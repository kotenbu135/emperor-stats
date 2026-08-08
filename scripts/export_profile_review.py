#!/usr/bin/env python3
"""紹介文を外部レビュー（Gemini など）へ出すための平文ファイルを書き出す。

**会話からコピーして渡さないための道具。** 2026-08-04 に胡亥の紹介文を会話経由で
Gemini へ渡したところ、写しが6箇所で途中欠けし、レビューアはそこを推測で埋めた。
埋めた内容には史実の誤りが混じっていた（本紀「山東郡県の少年、皆その守尉令丞を殺す」を
「山東の豪傑たちが郡県の長官を殺して」と復元した）。**欠けたテキストのレビューは、
指摘が減るのではなく誤りが増える。**

対策は3つ入れてある。

1. **ファイルを渡す**（会話へ手で写さない）。添付でも貼り付けでもよい
2. **先頭に段落数と通し番号の範囲を書く。** 受け取った側が「番号が飛んでいる・最後の番号で
   終わっていない＝途中で切れている」と気づけるようにする。依頼文の中でもそう指示している。
   **行数では見ない**（2026-08-09） — 添付なら保たれるが、チャットへ貼ると折り返しで必ず
   変わるので、貼った瞬間に誤検知する
3. **リライト案を求めない。** 指摘だけを表で返させる。上の誤りは「欠けた箇所を埋めた
   リライト案」として出てきたもので、書き直しを頼まなければ混入しない
   （このリポジトリの「レビュー依頼は報告のみ」と同じ扱い。加えて、返ってきた文を
   本文へ取り込むと `R-PRIMARY-SOURCE` の「Web の文章は本文へ取り込まない」に触れる）

**渡すのはルビを外した本文**（2026-08-09）。`｜親文字《ルビ》` のままだと、読み物としての
判断が読者の見ない表記に対して下される。ルビは本ごとに `親文字《読み》` の一覧へまとめて
別に出し、読みの誤り・一般語への振りすぎだけをそこで見てもらう。

**観点は `docs/process/profile-writing/README.md` の要約で、機械が見ない所だけを載せる**
（字数・ルビ辞書の充足・12-gram・`ARCHAIC` 語・人名の通用名はゲートと CI が落とすので
外部へ出さない。出すと triage する側の仕事が増えるだけになる）。規範を変えたらこの
`BRIEF` も直す — ずれたまま使うと外部レビューが我々の規約ではなく一般論で採点し始める。

使い方:
    python3 scripts/export_profile_review.py tangmo-huangchao
    python3 scripts/export_profile_review.py tangmo-anlushan tangmo-shisiming --name tangmo
    python3 scripts/export_profile_review.py --section 唐              # researchSection で選ぶ
    python3 scripts/export_profile_review.py tangmo-huangchao --with-source  # 原文を同梱
    python3 scripts/export_profile_review.py tangmo-anlushan tangmo-zhuci --split  # 1人1ファイル

**2人以上は既定で1ファイルにまとめる。** 同じ時代・同じ経路の人物が並ぶバッチでは
「似た言い回し・同じ構成の反復」が最大の欠点になり、それは1本ずつ見ても出ない
（文字どおりの重なりは `check_profile_ngram.py` が落とすが、構成の反復は落ちない）。

出力は `review/`（`.gitignore` 対象・`--out` で変更可）。`--with-source` は
`_corpus_cache/<id>.txt` を末尾に付ける。原文を同梱すると「本文の事実が原文に在るか」まで
見てもらえるが、ファイルは数倍になる（簡体字なので読める相手にだけ）。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
EMPERORS = ROOT / "data" / "emperors.json"
PROFILES = ROOT / "data" / "emperor-profiles.json"
# _corpus_cache は worktree では symlink（scripts/setup_worktree.sh が張る）。
CACHE_DIRS = [ROOT / "_corpus_cache", Path("/home/sakis/emperor-stats/_corpus_cache")]

RUBY = re.compile(r"｜([^｜《》]+)《([^｜《》]+)》")

BRIEF = """\
# 紹介文レビューのお願い（{count}）

中国皇帝365人のデータセットを公開しているサイト（emperorstats.com）の、皇帝個別ページに
出る紹介文です。**指摘だけをください。書き直し案・リライトは不要です。**

正史の原文（本紀・列伝・載記）を1人ぶんずつ読んで書いたもので、事実の根拠はすべて原文側に
あります。ここでお願いしたいのは、**原文を読んだ側では気づけない欠点**の指摘です。

## 書き直し案を求めない理由

以前このレビューを頼んだとき、渡した文章が途中で欠けており、レビューアが欠落部分を
推測で埋めたリライト案を返しました。その推測に史実の誤りが混じっていました
（正史『史記』の「山東郡県の少年、皆その守尉令丞を殺す」を「山東の豪傑たちが郡県の
長官を殺して」と復元していた）。**欠けた文章を書き直すと、指摘が減るのではなく誤りが
増えます。** また、返していただいた文をそのまま本文へ入れることはできません
（本文に置けるのは原文から書き起こした文だけ、という規約があります）。
そこで**指摘だけ**をお願いしています。

## 途中で切れていないかの確認

本文は {chars} 字・{blocks} 段落で、段落には **[{first}] から [{last}] まで通し番号**が
付いています（番号は飛びません）。**受け取った内容で番号が飛んでいる・[{last}] で
終わっていない場合は途中で欠けているので、レビューせずにその旨を教えてください。**
「文章が中抜けしている」という指摘は、こちらの原稿ではなく受け渡しの問題です。

## 見てほしい観点

**一般的な文章の良し悪しではなく、次の観点で見てください。** 字数・用語の統一・
表記ゆれ・禁止語の残りは機械で検査済みなので、挙げていただかなくて大丈夫です。

1. **通説との食い違い** — いちばん価値のある指摘です。年号・数値・序数・因果関係で
   「一般に言われていることと違う」箇所があれば挙げてください。ただし**このデータセットは
   正史の原文を根拠にしており、割れたときは原文を採ります**（例: 『史記』に「坑儒」の語は
   無い）。**訂正ではなく「通説ではこう言われている」という形**で挙げてもらえれば、
   こちらで原文に当て直します
2. **1つの文が別々の記事を融合していないか** — 正史では別の条に書かれている2つの出来事を
   1文にまとめると、原文には無い像ができます（実例: 本紀「賊が御座に登った」＝主語は無名の
   賊、五行志「二人が清思殿で向かい合って食べた」の2条を「張韶と蘇玄明が御座に登って
   向かい合って食べた」と1文にしかけた。その像は『資治通鑑』のもの）。
   **出来過ぎに見える一文・主語が繋がりすぎている一文**を挙げてください
3. **人物の内心を断定していないか** — 「〜と考えた」「〜を恐れた」は、史料自身がその心情を
   書いている場合を除いて誤りです。発言・詔・行動で示します
4. **故事成語・制度語・官職名がその場で意味の通る形で出ているか** — 読者は専門家では
   ありません。読みを添えるだけでは足りず（例:「奇貨居くべし」「仲父」「璽書」）、
   意味が地の文で通っていない語を挙げてください
5. **一度読んで頭に入るか** — 主語の落ち、係り受け、話が飛ぶ箇所、指示語の指す先
6. **敬称・賛辞・主観的評価が入っていないか** — 「名君」「暗愚」「英明な」。
   史書の評は「『漢書』は〜と評する」と主語を立てる形なら可です
7. **水増しに見える箇所** — 書くことが尽きたのに続いている段落、同じ内容の言い換え。
   材料の少ない人物は短くてかまわないので、**短さは欠点として挙げないでください**
8. **漢文訓読調が残っていないか** — 原文の語を訓読でそのまま持ってきた形
   （「母を皇太后に尊んだ」「六国を併せた」「誅した」）。ただし**「没した」は可**、
   「即位」「封じる」「詔」などの歴史用語も可です。カギ括弧の中（史書の語そのものを
   話題にしている箇所）も対象外
9. **ルビ**（各本の末尾の一覧を見てください） — 読みが誤っているもの、
   一般語なのに振っているもの（「皇太子」「儒学」のような語には振りません）、
   逆に**本文に出ているのに一覧に無く、読者が読めそうにない語**
{cross}
## 各本に付いている「確定値」

原典から確定させた調査結果です。**本文がこれと食い違っていたら指摘してください**
（在位年・年齢・死因・即位経路。本文側が誤っている可能性が高い箇所です）。

## 返し方

次の表だけを返してください。**箇所は本文に付けた [番号] で指してください。**

| 箇所 | 観点 | 指摘 |
|---|---|---|
| [3-2] | 2 | 「〜して〜した」が2つの出来事を1文にまとめている疑い |
| [5-1] | 1 | 通説では即位は881年正月とされることが多い |

書き直した文は載せないでください。
"""

CROSS = """\
10. **本どうしの反復** — この{count}本は同じ時代・似た経歴の人物が並んでいます。
   **通して読んだときに、言い回しや段落構成が使い回しに見える箇所**を挙げてください
   （「〜を名乗り、〜と改元した」のような型の繰り返し、始まり方・終わり方の同型）。
   1本ずつ読んでいるかぎり出てこない指摘なので、ここは特にお願いしたいところです。
"""


def strip_ruby(text: str) -> str:
    return RUBY.sub(r"\1", text)


def ruby_pairs(text: str) -> list[str]:
    """本の中で振ったルビを出現順・重複なしで並べる。"""
    seen: list[str] = []
    for base, reading in RUBY.findall(text):
        pair = f"{base}《{reading}》"
        if pair not in seen:
            seen.append(pair)
    return seen


def cache_path(emperor_id: str) -> Path | None:
    for d in CACHE_DIRS:
        p = d / f"{emperor_id}.txt"
        if p.exists():
            return p
    return None


def display_name(emperor_id: str, record: dict) -> str:
    """本文で使う名前（`profile_name.py` の解決結果）。commonName は尊号を含むことがある。"""
    try:
        from profile_name import resolve_id

        return resolve_id(emperor_id)["plain"]
    except Exception:
        # commonName には尊号が入る（「雄武皇帝安禄山」）ので落とし所にしない。
        name = record.get("name") or {}
        return f"{name.get('familyName') or ''}{name.get('personalName') or ''}" or emperor_id


def label_maps(catalogs: dict) -> dict[str, dict[str, str]]:
    """レコードは ID しか持たないので、表示ラベルは meta.catalogs から引く。"""
    enums = catalogs.get("enums") or {}
    return {
        "regime": {r["id"]: r.get("label") or r.get("name") for r in catalogs.get("regimes") or []},
        "accession": {e["id"]: e["label"] for e in enums.get("accessionCategory") or []},
        "death": {e["id"]: e["label"] for e in enums.get("deathCause") or []},
        "standing": {e["id"]: e["label"] for e in enums.get("emperorStanding") or []},
    }


def facts_of(record: dict, labels: dict[str, dict[str, str]]) -> list[str]:
    """本文と突き合わせられる確定値だけを並べる（判定の根拠 note は出さない）。

    note を出さないのは、note が作業ログで「現行 X → Y に訂正」のように**捨てた側の値**を
    含むため（`R-NOTE-CLAIM`）。外部レビューへ渡すと捨てた値のほうを指摘される。
    """
    name = record.get("name") or {}
    summary = record.get("reignSummary") or {}
    ages = record.get("ages") or {}
    regime = labels["regime"].get(record.get("regimeId"), record.get("regimeId"))
    standing = labels["standing"].get(record.get("standing"))
    out = [f"- 政権: {regime}" + (f"（{standing}）" if standing else "")]
    out.append(f"- 正式な呼称: {name.get('commonName')}")
    if name.get("familyName") or name.get("personalName"):
        out.append(f"- 姓: {name.get('familyName') or '—'} ／ 諱: {name.get('personalName') or '—'}")
    for label, key in (("廟号", "templeName"), ("諡号", "posthumousName")):
        if name.get(key):
            out.append(f"- {label}: {name[key]}")

    def year(v):
        return f"前{-v}年" if isinstance(v, int) and v < 0 else (f"{v}年" if v else "—")

    duration = summary.get("totalReignDuration") or {}
    reign = (
        f"- 在位: {year(summary.get('firstStartYear'))}〜{year(summary.get('lastEndYear'))}"
        f"（{summary.get('reignCount')}期）"
    )
    if duration.get("displayYears"):
        reign += f"・通算 約{duration['displayYears']}年"
    out.append(reign)
    if ages.get("accessionAge"):
        out.append(f"- 即位時の年齢（数え）: {ages['accessionAge']}")
    if ages.get("deathAge"):
        out.append(f"- 没年齢（数え）: {ages['deathAge']}")
    route = (record.get("accessionRoute") or {}).get("categoryId")
    cause = (record.get("deathCause") or {}).get("category")
    if route:
        out.append(f"- 即位経路の区分: {labels['accession'].get(route, route)}")
    if cause:
        out.append(f"- 死因の区分: {labels['death'].get(cause, cause)}")
    return out


def numbered(lead: str, body: str, prefix: str) -> tuple[list[str], int]:
    """段落に [番号] を振る。レビューの指摘がどこを指すか一意にするため。

    節見出し（`## `）は 2026-08-05 の規範で禁止したので、残っていれば印を付けて出す。
    """
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
        tag = f"[{prefix}{i}]" if prefix else f"[{i}]"
        lines.append(f"{tag} 【{kind}】{text}" if kind == "見出し" else f"{tag} {text}")
        lines.append("")
    return lines, chars


def one_profile(
    emperor_id: str,
    record: dict,
    profile: dict,
    labels: dict[str, dict[str, str]],
    with_source: bool,
    index: int | None,
) -> tuple[list[str], int]:
    """1人ぶんの節を組む。index を渡すと [3-2] 形式の番号になる。"""
    prefix = f"{index}-" if index else ""
    lead = profile.get("lead") or ""
    body = profile.get("body") or ""
    body_lines, chars = numbered(lead, body, prefix)

    head = f"{index}. " if index else "対象: "
    parts = [f"# {head}{display_name(emperor_id, record)}（{emperor_id}）\n"]
    parts.append("## 確定値\n")
    parts.extend(facts_of(record, labels))
    parts.append("\n## 本文\n")
    parts.extend(body_lines)

    pairs = ruby_pairs(lead + "\n" + body)
    parts.append(f"## この本で振ったルビ（{len(pairs)}語）\n")
    parts.append("　".join(pairs) if pairs else "（なし）")
    parts.append("")

    description = profile.get("description") or ""
    parts.append(f"## 検索結果に出る1文（{len(description)}字・ルビなし）\n")
    parts.append(description)

    if with_source:
        path = cache_path(emperor_id)
        if path is None:
            parts.append("\n## 根拠にした正史の原文\n\n（原文キャッシュが無いので同梱していません）")
        else:
            parts.append(
                "\n## 根拠にした正史の原文\n\n"
                "本文はこの原文だけを根拠にしています。**簡体字**で、行頭の数字は行番号です。\n\n```"
            )
            parts.append(path.read_text(encoding="utf-8").rstrip())
            parts.append("```")
    return parts, chars


def build(
    items: list[tuple[str, dict, dict]], labels: dict[str, dict[str, str]], with_source: bool
) -> str:
    """1人でも複数でも同じ器で組む（複数のときだけ通し番号と反復の観点が付く）。"""
    multi = len(items) > 1
    parts: list[str] = ["{{BRIEF}}"]
    chars = 0
    for i, (emperor_id, record, profile) in enumerate(items, start=1):
        parts.append("\n---\n")
        block, n = one_profile(
            emperor_id, record, profile, labels, with_source, i if multi else None
        )
        parts.extend(block)
        chars += n

    count = f"{len(items)}本" if multi else "1本"
    cross = CROSS.format(count=len(items)) if multi else ""
    text = "\n".join(parts)
    # 欠けの検出は**行数ではなく段落番号**でやる（2026-08-09）。行数は添付なら保たれるが、
    # チャットへ貼ると折り返しで必ず変わるので、貼った瞬間に「切れている」と誤検知する。
    # 番号の飛びと最後の番号なら、貼っても添付しても同じように効く。
    tags = re.findall(r"^\[([0-9-]+)\]", text, re.M)
    return text.replace(
        "{{BRIEF}}",
        BRIEF.format(
            chars=chars,
            blocks=len(tags),
            first=tags[0] if tags else "1",
            last=tags[-1] if tags else "1",
            count=count,
            cross=cross,
        ),
        1,
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="紹介文を外部レビュー用の1ファイルに書き出す")
    ap.add_argument("ids", nargs="*", help="皇帝id")
    ap.add_argument("--section", help="researchSection で選ぶ（紹介文のある人だけ）")
    ap.add_argument("--all", action="store_true", help="紹介文のある全員（データ順）")
    ap.add_argument("--exclude", nargs="*", default=[], help="外す皇帝id（レビュー済みなど）")
    ap.add_argument("--chunk", type=int, help="この人数ごとにファイルを分ける（例: 10）")
    ap.add_argument("--with-source", action="store_true", help="本紀の原文キャッシュを同梱")
    ap.add_argument("--split", action="store_true", help="1人1ファイルに分ける")
    ap.add_argument("--name", help="まとめて出すときのファイル名（既定: review-<最初のid>）")
    ap.add_argument("--out", default="review", help="出力先ディレクトリ（既定: review/）")
    args = ap.parse_args()

    emperors = json.loads(EMPERORS.read_text(encoding="utf-8"))
    by_id = {e["id"]: e for e in emperors["emperors"]}
    profiles = json.loads(PROFILES.read_text(encoding="utf-8"))["profiles"]
    labels = label_maps(emperors["meta"].get("catalogs") or {})

    ids = list(args.ids)
    if args.section:
        ids += [
            e["id"]
            for e in emperors["emperors"]
            if e.get("researchSection") == args.section and e["id"] in profiles and e["id"] not in ids
        ]
    if args.all:
        ids += [e["id"] for e in emperors["emperors"] if e["id"] in profiles and e["id"] not in ids]
    ids = [i for i in ids if i not in set(args.exclude)]
    if not ids:
        ap.error("皇帝id か --section か --all が要ります")

    items: list[tuple[str, dict, dict]] = []
    for emperor_id in ids:
        if emperor_id not in by_id:
            print(f"{emperor_id}: 存在しない皇帝id", file=sys.stderr)
            return 1
        if emperor_id not in profiles:
            print(f"{emperor_id}: 紹介文がありません", file=sys.stderr)
            return 1
        items.append((emperor_id, by_id[emperor_id], profiles[emperor_id]))

    out_dir = ROOT / args.out
    out_dir.mkdir(parents=True, exist_ok=True)
    if args.split:
        groups = [[it] for it in items]
    elif args.chunk:
        groups = [items[i : i + args.chunk] for i in range(0, len(items), args.chunk)]
    else:
        groups = [items]
    width = len(str(len(groups)))
    for n, group in enumerate(groups, start=1):
        text = build(group, labels, args.with_source)
        if len(group) == 1 and args.split:
            stem = group[0][0]
        elif len(groups) > 1:
            # 連番を先頭に置く。ファイル名の並び順＝渡す順序にしておく
            stem = f"{args.name or 'review'}-{n:0{width}d}-{group[0][0]}"
        else:
            stem = args.name or f"review-{group[0][0]}"
        path = out_dir / f"{stem}.md"
        path.write_text(text + "\n", encoding="utf-8")
        shown = path.relative_to(ROOT) if path.is_relative_to(ROOT) else path
        print(f"{shown}  {len(group)}人 / {len(text):,}字 / {text.count(chr(10)) + 1}行")

    print("\nGemini へはこのファイルを添付するか、中身をそのまま貼り付ける（手で写さない）。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
