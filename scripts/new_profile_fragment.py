#!/usr/bin/env python3
"""紹介文の断片の骨格と、引用台帳の空ファイルを先に作る。

**なぜ骨格を配るのか（2026-08-05 の実測）。** Workflow で書かせた9体すべてが、断片 JSON を
直接書かずに 6.7KB 前後の `build.py` を書き、ゲートで落ちるたびにヒアドキュメントで
丸ごと書き直していた（敬宗の執筆で4回・劉鋹の反映で build2.py＋trim3.py＋rec.py）。
本文2,000字の成果物に対して1体あたり3〜6万トークンの出力で、**出力は重み付き費用の
37.5%＝最大項目**だった。

原因は、ルビ記法と40〜53件の `claims` を含む9,000字の JSON を1回の Write で出させて
いたこと。**body を1文直すだけで claims 全件が再送される。** そこで:

1. 骨格をこちらで作る（キー・入れ物・出力先を書き手に決めさせない）
2. **`claims` は別ファイル `<id>.claims.jsonl` に1行1件で追記させる。**
   本文の直しで台帳が再送されず、台帳の直しは1行の Edit で済む

書き手への指示は「Write は骨格を埋める1回だけ。以降は Edit」。`build.py` の類を
書かせない。

使い方:
    python3 scripts/new_profile_fragment.py <皇帝id> --out <ディレクトリ>
    python3 scripts/new_profile_fragment.py <皇帝id> --out <ディレクトリ> --force

`check_profile_fragment.py` は `<断片>.json` の隣に `<断片>.claims.jsonl` があれば
自動で読む（断片の中に `claims` を直接書いた旧い形も通る）。
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SKELETON_HELP = {
    "lead": "70〜260字。誰の何にあたる人か・どう即位したか。ここだけで人物が立つように",
    "body": "100〜2400字（**目安は800〜1,500字**）。段落は空行で分ける。節見出し（## ）を立てない",
    "description": "100〜140字。検索結果に出る一文。**ルビを振らない**",
    "basis": "読んだ場所の**ポインタ**。「_corpus_cache/<id>.txt L12-40 即位から改元まで」"
             "の形で、ファイル名＋L行番号＋そこに何があるかを並べる。散文の覚え書きにしない",
}


def main() -> int:
    ap = argparse.ArgumentParser(
        description="断片の骨格と引用台帳の空ファイルを作る",
        epilog="Write は骨格を埋める1回だけ。以降の直しは Edit で行い、build.py の類を書かない",
    )
    ap.add_argument("emperor_id")
    ap.add_argument("--out", required=True, help="出力先ディレクトリ（workDir）")
    ap.add_argument("--force", action="store_true", help="既にあっても上書きする")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    frag = out / f"{args.emperor_id}.json"
    ledger = out / f"{args.emperor_id}.claims.jsonl"

    if frag.exists() and not args.force:
        print(f"既にある: {frag}（作り直すなら --force）")
    else:
        frag.write_text(
            json.dumps(
                {args.emperor_id: {k: "" for k in ("lead", "body", "description", "basis")}},
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        print(f"骨格を作った: {frag}")

    if ledger.exists() and not args.force:
        print(f"既にある: {ledger}（作り直すなら --force）")
    else:
        ledger.write_text("", encoding="utf-8")
        print(f"引用台帳（空）: {ledger}")

    print("\n埋め方:")
    for k, v in SKELETON_HELP.items():
        print(f"  {k:12} {v}")
    print(
        f"\n引用台帳は {ledger.name} に**1行1件の JSON**で書く（読みながら足す）:\n"
        '  {"text": "本文で書く事実", "quote": "根拠の原文句", "src": "_corpus_cache/'
        f'{args.emperor_id}.txt:123"}}\n'
        "  quote は**ツール出力からコピー**する（手打ち禁止・字体を変えない）。\n"
        "  src は「ファイル:行」。本紀の外（列伝・志）から引いたらそのファイルを書く。"
    )
    print(
        f"\n書けたら:\n"
        f"  python3 scripts/check_profile_fragment.py {frag} --strict\n"
        f"  python3 scripts/check_profile_ngram.py {frag}\n"
        "**Write は骨格を埋める1回だけ。以降は Edit で直す**（build.py の類を書かない）。"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
