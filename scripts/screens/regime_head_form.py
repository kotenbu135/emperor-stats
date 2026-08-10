#!/usr/bin/env python3
"""絞り込みの機械検査: 政権ごとの「名前の所在」（Issue #37・規則 R-REGIME-FIRST）。

**判定はしない。読む順序と量を変えるだけ**（規則 R-NO-AUTOGEN）。
ここで決まるのは「その政権の慣行を確定するのに何人ぶん読むか」だけで、
`data/regime-conventions.json` の verdict は1件もここから決まらない。

単位は**政権**。その政権に属する人物の `_corpus_cache/<id>.txt` の**冒頭3行**を見て、
名前が並ぶ定型に当たるかを数える。

  政権
   ├ annal-head    … 過半が本紀冒頭の定型（「〈諡〉皇帝，讳〈諱〉」）に当たる。
   │                  代表2人の1行を読めば書式・所在が確定できる側。kind=read
   ├ annal-partial … 定型に当たる人物と当たらない人物が混じる。当たらない側が
   │                  **例外（所在が違う人物）の候補**なので全員ぶん冒頭を見る。kind=read
   ├ bio-head      … 定型はゼロだが列伝の定型（「〈姓名〉字〈字〉，〈本貫〉」）に当たる。
   │                  biography-only の候補だが**打ち切り側なので原典2件で裏を取る**。kind=read
   └ head-none     … 機械がどの定型も見つけなかった。kind=absent
                      **「その書に書式が無い」ではない**。編年体（西夏書事・資治通鑑）・
                      キャッシュの開始位置が紀の冒頭でない・定型の語順が違う、の
                      どれでも同じ見え方になる。だから種つき標本を原典で読む

前漢14人が冒頭3行に「讳」を持たないのは廟号が無いからではなく漢書が並べないから、
という失敗（R-REGIME-FIRST の evidence）と同じ形の見誤りを、absent 側の監査で測る。

出力:
    python3 scripts/screens/regime_head_form.py            # 人が読む形
    python3 scripts/screens/regime_head_form.py --json     # ゲート（check_screenings.py）用
"""
import argparse
import hashlib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
EMPERORS = ROOT / "data" / "emperors.json"
CACHE = ROOT / "_corpus_cache"

HEAD_LINES = 3
# 本紀冒頭の定型。諡（「…皇帝」「…大帝」）に諱が続く形。「皇帝諱X」「皇帝，讳X」の両方
ANNAL = re.compile(r"(皇帝|大帝)[，,]?\s*[讳諱]")
# 列伝の定型。「〈姓名〉，字〈字〉」— 本紀には字が並ばないので所在の違いの印になる
BIO = re.compile(r"^.{2,8}?[，,]?\s*字[^\n，,。]{1,6}[，,]")


def heads():
    """政権 → [(皇帝id, 当たった定型)]。キャッシュが無い人物は None。"""
    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    out = defaultdict(list)
    for e in data["emperors"]:
        path = CACHE / f"{e['id']}.txt"
        if not path.exists():
            out[e["regimeId"]].append((e["id"], None))
            continue
        head = "\n".join(path.read_text(encoding="utf-8", errors="replace")
                         .split("\n")[:HEAD_LINES])
        if ANNAL.search(head):
            kind = "annal"
        elif any(BIO.match(l) for l in head.split("\n")):
            kind = "bio"
        else:
            kind = "none"
        out[e["regimeId"]].append((e["id"], kind))
    return out


def run():
    """政権 → バケット。人物単位ではなく政権単位で決まる（所在は政権の属性）。"""
    buckets, detail = {}, {}
    for rid, members in heads().items():
        kinds = [k for _, k in members]
        n_annal = kinds.count("annal")
        if n_annal * 2 > len(kinds):
            b = "annal-head"
        elif n_annal:
            b = "annal-partial"
        elif kinds.count("bio"):
            b = "bio-head"
        else:
            b = "head-none"
        buckets[rid] = b
        # 定型から外れた人物＝例外（所在が違う）の候補。読む順序はここから決める
        detail[rid] = [i for i, k in members if k != "annal"] if b.startswith("annal") \
            else [i for i, _ in members]
    return buckets, detail


def sample(ids, seed, size):
    """種つきの無作為抽出。ハッシュ順の上位 k（母集団が動いても当落が変わらない）。"""
    rank = sorted(ids, key=lambda i: hashlib.md5(f"{seed}:{i}".encode()).hexdigest())
    return sorted(rank[:size])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--sample", type=int, default=0, help="absent バケットから引く標本数")
    ap.add_argument("--sample-key", default="regime-id",
                    help="抽選の鍵（既定は政権 id）")
    args = ap.parse_args()

    buckets, detail = run()
    by_bucket = defaultdict(list)
    for rid, b in sorted(buckets.items()):
        by_bucket[b].append(rid)

    if args.json:
        # coverage は皇帝 id で引けるようにする（check_screenings.py --for <皇帝id>）
        data = json.loads(EMPERORS.read_text(encoding="utf-8"))
        coverage = {e["id"]: [buckets[e["regimeId"]]] for e in data["emperors"]
                    if e["regimeId"] in buckets}
        print(json.dumps({
            "unit": "regime",
            "n": len(buckets),
            "buckets": {k: len(v) for k, v in sorted(by_bucket.items())},
            "samples": {k: sample(v, args.seed, args.sample)
                        for k, v in sorted(by_bucket.items())},
            "coverage": coverage,
        }, ensure_ascii=False, sort_keys=True))
        return 0

    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    labels = {r["id"]: r["label"] for r in data["meta"]["catalogs"]["regimes"]}
    sizes = defaultdict(int)
    for e in data["emperors"]:
        sizes[e["regimeId"]] += 1
    print(f"母集団 {len(buckets)}政権 / {sum(sizes.values())}人")
    for b in ("annal-head", "annal-partial", "bio-head", "head-none"):
        rids = by_bucket.get(b) or []
        print(f"\n■ {b}: {len(rids)}政権 / {sum(sizes[r] for r in rids)}人")
        for rid in sorted(rids, key=lambda r: -sizes[r]):
            extra = detail[rid]
            tail = f"  定型外: {'・'.join(extra[:4])}" if extra and b == "annal-partial" else ""
            print(f"    {sizes[rid]:3d} {rid:24s} {labels.get(rid, '?')}{tail}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
