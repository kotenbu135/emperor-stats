#!/usr/bin/env python3
"""Issue #34 フェーズ3: フェーズ1・2 の機械条件では拾えなかった A（年またぎ）を、
note と本紀を1件ずつ読んで個別に訂正する。

各行の根拠は下の RECORDS のコメントに書いた。旧値ガードつきで、値が違えば中断する。

使い方: python3 docs/qa/issue34-event-date-2026-08-02/apply_phase3_individual.py --apply
"""
import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from apply_majority_month import DATA_PATH  # noqa: E402

# (id, 指標, index, キー, 旧値, 新値, 根拠)
RECORDS = [
    ('liu-song-shundi', 'rebellionSuppressionCount', 1, 'endDate', '0477-12-01', '0478-01-01',
     '袁粲の石頭反乱は昇明元年十二月壬申に起き同月中に鎮圧（note）。旧暦十二月 → 多数月 0478-01'),
    ('beiwei-xiaowendi', 'crownPrinceDepositionCount', 0, 'date', '0496-12-01', '0497-01-01',
     '魏書高祖紀「十有二月甲子…丙寅，廢皇太子恂為庶人」。旧暦十二月 → 0497-01'
     '（丙寅は sxtwl の当該月内に無いが、本紀の月見出しは十二月で確定）'),
    ('tang-gaozu', 'rebellionSuppressionCount', 0, 'startDate', '0618-12-01', '0619-01-01',
     '旧唐書本紀の武徳元年十二月庚子「李密反於桃林」が蜂起（十月の記事は来降）。旧暦十二月 → 0619-01'),
    ('tang-taizong', 'rebellionSuppressionCount', 4, 'endDate', '0638-12-01', '0639-01-01',
     '旧唐書巻三、貞観十二年十二月辛巳「右武候将軍上官懐仁大破山獠于壁州」。旧暦十二月 → 0639-01'),
    ('tang-zhaozong', 'rebellionSuppressionCount', 1, 'endDate', '0893-12-01', '0894-01-01',
     '旧唐書昭宗紀、景福二年十二月辛未朔「楊守亮、楊復恭並已処斬訖」。旧暦十二月 → 0894-01'),
    ('beisong-taizong', 'eraChangeCount', 0, 'date', '0976-12-01', '0977-01-01',
     '開寶九年十二月の改元（十月・十一月は開寶年号を継続）。旧暦十二月 → 0977-01'),
    ('ming-daizong', 'rebellionSuppressionCount', 1, 'endDate', '1456-12-30', '1457-01-31',
     '景泰七年十二月己亥、方瑛が湖広苗を大破（note）。旧暦十二月 → 1457-01'),
    ('ming-daizong', 'rebellionSufferedCount', 1, 'endDate', '1456-12-30', '1457-01-31',
     '同上（鎮圧側と同一事件）'),
]

# 調査した結果「現行値のままで正しい」と確認したもの（再検出時に迷わないための記録）
CONFIRMED_OK = [
    ('hou-han-huandi', 'rebellionSuppressionCount', 14, 'startDate', '0160-12-01',
     '蜂起は延熹三年十一月（本紀）。旧暦十一月 → 多数月 0160-12 で現行値と一致'),
    ('wu-modi', 'amnestyCount', 2, 'date', '0265-12-01',
     'note が「十一月として近似」と明記。甘露元年十一月 → 多数月 0265-12 で一致'),
    ('liang-yuandi', 'personalCampaignCount', 0, 'startDate', '0554-12-01',
     'note が「旧暦十一月」と明記。承聖三年十一月 → 多数月 0554-12 で一致'),
    ('liang-yuandi', 'personalCampaignCount', 0, 'endDate', '0554-12-01', '同上'),
    ('jin-wudi', 'rebellionSuppressionCount', 5, 'startDate', '0287-12-01',
     '蜂起は太康八年冬十月（note）。旧暦十月 → 多数月 0287-12 で一致'),
    ('liu-song-wendi', 'rebellionSuppressionCount', 6, 'startDate', '0441-12-01',
     '侵寇は元嘉十八年冬十一月（note）。旧暦十一月 → 多数月 0441-12 で一致'),
]

# 原典で対応する旧暦月を確定できず、今回は触らなかったもの（残タスク）
UNRESOLVED = [
    ('jin-huaidi', 'rebellionSuppressionCount', 2, 'endDate', '0307-12-01',
     '懐帝紀は汲桑の乱を五月〜九月で記し、note の「307年末」に対応する月の記事が本紀に無い'),
    ('liu-song-mingdi', 'rebellionSuppressionCount', 0, 'endDate', '0466-12-01',
     '明帝紀は泰始二年八月己卯に五州平定・子勛ら賜死と記し、十二月に対応する記事が無い'),
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
    print(f'（現行値のままで正しいと確認: {len(CONFIRMED_OK)} フィールド / 未確定で保留: {len(UNRESOLVED)} フィールド）')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
