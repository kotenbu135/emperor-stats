#!/usr/bin/env python3
"""Issue #34 フェーズ6: **`YYYY-MM` 形式**の month 精度 event 日付を多数月方式へ換算する。

フェーズ1〜5 のスクリプトはすべて `^(-?\\d{4})-(\\d{2})-(\\d{2})$` を要求していたため、
**日を持たない `YYYY-MM` 形式（2464 フィールド）が丸ごと対象外**になっていた。
実際にはこちらが month 精度の主流表記で、`YYYY-MM-DD`（日はプレースホルダ）は少数派だった。

内訳（フェーズ5 完了時点）:
    note に旧暦月なし        1094   照合の足場が無い（別タスク）
    換算済み                  433   note のいずれかの旧暦月から多数月方式で導ける
    未換算候補・単一月        603   ← 6a
    未換算候補・複数月        262   ← 6b（記述順で決まる 232）/ 6c（決まらない 30）
    説明不能                   72   ISO 月が note のどの旧暦月とも一致しない（別タスク）

判定はフェーズ5 と同じ向き（その端点が指すべき旧暦月 → 多数月方式で写す → 現在値と比較）。
`YYYY-MM` は日を持たないので、フェーズ1 の「日がプレースホルダであること」条件は自動的に満たされる。

使い方:
    python3 .../apply_phase6_ym.py --dry-run
    python3 .../apply_phase6_ym.py --apply
    python3 .../apply_phase6_ym.py --list-undecided   # 6c 用（記述順で決まらないもの）
    python3 .../apply_phase6_ym.py --list-ganzhi      # 干支が当該旧暦月に実在しないもの
"""
import argparse
import json
import pathlib
import re
import sys

import sxtwl

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from apply_majority_month import COUNT_KEYS, DATA_PATH, KAN, LUNAR_RX, majority_solar_ym  # noqa: E402
from check_month_conversion import prec, texts  # noqa: E402

YM = re.compile(r'^(\d{4})-(\d{2})$')
TG = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
DZ = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
PAIR = re.compile(r'(?<![閏])(正|十二|十一|十|一|二|三|四|五|六|七|八|九)月[^。、，,]{0,6}?'
                  r'([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])')

# 6c: 記述順ルール（開始＝最初の月・終了＝最後の月）では対応月が決まらないもの。
# 個別に原典・note を読んで決めた結果を (id, 指標, index, キー) -> 旧暦月 で置く。
# 値が None のものは「現行値のままで正しい」＝触らない。
UNDECIDED_RESOLUTION = {
    # 東晋〜北朝
    ('dongjin-yuandi', 'rebellionSuppressionCount', 3, 'endDate'): 4,          # 四月の石頭城の敗北で鎮圧の試みが終結
    ('beiwei-taiwudi', 'personalCampaignCount', 10, 'startDate'): 1,           # 太平真君七年正月戊辰「車駕次東雍州」
    ('beiwei-taiwudi', 'personalCampaignCount', 12, 'endDate'): 12,            # 十二月戊申「車駕至自北伐」
    ('dongwei-xiaojingdi', 'eraChangeCount', 2, 'date'): 11,                   # 興和元年冬十一月癸亥に改元
    ('dongwei-xiaojingdi', 'amnestyCount', 5, 'date'): 11,                     # 同上（新宮完成に伴う大赦）
    # 隋末〜唐
    ('suimo-wangshichong', 'personalCampaignCount', 1, 'startDate'): 8,        # 八月「秦王陳兵於青城宮，世充悉兵來拒」
    ('tang-dezong', 'rebellionSuppressionCount', 7, 'startDate'): 10,          # 建中四年冬十月の泾原兵変
    ('tang-dezong', 'rebellionSuppressionCount', 8, 'startDate'): 2,           # 興元元年二月甲子「怀光夺杨惠元…」
    ('tang-dezong', 'rebellionSuppressionCount', 9, 'startDate'): 3,           # 興元元年三月「泾州乱，牙将田希鉴杀其帅冯河清」
    ('tang-dezong', 'rebellionSufferedCount', 7, 'startDate'): 10,             # 同・被反乱側
    ('tang-dezong', 'rebellionSufferedCount', 8, 'startDate'): 2,
    ('tang-dezong', 'rebellionSufferedCount', 9, 'startDate'): 3,
    ('tang-wenzong', 'rebellionSuppressionCount', 0, 'endDate'): 5,            # 大和三年五月「柏耆斬李同捷於將陵，滄景平」
    ('tang-wuzong', 'rebellionSufferedCount', 3, 'startDate'): 4,              # 会昌三年四月に劉稹が抗命
    ('tang-wuzong', 'rebellionSufferedCount', 3, 'endDate'): 7,                # 会昌四年七月に郭誼らが劉稹を斬る
    ('tang-yizong', 'rebellionSufferedCount', 3, 'startDate'): 12,             # 咸通十三年十二月に李克用が雲州を占拠
    # 五代〜宋遼西夏
    ('wudai-houliang-zhuyougui', 'eraChangeCount', 0, 'date'): 1,              # 乾化三年正月に「鳳暦」と改元
    ('beisong-taizu', 'rebellionSuppressionCount', 2, 'startDate'): 7,         # 乾徳二年七月に汪端が朗州城を攻撃
    ('liao-shizong', 'eraChangeCount', 0, 'date'): 9,                          # 大同元年九月丁卯「改大同元年为天禄元年」
    ('liao-muzong', 'rebellionSuppressionCount', 1, 'startDate'): 12,          # 応暦十四年十二月「乌古叛」
    ('xixia-yizong', 'empressInstallationCount', 1, 'date'): 9,                # 西夏書事から九月頃の梁氏冊立と推定
    # 明清
    ('ming-taizu', 'rebellionSuppressionCount', 16, 'startDate'): 9,           # 洪武二十一年九月癸巳「越州蛮阿資叛」
    ('ming-taizu', 'rebellionSufferedCount', 16, 'startDate'): 9,
    ('ming-xiaozong', 'rebellionSufferedCount', 0, 'startDate'): 3,            # 弘治五年三月時点で反乱が継続中
    ('ming-xiaozong', 'rebellionSufferedCount', 0, 'endDate'): 6,              # 弘治六年六月に鎮圧
    ('ming-shenzong', 'eraChangeCount', 0, 'date'): 1,                         # 萬曆元年正月から新元号を使用開始
    ('qing-gaozong', 'rebellionSuppressionCount', 1, 'endDate'): 12,           # 乾隆五年十二月「张广泗进剿……悉平之」
    ('qing-gaozong', 'rebellionSuppressionCount', 6, 'endDate'): 9,            # 乾隆三十年九月の烏什城降伏（十一月は尽誅の奏聞）
    ('qing-gaozong', 'rebellionSufferedCount', 15, 'startDate'): 2,            # 乾隆六十年二月「贵州松桃苗匪石柳邓等……作乱」
    # 換算してはいけないもの
    ('qing-xuantong', 'amnestyCount', 1, 'date'): None,
    # ↑ 満洲国康徳元年（1934年）の即位・恩赦。「大同三年三月一日」は**太陽暦**の 3 月 1 日で旧暦ではない。
    #   清朝滅亡後のレコードに旧暦換算を当ててはいけない
}


def gz_str(gz):
    return TG[gz.tg] + DZ[gz.dz]


def ganzhi_exists(ly, lm, gz):
    for dd in range(1, 31):
        try:
            d = sxtwl.fromLunar(ly, lm, dd)
        except Exception:
            break
        if d.getLunarMonth() != lm or d.isLunarLeap():
            break
        if gz_str(d.getDayGZ()) == gz:
            return True
    return False


def collect(data):
    """(emperor, ck, i, key, 旧値, 新値, 種別, 旧暦月列, note) を返す。"""
    out = []
    for e in data['emperors']:
        for ck in COUNT_KEYS:
            blk = e.get(ck)
            if not isinstance(blk, dict):
                continue
            for i, ev in enumerate(blk.get('events') or []):
                t = texts(ev)
                seq = []
                for m in LUNAR_RX.finditer(t):
                    v = KAN[m.group(1)]
                    if not seq or seq[-1] != v:
                        seq.append(v)
                months = set(seq)
                if not months:
                    continue
                for key in ('date', 'startDate', 'endDate'):
                    iso = ev.get(key)
                    if not iso:
                        continue
                    m = YM.match(str(iso))
                    if not m or prec(ev, key) != 'month':
                        continue
                    y, mo = int(m.group(1)), int(m.group(2))
                    # 既にどれかの旧暦月から説明できるなら換算済み
                    if any(majority_solar_ym(ly, lm) == (y, mo) for ly in (y - 1, y) for lm in months):
                        continue
                    if mo not in months:
                        continue                     # ISO 月が note のどの月とも一致しない（別タスク）
                    sig = (e['id'], ck, i, key)
                    if len(months) == 1:
                        lm, kind = mo, '6a-単一月'
                    else:
                        want = seq[-1] if key == 'endDate' else seq[0]
                        if mo == want:
                            lm, kind = mo, '6b-記述順'
                        elif sig in UNDECIDED_RESOLUTION:
                            r = UNDECIDED_RESOLUTION[sig]
                            if r is None:
                                continue
                            lm, kind = r, '6c-個別'
                        else:
                            out.append((e, ck, i, key, str(iso), None, '6c-未決', seq, t))
                            continue
                    mj = majority_solar_ym(y, lm)
                    if not mj or mj == (y, mo):
                        continue
                    out.append((e, ck, i, key, str(iso), f'{mj[0]:04d}-{mj[1]:02d}', kind, seq, t))
    return out


def inversions(data):
    n = 0
    for e in data['emperors']:
        for ck in COUNT_KEYS:
            blk = e.get(ck)
            if not isinstance(blk, dict):
                continue
            for ev in blk.get('events') or []:
                s, en = ev.get('startDate'), ev.get('endDate')
                if s and en and str(s) > str(en):
                    n += 1
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--list-undecided', action='store_true')
    ap.add_argument('--list-ganzhi', action='store_true')
    args = ap.parse_args()

    data = json.loads(DATA_PATH.read_text(encoding='utf-8'))
    rows = collect(data)

    if args.list_undecided:
        for e, ck, i, key, old, new, kind, seq, t in rows:
            if kind == '6c-未決':
                print(f'{e["id"]} / {ck}.events[{i}].{key} = {old}  旧暦月列={seq}')
                ev = e[ck]['events'][i]
                print(f'    端点={ {k: ev.get(k) for k in ("date", "startDate", "endDate") if ev.get(k)} }')
                print(f'    note: {t[:300]}')
        return 0

    if args.list_ganzhi:
        bad = 0
        for e, ck, i, key, old, new, kind, seq, t in rows:
            if kind == '6c-未決':
                continue
            y = int(old[:4])
            lm = int(new[5:7]) and None  # 使わない
            # 換算元の旧暦月は「note の月」＝ ISO 月（この経路では常に一致）
            lm = int(old[5:7])
            hits = [m for m in PAIR.finditer(t) if KAN[m.group(1)] == lm]
            for h in hits:
                if not ganzhi_exists(y, lm, h.group(2)):
                    bad += 1
                    print(f'{e["id"]} / {ck}.events[{i}].{key} = {old} → {new}  '
                          f'旧暦{lm}月{h.group(2)}が sxtwl の当該月に無い')
                break
        print(f'\n干支が実在しない: {bad} 件')
        return 0

    before = inversions(data)
    applied = {}
    for e, ck, i, key, old, new, kind, seq, t in rows:
        if kind == '6c-未決':
            continue
        applied[kind] = applied.get(kind, 0) + 1
        if args.apply:
            ev = e[ck]['events'][i]
            if str(ev.get(key)) != old:
                raise SystemExit(f'旧値不一致で中断: {e["id"]}.{ck}[{i}].{key}')
            ev[key] = new

    undecided = sum(1 for r in rows if r[6] == '6c-未決')
    if args.apply:
        after = inversions(data)
        if after > before:
            raise SystemExit(f'端点の前後関係が悪化したので中断: {before} → {after}')
        DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        print(f'startDate > endDate: {before} → {after}（増えていないことを確認）')
    for k in sorted(applied):
        print(f'  {k}: {applied[k]}')
    print(f'  6c-未決（個別判定へ）: {undecided}')
    print(f'計 {sum(applied.values())} フィールド'
          f'{"（適用済み）" if args.apply else "（ドライラン）"}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
