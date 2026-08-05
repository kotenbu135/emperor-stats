#!/usr/bin/env python3
"""Noto Sans JP を「このサイトが実際に描く文字」だけに絞り、自前で配る woff2 を作る。

なぜ自前で持つか（2026-08-05・PSI 実測）
--------------------------------------
`next/font/google` は unicode-range を 124 サブセットぶん宣言するので、
**@font-face だけで 283KB（gz 98KB）のレンダーブロッキング CSS** が1本増える。
中身は全 17,936 グリフの割り当て表で、当サイトが描く文字は 3,300 字ほどしかない。
実測では PSI モバイルのレンダリングブロックが 120KiB・推定削減 9,090ms、トップの
フォント転送が 50本 1,180KB（/emperors は 102本 4,189KB）だった。

Issue #79 で明朝を落としたときに消したのと同じ構造の負債がサンセリフ側に残っていた、
というのがこの版の出発点。

作り方
------
1. 可変フォント `NotoSansJP[wght].ttf`（google/fonts・OFL 1.1）を取ってくる
2. wght=400/500/700 で3本にインスタンス化する
3. `out/` に書き出された**描画対象の文字**を集める（`out/data/` は配布用データの
   ダウンロードで画面には出ないので除く。ここを混ぜると note や引用に出てくる
   異体字 2,119 字ぶんフォントが太る）
4. 文字を「何ページに出るか」の多い順に並べ、CHUNK_SIZE 字ずつに切る
5. チャンク×ウェイトごとに woff2 を書き、`src/app/fonts.css` に @font-face を出す

**並びを頻度順にするのが要点。** コードポイント順に切ると、漢字は範囲全体に
散らばっているのでどのページも全チャンクを引き当てて universe 全部（約1.2MB）を
落とすことになる（実測・codepoint 順は6面すべてで 3,287 グリフ全取り）。
頻度順なら仮名と常用漢字が先頭に固まり、トップページは 1,920 グリフで足りる。

unicode-range は1文字ずつ列挙するので CSS は「文字数 × ウェイト数 × 約7バイト」で
決まる（チャンクの大きさをどう変えても総量はほぼ動かない）。3,300字×3ウェイトで
約72KB・gz 約25KB。**ウェイトを1つ落とすとそのぶんそのまま減る。**

使い方
------
    npm run build                     # 先に out/ を作る（文字はここから集める）
    python3 tools/build-font-subset.py
    npm run build                     # 生成した woff2 を載せて焼き直す

`out/` に新しい文字が出たのに流し直していないと、`npm run build` の postbuild
（tools/check-font-coverage.mjs）が落ちる。紹介文（Issue #16）が入るたびに
ここを回すことになる。
"""

from __future__ import annotations

import argparse
import json
import pathlib
import shutil
import subprocess
import sys
import time

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

SITE = pathlib.Path(__file__).resolve().parent.parent
OUT = SITE / "out"
FONT_DIR = SITE / "src" / "app" / "fonts"
CSS_PATH = SITE / "src" / "app" / "fonts.css"
COVERAGE_PATH = SITE / "tools" / "font-coverage.json"
CACHE = SITE / "tools" / ".font-cache"

SOURCE_URL = (
    "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/"
    "NotoSansJP%5Bwght%5D.ttf"
)
LICENSE_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/OFL.txt"

# 400=本文 / 500=font-medium / 700=font-semibold(600) の解決先。
# 600 の実体は無く、CSS の重み照合が上方向に歩いて 700 に当たる（layout.tsx の注記）。
WEIGHTS = (400, 500, 700)

# 1チャンクの字数。Google の分割は約144字/チャンクで、それに近い粒度にしてある。
# 小さくすると引き当ての無駄は減るがファイル数が増える（実測: 80字でトップ1,680
# グリフ・120字で1,920グリフとほとんど変わらないので、ファイル数の少ない側を採る）。
CHUNK_SIZE = 120

# 画面に出る文字を集めるとき見るファイル。`out/data/` は配布データの置き場なので除く
# （../scripts で作る配布物で、ブラウザは描画しない）。
SCAN_SUFFIXES = (".html", ".js", ".txt", ".xml", ".css")
SCAN_EXCLUDE_TOP = ("data",)

# out/ に1文字も出ていなくても必ず入れる下限。UI の文言をいじった程度で
# postbuild が落ちないようにする保険で、字数は 500 弱しかないので実害は無い。
BASELINE_RANGES = (
    (0x0020, 0x007E),  # ASCII
    (0x00A0, 0x00FF),  # Latin-1 補助（°・×・÷ など）
    (0x2010, 0x2027),  # ハイフン・ダッシュ・引用符・傍点
    (0x2030, 0x205E),  # ‰ † ‡ … ′ ″ など
    (0x2190, 0x2193),  # ← ↑ → ↓
    (0x2460, 0x2473),  # ① 〜 ⑳
    (0x25A0, 0x25CF),  # ■ □ ▲ △ ● ○
    (0x3000, 0x303F),  # 全角空白・句読点・括弧
    (0x3041, 0x309F),  # ひらがな
    (0x30A0, 0x30FF),  # カタカナ
    (0xFF01, 0xFF60),  # 全角英数・記号
    (0xFFE0, 0xFFE6),  # ￠ ￡ ￥ など
)


def log(msg: str) -> None:
    print(msg, flush=True)


def ensure_source() -> pathlib.Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    ttf = CACHE / "NotoSansJP[wght].ttf"
    if not ttf.exists():
        log(f"取得中: {SOURCE_URL}")
        subprocess.run(["curl", "-sSL", "--fail", "-o", str(ttf), SOURCE_URL], check=True)
    ofl = FONT_DIR / "OFL.txt"
    if not ofl.exists():
        FONT_DIR.mkdir(parents=True, exist_ok=True)
        # 再配布するので同梱する（OFL 1.1 の条件）。
        subprocess.run(["curl", "-sSL", "--fail", "-o", str(ofl), LICENSE_URL], check=True)
    return ttf


def collect_charset() -> tuple[set[int], dict[int, int]]:
    """描画対象の文字と、ページ出現数（並べ替えの鍵）を返す。"""
    if not OUT.is_dir():
        sys.exit("out/ が無い。先に `npm run build` を流すこと（文字はそこから集める）")

    chars: set[str] = set()
    for path in OUT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in SCAN_SUFFIXES:
            continue
        rel = path.relative_to(OUT)
        if rel.parts and rel.parts[0] in SCAN_EXCLUDE_TOP:
            continue
        chars |= set(path.read_text(encoding="utf-8", errors="ignore"))

    codepoints = {ord(c) for c in chars}
    for lo, hi in BASELINE_RANGES:
        codepoints |= set(range(lo, hi + 1))

    # 並べ替えの鍵は「何ページの HTML に出るか」。1ページにしか出ない諱の異体字が
    # 後ろへ回り、仮名と常用漢字が先頭に固まる。
    freq: dict[int, int] = {}
    for path in OUT.rglob("*.html"):
        for c in set(path.read_text(encoding="utf-8", errors="ignore")):
            cp = ord(c)
            if cp in codepoints:
                freq[cp] = freq.get(cp, 0) + 1
    return codepoints, freq


def chunk_order(codepoints: set[int], freq: dict[int, int]) -> list[list[int]]:
    ordered = sorted(codepoints, key=lambda cp: (-freq.get(cp, 0), cp))
    return [ordered[i : i + CHUNK_SIZE] for i in range(0, len(ordered), CHUNK_SIZE)]


def unicode_range(cps: list[int]) -> str:
    """連続する部分だけ範囲へ畳んで unicode-range の値にする。"""
    parts: list[str] = []
    run_start = run_end = None
    for cp in sorted(cps):
        if run_start is None:
            run_start = run_end = cp
        elif cp == run_end + 1:
            run_end = cp
        else:
            parts.append(f"U+{run_start:X}" if run_start == run_end else f"U+{run_start:X}-{run_end:X}")
            run_start = run_end = cp
    if run_start is not None:
        parts.append(f"U+{run_start:X}" if run_start == run_end else f"U+{run_start:X}-{run_end:X}")
    return ",".join(parts)


def compact_ranges(cps: set[int]) -> list[list[int]]:
    """連続するコードポイントを [開始, 終了] へ畳む（coverage を小さく保つため）。"""
    out: list[list[int]] = []
    for cp in sorted(cps):
        if out and cp == out[-1][1] + 1:
            out[-1][1] = cp
        else:
            out.append([cp, cp])
    return out


def subset_font(src: pathlib.Path, cps: list[int], dest: pathlib.Path, flavor: str | None) -> None:
    args = [str(src), f"--output-file={dest}", "--unicodes=" + ",".join(f"{cp:X}" for cp in cps)]
    if flavor:
        args.append(f"--flavor={flavor}")
    subset.main(args)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep-cache", action="store_true", help="中間の ttf を消さない（調査用）")
    args = ap.parse_args()

    started = time.time()
    src = ensure_source()

    codepoints, freq = collect_charset()
    full = TTFont(src)
    have = set(full.getBestCmap())
    # Noto Sans JP は日本語の字形しか持たないので、原文の引用に混じる簡体字
    # （迟・爱・为 …）は底本の時点で入っていない。**これは今回の差し替えで生じた
    # ものではなく、next/font/google のときから同じ**（ブラウザが1字だけ別書体へ
    # 落として描いている）。ここで黙って消えると後から追えないので件数を出し、
    # 「取り直せば入る字」と機械で区別できるよう底本の cmap を coverage に残す。
    unavailable = sorted(cp for cp in codepoints - have if cp >= 0x2E80)
    if unavailable:
        log(
            f"注意: 底本 Noto Sans JP に無い文字が {len(unavailable)} 字ある"
            "（画面ではその字だけ別書体で描かれる。差し替え前からの既知の状態）: "
            + "".join(chr(c) for c in unavailable[:30])
        )
    codepoints &= have

    chunks = chunk_order(codepoints, freq)
    log(f"描画対象 {len(codepoints)} 字 → {len(chunks)} チャンク × {len(WEIGHTS)} ウェイト")

    if FONT_DIR.exists():
        for old in FONT_DIR.glob("*.woff2"):
            old.unlink()
    FONT_DIR.mkdir(parents=True, exist_ok=True)

    faces: list[tuple[int, int, str, int]] = []  # weight, index, filename, bytes
    for weight in WEIGHTS:
        t0 = time.time()
        inst = instancer.instantiateVariableFont(
            TTFont(src), {"wght": weight}, inplace=False, updateFontNames=False
        )
        stage = CACHE / f"stage-{weight}.ttf"
        inst.save(stage)
        # 一度 universe まで絞ってからチャンクへ割る（5.7MB を84回舐めると数分かかる）。
        narrowed = CACHE / f"narrow-{weight}.ttf"
        subset_font(stage, sorted(codepoints), narrowed, None)
        for i, cps in enumerate(chunks):
            name = f"noto-sans-jp-{weight}-{i:02d}.woff2"
            dest = FONT_DIR / name
            subset_font(narrowed, cps, dest, "woff2")
            faces.append((weight, i, name, dest.stat().st_size))
        log(f"  wght={weight}: {time.time() - t0:.1f}s")

    lines = [
        "/* 自動生成 — 手で書き換えないこと。作り直しは `python3 tools/build-font-subset.py`。",
        " * 由来と設計の理由はそのスクリプトの docstring に書いてある。",
        " * 書体そのものは Noto Sans JP（OFL 1.1・ライセンスは ./fonts/OFL.txt）。 */",
    ]
    for i, cps in enumerate(chunks):
        rng = unicode_range(cps)
        for weight in WEIGHTS:
            name = f"noto-sans-jp-{weight}-{i:02d}.woff2"
            lines.append(
                "@font-face{font-family:'Noto Sans JP';font-style:normal;"
                f"font-weight:{weight};font-display:swap;"
                f'src:url("./fonts/{name}") format("woff2");unicode-range:{rng}}}'
            )
    # 差し替え前（next/font/google）が出していた代替書体の指標をそのまま引き継ぐ。
    # 値は Next が Arial の実測から出したもので、これが無いと swap の瞬間に行が動く
    # （PSI 実測の CLS 0 を守るための1行）。
    lines.append(
        "@font-face{font-family:'Noto Sans JP Fallback';src:local(Arial);"
        "ascent-override:110.73%;descent-override:27.49%;line-gap-override:0.0%;"
        "size-adjust:104.76%}"
    )
    CSS_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")

    # `sourceRanges` は底本が持っている字の全体。postbuild の検査はこれを使って
    # 「取り直せば入る字（＝落とすべき）」と「底本がそもそも持っていない字
    # （＝どうにもならない）」を分ける。片方しか無いと、簡体字が出るたびに
    # ビルドが落ちるか、逆にサブセットの取り忘れを見逃すかのどちらかになる。
    COVERAGE_PATH.write_text(
        json.dumps(
            {
                "generatedBy": "tools/build-font-subset.py",
                "chunkSize": CHUNK_SIZE,
                "weights": list(WEIGHTS),
                "codepoints": sorted(codepoints),
                "sourceRanges": compact_ranges(have),
            },
            ensure_ascii=True,
        )
        + "\n",
        encoding="utf-8",
    )

    if not args.keep_cache:
        for stray in CACHE.glob("stage-*.ttf"):
            stray.unlink()
        for stray in CACHE.glob("narrow-*.ttf"):
            stray.unlink()

    total = sum(size for *_, size in faces)
    log(f"woff2 {len(faces)} 本 / 合計 {total / 1024:.0f}KB")
    log(f"CSS {CSS_PATH.stat().st_size / 1024:.1f}KB（従来 283.7KB）")
    log(f"所要 {time.time() - started:.1f}s")
    if shutil.which("gzip"):
        gz = subprocess.run(["gzip", "-9c", str(CSS_PATH)], capture_output=True).stdout
        log(f"CSS gz {len(gz) / 1024:.1f}KB（従来 98KB）")


if __name__ == "__main__":
    main()
