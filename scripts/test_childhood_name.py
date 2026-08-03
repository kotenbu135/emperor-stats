#!/usr/bin/env python3
"""幼名 childhoodName の検査を、合成レコードで確かめる（Issue #37 単位5・2026-08-03）。

**この欄は 365人のうち30人にしか無い**（小字を冒頭定型に載せるのは宋斉梁陳・隋唐五代の
一部・遼金にほぼ限られる）。本番の「0 errors」が「守れている」なのか「そもそも何も
見ていない」なのかを実データでは区別できないので、ここで検出力そのものを測る
（SCHEMA_CHANGE_CHECKLIST.md 手順4）。

測るのは3つのゲート:

  A 形           validate_emperors.py::check_childhood_names（漢字1〜4字・定型を含まない）
  B 名乗りの分離  同上（諱・字・廟号・諡号のどれかを写した形を落とす）
  C 底本         verify_quotes.py::childhood_hit（本人の原文に「小字〈値〉」の形で在るか）

**B は民族名と突き合わせない。** 契丹・女真の名は本紀が「小字」として載せる形があり
（遼史「讳德光，字德谨，小字尧骨」・金史「讳璟，小字麻达葛」）、同値であることが
正しい。ここを字の欄と同じ実装にすると、金章宗の麻達葛が**正しいのに落ちる**。
下の B-CASES はその非対称が効いていることを測る。
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
    V.check_childhood_names({"emperors": records})
    return list(V.errors)


def rec(eid, childhood=None, personal=None, courtesy=None,
        temple=None, posthumous=None, ethnic=None):
    name = {}
    if personal:
        name["personalName"] = personal
    if courtesy:
        name["courtesyName"] = courtesy
    if temple:
        name["templeName"] = temple
    if posthumous:
        name["posthumousName"] = posthumous
    if ethnic:
        name["ethnicName"] = ethnic
    if childhood is not None:
        name["childhoodName"] = childhood
    return {"id": eid, "name": name}


CASES = [
    ("正しい形は通る（遼太祖 字阿保機・小字啜里只）",
     [rec("liao-taizu", "啜里只", personal="耶律億", courtesy="阿保機")], 0),
    ("childhoodName が無いレコードは何も言わない（任意・遡及しない）",
     [rec("tang-taizong", personal="李世民")], 0),
    ("3字の小字も通る（後唐閔帝の菩薩奴）",
     [rec("wudai-houtang-mindi", "菩薩奴", personal="李従厚")], 0),
    ("数字の小字も通る（後唐末帝の二十三）",
     [rec("wudai-houtang-modi2", "二十三", personal="李従珂")], 0),
    # A 形
    ("空文字は落ちる",
     [rec("liao-taizu", "", personal="耶律億")], 1),
    ("5字以上は落ちる（記事を切り取った形）",
     [rec("liao-taizu", "啜里只德祖皇", personal="耶律億")], 1),
    ("漢字以外が混じると落ちる",
     [rec("liao-taizu", "チョリジ", personal="耶律億")], 1),
    ("定型ごと写した形は落ちる（「字」が値に入る）",
     [rec("liao-taizu", "小字啜里只", personal="耶律億")], 2),
    ("「諱」が値に入る形も落ちる",
     [rec("liao-taizu", "諱億", personal="耶律億")], 1),
    # B 名乗りの分離 **取り違えの主力**
    ("諱をそのまま幼名の欄へ写すと落ちる",
     [rec("liao-taizu", "耶律億", personal="耶律億")], 1),
    ("**字を幼名の欄へ写すと落ちる**（遼太祖で阿保機と啜里只を取り違える形の逆向き）",
     [rec("liao-taizu", "阿保機", personal="耶律億", courtesy="阿保機")], 1),
    ("廟号を写すと落ちる",
     [rec("liao-taizu", "太祖", personal="耶律億", temple="太祖")], 1),
    ("諡号を写すと落ちる",
     [rec("liao-taizu", "大聖", personal="耶律億", posthumous="大聖")], 1),
]

# B の非対称。**民族名と同値でも通る**のがこの欄の固有の事情で、
# 字の欄（同値なら落ちる）と逆になっている。
B_CASES = [
    ("民族名と同じ値でも通る（金章宗 女真名＝小字＝麻達葛）",
     [rec("jin-zhangzong", "麻達葛", personal="完顔璟",
          ethnic={"kind": "jurchen", "value": "麻達葛"})], 0),
    ("民族名が姓を冠していても通る（遼太宗 契丹名 耶律堯骨・小字 堯骨）",
     [rec("liao-taizong", "堯骨", personal="耶律徳光", courtesy="徳謹",
          ethnic={"kind": "khitan", "value": "耶律堯骨"})], 0),
]

bad = 0
for label, records, want in CASES + B_CASES:
    errs = run(records)
    ok = len(errs) == want
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {label}  ({len(errs)}件 / want {want})")
    if not ok:
        for e in errs:
            print(f"       {e[:160]}")

# 同じレコードを字のゲートに掛けると落ちること（**非対称が意図的であることの裏**）。
# 民族名との同値を字の欄で許すと、遼太祖の取り違えが全ゲート緑で通ってしまう。
V.errors.clear()
V.infos.clear()
V.check_courtesy_names({"emperors": [
    {"id": "jin-zhangzong", "name": {"personalName": "完顔璟", "courtesyName": "麻達葛",
                                     "ethnicName": {"kind": "jurchen", "value": "麻達葛"}}}]})
ok = len(V.errors) == 1
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 同じ値を**字**の欄へ入れると落ちる（非対称の裏取り）")

# 分母（評価件数）が出ているか。出ていないと 0 エラーの意味が読めない
run([rec("liao-taizu", "啜里只", personal="耶律億")])
ok = any("childhoodName を持つ人物 1人" in i for i in V.infos)
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 評価件数（分母）を出す")

# --- C 底本（「小字〈値〉」の隣接まで見る）-------------------------------------
# 遼史 太祖紀の書き出し。**字と小字が同じ1行に並ぶ**ので、隣接を見ない実装だと
# 阿保機を幼名の欄へ入れても当たってしまう。
HAY = norm_for_match(
    "太祖大聖大明神烈天皇帝，姓耶律氏，諱億，字阿保機，小字啜里只，德祖皇帝之長子，"
    "母曰宣簡皇后蕭氏。唐咸通十三年生，簡獻皇帝之孫也。")
C_CASES = [
    ("小字はそのまま当たる", "啜里只", True),
    ("**字は当たらない**（これがゲートの主眼）", "阿保機", False),
    ("諱は当たらない（「小字」と隣り合わない）", "億", False),
    ("底本に無い名は当たらない", "啜里支", False),
    ("本文に在るだけの断片は当たらない（隣接が要る）", "德祖", False),
    ("新字体で書いても当たる（児→兒・薬→藥の正規化と同じ経路）", "啜里只", True),
]
for label, value, want in C_CASES:
    hit = Q.childhood_hit(value, HAY)
    ok = bool(hit) == want
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {label}  (hit={hit!r})")

# 新字体で保存した値が底本の簡体・繁体に当たること（宋書「小字车兒」→ 保存値「車児」）。
HAY2 = norm_for_match("太祖文皇帝讳义隆，小字车兒，武帝第三子也。")
ok = bool(Q.childhood_hit("車児", HAY2))
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 新字体で保存した値が底本に当たる（宋文帝 車児）")

# **注釈の形は名前ではない。** 「〈名〉，〈人〉小字也」は「これは誰それの小字だ」という
# 説明で、直後の1字を値にすると「也」を拾う。絞り込み側で落としているが、ゲートCも
# 「小字也」に当たらないことを測っておく（値が「也」で入ってくる経路を塞ぐ）。
HAY3 = norm_for_match("驹，愉小字也。谧惧，奔于曲阿。")
ok = not Q.childhood_hit("駒", HAY3)
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 注釈「〈人〉小字也」からは値が取れない（劉裕紀の形）")

# **動詞をはさむ形は当たらない＝入れられない。** 南漢の劉玢は高祖の遺言が
# 「呼洪度、洪熙小字曰：『寿、俊虽长…』」で、読めば小字が「寿」と分かるが
# 隣接にならない。取りこぼす側に倒したことを明示して測る（残量表の行）。
HAY4 = norm_for_match("呼洪度、洪熙小字曰：“寿、俊虽长，然皆不足任吾事”")
ok = not Q.childhood_hit("寿", HAY4)
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 動詞をはさむ形は当たらない（南漢劉玢・取りこぼす側に倒した）")

total = len(CASES) + len(B_CASES) + len(C_CASES) + 5
print(f"\n{'全件一致' if not bad else str(bad) + '件 不一致'} / {total}件")
sys.exit(1 if bad else 0)
