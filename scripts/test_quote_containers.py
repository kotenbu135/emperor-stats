#!/usr/bin/env python3
"""書カタログと構造化引用の器の検出力を合成データで測る（Issue #69・計画7節の4）。

**このゲートは実データで一度も発火しない。** 移行した時点では `quotes[]` を持つ容器が
0件で、`bookId`・`volume` を書いたレコードも無いためで、本番の「0 errors」は
守れているのか何も見ていないのかを区別できない。器だけ先に入れる段では、
発火の証拠は合成レコードにしか無い（`test_date_claim_scope.py` と同じ理由）。

見るのは:

- カタログ単体の健全性（id の重複・`volumeIndex` の値・索引の詳細の欠け）
- `bookId` がカタログに在ること（＝コーパスに実在する書であること）
- **巻の索引を持たない書に `volume` を書けない**こと
  … 巻番号を機械で確かめられない書に巻を書くと、#53 の「巻番号の誤りが全ゲートを
    緑で通る」がそのまま戻る
- `quotes[]` の形（空配列・`text` の欠け・`bookId` の欠け）
- **`source.quote` と `quotes[]` の同居禁止**（引用の在りかを2つ持たない）
- 床のラチェット（構造化引用を持つ容器の数が基準線を下回ったら落ちる）
- 旧い器 `source.quote` の件数が上限を超えたら落ちる（散文側を増やさない）

    python3 scripts/test_quote_containers.py
"""
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


VE = _load("ve", "validate_emperors.py")

# 合成レコードには本番のラチェットを掛けない（在位も死因も持たない1人だけの
# データなので、本番の基準線を当てると全部「床を割った」になる）。
# ラチェットが効くこと自体は with_baseline で明示的に確かめる。
VE.QUOTE_FLOOR_BASELINE = {name: 0 for name in VE.FLOOR_UNITS}

fails = []


def check(label, cond):
    print(("ok   " if cond else "FAIL ") + label)
    if not cond:
        fails.append(label)


BOOKS = [
    {"id": "宋书", "volumeIndex": "daizhige-heading",
     "volumePath": "daizhigev20/史藏/正史/宋书.txt", "volumeScope": "all",
     "corpusVolumeMax": 100, "corpusVolumeCount": 100},
    {"id": "三国志", "volumeIndex": None},
]


def run(unit, books=None):
    """deathCause に容器を1つ置いて器のゲートを回す。"""
    VE.errors.clear()
    data = {
        "meta": {"catalogs": {"books": books if books is not None else BOOKS}},
        "emperors": [{"id": "test-emperor", "reigns": [], "deathCause": unit}],
    }
    VE.check_quote_containers(data)
    return list(VE.errors)


def run_books(books):
    VE.errors.clear()
    VE.check_quote_containers(
        {"meta": {"catalogs": {"books": books}}, "emperors": []})
    return list(VE.errors)


# --- カタログ単体 -----------------------------------------------------------
check("カタログ: 正しい形なら通る", run_books(BOOKS) == [])
check("カタログ: id の重複で落ちる",
      any("id が重複" in e for e in run_books(BOOKS + [{"id": "宋书", "volumeIndex": None}])))
check("カタログ: volumeIndex が知らない値なら落ちる",
      any("volumeIndex が不正" in e
          for e in run_books([{"id": "宋书", "volumeIndex": "手で書いた"}])))
check("カタログ: 索引が null なのに巻の詳細が在れば落ちる（引けないのに引ける顔をする）",
      any("詳細が在る" in e for e in
          run_books([{"id": "宋书", "volumeIndex": None, "corpusVolumeMax": 100}])))
check("カタログ: 索引が在るのに volumePath が無ければ落ちる",
      any("volumePath が無い" in e for e in
          run_books([{"id": "宋书", "volumeIndex": "daizhige-heading",
                      "volumeScope": "all", "corpusVolumeMax": 100,
                      "corpusVolumeCount": 100}])))
check("カタログ: meta.catalogs.books そのものが無ければ落ちる",
      any("meta.catalogs.books が無い" in e for e in run_books(None)))

# --- bookId と volume -------------------------------------------------------
check("bookId: カタログに在れば通る",
      run({"source": {"bookId": "宋书", "volume": 3}}) == [])
check("bookId: カタログに無い書は落ちる",
      any("bookId が meta.catalogs.books にない" in e
          for e in run({"source": {"bookId": "架空書", "volume": 1}})))
check("volume: 巻の索引が無い書に巻を書くと落ちる（#53 の穴を開け直さない）",
      any("volume を主張できない" in e
          for e in run({"source": {"bookId": "三国志", "volume": 2}})))
check("volume: bookId 無しで巻だけ書くと落ちる",
      any("bookId が無い" in e for e in run({"source": {"volume": 3}})))
check("volume: 0 や文字列は落ちる",
      any("1以上の整数" in e for e in run({"source": {"bookId": "宋书", "volume": 0}}))
      and any("1以上の整数" in e
              for e in run({"source": {"bookId": "宋书", "volume": "三"}})))
check("volume: 真偽値は整数として通さない",
      any("1以上の整数" in e for e in run({"source": {"bookId": "宋书", "volume": True}})))

# --- quotes[] の形 ----------------------------------------------------------
GOOD = {"bookId": "宋书", "volume": 3, "text": "丁未，帝崩于西殿"}
check("quotes: 正しい形なら通る", run({"quotes": [GOOD]}) == [])
check("quotes: 空配列は落ちる（無いなら欄を置かない）",
      any("1件以上の配列" in e for e in run({"quotes": []})))
check("quotes: text が空なら落ちる",
      any("text が空" in e for e in run({"quotes": [{"bookId": "宋书", "text": "  "}]})))
check("quotes: bookId が無ければ落ちる",
      any("bookId が無い" in e for e in run({"quotes": [{"text": "丁未，帝崩于西殿"}]})))
check("quotes: 巻の索引が無い書の巻はここでも落ちる",
      any("volume を主張できない" in e
          for e in run({"quotes": [{"bookId": "三国志", "volume": 2, "text": "臨崩"}]})))
check("quotes: source.quote との同居は落ちる（引用の在りかを2つ持たない）",
      any("同居している" in e
          for e in run({"source": {"quote": "丁未，帝崩于西殿"}, "quotes": [GOOD]})))
check("quotes: source.quote だけなら通る（既存の器は残す）",
      run({"source": {"quote": "丁未，帝崩于西殿"}}) == [])

# --- 床のラチェットと旧い器の上限 -------------------------------------------
def with_baseline(name, value, unit):
    orig = VE.QUOTE_FLOOR_BASELINE.get(name, 0)
    VE.QUOTE_FLOOR_BASELINE[name] = value
    try:
        return run(unit)
    finally:
        VE.QUOTE_FLOOR_BASELINE[name] = orig


check("床: 基準線を下回ると落ちる（転記した引用を消して戻せない）",
      any("床は減らさない" in e for e in with_baseline("deathCause", 1, {})))
check("床: 基準線を満たしていれば通る",
      with_baseline("deathCause", 1, {"quotes": [GOOD]}) == [])


def with_legacy_max(value, unit):
    orig = VE.LEGACY_SOURCE_QUOTE_MAX
    VE.LEGACY_SOURCE_QUOTE_MAX = value
    try:
        return run(unit)
    finally:
        VE.LEGACY_SOURCE_QUOTE_MAX = orig


check("旧い器: source.quote が上限を超えると落ちる（散文側を増やさない）",
      any("上限" in e for e in
          with_legacy_max(0, {"source": {"quote": "丁未，帝崩于西殿"}})))

# --- 床の単位が実データの容器名と合っているか -------------------------------
check("床の単位に8つの count 容器がすべて入っている",
      set(VE.COUNT_GROUPS) <= set(VE.FLOOR_UNITS))
check("床の単位に在位日・死因・即位経路が入っている",
      {"reigns[].duration", "deathCause", "accessionRoute"} <= set(VE.FLOOR_UNITS))

print()
if fails:
    print(f"{len(fails)} 件 FAIL: " + " / ".join(fails))
    sys.exit(1)
print("すべて ok")
