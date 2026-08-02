#!/usr/bin/env python3
"""claim 欄の検査（validate_emperors.py の check_claim_fields）を、合成レコードで確かめる。

**この検査は当面 0 件のデータに掛かる**（claim は任意で、既存 note に遡及しないため）。
0 エラーが「守れている」なのか「そもそも何も見ていない」なのかを、実データでは
区別できない。だからここで検出力そのものを測る。
"""
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("v", ROOT / "scripts" / "validate_emperors.py")
V = importlib.util.module_from_spec(spec)
spec.loader.exec_module(V)


def run(record):
    V.errors.clear()
    V.warnings.clear()
    V.infos.clear()
    V.check_claim_fields({"emperors": [dict(record, id="t")]})
    return list(V.errors), list(V.infos)


CASES = [
    ("前向きな claim は通る",
     {"amnestyCount": {"count": 3, "note": "現行 2 → 3 に訂正した", "claim": "大赦は3回。"}}, 0),
    ("作業ログの印（訂正・現行）を弾く",
     {"deathCause": {"claim": "現行の病死から毒殺へ訂正した"}}, 2),
    ("矢印を弾く",
     {"deathCause": {"claim": "病死→毒殺"}}, 1),
    ("count と食い違えば落ちる（件数は算用数字）",
     {"amnestyCount": {"count": 3, "claim": "大赦は二回。"}}, 1),
    ("原文引用の混入を弾く（照合台帳は claim を見ない）",
     {"deathCause": {"claim": "「冬十月戊辰帝崩于顕陽殿」により病死とみる。"}}, 1),
    ("日本語の短い鉤括弧は通る",
     {"deathCause": {"claim": "いわゆる「毒殺説」は採らない。"}}, 0),
    ("空文字・空白のみは落ちる",
     {"deathCause": {"claim": "  "}}, 1),
    ("claim が無いレコードは何も言わない（遡及しないため既定）",
     {"deathCause": {"note": "現行 X → Y に訂正"}}, 0),
    ("events[] の中に書かれていても見る",
     {"amnestyCount": {"count": 1, "claim": "1回。", "events": [{"claim": "現行の記述"}]}}, 1),
    ("確定できないという主張は前向きなので通る",
     {"ages": {"claim": "生年が原典に無く、即位時の年齢は確定できない。"}}, 0),
    # 史実の日本語と衝突する語を印に入れると、最初に claim を書いた人が誤検出に当たって
    # 「このゲートは壊れている」と結論する。改元・遷都・皇太子廃立で実際に出る言い回し
    ("改元の「〜に改め」は通る",
     {"eraChangeCount": {"count": 3, "claim": "元号を3回立て、最後は建武に改めた。"}}, 0),
    ("遷都の「〜から〜へ変更」は通る",
     {"capitalRelocationCount": {"count": 2, "claim": "都を2回移し、洛陽から長安へ変更した。"}}, 0),
    ("皇太子廃立の「差し替え」は通る",
     {"crownPrinceDepositionCount": {"count": 1, "claim": "皇太子を1回差し替えた。"}}, 0),
]

bad = 0
for name, record, want in CASES:
    errs, infos = run(record)
    ok = len(errs) == want
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {name}  ({len(errs)}件 / want {want})")
    if not ok:
        for e in errs:
            print(f"       {e[:140]}")

# 分母（評価件数）そのものが出ているか。出ていないと 0 エラーの意味が読めない
errs, infos = run({"deathCause": {"claim": "病死。"}})
ok = any("1 件を評価" in i for i in infos)
bad += 0 if ok else 1
print(f"{'OK ' if ok else 'NG '} 評価件数（分母）を出す")

print(f"\n{'全件一致' if not bad else str(bad) + '件 不一致'} / {len(CASES) + 1}件")
sys.exit(1 if bad else 0)
