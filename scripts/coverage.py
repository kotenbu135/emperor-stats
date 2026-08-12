#!/usr/bin/env python3
"""悉皆作業の充足率を、進捗表記ではなく**データ本体から実測する**（規則 R-COVERAGE-MEASURED）。

「364人完了」がチェックリスト上の自己申告で、実測は355人だった前例がある（2026-07-18・
グループ2の明清交替期群雄9名）。唐哀帝の収録漏れを見つけたのもエージェントではなく
在位年カバレッジの機械集計だった。**進捗は書くものではなく測るもの**、というのがこの
スクリプトの前提。

## セルは3状態で数える（2状態にしない）

「フィールドが在るか」で数えると全12項目が 365/365 で緑になり、いま分かっているだけでも
名前欄（Issue #126・旧 #37）の判別不能セル・紹介文の残りを1件も拾えない。数えるのは**確定したか**で、
そのために状態を3つに割る。

  filled      値がある
  absent      **構造的な根拠**があって「値が無い」と読める。死因の enum `unknown`
              （＝原典に死因記述が無いという判定）、regime-conventions.json が原典の
              明文で打ち切った政権、`dynastyOrderSurveyed: true` の政権の null など
  unknown     上のどちらでもない。**構造だけでは確定と読めない**セル

3つ目を潰さないのがこのスクリプトの要点で、絞り込みの `absent` を「値が無い」と読まない
のと同じ理由（規則 R-SCREEN-FIRST）。**note の散文からは確定を読み取らない** — note は
作業ログで「現行X→Yに訂正」と捨てた側を書くため、フィールドとの突合は向きが反転する
（Issue #40 の G2/G3 が測定で否定された経路）。だから `ages` のように「調査したが原典に
記載が無い」を散文でしか書いていない項目は、正直に unknown 側へ落ちる。**それが所見**で、
スクリプトがどちらかへ寄せて良いものではない。

**`claim` 欄（2026-08-03・Issue #43）も確定の根拠にしない。** claim は note と違って向きが
反転しないので突合の witness にはなるが、**既存 note に遡及しないので無いのが既定**であり、
「claim があるから確定」と読むと、書いた人物だけが確定に見えて実態は動かない。
`filled` にも `absent` にも使わないこと。突合は validate_emperors.py の check_claim_fields の担当。

## 使い方

    python3 scripts/coverage.py            # 項目別・政権別の実測
    python3 scripts/coverage.py --field ages.accessionAge   # 判別不能セルの id を出す
    python3 scripts/coverage.py --write    # PROJECT_STATUS.md の生成領域を書き直す
    python3 scripts/coverage.py --check    # 生成領域が実測とずれていたら落ちる（CI・Stop）

`--check` が見るのは docs/PROJECT_STATUS.md の `<!-- coverage:begin -->` … `:end` に
挟まれた領域だけ。同ファイルの他所には 2026-07-18 時点の「364人」のように**凍結した
歴史的な数字**が意図的に残っているので、そちらは触らないし検査もしない。
"""
from __future__ import annotations

import argparse
import collections
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EMPERORS = ROOT / "data" / "emperors.json"
CONVENTIONS = ROOT / "data" / "regime-conventions.json"
FRAGMENTS = ROOT / "data" / "internal" / "name-fragments"
PROFILES = ROOT / "data" / "emperor-profiles.json"
KINSHIP = ROOT / "data" / "kinship.json"
STATUS = ROOT / "docs" / "PROJECT_STATUS.md"

BEGIN = "<!-- coverage:begin -->"
END = "<!-- coverage:end -->"

FILLED, ABSENT, UNKNOWN = "filled", "absent", "unknown"


class Ctx:
    def __init__(self):
        self.data = json.loads(EMPERORS.read_text(encoding="utf-8"))
        self.emperors = self.data["emperors"]
        regimes = (self.data.get("meta", {}).get("catalogs", {}) or {}).get("regimes") or []
        self.regimes = {r["id"]: r for r in regimes}
        self.skip = self._skip_cells()
        self.read_absent = self._read_absent_cells()
        self.profiles = {}
        if PROFILES.exists():
            self.profiles = json.loads(PROFILES.read_text(encoding="utf-8")).get("profiles") or {}
        self.mothers = set()
        if KINSHIP.exists():
            for e in json.loads(KINSHIP.read_text(encoding="utf-8")).get("edges") or []:
                if e.get("type") == "kinship" and e.get("relation") == "birth-mother":
                    self.mothers.add(e.get("to"))

    def _skip_cells(self):
        """regime-conventions.json が原典の明文で打ち切った (政権, 項目, 例外id集合)。

        **scripts/screens/name_fields.py とは別実装にしてある。** 同じ母集団を2つの
        道具が測るので、突き合わせて合わなければどちらかが誤っていると分かる（片方が
        片方を import すると、その突き合わせは何も検査しない）。
        """
        out = {}
        if not CONVENTIONS.exists():
            return out
        data = json.loads(CONVENTIONS.read_text(encoding="utf-8"))
        for rec in data.get("conventions") or []:
            ex = {x.get("id"): x.get("personScope") for x in rec.get("exceptions") or []}
            for rid in rec.get("regimeIds") or []:
                for f in rec.get("fields") or []:
                    if rec.get("personScope") == "skip":
                        # 政権ぐるみの打ち切り。例外に別の scope が書かれた人物だけ戻す
                        out.setdefault((rid, f), set()).update(
                            {"*"} | {f"-{k}" for k, v in ex.items() if v != "skip"}
                        )
                    else:
                        # 人物単位の打ち切り（現状 0 件だが、書けてしまう形なので拾う）
                        for k, v in ex.items():
                            if v == "skip":
                                out.setdefault((rid, f), set()).add(k)
        return out

    def _read_absent_cells(self):
        """原文を読んで「この人にこの名乗りは無い」と決めた (人物, 項目)。

        証人は `data/internal/name-fragments/<id>.json` の
        `findings[{field: "name.<項目>", value: null, verdict: "read-absent"}]`。
        `basis` が引用台帳を指しているかは check_claims.py が見ている（引用が底本に
        実在するかまで）ので、**note の散文は読まない**。`verdict` が無い・"pending" の
        主張は数えない（付け忘れを過大報告ではなく過小報告に落とすため）。

        **`_skip_cells` と違い、これは絞り込みとの突き合わせにならない。**
        scripts/screens/name_fields.py も同じファイルを読むので、2つの実装が一致しても
        それは同じ証人を2回読んだだけ。検査になっているのは check_claims.py の側。

        空セルを母集団に取る絞り込みは、そのままでは 0 に到達できない（読んで「空が
        正しい」と決めたセルも空のまま残る）。この欄はその出口で、2026-08-11 に
        `read-absent` バケットと同時に入れた。
        """
        out = set()
        if not FRAGMENTS.exists():
            return out
        for path in sorted(FRAGMENTS.glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            eid = data.get("id") or path.stem
            for f in data.get("findings") or []:
                field = str(f.get("field") or "")
                if not field.startswith("name."):
                    continue
                if f.get("value") is not None or f.get("verdict") != "read-absent":
                    continue
                out.add((eid, field.split(".", 1)[1]))
        return out

    def skipped(self, regime_id, field, emperor_id):
        s = self.skip.get((regime_id, field))
        if not s:
            return False
        if "*" in s:
            return f"-{emperor_id}" not in s
        return emperor_id in s


def cell(subject, regime, state):
    return (subject, regime, state)


# --- 項目ごとの測り方 ---------------------------------------------------------
# `absent` を返してよいのは**構造的な根拠がある場合だけ**。根拠が散文にしか無い項目は
# unknown へ落とす（それが所見であって、スクリプトが埋めるものではない）。

def m_reign_date(ctx, which):
    for e in ctx.emperors:
        for i, r in enumerate(e.get("reigns") or []):
            v = r.get(which)
            yield cell(f"{e['id']}#{i + 1}", e["regimeId"], FILLED if v else UNKNOWN)


def m_count(ctx, field):
    for e in ctx.emperors:
        f = e.get(field)
        ok = isinstance(f, dict) and isinstance(f.get("count"), int)
        yield cell(e["id"], e["regimeId"], FILLED if ok else UNKNOWN)


def m_death_cause(ctx):
    for e in ctx.emperors:
        c = (e.get("deathCause") or {}).get("category")
        if not c:
            state = UNKNOWN
        elif c == "unknown":
            # enum の `unknown` は「原典に死因記述が無い」という判定で、未調査ではない
            state = ABSENT
        else:
            state = FILLED
        yield cell(e["id"], e["regimeId"], state)


def m_accession_route(ctx):
    for e in ctx.emperors:
        c = (e.get("accessionRoute") or {}).get("categoryId")
        yield cell(e["id"], e["regimeId"], FILLED if c else UNKNOWN)


def m_ages(ctx, sub):
    for e in ctx.emperors:
        v = (e.get("ages") or {}).get(sub)
        # ages には「調査したが原典に記載が無い」の構造的な印が無い（confidence は
        # レコード単位の判定で、high の98人が accessionAge を持たない）。だから
        # null は一律 unknown。**confidence を確定の印に流用しない**
        yield cell(e["id"], e["regimeId"], FILLED if v is not None else UNKNOWN)


def m_name(ctx, sub):
    for e in ctx.emperors:
        v = (e.get("name") or {}).get(sub)
        if v:
            state = FILLED
        elif ctx.skipped(e["regimeId"], sub, e["id"]) or (e["id"], sub) in ctx.read_absent:
            # 政権ぐるみの打ち切り（原典の明文）と、人物ごとの読解結果の2本。
            # 後者が無いと、読み終わったセルが未調査のセルと同じ判別不能に落ちる
            state = ABSENT
        else:
            state = UNKNOWN
        yield cell(e["id"], e["regimeId"], state)


def m_dynasty_order(ctx):
    for e in ctx.emperors:
        surveyed = (ctx.regimes.get(e["regimeId"]) or {}).get("dynastyOrderSurveyed") is True
        for i, r in enumerate(e.get("reigns") or []):
            v = r.get("dynastyOrder")
            if v is not None:
                state = FILLED
            elif surveyed:
                # 調査済み政権の null は「歴代に数えない」の意（EMPERORS_SCHEMA.md）
                state = ABSENT
            else:
                state = UNKNOWN
            yield cell(f"{e['id']}#{i + 1}", e["regimeId"], state)


def m_profile(ctx):
    for e in ctx.emperors:
        p = ctx.profiles.get(e["id"]) or {}
        ok = bool(p.get("lead")) and bool(p.get("description"))
        yield cell(e["id"], e["regimeId"], FILLED if ok else UNKNOWN)


def m_mother(ctx):
    for e in ctx.emperors:
        yield cell(e["id"], e["regimeId"], FILLED if e["id"] in ctx.mothers else UNKNOWN)


# id・ラベル・単位・「完了」と称しているか（meta.status の実値から引く）
FIELDS = [
    ("reigns.startDate", "在位データ: 即位日", "在位", "reignData", lambda c: m_reign_date(c, "startDate")),
    ("reigns.endDate", "在位データ: 退位・崩御日", "在位", "reignData", lambda c: m_reign_date(c, "endDate")),
    ("deathCause", "死因", "人", "deathCause", m_death_cause),
    ("accessionRoute", "即位経路", "人", "accessionRoute", m_accession_route),
    ("eraChangeCount", "改元回数", "人", "eraChangeCount", lambda c: m_count(c, "eraChangeCount")),
    ("amnestyCount", "大赦回数", "人", "amnestyCount", lambda c: m_count(c, "amnestyCount")),
    ("empressInstallationCount", "立后回数", "人", "empressInstallationCount", lambda c: m_count(c, "empressInstallationCount")),
    ("crownPrinceDepositionCount", "皇太子廃立回数", "人", "crownPrinceDepositionCount", lambda c: m_count(c, "crownPrinceDepositionCount")),
    ("personalCampaignCount", "親征回数", "人", "personalCampaignCount", lambda c: m_count(c, "personalCampaignCount")),
    ("rebellionSuppressionCount", "反乱鎮圧回数", "人", "rebellionSuppressionCount", lambda c: m_count(c, "rebellionSuppressionCount")),
    ("rebellionSufferedCount", "被反乱回数", "人", "rebellionSufferedCount", lambda c: m_count(c, "rebellionSufferedCount")),
    ("capitalRelocationCount", "遷都回数", "人", "capitalRelocationCount", lambda c: m_count(c, "capitalRelocationCount")),
    ("ages.birthDate", "生年月日", "人", "ages", lambda c: m_ages(c, "birthDate")),
    ("ages.deathDate", "没年月日", "人", "ages", lambda c: m_ages(c, "deathDate")),
    ("ages.accessionAge", "即位時年齢", "人", "ages", lambda c: m_ages(c, "accessionAge")),
    ("ages.deathAge", "没年齢", "人", "ages", lambda c: m_ages(c, "deathAge")),
    ("name.templeName", "廟号（Issue #126）", "人", None, lambda c: m_name(c, "templeName")),
    ("name.posthumousName", "諡号（短縮呼称・Issue #126）", "人", None, lambda c: m_name(c, "posthumousName")),
    # 2026-08-10 に諡号を2欄へ割った（Issue #37 単位1・後継は #126）。短縮呼称と全長形は**別の主張**で、
    # 唐のように原典が短縮形を与えない政権では前者が空のまま後者だけ入る。だから
    # 1行にまとめず両方を測る（合算すると「どちらか在れば埋まっている」に見えてしまう）
    ("name.posthumousNameFull", "諡号の全長形（Issue #126）", "人", None,
     lambda c: m_name(c, "posthumousNameFull")),
    # 2026-08-10 に諡号の段を足した（ユーザー決定「案B」）。スカラ2欄では加諡が
    # 積み上がる過程を保存できず、方針「Wikipedia 並み」の諡号欄を満たせなかった。
    # **不在確定は出ない** — 「段が1つしか無い」と「まだ読んでいない」は
    # regime-conventions では割れないので、全員が値あり／判別不能のどちらかに落ちる
    ("name.posthumousNames", "諡号の段（Issue #126）", "人", None,
     lambda c: m_name(c, "posthumousNames")),
    ("reigns.dynastyOrder", "第N代（Issue #24）", "在位", None, m_dynasty_order),
    ("profiles", "紹介文（Issue #16）", "人", None, m_profile),
    ("kinship.birthMother", "生母（kinship）", "人", None, m_mother),
]


def measure(ctx):
    out = []
    for fid, label, unit, phase, fn in FIELDS:
        cells = list(fn(ctx))
        c = collections.Counter(s for _, _, s in cells)
        out.append({
            "id": fid, "label": label, "unit": unit, "phase": phase,
            "cells": cells,
            "n": len(cells), "filled": c[FILLED], "absent": c[ABSENT], "unknown": c[UNKNOWN],
        })
    return out


def phase_status(ctx, key):
    if not key:
        return None
    return ((ctx.data.get("meta", {}).get("status", {}).get("phases", {}) or {})
            .get(key, {}).get("status"))


def pct(x, n):
    return 100.0 * x / n if n else 0.0


# --- 出力 --------------------------------------------------------------------

def render_block(ctx, rows):
    """PROJECT_STATUS.md へ埋める生成領域。**日付は入れない**（毎日 --check が落ちる）。"""
    ndone, n, u = headline(ctx, rows)
    out = []
    out.append(f"**完了と称している {ndone} 項目 {n} セルのうち、構造だけでは確定と読めないのが "
               f"{u} セル（{pct(u, n):.1f}%）。**")
    out.append("")
    out.append("この表は `python3 scripts/coverage.py --write` が生成します。手で書き換えないでください")
    out.append("（`--check` が実測とのずれで落ちます）。**「フィールドが在るか」ではなく「確定したか」**を数えており、")
    out.append("`判別不能` は構造だけでは確定と読めないセルです — 誤りではなく、**その項目の完了主張が機械では確かめられない**ことを表します。")
    out.append("")
    out.append("| 項目 | 単位 | 総数 | 値あり | 不在確定 | 判別不能 | 確定率 |")
    out.append("|------|------|-----:|------:|--------:|--------:|------:|")
    for r in rows:
        det = r["filled"] + r["absent"]
        out.append(f"| {r['label']} | {r['unit']} | {r['n']} | {r['filled']} | {r['absent']} "
                   f"| {r['unknown']} | {pct(det, r['n']):.1f}% |")
    out.append("")
    claimed = [r for r in rows if phase_status(ctx, r["phase"]) == "completed" and r["unknown"]]
    if claimed:
        out.append("**`meta.status.phases` が `completed` なのに判別不能セルが残っている項目**"
                   "（完了が誤りとは限らず、**構造からは確かめられない**という意味）:")
        out.append("")
        for r in claimed:
            out.append(f"- {r['label']}（`{r['id']}`） — 判別不能 {r['unknown']} / {r['n']}")
        out.append("")
    # 前後の空行は current_block() 側でも落とすので、ここで揃えておかないと
    # --write の直後に --check が落ちる
    return "\n".join(out).strip("\n")


def headline(ctx, rows):
    """完了と称している側だけを切り出す。全体の平均は未着手の項目に薄められる。"""
    done = [r for r in rows if phase_status(ctx, r["phase"]) == "completed"]
    n = sum(r["n"] for r in done)
    u = sum(r["unknown"] for r in done)
    return len(done), n, u


def print_report(ctx, rows, worst):
    ndone, n, u = headline(ctx, rows)
    print(f"完了と称している {ndone} 項目 {n} セルのうち、構造だけでは確定と読めないのが "
          f"**{u} セル（{pct(u, n):.1f}%）**")
    print()
    print("=== 項目別（データ本体からの実測。単位は人物または在位） ===")
    print(f"{'項目':<24} {'総数':>5} {'値あり':>6} {'不在確定':>8} {'判別不能':>8}  確定率")
    for r in rows:
        det = r["filled"] + r["absent"]
        print(f"{r['label']:<24} {r['n']:>5} {r['filled']:>6} {r['absent']:>8} "
              f"{r['unknown']:>8}  {pct(det, r['n']):5.1f}%")

    print()
    print("=== 完了と称している項目のうち、構造だけでは確定と読めないセル ===")
    claimed = [r for r in rows if phase_status(ctx, r["phase"]) == "completed" and r["unknown"]]
    if not claimed:
        print("  なし（12項目すべて構造から確定を読める）")
    else:
        for r in claimed:
            print(f"  {r['label']}（{r['id']}）: 判別不能 {r['unknown']} / {r['n']}"
                  f"  — `--field {r['id']}` で id を出す")
        print("  ※ 「誤っている」ではなく「**完了の主張が機械では確かめられない**」。"
              "確定の根拠が散文にしか無い項目がここへ出る")

    print()
    items, shown = worst
    print(f"=== 政権別ワースト（確定率の低い順・{len(shown)}/{len(items)}政権）===")
    print("  大きな政権が平均を持ち上げるので**昇順で見る**。欠陥密度は小政権側が高い")
    for rid, det, n in shown:
        reg = ctx.regimes.get(rid) or {}
        print(f"  {pct(det, n):5.1f}%  {reg.get('label') or reg.get('name') or rid:<12} "
              f"({rid}) 確定 {det}/{n} セル")
    if shown:
        edge = pct(shown[-1][1], shown[-1][2])
        same = sum(1 for _, d, n in items if abs(pct(d, n) - edge) < 0.05) - \
            sum(1 for _, d, n in shown if abs(pct(d, n) - edge) < 0.05)
        if same:
            print(f"  （{edge:.1f}% の政権が他に {same} 件。1人だけの政権が34件あるので"
                  f"同率が並ぶ — 順位ではなく**帯**として読む）")

    print()
    print("=== 判別不能セルが多い政権（次にどこを読むかはこちら）===")
    print("  率が低いのは1人の政権ばかりになるので、**手当ての量**はセル数で見る")
    for rid, det, n in sorted(items, key=lambda x: (-(x[2] - x[1]), x[0]))[:6]:
        reg = ctx.regimes.get(rid) or {}
        print(f"  {n - det:>4}セル  {reg.get('label') or reg.get('name') or rid:<12} "
              f"({rid}) 確定率 {pct(det, n):.1f}%")


def regime_worst(ctx, rows, limit=12):
    agg = collections.defaultdict(lambda: [0, 0])  # rid -> [確定, 総数]
    for r in rows:
        for _, rid, state in r["cells"]:
            agg[rid][1] += 1
            if state != UNKNOWN:
                agg[rid][0] += 1
    items = [(rid, d, n) for rid, (d, n) in agg.items()]
    # 同率のときはセル数の多い政権を先に出す（同じ率でも手当ての効きが違う）
    items.sort(key=lambda x: (x[1] / x[2] if x[2] else 0, -x[2], x[0]))
    return items, items[:limit]


def show_field(rows, fid):
    hit = [r for r in rows if r["id"] == fid]
    if not hit:
        print(f"そんな項目はありません: {fid}", file=sys.stderr)
        print("  " + " / ".join(r["id"] for r in rows), file=sys.stderr)
        return 2
    r = hit[0]
    ids = [s for s, _, st in r["cells"] if st == UNKNOWN]
    print(f"{r['label']}（{r['id']}）: 判別不能 {len(ids)} / {r['n']}")
    for i in ids:
        print(" ", i)
    return 0


def splice(text, block):
    if BEGIN not in text or END not in text:
        return None
    head, rest = text.split(BEGIN, 1)
    _, tail = rest.split(END, 1)
    return f"{head}{BEGIN}\n{block}\n{END}{tail}"


def current_block(text):
    if BEGIN not in text or END not in text:
        return None
    return text.split(BEGIN, 1)[1].split(END, 1)[0].strip("\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--field", help="この項目の判別不能セルの id を列挙する")
    ap.add_argument("--write", action="store_true", help="PROJECT_STATUS.md の生成領域を書き直す")
    ap.add_argument("--check", action="store_true", help="生成領域が実測とずれていたら落ちる")
    args = ap.parse_args()

    ctx = Ctx()
    rows = measure(ctx)

    if args.field:
        return show_field(rows, args.field)

    block = render_block(ctx, rows)

    if args.write or args.check:
        text = STATUS.read_text(encoding="utf-8")
        cur = current_block(text)
        if cur is None:
            print(f"{STATUS} に {BEGIN} … {END} の生成領域がありません", file=sys.stderr)
            return 1
        if args.write:
            new = splice(text, block)
            if new == text:
                print("PROJECT_STATUS.md の生成領域は実測と一致しています（変更なし）")
            else:
                STATUS.write_text(new, encoding="utf-8")
                print("PROJECT_STATUS.md の生成領域を実測で書き直しました")
            return 0
        if cur != block:
            print("PROJECT_STATUS.md の進捗表記が実測とずれています。"
                  "`python3 scripts/coverage.py --write` で引き直してください", file=sys.stderr)
            print("--- 記録 ---", file=sys.stderr)
            print(cur, file=sys.stderr)
            print("--- 実測 ---", file=sys.stderr)
            print(block, file=sys.stderr)
            return 1
        print("PROJECT_STATUS.md の進捗表記は実測と一致しています")
        return 0

    print_report(ctx, rows, regime_worst(ctx, rows))
    return 0


if __name__ == "__main__":
    sys.exit(main())
