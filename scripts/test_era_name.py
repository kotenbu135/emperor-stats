#!/usr/bin/env python3
"""元号名 eraName の検査を、合成レコードで確かめる（Issue #37 単位2・2026-08-03）。

**この検査は 681件のうち 5件にしか掛かっていない**（転記が別段のため）。本番の
「0 errors」が「守れている」なのか「そもそも何も見ていない」なのかを実データでは
区別できないので、ここで検出力そのものを測る（SCHEMA_CHANGE_CHECKLIST.md 手順4）。

測るのは4つのゲート:

  A 形         validate_emperors.py::check_era_names
  B 再演       同上（eraNameRaw との正規化一致）
  C 根拠       同上（同じ event の note に在る）
  E ラチェット 同上（充足数が基準線を下回ったら落ちる）
  D 底本       verify_quotes.py::era_anchor_hit（改元の定型句と隣り合うか）

**C の限界もここで測る**（「捨てた側の元号を入れても C は通る」を明示的に主張する）。
限界を測らないと、次に読む人が C を「建てた元号であることの検査」と読む。
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

# 合成レコード1件に本番のラチェット（基準線5）を掛けると全ケースが1件ずつ余計に
# 落ちる。ラチェットが効くこと自体は下の with_baseline で別に確かめる。
V.ERA_NAME_BASELINE = 0


def run(event, group="eraChangeCount"):
    V.errors.clear()
    V.warnings.clear()
    V.infos.clear()
    V.check_era_names({"emperors": [{"id": "t", group: {"events": [event]}}]})
    return list(V.errors)


NOTE = "年号を「景和二年」から「義嘉元年」に改元（建元）。"

CASES = [
    ("正しい形は通る",
     {"eraName": "義嘉", "note": NOTE}, 0),
    ("eraName が無い改元 event は何も言わない（任意・元号制以前があるため）",
     {"note": NOTE}, 0),
    # C
    ("1字差し替えると C が落ちる（note に根拠が無い）",
     {"eraName": "義喜", "note": NOTE}, 1),
    ("note が空なら C が落ちる",
     {"eraName": "義嘉", "note": ""}, 1),
    ("根拠は quotes[] からも取れる",
     {"eraName": "天啓", "quotes": [{"bookId": "beiqishu", "text": "年號天啟"}]}, 0),
    ("底本の字体（简体）の note でも C は通る（正規化を通すため）",
     {"eraName": "天啓", "note": "年号天启"}, 0),
    # B
    ("eraNameRaw が別の元号なら B が落ちる",
     {"eraName": "天啓", "eraNameRaw": "天成", "note": "年号天启"}, 1),
    ("eraNameRaw が同じ元号の別字体なら通る",
     {"eraName": "天啓", "eraNameRaw": "天啟", "note": "年号天启"}, 0),
    ("eraNameRaw だけがあると落ちる",
     {"eraNameRaw": "天啟", "note": "年号天启"}, 1),
    # A
    ("記事の一節を丸ごと入れると A が落ちる",
     {"eraName": "改元康熙", "note": "改元康熙"}, 1),
    ("「◯◯元年」の形も A が落ちる",
     {"eraName": "天啓元年", "note": "天啓元年"}, 1),
    # 史実と衝突する語の逃がし。**単純化して消さないこと** — 「建元」は漢武帝の最初の元号で、
    # 東晋康帝・前秦苻堅・南斉高帝も立てている。禁止語に素で入れると前漢の1件目で
    # 正しい値が弾かれ、転記する人が「ゲートが壊れている」と読む
    ("実在する元号「建元」は通る（禁止語と衝突する史実の元号）",
     {"eraName": "建元", "note": "建元元年"}, 0),
    ("「建元」を含む記事の形は落ちたまま",
     {"eraName": "改元建元", "note": "改元建元"}, 1),
    # 上限は6字。西夏の「天授禮法延祚」「天賜禮盛國慶」が実在するので、
    # 2〜4字の前提で書いていた旧ケース（5字は落ちる）を 2026-08-05 に差し替えた
    ("6字の実在する元号は通る（西夏）",
     {"eraName": "天授禮法延祚", "note": "天授禮法延祚元年"}, 0),
    ("7字は A が落ちる",
     {"eraName": "天啓万暦義和平", "note": "天啓万暦義和平"}, 1),
    ("1字は A が落ちる",
     {"eraName": "啓", "note": "年号天启"}, 1),
    ("カナ・かなの混入は A が落ちる",
     {"eraName": "テンケイ", "note": "年号天启"}, 1),
]

bad = 0
for name, event, want in CASES:
    errs = run(event)
    ok = len(errs) == want
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {name}  ({len(errs)}件 / want {want})")
    if not ok:
        for e in errs:
            print(f"       {e[:160]}")

# 改元以外の容器（型でも禁じているが、合成レコードでも同じ判定が要る）
errs = run({"eraName": "義嘉", "note": NOTE}, group="amnestyCount")
ok = len(errs) == 1
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 大赦 event に eraName を入れると落ちる  ({len(errs)}件 / want 1)")

# --- C の限界（測って明示する）-----------------------------------------------
# 「章武から建興へ改元」の note で、**捨てた側**の章武を入れても C は通る。
# C は「この event が建てた元号」ではなく「この event の中に名前がある」しか見ない。
errs = run({"eraName": "章武", "note": "年号を章武から建興へ改元した。"})
ok = len(errs) == 0
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 【限界】捨てた側の元号を入れても C は通る（区別するのは D だけ）"
      f"  ({len(errs)}件 / want 0)")

# --- D（底本に改元の定型句と隣り合って在るか）---------------------------------
LINES = [norm_for_match("九年二月、自湓城済江、三月、即帝位于郢州、年号天启、王琳総其軍国"),
         norm_for_match("天启三年冬十月、陳軍至郢州")]
D_CASES = [
    ("定型句と隣り合っていれば D は通る", "天啓", True),
    ("年次表記の行にしか無ければ D が落ちる", "天成", False),
]
for name, era, want_hit in D_CASES:
    hit = Q.era_anchor_hit(norm_for_match(era), LINES)
    ok = bool(hit) == want_hit
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {name}  (hit={hit!r})")

# 「改〈捨てる側〉为〈建てる側〉」型（2026-08-17 に足した。唐の本紀が多用する形で、
# 隣接形だけだと粛宗の乾元→上元・宝応が落ちた）。**建てた側にだけ当たること**が要点で、
# 捨てた側は 改 の直後に立つので当たってはいけない
RECAST = [norm_for_match("上御明鳳門、大赦天下、改乾元為上元"),
          norm_for_match("其元年宜改為寶應、建巳月為四月"),
          norm_for_match("壬申、大赦、改元為顯慶")]
RECAST_CASES = [
    ("改〈旧〉为〈新〉の新しい側は D に当たる", "上元", True),
    ("改为〈新〉（旧を挟まない形）も当たる", "宝応", True),
    ("改元为〈新〉も当たる", "顕慶", True),
    ("【要】改の直後に立つ捨てた側は当たらない", "乾元", False),
]
for name, era, want_hit in RECAST_CASES:
    hit = Q.era_anchor_hit(norm_for_match(era), RECAST)
    ok = bool(hit) == want_hit
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {name}  (hit={hit!r})")

# 新字体と底本が1対1にならない字（2026-08-17）。`歳` は AMBIGUOUS_JP なので
# norm_for_match の1形では底本の `岁` に当たらず、武則天の3元号がまるごと落ちた
GLYPH = [norm_for_match("加尊號天冊金輪聖神皇帝、大赦天下、改元為天冊萬歲"),
         norm_for_match("萬歲登封元年臘月甲申、上登封于嵩岳、大赦天下、改元")]
GLYPH_CASES = [
    ("新字体の歳を含む元号が底本の岁に当たる", "天冊万歳", True),
    ("年ラベルの側（◯◯元年）でも歳が当たる", "万歳登封", True),
    ("同じ行に無い元号は当たらない", "万歳通天", False),
]
for name, era, want_hit in GLYPH_CASES:
    hit = Q.era_anchor_hit(norm_for_match(era), GLYPH)
    ok = bool(hit) == want_hit
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {name}  (hit={hit!r})")

# 底本が字を PUA・分解表記で持つ形（2026-08-17・西夏）。**目には脱字に見えるが在る**ので、
# 写像が無いと han_only が黙って落とし、正しい値が D で落ちる。
# 行は西夏書事の年見出しそのまま。**PUA は  のエスケープで書く** — 生の字で貼ると
# 編集の途中で黙って落ちる（この検査を書くとき実際に落ちて、当たるはずのケースが外れた）
PUA = [norm_for_match("皇二年、夏天垂圣元年春正月，使献契丹捷。"),
       norm_for_match("嘉二年、夏<奢单>都元年春三月，以国母遗物入献。"),
       norm_for_match("绍兴五年、夏大德元年春正月，金使来告哀及报即位。")]
PUA_CASES = [
    ("PUA の祐を含む元号が当たる（天祐垂聖）", "天祐垂聖", True),
    ("角括弧の分解表記が1字に戻る（奲都）", "奲都", True),
    ("同じ行の PUA を含まない元号は当たらない", "天祐民安", False),
    ("分解の部品そのものは元号として当たらない", "奢单", False),
    ("写像を足しても素の行の判定は変わらない", "大德", True),
]
for name, era, want_hit in PUA_CASES:
    hit = Q.era_anchor_hit(norm_for_match(era), PUA)
    ok = bool(hit) == want_hit
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {name}  (hit={hit!r})")

# --- 「號年〈元号〉」型（2026-08-17・北魏ブロックで足した） --------------------
# 魏書は**自ら帝号を称した側**の建元をこの語順で書く。`年号` の逆で、`号` 単独では
# `号建明` にならないため隣接形から漏れ、値が正しいのに D で2件落ちた。
# **建てた側にだけ当たること**を主張する（同じ紀の「改建明二年為普泰元年」は捨てた側）
HAOYEAR = [norm_for_match("共推太原太守、行并州刺史长广王晔为主，大赦所部，号年建明，普泛四级。"),
           norm_for_match("孝昌元年，法僧杀行台高谅，反于彭城，自称尊号，号年天启。"),
           norm_for_match("诏曰：朕以寡薄，抚临万邦。可大赦天下，改建明二年为普泰元年。")]
HAOYEAR_CASES = [
    ("號年で建てた側が当たる（建明）", "建明", True),
    ("號年で建てた側が当たる（天啓）", "天啓", True),
    ("改〈旧〉為〈新〉の新しい側も当たる（普泰）", "普泰", True),
    ("號年の語に掛からない別の元号は当たらない", "永安", False),
]
for name, era, want_hit in HAOYEAR_CASES:
    hit = Q.era_anchor_hit(norm_for_match(era), HAOYEAR)
    ok = bool(hit) == want_hit
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {name}  (hit={hit!r})")

# 元号名だけが在る行（「天启三年」）を当たりに数えないこと。D の主力はこの区別
hit = Q.era_anchor_hit(norm_for_match("天啓"), [LINES[1]])
ok = hit is None
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 元号名が在るだけの行は D の当たりにしない  (hit={hit!r})")

# --- C 単独語と文中で正規化が割れる字（2026-08-17・五代十国ブロック）-----------
# opencc は文脈で変換先を変えるので、「応乾」は単独だと 应干・文中の「応乾元年」は
# 应乾 のまま。norm_for_match 同士では当たらず、2026-08-05 の転記はここで撤回された
YINGQIAN_NOTE = ("光天二年の元号を「応乾元年」と改めた。"
                 "「即皇帝位更今名改光天二年為応乾元年」（十国春秋・中宗本紀）")
CW_CASES = [
    ("文中で乾が畳まれない元号も C を通る（応乾）", {"eraName": "応乾", "note": YINGQIAN_NOTE}, 0),
    ("同じ note に出ない元号は C で落ちる（乾和）", {"eraName": "乾和", "note": YINGQIAN_NOTE}, 1),
]
for name, ev, want in CW_CASES:
    errs = run(ev)
    ok = len(errs) == want
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {name}  ({len(errs)}件 / want {want})")

# --- D 書を証人にする引っ越し（行範囲つき）------------------------------------
# 十国は本紀が立たずキャッシュが新五代史の世家なので、改元条は十国春秋の側に在る。
# **書ごと当てると同じ書の他国の改元に当たる**ので行範囲まで絞れているかを見る
BOOK_SPEC = "book:daizhigev20/史藏/载记/十国春秋.txt#1409-1431"
# CI にはコーパスが無く CORPUS_ROOT は None（`None / "…"` で落ちるので先に見る）
if Q.CORPUS_ROOT and (Q.CORPUS_ROOT / "daizhigev20/史藏/载记/十国春秋.txt").is_file():
    wl = Q._witness_lines(BOOK_SPEC)
    BOOK_CASES = [
        ("行範囲の中の改元条が証人になる（中興）", "中興", True),
        ("同じ書の別の巻にしか無い元号は当たらない（広政）", "広政", False),
    ]
    for name, era, want_hit in BOOK_CASES:
        hit = Q.era_anchor_hit(norm_for_match(era), wl)
        ok = bool(hit) == want_hit
        bad += 0 if ok else 1
        print(f"{'OK ' if ok else 'NG '} {name}  (hit={hit!r})")
    n_book = len(BOOK_CASES)
else:
    print("SKIP 十国春秋がコーパスに無いので書の証人は測っていない")
    n_book = 0

# --- D note を証人にする引っ越し（note:self・2026-08-20 康徳）------------------
# 正史の範囲外の改元（満洲国）はコーパスに底本が無い。event 自身の note に持つ
# 引用へ同じ定型句の隣接を求める（免除ではない。引用が無ければ落ちる）
KANGDE_NOTE = ("執政溥儀が皇帝に即位すると同時に「大同」から「康徳」に改元。即位詔書に"
               "「以大同三年三月一日，即皇帝位，改为康德元年，仍用满洲国号」とある。")
NOTESELF_CASES = [
    ("note の即位詔書引用が証人になる（康徳）", "康徳", True),
    ("note に無い元号は当たらない（大同単独）", "宣統", False),
]
for name, era, want_hit in NOTESELF_CASES:
    hit = Q.era_anchor_hit(norm_for_match(era), [norm_for_match(KANGDE_NOTE)])
    ok = bool(hit) == want_hit
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {name}  (hit={hit!r})")

# --- E ラチェット -------------------------------------------------------------
V.ERA_NAME_BASELINE = 3
errs = run({"eraName": "義嘉", "note": NOTE})
ok = len(errs) == 1 and any("基準線" in e for e in errs)
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 充足数が基準線を下回ると E が落ちる  ({len(errs)}件 / want 1)")
V.ERA_NAME_BASELINE = 0

# 分母（評価件数）が出ているか。出ていないと 0 エラーの意味が読めない
V.errors.clear(); V.infos.clear()
V.check_era_names({"emperors": [{"id": "t", "eraChangeCount": {"events": [{"note": NOTE}]}}]})
ok = any("改元 event 1件のうち eraName を持つのは 0件" in i for i in V.infos)
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 評価件数（分母）を出す")

total = (len(CASES) + len(D_CASES) + len(RECAST_CASES) + len(GLYPH_CASES)
         + len(PUA_CASES) + len(HAOYEAR_CASES) + len(CW_CASES) + n_book
         + len(NOTESELF_CASES) + 5)
#          5 = 大赦容器・C の限界・元号名だけの行・E・分母
print(f"\n{'全件一致' if not bad else str(bad) + '件 不一致'} / {total}件")
sys.exit(1 if bad else 0)
