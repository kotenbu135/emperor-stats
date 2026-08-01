#!/usr/bin/env python3
"""紹介文の断片（1人ぶん）を、data/emperor-profiles.json へ入れる前に見る。

既存のゲートは**ファイル全体**に掛かる（validate_profiles.py・validate_readings.py）ので、
1人ぶんの書き上がりを確かめるには add_profile.py で本体へ入れてしまう必要があった。
それでは書き直しのたびに共有ファイルを触ることになり、並行執筆と相性が悪い。

実際に繰り返し出ている外し方は決まっている（三国11人のうち5人で body が上限超過・
かなの前の裸の ｜・読みテーブルと違う切り方・description にルビ）。ここで先に落とす。

使い方:
    python3 scripts/check_profile_fragment.py <断片.json> [--basis-corpus]

断片は {"<皇帝id>": {"lead": ..., "body": ..., "description": ..., "basis": ...}}。
--basis-corpus を付けると basis に並べた原文断片が本紀キャッシュに実在するかを
**報告**する（エラーにはしない）。キャッシュは簡体字・繁体字が混在した基準で書かれる
ため hanzi_norm で両側をそろえて突き合わせる。書き手のコーパス読みが空振りしたまま
記憶で書いた場合に気づくための、唯一の機械的な手がかり。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
READINGS = ROOT / "data" / "name-readings.json"
# _corpus_cache はメインの作業ツリーにしか無い（.gitignore 対象・worktree へは複製されない）。
CACHE_DIRS = [ROOT / "_corpus_cache", Path("/home/sakis/emperor-stats/_corpus_cache")]

# add_profile.py・site/src/lib/ruby.ts と同じもの。片方だけ変えないこと。
RUBY = re.compile(r"｜([^｜《》]+)《([^｜《》]+)》")
KANJI = re.compile(r"[㐀-鿿豈-﫿]|[\U00020000-\U0003ffff]")

LIMITS = {"lead": (70, 110), "body": (100, 700), "description": (100, 140)}

errors: list[str] = []
notices: list[str] = []


def strip_ruby(text: str) -> str:
    return RUBY.sub(r"\1", text)


def check_ruby_coverage(text: str, label: str) -> None:
    """ルビの付いていない漢字が残っていないか（総ルビ・Issue #20）。"""
    rest = RUBY.sub("", text)
    bare = sorted({c for c in rest if KANJI.match(c)})
    if bare:
        errors.append(f"{label}: ルビの無い漢字 {len(bare)}種 → {'・'.join(bare[:20])}")
    for m in re.finditer(r"｜(?!.{0,40}?《)", rest):
        nxt = rest[m.end() : m.end() + 1]
        errors.append(f"{label}: 裸の ｜（次の文字「{nxt}」）")
        break


def check_readings(text: str, label: str, readings: dict) -> None:
    """本文で振ったルビ → 読みテーブルの向きで照合する（逆向きは1字キーで壊れる）。"""
    for m in RUBY.finditer(text):
        parent = m.group(1)
        if len(parent) < 2:
            continue
        expected = readings.get(parent)
        if expected and expected != m.group(0):
            errors.append(
                f"{label}: 「{parent}」の振り方がテーブルと違う "
                f"（本文 {m.group(0)} / テーブル {expected}）"
            )


def cache_path(emperor_id: str) -> Path | None:
    for d in CACHE_DIRS:
        p = d / f"{emperor_id}.txt"
        if p.exists():
            return p
    return None


def check_basis_corpus(emperor_id: str, basis: str) -> None:
    """basis に並べた原文断片が本紀キャッシュに実在するか（報告のみ）。"""
    try:
        from hanzi_norm import norm_for_match  # type: ignore
    except ImportError:
        sys.path.insert(0, str(ROOT / "scripts"))
        from hanzi_norm import norm_for_match  # type: ignore

    path = cache_path(emperor_id)
    if path is None:
        notices.append(f"{emperor_id}: 本紀キャッシュが無いので basis の照合を飛ばした")
        return
    haystack = norm_for_match(path.read_text(encoding="utf-8"))
    runs = [r for r in re.findall(r"[㐀-鿿]{6,}", basis)]
    if not runs:
        notices.append(f"{emperor_id}: basis に6字以上の原文断片が無く照合できない")
        return

    # 完全一致では取りこぼす。hanzi_norm の新字体表は常用漢字を全部は持っておらず
    # （郷→乡・舎→舍 が抜けている）、正しく本紀から引いた断片でも1〜2字ぶん外れる。
    # 最長共通部分列の被覆率で見る——「記憶で書いた」断片は数字と人名しか合わないので
    # 0.5 を割り、正しい引き写しは表記ゆれがあっても 0.8 を超える。
    matcher = SequenceMatcher(autojunk=False)
    matcher.set_seq2(haystack)
    missing: list[str] = []
    for r in runs:
        needle = norm_for_match(r)
        matcher.set_seq1(needle)
        cover = matcher.find_longest_match(0, len(needle), 0, len(haystack)).size / max(
            len(needle), 1
        )
        if cover < 0.5:
            missing.append(f"{r}（被覆 {cover:.0%}）")
    hit = len(runs) - len(missing)
    notices.append(f"{emperor_id}: basis の原文断片 {hit}/{len(runs)} 件が本紀キャッシュに実在")
    for r in missing[:12]:
        notices.append(f"    未検出: {r} — 本紀の外（列伝・裴注・他書）なら出所を basis に明記。心当たりが無ければ書いた事実を疑う")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("fragment")
    ap.add_argument("--basis-corpus", action="store_true")
    args = ap.parse_args()

    fragment = json.loads(Path(args.fragment).read_text(encoding="utf-8"))
    readings = json.loads(READINGS.read_text(encoding="utf-8"))["names"]

    for emperor_id, profile in fragment.items():
        unknown = set(profile) - {"lead", "body", "description", "basis"}
        if unknown:
            errors.append(f"{emperor_id}: 知らないフィールド {sorted(unknown)}")
        if not profile.get("lead"):
            errors.append(f"{emperor_id}: lead がありません")
        if profile.get("lead") and not profile.get("basis"):
            errors.append(f"{emperor_id}: basis が空です（何を読んで書いたかを残す）")

        for field in ("lead", "body"):
            text = profile.get(field)
            if not text:
                continue
            check_ruby_coverage(text, f"{emperor_id} の {field}")
            check_readings(text, f"{emperor_id} の {field}", readings)

        desc = profile.get("description", "")
        if RUBY.search(desc) or "｜" in desc or "《" in desc:
            errors.append(f"{emperor_id}: description にルビ記法（平文で書く）")

        for field, (lo, hi) in LIMITS.items():
            text = profile.get(field)
            if not text:
                continue
            n = len(strip_ruby(text))
            mark = "OK" if lo <= n <= hi else f"**範囲外 {lo}〜{hi}**"
            print(f"{emperor_id}: {field} = {n}字 {mark}")
            if not (lo <= n <= hi):
                errors.append(f"{emperor_id}: {field} が {n}字（{lo}〜{hi}字）")

        if desc:
            print(f"{emperor_id}: description 先頭70字 → {desc[:70]}")

        if args.basis_corpus and profile.get("basis"):
            check_basis_corpus(emperor_id, profile["basis"])

    if notices:
        print("\n報告:")
        for m in notices:
            print(f"  {m}")

    if errors:
        print(f"\n{len(errors)} 件のエラー:", file=sys.stderr)
        for m in errors:
            print(f"  - {m}", file=sys.stderr)
        return 1
    print("\nOK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
