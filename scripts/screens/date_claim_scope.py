#!/usr/bin/env python3
"""events の日付について「配布物が主張する範囲」を数える（Issue #69）。

**判定はしない。**主張の面積を測るだけで、どの日付が正しいかには何も言わない。

#69 の本文にあった 4,249 / 1,106 / 3,143 は**引き直せる形が残っていなかった**
（数を出すスクリプトがどこにも無かった）。同じ陳腐化を繰り返さないために、
コメントで公開した定義をそのまま実行できる形で置く。

  python3 scripts/screens/date_claim_scope.py --before
      移行前の定義で数える（#69 コメントの `6026 328 1361 4337 1173 3164` を再現する。
      **`datePrecision` で月日精度を判定する** — 保存値の深さがまだ主張になっていない段階の数え方）

  python3 scripts/screens/date_claim_scope.py
      移行後の定義で数える（**保存値の深さが主張**。残量表の日付系の行はこれで引き直す）

判定の実装は `scripts/event_date_scope.py` に1つだけ置いてある（移行スクリプト・
`validate_emperors.py`・`verify_calendar.py` も同じ関数を呼ぶ）。
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from event_date_scope import (  # noqa: E402
    DATE_KEYS, boundary_years, depth_of, event_years, is_boundary_event,
    iter_events, precision_of,
)

DATA = ROOT / "data" / "emperors.json"


def count_before(data) -> dict:
    """移行前の数え方（`datePrecision` が月日を含むか）。#69 コメントの数字を再現する。"""
    out = dict(events=0, nodate=0, coarse=0, fine=0, boundary=0, other=0)
    for e, g, i, ev in iter_events(data):
        years = boundary_years(e)
        out["events"] += 1
        vals = [(k, ev.get(k)) for k in DATE_KEYS if ev.get(k)]
        if not vals:
            out["nodate"] += 1
            continue
        if not any(precision_of(ev, k) in ("month", "day") for k, _ in vals):
            out["coarse"] += 1
            continue
        out["fine"] += 1
        if is_boundary_event(years, ev):
            out["boundary"] += 1
        else:
            out["other"] += 1
    return out


def count_after(data) -> dict:
    """移行後の数え方（**保存値の深さが主張**）。"""
    out = dict(events=0, nodate=0, year_only=0, fine=0, day_values=0, month_values=0,
               year_values=0, witnessed=0, scope_violations=0)
    for e, g, i, ev in iter_events(data):
        years = boundary_years(e)
        out["events"] += 1
        vals = [(k, ev.get(k)) for k in DATE_KEYS if ev.get(k)]
        if not vals:
            out["nodate"] += 1
            continue
        depths = [depth_of(v) for _, v in vals]
        out["day_values"] += sum(1 for d in depths if d == 3)
        out["month_values"] += sum(1 for d in depths if d == 2)
        out["year_values"] += sum(1 for d in depths if d == 1)
        if max(depths) == 1:
            out["year_only"] += 1
            continue
        out["fine"] += 1
        if not is_boundary_event(years, ev):
            out["scope_violations"] += 1
        has_raw = any(str(k).endswith("Raw") and ev.get(k) for k in ev)
        src = ev.get("source")
        has_conv = bool(src.get("conversion")) if isinstance(src, dict) else False
        if has_raw and has_conv:
            out["witnessed"] += 1
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--before", action="store_true",
                    help="移行前の定義（datePrecision ベース）で数える")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    data = json.loads(DATA.read_text(encoding="utf-8"))

    if args.before:
        c = count_before(data)
        if args.json:
            print(json.dumps(c, ensure_ascii=False))
            return 0
        print("移行前の定義（datePrecision が月日を含むか・#69 コメントの数え方）")
        print(f"  events 総数                 {c['events']}")
        print(f"  日付をひとつも持たない      {c['nodate']}")
        print(f"  年精度のみ                  {c['coarse']}")
        print(f"  月日精度                    {c['fine']}")
        print(f"    うち在位の境界年に在る    {c['boundary']}")
        print(f"    境界年でない              {c['other']}")
        return 0

    c = count_after(data)
    if args.json:
        print(json.dumps(c, ensure_ascii=False))
        return 0
    print("移行後の定義（**保存値の深さが主張**・Issue #69）")
    print(f"  events 総数                 {c['events']}")
    print(f"  日付をひとつも持たない      {c['nodate']}")
    print(f"  年だけを主張                {c['year_only']}")
    print(f"  月日を主張                  {c['fine']}")
    print(f"    うち *Raw ＋ conversion を持つ  {c['witnessed']}"
          f"（残 {c['fine'] - c['witnessed']} — 人が原典から写す残量）")
    print(f"  値の深さ: 日 {c['day_values']} ／ 月 {c['month_values']} ／ 年 {c['year_values']}")
    if c["scope_violations"]:
        print(f"  **主張範囲の違反（境界年でないのに月日の深さ）: {c['scope_violations']}**"
              f" — python3 scripts/validate_emperors.py が同じ件数で落ちる")
    return 0


if __name__ == "__main__":
    sys.exit(main())
