#!/usr/bin/env python3
"""書き上げた紹介文の断片を data/emperor-profiles.json へ入れる（GitHub Issue #16）。

**JSON を直接編集しない**ための道具。理由は3つある。

1. 並行セッションが同じファイルを触っている。指定 id のキーだけを差し替え、
   ほかのレコードには手を出さない read-modify-write にする
2. かなの前に裸の ｜ を書く事故が繰り返し起きる（「｜のちに」「｜そのうえで」）。
   ルビ記法は ｜親文字《ルビ》 で、《》の無い ｜ はそのまま画面に出る。
   かなの前なら落とし、**漢字の前なら止める**（そちらはルビの書き漏れなので、
   黙って消すと総ルビが崩れたまま通ってしまう）
3. 入れた直後にルビを剥がした字数を出す。lead 70〜110字・body 100〜700字・
   description 100〜140字の上下限は validate_profiles.py が見るが、
   書き直しは早いほど安い

使い方:
    python3 scripts/add_profile.py <断片.json>

断片は {"<皇帝id>": {"lead": ..., "body": ..., "description": ..., "basis": ...}}。
body は任意（史料が数十字しか無い人物では書かない）。
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "data" / "emperor-profiles.json"

# site/src/lib/ruby.ts の RUBY_PATTERN と同じもの。片方だけ変えないこと。
RUBY = re.compile(r"｜([^｜《》]+)《([^｜《》]+)》")
KANJI = re.compile(r"[㐀-鿿豈-﫿]|[\U00020000-\U0003ffff]")
FIELDS = ("lead", "body", "description", "basis")


def clean(text: str, label: str) -> str:
    """かなの前に付いた裸の ｜ を落とす。漢字の前に付いていたら止める。"""
    out: list[str] = []
    i = 0
    while i < len(text):
        m = RUBY.match(text, i)
        if m:
            out.append(m.group(0))
            i = m.end()
            continue
        ch = text[i]
        if ch == "｜":
            nxt = text[i + 1] if i + 1 < len(text) else ""
            if KANJI.match(nxt):
                raise SystemExit(
                    f"{label}: 漢字「{nxt}」の前に裸の ｜ があります（ルビの書き漏れ）"
                )
            print(f"  {label}: 裸の ｜ を除去（次の文字「{nxt}」）")
            i += 1
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)

    fragment = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    data = json.loads(TARGET.read_text(encoding="utf-8"))

    for emperor_id, profile in fragment.items():
        for field in ("lead", "body"):
            if field in profile:
                profile[field] = clean(profile[field], f"{emperor_id} の {field}")
        data["profiles"][emperor_id] = {
            k: profile[k] for k in FIELDS if k in profile
        }
        lengths = {
            k: len(RUBY.sub(r"\1", profile[k]))
            for k in ("lead", "body", "description")
            if k in profile
        }
        print(f"{emperor_id}: " + " ".join(f"{k}={v}字" for k, v in lengths.items()))

    data["meta"]["counts"]["written"] = len(data["profiles"])
    TARGET.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"written = {data['meta']['counts']['written']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
