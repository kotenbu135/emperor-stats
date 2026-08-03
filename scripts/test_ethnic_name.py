#!/usr/bin/env python3
"""民族名 ethnicName の検査を、合成レコードで確かめる（Issue #37 単位3・2026-08-03）。

**この検査は 32件のうち 10件にしか掛かっていない**（移行が別段のため）。本番の
「0 errors」が「守れている」なのか「そもそも何も見ていない」なのかを実データでは
区別できないので、ここで検出力そのものを測る（SCHEMA_CHANGE_CHECKLIST.md 手順4）。

測るのは5つのゲート:

  A kind の実在  validate_emperors.py::check_ethnic_names
  B 政権との整合  同上（クビライに「女真名」が生える形を落とす）
  C 字種         同上（漢字の kind にカナ・カナの kind に漢字）
  F 組み直し      同上（凍結標本の原文字列に戻る＝**括弧ごとの欠落を落とす唯一の検査**）
  E 括弧の天井    同上（括弧つきが増えたら落ちる）
  D 底本         verify_quotes.py::ethnic_han_hit（漢字側が本人の原文に在るか）

カタログ（meta.catalogs.ethnicNameKinds）は**実データから読む** — 表を写して持つと、
カタログ側の order・script を書き換えたときにテストだけが古い前提で緑になる。
"""
import importlib.util
import json
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

CATALOG = json.loads((ROOT / "data" / "emperors.json").read_text(encoding="utf-8")
                     )["meta"]["catalogs"]["ethnicNameKinds"]
ORIGINALS = json.loads((ROOT / "data" / "internal" / "personal-name-originals.json"
                        ).read_text(encoding="utf-8"))["records"]

# 合成レコード1件に本番の天井（32）を掛けても落ちない（超えるほうを見るゲートなので）。
# 天井が効くこと自体は下で明示的に確かめる。


def run(records):
    V.errors.clear()
    V.warnings.clear()
    V.infos.clear()
    V.check_ethnic_names({
        "meta": {"catalogs": {"ethnicNameKinds": CATALOG}},
        "emperors": records,
    })
    return list(V.errors)


def rec(eid, regime, personal, ethnic=None, aliases=None):
    name = {"personalName": personal, "aliases": aliases or []}
    if ethnic is not None:
        name["ethnicName"] = ethnic
    return {"id": eid, "regimeId": regime, "name": name}


# 凍結標本に在る実 id を使う（F は標本を引くので、合成 id では評価そのものが起きない）
JIN = ("jin-shizong", "jin-jurchen", "完顔雍", "烏禄")          # 完顔雍（烏禄）
YUAN = ("yuan-shizu", "yuan", "忽必烈", "クビライ")             # クビライ（忽必烈）

CASES = [
    ("正しい形は通る（金・漢名（女真名））",
     [rec(*JIN[:3], {"kind": "jurchen", "value": JIN[3]})], 0),
    ("正しい形は通る（元・カナ（漢字音写）＝並びが逆）",
     [rec(*YUAN[:3], {"kind": "mongol", "value": YUAN[3]})], 0),
    ("ethnicName が無いレコードは何も言わない（任意・遡及しない）",
     [rec("han-wudi", "western-han", "劉徹")], 0),
    # A
    ("カタログに無い kind は落ちる",
     [rec(*JIN[:3], {"kind": "tangut", "value": JIN[3]})], 1),
    # B **取り違えの主力**
    ("元の皇帝に「女真名」を入れると B が落ちる（組み直しも戻らないので2件）",
     [rec(*YUAN[:3], {"kind": "jurchen", "value": "忽必烈"})], 2),
    ("金の皇帝に「モンゴル語名」を入れると B が落ちる（字種・組み直しも外れて3件）",
     [rec(*JIN[:3], {"kind": "mongol", "value": JIN[3]})], 3),
    # C
    ("漢字の kind にカナを入れると C が落ちる",
     [rec(*JIN[:3], {"kind": "jurchen", "value": "ウル"})], 2),
    ("カナの kind に漢字を入れると C が落ちる",
     [rec(*YUAN[:3], {"kind": "mongol", "value": "忽必烈"})], 2),
    ("中黒を含むカナは通る（イェスン・テムル）",
     [rec("yuan-taidingdi", "yuan", "也孫鉄木児",
          {"kind": "mongol", "value": "イェスン・テムル"})], 0),
    # F **括弧ごとの欠落を落とす唯一の検査**
    ("民族名を1字変えると F が落ちる（原文字列に戻らない）",
     [rec(*JIN[:3], {"kind": "jurchen", "value": "烏緑"})], 1),
    ("漢字名のほうを1字変えても F が落ちる",
     [rec("jin-shizong", "jin-jurchen", "完顔雝",
          {"kind": "jurchen", "value": "烏禄"})], 1),
    ("並びを取り違えた形は F が落ちる（金を「民族名（漢字名）」で入れる）",
     [rec("jin-shizong", "jin-jurchen", "烏禄",
          {"kind": "jurchen", "value": "完顔雍"})], 1),
    ("括弧を残したまま ethnicName を足すと落ちる（在りかが2つになる）",
     [rec("jin-shizong", "jin-jurchen", "完顔雍（烏禄）",
          {"kind": "jurchen", "value": "烏禄"})], 2),
    # 対の検査。天井だけなら「（烏禄）を消す」で満たせてしまう
    ("括弧だけ消して民族名の行き先が無い形は落ちる",
     [rec("jin-shizong", "jin-jurchen", "完顔雍")], 1),
    ("括弧を消して aliases へ逃がした形は通る（改名の劉崇＝劉旻の受け方）",
     [rec("shiguo-beihan-liuchong", "northern-han", "劉崇", aliases=["劉旻"])], 0),
    ("凍結標本に無い人物の personalName は自由（標本は移行の証人であって母集団ではない）",
     [rec("han-wudi", "western-han", "劉徹")], 0),
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

# --- E 天井 -------------------------------------------------------------------
orig_ceiling = V.ETHNIC_PAREN_CEILING
V.ETHNIC_PAREN_CEILING = 0
errs = run([rec("jin-shizong", "jin-jurchen", "完顔雍（烏禄）")])
ok = any("天井" in e for e in errs)
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 括弧つきが天井を超えると E が落ちる  ({len(errs)}件)")
V.ETHNIC_PAREN_CEILING = orig_ceiling

# 分母（評価件数）が出ているか。出ていないと 0 エラーの意味が読めない
run([rec(*JIN[:3], {"kind": "jurchen", "value": JIN[3]})])
ok = any("ethnicName を持つ人物 1人" in i for i in V.infos)
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 評価件数（分母）を出す")

# --- D 底本（漢字側が本人の原文に在るか）--------------------------------------
# 本紀は「姓完顔氏，讳雍」と氏族名を別に述べるので、姓つきのままでは当たらない。
HAY = norm_for_match("金世宗讳雍，本讳乌禄，太祖孙，睿宗子也。卫绍王讳永济，小字兴胜")
D_CASES = [
    ("女真名はそのまま当たる", "烏禄", True),
    ("姓を落とせば漢名も当たる（本紀は姓を諱に連ねない）", "完顔永済", True),
    ("底本に無い名は当たらない", "完顔雝", False),
    ("氏族名だけでは当たらない", "完顔", False),
    # 「完顔雍」→「雍」のような1字の残りを候補にすると、どの巻にも出てくる字に
    # 当たって証拠にならない（残り2字以上だけを候補にしている）
    ("残りが1字になる形は当たりにしない", "完顔雍", False),
]
for label, value, want in D_CASES:
    hit = Q.ethnic_han_hit(value, HAY)
    ok = bool(hit) == want
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {label}  (hit={hit!r})")

# --- カタログそのもの ---------------------------------------------------------
ok = {k["id"] for k in CATALOG} == {"khitan", "jurchen", "mongol", "manchu"} and all(
    k["order"] in ("ethnic-first", "personal-first") and k["script"] in ("han", "kana")
    for k in CATALOG)
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} カタログが4種類・order と script が既知の値")

total = len(CASES) + len(D_CASES) + 3
print(f"\n{'全件一致' if not bad else str(bad) + '件 不一致'} / {total}件")
sys.exit(1 if bad else 0)
