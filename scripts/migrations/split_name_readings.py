#!/usr/bin/env python3
"""姓と諱を分けたぶんのルビを `data/name-readings.json` へ足す（Issue #37 単位6）。

サイトは**画面に出る漢字入りの文字列が未登録ならビルドを落とす**（`site/src/lib/
name-readings.ts` の `rubyOf`）。姓と諱を別のチップにすると「嬴」「胡亥」のように
**今まで画面に出ていなかった文字列**が出るので、その読みが要る。

## 読みを新しく決めていない

足す読みは**既存の姓＋諱の読みを同じ位置で割ったもの**だけ:

1. 注記が既に境界で割れている（`｜嬴《えい》｜胡亥《こがい》`）→ そのまま2件に分ける
2. 1つに畳んである（`｜劉邦《りゅうほう》`）→ 姓の各字の読み（`site/src/lib/
   kana-readings.ts` の表）で先頭を食い、**一意に食い切れたときだけ**割る

**候補が0通り・2通り以上のときは書かない**（人が決める）。だから「劉＝りゅう」のような
既知の対応を使うだけで、新しい読みの判断はしていない。

出力:
    python3 scripts/migrations/split_name_readings.py --dry-run
    python3 scripts/migrations/split_name_readings.py
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EMPERORS = ROOT / "data" / "emperors.json"
READINGS = ROOT / "data" / "name-readings.json"
KANA_TABLE = ROOT / "site" / "src" / "lib" / "kana-readings.ts"

SEG = re.compile(r"｜([^｜《》]+)《([^｜《》]+)》")


def kana_table():
    src = KANA_TABLE.read_text(encoding="utf-8")
    body = src.split("const TABLE_SOURCE = `", 1)[1].split("`", 1)[0]
    table = {}
    for line in body.splitlines():
        if ":" not in line:
            continue
        char, readings = line.split(":", 1)
        table[char.strip()] = readings.split()
    return table


def split_reading(family, kana, table):
    """姓の読みで先頭を食い、(姓の読み, 諱の読み) を返す。決まらなければ None。"""
    heads = {""}
    for ch in family:
        nxt = set()
        for h in heads:
            for r in table.get(ch, []):
                nxt.add(h + r)
        heads = nxt
        if not heads:
            return None
    fits = {h for h in heads if kana.startswith(h) and len(kana) > len(h)}
    if len(fits) != 1:
        return None
    head = fits.pop()
    return head, kana[len(head):]


def build():
    table = kana_table()
    names = json.loads(READINGS.read_text(encoding="utf-8"))
    emperors = json.loads(EMPERORS.read_text(encoding="utf-8"))["emperors"]
    add, unresolved = {}, []
    for e in emperors:
        n = e["name"]
        family, given = n.get("familyName"), n["personalName"]
        full = f"{family or ''}{given}"
        ann = names["names"].get(full)
        if ann is None:
            unresolved.append((e["id"], full, "姓＋諱の読みが無い"))
            continue
        segs = SEG.findall(ann)
        if not family:
            # 姓を持たない12人。諱＝移行前の文字列なので既に登録済み
            continue
        if segs and segs[0][0] == family:
            fam_ruby = f"｜{segs[0][0]}《{segs[0][1]}》"
            giv_ruby = "".join(f"｜{t}《{r}》" for t, r in segs[1:])
        else:
            kana = "".join(r for _, r in segs)
            text = "".join(t for t, _ in segs)
            if text != full:
                unresolved.append((e["id"], full, f"注記の親文字が {text!r} で一致しない"))
                continue
            got = split_reading(family, kana, table)
            if got is None:
                unresolved.append((e["id"], full, f"{kana!r} を姓 {family!r} の読みで"
                                                  f"一意に割れない"))
                continue
            fam_ruby = f"｜{family}《{got[0]}》"
            giv_ruby = f"｜{given}《{got[1]}》"
        for key, value in ((family, fam_ruby), (given, giv_ruby)):
            if key in names["names"] or not value:
                continue
            if key in add and add[key] != value:
                unresolved.append((e["id"], key, f"同じ文字列に別の読み "
                                                 f"{add[key]!r} / {value!r}"))
                continue
            add[key] = value
    return names, add, unresolved


def main() -> int:
    ap = argparse.ArgumentParser(description="姓と諱のルビを足す（一度きりの移行）")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    names, add, unresolved = build()
    print(f"■ 足す読み {len(add)}件（既存 {len(names['names'])}件）")
    for k in list(add)[:10]:
        print(f"    {k} → {add[k]}")
    if unresolved:
        print(f"\n■ 割れないので**人が決める** {len(unresolved)}件")
        for eid, key, why in unresolved:
            print(f"    {eid:<28} {key}: {why}")
    if args.dry_run:
        print("\n--dry-run のため書き込んでいません")
        return 0
    if unresolved:
        print("\n割れない行があるので書きません（先に data/name-readings.json へ手で足す）")
        return 1
    names["names"].update(add)
    names["names"] = dict(sorted(names["names"].items()))
    READINGS.write_text(json.dumps(names, ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8")
    print(f"\n書き込みました: {READINGS.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
