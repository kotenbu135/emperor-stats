#!/usr/bin/env python3
"""案Aモック生成: 唯一王朝期間を太帯で表す通史年表HTML(静的・実データ)"""
import json, html, os
from collections import defaultdict

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..')
DATA = json.load(open(os.path.join(ROOT, 'data', 'emperors.json')))
BG = (0xF5, 0xF1, 0xE8)
SERIES = ['#2a78d6', '#008300', '#e87ba4', '#eda100', '#1baf7a', '#eb6834', '#4a3aa7', '#e34948']

def astro(y): return y if y > 0 else y + 1
def disp(a): return a if a > 0 else a - 1
def fmt(y): return f'前{-y}' if y < 0 else str(y)

def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
def mix(color, pct):  # color-mix(color pct%, BG)
    c = hexrgb(color)
    m = tuple(round(c[i]*pct/100 + BG[i]*(1-pct/100)) for i in range(3))
    return '#%02x%02x%02x' % m

# --- 帯の構築(サイトのgetTimelineDataを簡略再現) ---
by_key = {}
for e in DATA['emperors']:
    d = e['dynasty']
    key = (d.get('name') or '?') + '|' + (d.get('section') or '')
    ent = by_key.setdefault(key, {'label': d.get('name') or '?', 'cats': set(), 'ivs': []})
    ent['cats'].add(d.get('category'))
    for r in e['reigns']:
        ent['ivs'].append((astro(r['startYear']), astro(r['endYear'])))

def merge(ivs):
    ivs = sorted(ivs)
    out = [list(ivs[0])]
    for s, e in ivs[1:]:
        if s <= out[-1][1] + 1: out[-1][1] = max(out[-1][1], e)
        else: out.append([s, e])
    return [tuple(x) for x in out]

bands = []
for key, ent in by_key.items():
    spans = merge(ent['ivs'])
    bands.append({
        'key': key, 'label': ent['label'],
        'cat': '正統' if '正統' in ent['cats'] else 'other',
        'start': spans[0][0], 'end': spans[-1][1], 'spans': spans,
    })
bands.sort(key=lambda b: (b['start'], 0 if b['cat'] == '正統' else 1, -(b['end'] - b['start'])))

def pack(group, offset):
    ends = []
    for b in group:
        for i, e in enumerate(ends):
            if b['start'] >= e:
                b['lane'] = offset + i; ends[i] = b['end']; break
        else:
            b['lane'] = offset + len(ends); ends.append(b['end'])
    return len(ends)

main_n = pack([b for b in bands if b['cat'] == '正統'], 0)
other_n = pack([b for b in bands if b['cat'] != '正統'], main_n)

# 配色スロット(重なり・同一レーン隣接を回避)
last_in_lane = {}
for i, b in enumerate(bands):
    used = {bands[j]['slot'] for j in range(i)
            if bands[j]['end'] >= b['start'] and bands[j]['start'] <= b['end']}
    if b['lane'] in last_in_lane: used.add(last_in_lane[b['lane']])
    b['slot'] = next((s for s in range(1, 9) if s not in used), (b['lane'] % 8) + 1)
    last_in_lane[b['lane']] = b['slot']

# --- 唯一王朝期間(年→王朝キー集合) ---
year_dyns = defaultdict(set)
for e in DATA['emperors']:
    d = e['dynasty']
    key = (d.get('name') or '?') + '|' + (d.get('section') or '')
    for r in e['reigns']:
        for y in range(astro(r['startYear']), astro(r['endYear'])+1):
            year_dyns[y].add(key)
sole_years = defaultdict(set)  # key -> {year}
for y, ds in year_dyns.items():
    if len(ds) == 1: sole_years[next(iter(ds))].add(y)

def split_sole(key, s, e):
    """span(s,e)を唯一/通常のサブ区間列に分割"""
    ys = sole_years.get(key, set())
    out, cur = [], None
    for y in range(s, e+1):
        f = y in ys
        if cur and cur[2] == f: cur[1] = y
        else:
            if cur: out.append(tuple(cur))
            cur = [y, y, f]
    if cur: out.append(tuple(cur))
    return out  # [(s,e,is_sole)]

# 空位期間
y0 = min(b['start'] for b in bands); y1 = max(b['end'] for b in bands)
vac, cur = [], None
for y in range(y0, y1+1):
    if not year_dyns.get(y):
        if cur and cur[1] == y-1: cur[1] = y
        else:
            if cur: vac.append(tuple(cur))
            cur = [y, y]
    else:
        if cur: vac.append(tuple(cur)); cur = None
if cur: vac.append(tuple(cur))

# --- 描画 ---
PXY = 0.62
PAD = 14
LANE_H = 30
H_NORMAL, H_SOLE, H_OTHER = 18, 28, 9
W = round((y1 + 1 - y0) * PXY) + PAD * 2
def x(a): return PAD + (a - y0) * PXY
def w(s, e): return (e + 1 - s) * PXY

def band_divs(b, top_of):
    fill_p, edge_p = (40, 78) if b['cat'] == '正統' else (22, 52)
    color = SERIES[(b['slot']-1) % 8]
    fill, edge = mix(color, fill_p), mix(color, edge_p)
    hN = H_NORMAL if b['cat'] == '正統' else H_OTHER
    lane_top = top_of(b['lane'])
    parts = []
    if len(b['spans']) > 1:
        parts.append(f'<div style="position:absolute;left:{x(b["start"]):.1f}px;width:{w(b["start"],b["end"]):.1f}px;top:{lane_top+LANE_H/2-0.5:.1f}px;border-top:1px dashed {edge}"></div>')
    label_done = False
    for s, e in b['spans']:
        for ss, ee, sole in split_sole(b['key'], s, e):
            h = H_SOLE if sole and b['cat'] == '正統' else hN
            top = lane_top + (LANE_H - h) / 2
            parts.append(f'<div style="position:absolute;left:{x(ss):.1f}px;width:{max(w(ss,ee),1.2):.1f}px;top:{top:.1f}px;height:{h}px;background:{fill};border:1px solid {edge};border-radius:2px"></div>')
    bw = w(b['start'], b['end'])
    if bw >= len(b['label']) * 11 + 8:
        parts.append(f'<div style="position:absolute;left:{x(b["start"])+5:.1f}px;top:{lane_top:.0f}px;height:{LANE_H}px;line-height:{LANE_H}px;font-size:11px;font-weight:600;color:#3A3530;text-shadow:0 0 3px #F5F1E8,0 0 3px #F5F1E8;white-space:nowrap">{html.escape(b["label"])}</div>')
    return parts

def render_chart(top_of, total_rows, note, separator_row=None):
    AXIS = 24
    ch = AXIS + total_rows * LANE_H + 8
    parts = [f'<div class="note">{note}</div>',
             f'<div class="chartwrap"><div style="position:relative;width:{W}px;height:{ch}px">']
    for y in range(-200, 2000, 200):
        if y == 0: continue
        a = astro(y)
        if a < y0 or a > y1: continue
        parts.append(f'<div style="position:absolute;left:{x(a):.1f}px;top:2px;font-size:10px;color:#8a8378;transform:translateX(-50%)">{fmt(y)}</div>')
        parts.append(f'<div style="position:absolute;left:{x(a):.1f}px;top:{AXIS}px;width:1px;height:{total_rows*LANE_H}px;background:rgba(58,53,48,0.10)"></div>')
    for s, e in vac:
        parts.append(f'<div style="position:absolute;left:{x(s):.1f}px;width:{max(w(s,e),2):.1f}px;top:{AXIS}px;height:{total_rows*LANE_H}px;background:repeating-linear-gradient(45deg,rgba(58,53,48,0.14) 0 2px,transparent 2px 7px)"></div>')
    if separator_row is not None:
        parts.append(f'<div style="position:absolute;left:0;right:0;top:{AXIS+separator_row*LANE_H-1}px;border-top:1px dashed rgba(58,53,48,0.35)"></div>')
    for b in bands:
        parts += band_divs(b, lambda l: AXIS + top_of(l) * LANE_H)
    parts.append('</div></div>')
    return '\n'.join(parts)

# 配置1: 現行(正統上ブロック/非正統下ブロック)
v1 = render_chart(lambda l: l, main_n + other_n,
                  '配置は現行のまま(正統ブロック上/並立・反乱ブロック下)。正統帯のうち「皇帝がこの王朝のみ」の期間だけ太くなる。',
                  separator_row=main_n)
# 配置2: 本流中央(正統並立を上、lane0を中央、非正統を下)
v2 = render_chart(lambda l: (main_n - 1 - l) if l < main_n else l, main_n + other_n,
                  '前回提案の「本流中央」配置と組み合わせた版。中央の背骨が統一期に太く、分裂期に細くなり上下に並立が膨らむ。')

sole_leg = mix(SERIES[0], 40); sole_edge = mix(SERIES[0], 78)
other_leg = mix(SERIES[1], 22); other_edge = mix(SERIES[1], 52)
legend = f'''<div class="legend">
<span><i style="height:{H_SOLE-8}px;background:{sole_leg};border:1px solid {sole_edge}"></i>正統・皇帝がこの王朝のみの期間(太)</span>
<span><i style="height:{H_NORMAL-8}px;background:{sole_leg};border:1px solid {sole_edge}"></i>正統・他王朝の皇帝と並立(通常)</span>
<span><i style="height:{H_OTHER-2}px;background:{other_leg};border:1px solid {other_edge}"></i>並立・反乱・自称政権</span>
<span><i style="height:12px;border:1px solid #ccc;background:repeating-linear-gradient(45deg,rgba(58,53,48,0.2) 0 2px,transparent 2px 6px)"></i>皇帝不在</span>
<span><i style="height:1px;border-top:1px dashed #8a8378;background:none"></i>同王朝で皇帝不在の期間(コネクタ)</span>
</div>'''

out = f'''<meta charset="utf-8"><title>案Aモック: 唯一王朝期間の太帯表現</title>
<style>
body{{background:#F5F1E8;color:#3A3530;font-family:"Hiragino Sans","Noto Sans JP",sans-serif;margin:24px;max-width:100%}}
h1{{font-size:18px}} h2{{font-size:15px;margin:28px 0 6px}}
.note{{font-size:12px;color:#6b645a;margin:4px 0 8px}}
.chartwrap{{overflow-x:auto;border:1px solid #d8d2c6;border-radius:4px;background:#F5F1E8}}
.legend{{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:#6b645a;margin:10px 0 4px}}
.legend i{{display:inline-block;width:22px;border-radius:2px;vertical-align:middle;margin-right:5px}}
</style>
<h1>案Aモック — 「皇帝がこの王朝のみ」の期間を太帯で表す</h1>
<div class="note">data/emperors.json の在位データから機械算出(前221〜1945・全期間ズーム相当0.62px/年)。横スクロールできます。</div>
{legend}
<h2>1. 現行レイアウト + 案A</h2>
{v1}
<h2>2. 本流中央配置 + 案A</h2>
{v2}
<div class="note" style="margin-top:16px">申し送りの境界事例がそのまま見えます: 東晋371〜383・南宋1235〜1259・清(満洲国)1934〜1945 も太帯になる点に注目。</div>
'''
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'timeline-thick-bands.html')
open(path, 'w').write(out)
print('written', path, 'lanes:', main_n, other_n, 'bands:', len(bands), 'width:', W)
