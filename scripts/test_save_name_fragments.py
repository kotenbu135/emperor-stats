#!/usr/bin/env python3
"""断片のマージ（`scripts/save_name_fragments.py`）を合成断片で確かめる。

このスクリプトは **cp による上書きで前のブロックの読解が消える**のを止めるために
書いた。実データで 0 件のまま通っても「効いている」証拠にはならない（消えるのは
これから重なる人物なので）ので、4つの規約それぞれの発火をここで測る。
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


SF = load("sf_under_test", ROOT / "scripts" / "save_name_fragments.py")


def claim(cid, line=1, quote="架空の引用"):
    return {"cid": cid, "book": "架空書", "file": "_corpus_cache/t.txt",
            "line": line, "quote": quote}


def run(old, new, tag="block9"):
    """旧断片と新断片を置いて --apply で走らせ、保存後の断片と標準出力を返す。"""
    with tempfile.TemporaryDirectory() as d:
        src, dest = Path(d) / "claims", Path(d) / "frag"
        src.mkdir()
        dest.mkdir()
        (src / "t-emperor.json").write_text(json.dumps(new, ensure_ascii=False),
                                            encoding="utf-8")
        if old is not None:
            (dest / "t-emperor.json").write_text(json.dumps(old, ensure_ascii=False),
                                                 encoding="utf-8")
        orig = SF.DEST
        SF.DEST = dest
        import io
        import contextlib
        buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf):
                SF.main([str(src), "--tag", tag, "--apply"])
            saved = json.loads((dest / "t-emperor.json").read_text(encoding="utf-8"))
        finally:
            SF.DEST = orig
    return saved, buf.getvalue()


def field(frag, name):
    return next((f for f in frag["findings"] if f["field"] == name), None)


FAILED = []


def check(name, cond, detail=""):
    print(f"{'OK  ' if cond else 'NG  '}{name}{('  ' + detail) if detail and not cond else ''}")
    if not cond:
        FAILED.append(name)


# 規約1: 旧側にしか無い欄を持ち越す
old = {"id": "t-emperor", "claims": [claim("c1")],
       "findings": [{"field": "name.courtesyName", "value": "元吉", "basis": ["c1"]}]}
new = {"id": "t-emperor", "claims": [claim("c1", line=2, quote="別の引用")],
       "findings": [{"field": "name.templeName", "value": None, "verdict": "read-absent",
                     "basis": ["c1"]}]}
saved, out = run(old, new)
check("規約1: 旧側だけの欄が残る", field(saved, "name.courtesyName") is not None)
check("規約1: 新側の欄が足される", field(saved, "name.templeName") is not None)
check("規約1: 旧側の欄を上書きしない", field(saved, "name.courtesyName")["value"] == "元吉")

# 規約5（cid）: 衝突した新側の cid が付け替わり basis が追い替わる
check("cid の衝突を付け替える", {c["cid"] for c in saved["claims"]} == {"c1", "block9-c1"},
      str([c["cid"] for c in saved["claims"]]))
check("basis が付け替えに追随する",
      field(saved, "name.templeName")["basis"] == ["block9-c1"],
      str(field(saved, "name.templeName")["basis"]))

# 同じ引用は行を増やさず旧側の cid へ寄せる
new_same = {"id": "t-emperor", "claims": [claim("c9")],
            "findings": [{"field": "name.templeName", "value": None,
                          "verdict": "read-absent", "basis": ["c9"]}]}
saved2, _ = run(old, new_same)
check("同一の引用は claims を増やさない", len(saved2["claims"]) == 1, str(saved2["claims"]))
check("同一の引用へ寄せた basis が旧 cid を指す",
      field(saved2, "name.templeName")["basis"] == ["c1"])

# 規約2: 空配列は null ＋ read-absent へ
new_empty = {"id": "t-emperor", "claims": [claim("c1")],
             "findings": [{"field": "name.posthumousNames", "value": [], "basis": ["c1"]}]}
saved3, _ = run(None, new_empty)
f = field(saved3, "name.posthumousNames")
check("規約2: [] を null にする", f["value"] is None)
check("規約2: verdict を read-absent にする", f.get("verdict") == "read-absent")

# 規約2 の但し書き: verdict が既に在るなら勝手に上書きしない
new_empty_pending = {"id": "t-emperor", "claims": [claim("c1")],
                     "findings": [{"field": "name.posthumousNames", "value": [],
                                   "verdict": "pending", "basis": ["c1"]}]}
saved4, _ = run(None, new_empty_pending)
check("規約2: 既存の verdict は保つ",
      field(saved4, "name.posthumousNames").get("verdict") == "pending")

# 規約3: read-absent を pending へ後退させない
old_ra = {"id": "t-emperor", "claims": [claim("c1")],
          "findings": [{"field": "name.templeName", "value": None,
                        "verdict": "read-absent", "basis": ["c1"]}]}
new_pending = {"id": "t-emperor", "claims": [claim("c1")],
               "findings": [{"field": "name.templeName", "value": None,
                             "verdict": "pending", "basis": ["c1"]}]}
saved5, out5 = run(old_ra, new_pending)
check("規約3: read-absent が pending に戻らない",
      field(saved5, "name.templeName")["verdict"] == "read-absent")
check("規約3: 要判断として報告する", "要判断" in out5 and "pending" in out5)

# 規約4: 旧側の値を新側の空で消さない
old_val = {"id": "t-emperor", "claims": [claim("c1")],
           "findings": [{"field": "name.templeName", "value": "烈宗", "basis": ["c1"]}]}
new_null = {"id": "t-emperor", "claims": [claim("c1")],
            "findings": [{"field": "name.templeName", "value": None,
                          "verdict": "read-absent", "basis": ["c1"]}]}
saved6, out6 = run(old_val, new_null)
check("規約4: 旧側の値が残る", field(saved6, "name.templeName")["value"] == "烈宗")
check("規約4: 要判断として報告する", "要判断" in out6)

# 逆向き（旧が空・新に値）は新側を採る — 読み進めた結果なので通す
saved7, _ = run(new_null, old_val)
check("旧が空・新に値なら新を採る", field(saved7, "name.templeName")["value"] == "烈宗")

# 旧が無ければそのまま保存する
saved8, out8 = run(None, new_null)
check("旧が無ければ新規保存", field(saved8, "name.templeName")["verdict"] == "read-absent")
check("新規と報告する", "[新規]" in out8)

# noteLog は積む（前のブロックの経緯を消さない）
old_note = dict(old_ra, noteLog="ブロックAの経緯")
new_note = dict(new_pending, noteLog="ブロックBの経緯")
saved9, _ = run(old_note, new_note)
check("noteLog を積む",
      "ブロックAの経緯" in saved9["noteLog"] and "ブロックBの経緯" in saved9["noteLog"])

# conflicts は上書きせず重ねる（2026-08-17。素の代入だったため、元号名のブロックを
# 重ねたときに名前欄のブロックが記録した対立が唐の5断片で黙って消えた）
old_cf = dict(old_ra, conflicts=[{"field": "name.posthumousNames", "reason": "旧の採否",
                                  "alternatives": [{"value": "A"}]}])
new_cf = dict(new_pending, conflicts=[{"field": "eraChangeCount.events[0].eraName",
                                       "reason": "新の採否", "alternatives": [{"value": "B"}]}])
saved10, _ = run(old_cf, new_cf)
check("conflicts: 旧側の対立が残る",
      any(c["field"] == "name.posthumousNames" for c in saved10.get("conflicts") or []))
check("conflicts: 新側の対立も入る",
      any(c["field"].startswith("eraChangeCount") for c in saved10.get("conflicts") or []))

# **新側が空配列でも消さない**（元号名の断片は conflicts を持たないことが多い）
saved11, _ = run(old_cf, dict(new_pending, conflicts=[]))
check("conflicts: 新側が空でも旧を消さない", len(saved11.get("conflicts") or []) == 1)

# 同じ対立を2度重ねても増えない
saved12, _ = run(old_cf, dict(new_pending, conflicts=list(old_cf["conflicts"])))
check("conflicts: 同じ対立は重複しない", len(saved12.get("conflicts") or []) == 1)

print(f"\n{'失敗 ' + '・'.join(FAILED) if FAILED else 'すべて通りました'}")
raise SystemExit(1 if FAILED else 0)
