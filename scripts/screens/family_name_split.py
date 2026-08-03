#!/usr/bin/env python3
"""絞り込みの機械検査: `name.personalName`（姓＋諱）を姓と諱へ割る切れ目（Issue #37 単位6）。

**判定はしない。読む順序と量を変えるだけ**（規則 `R-NO-AUTOGEN`）。
ここで決まるのは「どの人物を原典に当て直すか」だけで、値は1つも書かない。

## 何を絞り込むのか

`personalName` は 2026-08-03 の決定で**姓＋諱**を1つの文字列に持っている（「嬴胡亥」）。
これを `familyName`＋`personalName`（諱）へ割るとき、**人物の名前そのものは既に確定済み**で、
新しく決まるのは**どこで切るか**だけ。誤りの形は2つしかない:

- **複姓を1字で切る**（「司馬炎」→ 姓「司」）
- **姓を持たない名を切る**（元の「忽必烈」はモンゴル語名の漢字音写で姓ではない）

そこで切れ目そのものに底本の裏を取る。

  切れ目の候補（複姓リストで始まれば複姓・それ以外は先頭1字）
   ├ kana-name … 民族名 `ethnicName.kind == mongol` の人物。相手側 personalName は
   │             同じ名前の漢字音写（クビライ＝忽必烈）なので**姓を持たない候補**。
   │             **判定順の先頭に置く**（下の注）
   ├ hui       … 本人の原文キャッシュに「讳〈諱候補〉」が在る。
   │             **切れ目を原文が名指ししている**ので最も強い。
   │             「名〈諱候補〉」は採らない — 諱候補が1字だと別の文脈に当たる
   │             （元の武宗「海山」が「名山」で当たった）
   ├ xing      … コーパス全体に「姓〈姓候補〉氏」が在る。姓としての実在（＝複姓の
   │             切れ目）の裏で、**この人物がその姓であること**の証拠ではない
   └ unattested … どれも当たらない。**ここが要読解**

さらに切れ目を**反対側から**も叩く（`ambiguous`）— 1字で切った人物について、
**2字の接頭辞もコーパスで複姓として当たるか**を見る。当たれば1字で切ってよい理由が
無くなるので要読解へ落ちる。この検出器は `COMPOUND` の取りこぼし（一覧に無い複姓を
政権まるごと1字で切る形）を捕まえるためのもので、**一覧を人が眺めて確かめるのとは
独立**に効く。

**absent 側の非対称に注意**（規則 `R-SWEEP-DETECTION`）— `xing` が当たらないことは
「その姓が存在しない」ではなく「コーパスにその定型が無い」で、逆に `xing` が当たっても
本人がその姓だとは言えない（同名の姓が別の人物に在るだけかもしれない）。**当たりを
悉皆性の根拠に使わない。**

出力:
    python3 scripts/screens/family_name_split.py            # 人が読む形
    python3 scripts/screens/family_name_split.py --json     # ゲート（check_screenings.py）用
    python3 scripts/screens/family_name_split.py --list <バケット>  # そのバケットの全件
"""
import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
EMPERORS = ROOT / "data" / "emperors.json"
CACHE = ROOT / "_corpus_cache"
CORPORA = [ROOT / "china-history", ROOT / "daizhigev20"]

sys.path.insert(0, str(ROOT / "scripts"))
import hanzi_norm  # noqa: E402

# 複姓の候補。**この一覧そのものが判定ではない** — ここに載せた形で切ったうえで、
# 下の `xing` 照合（コーパスに「姓◯氏」が在るか）で切れ目の裏を取る。
# 一覧に無い複姓を1字で切ってしまう取りこぼしは、政権内の一貫性（ゲートD）でも
# 見えない（政権まるごと同じ誤り方をするため）ので、**足すときは底本で確かめる**。
COMPOUND = (
    "愛新覚羅",
    "司馬",
    "慕容",
    "赫連",
    "宇文",
    "拓跋",
    "耶律",
    "完顔",
    "公孫",
)

BUCKETS = ("kana-name", "hui", "xing", "ambiguous", "unattested")


def split_candidate(personal_name):
    """切れ目の候補を返す（姓, 諱）。複姓リストに当たらなければ先頭1字を姓とする。"""
    for c in COMPOUND:
        if personal_name.startswith(c) and len(personal_name) > len(c):
            return c, personal_name[len(c):]
    return personal_name[0], personal_name[1:]


def corpus_family_names(candidates):
    """コーパス全体で「姓〈候補〉氏」が在る候補の集合を返す（コーパスが無ければ空）。

    候補には**1字で切った人物の2字接頭辞**も混ぜて渡す（`ambiguous` の判定に使う）。
    **文脈抽出をしない**（規則 `R-CORPUS-GREP`）。固定文字列の一致だけを取り出す。
    """
    roots = [str(p) for p in CORPORA if p.exists()]
    if not roots:
        return set(), False
    patterns = "\n".join(f"姓{hanzi_norm.norm_for_match(c)}氏" for c in sorted(candidates))
    try:
        out = subprocess.run(
            ["rg", "-oF", "-I", "--no-messages", "-f", "-", *roots],
            input=patterns, capture_output=True, text=True, timeout=900,
        ).stdout
    except (OSError, subprocess.TimeoutExpired):
        return set(), False
    hit = {line.strip() for line in out.splitlines() if line.strip()}
    return {c for c in candidates
            if f"姓{hanzi_norm.norm_for_match(c)}氏" in hit}, True


def run(use_corpus=True):
    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    rows = {}
    cands = {}
    for e in data["emperors"]:
        name = e.get("name") or {}
        # **移行後も同じ母集団を出すために姓＋諱へ戻してから割る**（Issue #37 単位6）。
        # 分けたあとの `personalName` は諱だけなので、そのまま割ると「胡亥」→
        # 姓 胡／諱 亥 になり、**落ちずに違う数字を出す**（記録した件数と突き合わなくなる）。
        personal = (f"{name.get('familyName') or ''}"
                    f"{name.get('personalName') or ''}").strip()
        if not personal:
            continue
        cands[e["id"]] = split_candidate(personal)

    families = {f for f, _ in cands.values()}
    # 1字で切った人物の2字接頭辞（複姓の取りこぼしを反対側から叩く）。
    prefixes = {
        pn[:2]
        for eid, (f, g) in cands.items()
        for pn in [f + g]
        if len(f) == 1 and len(pn) >= 3
    }
    attested, corpus_ok = (corpus_family_names(families | prefixes)
                           if use_corpus else (set(), False))

    for e in data["emperors"]:
        if e["id"] not in cands:
            continue
        family, given = cands[e["id"]]
        kind = ((e.get("name") or {}).get("ethnicName") or {}).get("kind")
        text = ""
        p = CACHE / f"{e['id']}.txt"
        if p.exists():
            text = hanzi_norm.norm_for_match(p.read_text(encoding="utf-8", errors="ignore"))
        g = hanzi_norm.norm_for_match(given)
        # **民族名の判定を先に置く**（`kind` はデータ側で確定済みの事実で、
        # 原文の部分一致より強い）。元の武宗「海山」は諱候補が1字の「山」なので
        # 「名山」が別の文脈に当たってしまい、順序を逆にすると `hui` へ落ちる。
        personal = family + given
        two = personal[:2] if len(family) == 1 and len(personal) >= 3 else None
        if kind == "mongol":
            bucket = "kana-name"
        elif two and two in attested:
            # 1字で切ったが2字も複姓として在る＝切れ目を機械では決められない。
            # **原文で当て直す**（当たり側の `hui` より優先して落とす）
            bucket = "ambiguous"
        elif g and f"讳{g}" in text:
            bucket = "hui"
        elif family in attested:
            bucket = "xing"
        else:
            bucket = "unattested"
        rows[e["id"]] = (bucket, family, given)
    return rows, corpus_ok


def sample(ids, seed, size):
    """種つきの無作為抽出（`childhood_name.py` と同じ作法）。

    **誰かが選んだ標本では取りこぼし率は言えない**ので、抽出はここで決めて
    記録側が同じ種で引き直す。ハッシュ順の上位 k を取る（母集団が動いても
    既存の標本の当落が変わらない）。
    """
    rank = sorted(ids, key=lambda i: hashlib.md5(f"{seed}:{i}".encode()).hexdigest())
    return sorted(rank[:size])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--list", metavar="バケット", choices=BUCKETS)
    ap.add_argument("--sample", metavar="バケット", choices=BUCKETS,
                    help="そのバケットから種つき無作為標本を出す（監査用）")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--size", type=int, default=6)
    ap.add_argument("--no-corpus", action="store_true",
                    help="コーパス照合を飛ばす（xing が全件 unattested へ落ちる）")
    args = ap.parse_args()

    rows, corpus_ok = run(use_corpus=not args.no_corpus)
    counts = {b: sum(1 for v in rows.values() if v[0] == b) for b in BUCKETS}

    if args.json:
        print(json.dumps({"population": len(rows), "buckets": counts,
                          "corpus": corpus_ok}, ensure_ascii=False))
        return
    if args.list:
        for eid, (bucket, family, given) in sorted(rows.items()):
            if bucket == args.list:
                print(f"{eid}\t{family}\t{given}")
        return
    if args.sample:
        picked = sample([i for i, v in rows.items() if v[0] == args.sample],
                        args.seed, args.size)
        for eid in picked:
            _, family, given = rows[eid]
            print(f"{eid}\t{family}\t{given}")
        return

    print(f"母集団 {len(rows)}人"
          f"（コーパス照合: {'あり' if corpus_ok else 'なし'}）")
    for b in BUCKETS:
        print(f"  {b:<11} {counts[b]:>4}")
    print(f"要読解 {counts['unattested']}人")

    # 移行後は**保存値との突合**にもなる（絞り込みが出す切れ目と、データが持つ姓のずれ）。
    # 判定はしない — ずれた人物を読む対象として出すだけ。
    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    diff = [(e["id"], (e.get("name") or {}).get("familyName"), rows[e["id"]][1])
            for e in data["emperors"]
            if e["id"] in rows and "familyName" in (e.get("name") or {})
            and ((e.get("name") or {}).get("familyName") or "") != (
                "" if rows[e["id"]][0] == "kana-name" else rows[e["id"]][1])]
    if diff:
        print(f"\n保存値と切れ目がずれる {len(diff)}人（要読解）")
        for eid, stored, cand in diff:
            print(f"  {eid}\t保存 {stored}\t候補 {cand}")


if __name__ == "__main__":
    main()
