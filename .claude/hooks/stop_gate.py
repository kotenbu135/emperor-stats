#!/usr/bin/env python3
"""Stop フック — データに未コミット差分があるまま turn を終えるのを止める。

規則 R-GATES-BEFORE-COMMIT（docs/process/RULES.yml）の L1 実装。
ゲートは既に揃っているのに「走らせること自体」が人の記憶頼りで、
遼景宗の即位日1日ズレはそこをすり抜けて note に埋もれた。

設計で決めたこと:

- **走ったかどうかを帳簿で追わず、その場で走らせる。**「実行済みか」を記録から judge すると
  「走ったが落ちていた」を通してしまう。軽いゲートは全部合わせて 1 秒未満なので、
  差分があるときだけ実際に流したほうが正確で安い。
- **重いゲートは走らせず、走っていないことだけ告げる。** verify_quotes.py --check は 344 秒
  かかる。turn ごとに流すと手が止まるので、最後の実行がデータの更新より古いときに
  「まだ走っていない」と言うに留める（合格したとは言えない。PreToolUse は起動しか見ていない）。
- **stop_hook_active なら素通しする。** 意図的に途中で止める turn（ユーザーへの質問など）が
  あるので、止めるのは1回だけ。忘れを防ぐには1回で足り、2回目以降は作業妨害になる。
"""
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

RULE_ID = "R-GATES-BEFORE-COMMIT"

# 変更されたファイル → 必ず流す軽いゲート（いずれも 1 秒未満）
LIGHT_GATES = [
    ("data/emperors.json", ["validate_emperors.py", "verify_calendar.py"]),
    ("data/kinship.json", ["validate_kinship.py"]),
    ("data/name-readings.json", ["validate_readings.py"]),
    ("data/emperor-profiles.json", ["validate_readings.py", "validate_profiles.py"]),
    ("data/regime-conventions.json", ["check_regime_conventions.py"]),
]

# 引用・日付を触ったときだけ必要になる重いゲート（344 秒・走らせない）
HEAVY_TRIGGER = re.compile(r'"(quote|date|startDate|endDate|deathDate|birthDate|note)"')
HEAVY_RAN = re.compile(r"verify_quotes\.py.*?--check(?![-\w])")


def log(root, rec):
    """発火を毎回残す。0 件の block は「守られている」と「掛かっていない」を区別しない。"""
    try:
        p = Path(root) / ".claude" / "hook-log.jsonl"
        p.parent.mkdir(parents=True, exist_ok=True)
        rec.update(rule=RULE_ID, ts=time.strftime("%Y-%m-%dT%H:%M:%S"))
        with p.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except Exception:  # noqa: BLE001
        pass


def run(cmd, cwd, timeout=180):
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except subprocess.TimeoutExpired:
        return 124, f"{' '.join(cmd)} が {timeout} 秒で終わりませんでした"
    except Exception as exc:  # noqa: BLE001
        return 125, f"{' '.join(cmd)} を起動できませんでした: {exc}"


def changed_data_files(root):
    """未コミットの data/*.json（staged・unstaged・untracked をまとめて）。"""
    rc, out = run(["git", "status", "--porcelain", "--", "data"], root, timeout=30)
    if rc != 0:
        return []
    files = []
    for line in out.splitlines():
        path = line[3:].strip().strip('"')
        if " -> " in path:            # rename
            path = path.split(" -> ")[-1]
        if path.endswith(".json"):
            files.append(path)
    return files


def heavy_gate_note(root, changed):
    """重いゲートが「今回の変更より後に起動されていない」ときだけ一言返す。"""
    if not any(f in ("data/emperors.json", "data/quote-refs.json") for f in changed):
        return None
    rc, diff = run(["git", "diff", "-U0", "HEAD", "--", "data/emperors.json",
                    "data/quote-refs.json"], root, timeout=60)
    if rc != 0 or not HEAVY_TRIGGER.search(diff):
        return None   # 引用・日付は触っていない

    target = Path(root) / "data" / "emperors.json"
    mtime = target.stat().st_mtime if target.exists() else 0
    log = Path(root) / ".claude" / "hook-log.jsonl"
    if log.exists():
        try:
            for line in reversed(log.read_text(encoding="utf-8").splitlines()):
                rec = json.loads(line)
                if not HEAVY_RAN.search(rec.get("detail") or ""):
                    continue
                ts = time.mktime(time.strptime(rec["ts"], "%Y-%m-%dT%H:%M:%S"))
                return None if ts >= mtime else _heavy_msg(rec["ts"])
        except Exception:  # noqa: BLE001
            pass
    return _heavy_msg(None)


def _heavy_msg(last):
    when = f"最後の起動は {last} で、その後にデータが変わっています" if last else "起動の記録がありません"
    return ("引用または日付を変更しています。`python3 scripts/verify_quotes.py --backfill && "
            "--check` の合格がコミット条件です（"
            f"{when}）。344 秒かかるのでコミット直前に1回・バックグラウンドで流してください")


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:  # noqa: BLE001
        sys.exit(0)

    # 止めるのは1回だけ。意図的に途中で止める turn を握りつぶさないため。
    if data.get("stop_hook_active"):
        sys.exit(0)

    root = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()
    if not (Path(root) / "data").is_dir():
        sys.exit(0)

    changed = changed_data_files(root)
    if not changed:
        sys.exit(0)

    scripts, why = [], {}
    for path, gates in LIGHT_GATES:
        if path in changed:
            for g in gates:
                if g not in scripts and (Path(root) / "scripts" / g).exists():
                    scripts.append(g)
                    why.setdefault(g, path)

    failures = []
    for g in scripts:
        rc, out = run(["python3", f"scripts/{g}"], root)
        if rc != 0:
            tail = "\n".join([ln for ln in out.strip().splitlines() if ln.strip()][-12:])
            failures.append(f"■ scripts/{g}（{why[g]} を変更したため実行）\n{tail}")

    note = heavy_gate_note(root, changed)
    log(root, {
        "decision": "block" if failures else ("note" if note else "pass"),
        "tool": "Stop", "actor": "main",
        "detail": f"{','.join(changed)} → {','.join(scripts) or '該当ゲートなし'}",
    })

    if failures:
        print("データに未コミットの差分があり、ゲートが落ちています。"
              "訂正してからもう一度終えてください。\n\n" + "\n\n".join(failures) +
              (f"\n\n【あわせて】{note}" if note else "") +
              "\n\nこの差分が意図的に途中の状態なら、その旨を述べてもう一度終えてください"
              "（2回目は止めません）。", file=sys.stderr)
        sys.exit(2)

    if note:
        # 重い側は止めない。走っていないことだけ伝える。
        print(json.dumps({"continue": True, "systemMessage": note}, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    # ガードの例外で turn を終われなくしない。落ちたら素通しして stderr に出す。
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        print(f"[stop_gate.py] 内部エラーのため素通しします: {exc}", file=sys.stderr)
        sys.exit(0)
