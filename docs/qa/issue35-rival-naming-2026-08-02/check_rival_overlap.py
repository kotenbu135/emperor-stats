#!/usr/bin/env python3
"""standing: rival の20人について、同じ政権の regular な皇帝と在位期間が重なるかを照合する。

Issue #35 の対応案2「rival の判定基準は帝紀の有無ではなく在位が並立か逐次か」を検証するための
機械照合で、判定は伴わない（reigns[].startDate/endDate を突き合わせるだけ）。
結果は FINDINGS.md の2節。
"""

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[3]
EMPERORS = json.loads((ROOT / "data" / "emperors.json").read_text(encoding="utf-8"))["emperors"]


def spans(e):
    """在位期間を (開始, 終了) の ISO 文字列で返す。日付が無い期は年で丸める。"""
    out = []
    for r in e.get("reigns", []):
        start = r.get("startDate") or (f"{r['startYear']:04d}-01-01" if r.get("startYear") else None)
        end = r.get("endDate") or (f"{r['endYear']:04d}-12-31" if r.get("endYear") else None)
        if start and end:
            out.append((start, end))
    return out


def main():
    rivals = [e for e in EMPERORS if e.get("standing") == "rival"]
    print(f"standing: rival は {len(rivals)}人\n")
    sequential = []
    for e in rivals:
        mine = spans(e)
        peers = [
            p
            for p in EMPERORS
            if p["regimeId"] == e["regimeId"] and p["id"] != e["id"] and p.get("standing") == "regular"
        ]
        overlap = {
            p["name"]["commonName"]
            for p in peers
            for (s1, t1) in mine
            for (s2, t2) in spans(p)
            if s1 <= t2 and s2 <= t1
        }
        mark = "並立" if overlap else "★逐次"
        if not overlap:
            sequential.append(e["id"])
        span = f"{mine[0][0]}→{mine[-1][1]}" if mine else "?"
        print(f"{mark}  {e['id']:34s} {e['name']['commonName']:22s} {span}  {'/'.join(sorted(overlap))}")
    print(f"\n並立 {len(rivals) - len(sequential)}人 / 逐次 {len(sequential)}人: {', '.join(sequential)}")


if __name__ == "__main__":
    main()
