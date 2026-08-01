#!/usr/bin/env python3
"""Issue #34 残タスクの仕分け: 「現在値が既に換算済みだとすると元の旧暦月は何月か」（逆写像）で分類する。

多数月方式は旧暦月 → 太陽暦年月の写像なので、逆に太陽暦 (y,mo) へ写る旧暦月を求められる。
**閏月のある年は 2 か月ずれる**（例: 旧暦35年は閏三月があるため 旧暦六月 → 0035-08）ので、
「mo-1 月か mo 月」ではなく全月を走査して求める必要がある。

分類:
  未換算確定   : (y,mo) へ写る旧暦月が存在しない → 現在値は旧暦月番号の転記でしかありえない
  換算済み候補 : 逆写像で得た旧暦月が note の月列に含まれる → 現在値が正しい可能性がある（曖昧）
  要判定       : 逆写像は存在するが note の月列に無い → どちらとも言えず個別判定

判定はしない。仕分けだけ。
"""
import json
import pathlib
import sys
from collections import Counter, defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from apply_majority_month import COUNT_KEYS, DATA_PATH, majority_solar_ym  # noqa: E402
from list_remaining import ISO_RX, lunar_seq, prec, texts  # noqa: E402
from make_worksheet import classify, lunar_months_mapping_to  # noqa: E402


def main():
    data = json.loads(DATA_PATH.read_text(encoding='utf-8'))
    cnt = Counter()
    rows = defaultdict(list)
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
                    back = lunar_months_mapping_to(y, mo)
                    back_m = {lm for _, lm in back}
                    if not back:
                        g = '未換算確定'
                    elif back_m & set(seq):
                        g = '換算済み候補'
                    else:
                        g = '要判定'
                    cnt[(cls, g)] += 1
                    rows[g].append((e['id'], ck, i, key, iso, sorted(back_m), seq, cls))
    for k in sorted(cnt, key=lambda x: (-cnt[x], x)):
        print(f'{cnt[k]:4d}  {k[0]:16s} {k[1]}')
    print(f'計 {sum(cnt.values())}')
    for g in ('未換算確定', '換算済み候補', '要判定'):
        print(f'\n=== {g} ({len(rows[g])}) ===')
        for r in rows[g]:
            print(f'  {r[0]} / {r[1]}.events[{r[2]}].{r[3]} = {r[4]}  逆写像旧暦月={r[5]} note月列={r[6]} [{r[7]}]')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
