#!/usr/bin/env python3
"""絞り込みの機械検査: 生母（`data/kinship.json` の `birth-mother` エッジ）の未読113人（Issue #171）。

**判定はしない。読む順序と量を変えるだけ**（規則 `R-NO-AUTOGEN`）。ここで決まるのは
「本人の原文キャッシュの中に母を名指す定型が在るので先に読む人物」と「キャッシュの外へ
出ないと決められない人物」「そもそもその政権に后妃伝が立たない人物」の仕分けだけで、
母の名は1つも書かない。

単位は**人物**。母集団は 2026-08-17 時点で `coverage.py` の `m_mother` が判別不能と数えた
113人（生母エッジ178・不在確定74＝`meta.confirmedMotherUnknown` を除いた残り）で、下に
凍結して持つ。**作業が進むと母集団が減る**ので、凍結しないとバケットの件数が記録と
合わなくなる（`temple_name.py`・`posthumous_short.py` と同じ理由）。

読むのは2つのファイル — 本人の原文キャッシュ `_corpus_cache/<id>.txt` と、**フェーズ
1〜3（継承・実父・王朝間縁戚）が原文から切り出して保存した `_corpus_cache/kinship/<id>.txt`**。
**113人全員が後者を持つ**ので、母の条が既に手元に在ることが少なくない（後者を足すだけで
22人が `mother-formula` へ移った）。

  人物
   ├ mother-formula    … 母を名指す定型（母曰・生母・其母・所生）が在る 81人。kind=read
   │                     **その母が生母とは限らない** — 嫡母・養母・祖母を同じ語で書く条が
   │                     ある（後漢 殤帝の和熹鄧皇后が実例で、既存の
   │                     `confirmedMotherUnknown` の理由文に残っている）
   ├ taihou-only       … 定型は無く「太后」「母弟」だけが在る 19人。kind=read
   │                     尊号・追尊・同母弟の記事で出るだけのことが多く、母の名を与えない
   ├ consort-volume    … どちらも沈黙で、**その政権自身の正史に后妃伝・皇后紀が立つ** 3人
   │                     （金 末帝・明 太祖・明 仁宗）。kind=read。裏取りの本命はその巻
   ├ no-consort-volume … どちらも沈黙で、**その政権自身の后妃伝が無い** 10人。kind=read
   │                     （唐末群雄2・西夏3・元末群雄3・順1・西1）。読む先は
   │                     他政権の書の列伝（旧唐書・明史）と別史（西夏書事）で、
   │                     `confirmedMotherUnknown` になりやすいのはこの層
   └ no-cache          … どちらのファイルも無い 0人

## この検出器がどれだけ沈黙するか（2026-08-17・`--audit`・標本ではなく全数）

母集団は**生母エッジが既に在る178人**（答えが分かっている側）で、同じ検出器を掛ける。
**生母フェーズが後から追記した `(mother)` の節は落として測る** — 落とさないと
「自分の答案を読み返して98.9%当たった」という循環した数字になる（実測した）。

    mother-formula      110人（61.8%）
    taihou-only          47人（26.4%）
    no-consort-volume    21人（11.8%）

**母の名が実際に分かっている人物の 38.2% が、母の定型では沈黙する。**
だから沈黙側のバケットを「母の記載が無い」と読んではいけない（`R-SCREEN-FIRST`）。
**ただしこの178人は唐以前の書**（漢書・後漢書・晋書・南北朝の各書…）で、これから読む
113人の書（宋史・遼史・金史・元史・明史・清史稿）とは后妃の書き方が違う。率はあくまで
「沈黙は珍しくない」ことの根拠で、宋以降でも同じ38%になるという意味ではない。

**absent のバケットを立てていない。** この絞り込みは「機械が母を見つけられなかった」を
どこでも「母の記載が無い」と読み替えないので、種つき標本の監査は要らない（`R-SCREEN-FIRST`
の absent 側の要求は掛からない）。沈黙の側の3バケットは全部 kind=read ＝「読む先が
キャッシュの外にある」という所在の話でしかない。

出力:
    python3 scripts/screens/birth_mother.py           # 人が読む形
    python3 scripts/screens/birth_mother.py --json    # ゲート（check_screenings.py）用
    python3 scripts/screens/birth_mother.py --audit   # 検出器の取りこぼしを全数で測り直す
"""
import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
EMPERORS = ROOT / "data" / "emperors.json"
KINSHIP = ROOT / "data" / "kinship.json"
CACHE = ROOT / "_corpus_cache"
DAIZHI = ROOT / "daizhigev20"

_spec = importlib.util.spec_from_file_location(
    "hanzi_norm", ROOT / "scripts" / "hanzi_norm.py")
_hn = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_hn)

# 母を名指す定型。正規化を通すので字形（曰／曰・其／其）は1つ書けば足りる
MOTHER_WORDS = ("母曰", "生母", "其母", "所生")
# 母への手掛かりではあるが名を与えない語。尊号・追尊・同母弟の記事で出る
WEAK_WORDS = ("太后", "母弟")

# 政権 → その政権自身の正史（后妃伝・皇后紀が立つ書）。**在否は下で実際に当てる**ので、
# ここに書くのは「どの書がその政権の后妃を持つはずか」という対応だけ
REGIME_HISTORY = {
    "northern-song": "史藏/正史/宋史.txt",
    "southern-song": "史藏/正史/宋史.txt",
    "liao": "史藏/正史/辽史.txt",
    "jin-jurchen": "史藏/正史/金史.txt",
    "yuan": "史藏/正史/元史.txt",
    "ming": "史藏/正史/明史.txt",
    "qing": "史藏/正史/清史稿.txt",
    "northern-yuan": "史藏/正史/新元史.txt",
}
# 后妃の巻の見出し。書によって語が割れる（宋史・遼史・金史・元史・明史＝后妃传／
# 清史稿＝后妃／新元史＝后妃传）
CONSORT_MARKERS = ("后妃传", "后妃列传", "皇后纪", "后妃")

BUCKETS = ("mother-formula", "taihou-only", "consort-volume",
           "no-consort-volume", "no-cache")

# 2026-08-17 に凍結した未読113人（`coverage.py` の `m_mother` が判別不能と数えた側）
POPULATION = (
    "tangmo-anlushan", "tangmo-anqingxu", "tangmo-shisiming", "tangmo-shichaoyi",
    "tangmo-zhuci", "tangmo-lixilie", "tangmo-huangchao",
    "beisong-taizu", "beisong-taizong", "beisong-zhenzong", "beisong-renzong",
    "beisong-yingzong", "beisong-shenzong", "beisong-zhezong", "beisong-huizong",
    "beisong-qinzong",
    "nansong-gaozong", "nansong-xiaozong", "nansong-guangzong", "nansong-ningzong",
    "nansong-lizong", "nansong-duzong", "nansong-gongdi", "nansong-duanzong",
    "nansong-weiwang",
    "liao-taizu", "liao-taizong", "liao-shizong", "liao-muzong", "liao-jingzong",
    "liao-shengzong", "liao-xingzong", "liao-daozong", "liao-tianzuodi",
    "xiliao-dezong", "xiliao-renzong", "xiliao-tianxi",
    "jin-taizu", "jin-taizong", "jin-xizong", "jin-hailingwang", "jin-shizong",
    "jin-zhangzong", "jin-weishaowang", "jin-xuanzong", "jin-aizong", "jin-modi",
    "xixia-jingzong", "xixia-yizong", "xixia-huizong", "xixia-chongzong",
    "xixia-renzong", "xixia-huanzong", "xixia-xiangzong", "xixia-shenzong",
    "xixia-xianzong", "xixia-mozhu",
    "beisongmo-zhangbangchang", "beisongmo-liuyu",
    "yuan-shizu", "yuan-chengzong", "yuan-wuzong", "yuan-renzong", "yuan-yingzong",
    "yuan-taidingdi", "yuan-tianshundi", "yuan-wenzong", "yuan-mingzong",
    "yuan-ningzong", "yuan-huizong", "beiyuan-zhaozong",
    "yuanmo-hanlin-er", "yuanmo-xushouhui", "yuanmo-chenyouliang", "yuanmo-chenli",
    "yuanmo-mingyuzhen", "yuanmo-mingsheng",
    "ming-taizu", "ming-huizong", "ming-taizong", "ming-renzong", "ming-xuanzong",
    "ming-yingzong", "ming-daizong", "ming-xianzong", "ming-xiaozong", "ming-wuzong",
    "ming-shizong", "ming-muzong", "ming-shenzong", "ming-guangzong", "ming-xizong",
    "ming-yizong",
    "nanming-anzong", "nanming-zongzong", "nanming-shaowudi", "nanming-zhaozong",
    "shun-lichengzheng", "xi-zhangxianzhong",
    "qing-taizong", "qing-shizu", "qing-shengzu", "qing-shizong", "qing-gaozong",
    "qing-renzong", "qing-xuanzong", "qing-wenzong", "qing-muzong", "qing-dezong",
    "qing-xuantong",
    "wuzhou-wusangui", "wuzhou-wushifan", "zhonghuadiguo-yuanshikai",
)

_consort_cache = {}


def has_consort_volume(regime_id):
    """その政権自身の正史に后妃の巻が在るか。**対応表ではなく底本に当てて決める**。"""
    rel = REGIME_HISTORY.get(regime_id)
    if not rel:
        return False
    if regime_id in _consort_cache:
        return _consort_cache[regime_id]
    path = DAIZHI / rel
    ok = False
    if path.exists():
        text = _hn.norm_for_match(path.read_text(encoding="utf-8", errors="replace"))
        ok = any(_hn.norm_for_match(m) in text for m in CONSORT_MARKERS)
    _consort_cache[regime_id] = ok
    return ok


def _cache_text(eid, drop_mother_section=False):
    """本人の原文キャッシュ ＋ **フェーズ1〜3が保存した系譜パッセージ**を合わせて読む。

    `_corpus_cache/kinship/<id>.txt` は継承・実父・王朝間縁戚の調査のときに原文から
    切り出して保存したもので、**113人全員がこのファイルを持つ**。本紀の抜粋だけを見る
    より確実に母の条を含む（2026-08-17 に実測したところ、これを足すだけで22人が
    `mother-formula` へ移った — 袁世凱もキャッシュ本体は無いがこちらは在る）。
    """
    parts = []
    for path in (CACHE / f"{eid}.txt", CACHE / "kinship" / f"{eid}.txt"):
        if path.exists():
            parts.append(path.read_text(encoding="utf-8", errors="replace"))
    if not parts:
        return None
    text = "\n".join(parts)
    if drop_mother_section:
        text = _without_mother_section(text)
    return _hn.norm_for_match(text)


def _without_mother_section(text):
    """生母フェーズが後から追記した「(mother)」の節を落とす。

    **監査を循環させないための処理**。生母が確定済みの178人のパッセージ集には、
    まさにその母を確定したときの原文が `## …（mother）` として追記されている。
    落とさずに測ると「検出器は98.9%当たる」という自分の答案を読んだだけの数字になる。
    """
    out, skipping = [], False
    for line in text.split("\n"):
        if line.startswith("## "):
            skipping = "mother" in line
        if not skipping:
            out.append(line)
    return "\n".join(out)


def classify(eid, regime_id, drop_mother_section=False):
    text = _cache_text(eid, drop_mother_section)
    if text is None:
        return "no-cache"
    if any(_hn.norm_for_match(w) in text for w in MOTHER_WORDS):
        return "mother-formula"
    if any(_hn.norm_for_match(w) in text for w in WEAK_WORDS):
        return "taihou-only"
    return "consort-volume" if has_consort_volume(regime_id) else "no-consort-volume"


def regimes():
    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    return {e["id"]: e["regimeId"] for e in data["emperors"]}


def run(regime=None):
    regime = regime or regimes()
    return {eid: classify(eid, regime.get(eid, "")) for eid in POPULATION}


def audit():
    """検出器の取りこぼしを、**生母エッジが既に在る178人の全数**で測り直す。

    答えが分かっている側に同じ検出器を掛けて、何人がキャッシュの中で沈黙するかを数える。
    ここで沈黙する率がそのまま `consort-volume`・`no-consort-volume` の危うさになる
    （この2バケットは「値が無い」ではなく「読む先がキャッシュの外」の意だが、
    率を知らないと読む量の見積もりが立たない）。
    """
    kin = json.loads(KINSHIP.read_text(encoding="utf-8"))
    regime = regimes()
    known = sorted({e["to"] for e in kin["edges"]
                    if e.get("type") == "kinship" and e.get("relation") == "birth-mother"}
                   & set(regime))
    rows = []
    for eid in known:
        rows.append((eid, regime[eid], classify(eid, regime[eid], drop_mother_section=True)))
    return rows


def sample(ids, seed, size):
    """種つきの無作為抽出。ハッシュ順の上位 k（母集団が動いても当落が変わらない）。"""
    rank = sorted(ids, key=lambda i: hashlib.md5(f"{seed}:{i}".encode()).hexdigest())
    return sorted(rank[:size])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--audit", action="store_true",
                    help="生母エッジがある178人で検出器の沈黙率を全数測定する")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--sample", type=int, default=0)
    ap.add_argument("--sample-key", default="emperor-id")
    args = ap.parse_args()

    regime = regimes()

    if args.audit:
        rows = audit()
        counts = {}
        for r in rows:
            counts[r[2]] = counts.get(r[2], 0) + 1
        total = len(rows)
        print(f"母集団 {total}人（生母エッジが在る＝答えが分かっている側）")
        for b in BUCKETS:
            n = counts.get(b, 0)
            print(f"  {b:18s} {n:4d}人 ({n / total:5.1%})")
        silent = [r for r in rows if r[2] not in ("mother-formula",)]
        print(f"\n■ 母の定型で沈黙する {len(silent)}人（{len(silent) / total:.1%}）"
              f" — この率がそのまま沈黙側3バケットの読む量")
        for eid, rid, b in silent:
            print(f"    {eid:32s} {rid:16s} {b}")
        return 0

    buckets = run(regime)
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

    print(f"母集団 {len(POPULATION)}人（2026-08-17 に凍結）")
    for b in BUCKETS:
        ids = by_bucket.get(b) or []
        print(f"\n■ {b}: {len(ids)}人")
        for eid in ids:
            print(f"    {eid:32s} {regime.get(eid, '?')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
