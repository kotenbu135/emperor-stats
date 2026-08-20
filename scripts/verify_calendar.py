"""暦換算・在位日数の機械リプレイ検証ゲート（層B の恒久化・2026-07-22 note 全件検証で導入）。

使い方: python3 scripts/verify_calendar.py
終了コード: 0=合格（警告含む） / 1=エラー

チェック内容:
  B-1 conversion 中の sxtwl.fromLunar(y,m,d[,leap]) を全件リプレイし、結果が conversion 本文の
      「→YYYY-MM-DD」主張または保存 startDate/endDate と一致するか（旧暦1日=朔日アンカー計算は対象外。
      sxtwl 未導入環境ではスキップ・警告）
  B-2 exactDays を実経過日数（ユリウス/グレゴリオ JDN 差）で全件再計算。
      日付ラベルの暦系は「1582-10-15 改暦前=ユリウス・以後=グレゴリオ」（sxtwl の出力系と同一。
      2026-07-22 に実測確定。reignDaysPolicy「暦系によらず日数不変」の機械化）
  B-3 conversion 本文の「→YYYY-MM-DD」主張のうち、保存日付と±3日以内で食い違うもの
      （内禅・即位日の同期漏れ＝光宗/寧宗・遼景宗型の検出。±4日以上は別事象言及とみなし対象外）
  B-4 ages.note 本文の「→YYYY-MM-DD」主張が birthDate/deathDate と一致するか
  B-5 回数系 events の source.conversion にある fromLunar(y,m,d[,leap]) を再演し、保存日付・
      conversion 本文の主張と突き合わせる（2026-08-03 新設・Issue #56）。**朔日アンカー
      fromLunar(y,m,1) は月精度の主張として扱い、多数月を計算して「→YYYY-MM」や保存された
      月精度の値と照合する** — 旧暦の月番号を太陽暦の欄へ直書きした型の誤りはここで落ちる。
      events は reigns と違って原表記を持たず、この欄が無いうちは機械で区別できなかった
  B-6 reigns の datePrecision が month の側を持つ在位について、conversion の朔日アンカー
      fromLunar(y,m,1) を B-5 と同じ多数月方式で再演し、保存された月・「→YYYY-MM」主張と
      突き合わせる（2026-08-21 新設・残量表「reigns[] の月精度日付が旧暦から再演されない」
      101値。元末 陳理・明昇の「旧暦月番号の直書き」2件はこの型だった）。**アンカーの実日付が
      保存日付そのもの（朔日アンカー方式）の場合も合格** — 月精度を多数月で作るか朔日で作るかは
      未決のまま併存しており（残量表の43値の行）、未決の規約をゲートで片側に倒さない。
      **月精度の側が無い在位のアンカーは従来どおり照合対象外**（日精度の計算過程のアンカーを
      月の主張と誤読しない）。アンカーを持つのは母集団101値のうち一部だけで、持たない値は
      依然再演されない（検査件数は B6=… で必ず出す。0 を「綺麗」と読まない）

KNOWN_* は 2026-07-22 検証時のトリアージ済み事項:
  - *_PENDING = 誤りと確定・訂正待ち（警告として件数を出し続ける。訂正されたら陳腐化警告）
  - *_CONTEXT = 別事象・計算過程の言及と確認済みの正当例（新規発生のみエラー）
  詳細: docs/qa/note-verification-2026-07-22/REPORT.md
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "emperors.json"

ISO = re.compile(r"^(-?\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$")
# 年は BCE を負で書く（天文年）。`(\d+)` のままだと fromLunar(-201,7,1) が黙って
# 素通りし、BCE の conversion が1件も再演されない（2026-08-07・Issue #82 で実際に起きた）
FROMLUNAR = re.compile(r"fromLunar\(\s*(-?\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(True|False)\s*)?\)")
ARROW_DATE = re.compile(r"[→=]\s*(-?\d{3,4})[-年](\d{1,2})[-月](\d{1,2})日?")
# B-5 の月精度主張。ISO の「→YYYY-MM」だけを拾う（日まで続く形は ARROW_DATE の担当）
ARROW_MONTH = re.compile(r"[→=]\s*(-?\d{3,4})-(\d{2})(?!\s*-?\d)")
# events を持つ回数系フィールド（B-5 の走査対象）
COUNT_GROUPS = ("eraChangeCount", "amnestyCount", "empressInstallationCount",
                "crownPrinceDepositionCount", "personalCampaignCount",
                "rebellionSuppressionCount", "rebellionSufferedCount",
                "capitalRelocationCount")

# ---------------------------------------------------------------------------
# B-2: exactDays が実経過日数と食い違う既知例（2026-07-22 検出の19件は同日訂正済み・現在は空）。
# 値は「正しい実経過日数」。新規に検出・トリアージした訂正待ちをここに登録し、訂正時に空にしていく。
KNOWN_EXACTDAYS_PENDING = {}

# B-1: 朔日以外の fromLunar 呼び出しで結果が主張・保存値と一致しないが、文脈上正当と確認済みのもの
KNOWN_FROMLUNAR_CONTEXT = {
    ("liang-xiaoji", 0, (553, 7, 26)),       # 別事象（記事日）の換算
    ("suimo-fugongshi", 0, (623, 8, 9)),     # 前後干支のブラケット計算
    ("suimo-fugongshi", 0, (624, 3, 28)),    # 同上
    ("tangmo-li-yun", 0, (886, 12, 12)),     # 検算用の中間値
    ("tangmo-shisiming", 0, (761, 3, 9)),    # 旧値の検討記録（endDate は 04-22 に訂正済み）
}
# B-1: 誤りと確定・訂正待ち（conversion 本文の引数誤記等。2026-07-22 検出の1件は同日訂正済み）
KNOWN_FROMLUNAR_PENDING = set()

# B-5: events の source.conversion で、リプレイ結果が主張・保存値と一致しないが文脈上正当なもの。
# **この欄は 2026-08-03 新設で遡及しない**ので、既存 2,000 件超の events には conversion が無く、
# 検査件数は 0 から増えていく。0 件を「綺麗」と読まないため件数は必ず出す（B5=…）。
#
# **鍵は `(events[].id, (旧暦年, 月, 日))`。** 2026-08-03 の主張範囲の移行までは
# `(皇帝id, 容器, 添字, 旧暦)` で、event を1件挿入すると**別の event の食い違いを黙って
# 許可する**形だった（validate_emperors.py の許可リスト2本と同型の穴。中身が空のうちに
# 形だけ直しておく — 埋まってから直すと添字で焼き付いた参照ごと移すことになる）。
#
# 対象は「月日の深さを持つ日付」＝配布物が主張する 1,173件（Issue #69）。丸めて年精度に
# なった event の conversion は主張の外なので、リプレイ結果は保存値ではなく
# conversion 本文の「→」主張とだけ突き合わせることになる。
KNOWN_EVENTCONV_CONTEXT = set()
KNOWN_EVENTCONV_PENDING = set()

# B-6: reigns の朔日アンカーで、多数月が保存月・主張と一致しないが文脈上正当なもの。
# 鍵は (皇帝id, reigns添字, (旧暦年, 月, 日))。月精度の側が在る在位でも、アンカーが
# 日精度側や別事象の計算過程のことがある（その場合はここへ理由つきで登録する）
KNOWN_REIGNCONV_CONTEXT = {
    # 別事象のアンカー。二月壬午は起兵の換算で、在位開始（称帝）は三月＝多数月 0617-04
    # で保存値と一致している（2026-08-21 導入時トリアージ・多数月は再計算で確認済み）
    ("suimo-liangshidu", 0, (617, 2, 1)),
    # 保存値 0933-01-01 は旧暦月番号のままで、朔日（933-01-29）とも多数月（0933-02）とも
    # 一致しない。ただし朔日アンカー方式なら月は 01 で合っており、どちらの方式で作るかが
    # 未決（残量表「朔日アンカーで作るか多数月で作るかが決まっていない」の行・conversion
    # 自身が係属を明記）のため、決着までエラーにしない。決着したらこの行を外して直す
    ("shiguo-min-wangyanjun", 0, (933, 1, 1)),
}
KNOWN_REIGNCONV_PENDING = set()

# B-3: 保存日付と±3日以内で食い違う conversion 主張のうち、別事象・検討過程と確認済みの正当例
KNOWN_NEARMISS_CONTEXT = {
    ("qi-yulinwang", 0, "0494-09-06"), ("qi-hedi", 0, "0502-05-02"),
    ("chen-houzhu", 0, "0582-02-17"), ("chen-houzhu", 0, "0582-02-18"),
    ("chen-houzhu", 0, "0582-02-19"), ("suimo-zhucan", 0, "0618-11-04"),
    ("tang-jingzong", 0, "0824-02-25"), ("wudai-houzhou-gongdi", 0, "0959-07-27"),
    ("wudai-houzhou-gongdi", 0, "0960-02-02"), ("shiguo-houshu-mengzhixiang", 0, "0934-09-09"),
    ("shiguo-houshu-mengzhixiang", 0, "0934-09-10"), ("shiguo-min-wangyanjun", 0, "0935-11-16"),
    ("shiguo-min-wangyanjun", 0, "0935-11-18"), ("shiguo-min-wangjipeng", 0, "0935-11-17"),
    ("shiguo-beihan-liujiyuan", 0, "0979-06-02"), ("nansong-ningzong", 0, "1194-07-21"),
    ("nansong-ningzong", 0, "1194-07-22"), ("nansong-ningzong", 0, "1224-09-15"),
    ("liao-shizong", 0, "0947-05-15"), ("liao-shizong", 0, "0951-10-04"),
    ("jin-xizong", 0, "1135-02-09"), ("jin-xizong", 0, "1150-01-08"),
    ("jin-hailingwang", 0, "1150-01-11"), ("jin-weishaowang", 0, "1213-09-09"),
    ("jin-weishaowang", 0, "1213-09-10"), ("jin-aizong", 0, "1234-02-08"),
    ("ming-xuanzong", 0, "1435-01-29"), ("qing-shengzu", 0, "1661-02-04"),
}
# B-3: 誤りと確定・訂正待ち（2026-07-22 検出の遼景宗1件は同日 startDate を 03-12 に訂正済み）
KNOWN_NEARMISS_PENDING = set()

# B-4: ages.note の日付主張のうち、別事象（即位日等）の言及と確認済みの正当例
KNOWN_AGES_CLAIM_CONTEXT = {
    ("hou-han-lingdi", "0168-02-17"), ("jin-huaidi", "0313-03-14"),
    ("dongjin-yuandi", "0318-04-26"), ("beiwei-youzhu-yuanzhao", "0528-04-02"),
    ("beiqi-houzhu", "0565-06-08"), ("tang-daizong", "0762-05-18"),
    ("wudai-houtang-zhuangzong", "0885-11-22"), ("shiguo-nanhan-liuyan", "0942-04-11"),
    ("nansong-lizong", "1224-09-17"), ("jin-aizong", "1224-01-15"),
    ("jin-aizong", "1234-02-08"), ("ming-renzong", "1424-09-07"),
    ("nanming-zongzong", "1645-08-18"), ("qing-renzong", "1796-02-09"),
    ("qing-xuantong", "1908-11-14"),
}
# B-4: 誤りと確定・訂正待ち（2026-07-22 検出の史思明1件は同日 note を同期訂正済み）
KNOWN_AGES_CLAIM_PENDING = set()

errors: list[str] = []
warnings: list[str] = []


def pd(v):
    m = ISO.match(v) if isinstance(v, str) else None
    if not m:
        return None
    return (int(m.group(1)), int(m.group(2)) if m.group(2) else None,
            int(m.group(3)) if m.group(3) else None)


def full(t):
    return t is not None and t[1] is not None and t[2] is not None


def jdn(y, m, day, julian):
    a = (14 - m) // 12
    yy = y + 4800 - a
    mm = m + 12 * a - 3
    base = day + (153 * mm + 2) // 5 + 365 * yy + yy // 4
    return base - 32083 if julian else base - yy // 100 + yy // 400 - 32045


def J(t):
    return jdn(*t, t < (1582, 10, 15))


def majority_month(sxtwl, y, m, leap):
    """旧暦の1ヶ月が最も多く重なる太陽暦の月（多数月方式）を返す。

    月精度の日付はこの方式で作る決まりなので、朔日アンカー fromLunar(y,m,1) を
    「その旧暦月の主張」と読んで保存値と突き合わせられる。日精度と違って
    別の記法を増やさずに済む。
    """
    d = sxtwl.fromLunar(y, m, 1, leap)
    counts = {}
    while True:
        k = (d.getSolarYear(), d.getSolarMonth())
        counts[k] = counts.get(k, 0) + 1
        d = d.after(1)
        if d.getLunarDay() == 1:
            break
    return max(counts, key=lambda k: counts[k])


def main() -> int:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    try:
        import sxtwl
    except ImportError:
        sxtwl = None
        warnings.append("[B1] sxtwl 未導入のため fromLunar リプレイをスキップ（pip install sxtwl）")

    pend_counts = {"B1": 0, "B2": 0, "B3": 0, "B4": 0, "B5": 0, "B6": 0}
    n_checked = {"B1": 0, "B2": 0, "B3": 0, "B4": 0, "B5": 0, "B6": 0}

    for e in data["emperors"]:
        eid = e["id"]
        for i, r in enumerate(e.get("reigns") or []):
            conv = ((r.get("duration") or {}).get("source") or {}).get("conversion") or ""
            stored = [t for t in (pd(r.get("startDate")), pd(r.get("endDate"))) if full(t)]
            claims = [(int(a), int(b), int(c)) for a, b, c in ARROW_DATE.findall(conv)]

            # B-1 fromLunar リプレイ
            if sxtwl:
                for ly, lm, ld, leap in FROMLUNAR.findall(conv):
                    ly, lm, ld = int(ly), int(lm), int(ld)
                    if ld == 1:
                        continue  # 朔日アンカー計算は照合対象外
                    n_checked["B1"] += 1
                    try:
                        day = sxtwl.fromLunar(ly, lm, ld, leap == "True")
                        got = (day.getSolarYear(), day.getSolarMonth(), day.getSolarDay())
                    except Exception as ex:
                        errors.append(f"[B1] {eid}.reigns[{i}]: fromLunar({ly},{lm},{ld}) 実行エラー {ex}")
                        continue
                    if got in claims or got in stored:
                        continue
                    key = (eid, i, (ly, lm, ld))
                    if key in KNOWN_FROMLUNAR_PENDING:
                        KNOWN_FROMLUNAR_PENDING.discard(key)
                        pend_counts["B1"] += 1
                    elif key in KNOWN_FROMLUNAR_CONTEXT:
                        KNOWN_FROMLUNAR_CONTEXT.discard(key)
                    else:
                        errors.append(f"[B1] {eid}.reigns[{i}]: fromLunar({ly},{lm},{ld})→"
                                      f"{got[0]:04d}-{got[1]:02d}-{got[2]:02d} が conversion 主張にも"
                                      f"保存日付にも一致しない（引数誤記または同期漏れの疑い）")

            # B-6 月精度の側の朔日アンカーを多数月方式で再演（2026-08-21・残量表の行）。
            # 月精度の作り方は多数月と朔日アンカーの2方式が未決のまま併存する（残量表
            # 「朔日アンカーで作るか多数月で作るかが決まっていない」43値）ので、
            # **アンカーの実日付が保存日付そのもの（朔日アンカー方式）である場合も合格**
            # とし、未決の規約をこのゲートで片側に倒さない。落ちるのは、多数月にも
            # 朔日にも一致しない形＝旧暦月番号の直書き（陳理・明昇型）だけ
            dp = r.get("datePrecision") or {}
            month_sides = [s for s in ("start", "end") if dp.get(s) == "month"]
            if sxtwl and month_sides and conv:
                stored_all = [pd(r.get("startDate")), pd(r.get("endDate"))]
                stored_full = {t for t in stored_all if full(t)}
                stored_m = {(t[0], t[1]) for t in stored_all
                            if t is not None and t[1] is not None}
                claims_m = {(int(a), int(b)) for a, b in ARROW_MONTH.findall(conv)}
                for ly, lm, ld, leap in FROMLUNAR.findall(conv):
                    ly, lm, ld = int(ly), int(lm), int(ld)
                    if ld != 1:
                        continue  # 朔日以外は B-1 の担当
                    n_checked["B6"] += 1
                    try:
                        got = majority_month(sxtwl, ly, lm, leap == "True")
                        day = sxtwl.fromLunar(ly, lm, 1, leap == "True")
                        anchor = (day.getSolarYear(), day.getSolarMonth(), day.getSolarDay())
                    except Exception as ex:
                        errors.append(f"[B6] {eid}.reigns[{i}]: fromLunar({ly},{lm},1) 実行エラー {ex}")
                        continue
                    if got in claims_m or got in stored_m or anchor in stored_full:
                        continue
                    key = (eid, i, (ly, lm, ld))
                    if key in KNOWN_REIGNCONV_PENDING:
                        KNOWN_REIGNCONV_PENDING.discard(key)
                        pend_counts["B6"] += 1
                    elif key in KNOWN_REIGNCONV_CONTEXT:
                        KNOWN_REIGNCONV_CONTEXT.discard(key)
                    else:
                        errors.append(
                            f"[B6] {eid}.reigns[{i}]: fromLunar({ly},{lm},1)→"
                            f"{got[0]:04d}-{got[1]:02d}（多数月）が月精度の保存日付にも"
                            f"conversion 主張にも一致しない（旧暦月番号の直書き・"
                            f"計算過程アンカーの疑い）")

            # B-2 exactDays 再計算
            ex_ = (r.get("duration") or {}).get("exactDays")
            if ex_ is not None:
                st, en = pd(r.get("startDate")), pd(r.get("endDate"))
                if full(st) and full(en):
                    n_checked["B2"] += 1
                    calc = J(en) - J(st)
                    if calc != ex_:
                        if KNOWN_EXACTDAYS_PENDING.get((eid, i)) == calc:
                            del KNOWN_EXACTDAYS_PENDING[(eid, i)]
                            pend_counts["B2"] += 1
                        else:
                            errors.append(f"[B2] {eid}.reigns[{i}]: exactDays={ex_} だが実経過日数は {calc}"
                                          f"（暦系: 1582-10-15 改暦前=ユリウス）")

            # B-3 near-miss 主張
            for t in claims:
                if not stored or t in stored:
                    continue
                if min(abs(J(t) - J(s)) for s in stored) > 3:
                    continue  # ±4日以上は別事象言及とみなす
                n_checked["B3"] += 1
                key = (eid, i, f"{t[0]:04d}-{t[1]:02d}-{t[2]:02d}")
                if key in KNOWN_NEARMISS_PENDING:
                    KNOWN_NEARMISS_PENDING.discard(key)
                    pend_counts["B3"] += 1
                elif key in KNOWN_NEARMISS_CONTEXT:
                    KNOWN_NEARMISS_CONTEXT.discard(key)
                else:
                    errors.append(f"[B3] {eid}.reigns[{i}]: conversion 主張 {key[2]} が保存日付と"
                                  f"±3日以内で食い違う（同期漏れの疑い＝光宗/寧宗・遼景宗型）")

        # B-5 events の source.conversion リプレイ（2026-08-03・Issue #56）
        if sxtwl:
            for g in COUNT_GROUPS:
                o = e.get(g)
                if not isinstance(o, dict):
                    continue
                for i, ev in enumerate(o.get("events") or []):
                    conv = ((ev.get("source") or {}) if isinstance(ev.get("source"), dict)
                            else {}).get("conversion") or ""
                    if not conv:
                        continue
                    stored_d = {t for t in (pd(ev.get("date")), pd(ev.get("startDate")),
                                            pd(ev.get("endDate"))) if full(t)}
                    stored_m = {(t[0], t[1]) for t in
                                (pd(ev.get("date")), pd(ev.get("startDate")), pd(ev.get("endDate")))
                                if t is not None and t[1] is not None}
                    claims_d = {(int(a), int(b), int(c)) for a, b, c in ARROW_DATE.findall(conv)}
                    claims_m = {(int(a), int(b)) for a, b in ARROW_MONTH.findall(conv)}
                    for ly, lm, ld, leap in FROMLUNAR.findall(conv):
                        ly, lm, ld = int(ly), int(lm), int(ld)
                        n_checked["B5"] += 1
                        key = (ev.get("id") or f"{eid}.{g}[{i}]", (ly, lm, ld))
                        try:
                            if ld == 1:
                                # 朔日アンカー＝月精度の主張。多数月を計算して突き合わせる
                                got = majority_month(sxtwl, ly, lm, leap == "True")
                                ok = got in claims_m or got in stored_m
                                shown = f"{got[0]:04d}-{got[1]:02d}（多数月）"
                            else:
                                day = sxtwl.fromLunar(ly, lm, ld, leap == "True")
                                got = (day.getSolarYear(), day.getSolarMonth(), day.getSolarDay())
                                ok = got in claims_d or got in stored_d
                                shown = f"{got[0]:04d}-{got[1]:02d}-{got[2]:02d}"
                        except Exception as ex:
                            errors.append(f"[B5] {key[0]}: fromLunar({ly},{lm},{ld}) 実行エラー {ex}")
                            continue
                        if ok:
                            continue
                        if key in KNOWN_EVENTCONV_PENDING:
                            KNOWN_EVENTCONV_PENDING.discard(key)
                            pend_counts["B5"] += 1
                        elif key in KNOWN_EVENTCONV_CONTEXT:
                            KNOWN_EVENTCONV_CONTEXT.discard(key)
                        else:
                            errors.append(
                                f"[B5] {key[0]}: fromLunar({ly},{lm},{ld})→{shown} が "
                                f"conversion 主張にも保存日付にも一致しない"
                                f"（旧暦月番号の直書き・引数誤記・同期漏れの疑い）")

        # B-4 ages.note の日付主張
        a = e.get("ages") or {}
        note = a.get("note") or ""
        stored_a = [t for t in (pd(a.get("birthDate")), pd(a.get("deathDate"))) if full(t)]
        for x, y, z in ARROW_DATE.findall(note):
            t = (int(x), int(y), int(z))
            if t in stored_a:
                continue
            n_checked["B4"] += 1
            key = (e["id"], f"{t[0]:04d}-{t[1]:02d}-{t[2]:02d}")
            if key in KNOWN_AGES_CLAIM_PENDING:
                KNOWN_AGES_CLAIM_PENDING.discard(key)
                pend_counts["B4"] += 1
            elif key in KNOWN_AGES_CLAIM_CONTEXT:
                KNOWN_AGES_CLAIM_CONTEXT.discard(key)
            else:
                errors.append(f"[B4] {e['id']}.ages: note の日付主張 {key[1]} が birthDate/deathDate に"
                              f"一致しない（旧値残存または別事象の言及＝要確認）")

    total_pending = sum(pend_counts.values())
    if total_pending:
        warnings.append(f"[pending] 検出済み・訂正待ちの既知問題: exactDays {pend_counts['B2']} 件・"
                        f"fromLunar 引数 {pend_counts['B1']} 件・日付同期 {pend_counts['B3'] + pend_counts['B4']} 件"
                        f"（一覧: docs/qa/note-verification-2026-07-22/REPORT.md）")
    for name, left in (("KNOWN_EXACTDAYS_PENDING", set(KNOWN_EXACTDAYS_PENDING)),
                       ("KNOWN_FROMLUNAR_PENDING", KNOWN_FROMLUNAR_PENDING),
                       ("KNOWN_FROMLUNAR_CONTEXT", KNOWN_FROMLUNAR_CONTEXT),
                       ("KNOWN_NEARMISS_PENDING", KNOWN_NEARMISS_PENDING),
                       ("KNOWN_NEARMISS_CONTEXT", KNOWN_NEARMISS_CONTEXT),
                       ("KNOWN_AGES_CLAIM_PENDING", KNOWN_AGES_CLAIM_PENDING),
                       ("KNOWN_AGES_CLAIM_CONTEXT", KNOWN_AGES_CLAIM_CONTEXT),
                       ("KNOWN_EVENTCONV_PENDING", KNOWN_EVENTCONV_PENDING),
                       ("KNOWN_EVENTCONV_CONTEXT", KNOWN_EVENTCONV_CONTEXT),
                       ("KNOWN_REIGNCONV_PENDING", KNOWN_REIGNCONV_PENDING),
                       ("KNOWN_REIGNCONV_CONTEXT", KNOWN_REIGNCONV_CONTEXT)):
        if left and not (name == "KNOWN_FROMLUNAR_CONTEXT" and sxtwl is None) \
                and not (name == "KNOWN_FROMLUNAR_PENDING" and sxtwl is None):
            warnings.append(f"[allowlist] {name} の陳腐化エントリ（解消済み・削除可）: {sorted(left)[:6]}")

    for w in warnings:
        print(f"WARN  {w}")
    for e_ in errors:
        print(f"ERROR {e_}")
    print(f"---\n{len(errors)} errors, {len(warnings)} warnings "
          f"(checked: B1={n_checked['B1']} B2={n_checked['B2']} B3={n_checked['B3']} "
          f"B4={n_checked['B4']} B5={n_checked['B5']} B6={n_checked['B6']})")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
