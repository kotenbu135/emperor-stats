"""章ごとの政権数を数える（`--series-*` は8色しかない）。

南北朝の11政権は 2026-08-01 の選定ドキュメントに書いてあるが、
「南北朝だけの特例」なのか「6章のうち複数が8を超える」のかで打ち手が変わる。

あわせて、旧実装の「割拠政権は 0＝--kinship-minor（群雄灰）」の割り当てを効かせたとき、
色を当てる政権が8以内に収まるかも測る（＝主要政権だけを塗る案が成立するか）。
政権の区分は meta.catalogs.regimes[].category。
"""
import json
import collections
import os

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', '..')
E = json.load(open(os.path.join(ROOT, 'data', 'emperors.json')))
REG = {r['id']: r for r in E['meta']['catalogs']['regimes']}

IN_SCOPE = ['qin-han', 'three-kingdoms-jin', 'eastern-jin-sixteen',
            'northern-southern', 'sui-tang', 'five-dynasties']

# 皇帝が1人でもいる政権だけが図に出る
used = collections.defaultdict(set)
for e in E['emperors']:
    used[e.get('eraId')].add(e.get('regimeId'))

print('政権の区分（catalogs.regimes[].category）:',
      dict(collections.Counter(r['category'] for r in REG.values())))
print()

MAJOR = None  # 下で章ごとに区分の内訳を出してから決める
print(f"{'章(eraId)':<24}{'政権数':>6}  区分の内訳")
for era in IN_SCOPE:
    ids = used[era]
    breakdown = collections.Counter(REG[i]['category'] for i in ids if i in REG)
    mark = '収まる' if len(ids) <= 8 else f'溢れる（+{len(ids) - 8}）'
    print(f"{era:<24}{len(ids):>6}  {mark:<12}{dict(breakdown)}")

print()
print('（参考）スコープ外の章:')
for era in sorted(set(used) - set(IN_SCOPE), key=str):
    print(f"  {str(era):<22}{len(used[era]):>6}")
