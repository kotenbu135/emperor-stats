#!/usr/bin/env python3
"""`name.personalName`（姓＋諱）を `familyName` と `personalName`（諱）へ分ける
（Issue #37 単位6・設計は docs/schema/FAMILY_NAME_SPLIT_2026-08-03.md）。

## なぜ patch_emperor.py を通さないか

`patch_emperor.py` は**1回の起動で皇帝1人**の転記ツールで、365人×2欄の構造移行はその外に在る。
一度きりの移行として別に置くが、`patch_emperor.py` の防護のうち**書き出しの作法は同じ**:

- 出力は `json.dumps(..., ensure_ascii=False, indent=1) + "\\n"`
- 読み込み時の sha256 を書き込み直前に照合する（`R-RMW`・並行セッション）
- 触ったパスが要求するゲートを最後に出す

## R-NO-AUTOGEN との関係

**歴史的判断はしない。** 名前そのものは365人ぶん確定済みで、ここでやるのは1つの文字列を
2つの欄へ割る構造変換だけ。新しく決まるのは切れ目だけで、その切れ目には先に底本の裏を
取ってある（`scripts/screens/family_name_split.py`・母集団365→要読解0）。**この
スクリプトは絞り込みと同じ `split_candidate()` を呼ぶ**ので、切れ目の規則が2箇所に
分かれない。

## 冪等・巻き戻し

- 既に `familyName` を持つレコードは飛ばす
- 移行前の `personalName` は `data/internal/family-name-split-originals.json` に凍結し、
  `validate_emperors.py::check_family_names` が連結して戻ることを毎回見る（ゲートB）
"""
import argparse
import hashlib
import importlib.util
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "emperors.json"
ORIGINALS = ROOT / "data" / "internal" / "family-name-split-originals.json"
SCREEN = ROOT / "scripts" / "screens" / "family_name_split.py"

# 切れ目の規則は絞り込み側の1実装だけを使う（2箇所に分けない）。
_spec = importlib.util.spec_from_file_location("family_name_split", SCREEN)
_screen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_screen)

# 姓を持たない形で伝わる政権（モンゴル語名の漢字音写）。ここに載る政権は familyName を
# null にする。**判定は政権ではなく `ethnicName.kind == mongol` で行い、政権は照合に使う**。
NULL_REGIMES = {"yuan", "northern-yuan"}


def split_all(data):
    """(移行の対象, 飛ばした件数, 食い違い) を返す。値は書かない。"""
    planned, skipped, mismatch = [], 0, []
    for e in data["emperors"]:
        name = e.get("name") or {}
        if "familyName" in name:
            skipped += 1
            continue
        personal = (name.get("personalName") or "").strip()
        if not personal:
            continue
        kind = (name.get("ethnicName") or {}).get("kind")
        if kind == "mongol":
            family, given = None, personal
            if e.get("regimeId") not in NULL_REGIMES:
                mismatch.append(f"{e['id']}: モンゴル語名だが政権 {e.get('regimeId')!r} が"
                                f"姓なしの政権として宣言されていない")
        else:
            family, given = _screen.split_candidate(personal)
            if e.get("regimeId") in NULL_REGIMES:
                mismatch.append(f"{e['id']}: 政権 {e.get('regimeId')!r} は姓なしのはずだが"
                                f"民族名が mongol でない")
        planned.append((e, family, given, personal))
    return planned, skipped, mismatch


def apply(planned):
    """`name` の中で `personalName` の直前に `familyName` を挿す（欄の並びを保つ）。"""
    originals = {}
    for e, family, given, personal in planned:
        name = e["name"]
        rebuilt = {}
        for k, v in name.items():
            if k == "personalName":
                rebuilt["familyName"] = family
                rebuilt["personalName"] = given
            else:
                rebuilt[k] = v
        e["name"] = rebuilt
        originals[e["id"]] = {"personalName": personal}
    return originals


def main() -> int:
    ap = argparse.ArgumentParser(description="姓と諱を分ける（一度きりの移行）")
    ap.add_argument("--dry-run", action="store_true", help="件数と標本を出して書かない")
    ap.add_argument("--sample", type=int, default=8, help="--dry-run で出す標本の数")
    args = ap.parse_args()

    raw = DATA.read_text(encoding="utf-8")
    before_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    data = json.loads(raw)
    if json.dumps(data, ensure_ascii=False, indent=1) + "\n" != raw:
        sys.exit("data/emperors.json の整形が既定（ensure_ascii=False, indent=1）と違います。"
                 "このまま書くと触っていない箇所まで差分に出ます")

    planned, skipped, mismatch = split_all(data)
    with_family = sum(1 for _, f, _, _ in planned if f)
    print("■ 移行の内容")
    print(f"  分ける {len(planned)}人（うち姓を持つ {with_family}人・"
          f"姓を持たない形で伝わる {len(planned) - with_family}人）")
    print(f"  既に familyName を持つため飛ばす {skipped}人")
    for e, family, given, personal in planned[:args.sample]:
        print(f"    {e['id']:<28} {personal} → 姓 {family or '（無し）'}／諱 {given}")
    if mismatch:
        print("\n  民族名と政権の食い違い（書きません）:")
        for m in mismatch:
            print(f"    {m}")
        return 1
    if args.dry_run:
        print("\n--dry-run のため書き込んでいません")
        return 0

    originals = apply(planned)
    if hashlib.sha256(DATA.read_bytes()).hexdigest() != before_hash:
        sys.exit("\n読み込みから書き込みまでの間に data/emperors.json が変わりました"
                 "（別セッションの編集）。書かずに終わります")

    frozen = {
        "purpose": "姓と諱を分ける移行（Issue #37 単位6）の前の personalName（姓＋諱）。"
                   "validate_emperors.py::check_family_names が familyName + personalName を"
                   "連結してここへ戻ることを見る（ゲートB）",
        "migratedAt": "2026-08-03",
        "records": originals,
    }
    ORIGINALS.parent.mkdir(parents=True, exist_ok=True)
    ORIGINALS.write_text(json.dumps(frozen, ensure_ascii=False, indent=1) + "\n",
                         encoding="utf-8")
    out = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
    tmp = DATA.with_suffix(".json.tmp")
    tmp.write_text(out, encoding="utf-8")
    os.replace(tmp, DATA)
    print(f"\n書き込みました: {DATA.relative_to(ROOT)} / {ORIGINALS.relative_to(ROOT)}")
    print("""
■ このあと通すゲート（コミット条件・R-GATES-BEFORE-COMMIT）
  python3 scripts/validate_emperors.py
  python3 scripts/test_family_name.py
  python3 scripts/verify_quotes.py --check-family-names   # ローカル専用・要コーパス
  cd site && npm run build                               # 表示側（COUPLINGS.md）""")
    return 0


if __name__ == "__main__":
    sys.exit(main())
