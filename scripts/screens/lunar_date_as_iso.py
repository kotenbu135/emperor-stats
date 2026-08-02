#!/usr/bin/env python3
"""events の日精度 ISO 日付が、その event 自身の記述と食い違うものを機械で拾う（Issue #50 の横展開）。

Issue #50 でトリアージした5件のうち2件は「旧暦の月日をそのまま西暦の月日として書いた」
（元徽五年七月七日 → 0477-07-07 / 隆昌元年七月二十二日 → 0494-07-22）で、3件は
「在位終了日を訂正したときに event 側へ横展開されなかった旧値」だった。前者は同型の誤りが
他にもありうるので、原典を読む前に母集団を機械で絞る（規則 R-SCREEN-FIRST）。

**この絞り込みは読む順序と量を決めるだけで、判定はしない**（規則 R-NO-AUTOGEN）。

母集団: すべての count グループの events のうち、date / startDate / endDate が日精度で
        入っているフィールド。
検出器A（干支不一致）: その event の name / outcome / note に干支が1つ以上書かれているのに、
        ISO 日付の干支がそのどれとも一致しない。干支は日の絶対的な鍵なので、
        「書かれている干支のどれとも合わない」は換算の食い違いの強い候補になる。
        note が別事象の干支を併記することがあるため、「1つも一致しない」を条件にしている。
検出器B（旧暦直書き）: event の記述に漢数字の「◯月◯日」があり、ISO 日付の月・日が
        その旧暦の月・日と数字として一致する。旧暦の月日を西暦欄に書いた形。
        Issue #50 の2件はここに掛かる（＝検出力の実測がある）。

使い方: python3 scripts/screens/lunar_date_as_iso.py [--json] [--detail]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DATA = ROOT / "data" / "emperors.json"

COUNT_GROUPS = [
    "eraChangeCount", "amnestyCount", "empressInstallationCount",
    "crownPrinceChangeCount", "personalCampaignCount", "rebellionSuppressionCount",
    "rebellionSufferedCount", "capitalRelocationCount",
]

GAN = "甲乙丙丁戊己庚辛壬癸"
ZHI = "子丑寅卯辰巳午未申酉戌亥"
GANZHI = {GAN[i % 10] + ZHI[i % 12] for i in range(60)}
GANZHI_RE = re.compile("|".join(sorted(GANZHI)))

CN_DIGIT = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8,
            "九": 9, "十": 10, "廿": 20, "卅": 30, "元": 1, "正": 1}
# 「七月七日」「九月廿九日」「三月十三日」…（閏月は月番号が同じなので同様に扱う）
LUNAR_MD_RE = re.compile(r"(閏?)([一二三四五六七八九十正]{1,3})月([一二三四五六七八九十廿卅]{1,3})日")
ISO_DAY_RE = re.compile(r"^(-?\d{4})-(\d{2})-(\d{2})$")


def cn_num(s: str) -> int | None:
    """漢数字（〜三十九）を整数へ。読めなければ None。"""
    if not s:
        return None
    if s in CN_DIGIT and s not in ("十",):
        return CN_DIGIT[s]
    if s == "十":
        return 10
    if s.startswith("廿") or s.startswith("卅"):
        base = 20 if s[0] == "廿" else 30
        rest = s[1:]
        if not rest:
            return base
        return base + (CN_DIGIT.get(rest) or 0) if rest in CN_DIGIT else None
    if "十" in s:
        head, _, tail = s.partition("十")
        h = CN_DIGIT.get(head, 1) if head else 1
        t = CN_DIGIT.get(tail, 0) if tail else 0
        if (head and head not in CN_DIGIT) or (tail and tail not in CN_DIGIT):
            return None
        return h * 10 + t
    return None


def load_sxtwl():
    try:
        import sxtwl
    except ImportError:
        return None
    return sxtwl


def day_ganzhi(sxtwl, y: int, m: int, d: int) -> str:
    day = sxtwl.fromSolar(y, m, d)
    g = day.getDayGZ()
    return GAN[g.tg] + ZHI[g.dz]


def event_text(ev: dict) -> str:
    return " ".join(str(ev.get(k) or "") for k in ("name", "outcome", "note", "target", "leader"))


def precision_for(ev: dict, key: str):
    p = ev.get("datePrecision")
    if isinstance(p, dict):
        return p.get("end" if key == "endDate" else "start")
    return p


def run():
    sxtwl = load_sxtwl()
    data = json.loads(DATA.read_text(encoding="utf-8"))
    population = 0
    hits_a, hits_b = [], []
    for e in data["emperors"]:
        for g in COUNT_GROUPS:
            o = e.get(g)
            if not isinstance(o, dict):
                continue
            for i, ev in enumerate(o.get("events") or []):
                if not isinstance(ev, dict):
                    continue
                text = event_text(ev)
                lunar_md = [(cn_num(m.group(2)), cn_num(m.group(3)))
                            for m in LUNAR_MD_RE.finditer(text)]
                written_gz = set(GANZHI_RE.findall(text))
                for key in ("date", "startDate", "endDate"):
                    val = ev.get(key)
                    if not isinstance(val, str):
                        continue
                    mo = ISO_DAY_RE.match(val)
                    if not mo or precision_for(ev, key) != "day":
                        continue
                    population += 1
                    y, mm, dd = int(mo.group(1)), int(mo.group(2)), int(mo.group(3))
                    where = f"{e['id']}.{g}[{i}].{key}"
                    if written_gz and sxtwl is not None:
                        gz = day_ganzhi(sxtwl, y, mm, dd)
                        if gz not in written_gz:
                            hits_a.append((where, val, gz, "/".join(sorted(written_gz))))
                    if (mm, dd) in lunar_md:
                        hits_b.append((where, val, f"{mm}月{dd}日"))
    return population, hits_a, hits_b, sxtwl is not None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--detail", action="store_true")
    args = ap.parse_args()
    population, hits_a, hits_b, has_sxtwl = run()
    both = {h[0] for h in hits_a} & {h[0] for h in hits_b}
    read = len({h[0] for h in hits_a} | {h[0] for h in hits_b})
    if args.json:
        print(json.dumps({
            "population": population,
            "ganzhiMismatch": len(hits_a),
            "lunarWrittenAsIso": len(hits_b),
            "both": len(both),
            "read": read,
            "sxtwl": has_sxtwl,
        }, ensure_ascii=False))
        return 0
    if not has_sxtwl:
        print("WARN: sxtwl 未導入のため検出器A（干支不一致）はスキップした", file=sys.stderr)
    print(f"母集団（日精度の event 日付フィールド）: {population}")
    print(f"  A 干支不一致: {len(hits_a)}")
    print(f"  B 旧暦の月日を西暦欄へ直書きの疑い: {len(hits_b)}")
    print(f"  → 要読解（A∪B・重複 {len(both)} 件を除く）: {read}")
    if args.detail:
        print("\n[A] 干支不一致（ISO 日付の干支 / 記述にある干支）")
        for w, v, gz, written in hits_a:
            print(f"  {w} = {v} → {gz} ／ 記述: {written}")
        print("\n[B] 旧暦の月日と ISO の月日が一致")
        for w, v, md in hits_b:
            print(f"  {w} = {v} ／ 記述: {md}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
