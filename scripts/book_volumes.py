#!/usr/bin/env python3
"""書の「巻」をローカルコーパスの実体から引く（Issue #69・計画7節の4）。

`meta.catalogs.books` を**作る側**（build_books_catalog.py）と**照合する側**
（verify_quotes.py --check-volumes）が同じ規則で巻を数えるための1実装。
2箇所に書くと、片方だけ直したときに「カタログは在るのに引けない巻」が静かに生まれる。

巻の索引は2系統ある:

- `daizhige-heading` … `daizhigev20/.../<書>.txt` の行頭「卷N」見出しから次の見出しまで
- `china-history-file` … `china-history/<書>/<節>/第N章-卷N-原文.html` のファイル1枚

**china-history は節を絞らないと使えない。** 列伝・志は書の途中から始まるのに
ファイル名の巻番号が1から振り直されている（宋史の列伝は実際には巻242〜496だが
`卷一`〜`卷二百五十五` と名乗る）。CORPUS_NOTES の「china-history の相対巻数」がこれで、
節を絞らずに索引にすると**黙って別の巻を読みに行く**（#53 と同じ形）。
"""
from __future__ import annotations

import re
from pathlib import Path

VOL_HEAD = re.compile(r"^\s*[卷巻]([一二三四五六七八九十百千零〇\d]+)")
VOL_FILE = re.compile(r"[卷巻]([一二三四五六七八九十百千零〇\d]+)")

# 巻番号が書頭からの絶対値である節（本紀・帝紀は書の先頭から始まる）。
ABS_SECTIONS = ("本纪", "本紀", "帝纪", "帝紀", "纪", "紀")

_CN = {"〇": 0, "零": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
       "六": 6, "七": 7, "八": 8, "九": 9}


def cn_number(s: str):
    """「二百十七」「十七」「17」→ int。読めなければ None。

    位取り（百・千）は total へ繰り上げ、十の位までを section に持つ。
    「一百零八」の零は section が空のままなので 8 として積まれる。
    """
    if s.isdigit():
        return int(s)
    total, section, seen = 0, 0, False
    for ch in s:
        if ch in _CN:
            d = _CN[ch]
            section = section + d if section and section % 10 == 0 else d
            seen = True
        elif ch == "十":
            section = (section or 1) * 10
            seen = True
        elif ch in ("百", "千"):
            total += (section or 1) * (100 if ch == "百" else 1000)
            section = 0
            seen = True
        else:
            return None
    return total + section if seen else None


_HAN = re.compile(r"[㐀-鿿豈-﫿]")


def _han(s):
    return "".join(_HAN.findall(s or ""))


def _spans_from_starts(starts, n_lines):
    spans = {}
    for j, (vol, start) in enumerate(starts):
        end = starts[j + 1][1] if j + 1 < len(starts) else n_lines
        spans[vol] = (start, end)
    return spans


def daizhige_spans(corpus: Path, rel: str):
    """daizhige の txt から {巻番号: (開始行, 終了行)} を作る。組版は2通りある。

    - **本文の見出しが「卷N …」**（元史など）… そのまま次の見出しまでが1巻
    - **「卷N …」は目次だけ**（宋书など）… 本文の見出しは「本纪第三　武帝下」のように
      節名で巻番号を持たない。素朴に「卷N」から次の「卷N」まで切ると目次の1行しか
      取れず、**最後の巻だけが本文全部を指す**（どんな引用でも当たる巻ができる）。
      目次の「卷N <節名>」で 巻→節名 を作り、本文の見出しを目次の順にたどる

    **どちらの読み方でも目次の全巻がそろわない書は、巻を引けないものとして扱う**
    （空の辞書を返す）。半分だけ引ける索引は、引けなかった巻を「存在しない巻」と
    誤って弾くうえ、当たった側も組版を読み違えている疑いが残る。
    """
    p = corpus / rel
    if not p.is_file():
        return {}, []
    lines = p.read_text(encoding="utf-8", errors="ignore").splitlines()
    heads = []        # [(行, 巻番号, 節名の漢字)]
    for i, line in enumerate(lines):
        m = VOL_HEAD.match(line)
        if m:
            n = cn_number(m.group(1))
            if n:
                heads.append((i, n, _han(line[m.end():])))
    if not heads:
        return {}, lines

    # 1) 本文の見出しが「卷N」型か: 1行しか持たない区間が少なければそちら
    inline = _spans_from_starts([(n, i) for i, n, _ in heads], len(lines))
    thin = sum(1 for a, b in inline.values() if b - a <= 1)
    if thin <= len(inline) * 0.1 and _balanced(inline, len(lines)):
        return inline, lines

    # 2) 目次型: 目次の並び順で本文の節見出しを追う
    toc = [(n, label) for _, n, label in heads if label]
    toc_end = heads[-1][0]
    starts, k = [], 0
    for i in range(toc_end + 1, len(lines)):
        if k >= len(toc):
            break
        if _han(lines[i]).startswith(toc[k][1]):
            starts.append((toc[k][0], i))
            k += 1
    if len(starts) != len(toc):
        return {}, lines      # 組版を読み切れていない。巻は引けない扱い
    spans = _spans_from_starts(starts, len(lines))
    return (spans, lines) if _balanced(spans, len(lines)) else ({}, lines)


def _balanced(spans, n_lines):
    """1つの巻が本文の大半を飲み込んでいないか。

    目次を本文と取り違えると、最後の見出しから EOF までが1巻になり、**その巻だけは
    どんな引用にも当たる**（照合がザルになったことに気づけない）。巻の切り出しが
    壊れている合図なので、索引そのものを無効にする。
    """
    if len(spans) < 4:
        return True
    return max(b - a for a, b in spans.values()) <= n_lines * 0.3


def volumes_from_daizhige(corpus: Path, rels):
    """daizhige の単一 txt から**本文まで引ける**巻番号の集合を採る。"""
    best = (set(), None)
    for rel in rels:
        if not rel.endswith(".txt"):
            continue
        spans, _ = daizhige_spans(corpus, rel)
        if len(spans) > len(best[0]):
            best = (set(spans), rel)
    return best


def volumes_from_china_history(rels):
    """china-history の巻単位ファイル名から巻番号の集合を採る。

    絶対巻番号だと分かっている節（本紀・帝紀、および書全体を1階層で持つ「原文版○○」）
    だけを見る。戻り値の3つめは巻の範囲（"all" か "benji"）。
    """
    best = (set(), None, None)
    by_dir: dict[str, set] = {}
    for rel in rels:
        if not rel.startswith("china-history/"):
            continue
        parts = rel.split("/")
        if len(parts) < 3:
            continue
        section = parts[2]
        if not (section in ABS_SECTIONS or section.startswith("原文版")):
            continue
        m = VOL_FILE.search(Path(rel).name)
        if m:
            n = cn_number(m.group(1))
            if n:
                by_dir.setdefault("/".join(parts[:3]), set()).add(n)
    for d, vols in by_dir.items():
        if len(vols) > len(best[0]):
            scope = "all" if d.split("/")[2].startswith("原文版") else "benji"
            best = (vols, d, scope)
    return best


def entry_for(corpus: Path, book_id: str, rels):
    """カタログの1行を作る。巻を引けない書は volumeIndex: null だけを持つ。"""
    dz_vols, dz_path = volumes_from_daizhige(corpus, rels)
    ch_vols, ch_root, ch_scope = volumes_from_china_history(rels)
    if len(dz_vols) >= len(ch_vols) and dz_vols:
        kind, path, vols, scope = "daizhige-heading", dz_path, dz_vols, "all"
    elif ch_vols:
        kind, path, vols, scope = "china-history-file", ch_root, ch_vols, ch_scope
    else:
        return {"id": book_id, "volumeIndex": None}
    return {
        "id": book_id,
        "volumeIndex": kind,
        "volumePath": path,
        "volumeScope": scope,
        # コーパスの**収録**であって、その書の巻数ではない。上限のゲートに使わない
        # （北齊書は原文版が巻八までしか無い一方、書自体は50巻ある）
        "corpusVolumeMax": max(vols),
        "corpusVolumeCount": len(vols),
    }


def volume_lines(corpus: Path, book: dict, volume: int):
    """カタログの1行と巻番号から、その巻の生の行を返す。引けなければ None。"""
    kind = book.get("volumeIndex")
    path = book.get("volumePath")
    if not kind or not path:
        return None
    if kind == "daizhige-heading":
        spans, lines = daizhige_spans(corpus, path)
        span = spans.get(volume)
        return lines[span[0]:span[1]] if span else None
    if kind == "china-history-file":
        d = corpus / path
        if not d.is_dir():
            return None
        # 白話訳・段訳は「原文ラベルなのに中身が現代語訳」の既知の罠（CORPUS_NOTES）の
        # 側なので、原文のファイルだけを読む
        for f in sorted(d.iterdir()):
            if any(x in f.name for x in ("白话", "白話", "译文", "段译")):
                continue
            m = VOL_FILE.search(f.name)
            if m and cn_number(m.group(1)) == volume:
                return f.read_text(encoding="utf-8", errors="ignore").splitlines()
        return None
    return None
