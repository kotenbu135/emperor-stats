#!/usr/bin/env python3
"""絞り込みの機械検査: 字（あざな）`name.courtesyName`（Issue #37 単位4）。

**判定はしない。読む順序と量を変えるだけ**（規則 R-NO-AUTOGEN）。
ここで決まるのは「どの1行を転記として読み、どこを従来どおり調べるか」だけで、
値は1つも書かない。**この画面が出す候補文字列は読む場所の目印**であって、
`courtesyName` へ入れてよい値ではない（入れる前に原文を読む — 下の偽陽性）。

母集団は365人ぜんぶ。`courtesyName` が空の人物を数える形にしないのは、この欄が
**まだ1件も無い**ためで、埋まり始めたら埋まったセルは母集団から外れる。

  人物
   ├ formula-head  … 本人の原文キャッシュの**冒頭300字**に「，字〈1〜4字〉，」の定型が在る。
   │                 正史の帝紀・列伝の書き出し「諱〈諱〉，字〈字〉」がここに来る。kind=read
   ├ formula-late  … 定型は在るが冒頭300字より後。**同じ巻に同居する他人の伝**を
   │                 拾っている形があるので、誰の字かを原文で決める必要がある。kind=read
   ├ small-name    … 「字」の定型は無いが「小字〈…〉」が在る。**小字は字ではない**
   │                 （遼太祖は「字阿保機，小字啜里只」で両方を持つ）。この欄に
   │                 小字を入れる取り違えを防ぐために分けて数える。kind=read
   ├ no-corpus     … 原文キャッシュが無い（正史の対象外）。kind=read
   └ unknown       … 機械が何も見つけなかっただけ。kind=absent
                     （「字が無い」の証拠ではない。だから種つき標本を原典で読む）

**この検出器が拾えないもの**（`notEstablished` に同じことを書く）:

- **本人の帝紀・列伝以外に載る字**。唐・北宋・元・清の帝紀は冒頭の定型に字の欄を
  持たないので、字が在っても本人のキャッシュには出ない。unknown を「字が無い」と
  読めないのはこのため（規則 R-SCREEN-FIRST の absent 側）
- **定型を採らない書き方**（「字曰〈…〉」「字為〈…〉」のような動詞用法）。この形は
  隣接を要求するゲートCも受けないので、**当たっても本人の欄には入らない**
  （西夏 景宗の西夏書事「德明爱之，字为嵬埋」がこれで、同じ名を正史の宋史は
  「小字嵬理」と呼ぶ＝幼名の欄が持つ）

  **ただし動詞用法だから字ではない、とは限らない**（2026-08-16 に訂正した）。
  前漢 成帝の「字曰太孫」はここに偽陽性として挙げていたが転記に改めた
  （ゲートCは免除 `COURTESY_ALLOW` で受ける）。**隣接の有無は決め手にならない** —
  同じ漢書の元后傳「宣帝爱之，自名曰骜，字太孙」（卷九十八・L4305）も上の
  西夏書事「德明爱之，字为嵬埋」も「〈人〉爱之，…字〈X〉」という同じ枠にある。
  **分かれ目は名の行き先が他にあるか**で、嵬理は宋史が「小字」と呼ぶので幼名の欄が
  持ち、太孫を小字と呼ぶ書は無い（漢書1冊に「小字」の語が0件）。
  動詞用法に当たったら、**同じ書の別の巻と、他の欄を名乗る書**を見に行く

偽陽性は当たった側に出るので、当たった側も転記ではなく**読解**として扱う。
実際、同じ値が2人に当たる形が3組あり（梁簡文帝と豫章王の「世纘」・呉三桂と
呉世璠の「長伯」・後燕慕容垂と南燕慕容徳の「玄明」の一部）、キャッシュが同居する
他人の伝を含んでいる疑いがある。

出力:
    python3 scripts/screens/courtesy_name.py            # 人が読む形
    python3 scripts/screens/courtesy_name.py --json     # ゲート（check_screenings.py）用
    python3 scripts/screens/courtesy_name.py --context  # 転記のために当たり全件の前後を出す
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
# 「，字〈1〜4字〉，」の定型。**直前に句読点を要求する**のが肝で、これが無いと
# 「小字」「表字」「名字」「文字」のような複合語の後半に当たる（小字は別の名乗り）。
FORMULA = re.compile(rf"(?:^|[，,。；;：:、\s])字({HAN}{{1,4}})(?=[，,。；;、])")
# **冒頭だけは区切りを要求しない**（2026-08-11）。載記・列伝の書き出しには
# 「寿字武考，骧之子也」のように**姓を伴わず諱の1字が直に「字」へ続く形**があり、
# 上の定型では当たらない。標本監査の反例3件のうち2件（成漢 李寿・後梁 蕭琮）が
# これで、本人のキャッシュの中に在るのに unknown へ落ちていた。
# 直前の1字だけは見る（複合語の後半＝別の名乗り・一般語を落とす）。**この緩和を
# 全文へ広げると「正字」「大字」「十字路」「漢字」が大量に当たる**ので冒頭に限る
# （実測: 全文へ広げると56人が動き、そのうち冒頭の13人以外はほぼ全部が雑音）。
HEAD_BAD_PREV = "小表别別名文番漢汉蕃正大十八"
HEAD_FORMULA = re.compile(rf"(?<![{HEAD_BAD_PREV}])字({HAN}{{1,4}})(?=[，,。；;、])")
SMALL_NAME = re.compile(rf"小字({HAN}{{1,4}})")
HEAD = 300

BUCKETS = ("formula-head", "formula-late", "small-name", "no-corpus", "unknown")


def classify(eid):
    """1人ぶんのバケットと、読む場所の目印（当たった文字列・位置）を返す。"""
    p = CACHE / f"{eid}.txt"
    if not p.exists():
        return "no-corpus", None, None
    text = p.read_text(encoding="utf-8", errors="ignore")
    m = HEAD_FORMULA.search(text[:HEAD])
    if m:
        return "formula-head", m.group(1), m.start()
    m = FORMULA.search(text)
    if m:
        return "formula-late", m.group(1), m.start()
    m = SMALL_NAME.search(text[:HEAD])
    if m:
        return "small-name", m.group(1), m.start()
    return "unknown", None, None


def run():
    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    rows = {}
    for e in data["emperors"]:
        # 既に埋まっているセルは母集団の外（訂正は別作業）
        if (e.get("name") or {}).get("courtesyName"):
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
            if hit is None:
                continue
            text = (CACHE / f"{eid}.txt").read_text(encoding="utf-8", errors="ignore")
            s = max(0, pos - 40)
            print(f"{eid:34s} [{b}] …{text[s:pos + 40]}…".replace("\n", " "))
        return 0

    if args.json:
        print(json.dumps({
            "unit": "person",
            # コーパスが無い環境（CI）では件数が再現しない。**検査側へそれを伝える**
            # ための旗で、値そのものではない（引用の実在検査が飛ぶのと同じ理由）
            "corpus": CACHE.is_dir() and any(CACHE.glob("*.txt")),
            "n": len(rows),
            "buckets": {b: len(buckets.get(b, [])) for b in BUCKETS},
            "samples": ({"unknown": sample(buckets.get("unknown", []), args.seed, args.sample)}
                        if args.sample else {}),
            "coverage": {eid: b for eid, (b, _, _) in sorted(rows.items())},
        }, ensure_ascii=False))
        return 0

    read = sum(len(buckets.get(b, [])) for b in BUCKETS if b != "unknown")
    print(f"母集団 {len(rows)}人（courtesyName が空） → 要読解 {read}人")
    for b in BUCKETS:
        print(f"  {b}: {len(buckets.get(b, []))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
