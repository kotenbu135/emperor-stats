#!/usr/bin/env python3
"""apply_majority_month.py の対象について、換算の前提（note の元号年月＝旧暦年月）を
干支で自己検証する。

note に「〇月〇〇（干支）」が書かれている場合、その干支が当該旧暦年月の中に実在すれば、
「ISO の年 = 紀年ラベル年」「ISO の月 = 旧暦月」という読みが裏付けられる（＝多数月方式で
換算してよい）。実在しなければ、旧暦年月の取り違えか史書暦と sxtwl の朔差なので個別確認に回す。

使い方: python3 docs/qa/issue34-event-date-2026-08-02/selfcheck_ganzhi.py
"""
import json
import re
import sys
import pathlib
import sxtwl

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from apply_majority_month import DATA_PATH, collect, event_text  # noqa: E402

TG = '甲乙丙丁戊己庚辛壬癸'
DZ = '子丑寅卯辰巳午未申酉戌亥'
# 「〇月」の直後6文字以内に現れる最初の干支だけを見る（記事本文中の別の干支を拾わない）
PAIR = re.compile(r'(?<![閏])(正|十二|十一|十|一|二|三|四|五|六|七|八|九)月[^。、，,]{0,6}?'
                  r'([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])')


def in_lunar_month(ly, lm, gz):
    for dd in range(1, 31):
        try:
            day = sxtwl.fromLunar(ly, lm, dd)
        except Exception:
            return None
        if day.getLunarMonth() != lm or day.isLunarLeap():
            break
        g = day.getDayGZ()
        if TG[g.tg] + DZ[g.dz] == gz:
            return f'{day.getSolarYear():04d}-{day.getSolarMonth():02d}-{day.getSolarDay():02d}'
    return None


def main():
    data = json.loads(DATA_PATH.read_text(encoding='utf-8'))
    targets = collect(data, apply_exclusions=False)
    ok = ng = nogz = 0
    ng_rows = []
    for e, ck, i, key, old, new, cls in targets:
        ev = e[ck]['events'][i]
        pairs = set(PAIR.findall(event_text(ev)))
        if len(pairs) != 1:
            nogz += 1
            continue
        _lm_kan, gz = list(pairs)[0]
        y, mo = int(old[:4]), int(old[5:7])
        hit = in_lunar_month(y, mo, gz)
        if hit:
            ok += 1
        else:
            ng += 1
            ng_rows.append((cls, e['id'], f'{ck}.events[{i}].{key}', old, new, gz))
    print(f'自己検証（note の干支が旧暦年月内に実在するか）: 対象 {len(targets)} フィールド')
    print(f'  干支あり・実在 {ok} / 干支あり・不在 {ng} / 干支なし（検証できず） {nogz}')
    if ng_rows:
        print('\n=== 干支が当該旧暦月内に見つからない（個別確認へ）===')
        for r in ng_rows:
            print(f'  [{r[0]}] {r[1]} / {r[2]}  {r[3]} → {r[4]}  干支 {r[5]}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
