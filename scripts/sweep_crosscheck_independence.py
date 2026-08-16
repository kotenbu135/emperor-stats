#!/usr/bin/env python3
"""断片台帳の「2冊目」が本当に別の証人かを測る道具（残量表102・判定はしない）。

`data/internal/name-fragments/<id>.json` の finding は根拠 `basis` に複数の書の
claim を並べることがある。**書が2つ並んでいることは独立した2証人がいることを
意味しない** — 2026-08-17 の検証段が3群（三国・両晋・北朝）から独立に同じ指摘を
出した。この道具はその形を機械で数える。

**測るのは「同じ文字列が両方に在るか」だけで、「B は A の写しだ」とは言わない。**
親子の向きは推定しない（daizhige 北齊書の補巻は北史から補われた側なので、
「後から出た書が写した」という直感とは向きが逆になる）。

出る層:

  label-only     … 正規化すると1書に潰れる。「舊唐書」と「舊唐書 卷十六 本紀第十六」・
                   「晉書」と「晋書」のように**ラベルの揺れが2冊に見えていた**側で、
                   2冊目はそもそも存在しない
  shared-text    … 書をまたぐ引用が閾値以上の同文を共有する。引用の位置から前後
                   50字の窓を取り、`norm_for_match` を通してから最長共通部分列を測る。
                   **引用そのものではなく窓で測る**のは、諱や字は3〜5字しかなく
                   「同じ事実」と「同じ文」を区別できないため（助言）
  supplemented   … 引用が**補巻**に落ちる。daizhige の北齊書は本文の巻見出しが
                   「第五卷　　补帝纪第五」の形で、校勘記に「此卷原缺…以北史補」と
                   明記されている。北史と別の証人には数えられない
  no-shared-text … 上のどれにも掛からなかった側

**`no-shared-text` は「独立している」の証拠ではない。** 引用が別々の条を指していれば
同文は出ないし、書き換えを伴う襲用（新唐書が旧唐書の記事を書き直す形）も出ない。
この道具が出すのは**陽性側だけ**で、陰性側は何も言っていない（規則 R-SWEEP-DETECTION）。

**この道具は絞り込みではない**（`data/screenings.json` に記録を持たない）。母集団は
台帳が動けば動くので、数字は残量表に日付つきで置く。

    python3 scripts/sweep_crosscheck_independence.py                   # 層別の件数
    python3 scripts/sweep_crosscheck_independence.py --list shared-text
    python3 scripts/sweep_crosscheck_independence.py --min-shared 20   # 閾値を変える
    python3 scripts/sweep_crosscheck_independence.py --pages           # 配布物側の母集団
    python3 scripts/sweep_crosscheck_independence.py --json
"""
import argparse
import collections
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from hanzi_norm import norm_for_match, to_simplified, to_traditional  # noqa: E402

FRAG = ROOT / "data/internal/name-fragments"
EMPERORS = ROOT / "data/emperors.json"
ZHENGSHI = ROOT / "daizhigev20/史藏/正史"
PAD = 50
MIN_SHARED = 15
STRATA = ("label-only", "supplemented", "shared-text", "no-shared-text")

# 書の中の篇名が別の正史と同名になる組。`source.page` の書名走査はここで必ず誤る
# （「三国志 魏書 武帝紀」は魏書を名乗っていない・「舊五代史 漢書 高祖紀」も同じ）。
SECTIONS = {
    "三国志": {"魏书", "蜀书", "吴书"},
    "旧五代史": {"梁书", "唐书", "晋书", "汉书", "周书"},
}


def catalog_books():
    with EMPERORS.open(encoding="utf-8") as fh:
        data = json.load(fh)
    return [b["id"] for b in data["meta"]["catalogs"]["books"]], data


def make_canon(books):
    """書ラベルを底本の書名へ寄せる。版の注記と巻の記述を落とす。"""
    known = sorted(books, key=len, reverse=True)

    def canon(label):
        s = to_simplified(re.sub(r"[（(].*?[)）]", "", str(label))).strip()
        for b in known:
            # 「旧唐书 卷十六 本纪第十六」→「旧唐书」。**前方一致だけで潰さない**
            # （「三国志补注」を三国志にしてしまう）ので、直後に区切りを要求する
            if s == b or (s.startswith(b) and s[len(b):len(b) + 1] in " 　・，,、"):
                return b
        return s

    return canon


def supplemented_spans():
    """本文の巻見出しに「补」を持つ巻の行範囲（書ファイル名 → [(始, 終)]）。

    目次側の「补列传第一」ではなく**本文の見出し**を見る。daizhige の北齊書は
    冒頭に目次を持っていて、そこにも同じ語が並ぶ。
    """
    head_re = re.compile(r"^第[一二三四五六七八九十百零〇\d]{1,6}卷")
    out = {}
    if not ZHENGSHI.is_dir():
        return out
    for p in sorted(ZHENGSHI.glob("*.txt")):
        heads = []
        with p.open(encoding="utf-8", errors="replace") as fh:
            for i, s in enumerate(fh, 1):
                s = s.strip()
                if len(s) <= 40 and head_re.match(s):
                    heads.append((i, s))
        spans = []
        for k, (i, s) in enumerate(heads):
            if "补" in s:
                end = heads[k + 1][0] - 1 if k + 1 < len(heads) else 10 ** 9
                spans.append((i, end, s))
        if spans:
            out[p.name] = spans
    return out


def in_supplemented(spans, relpath, line):
    if not relpath.startswith("daizhigev20/史藏/正史/"):
        return None
    for lo, hi, head in spans.get(relpath.rsplit("/", 1)[-1], []):
        if lo <= line <= hi:
            return head
    return None


def lcs(a, b):
    """最長共通部分列（連続）。窓が100字前後なので素直な DP で足りる。"""
    if not a or not b:
        return 0, ""
    prev = [0] * (len(b) + 1)
    best = end = 0
    for i in range(1, len(a) + 1):
        cur = [0] * (len(b) + 1)
        ai = a[i - 1]
        for j in range(1, len(b) + 1):
            if ai == b[j - 1]:
                cur[j] = prev[j - 1] + 1
                if cur[j] > best:
                    best, end = cur[j], i
        prev = cur
    return best, a[end - best:end]


def load_units(canon):
    """finding のうち基礎が2つ以上の書ラベルにまたがるもの。"""
    units, need = [], collections.defaultdict(set)
    for f in sorted(FRAG.glob("*.json")):
        with f.open(encoding="utf-8") as fh:
            doc = json.load(fh)
        cmap = {c["cid"]: c for c in doc.get("claims", [])}
        for fi in doc.get("findings", []):
            cs = [cmap[b] for b in fi.get("basis", []) if b in cmap]
            if len({c["book"] for c in cs}) < 2:
                continue
            units.append({"id": f.stem, "field": fi.get("field"), "claims": cs,
                          "books": sorted({canon(c["book"]) for c in cs}),
                          "raw": sorted({c["book"] for c in cs})})
            for c in cs:
                need[c["file"]].add(c["line"])
    return units, need


def read_lines(need):
    out = {}
    for rel, wanted in need.items():
        p = ROOT / rel
        if not p.exists():
            continue
        top = max(wanted)
        with p.open(encoding="utf-8", errors="replace") as fh:
            for i, s in enumerate(fh, 1):
                if i in wanted:
                    out[(rel, i)] = s.rstrip("\n")
                if i >= top:
                    break
    return out


def window(lines, claim):
    s = lines.get((claim["file"], claim["line"]))
    if s is None:
        return None
    text, frag = norm_for_match(s), norm_for_match(claim["quote"])
    i = text.find(frag)
    if i < 0:
        return text[:400]
    return text[max(0, i - PAD):i + len(frag) + PAD]


def run(min_shared=MIN_SHARED):
    books, _ = catalog_books()
    canon = make_canon(books)
    units, need = load_units(canon)
    lines = read_lines(need)
    spans = supplemented_spans()
    rows = []
    for u in units:
        row = {"id": u["id"], "field": u["field"], "books": u["books"],
               "raw": u["raw"], "shared": 0, "text": "", "pair": None, "head": None}
        if len(u["books"]) < 2:
            row["stratum"] = "label-only"
            rows.append(row)
            continue
        head = next((h for h in (in_supplemented(spans, c["file"], c["line"])
                                 for c in u["claims"]) if h), None)
        by_book = collections.defaultdict(list)
        for c in u["claims"]:
            w = window(lines, c)
            if w:
                by_book[canon(c["book"])].append((c["cid"], w))
        names = sorted(by_book)
        for x in range(len(names)):
            for y in range(x + 1, len(names)):
                for cid1, w1 in by_book[names[x]]:
                    for cid2, w2 in by_book[names[y]]:
                        n, sub = lcs(w1, w2)
                        if n > row["shared"]:
                            row.update(shared=n, text=sub,
                                       pair=[f"{names[x]}:{cid1}", f"{names[y]}:{cid2}"])
        if head:
            row["stratum"], row["head"] = "supplemented", head
        elif row["shared"] >= min_shared:
            row["stratum"] = "shared-text"
        else:
            row["stratum"] = "no-shared-text"
        rows.append(row)
    return rows


def pages():
    """配布物側の母集団: `source.page` が2冊以上を名乗る容器。"""
    books, data = catalog_books()
    pat = {}
    for b in books:
        for v in {b, to_traditional(b)}:
            pat.setdefault(v, b)
    keys = sorted(pat, key=len, reverse=True)
    raw, clean = [], []

    def scan(text, eid, path):
        found, s = set(), text
        for k in keys:
            if k in s:
                found.add(pat[k])
                s = s.replace(k, "〓" * len(k))
        if len(found) < 2:
            return
        raw.append((eid, path, sorted(found)))
        trimmed = set(found)
        for host, secs in SECTIONS.items():
            if host in trimmed:
                trimmed -= secs
        if len(trimmed) >= 2:
            clean.append((eid, path, sorted(trimmed)))

    def walk(node, path, eid):
        if isinstance(node, dict):
            src = node.get("source")
            if isinstance(src, dict) and src.get("page"):
                scan(src["page"], eid, path + ".source.page")
            for k, v in node.items():
                walk(v, f"{path}.{k}", eid)
        elif isinstance(node, list):
            for i, v in enumerate(node):
                walk(v, f"{path}[{i}]", eid)

    for e in data["emperors"]:
        walk(e, "", e["id"])
    return raw, clean


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-shared", type=int, default=MIN_SHARED,
                    help=f"同文とみなす共有の長さ（既定 {MIN_SHARED}字）")
    ap.add_argument("--list", choices=STRATA, help="その層の全件を出す")
    ap.add_argument("--pages", action="store_true",
                    help="配布物 source.page が2冊以上を名乗る容器を数える")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    if args.pages:
        raw, clean = pages()
        if args.json:
            print(json.dumps({"raw": len(raw), "clean": len(clean),
                              "people": len({c[0] for c in clean}),
                              "rows": [{"id": a, "path": b, "books": c} for a, b, c in clean]},
                             ensure_ascii=False))
            return 0
        print(f"source.page が2冊以上を名乗る容器: 生 {len(raw)} → 篇名の偽陽性を落として "
              f"{len(clean)}（人物 {len({c[0] for c in clean})}）")
        cnt = collections.Counter(tuple(c[2]) for c in clean)
        for k, v in cnt.most_common(15):
            print(f"  {v:4d} {'／'.join(k)}")
        return 0

    rows = run(args.min_shared)
    if args.json:
        print(json.dumps({"n": len(rows), "minShared": args.min_shared,
                          "strata": collections.Counter(r["stratum"] for r in rows),
                          "rows": rows}, ensure_ascii=False))
        return 0
    if args.list:
        sel = [r for r in rows if r["stratum"] == args.list]
        for r in sorted(sel, key=lambda x: -x["shared"]):
            print(f'{r["shared"]:3d} {r["id"]:30s} {r["field"]:28s} {"／".join(r["books"])}')
            if r["head"]:
                print(f'      補巻 {r["head"]}')
            if r["text"]:
                print(f'      共有「{r["text"]}」')
        print(f"\n{args.list}: {len(sel)}件 / 人物 {len({r['id'] for r in sel})}")
        return 0

    cnt = collections.Counter(r["stratum"] for r in rows)
    print(f"母集団 {len(rows)} finding（基礎が2つ以上の書ラベルにまたがるもの）"
          f" / 閾値 {args.min_shared}字\n")
    for s in STRATA:
        sel = [r for r in rows if r["stratum"] == s]
        print(f"  {s:15s} {len(sel):4d}  人物 {len({r['id'] for r in sel}):3d}")
    print(f"\n陽性（label-only・supplemented・shared-text）: "
          f"{len(rows) - cnt['no-shared-text']} / 人物 "
          f"{len({r['id'] for r in rows if r['stratum'] != 'no-shared-text'})}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
