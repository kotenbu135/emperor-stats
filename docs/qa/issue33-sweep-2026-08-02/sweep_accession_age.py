#!/usr/bin/env python3
"""Issue #33 横展開スイープC: ages.accessionAge が null なのに
note 類が即位時年齢を書いているレコード（Issue #33 の 4 と同型の矛盾）を洗う。
他人の即位年齢を書いている note も拾うので、候補として目視で振り分ける前提。
"""
import json, re

d = json.load(open('data/emperors.json'))

def walk(o, path=''):
    if isinstance(o, str):
        yield path, o
    elif isinstance(o, dict):
        for k, v in o.items():
            yield from walk(v, f'{path}.{k}' if path else k)
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from walk(v, f'{path}[{i}]')

AGE = re.compile(r'(\d{1,2})\s*歳(?:で|にして|の(?:時|とき)に)?(?:即位|践祚|皇帝位|位に即|擁立|立てられ)')
AGE2 = re.compile(r'即位(?:時|の(?:時|とき))(?:年齢)?[はも]?\s*(\d{1,2})\s*歳')

seen = set()
n = 0
for e in d['emperors']:
    ages = e.get('ages') or {}
    if ages.get('accessionAge') is not None:
        continue
    for p, s in walk(e):
        if p.startswith('ages.') and p != 'ages.note':
            continue
        for rx in (AGE, AGE2):
            m = rx.search(s)
            if not m:
                continue
            k = (e['id'], p, m.group(1))
            if k in seen:
                continue
            seen.add(k)
            n += 1
            ctx = s[max(0, m.start() - 40):m.end() + 25].replace('\n', ' ')
            print(f"- {e['id']} / {p}  note中の即位時年齢={m.group(1)}歳（accessionAge は null）")
            print(f"    …{ctx}…")
            break

print(f'\n候補計: {n} 件')
