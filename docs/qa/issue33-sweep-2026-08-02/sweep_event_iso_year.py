#!/usr/bin/env python3
"""Issue #33 横展開スイープB: events の ISO 日付が「紀年ラベル年＋旧暦月番号」のまま
（AI_RESEARCH_LESSONS.md「9. 元号日付の暦換算」の
  ・旧暦十一月・十二月は年またぎする。ISO 年は必ず sxtwl の太陽暦出力から取る
  ・旧暦月だけ判明している日付の月精度換算は多数月方式（旧暦九月→10月）
に反する）候補を洗う。

判定は多数月方式（旧暦月の日数のうち最も多くが属する太陽暦の年月）で行う。

検出できないもの（限界）:
- note/outcome 等に旧暦月が書かれていない event は照合の足場が無いので対象外。
- ISO の月が note の旧暦月と一致しない event は「換算済み」とみなして飛ばす
  （実際には別の誤りで一致していない可能性は残る）。
"""
import json, re, sxtwl

KAN = {'正':1,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,
       '十':10,'十一':11,'十二':12}
LUNAR_RX = re.compile(r'(?<![閏])(正|十二|十一|十|一|二|三|四|五|六|七|八|九)月')

d = json.load(open('data/emperors.json'))

def event_dates(ev):
    for k in ('date', 'startDate', 'endDate'):
        if ev.get(k):
            yield k, ev[k]

def prec(ev, key):
    p = ev.get('datePrecision')
    if isinstance(p, dict):
        return p.get('start' if key == 'startDate' else 'end')
    return p

def texts(ev):
    return ' '.join(str(v) for k, v in ev.items()
                    if isinstance(v, str) and k not in ('date','startDate','endDate','datePrecision'))

from collections import Counter

_cache = {}

def majority_solar_ym(ly, lm):
    """旧暦 (ly, lm) の各日が属する太陽暦の年月のうち、日数が最も多いものを返す。"""
    key = (ly, lm)
    if key in _cache:
        return _cache[key]
    c = Counter()
    for dd in range(1, 31):
        try:
            day = sxtwl.fromLunar(ly, lm, dd)
        except Exception:
            break
        if day.getLunarMonth() != lm or day.isLunarLeap():
            break
        c[(day.getSolarYear(), day.getSolarMonth())] += 1
    res = c.most_common(1)[0][0] if c else None
    _cache[key] = res
    return res


COUNT_KEYS = ['eraChangeCount','amnestyCount','empressInstallationCount',
              'crownPrinceDepositionCount','personalCampaignCount',
              'rebellionSuppressionCount','rebellionSufferedCount',
              'capitalRelocationCount']

hits = []
total_month = 0
for e in d['emperors']:
    for ck in COUNT_KEYS:
        blk = e.get(ck)
        if not isinstance(blk, dict):
            continue
        for i, ev in enumerate(blk.get('events') or []):
            t = texts(ev)
            lunars = {KAN[m.group(1)] for m in LUNAR_RX.finditer(t)}
            if not lunars:
                continue
            for key, iso in event_dates(ev):
                m = re.match(r'^(-?\d{4})-(\d{2})-(\d{2})$', iso)
                if not m:
                    continue
                y, mo = int(m.group(1)), int(m.group(2))
                if y < 1:
                    continue
                p = prec(ev, key)
                if p != 'month':
                    continue
                total_month += 1
                if mo not in lunars:
                    continue          # 既に太陽暦へ換算済みとみなす
                mj = majority_solar_ym(y, mo)
                if mj is None:
                    continue
                sy, sm = mj
                if (sy, sm) != (y, mo):
                    hits.append((e['id'], f'{ck}.events[{i}].{key}', iso,
                                 f'{sy:04d}-{sm:02d}', mo, t[:70]))

year_shift = [h for h in hits if h[2][:4] != h[3][:4] and h[4] in (11, 12)]
other_shift = [h for h in hits if h[2][:4] != h[3][:4] and h[4] not in (11, 12)]
month_only = [h for h in hits if h[2][:4] == h[3][:4]]

print(f'month 精度の event 日付: {total_month} 件')
print(f'うち「ISO 月＝note の旧暦月」かつ実太陽暦とずれる: {len(hits)} 件')
print(f'  A: 旧暦十一月・十二月の年またぎで ISO 年が1年古い: {len(year_shift)} 件')
print(f'  B: 十一月・十二月以外なのに年がずれる（改暦・閏月の要個別確認）: {len(other_shift)} 件')
print(f'  C: 年は同じで月ラベルだけ実太陽暦とずれる（多数月方式の未適用）: {len(month_only)} 件')
print()
print('=== A: 旧暦十一月・十二月の年またぎ（ISO 年が1年古い）===')
for h in year_shift:
    print(f'- {h[0]} / {h[1]}  ISO={h[2]} → 実太陽暦 {h[3]}  旧暦{h[4]}月')
    print(f'    {h[5]}')
print()
print('=== B: 十一月・十二月以外の年ずれ（要個別確認）===')
for h in other_shift:
    print(f'- {h[0]} / {h[1]}  ISO={h[2]} → 実太陽暦 {h[3]}  旧暦{h[4]}月')
    print(f'    {h[5]}')
print()
print(f'=== C: 月ラベルだけのずれ（先頭15件のみ表示・計 {len(month_only)} 件）===')
for h in month_only[:15]:
    print(f'- {h[0]} / {h[1]}  ISO={h[2]} → 実太陽暦 {h[3]}  旧暦{h[4]}月')
