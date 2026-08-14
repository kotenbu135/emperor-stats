#!/usr/bin/env python3
"""絞り込みの機械検査: 廟号（`name.templeName`）の未確定126人（Issue #126）。

**判定はしない。読む順序と量を変えるだけ**（規則 R-NO-AUTOGEN）。
ここで決まるのは「本人の原文キャッシュの中に廟号の定型が在るので先に読む人物」と
「キャッシュの中には手掛かりが無いので、**閉域をキャッシュの外へ広げないと決められない**
人物」の仕分けだけで、値は1つも書かない。

単位は**人物**。母集団は 2026-08-14 時点で `coverage.py` の `m_name` が `templeName` を
判別不能と数えた126人で、下に凍結して持つ（作業が進むと `read-absent` の証人が付いて
母集団が減り、種つき標本が引き直しになるため。`posthumous_short.py` と同じ理由）。

**`name_fields.py` の `templeName:unknown` 178 とは母集団が違う。** あちらは
`commonName` が廟号形（〜祖／〜宗）で立つセルにしか `read-absent` の印を付けない設計
（あちらの docstring の「`unknown` に読み終わったセルが混じっていること自体は残る」）で、
既に読み終えた52人が `unknown` に残っている。**読む対象はこちらの126人**で、
178 − 126 = 52 がその差。

  人物
   ├ formula-in-cache … 本人の `_corpus_cache/<id>.txt` に廟号の定型
   │                    （庙号・庙曰・庙称・称宗）が在る。kind=read
   │                    **その条が本人の廟号とは限らない** — 追尊された祖先・
   │                    先帝・宗廟の一般語が同じ語で書かれる（遼天祚帝の巻の3件は
   │                    順宗・肅祖・懿祖の追尊で本人には廟号が無い）
   ├ zong-token       … 定型は無いが「〈X〉祖／〈X〉宗」型の2字語が在る。kind=read
   │                    宋書のように**廟号の条を1件も持たず地の文の呼称でしか
   │                    帝を呼ばない書**が現にある（劉宋9人・南齊3人がこの型）
   ├ cache-silent     … どちらも本人のキャッシュに無い。kind=absent
   │                    **「廟号が無い」ではない。** 下の実測のとおり、値が在ると
   │                    分かっている174人のうち13人がこの見え方をする
   └ no-cache         … 原文キャッシュが無い。kind=read（書から直接読む）

## この検出器がどれだけ取りこぼすか（2026-08-14・**標本ではなく全数**）

`--audit` が測る。母集団は**値が実在すると分かっている174人**で、同じ検出器を掛けて
何人が沈黙するかを数えるので、取りこぼし率を推定ではなく実測で言える。

    定型（庙号・庙曰・庙称・称宗）で当たる     147人（84.5%）
    定型は沈黙し、保存値の文字列だけが当たる    14人（ 8.0%）
    どちらも本人のキャッシュに出ない            13人（ 7.5%）

**27人（15.5%）が定型では沈黙する。** うち13人は保存値の文字列すら本人のキャッシュに
出ない — 西漢6人（文帝・武帝・宣帝・元帝・成帝・平帝。漢書は本紀に廟号の条を置かない）・
後漢 順帝（裏は献帝紀の除尊号条＝**別人のキャッシュ**）・魏文帝・蜀漢 昭烈帝・
東吳 大帝・南燕 慕容德・北齊 孝昭帝・隋 煬帝。

だから **`cache-silent` を「読んだうえで空」の根拠にしてはいけない**。この層で
`read-absent` を書くには、下の4軸の閉域を当ててからにする（残量表の
「名前欄の『読んだうえで空』が**本人のキャッシュだけ**で閉じている」の行）。

## `read-absent` を書くときの閉域（4軸）

2026-08-14 までに実際に破れた3件（隋 恭帝侑・梁 貞陽侯淵明・西梁 後主 琮）と、
上の13人が示す軸をまとめたもの。**この4つを当ててから空を主張する**。

  1. 本人のキャッシュの外側（同じ書）… 巻の見出し・史臣曰／論曰・志（礼志・楽志）。
     清 聖祖の廟号の裏は礼志 L6983 で、本紀の上諡条は「庙号」の語を使わない
  2. 政権慣行レコードが言う所在 … `check_regime_conventions.py --for <id> --field name.templeName`
  3. 別政権の書 … 亡国・廃位した君主は、**贈った主体が後継／敵対政権**であることがある
     （元順帝の「惠宗」は北元の追尊で元史に無い＝新元史が持つ）
  4. 語彙は `hanzi_norm.norm_for_match` を通してから当てる … 字形を数え上げると
     次の異体でまた穴が開く（1冊の中で庙号／庙曰／庙称が割れる実例が魏書にある）

出力:
    python3 scripts/screens/temple_name.py            # 人が読む形
    python3 scripts/screens/temple_name.py --json     # ゲート（check_screenings.py）用
    python3 scripts/screens/temple_name.py --audit    # 検出器の取りこぼしを全数で測り直す
"""
import argparse
import hashlib
import importlib.util
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
EMPERORS = ROOT / "data" / "emperors.json"
CACHE = ROOT / "_corpus_cache"

_spec = importlib.util.spec_from_file_location(
    "hanzi_norm", ROOT / "scripts" / "hanzi_norm.py")
_hn = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_hn)

# 廟号の定型。正規化を通すので字形（庙／廟・号／號・称／稱）は1つ書けば足りる。
# 書ごとに語が違う（宋史は廟號32件・後漢書は庙曰／尊庙曰・魏書は1冊の中で
# 庙号／庙称／庙曰が割れる・清史稿は聖祖だけ語そのものを使わない）
FORMULA_WORDS = ("庙号", "庙曰", "庙称", "称宗", "尊庙曰", "上庙号")
# 廟号そのものの形。定型を持たない書（宋書・南齊書）は地の文の呼称しか持たない
ZONG_TOKEN = re.compile(r"[太高世中显肃穆恭敬威烈成宣睿仁英神圣哲徽钦孝光宁理度端顺武文昭章和安质桓灵献元定简穆襄悼哀思愍怀]{1}[祖宗]")

# 2026-08-14 時点で判別不能だった126人（`coverage.py` の `m_name` が正）。
# 作業で減るので凍結する。減った件数は data/screenings.json 側の記録で追う
POPULATION = (
    "beiqi-feidi-gaoyin", "beiqi-gaoxie", "beiqi-houzhu", "beiqi-youzhu-gaoheng",
    "beisongmo-liuyu", "beisongmo-zhangbangchang", "beiwei-tuobayu",
    "beiwei-youzhu-yuanzhao", "beiwei-yuanye", "beizhou-jingdi", "beizhou-xuandi",
    "chen-feidi", "chen-houzhu", "chenghan-liban", "chenghan-liqi", "chenghan-lishi",
    "dongwei-xiaojingdi", "gengshi-di", "gongsun-shu", "han-aidi", "han-houshaodi",
    "han-huidi", "han-jingdi", "han-liuhe", "han-qianshaodi", "han-zhaodi",
    "hou-han-shaodi-bian", "hou-han-shaodi-yi", "houliang-houzhu", "houqin-yaohong",
    "houqin-yaoxing", "houyan-murongbao", "houyan-muronglin", "houyan-murongsheng",
    "houyan-murongxi", "houyan-murongxiang", "huan-xuan", "jin-simalun",
    "liang-houjing", "liang-jingdi", "liang-xiaoji", "liang-xiaoyuanming",
    "liang-xiaozhengde", "liang-xiaozhuang", "liang-yuzhangwang", "liu-penzi",
    "liu-song-liushao", "liu-yong-liang", "nanming-shaowudi", "nansong-weiwang",
    "nanyan-murongchao", "qianliang-zhangzuo", "qianqin-fuchong", "qianqin-fudeng",
    "qianqin-fupi", "qianqin-fusheng", "qianyan-murongwei", "qianzhao-liucan",
    "qianzhao-liucong", "qianzhao-liuhe", "qianzhao-liuyao", "qianzhao-liuyuan",
    "qin-er-shi", "qin-shi-huang", "shiguo-beihan-liujien", "shiguo-beihan-liujiyuan",
    "shiguo-houshu-mengchang", "shiguo-jieyan-liushouguang", "shiguo-min-wangyanzheng",
    "shiguo-nanhan-liubin", "shiguo-nanhan-liuchang", "shiguo-qianshu-wangyan",
    "shiguo-wu-yangpu", "shuhan-liushan", "shun-lichengzheng", "sui-gongdi-tong",
    "sui-gongdi-you", "sui-yanghao", "suimo-fugongshi", "suimo-liangshidu",
    "suimo-linshihong", "suimo-liqui", "suimo-liuwuzhou", "suimo-lizitong",
    "suimo-wangshichong", "suimo-xiaoxian", "suimo-xueju", "suimo-xuerengao",
    "suimo-yuwenhuaji", "suimo-zhucan", "tang-wuzetian", "tangmo-anlushan",
    "tangmo-anqingxu", "tangmo-huangchao", "tangmo-li-chenghong", "tangmo-lixilie",
    "tangmo-shichaoyi", "tangmo-shisiming", "tangmo-zhuci", "wang-mang",
    "wei-caofang", "wei-caomao", "wei-yuandi", "wu-jingdi", "wu-modi", "wu-sunliang",
    "wuzhou-wushifan", "xi-zhangxianzhong", "xia-heliading", "xia-helianchang",
    "xiliao-tianxi", "xiwei-feidi-yuanqin", "xiwei-gongdi", "xiwei-wendi",
    "xiyan-murongchong", "xiyan-murongyao", "xiyan-murongyong", "xiyan-murongzhong",
    "yuan-shu", "yuan-tianshundi", "yuanmo-chenli", "yuanmo-chenyouliang",
    "yuanmo-hanlin-er", "yuanmo-mingsheng", "yuanmo-xushouhui",
    "zhonghuadiguo-yuanshikai",
)

BUCKETS = ("formula-in-cache", "zong-token", "cache-silent", "no-cache")


def _cache_text(eid):
    path = CACHE / f"{eid}.txt"
    if not path.exists():
        return None
    return _hn.norm_for_match(path.read_text(encoding="utf-8", errors="replace"))


def classify(eid, needles):
    text = _cache_text(eid)
    if text is None:
        return "no-cache"
    if any(n in text for n in needles):
        return "formula-in-cache"
    if ZONG_TOKEN.search(text):
        return "zong-token"
    return "cache-silent"


def run():
    """皇帝 id → バケット。**本人のキャッシュの中しか見ない**（見えない側を測るため）。"""
    needles = [_hn.norm_for_match(w) for w in FORMULA_WORDS]
    return {eid: classify(eid, needles) for eid in POPULATION}


def audit():
    """検出器の取りこぼしを、値が実在する174人の**全数**で測り直す。

    絞り込みの `cache-silent` を「値が無い」と読まないための根拠がここに出る
    （規則 R-SCREEN-FIRST の「absent 側は原典で読んで取りこぼし率を測る」を、
    標本ではなく全数でやれる珍しい場面 — 値が既に入っている人物は答えが分かっている）。
    """
    needles = [_hn.norm_for_match(w) for w in FORMULA_WORDS]
    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    rows = []
    for e in data["emperors"]:
        v = (e.get("name") or {}).get("templeName")
        if not v:
            continue
        text = _cache_text(e["id"])
        if text is None:
            kind = "no-cache"
        elif any(n in text for n in needles):
            kind = "formula"
        elif _hn.norm_for_match(v) in text:
            kind = "value-only"
        else:
            kind = "silent"
        rows.append((e["id"], e["regimeId"], v, kind))
    return rows


def sample(ids, seed, size):
    """種つきの無作為抽出。ハッシュ順の上位 k（母集団が動いても当落が変わらない）。"""
    rank = sorted(ids, key=lambda i: hashlib.md5(f"{seed}:{i}".encode()).hexdigest())
    return sorted(rank[:size])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--audit", action="store_true",
                    help="値がある174人で検出器の取りこぼしを全数測定する")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--sample", type=int, default=0, help="absent バケットから引く標本数")
    ap.add_argument("--sample-key", default="emperor-id", help="抽選の鍵")
    args = ap.parse_args()

    if args.audit:
        rows = audit()
        counts = {}
        for r in rows:
            counts[r[3]] = counts.get(r[3], 0) + 1
        total = len(rows)
        print(f"母集団 {total}人（`templeName` に値がある人物＝答えが分かっている側）")
        for k in ("formula", "value-only", "silent", "no-cache"):
            n = counts.get(k, 0)
            print(f"  {k:12s} {n:4d}人 ({n / total:5.1%})")
        miss = [r for r in rows if r[3] != "formula"]
        print(f"\n■ 定型で沈黙する {len(miss)}人（{len(miss) / total:.1%}）"
              f" — この率がそのまま `cache-silent` の危うさ")
        for eid, rid, v, kind in miss:
            print(f"    {eid:30s} {rid:16s} {v}  {kind}")
        return 0

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
            "buckets": {k: len(by_bucket.get(k) or []) for k in BUCKETS},
            "samples": {k: sample(by_bucket.get(k) or [], args.seed, args.sample)
                        for k in BUCKETS},
            "coverage": {eid: [b] for eid, b in sorted(buckets.items())},
        }, ensure_ascii=False, sort_keys=True))
        return 0

    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    regime = {e["id"]: e["regimeId"] for e in data["emperors"]}
    print(f"母集団 {len(POPULATION)}人（2026-08-14 に凍結）")
    for b in BUCKETS:
        ids = by_bucket.get(b) or []
        print(f"\n■ {b}: {len(ids)}人")
        for eid in ids:
            print(f"    {eid:30s} {regime.get(eid, '?')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
