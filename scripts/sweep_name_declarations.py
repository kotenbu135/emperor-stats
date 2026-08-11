#!/usr/bin/env python3
"""コーパス40冊から「〈名〉字〈字〉」「小字〈値〉」の宣言を刈り取り、
字・幼名が空の人物の諱と突き合わせる（読む場所を出す道具・判定はしない）。

`scripts/screens/courtesy_name.py`・`childhood_name.py` との違いは**見る範囲**。
絞り込みの2本は `_corpus_cache/<id>.txt`（本人の帝紀の切り出し）だけを見るので、
**本人の帝紀が独立して立たない人物**を構造的に取りこぼす。2026-08-11 の標本監査で
3回続けて同じ形の反例が出た（梁 蕭淵明＝南史の列伝・成漢 李寿＝晋書 載記・
後梁 蕭琮＝隋書 外戚伝）ので、コーパス全体を横から当てる道具を分けた。

**この道具は絞り込みではない**（`data/screenings.json` に記録を持たない）。
バケットも取りこぼし率も出さず、出すのは候補の窓だけ。母集団が動いても
種つき標本が引き直しにならないよう、既存の絞り込みには手を入れていない。

    python3 scripts/sweep_name_declarations.py            # 鍵2字以上（高精度）
    python3 scripts/sweep_name_declarations.py --all      # 1字の諱の当たりも出す
    python3 scripts/sweep_name_declarations.py --field childhoodName
    python3 scripts/sweep_name_declarations.py --json     # 機械で読む形

**当たり＝値ではない。** 諱が1〜2字なので同名異人が大量に混じる（後漢書の
「刘隆字符伯」は雲台二十八将の劉隆で、殤帝ではない）。窓を人が読んで、
**どの人物の記事の中に在るか**を決めてから転記する。値はここからコピーせず、
`scripts/quote_helper.py` か底本の行から取る（`R-QUOTE-NO-TYPE`）。

**書によって値が割れる。** 姚萇の字は晋書 載記が「景茂」・十六国春秋別伝が
「子茂」で、正史を採る（`R-PRIMARY-SOURCE`）。載記系（十六国春秋・十国春秋）は
正史ではないので、当たったら必ず正史側に同じ記事があるかを見る。
"""
import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from hanzi_norm import to_simplified, to_traditional  # noqa: E402

ZHENGSHI = ROOT / "daizhigev20/史藏/正史"
ZAIJI = ROOT / "daizhigev20/史藏/载记"
# 同じ本文が二重に出る重複本・注釈本は落とす
SKIP = {"史记四库", "史记正义", "史记疑问", "史记索隐", "史记集解",
        "史记集解三家注索隐正义", "后汉书四库", "后汉书八家辑注", "旧五代史四库",
        "三国史辨误", "三国志补注", "两汉刊误补遗", "五代史纂误", "新唐书纠谬",
        "班马异同", "班马异同论", "补后汉书年表", "读史记十表", "辽史拾遗",
        "钦定辽金元三史国语解", "旧晋书九家辑本", "前汉书"}
# 正史ではないが十六国・十国の人物はここにしか記事が無いことがある
EXTRA = ["十六国春秋.txt", "别本十六国春秋.txt", "十六国春秋别传.txt", "十国春秋.txt"]

HAN = r"[一-鿿㐀-䶿]"
ZI = re.compile(rf"([^，,。；;、：:【】〔〕\s]{{1,4}})字({HAN}{{1,4}})(?=[，,。；;、])")
XIAOZI = re.compile(rf"小字({HAN}{{1,4}})(?=[，,。；;、])")
# 「小字」の直後に来ても名前ではない字（注釈の「〈人〉小字也」・動詞用法「小字曰」）
GLOSS = {"也", "曰", "耳", "云", "书", "書", "行"}
CTX = 60


def variants(s):
    return {v for v in (s, to_simplified(s), to_traditional(s)) if v}


def load_targets(field):
    data = json.loads((ROOT / "data" / "emperors.json").read_text(encoding="utf-8"))
    targets, meta = {}, {}
    for e in data["emperors"]:
        n = e.get("name") or {}
        per = n.get("personalName") or ""
        if not per or n.get(field):
            continue
        fam = n.get("familyName") or ""
        keys = set()
        for v in variants(per):
            keys.add(v)
            for f in variants(fam):
                keys.add(f + v)
        targets[e["id"]] = keys
        meta[e["id"]] = (fam, per, n.get("commonName", ""))
    return targets, meta


def books():
    fs = [p for p in sorted(ZHENGSHI.glob("*.txt")) if p.stem not in SKIP]
    fs += [ZAIJI / n for n in EXTRA if (ZAIJI / n).exists()]
    return fs


def sweep(field, min_key):
    targets, meta = load_targets(field)
    by_key = defaultdict(set)
    for eid, ks in targets.items():
        for k in ks:
            by_key[k].add(eid)

    hits = defaultdict(dict)
    for p in books():
        text = p.read_text(encoding="utf-8", errors="ignore")
        if field == "courtesyName":
            for m in ZI.finditer(text):
                name, val = m.group(1), m.group(2)
                if val in GLOSS:
                    continue
                for L in range(min_key, len(name) + 1):
                    for eid in by_key.get(name[-L:], ()):
                        w = text[max(0, m.start() - 40):m.end() + 30].replace("\n", " ")
                        hits[eid].setdefault((p.stem, name[-L:], val), w)
        else:
            for m in XIAOZI.finditer(text):
                val = m.group(1)
                if val in GLOSS:
                    continue
                ctx = text[max(0, m.start() - CTX):m.start()]
                for k, eids in by_key.items():
                    if len(k) < min_key or k not in ctx:
                        continue
                    for eid in eids:
                        w = text[max(0, m.start() - CTX):m.end() + 20].replace("\n", " ")
                        hits[eid].setdefault((p.stem, k, val), w)
    return hits, meta, len(targets)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--field", default="courtesyName",
                    choices=["courtesyName", "childhoodName"])
    ap.add_argument("--all", action="store_true",
                    help="1字の鍵の当たりも出す（同名異人が大量に混じる）")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    hits, meta, n = sweep(args.field, 1 if args.all else 2)
    if args.json:
        print(json.dumps({eid: [{"book": b, "key": k, "value": v, "window": w}
                                for (b, k, v), w in d.items()]
                          for eid, d in hits.items()}, ensure_ascii=False))
        return 0
    total = sum(len(d) for d in hits.values())
    print(f"{args.field} が空 {n}人 → 当たり {len(hits)}人・窓 {total}"
          f"（鍵 {1 if args.all else 2}字以上）\n")
    for eid, d in sorted(hits.items()):
        fam, per, common = meta[eid]
        print(f"== {eid}  {fam}{per} / {common}")
        for (b, k, v), w in d.items():
            print(f"   [{b}] {k} → 「{v}」  …{w}…")
    return 0


if __name__ == "__main__":
    sys.exit(main())
