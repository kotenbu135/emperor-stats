#!/usr/bin/env python3
"""Issue #34 残タスクの判定用ワークシートを作る。

`list_remaining.py` の対象のうち、判定が要るクラス（C-複数月・C-単一月・干支不在で除外・A-保留、
および `verify_realday_fields.py` で「月不一致」と出た日実値フィールド）を **イベント単位** にまとめ、
note 全文ではなく「旧暦月の前後 N 字」だけを切り出して出す（コンテキスト節約）。

判定そのものはしない。人が読んで端点の対応月を決めるための材料を並べるだけ。

使い方:
    python3 .../make_worksheet.py --batch 0 --size 12   # 人物を id 順に 12 人ずつ
    python3 .../make_worksheet.py --list               # 人物とバッチ番号の一覧だけ
"""
import argparse
import json
import pathlib
import re
import sys
from collections import defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from apply_majority_month import COUNT_KEYS, DATA_PATH, KAN, LUNAR_RX, majority_solar_ym  # noqa: E402
from list_remaining import EXCLUDED, PENDING_A, ISO_RX, lunar_seq, prec, texts  # noqa: E402
import calendar  # noqa: E402

# verify_realday_fields.py で「逆変換した旧暦月が note の月と一致しない」と出たもの。
REALDAY_SUSPECT = {
    ('jin-huidi', 'personalCampaignCount', 0, 'endDate'),
    ('liang-xiaoji', 'personalCampaignCount', 0, 'endDate'),
    ('wudai-houtang-mingzong', 'rebellionSuppressionCount', 12, 'endDate'),
    ('wudai-houtang-mingzong', 'rebellionSuppressionCount', 13, 'startDate'),
    ('wudai-houtang-mingzong', 'rebellionSufferedCount', 12, 'endDate'),
    ('wudai-houtang-mingzong', 'rebellionSufferedCount', 13, 'startDate'),
    ('wudai-houtang-mingzong', 'rebellionSufferedCount', 15, 'startDate'),
    ('wudai-houtang-mingzong', 'rebellionSufferedCount', 15, 'endDate'),
    ('wudai-houhan-yindi', 'rebellionSuppressionCount', 0, 'endDate'),
    ('ming-daizong', 'rebellionSufferedCount', 3, 'startDate'),
}

CTX = 55


def lunar_months_mapping_to(y, mo):
    """多数月方式で太陽暦 (y, mo) に写る旧暦月を返す（普通は 1 個、閏月がある年は複数）。

    「現在の ISO 値が既に換算済みだとすると元の旧暦月は何月か」を出すための逆写像。
    """
    out = []
    for ly in (y - 1, y):
        for lm in range(1, 13):
            if majority_solar_ym(ly, lm) == (y, mo) and (ly, lm) not in out:
                out.append((ly, lm))
    return out


def classify(eid, ck, i, key, ev, seq, y, mo, dd):
    sig = (eid, ck, i, key)
    if sig in PENDING_A:
        return 'A-保留'
    if sig in EXCLUDED:
        return '干支不在'
    if sig in REALDAY_SUSPECT:
        return '日実値・月不一致'
    if seq and mo in set(seq):
        mj = majority_solar_ym(y, mo)
        if mj and mj != (y, mo):
            if (dd == 1) or (dd == calendar.monthrange(y, mo)[1]):
                return 'C-単一月' if len(set(seq)) == 1 else 'C-複数月'
    return None


def snippets(note):
    """旧暦月の各出現について前後 CTX 字を切り出す。"""
    out = []
    for m in LUNAR_RX.finditer(note):
        s = max(0, m.start() - CTX)
        e = min(len(note), m.end() + CTX)
        out.append(f'…{note[s:e]}…')
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--batch', type=int)
    ap.add_argument('--size', type=int, default=12)
    ap.add_argument('--list', action='store_true')
    ap.add_argument('--person')
    args = ap.parse_args()

    data = json.loads(DATA_PATH.read_text(encoding='utf-8'))
    per_person = defaultdict(lambda: defaultdict(list))   # id -> (ck,i) -> [fields]
    ev_of = {}
    order = []
    for e in data['emperors']:
        for ck in COUNT_KEYS:
            blk = e.get(ck)
            if not isinstance(blk, dict):
                continue
            for i, ev in enumerate(blk.get('events') or []):
                t = texts(ev)
                seq = lunar_seq(t)
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
                    cls = classify(e['id'], ck, i, key, ev, seq, y, mo, dd)
                    if not cls:
                        continue
                    per_person[e['id']][(ck, i)].append((key, iso, cls))
                    ev_of[(e['id'], ck, i)] = (ev, t, seq)
        if e['id'] in per_person and e['id'] not in order:
            order.append(e['id'])

    if args.list:
        for n, eid in enumerate(order):
            cnt = sum(len(v) for v in per_person[eid].values())
            print(f'{n // args.size:2d}  {eid}  {cnt}')
        print(f'\n{len(order)} 人 / {sum(sum(len(v) for v in p.values()) for p in per_person.values())} フィールド'
              f' / バッチ数 {(len(order) + args.size - 1) // args.size}')
        return 0

    targets = [args.person] if args.person else order[args.batch * args.size:(args.batch + 1) * args.size]
    for eid in targets:
        print(f'#### {eid}')
        for (ck, i), fields in sorted(per_person[eid].items()):
            ev, t, seq = ev_of[(eid, ck, i)]
            print(f'  -- {ck}.events[{i}]  旧暦月列={seq}')
            for key, iso, cls in fields:
                y, mo = int(iso[:4]), int(iso[5:7])
                mj = majority_solar_ym(y, mo)
                back = lunar_months_mapping_to(y, mo)
                back_s = '/'.join(f'{ly}年{lm}月' for ly, lm in back) or '（なし）'
                print(f'     [{cls}] {key}={iso}')
                print(f'        未換算とみなす→ 旧暦{mo}月 = {mj[0]:04d}-{mj[1]:02d} / '
                      f'換算済みとみなす→ 元は 旧暦{back_s}')
            others = {k: ev.get(k) for k in ('date', 'startDate', 'endDate') if ev.get(k)}
            print(f'     端点={others} precision={ev.get("datePrecision")}')
            for s in snippets(t):
                print(f'     {s}')
        print()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
