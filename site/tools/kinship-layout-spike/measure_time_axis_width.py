"""縦軸＝実時間に戻したときの「幅の下限」を測る（2026-08-17）。

縦位置が実時間で決まると、横位置しか決められない。すると幅には
**アルゴリズムに依存しない下限**がある: ある瞬間に同時に存在する箱の数だけは、
どんな置き方をしても横に並べるしかない。

  幅の下限 = max_t（時刻 t を含む箱の数） × (箱の幅 + 箱の間隔)

旧実装が当たった壁は総幅 約6,500px（バンド方式の機械検算・2026-07-24）。
下限がそこに近ければ、貪欲パッカーの出来の話ではなく「その形では入らない」ということ。

前提はレビュー⑥〜⑧でユーザー承認済みの規範から取る:
  - 1年 = 8px の完全等間隔
  - 皇帝カプセルの上辺 = 即位年・下辺 = 退位年（在位ごとに1つ。復位は別カプセル）
  - 短在位は最小高を確保するため下辺が延びる → その延びも占有として数える
  - 非皇帝は固定高で生没の中点に置く
"""
import json
import os
import collections

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', '..')
E = json.load(open(os.path.join(ROOT, 'data', 'emperors.json')))
K = json.load(open(os.path.join(ROOT, 'data', 'kinship.json')))

PX_PER_YEAR = 8.0
MIN_CAPSULE_PX = 44.0        # 皇帝カプセル（2行）の最小高
PERSON_PX = 38.0             # 非皇帝ピルの固定高
MIN_CAPSULE_Y = MIN_CAPSULE_PX / PX_PER_YEAR
PERSON_Y = PERSON_PX / PX_PER_YEAR

IN_SCOPE = ['qin-han', 'three-kingdoms-jin', 'eastern-jin-sixteen',
            'northern-southern', 'sui-tang', 'five-dynasties']

# 箱の幅の想定（中の文字で決まるので幅は一定でない）。下限なので狭めと広めの2通り。
WIDTHS = [(120, 24), (150, 24)]


def year_of(iso):
    """ISO 日付か年の文字列から歴史年を取る（BCE は先頭に -）。"""
    if iso is None:
        return None
    s = str(iso)
    neg = s.startswith('-')
    if neg:
        s = s[1:]
    head = s.split('-')[0]
    if not head.isdigit():
        return None
    y = int(head)
    return -y if neg else y


boxes = collections.defaultdict(list)   # era -> [(y0, y1, label)]

for e in E['emperors']:
    era = e.get('eraId')
    for i, r in enumerate(e.get('reigns') or []):
        s = year_of(r.get('startDate')) or r.get('startYear')
        t = year_of(r.get('endDate')) or r.get('endYear')
        if s is None:
            continue
        if t is None:
            t = s
        y0, y1 = float(s), float(t)
        if y1 - y0 < MIN_CAPSULE_Y:     # 短在位は下辺が延びる
            y1 = y0 + MIN_CAPSULE_Y
        boxes[era].append((y0, y1, f"{(e.get('name') or {}).get('commonName') or e['id']}"))

no_years = collections.Counter()
for p in K['persons']:
    era = p.get('eraId')
    b, d = p.get('birthYear'), p.get('deathYear')
    if b is None and d is None:
        no_years[era] += 1
        continue
    mid = float(b if d is None else (d if b is None else (b + d) / 2))
    boxes[era].append((mid - PERSON_Y / 2, mid + PERSON_Y / 2, p.get('name', p['id'])))


def max_overlap(items):
    """同時に存在する箱の最大数と、それが起きる年。"""
    ev = []
    for y0, y1, _ in items:
        ev.append((y0, 1))
        ev.append((y1, -1))
    ev.sort(key=lambda x: (x[0], -x[1]))
    cur = best = 0
    at = None
    for y, d in ev:
        cur += d
        if cur > best:
            best, at = cur, y
    return best, at


# 比較の相手は「段」で並べた ELK の実測幅（KINSHIP_TECH_2026-08-01.md の 4節・6-2節）。
# 様式が承認されたモックはこの幅で描かれているので、これが実際の物差しになる。
ELK_TIER_WIDTH = {
    'qin-han': 1519,
    'eastern-jin-sixteen': 1998,
    'northern-southern': 3398,
    'five-dynasties': 1594,
}

print(f"1年={PX_PER_YEAR:.0f}px・最小カプセル高={MIN_CAPSULE_PX:.0f}px"
      f"・非皇帝={PERSON_PX:.0f}px 固定")
print()
hdr = f"{'章(eraId)':<24}{'箱':>5}{'同時最大':>8}{'その年':>8}"
for w, g in WIDTHS:
    hdr += f"{f'幅下限@{w}px':>14}"
hdr += f"{'ELK(段)':>9}{'年無し':>7}{'章の高さ':>9}"
print(hdr)

for era in IN_SCOPE:
    items = boxes[era]
    n, at = max_overlap(items)
    lo = min(y for y, _, _ in items)
    hi = max(y for _, y, _ in items)
    row = f"{era:<24}{len(items):>5}{n:>8}{(str(int(at)) if at is not None else '-'):>8}"
    for w, g in WIDTHS:
        row += f"{f'{n * (w + g):,}px':>14}"
    tier = ELK_TIER_WIDTH.get(era)
    row += f"{(f'{tier:,}px' if tier else '-'):>9}"
    row += f"{no_years[era]:>7}{f'{int((hi - lo) * PX_PER_YEAR):,}px':>9}"
    print(row)

print()
print('※ 幅下限 = 同時最大 ×（箱の幅＋間隔24px）。どんなアルゴリズムでもこれ以下にはならない。')
print('※ ELK(段) = 様式が承認されたモックの実測幅。実時間に戻しても幅で負けるかを見る相手はこれ。')
print('※ 旧実装が当たった「総幅 約6,500px」（2026-07-24）は全域を1枚に並べたバンド方式の検算値で、')
print('   章ごとの数字ではないので直接は比べられない。')

