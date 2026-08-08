#!/usr/bin/env python3
"""ルビ強制辞書へ足せる語・足せない語を測る（GitHub Issue #16）。

バッチを本体へ入れたあと毎回やっている測定を1本にした（2026-08-08）。それまでは
バッチごとに使い捨ての式を書いていて、**足せなかった語の理由が数え直すたびに
違う形で出ていた**（RESIDUAL.md の同じ行に、三国7人・北斉8人・隋末12人の実測が
別々の書き方で並んでいる）。

判定は3つだけ:

1. **本をまたぐ語だけ足す** — 配布物の中で2本以上にルビ付きで出ている語
   （1冊にしか出ない語を固定しても得が無く、外れたときの面積だけ増える）
2. **既存本にルビ無しの素通り出現がある語は足せない** — 足すと既存本が
   `validate_readings.py` の検査8で落ちる。素通りの判定は
   `profile_prose.missing_ruby` と同じ（`NOT_TERMS` を伏せ、左右に漢字が続く
   出現は数えない）
3. **1字の語は足さない**（一般語へこぼれる側は `profile_prose.NOT_TERMS` の手当て）

読みが本ごとに割れている語も足さない（先に `fix_profile_ruby.py` で寄せる）。

使い方:
    python3 scripts/lexicon_candidates.py --for tang-gaozu tang-taizong   # 測るだけ
    python3 scripts/lexicon_candidates.py --for <id>… --write             # 足せるぶんを追記
    python3 scripts/lexicon_candidates.py --all                           # 全本を母集団に測る
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import profile_prose  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PROFILES = ROOT / "data" / "emperor-profiles.json"
LEXICON = ROOT / "data" / "profile-ruby-lexicon.json"
RUBY = profile_prose.RUBY
KANJI = re.compile(r"[㐀-鿿豈-﫿\U00020000-\U0003ffff]")


def joined(profile: dict) -> str:
    """lead と body はつないで1本として見る（reapply_profile_ruby と同じ扱い）。"""
    return profile.get("lead", "") + "\n" + profile.get("body", "")


def plain_hits(text: str, word: str) -> int:
    """ルビ無しの素通り出現の数。左右に漢字が続く出現は数えない。"""
    rest = profile_prose.mask_not_terms(profile_prose.outside_ruby(text))
    count = 0
    for m in re.finditer(re.escape(word), rest):
        left = rest[m.start() - 1] if m.start() else ""
        right = rest[m.end()] if m.end() < len(rest) else ""
        if KANJI.match(left) or KANJI.match(right):
            continue
        count += 1
    return count


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--for", dest="ids", nargs="+", default=[],
                    help="測る対象の皇帝 id（このバッチで書いた本）")
    ap.add_argument("--all", action="store_true", help="配布物の全本を対象にする")
    ap.add_argument("--write", action="store_true", help="足せる語を辞書へ追記する")
    args = ap.parse_args()

    profiles = json.loads(PROFILES.read_text(encoding="utf-8"))["profiles"]
    lexicon = json.loads(LEXICON.read_text(encoding="utf-8"))
    known = set(lexicon["terms"])

    if args.all:
        targets = list(profiles)
    else:
        targets = args.ids
    missing = [i for i in targets if i not in profiles]
    if not targets or missing:
        print(f"対象が配布物にありません: {missing or '（--for か --all を付ける）'}")
        return 2

    # 語 → {本id: ルビの形}
    forms: dict[str, dict[str, str]] = defaultdict(dict)
    for pid, prof in profiles.items():
        for m in RUBY.finditer(joined(prof)):
            forms[m.group(1)].setdefault(pid, m.group(0))

    addable: dict[str, str] = {}
    blocked: list[tuple[str, int, list[str]]] = []
    split: list[str] = []
    single: list[str] = []
    candidates = 0

    for word in sorted(forms):
        books = forms[word]
        if not any(pid in books for pid in targets):
            continue          # このバッチで振っていない語は測らない
        if word in known or len(books) < 2:
            continue          # 既に辞書にある／1冊にしか出ない
        candidates += 1
        if len(word) < 2:
            single.append(word)
            continue
        if len(set(books.values())) > 1:
            split.append(word)
            continue
        passers = [pid for pid, prof in profiles.items() if plain_hits(joined(prof), word)]
        if passers:
            blocked.append((word, len(passers), passers[:6]))
            continue
        addable[word] = next(iter(books.values()))

    print(f"候補 {candidates}語（{len(targets)}本で振った語のうち、2本以上に出て辞書に未載）")
    print(f"  足せる: {len(addable)}語")
    if addable:
        print("    " + "・".join(sorted(addable)))
    print(f"  足せない（既存本にルビ無しの素通り出現）: {len(blocked)}語")
    for word, n, sample in sorted(blocked, key=lambda x: -x[1])[:12]:
        print(f"    {word} — {n}本（{'・'.join(sample)}{'…' if n > len(sample) else ''}）")
    if len(blocked) > 12:
        print(f"    …ほか {len(blocked) - 12}語")
    if split:
        print(f"  読みが割れていて足せない: {len(split)}語 — " + "・".join(split)
              + "（先に fix_profile_ruby.py で寄せる）")
    if single:
        print(f"  1字なので足さない: {len(single)}語 — " + "・".join(single))

    if args.write and addable:
        lexicon["terms"].update(addable)
        lexicon["terms"] = dict(sorted(lexicon["terms"].items()))
        LEXICON.write_text(
            json.dumps(lexicon, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"\n{LEXICON} を更新した（{len(known)} → {len(lexicon['terms'])}語）。"
              "次に流す: python3 scripts/validate_readings.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
