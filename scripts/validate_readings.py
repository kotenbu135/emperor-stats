#!/usr/bin/env python3
"""ふりがな（ルビ）データの機械ゲート。GitHub Issue #20。

方針の全文は docs/site-design/RUBY_PLAN_2026-08-01.md。検査するのは次の4つ。

1. 平文一致 — data/name-readings.json は「平文をキー、ルビ記法を値」に持つ。
   値からルビを剥がした結果がキーと一致すること（親文字の打ち間違いを落とす）
2. 総ルビ充足 — 紹介文（data/emperor-profiles.json）はルビ注釈の外に漢字を
   1文字も残さないこと（振り漏れを落とす）
3. 固有名詞整合 — 紹介文の中に読みテーブルのキー文字列が現れる箇所は、
   そのルビがテーブルの値と一致すること
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
    emperor_ids = {e["id"] for e in emperors["emperors"]}
    written = 0
    for emperor_id, profile in profiles["profiles"].items():
        if emperor_id not in emperor_ids:
            err(f"emperor-profiles.json: 存在しない皇帝id「{emperor_id}」")
        for field in ("lead", "description"):
            text = profile.get(field)
            if not text:
                continue
            written += 1
            label = f"emperor-profiles.json「{emperor_id}」の{field}"
            check_notation(text, label)
            # 2. 総ルビ充足: ルビ注釈の外に漢字が残っていないこと
            outside = RUBY.sub("", text)
            missed = KANJI.findall(outside)
            if missed:
                err(f"{label}: ルビの無い漢字があります → {''.join(dict.fromkeys(missed))}")
            # 3. 固有名詞整合: 読みテーブルにある名前は同じ読みで振ること
            for plain, annotated in readings.items():
                if plain in strip_ruby(text) and annotated not in text:
                    err(
                        f"{label}: 「{plain}」は読みテーブルの「{annotated}」と"
                        "同じ振り方にしてください"
                    )

    total = len(displayed)
    done = len(displayed & set(readings))
    site_only = len(set(readings) - displayed)
    print(f"読みテーブル: {len(readings)} 行（data 由来の名称 {done}/{total} 件・"
          f"サイト固有の表示名 {site_only} 件）")
    print(f"紹介文: {written} 本ぶんのルビを検査")

    if errors:
        print(f"\n{len(errors)} 件のエラー:", file=sys.stderr)
        for message in errors:
            print(f"  - {message}", file=sys.stderr)
        return 1
    print("エラーなし")
    return 0


if __name__ == "__main__":
    sys.exit(main())
