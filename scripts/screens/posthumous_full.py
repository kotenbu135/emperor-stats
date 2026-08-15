#!/usr/bin/env python3
"""絞り込みの機械検査: 諡号の全長形（`name.posthumousNameFull`）の未確定68人（Issue #126）。

**判定はしない。読む順序と量を変えるだけ**（規則 R-NO-AUTOGEN）。
ここで決まるのは「本人の原文キャッシュの中に全長形の候補が在るので先に読む人物」と
「候補が1つも無いので閉域をキャッシュの外へ広げないと決められない人物」の仕分けだけで、
値は1つも書かない。

単位は**人物**。母集団は 2026-08-15 時点で `coverage.py` の `m_name` が
`posthumousNameFull` を判別不能と数えた68人で、下に凍結して持つ（作業が進むと
`read-absent` の証人が付いて母集団が減り、種つき標本が引き直しになるため。
`temple_name.py`・`posthumous_short.py` と同じ理由）。

## この欄の所在は「授与の条」ではなく**巻頭の定型**（2026-08-15・177人の全数実測）

廟号の絞り込みを組んだときの見立て（谥曰・追尊を走査する）は**この欄では外れる**。
値が在ると分かっている177人について、保存値がキャッシュのどこに在るかを数えると:

    直前が廟号（〈X〉祖／〈X〉宗）   110人  ← 「太祖文皇帝，讳丕」型の巻頭
    直前がキャッシュ先頭（空）        35人  ← 「孝文皇帝，高祖中子也」型の巻頭
    直前が 谥曰／号曰                17人  ← 授与の条
    その他（帝・纪・为・上…）         15人

**授与の条は6分の1しかない。** だから走査語を 谥／追尊／追崇 に置くと母集団の大半を
落とす。この絞り込みは**「皇帝」で終わる形そのもの**を主フックにし、授与の語は
副次的な信号としてしか使わない（新五代史 十国世家「追尊行密武皇帝，渥景皇帝，
隆演宣皇帝」のように授与語 谥 を1つも含まない条も実在する）。

保存値177件は**全件が「皇帝」で終わる**（「大帝」で終わる保存値は0件。東吳 大帝の
全長形は未確定だが、三國志の授与の条は「谥曰大皇帝」なので候補側は 大帝 も拾う）。
字数は3〜4字が84件で最頻・18字以上が36件（唐宋明清の加上）。

  人物
   ├ derived-hit  … 短縮諡から導ける形（諡字＋皇帝／孝＋諡字＋皇帝）が本人の
   │                キャッシュに**そのまま在る**。kind=read。**最も先に読む層**
   │                （導出は当て推量なので、条の主語を読んで確かめてから転記する）
   ├ head-form    … 導ける形は無いが、キャッシュ先頭120字以内に「〜皇帝」型が在る。
   │                kind=read。巻頭定型の位置なので本人を指す見込みが高い
   ├ body-form    … 「〜皇帝」型が本文の側にだけ在る。kind=read
   │                **その形が本人とは限らない** — 先帝・追尊された父祖・敵対政権の
   │                君主・即位の記事（「僭即皇帝位」）が同じ形で当たる
   ├ cache-silent … 「皇帝」「大帝」で終わる形が本人のキャッシュに1つも無い。kind=absent
   │                **空の証拠にはならない**（種つき標本8人のうち2人が反例。下の節）
   └ no-cache     … 原文キャッシュが無い。kind=read（書から直接読む）

## この検出器がどれだけ取りこぼすか（2026-08-15・**標本ではなく全数**）

`--audit` が測る。母集団は値が実在すると分かっている177人。

    「皇帝」型が本人のキャッシュに1つも無い      **0人**
    保存値そのものが候補集合に出てこない        16人（全員が明清の加上・20字超）

**廟号の 13人（7.5%）に対してこちらは 0人。** `verify_quotes.py
--check-posthumous-name-full` が 177/177 で当たる（当たらない0人・キャッシュ無し0人）
のと同じことを別方向から言っている。

### **その0人を「`cache-silent` は空だ」と読んではいけない**（2026-08-15・種つき標本で実測）

この0人は**「読んで見つかった値」だけを数えた結果**で、見つからなかった側は母集団に
入っていない。`cache-silent` 21人から種 126 で8人を引いて原典に当て直したところ、
**2人（25%）が反例**だった:

    王継鵬（閩 康宗）  十国春秋 L3885「永隆初諡帝曰…大孝皇帝，庙号康宗」
    王延羲（閩 景宗）  十国春秋 L3906「諡曰睿文広武明聖元徳隆道大孝皇帝，庙号景宗」

**授与の条は後継者の紀に在り、本人のキャッシュには入らない**（十国春秋の閩は1人
4行で、諡は次の帝の本紀が書く）。清の短縮呼称10件が全部別人のキャッシュに在ったのと
同じ形。だから `read-absent` を書くときは下の閉域4軸を必ず当てる。

候補集合から落ちる16人は明 13・清 3 の加上（「開天行道肇紀立極…成功高皇帝」25字）で、
**今回の68人には明清が1人も居ない**ので効かない。長い加上を読む段が来たら、
候補の作り方（`_variants` の右側切り出し）をその字数へ広げる。

## 導出規則「短縮諡の諡字＋皇帝」は当てにならない（同じく全数実測）

    導出（〈諡字〉皇帝／孝〈諡字〉皇帝／短縮そのまま）が当たる  75人
    外れる                                            23人  ← **全員が明清の加上**

「孝」を足す形を導出に入れる前は 46/52 で、外れの半分が前漢10・後漢11・西晋3の
**「孝」付き**だった。外れ方は人物ごとの偶然ではなく**政権ごとの書式**なので、
残る23人も政権で説明が付く。

### バケットそのものの外し方＝**偽の `derived-hit`**（同じく `--audit`）

導出規則の正誤ではなく「`derived-hit` に落ちたとき読み手へ渡す候補が保存値かどうか」を
測ると **23人**が外れる。**23人とも明13・清10**で、短い形（「高皇帝」）がキャッシュに
在るのに保存値は加上（「開天行道…成功高皇帝」）という型だけだった。
**今回の68人には明清が1人も居ない**（三国・十六国・南朝・十国・隋末唐初）ので、
この型の偽陽性はこの母集団では出ない見込み — ただし**渡す候補は候補であって値ではない**。
陳 宣帝のように「宣皇帝」と「孝宣皇帝」の両方が当たる人物が28人の中に居るので、
条の主語と授与の形を読んでから転記する。

### この絞り込みは `emperors.json` の**別の欄**を読む（`temple_name.py` との違い）

`derived_forms` が `name.posthumousName`（短縮諡）を読むので、**短縮諡を直すと
バケットが動く**。残量表に挙げた閩の2人（`shiguo-min-wangjipeng`「康宗」・
`shiguo-min-wangyanxi`「景宗」＝どちらも実体は廟号）を直すと、この2人の導出形が
変わって `check_screenings.py` が「件数が違います」で落ちる。**直したら
`python3 scripts/check_screenings.py --update` を同じ turn で流す。**

外れ方は人物ごとの偶然ではなく**政権ごとの書式**なので、`check_regime_conventions.py
--for <id> --field name.posthumousNameFull` を先に引く（この欄は政権慣行の層で
止まりやすい — 2026-08-15 の実測で68人中**28人が12政権で止まっている**）。

## `read-absent` を書くときの閉域（4軸・`temple_name.py` と同じ）

  1. 本人のキャッシュの外側（同じ書）… 巻の見出し・史臣曰／論曰・志
  2. 政権慣行レコードが言う所在 … `check_regime_conventions.py --for <id>
     --field name.posthumousNameFull`
  3. 別政権の書 … 亡国・廃位した君主は、贈った主体が後継／敵対政権であることがある
  4. 語彙は `hanzi_norm.norm_for_match` を通してから当てる

出力:
    python3 scripts/screens/posthumous_full.py            # 人が読む形
    python3 scripts/screens/posthumous_full.py --json     # ゲート（check_screenings.py）用
    python3 scripts/screens/posthumous_full.py --audit    # 検出器の取りこぼしを全数で測り直す
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

# 全長形の形そのものを主フックにする（上の実測のとおり授与の条は6分の1しかない）。
# 走査する側もされる側も norm_for_match を通すので字形は1つ書けば足りる
# **最短一致にする**（貪欲だと巻頭「明皇帝讳绍…元皇帝」で先頭の1件を
# 後続の当たりの中へ飲み込み、保存値そのものが候補から落ちる）
RUN = re.compile(r"([一-鿿]{1,30}?)(皇帝|大帝)")
# 巻頭定型と見なす範囲。上の実測（直前が廟号110人・キャッシュ先頭35人）がこの内側
HEAD_CHARS = 120
# 候補の先頭から落とす語。廟号（〈X〉祖／〈X〉宗）は「太祖文皇帝」型の巻頭で必ず前に付く
TEMPLE = re.compile(r"^[一-鿿][祖宗]")
LEADS = ("谥曰", "谥为", "号曰", "尊号曰", "上尊号曰", "追尊", "追崇", "谥", "曰", "为", "上", "称")

# 2026-08-15 時点で判別不能だった68人（`coverage.py` の `m_name` が正）。
# 作業で減るので凍結する。減った件数は data/screenings.json 側の記録で追う
POPULATION = (
    "beiqi-andewang-gaoyanzong", "beiqi-feidi-gaoyin", "chen-houzhu", "chen-wendi",
    "chen-wudi", "chen-xuandi", "chenghan-liban", "chenghan-liqi", "chenghan-lishou",
    "chenghan-lixiong", "houliang-mingdi", "houliang-xuandi", "houqin-yaochang",
    "houqin-yaoxing", "houyan-murongbao", "houyan-murongchui", "houyan-murongsheng",
    "houyan-murongxi", "houzhao-shihong", "houzhao-shihu", "houzhao-shijian",
    "houzhao-shile", "houzhao-shishi", "houzhao-shizhi", "houzhao-shizun",
    "huan-xuan", "liang-jianwendi", "liang-wudi", "liang-yuandi", "nanming-zhaozong",
    "nansong-duanzong", "nanyan-murongde", "qianliang-zhangzuo", "qianqin-fudeng",
    "qianqin-fujian", "qianqin-fupi", "qianqin-fusheng", "qianyan-murongjun",
    "qianzhao-liucan", "qianzhao-liucong", "qianzhao-liuyuan", "qin-er-shi",
    "qin-shi-huang", "shiguo-beihan-liuchong", "shiguo-beihan-liujun",
    "shiguo-min-wangjipeng", "shiguo-min-wangyanxi", "shuhan-liushan",
    "shuhan-zhaoliedi", "sui-gongdi-tong", "suimo-liqui", "suimo-xueju",
    "tangmo-anlushan", "tangmo-anqingxu", "tangmo-shisiming", "tangmo-zhuci",
    "wei-mingdi", "wei-wendi", "wei-yuandi", "wu-dadi", "wu-jingdi",
    "xia-helianbobo", "xia-helianchang", "xiliao-dezong", "xiliao-renzong",
    "yuanmo-mingsheng", "yuanmo-mingyuzhen", "zhonghuadiguo-yuanshikai",
)

BUCKETS = ("derived-hit", "head-form", "body-form", "cache-silent", "no-cache")


def _cache_text(eid):
    path = CACHE / f"{eid}.txt"
    if not path.exists():
        return None
    return _hn.norm_for_match(path.read_text(encoding="utf-8", errors="replace"))


def _variants(stem, tail):
    """1つの当たりから候補の形を作る（巻頭の廟号・授与の助辞を削る）。"""
    out = {stem + tail}
    s = stem
    while True:
        for lead in LEADS:
            if s.startswith(lead) and len(s) > len(lead):
                s = s[len(lead):]
                out.add(s + tail)
                break
        else:
            m = TEMPLE.match(s)
            if m and len(s) > 2:
                s = s[2:]
                out.add(s + tail)
                continue
            break
    # 区切りの無い長い run から右側だけを残した形（保存値は3〜4字が最頻）
    for k in range(1, 15):
        if len(stem) >= k:
            out.add(stem[-k:] + tail)
    return {v for v in out if 3 <= len(v) <= 32}


def candidates(text):
    """候補 → その候補が最初に現れた位置。**本人のキャッシュの中しか見ない**。

    直後が「位」の当たりは落とす（「僭即皇帝位」型の即位記事で、諡ではない）。
    落として保存値が拾えなくなる人物は177人中0人であることを `--audit` で測っている。
    """
    out = {}
    for m in RUN.finditer(text):
        if text[m.end():m.end() + 1] == "位":
            continue
        for v in _variants(m.group(1), m.group(2)):
            out[v] = min(out.get(v, 10 ** 9), m.start())
    return out


def derived_forms(short):
    """短縮諡から導ける全長形。**当たっても確定ではない**（正答率は --audit）。"""
    if not short:
        return set()
    out = set()
    if short.endswith("皇帝") or short.endswith("大帝"):
        out.add(short)
    if short.endswith("帝"):
        core = short[:-1]
        out.add(core + "皇帝")
        out.add(core + "大帝")
        out.add("孝" + core + "皇帝")  # 前漢10・後漢11・西晋3がこの型
    return {_hn.norm_for_match(v) for v in out}


def classify(eid, short):
    text = _cache_text(eid)
    if text is None:
        return "no-cache", []
    cand = candidates(text)
    hit = sorted(derived_forms(short) & set(cand), key=len)
    if hit:
        return "derived-hit", hit
    head = sorted([k for k, v in cand.items() if v < HEAD_CHARS], key=len)
    if head:
        return "head-form", head[:3]
    if cand:
        return "body-form", sorted(cand, key=len)[:3]
    return "cache-silent", []


def _shorts():
    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    return ({e["id"]: (e.get("name") or {}).get("posthumousName") or "" for e in data["emperors"]},
            {e["id"]: e["regimeId"] for e in data["emperors"]})


def run():
    """皇帝 id → (バケット, 候補)。"""
    short, _ = _shorts()
    return {eid: classify(eid, short.get(eid, "")) for eid in POPULATION}


def audit():
    """検出器の取りこぼしと導出規則の正答率を、値が実在する177人の**全数**で測り直す。

    絞り込みの `cache-silent` を「値が無い」と読まないための根拠がここに出る
    （規則 R-SCREEN-FIRST の「absent 側は原典で読んで取りこぼし率を測る」）。
    """
    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    silent, derived_ok, derived_bad, tail = [], [], [], {}
    total = 0
    not_in_candidates = []
    false_hit = []
    for e in data["emperors"]:
        full = (e.get("name") or {}).get("posthumousNameFull")
        if not full:
            continue
        total += 1
        tail[full[-2:]] = tail.get(full[-2:], 0) + 1
        text = _cache_text(e["id"])
        if text is None:
            silent.append((e["id"], "no-cache"))
            continue
        cand = candidates(text)
        # **絞り込みが使うのと同じ判定で数える**（RUN.search では「即皇帝位」しか
        # 持たない人物を非沈黙と数えてしまい、classify の cache-silent と食い違う）
        if not cand:
            silent.append((e["id"], "silent"))
        elif _hn.norm_for_match(full) not in cand:
            not_in_candidates.append((e["id"], full))
        short = (e.get("name") or {}).get("posthumousName") or ""
        forms = derived_forms(short)
        if not forms:
            continue
        (derived_ok if _hn.norm_for_match(full) in forms else derived_bad).append(
            (e["id"], short, full))
        # バケットの当たり方そのものを測る（導出規則の正誤ではなく、
        # 「derived-hit に落ちたとき渡す候補が保存値かどうか」）
        hit = forms & set(cand)
        if hit and _hn.norm_for_match(full) not in hit:
            false_hit.append((e["id"], e["regimeId"], short, sorted(hit), full))
    return total, tail, silent, derived_ok, derived_bad, not_in_candidates, false_hit


def sample(ids, seed, size):
    """種つきの無作為抽出。ハッシュ順の上位 k（母集団が動いても当落が変わらない）。"""
    rank = sorted(ids, key=lambda i: hashlib.md5(f"{seed}:{i}".encode()).hexdigest())
    return sorted(rank[:size])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--audit", action="store_true",
                    help="値がある177人で検出器の取りこぼしと導出規則を全数測定する")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--sample", type=int, default=0, help="absent バケットから引く標本数")
    ap.add_argument("--sample-key", default="emperor-id", help="抽選の鍵")
    args = ap.parse_args()

    if args.audit:
        total, tail, silent, ok, bad, missed, false_hit = audit()
        print(f"母集団 {total}人（`posthumousNameFull` に値がある人物＝答えが分かっている側）")
        print(f"  保存値の末尾2字: {sorted(tail.items(), key=lambda kv: -kv[1])}")
        print(f"\n■ 「皇帝」型が本人のキャッシュに1つも無い人物: {len(silent)}人  {silent}")
        print(f"   （廟号の同じ測定は 13人 7.5% だった。この欄は所在が巻頭定型なので当たる）")
        print(f"\n■ 保存値そのものが候補集合に出てこない人物: {len(missed)}人")
        for eid, full in missed:
            print(f"    {eid:28s} {full}")
        print(f"\n■ 導出規則「短縮諡 → 全長形」の正答率: 当たり {len(ok)} / 外れ {len(bad)}")
        for eid, s, f in bad:
            print(f"    {eid:28s} {s:12s} → 実際は {f}")
        print(f"\n■ **偽の derived-hit**（導ける形がキャッシュに在るのに、それが保存値ではない）"
              f": {len(false_hit)}人")
        for eid, rid, s, hit, f in false_hit:
            print(f"    {eid:28s} {rid:16s} 短縮={s:10s} 渡す候補={'・'.join(hit)} → 実際は {f}")
        return 0

    result = run()
    by_bucket = {}
    for eid in POPULATION:
        by_bucket.setdefault(result[eid][0], []).append(eid)

    if args.json:
        print(json.dumps({
            # コーパスの無い環境（CI）では全員が no-cache へ落ちて記録と必ずずれる
            "corpus": CACHE.is_dir() and any(CACHE.glob("*.txt")),
            "unit": "person",
            "n": len(POPULATION),
            "buckets": {k: len(by_bucket.get(k) or []) for k in BUCKETS},
            "samples": {k: sample(by_bucket.get(k) or [], args.seed, args.sample)
                        for k in BUCKETS},
            "coverage": {eid: [b] for eid, (b, _) in sorted(result.items())},
        }, ensure_ascii=False, sort_keys=True))
        return 0

    short, regime = _shorts()
    print(f"母集団 {len(POPULATION)}人（2026-08-15 に凍結）")
    for b in BUCKETS:
        ids = by_bucket.get(b) or []
        print(f"\n■ {b}: {len(ids)}人")
        for eid in ids:
            cand = " ".join(result[eid][1])
            print(f"    {eid:30s} {regime.get(eid, '?'):18s} "
                  f"短縮={short.get(eid) or '—':10s} {cand}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
