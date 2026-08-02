#!/usr/bin/env python3
"""B-5（events の source.conversion リプレイ）の検出力を合成データで測る。

**この検査は当面 0 件のデータに掛かる** — `source.conversion` は 2026-08-03 新設の任意欄で、
既存の 2,000 件超の events には無い（R-NO-AUTOGEN のため遡及で埋められない）。だから
実データの「0 errors / B5=0」は、守れているのか何も見ていないのか区別できない。
ここで発火そのものを確かめる（`test_claim_field.py`・`test_conflicts_field.py` と同じ理由）。

    python3 scripts/test_event_conversion_gate.py
"""
import importlib.util
import io
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


VC = _load("vc", "verify_calendar.py")

try:
    import sxtwl
except ImportError:
    print("SKIP: sxtwl 未導入のため B-5 の検出力を測れません（pip install sxtwl）")
    sys.exit(0)

fails = []


def check(label, cond):
    print(("ok   " if cond else "FAIL ") + label)
    if not cond:
        fails.append(label)


def run(events, field="personalCampaignCount"):
    """合成レコード1件で verify_calendar の main を回し、B-5 のエラーだけ返す。"""
    VC.errors.clear()
    VC.warnings.clear()
    data = {"emperors": [{"id": "TEST", field: {"count": len(events), "events": events}}]}
    orig = VC.json.loads
    VC.json.loads = lambda _s, **_k: data
    buf, real = io.StringIO(), sys.stdout
    sys.stdout = buf  # 本体の WARN/ERROR 行でテスト出力が埋まるのを避ける
    try:
        VC.main()
    finally:
        sys.stdout = real
        VC.json.loads = orig
    return [e for e in VC.errors if e.startswith("[B5]")]


# --- 多数月の計算そのもの（Issue #56 で実測した値と突き合わせる） ---------------
check("多数月: 正統十四年七月 → 1449-08",
      VC.majority_month(sxtwl, 1449, 7, False) == (1449, 8))
check("多数月: 正統十四年八月 → 1449-09（七月と別の月になる＝土木の変の型）",
      VC.majority_month(sxtwl, 1449, 8, False) == (1449, 9))
check("多数月: 嘉定四年五月 → 1211-06（西夏襄宗の型）",
      VC.majority_month(sxtwl, 1211, 5, False) == (1211, 6))
check("多数月: 至元二十四年四月 → 1287-05（元世祖の被反乱の型）",
      VC.majority_month(sxtwl, 1287, 4, False) == (1287, 5))

# --- 発火: 旧暦の月番号を太陽暦の欄へ直書きした型 ------------------------------
bad = run([{"startDate": "1211-05", "endDate": "1211-05", "datePrecision": "month",
            "source": {"conversion": "西夏書事 嘉定四年夏五月。fromLunar(1211,5,1) の月。"}}])
check("発火: 旧暦五月なのに保存が 1211-05（多数月は 1211-06）", len(bad) == 1)

# --- 沈黙: 正しく多数月へ換算されている ----------------------------------------
good = run([{"startDate": "1211-06", "endDate": "1211-06", "datePrecision": "month",
             "source": {"conversion": "西夏書事 嘉定四年夏五月。fromLunar(1211,5,1) → 1211-06"}}])
check("沈黙: 保存が多数月 1211-06 なら通る", good == [])

# --- 沈黙: 起点と終期が別の旧暦月で、それぞれ別の多数月になる ------------------
ok2 = run([{"startDate": "1449-08", "endDate": "1449-09", "datePrecision": "month",
            "source": {"conversion": "明史 英宗前紀 七月甲午発京師 fromLunar(1449,7,1)、"
                                     "八月壬戌師潰 fromLunar(1449,8,1)"}}])
check("沈黙: 七月と八月が別の多数月に落ちていれば通る（土木の変）", ok2 == [])

# --- 発火: 起点＝終期に潰れている（訂正前の土木の変） --------------------------
bad2 = run([{"startDate": "1449-08", "endDate": "1449-08", "datePrecision": "month",
             "source": {"conversion": "明史 英宗前紀 七月甲午 fromLunar(1449,7,1)、"
                                      "八月壬戌 fromLunar(1449,8,1)"}}])
check("発火: 八月の主張があるのに保存が 1449-08 しかない", len(bad2) == 1)

# --- 日精度側も従来どおり見る ---------------------------------------------------
bad3 = run([{"startDate": "1261-12", "endDate": "1261-12-28", "datePrecision":
             {"start": "month", "end": "day"},
             "source": {"conversion": "元史 中統二年十二月甲午 fromLunar(1261,12,6)"}}])
check("発火: 日精度の再演結果 1261-12-29 が保存 1261-12-28 と合わない", len(bad3) == 1)
ok3 = run([{"startDate": "1261-12", "endDate": "1261-12-29", "datePrecision":
            {"start": "month", "end": "day"},
            "source": {"conversion": "元史 中統二年十二月甲午 fromLunar(1261,12,6)"}}])
check("沈黙: 日精度が一致すれば通る", ok3 == [])

# --- 被反乱にも掛かる（走査対象がフィールド横断であることの確認） ---------------
bad4 = run([{"startDate": "1287-04", "endDate": "1290", "datePrecision": "year",
             "source": {"conversion": "元史 至元二十四年夏四月 fromLunar(1287,4,1)"}}],
           field="rebellionSufferedCount")
check("発火: 被反乱でも旧暦四月の直書き 1287-04 を捕まえる", len(bad4) == 1)

print(f"\n{len(fails)} failures")
sys.exit(1 if fails else 0)
