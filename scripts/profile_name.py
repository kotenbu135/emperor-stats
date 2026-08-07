#!/usr/bin/env python3
"""紹介文の本文で人物を指すときに使う名前を引く（GitHub Issue #16）。

**書き手に選ばせない。** 続柄を `relation_path.py` から引くのと同じ理由で、
呼び名も解決器から引く。2026-08-07 にユーザーから出た指摘:

> 紹介文の人物名は諱固定ではなく現代での通用名にする。始皇帝なら政ではなく嬴政。
> ただし耶律阿保機、クビライのように単純に姓諱を繋げればいいというものではない。

実際、既存148本のうち73本が姓を1度も出さず、「垂」「曜」「勒」「勃勃」のように
**諱1字だけ**で人物を指していた（本紀の原文がそう書くのをそのまま持ってきた形）。
日本語では姓を落とした呼び方は通用しないので、本文では通用名を使う。

読みと同じで**これは原典から得られる調査項目ではない**（日本語の慣用）。だから
`emperors.json` に欄を足さず（`R-CLAIM-GATED` の対象外）、ここで解決する。
`data/name-readings.json` の meta が同じ理由で読みを別ファイルにしているのと揃える。

規則は4つ。**既定は姓＋諱**で、例外だけを名指しで持つ:

1. `default` — 姓＋諱（嬴政・劉邦・曹丕・石勒・慕容垂・拓跋珪・愛新覚羅溥儀）
2. `ethnic` — 音写名が通用する政権。モンゴル（元・北元12人）と満洲（清太宗）。
   **契丹名・女真名は含めない** — 遼の「耶律堯骨」・金の「合剌」は原音の別名であって
   現代日本の通用名ではなく、通用するのは漢名の「耶律徳光」「完顔亶」のほう
3. `courtesy` — 諱ではなく字で知られる2人（耶律阿保機＝諱は億／完顔阿骨打＝諱は旻）
4. `override` — 上のどれでもない名指しの例外（武則天）

`aliases` から機械で拾わない。あの欄には「秦始皇」「海昏侯」「蒼梧王」のような
**号**が混ざっていて、通用名かどうかは欄では決まらない。

使い方:
    python3 scripts/profile_name.py <皇帝id>          # 本文で使う名前とルビ
    python3 scripts/profile_name.py --all             # 365人ぶん（規則の内訳つき）
    python3 scripts/profile_name.py --all --rule ethnic
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EMPERORS = ROOT / "data" / "emperors.json"
READINGS = ROOT / "data" / "name-readings.json"

# 音写名が通用する民族名の種別。`name.ethnicName.kind` の値。
ETHNIC_KINDS = ("mongol", "manchu")

# 諱ではなく字で知られる人物。値は本文で使う形。
COURTESY_NAMES: dict[str, str] = {
    "liao-taizu": "耶律阿保機",   # 諱は億
    "jin-taizu": "完顔阿骨打",     # 諱は旻
}

# 上のどの規則にも当たらない名指しの例外。**足すときは理由をコメントで残す。**
OVERRIDES: dict[str, str] = {
    # 姓＋諱は「武曌」だが、現代の日本で通用するのは武則天（または則天武后）。
    # データ側の commonName も「則天大聖皇帝（武則天）」で武則天を採っている。
    "tang-wuzetian": "武則天",
}


def load_emperors() -> dict[str, dict]:
    return {e["id"]: e for e in json.loads(EMPERORS.read_text(encoding="utf-8"))["emperors"]}


def load_readings() -> dict[str, str]:
    return json.loads(READINGS.read_text(encoding="utf-8"))["names"]


def resolve(emperor: dict, readings: dict[str, str]) -> dict:
    """本文で使う名前を決める。→ {plain, annotated, rule, personalName, familyName}

    `annotated` は `data/name-readings.json` が持つルビ記法そのまま（切り方も読みも
    テーブルが正本で、ここでは組み立てない）。カタカナだけの名前にはルビが要らないので
    `annotated` は `plain` と同じになる。
    """
    emperor_id = emperor["id"]
    name = emperor["name"]
    family = name.get("familyName") or ""
    personal = name.get("personalName") or ""
    ethnic = name.get("ethnicName") or {}

    if emperor_id in OVERRIDES:
        plain, rule = OVERRIDES[emperor_id], "override"
    elif emperor_id in COURTESY_NAMES:
        plain, rule = COURTESY_NAMES[emperor_id], "courtesy"
    elif ethnic.get("kind") in ETHNIC_KINDS:
        plain, rule = ethnic["value"], "ethnic"
    else:
        plain, rule = family + personal, "default"

    annotated = readings.get(plain)
    if annotated is None:
        # 漢字を含むのに読みが無いのは、テーブル側の穴か例外の書き間違い。
        has_kanji = any("㐀" <= c <= "鿿" or "豈" <= c <= "﫿" for c in plain)
        if has_kanji:
            raise SystemExit(
                f"{emperor_id}: 「{plain}」の読みが data/name-readings.json にありません。\n"
                f"      直し方: name-readings.json の names へ ｜{plain}《よみ》 を足す"
                "（読みの正本はあちら側で、ここでは組み立てない）"
            )
        annotated = plain  # カタカナ（クビライ・ホンタイジ）

    return {
        "id": emperor_id,
        "plain": plain,
        "annotated": annotated,
        "rule": rule,
        "familyName": family,
        "personalName": personal,
    }


def resolve_id(emperor_id: str) -> dict:
    emperors = load_emperors()
    if emperor_id not in emperors:
        raise SystemExit(f"未知の皇帝id: {emperor_id}")
    return resolve(emperors[emperor_id], load_readings())


# ---------------------------------------------------------------- 諱1字の検出

# 諱を含む名乗りの形。この中に現れた諱は「単独で使った」に数えない。
_FORM_KEYS = ("commonName", "posthumousName", "templeName", "courtesyName", "childhoodName")
# 1字の諱の直後に来てよい文字（助詞・句読点）。これ以外が続くものは一般語とみなす
# （「生まれつき」の「生」・「余り」の「余」で実際に誤爆した）。
_PARTICLES = "はがをにのへともやでか、。」』・"
_KANJI = r"[㐀-鿿豈-﫿\U00020000-\U0003ffff]"
# 「諱は禅、字は公嗣」のように**諱そのものを話題にしている**箇所。ここは単独でよい。
_INTRO = re.compile(r"(諱|名|字|幼名|小字)(は|を|が|の)$")
# 逆向きの同じ形。「汲桑が石を姓とし勒を名として与えた」— ここへ姓を足すと
# 「石勒を名として与えた」になって文が壊れる（実際に壊した）。
_AS_NAME = re.compile(r"^(を|と|という)(名|諱|字|号)")


def name_forms(emperor: dict, resolved: dict) -> list[str]:
    """その人物の名乗りのうち、諱を含むもの（長い順）。"""
    name = emperor["name"]
    personal = name.get("personalName") or ""
    forms = [resolved["plain"], (name.get("familyName") or "") + personal]
    forms += [name[k] for k in _FORM_KEYS if name.get(k)]
    forms += list(name.get("aliases") or [])
    if name.get("ethnicName"):
        forms.append(name["ethnicName"]["value"])
    uniq = {f for f in forms if f and personal in f and f != personal}
    return sorted(uniq, key=len, reverse=True)


def bare_spans(text: str, emperor: dict, resolved: dict) -> list[tuple[int, int]]:
    """本文が諱だけで人物を指している箇所の位置。→ [(始まり, 終わり), ...]

    `text` は**ルビを剥がした** lead＋body（位置は剥がしたあとの座標）。
    **カギ括弧の中は数えない**（原文の言い回しを話題にしている箇所・
    profile_prose.archaic_hits と同じ扱い）。

    先に名乗りの形（姓＋諱・廟号・字・別名）を伏せてから諱を探す。伏せないと
    「石勒」の中の「勒」に当たる。伏せ字は長さを変えないので位置はずれない。
    """
    import profile_prose  # 循環を避けるため関数の中で読む

    personal = emperor["name"].get("personalName") or ""
    if not personal:
        return []
    work = profile_prose.QUOTED.sub(lambda m: "\x00" * len(m.group(0)), text)
    for form in name_forms(emperor, resolved):
        work = work.replace(form, "\x00" * len(form))

    if len(personal) == 1:
        # 1字の諱は**助詞・句読点が続くときだけ**数える。熟語の一部（「隆盛」）と
        # 送り仮名の付く一般語（「生まれ」「余り」）を落とすため。
        pattern = re.compile(
            f"(?<!{_KANJI}){re.escape(personal)}(?=[{re.escape(_PARTICLES)}])"
        )
    else:
        pattern = re.compile(re.escape(personal))

    spans = []
    for m in pattern.finditer(work):
        if _INTRO.search(work[max(0, m.start() - 3):m.start()]):
            continue
        if _AS_NAME.match(work[m.end():m.end() + 4]):
            continue
        spans.append(m.span())
    return spans


def bare_hits(text: str, emperor: dict, resolved: dict) -> list[str]:
    """bare_spans の前後8字を添えた形。報告・エラー文に使う。"""
    return [
        text[max(0, lo - 8):hi + 8].replace("\x00", "").replace("\n", " ")
        for lo, hi in bare_spans(text, emperor, resolved)
    ]


def main() -> int:
    ap = argparse.ArgumentParser(description="紹介文の本文で使う人物名を引く")
    ap.add_argument("emperor_id", nargs="?")
    ap.add_argument("--all", action="store_true", help="365人ぶん出す")
    ap.add_argument("--rule", help="--all を規則で絞る（default/ethnic/courtesy/override）")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    emperors = load_emperors()
    readings = load_readings()

    if args.all:
        rows = [resolve(e, readings) for e in emperors.values()]
        if args.rule:
            rows = [r for r in rows if r["rule"] == args.rule]
        if args.json:
            print(json.dumps(rows, ensure_ascii=False, indent=2))
            return 0
        for r in rows:
            bare = f"（諱は{r['personalName']}）" if r["plain"] != r["familyName"] + r["personalName"] else ""
            print(f"{r['id']:32s} {r['rule']:8s} {r['annotated']}{bare}")
        counts: dict[str, int] = {}
        for r in rows:
            counts[r["rule"]] = counts.get(r["rule"], 0) + 1
        print("\n" + "／".join(f"{k} {v}人" for k, v in sorted(counts.items())))
        return 0

    if not args.emperor_id:
        ap.error("皇帝id か --all を付ける")
    r = resolve_id(args.emperor_id)
    if args.json:
        print(json.dumps(r, ensure_ascii=False, indent=2))
        return 0
    print(f"本文で使う名前: {r['annotated']}")
    print(f"規則: {r['rule']}／姓 {r['familyName'] or '（無し）'}／諱 {r['personalName']}")
    if r["plain"] != r["familyName"] + r["personalName"]:
        print(f"**諱「{r['personalName']}」で指さない。**")
    return 0


if __name__ == "__main__":
    sys.exit(main())
