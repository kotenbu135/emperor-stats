#!/usr/bin/env python3
"""主張範囲のゲート4本の検出力を合成データで測る（Issue #69）。

見るのは:

- `check_event_date_format` の**深さの規則**（2026-08-03 に反転）
  … 深さは `datePrecision` を超えない／月日の深さを持てるのは**在位の境界年**だけ
- `check_event_date_archive`
  … 退避した月日（data/internal/event-date-archive.json）の鍵が実在の event を指し、
    **配布物の値がその接頭辞**になっていること
- `check_ages` の**深さの規則**（2026-08-03 に events から広げた）
  … `ages.birthDate`／`deathDate` の深さ ≤ `birthDatePrecision`／`deathDatePrecision`
- `check_dynasty_order`（同日・計画7節の3）
  … `dynastyOrderSurveyed: false` の政権は `reigns[].dynastyOrder` の**欄を持たない**（未調査）／
    `true` の政権は必ず持つ（値、または「歴代に数えない」の `null`）。
    **`null` の意味を1つに保つのがこのゲートの役目**で、欄を落としただけでは保証が残らない

**移行直後の実データは違反 0 件**なので、本番の「0 errors」は守れているのか何も
見ていないのかを区別できない（`test_event_ids.py` と同じ理由）。とくにスコープの
ゲートは「0 件を保つこと」自体が主張範囲の凍結なので、発火することを別に確かめる。

    python3 scripts/test_date_claim_scope.py
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


def emperor(events, reign=("1210-01-01", "1215-12-31")):
    """在位 1210〜1215 の合成レコード（境界年は 1210 と 1215）。"""
    return {"emperors": [{
        "id": "test-emperor",
        "reigns": [{"startDate": reign[0], "endDate": reign[1]}],
        "amnestyCount": {"count": len(events), "events": events},
    }]}


def run_format(events, **kw):
    VE.errors.clear()
    VE.check_event_date_format(emperor(events, **kw))
    return [e for e in VE.errors if e.startswith("[event-date]")]


def run_archive(events, archive):
    """アーカイブの中身を差し替えて check_event_date_archive を回す。"""
    VE.errors.clear()
    path = VE.ARCHIVE_PATH
    orig_read, orig_exists = type(path).read_text, type(path).exists
    payload = json.dumps({"events": archive}, ensure_ascii=False)
    type(path).exists = lambda self: (True if self.name == "event-date-archive.json"
                                      else orig_exists(self))
    type(path).read_text = lambda self, **kw: (
        payload if self.name == "event-date-archive.json" else orig_read(self, **kw))
    try:
        VE.check_event_date_archive(emperor(events))
    finally:
        type(path).read_text, type(path).exists = orig_read, orig_exists
    return [e for e in VE.errors if e.startswith("[event-archive]")]


ID = "test-emperor.amnestyCount.e001"

# --- 深さ＝主張（埋め草の廃止） ----------------------------------------------
check("年精度は年だけの値で通る",
      run_format([{"id": ID, "date": "1212", "datePrecision": "year"}]) == [])
check("年精度なのに日まで書いてあれば落ちる（埋め草）",
      any("深すぎる" in e for e in
          run_format([{"id": ID, "date": "1212-01-01", "datePrecision": "year"}])))
check("月精度なのに日まで書いてあれば落ちる",
      any("深すぎる" in e for e in
          run_format([{"id": ID, "date": "1210-05-07", "datePrecision": "month"}])))
check("精度より浅いのは通る（主張を弱める側は自由）",
      run_format([{"id": ID, "date": "1212", "datePrecision": "day"}]) == [])

# --- 主張範囲（境界年の外に月日を置かない） ----------------------------------
check("境界年の月日は通る（在位開始年）",
      run_format([{"id": ID, "date": "1210-05-07", "datePrecision": "day"}]) == [])
check("境界年の月日は通る（在位終了年）",
      run_format([{"id": ID, "date": "1215-05-07", "datePrecision": "day"}]) == [])
check("境界年でない年の月日は落ちる",
      any("境界年でない" in e for e in
          run_format([{"id": ID, "date": "1212-05-07", "datePrecision": "day"}])))
check("境界年でない年でも年精度なら通る",
      run_format([{"id": ID, "date": "1212", "datePrecision": "day"}]) == [])
check("片端が境界年なら event 全体が境界年（年をまたぐ event を割らない）",
      run_format([{"id": ID, "startDate": "1215-11", "endDate": "1216-02",
                   "datePrecision": "month"}]) == [])
check("在位日付を1つも持たない人物では月日を主張できない（境界年が空）",
      any("境界年でない" in e for e in
          run_format([{"id": ID, "date": "1212-05-07", "datePrecision": "day"}],
                     reign=(None, None))))

# 歴史年だけを持つ人物（BCE で天文年と1年ずれる側）
VE.errors.clear()
VE.check_event_date_format({"emperors": [{
    "id": "test-bce", "reigns": [{"startYear": -210, "endYear": -207}],
    "amnestyCount": {"count": 1, "events": [
        {"id": "test-bce.amnestyCount.e001", "date": "-0207-05-07", "datePrecision": "day"}]},
}]})
check("startYear/endYear（歴史年）だけでも境界年として効く",
      [e for e in VE.errors if e.startswith("[event-date]")] == [])

# --- アーカイブとの対応 -------------------------------------------------------
OK_EV = [{"id": ID, "date": "1212", "datePrecision": "day"}]
check("退避した月日の接頭辞が現在値なら通る",
      run_archive(OK_EV, {ID: {"date": "1212-05-07"}}) == [])
check("鍵が実在しない event を指していれば落ちる",
      any("実在の event を指していません" in e for e in
          run_archive(OK_EV, {"test-emperor.amnestyCount.e099": {"date": "1212-05-07"}})))
check("現在値が退避値の接頭辞でなければ落ちる（配布物だけ後から動いた）",
      any("接頭辞になっていません" in e for e in
          run_archive([{"id": ID, "date": "1213"}], {ID: {"date": "1212-05-07"}})))
check("退避値が現在値より細かくなければ落ちる（退避する必要が無かった値）",
      any("細かくありません" in e for e in
          run_archive([{"id": ID, "date": "1212"}], {ID: {"date": "1212"}})))
check("配布物側に値が無ければ落ちる",
      any("値がありません" in e for e in
          run_archive([{"id": ID}], {ID: {"date": "1212-05-07"}})))


# --- ages の深さ＝主張（7節の3・埋め草の廃止を events から ages へ広げた） -----
def run_ages(ages):
    VE.errors.clear()
    VE.check_ages({"emperors": [{"id": "test-emperor", "ages": ages, "reigns": []}]})
    return [e for e in VE.errors if "深すぎる" in e]


check("ages: 年精度は年だけの値で通る",
      run_ages({"birthDate": "1212", "birthDatePrecision": "year"}) == [])
check("ages: 年精度なのに日まで書いてあれば落ちる（埋め草）",
      run_ages({"birthDate": "1212-01-01", "birthDatePrecision": "year"}) != [])
check("ages: 月精度なのに日まで書いてあれば落ちる",
      run_ages({"deathDate": "1212-05-07", "deathDatePrecision": "month"}) != [])
check("ages: 精度より浅いのは通る",
      run_ages({"deathDate": "1212", "deathDatePrecision": "day"}) == [])
check("ages: precision が無ければ深さは検査しない（判定できない）",
      run_ages({"birthDate": "1212-05-07"}) == [])

# --- dynastyOrder の欄の在り方（未調査は欄を持たない） -------------------------
def run_dynasty(regime_surveyed, reign):
    VE.errors.clear()
    VE.check_dynasty_order({
        "meta": {"catalogs": {"regimes": [
            {"id": "test-regime", "dynastyOrderSurveyed": regime_surveyed}]}},
        "emperors": [{"id": "test-emperor", "regimeId": "test-regime", "reigns": [reign]}],
    })
    return [e for e in VE.errors if e.startswith("[dynasty-order]")]


check("dynastyOrder: 未調査の政権は欄が無いのが正しい",
      run_dynasty(False, {"startYear": 1210}) == [])
check("dynastyOrder: 未調査の政権に null の欄が残っていれば落ちる",
      any("欄が在る" in e for e in run_dynasty(False, {"dynastyOrder": None})))
check("dynastyOrder: 未調査の政権に値が入っていても落ちる",
      any("欄が在る" in e for e in run_dynasty(False, {"dynastyOrder": 3})))
check("dynastyOrder: 調査済みの政権は値でも null でも通る（null＝歴代に数えない）",
      run_dynasty(True, {"dynastyOrder": 3}) == []
      and run_dynasty(True, {"dynastyOrder": None}) == [])
check("dynastyOrder: 調査済みの政権で欄が無ければ落ちる（書き忘れと該当なしを分ける）",
      any("欄が無い" in e for e in run_dynasty(True, {"startYear": 1210})))

print()
if fails:
    print(f"{len(fails)} 件 FAIL: " + " / ".join(fails))
    sys.exit(1)
print("すべて ok")
