#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""「中国皇帝の大河」— 87王朝を意味集約した通史タイムラインのインタラクティブモック。
縦軸=地理(上:北方/中央:統一/下:南方)、太さ=天下唯一の皇帝、灰=群雄クラスター。
ズーム3段階(全体/拡大/詳細)で皇帝セグメント・名前を表示、クラスターはクリックで開閉。
データは data/emperors.json の純粋な写像(集約と配置のみ手動キュレーション)。
再生成: python3 timeline-river.gen.py → timeline-river.html"""
import json, os
from collections import defaultdict

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..')
DATA = json.load(open(os.path.join(ROOT, 'data', 'emperors.json')))

PAPER, INK, MUTED, SEAL = '#F5F1E8', '#3A3530', '#8a8378', '#B03A2E'
C = {'blue': '#2a78d6', 'green': '#008300', 'gold': '#eda100', 'teal': '#1baf7a',
     'violet': '#4a3aa7', 'red': '#e34948', 'pink': '#e87ba4', 'orange': '#eb6834'}

def astro(y): return y if y > 0 else y + 1
def hexrgb(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
def mix(c, p, base=PAPER):
    a, b = hexrgb(c), hexrgb(base)
    return '#%02x%02x%02x' % tuple(round(a[i]*p/100 + b[i]*(1-p/100)) for i in range(3))

# ---------- データ抽出 ----------
keys = {}   # (name,section) -> {'ivs': [...], 'n': 人数, 'emps': [{n,rr:[[s,e,rst]]}]}
year_dyns = defaultdict(set)
for e in DATA['emperors']:
    d = e['dynasty']
    k = (d.get('name') or '?', d.get('section') or '')
    ent = keys.setdefault(k, {'ivs': [], 'n': 0, 'emps': []})
    ent['n'] += 1
    nm = (e.get('name') or {})
    disp = nm.get('commonName') or nm.get('personalName') or e['id']
    rr = []
    for r in e['reigns']:
        s, t = astro(r['startYear']), astro(r['endYear'])
        ent['ivs'].append((s, t))
        rr.append([s, t, bool(r.get('isRestoration'))])
        for y in range(s, t + 1):
            year_dyns[y].add(k)
    ent['emps'].append({'n': disp, 'rr': rr})

def merge(ivs, gap=1):
    ivs = sorted(ivs)
    out = [list(ivs[0])]
    for s, e in ivs[1:]:
        if s <= out[-1][1] + gap: out[-1][1] = max(out[-1][1], e)
        else: out.append([s, e])
    return [tuple(v) for v in out]

# ---------- ストリーム定義(集約・配置・配色のキュレーション) ----------
S = []
def st(label, ks, row, color, kind='major', sub=None, splits=None, rows=None,
       subdiv=False, labelpos='in'):
    S.append(dict(label=label, keys=ks, row=row, color=color, kind=kind, sub=sub,
                  splits=splits or [], rows=rows, subdiv=subdiv, labelpos=labelpos))

K = lambda n, s: (n, s)
st('秦', [K('秦','秦（始皇帝以降）')], 0, C['red'], labelpos='out')
st('前漢', [K('前漢','秦（始皇帝以降）')], 0, C['gold'], sub='皇帝14人')
st('新', [K('新','新')], 0, C['blue'], labelpos='out')
st('更始帝', [K('玄漢（更始）','新')], 0, C['gold'], kind='tiny', labelpos='out')
st('後漢', [K('後漢','後漢')], 0, C['gold'], sub='皇帝14人')
st('赤眉・成家など', [K('漢（赤眉軍）','漢（赤眉軍）'), K('成家','成家'), K('梁','梁')],
   1, None, kind='cluster', labelpos='out')
st('袁術（仲）', [K('仲家','仲家')], 1, None, kind='cluster', labelpos='out')
st('魏', [K('魏','三国時代')], 0, C['blue'])
st('蜀漢', [K('蜀漢','三国時代')], 1, C['gold'])
st('呉', [K('呉','三国時代')], 2, C['green'])
st('西晋', [K('西晋','晋')], 0, C['violet'])
st('五胡十六国', [K('成漢','成漢'), K('前趙（漢趙）','前趙'), K('後趙','後趙'),
   K('前燕','前燕'), K('前秦','前秦'), K('前涼','前涼'), K('西燕','西燕'),
   K('後燕','後燕'), K('後秦','後秦'), K('南燕','南燕'), K('夏','夏')],
   -1, None, kind='cluster', sub='11政権・皇帝43人')
st('東晋', [K('東晋','晋')], 1, C['violet'], sub='皇帝11人')
st('桓玄（楚）', [K('楚（桓楚）','楚')], 2, None, kind='cluster', labelpos='out')
st('北魏', [K('北魏','北朝')], -1, C['blue'], sub='皇帝18人')
st('東魏', [K('東魏','北朝')], -1, C['blue'], labelpos='out')
st('北斉', [K('北斉','北朝')], -1, C['blue'])
st('西魏', [K('西魏','北朝')], -2, C['violet'], labelpos='out')
st('北周', [K('北周','北朝')], -2, C['violet'])
st('宋', [K('宋','南朝')], 1, C['green'])
st('斉', [K('斉','南朝')], 1, C['orange'])
st('梁', [K('梁','南朝')], 1, C['teal'])
st('侯景（漢）', [K('梁（簒奪・漢）','南朝')], 2, None, kind='cluster', labelpos='below')
st('後梁（西梁）', [K('後梁','南朝')], 2, C['teal'], kind='tiny', labelpos='out')
st('陳', [K('陳','南朝')], 1, C['pink'])
st('隋', [K('隋','隋')], 0, C['teal'])
st('隋末群雄', [K('定楊','隋末群雄'), K('秦（西秦）','隋末群雄'), K('楚','隋末群雄'),
   K('許','隋末群雄'), K('梁','隋末群雄'), K('涼','隋末群雄'), K('鄭','隋末群雄'),
   K('呉','隋末群雄'), K('宋','隋末群雄')], -1, None, kind='cluster', labelpos='out')
st('唐', [K('唐','唐')], 0, C['gold'], sub='皇帝21人')
st('武周', [K('周','唐')], 0, C['pink'], labelpos='out')
st('燕（安史の乱）ほか', [K('燕','唐'), K('秦（漢）','唐'), K('楚','唐'), K('斉','唐')],
   -1, None, kind='cluster', labelpos='out')
st('五代', [K('後梁','五代十国'), K('後唐','五代十国'), K('後晋','五代十国'),
   K('後漢','五代十国'), K('後周','五代十国')], 0, C['orange'],
   subdiv=True, sub='5王朝・皇帝13人')
st('十国', [K('前蜀','五代十国'), K('桀燕','五代十国'), K('南漢','五代十国'),
   K('呉','五代十国'), K('閩','五代十国'), K('後蜀','五代十国'),
   K('南唐','五代十国'), K('北漢','五代十国')], 1, None, kind='cluster',
   sub='皇帝を称した8政権')
st('遼', [K('遼','宋遼西夏金')], -1, C['blue'], sub='皇帝9人')
st('西遼', [K('西遼','宋遼西夏金')], -1, C['blue'], labelpos='in')
st('金', [K('金','宋遼西夏金')], -2, C['violet'], sub='皇帝10人')
st('西夏', [K('西夏','宋遼西夏金')], -3, C['teal'], sub='皇帝10人')
st('北宋', [K('北宋','宋遼西夏金')], 0, C['green'], sub='皇帝9人')
st('南宋', [K('南宋','宋遼西夏金')], 1, C['green'], sub='皇帝9人')
st('楚・斉（金の傀儡）', [K('楚','宋遼西夏金'), K('斉','宋遼西夏金')], 0, None,
   kind='cluster', labelpos='out')
st('元', [K('元','元')], 0, C['blue'], sub='皇帝11人', splits=[astro(1368)], rows=[0, -1])
st('北元', [K('北元','元')], -1, C['blue'], labelpos='out')
st('元末群雄', [K('天完','元'), K('宋','元'), K('陳漢','元'), K('夏','元')],
   1, None, kind='cluster', sub='天完・宋・陳漢・夏', labelpos='out')
st('明', [K('明','明')], 0, C['red'], sub='皇帝16人')
st('南明', [K('南明','明')], 1, C['red'], labelpos='out')
st('順・西（李自成・張献忠）', [K('順','明'), K('西','明')], 2, None,
   kind='cluster', labelpos='out')
st('清', [K('清','清')], 0, C['blue'], sub='皇帝11人',
   splits=[astro(1644)], rows=[-1, 0, 0, -1])
st('三藩の乱（呉周）', [K('呉周','清')], 1, None, kind='cluster', labelpos='below')
st('袁世凱（中華帝国）', [K('中華帝国','清')], 0, None, kind='cluster', labelpos='below')

used = set()
for s in S:
    for k in s['keys']:
        assert k in keys, f'unknown key {k}'
        assert k not in used, f'dup {k}'
        used.add(k)
assert not (set(keys) - used), f'unassigned: {set(keys) - used}'

def sole_split(kset, a, b):
    out, cur = [], None
    for y in range(a, b + 1):
        ds = year_dyns.get(y, set())
        f = 1 if (ds and ds <= kset) else 0
        if cur and cur[2] == f: cur[1] = y
        else:
            if cur: out.append(cur)
            cur = [y, y, f]
    if cur: out.append(cur)
    return out

for si, s in enumerate(S):
    ivs = [iv for k in s['keys'] for iv in keys[k]['ivs']]
    spans = merge(ivs)
    if s['splits']:
        cut = []
        for a, b in spans:
            for c in s['splits']:
                if a < c <= b:
                    cut.append((a, c - 1)); a = c
            cut.append((a, b))
        spans = cut
    rows = s['rows'] if s['rows'] else [s['row']] * len(spans)
    assert len(rows) == len(spans), f"rows mismatch {s['label']}"
    kset = set(s['keys'])
    s['spansOut'] = [{'a': a, 'b': b, 'row': r,
                      'pieces': sole_split(kset, a, b) if s['kind'] != 'cluster' else [[a, b, 0]]}
                     for (a, b), r in zip(spans, rows)]
    s['n'] = sum(keys[k]['n'] for k in s['keys'])
    s['start'], s['end'] = spans[0][0], spans[-1][1]
    # 皇帝セグメント(在位ごと。開始年順)
    segs = []
    for k in s['keys']:
        for emp in keys[k]['emps']:
            for (a, b, rst) in emp['rr']:
                segs.append({'n': emp['n'], 'a': a, 'b': b, 'rst': 1 if rst else 0,
                             'd': k[0] if len(s['keys']) > 1 else ''})
    segs.sort(key=lambda g: (g['a'], g['b']))
    s['segs'] = segs
    # クラスターの構成政権(開閉表示用)。開始年順にミニレーンへ詰める
    if s['kind'] == 'cluster':
        members = []
        for k in s['keys']:
            iv = merge(keys[k]['ivs'])
            msegs = sorted(
                [{'n': emp['n'], 'a': a, 'b': b, 'rst': 1 if rst else 0}
                 for emp in keys[k]['emps'] for (a, b, rst) in emp['rr']],
                key=lambda g: (g['a'], g['b']))
            members.append({'label': k[0], 'spans': [list(v) for v in iv],
                            'n': keys[k]['n'], 'segs': msegs,
                            'start': iv[0][0], 'end': iv[-1][1]})
        members.sort(key=lambda m: (m['start'], -(m['end'] - m['start'])))
        ends = []
        for m in members:
            for li, e2 in enumerate(ends):
                if m['start'] > e2:
                    m['lane'] = li; ends[li] = m['end']; break
            else:
                m['lane'] = len(ends); ends.append(m['end'])
        s['members'] = members
        s['lanes'] = len(ends)
    # 五代の内部区分(王朝ごとの境界とラベル)
    if s['subdiv']:
        s['subdivs'] = []
        for k in s['keys']:
            iv = merge(keys[k]['ivs'])
            s['subdivs'].append({'label': k[0], 'a': iv[0][0], 'b': iv[-1][1]})
        s['subdivs'].sort(key=lambda v: v['a'])

BYL = {s['label']: i for i, s in enumerate(S)}
Y0 = min(s['start'] for s in S); Y1 = max(s['end'] for s in S)

# 空位・バーコード
vac, cur = [], None
runs, rcur = [], None
for y in range(Y0, Y1 + 1):
    nd = len(year_dyns.get(y, ()))
    if nd == 0:
        if cur and cur[1] == y - 1: cur[1] = y
        else: cur = [y, y]; vac.append(cur)
    else:
        cur = None
    stt = 'u' if nd == 1 else ('v' if nd == 0 else 'd')
    if rcur and rcur[2] == stt: rcur[1] = y
    else: rcur = [y, y, stt]; runs.append(rcur)

CHAPTERS = [(-221, 220, '秦・漢'), (220, 280, '三国'), (280, 420, '晋・五胡十六国'),
            (420, 581, '南北朝'), (581, 907, '隋・唐'), (907, 960, '五代十国'),
            (960, 1279, '宋と北方王朝'), (1279, 1368, '元'), (1368, 1644, '明'),
            (1644, 1912, '清'), (1912, 1945, '')]
EVENTS = [(-221, '秦が天下を統一', 0), (220, '後漢滅亡・三国へ', 0),
          (280, '西晋が再統一', 1), (317, '晋、江南へ（南北分裂）', 0),
          (439, '北魏が華北を統一', 1), (589, '隋が南北を再統一', 0),
          (690, '武則天・唯一の女帝', 1), (755, '安史の乱', 0),
          (907, '唐滅亡・五代十国', 1), (960, '北宋建国', 0),
          (1127, '靖康の変・宋が南遷', 1), (1279, '元が南宋を滅ぼし統一', 0),
          (1368, '明建国・元は北走', 1), (1644, '明滅亡・清が入関', 0),
          (1912, '宣統帝退位・帝制終焉', 1), (1934, '満洲国', 0)]
EDGES = [('秦', '前漢', 'dash', None), ('前漢', '新', 'succ', None),
    ('新', '更始帝', 'succ', None), ('更始帝', '後漢', 'succ', None),
    ('後漢', '魏', 'succ', None), ('蜀漢', '魏', 'merge', 263),
    ('魏', '西晋', 'succ', None), ('呉', '西晋', 'merge', 280),
    ('西晋', '東晋', 'succ', None), ('西晋', '五胡十六国', 'fork', 306),
    ('五胡十六国', '北魏', 'merge', 439), ('東晋', '宋', 'succ', None),
    ('北魏', '東魏', 'succ', None), ('北魏', '西魏', 'fork', 535),
    ('東魏', '北斉', 'succ', None), ('西魏', '北周', 'succ', None),
    ('北斉', '北周', 'merge', 577), ('北周', '隋', 'succ', None),
    ('宋', '斉', 'succ', None), ('斉', '梁', 'succ', None),
    ('梁', '陳', 'succ', None), ('梁', '後梁（西梁）', 'fork', 555),
    ('陳', '隋', 'merge', 589), ('後梁（西梁）', '隋', 'merge', 587),
    ('隋', '唐', 'succ', None), ('隋', '隋末群雄', 'fork', 617),
    ('隋末群雄', '唐', 'merge', 628), ('唐', '武周', 'succ', 690),
    ('武周', '唐', 'succ', 705), ('唐', '五代', 'succ', None),
    ('唐', '十国', 'fork', 907), ('五代', '北宋', 'succ', None),
    ('十国', '北宋', 'merge', 979), ('北宋', '南宋', 'succ', None),
    ('南宋', '元', 'merge', 1279), ('元', '北元', 'succ', None),
    ('元末群雄', '明', 'merge', 1368), ('明', '南明', 'fork', 1644),
    ('南明', '清', 'merge', 1662)]

payload = {
    'paper': PAPER, 'ink': INK, 'muted': MUTED, 'seal': SEAL,
    'Y0': Y0, 'Y1': Y1,
    'streams': [{'label': s['label'], 'kind': s['kind'],
                 'fill': mix(s['color'], 42) if s['color'] else mix('#6b645a', 16),
                 'edge': mix(s['color'], 82) if s['color'] else mix('#6b645a', 46),
                 'sub': s['sub'], 'labelpos': s['labelpos'],
                 'spans': s['spansOut'], 'segs': s['segs'], 'n': s['n'],
                 'start': s['start'], 'end': s['end'],
                 'members': s.get('members'), 'lanes': s.get('lanes'),
                 'subdivs': s.get('subdivs')} for s in S],
    'edges': [{'f': BYL[f], 't': BYL[t], 'kind': k, 'year': (astro(y) if y else None)}
              for (f, t, k, y) in EDGES],
    'chapters': [{'a': astro(a), 'b': astro(b), 'label': l} for a, b, l in CHAPTERS],
    'events': [{'a': astro(y), 'text': t, 'lv': lv} for y, t, lv in EVENTS],
    'vac': [list(v) for v in vac],
    'runs': [list(r) for r in runs],
    'sealGold': mix(C['gold'], 78), 'grayRun': mix('#6b645a', 26),
}

TPL = r'''<meta charset="utf-8"><title>中国皇帝の大河 — 通史タイムライン新案</title>
<style>
:root { color-scheme: light; }
body { background:__PAPER__; color:__INK__; margin:0; padding:26px 24px 40px;
  font-family:'Hiragino Sans','Yu Gothic','Noto Sans JP',sans-serif; }
.hd { display:flex; align-items:baseline; gap:14px; margin-bottom:2px; flex-wrap:wrap; }
h1 { font-family:'Yu Mincho','Hiragino Mincho ProN',serif; font-size:26px; letter-spacing:6px; margin:0; }
.seal { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px;
  background:__SEAL__; color:__PAPER__; font-family:'Yu Mincho',serif; font-size:16px; border-radius:3px;
  transform:rotate(-2deg) translateY(4px); }
.sub { color:__MUTED__; font-size:12.5px; }
.howto { display:flex; flex-wrap:wrap; gap:16px; margin:8px 0 10px; font-size:12px; color:#5d574e; }
.howto b { font-weight:600; color:__INK__; }
.howto span { display:inline-flex; align-items:center; gap:6px; }
.chip { display:inline-block; border-radius:2.5px; }
.bar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:0 0 10px; }
.bar .lbl { font-size:11px; color:__MUTED__; margin-right:2px; }
button.z { font:600 12px 'Hiragino Sans','Yu Gothic',sans-serif; padding:4px 12px; border-radius:4px;
  border:1px solid #c9c2b4; background:__PAPER__; color:__INK__; cursor:pointer; }
button.z[data-on="1"] { background:__SEAL__; border-color:__SEAL__; color:__PAPER__; }
button.c { font:11px 'Yu Mincho','Hiragino Mincho ProN',serif; font-weight:600; padding:3px 9px;
  border-radius:99px; border:1px solid #d5cec0; background:transparent; color:#5d574e; cursor:pointer; }
button.c:hover { border-color:__SEAL__; color:__SEAL__; }
.frame { display:flex; }
.gut { position:relative; width:46px; flex:none; }
.gut div { position:absolute; right:8px; font-size:10px; color:#57514a; writing-mode:vertical-rl;
  letter-spacing:2px; font-weight:600; white-space:nowrap; transition:top .15s; }
.gut i { position:absolute; right:2px; width:3px; border-radius:2px; display:block; }
.scroll { overflow-x:auto; border:1px solid rgba(58,53,48,0.18); border-radius:6px;
  background:__PAPER__; box-shadow:0 1px 0 rgba(58,53,48,0.05); flex:1; }
.tip { position:fixed; z-index:10; pointer-events:none; display:none; max-width:280px;
  background:__PAPER__; border:1px solid rgba(58,53,48,0.35); border-radius:5px;
  box-shadow:0 2px 10px rgba(58,53,48,0.18); padding:7px 10px; font-size:11.5px; line-height:1.6; }
.tip b { font-family:'Yu Mincho','Hiragino Mincho ProN',serif; font-size:13px; }
.tip .m { color:__MUTED__; }
.tip .h { color:__SEAL__; font-size:10px; margin-top:2px; }
.fn { margin-top:12px; font-size:11px; color:__MUTED__; line-height:1.8; max-width:1100px; }
</style>
<div class="hd"><span class="seal">帝</span><h1>中国皇帝の大河</h1>
<span class="sub">前221年–1945年 ｜ 皇帝を名乗った365人・87政権の2166年を1枚に</span></div>
<div class="howto">
<span><span class="chip" style="width:22px;height:15px;background:#f3ddb0;border:1px solid #eab52d"></span>→<span class="chip" style="width:22px;height:24px;background:#f3ddb0;border:1px solid #eab52d"></span><b>太い帯＝天下に皇帝がその王朝ただ一つ</b>（統一）</span>
<span><b>上下＝地理</b>：上が北方・下が南方・中央が統一王朝の座</span>
<span><span class="chip" style="width:22px;height:15px;background:repeating-linear-gradient(45deg,#c4bfb4 0 2px,#e4dfd4 2px 6px);border:1px solid #b9b2a4"></span><b>灰色＝群雄のまとまり（クリックで開閉）</b></span>
<span><span class="chip" style="width:22px;height:2px;border-top:2px dashed #a9a295;background:none"></span><b>点線＝中断・継承</b></span>
<span><b>拡大・詳細ズーム＝皇帝ごとの区切りと名前</b></span>
</div>
<div class="bar"><span class="lbl">表示範囲</span>
<button class="z" id="z-fit" data-on="1">全体</button>
<button class="z" id="z-mid">拡大</button>
<button class="z" id="z-det">詳細</button>
<span class="lbl" style="margin-left:10px">時代へ移動</span><span id="chapnav"></span></div>
<div class="frame"><div class="gut" id="gut"></div><div class="scroll" id="sc"><svg id="svg"></svg></div></div>
<div class="tip" id="tip"></div>
<div class="fn">縦軸の配置と政権の集約のみ編集（北・南・統一の座）。期間・太さ・統一/分裂の判定はすべて
data/emperors.json の在位データから機械算出。「統一」は正確には「在位する皇帝がただ一つの王朝にのみいる期間」
— 東晋371–383（前秦は天王を称し皇帝でない）・南宋1235–1259（モンゴルは皇帝を称さず）・満洲国1934–45（溥儀が唯一の皇帝）もこの定義では金色になる。
赤の縦線＝復位による再即位。</div>
<script>
const D = __DATA__;
const ML = 26, MR = 30, CH_H = 30, EV_H = 50, U = 50, R0 = -3, R1 = 2, AX_H = 30, BC_H = 46;
const H_SOLE = 34, H_MAJ = 17, H_TINY = 11, H_CLU = 22, LANE = 16;
const PXYS = { fit: 1.05, mid: 3, det: 8 };
const rowsTop = CH_H + EV_H;
const serif = "font-family=\"'Yu Mincho','Hiragino Mincho ProN',serif\"";
const halo = `stroke="${D.paper}" stroke-width="3.5" paint-order="stroke"`;
let zoom = 'fit';
const expanded = new Set();
let hits = [];   // {x0,x1,y0,y1,tip,si?}  描画順に積み、後勝ちで判定
let rowH = [], rowY = [], rowsBot = 0, Wt = 0, Ht = 0, pxy = 1;

const esc = t => t.replace(/&/g,'&amp;').replace(/</g,'&lt;');
const fmt = a => { const y = a > 0 ? a : a - 1; return y < 0 ? '前' + (-y) : '' + y; };
const per = (a, b) => a === b ? fmt(a) + '年' : fmt(a) + '–' + fmt(b) + '年';
const x = a => ML + (a - D.Y0) * pxy;
const wd = (a, b) => (b + 1 - a) * pxy;
const yOf = r => rowY[r - R0];
const bandH = (s, sole) => s.kind === 'cluster' ? H_CLU : (sole ? H_SOLE : (s.kind === 'tiny' ? H_TINY : H_MAJ));

function layout() {
  pxy = PXYS[zoom];
  Wt = Math.round((D.Y1 + 1 - D.Y0) * pxy) + ML + MR;
  rowH = []; rowY = [];
  for (let r = R0; r <= R1; r++) {
    let h = U;
    D.streams.forEach((s, si) => {
      if (s.kind === 'cluster' && expanded.has(si) && s.spans[0].row === r)
        h = Math.max(h, s.lanes * LANE + 34);
    });
    rowH.push(h);
  }
  let acc = rowsTop;
  for (let i = 0; i < rowH.length; i++) { rowY.push(acc + rowH[i] / 2); acc += rowH[i]; }
  rowsBot = acc;
  Ht = rowsBot + AX_H + BC_H;
}

function spanAt(s, a) {
  let best = s.spans[0];
  for (const sp of s.spans) { if (sp.a <= a && a <= sp.b) return sp; if (sp.a <= a) best = sp; }
  return best;
}
const soleAt = (s, a) => { const sp = spanAt(s, a);
  for (const p of sp.pieces) if (p[0] <= a && a <= p[1]) return !!p[2]; return false; };

function render() {
  layout();
  const P = [];
  hits = [];
  // 章
  D.chapters.forEach((c, i) => {
    const xx = x(c.a), ww = x(c.b) - xx;
    if (i % 2 === 1) P.push(`<rect x="${xx}" y="${CH_H}" width="${ww}" height="${rowsBot-CH_H}" fill="rgba(58,53,48,0.028)"/>`);
    P.push(`<line x1="${xx}" y1="${CH_H}" x2="${xx}" y2="${rowsBot}" stroke="rgba(58,53,48,0.14)" stroke-dasharray="1 3"/>`);
    if (c.label) P.push(`<text x="${xx+ww/2}" y="${CH_H-9}" text-anchor="middle" font-size="${ww>120?15:11}" ${serif} font-weight="600" fill="${D.ink}" letter-spacing="${ww>200?4:1}">${c.label}</text>`);
  });
  // 世紀グリッド + 軸ラベル
  const step = zoom === 'fit' ? 100 : 50, lstep = zoom === 'fit' ? 200 : 100;
  for (let y = -200; y < 2000; y += step) {
    if (y === 0) continue;
    const a = y > 0 ? y : y + 1;
    if (a < D.Y0 || a > D.Y1) continue;
    const mj = y % lstep === 0;
    P.push(`<line x1="${x(a)}" y1="${rowsTop}" x2="${x(a)}" y2="${rowsBot}" stroke="rgba(58,53,48,${mj?0.07:0.04})"/>`);
    if (mj) P.push(`<text x="${x(a)}" y="${rowsBot+18}" text-anchor="middle" font-size="10" fill="${D.muted}">${fmt(a)}</text>`);
  }
  P.push(`<line x1="${ML}" y1="${rowsBot+2}" x2="${Wt-MR}" y2="${rowsBot+2}" stroke="rgba(58,53,48,0.25)"/>`);
  // 空位
  for (const [a, b] of D.vac)
    P.push(`<rect x="${x(a)}" y="${rowsTop}" width="${Math.max(wd(a,b),2)}" height="${rowsBot-rowsTop}" fill="url(#vachatch)"/>`);
  // 出来事
  for (const ev of D.events) {
    const ty = CH_H + 16 + ev.lv * 16;
    const end = x(ev.a) > Wt - 180;
    P.push(`<line x1="${x(ev.a)}" y1="${ty+3}" x2="${x(ev.a)}" y2="${rowsBot}" stroke="#e0b4a8"/>`);
    P.push(`<text x="${x(ev.a)+(end?-3:3)}" y="${ty}" text-anchor="${end?'end':'start'}" font-size="10" fill="#a45447" ${halo}><tspan font-weight="600">${fmt(ev.a)}</tspan> ${ev.text}</text>`);
  }
  // 継承エッジ
  for (const e of D.edges) {
    const f = D.streams[e.f], t = D.streams[e.t];
    const a1 = e.year ?? t.start;
    const fsp = spanAt(f, a1 - 1), tsp = spanAt(t, a1);
    const x1 = x(Math.max(a1, tsp.a));
    let x0 = Math.min(x(fsp.b + 1), x1 - 6); x0 = Math.max(x0, x1 - 26);
    const yF = yOf(fsp.row), yT = yOf(tsp.row);
    const hF = bandH(f, soleAt(f, fsp.b)), hT = bandH(t, soleAt(t, tsp.a));
    if (e.kind === 'dash') {
      P.push(`<line x1="${x0}" y1="${yF}" x2="${x1}" y2="${yT}" stroke="${f.edge}" stroke-width="1.6" stroke-dasharray="4 3"/>`); continue;
    }
    if (fsp.row === tsp.row) {
      P.push(`<path d="M${x0},${yF-hF/2} L${x1},${yT-hT/2} L${x1},${yT+hT/2} L${x0},${yF+hF/2} Z" fill="${t.fill}" opacity="0.85"/>`);
    } else {
      const up = tsp.row < fsp.row;
      const ya = up ? yF - hF/2 : yF + hF/2, yb = up ? yT + hT/2 : yT - hT/2;
      const m = (x0 + x1) / 2, o = up ? 8 : -8;
      P.push(`<path d="M${x0},${ya} C${m},${ya} ${m},${yb} ${x1},${yb} L${x1},${yb+o} C${m},${yb+o} ${m},${ya+o} ${x0},${ya+o} Z" fill="${e.kind==='merge'?f.fill:t.fill}" opacity="0.8"/>`);
    }
  }
  // 帯
  D.streams.forEach((s, si) => {
    if (s.kind === 'cluster' && expanded.has(si)) { renderExpanded(P, s, si); return; }
    // 中断コネクタ / 段替わり
    for (let i = 0; i < s.spans.length - 1; i++) {
      const s1 = s.spans[i], s2 = s.spans[i + 1];
      const gap = x(s2.a) - x(s1.b + 1);
      if (s1.row !== s2.row && gap < 8) {
        const xa = x(s1.b + 1) - 4, xb = x(s2.a) + 4, m = (xa + xb) / 2, h2 = H_MAJ / 2;
        const y1 = yOf(s1.row), y2 = yOf(s2.row);
        P.push(`<path d="M${xa},${y1-h2} C${m},${y1-h2} ${m},${y2-h2} ${xb},${y2-h2} L${xb},${y2+h2} C${m},${y2+h2} ${m},${y1+h2} ${xa},${y1+h2} Z" fill="${s.fill}" opacity="0.9"/>`);
        continue;
      }
      if (gap < 2) continue;
      P.push(`<line x1="${x(s1.b+1)}" y1="${yOf(s1.row)}" x2="${x(s2.a)}" y2="${yOf(s2.row)}" stroke="${s.edge}" stroke-width="1.3" stroke-dasharray="3 3"/>`);
    }
    for (const sp of s.spans) {
      const yC = yOf(sp.row);
      for (const [a, b, sole] of sp.pieces) {
        const h = bandH(s, sole);
        const fl = s.kind === 'cluster' ? 'url(#hatch)' : s.fill;
        P.push(`<rect x="${x(a)}" y="${yC-h/2}" width="${Math.max(wd(a,b),1.6)}" height="${h}" rx="2.5" fill="${fl}" stroke="${s.edge}" stroke-width="1.1"/>`);
      }
      const hMax = Math.max(...sp.pieces.map(p => bandH(s, p[2])));
      const tip = `<b>${esc(s.label)}</b><br><span class="m">${per(s.start,s.end)}・皇帝${s.n}人</span>` +
        (s.kind === 'cluster' ? '<div class="h">クリックで構成政権を展開</div>' : (zoom==='fit' ? '<div class="h">「拡大」で皇帝ごとの区切りを表示</div>' : ''));
      hits.push({ x0: x(sp.a), x1: x(sp.a) + wd(sp.a, sp.b), y0: yC - hMax/2 - 2, y1: yC + hMax/2 + 2, tip, si, seg: s.kind !== 'cluster' });
      // 皇帝セグメント(ズーム時)
      if (zoom !== 'fit' && s.kind !== 'cluster') {
        let i = 0;
        for (const g of s.segs) {
          if (g.b < sp.a || g.a > sp.b) continue;
          const h = bandH(s, soleAt(s, g.a));
          const gw = wd(g.a, g.b);
          if (i % 2 === 1) P.push(`<rect x="${x(g.a)}" y="${yC-h/2+1}" width="${gw}" height="${h-2}" fill="rgba(58,53,48,0.055)"/>`);
          if (g.a > sp.a) P.push(`<line x1="${x(g.a)}" y1="${yC-h/2}" x2="${x(g.a)}" y2="${yC+h/2}" stroke="${g.rst?D.seal:s.edge}" stroke-width="${g.rst?2:1}"/>`);
          const nm = g.n;
          if (zoom === 'det' && gw >= nm.length * 10.5 + 8)
            P.push(`<text x="${x(g.a)+4}" y="${yC+3.5}" font-size="10" fill="${D.ink}" ${halo}>${esc(nm)}</text>`);
          i++;
        }
      }
      // 五代の内部区分
      if (s.subdivs) for (const v of s.subdivs) {
        if (v.a > sp.a) P.push(`<line x1="${x(v.a)}" y1="${yC-H_MAJ/2-3}" x2="${x(v.a)}" y2="${yC+H_MAJ/2+3}" stroke="${D.paper}" stroke-width="2"/>`);
        if (zoom !== 'fit') P.push(`<text x="${x(v.a)+wd(v.a,v.b)/2}" y="${yC-H_MAJ/2-6}" text-anchor="middle" font-size="10.5" ${serif} font-weight="600" fill="${D.ink}" ${halo}>${esc(v.label)}</text>`);
      }
    }
    renderLabel(P, s);
  });
  // バーコード
  const bcY = rowsBot + AX_H;
  P.push(`<text x="${ML}" y="${bcY+9}" font-size="10.5" fill="${D.ink}" font-weight="600">統一と分裂のリズム</text>`);
  P.push(`<text x="${ML+128}" y="${bcY+9}" font-size="9.5" fill="${D.muted}">在位する皇帝がただ一つの王朝のみ＝統一（金）／複数王朝が並立＝分裂（灰）／皇帝不在（斜線）</text>`);
  for (const [a, b, stt] of D.runs) {
    const fl = stt === 'u' ? D.sealGold : (stt === 'd' ? D.grayRun : 'url(#vachatch)');
    P.push(`<rect x="${x(a)}" y="${bcY+14}" width="${Math.max(wd(a,b),1)}" height="13" fill="${fl}"/>`);
  }
  P.push(`<rect x="${ML}" y="${bcY+14}" width="${Wt-ML-MR}" height="13" fill="none" stroke="rgba(58,53,48,0.3)" stroke-width="0.8"/>`);

  const svg = document.getElementById('svg');
  svg.setAttribute('width', Wt); svg.setAttribute('height', Ht);
  svg.setAttribute('viewBox', `0 0 ${Wt} ${Ht}`);
  svg.innerHTML = `<defs>
    <pattern id="hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <rect width="7" height="7" fill="#e4dfd4"/><line x1="0" y1="0" x2="0" y2="7" stroke="#c4bfb4" stroke-width="2.4"/></pattern>
    <pattern id="vachatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(58,53,48,0.13)" stroke-width="2"/></pattern>` +
    `</defs><g font-family="'Hiragino Sans','Yu Gothic','Noto Sans JP',sans-serif">` + P.join('') + '</g>';
  // ガター
  const gut = document.getElementById('gut');
  gut.innerHTML = '';
  [[-2, '北方の王朝'], [0, '天下統一の座'], [1.5, '南方の王朝']].forEach(([r, lab]) => {
    const yy = r === 1.5 ? (yOf(1) + yOf(2)) / 2 : yOf(Math.round(r));
    const el = document.createElement('div');
    el.textContent = lab; el.style.top = (yy - lab.length * 13 / 2) + 'px';
    gut.appendChild(el);
  });
  const bar = document.createElement('i');
  bar.style.top = rowsTop + 'px'; bar.style.height = (rowsBot - rowsTop) + 'px';
  bar.style.background = 'linear-gradient(180deg,#9dbfe4,#f0d089 55%,#9cc79c)';
  gut.appendChild(bar);
}

function renderExpanded(P, s, si) {
  const sp = s.spans[0], row = sp.row;
  const top = yOf(row) - (s.lanes * LANE + 34) / 2;
  const x0 = x(s.start) - 6, x1 = x(s.end) + wd(s.end, s.end) + 6;
  P.push(`<rect x="${x0}" y="${top}" width="${x1-x0}" height="${s.lanes*LANE+30}" rx="4" fill="rgba(58,53,48,0.03)" stroke="rgba(58,53,48,0.25)" stroke-dasharray="3 3"/>`);
  P.push(`<text x="${x0+5}" y="${top+13}" font-size="10.5" ${serif} font-weight="600" fill="${D.ink}" ${halo}>▾ ${esc(s.label)}（皇帝${s.n}人・たたむ）</text>`);
  hits.push({ x0, x1, y0: top, y1: top + 18, tip: `<b>${esc(s.label)}</b><div class="h">クリックでたたむ</div>`, si });
  for (const m of s.members) {
    const yC = top + 22 + m.lane * LANE + LANE / 2;
    for (let i = 0; i < m.spans.length - 1; i++)
      P.push(`<line x1="${x(m.spans[i][1]+1)}" y1="${yC}" x2="${x(m.spans[i+1][0])}" y2="${yC}" stroke="#b9b2a4" stroke-dasharray="3 3"/>`);
    for (const [a, b] of m.spans)
      P.push(`<rect x="${x(a)}" y="${yC-5.5}" width="${Math.max(wd(a,b),1.6)}" height="11" rx="2" fill="url(#hatch)" stroke="#b9b2a4" stroke-width="1"/>`);
    if (zoom !== 'fit') for (const g of m.segs) {
      if (g.a > m.spans[0][0]) P.push(`<line x1="${x(g.a)}" y1="${yC-5.5}" x2="${x(g.a)}" y2="${yC+5.5}" stroke="${g.rst?D.seal:'#b9b2a4'}" stroke-width="${g.rst?2:1}"/>`);
    }
    const ww = wd(m.start, m.end);
    const nm = m.label;
    if (ww >= nm.length * 10 + 6)
      P.push(`<text x="${x(m.start)+ww/2}" y="${yC+3.5}" text-anchor="middle" font-size="9.5" ${serif} font-weight="600" fill="${D.ink}" ${halo}>${esc(nm)}</text>`);
    else
      P.push(`<text x="${x(m.end)+wd(m.end,m.end)+3}" y="${yC+3.5}" font-size="9.5" ${serif} fill="${D.ink}" ${halo}>${esc(nm)}</text>`);
    const segtip = m.segs.map(g => `${esc(g.n)}（${per(g.a,g.b)}）`).join('<br>');
    hits.push({ x0: x(m.start), x1: x(m.end)+wd(m.end,m.end), y0: yC-7, y1: yC+7,
      tip: `<b>${esc(m.label)}</b><br><span class="m">${per(m.start,m.end)}・皇帝${m.n}人</span><br>${segtip}<div class="h">クリックでたたむ</div>`, si });
  }
}

function renderLabel(P, s) {
  let big = s.spans[0];
  for (const sp of s.spans) if (sp.b - sp.a > big.b - big.a) big = sp;
  const yC = yOf(big.row), ww = wd(big.a, big.b), cx = x(big.a) + ww / 2;
  const fs = s.kind === 'major' ? 15 : 11;
  const pre = s.kind === 'cluster' ? '▸ ' : '';
  const name = pre + s.label;
  const inw = s.label.length * fs * 1.08 + 6;
  const hMax = Math.max(...big.pieces.map(p => bandH(s, p[2])));
  if (zoom !== 'fit') {  // ズーム時は各スパンの左端に沿わせる
    for (const sp of s.spans) {
      const h = bandH(s, soleAt(s, sp.a));
      P.push(`<text x="${x(sp.a)+4}" y="${yOf(sp.row)-h/2-5}" font-size="${fs}" ${serif} font-weight="600" fill="${D.ink}" ${halo}>${esc(name)}</text>`);
    }
    return;
  }
  if (s.labelpos === 'in' && ww >= inw) {
    if (s.sub && ww >= inw + 64) {
      P.push(`<text x="${cx}" y="${yC-2}" text-anchor="middle" font-size="${fs}" ${serif} font-weight="600" fill="${D.ink}" ${halo}>${esc(name)}</text>`);
      P.push(`<text x="${cx}" y="${yC+13}" text-anchor="middle" font-size="9" fill="#6f6a60" ${halo}>${fmt(s.start)}–${fmt(s.end)}・${s.sub}</text>`);
    } else
      P.push(`<text x="${cx}" y="${yC+fs*0.36}" text-anchor="middle" font-size="${fs}" ${serif} font-weight="600" fill="${D.ink}" ${halo}>${esc(name)}</text>`);
  } else if (s.labelpos === 'below')
    P.push(`<text x="${cx}" y="${yC+hMax/2+12}" text-anchor="middle" font-size="10.5" ${serif} font-weight="600" fill="${D.ink}" ${halo}>${esc(name)}</text>`);
  else
    P.push(`<text x="${cx}" y="${yC-hMax/2-5}" text-anchor="middle" font-size="10.5" ${serif} font-weight="600" fill="${D.ink}" ${halo}>${esc(name)}</text>`);
}

// ---------- 操作 ----------
const sc = document.getElementById('sc'), tip = document.getElementById('tip');
function centerYear() { return D.Y0 + (sc.scrollLeft + sc.clientWidth / 2 - ML) / pxy; }
function rerender(keepYear) {
  const cy = keepYear ?? centerYear();
  render();
  sc.scrollLeft = (cy - D.Y0) * pxy + ML - sc.clientWidth / 2;
  for (const id of ['fit', 'mid', 'det'])
    document.getElementById('z-' + id).dataset.on = (zoom === id) ? '1' : '0';
}
for (const id of ['fit', 'mid', 'det'])
  document.getElementById('z-' + id).onclick = () => { zoom = id; rerender(); };
const nav = document.getElementById('chapnav');
D.chapters.forEach(c => {
  if (!c.label) return;
  const b = document.createElement('button');
  b.className = 'c'; b.textContent = c.label;
  b.onclick = () => { sc.scrollTo({ left: (c.a - D.Y0) * pxy + ML - 60, behavior: 'smooth' }); };
  nav.appendChild(b);
});
function hitAt(ev) {
  const r = sc.getBoundingClientRect();
  const mx = ev.clientX - r.left + sc.scrollLeft, my = ev.clientY - r.top;
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    if (mx >= h.x0 && mx <= h.x1 && my >= h.y0 && my <= h.y1) return { h, mx };
  }
  return null;
}
sc.addEventListener('mousemove', ev => {
  const r = hitAt(ev);
  if (!r) { tip.style.display = 'none'; return; }
  let content = r.h.tip;
  if (r.h.seg && zoom !== 'fit') {  // ズーム時は皇帝単位のツールチップ
    const s = D.streams[r.h.si], yr = D.Y0 + (r.mx - ML) / pxy;
    let best = null, bd = 1e9;
    for (const g of s.segs) {
      const d2 = g.a <= yr && yr <= g.b + 1 ? 0 : Math.min(Math.abs(yr - g.a), Math.abs(yr - g.b + 1));
      if (d2 < bd) { bd = d2; best = g; }
    }
    if (best) content = `<b>${esc(best.n)}</b>${best.d?`<span class="m">（${esc(best.d)}）</span>`:''}<br><span class="m">在位 ${per(best.a,best.b)}${best.rst?'・復位':''} ｜ ${esc(s.label)}</span>`;
  }
  tip.innerHTML = content;
  tip.style.display = 'block';
  const tx = Math.min(ev.clientX + 14, innerWidth - 300), ty = ev.clientY + 16;
  tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
});
sc.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
sc.addEventListener('scroll', () => { tip.style.display = 'none'; });
sc.addEventListener('click', ev => {
  const r = hitAt(ev);
  if (!r || r.h.si === undefined) return;
  const s = D.streams[r.h.si];
  if (s.kind !== 'cluster') return;
  const cy = D.Y0 + (r.mx - ML) / pxy;
  if (expanded.has(r.h.si)) expanded.delete(r.h.si); else expanded.add(r.h.si);
  tip.style.display = 'none';
  rerender(cy);
});
render();
</script>
'''

out = (TPL.replace('__DATA__', json.dumps(payload, ensure_ascii=False, separators=(',', ':')))
          .replace('__PAPER__', PAPER).replace('__INK__', INK)
          .replace('__MUTED__', MUTED).replace('__SEAL__', SEAL))
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'timeline-river.html')
open(path, 'w').write(out)
print('OK', path, f'{len(out)//1024}KB')
