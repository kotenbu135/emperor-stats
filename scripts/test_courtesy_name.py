#!/usr/bin/env python3
"""字 courtesyName の検査を、合成レコードで確かめる（Issue #37 単位4・2026-08-03）。

**この欄は 365人のうち一部にしか無い**（多くの書が帝紀の冒頭定型に字の欄を持たない）。
本番の「0 errors」が「守れている」なのか「そもそも何も見ていない」なのかを実データでは
区別できないので、ここで検出力そのものを測る（SCHEMA_CHANGE_CHECKLIST.md 手順4）。

測るのは3つのゲート:

  A 形           validate_emperors.py::check_courtesy_names（漢字1〜4字・定型を含まない）
  B 名乗りの分離  同上（諱・民族名・廟号・諡号のどれかを写した形を落とす）
  C 底本         verify_quotes.py::courtesy_hit（本人の原文に「字〈値〉」の形で在るか）

**C は「字」との隣接まで見る。** 値だけを本文に探す実装だと、2字の断片は本紀の
どこにでも当たって実在検査にならず、さらに「小字」を字の欄へ入れた取り違えが
素通りする（遼太祖は「字阿保機，小字啜里只」で両方を1行に持つ）。下の C-CASES は
その隣接が効いていることを、実際の遼史の書き出しを底本にして測る。
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
    V.check_courtesy_names({"emperors": records})
    return list(V.errors)


def rec(eid, courtesy=None, personal=None, temple=None, posthumous=None, ethnic=None):
    name = {}
    if personal:
        name["personalName"] = personal
    if temple:
        name["templeName"] = temple
    if posthumous:
        name["posthumousName"] = posthumous
    if ethnic:
        name["ethnicName"] = ethnic
    if courtesy is not None:
        name["courtesyName"] = courtesy
    return {"id": eid, "name": name}


CASES = [
    ("正しい形は通る（遼太祖 諱耶律億・字阿保機）",
     [rec("liao-taizu", "阿保機", personal="耶律億")], 0),
    ("courtesyName が無いレコードは何も言わない（任意・遡及しない）",
     [rec("tang-taizong", personal="李世民")], 0),
    ("4字の字も通る（北周武帝の祢羅突のような形）",
     [rec("beizhou-wudi", "禰羅突", personal="宇文邕")], 0),
    # A 形
    ("空文字は落ちる",
     [rec("liao-taizu", "", personal="耶律億")], 1),
    ("5字以上は落ちる（記事を切り取った形）",
     [rec("liao-taizu", "阿保機小字啜", personal="耶律億")], 2),
    ("漢字以外が混じると落ちる",
     [rec("liao-taizu", "アボキ", personal="耶律億")], 1),
    ("定型ごと写した形は落ちる（「字」が値に入る）",
     [rec("liao-taizu", "字阿保機", personal="耶律億")], 1),
    ("「諱」が値に入る形も落ちる",
     [rec("liao-taizu", "諱億", personal="耶律億")], 1),
    # B 名乗りの分離 **取り違えの主力**
    ("諱をそのまま字の欄へ写すと落ちる",
     [rec("liao-taizu", "耶律億", personal="耶律億")], 1),
    ("民族名を字の欄へ写すと落ちる（遼太祖で阿保機と啜里只を取り違える形）",
     [rec("liao-taizong", "堯骨", personal="耶律徳光",
          ethnic={"kind": "khitan", "value": "堯骨"})], 1),
    ("廟号を写すと落ちる",
     [rec("liao-taizu", "太祖", personal="耶律億", temple="太祖")], 1),
    ("諡号を写すと落ちる",
     [rec("liao-taizu", "大聖", personal="耶律億", posthumous="大聖")], 1),
    ("民族名と字が別々なら通る（遼太宗 字德謹・契丹名 堯骨）",
     [rec("liao-taizong", "徳謹", personal="耶律徳光",
          ethnic={"kind": "khitan", "value": "堯骨"})], 0),
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
run([rec("liao-taizu", "阿保機", personal="耶律億")])
ok = any("courtesyName を持つ人物 1人" in i for i in V.infos)
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 評価件数（分母）を出す")

# --- C 底本（「字〈値〉」の隣接まで見る）---------------------------------------
# 遼史 太祖紀の書き出し。**字と小字が同じ1行に並ぶ**ので、隣接を見ない実装だと
# 啜里只を字の欄へ入れても当たってしまう。
HAY = norm_for_match(
    "太祖大聖大明神烈天皇帝，姓耶律氏，諱億，字阿保機，小字啜里只，德祖皇帝之長子，"
    "母曰宣簡皇后蕭氏。唐咸通十三年生，簡獻皇帝之孫也。")
C_CASES = [
    ("字はそのまま当たる", "阿保機", True),
    ("**小字は当たらない**（これがゲートの主眼）", "啜里只", False),
    ("諱は当たらない（「字」と隣り合わない）", "億", False),
    ("底本に無い名は当たらない", "阿保璣", False),
    ("本文に在るだけの断片は当たらない（隣接が要る）", "德祖", False),
    ("新字体で書いても当たる（徳→德の正規化）", "阿保機", True),
]
for label, value, want in C_CASES:
    hit = Q.courtesy_hit(value, HAY)
    ok = bool(hit) == want
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {label}  (hit={hit!r})")

# 名乗りの種類を作る接頭字（小字・表字）は弾く。**一般語（名字・文字）は弾かない** —
# 正規化本文は漢字だけになって句読点が落ちるので、「字」の直前はたいてい**諱の末字**に
# なる。「文」を弾く表にしていたあいだ、東晋恭帝（諱德文・字德文）と南斉海陵王
# （諱昭文・字季尚）の2件が**正しい字なのに落ちていた**。取りこぼしと見逃しのどちらを
# 取るかの選択で、ここは**見逃す側**に倒してある（見逃した形はゲートBの分離と、
# そもそも原文を読んで入れるという手順が受ける）。
HAY2 = norm_for_match("其人名字子仙，小字法師，表字元亮。")
for label, value, want in (("表字の後半には当たらない", "元亮", False),
                           ("名字は弾かない（諱の末字との衝突を避けるため）", "子仙", True)):
    hit = Q.courtesy_hit(value, HAY2)
    ok = bool(hit) == want
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {label}  (hit={hit!r})")

# 諱の末字が「文」でも当たる（上の選択が効いていること）
HAY3 = norm_for_match("恭帝讳德文，字德文，安帝母弟也。")
ok = bool(Q.courtesy_hit("徳文", HAY3))
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 諱の末字が「文」でも字が当たる（東晋恭帝の形）")

# 本文の先頭に来る形。空文字はどの文字列にも含まれるので、番兵が無いと必ず弾かれる
HAY4 = norm_for_match("字景茂，俊第三子也。")
ok = bool(Q.courtesy_hit("景茂", HAY4))
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 本文の先頭に来る字も当たる（前燕慕容暐の形）")

# 避諱で**字のほうを見出しに立てた**形（晉書 載記）。この条には「字〈値〉」の並びが
# 一度も出ない — 値そのものが見出しで、「字」は「故称字焉」の中にしか無い。
# 2026-08-11 に足す前は石季龍がゲートCで落ちていた。**免除ではなくゲートで受ける**のは、
# これが底本の事故ではなく書が明示している定型で、同じ載記の劉元海（未転記）にも及ぶため。
HAY5 = norm_for_match("石季龙，勒之从子也，名犯太祖庙讳，故称字焉。祖曰乙邪，父曰寇觅。")
HAY6 = norm_for_match("刘元海，新兴匈奴人，冒顿之后也。名犯高祖庙讳，故称其字焉。")
TABOO_CASES = [
    ("避諱で見出しに立った字が当たる（石季龍）", "季龍", HAY5, True),
    ("「故称**其**字焉」の形でも当たる（劉元海）", "元海", HAY6, True),
    ("**同じ条でも冒頭から離れた2字は当たらない**（見出しの位置を要求する）",
     "寇覓", HAY5, False),
    ("底本に無い名は当たらない", "季虎", HAY5, False),
]
for label, value, hay, want in TABOO_CASES:
    hit = Q.courtesy_hit(value, hay)
    ok = bool(hit) == want
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {label}  (hit={hit!r})")

# **旗が無ければ冒頭でも当たらない**。この1件が無いと、上の緩和が「冒頭2字なら何でも
# 通る」に化けたことを検出できない
HAY7 = norm_for_match("石季龙，勒之从子也。祖曰乙邪，父曰寇觅。")
ok = not Q.courtesy_hit("季龍", HAY7)
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 「故称字焉」が無ければ冒頭の名乗りでも当たらない")

total = len(CASES) + len(C_CASES) + len(TABOO_CASES) + 6
print(f"\n{'全件一致' if not bad else str(bad) + '件 不一致'} / {total}件")
sys.exit(1 if bad else 0)
