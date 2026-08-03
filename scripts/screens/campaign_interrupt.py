#!/usr/bin/env python3
"""絞り込みの機械検査: 親征の「中断」と「再出征」の境目（Issue #63）。

**判定はしない。読む順序と量を変えるだけ**（規則 R-NO-AUTOGEN）。
ここで決まるのは「どの隣接ペアを原典に当て直すか」だけで、値は1つも書かない。

[ADDITIONAL_SCHEMA.md](../../data/schema/ADDITIONAL_SCHEMA.md) の7節は、2026-08-03 に
**「一時帰還を挟んでも、中断前と後で行き先（相手）が同じなら1回」**を足した（Issue #63）。
既存の**「年を空けて同じ相手に再度出征した場合は別カウント」**と両立させると、
両条項の境目は**帰還から再出発までの間隔**で決まる。

この絞り込みが見るのは、同じ皇帝の `personalCampaignCount.events` の**隣接ペア**。
中断が「別々の event として割れている」形が既存データに在れば、そこが条項の
適用対象になる（北周武帝の建徳五年の班師と4日後の再出発は1つの event の内側にあり、
**この検出器には掛からない** — 検出器が拾えるのは割れている側だけ）。

  隣接ペア
   ├ same-target-close   … 相手が同じで、記録された日付から読める再出発間隔が
   │                       1か月未満。**この条項で count が動きうる唯一の形**。kind=read
   ├ same-target-apart   … 相手が同じで間隔が1か月以上。「年を空けて再度出征」側に
   │                       落ちるので count は動かない。kind=corroborated
   ├ same-target-unknown … 相手は同じだが、間隔が読めない。**年精度の埋め草をここへ落とす**
   │                       のが肝で、`datePrecision` が year のイベントは
   │                       `0390-01-01`／`0390-12-31` という**両端が年の輪郭**の値を持つため、
   │                       月として引き算すると「1か月で再出発した」ように見える。
   │                       埋め草は witness ではないので、間隔は測れていない。kind=read
   └ different-target    … 相手キーが違う。表記の揺れで同一相手を取りこぼしている
                           可能性は**未測定**なので、absent とは名乗らない。kind=read

相手キーは `target` の表記揺れを吸収する（柔然＝蠕蠕＝茹茹、契丹＝遼 など）。
**この別名表が薄いぶんだけ different-target は水増しされる**ので、絞り込みの
効く側として扱ってはならない。

出力:
    python3 scripts/screens/campaign_interrupt.py            # 人が読む形
    python3 scripts/screens/campaign_interrupt.py --json     # ゲート（check_screenings.py）用
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from event_date_scope import load_archive, recorded_dates  # noqa: E402

EMPERORS = ROOT / "data" / "emperors.json"

FIELD = "personalCampaignCount"

BUCKETS = ("same-target-close", "same-target-apart", "same-target-unknown", "different-target")

# 同一相手の表記揺れ。左の語が `target` に含まれれば右のキーに寄せる。
# **足りないぶんは different-target を水増しする側に効く**（取りこぼしは未測定）。
ALIASES = (
    ("柔然", "柔然"), ("蠕蠕", "柔然"), ("茹茹", "柔然"),
    ("契丹", "契丹"), ("遼", "契丹"),
    ("北斉", "北斉"), ("高緯", "北斉"),
    ("南唐", "南唐"),
    ("韃靼", "韃靼"), ("阿魯台", "韃靼"),
)


def target_key(t):
    """`target` を相手の政権・勢力へ寄せた鍵。括弧書きの補足は落とす。"""
    t = (t or "").strip()
    for needle, key in ALIASES:
        if needle in t:
            return key
    return re.split(r"[（(・、]", t)[0].strip() or t


def precision(ev, side):
    """`datePrecision` は文字列と {start,end} の2形式がある（campaign_span.py と同じ）。"""
    dp = ev.get("datePrecision")
    if isinstance(dp, dict):
        return dp.get(side)
    return dp


def month_index(s):
    """`YYYY-MM…` を通し月に。年精度どまり（`YYYY`）は None。"""
    if not s:
        return None
    m = re.match(r"^(-?\d{4})-(\d{2})", s)
    if not m:
        return None
    return int(m.group(1)) * 12 + int(m.group(2))


def run():
    """戻り値は ペア鍵 → (バケット, 間隔の月数 or None)。

    **見るのは「記録された日付」で、配布物が主張する日付ではない**（Issue #69）。
    主張範囲を絞る移行で非境界年の月日は年へ丸まっており、そのまま見ると
    間隔が読めるペアまで unknown に化ける。退避した値
    （data/internal/event-date-archive.json）を戻してから測る。
    """
    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    archive = load_archive()
    pairs = {}
    for e in data["emperors"]:
        v = e.get(FIELD)
        if not isinstance(v, dict):
            continue
        events = v.get("events") or []
        for i, (a, b) in enumerate(zip(events, events[1:])):
            for ev, idx in ((a, i), (b, i + 1)):
                if not ev.get("id"):
                    sys.exit(f"{e['id']}.{FIELD}[{idx}] に id がありません"
                             f"（python3 scripts/migrations/bake_event_ids.py --fill）")
            key = f"{a['id']}→{b['id']}"
            if target_key(a.get("target")) != target_key(b.get("target")):
                pairs[key] = ("different-target", None)
                continue
            # 年精度のイベントは両端に年の輪郭（-01-01／-12-31）が入っており、
            # 月として引くと測っていない間隔が出てしまう。**埋め草は witness ではない**
            measurable = (precision(a, "end") in ("month", "day")
                          and precision(b, "start") in ("month", "day"))
            end = month_index(recorded_dates(a, archive).get("endDate"))
            start = month_index(recorded_dates(b, archive).get("startDate"))
            if not measurable or end is None or start is None:
                pairs[key] = ("same-target-unknown", None)
            elif start - end < 1:
                pairs[key] = ("same-target-close", start - end)
            else:
                pairs[key] = ("same-target-apart", start - end)
    return pairs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--seed", type=int, default=0, help="check_screenings.py が渡す（標本は引かない）")
    ap.add_argument("--sample", type=int, default=0, help="同上。absent バケットが無いので未使用")
    args = ap.parse_args()

    pairs = run()
    counts = {name: 0 for name in BUCKETS}
    for bucket, _ in pairs.values():
        counts[bucket] += 1

    if args.json:
        print(json.dumps({
            "unit": "campaign-event-pair",
            "n": len(pairs),
            "buckets": counts,
            "coverage": {k: [v[0]] for k, v in sorted(pairs.items())},
        }, ensure_ascii=False))
        return 0

    read = counts["same-target-close"] + counts["same-target-unknown"] + counts["different-target"]
    print(f"母集団 {len(pairs)}件（親征イベントの隣接ペア） → 要読解 {read}件")
    for name in BUCKETS:
        print(f"  {name}: {counts[name]}")
    print()
    gaps = sorted((g, k) for k, (b, g) in pairs.items() if g is not None)
    if gaps:
        print("同一相手ペアの再出発間隔（月・短い順に10件）:")
        for g, k in gaps[:10]:
            print(f"  {g:>3}か月  {k}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
