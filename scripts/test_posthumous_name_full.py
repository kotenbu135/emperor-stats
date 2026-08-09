#!/usr/bin/env python3
"""諡号の全長形 posthumousNameFull の検査を、合成レコードで確かめる（Issue #37 単位1・2026-08-10）。

**この欄は 365人のうち16人にしか無い**（着手時点で明の16人だけ）。本番の「0 errors」が
「守れている」なのか「そもそも何も見ていない」なのかを実データでは区別できないので、
ここで検出力そのものを測る（SCHEMA_CHANGE_CHECKLIST.md 手順4）。

測るのは4つのゲート:

  A 形            validate_emperors.py::check_posthumous_name_full（漢字2〜30字・「皇帝」で結ぶ）
  B 廟号の混入     同上（本紀冒頭「〈廟号〉〈全長諡〉」を行ごと写した形を落とす）
  C 短縮形との整合  同上（posthumousName が全長形の部分列＋諡の実字が一致すること）
  F 底本          verify_quotes.py::posthumous_full_hit（本人の原文に連続で在るか）

**B がこの欄の主眼。** 底本照合（F）は連続文字列で当てるので、廟号を頭に付けたままの
値でも当たってしまう（本紀冒頭がまさにその並びだから）。廟号の食い込みは A でも F でも
落ちず、B だけが落とす。

**C は部分列で見る。** 漢の短縮呼称「文帝」は全長形「孝文皇帝」の連続部分ではない
（「皇」を落とす）ので、部分文字列で見ると正しい組が落ちる。ただし部分列だけでは
**弱すぎる** — 3字の「昭皇帝」は別人（明宣宗）の全長形にも部分列として当たる。
諡の実字（「皇帝」を落とした末尾1字）の一致を足して初めて別人の全長形が落ちる。
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
    V.check_posthumous_name_full({"emperors": records})
    return list(V.errors)


def rec(eid, full=None, short=None, temple=None):
    name = {}
    if short:
        name["posthumousName"] = short
    if temple:
        name["templeName"] = temple
    if full is not None:
        name["posthumousNameFull"] = full
    return {"id": eid, "name": name}


CASES = [
    ("正しい形は通る（明太祖 高皇帝 ⊂ 開天行道…成功高皇帝）",
     [rec("ming-taizu", "開天行道肇紀立極大聖至神仁文義武俊徳成功高皇帝",
          short="高皇帝", temple="太祖")], 0),
    ("posthumousNameFull が無いレコードは何も言わない（任意・遡及しない）",
     [rec("tang-taizong", short="文皇帝", temple="太宗")], 0),
    ("短縮形と全長形が同じでも通る（明恵帝は清の追諡が5字の1形しか無い）",
     [rec("ming-huizong", "恭閔恵皇帝", short="恭閔恵皇帝")], 0),
    ("短縮形がまだ無くても通る（唐のように原文が全長形しか与えない政権）",
     [rec("tang-shunzong", "至徳大聖大安孝皇帝", temple="順宗")], 0),
    # A 形
    ("空文字は落ちる",
     [rec("ming-taizu", "", short="高皇帝")], 1),
    ("「皇帝」で終わらない形は落ちる（短縮呼称を全長形の欄へ入れた形）",
     [rec("han-wendi", "文帝")], 1),
    ("31字以上は落ちる（記事を切り取った形）",
     [rec("ming-taizu", "開天行道肇紀立極大聖至神仁文義武俊徳成功高皇帝諱元璋字国瑞姓朱氏也")], 3),
    ("漢字以外が混じると落ちる",
     [rec("ming-taizu", "開天行道・成功高皇帝")], 1),
    ("定型ごと写した形は落ちる（「谥曰」を含む）",
     [rec("ming-yizong", "谥曰荘烈愍皇帝")], 2),
    ("「庙号」を巻き込んだ形も落ちる",
     [rec("ming-taizu", "開天行道肇紀立極大聖至神仁文義武俊徳成功高皇帝庙号太祖")], 3),
    # B 廟号の混入 **この欄の主眼**
    ("**廟号を頭に付けたままだと落ちる**（本紀冒頭を行ごと写した形）",
     [rec("ming-taizu", "太祖開天行道肇紀立極大聖至神仁文義武俊徳成功高皇帝",
          short="高皇帝", temple="太祖")], 1),
    ("廟号が無いレコードでは B は鳴らない（明恵帝は廟号を持たない）",
     [rec("ming-huizong", "恭閔恵皇帝", short="恭閔恵皇帝")], 0),
    # C 短縮形との整合
    ("別人の全長形を写すと落ちる（明仁宗の昭皇帝に宣宗の全長形）",
     [rec("ming-renzong", "憲天崇道英明神聖欽文昭武寬仁純孝章皇帝",
          short="昭皇帝", temple="仁宗")], 1),
    ("**部分列なので連続していなくても通る**（漢文帝 文帝 ⊂ 孝文皇帝）",
     [rec("han-wendi", "孝文皇帝", short="文帝")], 0),
    ("字の順序が入れ替わると落ちる（部分列は順序を見る）",
     [rec("ming-taizu", "開天行道肇紀立極大聖至神仁文義武俊徳成功高皇帝",
          short="帝皇高", temple="太祖")], 1),
]

bad = 0
for label, records, want in CASES:
    errs = run(records)
    ok = len(errs) == want
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {label}  ({len(errs)}件 / want {want})")
    if not ok:
        for e in errs:
            print(f"       {e[:160]}")

# 分母（評価件数）が出ているか。出ていないと 0 エラーの意味が読めない
run([rec("ming-taizu", "開天行道肇紀立極大聖至神仁文義武俊徳成功高皇帝",
         short="高皇帝", temple="太祖")])
ok = any("posthumousNameFull を持つ人物 1人" in i for i in V.infos)
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 評価件数（分母）を出す")

# --- F 底本（本人の原文に連続で在るか）-----------------------------------------
# 明史 太祖本紀の書き出し。**廟号込みの並び**なので、ここで「廟号を頭に付けた値でも
# 当たってしまう」ことを測る（＝B が要る理由の裏取り）。
HAY = norm_for_match(
    "太祖开天行道肇纪立极大圣至神仁文义武俊德成功高皇帝，讳元璋，字国瑞，姓朱氏。"
    "先世家沛，徙句容，再徙泗州。")
F_CASES = [
    ("全長形はそのまま当たる", "開天行道肇紀立極大聖至神仁文義武俊徳成功高皇帝", True),
    ("**廟号込みでも当たってしまう**（F では落ちない＝B が要る）",
     "太祖開天行道肇紀立極大聖至神仁文義武俊徳成功高皇帝", True),
    ("底本に無い形は当たらない（1字違い）",
     "開天行道肇紀立極大聖至神仁文義武俊徳成功文皇帝", False),
    ("短縮呼称は当たらない（この底本では連続しない）", "高皇帝", True),
    ("新字体で書いても当たる（徳→德・聖→圣の正規化）", "大聖至神仁文義武俊徳成功高皇帝", True),
]
for label, value, want in F_CASES:
    hit = Q.posthumous_full_hit(value, HAY)
    ok = bool(hit) == want
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {label}  (hit={hit!r})")

# **差分表に無い字は新字体で書くと当たらない。** `寛`↔`寬` は hanzi_norm の
# SHINJITAI_TO_TRAD に無く、norm_for_match が `寛` をそのまま残すため底本の `宽` に
# 当たらない。だから穆宗・宣宗の全長形は底本の字体（寬）で保存している。
# これは仕様であって取りこぼしではない、ということをここで固定する（残量表の行）。
HAY2 = norm_for_match("穆宗契天隆道渊懿宽仁显文光武纯德弘孝庄皇帝，讳载垕，世宗第三子也")
ok = bool(Q.posthumous_full_hit("契天隆道淵懿寬仁顕文光武純徳弘孝荘皇帝", HAY2))
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 差分表に在る字は新字体で当たる（明穆宗）")
ok = not Q.posthumous_full_hit("契天隆道淵懿寛仁顕文光武純徳弘孝荘皇帝", HAY2)
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} **差分表に無い `寛` を使うと当たらない**"
      f"（だから底本の字体で保存する・残量表の行）")

total = len(CASES) + len(F_CASES) + 3
print(f"\n{'全件一致' if not bad else str(bad) + '件 不一致'} / {total}件")
sys.exit(1 if bad else 0)
