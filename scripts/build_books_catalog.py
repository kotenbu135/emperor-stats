#!/usr/bin/env python3
"""`meta.catalogs.books` をローカルコーパスの実体から作る（Issue #69・計画7節の4）。

**書名を手で列挙しない。** `verify_quotes.build_book_index()` が実ファイル名から作る索引を
そのまま鍵にする（同スクリプトの docstring:「書名を手で列挙すると、辞書に無い書を
『別の書を名乗っている』と誤読する。実体のファイル名だけを根拠にする」）。

`id` はコーパス索引の鍵（正規化済みの簡体書名）そのもの。ローマ字 slug を人が振ると、
slug → 書 の対応表が手作りのデータになり、間違えると**別の書の巻を読みに行く**
（#53 と同じ形）。id ＝ 索引の鍵にしておけば、その照合は恒等式になって壊れようがない。

巻の引き方そのものは `scripts/book_volumes.py` の1実装で、照合する側
（`verify_quotes.py --check-volumes`）も同じものを使う。**どちらの索引も無い書は
`volumeIndex: null` で、その書に `volume` を書くことを禁じる**
（巻を主張しても機械で確かめられないため。#69 の「検査できない主張を置かない」）。

使い方:
    python3 scripts/build_books_catalog.py --dry-run
    python3 scripts/build_books_catalog.py --write
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import book_volumes as BV  # noqa: E402
import verify_quotes as VQ  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data/emperors.json"
CORPUS = VQ.CORPUS_ROOT


def claimed_book_names(data, book_re):
    """データ全域の文字列が名乗る書名（正規化済み）。"""
    out = set()

    def walk(o):
        if isinstance(o, dict):
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for x in o:
                walk(x)
        elif isinstance(o, str) and len(o) > 2:
            out.update(VQ.claimed_books(o, book_re))
    walk(data["emperors"])
    return out


def build(data):
    index = VQ.build_book_index()
    book_re = re.compile("|".join(sorted((re.escape(b) for b in index),
                                         key=len, reverse=True)))
    names = claimed_book_names(data, book_re)
    books = []
    for name in sorted(names):
        books.append(BV.entry_for(CORPUS, name, VQ.book_files(name, index)))
    return books


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not (args.write or args.dry_run):
        ap.error("--write か --dry-run を付ける")

    raw = DATA.read_bytes()
    before = hashlib.sha256(raw).hexdigest()
    data = json.loads(raw)
    books = build(data)

    indexed = [b for b in books if b["volumeIndex"]]
    print(f"名乗られる書 {len(books)} 件 / 巻の索引が引ける {len(indexed)} 件")
    for b in books:
        if not b["volumeIndex"]:
            print(f"！{b['id']:<12} 巻の索引なし（volume を書けない）")
        else:
            print(f"  {b['id']:<12} {b['volumeIndex']:<20} 範囲 {b['volumeScope']:<6}"
                  f" 収録 {b['corpusVolumeCount']:>4}巻（最大 {b['corpusVolumeMax']}）")
    if args.dry_run:
        return 0

    if hashlib.sha256(DATA.read_bytes()).hexdigest() != before:
        print("ERROR: 読み込み後に data/emperors.json が変わった。やり直す", file=sys.stderr)
        return 1
    data["meta"]["catalogs"]["books"] = books
    tmp = DATA.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    os.replace(tmp, DATA)
    print(f"書いた: meta.catalogs.books {len(books)} 件")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
