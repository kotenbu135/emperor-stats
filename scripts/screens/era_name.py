#!/usr/bin/env python3
"""絞り込みの機械検査: 改元 event の元号名 `eraName`（Issue #37 単位2）。

**判定はしない。読む順序と量を変えるだけ**（規則 R-NO-AUTOGEN）。
ここで決まるのは「どの event を転記として読み、どれを原典へ戻って調べるか」だけで、
値は1つも書かない。**候補は転記の当たりであって転記ではない** — 建てた元号か
捨てた元号かは人が note と原文を読んで決める。

単位は `eraChangeCount.events[]` の**まだ `eraName` を持たない event**。
埋まった event は母集団の外（訂正は別作業）なので、転記が進むと n は減る。

  event
   ├ unique    … note から立てた候補のうち**ちょうど1つ**が本人の原文キャッシュで
   │             改元の定型句と隣り合う。kind=read（転記として読む側）
   ├ multi     … 候補が2つ以上とも原文で定型句と隣り合う。建てた元号と捨てた元号が
   │             どちらも本人の紀に在る形（「章武から建興へ改元」）。kind=read
   ├ note-only … note に候補はあるが、原文キャッシュで定型句と隣り合わない。
   │             底本の字体・note の語順・別の書からの引用など。kind=read
   ├ absent    … 機械が候補を1つも立てられなかった。kind=absent
   │             （「元号名が無い」の証拠ではない。だから標本を原典で読む）
   └ no-cache  … 本人の原文キャッシュが無く照合そのものができない。kind=absent

候補の立て方は2段で、**note 側とコーパス側の両方に在ることを条件にする**。
note だけを見ると日本語の地の文（「同時」「相当」）を拾い、コーパスだけを見ると
その人物の紀に載る**他の帝の改元**まで拾うため。

出力:
    python3 scripts/screens/era_name.py            # 人が読む形
    python3 scripts/screens/era_name.py --json     # ゲート（check_screenings.py）用
    python3 scripts/screens/era_name.py --list unique   # 読む順に event を並べる
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from hanzi_norm import norm_for_match  # noqa: E402
from verify_quotes import era_anchor_hit  # noqa: E402

EMPERORS = ROOT / "data" / "emperors.json"
CACHE_DIR = ROOT / "_corpus_cache"

NAME = r"[一-鿿㐀-䶿]{2}"     # 元号名はほぼ2字（3〜4字の元号はこの絞り込みでは拾わない）
PREF = r"(?:改元|建元|改號|改号|改年|紀元|纪元|年號|年号|改為|改为|曰|為|为)"

# note 側（日本語の地の文＋引用の混在）
NOTE_BUILD = [
    re.compile(PREF + r"(?:して|曰|は)?[「『]?(" + NAME + r")[」』]?"),
    re.compile(r"[「『]?(" + NAME + r")[」』]?(?:に|へ)(?:改元|建元|改める|改めた)"),
    re.compile(r"(?<![一-鿿])(" + NAME + r")元年"),
]
# 捨てた側を名指しする形（候補から落とす。**落としきることは期待しない** — 落ちなければ
# multi として要読解へ回るだけで、絞り込みが値を決めるわけではない）
NOTE_DROP = [
    re.compile(r"[「『]?(" + NAME + r")[」』]?(?:から|より|を改めて|を廃して|を継続|をそのまま)"),
]
# コーパス側（正規化済み。繁簡・異体は norm_for_match が吸う）
CORPUS_BUILD = [
    re.compile(r"(?:改元|建元|改年|紀元|纪元|年號|年号)(?:曰|為|为)?(" + NAME + r")"),
    re.compile(r"(?<![一-鿿])(" + NAME + r")元年"),
    re.compile(r"(?:曰|為|为)(" + NAME + r")"),
]

# 元号名になり得ない字。**候補の2字目が数字**（「元和四年」から切れた「和四」）と、
# 日付・行為の語が混じった切り出しを落とす
DIGITS = set("一二三四五六七八九十元")
STOP = set("年月日春夏秋冬為爲曰詔即位崩薨帝王年號号改")
NOISE = {"元年", "改元", "建元", "皇帝", "即位", "本紀", "本纪", "原文", "大赦", "天下",
         "在位", "元号", "年号", "西暦", "資治", "通鑑", "翌年", "明年", "同年", "先帝",
         "最初", "唯一", "以下", "以後", "以降", "記事", "記載", "確認", "原典", "史書",
         "同時", "相当", "当該", "上記", "以上", "なお", "また"}


def plausible(v):
    """元号名の形として通るか。**実在するかは見ていない**（それは原文側の仕事）。"""
    if v in NOISE or len(v) != 2:
        return False
    if v[1] in DIGITS:
        return False
    return not (set(v) & STOP)


def extract(pats, text, raw=False):
    """`raw=True` は形の検査を掛けない生の切り出し。

    **absent の意味を濁らせないために分けてある** — `plausible` で落ちた候補まで
    absent へ落とすと、「機械が何も見つけなかった」バケットに「見つけたが形で落とした」
    が混ざり、標本で測る取りこぼし率が別のものを測ることになる。
    """
    out, seen = [], set()
    for p in pats:
        for m in p.finditer(text):
            v = m.group(1)
            if (raw or plausible(v)) and v not in seen:
                seen.add(v)
                out.append(v)
    return out


def load_cache(eid):
    """(正規化済みの行, 定型句で立つ元号名の集合)。キャッシュが無ければ None。"""
    p = CACHE_DIR / f"{eid}.txt"
    if not p.is_file():
        return None
    lines = [norm_for_match(ln) for ln in p.read_text(encoding="utf-8").splitlines()]
    names = {norm_for_match(v) for v in extract(CORPUS_BUILD, "\n".join(lines))}
    return lines, names


def run():
    """event id → (バケット, 皇帝id, 候補)。"""
    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    caches, out = {}, {}
    for e in data["emperors"]:
        o = e.get("eraChangeCount")
        if not isinstance(o, dict):
            continue
        events = [ev for ev in (o.get("events") or [])
                  if isinstance(ev, dict) and not ev.get("eraName")]
        if not events:
            continue
        eid = e["id"]
        if eid not in caches:
            caches[eid] = load_cache(eid)
        for ev in events:
            evid = ev.get("id") or f"{eid}.eraChangeCount.?"
            note = ev.get("note") or ""
            raw = extract(NOTE_BUILD, note, raw=True)
            cands = [v for v in raw if plausible(v)]
            drops = set(extract(NOTE_DROP, note))
            if caches[eid] is None:
                out[evid] = ("no-cache", eid, cands)
                continue
            lines, corpus_names = caches[eid]
            hit = [v for v in cands if v not in drops
                   and norm_for_match(v) in corpus_names
                   and era_anchor_hit(norm_for_match(v), lines)]
            if len(hit) == 1:
                out[evid] = ("unique", eid, hit)
            elif len(hit) > 1:
                out[evid] = ("multi", eid, hit)
            elif raw:
                out[evid] = ("note-only", eid, cands or raw)
            else:
                out[evid] = ("absent", eid, [])
    return out


def sample(ids, seed, size):
    """種つきの無作為抽出（name_fields.py と同じハッシュ順）。

    母集団が動いても既存の標本の当落が変わらないので、転記が進んで event が
    母集団から抜けても監査をやり直さずに済む。
    """
    rank = sorted(ids, key=lambda i: hashlib.md5(f"{seed}:{i}".encode()).hexdigest())
    return sorted(rank[:size])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--sample", type=int, default=0, help="absent 系バケットから引く標本数")
    ap.add_argument("--sample-key", default="event-id")
    ap.add_argument("--list", metavar="バケット", help="そのバケットの event を並べる")
    args = ap.parse_args()

    cells = run()
    buckets = {}
    for evid, (b, _eid, _c) in cells.items():
        buckets.setdefault(b, []).append(evid)

    if args.list:
        for evid in sorted(buckets.get(args.list, [])):
            print(evid, "\t", "・".join(cells[evid][2]))
        return 0

    if args.json:
        coverage = {}
        for evid, (b, eid, _c) in sorted(cells.items()):
            coverage.setdefault(eid, []).append(f"eraChangeCount.events[].eraName:{b}")
        print(json.dumps({
            "unit": "era-change-event",
            "n": len(cells),
            "corpus": CACHE_DIR.is_dir(),
            "buckets": {k: len(v) for k, v in sorted(buckets.items())},
            "samples": {k: sample(v, args.seed, args.sample)
                        for k, v in sorted(buckets.items())
                        if k in ("absent", "no-cache") and args.sample},
            "coverage": coverage,
        }, ensure_ascii=False))
        return 0

    total = len(cells)
    read = sum(len(v) for k, v in buckets.items() if k in ("unique", "multi", "note-only"))
    print(f"母集団 {total} event（eraName がまだ無い改元 event） → 要読解 {read}")
    for k, v in sorted(buckets.items()):
        print(f"  {k}: {len(v)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
