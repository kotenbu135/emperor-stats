#!/usr/bin/env python3
"""紹介文が諱1字で人物を指している箇所を、通用名へ置き換える（GitHub Issue #16）。

2026-08-07 のユーザー指摘（「人物名は諱固定ではなく現代での通用名にする」）を
既存の本へ当てるための道具。**新しく書く本には要らない** — 執筆段は
`scripts/profile_name.py` が出す名前をそのまま使い、`check_profile_fragment.py` が
落とす。

置き換えるのは `profile_name.bare_spans` が拾う箇所だけで、**どこを直したかは
機械が決め、何に直すかは `profile_name.resolve` が決める**。読みは
`data/name-readings.json` の記法をそのまま入れるので、ルビは同時に付く。

`fix_profile_ruby.py` と同じく **`--expect` の宣言**を持つ。宣言が合わなければ
書かずに落ちる（置換が途中で消えたことに気づく唯一の証人）。

使い方:
    python3 scripts/fix_profile_bare_name.py --dry-run
    python3 scripts/fix_profile_bare_name.py --for houyan-murongchui --dry-run
    python3 scripts/fix_profile_bare_name.py --expect 924 --write
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import profile_name  # noqa: E402
import profile_prose  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PROFILES = ROOT / "data" / "emperor-profiles.json"
RUBY = profile_prose.RUBY


def tokenize(text: str) -> list[tuple[str, str]]:
    """本文を [(ルビを剥がした形, 元の形), ...] へ割る。ルビ注釈は1トークン。"""
    parts: list[tuple[str, str]] = []
    pos = 0
    for m in RUBY.finditer(text):
        if m.start() > pos:
            chunk = text[pos:m.start()]
            parts.append((chunk, chunk))
        parts.append((m.group(1), m.group(0)))
        pos = m.end()
    if pos < len(text):
        parts.append((text[pos:], text[pos:]))
    return parts


def rewrite(text: str, emperor: dict, resolved: dict) -> tuple[str, int, list[str]]:
    """→ (直した本文, 置換件数, 見送った箇所)

    諱の出現が**1トークンに収まっている**ときだけ置き換える。ルビ注釈をまたぐ形
    （姓と諱を別々のルビにしている「｜孫《そん》｜晧《こう》」）は姓が付いている
    ＝そもそも拾われないので、またぐ箇所が出たら**直さずに報告する**。
    """
    parts = tokenize(text)
    stripped = "".join(p for p, _ in parts)
    spans = profile_name.bare_spans(stripped, emperor, resolved)
    if not spans:
        return text, 0, []

    # 各トークンの、剥がしたあとの座標での範囲
    bounds: list[tuple[int, int]] = []
    at = 0
    for plain, _ in parts:
        bounds.append((at, at + len(plain)))
        at += len(plain)

    replacement = resolved["annotated"]
    edits: dict[int, list[tuple[int, int]]] = {}
    skipped: list[str] = []
    for lo, hi in spans:
        owner = next((i for i, (a, b) in enumerate(bounds) if a <= lo and hi <= b), None)
        if owner is None:
            skipped.append(stripped[max(0, lo - 8):hi + 8])
            continue
        edits.setdefault(owner, []).append((lo - bounds[owner][0], hi - bounds[owner][0]))

    out: list[str] = []
    count = 0
    for i, (plain, original) in enumerate(parts):
        if i not in edits:
            out.append(original)
            continue
        if plain != original:
            # ルビ注釈そのものが諱1字だった（「｜勒《ろく》は」）。注釈ごと置き換える。
            out.append(replacement)
            count += 1
            continue
        buf = plain
        for lo, hi in sorted(edits[i], reverse=True):
            buf = buf[:lo] + replacement + buf[hi:]
            count += 1
        out.append(buf)
    return "".join(out), count, skipped


def main() -> int:
    ap = argparse.ArgumentParser(description="諱1字の呼び方を通用名へ直す")
    ap.add_argument("--for", dest="only", help="皇帝id 1人だけ")
    ap.add_argument("--path", default=str(PROFILES), help="断片 JSON を直すとき")
    ap.add_argument("--expect", type=int, help="置換件数の宣言（合わなければ書かない）")
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not (args.write or args.dry_run):
        ap.error("--write か --dry-run のどちらかを付ける")

    emperors = profile_name.load_emperors()
    readings = profile_name.load_readings()
    path = Path(args.path)
    doc = json.loads(path.read_text(encoding="utf-8"))
    profiles = doc["profiles"] if "profiles" in doc else doc

    total = 0
    books = 0
    skipped_all: list[str] = []
    for emperor_id, profile in profiles.items():
        if args.only and emperor_id != args.only:
            continue
        emperor = emperors.get(emperor_id)
        if not emperor:
            continue
        resolved = profile_name.resolve(emperor, readings)
        touched = 0
        for field in ("lead", "body"):
            text = profile.get(field)
            if not text:
                continue
            new, n, skipped = rewrite(text, emperor, resolved)
            skipped_all += skipped
            if n:
                profile[field] = new
                touched += n
        if touched:
            books += 1
            total += touched
            print(f"{emperor_id}: {touched}件 → {resolved['plain']}")

    print(f"\n{books}本 / 延べ{total}件")
    if skipped_all:
        print(f"見送り {len(skipped_all)}件（ルビ注釈をまたぐ）: {skipped_all[:5]}")
    if args.expect is not None and args.expect != total:
        print(f"\n宣言 {args.expect} 件と実際 {total} 件が合わない。書かずに終わる。")
        return 1
    if args.write and total:
        path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{path} を更新した")
    elif args.dry_run:
        print("（--dry-run なので書いていない）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
