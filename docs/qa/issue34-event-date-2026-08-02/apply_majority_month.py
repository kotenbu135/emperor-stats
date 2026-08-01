#!/usr/bin/env python3
"""Issue #34 フェーズ1: month 精度 event 日付のうち「旧暦月番号がそのまま入っている」ことが
機械的に確定できるものを、多数月方式（旧暦月の日数が最も多く属する太陽暦の年月）へ換算する。

適用条件（すべて満たすものだけ触る）:
  (1) datePrecision が month
  (2) note 等から拾える旧暦月が **単一**（複数月が出てくる期間イベントは開始・終了の対応が機械では決まらない）
  (3) その旧暦月が ISO の月と一致（＝旧暦月番号の転記）
  (4) 日が 01（endDate は 01 または月末）＝日情報を持たないプレースホルダ
      ※ 日に実値があるものは既に太陽暦の日まで換算済みのことがある（例 wudai-houliang-modi
        `0914-09-23`＝乾化四年九月の実日付）ので触らない
  (5) 多数月方式の結果が現在の年月と異なる

日の埋め方: 元が 01 なら新しい月の 01、元が月末なら新しい月の末日（month 精度なので日は意味を持たない）。

使い方:
    python3 docs/qa/issue34-event-date-2026-08-02/apply_majority_month.py --dry-run
    python3 docs/qa/issue34-event-date-2026-08-02/apply_majority_month.py --apply
"""
import argparse
import calendar
import json
import pathlib
import re
from collections import Counter

import sxtwl

ROOT = pathlib.Path(__file__).resolve().parents[3]
DATA_PATH = ROOT / "data" / "emperors.json"

KAN = {'正': 1, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7,
       '八': 8, '九': 9, '十': 10, '十一': 11, '十二': 12}
LUNAR_RX = re.compile(r'(?<![閏])(正|十二|十一|十|一|二|三|四|五|六|七|八|九)月')
ISO_RX = re.compile(r'^(\d{4})-(\d{2})-(\d{2})$')
COUNT_KEYS = ['eraChangeCount', 'amnestyCount', 'empressInstallationCount',
              'crownPrinceDepositionCount', 'personalCampaignCount',
              'rebellionSuppressionCount', 'rebellionSufferedCount',
              'capitalRelocationCount']

# selfcheck_ganzhi.py で「note の干支が当該旧暦月内に実在しない」と出たもの。
# 旧暦年月の取り違えか史書暦と sxtwl の朔差なので、機械換算せず個別確認に回す。
EXCLUDE_GANZHI_MISMATCH = {
    ('hou-han-huandi', 'amnestyCount', 7, 'date'),
    ('hou-han-xiandi', 'amnestyCount', 3, 'date'),
    ('wei-yuandi', 'amnestyCount', 3, 'date'),
    ('beiwei-xiaowendi', 'crownPrinceDepositionCount', 0, 'date'),
    ('dongwei-xiaojingdi', 'rebellionSuppressionCount', 6, 'startDate'),
    ('dongwei-xiaojingdi', 'rebellionSuppressionCount', 6, 'endDate'),
    ('beizhou-wudi', 'personalCampaignCount', 0, 'endDate'),
    ('tang-xuanzong', 'amnestyCount', 7, 'date'),
    ('beisong-zhenzong', 'amnestyCount', 1, 'date'),
    ('ming-taizong', 'rebellionSuppressionCount', 7, 'startDate'),
    ('ming-taizong', 'rebellionSuppressionCount', 7, 'endDate'),
    # 本紀の記事順で note の旧暦月自体が誤っていると分かったもの（別途 note ごと個別訂正）。
    # 後漢書桓帝紀は「冬十一月…太山賊叔孫無忌攻殺都尉侯章。十二月，遣中郎将宗資討破之」で、
    # 蜂起は十一月・討破が十二月。note は蜂起を十二月としている。
    ('hou-han-huandi', 'rebellionSuppressionCount', 14, 'startDate'),
    ('hou-han-huandi', 'rebellionSuppressionCount', 14, 'endDate'),
}

_mj = {}


def majority_solar_ym(ly, lm):
    """旧暦 (ly, lm) の各日が属する太陽暦の年月のうち、日数が最も多いものを返す。"""
    if (ly, lm) in _mj:
        return _mj[(ly, lm)]
    c = Counter()
    for dd in range(1, 31):
        try:
            day = sxtwl.fromLunar(ly, lm, dd)
        except Exception:
            break
        if day.getLunarMonth() != lm or day.isLunarLeap():
            break
        c[(day.getSolarYear(), day.getSolarMonth())] += 1
    r = c.most_common(1)[0][0] if c else None
    _mj[(ly, lm)] = r
    return r


def precision_of(ev, key):
    p = ev.get('datePrecision')
    if isinstance(p, dict):
        return p.get('start' if key == 'startDate' else 'end')
    return p


def event_text(ev):
    return ' '.join(str(v) for k, v in ev.items()
                    if isinstance(v, str)
                    and k not in ('date', 'startDate', 'endDate', 'datePrecision'))


def collect(data, apply_exclusions=True):
    """(emperor, 指標キー, index, 日付キー, 旧値, 新値, クラス) を返す。

    apply_exclusions=False にすると EXCLUDE_GANZHI_MISMATCH を無視する
    （selfcheck_ganzhi.py が除外リストの根拠を再現するために使う）。
    """
    out = []
    for e in data['emperors']:
        for ck in COUNT_KEYS:
            blk = e.get(ck)
            if not isinstance(blk, dict):
                continue
            for i, ev in enumerate(blk.get('events') or []):
                lunars = {KAN[m.group(1)] for m in LUNAR_RX.finditer(event_text(ev))}
                if len(lunars) != 1:            # 条件 (2)
                    continue
                for key in ('date', 'startDate', 'endDate'):
                    v = ev.get(key)
                    if not isinstance(v, str) or precision_of(ev, key) != 'month':
                        continue                # 条件 (1)
                    m = ISO_RX.match(v)
                    if not m:
                        continue
                    y, mo, dy = map(int, m.groups())
                    if mo not in lunars:        # 条件 (3)
                        continue
                    last = calendar.monthrange(y, mo)[1]
                    if not (dy == 1 or (key == 'endDate' and dy == last)):
                        continue                # 条件 (4)
                    mj = majority_solar_ym(y, mo)
                    if not mj or mj == (y, mo):
                        continue                # 条件 (5)
                    if apply_exclusions and (e['id'], ck, i, key) in EXCLUDE_GANZHI_MISMATCH:
                        continue
                    sy, sm = mj
                    nd = calendar.monthrange(sy, sm)[1] if dy != 1 else 1
                    new = f'{sy:04d}-{sm:02d}-{nd:02d}'
                    cls = 'A' if (sy != y and mo in (11, 12)) else 'C'
                    out.append((e, ck, i, key, v, new, cls))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    if args.apply == args.dry_run:
        ap.error('--apply か --dry-run のどちらかを指定する')

    data = json.loads(DATA_PATH.read_text(encoding='utf-8'))
    targets = collect(data)
    n_a = sum(1 for t in targets if t[6] == 'A')
    print(f'対象 {len(targets)} フィールド（A: 年またぎ {n_a} / C: 月のみ {len(targets) - n_a}）')
    for e, ck, i, key, old, new, cls in targets:
        print(f'  [{cls}] {e["id"]} / {ck}.events[{i}].{key}  {old} → {new}')
    if args.dry_run:
        return 0

    # 旧値一致ガードつきで書き戻す（並行セッションの編集と衝突したら止める）
    fresh = json.loads(DATA_PATH.read_text(encoding='utf-8'))
    by_id = {e['id']: e for e in fresh['emperors']}
    applied = 0
    for e, ck, i, key, old, new, _cls in targets:
        ev = by_id[e['id']][ck]['events'][i]
        if ev.get(key) != old:
            raise SystemExit(f'旧値不一致で中断: {e["id"]}.{ck}[{i}].{key} = {ev.get(key)!r}（期待 {old!r}）')
        ev[key] = new
        applied += 1
    DATA_PATH.write_text(json.dumps(fresh, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'適用 {applied} フィールド → {DATA_PATH}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
