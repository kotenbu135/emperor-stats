#!/usr/bin/env python3
"""本紀キャッシュの「読み地図」を出す — どの段落が詔・冊文で、どこが叙事か。

紹介文の手順では本紀を**1巡**読む（docs/process/profile-writing/README.md の3節）。
原文が大きい人物ほど、その1巡の費用の大半が**詔・冊文・論賛**に消える。隋の文帝
（72,150B）で実測したところ、受禅までの冊文が続く段落から取れた材料はほぼ無かった。

**捨てるための道具ではない。** 詔にも事実は載る（大赦・改元・遷都の詔がその例）。
出すのは「どこを速く通してよいか」の見当で、読む順序を変えるだけ。

判定は行単位で3つ:

- `評` … 史臣曰・論曰・贊曰。書き手の評語で、事実の初出はここには無い
- `詔冊` … 日付の目印を持たず長い段落（詔・冊・策・上表の本文）
- `叙事` … それ以外。年月日・干支と事件が並ぶ、本紀の本体

使い方:
    python3 scripts/corpus_reading_map.py sui-wendi
    python3 scripts/corpus_reading_map.py sui-wendi --lines      # 行ごとに出す
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIRS = [ROOT / "_corpus_cache", Path("/home/sakis/emperor-stats/_corpus_cache")]

# 年月日の目印。叙事の行はこれが密で、詔・冊文の本文にはまず出てこない。
DATE = re.compile(
    r"[元二三四五六七八九十百]+年|[春夏秋冬]|"
    r"[正一二三四五六七八九十]+月|"
    r"[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]"
)
# 詔・冊の書き出し。**行末が「…曰：」のときだけ**続く行を詔の本文とみなす。
# 「長くて日付が薄い段落は詔」という当て方は載記で総崩れになる（慕容超の載記は
# 叙事なのに日付が薄く、92% が詔と判定された）。組版の合図だけを見る。
DECREE_HEAD = re.compile(r"詔曰|诏曰|制曰|册曰|冊曰|策曰|其略曰|下书曰|下書曰|璽書曰|玺书曰|上表曰|上疏曰|下令曰|手詔曰|手诏曰")
DECREE_OPEN = re.compile(r"曰[：:][「“]?[\s　]*$")
COMMENT_HEAD = re.compile(r"^[\s　]*(史臣曰|论曰|論曰|赞曰|贊曰|评曰|評曰|太史公曰|臣光曰)")
# 詔・冊文の本文そのものの書き出し（前の行が「曰：」で閉じていない組版のため）
DECREE_BODY_HEAD = re.compile(r"^[\s　]*(咨尔|咨爾|门下|門下|朕|王若曰|惟王|於戏|於戲|呜呼|嗚呼)")
# 叙事へ戻る合図: 行頭が年月日・干支・季節で始まる（本紀の条はここから立つ）
NARRATIVE_HEAD = re.compile(
    r"^[\s　]*("
    r"[元二三四五六七八九十百]+年|[春夏秋冬]|"
    r"[正閏闰一二三四五六七八九十]+月|"
    r"[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]|"
    r"\d)"
)

LONG = 200           # 「…曰：」で開いた詔を、この長さ以上のとき詔冊として数える
DATE_SPARSE = 0.008  # 1字あたりの日付目印の数。叙事へ戻ったかの判定に使う


def cache_path(emperor_id: str) -> Path | None:
    for d in CACHE_DIRS:
        p = d / f"{emperor_id}.txt"
        if p.exists():
            return p
    return None


def classify(line: str, in_decree: bool) -> tuple[str, bool]:
    """1行を 評／詔冊／叙事 に振り分ける。戻り値は (種別, 詔の続き中か)。"""
    s = line.strip()
    if not s:
        return "空", in_decree
    if COMMENT_HEAD.match(s):
        return "評", False
    density = len(DATE.findall(s)) / max(len(s), 1)

    if in_decree:
        # 詔の本文が続いているか。行頭が日付で立つか、日付が密になったら叙事へ戻る
        if NARRATIVE_HEAD.match(s) or density >= DATE_SPARSE:
            in_decree = False
        elif len(s) >= LONG:
            return "詔冊", True
        else:
            # 短い行が挟まったら詔は終わったものとする。**続き扱いを持ち越さない** —
            # 慕容超の載記で「群下议多不同，乃止。」（10字）を跨いで持ち越した結果、
            # 母と楽人の交換という最良の材料の段落まで詔と判定された
            return "叙事", False

    if DECREE_BODY_HEAD.match(s) and len(s) >= LONG and density < DATE_SPARSE:
        # 前の行が「…曰：」で閉じていなくても、冊文・詔の本文は書き出しで分かる
        # （「咨尔<官職>」「朕以不德」「門下」）。隋の文帝は受禅の冊文がこの形で
        # 2,000字あり、組版の合図だけでは叙事として通ってしまう
        return "詔冊", True

    if DECREE_OPEN.search(s) or (DECREE_HEAD.search(s) and s.endswith(("：", ":"))):
        # 「…詔曰：」で行が終わる形。次の行から詔の本文が始まる
        return "叙事", True
    return "叙事", False


def build(emperor_id: str):
    path = cache_path(emperor_id)
    if path is None:
        return None, None
    lines = path.read_text(encoding="utf-8").split("\n")
    rows, in_decree = [], False
    for i, line in enumerate(lines, 1):
        kind, in_decree = classify(line, in_decree)
        rows.append((i, kind, len(line.strip()), line.strip()[:28]))
    return path, rows


def render(emperor_id: str, rows, per_line: bool) -> str:
    out: list[str] = []
    total = {k: 0 for k in ("叙事", "詔冊", "評", "空")}
    for _, kind, n, _ in rows:
        total[kind] += n
    body = total["叙事"] + total["詔冊"] + total["評"]
    if body == 0:
        return "（キャッシュが空）"

    if per_line:
        for i, kind, n, head in rows:
            if kind == "空":
                continue
            out.append(f"L{i:<4} {kind}  {n:>5}字  {head}")
    else:
        # 同じ種別が続く区間へまとめる（行が数百ある人物で1行ずつ出しても読めない）
        run = None
        for i, kind, n, head in rows:
            if kind == "空":
                continue
            if run and run[0] == kind and i == run[2] + 1:
                run = (kind, run[1], i, run[3] + n, run[4])
            else:
                if run:
                    out.append(
                        f"L{run[1]}-{run[2]}\t{run[0]}\t{run[3]:>6}字\t{run[4]}"
                    )
                run = (kind, i, i, n, head)
        if run:
            out.append(f"L{run[1]}-{run[2]}\t{run[0]}\t{run[3]:>6}字\t{run[4]}")

    pct = 100 * total["詔冊"] / body
    out.append("")
    out.append(
        f"叙事 {total['叙事']:,}字／詔冊 {total['詔冊']:,}字（{pct:.0f}%）／評 {total['評']:,}字"
    )
    if pct >= 30:
        out.append(
            f"**この人物は本紀の {pct:.0f}% が詔・冊文**。そこは速く通し、叙事の区間に時間を配る"
            "（詔にも大赦・改元・遷都のような事実は載るので、飛ばすのではなく速度を変える）"
        )
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("emperor_id")
    ap.add_argument("--lines", action="store_true", help="区間へまとめず1行ずつ出す")
    args = ap.parse_args()
    path, rows = build(args.emperor_id)
    if path is None:
        print(f"_corpus_cache/{args.emperor_id}.txt が無い", file=sys.stderr)
        return 1
    print(f"# 読み地図 {path.name}")
    print(render(args.emperor_id, rows, args.lines))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
