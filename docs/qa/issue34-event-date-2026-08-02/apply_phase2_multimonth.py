#!/usr/bin/env python3
"""Issue #34 フェーズ2: note に複数の旧暦月が出てくる期間イベントのうち、
どの旧暦月に対応するかが note の記述順から決まるものを換算する。

フェーズ1（apply_majority_month.py）は「note の旧暦月が単一」のものだけを扱った。
期間イベントの note は「〇年十二月に蜂起し、翌年五月に鎮圧」のように複数の月を書くため、
単一月の条件では拾えない。ここでは note フィールド（＝出来事の説明本文）だけを使い、

    startDate / date → note に最初に現れる旧暦月
    endDate          → note に最後に現れる旧暦月

を対応月とみなし、それが現在の ISO 月と一致する場合に限って多数月方式で換算する
（一致しない＝どの月を指しているか機械では決まらないので触らない）。
日がプレースホルダ（01 または月末）であることはフェーズ1と同じく必須。

使い方:
    python3 docs/qa/issue34-event-date-2026-08-02/apply_phase2_multimonth.py --dry-run
    python3 docs/qa/issue34-event-date-2026-08-02/apply_phase2_multimonth.py --apply
"""
import argparse
import calendar
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from apply_majority_month import (  # noqa: E402
    COUNT_KEYS, DATA_PATH, ISO_RX, KAN, LUNAR_RX,
    majority_solar_ym, precision_of,
)

# フェーズ1 と同じ理由（note の旧暦月自体が本紀と食い違う等）で機械換算しないもの
EXCLUDE = {
    ('hou-han-huandi', 'rebellionSuppressionCount', 14, 'startDate'),
    ('hou-han-huandi', 'rebellionSuppressionCount', 14, 'endDate'),
    # note の「〇月〇〇（干支）」が sxtwl の当該旧暦月内に実在しないもの（朔差か史料誤記。個別確認へ）
    ('hou-han-shaodi-yi', 'rebellionSuppressionCount', 0, 'startDate'),
    ('hou-han-shaodi-yi', 'rebellionSufferedCount', 0, 'startDate'),
    ('wei-wendi', 'personalCampaignCount', 2, 'startDate'),
    ('beiwei-xiaowendi', 'personalCampaignCount', 2, 'startDate'),
    ('beiwei-xiaowendi', 'rebellionSuppressionCount', 13, 'endDate'),
    ('beiwei-xiaowendi', 'rebellionSuppressionCount', 22, 'startDate'),
    ('dongwei-xiaojingdi', 'rebellionSuppressionCount', 0, 'endDate'),
    ('tang-suzong', 'rebellionSuppressionCount', 3, 'startDate'),
    ('tang-zhaozong', 'rebellionSuppressionCount', 1, 'endDate'),
}


def ordered_lunar_months(note):
    """note に現れる旧暦月を出現順に返す（重複は保つ）。"""
    return [KAN[m.group(1)] for m in LUNAR_RX.finditer(note or '')]


def collect(data):
    out = []
    for e in data['emperors']:
        for ck in COUNT_KEYS:
            blk = e.get(ck)
            if not isinstance(blk, dict):
                continue
            for i, ev in enumerate(blk.get('events') or []):
                seq = ordered_lunar_months(ev.get('note'))
                if len(set(seq)) < 2:
                    continue          # 単一月はフェーズ1の担当
                for key in ('date', 'startDate', 'endDate'):
                    v = ev.get(key)
                    if not isinstance(v, str) or precision_of(ev, key) != 'month':
                        continue
                    m = ISO_RX.match(v)
                    if not m:
                        continue
                    y, mo, dy = map(int, m.groups())
                    want = seq[-1] if key == 'endDate' else seq[0]
                    if mo != want:
                        continue      # note の記述順から決まる月と一致しないものは触らない
                    last = calendar.monthrange(y, mo)[1]
                    if not (dy == 1 or (key == 'endDate' and dy == last)):
                        continue
                    if (e['id'], ck, i, key) in EXCLUDE:
                        continue
                    mj = majority_solar_ym(y, mo)
                    if not mj or mj == (y, mo):
                        continue
                    sy, sm = mj
                    nd = calendar.monthrange(sy, sm)[1] if dy != 1 else 1
                    new = f'{sy:04d}-{sm:02d}-{nd:02d}'
                    cls = 'A' if (sy != y and mo in (11, 12)) else 'C'
                    out.append((e, ck, i, key, v, new, cls, seq))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--only', choices=['A', 'C'], help='このクラスだけを対象にする')
    args = ap.parse_args()
    if args.apply == args.dry_run:
        ap.error('--apply か --dry-run のどちらかを指定する')

    data = json.loads(DATA_PATH.read_text(encoding='utf-8'))
    targets = [t for t in collect(data) if not args.only or t[6] == args.only]
    n_a = sum(1 for t in targets if t[6] == 'A')
    print(f'対象 {len(targets)} フィールド（A: 年またぎ {n_a} / C: 月のみ {len(targets) - n_a}）')
    for e, ck, i, key, old, new, cls, seq in targets:
        print(f'  [{cls}] {e["id"]} / {ck}.events[{i}].{key}  {old} → {new}  note の月列={seq}')
    if args.dry_run:
        return 0

    fresh = json.loads(DATA_PATH.read_text(encoding='utf-8'))
    by_id = {e['id']: e for e in fresh['emperors']}
    for e, ck, i, key, old, new, _cls, _seq in targets:
        ev = by_id[e['id']][ck]['events'][i]
        if ev.get(key) != old:
            raise SystemExit(f'旧値不一致で中断: {e["id"]}.{ck}[{i}].{key} = {ev.get(key)!r}（期待 {old!r}）')
        ev[key] = new
    DATA_PATH.write_text(json.dumps(fresh, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'適用 {len(targets)} フィールド → {DATA_PATH}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
