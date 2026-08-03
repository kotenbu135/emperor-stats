#!/usr/bin/env python3
"""絞り込みの機械検査: 幼名（小字）`name.childhoodName`（Issue #37 単位5）。

**判定はしない。読む順序と量を変えるだけ**（規則 R-NO-AUTOGEN）。
ここで決まるのは「どの1行を転記として読み、どこを従来どおり調べるか」だけで、
値は1つも書かない。**この画面が出す候補文字列は読む場所の目印**であって、
`childhoodName` へ入れてよい値ではない（入れる前に原文を読む — 下の偽陽性）。

母集団は365人ぜんぶ。字（`courtesyName`）の絞り込みと違って**字が埋まった人物を
除かない** — 遼太祖は「字阿保機，小字啜里只」で**両方を持つ**ので、字の側の
母集団から外すと小字が見えなくなる。

  人物
   ├ formula-head  … 本人の原文キャッシュの**冒頭120字**に「小字〈1〜4字〉，」の定型が
   │                 在る。正史の書き出し「諱〈諱〉，字〈字〉，小字〈小字〉」がここに来る。
   │                 実測で本人ぶんの当たりはすべて 86字以内だった。kind=read
   ├ formula-late  … 定型は在るが冒頭120字より後。**大半は他人の小字**で、注釈の
   │                 「〈名〉，〈人〉小字也」（姚邕の黄兒・王愉の駒）や同じ巻に同居する
   │                 別人の伝（北遼の耶律淳「小字涅里」）が来る。kind=read
   ├ nodelim       … 冒頭に「小字」は在るが**後ろに句読点が無い**ので語の切れ目が
   │                 機械では決まらない。十六国の原文には句読点が1つも無い版が
   │                 あり、赫連定の「小字直獖勃勃之第五子也」がこれ。kind=read
   ├ no-corpus     … 原文キャッシュが無い（正史の対象外）。kind=read
   └ unknown       … 機械が何も見つけなかっただけ。kind=absent
                     （「小字が無い」の証拠ではない。だから種つき標本を原典で読む）

**この検出器が拾えないもの**（`notEstablished` に同じことを書く）:

- **定型を採らない書き方**。南漢の劉玢がこれで、高祖の遺言が「呼洪度、洪熙小字曰：
  『寿、俊虽长…』」と**動詞をはさむ**ため「小字〈値〉」の隣接にならない。読めば
  劉玢（初名 洪度）の小字が「寿」だと分かるが、**同じ隣接をゲートCも要求する**ので
  この形は欄に入れられない（残量表の行）
- **本人の帝紀・列伝以外に載る小字**。唐・北宋・元・清の帝紀は冒頭定型に小字の欄を
  持たない。unknown を「小字が無い」と読めないのはこのため（R-SCREEN-FIRST の absent 側）

偽陽性は当たった側に出るので、当たった側も転記ではなく**読解**として扱う。実際、
梁の豫章王のキャッシュは簡文帝紀を指しており、冒頭定型の「小字六通」は簡文帝のもの
だった（同じ値が2人に当たる形）。

出力:
    python3 scripts/screens/childhood_name.py            # 人が読む形
    python3 scripts/screens/childhood_name.py --json     # ゲート（check_screenings.py）用
    python3 scripts/screens/childhood_name.py --context  # 転記のために当たり全件の前後を出す
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
EMPERORS = ROOT / "data" / "emperors.json"
CACHE = ROOT / "_corpus_cache"

HAN = r"[一-鿿㐀-䶿]"
# 「小字〈1〜4字〉，」の定型。字の絞り込みと違って**直前に句読点を要求しない**
# （「小字」の2字がそれ自体で名乗りの種類を決めており、複合語の後半に当たらない）。
FORMULA = re.compile(rf"小字({HAN}{{1,4}})(?=[，,。；;、])")
NODELIM = re.compile(r"小字")
# 「小字」の直後に来ても名前ではない字。「〈人〉小字也」は注釈の形、「小字曰〈…〉」は
# 動詞をはさむ形で、どちらも捕まえた1字が名前になってしまう。
GLOSS = {"也", "曰", "耳", "云"}
HEAD = 120

BUCKETS = ("formula-head", "formula-late", "nodelim", "no-corpus", "unknown")


def first_hit(text):
    """定型の最初の当たりを返す（注釈・動詞用法は飛ばす）。"""
    for m in FORMULA.finditer(text):
        if m.group(1) not in GLOSS:
            return m
    return None


def classify(eid):
    """1人ぶんのバケットと、読む場所の目印（当たった文字列・位置）を返す。"""
    p = CACHE / f"{eid}.txt"
    if not p.exists():
        return "no-corpus", None, None
    text = p.read_text(encoding="utf-8", errors="ignore")
    m = first_hit(text[:HEAD])
    if m:
        return "formula-head", m.group(1), m.start()
    m = NODELIM.search(text[:HEAD])
    if m:
        return "nodelim", None, m.start()
    m = first_hit(text)
    if m:
        return "formula-late", m.group(1), m.start()
    return "unknown", None, None


def run():
    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    rows = {}
    for e in data["emperors"]:
        # 既に埋まっているセルは母集団の外（訂正は別作業）
        if (e.get("name") or {}).get("childhoodName"):
            continue
        rows[e["id"]] = classify(e["id"])
    return rows


def sample(ids, seed, size):
    """種つきの無作為抽出。**誰かが選んだ標本では取りこぼし率は言えない**ので、
    抽出はここで決めてゲートが同じ種で引き直して突き合わせる。
    ハッシュ順の上位 k を取る（母集団が動いても既存の標本の当落が変わらない）。
    """
    rank = sorted(ids, key=lambda i: hashlib.md5(f"{seed}:{i}".encode()).hexdigest())
    return sorted(rank[:size])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--context", action="store_true",
                    help="当たった全件の前後を出す（転記のために原文を読む用）")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--sample", type=int, default=0, help="absent バケットから引く標本数")
    args = ap.parse_args()

    rows = run()
    buckets = {}
    for eid, (b, _, _) in rows.items():
        buckets.setdefault(b, []).append(eid)

    if args.context:
        for eid, (b, hit, pos) in sorted(rows.items()):
            if pos is None:
                continue
            text = (CACHE / f"{eid}.txt").read_text(encoding="utf-8", errors="ignore")
            s = max(0, pos - 40)
            print(f"{eid:34s} [{b}] …{text[s:pos + 40]}…".replace("\n", " "))
        return 0

    if args.json:
        print(json.dumps({
            "unit": "person",
            "n": len(rows),
            "buckets": {b: len(buckets.get(b, [])) for b in BUCKETS},
            "samples": ({"unknown": sample(buckets.get("unknown", []), args.seed, args.sample)}
                        if args.sample else {}),
            "coverage": {eid: b for eid, (b, _, _) in sorted(rows.items())},
        }, ensure_ascii=False))
        return 0

    read = sum(len(buckets.get(b, [])) for b in BUCKETS if b != "unknown")
    print(f"母集団 {len(rows)}人 → 要読解 {read}人")
    for b in BUCKETS:
        print(f"  {b}: {len(buckets.get(b, []))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
