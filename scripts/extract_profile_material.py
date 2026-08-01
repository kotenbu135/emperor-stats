#!/usr/bin/env python3
"""紹介文（GitHub Issue #16）を書くための素材を1人ぶんずつ抜き出す。

紹介文は**既存の調査結果の範囲内だけ**で書く決まり（SITE_DESIGN.md の8節）なので、
執筆に必要なのは data/emperors.json の一部フィールドだけ。約7MBの本体を会話へ読み込む
かわりに、ここで人が読める形へ落とす（CLAUDE.md の「コンテキスト効率」）。

**データを書き換えないし、紹介文を生成もしない。** 出すのは既存フィールドの引き写しで、
文章を書くのは人（一人ずつ作成する — Issue #16）。

使い方:
    python3 scripts/extract_profile_material.py qin-shi-huang qin-er-shi
    python3 scripts/extract_profile_material.py --section '秦（始皇帝以降）'
    python3 scripts/extract_profile_material.py --list-sections
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EMPERORS = ROOT / "data" / "emperors.json"

# 回数系8項目。count と note を並べる（0回の note に「なぜ0か」が書いてあることが多く、
# 紹介文の素材として count そのものより効く）。
COUNT_FIELDS = [
    ("eraChangeCount", "改元"),
    ("amnestyCount", "大赦"),
    ("empressInstallationCount", "立后"),
    ("crownPrinceDepositionCount", "皇太子の廃立"),
    ("personalCampaignCount", "親征"),
    ("rebellionSuppressionCount", "反乱鎮圧"),
    ("rebellionSufferedCount", "被反乱"),
    ("capitalRelocationCount", "遷都"),
]


def render(e: dict, catalogs: dict, max_events: int) -> str:
    name = e["name"]
    display = (
        name.get("commonName")
        or name.get("personalName")
        or name.get("templeName")
        or name.get("posthumousName")
    )
    regime = catalogs["regimes"].get(e.get("regimeId"), e.get("regimeId"))
    out: list[str] = []
    add = out.append

    add(f"## {display}（{e['id']}）")
    add("")
    add(f"- 政権: {regime}／区分: {e.get('researchSection')}")
    add(
        "- 名: 諱 {personalName}／通用名 {commonName}／廟号 {templeName}／諡号 {posthumousName}".format(
            personalName=name.get("personalName") or "—",
            commonName=name.get("commonName") or "—",
            templeName=name.get("templeName") or "—",
            posthumousName=name.get("posthumousName") or "—",
        )
    )
    if name.get("aliases"):
        add(f"- 別名: {'・'.join(name['aliases'])}")
    if e.get("flags", {}).get("isFemale"):
        add("- **女性**")

    summary = e.get("reignSummary", {}).get("totalReignDuration", {})
    add(
        f"- 在位: {e['reignSummary'].get('firstStartYear')}〜"
        f"{e['reignSummary'].get('lastEndYear')}年"
        f"／通算 約{summary.get('approxDays')}日（{summary.get('displayYears')}年）"
        f"／{e['reignSummary'].get('reignCount')}期"
        + ("／**日数は概算**" if summary.get("needsPreciseDays") else "")
    )
    for i, r in enumerate(e.get("reigns", []), 1):
        line = f"  - 第{i}期 {r.get('raw')}（{r.get('durationRaw')}）"
        if r.get("isRestoration"):
            line += "【復位】"
        add(line)
        if r.get("note"):
            add(f"    - note: {r['note']}")
        src = (r.get("duration") or {}).get("source") if isinstance(r.get("duration"), dict) else None
        if src:
            add(f"    - 典拠: {src}")

    ages = e.get("ages") or {}
    add(
        f"- 年齢: 即位 {ages.get('accessionAge')}／没 {ages.get('deathAge')}"
        f"（生 {ages.get('birthDate')}／没 {ages.get('deathDate')}・数え年）"
    )
    if ages.get("note"):
        add(f"  - note: {ages['note']}")

    acc = e.get("accessionRoute") or {}
    axes = acc.get("axes") or {}
    add(f"- 即位経路: {acc.get('categoryId')}")
    add(
        "  - 軸: 皇位の出所 {throneSource}／称号の由来 {titleOrigin}／決定者 {decidedBy}"
        "／前任者の末路 {predecessorFate}／前任者との関係 {relationToPredecessor}"
        "／手続き {procedure}".format(
            throneSource=axes.get("throneSource"),
            titleOrigin=axes.get("titleOrigin"),
            decidedBy="・".join(axes.get("decidedBy") or []),
            predecessorFate=axes.get("predecessorFate"),
            relationToPredecessor=axes.get("relationToPredecessor"),
            procedure=axes.get("procedure"),
        )
    )
    if acc.get("note"):
        add(f"  - note: {acc['note']}")

    death = e.get("deathCause") or {}
    add(f"- 死因: {death.get('category')}")
    if death.get("note"):
        add(f"  - note: {death['note']}")

    add("- 回数8項目:")
    for key, label in COUNT_FIELDS:
        f = e.get(key) or {}
        add(f"  - {label}: {f.get('count')}回")
        if f.get("note"):
            add(f"    - note: {f['note']}")
        events = f.get("events") or []
        if events:
            add(f"    - events {len(events)}件（先頭{min(len(events), max_events)}件）:")
            for ev in events[:max_events]:
                # events はキーが項目ごとに違う（name/leader/outcome、eraName/newEra、
                # target、from/to…）ので、日付以外は素直に全部並べる。
                date = ev.get("startDate") or ev.get("date") or ev.get("dateRaw") or "日付不明"
                rest = "／".join(
                    f"{k}: {v}"
                    for k, v in ev.items()
                    if k not in {"startDate", "endDate", "date", "datePrecision"} and v
                )
                add(f"      - {date} {rest}")

    v = e.get("verification") or {}
    if v.get("notes"):
        add(f"- 収録メモ: {v['notes']}")
    add("")
    return "\n".join(out)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("ids", nargs="*", help="皇帝id")
    p.add_argument("--section", help="researchSection でまとめて出す")
    p.add_argument("--list-sections", action="store_true")
    p.add_argument("--max-events", type=int, default=8, help="1項目あたりに出す events 件数")
    args = p.parse_args()

    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    catalogs = {
        "regimes": {r["id"]: r["label"] for r in data["meta"]["catalogs"]["regimes"]},
    }

    if args.list_sections:
        seen: dict[str, int] = {}
        for e in data["emperors"]:
            seen[e.get("researchSection")] = seen.get(e.get("researchSection"), 0) + 1
        for name, n in seen.items():
            print(f"{n:4d}  {name}")
        return 0

    if args.section:
        targets = [e for e in data["emperors"] if e.get("researchSection") == args.section]
    else:
        by_id = {e["id"]: e for e in data["emperors"]}
        targets = []
        for i in args.ids:
            if i not in by_id:
                print(f"存在しない皇帝id: {i}", file=sys.stderr)
                return 1
            targets.append(by_id[i])

    if not targets:
        print("対象が0件です（--list-sections で区分名を確認）", file=sys.stderr)
        return 1

    for e in targets:
        print(render(e, catalogs, args.max_events))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
