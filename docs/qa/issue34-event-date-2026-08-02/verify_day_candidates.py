#!/usr/bin/env python3
"""sweep_day_precision.py が挙げた day 精度候補を、紀年年を固定して検証する。

sweep 側は旧暦年を y-1/y/y+1 で走査して「一意に解ければ候補」としていたため、
note の元号年（＝紀年ラベル年）と違う旧暦年で解けたものまで拾ってしまう。
ここでは candidates に紀年年を明示し、
  (1) その年の当該旧暦月に note の干支が実在するか
  (2) note が「朔」と書いているなら解が旧暦1日か
  (3) 当該月の朔の太陽暦日と朔干支
を出して、機械で確定できるものだけを残せるようにする。
"""
import sxtwl

TG = '甲乙丙丁戊己庚辛壬癸'
DZ = '子丑寅卯辰巳午未申酉戌亥'


def gz_of(day):
    g = day.getDayGZ()
    return TG[g.tg] + DZ[g.dz]


def solve(ly, lm, gz):
    out = []
    for dd in range(1, 31):
        try:
            day = sxtwl.fromLunar(ly, lm, dd)
        except Exception:
            break
        if day.getLunarMonth() != lm or day.isLunarLeap():
            break
        if gz_of(day) == gz:
            out.append((dd, f'{day.getSolarYear():04d}-{day.getSolarMonth():02d}-{day.getSolarDay():02d}'))
    return out


# (表示名, 紀年年, 旧暦月, 干支, 現行ISO, noteに「朔」があるか)
CANDIDATES = [
    ('beiwei-xiaozhuangdi.amnestyCount.events[2].date   永安二年七月庚午', 529, 7, '庚午', '0529-08-10', False),
    ('beiqi-wuchengdi.empressInstallationCount.events[0].date 河清元年正月丙戌', 562, 1, '丙戌', '0562-03-06', False),
    ('tang-daizong.eraChangeCount.events[1].date        広徳三年正月癸巳朔', 765, 1, '癸巳', '0765-01-01', True),
    ('tang-daizong.amnestyCount.events[3].date          永泰元年正月癸巳朔', 765, 1, '癸巳', '0765-01-01', True),
    ('tang-xianzong.amnestyCount.events[3].date         元和十三年正月己酉朔', 818, 1, '己酉', '0818-01-30', True),
    ('wudai-houliang-taizu.capitalRelocationCount.events[0].date 開平三年正月戊辰朔', 909, 1, '戊辰', '0909-01-12', True),
]

for name, ly, lm, gz, cur, shuo in CANDIDATES:
    d1 = sxtwl.fromLunar(ly, lm, 1)
    sols = solve(ly, lm, gz)
    y, mo, dy = map(int, cur.split('-'))
    curd = sxtwl.fromSolar(y, mo, dy)
    verdict = '判定不能（紀年年の当該月に干支が実在しない＝史書暦と sxtwl の朔差／史料誤記）'
    if sols:
        if shuo:
            verdict = ('確度高（朔干支一致・旧暦1日）' if sols[0][0] == 1
                       else '要確認（干支は実在するが朔＝1日でない）')
        else:
            verdict = '確度中（干支は実在するが朔の裏取りなし）'
    print(f'{name}')
    print(f'  現行 {cur} → 旧暦{curd.getLunarYear()}年{curd.getLunarMonth()}月{curd.getLunarDay()}日・干支{gz_of(curd)}')
    print(f'  紀年年 {ly} の旧暦{lm}月朔 = {d1.getSolarYear():04d}-{d1.getSolarMonth():02d}-{d1.getSolarDay():02d}（朔干支 {gz_of(d1)}）')
    print(f'  紀年年内の{gz}: {sols if sols else "なし"}')
    print(f'  → {verdict}')
    print()
