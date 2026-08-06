#!/usr/bin/env python3
"""書きかけの断片が、既存の紹介文と同じ言い回しを使っていないか見る。

Issue #16 の「一人ずつ作成する」に対する唯一の機械的な担保は 12-gram の重複報告で、
validate_profiles.py はそれを**本体へ入れたあと・3本以上で共有された場合だけ**出す。
それでは気づくのが遅い。実際、晋武帝の初稿は「縛めを解き棺を焼いて迎え」を
wu-modi・shuhan-liushan と共有していた（同じ280年の孫晧降伏を、降す側と降る側から
書いた2本に一字一句同じ節が並ぶ）。書いている最中に見えれば直せる。

使い方:
    python3 scripts/check_profile_ngram.py <断片.json> [--frag-dir <dir>] [-n 12]

比較先は data/emperor-profiles.json の既存分と、**同じディレクトリに並ぶ他の断片**
（並行して書かれている同じバッチの原稿。`--frag-dir` で別の場所も指せる。
`--no-siblings` で切れる）。**報告だけで、エラーにはしない。**

兄弟断片を既定で見るのは 2026-08-06 から。それまでは `--frag-dir` を渡さないと
同一バッチ内の衝突が誰にも見えず、「1本 add → 残りを検査し直す」を人が手で
並べていた（三国7人で3件・後漢9人で4件が実際に出た。同じ問いに全員が答える
規範なので、同系列が続くバッチでは構造的に起きる）。
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
    ap.add_argument("--frag-dir", help="兄弟断片の在り処（既定は断片と同じディレクトリ）")
    ap.add_argument("--no-siblings", action="store_true", help="兄弟断片を見ない")
    ap.add_argument("-n", type=int, default=12)
    args = ap.parse_args()

    target = Path(args.fragment)
    fragment = json.loads(target.read_text(encoding="utf-8"))
    others: dict[str, str] = {
        i: plain(p)
        for i, p in json.loads(PROFILES.read_text(encoding="utf-8"))["profiles"].items()
    }
    written = len(others)
    siblings = 0
    frag_dir = Path(args.frag_dir) if args.frag_dir else target.parent
    if not args.no_siblings and frag_dir.is_dir():
        for path in sorted(frag_dir.glob("*.json")):
            if path.name.startswith("_") or path.resolve() == target.resolve():
                continue
            try:
                loaded = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue  # 断片以外の JSON が同居していても止めない
            if not isinstance(loaded, dict):
                continue  # 配列やスカラの JSON（断片ではない）
            for i, p in loaded.items():
                if not isinstance(p, dict) or not (p.get("lead") or p.get("body")):
                    continue
                if i not in others:
                    siblings += 1
                others[i] = plain(p)

    where = f"既存 {written}本"
    if siblings:
        where += f" ＋ 同じ場所の断片 {siblings}本"

    hits = 0
    for emperor_id, profile in fragment.items():
        others.pop(emperor_id, None)
        mine = grams(plain(profile), args.n)
        shared: dict[str, list[str]] = {}
        for other_id, text in others.items():
            for g in mine & grams(text, args.n):
                shared.setdefault(g, []).append(other_id)
        if not shared:
            print(f"{emperor_id}: {where}と共通する{args.n}-gram なし")
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
