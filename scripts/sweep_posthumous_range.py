#!/usr/bin/env python3
"""諡の段（name.posthumousNames）の走査範囲を、底本1冊の中で測る道具。

規則 ID は RULES.yml の R-SWEEP-DETECTION。**判定はしない。**
出すのは「諡の語が本紀・志・列傳のどこに落ちるか」と「本紀の外に諡の形が
何件あるか」だけで、その形が収録365人の段になるかは人が読んで決める。

2026-08-10 に唐（舊唐書）・明（明史）で流し、**本紀の外に新しい段は0件**だった。
段の母集団は本紀（その政権の名乗りが立つ巻）だけで作れる、というのがこの2政権での結論。
残り88政権へ一般化はできない（残量表「諡の段の走査範囲（本紀の外）」の行）。

    python3 scripts/sweep_posthumous_range.py <底本パス>...            # バケットと候補
    python3 scripts/sweep_posthumous_range.py <底本パス> --audit 12    # 落とした側の監査標本

**候補を選ぶ正規表現が絞り込みの本体**なので、そこが落とす側（--audit）を必ず見る。
「…皇帝」で結ぶ形だけを拾うと、明代宗の王諡「戾」・則天武后の「則天大聖皇后」・
清の20字超の形を落とす（2026-08-10 に実際に1版目でこの穴を出した）。
"""
import argparse
import hashlib
import re
import sys
from collections import Counter
from pathlib import Path

# 諡・尊号に触れる語。8語は本紀の走査（2026-08-10）と同じものを使う。
# **`徽号` は9語目として 2026-08-10 に足した** — 宋は元豊六年に制度ごと改称して
# 「改加上尊谥作奉上徽号」（宋史 礼志 L22073）、以後の加諡を全部「徽号」と書く。
# 9語だけで流すと仁宗・英宗・神宗の加諡の条が候補に1件も出ず、「本紀の外に新規0件」
# という誤った結論になる。**語は書の中で制度改称に合わせて変わる**（R-SWEEP-DETECTION）
WORDS = ["上尊谥", "上谥", "改谥", "加谥", "增谥", "追谥", "谥曰", "谥为", "尊号", "徽号"]

# 諡になりうる形。帝号・后号・王号で結ぶ形と、裸の1〜3字＋庙号の形の3本立て。
# 字数は 30 まで見る（明太祖の嘉靖形が23字・清が22〜25字）。
# 3本目は**語を伴わずに冊宝の文面だけで形が出る**行（宋史 礼志 L22075 の
# 「奉上册宝曰神宗绍天法古…皇帝」＝神宗の紹聖二年の加諡）を拾う
FORMS = [
    re.compile(r"(上尊谥|上谥|改谥|加谥|增谥|追谥|谥曰|谥为|尊号|徽号)[^。，,”]{0,30}(皇帝|皇后|太后|帝|王|后)"),
    re.compile(r"谥[曰为][^，。]{1,3}[，,]\s*庙号"),
    re.compile(r"(册宝|册文|册曰)[^。]{0,12}曰[^。，,”]{0,30}(皇帝|皇后|太后)"),
]

# 巻の見出し。**「第」の有無も、序数と題の間に空白が入るかも書で違う** —
# 舊唐書は「本纪第一 高祖」・明史は「本纪第一太祖一」（空白なし）・
# 清史稿は「本纪一  太祖本纪」（第なし）。`第` を必須にすると清史稿が1冊まるごと
# [序] に落ち、序数のあとに空白を必須にすると明史の本紀173巻が全部落ちる
# （2026-08-10 に両方とも実際に出した）。序数の直後は `\s*` で結ぶ
#
# **2026-08-13 に3つ足した**（残る10書を流したら5書が丸ごと [序]・[列傳] へ落ちた）:
#   1. `卷N` の前置き — 晉書「卷一 帝纪第一」・後漢書「卷一上 光武帝纪第一上」
#   2. `本纪` 以外の帝の紀の名 — 晉書・周書・隋書「帝纪第N」、後漢書「光武帝纪第一上」
#      のように**帝号が見出しの中に入る**形、北齊書の「补帝纪第一」（追尊帝のぶん）
#   3. 晉書の `载记`（十六国の**本人の底本**。本紀の外ではない）
# 見出しの前に付く字は `[^\s第]{0,8}?` で吸うが、**行の短さも条件に入れる**
# （本文の途中に出る「…志第…」を見出しと誤認しないため。見出しは1行が短い）
HEAD = re.compile(
    r"^\s*(?:卷[一二三四五六七八九十百]+[上下]?[\s　]+)?"
    r"([^\s第]{0,8}?(?:本纪|帝纪|载记|志|列传|表))"
    r"第?[一二三四五六七八九十百]+[上下]?\s*(.*)$")
HEAD_MAX_LEN = 40  # 見出しとみなす行の上限（本文の巨大な1行を弾く）

# 帝の紀にあたるバケット。**載記は「本紀の外」ではない** — 晉書 載記は十六国の
# 皇帝が名乗る底本そのもので、そこに出る諡は候補ではなく段の本体になる
ANNALS = ("本紀", "載記")


def bucket_of(kind, title):
    """巻の見出しから、走査範囲の区分を決める。"""
    if kind.endswith("本纪") or kind.endswith("帝纪"):
        return "本紀"
    if kind.endswith("载记"):
        return "載記"
    if kind.endswith("志"):
        return "礼志" if ("礼仪" in title or title.startswith("礼")) else "他の志"
    if kind.endswith("列传"):
        return "列傳"
    if kind.endswith("表"):
        return "表"
    return "序"


def scan(path):
    """1冊を走査して (バケット別の当たり数, 帝紀の外の候補, 落とした当たり, 見出し数) を返す。"""
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    marks = [(i, m.group(1), m.group(2)) for i, ln in enumerate(lines, 1)
             if len(ln.strip()) <= HEAD_MAX_LEN and (m := HEAD.match(ln))]

    cur, idx = ("序", ""), 0
    counts, picked, dropped = Counter(), [], []
    for i, ln in enumerate(lines, 1):
        while idx < len(marks) and marks[idx][0] <= i:
            cur = (marks[idx][1], marks[idx][2])
            idx += 1
        if not any(w in ln for w in WORDS):
            continue
        b = bucket_of(*cur)
        for w in WORDS:
            counts[(b, w)] += ln.count(w)
        if b in ANNALS:
            continue
        spans = []
        for pat in FORMS:
            for m in pat.finditer(ln):
                spans.append((m.start(), m.end(), m.group(0)))
        for w in WORDS:
            for m in re.finditer(re.escape(w), ln):
                # 候補として拾った形に含まれる当たりは「落とした側」ではない
                if any(s <= m.start() < e for s, e, _ in spans):
                    continue
                dropped.append((i, b, w, ln[max(0, m.start() - 35):m.end() + 45].strip()))
        seen = set()
        for s, _, text in sorted(spans):
            if text[:6] in seen:
                continue
            seen.add(text[:6])
            picked.append((i, b, text))
    return counts, picked, dropped, marks


def sample(rows, size, seed):
    """種つきの安定標本。母集団が動いても既に引いた分が入れ替わらないよう md5 順で採る。"""
    keyed = sorted(rows, key=lambda r: hashlib.md5(
        f"{seed}:{r[0]}:{r[2]}".encode()).hexdigest())
    return keyed[:size]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="+", help="底本のパス（daizhigev20/... など）")
    ap.add_argument("--audit", type=int, default=0,
                    help="候補から落とした当たりを何件読むか（絞り込みの絶対に見る側）")
    ap.add_argument("--seed", type=int, default=810, help="標本の種")
    args = ap.parse_args()

    for path in args.paths:
        if not Path(path).exists():
            print(f"底本がありません: {path}（コーパスの symlink を確認）", file=sys.stderr)
            return 1
        counts, picked, dropped, marks = scan(path)
        print(f"== {Path(path).name} ==")
        # **見出しが取れているかを先に出す。** 0件を黙って [序] へ落とすのがこの道具の
        # いちばん危ない壊れ方で、「本紀の外の候補 N件」がそのまま嘘になる（2026-08-13）
        kinds = Counter(bucket_of(k, t) for _, k, t in marks)
        nlines = sum(1 for _ in Path(path).open(encoding="utf-8"))
        if not marks:
            print("  !! 巻の見出しが1件も取れていない — バケットは信用できない。"
                  "この書は範囲を人ごとの底本で測ること")
        else:
            print("  巻の見出し {}件（{}）".format(
                len(marks), " ".join(f"{b}{n}" for b, n in kinds.most_common())))
            # **見出しが冒頭に固まっていたら、それは目次であって本体の区切りではない。**
            # 北齊書・周書・元史は目次だけを持ち本体に見出しが無く、最後の目次項目
            # （たいてい列傳の末尾）が本体の全部に掛かる＝帝紀の当たりが列傳に化ける
            # （2026-08-13。件数だけ見ていると気づけないのでここで止める）
            if marks[-1][0] < nlines * 0.5:
                print(f"  !! 見出しが冒頭 {marks[-1][0]}/{nlines} 行までに固まっている"
                      "（目次だけで本体に区切りが無い）— バケットは信用できない")
        for b in ("本紀", "載記", "礼志", "他の志", "列傳", "表", "序"):
            n = sum(v for (bb, _), v in counts.items() if bb == b)
            if n:
                print(f"  {b}: {n}")
        print(f"\n  帝紀（本紀・載記）の外の候補 {len(picked)}件"
              f"（落とした当たり {len(dropped)}件）")
        for i, b, s in picked:
            print(f"    {i} [{b}] {s}")
        if args.audit:
            print(f"\n  -- 落とした側の標本（種 {args.seed}・{args.audit}件）--")
            for i, b, w, win in sample(dropped, args.audit, args.seed):
                print(f"    {i} [{b}] {w} | {win}")
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
