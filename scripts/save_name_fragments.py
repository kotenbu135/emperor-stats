#!/usr/bin/env python3
"""調査ブロックが /tmp に書いた断片を data/internal/name-fragments/ へ保存する。

**cp で上書きしない**ためのスクリプト。名前欄の補充（Issue #126）は項目ごとに
ブロックを分けて進めるので、同じ人物の断片が「諡の段のブロック」「字のブロック」
「廟号のブロック」で何度も作られる。cp すると前のブロックが確定した `read-absent` や
別項目の `findings` が黙って消える（2026-08-14 のブロック2で手作業のマージに切り替えた
経緯を、ここで機械側に移す）。

マージの規約は4つ:

1. 旧側にしか無い欄（top-level・findings の field）を持ち越す
2. `value: []` は `null` ＋ `verdict: "read-absent"` へ正規化する
3. **既存の `read-absent` を `pending` へ後退させない**（fail-closed の向きを保つ）
4. 旧側が値を持つ欄を新側の空で消さない — 検証段が守った値がここに入るので、
   自動では上書きせず「要判断」として報告する

使い方::

    python3 scripts/save_name_fragments.py <srcDir> --tag block3          # 下見
    python3 scripts/save_name_fragments.py <srcDir> --tag block3 --apply  # 保存

`--tag` は cid の衝突を避ける接頭辞。旧側と同じ cid（c1, c2 …）が来たら
新側だけを `block3-c1` の形に付け替え、`basis` の参照も一緒に書き換える。
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "data/internal/name-fragments"


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def normalize(frag, reports):
    """空配列を null ＋ read-absent へ寄せる（規約2）。"""
    for f in frag.get("findings") or []:
        if f.get("value") == []:
            f["value"] = None
            if not f.get("verdict"):
                f["verdict"] = "read-absent"
                reports.append(f"  正規化: {f.get('field')} の [] を null ＋ read-absent へ")
            else:
                reports.append(f"  正規化: {f.get('field')} の [] を null へ"
                               f"（verdict は {f['verdict']} のまま）")
    return frag


def key_of(claim):
    return (claim.get("file"), claim.get("line"), claim.get("quote"))


def merge(old, new, tag, reports, conflicts):
    """旧断片に新断片を重ねる。戻り値は保存する dict。"""
    old_cids = {c.get("cid") for c in old.get("claims") or []}
    by_key = {key_of(c): c.get("cid") for c in old.get("claims") or []}

    # 新側の cid を付け替える（衝突したものだけ）。同じ引用が旧側に在れば旧の cid へ寄せる
    remap = {}
    kept_claims = []
    for c in new.get("claims") or []:
        cid = c.get("cid")
        same = by_key.get(key_of(c))
        if same:
            remap[cid] = same          # 同一の引用 — 旧側の cid を使い、行は増やさない
            continue
        if cid in old_cids:
            new_cid = f"{tag}-{cid}"
            remap[cid] = new_cid
            c["cid"] = new_cid
        kept_claims.append(c)
    for f in new.get("findings") or []:
        f["basis"] = [remap.get(b, b) for b in (f.get("basis") or [])]

    merged = dict(old)
    merged["claims"] = (old.get("claims") or []) + kept_claims

    old_by_field = {f.get("field"): f for f in old.get("findings") or []}
    out, replaced, added = [], [], []
    for field, of in old_by_field.items():
        nf = next((x for x in new.get("findings") or [] if x.get("field") == field), None)
        if nf is None:
            out.append(of)                                    # 規約1: 旧側だけの欄
            continue
        if of.get("verdict") == "read-absent" and nf.get("verdict") == "pending":
            out.append(of)                                    # 規約3: 後退させない
            conflicts.append(f"  {field}: 旧 read-absent → 新 pending。旧を残した")
            continue
        if of.get("value") not in (None, [], "") and nf.get("value") in (None, [], ""):
            out.append(of)                                    # 規約4: 値を消さない
            conflicts.append(f"  {field}: 旧に値 {of.get('value')!r}・新は空。"
                             f"旧を残した（要判断）")
            continue
        out.append(nf)
        replaced.append(field)
    for nf in new.get("findings") or []:
        if nf.get("field") not in old_by_field:
            out.append(nf)
            added.append(nf.get("field"))
    merged["findings"] = out

    for k, v in (new or {}).items():                          # 規約1 の top-level 側
        if k in ("claims", "findings"):
            continue
        if k == "conflicts":
            # **上書きしない**（2026-08-17 に直した）。ここが素の代入だったため、
            # 別項目のブロックを重ねるたびに前の対立が消えていた（唐の5断片で実測 —
            # 元号名の断片は conflicts を持たない／1件しか持たないので、名前欄の段が
            # 記録した「諡の段の対立」が黙って落ちた）。claims と同じく重ねる
            same = {json.dumps(c, ensure_ascii=False, sort_keys=True) for c in (v or [])}
            keep = [c for c in (old.get("conflicts") or [])
                    if json.dumps(c, ensure_ascii=False, sort_keys=True) not in same]
            merged["conflicts"] = keep + list(v or [])
            if keep:
                reports.append(f"  conflicts: 旧側の {len(keep)}件を持ち越した")
            continue
        if k == "noteLog":
            merged["noteLog"] = ((old.get("noteLog") or "").rstrip() + "\n" + str(v)).strip()
        else:
            merged[k] = v
    for k, v in (old or {}).items():
        merged.setdefault(k, v)

    if added:
        reports.append(f"  追加した欄: {'・'.join(added)}")
    if replaced:
        reports.append(f"  差し替えた欄: {'・'.join(replaced)}")
    if remap:
        reports.append(f"  cid の付け替え {len(remap)}件（うち旧へ寄せたのが "
                       f"{sum(1 for k, v in remap.items() if not v.startswith(tag))}件）")
    return merged


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src", help="ブロックが断片を書いたディレクトリ（*.json）")
    ap.add_argument("--tag", required=True, help="cid が衝突したときの接頭辞（例: block3）")
    ap.add_argument("--apply", action="store_true", help="実際に書き込む（既定は下見）")
    ap.add_argument("--only", help="id のカンマ区切り（一部だけ保存するとき）")
    args = ap.parse_args(argv)

    src = Path(args.src)
    if not src.is_dir():
        print(f"ディレクトリがありません: {src}", file=sys.stderr)
        return 1
    only = set((args.only or "").split(",")) if args.only else None

    files = sorted(p for p in src.glob("*.json"))
    n_new = n_merged = 0
    all_conflicts = []
    for p in files:
        raw = load(p)
        eid = raw.get("id") or p.stem
        if only and eid not in only:
            continue
        dest = DEST / f"{eid}.json"
        reports, conflicts = [], []
        frag = normalize(raw, reports)
        if dest.exists():
            merged = merge(load(dest), frag, args.tag, reports, conflicts)
            n_merged += 1
            head = f"[マージ] {eid}"
        else:
            merged = frag
            n_new += 1
            head = f"[新規]   {eid}"
        print(head)
        for line in reports + conflicts:
            print(line)
        all_conflicts += [f"{eid}: {c.strip()}" for c in conflicts]
        if args.apply:
            dest.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n",
                            encoding="utf-8")

    print(f"\n新規 {n_new}件・マージ {n_merged}件"
          f"{'（下見。--apply で書き込む）' if not args.apply else '（書き込みました）'}")
    if all_conflicts:
        print(f"\n要判断 {len(all_conflicts)}件（旧側を残してある）:")
        for c in all_conflicts:
            print(f"  - {c}")
    print("\n保存したら python3 scripts/check_claims.py data/internal/name-fragments/ で照合する")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
