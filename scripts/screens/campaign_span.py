#!/usr/bin/env python3
"""絞り込みの機械検査: 親征イベントの期間（Issue #49 から派生）。

**判定はしない。読む順序と量を変えるだけ**（規則 R-NO-AUTOGEN）。
ここで決まるのは「どのイベントの終期を原典に当て直すか」だけで、値は1つも書かない。

親征は [ADDITIONAL_SCHEMA.md](../../data/schema/ADDITIONAL_SCHEMA.md) の7節で
**「出征〜帰還または現地での終結まで」**を1回と定めている。つまり終期は
起点とは別の記事（「車駕還〜」等）から立てるべきもので、起点と同じ日付が
入っているイベントは**終期を調べていない疑い**がある。

Issue #49 の元世祖・海都イベントが実際にこの形だった（出征日 1289-07-19 が
そのまま終期に入り、一日で終わる遠征になっていた。本紀の帰還記事は閏十月戊寅）。

  親征イベント
   ├ instant     … 起点＝終期で、しかも日・月の精度。**一日／一月で終わる遠征の形**に
   │               なっている。日付が細かいほど「たまたま同じ」は起こりにくい。kind=read
   ├ same-year   … 起点＝終期で年精度。同年に始まって終わったのか、終期を
   │               調べていないのかを機械では区別できない。kind=read（広く取る側の誤りは
   │               トークンしか損しない）
   ├ no-dates    … 起点か終期が無い。kind=read
   └ spanned     … 起点と終期が別に立っている。**機械が何も見つけなかっただけ**で、
                   その終期が原典の帰還記事に基づく保証はない。kind=absent

出力:
    python3 scripts/screens/campaign_span.py            # 人が読む形
    python3 scripts/screens/campaign_span.py --json     # ゲート（check_screenings.py）用
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
EMPERORS = ROOT / "data" / "emperors.json"

FIELD = "personalCampaignCount"


def end_precision(ev):
    """終期側の精度。`datePrecision` は文字列と {start,end} の2形式がある。"""
    dp = ev.get("datePrecision")
    if isinstance(dp, dict):
        return dp.get("end")
    return dp


def run():
    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    units = {}      # "<id>#<n>" → bucket
    for e in data["emperors"]:
        v = e.get(FIELD)
        if not isinstance(v, dict):
            continue
        for i, ev in enumerate(v.get("events") or []):
            key = f"{e['id']}#{i}"
            s, t = ev.get("startDate"), ev.get("endDate")
            if not s or not t:
                units[key] = "no-dates"
            elif s != t:
                units[key] = "spanned"
            elif end_precision(ev) in ("day", "month"):
                units[key] = "instant"
            else:
                units[key] = "same-year"
    return units


def sample(keys, seed, size):
    """種つきの無作為抽出（name_fields.py と同じハッシュ順の上位 k）。

    母集団が動いても既存の標本の当落が変わらないので、訂正が進んでも
    監査をやり直さずに済む。
    """
    rank = sorted(keys, key=lambda k: hashlib.md5(f"{seed}:{k}".encode()).hexdigest())
    return sorted(rank[:size])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--sample", type=int, default=0, help="absent バケットから引く標本数")
    args = ap.parse_args()

    units = run()
    buckets = {}
    for key, b in units.items():
        buckets.setdefault(b, []).append(key)

    if args.json:
        print(json.dumps({
            "unit": "campaign-event",
            "n": len(units),
            "buckets": {k: len(v) for k, v in sorted(buckets.items())},
            "samples": {k: sample(v, args.seed, args.sample)
                        for k, v in sorted(buckets.items())
                        if k == "spanned" and args.sample},
            "coverage": {k: [b] for k, b in sorted(units.items())},
        }, ensure_ascii=False))
        return 0

    read = sum(len(v) for k, v in buckets.items() if k != "spanned")
    print(f"母集団 {len(units)}件（親征イベント） → 要読解 {read}件")
    for k, v in sorted(buckets.items()):
        print(f"  {k}: {len(v)}")
    print()
    print("instant の内訳（起点＝終期・日／月精度）:")
    for key in sorted(buckets.get("instant", [])):
        print(f"  {key}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
