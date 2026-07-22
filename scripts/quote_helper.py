"""引用作成ヘルパー — 原文引用の「手打ち禁止」ルールを手順として強制するためのツール。

使い方:
  python3 scripts/quote_helper.py <emperor-id> <検索語> [--book <コーパス相対パス>] [-C <前後文字数>]

  例: python3 scripts/quote_helper.py nansong-guangzong 內禪
      python3 scripts/quote_helper.py xixia-renzong 大德五年 --book daizhigev20/史藏/别史/西夏书事.txt

動作:
  1. 本人の _corpus_cache/<id>.txt を優先し、無ければ（または --book 指定時は）コーパスを検索
  2. ヒット行を前後文脈つきで表示し、そのままコピーできる形（原文断片＋出典ファイル）を出力
  3. 出力された原文は一字も変えずに quote / note へ貼り付けること（字体変換・要約・語順変更は禁止。
     規約: docs/process/RESEARCH_PROCESS.md「引用の取り扱い規約」）
  4. データ更新後は `python3 scripts/verify_quotes.py --backfill` → `--check` で台帳を更新・検証する

検索語は新字体・繁体・簡体のいずれでもよい（内部で正規化して両形を検索する）。
"""
from __future__ import annotations

import argparse
import re
import sys
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from hanzi_norm import han_only, to_simplified, to_traditional  # noqa: E402
from verify_quotes import CORPUS_ROOT, SCAN_DIRS, gap_pattern  # noqa: E402


def show_hits(path: Path, pattern: str, context: int, label: str, limit=8):
    text = path.read_text(encoding="utf-8", errors="ignore")
    n = 0
    for m in re.finditer(pattern, text):
        n += 1
        if n > limit:
            print(f"  …他にもヒットあり（{label}）")
            break
        s = max(0, m.start() - context)
        e = min(len(text), m.end() + context)
        line_no = text.count("\n", 0, m.start()) + 1
        excerpt = text[s:e].replace("\n", "⏎")
        print(f"--- {label}:{line_no}")
        print(f"  {excerpt}")
        print(f"  ↑ この範囲から必要部分を【一字も変えずに】コピーして使う（出典メモ: {label} {line_no}行付近）")
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("emperor_id")
    ap.add_argument("query")
    ap.add_argument("--book", help="コーパス相対パス（例: daizhigev20/史藏/正史/明史.txt）")
    ap.add_argument("-C", type=int, default=60, help="前後文脈の文字数")
    args = ap.parse_args()

    if CORPUS_ROOT is None:
        sys.exit("ローカルコーパスが見つかりません（このツールはローカル専用）")

    q = han_only(args.query)
    if len(q) < 2:
        sys.exit("検索語は漢字2字以上で指定してください")
    forms = {to_simplified(q), to_traditional(q), q}
    pattern = "|".join(gap_pattern(f) for f in sorted(forms))

    total = 0
    if args.book:
        p = CORPUS_ROOT / args.book
        if not p.exists():
            sys.exit(f"コーパスファイルが見つかりません: {args.book}")
        total += show_hits(p, pattern, args.C, args.book)
    else:
        cache = CORPUS_ROOT / "_corpus_cache" / f"{args.emperor_id}.txt"
        if cache.exists():
            total += show_hits(cache, pattern, args.C, f"_corpus_cache/{args.emperor_id}.txt")
        if total == 0:
            print("キャッシュにヒットなし → コーパス全体を検索（数十秒）…")
            r = subprocess.run(["rg", "-l", "-e", pattern] + [str(CORPUS_ROOT / d) for d in SCAN_DIRS],
                               capture_output=True, text=True, timeout=600)
            files = [Path(x) for x in r.stdout.splitlines()][:5]
            for f in files:
                total += show_hits(f, pattern, args.C, str(f.relative_to(CORPUS_ROOT)))
    if total == 0:
        print("ヒットなし。検索語を変えるか、原文が確認できない場合は引用の体裁（「」）を使わず\n"
              "「該当原文は確認できず（出典名）」と記載すること（規約4項）。")
        return 1
    print(f"\n計 {total} ヒット。貼り付け後は scripts/verify_quotes.py --backfill && --check を実行。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
