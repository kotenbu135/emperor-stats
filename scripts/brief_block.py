#!/usr/bin/env python3
"""着手前ブリーフィング — その書・そのブロックに固有の罠だけを出す。

「CORPUS_NOTES.md を読んでから着手する」は規則にしてあるのに読まずに始めて手戻りした事故が
複数回ある。読ませたいのは全文ではなく**その回に効く数十行**なので、機械で抜き出す。

    python3 scripts/brief_block.py 晋書 載記          # 書名・ブロック名で引く
    python3 scripts/brief_block.py --id qianzhao-liuyao  # 人物のキャッシュ有無も見る

常に出るもの: コーパス検索のメモリ事故対策（WSL が落ちる）と、全書に共通する罠の見出し。
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CORPUS_ROOTS = [p for p in (ROOT, Path("/home/sakis/emperor-stats")) if (p / "docs").is_dir()]
NOTES = ROOT / "docs" / "process" / "CORPUS_NOTES.md"
MAPPING = ROOT / "docs" / "process" / "SOURCE_MAPPING.md"
ALWAYS = "コーパス検索のメモリ事故対策"


def sections(path):
    """(見出し, 本文) の列。### は ## の下に畳まず独立に扱う。"""
    out, head, buf = [], None, []
    for line in path.read_text(encoding="utf-8").splitlines():
        if re.match(r"^#{2,3} ", line):
            if head:
                out.append((head, "\n".join(buf)))
            head, buf = line, []
        elif head:
            buf.append(line)
    if head:
        out.append((head, "\n".join(buf)))
    return out


def show(title, items):
    if not items:
        return
    print(f"\n{'=' * 8} {title} {'=' * 8}")
    for head, body in items:
        print(f"\n{head}\n{body.rstrip()}")


def main():
    args = [a for a in sys.argv[1:]]
    eid = None
    if "--id" in args:
        i = args.index("--id")
        eid = args[i + 1] if i + 1 < len(args) else None
        args = args[:i] + args[i + 2:]
    if not args and not eid:
        print(__doc__)
        return 2
    keys = args + ([eid] if eid else [])

    notes, mapping = sections(NOTES), sections(MAPPING)
    show("必ず読む（全書共通）", [s for s in notes if ALWAYS in s[0]])

    hit_n = [s for s in notes if any(k in s[0] or k in s[1] for k in keys) and ALWAYS not in s[0]]
    hit_m = [s for s in mapping if any(k in s[0] or k in s[1] for k in keys)]
    show(f"CORPUS_NOTES の該当箇所（{'・'.join(keys)}）", hit_n)
    show(f"SOURCE_MAPPING の該当箇所（{'・'.join(keys)}）", hit_m)

    if not hit_n and not hit_m:
        print(f"\n該当なし。**表に無い書は罠が未調査**です — 巻数が絶対か相対か・"
              f"「原文」ラベルの中身が本当に文言文か・人物記事が巻をまたいでいないかを"
              f"1〜2件で確かめ、結果を CORPUS_NOTES.md と SOURCE_MAPPING.md に足してから配ってください。")
    print("\n" + "-" * 40)
    print("罠の見出し一覧（気になるものは CORPUS_NOTES.md 本文へ）:")
    for head, _ in notes:
        print("  " + head.lstrip("# "))

    if eid:
        for root in CORPUS_ROOTS:
            cache = root / "_corpus_cache" / f"{eid}.txt"
            if cache.exists():
                print(f"\n原文キャッシュ: {cache}（{cache.stat().st_size:,} バイト）")
                break
        else:
            print(f"\n原文キャッシュ `_corpus_cache/{eid}.txt` がありません。"
                  f"scripts/build_corpus_cache.py に書名・巻・行範囲を追記して生成してから調査に入ります。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
