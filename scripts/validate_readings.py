#!/usr/bin/env python3
"""ふりがな（ルビ）データの機械ゲート。GitHub Issue #20。

方針の全文は docs/site-design/RUBY_PLAN_2026-08-01.md。検査するのは次の4つ。

1. 平文一致 — data/name-readings.json は「平文をキー、ルビ記法を値」に持つ。
   値からルビを剥がした結果がキーと一致すること（親文字の打ち間違いを落とす）
2. ルビの本数 — 紹介文の lead・body（data/emperor-profiles.json）に振られたルビの
   **本数を数えて出すだけ**で、エラーにはしない。**description はルビを持たず平文**
   （<meta>・JSON-LD にしか出ないので、ルビを書いても画面に出ない）

   **2026-08-05 に「総ルビ充足」（ルビ注釈の外に漢字を1文字も残さない）をやめた**
   （ユーザー決定）。ルビは難読語・中国史特有の語に限り、日本人が普通に読める漢字には
   振らない。**どの語が難読かは機械では決まらない**ので、ここで検査できるのは記法（4）と
   読みの整合（3）だけになる。件数を必ず出すのは、0件が「振る語が無かった」のか
   「振り忘れた」のかを人が見て区別できるようにするため。
3. 固有名詞整合 — lead・body で振ったルビのうち、親文字が読みテーブルに載っている
   2字以上のものは、テーブルと同じ読みであること（向きは本文→テーブル。
   逆向きが成立しない理由は該当箇所のコメント）
4. 記法そのもの — 裸の ｜《》 が無いこと、ルビがかなだけで書かれていること

**キーが実在するかはここでは検査しない。** 画面に出る文字列の正はサイト側で、
時代ラベル15区分・王朝名の時代サフィックス（「呉・三国」）・カードの補助名は
data/emperors.json に無い形で作られる。未登録の表示名は
site/src/lib/name-readings.ts の rubyOf がビルド時に throw して落とす
（＝取りこぼしの検出はビルド側が持っている）。ここでは data 由来でないキーの
件数だけ出す。

捕まえられないのは一般語彙の誤読（「行った」＝いった／おこなった）。そこは
執筆時の人手レビューに残る（紹介文は編集コンテンツで原典調査の対象外）。

使い方: python3 scripts/validate_readings.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import profile_prose  # noqa: E402  （ルビ漏れ・訓読調。check_profile_fragment.py と共有）

ROOT = Path(__file__).resolve().parent.parent
EMPERORS = ROOT / "data" / "emperors.json"
READINGS = ROOT / "data" / "name-readings.json"
PROFILES = ROOT / "data" / "emperor-profiles.json"

# site/src/lib/ruby.ts の RUBY_PATTERN と同じもの。片方だけ変えないこと。
RUBY = re.compile(r"｜([^｜《》]+)《([^｜《》]+)》")
KANA_ONLY = re.compile(r"^[ぁ-ゖァ-ヺー・ゝゞヽヾ]+$")
# 常用漢字だけでなく異体字・拡張漢字（皇帝名に多い）も拾う。
KANJI = re.compile(r"[㐀-鿿豈-﫿]|[\U00020000-\U0003ffff]")

errors: list[str] = []


def err(message: str) -> None:
    errors.append(message)


def strip_ruby(text: str) -> str:
    return RUBY.sub(r"\1", text)


def strip_ruby_reading(annotated: str) -> str:
    """ルビ記法から読みだけを取り出す（エラー文で「かん」だけを見せるため）。"""
    return "".join(reading for _, reading in RUBY.findall(annotated))


def check_notation(text: str, label: str) -> None:
    """4. 記法そのもの。"""
    rest = RUBY.sub("", text)
    for char in "｜《》":
        if char in rest:
            err(f"{label}: 対にならない「{char}」があります → {text}")
    for _, reading in RUBY.findall(text):
        if not KANA_ONLY.match(reading):
            err(f"{label}: ルビはかなのみで書きます → 「{reading}」")


def displayed_strings(emperors: dict) -> set[str]:
    """画面に出る名称（皇帝の表示名・諱・廟号・諡号＋政権ラベル＋時代ラベル）。"""
    out: set[str] = set()
    for e in emperors["emperors"]:
        n = e["name"]
        display = (
            n.get("commonName")
            or n.get("personalName")
            or n.get("templeName")
            or n.get("posthumousName")
        )
        for s in (display, n.get("personalName"), n.get("templeName"), n.get("posthumousName")):
            if s:
                out.add(s)
    for r in emperors["meta"]["catalogs"]["regimes"]:
        out.add(r["label"])
    for era in emperors["meta"]["catalogs"]["eras"]:
        out.add(era["label"])
    return out


def main() -> int:
    emperors = json.loads(EMPERORS.read_text(encoding="utf-8"))
    readings = json.loads(READINGS.read_text(encoding="utf-8"))["names"]
    displayed = displayed_strings(emperors)

    for plain, annotated in readings.items():
        label = f"name-readings.json「{plain}」"
        check_notation(annotated, label)
        stripped = strip_ruby(annotated)
        if stripped != plain:
            err(f"{label}: ルビを剥がすと「{stripped}」になります（キーと1文字ずつ一致させる）")


    profiles = json.loads(PROFILES.read_text(encoding="utf-8"))
    lexicon = profile_prose.load_lexicon()
    emperor_ids = {e["id"] for e in emperors["emperors"]}
    written = 0
    ruby_counts: dict[str, int] = {}
    for emperor_id, profile in profiles["profiles"].items():
        if emperor_id not in emperor_ids:
            err(f"emperor-profiles.json: 存在しない皇帝id「{emperor_id}」")

        # description はルビを持たない（平文で保存する・2026-08-01 決定）。
        # 出力先が <meta> と JSON-LD だけで必ず strip されるため、ルビを持たせても
        # 画面に出ない一方、記法エラーの面積と執筆量だけが倍になる。
        description = profile.get("description")
        if description:
            written += 1
            if RUBY.search(description) or any(c in description for c in "｜《》"):
                err(
                    f"emperor-profiles.json「{emperor_id}」の description: "
                    "ここはルビを振らず平文で書きます（<meta>・JSON-LD にしか出ないため）"
                )

        for field in ("lead", "body"):
            text = profile.get(field)
            if not text:
                continue
            written += 1
            label = f"emperor-profiles.json「{emperor_id}」の {field}"
            check_notation(text, label)
            # 2. ルビの本数を数える（エラーにはしない・2026-08-05）。
            #
            # 総ルビをやめた以上、「振り漏れ」は機械では定義できない — 難読かどうかは
            # 語ごとの判断で、ルビの無い漢字が残っているのが正常な状態になった。
            # ここで数えた本数は最後にまとめて出す（0件を人が見て気づけるように）。
            ruby_counts[f"{emperor_id}/{field}"] = len(RUBY.findall(text))
            # 3. 固有名詞整合: 本文で振ったルビが読みテーブルと矛盾しないこと。
            #
            # **向きは「本文のルビ注釈 → テーブル」で、逆ではない。** 逆向き
            #（テーブルのキーが本文に現れたら同じ literal を要求する）は素の部分文字列
            # 一致になるため、885キー中352キーが2字以下・21キーが1字という実データでは
            # 総ルビの本文がまず通らない: 「｜光武帝《こうぶてい》」は「武帝」キーで、
            #「｜前漢《ぜんかん》」は「漢」キーで、一般語彙の「｜元号《げんごう》」まで
            #「元」キーで落ちる。
            #
            # 1字キー（元・唐・漢・明・清…の21件）は一般語彙と衝突するので照合しない
            #（王朝名1字の読みは自明で、取り違えは人手レビューで足りる）。
            for parent, reading in RUBY.findall(text):
                if len(parent) < 2:
                    continue
                expected = readings.get(parent)
                if expected and expected != f"｜{parent}《{reading}》":
                    err(
                        f"{label}: 「{parent}」の読みが読みテーブルと違います → "
                        f"本文「{reading}」／テーブル「{strip_ruby_reading(expected)}」"
                    )

        # 5. ルビの振り漏れ・6. 漢文訓読調（2026-08-05・実装は scripts/profile_prose.py）。
        #
        # **lead と body をつないで見る**（欄が違っても同じ1本の紹介文で、実際に
        # 「挟書律」は lead に振って body で素通りしていた）。断片側の
        # check_profile_fragment.py と同じ関数を呼ぶので、片方だけ直さないこと。
        joined = f"{profile.get('lead') or ''}\n{profile.get('body') or ''}"
        if joined.strip():
            label = f"emperor-profiles.json「{emperor_id}」"
            for term, n, how in profile_prose.missing_ruby(joined, lexicon):
                err(f"{label}: 「{term}」にルビがありません（{n}箇所）→ {how} を"
                    f"**{n}箇所すべて**に振る（2回目以降も振る）")
            for word, n, how in profile_prose.archaic_hits(joined):
                err(f"{label}: 漢文訓読調の「{word}」（{n}箇所）→ {how} に書き換える")

    total = len(displayed)
    done = len(displayed & set(readings))
    site_only = len(set(readings) - displayed)
    print(f"読みテーブル: {len(readings)} 行（data 由来の名称 {done}/{total} 件・"
          f"サイト固有の表示名 {site_only} 件）")
    print(f"紹介文: {written} 本ぶんのルビを検査")
    if ruby_counts:
        total_ruby = sum(ruby_counts.values())
        zero = [k for k, v in ruby_counts.items() if v == 0]
        print(f"  ルビ本数: 合計 {total_ruby} 件 / {len(ruby_counts)} 欄"
              f"（1欄あたり平均 {total_ruby / len(ruby_counts):.1f} 件）")
        if zero:
            print(f"  ルビ0件の欄 {len(zero)} 件: {'、'.join(sorted(zero)[:10])}"
                  + ("…" if len(zero) > 10 else ""))

    if errors:
        print(f"\n{len(errors)} 件のエラー:", file=sys.stderr)
        for message in errors:
            print(f"  - {message}", file=sys.stderr)
        return 1
    print("エラーなし")
    return 0


if __name__ == "__main__":
    sys.exit(main())
