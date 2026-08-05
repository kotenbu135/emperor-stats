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
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import profile_prose  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PROFILES = ROOT / "data" / "emperor-profiles.json"
RUBY = profile_prose.RUBY


def forms_for(joined: str, lexicon: dict[str, list[str]]) -> dict[str, str]:
    """この1本で使うルビの形。**lead と body をつないだ側から拾う。**

    欄ごとに拾うと、lead でしか振っていない語（「宣帝」「挟書律」）が body で
    埋まらない。実際にそれで取りこぼした。
    """
    forms: dict[str, str] = {}
    for plain, candidates in lexicon.items():
        if len(candidates) == 1:  # 候補が割れる語（送り仮名で読みが変わる）は機械で決めない
            forms[plain] = candidates[0]
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

    added = 0
    for plain in sorted(forms, key=len, reverse=True):
        if plain not in work:
            continue
        added += work.count(plain)
        slots.append(forms[plain])
        work = work.replace(plain, f"\x00{len(slots) - 1}\x01")

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

    total = 0
    for emperor_id, profile in profiles.items():
        forms = forms_for(f"{profile.get('lead') or ''}\n{profile.get('body') or ''}", lexicon)
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
