#!/usr/bin/env python3
"""照合台帳に載らない引用の件数（2026-08-03・Issue #63 の作業中に見つかった）。

`verify_quotes.py` の `quoted_spans()` が拾うのは **「」で囲んだスパンだけ**で、
`『』` で囲んだ引用は引用ユニットにならない。つまり `--check` も `--check-books` も
`--check-volumes` も、字体ゲートも**その断片には一度も掛かっていない**。

**この状態を直すには抽出規則を変える必要があり、台帳キーが変わるので全件バックフィルになる**
（`extract_units` の docstring）。手順の変更なので勝手にやらず、まず数を出す
（規則 `R-PROCESS-FEEDBACK`／量の置き場は docs/process/RESIDUAL.md）。

    python3 scripts/count_unledgered_quotes.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from verify_quotes import KANA, extract_units, han_only  # noqa: E402

# `verify_quotes.quoted_spans` と同じ条件で、括弧だけ差し替える
OTHER = re.compile(r"『([^』]+)』")

# 引用が書かれうる欄。`extract_units` は容器を列挙するが、こちらは数を出すだけなので走査する
TEXT_KEYS = ("note", "conversion", "quote")


def spans(text):
    out = []
    for m in OTHER.finditer(text or ""):
        s = m.group(1)
        if KANA.search(s):
            continue
        if len(han_only(s)) >= 6:
            out.append(s)
    return out


def walk(node, found, eid):
    if isinstance(node, dict):
        for k, v in node.items():
            if k in TEXT_KEYS and isinstance(v, str):
                for s in spans(v):
                    found.append((eid, k, s))
            else:
                walk(v, found, eid)
    elif isinstance(node, list):
        for v in node:
            walk(v, found, eid)


def main():
    data = json.loads((ROOT / "data" / "emperors.json").read_text(encoding="utf-8"))
    found = []
    for e in data["emperors"]:
        walk(e, found, e["id"])
    fields = {}
    for _, k, _ in found:
        fields[k] = fields.get(k, 0) + 1
    print(f"台帳に載っている引用ユニット: {len(extract_units(data))}")
    print(f"『』で囲まれていて台帳に載らない断片: {len(found)}"
          f"（{len({e for e, _, _ in found})}人／欄別 "
          + "・".join(f"{k} {v}" for k, v in sorted(fields.items())) + "）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
