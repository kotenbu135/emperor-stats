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

# 諡・尊号に触れる語。8語は本紀の走査（2026-08-10）と同じものを使う
WORDS = ["上尊谥", "上谥", "改谥", "加谥", "增谥", "追谥", "谥曰", "谥为", "尊号"]

# 諡になりうる形。帝号・后号・王号で結ぶ形と、裸の1〜3字＋庙号の形の2本立て。
# 字数は 30 まで見る（明太祖の嘉靖形が23字・清が22〜25字）
FORMS = [
    re.compile(r"(上尊谥|上谥|改谥|加谥|增谥|追谥|谥曰|谥为|尊号)[^。，,”]{0,30}(皇帝|皇后|太后|帝|王|后)"),
    re.compile(r"谥[曰为][^，。]{1,3}[，,]\s*庙号"),
]

# 巻の見出し。**「第」の有無も、序数と題の間に空白が入るかも書で違う** —
# 舊唐書は「本纪第一 高祖」・明史は「本纪第一太祖一」（空白なし）・
# 清史稿は「本纪一  太祖本纪」（第なし）。`第` を必須にすると清史稿が1冊まるごと
# [序] に落ち、序数のあとに空白を必須にすると明史の本紀173巻が全部落ちる
# （2026-08-10 に両方とも実際に出した）。序数の直後は `\s*` で結ぶ
HEAD = re.compile(
    r"^\s*(本纪|志|列传|表)第?[一二三四五六七八九十百]+[上下]?\s*(.*)$")


def bucket_of(kind, title):
    """巻の見出しから、走査範囲の区分を決める。"""
    if kind.startswith("本纪"):
        return "本紀"
    if kind.startswith("志"):
        return "礼志" if ("礼仪" in title or title.startswith("礼")) else "他の志"
    if kind.startswith("列传"):
        return "列傳"
    if kind.startswith("表"):
        return "表"
    return "序"


def scan(path):
    """1冊を走査して (バケット別の当たり数, 本紀の外の候補, 本紀の外で落とした当たり) を返す。"""
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    marks = [(i, m.group(1), m.group(2)) for i, ln in enumerate(lines, 1)
             if (m := HEAD.match(ln))]

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
        if b == "本紀":
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
    return counts, picked, dropped


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
        counts, picked, dropped = scan(path)
        print(f"== {Path(path).name} ==")
        for b in ("本紀", "礼志", "他の志", "列傳", "表", "序"):
            n = sum(v for (bb, _), v in counts.items() if bb == b)
            if n:
                print(f"  {b}: {n}")
        print(f"\n  本紀の外の候補 {len(picked)}件"
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
