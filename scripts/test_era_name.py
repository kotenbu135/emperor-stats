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
    ("5字は A が落ちる",
     {"eraName": "天啓万暦義", "note": "天啓万暦義"}, 1),
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

# 元号名だけが在る行（「天启三年」）を当たりに数えないこと。D の主力はこの区別
hit = Q.era_anchor_hit(norm_for_match("天啓"), [LINES[1]])
ok = hit is None
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 元号名が在るだけの行は D の当たりにしない  (hit={hit!r})")

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

total = len(CASES) + len(D_CASES) + 5
print(f"\n{'全件一致' if not bad else str(bad) + '件 不一致'} / {total}件")
sys.exit(1 if bad else 0)
