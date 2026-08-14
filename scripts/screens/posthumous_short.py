#!/usr/bin/env python3
"""絞り込みの機械検査: 短縮諡（`name.posthumousName`）の未確定80人（Issue #126）。

**判定はしない。読む順序と量を変えるだけ**（規則 R-NO-AUTOGEN）。
ここで決まるのは「授与の条を先に読む人物」と「本人のキャッシュには授与の語が
1件も無いので、閉じ方を別の証人（記録の閉じ方・位号への降格）に頼る人物」の
仕分けだけで、値は1つも書かない。

単位は**人物**。母集団は 2026-08-14 時点で `coverage.py` の `m_name` が
`posthumousName` を判別不能と数えた80人で、**下に凍結して持つ**。
凍結する理由は、この作業が進むと `read-absent` の証人が付いて母集団が
80→0 へ減り、種つき標本が引き直しになるため（`name_fields.py` が
`unknown` 側へ印を付けないのと同じ理由）。

  人物
   ├ award-in-cache … 本人の `_corpus_cache/<id>.txt` に授与の語（諡）が在る。
   │                  kind=read。**その条が本人への授与とは限らない** —
   │                  実際に多数が他人（先帝・后妃・臣下）への授与で、
   │                  帝昺（2026-08-14）で取り違えたのと同じ型
   ├ award-none     … 授与の語が本人のキャッシュに1件も無い。kind=absent
   │                  **「諡が無い」ではない**。キャッシュの範囲が狭い／
   │                  書が別の語で書く／授与が他巻に在る、のどれでも同じ見え方
   └ no-cache       … 原文キャッシュが無い。kind=read（書から直接読む）

走査語は `scripts/hanzi_norm.py::norm_for_match` で**走査する側もされる側も
正規化してから**当てる。字形を数え上げると次の異体でまた穴が開く
（2026-08-14・宋史 卷四十七が諡の条を5回書くのに全部「謚」で、
簡体・繁体の2字形だけを持つ語彙では巻ごと空に見えた）。

出力:
    python3 scripts/screens/posthumous_short.py            # 人が読む形
    python3 scripts/screens/posthumous_short.py --json     # ゲート（check_screenings.py）用
"""
import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
EMPERORS = ROOT / "data" / "emperors.json"
CACHE = ROOT / "_corpus_cache"

_spec = importlib.util.spec_from_file_location(
    "hanzi_norm", ROOT / "scripts" / "hanzi_norm.py")
_hn = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_hn)

# 授与の語。正規化を通すので字形（谥／諡／謚）は1つ書けば足りる
AWARD_WORDS = ("諡",)

# 2026-08-14 時点で判別不能だった80人（`coverage.py` の `m_name` が正）。
# 作業で減るので凍結する。減った件数は data/screenings.json 側の記録で追う
POPULATION = (
    "wang-mang", "gongsun-shu", "liu-yong-liang", "wei-caofang", "wei-caomao",
    "wu-sunliang", "yuan-shu", "jin-simalun", "huan-xuan", "qianzhao-liuhe",
    "qianzhao-liuyao", "xia-helianchang", "xia-heliading", "houyan-murongxiang",
    "houyan-muronglin", "xiyan-murongyao", "xiyan-murongzhong", "xiyan-murongyong",
    "nanyan-murongchao", "houqin-yaohong", "houliang-houzhu", "liu-song-liushao",
    "liu-song-liuzixun", "liang-xiaozhengde", "liang-houjing", "liang-xiaoji",
    "liang-xiaoyuanming", "liang-xiaozhuang", "beiwei-tuobayu",
    "beiwei-youzhu-yuanzhao", "beiwei-yuanye", "beiwei-houfeidi-yuanlang",
    "beiwei-yuanyu", "beiwei-yuanfasheng", "beiwei-yuanhao", "beiqi-houzhu",
    "beiqi-andewang-gaoyanzong", "beiqi-youzhu-gaoheng", "beiqi-gaoxie",
    "sui-gongdi-you", "sui-yanghao", "suimo-yuwenhuaji", "suimo-wangshichong",
    "suimo-liuwuzhou", "suimo-liangshidu", "suimo-xueju", "suimo-xuerengao",
    "suimo-liqui", "suimo-xiaoxian", "suimo-lizitong", "suimo-linshihong",
    "suimo-fugongshi", "suimo-zhucan", "tangmo-anlushan", "tangmo-anqingxu",
    "tangmo-shisiming", "tangmo-shichaoyi", "tangmo-zhuci", "tangmo-lixilie",
    "tangmo-huangchao", "shiguo-qianshu-wangyan", "shiguo-nanhan-liuyan",
    "shiguo-nanhan-liuchang", "shiguo-houshu-mengchang", "shiguo-beihan-liuchong",
    "shiguo-beihan-liujun", "shiguo-beihan-liujien", "shiguo-jieyan-liushouguang",
    "beisongmo-zhangbangchang", "beisongmo-liuyu", "beiyuan-zhaozong",
    "yuanmo-hanlin-er", "yuanmo-xushouhui", "yuanmo-chenyouliang", "yuanmo-chenli",
    "yuanmo-mingyuzhen", "yuanmo-mingsheng", "nanming-zhaozong", "qing-xuantong",
    "zhonghuadiguo-yuanshikai",
)


def run():
    """皇帝 id → バケット。授与の語の在否だけで分ける。"""
    needles = [_hn.norm_for_match(w) for w in AWARD_WORDS]
    buckets = {}
    for eid in POPULATION:
        path = CACHE / f"{eid}.txt"
        if not path.exists():
            buckets[eid] = "no-cache"
            continue
        text = _hn.norm_for_match(path.read_text(encoding="utf-8", errors="replace"))
        buckets[eid] = "award-in-cache" if any(n in text for n in needles) \
            else "award-none"
    return buckets


def sample(ids, seed, size):
    """種つきの無作為抽出。ハッシュ順の上位 k（母集団が動いても当落が変わらない）。"""
    rank = sorted(ids, key=lambda i: hashlib.md5(f"{seed}:{i}".encode()).hexdigest())
    return sorted(rank[:size])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--sample", type=int, default=0, help="absent バケットから引く標本数")
    ap.add_argument("--sample-key", default="emperor-id", help="抽選の鍵")
    args = ap.parse_args()

    buckets = run()
    by_bucket = {}
    for eid in POPULATION:
        by_bucket.setdefault(buckets[eid], []).append(eid)

    if args.json:
        print(json.dumps({
            # コーパスの無い環境（CI）では全員が no-cache へ落ちて記録と必ずずれる
            "corpus": CACHE.is_dir() and any(CACHE.glob("*.txt")),
            "unit": "person",
            "n": len(POPULATION),
            "buckets": {k: len(v) for k, v in sorted(by_bucket.items())},
            "samples": {k: sample(v, args.seed, args.sample)
                        for k, v in sorted(by_bucket.items())},
            "coverage": {eid: [b] for eid, b in sorted(buckets.items())},
        }, ensure_ascii=False, sort_keys=True))
        return 0

    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    regime = {e["id"]: e["regimeId"] for e in data["emperors"]}
    print(f"母集団 {len(POPULATION)}人（2026-08-14 に凍結）")
    for b in ("award-in-cache", "award-none", "no-cache"):
        ids = by_bucket.get(b) or []
        print(f"\n■ {b}: {len(ids)}人")
        for eid in ids:
            print(f"    {eid:28s} {regime.get(eid, '?')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
