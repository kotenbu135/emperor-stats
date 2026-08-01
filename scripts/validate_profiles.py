#!/usr/bin/env python3
"""紹介文（data/emperor-profiles.json・GitHub Issue #16）の機械ゲート。

ルビ記法・総ルビ充足・固有名詞の読みは scripts/validate_readings.py が見る。
**こちらが見るのは文章としての体裁と、365本を機械的に量産していないこと。**

1. 存在しない皇帝id・空フィールド（前者はサイト側のビルド assert と二重）
2. 文字数 — lead 150〜600字・description 100〜140字。**ルビを剥がしたあと**で数える
   （記法込みだと500字の lead が1200字級になり上下限が意味を失う）
3. description が平文であること（<meta>・JSON-LD にしか出ないのでルビは書かない）
4. meta.counts.written が profiles の実数と合っていること／lead があるのに basis が空でないこと
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
#
# 本文には期間の表現（「約11年」「7年のあいだ」「在位13年」「2年後」）が年号と
# 同じ形で出るので、**「前」付きは何桁でも年号・「前」無しは3桁以上だけ年号**とみなす。
# 西暦2桁の年（光武帝の25年など）は取りこぼすが、こちらは報告漏れで済む一方、
# 誤検知を放置すると365本ぶんの通知に埋もれて本物の当たりが見えなくなる。
YEAR = re.compile(r"(?<![0-9])(?:(前)(\d{1,4})|(?:(\d{3,4})))\s*年(?![間目後])")

# lead の幅が広いのは、書ける量が人物によって桁で違うため（2026-08-01 方針転換）。
# 逸話を交えた人物紹介にしたので、本紀に記述の厚い皇帝は500字級になり、
# 『遼史』が「即位し、在位13年で没した」しか伝えない西遼仁宗のような人物では
# 200字も書けない。下限を上に置くと、素材の無い人物で骨組みの使い回しが起きる。
LEAD_MIN, LEAD_MAX = 150, 600
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
            # "-0258-01" / "1735-10-08"。
            #
            # **ages の日付は天文年表記（0年あり）で、reigns の startYear/endYear
            # とは1年ずれる。** 始皇帝は reigns.endYear=-210（前210年）に対し
            # ages.deathDate="-0209-09-10" で、どちらも前210年を指す。
            # 揃えずに同じ集合へ入れると、本文の「前259年生まれ」（正しい）が
            # 誤検知され、「前209年に没した」（天文年表記のままの誤り）が素通しする
            # ——このリポジトリが実際に2回踏んで conversion note に記録した
            # off-by-one を、検出するはずのゲートが逆に許すことになる。
            m = re.match(r"^(-?)0*(\d+)", v)
            if m:
                n = int(m.group(2))
                out.add(-(n + 1) if m.group(1) else n)
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

        # basis — その紹介文を何で裏付けたかの覚え書き（サイトには出さない）。
        #
        # 逸話を書くようになった時点（2026-08-01 の方針転換）で、「素材は既存の
        # 調査結果だけ」という制約そのものが持っていた検証手段が消えた。
        # verify_quotes.py は原文引用しか見ず、このスクリプトは文字数と n-gram しか
        # 見ないので、**どこから来た記述かを書き手が残さないと後から追えない。**
        # 365本書き終えてから1本ずつ裏を取り直すことはできない。
        if profile.get("lead") and not (profile.get("basis") or "").strip():
            errors.append(
                f"「{emperor_id}」に basis がありません"
                "（何を読んで書いたか。例: 史記 巻六 秦始皇本紀〔徐巿・阿房宮・焚書〕）"
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
            for bc, bc_digits, ad_digits in YEAR.findall(text):
                digits = bc_digits or ad_digits
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
