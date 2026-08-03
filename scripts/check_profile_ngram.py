#!/usr/bin/env python3
"""書きかけの断片が、既存の紹介文と同じ言い回しを使っていないか見る。

Issue #16 の「一人ずつ作成する」に対する唯一の機械的な担保は 12-gram の重複報告で、
validate_profiles.py はそれを**本体へ入れたあと・3本以上で共有された場合だけ**出す。
それでは気づくのが遅い。実際、晋武帝の初稿は「縛めを解き棺を焼いて迎え」を
wu-modi・shuhan-liushan と共有していた（同じ280年の孫晧降伏を、降す側と降る側から
書いた2本に一字一句同じ節が並ぶ）。書いている最中に見えれば直せる。

使い方:
    python3 scripts/check_profile_ngram.py <断片.json> [--frag-dir <dir>] [-n 12]

比較先は data/emperor-profiles.json の既存分と、--frag-dir にある他の断片
（並行して書かれている同じブロックの原稿）。**報告だけで、エラーにはしない。**
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROFILES = ROOT / "data" / "emperor-profiles.json"
RUBY = re.compile(r"｜([^｜《》]+)《([^｜《》]+)》")


# body の節見出し（`## ` 始まり）。見出しは365本で共通してよいので n-gram から外す
# — scripts/validate_profiles.py の HEADING と同じもの。
HEADING = re.compile(r"^##\s.*$", re.MULTILINE)


def plain(profile: dict) -> str:
    joined = " ".join(filter(None, (profile.get("lead"), profile.get("body"))))
    return RUBY.sub(r"\1", HEADING.sub("", joined))


def grams(text: str, n: int) -> set[str]:
    body = re.sub(r"\s+", "", text)
    return {body[i : i + n] for i in range(len(body) - n + 1)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("fragment")
    ap.add_argument("--frag-dir")
    ap.add_argument("-n", type=int, default=12)
    args = ap.parse_args()

    fragment = json.loads(Path(args.fragment).read_text(encoding="utf-8"))
    others: dict[str, str] = {
        i: plain(p)
        for i, p in json.loads(PROFILES.read_text(encoding="utf-8"))["profiles"].items()
    }
    if args.frag_dir:
        for path in sorted(Path(args.frag_dir).glob("*.json")):
            if path.name.startswith("_"):
                continue
            for i, p in json.loads(path.read_text(encoding="utf-8")).items():
                others.setdefault(i, plain(p))

    hits = 0
    for emperor_id, profile in fragment.items():
        others.pop(emperor_id, None)
        mine = grams(plain(profile), args.n)
        shared: dict[str, list[str]] = {}
        for other_id, text in others.items():
            for g in mine & grams(text, args.n):
                shared.setdefault(g, []).append(other_id)
        if not shared:
            print(f"{emperor_id}: 既存 {len(others)}本と共通する{args.n}-gram なし")
            continue
        hits += len(shared)
        print(f"{emperor_id}: {len(shared)}件の{args.n}-gram が他の本と共通")
        for g, ids in sorted(shared.items(), key=lambda kv: -len(kv[1])):
            print(f"  「{g}」← {'・'.join(ids)}")
    if hits:
        print("\n骨組みの使い回しなら書き換える（固有名詞を含む一致は偶然のこともある）。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
