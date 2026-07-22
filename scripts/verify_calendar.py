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
FROMLUNAR = re.compile(r"fromLunar\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(True|False)\s*)?\)")
ARROW_DATE = re.compile(r"[→=]\s*(-?\d{3,4})[-年](\d{1,2})[-月](\d{1,2})日?")

# ---------------------------------------------------------------------------
# B-2: exactDays が実経過日数と食い違う既知例（2026-07-22 検出の19件は同日訂正済み・現在は空）。
# 値は「正しい実経過日数」。新規に検出・トリアージした訂正待ちをここに登録し、訂正時に空にしていく。
KNOWN_EXACTDAYS_PENDING = {}

# B-1: 朔日以外の fromLunar 呼び出しで結果が主張・保存値と一致しないが、文脈上正当と確認済みのもの
KNOWN_FROMLUNAR_CONTEXT = {
    ("liu-yong-liang", 0, (25, 6, 22)),      # 検討過程の候補日計算
    ("liang-xiaoji", 0, (553, 7, 26)),       # 別事象（記事日）の換算
    ("suimo-fugongshi", 0, (623, 8, 9)),     # 前後干支のブラケット計算
    ("suimo-fugongshi", 0, (624, 3, 28)),    # 同上
    ("tangmo-li-yun", 0, (886, 12, 12)),     # 検算用の中間値
    ("tangmo-shisiming", 0, (761, 3, 9)),    # 旧値の検討記録（endDate は 04-22 に訂正済み）
}
# B-1: 誤りと確定・訂正待ち（conversion 本文の引数誤記等。2026-07-22 検出の1件は同日訂正済み）
KNOWN_FROMLUNAR_PENDING = set()

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


def main() -> int:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    try:
        import sxtwl
    except ImportError:
        sxtwl = None
        warnings.append("[B1] sxtwl 未導入のため fromLunar リプレイをスキップ（pip install sxtwl）")

    pend_counts = {"B1": 0, "B2": 0, "B3": 0, "B4": 0}
    n_checked = {"B1": 0, "B2": 0, "B3": 0, "B4": 0}

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
                       ("KNOWN_AGES_CLAIM_CONTEXT", KNOWN_AGES_CLAIM_CONTEXT)):
        if left and not (name == "KNOWN_FROMLUNAR_CONTEXT" and sxtwl is None) \
                and not (name == "KNOWN_FROMLUNAR_PENDING" and sxtwl is None):
            warnings.append(f"[allowlist] {name} の陳腐化エントリ（解消済み・削除可）: {sorted(left)[:6]}")

    for w in warnings:
        print(f"WARN  {w}")
    for e_ in errors:
        print(f"ERROR {e_}")
    print(f"---\n{len(errors)} errors, {len(warnings)} warnings "
          f"(checked: B1={n_checked['B1']} B2={n_checked['B2']} B3={n_checked['B3']} B4={n_checked['B4']})")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
