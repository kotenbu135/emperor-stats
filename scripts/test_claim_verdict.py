#!/usr/bin/env python3
"""空の主張（`value: null`）の `verdict` を、合成断片で確かめる。

この欄は **fail-closed** に設計してある —— `verdict` が無い主張は
coverage.py が不在確定に数えず、check_claims.py が落とす。実データでは
2026-08-11 の後追いで全件に付いているので、**実データの 0 エラーは
「検査が効いている」証拠にならない**（付け忘れが出るのはこれから書く断片）。
だから発火そのものをここで測る。

- 過大報告（読んでいないセルを不在確定に数える）が**起きない**こと
- 判断待ち（`verdict: "pending"`）を不在確定に数え**ない**こと
"""
import importlib.util
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


COV = load("cov_under_test", ROOT / "scripts" / "coverage.py")
CC = load("cc_under_test", ROOT / "scripts" / "check_claims.py")


def fragment(finding):
    return {
        "id": "t-emperor",
        "claims": [{"cid": "c1", "book": "架空書", "file": "_corpus_cache/t.txt",
                    "line": 1, "quote": "架空の引用"}],
        "findings": [dict({"basis": ["c1"], "confidence": "high"}, **finding)],
        "discrepancies": "なし",
    }


def counted(finding):
    """coverage.py の読解結果ローダが、この主張を不在確定として拾うか。"""
    with tempfile.TemporaryDirectory() as d:
        p = Path(d)
        (p / "t-emperor.json").write_text(
            json.dumps(fragment(finding), ensure_ascii=False), encoding="utf-8")
        orig = COV.FRAGMENTS
        COV.FRAGMENTS = p
        try:
            # self を見ないメソッドなので、emperors.json を読まずに単体で呼べる
            cells = COV.Ctx._read_absent_cells(object())
        finally:
            COV.FRAGMENTS = orig
    return ("t-emperor", "templeName") in cells


def outscoped(finding):
    """coverage.py の打ち切りローダが、この主張を対象外として拾うか。

    **不在確定と同じバケツに落ちないこと**を測るために別で見る（落ちると
    「読んだうえで空」を読んでいないセルに主張してしまう）。
    """
    with tempfile.TemporaryDirectory() as d:
        p = Path(d)
        (p / "t-emperor.json").write_text(
            json.dumps(fragment(finding), ensure_ascii=False), encoding="utf-8")
        orig = COV.FRAGMENTS
        COV.FRAGMENTS = p
        try:
            cells = COV.Ctx._out_of_scope_cells(object())
        finally:
            COV.FRAGMENTS = orig
    return ("t-emperor", "templeName") in cells


def gate_errors(finding):
    """check_claims.py が verdict について出すエラーの数（引用側の指摘は数えない）。"""
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "t-emperor.json"
        p.write_text(json.dumps(fragment(finding), ensure_ascii=False), encoding="utf-8")
        errors, reports = [], []
        counters = {"checked": 0, "unresolved": 0, "glyph": 0, "spliced": 0,
                    "line_off": 0, "findings": 0, "conflicts": 0, "suggestions": 0,
                    "out_of_scope": 0}
        try:
            CC.check_one(p, errors, reports, counters)
        except Exception as e:      # コーパス不在で引用照合が落ちても verdict は測れる
            errors.append(f"(引用照合が実行できず: {e})")
    return [e for e in errors if "verdict" in e or "pending" in e]


CASES = [
    # (名前, finding, coverage が不在確定に数えるか, ゲートのエラー件数, 対象外に数えるか)
    ("読んで無いと決めた主張は数える",
     {"field": "name.templeName", "value": None, "verdict": "read-absent"}, True, 0),
    ("verdict の付け忘れは数えない（過小報告に落ちる）",
     {"field": "name.templeName", "value": None}, False, 1),
    ("判断待ちは数えない",
     {"field": "name.templeName", "value": None, "verdict": "pending"}, False, 0),
    ("知らない verdict は数えないし落ちる",
     {"field": "name.templeName", "value": None, "verdict": "absent"}, False, 1),
    ("廃止した pending 旗は落ちる（fail-open へ戻さない）",
     {"field": "name.templeName", "value": None, "pending": True, "verdict": "pending"}, False, 1),
    ("値のある主張に verdict は要らない",
     {"field": "name.templeName", "value": "太宗"}, False, 0),
    ("name 以外の空の主張は名前欄に数えない",
     {"field": "ages.birthDate", "value": None, "verdict": "read-absent"}, False, 0),
    # 2026-08-16 に足した4つ目の状態。**不在確定と混ざらないこと**が要点で、
    # 混ざると読んでいないセルに「読んだうえで空」を主張することになる
    ("打ち切りは不在確定に数えず、対象外として拾う",
     {"field": "name.templeName", "value": None, "verdict": "out-of-scope",
      "reason": "2026-08-16 のユーザー決定。コーパスに書が無い"}, False, 0, True),
    ("理由の無い打ち切りは落ちる（率の分母から外れるので言い値にしない）",
     {"field": "name.templeName", "value": None, "verdict": "out-of-scope"}, False, 1, True),
    ("日付の無い理由も落ちる（いつ誰が打ち切ったかへ遡れる形を要る）",
     {"field": "name.templeName", "value": None, "verdict": "out-of-scope",
      "reason": "コーパスに書が無い"}, False, 1, True),
    ("読んで無いと決めた主張は対象外には数えない",
     {"field": "name.templeName", "value": None, "verdict": "read-absent"}, True, 0, False),
]

bad = 0
for case in CASES:
    name, finding, want_counted, want_errors = case[:4]
    want_outscope = case[4] if len(case) > 4 else False
    got_counted = counted(finding)
    got_outscope = outscoped(finding)
    errs = gate_errors(finding)
    ok = (got_counted == want_counted and len(errs) == want_errors
          and got_outscope == want_outscope)
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {name}  "
          f"(数える {got_counted} / want {want_counted}・エラー {len(errs)} / want {want_errors}"
          f"・対象外 {got_outscope} / want {want_outscope})")
    if not ok:
        for e in errs:
            print(f"       {e[:160]}")

print(f"\n{'全件一致' if not bad else str(bad) + '件 不一致'} / {len(CASES)}件")
sys.exit(1 if bad else 0)
