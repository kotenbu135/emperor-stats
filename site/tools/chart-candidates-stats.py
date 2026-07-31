#!/usr/bin/env python3
"""CHART_CANDIDATES_2026-07-31.md が引用する数値の実測スクリプト（読み取り専用）。

同ファイルの数値はすべてこの出力から取る。前版（同日・スキーマ未読で書かれた版）の
数値は1つも継承していない。使い方: python3 site/tools/chart-candidates-stats.py
検討が決着して CHART_CANDIDATES_2026-07-31.md を削除するときに、これも一緒に消す。
"""
import math
import json, collections, statistics, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
D = json.load(open(ROOT / 'data' / 'emperors.json', encoding='utf-8'))
EM = D['emperors']
CAT = D['meta']['catalogs']
ENUM = CAT['enums']
ERA = {e['id']: e['label'] for e in CAT['eras']}
ERA_ORDER = {e['id']: e['sortOrder'] for e in CAT['eras']}
REG = {r['id']: r for r in CAT['regimes']}
LBL = {k: {v['id']: v['label'] for v in vs} for k, vs in ENUM.items()}

COUNT_FIELDS = ['eraChangeCount', 'amnestyCount', 'empressInstallationCount',
                'crownPrinceDepositionCount', 'capitalRelocationCount',
                'personalCampaignCount', 'rebellionSuppressionCount', 'rebellionSufferedCount']
CONF_FIELDS = ['verification', 'deathCause', 'accessionRoute', 'ages'] + COUNT_FIELDS


def h(t):
    print('\n' + '=' * 8 + ' ' + t + ' ' + '=' * 8)


def pct(a, b):
    return f'{a}/{b}={100*a/b:.1f}%'


# ---------------------------------------------------------------- A. 基礎
h('A. 基礎')
print('n =', len(EM))
print('standing:', collections.Counter(e['standing'] for e in EM).most_common())
print('regimes[].category（政権数）:', collections.Counter(r['category'] for r in REG.values()).most_common())
print('regimes[].category（人数）:', collections.Counter(REG[e['regimeId']]['category'] for e in EM).most_common())
print('eraId 人数:', [(ERA[k], v) for k, v in sorted(collections.Counter(e['eraId'] for e in EM).items(), key=lambda x: ERA_ORDER[x[0]])])
print('researchSection 種類数:', len(set(e['researchSection'] for e in EM)))
print('reignCount>=2:', sum(1 for e in EM if e['reignSummary']['reignCount'] >= 2))
print('isRestoration を持つ在位:', sum(1 for e in EM for r in e['reigns'] if r['isRestoration']))
print('isFemale:', sum(1 for e in EM if e['flags']['isFemale']))
uet = [e['id'] for e in EM if e['flags']['usedEmperorTitleFrom'] != e['reigns'][0]['startYear']]
print('usedEmperorTitleFrom != reigns[0].startYear:', len(uet), uet)

# ---------------------------------------------------------------- B. 在位の精度
h('B. 在位日付の精度と duration')
pc = collections.Counter()
for e in EM:
    for r in e['reigns']:
        pc[(r['datePrecision']['start'], r['datePrecision']['end'])] += 1
print('reigns の precision (start,end):', pc.most_common())
allday = [e for e in EM if all(r['datePrecision']['start'] == 'day' and r['datePrecision']['end'] == 'day' for r in e['reigns'])]
print('全在位が day×day の皇帝:', len(allday))
print('reignSummary.isExact:', sum(1 for e in EM if e['reignSummary']['totalReignDuration']['isExact']))
print('needsPreciseDays:', sum(1 for e in EM if e['reignSummary']['totalReignDuration']['needsPreciseDays']))
# approxDays が365の倍数ぴったり＝年精度由来の量子化
q = [e for e in EM if e['reignSummary']['totalReignDuration']['approxDays'] % 365 == 0]
print('totalReignDuration.approxDays が365の倍数:', len(q))
nonday = [e for e in EM if not all(r['datePrecision']['start'] == 'day' and r['datePrecision']['end'] == 'day' for r in e['reigns'])]
print('非 day 精度を含む皇帝の時代内訳:',
      [(ERA[k], v) for k, v in sorted(collections.Counter(e['eraId'] for e in nonday).items(), key=lambda x: ERA_ORDER[x[0]])])
ad = [e['reignSummary']['totalReignDuration']['approxDays'] for e in EM]
print('approxDays 平均 %.1f日=%.2f年 / 中央値 %.1f日=%.2f年' % (statistics.mean(ad), statistics.mean(ad)/365.2422,
                                                    statistics.median(ad), statistics.median(ad)/365.2422))
print('平均以上:', sum(1 for x in ad if x >= statistics.mean(ad)))

# ---------------------------------------------------------------- C. 在位継続率
h('C. 在位継続率カーブ（全在位合算 vs 初回在位のみ / 全体 vs day精度限定）')


def survival(vals, marks):
    n = len(vals)
    return [(m, sum(1 for v in vals if v >= m * 365.2422) / n) for m in marks]


MARKS = [0.5, 1, 2, 3, 5, 10, 15, 20, 30, 50]
total = [e['reignSummary']['totalReignDuration']['approxDays'] for e in EM]
first = [e['reigns'][0]['duration']['approxDays'] for e in EM]
exact = [e['reignSummary']['totalReignDuration']['approxDays'] for e in EM if e['reignSummary']['totalReignDuration']['isExact']]
for nm, vals in [('全在位合算 n=%d' % len(total), total), ('初回在位のみ n=%d' % len(first), first),
                 ('isExact のみ n=%d' % len(exact), exact)]:
    print(nm, ' '.join('%g年:%.0f%%' % (m, 100 * p) for m, p in survival(vals, MARKS)))
print('中央値: 合算 %.2f年 / 初回 %.2f年 / exact %.2f年' % (statistics.median(total)/365.2422,
      statistics.median(first)/365.2422, statistics.median(exact)/365.2422))

# ---------------------------------------------------------------- D. 即位経路の各軸
h('D. accessionRoute の各軸（v3 ID / ラベルはカタログから引く）')
ar = [e['accessionRoute'] for e in EM]
print('categoryId:', [(LBL['accessionCategory'][k], v) for k, v in collections.Counter(a['categoryId'] for a in ar).most_common()])
for ax, en in [('throneSource', 'throneSource'), ('titleOrigin', 'titleOrigin'),
               ('predecessorFate', 'predecessorFate'), ('procedure', 'procedure'),
               ('relationToPredecessor', 'relationToPredecessor'), ('decidedByBasis', 'decidedByBasis')]:
    c = collections.Counter(a['axes'][ax] for a in ar)
    print(f'{ax}:', [(LBL.get(en, {}).get(k, k), v) for k, v in c.most_common()], '合計', sum(c.values()))
dbc = collections.Counter()
for a in ar:
    dbc[tuple(sorted(a['axes']['decidedBy']))] += 1
print('decidedBy の組み合わせ:', [(tuple(LBL['decidedBy'][x] for x in k), v) for k, v in dbc.most_common()])
print('decidedBy 値ごとの延べ:', [(LBL['decidedBy'][k], v) for k, v in
                          collections.Counter(x for a in ar for x in a['axes']['decidedBy']).most_common()])
print('decidedByAgents 延べ:', [(LBL['decidedByAgent'][k], v) for k, v in
                            collections.Counter(x for a in ar for x in a['axes']['decidedByAgents']).most_common()])
print('agents を持つ人数:', sum(1 for a in ar if a['axes']['decidedByAgents']))

# titleOrigin × throneSource
h('D2. titleOrigin × throneSource / procedure × decidedBy')
m = collections.Counter((a['axes']['throneSource'], a['axes']['titleOrigin']) for a in ar)
for (ts, to), v in sorted(m.items()):
    print(f'  {LBL["throneSource"][ts]} × {LBL["titleOrigin"][to]}: {v}')
m2 = collections.Counter()
for a in ar:
    db = a['axes']['decidedBy']
    key = 'self' if 'self' in db else ('predecessor' if 'predecessor' in db else ('third-party' if 'third-party' in db else 'undetermined'))
    m2[(a['axes']['procedure'], key)] += 1
for (p, k), v in sorted(m2.items()):
    print(f'  {LBL["procedure"][p]} × {LBL["decidedBy"][k]}: {v}')

# ---------------------------------------------------------------- E. self-established の実体
h('E. throneSource=self-established の実体（「自力で建てた」か？）')
se = [e for e in EM if e['accessionRoute']['axes']['throneSource'] == 'self-established']
print('n =', len(se))
print('  standing:', collections.Counter(e['standing'] for e in se).most_common())
print('  regimes.category:', collections.Counter(REG[e['regimeId']]['category'] for e in se).most_common())
print('  categoryId:', [(LBL['accessionCategory'][k], v) for k, v in collections.Counter(e['accessionRoute']['categoryId'] for e in se).most_common()])
# その政権の最初の即位者か（=創始者らしさ）
firstof = {}
for e in EM:
    rid = e['regimeId']
    y = e['reignSummary']['firstStartYear']
    if rid not in firstof or y < firstof[rid][1]:
        firstof[rid] = (e['id'], y)
founders = set(v[0] for v in firstof.values())
print('  うち「その政権で最初に即位した人」:', sum(1 for e in se if e['id'] in founders), '/', len(se))
# 逆: 王朝創始者のうち self-established でない人
h('E2. 受禅（他政権から受禅）で王朝を開いた人 = self-established に入らない創始者')
ab = [e for e in EM if e['accessionRoute']['axes']['throneSource'] == 'abdication-received']
print('abdication-received n =', len(ab), [e['name']['commonName'] for e in ab])
# 各群の在位
def med(g):
    v = [x['reignSummary']['totalReignDuration']['approxDays'] for x in g]
    return statistics.median(v)/365.2422 if v else float('nan')
others = [e for e in EM if e['accessionRoute']['axes']['throneSource'] != 'self-established']
print('在位中央値: self-established %.2f年 (n=%d) / それ以外 %.2f年 (n=%d)' % (med(se), len(se), med(others), len(others)))
for ts in ['inherited', 'abdication-received', 'self-established']:
    g = [e for e in EM if e['accessionRoute']['axes']['throneSource'] == ts]
    print('  %s: n=%d 中央値 %.2f年' % (LBL['throneSource'][ts], len(g), med(g)))

# ---------------------------------------------------------------- F. 改元
h('F. eraChangeCount の意味（初回建元を含む）')
ec = [e['eraChangeCount'] for e in EM]
print('count の分布:', sorted(collections.Counter(x['count'] for x in ec).items()))
print('count != len(events):', [(e['id'], e['eraChangeCount']['count'], len(e['eraChangeCount']['events'])) for e in EM if e['eraChangeCount']['count'] != len(e['eraChangeCount']['events'])])
print('events 総数:', sum(len(x['events']) for x in ec), '/ count 合計:', sum(x['count'] for x in ec))
print('count==0 の人数:', sum(1 for x in ec if x['count'] == 0))
z = [e for e in EM if e['eraChangeCount']['count'] == 0]
print('  count==0 の時代内訳:', [(ERA[k], v) for k, v in collections.Counter(e['eraId'] for e in z).items()])
# 元号制度なし note を持つか
nn = sum(1 for e in z if '年号' in (e['eraChangeCount'].get('note') or '') or '元号' in (e['eraChangeCount'].get('note') or ''))
print('  うち note に年号/元号への言及:', nn)
for eid in ['qin-han', 'sui-tang', 'song-liao-jin-xia', 'yuan', 'ming', 'qing']:
    g = [e for e in EM if e['eraId'] == eid]
    cs = [e['eraChangeCount']['count'] for g2 in [g] for e in g2]
    ge2 = sum(1 for c in cs if c >= 2)
    print('  %s: n=%d 中央値%.1f 最大%d 「2つ以上の元号」%s' % (ERA[eid], len(g), statistics.median(cs), max(cs), pct(ge2, len(g))))

# ---------------------------------------------------------------- G. イベント日付の精度
h('G. 全イベントの日付キーと datePrecision')
kc, prc, dpobj = collections.Counter(), collections.Counter(), 0
tot = 0
for e in EM:
    for f in COUNT_FIELDS:
        for ev in e[f]['events']:
            tot += 1
            ks = tuple(sorted(k for k in ev if k in ('date', 'startDate', 'endDate')))
            kc[(f, ks)] += 1
            dp = ev.get('datePrecision')
            if isinstance(dp, dict):
                dpobj += 1
                prc[(f, 'object')] += 1
            else:
                prc[(f, dp)] += 1
print('イベント総数:', tot, '/ datePrecision がオブジェクト形式:', dpobj)
print('日付キーの型:')
for k, v in sorted(kc.items()):
    print('  ', k[0], k[1], v)
print('項目 × precision:')
for f in COUNT_FIELDS:
    row = {p: v for (ff, p), v in prc.items() if ff == f}
    n = sum(row.values())
    print('  %-28s n=%-5d %s' % (f, n, {k: v for k, v in sorted(row.items(), key=lambda x: -x[1])}))

# ---------------------------------------------------------------- H. 称帝前イベント
h('H. 在位 ISO 年範囲の外に出るイベント（称帝前イベント＝規約上は正当）')


def iso_year(s):
    if not s:
        return None
    s = s.strip()
    neg = s.startswith('-')
    y = s[1:5] if neg else s[0:4]
    try:
        return -int(y) if neg else int(y)
    except ValueError:
        return None


out = collections.Counter()
outp = []
for e in EM:
    ys = [r['startYear'] for r in e['reigns']]
    ye = [r['endYear'] for r in e['reigns']]
    lo, hi = min(ys), max(ye)
    # ISO 天文年へ：紀元前は -n → -(n-1)
    ilo = lo + 1 if lo < 0 else lo
    ihi = hi + 1 if hi < 0 else hi
    for f in COUNT_FIELDS:
        for ev in e[f]['events']:
            dt = ev.get('date') or ev.get('startDate')
            y = iso_year(dt)
            if y is None:
                continue
            if y < ilo - 1 or y > ihi + 1:
                out[f] += 1
                outp.append((e['id'], f, dt, lo, hi))
print('範囲外イベント:', out.most_common(), '合計', sum(out.values()))
print('該当人数:', len(set(x[0] for x in outp)))
print('例:', outp[:12])

# ---------------------------------------------------------------- I. 同時在位数
h('I. 各年の在位人数（startYear/endYear = 歴史年）')
yc = collections.Counter()
for e in EM:
    for r in e['reigns']:
        for y in range(r['startYear'], r['endYear'] + 1):
            yc[y] += 1
years = sorted(yc)
lo, hi = min(years), max(years)
span = [y for y in range(lo, hi + 1) if y != 0]
dist = collections.Counter(yc.get(y, 0) for y in span)
print('全期間 %d〜%d (%d年)' % (lo, hi, len(span)))
print('並立数の分布（年数）:', sorted(dist.items()))
mx = max(yc.values())
print('最大:', mx, [y for y in years if yc[y] == mx])
print('上位:', sorted(((v, k) for k, v in yc.items()), reverse=True)[:8])
zero = [y for y in span if yc.get(y, 0) == 0]
print('0人の年:', len(zero), zero)
print('1人だけの年:', dist[1], pct(dist[1], len(span)))
# rival を除いた場合
yc2 = collections.Counter()
for e in EM:
    if e['standing'] == 'rival':
        continue
    for r in e['reigns']:
        for y in range(r['startYear'], r['endYear'] + 1):
            yc2[y] += 1
print('standing=rival を除くと最大年の人数:', {y: yc2.get(y, 0) for y in [y for y in years if yc[y] == mx]})
# 政権 category=orthodox のみ
yc3 = collections.Counter()
for e in EM:
    if REG[e['regimeId']]['category'] != 'orthodox':
        continue
    for r in e['reigns']:
        for y in range(r['startYear'], r['endYear'] + 1):
            yc3[y] += 1
print('regimes.category=orthodox のみ 最大:', max(yc3.values()), [y for y in yc3 if yc3[y] == max(yc3.values())])

# ---------------------------------------------------------------- J. confidence
h('J. confidence の分布（12フィールド）')
gr = collections.Counter()
per = {}
for f in CONF_FIELDS:
    c = collections.Counter(e[f].get('confidence') for e in EM)
    per[f] = c
    for k, v in c.items():
        gr[k] += v
    print('  %-28s %s' % (f, dict(c)))
print('全体:', dict(gr), '総セル', sum(gr.values()))
allhigh = sum(1 for e in EM if all(e[f].get('confidence') == 'high' for f in CONF_FIELDS))
print('12項目すべて high:', allhigh)
nonhigh = collections.Counter(sum(1 for f in CONF_FIELDS if e[f].get('confidence') != 'high') for e in EM)
print('high でない項目数の分布:', sorted(nonhigh.items()))
print('※ reigns[].duration に confidence は無い（needsPreciseDays が代替）')

# ---------------------------------------------------------------- K. ages
h('K. ages の被覆')
acc = [e for e in EM if e['ages'].get('accessionAge') is not None]
de = [e for e in EM if e['ages'].get('deathAge') is not None]
bd = [e for e in EM if e['ages'].get('birthDate')]
print('accessionAge:', pct(len(acc), 365), ' deathAge:', pct(len(de), 365), ' birthDate:', pct(len(bd), 365))
miss = [e for e in EM if e['ages'].get('birthDate') and e['ages'].get('accessionAge') is None]
print('生年ありで accessionAge が null:', len(miss))
print('  birthDatePrecision:', collections.Counter(e['ages'].get('birthDatePrecision') for e in miss).most_common())
print('  時代内訳:', [(ERA[k], v) for k, v in sorted(collections.Counter(e['eraId'] for e in miss).items(), key=lambda x: ERA_ORDER[x[0]])])
print('accessionAge 判明率（時代別）:')
for eid in sorted(ERA, key=lambda k: ERA_ORDER[k]):
    g = [e for e in EM if e['eraId'] == eid]
    a = sum(1 for e in g if e['ages'].get('accessionAge') is not None)
    print('  %-12s %s' % (ERA[eid], pct(a, len(g))))

# ---------------------------------------------------------------- L. 遷都
h('L. 遷都イベント')
ce = [(e['id'], ev) for e in EM for ev in e['capitalRelocationCount']['events']]
print('件数:', len(ce), '/ count 合計:', sum(e['capitalRelocationCount']['count'] for e in EM))
names = collections.Counter()
for _, ev in ce:
    names[ev.get('from')] += 1
    names[ev.get('to')] += 1
print('都市名の異なり:', len(names))
print('上位:', names.most_common(12))

# ---------------------------------------------------------------- M. 世紀
h('M. 世紀ごとの即位人数と在位中央値')


def century(y):
    return (y - 1)//100 + 1 if y > 0 else -((-y)//100 + 1)


cy = collections.defaultdict(list)
for e in EM:
    cy[century(e['reignSummary']['firstStartYear'])].append(e['reignSummary']['totalReignDuration']['approxDays'])
for c in sorted(cy):
    print('  %4d世紀 n=%-3d 中央値 %.1f年' % (c, len(cy[c]), statistics.median(cy[c])/365.2422))

# ---------------------------------------------------------------- N. 呼称
h('N. name フィールドの被覆')
for k in ['personalName', 'posthumousName', 'templeName']:
    print(' ', k, sum(1 for e in EM if e['name'].get(k)))
print('aliases を持つ:', sum(1 for e in EM if e['name'].get('aliases')))

# ---------------------------------------------------------------- O. 死因
h('O. deathCause')
print(collections.Counter(LBL['deathCause'][e['deathCause']['category']] for e in EM).most_common())

# ============ 追加の実測（候補2の位置正規化・改元0回・軸のクロス） ============
JP = {'eraChangeCount': '改元', 'amnestyCount': '大赦', 'empressInstallationCount': '立后',
      'crownPrinceDepositionCount': '皇太子廃立', 'capitalRelocationCount': '遷都',
      'personalCampaignCount': '親征', 'rebellionSuppressionCount': '反乱鎮圧',
      'rebellionSufferedCount': '被反乱'}


def h(t):
    print('\n' + '=' * 8 + ' ' + t + ' ' + '=' * 8)


def jd(iso):
    """ISO 天文年の日付文字列 → 通し日数（proleptic Gregorian の序数近似）。年のみ/月のみは頭に丸める。"""
    if not iso:
        return None, None
    s = iso.strip()
    neg = s.startswith('-')
    body = s[1:] if neg else s
    parts = body.split('-')
    try:
        y = int(parts[0])
    except ValueError:
        return None, None
    if neg:
        y = -y
    m = int(parts[1]) if len(parts) > 1 else 1
    dd = int(parts[2]) if len(parts) > 2 else 1
    prec = 'day' if len(parts) > 2 else ('month' if len(parts) > 1 else 'year')
    # 序数：datetime は年1未満を扱えないのでユリウス日を自前で計算
    a = (14 - m) // 12
    yy = y + 4800 - a
    mm = m + 12 * a - 3
    jdn = dd + (153 * mm + 2) // 5 + 365 * yy + yy // 4 - yy // 100 + yy // 400 - 32045
    return jdn, prec


# ---------------------------------------------------------------- 候補2の再現
h('候補2: 在位を10等分したときのイベント位置（precision 別）')
rows = collections.defaultdict(lambda: collections.defaultdict(list))
usable_emp = set()
skip_multi = 0
for e in EM:
    if e['reignSummary']['reignCount'] != 1:
        skip_multi += 1
    r = e['reigns'][0]
    s, sp = jd(r['startDate'])
    en, ep = jd(r['endDate'])
    if s is None or en is None or en <= s:
        continue
    span = en - s
    if span < 365:
        continue
    usable_emp.add(e['id'])
    for f in COUNT_FIELDS:
        for ev in e[f]['events']:
            dt = ev.get('date') or ev.get('startDate')
            j, _ = jd(dt)
            if j is None:
                continue
            dp = ev.get('datePrecision')
            dp = 'object' if isinstance(dp, dict) else (dp or 'none')
            pos = (j - s) / span
            if -0.11 <= pos <= 1.11:
                rows[f][dp].append(min(max(pos, 0.0), 1.0))
print('複数回在位（初回のみ採用）:', skip_multi, '／位置決めに使える皇帝:', len(usable_emp))
print('%-12s %-6s %-6s %-8s %-8s  %s' % ('項目', '採用', '全件', '中央値', '最初の1/10', 'precision 内訳'))
for f in COUNT_FIELDS:
    allpos = [p for v in rows[f].values() for p in v]
    tot = sum(len(e[f]['events']) for e in EM)
    if not allpos:
        continue
    br = {k: len(v) for k, v in sorted(rows[f].items(), key=lambda x: -len(x[1]))}
    print('%-12s %-6d %-6d %-8.2f %-8s  %s' % (JP[f], len(allpos), tot, statistics.median(allpos),
          '%.0f%%' % (100 * sum(1 for p in allpos if p < 0.1) / len(allpos)), br))
print()
print('年精度イベントだけを外した場合の「最初の1/10」割合:')
for f in COUNT_FIELDS:
    day = rows[f].get('day', []) + rows[f].get('month', [])
    yr = rows[f].get('year', [])
    if not day:
        continue
    print('  %-12s day+month n=%-5d 先頭1/10 %.0f%% ／ year n=%-4d 先頭1/10 %s'
          % (JP[f], len(day), 100 * sum(1 for p in day if p < 0.1) / len(day), len(yr),
             ('%.0f%%' % (100 * sum(1 for p in yr if p < 0.1) / len(yr))) if yr else '—'))

h('候補2の母集団が落とす層')
inn = [e for e in EM if e['id'] in usable_emp]
out = [e for e in EM if e['id'] not in usable_emp]
print('採用 %d名 中央値 %.2f年 ／ 除外 %d名 中央値 %.2f年' % (
    len(inn), statistics.median([e['reignSummary']['totalReignDuration']['approxDays'] for e in inn]) / 365.2422,
    len(out), statistics.median([e['reignSummary']['totalReignDuration']['approxDays'] for e in out]) / 365.2422))
print('除外の時代内訳:', [(ERA[k], v) for k, v in sorted(collections.Counter(e['eraId'] for e in out).items(), key=lambda x: ERA_ORDER[x[0]])])

h('期間イベントの startDate が在位開始より前（反乱系）')
for f in ['rebellionSufferedCount', 'rebellionSuppressionCount', 'personalCampaignCount']:
    n = pre = 0
    for e in EM:
        s, _ = jd(e['reigns'][0]['startDate'])
        if s is None:
            continue
        for ev in e[f]['events']:
            j, _ = jd(ev.get('startDate'))
            if j is None:
                continue
            n += 1
            if j < s - 30:
                pre += 1
    print('  %-12s %d/%d = %.1f%%' % (JP[f], pre, n, 100 * pre / n))

# ---------------------------------------------------------------- 改元0回
h('eraChangeCount.count == 0 の中身')
z = [e for e in EM if e['eraChangeCount']['count'] == 0]
for e in z[:40]:
    print('  %-28s %-10s %s' % (e['id'], REG[e['regimeId']]['label'], (e['eraChangeCount'].get('note') or '')[:70]))

h('一世一元: 時代 × 「即位後に改元したか」（count>=2）')
for eid in sorted(ERA, key=lambda k: ERA_ORDER[k]):
    g = [e for e in EM if e['eraId'] == eid]
    cs = [e['eraChangeCount']['count'] for e in g]
    pos = [c for c in cs if c > 0]
    ge2 = sum(1 for c in cs if c >= 2)
    print('  %-12s n=%-3d count0=%-3d 中央値%.1f 最大%-3d count>=2 %d (%.0f%%)  count>0に限ると %d/%d=%.0f%%'
          % (ERA[eid], len(g), len(cs) - len(pos), statistics.median(cs), max(cs), ge2, 100 * ge2 / len(g),
             ge2, len(pos), 100 * ge2 / len(pos) if pos else 0))

h('改元イベントの間隔（世紀別・同一皇帝内の連続する改元の年差）')
gap = collections.defaultdict(list)


def iso_y(s):
    if not s:
        return None
    neg = s.startswith('-')
    b = s[1:] if neg else s
    try:
        y = int(b.split('-')[0])
    except ValueError:
        return None
    return -y if neg else y


for e in EM:
    ys = sorted(x for x in (iso_y(ev.get('date')) for ev in e['eraChangeCount']['events']) if x is not None)
    for a, b in zip(ys, ys[1:]):
        c = math.ceil(abs(b) / 100) * (1 if b > 0 else -1)
        gap[c].append(b - a)
for c in sorted(gap):
    print('  %4d世紀 n=%-4d 中央値 %.1f年' % (c, len(gap[c]), statistics.median(gap[c])))

# ---------------------------------------------------------------- 確信度の欠損
h('confidence が enum 外（空文字）のセル')
for e in EM:
    for f in CONF_FIELDS:
        c = e[f].get('confidence')
        if c not in ('high', 'medium', 'low'):
            print('  ', e['id'], f, repr(c))

h('確信度: 項目別の high 率（列で見える差）')
for f in CONF_FIELDS:
    c = collections.Counter(e[f].get('confidence') for e in EM)
    print('  %-28s high %3d (%.0f%%)  medium %3d  low %3d' % (f, c['high'], 100 * c['high'] / 365, c['medium'], c['low']))

h('確信度: 時代別の high 率（行の側の偏り）')
for eid in sorted(ERA, key=lambda k: ERA_ORDER[k]):
    g = [e for e in EM if e['eraId'] == eid]
    cells = [e[f].get('confidence') for e in g for f in CONF_FIELDS]
    print('  %-12s n=%-3d high %.0f%%' % (ERA[eid], len(g), 100 * sum(1 for c in cells if c == 'high') / len(cells)))

# ---------------------------------------------------------------- 建前と実態
h('建前（procedure）× 実態（decidedBy を1つに畳んだ値）')
tbl = collections.defaultdict(collections.Counter)
for e in EM:
    a = e['accessionRoute']['axes']
    db = a['decidedBy']
    k = 'self' if 'self' in db else ('predecessor' if 'predecessor' in db else ('third-party' if 'third-party' in db else 'undetermined'))
    tbl[a['procedure']][k] += 1
order = ['self', 'predecessor', 'third-party', 'undetermined']
print('%-16s %s' % ('', ' '.join('%-8s' % LBL['decidedBy'][k] for k in order)))
for p, c in sorted(tbl.items(), key=lambda x: -sum(x[1].values())):
    print('%-16s %s  計%d' % (LBL['procedure'][p], ' '.join('%-8d' % c[k] for k in order), sum(c.values())))

h('relationToPredecessor を表示用に畳む（規約の丸め方）')
ROLL = {'son': '直系', 'grandson': '直系',
        'younger-brother': '傍系', 'elder-brother': '傍系', 'nephew': '傍系', 'uncle-younger': '傍系',
        'uncle-elder': '傍系', 'cousin': '傍系', 'distant-kin': '傍系', 'father': '傍系', 'mother': '傍系',
        'adopted-son': '養子', 'affinal-kin': '外戚', 'unrelated': '無血縁', 'other': 'その他', 'none': '該当なし'}
c = collections.Counter(ROLL[e['accessionRoute']['axes']['relationToPredecessor']] for e in EM)
print(c.most_common())

h('titleOrigin=新称 93名の内訳')
nw = [e for e in EM if e['accessionRoute']['axes']['titleOrigin'] == 'new']
print('  throneSource:', [(LBL['throneSource'][k], v) for k, v in collections.Counter(e['accessionRoute']['axes']['throneSource'] for e in nw).most_common()])
print('  時代:', [(ERA[k], v) for k, v in sorted(collections.Counter(e['eraId'] for e in nw).items(), key=lambda x: ERA_ORDER[x[0]])])
print('  在位中央値 %.2f年 / 継承組 %.2f年' % (
    statistics.median([e['reignSummary']['totalReignDuration']['approxDays'] for e in nw]) / 365.2422,
    statistics.median([e['reignSummary']['totalReignDuration']['approxDays'] for e in EM if e['accessionRoute']['axes']['titleOrigin'] == 'inherited']) / 365.2422))

h('死因 × throneSource / standing / regimes.category')
VIO = {'assassination', 'execution', 'killed-in-battle', 'suicide'}
print('deathCause enum:', [(v['id'], v['label']) for v in ENUM['deathCause']])
for key, fn in [('throneSource', lambda e: LBL['throneSource'][e['accessionRoute']['axes']['throneSource']]),
                ('standing', lambda e: LBL['emperorStanding'][e['standing']]),
                ('regimeCategory', lambda e: LBL['regimeCategory'][REG[e['regimeId']]['category']])]:
    print(' ', key)
    g = collections.defaultdict(list)
    for e in EM:
        g[fn(e)].append(e)
    for k, v in sorted(g.items(), key=lambda x: -len(x[1])):
        vio = sum(1 for e in v if e['deathCause']['category'] in VIO)
        print('    %-16s n=%-4d 非業の死 %.0f%%  在位中央値 %.2f年' % (
            k, len(v), 100 * vio / len(v),
            statistics.median([e['reignSummary']['totalReignDuration']['approxDays'] for e in v]) / 365.2422))

h('データ品質軸: needsPreciseDays / isExact を時代別に')
for eid in sorted(ERA, key=lambda k: ERA_ORDER[k]):
    g = [e for e in EM if e['eraId'] == eid]
    ex = sum(1 for e in g if e['reignSummary']['totalReignDuration']['isExact'])
    print('  %-12s %d/%d = %.0f%% が日まで確定' % (ERA[eid], ex, len(g), 100 * ex / len(g)))


# ============ 回数系8指標の0回率・在位長との相関・親征・同時在位の日単位 ============
h('回数系8指標: 総件数・0回の人数・在位年数との相関')
F = [(k, JP[k]) for k in COUNT_FIELDS]
print('%-10s %-6s %-10s %-6s %-6s %s' % ('項目', '総件数', '0回の人数', '中央値', '最大', 'r（在位年数）'))
for k, j in F:
    cs = [e[k]['count'] for e in EM]
    z = sum(1 for c in cs if c == 0)
    xs, ys = [], []
    for e in EM:
        d = e['reignSummary']['totalReignDuration']['approxDays'] / 365.2422
        if d >= 1:
            xs.append(d)
            ys.append(e[k]['count'])
    mx, my = sum(xs)/len(xs), sum(ys)/len(ys)
    num = sum((a-mx)*(b-my) for a, b in zip(xs, ys))
    den = math.sqrt(sum((a-mx)**2 for a in xs) * sum((b-my)**2 for b in ys))
    print('%-10s %-6d %-10s %-6d %-6d r=%.2f (n=%d)' % (j, sum(cs), '%d (%.0f%%)' % (z, 100*z/365),
          statistics.median(cs), max(cs), num/den, len(xs)))

h('親征経験率（count>=1）')
for eid in sorted(ERA, key=lambda k: ERA_ORDER[k]):
    g = [e for e in EM if e['eraId'] == eid]
    a = sum(1 for e in g if e['personalCampaignCount']['count'] > 0)
    print('  %-12s %2d/%2d = %3.0f%%  親征総数%3d' % (ERA[eid], a, len(g), 100*a/len(g),
          sum(e['personalCampaignCount']['count'] for e in g)))
for c in ['orthodox', 'coexisting', 'rebel']:
    g = [e for e in EM if REG[e['regimeId']]['category'] == c]
    a = sum(1 for e in g if e['personalCampaignCount']['count'] > 0)
    print('  %-10s %3d/%3d = %3.0f%%' % (LBL['regimeCategory'][c], a, len(g), 100*a/len(g)))
print('  回数トップ:', [(e['name']['commonName'], REG[e['regimeId']]['label'], e['personalCampaignCount']['count'])
                   for e in sorted(EM, key=lambda x: -x['personalCampaignCount']['count'])[:6]])
print('  outcome の語彙（上位）:', collections.Counter((ev.get('outcome') or '')[:8]
      for e in EM for ev in e['personalCampaignCount']['events']).most_common(6))

h('eraChangeCount.count == 0 の note（切り分けは末尾の在位年ベースの節が正）')
for e in EM:
    if e['eraChangeCount']['count'] == 0:
        print('  %-28s %-12s %s' % (e['id'], REG[e['regimeId']]['label'],
                                    (e['eraChangeCount'].get('note') or '')[:60]))
# note の文言（「年号制度」「元号制度」の表記ゆれ）で分類すると han-houshaodi を取り違える。
# 構造的な切り分けはファイル末尾の「count == 0 の切り分け」節を使うこと。

h('同時在位: 年単位 vs 日単位')


def jdn2(iso, end=False):
    if not iso:
        return None
    neg = iso.startswith('-')
    b = iso[1:] if neg else iso
    p = b.split('-')
    y = int(p[0])
    y = -y if neg else y
    m = int(p[1]) if len(p) > 1 else (12 if end else 1)
    dd = int(p[2]) if len(p) > 2 else (28 if end else 1)
    a = (14 - m)//12
    yy = y + 4800 - a
    mm = m + 12*a - 3
    return dd + (153*mm + 2)//5 + 365*yy + yy//4 - yy//100 + yy//400 - 32045


segs = []
for e in EM:
    for r in e['reigns']:
        s, t = jdn2(r['startDate']), jdn2(r['endDate'], True)
        if s and t and t >= s:
            segs.append((s, t))
ev2 = collections.Counter()
for s, t in segs:
    ev2[s] += 1
    ev2[t + 1] -= 1
cur = mx2 = 0
mxd = None
for k in sorted(ev2):
    cur += ev2[k]
    if cur > mx2:
        mx2, mxd = cur, k


def back(j):
    a = j + 32044
    b = (4*a + 3)//146097
    c = a - 146097*b//4
    d = (4*c + 3)//1461
    e2 = c - 1461*d//4
    m = (5*e2 + 2)//153
    return (100*b + d - 4800 + (m + 2)//12, m + 3 - 12*((m + 2)//12), e2 - (153*m + 2)//5 + 1)


print('  日付で区間を作れる在位:', len(segs), '/', sum(len(e['reigns']) for e in EM))
print('  同一日の最大:', mx2, 'at', back(mxd))
p618 = [(e['name']['commonName'], REG[e['regimeId']]['label'], e['standing'])
        for e in EM for r in e['reigns'] if r['startYear'] <= 618 <= r['endYear']]
print('  618年に在位記録を持つ人:', len(p618))

h('「政権で最初に即位した人」で切った場合（≠ self-established）')
firstof2 = {}
for e in EM:
    rid, y = e['regimeId'], e['reignSummary']['firstStartYear']
    if rid not in firstof2 or y < firstof2[rid][1]:
        firstof2[rid] = (e['id'], y)
ids = set(v[0] for v in firstof2.values())
VIO2 = {'assassination', 'execution', 'killed-in-battle', 'suicide'}
for nm, gr in [('政権で最初の即位者', [e for e in EM if e['id'] in ids]),
               ('それ以外', [e for e in EM if e['id'] not in ids])]:
    print('  %s n=%d 在位中央値 %.2f年 非業の死 %.0f%%' % (
        nm, len(gr), statistics.median([x['reignSummary']['totalReignDuration']['approxDays'] for x in gr])/365.2422,
        100*sum(1 for x in gr if x['deathCause']['category'] in VIO2)/len(gr)))


# ============ 親征の在位内限定・時代×政権性格 / 改元0回の構造的な切り分け ============
def iso_y2(s):
    if not s:
        return None
    neg = s.startswith('-')
    b = s[1:] if neg else s
    try:
        y = int(b.split('-')[0])
    except ValueError:
        return None
    return -y if neg else y


def in_reign_year(e, ev):
    """イベントの ISO 年が、いずれかの在位の ISO 年範囲に入るか。
    startYear/endYear は歴史年なので紀元前は +1 して天文年へ直す。"""
    y = iso_y2(ev.get('startDate') or ev.get('date'))
    if y is None:
        return None
    for r in e['reigns']:
        lo, hi = r['startYear'], r['endYear']
        if (lo + 1 if lo < 0 else lo) <= y <= (hi + 1 if hi < 0 else hi):
            return True
    return False


h('親征: 全件 vs 在位年範囲内に限った場合')
print('  イベント単位:', dict(collections.Counter(
    in_reign_year(e, ev) for e in EM for ev in e['personalCampaignCount']['events'])),
    '（True=在位年内 / False=範囲外＝称帝前など / None=日付なし）')
print('  %-12s %-13s %-13s' % ('時代', '全件', '在位年内'))
for eid in sorted(ERA, key=lambda k: ERA_ORDER[k]):
    g = [e for e in EM if e['eraId'] == eid]
    a = sum(1 for e in g if e['personalCampaignCount']['count'] > 0)
    b = sum(1 for e in g if any(in_reign_year(e, ev) for ev in e['personalCampaignCount']['events']))
    print('  %-12s %2d/%2d=%3.0f%%    %2d/%2d=%3.0f%%' % (ERA[eid], a, len(g), 100*a/len(g), b, len(g), 100*b/len(g)))
for cat in ['orthodox', 'coexisting', 'rebel']:
    g = [e for e in EM if REG[e['regimeId']]['category'] == cat]
    a = sum(1 for e in g if e['personalCampaignCount']['count'] > 0)
    b = sum(1 for e in g if any(in_reign_year(e, ev) for ev in e['personalCampaignCount']['events']))
    print('  %-10s 全件 %3d/%3d=%3.0f%%   在位年内 %3d/%3d=%3.0f%%' % (
        LBL['regimeCategory'][cat], a, len(g), 100*a/len(g), b, len(g), 100*b/len(g)))

h('親征: 時代 × 政権の性格（n>=5 のセルのみ・時代表と独立でないことの確認）')
for eid in sorted(ERA, key=lambda k: ERA_ORDER[k]):
    row = []
    for cat in ['orthodox', 'coexisting', 'rebel']:
        g = [e for e in EM if e['eraId'] == eid and REG[e['regimeId']]['category'] == cat]
        if len(g) >= 5:
            a = sum(1 for e in g if e['personalCampaignCount']['count'] > 0)
            row.append('%s %d/%d=%.0f%%' % (LBL['regimeCategory'][cat], a, len(g), 100*a/len(g)))
    if row:
        print('  %-12s %s' % (ERA[eid], ' | '.join(row)))

h('eraChangeCount.count == 0 の切り分け（note の文言でなく在位年で決める）')
print('  最初の年号「建元」は前140年（漢武帝）。lastEndYear < -140 なら年号制度の成立前。')
z0 = [e for e in EM if e['eraChangeCount']['count'] == 0]
pre0 = [e for e in z0 if e['reignSummary']['lastEndYear'] < -140]
print('  count==0 合計', len(z0))
print('  (a) 年号制度の成立前:', len(pre0), [e['id'] for e in pre0])
print('  (b) 先帝の元号を継続:', len(z0) - len(pre0))
print('  ※ 前140年より前に在位を終えた皇帝で count>0 なのは:',
      [(e['id'], e['eraChangeCount']['count']) for e in EM
       if e['reignSummary']['lastEndYear'] < -140 and e['eraChangeCount']['count'] > 0],
      '（前元/中元/後元の紀年更新を改元として数えている）')
