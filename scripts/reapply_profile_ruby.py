#!/usr/bin/env python3
"""紹介文のルビを、振るべき全出現へ付け直す（GitHub Issue #16）。

**2回目以降の出現にも振る**（2026-08-05 ユーザー決定）。初出だけ振って以降を素通り
させていたのが18本で143語・延べ305回あり、手で直す作業ではない。

付ける対象は scripts/profile_prose.missing_ruby と**同じ2種類**:

- data/profile-ruby-lexicon.json に載る語
- その本文の中で1度でもルビを振った語（辞書に無くてもよい）

**読みを決めるのは人**で、このツールは決まっている読みを機械的に写すだけ。
新しい語に初めてルビを振るときは、まず本文へ1箇所書くか辞書へ足す
（`R-NO-AUTOGEN` が禁じているのは判定の自動生成で、確定済みの転記は対象外）。

使い方:
    python3 scripts/reapply_profile_ruby.py --dry-run            # 本体18本の差分を見る
    python3 scripts/reapply_profile_ruby.py --write
    python3 scripts/reapply_profile_ruby.py <断片.json> --write  # 断片1本に掛ける
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
# 1字の親文字を熟語の中だけへ写すための漢字クラス（add_profile.py の KANJI と同じ範囲）。
KANJI_CLASS = r"[㐀-鿿豈-﫿\U00020000-\U0003ffff]"


def forms_for(joined: str, lexicon: dict[str, list[str]],
              extra: dict[str, str] | None = None) -> dict[str, str]:
    """この1本で使うルビの形。**lead と body をつないだ側から拾う。**

    欄ごとに拾うと、lead でしか振っていない語（「宣帝」「挟書律」）が body で
    埋まらない。実際にそれで取りこぼした。

    `extra` は**その本の主人公の名前**（2026-08-07）。辞書には載らない
    （365人ぶん載せる欄ではない）が、本人の名前にルビが無い本が実際にあった
    （「劉邦」5箇所・「楊堅」4箇所）ので、ここで必ず振る。
    """
    forms: dict[str, str] = {}
    for plain, candidates in lexicon.items():
        if len(candidates) == 1:  # 候補が割れる語（送り仮名で読みが変わる）は機械で決めない
            forms[plain] = candidates[0]
    forms.update(extra or {})
    for m in RUBY.finditer(joined):  # 本文で実際に振った形が辞書より優先
        forms[m.group(1)] = m.group(0)
    return forms


def annotate(text: str, forms: dict[str, str]) -> tuple[str, int]:
    """ルビ注釈の外に出ている対象語へルビを付ける。→ (新しい本文, 付けた数)

    既存の注釈は**一度プレースホルダへ退避**してから語を置換する。退避しないと、
    付けたばかりの `｜邯鄲《かんたん》` の中の「邯」に次の語が食い込む。
    """
    # 既存の注釈を退避
    slots: list[str] = []

    def stash(m):
        slots.append(m.group(0))
        return f"\x00{len(slots) - 1}\x01"

    work = RUBY.sub(stash, text)

    # 一般語（「広い」「陳列」）を先に退避する。1字の人名断片を辞書に載せた副作用で
    # ここへ当たるため、**必ず語より先**（profile_prose.mask_not_terms と同じ順序）。
    for word in profile_prose.NOT_TERMS:
        if word in work:
            slots.append(word)
            work = work.replace(word, f"\x00{len(slots) - 1}\x01")

    added = 0
    for plain in sorted(forms, key=len, reverse=True):
        if plain not in work:
            continue
        slots.append(forms[plain])
        token = f"\x00{len(slots) - 1}\x01"
        if len(plain) == 1:
            # **1字の親文字は熟語の中だけへ写す**（2026-08-06）。name-readings が
            # 2字名を1字ずつに割る指定を持つ人物（孫晧 → ｜孫《そん》｜晧《こう》）で、
            # 単独の「孫」＝まご にまで そん が付いた。単独で立っている1字は
            # 一般語のことが多く、熟語の中の1字は人名・官職の断片であることが多い。
            # 隣が既に置換済み（\x01 で終わる／\x00 で始まるプレースホルダ）の場合も
            # 「熟語の中」に数える。数えないと ｜孫《そん》｜晧《こう》 の2字目が
            # 落ちる（1字目を置換した時点で隣が漢字でなくなるため）。
            left = KANJI_CLASS[:-1] + "\x01]"
            right = KANJI_CLASS[:-1] + "\x00]"
            pattern = re.compile(
                f"(?<={left}){re.escape(plain)}|{re.escape(plain)}(?={right})"
            )
            work, n = pattern.subn(token, work)
            added += n
            continue
        added += work.count(plain)
        work = work.replace(plain, token)

    while "\x00" in work:
        for i, s in enumerate(slots):
            work = work.replace(f"\x00{i}\x01", s)
    return work, added


def main() -> int:
    ap = argparse.ArgumentParser(description="紹介文のルビを全出現へ付け直す")
    ap.add_argument("fragment", nargs="?", help="断片 JSON（省略すると本体18本）")
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not (args.write or args.dry_run):
        ap.error("--write か --dry-run のどちらかを付ける")

    lexicon = profile_prose.load_lexicon()
    path = Path(args.fragment) if args.fragment else PROFILES
    doc = json.loads(path.read_text(encoding="utf-8"))
    profiles = doc["profiles"] if "profiles" in doc else doc

    emperors = profile_name.load_emperors()
    readings = profile_name.load_readings()

    total = 0
    for emperor_id, profile in profiles.items():
        extra = None
        if emperor_id in emperors:
            r = profile_name.resolve(emperors[emperor_id], readings)
            if r["annotated"] != r["plain"]:  # カタカナ名（クビライ）にはルビが要らない
                extra = {r["plain"]: r["annotated"]}
        forms = forms_for(
            f"{profile.get('lead') or ''}\n{profile.get('body') or ''}", lexicon, extra
        )
        for field in ("lead", "body"):
            text = profile.get(field)
            if not text:
                continue
            new, added = annotate(text, forms)
            if added:
                total += added
                print(f"{emperor_id}/{field}: +{added}件")
                profile[field] = new

    print(f"\n合計 {total} 件のルビを追加"
          + ("（--dry-run なので書いていない）" if not args.write else ""))
    if args.write and total:
        path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{path} を更新した")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
