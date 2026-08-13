#!/usr/bin/env python3
"""諡号の段 posthumousNames の検査を、合成レコードで確かめる（Issue #37・2026-08-10）。

**この欄は 365人のうち6人にしか無い**（着手時点で唐の高祖・太宗・高宗・中宗・睿宗・文宗）。
本番の「0 errors」が「守れている」なのか「そもそも何も見ていない」なのかを実データでは
区別できないので、ここで検出力そのものを測る（SCHEMA_CHANGE_CHECKLIST.md 手順4）。

測るのは5つのゲート:

  A 形            validate_emperors.py::check_posthumous_names（漢字2〜30字・「皇帝」「大帝」で結ぶ）
  B 廟号の混入     同上（「〈廟号〉〈諡〉」を行ごと写した形を落とす）
  C 列の形        同上（段の重複なし・年が並び順に対して逆行しない）
  D 冒頭形との関係  同上（posthumousNameFull が段のどれかと一致する。例外は理由つきの表だけ）
  F 底本          verify_quotes.py::posthumous_full_hit（各段が本人の原文に在るか）

**C の年がこの欄の主眼。** この欄が既存の2欄に足しているのは「順序」だけなので、
順序が壊れていても落ちないなら、欄を足した意味そのものが無い。

**D は「一致しない人物を黙って通さない」ための表。** 舊唐書は高宗の崩御条を
「天皇大弘孝皇帝」、冒頭を「天皇大聖大弘孝皇帝」と書いており、書の内部差として実在する。
表に理由を書かせることで、**転記ミスと書の内部差を人が区別した証拠**が残る。

**F は段ごとに数える。** 人物単位で数えると3段のうち1段が捏造でも「当たった人物」に
入ってしまい、この欄でいちばん危ない失敗（在りもしない段を並べる）が見えない。
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


def run(records):
    V.errors.clear()
    V.warnings.clear()
    V.infos.clear()
    V.check_posthumous_names({"emperors": records})
    return list(V.errors)


def rec(eid, stages, full=None, temple=None):
    name = {"posthumousNames": stages}
    if full:
        name["posthumousNameFull"] = full
    if temple:
        name["templeName"] = temple
    return {"id": eid, "name": name}


CASES = []


def case(label, records, want_error):
    CASES.append((label, records, want_error))


# --- A 形 --------------------------------------------------------------------
case("A 正しい3段（唐太宗の実形）",
     [rec("t", [{"form": "文皇帝"},
                {"form": "文武聖皇帝", "year": 674},
                {"form": "文武大聖大広孝皇帝", "year": 754}],
          full="文武大聖大広孝皇帝", temple="太宗")], False)
case("A 「皇帝」でも「大帝」でも終わらない段",
     [rec("t", [{"form": "文武聖"}])], True)
case("A 原文の定型を写し込んだ段（谥曰）",
     [rec("t", [{"form": "谥曰文皇帝"}])], True)
case("A 高宗の「天皇大帝」は通る（大帝で終わる形は実在する）",
     [rec("t", [{"form": "天皇大帝"}])], False)

# --- B 廟号の混入 -------------------------------------------------------------
case("B 段が廟号で始まる（「〈廟号〉〈諡〉」を行ごと写した形）",
     [rec("t", [{"form": "太宗文武大聖大広孝皇帝"}], temple="太宗")], True)

# --- C 列の形 ----------------------------------------------------------------
case("C 同じ段が2回",
     [rec("t", [{"form": "文皇帝"}, {"form": "文皇帝"}])], True)
case("C 表に理由がある人物は同じ段が2回でも通る（北齊 文宣帝＝諡を戻した政変）",
     [rec("beiqi-wenxuandi", [{"form": "文宣皇帝", "year": 560},
                              {"form": "景烈皇帝", "year": 565},
                              {"form": "文宣皇帝", "year": 570}],
          full="文宣皇帝", temple="顕祖")], False)
case("C 重複が無いのに表へ挙がっている（免除の腐り止め）",
     [rec("beiqi-wenxuandi", [{"form": "文宣皇帝", "year": 560}],
          full="文宣皇帝", temple="顕祖")], True)
case("C 年が並び順に対して逆行（この欄が足しているのは順序だけなので、ここが要）",
     [rec("t", [{"form": "文武大聖大広孝皇帝", "year": 754},
                {"form": "文武聖皇帝", "year": 674}])], True)
case("C 年が無い段が混ざるのは通る（初諡は条が年を名乗らない）",
     [rec("t", [{"form": "文皇帝"}, {"form": "文武聖皇帝", "year": 674}])], False)
case("C 空の配列",
     [rec("t", [])], True)
case("C 未知のキー（source を持たせようとした形）",
     [rec("t", [{"form": "文皇帝", "source": {"page": "旧唐書 巻三"}}])], True)

# --- D 冒頭形との関係 ---------------------------------------------------------
case("D 冒頭形が段のどれとも一致しない（表に無い人物）",
     [rec("t", [{"form": "文皇帝"}], full="別人の全長諡皇帝")], True)
case("D 表に理由がある人物は通る（舊唐書 懿宗の書の内部差）",
     [rec("tang-yizong", [{"form": "睿文昭聖恭恵孝皇帝"}],
          full="昭聖恭恵孝皇帝")], False)
case("D 表に挙がっているのに一致してしまう（免除を消せる＝表の腐り止め）",
     [rec("tang-yizong", [{"form": "昭聖恭恵孝皇帝"}],
          full="昭聖恭恵孝皇帝")], True)

# --- A 皇帝号で結ばない王諡の免除 --------------------------------------------
case("A 皇帝号で結ばない段は落ちる（表に無い人物）",
     [rec("t", [{"form": "戾"}, {"form": "恭仁康定景皇帝"}])], True)
case("A 表に理由がある段は通る（明代宗の王諡）",
     [rec("ming-daizong", [{"form": "戾"}, {"form": "恭仁康定景皇帝"}],
          full="恭仁康定景皇帝")], False)
case("A 表の行がどの段にも無い（訂正で形が変わった＝表の腐り止め）",
     [rec("ming-daizong", [{"form": "恭仁康定景皇帝"}], full="恭仁康定景皇帝")], True)

# --- F 底本 ------------------------------------------------------------------
HAY = norm_for_match("群臣上谥曰大武皇帝，庙号高祖。高宗上元元年八月，改上尊号曰神尧皇帝。")
F_CASES = [
    ("F 底本に在る段は当たる", "大武皇帝", True),
    ("F 底本に在る段は当たる（新字体→簡体の差分を越える）", "神堯皇帝", True),
    ("F 底本に無い段は当たらない（捏造した段はここで落ちる）", "文武大聖大広孝皇帝", False),
]


def main():
    bad = 0
    for label, records, want_error in CASES:
        got = run(records)
        okay = bool(got) == want_error
        bad += 0 if okay else 1
        mark = "ok  " if okay else "NG  "
        detail = f" — {got[0]}" if got else ""
        print(f"{mark}{label}{'' if okay else detail}")
    for label, form, want_hit in F_CASES:
        got = Q.posthumous_full_hit(form, HAY) is not None
        okay = got == want_hit
        bad += 0 if okay else 1
        print(f"{'ok  ' if okay else 'NG  '}{label}")
    total = len(CASES) + len(F_CASES)
    print(f"---\n{bad} errors / {total} 件の合成ケースで検出力を測定")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
