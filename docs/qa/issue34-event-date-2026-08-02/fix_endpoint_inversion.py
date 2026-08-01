#!/usr/bin/env python3
"""Issue #34 フェーズ4: フェーズ1〜3 が端点（startDate/endDate）を独立に扱ったために生じた
「同一イベントで片端だけ換算され、startDate > endDate になった」5 件を直す。

除外条件も換算条件も**フィールド単位**で書いたため、期間イベントの片端だけが動くケースが出た。
うち前後関係が壊れた 5 件が下記。判定は1件ずつ note と原典で行った。

再発防止のための教訓（`apply_phase2_multimonth.py` には後追いで入れていない）:
  - 同一イベントの他端が「実日付」（プレースホルダでない日）を持つとき、month 精度の端点を
    多数月方式で動かすと矛盾する（`jin-huidi` の親征がこれ。end の 0304-07-30 は「己未」の実日付）
  - 両端が同じ旧暦月を指すイベントは、片端だけ換算してはいけない

使い方: python3 docs/qa/issue34-event-date-2026-08-02/fix_endpoint_inversion.py --apply
"""
import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from apply_majority_month import DATA_PATH  # noqa: E402

# (id, 指標, index, キー, 旧値, 新値, 根拠)
RECORDS = [
    ('jin-wudi', 'rebellionSuppressionCount', 6, 'endDate', '0287-12-31', '0288-02-29',
     'note「太康八年十一月…同年内に鎮圧された」。終了は太康八年の年末＝旧暦十二月 → 多数月 0288-02。'
     '同じ「同年内鎮圧」の events[5]・[7] の endDate も 0288-02-29 に揃う'),
    ('jin-huidi', 'personalCampaignCount', 0, 'startDate', '0304-08-01', '0304-07-01',
     'フェーズ2の誤適用を戻す。endDate 0304-07-30 は note の「己未」の実日付で、'
     '旧暦七月は太陽暦 7月末〜8月にまたがる。実日付がある側に合わせ startDate は 7 月に置く'),
    ('jin-mindi', 'rebellionSufferedCount', 3, 'endDate', '0316-05-01', '0316-06-01',
     'note「帝紀建興四年五月条」の単一事件（投降）。startDate と同じ旧暦五月 → 多数月 0316-06'),
    ('dongjin-mingdi', 'rebellionSufferedCount', 3, 'startDate', '0323-03-01', '0323-01-01',
     'フェーズ2の誤適用を戻す。note は「太宁元年正月」だが endDate 0323-02-01 の根拠が note になく、'
     '両端の対応月を決められない。個別確認へ回す'),
    ('beiwei-xiaowudi', 'rebellionSuppressionCount', 3, 'endDate', '0534-09-01', '0534-10-01',
     'note「永熙三年九月『是月，东清河人傅晶杀太守韩子捷，据郡反。会赦，乃降。』」で蜂起も降伏も九月。'
     'startDate と同じ旧暦九月 → 多数月 0534-10'),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    if args.apply == args.dry_run:
        ap.error('--apply か --dry-run のどちらかを指定する')

    data = json.loads(DATA_PATH.read_text(encoding='utf-8'))
    by_id = {e['id']: e for e in data['emperors']}
    for eid, ck, i, key, old, new, why in RECORDS:
        ev = by_id[eid][ck]['events'][i]
        if ev.get(key) != old:
            raise SystemExit(f'旧値不一致で中断: {eid}.{ck}[{i}].{key} = {ev.get(key)!r}（期待 {old!r}）')
        print(f'  {eid} / {ck}.events[{i}].{key}  {old} → {new}\n      {why}')
        if args.apply:
            ev[key] = new
    if args.apply:
        DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        print(f'適用 {len(RECORDS)} フィールド → {DATA_PATH}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
