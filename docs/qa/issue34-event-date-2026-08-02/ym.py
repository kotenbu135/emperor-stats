#!/usr/bin/env python3
"""旧暦年の各月について、朔日の太陽暦日・多数月方式の太陽暦年月を一覧する計算補助。

使い方: python3 .../ym.py 35 [36 ...]        # 旧暦年を並べる
        python3 .../ym.py 35 --gz 己未       # その年で指定干支が来る日も出す
"""
import argparse
import pathlib
import sys

import sxtwl

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from apply_majority_month import majority_solar_ym  # noqa: E402

TG = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
DZ = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']


def gz_str(gz):
    return TG[gz.tg] + DZ[gz.dz]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('years', nargs='+', type=int)
    ap.add_argument('--gz')
    args = ap.parse_args()
    for y in args.years:
        print(f'== 旧暦 {y} 年 ==')
        for lm in range(1, 13):
            for leap in (False, True):
                try:
                    d = sxtwl.fromLunar(y, lm, 1, leap)
                except Exception:
                    continue
                if d.getLunarMonth() != lm or d.isLunarLeap() != leap:
                    continue
                mj = majority_solar_ym(y, lm) if not leap else None
                label = f'閏{lm}月' if leap else f'{lm}月'
                s = (f'  {label:>5}  朔={d.getSolarYear():04d}-{d.getSolarMonth():02d}-{d.getSolarDay():02d}'
                     f' ({gz_str(d.getDayGZ())})')
                if mj:
                    s += f'  多数月={mj[0]:04d}-{mj[1]:02d}'
                print(s)
                if args.gz:
                    hits = []
                    for dd in range(1, 31):
                        try:
                            x = sxtwl.fromLunar(y, lm, dd, leap)
                        except Exception:
                            break
                        if x.getLunarMonth() != lm or x.isLunarLeap() != leap:
                            break
                        if gz_str(x.getDayGZ()) == args.gz:
                            hits.append(f'{dd}日={x.getSolarYear():04d}-{x.getSolarMonth():02d}-{x.getSolarDay():02d}')
                    if hits:
                        print(f'         {args.gz}: {", ".join(hits)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
