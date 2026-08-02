#!/usr/bin/env python3
"""`events[].id` のゲート（validate_emperors.check_event_ids）の検出力を合成データで測る。

**実データは全件が正しい id を持っているので、本番の「0 errors」は守れているのか
何も見ていないのかを区別できない**（`test_claim_field.py`・`test_conflicts_field.py`・
`test_event_conversion_gate.py` と同じ理由）。

id 特有の危険はここ: **焼いた直後は `eNNN` の連番と配列添字が1ずれで対応する**ので、
「id は添字から作り直せる」と誤解したコードを書いても全部のテストが通ってしまい、
event を1件挿入した瞬間に黙って番号が振り直されて、外部からの参照が別の event を指す。
だから「形」だけでなく **重複** と **外部参照が解決すること** を発火させて確かめる。

    python3 scripts/test_event_ids.py
"""
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


VE = _load("ve", "validate_emperors.py")

fails = []


def check(label, cond):
    print(("ok   " if cond else "FAIL ") + label)
    if not cond:
        fails.append(label)


def run(events, screenings=None, field="amnestyCount", emperor="test-emperor"):
    """合成レコード1件で check_event_ids を回し、[event-id] のエラーだけ返す。"""
    VE.errors.clear()
    data = {"emperors": [{"id": emperor, field: {"count": len(events), "events": events}}]}
    path = ROOT / "data" / "screenings.json"
    orig_read, orig_exists = type(path).read_text, type(path).exists
    if screenings is not None:
        payload = json.dumps({"screenings": [
            {"buckets": [{"audit": {"findings": [{"id": r} for r in screenings]}}]}]})
        type(path).read_text = lambda self, **kw: (
            payload if self.name == "screenings.json" else orig_read(self, **kw))
    try:
        VE.check_event_ids(data)
    finally:
        type(path).read_text = orig_read
        type(path).exists = orig_exists
    return [e for e in VE.errors if e.startswith("[event-id]")]


OK = {"id": "test-emperor.amnestyCount.e001", "date": "0100-01-01"}
OK2 = {"id": "test-emperor.amnestyCount.e002", "date": "0101-01-01"}

# --- 正しい形は通る -----------------------------------------------------------
check("正しい id の2件は通る", run([OK, OK2], screenings=[]) == [])

# --- 欠落・形の誤り -----------------------------------------------------------
check("id が無い event を拾う",
      any("id の無い event" in e for e in run([{"date": "0100-01-01"}], screenings=[])))
check("形の違う id を拾う（添字そのまま）",
      any("形が違います" in e for e in run([{"id": "test-emperor.amnestyCount.0"}], screenings=[])))
check("所在と食い違う id を拾う（容器名が別）",
      any("所在と食い違います" in e
          for e in run([{"id": "test-emperor.eraChangeCount.e001"}], screenings=[])))
check("所在と食い違う id を拾う（皇帝が別）",
      any("所在と食い違います" in e
          for e in run([{"id": "other-emperor.amnestyCount.e001"}], screenings=[])))

# --- 重複（「添字から作り直す」で最も出やすい壊れ方） --------------------------
check("同じ id が2つあれば落ちる",
      any("重複" in e for e in run([OK, dict(OK)], screenings=[])))

# --- 外部参照の解決（id を置いた目的そのもの） --------------------------------
check("screenings の参照が解決すれば通る",
      run([OK], screenings=["test-emperor.amnestyCount.e001.date"]) == [])
check("解決しない参照を拾う",
      any("解決しません" in e
          for e in run([OK], screenings=["test-emperor.amnestyCount.e099.date"])))
check("日付キーの付かない参照も解決する",
      run([OK], screenings=["test-emperor.amnestyCount.e001"]) == [])
check("人物 id の参照（person-field 単位の絞り込み）は event 参照として見ない",
      run([OK], screenings=["test-emperor"]) == [])

print()
if fails:
    print(f"{len(fails)} 件 FAIL: " + " / ".join(fails))
    sys.exit(1)
print("すべて ok")
