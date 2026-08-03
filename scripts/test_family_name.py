#!/usr/bin/env python3
"""姓 familyName の検査を、合成レコードで確かめる（Issue #37 単位6・2026-08-03）。

移行が終われば**実データには違反が1件も無い**（365人ぜんぶ分けたところで打ち止め）ので、
本番の「0 errors」はゲートが効いていることの証拠にならない。ここで検出力そのものを測る
（SCHEMA_CHANGE_CHECKLIST.md 手順4）。

測るゲート:

  A 形            漢字1〜4字か null・諱は非空で姓を含まない
  B 分割の同一性   凍結標本へ連結して戻る（**字を落とす形を落とす唯一の検査**）
  C null の所在    姓なしは宣言済み政権だけ・その政権に姓が入っていない
  D 政権内の一貫性 同じ政権の姓は1種類（宣言済みの5政権を除く）
  E 底本          verify_quotes.py::family_name_hit（「姓〈姓〉氏」「讳〈諱〉」）

**D の限界も測る** — 政権まるごと同じ誤り方（複姓を全員1字で切る）は D では落ちない。
落ちないことを測っておかないと、D を悉皆の検出器と読み違える。
"""
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


V = _load("v", ROOT / "scripts" / "validate_emperors.py")
Q = _load("q", ROOT / "scripts" / "verify_quotes.py")
from hanzi_norm import norm_for_match  # noqa: E402


def rec(eid, regime, family, given, ethnic=None):
    name = {"familyName": family, "personalName": given}
    if ethnic:
        name["ethnicName"] = ethnic
    return {"id": eid, "regimeId": regime, "name": name}


def run(records, originals=None):
    V.errors.clear()
    V.warnings.clear()
    V.infos.clear()
    # 凍結標本は**必ず差し替える**（実ファイルを読ませない）。既定は空で、
    # B を測るケースだけが自分の標本を渡す — 実データを読むと、B を測っていない
    # ケースまで実ファイルの値と突き合わさって件数がずれる。
    import json
    import tempfile
    saved = V.FAMILY_ORIGINALS_PATH
    tmp = Path(tempfile.mkdtemp()) / "originals.json"
    tmp.write_text(json.dumps({"records": originals or {}}, ensure_ascii=False),
                   encoding="utf-8")
    V.FAMILY_ORIGINALS_PATH = tmp
    try:
        V.check_family_names({"emperors": records})
    finally:
        V.FAMILY_ORIGINALS_PATH = saved
    return list(V.errors)


CASES = [
    # 正しい形
    ("正しい分割は通る（漢＝劉）",
     [rec("han-wudi", "western-han", "劉", "徹")], None, 0),
    ("複姓も通る（西晋＝司馬）",
     [rec("jin-wudi", "western-jin", "司馬", "炎")], None, 0),
    ("姓を持たない形（元＝モンゴル語名の漢字音写）は通る",
     [rec("yuan-shizu", "yuan", None, "忽必烈",
          ethnic={"kind": "mongol", "value": "クビライ"})], None, 0),
    # A 形
    ("諱が空だと落ちる",
     [rec("han-wudi", "western-han", "劉", "")], None, 1),
    ("姓が5字以上だと落ちる",
     [rec("qing-dezong", "qing", "愛新覚羅氏一", "載湉")], None, 1),
    # 形で落ちた時点で C（null の所在）までは見に行かない — 1件で止まる
    ("姓に漢字以外が混じると落ちる",
     [rec("yuan-shizu", "yuan", "クビライ", "忽必烈")], None, 1),
    ("**諱の側に姓が残っていると落ちる**（分けたつもりで写しただけの形）",
     [rec("han-wudi", "western-han", "劉", "劉徹")], None, 1),
    # B 分割の同一性
    ("連結すると移行前の値に戻る形は通る",
     [rec("han-wudi", "western-han", "劉", "徹")],
     {"han-wudi": {"personalName": "劉徹"}}, 0),
    ("**字を落とすと落ちる**（「劉弗陵」→ 姓 劉／諱 弗 の形）",
     [rec("han-zhaodi", "western-han", "劉", "弗")],
     {"han-zhaodi": {"personalName": "劉弗陵"}}, 1),
    ("姓と諱を入れ替えると落ちる",
     [rec("han-wudi", "western-han", "徹", "劉")],
     {"han-wudi": {"personalName": "劉徹"}}, 1),
    ("複姓を1字で切ると落ちる（司馬炎 → 姓 司／諱 馬炎 は連結では戻るので B では落ちない）",
     [rec("jin-wudi", "western-jin", "司", "馬炎")],
     {"jin-wudi": {"personalName": "司馬炎"}}, 0),
    # C null の所在
    ("宣言していない政権で姓を null にすると落ちる",
     [rec("han-wudi", "western-han", None, "徹")], None, 1),
    ("姓なしの政権に姓が入っていると落ちる",
     [rec("yuan-shizu", "yuan", "忽", "必烈")], None, 1),
    # D 政権内の一貫性 **誤分割の主力**
    ("同じ政権で姓が割れると落ちる（唐の1人だけ切れ目を1字ずらした形）",
     [rec("tang-taizong", "tang", "李世", "民"),
      rec("tang-gaozong", "tang", "李", "治")], None, 1),
    ("宣言済みの政権（後周 郭/柴）は割れていても通る",
     [rec("zhou-taizu", "later-zhou", "郭", "威"),
      rec("zhou-shizong", "later-zhou", "柴", "栄")], None, 0),
]

bad = 0
for label, records, originals, want in CASES:
    errs = run(records, originals)
    ok = len(errs) == want
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {label}  ({len(errs)}件 / want {want})")
    if not ok:
        for e in errs:
            print(f"       {e[:160]}")

# D の限界。**政権まるごと同じ誤り方は落ちない** — 落ちないことを測っておく
# （測らないと D を悉皆の検出器と読み違える。ここは絞り込みの ambiguous が受け持つ）。
errs = run([rec("jin-wudi", "western-jin", "司", "馬炎"),
            rec("jin-huidi", "western-jin", "司", "馬衷")])
ok = len(errs) == 0
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} **D の限界**: 政権まるごと1字で切ると落ちない（0件 / want 0）")

# 分母（評価件数）が出ているか。出ていないと 0 エラーの意味が読めない
run([rec("han-wudi", "western-han", "劉", "徹")])
ok = any("familyName を持つ人物 1人" in i for i in V.infos)
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 評価件数（分母）を出す")

# --- E 底本（「姓〈姓〉氏」「讳〈諱〉」）---------------------------------------
# 遼史 太祖紀の書き出し。姓と諱が同じ1行に並ぶ形。
HAY = norm_for_match(
    "太祖大聖大明神烈天皇帝，姓耶律氏，諱億，字阿保機，小字啜里只，德祖皇帝之長子。")
E_CASES = [
    ("姓と諱の両方が当たる（耶律／億）", "耶律", "億", True, True),
    ("複姓を1字で切ると姓が当たらない（耶／律億）", "耶", "律億", False, False),
    ("諱だけ当たる形もある（姓を書かない書）", "蕭", "億", False, True),
]
for label, family, given, want_x, want_h in E_CASES:
    hit_x, hit_h = Q.family_name_hit(HAY, family, given)
    ok = (hit_x, hit_h) == (want_x, want_h)
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {label}  (姓 {hit_x}/{want_x}・諱 {hit_h}/{want_h})")

print("---")
print(f"{bad} NG")
sys.exit(1 if bad else 0)
