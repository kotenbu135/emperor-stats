#!/usr/bin/env python3
"""events の日付を主張範囲まで丸め、丸める前の値をアーカイブへ退避する（Issue #69・計画7節の2）。

2026-08-03 のユーザー決定（B案）。**値は消さない。主張する精度を絞る。**

    data/emperors.json（配布物）  … 年精度 ＋ 在位境界年の月日。**深さそのものが主張**
    data/internal/event-date-archive.json（配布しない・書き込まない）
                                  … 丸める前の月日

## 1回のパスで2種類の書き換えをする（順序が固定）

1. **埋め草の切り詰め** — `datePrecision` より深い値を精度の深さへ（`"year"` なのに
   `-0208-09-01` のような形。実測 3,362値）。**「埋め草かどうか」を機械で判定しない** —
   `-01-01` を捨ててよい値と区別しようとすると歴史的判断になる（`R-NO-AUTOGEN`）。
   規則は「深さは `datePrecision` を超えない」だけ
2. **主張範囲の丸め** — 在位の境界年に無い event の日付を年へ（実測 3,164 events）

**値が変わったものは全部アーカイブへ**という単純規則にするので、1と2を分けて2回書かない
（中間状態を退避すると、戻すときにどちらが原値か分からなくなる）。

## R-NO-AUTOGEN との関係

歴史的判断はしない。境界年の判定は `reigns[]` との突合、丸めは文字列の切り詰め、
アーカイブは転記で、**どの日付が正しいか**には何も言わない。逆に、月日を主張する
1,173件へ `*Raw` を写すのは人が原典から読む作業のまま残る。

使い方:
    python3 scripts/migrations/round_event_dates.py --dry-run
    python3 scripts/migrations/round_event_dates.py
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from event_date_scope import (  # noqa: E402
    ARCHIVE_PATH, DATE_KEYS, assert_count_groups, boundary_years, claimed_depth,
    depth_of, is_boundary_event, iter_events, precision_of, truncate,
)

DATA = ROOT / "data" / "emperors.json"


def plan(data):
    """(event id, 変更, 理由) の一覧を作る。データはまだ触らない。"""
    changes, stats = [], Counter()
    for e, g, i, ev in iter_events(data):
        years = boundary_years(e)
        boundary = is_boundary_event(years, ev)
        eid = ev.get("id")
        if not eid:
            sys.exit(f"{e['id']}.{g}[{i}] に id がありません"
                     f"（python3 scripts/migrations/bake_event_ids.py --fill）")
        for k in DATE_KEYS:
            v = ev.get(k)
            if not isinstance(v, str) or not v:
                continue
            want = claimed_depth(ev, k, years)
            now = depth_of(v)
            if now <= want:
                continue
            new = truncate(v, want)
            # 理由は2つに1つ。「範囲外」が優先（丸めは切り詰めを含む）
            why = "out-of-scope" if not boundary else "filler"
            changes.append((eid, e["id"], g, i, k, v, new, why,
                            precision_of(ev, k), (ev.get("note") or "")[:20]))
            stats[why] += 1
    return changes, stats


def apply(data, changes):
    """emperors.json 側を書き換え、アーカイブの中身を作る。"""
    by_event = {}
    for eid, *_ in changes:
        by_event.setdefault(eid, {})
    index = {ev["id"]: ev for _, _, _, ev in iter_events(data)}
    for eid, emperor, g, i, k, old, new, why, prec, note_head in changes:
        ev = index[eid]
        ev[k] = new
        entry = by_event[eid]
        entry[k] = old
        entry.setdefault("datePrecision", prec)
        entry.setdefault("reason", why)
        entry.setdefault("noteHead", note_head)
    return by_event


def archive_doc(by_event, changes):
    return {
        "meta": {
            "purpose": "配布物（data/emperors.json）が主張しない events の月日を、"
                       "丸める前の形で残したもの（Issue #69・2026-08-03 のユーザー決定）。"
                       "主張は「年精度 ＋ 在位境界年の月日」だけに絞り、それ以外は年へ丸めた",
            "notClaimed": "ここに在る値は配布物の主張ではない。**内部側はこれ以上精度を"
                          "追求しない** — 誤りと分かっている値（RESIDUAL.md の #62 の9件）も"
                          "そのまま入っている",
            "writeOnce": "分割時に1回書いたきりで、追記しない。精度を戻すときは "
                         "patch_emperor.py で emperors.json へ昇格させ、ここから消す",
            "gate": "scripts/validate_emperors.py の check_event_date_archive が "
                    "(1) 鍵が実在の event を指すか (2) 現在値が退避値の接頭辞か を見る",
            "generator": "scripts/migrations/round_event_dates.py",
            "keys": {
                "reason": "out-of-scope＝在位の境界年に無いので年へ丸めた／"
                          "filler＝datePrecision より深い埋め草を切り詰めた",
                "datePrecision": "退避した時点の datePrecision（原典が何を言っているか。"
                                 "移行では触っていない）",
                "noteHead": "人が突き合わせるための note の先頭20字（機械は id で引く）",
            },
            "events": len(by_event),
            "values": len(changes),
        },
        "events": {k: by_event[k] for k in sorted(by_event)},
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="events の日付を主張範囲へ丸める（一度きりの移行）")
    ap.add_argument("--dry-run", action="store_true", help="件数と例だけ出して書かない")
    ap.add_argument("--sample", type=int, default=5, help="例示する件数")
    args = ap.parse_args()

    raw = DATA.read_text(encoding="utf-8")
    before_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    data = json.loads(raw)
    if json.dumps(data, ensure_ascii=False, indent=1) + "\n" != raw:
        sys.exit("data/emperors.json の整形が既定（ensure_ascii=False, indent=1）と違います。"
                 "このまま書くと触っていない箇所まで差分に出ます")
    assert_count_groups(data)
    if ARCHIVE_PATH.exists():
        sys.exit(f"{ARCHIVE_PATH.relative_to(ROOT)} が既に在ります。"
                 f"この移行は一度きりで、アーカイブへ追記する経路は作らない（#69 の 2-2）")

    changes, stats = plan(data)
    events = {c[0] for c in changes}
    print("■ 移行の内容")
    print(f"  値 {len(changes)}（event {len(events)}件）を丸める")
    print(f"    out-of-scope（境界年でない → 年へ）: {stats['out-of-scope']}")
    print(f"    filler（datePrecision より深い → 精度の深さへ）: {stats['filler']}")
    for c in changes[:args.sample]:
        print(f"    例 {c[0]}.{c[4]}: {c[5]} → {c[6]}（{c[7]}・datePrecision={c[8]}）")

    if args.dry_run:
        print("\n--dry-run のため書き込んでいません")
        return 0

    by_event = apply(data, changes)
    if hashlib.sha256(DATA.read_bytes()).hexdigest() != before_hash:
        sys.exit("\n読み込みから書き込みまでの間に data/emperors.json が変わりました"
                 "（別セッションの編集）。書かずに終わります")
    ARCHIVE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = DATA.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    os.replace(tmp, DATA)
    ARCHIVE_PATH.write_text(
        json.dumps(archive_doc(by_event, changes), ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8")
    print(f"\n書き込みました: {DATA.relative_to(ROOT)} / {ARCHIVE_PATH.relative_to(ROOT)}")
    print("""
■ このあと通すゲート（コミット条件・R-GATES-BEFORE-COMMIT）
  python3 scripts/validate_emperors.py
  python3 scripts/verify_calendar.py
  python3 scripts/check_screenings.py
  python3 scripts/coverage.py --check
  python3 scripts/verify_quotes.py --check
  python3 scripts/screens/date_claim_scope.py""")
    return 0


if __name__ == "__main__":
    sys.exit(main())
