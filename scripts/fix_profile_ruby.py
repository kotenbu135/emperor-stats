#!/usr/bin/env python3
"""配布済みの紹介文に振ってあるルビの**読みを直す**（GitHub Issue #16）。

`reapply_profile_ruby.py` は断片にしか掛からず、`data/emperor-profiles.json` へ
入ったあとの読みを直す道具が無かった。そのため訂正のたびに使い捨ての置換
スクリプトを書くことになり、2026-08-06 には途中で `git checkout` を打った拍子に
訂正が丸ごと消え、**ゲートは緑のまま**という一歩手前まで行っている（差分の行数で
気づいた）。**件数を宣言させて、合わなければ書かずに落ちる**のがこの道具の要点。

使い方:
    # 全本から「元和」の読みを直す（何件当たるかを先に見る）
    python3 scripts/fix_profile_ruby.py --from '｜元和《げんな》' --to '｜元和《げんわ》' --dry-run
    # 件数を宣言して書く（合わなければ何も書かずに落ちる）
    python3 scripts/fix_profile_ruby.py --from '…' --to '…' --expect 3 --write
    # 1人だけに掛ける
    python3 scripts/fix_profile_ruby.py --for wu-dadi --from '…' --to '…' --expect 2 --write

**辞書（data/profile-ruby-lexicon.json）は直さない。** 辞書に載る語の読みを変えた
ときは、辞書と本文の両方を直す必要がある（`COUPLINGS.md`「辞書の読みを直す」の行）。
このツールは本文側だけを受け持ち、終わったら `validate_readings.py` の検査7・8 が
両者の食い違いを見る。
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROFILES = ROOT / "data" / "emperor-profiles.json"
RUBY = re.compile(r"｜([^｜《》]+)《([^｜《》]+)》")
FIELDS = ("lead", "body")


def main() -> int:
    ap = argparse.ArgumentParser(description="配布済み紹介文のルビの読みを直す")
    ap.add_argument("--from", dest="src", required=True, help="いまの形（｜親文字《読み》）")
    ap.add_argument("--to", dest="dst", required=True, help="直したあとの形")
    ap.add_argument("--for", dest="only", help="この皇帝 id だけに掛ける")
    ap.add_argument("--expect", type=int, help="置換される件数。合わなければ書かない")
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not (args.write or args.dry_run):
        ap.error("--write か --dry-run のどちらかを付ける")

    for label, value in (("--from", args.src), ("--to", args.dst)):
        if not RUBY.fullmatch(value):
            ap.error(f"{label} はルビ1つの形で書く（例 ｜元和《げんわ》）: {value}")
    if RUBY.match(args.src).group(1) != RUBY.match(args.dst).group(1):
        ap.error("親文字が違います。このツールが直すのは**読みだけ**です")

    doc = json.loads(PROFILES.read_text(encoding="utf-8"))
    profiles = doc["profiles"]
    if args.only and args.only not in profiles:
        ap.error(f"{args.only} の紹介文がありません")

    hits: dict[str, int] = {}
    for emperor_id, profile in profiles.items():
        if args.only and emperor_id != args.only:
            continue
        for field in FIELDS:
            text = profile.get(field)
            if not text or args.src not in text:
                continue
            n = text.count(args.src)
            hits[f"{emperor_id}/{field}"] = n
            profile[field] = text.replace(args.src, args.dst)

    total = sum(hits.values())
    for where, n in sorted(hits.items()):
        print(f"  {where}: {n}件")
    print(f"合計 {total}件（{len(hits)}欄）")

    if total == 0:
        raise SystemExit("1件も当たりません。--from の形を本文から copy して確かめる")
    if args.expect is not None and args.expect != total:
        raise SystemExit(
            f"件数が宣言と違います（宣言 {args.expect} / 実際 {total}）。"
            "書いていません。**数え直してから宣言する** — この宣言が、"
            "置換が途中で消えたことに気づく唯一の証人です"
        )
    if not args.write:
        print("（--dry-run なので書いていない）")
        return 0
    if args.expect is None:
        raise SystemExit("--write には --expect を付ける（件数の宣言が要る）")

    PROFILES.write_text(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"{PROFILES} を更新した。次に流す: python3 scripts/validate_readings.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
