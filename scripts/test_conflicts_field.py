#!/usr/bin/env python3
"""conflicts 欄の検査（validate_emperors.py の check_conflicts）を、合成レコードで確かめる。

**この検査は当面 0 件のデータに掛かる**（conflicts は任意で、既存 note に遡及しないため）。
0 エラーが「守れている」なのか「そもそも何も見ていない」なのかを、実データでは
区別できない。だからここで検出力そのものを測る（`test_claim_field.py` と同じ理由）。

引用の抽出（`verify_quotes.py` が conflicts の quote を拾うか）もここで見る。
拾えていないと、対立値の原文が照合台帳を素通りする。
"""
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


V = _load("v", "validate_emperors.py")
Q = _load("q", "verify_quotes.py")


def run(record):
    V.errors.clear()
    V.warnings.clear()
    V.infos.clear()
    V.check_conflicts({"emperors": [dict(record, id="t")]})
    return list(V.errors), list(V.infos)


# 李班（chenghan-liban）の 47歳／38歳。引用は底本の字体のまま（时・为）。
GOOD = {
    "field": "deathAge",
    "adopted": {"value": 47, "source": {"page": "晋書 載記第二十一"},
                "quote": "时年四十七，在位一年"},
    "alternatives": [
        {"value": 38, "source": {"page": "華陽国志 巻九"}, "quote": "年二十六，立为太子",
         "note": "永昌元年（322年）の太子冊立を年二十六とするため崩御時は数え38歳（逆算値）"}],
    "reason": "晋書載記と十六国春秋がともに「时年四十七」と直接記す。38は逆算で直接記載ではない",
}


def variant(**over):
    c = {k: (v.copy() if isinstance(v, dict) else v) for k, v in GOOD.items()}
    c.update(over)
    return {"ages": {"deathAge": 47, "conflicts": [c]}}


CASES = [
    ("正しい形は通る", {"ages": {"deathAge": 47, "conflicts": [GOOD]}}, 0),
    ("空配列（確認して対立なし）は通る", {"ages": {"deathAge": 47, "conflicts": []}}, 0),
    ("キーが無い（未確認）は何も言わない", {"ages": {"deathAge": 47}}, 0),
    ("field が同じコンテナに無ければ落ちる", variant(field="deathAgeX"), 1),
    ("reason が空なら落ちる", variant(reason="  "), 1),
    ("adopted に source が無ければ落ちる",
     variant(adopted={"value": 47, "quote": "时年四十七"}), 1),
    # 採用値だけを 38 にすると alternatives の 38 と同値になって2件出るので、対立値もずらす
    ("adopted.value が実フィールドと食い違えば落ちる",
     variant(adopted={"value": 38, "source": {"page": "華陽国志 巻九"}},
             alternatives=[{"value": 47, "source": {"page": "晋書 載記第二十一"}}]), 1),
    ("alternatives が空なら落ちる（対立が無いなら要素を作らない）",
     variant(alternatives=[]), 1),
    ("対立値に source が無ければ落ちる",
     variant(alternatives=[{"value": 38}]), 1),
    ("対立値が採用値と同じなら落ちる",
     variant(alternatives=[{"value": 47, "source": {"page": "華陽国志 巻九"}}]), 1),
    ("conflicts が配列でなければ落ちる", {"ages": {"deathAge": 47, "conflicts": "なし"}}, 1),
    ("events[] の中に置いても見る",
     {"amnestyCount": {"count": 1, "events": [
         {"date": "0334-01-01", "conflicts": [
             {"field": "date", "adopted": {"value": "0334-01-01"},
              "alternatives": [{"value": "0334-02-01", "source": {"page": "資治通鑑"}}],
              "reason": "本紀を採る"}]}]}}, 1),  # adopted に source が無いぶんの1件
]

bad = 0
for name, record, want in CASES:
    errs, infos = run(record)
    ok = len(errs) == want
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {name}  ({len(errs)}件 / want {want})")
    if not ok:
        for e in errs:
            print(f"       {e[:140]}")

# 分母（評価件数）そのものが出ているか。出ていないと 0 エラーの意味が読めない
errs, infos = run({"ages": {"deathAge": 47, "conflicts": []}})
ok = any("1 件を評価" in i for i in infos)
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 評価件数（分母）を出す")

# 引用が照合台帳の対象になるか（拾えていないと規約が掛からない場所ができる）
rec = dict({"ages": {"deathAge": 47, "conflicts": [GOOD]}}, id="t")
units = Q.conflict_units(rec, "t")
paths = {p for _, p, _ in units}
want_paths = {"ages.conflicts[0].adopted.quote", "ages.conflicts[0].alternatives[0].quote"}
ok = want_paths <= paths
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} quote を照合台帳の抽出対象に含める（{len(units)}件）")

# --check-books が「名乗る書」を読めるか（読めないと書名の整合を問えない）
named = Q.source_text(rec, "ages.conflicts[0].alternatives[0].quote") or ""
ok = "華陽国志" in named
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 名乗る書を source.page から読む（{named[:30]!r}）")

print(f"\n{'全件一致' if not bad else str(bad) + '件 不一致'} / {len(CASES) + 3}件")
sys.exit(1 if bad else 0)
