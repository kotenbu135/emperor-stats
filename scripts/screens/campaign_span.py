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
sys.path.insert(0, str(ROOT / "scripts"))

from event_date_scope import load_archive, recorded_dates  # noqa: E402

EMPERORS = ROOT / "data" / "emperors.json"

FIELD = "personalCampaignCount"


def end_precision(ev):
    """終期側の精度。`datePrecision` は文字列と {start,end} の2形式がある。"""
    dp = ev.get("datePrecision")
    if isinstance(dp, dict):
        return dp.get("end")
    return dp


def run():
    """戻り値は (ユニット→バケット, ユニット→移行前の位置文字列)。

    ユニットの鍵は `events[].id`（`R-CLAIM-GATED` の移行で焼いた安定 id）。
    移行前は `<皇帝id>#<添字>` で、添字は event を1件挿入すると全部ずれた。

    **見るのは「記録された日付」で、配布物が主張する日付ではない**（Issue #69）。
    主張範囲を絞る移行で非境界年の月日は年へ丸まり、そのままだと起点と終期が同じ
    `"1211"` に潰れて **spanned が instant に化ける**（196 → 97 件に見えた）。
    「終期を別の記事から立てたか」という問いは記録に対するものなので、
    退避した値（data/internal/event-date-archive.json）を戻してから分類する。
    """
    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    archive = load_archive()
    units, legacy = {}, {}
    for e in data["emperors"]:
        v = e.get(FIELD)
        if not isinstance(v, dict):
            continue
        for i, ev in enumerate(v.get("events") or []):
            key = ev.get("id")
            if not key:
                sys.exit(f"{e['id']}.{FIELD}[{i}] に id がありません"
                         f"（python3 scripts/migrations/bake_event_ids.py --fill）")
            legacy[key] = f"{e['id']}#{i}"
            dates = recorded_dates(ev, archive)
            s, t = dates.get("startDate"), dates.get("endDate")
            if not s or not t:
                units[key] = "no-dates"
            elif s != t:
                units[key] = "spanned"
            elif end_precision(ev) in ("day", "month"):
                units[key] = "instant"
            else:
                units[key] = "same-year"
    return units, legacy


def sample(keys, seed, size, rank_key=None):
    """種つきの無作為抽出（name_fields.py と同じハッシュ順の上位 k）。

    母集団が動いても既存の標本の当落が変わらないので、訂正が進んでも
    監査をやり直さずに済む。**ただし鍵の文字列そのものを変えると引き直しになる**ので、
    2026-08-03 の id 移行より前に引いた標本は `rank_key` に移行前の位置文字列を渡して
    抽選を凍結する（data/screenings.json の `audit.sampleKey: "legacy-index"`）。
    """
    kf = rank_key or (lambda k: k)
    rank = sorted(keys, key=lambda k: hashlib.md5(f"{seed}:{kf(k)}".encode()).hexdigest())
    return sorted(rank[:size])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--sample", type=int, default=0, help="absent バケットから引く標本数")
    ap.add_argument("--sample-key", choices=("event-id", "legacy-index"), default="event-id",
                    help="抽選の鍵。移行前に引いた標本を再現するときだけ legacy-index")
    args = ap.parse_args()

    units, legacy = run()
    buckets = {}
    for key, b in units.items():
        buckets.setdefault(b, []).append(key)
    rank_key = legacy.get if args.sample_key == "legacy-index" else None

    if args.json:
        print(json.dumps({
            "unit": "campaign-event",
            "n": len(units),
            "buckets": {k: len(v) for k, v in sorted(buckets.items())},
            "samples": {k: sample(v, args.seed, args.sample, rank_key)
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
