#!/usr/bin/env python3
"""Issue #34 残タスクの作業リストを人物単位で出す。

対象:
  - C の残り 208 フィールド（3 分類: 複数月／日に実値あり／単一月）
  - 干支不在で機械換算から除外した 20 フィールド
  - A の保留 2 フィールド

出力は `--format text`（人物ごとのブロック・原典判定用）と `--format json`（進捗管理用）。
判定そのものは行わない（対象の列挙と現在値の提示だけ）。
"""
import argparse
import calendar
import json
import pathlib
import re
import sys
from collections import defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from apply_majority_month import (  # noqa: E402
    COUNT_KEYS, DATA_PATH, KAN, LUNAR_RX, majority_solar_ym,
)
from apply_majority_month import EXCLUDE_GANZHI_MISMATCH  # noqa: E402
from apply_phase2_multimonth import EXCLUDE as EXCLUDE_PHASE2  # noqa: E402

EXCLUDED = set(EXCLUDE_GANZHI_MISMATCH) | set(EXCLUDE_PHASE2)

ISO_RX = re.compile(r'^(-?\d{4})-(\d{2})-(\d{2})$')

PENDING_A = {
    ('jin-huaidi', 'rebellionSuppressionCount', 2, 'endDate'),
    ('liu-song-mingdi', 'rebellionSuppressionCount', 0, 'endDate'),
}


def prec(ev, key):
    p = ev.get('datePrecision')
    if isinstance(p, dict):
        return p.get('start' if key == 'startDate' else 'end')
    return p


def texts(ev):
    return ' '.join(str(v) for k, v in ev.items()
                    if isinstance(v, str) and k not in ('date', 'startDate', 'endDate', 'datePrecision'))


def lunar_seq(t):
    seq = []
    for m in LUNAR_RX.finditer(t):
        v = KAN[m.group(1)]
        if not seq or seq[-1] != v:
            seq.append(v)
    return seq


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--format', choices=['text', 'json'], default='text')
    args = ap.parse_args()

    data = json.loads(DATA_PATH.read_text(encoding='utf-8'))
    by_person = defaultdict(list)
    for e in data['emperors']:
        for ck in COUNT_KEYS:
            blk = e.get(ck)
            if not isinstance(blk, dict):
                continue
            for i, ev in enumerate(blk.get('events') or []):
                t = texts(ev)
                seq = lunar_seq(t)
                lun = set(seq)
                for key in ('date', 'startDate', 'endDate'):
                    iso = ev.get(key)
                    if not iso:
                        continue
                    m = ISO_RX.match(str(iso))
                    if not m:
                        continue
                    y, mo, dd = int(m.group(1)), int(m.group(2)), int(m.group(3))
                    if y < 1 or prec(ev, key) != 'month':
                        continue
                    sig = (e['id'], ck, i, key)
                    cls = None
                    if sig in PENDING_A:
                        cls = 'A-保留'
                    elif sig in EXCLUDED:
                        cls = '干支不在で除外'
                    elif lun and mo in lun:
                        mj = majority_solar_ym(y, mo)
                        if mj and mj != (y, mo):
                            ph = (dd == 1) or (dd == calendar.monthrange(y, mo)[1])
                            if not ph:
                                cls = 'C-日に実値あり'
                            elif len(lun) == 1:
                                cls = 'C-単一月'
                            else:
                                cls = 'C-複数月'
                    if cls is None:
                        continue
                    mj = majority_solar_ym(y, mo)
                    by_person[e['id']].append({
                        'class': cls, 'countKey': ck, 'index': i, 'key': key,
                        'iso': iso, 'majority': f'{mj[0]:04d}-{mj[1]:02d}' if mj else None,
                        'lunarSeq': seq, 'note': t,
                        'siblings': {k: ev.get(k) for k in ('date', 'startDate', 'endDate') if ev.get(k)},
                        'datePrecision': ev.get('datePrecision'),
                    })

    if args.format == 'json':
        print(json.dumps(by_person, ensure_ascii=False, indent=1))
        return 0

    order = {'A-保留': 0, '干支不在で除外': 1, 'C-単一月': 2, 'C-複数月': 3, 'C-日に実値あり': 4}
    total = sum(len(v) for v in by_person.values())
    counts = defaultdict(int)
    for v in by_person.values():
        for r in v:
            counts[r['class']] += 1
    print(f'対象 {total} フィールド / {len(by_person)} 人')
    for k in sorted(counts, key=lambda x: order[x]):
        print(f'  {k}: {counts[k]}')
    print()
    for eid in sorted(by_person, key=lambda x: (-len(by_person[x]), x)):
        rows = sorted(by_person[eid], key=lambda r: (order[r['class']], r['countKey'], r['index']))
        print(f'== {eid} ({len(rows)}) ==')
        for r in rows:
            print(f'  [{r["class"]}] {r["countKey"]}.events[{r["index"]}].{r["key"]}  '
                  f'{r["iso"]} → 多数月 {r["majority"]}  旧暦月列={r["lunarSeq"]}')
            print(f'      端点={r["siblings"]}  precision={r["datePrecision"]}')
            print(f'      note: {r["note"][:400]}')
        print()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
