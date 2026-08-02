#!/usr/bin/env python3
"""回数系フィールドの events を1人ぶん、**既存 note を外して**抜き出す。

日付・結末の訂正（Issue #49・#50・#56 の系統）で調査エージェントへ渡す素材はこれ。
約7MBの `data/emperors.json` を会話へ読み込むかわりに、対象の構造フィールドだけを出す
（CLAUDE.md の「コンテキスト効率」）。

**note は既定で出さない**（規則 R-CLAIMS-FIRST）。1段目が note を読むと、note の筋書きに
合う原文句を探すことになり、note の誤りがそのまま成果物へ流れます。2026-08-03 の Issue #56
では、親セッションがその場で書いた `python3 -c` のワンライナーが `note` を print していて、
規約が入口で破れていました（調査エージェント4体が同じ指摘を出した）。**プロンプトに抽出式を
書き起こさず、このコマンドを渡してください。** note との突き合わせは検証段の仕事です。

**データを書き換えません。** 転記は `scripts/patch_emperor.py` を通します。

使い方:
    python3 scripts/extract_event_material.py <皇帝id>
    python3 scripts/extract_event_material.py <皇帝id> --field personalCampaignCount
    python3 scripts/extract_event_material.py <皇帝id> --field personalCampaignCount --index 0 3
    python3 scripts/extract_event_material.py <皇帝id> --json          # 機械で読む形
    python3 scripts/extract_event_material.py <皇帝id> --notes on      # 検証段だけ
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EMPERORS = ROOT / "data" / "emperors.json"

# 回数系8項目。events の形は「単一日付」型と「期間」型の2系統ある
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
LABEL = dict(COUNT_FIELDS)

# events から出す欄。note は既定で落とす（--notes on のときだけ足す）
EVENT_KEYS = ("date", "startDate", "endDate", "datePrecision",
              "dateRaw", "startDateRaw", "endDateRaw",
              "target", "outcome", "name", "leader", "from", "to")

BANNER_OFF = (
    "> **この素材に既存 note は載せていません**（フィールドの note も events の note も）。\n"
    "> 残っているのは構造フィールドだけです。原文は `_corpus_cache/<id>.txt` と\n"
    "> `scripts/quote_helper.py <id> <検索語>` から直接読んでください。\n"
    "> note との突き合わせは検証段の仕事です（規則 R-CLAIMS-FIRST）。\n"
)
BANNER_ON = (
    "> **既存 note を載せています（`--notes on`）。** これは検証段の素材です。\n"
    "> note は作業ログで、訂正の経緯として**捨てた側の値**が残るため、フィールドとの\n"
    "> 突合は向きが反転します。前向きの主張は `claim` を見てください。\n"
)


def load(eid):
    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    for e in data["emperors"]:
        if e["id"] == eid:
            return e
    print(f"存在しない皇帝id: {eid}", file=sys.stderr)
    sys.exit(1)


def slim(ev, notes):
    out = {k: ev[k] for k in EVENT_KEYS if k in ev and ev[k] is not None}
    if notes and ev.get("note"):
        out["note"] = ev["note"]
    if isinstance(ev.get("source"), dict):
        out["source"] = ev["source"]
    # 想定外の欄を黙って落とさない（スキーマが増えたときに気づけるように）
    extra = sorted(set(ev) - set(EVENT_KEYS) - {"note", "source"})
    if extra:
        out["（この抽出が知らない欄）"] = extra
    return out


def collect(e, fields, indexes, notes):
    out = []
    for f in fields:
        v = e.get(f)
        if not isinstance(v, dict):
            continue
        events = v.get("events") or []
        picked = [(i, ev) for i, ev in enumerate(events)
                  if indexes is None or i in indexes]
        rec = {
            "field": f,
            "label": LABEL[f],
            "count": v.get("count"),
            "eventsTotal": len(events),
            "confidence": v.get("confidence"),
            "claim": v.get("claim"),
            "events": {f"{e['id']}#{i}": slim(ev, notes) for i, ev in picked},
        }
        if notes and v.get("note"):
            rec["note"] = v["note"]
        out.append(rec)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("emperor_id")
    ap.add_argument("--field", action="append", metavar="フィールド名",
                    help=f"対象フィールド（既定は全8項目）: {'・'.join(k for k, _ in COUNT_FIELDS)}")
    ap.add_argument("--index", nargs="+", type=int, metavar="N",
                    help="events の添字で絞る（--field を1つに絞ったときだけ意味がある）")
    ap.add_argument("--notes", choices=("on", "off"), default="off",
                    help="既存 note を載せるか。**検証段だけ on**（規則 R-CLAIMS-FIRST）")
    ap.add_argument("--json", action="store_true", help="JSON で出す")
    args = ap.parse_args()

    fields = args.field or [k for k, _ in COUNT_FIELDS]
    unknown = [f for f in fields if f not in LABEL]
    if unknown:
        ap.error(f"知らないフィールド: {'・'.join(unknown)}"
                 f"（{'・'.join(k for k, _ in COUNT_FIELDS)}）")
    notes = args.notes == "on"
    e = load(args.emperor_id)
    recs = collect(e, fields, set(args.index) if args.index else None, notes)

    if args.json:
        print(json.dumps({"id": e["id"], "notes": notes, "fields": recs},
                         ensure_ascii=False, indent=1))
        return 0

    print(f"# {e['id']}（{e['name'].get('commonName')}）の回数系イベント素材\n")
    print(BANNER_ON if notes else BANNER_OFF)
    for rec in recs:
        print(f"\n## {rec['label']}（{rec['field']}）"
              f" count={rec['count']} / events={rec['eventsTotal']}"
              f" / confidence={rec['confidence']}")
        if rec.get("claim"):
            print(f"claim: {rec['claim']}")
        if rec.get("note"):
            print(f"note: {rec['note']}")
        if not rec["events"]:
            print("（該当する events はありません）")
        for key, ev in rec["events"].items():
            print(f"- {key}: {json.dumps(ev, ensure_ascii=False)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
