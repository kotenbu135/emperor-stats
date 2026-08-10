"""コーパスの1冊（または1ディレクトリ）を語で走査し、前後の窓つきで出す。

    python3 scripts/sweep_keyword.py <ディレクトリ|ファイル> <語1,語2,…> [窓幅]

ディレクトリを渡すと配下の `.txt`／`.html` を全部、ファイルを渡すとその1冊だけを走査する。
**china-history 側は書によって志・列伝を欠く**（后汉书は志が無く、元史は志と表しか無い）ので、
「1冊まるごと走査した」と名乗るときは daizhigev20 の1ファイル版を渡す。

**なぜ grep を使わないか。** 素の `grep`／Grep ツールはこの環境では ugrep で、
`.{0,N}KW.{0,N}` 型のコンテキスト抽出を掛けるとメモリ4GB超に暴走して WSL ごと落ちる
（`R-CORPUS-GREP`・[CORPUS_NOTES.md](../docs/process/CORPUS_NOTES.md)）。
窓を切るのは Python 側の仕事にする。

**何に使うか。** 走査結果を悉皆性の根拠に使う前に、その語彙に掛からない該当記事が
無いかを1冊まるごとで確かめる（`R-SWEEP-DETECTION`）。名前欄の転記では
「第二の証人」を引くのに使う — **語は書で変わる**ので、当たらないときは語を疑う:

- 底本が繁体の書（宋史）は `廟號`。`庙号` では0件になる
- 後漢書は `庙号` を1件も使わず、宗号の制度を `称宗` の語で扱う
  （書全体で該当条は献帝紀 初平元年の除尊号1件だけ）
- 魏書は**1冊の中で3語を使い分ける** — `庙号` が多数だが明元帝は `庙称`・
  孝文帝は `庙曰`。1語で当てると帝が2人落ちる（2026-08-10）

出力は `<相対パス>:<行>:<語>:<窓>` の1件1行で、件数は stderr へ出す
（`| head` で切っても総数が読める）。巻をファイル1つに丸ごと入れている書では
行番号が常に同じ値になるが、これは異常ではない。
"""
import os
import sys


def walk(root):
    if os.path.isfile(root):
        yield root
        return
    for dirpath, _, names in os.walk(root):
        for n in sorted(names):
            if n.endswith(".txt") or n.endswith(".html"):
                yield os.path.join(dirpath, n)


def main(root, kws, width=40):
    kws = kws.split(",")
    total = 0
    for path in sorted(walk(root)):
        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
        except OSError:
            continue
        for ln, txt in enumerate(lines, 1):
            for kw in kws:
                start = 0
                while True:
                    i = txt.find(kw, start)
                    if i < 0:
                        break
                    total += 1
                    a = max(0, i - width)
                    b = min(len(txt), i + len(kw) + width)
                    print(f"{os.path.relpath(path, root)}:{ln}:{kw}:{txt[a:b].strip()}")
                    start = i + len(kw)
    print(f"# hits={total}", file=sys.stderr)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 40)
