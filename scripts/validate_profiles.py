#!/usr/bin/env python3
"""紹介文（data/emperor-profiles.json・GitHub Issue #16）の機械ゲート。

ルビ記法・総ルビ充足・固有名詞の読みは scripts/validate_readings.py が見る。
**こちらが見るのは文章としての体裁と、365本を機械的に量産していないこと。**

1. 存在しない皇帝id・空フィールド（前者はサイト側のビルド assert と二重）
2. 文字数 — lead 200〜300字・description 100〜140字。**ルビを剥がしたあと**で数える
   （記法込みだと250字の lead が600字級になり上下限が意味を失う）
3. description が平文であること（<meta>・JSON-LD にしか出ないのでルビは書かない）
4. meta.counts.written が profiles の実数と合っていること
5. 重複 n-gram — 全 lead で 12-gram を数え、3本以上に出るものを**報告する**
   （エラーにはしない）。Issue #16 の「一人ずつ作成する」に対する唯一の機械的な担保で、
   定型文で埋めた場合ここに一気に出る。共通の言い回し（「数え50歳だった」等）も
   拾うので、件数ではなく中身を人が見るためのもの
6. 在位年 — 本文に出る「前221年」「1735年」のような年が emperors.json の在位年・
   生没年のどれかと一致すること。**在位期間の外の年に言及することはある**
   （即位前の経歴・後世の評価）ので、レコードのどの年とも一致しない年だけ報告する

使い方: python3 scripts/validate_profiles.py
"""

from __future__ import annotations

import collections
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EMPERORS = ROOT / "data" / "emperors.json"
PROFILES = ROOT / "data" / "emperor-profiles.json"

RUBY = re.compile(r"｜([^｜《》]+)《([^｜《》]+)》")
# 「前221年」「1735年」。ルビを剥がしたあとの本文に当てる。
# 「約11年」「11年間」「3年目」は年号ではなく期間なので除外する。
YEAR = re.compile(r"(?<!約)(前)?(?<![0-9])(\d{1,4})\s*年(?![間目])")

LEAD_MIN, LEAD_MAX = 200, 300
DESC_MIN, DESC_MAX = 100, 140
NGRAM = 12
NGRAM_REPORT_AT = 3

errors: list[str] = []
notices: list[str] = []


def strip_ruby(text: str) -> str:
    return RUBY.sub(r"\1", text)


def years_of(e: dict) -> set[int]:
    """レコードが持っている年（負なら紀元前）。"""
    out: set[int] = set()
    summary = e.get("reignSummary") or {}
    for key in ("firstStartYear", "lastEndYear"):
        if isinstance(summary.get(key), int):
            out.add(summary[key])
    for r in e.get("reigns") or []:
        for key in ("startYear", "endYear"):
            if isinstance(r.get(key), int):
                out.add(r[key])
    ages = e.get("ages") or {}
    for key in ("birthDate", "deathDate"):
        v = ages.get(key)
        if isinstance(v, str) and v:
            # "-0258-01" / "1735-10-08"
            m = re.match(r"^(-?)0*(\d+)", v)
            if m:
                out.add(-int(m.group(2)) if m.group(1) else int(m.group(2)))
    return out


def main() -> int:
    emperors = json.loads(EMPERORS.read_text(encoding="utf-8"))
    by_id = {e["id"]: e for e in emperors["emperors"]}
    data = json.loads(PROFILES.read_text(encoding="utf-8"))
    profiles = data["profiles"]

    leads: dict[str, str] = {}
    for emperor_id, profile in profiles.items():
        record = by_id.get(emperor_id)
        if record is None:
            errors.append(f"存在しない皇帝id「{emperor_id}」")
            continue

        for field, (lo, hi) in (
            ("lead", (LEAD_MIN, LEAD_MAX)),
            ("description", (DESC_MIN, DESC_MAX)),
        ):
            text = profile.get(field)
            if text is None:
                errors.append(f"「{emperor_id}」に {field} がありません")
                continue
            if not text.strip():
                errors.append(f"「{emperor_id}」の {field} が空です")
                continue
            plain = strip_ruby(text)
            if not lo <= len(plain) <= hi:
                errors.append(
                    f"「{emperor_id}」の {field} は {len(plain)}字"
                    f"（{lo}〜{hi}字・ルビを剥がした長さで数える）"
                )

        description = profile.get("description") or ""
        if any(c in description for c in "｜《》"):
            errors.append(
                f"「{emperor_id}」の description にルビ記法があります"
                "（<meta>・JSON-LD 専用なので平文で書く）"
            )

        lead = profile.get("lead")
        if lead:
            leads[emperor_id] = strip_ruby(lead)

        known = years_of(record)
        for text in (strip_ruby(profile.get("lead") or ""), description):
            for bc, digits in YEAR.findall(text):
                year = -int(digits) if bc else int(digits)
                if known and year not in known:
                    notices.append(
                        f"「{emperor_id}」の本文にある{'前' if bc else ''}{digits}年は"
                        f"レコードの在位年・生没年のどれとも一致しません"
                    )

    written = len(profiles)
    if data["meta"]["counts"].get("written") != written:
        errors.append(
            f"meta.counts.written が {data['meta']['counts'].get('written')} ですが"
            f"実数は {written} 本です（同時に更新する）"
        )
    if data["meta"]["counts"].get("total") != len(by_id):
        errors.append(
            f"meta.counts.total が {data['meta']['counts'].get('total')} ですが"
            f"収録人数は {len(by_id)} 人です"
        )

    # 5. 定型文の検出。
    seen: dict[str, list[str]] = collections.defaultdict(list)
    for emperor_id, plain in leads.items():
        for gram in {plain[i : i + NGRAM] for i in range(len(plain) - NGRAM + 1)}:
            seen[gram].append(emperor_id)
    shared = {g: ids for g, ids in seen.items() if len(ids) >= NGRAM_REPORT_AT}

    print(f"紹介文: {written}/{len(by_id)} 本")
    if shared:
        print(f"\n{NGRAM}字が {NGRAM_REPORT_AT} 本以上で共通している箇所 {len(shared)} 件（要目視）:")
        for gram, ids in sorted(shared.items(), key=lambda kv: -len(kv[1]))[:20]:
            print(f"  - 「{gram}」 {len(ids)}本: {'・'.join(ids[:6])}")

    if notices:
        print(f"\n年の照合 {len(notices)} 件（在位期間外への言及なら問題なし）:")
        for m in notices[:40]:
            print(f"  - {m}")

    if errors:
        print(f"\n{len(errors)} 件のエラー:", file=sys.stderr)
        for m in errors:
            print(f"  - {m}", file=sys.stderr)
        return 1
    print("\nエラーなし")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
