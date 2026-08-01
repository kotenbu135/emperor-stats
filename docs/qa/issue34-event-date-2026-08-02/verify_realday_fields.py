#!/usr/bin/env python3
"""Issue #34 残タスク・ステップA: 「C-日に実値あり」37 フィールドが本当に換算済みかを照合する。

month 精度なのに日に実値が入っているものは、既に太陽暦の日まで換算されている（＝触ってはいけない）
というのが 7 節の観察。これを機械的に確かめる:

  ISO 日付 → sxtwl.fromSolar で旧暦へ逆変換し、
    (1) 得られた旧暦月が note に現れる旧暦月のどれかと一致するか
    (2) note に日干支があるなら、その日の干支と一致するか

(1)(2) が立てば「旧暦の実日付を太陽暦へ換算した値」で確定し、多数月方式を当ててはいけない。
判定ではなく照合（換算の逆算）なので機械で行う。
"""
import json
import pathlib
import re
import sys

import sxtwl

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from apply_majority_month import COUNT_KEYS, DATA_PATH, KAN, LUNAR_RX  # noqa: E402
from list_remaining import lunar_seq, prec, texts  # noqa: E402

TG = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
DZ = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
GZ_RX = re.compile(r'[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]')
ISO_RX = re.compile(r'^(-?\d{4})-(\d{2})-(\d{2})$')


def gz_str(gz):
    return TG[gz.tg] + DZ[gz.dz]


def main():
    data = json.loads(DATA_PATH.read_text(encoding='utf-8'))
    ok = mismatch = 0
    for e in data['emperors']:
        for ck in COUNT_KEYS:
            blk = e.get(ck)
            if not isinstance(blk, dict):
                continue
            for i, ev in enumerate(blk.get('events') or []):
                t = texts(ev)
                seq = lunar_seq(t)
                if not seq:
                    continue
                gzs = set(GZ_RX.findall(t))
                for key in ('date', 'startDate', 'endDate'):
                    iso = ev.get(key)
                    if not iso:
                        continue
                    m = ISO_RX.match(str(iso))
                    if not m or prec(ev, key) != 'month':
                        continue
                    y, mo, dd = int(m.group(1)), int(m.group(2)), int(m.group(3))
                    if y < 1 or mo not in set(seq):
                        continue
                    import calendar
                    if (dd == 1) or (dd == calendar.monthrange(y, mo)[1]):
                        continue        # プレースホルダはこのスクリプトの対象外
                    d = sxtwl.fromSolar(y, mo, dd)
                    lm, ld = d.getLunarMonth(), d.getLunarDay()
                    g = gz_str(d.getDayGZ())
                    # note の干支は同一 event の他端点のものが混ざるので、判定は旧暦月の一致で行い
                    # 干支は補助情報として表示するだけにする。
                    hit_month = lm in set(seq)
                    hit_gz = g in gzs
                    verdict = ('換算済み' if hit_month else ('干支一致・月不一致' if hit_gz else '月不一致'))
                    if hit_month and ld == 1:
                        verdict = '換算済み（朔＝月精度の開始日）'
                    if verdict.startswith('換算済み'):
                        ok += 1
                    else:
                        mismatch += 1
                        print(f'[{verdict}] {e["id"]} / {ck}.events[{i}].{key} = {iso}')
                        print(f'    逆変換: 旧暦{d.getLunarYear()}年{lm}月{ld}日 {g} / note の月列={seq} 干支={sorted(gzs)}')
                        print(f'    note: {t[:220]}')
    print(f'\n換算済みと確認: {ok} / 要確認: {mismatch}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
