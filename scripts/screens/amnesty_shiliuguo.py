#!/usr/bin/env python3
"""十六国系の政権で、原文キャッシュに在る赦の記事と `amnestyCount` の件数を突き合わせる。

Issue #98（2026-08-07 ユーザー決定）で「大赦したという行為」で数えることになり、
定型句（大赦／赦其境内／大赦境内殊死已下／赦境内死罪）の違いで計上を割らなくなった。
その決定より前に数えた十六国系のレコードは、語で切っていた可能性がある。

**この絞り込みが決めるのは読む順序だけ**（規則 R-SCREEN-FIRST）。
原文の赦の記事が何件あるかを数えるだけで、そのうち何件が計上対象か（在位中か・
版図全体か）は判定しない。判定は原典を読む人がする。

バケット:
  over    — 原文の候補が count より多い（読めば増える可能性がある側）
  match   — 候補と count が同数
  under   — 候補より count が多い（載記の外の書で数えている・1条を分けている）
  nocache — 原文キャッシュが無い

使い方:
    python3 scripts/screens/amnesty_shiliuguo.py [--json]
"""
from __future__ import annotations

import argparse
import json
import random
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

SECTIONS = {"後趙", "後燕", "前趙", "成漢", "前秦", "西燕", "夏", "後秦", "前燕", "南燕", "前涼"}

# 版図全体を対象にした赦の形。**罪の重さの線が重い側から引かれているもの**だけを拾う
# （殊死已下＝死罪を除く全部・死罪＝最も重い罪まで。ADDITIONAL_SCHEMA 3節）。
WIDE = re.compile(
    r"(?:大赦(?:天下|境内|其境内|殊死已下|殊死巳下)?"
    r"|赦(?:天下|其境内|于境内|境内)(?:殊死[已巳]下|死罪)?"
    r"|赦殊死[已巳]下"
    r"|太赦境内)"
)
# 範囲そのものが狭い形。WIDE に当たっても、この語が直前に付いていれば落とす
NARROW_PREFIX = re.compile(r"(?:曲赦|特赦)")
# 軽い罪だけを赦す形（刑期の軽い側から線を引く）
LIGHT = re.compile(r"赦[一二三四五六七八九十]歲刑|赦[一二三四五六七八九十]岁刑")


def candidates(text: str) -> list[str]:
    out = []
    for m in WIDE.finditer(text):
        s, e = m.start(), m.end()
        lead = text[max(0, s - 2):s]
        if NARROW_PREFIX.search(lead):
            continue
        out.append(text[max(0, s - 12):e + 12])
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--seed", type=int)
    ap.add_argument("--sample", type=int)
    ap.add_argument("--sample-key", default="id")
    args = ap.parse_args()

    data = json.loads((ROOT / "data" / "emperors.json").read_text(encoding="utf-8"))
    buckets: dict[str, list[str]] = {"over": [], "match": [], "under": [], "nocache": []}
    rows = []
    for e in data["emperors"]:
        if e.get("researchSection") not in SECTIONS:
            continue
        count = (e.get("amnestyCount") or {}).get("count")
        p = ROOT / "_corpus_cache" / f"{e['id']}.txt"
        if not p.exists():
            buckets["nocache"].append(e["id"])
            rows.append((e["id"], count, None, "nocache"))
            continue
        cands = candidates(p.read_text(encoding="utf-8"))
        light = len(LIGHT.findall(p.read_text(encoding="utf-8")))
        b = "match" if len(cands) == count else ("over" if len(cands) > count else "under")
        buckets[b].append(e["id"])
        rows.append((e["id"], count, len(cands), b, light, cands))

    if args.json:
        out = {"n": len(rows), "buckets": {k: len(v) for k, v in buckets.items()}}
        if args.seed is not None and args.sample:
            rnd = random.Random(args.seed)
            out["samples"] = {k: sorted(rnd.sample(v, min(args.sample, len(v))))
                              for k, v in buckets.items()}
        print(json.dumps(out, ensure_ascii=False))
        return 0

    print(f"母集団 {len(rows)}人（十六国系の政権）")
    for k, v in buckets.items():
        print(f"  {k}: {len(v)}人")
    print()
    for r in sorted(rows, key=lambda x: (x[3], x[0])):
        if r[3] == "nocache":
            print(f"{r[3]:8s} {r[0]:26s} count={r[1]} キャッシュ無し")
            continue
        print(f"{r[3]:8s} {r[0]:26s} count={r[1]} 候補={r[2]} 軽い赦={r[4]}")
        for c in r[5]:
            print(f"           {c}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
