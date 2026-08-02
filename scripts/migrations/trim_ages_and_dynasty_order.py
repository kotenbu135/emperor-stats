#!/usr/bin/env python3
"""ages の日付の深さを主張に揃え、未調査の dynastyOrder を欄ごと落とす（Issue #69・計画7節の3）。

7節の2で `events` に入れた「**深さそのものが主張**」を `ages` にも適用し、あわせて
`reigns[].dynastyOrder` の `null` から「未調査」の意味を抜く。どちらも
**検査できない主張を配布物から外す**（計画の B と D）。

## 1. ages の深さを `birthDatePrecision`／`deathDatePrecision` に揃える（42値）

規則は `events` と同じで「深さは `datePrecision` を超えない」だけ。**どれが埋め草かを
機械で判定しない**（`R-NO-AUTOGEN`）。実測の内訳は年精度で深さ3が31・月精度で深さ3が11。

**アーカイブは作らない。** `events` の丸めは原典から換算した月日を落とすので退避したが、
`ages` の超過分は `-01-01`／`-01` の埋め草（40値）と、note 自身が「参考値」「通説により補完」と
書いている2値（`tang-shunzong` の上元2年正月**朔日**換算・`qing-dezong` の通説の六月二十八日）で、
**原典から読んだ月日は1件も無い**。捨てた値はいずれも note に残る。

## 2. `dynastyOrderSurveyed: false` の政権から `dynastyOrder` の欄を落とす（198在位・190人）

`null` が「未調査」と「歴代に数えない」を兼ねていた。実測ではこの2つは
`meta.catalogs.regimes[].dynastyOrderSurveyed` で完全に分離できている（例外0件）ので、
**未調査側は欄を持たない**へ寄せて `null` の意味を「歴代に数えない」1つに定める。
残る `null` 14在位（liu-song 2・northern-qi 2・northern-wei 6・southern-liang 4）は主張。

読む側が `meta.catalogs.regimes` を引かなくても `null` の意味が決まるのが目的なので、
**同じ変更で `validate_emperors.py` の `check_dynasty_order` を足す**（`R-CLAIM-GATED`）。

使い方:
    python3 scripts/migrations/trim_ages_and_dynasty_order.py --dry-run
    python3 scripts/migrations/trim_ages_and_dynasty_order.py
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from event_date_scope import PRECISION_DEPTH, depth_of, truncate  # noqa: E402

DATA = ROOT / "data" / "emperors.json"
ISO_LIKE = re.compile(r"^-?\d{4}(-\d{2}){0,2}$")
AGE_DATES = (("birthDate", "birthDatePrecision"), ("deathDate", "deathDatePrecision"))


def plan_ages(data):
    """(皇帝id, キー, 精度, 現値, 切り詰め後) の一覧。データはまだ触らない。"""
    out = []
    for e in data["emperors"]:
        a = e.get("ages") or {}
        for key, pkey in AGE_DATES:
            v, p = a.get(key), a.get(pkey)
            if not isinstance(v, str) or not ISO_LIKE.match(v):
                continue  # 元号・自由記述は別問題（check_ages の非 ISO 警告が数えている）
            want = PRECISION_DEPTH.get(p)
            if want is None or depth_of(v) <= want:
                continue
            out.append((e["id"], key, p, v, truncate(v, want)))
    return out


def plan_dynasty_order(data):
    """(皇帝id, 在位index, 現値) の一覧と、規約違反の一覧を返す。"""
    surveyed = {r["id"]: r.get("dynastyOrderSurveyed")
                for r in data["meta"]["catalogs"]["regimes"]}
    drops, conflicts, missing = [], [], []
    for e in data["emperors"]:
        s = surveyed.get(e.get("regimeId"))
        for i, r in enumerate(e.get("reigns") or []):
            has = "dynastyOrder" in r
            if s is False:
                if has and r["dynastyOrder"] is not None:
                    conflicts.append((e["id"], i, r["dynastyOrder"]))
                elif has:
                    drops.append((e["id"], i, r["dynastyOrder"]))
            elif s is True and not has:
                missing.append((e["id"], i))
    return drops, conflicts, missing


def apply(data, ages_changes, drops):
    by_id = {e["id"]: e for e in data["emperors"]}
    for eid, key, _p, _old, new in ages_changes:
        by_id[eid]["ages"][key] = new
    for eid, i, _old in drops:
        del by_id[eid]["reigns"][i]["dynastyOrder"]


def main() -> int:
    ap = argparse.ArgumentParser(
        description="ages の深さを揃え、未調査の dynastyOrder を落とす（一度きりの移行）")
    ap.add_argument("--dry-run", action="store_true", help="件数と例だけ出して書かない")
    ap.add_argument("--sample", type=int, default=6, help="例示する件数")
    args = ap.parse_args()

    raw = DATA.read_text(encoding="utf-8")
    before_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    data = json.loads(raw)
    if json.dumps(data, ensure_ascii=False, indent=1) + "\n" != raw:
        sys.exit("data/emperors.json の整形が既定（ensure_ascii=False, indent=1）と違います。"
                 "このまま書くと触っていない箇所まで差分に出ます")

    ages_changes = plan_ages(data)
    drops, conflicts, missing = plan_dynasty_order(data)

    if conflicts:
        sys.exit(f"dynastyOrderSurveyed: false の政権に値が入っています（規約違反・"
                 f"落とすと調査結果が消える）: {conflicts}")

    stats = Counter(p for _e, _k, p, _o, _n in ages_changes)
    print("■ 1. ages の深さを precision に揃える")
    print(f"  {len(ages_changes)}値（{dict(stats)}）")
    for c in ages_changes[:args.sample]:
        print(f"    例 {c[0]}.ages.{c[1]}: {c[3]} → {c[4]}（{c[2]}精度）")
    print("■ 2. dynastyOrder の欄を落とす（dynastyOrderSurveyed: false の政権）")
    print(f"  {len(drops)}在位 / {len({d[0] for d in drops})}人")
    if missing:
        print(f"  ※ surveyed: true なのに欄が無い在位が {len(missing)} 件"
              f"（ゲートが落ちる）: {missing[:5]}")

    if args.dry_run:
        print("\n--dry-run のため書き込んでいません")
        return 0

    apply(data, ages_changes, drops)
    if hashlib.sha256(DATA.read_bytes()).hexdigest() != before_hash:
        sys.exit("\n読み込みから書き込みまでの間に data/emperors.json が変わりました"
                 "（別セッションの編集）。書かずに終わります")
    tmp = DATA.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    os.replace(tmp, DATA)
    print(f"\n書き込みました: {DATA.relative_to(ROOT)}")
    print("""
■ このあと通すゲート（コミット条件・R-GATES-BEFORE-COMMIT）
  python3 scripts/validate_emperors.py
  python3 scripts/verify_calendar.py
  python3 scripts/coverage.py --check
  python3 scripts/test_date_claim_scope.py""")
    return 0


if __name__ == "__main__":
    sys.exit(main())
