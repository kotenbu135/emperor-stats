#!/usr/bin/env python3
"""列伝（本紀の外）の該当箇所を、書ごとの在り処の違いを吸収して引く。

紹介文の手順では、Web差分が当たったときだけ列伝を**1箇所**読む
（docs/process/profile-writing/README.md の3節）。そのとき毎回つまずくのが
**降りる先が書によって違う**ことで、隋書のように `china-history/` に帝紀と志しか
無い書がある。人が気づくまで「列伝が無い」と読み違えるので、ここで機械的に解決する。

- `china-history/<書>/{列传,传,世家,载记,后妃传,…}/` があればそこを見る
- 無ければ `daizhigev20/史藏/{正史,别史}/<書>.txt` の全文へ降りる

**素の grep をコーパスに掛けない**（規則 R-CORPUS-GREP。ugrep が `.{0,N}KW.{0,N}` で
4GB超に膨張して WSL ごと落ちる）。ここは Python で1行ずつ読むので安全に窓を出せる。

検索語は新字体でも簡体字でも通る（hanzi_norm で両側をそろえる）。

使い方:
    python3 scripts/find_biography.py sui-wendi 独孤皇后
    python3 scripts/find_biography.py sui-wendi 宣華夫人 --window 300
    python3 scripts/find_biography.py tang-jingzong 劉克明 --book 旧唐书
    python3 scripts/find_biography.py sui-wendi --where          # 在り処だけ出す
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from hanzi_norm import norm_for_match  # noqa: E402

CHINA_HISTORY = ROOT / "china-history"
DAIZHI_DIRS = [
    ROOT / "daizhigev20" / "史藏" / "正史",
    ROOT / "daizhigev20" / "史藏" / "别史",
    ROOT / "daizhigev20" / "史藏" / "传记",
]
EMPERORS = ROOT / "data" / "emperors.json"

# 列伝にあたる節の名前。china-history は書ごとに節の切り方が違う
# （宋史は「列传」・漢書は「传」・晋書は「载记」・新五代史は「世家」）。
BIO_SECTIONS = ("列传", "列傳", "传", "傳", "世家", "载记", "載記", "后妃传", "外戚传")
# 本紀にあたる節。--where で「ここは本紀なので降り先ではない」と言うために持つ。
ANNAL_SECTIONS = ("本纪", "本紀", "帝纪", "帝紀", "纪", "紀")

TAG = re.compile(r"<[^>]+>")


def volume_index(path: Path) -> dict[int, int]:
    """daizhige の txt について {開始行(1始まり): 巻番号} を作る。

    **行頭の「卷N」を自分で数えない。** 隋書のように「卷N」が目次にしか無い書では、
    素朴に数えると本文の全行が目次の最後の巻（卷八十五）に属することになり、
    后妃伝（実際は巻三十六）を別の巻として報告する。組版の3通りを吸収するのは
    `book_volumes.daizhige_spans` の1実装なので、そちらへ委ねる（#53 と同じ形）。
    """
    try:
        from book_volumes import daizhige_spans  # noqa: PLC0415
    except ImportError:
        return {}
    try:
        spans, _ = daizhige_spans(ROOT, str(path.relative_to(ROOT)), path.stem)
    except Exception:
        return {}
    return {start + 1: vol for vol, (start, _end) in spans.items()}


def available_books() -> dict[str, list[Path]]:
    """コーパスに実在する書名 → 実体（ディレクトリ or ファイル）。

    書名を手で列挙しない（build_books_catalog.py と同じ理由 — 手書きの対応表は
    間違えると黙って別の書を読みに行く）。
    """
    books: dict[str, list[Path]] = {}
    if CHINA_HISTORY.exists():
        for d in sorted(CHINA_HISTORY.iterdir()):
            if d.is_dir() and not d.name.endswith("-白话"):
                books.setdefault(norm_for_match(d.name), []).append(d)
    for base in DAIZHI_DIRS:
        if not base.exists():
            continue
        for f in sorted(base.glob("*.txt")):
            books.setdefault(norm_for_match(f.stem), []).append(f)
    return books


def books_for(emperor_id: str) -> list[str]:
    """その皇帝のレコードが名乗っている書名を集める（source.page / bookId から）。"""
    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    rec = next((e for e in data["emperors"] if e["id"] == emperor_id), None)
    if rec is None:
        return []
    pages: list[str] = []

    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ("page", "bookId") and isinstance(v, str):
                    pages.append(v)
                else:
                    walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(rec)

    known = available_books()
    hits: list[str] = []
    for p in pages:
        n = norm_for_match(p)
        # 長い書名から当てる（「新唐书」を「唐书」より先に、「旧五代史」を「五代史」より先に）
        for name in sorted(known, key=len, reverse=True):
            if name and name in n and name not in hits:
                hits.append(name)
    return hits


def targets_for(book: str) -> tuple[list[Path], list[str]]:
    """書名 → 列伝を探す実体のリストと、在り処の説明。"""
    known = available_books()
    entries = known.get(book) or known.get(norm_for_match(book)) or []
    files: list[Path] = []
    notes: list[str] = []
    for ent in entries:
        if ent.is_dir():
            bio = [d for d in sorted(ent.iterdir()) if d.is_dir() and d.name in BIO_SECTIONS]
            if bio:
                for d in bio:
                    fs = sorted(d.rglob("*.html"))
                    files += fs
                    notes.append(f"china-history/{ent.name}/{d.name}/ … {len(fs)}ファイル")
            else:
                sub = [d.name for d in sorted(ent.iterdir()) if d.is_dir()]
                notes.append(
                    f"china-history/{ent.name}/ に列伝の節が無い（{'・'.join(sub) or '節なし'}）"
                    " → daizhigev20 側へ降りる"
                )
        else:
            files.append(ent)
            notes.append(f"{ent.relative_to(ROOT)} … 全文1ファイル")
    return files, notes


def load_lines(path: Path) -> list[str]:
    raw = path.read_text(encoding="utf-8", errors="replace")
    if path.suffix == ".html":
        raw = TAG.sub("\n", raw)
        raw = html.unescape(raw)
    return raw.split("\n")


def search(files: list[Path], needle: str, window: int, limit: int) -> int:
    key = norm_for_match(needle)
    if not key:
        print("検索語に漢字がありません", file=sys.stderr)
        return 0
    found = 0
    for path in files:
        lines = load_lines(path)
        vols = volume_index(path) if path.suffix == ".txt" else {}
        vol = ""
        for i, line in enumerate(lines, 1):
            if i in vols:
                vol = f"巻{vols[i]}"
            if key not in norm_for_match(line):
                continue
            found += 1
            where = f"{path.relative_to(ROOT)}:{i}"
            if vol:
                where += f"（{vol}）"
            elif path.suffix == ".txt":
                where += "（巻は引けない書）"
            print(f"\n--- {where} ---")
            n = norm_for_match(line)
            at = n.find(key)
            # 正規化で字数が変わることがあるので、窓は素の行から近似で切り出す
            ratio = len(line) / max(len(n), 1)
            center = int(at * ratio)
            lo = max(0, center - window)
            print(("…" if lo else "") + line[lo : center + window] + "…")
            if found >= limit:
                print(f"\n（{limit} 件で打ち切り。--max で増やせる）")
                return found
    return found


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("emperor_id")
    ap.add_argument("needle", nargs="?", help="探す語（人名など）。新字体でも簡体字でもよい")
    ap.add_argument("--book", help="書名を明示する（既定はレコードの source.page から引く）")
    ap.add_argument("--max", type=int, default=5)
    ap.add_argument("--window", type=int, default=160, help="前後に出す字数")
    ap.add_argument("--where", action="store_true", help="在り処だけ出して検索しない")
    args = ap.parse_args()

    books = [args.book] if args.book else books_for(args.emperor_id)
    if not books:
        print(
            f"{args.emperor_id} の書名を引けなかった。--book で書名を指定する",
            file=sys.stderr,
        )
        return 1
    print(f"# {args.emperor_id} が名乗っている書: {'・'.join(books)}")

    files: list[Path] = []
    for b in books:
        fs, notes = targets_for(b)
        print(f"\n## {b}")
        for n in notes:
            print(f"- {n}")
        files += fs
    if args.where or not args.needle:
        return 0
    if not files:
        print("列伝の実体が見つからない", file=sys.stderr)
        return 1

    print(f"\n# 「{args.needle}」を {len(files)} ファイルから探す")
    n = search(files, args.needle, args.window, args.max)
    if not n:
        print(
            "\n0 件。**「原文に記事が無い」は証拠にならない**（別の呼称・避諱・PUA文字で"
            "当たらないことがある）。呼び名を変えてもう一度引く"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
