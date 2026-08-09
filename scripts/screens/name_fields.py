#!/usr/bin/env python3
"""絞り込みの機械検査: 名前データ（Issue #37）の廟号・諡号。

**判定はしない。読む順序と量を変えるだけ**（規則 R-NO-AUTOGEN）。
ここで決まるのは「どの空セルを転記として読み、どれを従来どおり調べるか」だけで、
値は1つも書かない。

単位は「人物 × 項目」の**空セル**。埋まっているセルは母集団の外（訂正は別作業）。

  空セル
   ├ institution-skip … data/regime-conventions.json が原典の明文つきで
   │                    personScope=skip と確定した政権。kind=corroborated
   │                    **verdict は2種類ある**（バケット名は初出の verdict のまま）:
   │                    absent-by-institution＝制度そのものが無い（秦の諡号）／
   │                    absent-by-book＝制度はあるがその書がその形を使わない（唐の短縮呼称）
   ├ transcribe       … commonName が廟号形（〜祖／〜宗）・諡号形（〜帝）なのに
   │                    当該フィールドが空。**取りこぼしと言い切れる**側。kind=read
   └ unknown          … 機械が何も見つけなかっただけ。kind=absent
                        （「値が無い」の証拠ではない。だから標本を原典で読む）

出力:
    python3 scripts/screens/name_fields.py            # 人が読む形
    python3 scripts/screens/name_fields.py --json     # ゲート（check_screenings.py）用
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
EMPERORS = ROOT / "data" / "emperors.json"
CONVENTIONS = ROOT / "data" / "regime-conventions.json"

FIELDS = ("templeName", "posthumousName")
# commonName が「その形」で立っている＝その名乗りが実在する、の印。
# 括弧内（明清の元号呼称「太祖（洪武帝）」など）は別種の名乗りなので落とす。
PAREN = re.compile(r"[（(].*?[)）]")
FORM = {"templeName": re.compile(r"[祖宗]$"), "posthumousName": re.compile(r"帝$")}


def skip_cells():
    """regime-conventions.json が personScope=skip と確定した (政権, 項目)。

    打ち切りの根拠は向こうのゲート（check_regime_conventions.py）が原文と
    突き合わせ済み。ここでは参照するだけで、この画面で新しく打ち切らない。
    """
    if not CONVENTIONS.exists():
        return set()
    data = json.loads(CONVENTIONS.read_text(encoding="utf-8"))
    out = set()
    for rec in data.get("conventions") or []:
        ex = {x.get("id"): x.get("personScope") for x in rec.get("exceptions") or []}
        if rec.get("personScope") != "skip":
            continue
        for rid in rec.get("regimeIds") or []:
            for f in rec.get("fields") or []:
                out.add((rid, f, tuple(sorted(k for k, v in ex.items() if v != "skip"))))
    return out


def run():
    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    skips = skip_cells()
    cells = {}      # (id, field) → bucket
    for e in data["emperors"]:
        name = e.get("name") or {}
        base = PAREN.sub("", str(name.get("commonName") or "")).strip()
        for f in FIELDS:
            if name.get(f):
                continue        # 埋まっている＝母集団の外
            skipped = any(e.get("regimeId") == rid and f == sf and e["id"] not in exc
                          for rid, sf, exc in skips)
            if skipped:
                cells[(e["id"], f)] = "institution-skip"
            elif FORM[f].search(base):
                cells[(e["id"], f)] = "transcribe"
            else:
                cells[(e["id"], f)] = "unknown"
    return cells


def sample(ids, seed, size):
    """種つきの無作為抽出。**誰かが選んだ標本では 3/k の上限は言えない**ので、
    抽出はここで決めてゲートが同じ種で引き直して突き合わせる。

    ハッシュ順の上位 k を取る（`random.sample` にしない）。母集団が動いても
    **他のセルの増減が既存の標本の当落を変えない**ので、調査が進んで空セルが
    減っても監査をやり直さずに済み、新しく標本へ入ったものだけが増える。
    """
    rank = sorted(ids, key=lambda i: hashlib.md5(f"{seed}:{i}".encode()).hexdigest())
    return sorted(rank[:size])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--sample", type=int, default=0, help="absent バケットから引く標本数")
    args = ap.parse_args()

    cells = run()
    buckets = {}
    for (eid, f), b in cells.items():
        buckets.setdefault(f"{f}:{b}", []).append(eid)

    coverage = {}
    for (eid, f), b in sorted(cells.items()):
        # 1人が複数のセルを持つ（廟号と諡号でバケットが違う）。id をキーに上書きすると
        # 片方が消えて「この人は転記だけでよい」と読める
        coverage.setdefault(eid, []).append(f"{f}:{b}")

    if args.json:
        print(json.dumps({
            "unit": "person-field",
            "n": len(cells),
            "buckets": {k: len(v) for k, v in sorted(buckets.items())},
            "samples": {k: sample(v, args.seed, args.sample)
                        for k, v in sorted(buckets.items())
                        if k.endswith(":unknown") and args.sample},
            "coverage": coverage,
        }, ensure_ascii=False))
        return 0

    total = len(cells)
    read = sum(len(v) for k, v in buckets.items() if k.endswith(":transcribe"))
    print(f"母集団 {total}セル（人物×項目の空セル） → 要読解 {read}セル")
    for k, v in sorted(buckets.items()):
        print(f"  {k}: {len(v)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
