#!/usr/bin/env python3
"""絞り込みの機械検査: 同じ反乱を `rebellionSufferedCount` と `rebellionSuppressionCount` の
両方へ計上したのに、両容器の日付が食い違う形。

**判定はしない。読む順序と量を変えるだけ**（規則 `R-NO-AUTOGEN`）。
ここで決まるのは「どの event を原典に当て直すか」だけで、値は1つも書かない。

起点は 2026-08-05 の紹介文（後漢6人）で、章帝の武陵溇中蛮が
`rebellionSufferedCount.e004` = 0078〜0080 ／ `rebellionSuppressionCount.e004` = 0079〜0080 と
**同一の事件に別の開始年**を持っていた。本紀は蜂起を建初三年冬十二月（太陽暦では79年初に落ちる）、
鎮圧を建初五年に置くので、片方が年号年・片方が換算値になっている疑いがある。

  `name` が一致する被反乱／鎮圧のペア
   ├ same     … `startDate`・`endDate` ともに一致
   └ differ   … どちらかが違う。**ここが要読解**

**ずれ＝欠陥ではない。** 被反乱の側が蜂起の年、鎮圧の側が朝廷が兵を出した年を採っていて、
両方とも原文どおりということが有りうる。**同じ event id の対応が保証されていない**のも同じで、
名前が同じでも別の局面を指している場合がある。原典で条を読むまでは差の意味は決まらない。

**片方にしか無い反乱は見ていない**（`name` の表記が揺れているだけの取りこぼしを含む・
規則 `R-SWEEP-DETECTION`）。取りこぼし率は**未測定**。ただし揺れのうち
「鎮圧側の名前の末尾に『鎮圧』が付いているだけ」の形は `--loose` で測れる（2026-08-06 に
18ペアが増え、うち2件が食い違った）。**それ以外の揺れ（言い換え・表記差）は依然として未測定。**

出力:
    python3 scripts/screens/rebellion_pair_dates.py            # 人が読む形
    python3 scripts/screens/rebellion_pair_dates.py --json     # 件数だけ
    python3 scripts/screens/rebellion_pair_dates.py --loose    # 接尾辞を落として突き合わせる
"""
import argparse
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "emperors.json"

SUFFERED = "rebellionSufferedCount"
SUPPRESSION = "rebellionSuppressionCount"


def _events(record, field):
    container = record.get(field) or {}
    return container.get("events") or []


def _stem(name):
    """鎮圧側の名前に付く接尾辞を落とす（`--loose` のときだけ使う）。

    2026-08-06 の紹介文（東晋5人）で、明帝の顧颺の武康挙兵が被反乱 0324 ／ 鎮圧 0325-01 と
    割れているのに既定の突き合わせに出てこなかった。鎮圧側の `name` が
    「顧颺（沈充旧部将）の武康挙兵**鎮圧**」で、被反乱側と1字違いだったため。
    上の「片方にしか無い反乱は見ていない」の取りこぼしが、実際に出た形。
    """
    return re.sub(r"(の)?(鎮圧|平定|討伐)$", "", name)


def scan(loose=False):
    emperors = json.loads(DATA.read_text(encoding="utf-8"))["emperors"]
    pairs, differ = 0, []
    for record in emperors:
        by_name = {}
        for event in _events(record, SUPPRESSION):
            name = event.get("name")
            if name:
                by_name.setdefault(name, event)
                if loose:
                    by_name.setdefault(_stem(name), event)
        for event in _events(record, SUFFERED):
            other = by_name.get(event.get("name"))
            if other is None:
                continue
            pairs += 1
            start_a, end_a = event.get("startDate"), event.get("endDate")
            start_b, end_b = other.get("startDate"), other.get("endDate")
            if start_a == start_b and end_a == end_b:
                continue
            which = []
            if start_a != start_b:
                which.append("start")
            if end_a != end_b:
                which.append("end")
            differ.append(
                {
                    "id": record["id"],
                    "name": event.get("name"),
                    "which": "+".join(which),
                    "suffered": [start_a, end_a],
                    "suppression": [start_b, end_b],
                }
            )
    return pairs, differ


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="件数だけ出す")
    parser.add_argument(
        "--loose",
        action="store_true",
        help="鎮圧側の名前の末尾「鎮圧／平定／討伐」を落として突き合わせる（既定は完全一致）",
    )
    args = parser.parse_args()

    pairs, differ = scan(loose=args.loose)
    if args.json:
        counts = {"pairs": pairs, "differ": len(differ)}
        for kind in ("start", "end", "start+end"):
            counts[kind] = sum(1 for row in differ if row["which"] == kind)
        print(json.dumps(counts, ensure_ascii=False))
        return

    print(f"名前が一致する被反乱／鎮圧のペア: {pairs}")
    print(f"日付が食い違う: {len(differ)}（要読解。ずれ＝欠陥ではない）")
    for kind in ("start", "end", "start+end"):
        n = sum(1 for row in differ if row["which"] == kind)
        print(f"  {kind:9} {n}")
    print()
    for row in differ:
        print(
            f"  {row['id']:24} {row['which']:9} "
            f"被反乱 {row['suffered'][0]}〜{row['suffered'][1]} ／ "
            f"鎮圧 {row['suppression'][0]}〜{row['suppression'][1]}  {row['name']}"
        )


if __name__ == "__main__":
    main()
