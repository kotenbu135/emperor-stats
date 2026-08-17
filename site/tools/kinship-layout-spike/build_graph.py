#!/usr/bin/env python3
"""kinship.json + emperors.json から、時代（章）ごとのレイアウト入力グラフを作る。

- ノード = 人物（皇帝カプセル／非皇帝の細ノード）＋ 合成の union ノード（夫婦＝子の親セット）
- エッジ = 親 → union → 子（親が1人なら親 → 子）
- succession / marriage はレイアウトには渡さない（描画時のオーバーレイ扱い）
"""
import json, os, sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))

k = json.load(open(os.path.join(ROOT, 'data/kinship.json')))
em = json.load(open(os.path.join(ROOT, 'data/emperors.json')))
P = {p['id']: p for p in k['persons']}
EM = {e['id']: e for e in em['emperors']}


def era_of(nid):
    if nid in P:
        return P[nid].get('eraId')
    e = EM.get(nid)
    if not e:
        return None
    v = e.get('eraId') or e.get('era')
    return v.get('id') if isinstance(v, dict) else v


def name_of(nid):
    if nid in EM:
        e = EM[nid]
        return (e.get('name') or {}).get('commonName') or (e.get('name') or {}).get('personalName') or nid
    return P.get(nid, {}).get('name', nid)


PARENT_RELS = ('birth-father', 'birth-mother', 'adoptive-father', 'adoptive-mother')

# from: null は「先行皇帝のいない復位・別政権での即位」を表す succession エッジ
# （宣統帝の1917年復辟・1934年満洲国）。ノードではないので落とす。
nodes = set(P) | {e[x] for e in k['edges'] for x in ('from', 'to') if e[x]}
parents = defaultdict(list)          # child -> [(parent, relation, childOrder)]
for e in k['edges']:
    if e['type'] == 'kinship' and e.get('relation') in PARENT_RELS:
        parents[e['to']].append((e['from'], e['relation'], e.get('childOrder')))

era = sys.argv[1] if len(sys.argv) > 1 else 'qin-han'
members = {n for n in nodes if era_of(n) == era}

# --- union ノードの構築 ---------------------------------------------------
# 同じ親集合を持つ子をまとめて 1 union に束ねる（＝夫婦の子グループ）
union_of = {}
by_parentset = defaultdict(list)
for c in sorted(members):
    ps = tuple(sorted(p for p, _r, _o in parents.get(c, []) if p in members))
    if len(ps) >= 1:
        by_parentset[ps].append(c)
for ps, kids in by_parentset.items():
    if len(ps) == 1 and len(kids) == 1:
        continue                                   # 単親・単子は直結でよい
    uid = 'u:' + '+'.join(ps)
    union_of[ps] = uid

# ELK の「モデル順序」は配列の並びそのもの。childOrder は辺の属性として渡しても読まれないので、
# 兄弟を childOrder 順（欠測は後ろ・同着は id）に並べてから配列へ入れる。
# ORDERED=0 で id 昇順（＝兄弟順を渡さない対照条件）に切り替える。
ORDERED = os.environ.get('ORDERED', '1') != '0'


def parent_set(c):
    return tuple(sorted(p for p, _r, _o in parents.get(c, []) if p in members))


def child_order(c):
    return min([o for _p, _r, o in parents.get(c, []) if o is not None], default=None)


def sibling_key(c):
    o = child_order(c)
    return (0, o, c) if (ORDERED and o is not None) else (1, 0, c)


# 親を持たない人を先に、その下に子を childOrder 順で潜る（＝系図として自然な読み順）
ordered_persons, visited = [], set()


def walk(c):
    if c in visited:
        return
    visited.add(c)
    ordered_persons.append(c)
    kids = [x for x in members if c in parent_set(x)]
    for x in sorted(kids, key=sibling_key):
        walk(x)


for n in sorted(members, key=lambda x: (len(parent_set(x)) > 0, x)):
    walk(n)

out_nodes, out_edges = [], []
for n in ordered_persons:
    is_emp = n in EM
    out_nodes.append({
        'id': n, 'label': name_of(n), 'kind': 'emperor' if is_emp else 'person',
        'w': 96 if is_emp else 84, 'h': 44 if is_emp else 30,
    })
for ps, uid in union_of.items():
    out_nodes.append({'id': uid, 'label': '', 'kind': 'union', 'w': 8, 'h': 8})

for c in ordered_persons:
    ps = parent_set(c)
    if not ps:
        continue
    order = child_order(c)
    uid = union_of.get(ps)
    if uid:
        for p in ps:
            out_edges.append({'source': p, 'target': uid, 'kind': 'to-union'})
        out_edges.append({'source': uid, 'target': c, 'kind': 'to-child', 'childOrder': order})
    else:
        out_edges.append({'source': ps[0], 'target': c, 'kind': 'to-child', 'childOrder': order})

# union への入辺は重複しうるので落とす
seen = set(); ded = []
for e in out_edges:
    key = (e['source'], e['target'])
    if key in seen:
        continue
    seen.add(key); ded.append(e)

g = {'era': era, 'nodes': out_nodes, 'edges': ded}
json.dump(g, open(os.path.join(HERE, f'graph-{era}.json'), 'w'), ensure_ascii=False)

# --- 王朝バンド検証（group.mjs）用のグループ割当 --------------------------
regimes = {r['id']: r.get('name') or r['id']
           for r in (em.get('meta', {}).get('catalogs', {}).get('regimes') or [])}
children = defaultdict(list)
for e in k['edges']:
    if e['type'] == 'kinship' and e['from']:
        children[e['from']].append(e['to'])


def group_of(nid):
    if nid in EM:
        r = EM[nid].get('regimeId')
        return regimes.get(r, r)
    for c in children.get(nid, []):          # 非皇帝は子の政権へ寄せる
        if c in EM:
            r = EM[c].get('regimeId')
            return regimes.get(r, r)
    return (P.get(nid, {}).get('posthumous') or {}).get('dynasty') \
        or P.get(nid, {}).get('researchSection') or '不明'


groups = {}
for n in out_nodes:
    if n['kind'] == 'union':
        src = [e['source'] for e in ded if e['target'] == n['id']]
        groups[n['id']] = (group_of(src[0]) if src else '不明') or '不明'
    else:
        groups[n['id']] = group_of(n['id']) or '不明'
json.dump(groups, open(os.path.join(HERE, f'groups-{era}.json'), 'w'), ensure_ascii=False)

print(f'{era}: persons={len(members)} unions={len(union_of)} nodes={len(out_nodes)} edges={len(ded)}')
