"""2026-08-17: KINSHIP_TECH_2026-08-01.md の 2節の表を、今日のデータで測り直す。

доc の数値は 08-01 のもので、その後に生母ブロック13〜16 と
meta.confirmedMotherUnknown（読んだうえで記載が無い74人）が入っている。
「宋以降は実母0」がまだ成り立つかどうかが、章スコープの判断の根拠。
"""
import json
import collections
import os

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', '..')
K = json.load(open(os.path.join(ROOT, 'data', 'kinship.json')))
E = json.load(open(os.path.join(ROOT, 'data', 'emperors.json')))

P = {p['id']: p for p in K['persons']}
EM = {e['id']: e for e in E['emperors']}

print('schemaVersion', K.get('schemaVersion'))
print('persons', len(P), 'edges', len(K['edges']))
print('person keys:', sorted(P[K['persons'][0]['id']].keys()))
print('eraId on persons:', sum(1 for p in P.values() if p.get('eraId')), '/', len(P))
print('meta keys:', sorted(K.get('meta', {}).keys()))

cmu = K.get('meta', {}).get('confirmedMotherUnknown')
print('confirmedMotherUnknown:', type(cmu).__name__, len(cmu) if cmu else 0)

print('edge types:', dict(collections.Counter(e['type'] for e in K['edges'])))
print('kinship relations:', dict(collections.Counter(
    e.get('relation') for e in K['edges'] if e['type'] == 'kinship')))

# --- 章（eraId）ごとの実父・実母 ---


def era_of(nid):
    """build_graph.py の era_of と同じ引き方（人物は eraId・皇帝は eraId）。"""
    if nid in P:
        return P[nid].get('eraId')
    e = EM.get(nid)
    if not e:
        return None
    v = e.get('eraId') or e.get('era')
    return v.get('id') if isinstance(v, dict) else v


rows = collections.defaultdict(lambda: collections.Counter())
for e in K['edges']:
    if e['type'] != 'kinship':
        continue
    era = era_of(e['to'])
    rows[era][e.get('relation')] += 1

nodes = collections.Counter()
for nid in list(P) + list(EM):
    nodes[era_of(nid)] += 1

# confirmedMotherUnknown を章ごとに
cmu_by_era = collections.Counter()
if cmu:
    for item in cmu:
        i = item.get('id') if isinstance(item, dict) else item
        cmu_by_era[era_of(i)] += 1

print()
print(f"{'章(eraId)':<26}{'ノード':>6}{'実父':>6}{'実母':>6}{'母/父':>8}{'記載無し確定':>12}")
for era in sorted(rows, key=lambda x: (x is None, str(x))):
    f = rows[era].get('birth-father', 0)
    m = rows[era].get('birth-mother', 0)
    print(f"{str(era):<26}{nodes[era]:>6}{f:>6}{m:>6}"
          f"{(m / f if f else 0):>8.2f}{cmu_by_era.get(era, 0):>12}")
