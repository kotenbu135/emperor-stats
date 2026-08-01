"""底本に当たらない引用について、底本の最も近い箇所と1字単位の差分を出す。

`verify_quotes.py --check` が落とした引用・`--triage` 済みの残件を調べるための道具。
原文を人手で探し直す前に、まずこれを掛ける。

  python3 scripts/quote_diff.py                    # 調査待ち（triage 済み）を全部見る
  python3 scripts/quote_diff.py --id tang-taizong  # 人物を指定
  python3 scripts/quote_diff.py --status unresolved --limit 30

出力の読み方:
  不一致 1〜2字 → 字体の混入か誤字。底本の側を採る（引用は底本のまま保つ規約）
  不一致 3字以上 → 記事そのものの食い違い。複数箇所を1つの引用へ合成している疑い
  「底本に近い箇所なし」→ その書に無い。書名の取り違えを疑う

位置合わせは4字の窓を手がかりにする。断片の先頭が既に違っていても、
後半が一致していれば底本側の該当箇所を拾える。
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from hanzi_norm import han_only, norm_strict  # noqa: E402
from verify_quotes import CORPUS_ROOT, REFS_PATH, fragments, normalized_lines  # noqa: E402

WINDOW = 4


def strict_text(relpath, _cache={}):
    if relpath not in _cache:
        if len(_cache) > 6:
            _cache.clear()
        p = CORPUS_ROOT / relpath
        _cache[relpath] = norm_strict(p.read_text(encoding="utf-8", errors="ignore")) if p.exists() else ""
    return _cache[relpath]


def best_align(frag, text, limit=400):
    """frag に最も近い text 中の同じ長さの区間: (不一致数, 区間)。"""
    best = (len(frag) + 1, None)
    for k in range(0, max(1, len(frag) - WINDOW + 1)):
        win = frag[k:k + WINDOW]
        if len(win) < WINDOW:
            break
        start = n = 0
        while n < limit:
            i = text.find(win, start)
            if i < 0:
                break
            start, n = i + 1, n + 1
            j = i - k
            if j < 0 or j + len(frag) > len(text):
                continue
            seg = text[j:j + len(frag)]
            mis = sum(1 for a, b in zip(frag, seg) if a != b)
            if mis < best[0]:
                best = (mis, seg)
                if mis == 0:
                    return best
    return best


def line_of_strict(relpath, seg):
    for i, s in enumerate(normalized_lines(relpath), 1):
        if seg and seg in s:
            return i
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", help="人物 id で絞る")
    ap.add_argument("--status", help="台帳 status で絞る（既定: triage 済みの全て）")
    ap.add_argument("--limit", type=int, default=60)
    args = ap.parse_args()

    refs = json.loads(REFS_PATH.read_text(encoding="utf-8"))["refs"]
    rows = []
    for ent in refs.values():
        if args.id and ent.get("id") != args.id:
            continue
        if args.status:
            if ent.get("status") != args.status:
                continue
        elif not ent.get("triage"):
            continue
        rows.append(ent)
    rows.sort(key=lambda e: (e.get("id"), e.get("path")))

    dist = Counter()
    shown = 0
    for ent in rows:
        rel = ent.get("corpusFile")
        span = ent.get("span") or ""
        if not rel:
            dist["底本の記録なし"] += 1
            if shown < args.limit:
                shown += 1
                print(f'{ent["id"]} {ent["path"]}\n  引用 {span}\n  → 底本の記録が無い'
                      f'（status={ent.get("status")}）\n')
            continue
        text = strict_text(rel)
        worst = None
        for f in fragments(span):
            nf = norm_strict(f)
            if nf in text:
                continue
            mis, seg = best_align(nf, text)
            if worst is None or mis > worst[0]:
                worst = (mis, nf, seg)
        if worst is None:
            dist["一致（字体もそのまま）"] += 1
            continue
        mis, nf, seg = worst
        dist[f"{mis}字違い" if seg else "底本に近い箇所なし"] += 1
        if shown >= args.limit:
            continue
        shown += 1
        print(f'{ent["id"]} {ent["path"]}  [{rel}{"" if not ent.get("line") else " 行" + str(ent["line"])}]')
        print(f"  引用 {nf}")
        if seg:
            ln = line_of_strict(rel, seg)
            print(f'  底本 {seg}{"" if ln is None else f"  （行 {ln}）"}')
            print("  差分 " + "".join("." if a == b else "^" for a, b in zip(nf, seg)))
        else:
            print("  底本 （近い箇所が見つからない＝書名の取り違えを疑う）")
        print()

    print("--- 分布:", dict(sorted(dist.items())), f"/ 対象 {len(rows)} 件")
    return 0


if __name__ == "__main__":
    sys.exit(main())
