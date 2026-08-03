#!/usr/bin/env python3
"""紹介文の断片（1人ぶん）を、data/emperor-profiles.json へ入れる前に見る。

既存のゲートは**ファイル全体**に掛かる（validate_profiles.py・validate_readings.py）ので、
1人ぶんの書き上がりを確かめるには add_profile.py で本体へ入れてしまう必要があった。
それでは書き直しのたびに共有ファイルを触ることになり、並行執筆と相性が悪い。

実際に繰り返し出ている外し方は決まっている（三国11人のうち5人で body が上限超過・
かなの前の裸の ｜・読みテーブルと違う切り方・description にルビ）。ここで先に落とす。

使い方:
    python3 scripts/check_profile_fragment.py <断片.json> [--basis-corpus]

断片は {"<皇帝id>": {"lead": ..., "body": ..., "description": ..., "basis": ..., "claims": [...]}}。
--basis-corpus を付けると basis に並べた原文断片が本紀キャッシュに実在するかを
**報告**する（エラーにはしない）。キャッシュは簡体字・繁体字が混在した基準で書かれる
ため hanzi_norm で両側をそろえて突き合わせる。書き手のコーパス読みが空振りしたまま
記憶で書いた場合に気づくための、唯一の機械的な手がかり。

`claims` は 2026-08-02 に足した**引用台帳**（断片の中だけで使う。`add_profile.py` は
FIELDS しか転記しないので `data/emperor-profiles.json` には入らない）。
[{"text": "本文で書いた事実", "quote": "根拠の原文句", "src": "ファイル:行"}] の配列で、
**本文を書く前に原文から作る**のが執筆手順（`WRITER_TEMPLATE.md`）。ここでは
quote の実在照合と、本文に出てくる年・数値が台帳にあるかを**報告**する。
台帳の無い断片は警告のみ（2026-08-02 以前に書いた断片を落とさないため）。
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

# scripts/validate_profiles.py の LEAD_MIN/BODY_MAX と同じ値。片方だけ変えないこと。
LIMITS = {"lead": (70, 260), "body": (100, 2200), "description": (100, 140)}

EMPERORS = ROOT / "data" / "emperors.json"

# 本文の続柄語 → accessionRoute.axes.relationToPredecessor の値。
# **長いものから**当てる（「兄の子」を「兄」より先に、「従兄」を「兄」より先に、
# 「叔父」を「父」より先に）。世代が1つずれる取り違えが検証段で最も多く出ており、
# その型を執筆段のうちに見せるためだけの表。**照合は報告で、判定はしない**
# ——本文の続柄語が前任者を指しているとは限らない（別人の弟・別人の子を書いていることがある）。
RELATION_WORDS: list[tuple[str, str]] = [
    ("兄の子", "nephew"),
    ("弟の子", "nephew"),
    ("従兄弟", "cousin"),
    ("いとこ", "cousin"),
    ("従兄", "cousin"),
    ("従弟", "cousin"),
    ("従子", "nephew"),
    ("族子", "distant-kin"),
    ("族弟", "distant-kin"),
    ("族兄", "distant-kin"),
    ("養子", "adopted-son"),
    ("叔父", "uncle-younger"),
    ("伯父", "uncle-elder"),
    ("従父", "uncle-younger"),
    ("甥", "nephew"),
    ("孫", "grandson"),
    ("兄", "elder-brother"),
    ("弟", "younger-brother"),
    ("子", "son"),
    ("母", "mother"),
]
# 「Ａの弟」の形だけ拾う。皇太子・公孫・天子のような続柄でない語を巻き込まないため。
RELATION_RE = re.compile("の(" + "|".join(w for w, _ in RELATION_WORDS) + ")")

errors: list[str] = []
notices: list[str] = []
warnings: list[str] = []


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


def _norm():
    try:
        from hanzi_norm import norm_for_match  # type: ignore
    except ImportError:
        sys.path.insert(0, str(ROOT / "scripts"))
        from hanzi_norm import norm_for_match  # type: ignore
    return norm_for_match


def haystack_for(emperor_id: str) -> str | None:
    path = cache_path(emperor_id)
    if path is None:
        return None
    text = path.read_text(encoding="utf-8")
    # 載記が他人（父・兄）の巻に同居している人物はキャッシュが数百字しか無く、
    # 正しく引いた句もほとんど「未検出」になる。照合が効いていないことを言う
    # ——黙って通ると「確かめた」と読めてしまう。
    if len(text) < 2000:
        notices.append(
            f"{emperor_id}: 本紀キャッシュが {len(text)}字しか無く、原文照合はほとんど効きません"
            "（載記が他人の巻に同居している人物）。未検出が並ぶのは想定内で、出所は自分で確かめること"
        )
    return _norm()(text)


def coverage(fragment: str, haystack: str) -> float:
    """原文断片が haystack にどれだけ乗っているか（最長共通部分列の被覆率）。

    完全一致では取りこぼす。hanzi_norm の新字体表は常用漢字を全部は持っておらず
    （郷→乡・舎→舍 が抜けている）、正しく本紀から引いた断片でも1〜2字ぶん外れる。
    「記憶で書いた」断片は数字と人名しか合わないので 0.5 を割り、正しい引き写しは
    表記ゆれがあっても 0.8 を超える。
    """
    needle = _norm()(fragment)
    matcher = SequenceMatcher(autojunk=False)
    matcher.set_seq2(haystack)
    matcher.set_seq1(needle)
    return matcher.find_longest_match(0, len(needle), 0, len(haystack)).size / max(
        len(needle), 1
    )


def check_basis_corpus(emperor_id: str, basis: str) -> None:
    """basis に並べた原文断片が本紀キャッシュに実在するか（報告のみ）。"""
    haystack = haystack_for(emperor_id)
    if haystack is None:
        notices.append(f"{emperor_id}: 本紀キャッシュが無いので basis の照合を飛ばした")
        return
    runs = [r for r in re.findall(r"[㐀-鿿]{6,}", basis)]
    if not runs:
        notices.append(f"{emperor_id}: basis に6字以上の原文断片が無く照合できない")
        return

    missing = [
        f"{r}（被覆 {c:.0%}）" for r in runs if (c := coverage(r, haystack)) < 0.5
    ]
    hit = len(runs) - len(missing)
    notices.append(f"{emperor_id}: basis の原文断片 {hit}/{len(runs)} 件が本紀キャッシュに実在")
    for r in missing[:12]:
        notices.append(f"    未検出: {r} — 本紀の外（列伝・裴注・他書）なら出所を basis に明記。心当たりが無ければ書いた事実を疑う")


def check_claims(emperor_id: str, profile: dict, use_corpus: bool) -> None:
    """引用台帳（claims）— 本文の事実1つずつに原文句が付いているか。

    台帳そのものは構造をエラーで見るが、**本文との突き合わせは報告**にとどめる。
    年は本文が西暦・原文が元号なので機械照合が成り立たない。台帳へ列挙させること自体が
    目的で、ここは列挙もれを見せる窓口。
    """
    claims = profile.get("claims")
    if not claims:
        warnings.append(
            f"{emperor_id}: claims（引用台帳）がありません — "
            "本文を書く前に原文から作る手順です（WRITER_TEMPLATE.md）"
        )
        return
    if not isinstance(claims, list):
        errors.append(f"{emperor_id}: claims は配列で書きます")
        return

    haystack = haystack_for(emperor_id) if use_corpus else None
    unbacked: list[str] = []
    outside: list[str] = []
    for i, c in enumerate(claims):
        if not isinstance(c, dict) or not c.get("text"):
            errors.append(f"{emperor_id}: claims[{i}] に text がありません")
            continue
        quote = (c.get("quote") or "").strip()
        if not quote:
            unbacked.append(c["text"][:24])
            continue
        if haystack is None:
            continue
        runs = re.findall(r"[㐀-鿿]{6,}", quote)
        if not runs:
            continue
        if max(coverage(r, haystack) for r in runs) < 0.5:
            outside.append(f"{quote[:20]} → {c['text'][:20]}")

    notices.append(f"{emperor_id}: claims {len(claims)} 件")
    for t in unbacked:
        errors.append(f"{emperor_id}: 原文句の無い claim「{t}」— 書かないか、出所を付ける")
    for t in outside[:12]:
        notices.append(
            f"    本紀キャッシュ外の引用: {t} — 列伝・他書なら src に書名を明記。"
            "心当たりが無ければ書いた事実を疑う"
        )

    # 本文の年・回数が台帳のどこにも出てこないもの（報告）。
    ledger = "".join((c.get("text") or "") + (c.get("quote") or "") for c in claims if isinstance(c, dict))
    text = strip_ruby((profile.get("lead") or "") + (profile.get("body") or ""))
    loose = sorted({m for m in re.findall(r"\d+年|\d+歳|\d+人|\d+回|\d+か月", text) if m not in ledger})
    if loose:
        notices.append(f"    台帳に無い数値: {'・'.join(loose[:15])} — 出所を claims に足すか本文から落とす")


def check_relation(emperor_id: str, lead: str, body: str) -> None:
    """本文の続柄語と `relationToPredecessor`（報告のみ）。

    検証段で最も多く出た誤りが「世代が1つずれる」（族子・兄の子・弟の取り違え）で、
    前任者との続柄だけはデータ側に enum がある。**判定はしない** — lead の続柄語が
    前任者を指しているとは限らないので、突き合わせは人がやる。
    """
    if not EMPERORS.exists():
        return
    rel = None
    for e in json.loads(EMPERORS.read_text(encoding="utf-8"))["emperors"]:
        if e["id"] == emperor_id:
            rel = ((e.get("accessionRoute") or {}).get("axes") or {}).get(
                "relationToPredecessor"
            )
            break
    else:
        notices.append(f"{emperor_id}: emperors.json に id が無く続柄の照合を飛ばした")
        return

    # lead に無ければ body の書き出しまで見る（続柄は第1〜2文のどちらかに出る）。
    by_word = dict(RELATION_WORDS)
    scope = strip_ruby(lead)
    found = [f"{w}→{by_word[w]}" for w in RELATION_RE.findall(scope)]
    if not found:
        scope = strip_ruby(body)[:120]
        found = [f"{w}→{by_word[w]}" for w in RELATION_RE.findall(scope)]
    if not found:
        notices.append(f"{emperor_id}: データの前任者続柄 = {rel}（本文の書き出しに続柄語なし）")
        return
    mismatch = len(found) == 1 and rel and not found[0].endswith(rel)
    line = f"{emperor_id}: データの前任者続柄 = {rel} ／ 本文の続柄語 = {'・'.join(found)}"
    if mismatch:
        line += "  ← 食い違いの可能性。**前任者以外との続柄を書いているだけなら無視してよい**"
    notices.append(line)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("fragment")
    ap.add_argument("--basis-corpus", action="store_true")
    args = ap.parse_args()

    fragment = json.loads(Path(args.fragment).read_text(encoding="utf-8"))
    readings = json.loads(READINGS.read_text(encoding="utf-8"))["names"]

    for emperor_id, profile in fragment.items():
        unknown = set(profile) - {"lead", "body", "description", "basis", "claims"}
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
        check_claims(emperor_id, profile, args.basis_corpus)
        if profile.get("lead"):
            check_relation(emperor_id, profile["lead"], profile.get("body") or "")

    if notices:
        print("\n報告:")
        for m in notices:
            print(f"  {m}")

    if warnings:
        print("\n警告（落としはしない）:")
        for m in warnings:
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
