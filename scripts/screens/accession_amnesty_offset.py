#!/usr/bin/env python3
"""絞り込みの機械検査: 即位当日とされる大赦が在位開始日とずれている形（Issue #58）。

**判定はしない。読む順序と量を変えるだけ**（規則 `R-NO-AUTOGEN`）。
ここで決まるのは「どの event を原典に当て直すか」だけで、値は1つも書かない。

Issue #58 の唐太宗は、`reigns[0].startDate` が旧唐書の八月癸亥（626-09-03）なのに
`amnestyCount.events[0].date` は八月甲子（626-09-04）で、**即位の翌日に即位大赦をした**という
どの史料も書いていない状態になっていた。原因は日付そのものより「新唐書の読み（癸亥＝伝位の詔・
甲子＝即位）と旧唐書の読み（癸亥に一括）が混ざったまま、どちらを採ったかが書かれていないこと」で、
2026-08-03 に旧唐書側へ揃えて `conflicts` に対立を残した。

この絞り込みが見るのは**同じ形が他にもあるか**だけ。

  日精度の大赦 event で note に「即位」が出るもの
   ├ same-day   … `reigns[].startDate` のどれかと一致。ずれていない
   ├ off-by-N   … 最も近い `startDate` と 1〜3 日ずれる。**ここが要読解**。
   │              ただし**ずれ＝欠陥ではない**（宋代のように即位の翌日に大赦を出す条が
   │              実際に立つ書が多い）。原典で「即位と大赦が同じ条か別の条か」を読む
   └ apart      … 4日以上離れる。即位大赦ではなく別件の大赦を指している可能性が高い

**absent 側（note に「即位」が出ない大赦 event）は見ていない** — 即位大赦であることを
note の語彙から読んでいるので、語が無いだけの取りこぼしは**未測定**（規則 `R-SWEEP-DETECTION`）。

出力:
    python3 scripts/screens/accession_amnesty_offset.py            # 人が読む形
    python3 scripts/screens/accession_amnesty_offset.py --json     # 件数だけ
"""
import argparse
import datetime
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "emperors.json"

NEAR_DAYS = 3


def _as_date(value):
    if not isinstance(value, str) or len(value) != 10:
        return None
    try:
        return datetime.date(*map(int, value.split("-")))
    except ValueError:
        return None


def screen(data):
    rows = []
    for emperor in data["emperors"]:
        starts = []
        for reign in emperor.get("reigns", []):
            day = _as_date(reign.get("startDate"))
            if day is not None:
                starts.append((reign.get("startDate"), day))
        if not starts:
            continue
        container = emperor.get("amnestyCount")
        if not isinstance(container, dict):
            continue
        for event in container.get("events", []):
            day = _as_date(event.get("date"))
            if day is None:
                continue
            if "即位" not in (event.get("note") or ""):
                continue
            offsets = sorted((abs((day - s).days), raw) for raw, s in starts)
            gap, nearest = offsets[0]
            if gap == 0:
                kind = "same-day"
            elif gap <= NEAR_DAYS:
                kind = "off-by-%d" % gap
            else:
                kind = "apart"
            rows.append(
                {
                    "id": emperor["id"],
                    "eventId": event.get("id"),
                    "date": event.get("date"),
                    "startDate": nearest,
                    "gapDays": gap,
                    "kind": kind,
                }
            )
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="件数だけを JSON で出す")
    args = parser.parse_args()

    rows = screen(json.loads(DATA.read_text(encoding="utf-8")))
    buckets = {}
    for row in rows:
        buckets.setdefault(row["kind"], []).append(row)

    if args.json:
        print(json.dumps({k: len(v) for k, v in sorted(buckets.items())}, ensure_ascii=False))
        return

    print("母集団（日精度・note に「即位」が出る大赦 event）: %d" % len(rows))
    for kind in sorted(buckets):
        print("  %-10s %d" % (kind, len(buckets[kind])))
    print()
    print("要読解（1〜%d 日のずれ）:" % NEAR_DAYS)
    for row in rows:
        if row["kind"].startswith("off-by-"):
            print(
                "  %-24s %s  大赦 %s / 在位開始 %s（%d日）"
                % (row["id"], row["eventId"], row["date"], row["startDate"], row["gapDays"])
            )


if __name__ == "__main__":
    main()
