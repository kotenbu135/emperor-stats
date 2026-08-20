#!/usr/bin/env python3
"""第N代（`reigns[].dynastyOrder`）の未調査53政権を、読む先で仕分ける絞り込み（Issue #24）。

**何をしているか**
`dynastyOrder` の証人は「その政権の君主に紀（本紀・帝紀）が立っているか、立っているなら
何番目か」である。だから原典を開く前に、コーパス側の**紀の見出し**を機械で拾って、
未調査190人それぞれが

  - 自分の名で紀の見出しに立つのか（＝番号は見出しの並び順の転記になる）
  - その政権に紀は在るのに自分の見出しは無いのか（＝並立・僭称の疑い。読んで決める）
  - その政権にはそもそも紀が無いのか（＝継承記述を編年・列伝から読む）

のどれなのかを先に分ける。**判定はしない** — 見出しの並び順は候補であって、
番号そのものではない（追尊帝・本データに収録の無い君主が見出しに混じる）。

**絞り込みが変えるのは読む先と読む量だけ**（規則 `R-SCREEN-FIRST`）。
どのバケットも `read` で、機械が何も見つけなかったから空でよい、という側（`absent`）は作らない。

見出しの取り方:
  - china-history: `<書>/本纪|帝纪/*-原文.html`（旧五代史だけは王朝別ディレクトリの `*纪*`）の
    本文先頭行。`原文` の次の行が見出し（「恭帝」「◎太祖」）か、見出しを持たない書では
    本文の1行目そのもの（「太祖啟運立極英武睿文神德聖功至明大孝皇帝，諱匡胤」）になる。
    どちらでも人物名は行頭側に出るので、先頭40字だけを見出し文字列として持つ。
  - daizhigev20: china-history に無い書（清史稿・新元史・十国春秋・小腆纪传）は
    `卷N ... 本紀/紀第` 形の見出し行を拾う。

使い方:
    python3 scripts/screens/dynasty_order.py            # バケットの内訳
    python3 scripts/screens/dynasty_order.py --json     # data/screenings.json へ入れる形
    python3 scripts/screens/dynasty_order.py --regime <政権id>   # その政権の見出しと突き合わせ
"""
import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hanzi_norm import norm_for_match  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CH = ROOT / "china-history"
DZ = ROOT / "daizhigev20"
EMPERORS = ROOT / "data" / "emperors.json"

SCREEN_ID = "dynasty-order-issue24"

# 政権 → その政権の君主の紀を載せうる書。SOURCE_MAPPING.md の対応表から引いた。
# 「載せうる」であって「載っている」ではない — 載っていないことの確認もこの絞り込みの仕事。
REGIME_BOOKS = {
    "houjing-han": ["梁书", "南史"],
    "sui": ["隋书"],
    "tang": ["旧唐书", "新唐书"],
    "wu-zhou": ["旧唐书", "新唐书"],
    "anshi-yan": ["旧唐书", "新唐书"],
    "zhuci-qin": ["旧唐书", "新唐书"],
    "lixilie-chu": ["旧唐书", "新唐书"],
    "huangchao-qi": ["旧唐书", "新唐书"],
    # 隋末群雄（12在位・いずれも隋書／両唐書の列伝側）
    "dingyang": ["旧唐书", "新唐书", "隋书"],
    "liangshidu-liang": ["旧唐书", "新唐书", "隋书"],
    "suimo-chu": ["旧唐书", "新唐书", "隋书"],
    "xiqin": ["旧唐书", "新唐书", "隋书"],
    "xiaoxian-liang": ["旧唐书", "新唐书", "隋书"],
    "zhucan-chu": ["旧唐书", "新唐书", "隋书"],
    "liguigui-liang": ["旧唐书", "新唐书", "隋书"],
    "xu": ["旧唐书", "新唐书", "隋书"],
    "suimo-wu": ["旧唐书", "新唐书", "隋书"],
    "zheng": ["旧唐书", "新唐书", "隋书"],
    "suimo-song": ["旧唐书", "新唐书", "隋书"],
    # 五代本朝（旧五代史は王朝別ディレクトリ・新五代史は本纪）
    "later-liang": ["旧五代史", "新五代史"],
    "later-tang": ["旧五代史", "新五代史"],
    "later-jin": ["旧五代史", "新五代史"],
    "later-han": ["旧五代史", "新五代史"],
    "later-zhou": ["旧五代史", "新五代史"],
    # 十国（新五代史は世家・十国春秋に本紀）
    "former-shu": ["新五代史", "十国春秋"],
    "later-shu": ["新五代史", "十国春秋"],
    "southern-han": ["新五代史", "十国春秋"],
    "southern-tang": ["新五代史", "十国春秋"],
    "yang-wu": ["新五代史", "十国春秋"],
    "min": ["新五代史", "十国春秋"],
    "northern-han": ["新五代史", "十国春秋"],
    "jie-yan": ["新五代史", "旧五代史"],
    # 宋遼金西夏
    "northern-song": ["宋史"],
    "southern-song": ["宋史"],
    "zhangbangchang-chu": ["宋史"],
    "liuyu-qi": ["宋史"],
    "liao": ["辽史"],
    "western-liao": ["辽史"],
    "jin-jurchen": ["金史"],
    "western-xia": ["宋史"],
    # 元・元末
    "yuan": ["元史"],
    "northern-yuan": ["新元史"],
    "tianwan": ["明史"],
    "hanlin-song": ["明史"],
    "chen-han": ["明史"],
    "ming-xia": ["明史"],
    # 明清
    "ming": ["明史"],
    "southern-ming": ["明史", "小腆纪传"],
    "shun": ["明史"],
    "xi": ["明史"],
    "qing": ["清史稿"],
    "wu-zhou-sanfan": ["清史稿"],
    "empire-of-china": [],
}

# 政権 → **その政権自身の紀**が立つ書。値が None の政権は、どの書もその政権の君主に
# 紀を立てていない（列伝・世家・編年でしか追えない）。
#
# 見出しの突き合わせをこの1書に限る理由: 廟号は王朝をまたいで衝突する（西夏仁宗の「仁宗」は
# 宋史・遼史・金史・元史・明史のいずれの本紀見出しにも在る）。政権を跨いで当てると
# 「紀が立っている」という誤った絞り込みになり、絞り込みの誤りは打ち切り側で非対称に効く。
OWN_ANNALS_BOOK = {
    "sui": ("隋书", None),
    "tang": ("旧唐书", None),
    "wu-zhou": ("旧唐书", None),
    "later-liang": ("旧五代史", "后梁/"),
    "later-tang": ("旧五代史", "后唐/"),
    "later-jin": ("旧五代史", "后晋/"),
    "later-han": ("旧五代史", "后汉/"),
    "later-zhou": ("旧五代史", "后周/"),
    "former-shu": ("十国春秋", None),
    "later-shu": ("十国春秋", None),
    "southern-han": ("十国春秋", None),
    "southern-tang": ("十国春秋", None),
    "yang-wu": ("十国春秋", None),
    "min": ("十国春秋", None),
    "northern-han": ("十国春秋", None),
    "northern-song": ("宋史", None),
    "southern-song": ("宋史", None),
    "liao": ("辽史", None),
    "jin-jurchen": ("金史", None),
    "yuan": ("元史", None),
    "northern-yuan": ("新元史", None),
    "ming": ("明史", None),
    "southern-ming": ("小腆纪传", None),
    "qing": ("清史稿", None),
}

# daizhigev20 側の書（china-history に無い）。値は (相対パス, 見出し行の正規表現)
DZ_BOOKS = {
    "清史稿": ("史藏/正史/清史稿.txt", r"^本[纪紀][一二三四五六七八九十]"),
    "新元史": ("史藏/正史/新元史.txt", r"^卷[一二三四五六七八九十百]+\s*本[纪紀]第"),
    "十国春秋": ("史藏/载记/十国春秋.txt", r"^.{0,6}[帝主祖宗王]本[纪紀]$"),
    "小腆纪传": ("史藏/传记/小腆纪传.txt", r"^[纪紀]第[一二三四五六七八九十]"),
}

HEAD_CHARS = 40


def _body_head(path: Path) -> str:
    """china-history の 原文.html から本文先頭（見出しを含む）を取り出す。"""
    s = path.read_text(encoding="utf-8", errors="replace")
    body = s.split("<body>", 1)[-1]
    text = re.sub(r"<[^>]+>", "\n", body)
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    # ナビゲーション（首页／〈書〉-本纪／：目录／上一节／下一节／章タイトル／原文）を落とす
    for i, ln in enumerate(lines):
        if ln == "原文":
            rest = lines[i + 1:]
            break
    else:
        rest = lines
    if not rest:
        return ""
    head = rest[0].lstrip("◎○●　 ")
    if len(head) < 6 and len(rest) > 1:      # 「恭帝」のような短い見出しは次行も足す
        head = head + "｜" + rest[1][:HEAD_CHARS]
    return head[:HEAD_CHARS * 2]


def _cn_num(s: str) -> int:
    """ファイル名の「第十二章」から並び順の数を取る。"""
    digits = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
              "六": 6, "七": 7, "八": 8, "九": 9}
    m = re.search(r"第([一二三四五六七八九十百]+)章", s)
    if not m:
        return 0
    t, total, section, unit = m.group(1), 0, 0, 1
    for ch in t:
        if ch == "百":
            section = (section or 1) * 100
            total += section
            section = 0
        elif ch == "十":
            section = (section or 1) * 10
            total += section
            section = 0
        else:
            section += digits[ch] * unit
    return total + section


def collect_headings():
    """書名 → [(並び順, 巻ラベル, 見出し先頭)] を作る。"""
    out = {}
    for book_dir in sorted(CH.iterdir()) if CH.exists() else []:
        if not book_dir.is_dir() or book_dir.name.endswith("-白话"):
            continue
        entries = []
        if book_dir.name == "旧五代史":
            # 王朝別ディレクトリに「太祖纪一」のような紀が入る
            for sub in sorted(book_dir.iterdir()):
                if not sub.is_dir():
                    continue
                for f in sorted(sub.glob("*纪*-原文.html"), key=lambda p: _cn_num(p.name)):
                    entries.append((_cn_num(f.name), f"{sub.name}/{f.stem}", _body_head(f)))
        else:
            for name in ("本纪", "帝纪"):
                d = book_dir / name
                if not d.is_dir():
                    continue
                for f in sorted(d.glob("*-原文.html"), key=lambda p: _cn_num(p.name)):
                    entries.append((_cn_num(f.name), f.stem, _body_head(f)))
        if entries:
            out[book_dir.name] = entries

    for book, (rel, pat) in DZ_BOOKS.items():
        p = DZ / rel
        if not p.exists():
            continue
        rx = re.compile(pat)
        entries = []
        lines = p.read_text(encoding="utf-8", errors="replace").split("\n")
        for i, line in enumerate(lines, 1):
            ln = line.strip("　 \t\r")
            if ln and rx.search(ln[:60]):
                # 見出し行が帝名を持たない書（新元史「卷一 本纪第一」・小腆纪传「纪第一」）が
                # あるので、直後の2行も見出し文字列に足す
                nxt = "｜".join(x.strip("　 \t\r")[:HEAD_CHARS]
                               for x in lines[i:i + 2] if x.strip())
                entries.append((i, f"L{i}", (ln + "｜" + nxt)[:HEAD_CHARS * 3]))
        if entries:
            out[book] = entries
    return out


def name_tokens(e):
    """見出しに出うる呼称（廟号・諡号・諱・通称）。姓は見出しに出ないので入れない。"""
    n = e.get("name") or {}
    toks = []
    for key in ("templeName", "posthumousName", "commonName", "personalName",
                "posthumousNameFull"):
        v = n.get(key)
        if isinstance(v, str) and len(v) >= 2:
            toks.append(v)
    for v in (n.get("aliases") or []):
        if isinstance(v, str) and len(v) >= 2:
            toks.append(v)
    return toks


def run():
    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    regimes = {r["id"]: r for r in data["meta"]["catalogs"]["regimes"]}
    unsurveyed = [r for r in data["meta"]["catalogs"]["regimes"]
                  if not r.get("dynastyOrderSurveyed")]
    headings = collect_headings()

    # 書ごとに「正規化した見出し文字列」の一覧を持つ
    norm_heads = {b: [(o, lab, h, norm_for_match(h)) for o, lab, h in ents]
                  for b, ents in headings.items()}

    people = {}
    for e in data["emperors"]:
        rid = e.get("regimeId")
        if rid in {r["id"] for r in unsurveyed}:
            people.setdefault(rid, []).append(e)

    result = {}
    for reg in unsurveyed:
        rid = reg["id"]
        books = [b for b in REGIME_BOOKS.get(rid, []) if b in norm_heads]
        own = OWN_ANNALS_BOOK.get(rid)
        own_entries = []
        if own and own[0] in norm_heads:
            own_entries = [x for x in norm_heads[own[0]]
                           if not own[1] or x[1].startswith(own[1])]
        rows = []
        for e in people.get(rid, []):
            hits = []
            for tok in name_tokens(e):
                ntok = norm_for_match(tok)
                if len(ntok) < 2:
                    continue
                for o, lab, h, nh in own_entries:
                    if ntok in nh:
                        hits.append((own[0], lab, h))
            seen, uniq = set(), []
            for h in hits:
                if h[:2] not in seen:
                    seen.add(h[:2])
                    uniq.append(h)
            rows.append({"id": e["id"], "reigns": len(e.get("reigns", [])),
                         "hits": uniq})
        has_book_annals = bool(own_entries)
        for r in rows:
            if r["hits"]:
                r["bucket"] = "annals-head"
            elif has_book_annals:
                r["bucket"] = "annals-book"
            else:
                r["bucket"] = "no-annals"
        result[rid] = {"label": reg.get("label") or reg.get("name"),
                       "books": books, "rows": rows}
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--regime")
    args = ap.parse_args()
    res = run()

    if args.regime:
        r = res.get(args.regime)
        if not r:
            print(f"未調査政権に {args.regime} は無い", file=sys.stderr)
            return 1
        print(f"{args.regime} {r['label']} / 紀を持ちうる書: {'・'.join(r['books']) or 'なし'}")
        for row in r["rows"]:
            print(f"  [{row['bucket']}] {row['id']}")
            for b, lab, h in row["hits"]:
                print(f"        {b} {lab} … {h[:48]}")
        return 0

    counts = {"annals-head": 0, "annals-book": 0, "no-annals": 0}
    rcounts = {"annals-head": 0, "annals-book": 0, "no-annals": 0}
    for rid, r in res.items():
        for row in r["rows"]:
            counts[row["bucket"]] += 1
            rcounts[row["bucket"]] += row["reigns"]

    if args.json:
        # coverage は「この人物はどのバケットか」の引き当て表。
        # check_screenings.py --for <皇帝id> がこれを読むので、無いと調査エージェント側は
        # 「絞り込みが未実施」と表示される（遼の1段目が実際にそう報告した・2026-08-20）
        coverage = {}
        for r in res.values():
            for row in r["rows"]:
                coverage[row["id"]] = [row["bucket"]]
        out = {"screen": SCREEN_ID, "n": sum(counts.values()),
               "buckets": counts, "reigns": rcounts, "coverage": coverage}
        # コーパスが無い環境（CI）では全員が no-annals に落ちて記録と必ずずれる。
        # 件数の突合を飛ばさせる旗を出す（check_screenings.py の corpus: false）。
        if not (CH.exists() and DZ.exists()):
            out["corpus"] = False
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0

    print(f"未調査 {len(res)}政権 / {sum(counts.values())}人 / {sum(rcounts.values())}在位")
    for k in ("annals-head", "annals-book", "no-annals"):
        print(f"  {k:12s} {counts[k]:4d}人 {rcounts[k]:4d}在位")
    print()
    for rid, r in res.items():
        b = {}
        for row in r["rows"]:
            b[row["bucket"]] = b.get(row["bucket"], 0) + 1
        summary = "・".join(f"{k}{v}" for k, v in sorted(b.items()))
        print(f"  {rid:22s} {r['label']:16s} {summary}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
