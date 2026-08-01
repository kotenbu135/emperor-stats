#!/usr/bin/env python3
"""Issue #33 横展開スイープA: note の西暦ラベルが旧暦十一月・十二月の記事と衝突する候補。

検出できないもの（限界）:
- 月を書いていない西暦（安帝 reigns[0].note「403年に桓玄に禅譲を迫られ平固王に降格」）は
  月トークンが無いため当たらない。
- 元号年ラベルのみで西暦を書いていない note も対象外。
- 同レコードに y+1 の 1〜2月の ISO 日付が無いものは（照合の足場が無いので）候補にしない。
"""
import json, re

d = json.load(open('data/emperors.json'))
ems = d['emperors']

def walk(o, path=''):
    if isinstance(o, str):
        yield path, o
    elif isinstance(o, dict):
        for k, v in o.items():
            yield from walk(v, f'{path}.{k}' if path else k)
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from walk(v, f'{path}[{i}]')

ISO = re.compile(r'\b(\d{4})-(\d{2})-(\d{2})\b')
NEAR = re.compile(r'(\d{3,4})\s*年[^。、]{0,24}?(十一月|十二月|11月|12月)')

rows = []
for e in ems:
    fields = list(walk(e))
    isoym = set()
    for p, s in fields:
        for m in ISO.finditer(s):
            isoym.add((int(m.group(1)), int(m.group(2))))
    for p, s in fields:
        for m in NEAR.finditer(s):
            y = int(m.group(1))
            if not (200 <= y <= 1920):
                continue
            nxt = sorted([(yy, mm) for (yy, mm) in isoym if yy == y + 1 and mm in (1, 2)])
            if not nxt:
                continue
            pre = s[max(0, m.start() - 12):m.start()]
            head = s[max(0, m.start() - 1):m.start()]
            post = s[m.end():m.end() + 8]
            if re.match(r'\s*\d{1,2}\s*日', post) or re.match(r'\s*(上旬|中旬|下旬|[0-9]{1,2}日)', post):
                cls = 'D-太陽暦の実日付表記(誤りでない)'
            elif '旧暦' in pre[-4:] or 'lunar ' in pre[-8:]:
                cls = 'C-旧暦明示(誤りでない)'
            elif head in ('（', '(', '＝', '='):
                cls = 'B-元号（西暦）+月日'
            else:
                cls = 'A-裸の西暦+旧暦月'
            ctx = s[max(0, m.start() - 45):m.end() + 35].replace('\n', ' ')
            rows.append((cls, e['id'], p, y, nxt, ctx))

for cls in ['A-裸の西暦+旧暦月', 'B-元号（西暦）+月日', 'C-旧暦明示(誤りでない)',
            'D-太陽暦の実日付表記(誤りでない)']:
    sub = [r for r in rows if r[0] == cls]
    print('=' * 72)
    print(f'{cls}  — {len(sub)} 件')
    print('=' * 72)
    for r in sub:
        print(f'- {r[1]} / {r[2]}   記述={r[3]}年  実ISO={r[4]}')
        print(f'    …{r[5]}…')
    print()
print(f'合計 {len(rows)} 件 / 対象 {len(ems)} 人')
