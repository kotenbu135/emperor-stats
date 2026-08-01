#!/usr/bin/env python3
"""Issue #34 の再発検出器（恒久チェック候補）。

month 精度の event 日付が「旧暦月番号をそのまま置いたまま」になっていないかを検査する。
Issue #33 の `sweep_event_iso_year.py` は **ISO 月が note の旧暦月と一致したら未換算** と見なしていたが、
これは偽陽性を大量に出す:

  - 閏月のある年は旧暦月 → 太陽暦月が 2 か月ずれる（旧暦35年は閏三月があるため 旧暦六月 → 0035-08）。
    「旧暦八月 → 0035-08 のはず」と読むと、正しく換算済みの値を未換算と誤判定する
  - 期間イベントの note には複数の旧暦月が出るので、どれか 1 つと ISO 月が一致してしまいやすい

そこで判定を逆向きにする。**note に現れるいずれかの旧暦月から多数月方式で導いた値と現在値が一致すれば OK**。
日に実値がある（実日付まで換算済みの）フィールドは、逆変換した旧暦月が note の月に含まれれば OK とする
（閏月の朔もここで拾える。例: `ming-daizong` の 1452-10-13 ＝景泰三年閏九月朔）。

どちらも満たさないものだけを報告する。2026-08-02 のフェーズ5完了時点で 0 件。
"""
import json
import pathlib
import re
import sys

import sxtwl

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from apply_majority_month import COUNT_KEYS, DATA_PATH, KAN, LUNAR_RX, majority_solar_ym  # noqa: E402

ISO_RX = re.compile(r'^(-?\d{4})-(\d{2})-(\d{2})$')


def prec(ev, key):
    p = ev.get('datePrecision')
    if isinstance(p, dict):
        return p.get('start' if key == 'startDate' else 'end')
    return p


def texts(ev):
    return ' '.join(str(v) for k, v in ev.items()
                    if isinstance(v, str) and k not in ('date', 'startDate', 'endDate', 'datePrecision'))


def main():
    data = json.loads(DATA_PATH.read_text(encoding='utf-8'))
    bad = []
    checked = 0
    for e in data['emperors']:
        for ck in COUNT_KEYS:
            blk = e.get(ck)
            if not isinstance(blk, dict):
                continue
            for i, ev in enumerate(blk.get('events') or []):
                t = texts(ev)
                months = {KAN[m.group(1)] for m in LUNAR_RX.finditer(t)}
                if not months:
                    continue                      # 照合の足場が無い（969 件・別タスク）
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
                    checked += 1
                    # (1) note のいずれかの旧暦月を多数月方式で写した値と一致するか
                    #     （旧暦年は紀年ラベル年 y か、年またぎで y-1 のどちらか）
                    ok = False
                    for ly in (y - 1, y):
                        for lm in months:
                            if majority_solar_ym(ly, lm) == (y, mo):
                                ok = True
                    # (2) 実日付まで換算済みなら、逆変換した旧暦月が note に含まれるか
                    if not ok:
                        try:
                            d = sxtwl.fromSolar(y, mo, dd)
                            ok = d.getLunarMonth() in months
                        except Exception:
                            pass
                    if not ok:
                        bad.append((e['id'], f'{ck}.events[{i}].{key}', iso, sorted(months)))
    print(f'month 精度・note に旧暦月がある event 日付: {checked} 件')
    print(f'どの旧暦月からも説明できない値: {len(bad)} 件')
    for b in bad:
        print(f'  {b[0]} / {b[1]} = {b[2]}  note の旧暦月={b[3]}')
    return 1 if bad else 0


if __name__ == '__main__':
    raise SystemExit(main())
