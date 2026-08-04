#!/usr/bin/env python3
"""紹介文を外部レビュー（Gemini など）へ出すための平文ファイルを書き出す。

**会話からコピーして渡さないための道具。** 2026-08-04 に胡亥の紹介文を会話経由で
Gemini へ渡したところ、写しが6箇所で途中欠けし、レビューアはそこを推測で埋めた。
埋めた内容には史実の誤りが混じっていた（本紀「山東郡県の少年、皆その守尉令丞を殺す」を
「山東の豪傑たちが郡県の長官を殺して」と復元した）。**欠けたテキストのレビューは、
指摘が減るのではなく誤りが増える。**

対策は3つ入れてある。

1. **ファイルを渡す**（貼り付けない）。Gemini のウェブ画面にはファイルを添付できる
2. **先頭に行数と本文字数を書く。** 受け取った側が「行数が合わない＝途中で切れている」と
   気づけるようにする。レビュー依頼文の中でもそう指示している
3. **リライト案を求めない。** 指摘だけを表で返させる。上の誤りは「欠けた箇所を埋めた
   リライト案」として出てきたもので、書き直しを頼まなければ混入しない
   （このリポジトリの「レビュー依頼は報告のみ」と同じ扱い）

使い方:
    python3 scripts/export_profile_review.py qin-shi-huang qin-er-shi
    python3 scripts/export_profile_review.py qin-er-shi --with-source   # 本紀原文を同梱
    python3 scripts/export_profile_review.py --all-new                  # 節見出しを持つ本すべて

出力は `review/<皇帝id>.md`（`.gitignore` 対象・`--out` で変更可）。
`--with-source` は `_corpus_cache/<id>.txt` を末尾に付ける。原文を同梱すると
「本文の事実が原文に在るか」まで見てもらえるが、ファイルは数倍になる。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EMPERORS = ROOT / "data" / "emperors.json"
PROFILES = ROOT / "data" / "emperor-profiles.json"
# _corpus_cache は worktree では symlink（scripts/setup_worktree.sh が張る）。
CACHE_DIRS = [ROOT / "_corpus_cache", Path("/home/sakis/emperor-stats/_corpus_cache")]

RUBY = re.compile(r"｜([^｜《》]+)《([^｜《》]+)》")

# レビュー依頼文。もとは docs/process/profile-writing/STYLE.md の要約だったが、
# **2026-08-04 に STYLE.md ごと文体規範を削除した**（紹介文76本も全削除）。
# 規範を立て直したら、この文もその要約に差し替えること
# （ずれたまま使うと外部レビューが我々の規約ではなく一般論で採点し始める）。
BRIEF = """\
# 紹介文レビューのお願い

中国皇帝365人のデータセットを公開しているサイト（emperorstats.com）の、皇帝1人ぶんの
紹介文です。**指摘だけをください。書き直し案は不要です。**

## 書き直し案を求めない理由

以前このレビューを頼んだとき、渡した文章が途中で欠けており、レビューアが欠落部分を
推測で埋めたリライト案を返しました。その推測に史実の誤りが混じっていました
（正史『史記』の「山東郡県の少年、皆その守尉令丞を殺す」を「山東の豪傑たちが郡県の
長官を殺して」と復元していた）。**欠けた文章を書き直すと、指摘が減るのではなく誤りが
増えます。** そこで指摘だけをお願いしています。

## 途中で切れていないかの確認

このファイルは全 {lines} 行・本文 {chars} 字です。**受け取った内容がこれと合わない場合は
途中で欠けているので、レビューせずにその旨を教えてください。**「文章が中抜けしている」
という指摘は、こちらの原稿ではなく受け渡しの問題です。

## 見てほしい観点

この紹介文には守るべき文体規約があります。**一般的な文章の良し悪しではなく、
次の規約に照らして見てください。**

1. **人物の内心を断定していないか** — 「〜と考えた」「〜を望んだ」「〜を恐れた」は、
   史料自身がその心情を書いている場合を除いて誤りです。史料にある発言・詔・行動で示します
2. **時制が過去形にそろっているか** — 歴史的現在（「継ぐ」「定める」「上奏する」）の混在
3. **節見出しが内容を指す名詞句か** — 本文中の発言をそのまま見出しにしたもの、
   口語的な比喩は不可
4. **漢文訓読調の硬い語が残っていないか** — 没する／諫める／誹る／上書する／逡巡する など。
   現代の日本語で言い直します。古代の器物に現代語を当てるのも不可（「機械」「自動で」）
5. **主語が落ちていないか** — 節や段落の頭、動作の主体
6. **敬称・賛辞・主観的評価を書いていないか** — 「名君」「暗愚」「英明な」
7. **一度読んで頭に入るか** — 歴史の読み物として自然か。読者は専門家ではありません
8. **事実として疑わしい箇所** — 通説と違って見えるところがあれば挙げてください。
   ただし**このデータセットは正史の原文を根拠にしており、通説と違うのは意図的なことが
   あります**（例: 『史記』に「坑儒」の語は無い、兵馬俑は史書に記述が無い）。
   「通説ではこう言われている」という形で挙げてもらえれば、こちらで原文に当て直します

## 返し方

次の表だけを返してください。

| 箇所 | 種別（上の1〜8） | 指摘 |
|---|---|---|
| [12] | 1 | 「〜と考えた」は内心の断定 |

**箇所は本文に付けた [番号] で指してください。**
"""


def strip_ruby(text: str) -> str:
    return RUBY.sub(r"\1", text)


def cache_path(emperor_id: str) -> Path | None:
    for d in CACHE_DIRS:
        p = d / f"{emperor_id}.txt"
        if p.exists():
            return p
    return None


def facts_of(record: dict) -> list[str]:
    """本文と突き合わせられる確定値だけを並べる（判定の根拠 note は出さない）。"""
    name = record.get("name") or {}
    summary = record.get("reignSummary") or {}
    ages = record.get("ages") or {}
    out = [f"- 通用名: {name.get('commonName')}"]
    if name.get("familyName") or name.get("personalName"):
        out.append(f"- 姓: {name.get('familyName') or '—'} ／ 諱: {name.get('personalName') or '—'}")

    def year(v):
        return f"前{-v}年" if isinstance(v, int) and v < 0 else (f"{v}年" if v else "—")

    out.append(
        f"- 在位: {year(summary.get('firstStartYear'))}〜{year(summary.get('lastEndYear'))}"
        f"（{summary.get('reignCount')}期）"
    )
    if ages.get("accessionAge"):
        out.append(f"- 即位時の年齢（数え）: {ages['accessionAge']}")
    if ages.get("deathAge"):
        out.append(f"- 没年齢（数え）: {ages['deathAge']}")
    route = (record.get("accessionRoute") or {}).get("categoryId")
    cause = (record.get("deathCause") or {}).get("category")
    if route:
        out.append(f"- 即位経路の区分: {route}")
    if cause:
        out.append(f"- 死因の区分: {cause}")
    return out


def numbered(lead: str, body: str) -> tuple[list[str], int]:
    """段落と見出しに [番号] を振る。レビューの指摘がどこを指すか一意にするため。"""
    blocks: list[tuple[str, str]] = [("概要", strip_ruby(lead))]
    for raw in (body or "").split("\n\n"):
        raw = strip_ruby(raw).strip()
        if not raw:
            continue
        blocks.append(("見出し", raw[3:]) if raw.startswith("## ") else ("段落", raw))
    lines: list[str] = []
    chars = 0
    for i, (kind, text) in enumerate(blocks, start=1):
        chars += len(text)
        lines.append(f"[{i}] 【{kind}】{text}" if kind == "見出し" else f"[{i}] {text}")
        lines.append("")
    return lines, chars


def build(emperor_id: str, record: dict, profile: dict, with_source: bool) -> str:
    body_lines, chars = numbered(profile.get("lead") or "", profile.get("body") or "")
    parts: list[str] = []
    parts.append("{{BRIEF}}")
    parts.append(f"\n---\n\n# 対象: {record['name'].get('commonName')}（{emperor_id}）\n")
    parts.append("調査済みの確定値です。**本文がこれと食い違っていたら指摘してください。**\n")
    parts.extend(facts_of(record))
    parts.append("\n---\n\n# 本文\n")
    parts.extend(body_lines)
    parts.append("---\n")
    parts.append(f"# 検索結果に出る1文（{len(profile.get('description') or '')}字）\n")
    parts.append(profile.get("description") or "")

    if with_source:
        path = cache_path(emperor_id)
        if path is None:
            parts.append("\n---\n\n（本紀の原文キャッシュが無いので同梱していません）")
        else:
            parts.append(
                "\n---\n\n# 根拠にした正史の原文\n\n"
                "本文はこの原文だけを根拠にしています（例外は本文中に出所を書いてあります）。"
                "**簡体字**で、行頭の数字は行番号です。\n\n```"
            )
            parts.append(path.read_text(encoding="utf-8").rstrip())
            parts.append("```")

    text = "\n".join(parts)
    # 行数は**依頼文を差し込んだあとの全体**で数える。差し込む前の数を書くと、
    # 受け取った側の「行数が合わない＝途中で切れている」という判定が常に誤検知になる
    # ——この行数はファイルが欠けたことを見つけるためだけに置いてあるので、
    # 合わないのが既定では意味が無い。差し込みで行数は変わらないので2回に分ける。
    lines = text.replace("{{BRIEF}}", BRIEF.format(lines=0, chars=chars), 1).count("\n") + 1
    return text.replace("{{BRIEF}}", BRIEF.format(lines=lines, chars=chars), 1)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*", help="皇帝id")
    ap.add_argument("--all-new", action="store_true", help="節見出しを持つ本すべて（新文体）")
    ap.add_argument("--with-source", action="store_true", help="本紀の原文キャッシュを同梱")
    ap.add_argument("--out", default="review", help="出力先ディレクトリ（既定: review/）")
    args = ap.parse_args()

    emperors = json.loads(EMPERORS.read_text(encoding="utf-8"))
    by_id = {e["id"]: e for e in emperors["emperors"]}
    profiles = json.loads(PROFILES.read_text(encoding="utf-8"))["profiles"]

    ids = list(args.ids)
    if args.all_new:
        ids += [i for i, p in profiles.items() if "## " in (p.get("body") or "") and i not in ids]
    if not ids:
        ap.error("皇帝id か --all-new が要ります")

    out_dir = ROOT / args.out
    out_dir.mkdir(parents=True, exist_ok=True)
    for emperor_id in ids:
        if emperor_id not in profiles:
            print(f"{emperor_id}: 紹介文がありません", file=sys.stderr)
            return 1
        if emperor_id not in by_id:
            print(f"{emperor_id}: 存在しない皇帝id", file=sys.stderr)
            return 1
        text = build(emperor_id, by_id[emperor_id], profiles[emperor_id], args.with_source)
        path = out_dir / f"{emperor_id}.md"
        path.write_text(text + "\n", encoding="utf-8")
        print(f"{path.relative_to(ROOT)}  {len(text):,}字 / {text.count(chr(10)) + 1}行")

    print("\nGemini のウェブ画面へは**ファイルとして添付**する（貼り付けない）。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
