#!/usr/bin/env python3
"""第N代の検査（validate_emperors.py の check_dynasty_order）を、合成レコードで測る。

**実データは違反0件**なので、本番の「0 errors」だけでは「守れている」と
「そもそも何も見ていない」を区別できない（`test_conflicts_field.py` と同じ理由）。

とくに 2026-08-20 に足した重複検査は、**それが無かった間、復位に元の番号を
再利用した形が全ゲートを緑で通った**（南宋 高宗に 10/10 を割り当てた1段目の出力）。
検出力をここで固定する。

**欠番は検査しない**ことも合わせて測る — 本データ365人に収録の無い君主が並びに
入る政権が実際にあり（前涼は7だけ・清はヌルハチが第1・元は太祖〜憲宗が1〜4）、
連番性を要求すると正しいデータが落ちる。
"""
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


V = _load("v", "validate_emperors.py")


def run(regimes, emperors):
    V.errors.clear()
    V.warnings.clear()
    V.infos.clear()
    V.check_dynasty_order({"meta": {"catalogs": {"regimes": regimes}},
                           "emperors": emperors})
    return list(V.errors)


SURVEYED = [{"id": "r1", "dynastyOrderSurveyed": True}]
UNSURVEYED = [{"id": "r1", "dynastyOrderSurveyed": False}]


def reign(order=..., **kw):
    r = dict(kw)
    if order is not ...:
        r["dynastyOrder"] = order
    return r


CASES = [
    # (名前, regimes, emperors, エラーが出るべきか, 期待する語)
    ("調査済み・連番",
     SURVEYED,
     [{"id": "a", "regimeId": "r1", "reigns": [reign(1)]},
      {"id": "b", "regimeId": "r1", "reigns": [reign(2)]}],
     False, None),
    ("調査済み・復位に別番号（西晋 恵帝2/司馬倫3/恵帝4 の形）",
     SURVEYED,
     [{"id": "a", "regimeId": "r1", "reigns": [reign(2), reign(4)]},
      {"id": "b", "regimeId": "r1", "reigns": [reign(3)]}],
     False, None),
    ("調査済み・欠番（清のヌルハチが第1で不在の形）",
     SURVEYED,
     [{"id": "a", "regimeId": "r1", "reigns": [reign(2)]},
      {"id": "b", "regimeId": "r1", "reigns": [reign(3)]}],
     False, None),
    ("調査済み・歴代に数えない null",
     SURVEYED,
     [{"id": "a", "regimeId": "r1", "reigns": [reign(1)]},
      {"id": "b", "regimeId": "r1", "reigns": [reign(None)]}],
     False, None),
    ("★復位に同じ番号を再利用（2026-08-20 に足した検査）",
     SURVEYED,
     [{"id": "a", "regimeId": "r1", "reigns": [reign(10), reign(10)]}],
     True, "重複"),
    ("★別人どうしで同じ番号",
     SURVEYED,
     [{"id": "a", "regimeId": "r1", "reigns": [reign(5)]},
      {"id": "b", "regimeId": "r1", "reigns": [reign(5)]}],
     True, "重複"),
    ("政権が違えば同じ番号でよい",
     [{"id": "r1", "dynastyOrderSurveyed": True},
      {"id": "r2", "dynastyOrderSurveyed": True}],
     [{"id": "a", "regimeId": "r1", "reigns": [reign(1)]},
      {"id": "b", "regimeId": "r2", "reigns": [reign(1)]}],
     False, None),
    ("★調査済みなのに欄が無い",
     SURVEYED,
     [{"id": "a", "regimeId": "r1", "reigns": [reign()]}],
     True, "欄が無い"),
    ("★未調査なのに欄が在る",
     UNSURVEYED,
     [{"id": "a", "regimeId": "r1", "reigns": [reign(1)]}],
     True, "欄が在る"),
    ("未調査・欄なし",
     UNSURVEYED,
     [{"id": "a", "regimeId": "r1", "reigns": [reign()]}],
     False, None),
]


def main():
    bad = 0
    for name, regimes, emperors, should_fail, word in CASES:
        errs = run(regimes, emperors)
        got = bool(errs)
        ok = got == should_fail and (not word or any(word in e for e in errs))
        print(f"{'ok  ' if ok else 'NG  '}{name}"
              + (f" → {errs[0][:80]}" if errs else ""))
        if not ok:
            bad += 1
    print(f"---\n{len(CASES) - bad}/{len(CASES)} 通過")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
