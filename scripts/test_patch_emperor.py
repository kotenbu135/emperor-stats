#!/usr/bin/env python3
"""patch_emperor.py の検査（ローカル専用・data/emperors.json は触らない）。

見るのは2つ。**転記の道具として正しく動くか**と、**R-NO-AUTOGEN の境界が
設計で保たれているか**（値を作れない・1人しか触れない・構造を作らない）。
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOL = ROOT / "scripts" / "patch_emperor.py"

SAMPLE = {
    "meta": {"version": "3", "counts": {"total": 2}},
    "emperors": [
        {"id": "alpha", "deathCause": {"category": "illness", "source": {"page": "晉書"}},
         "reigns": [{"startYear": 290, "endYear": 306, "note": "旧note"}],
         "amnestyCount": {"count": 1, "events": [{"date": "0290-05-16"}]},
         "ages": {"deathAge": 48}},
        {"id": "beta", "deathCause": {"category": "unknown"}},
    ],
}


def run(args, data=None):
    """一時ファイルを data/emperors.json に見立てて起動する。"""
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        (root / "data").mkdir()
        (root / "scripts").mkdir()
        target = root / "data" / "emperors.json"
        target.write_text(json.dumps(data or SAMPLE, ensure_ascii=False, indent=1) + "\n",
                          encoding="utf-8")
        (root / "scripts" / "patch_emperor.py").write_bytes(TOOL.read_bytes())
        p = subprocess.run([sys.executable, str(root / "scripts" / "patch_emperor.py")] + args,
                           capture_output=True, text=True, cwd=root)
        return p.returncode, p.stdout + p.stderr, json.loads(target.read_text(encoding="utf-8"))


def rec(out, eid="alpha"):
    return [e for e in out["emperors"] if e["id"] == eid][0]


cases = []


def case(name, fn):
    cases.append((name, fn))


case("既存フィールドを置き換える", lambda: (
    lambda rc, log, out: rc == 0 and rec(out)["deathCause"]["category"] == "poisoning"
)(*run(["alpha", "--set", 'deathCause.category="poisoning"'])))

case("他レコードに触らない", lambda: (
    lambda rc, log, out: rec(out, "beta")["deathCause"]["category"] == "unknown"
)(*run(["alpha", "--set", 'deathCause.category="poisoning"'])))

case("meta に触らない", lambda: (
    lambda rc, log, out: out["meta"] == SAMPLE["meta"]
)(*run(["alpha", "--set", 'deathCause.category="poisoning"'])))

case("--dry-run は書かない", lambda: (
    lambda rc, log, out: rc == 0 and rec(out)["deathCause"]["category"] == "illness"
)(*run(["alpha", "--set", 'deathCause.category="x"', "--dry-run"])))

case("綴り違いの新キーは落ちる", lambda: (
    lambda rc, log, out: rc != 0 and "--allow-new-key" in log
)(*run(["alpha", "--set", 'deathCause.catgory="x"'])))

case("--allow-new-key なら新設できる", lambda: (
    lambda rc, log, out: rc == 0 and rec(out)["deathCause"]["claim"] == "病死"
)(*run(["alpha", "--set", 'deathCause.claim="病死"', "--allow-new-key"])))

case("中間コンテナは作らない", lambda: (
    lambda rc, log, out: rc != 0 and "中間コンテナは作りません" in log
)(*run(["alpha", "--set", 'foo.bar="x"', "--allow-new-key"])))

case("存在しない id は触らない", lambda: (
    lambda rc, log, out: rc != 0 and "1件でないと触りません" in log
)(*run(["gamma", "--set", 'deathCause.category="x"'])))

case("id は1回に1人（複数指定はできない）", lambda: (
    lambda rc, log, out: rc != 0
)(*run(["alpha", "beta", "--set", 'deathCause.category="x"'])))

case("--set-str は右辺をそのまま文字列にする", lambda: (
    lambda rc, log, out: rc == 0 and rec(out)["reigns"][0]["note"] == 'a="b" の形'
)(*run(["alpha", "--set-str", 'reigns[0].note=a="b" の形'])))

case("添字つきパスを解く", lambda: (
    lambda rc, log, out: rc == 0 and rec(out)["amnestyCount"]["events"][0]["date"] == "0290-06-01"
)(*run(["alpha", "--set", 'amnestyCount.events[0].date="0290-06-01"'])))

case("範囲外の添字は落ちる", lambda: (
    lambda rc, log, out: rc != 0
)(*run(["alpha", "--set", 'amnestyCount.events[9].date="x"'])))

case("--append は既存配列の末尾に足す", lambda: (
    lambda rc, log, out: rc == 0 and len(rec(out)["amnestyCount"]["events"]) == 2
)(*run(["alpha", "--append", 'amnestyCount.events={"date": "0291-01-01"}'])))

case("--unset はキーを消す", lambda: (
    lambda rc, log, out: rc == 0 and "page" not in rec(out)["deathCause"]["source"]
)(*run(["alpha", "--unset", "deathCause.source.page"])))

case("配列要素の削除はしない", lambda: (
    lambda rc, log, out: rc != 0 and "添字が全部ずれる" in log
)(*run(["alpha", "--unset", "amnestyCount.events[0]"])))

case("変更ゼロは落ちる", lambda: (
    lambda rc, log, out: rc != 0
)(*run(["alpha"])))

case("note を触るとゲート案内に verify_quotes が出る", lambda: (
    lambda rc, log, out: "verify_quotes.py" in log
)(*run(["alpha", "--set-str", "reigns[0].note=x", "--dry-run"])))

case("日付を触るとゲート案内に verify_calendar が出る", lambda: (
    lambda rc, log, out: "verify_calendar.py" in log
)(*run(["alpha", "--set", 'reigns[0].endYear=307', "--dry-run"])))

case("値を触らない道具には計算機能が無い", lambda: (
    not any(m in TOOL.read_text(encoding="utf-8")
            for m in ("import datetime", "import math", "from datetime"))
))

def untouched_lines_stable():
    """書き出しはファイル全体の再直列化になる。触っていない行が1行も動かないことを見る。

    ここが崩れると、訂正1件のコミットに364人ぶんの差分が乗って
    他セッションのレビューを潰す（並行セッション前提のリポジトリでの実害）。
    """
    before = (json.dumps(SAMPLE, ensure_ascii=False, indent=1) + "\n").splitlines()
    rc, _, out = run(["alpha", "--set", 'deathCause.category="poisoning"'])
    after = (json.dumps(out, ensure_ascii=False, indent=1) + "\n").splitlines()
    diff = [(a, b) for a, b in zip(before, after) if a != b]
    return rc == 0 and len(before) == len(after) and len(diff) == 1


case("触っていない行は1行も動かない", untouched_lines_stable)

bad = 0
for name, ok in cases:
    passed = bool(ok() if callable(ok) else ok)
    bad += 0 if passed else 1
    print(f"{'OK ' if passed else 'NG '} {name}")
print(f"\n{'全件一致' if not bad else str(bad) + '件 不一致'} / {len(cases)}件")
sys.exit(1 if bad else 0)
