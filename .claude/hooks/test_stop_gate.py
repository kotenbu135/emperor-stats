#!/usr/bin/env python3
"""stop_gate.py のテスト。

    python3 .claude/hooks/test_stop_gate.py

合成データのテストは「フックの中身」しか見ない。settings.json 経由で実際に発火するか、
turn の終わりで本当に止まるかは別に測ること（guard.py で一度これを取り違えた）。
"""
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HOOK = Path(__file__).resolve().parent / "stop_gate.py"

GATE_OK = "import sys\nprint('0 errors')\nsys.exit(0)\n"
GATE_NG = "import sys\nprint('ERROR  reigns[0].endDate が没年と食い違います')\nsys.exit(1)\n"
# 引数が渡ったときだけ落ちる贋物。引数なしで呼ばれたら 0 で返るので、
# 「--check が渡っている」ことだけを見分ける
ARGV_NG = ("import sys\n"
           "if '--check' in sys.argv:\n"
           "    print('PROJECT_STATUS.md の進捗表記が実測とずれています')\n"
           "    sys.exit(1)\n")


def make_repo(tmp, gates):
    """data/ と scripts/ を持つ git リポジトリを作り、コミット済みの状態にする。"""
    root = Path(tmp)
    (root / "data").mkdir()
    (root / "scripts").mkdir()
    (root / ".claude").mkdir()
    for name in ("emperors.json", "kinship.json", "regime-conventions.json",
                 "screenings.json"):
        (root / "data" / name).write_text('{"emperors": []}\n', encoding="utf-8")
    for name, body in gates.items():
        (root / "scripts" / name).write_text(body, encoding="utf-8")
    env = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t",
           "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t"}
    for cmd in (["git", "init", "-q"], ["git", "add", "data", "scripts"],
                ["git", "commit", "-qm", "init"]):
        subprocess.run(cmd, cwd=root, env=env, check=True, capture_output=True)
    return root


def fire(root, stop_hook_active=False, payload=None):
    env = {k: v for k, v in os.environ.items() if k != "CLAUDE_PROJECT_DIR"}
    data = {"cwd": str(root), "stop_hook_active": stop_hook_active}
    p = subprocess.run([sys.executable, str(HOOK)], input=payload if payload is not None
                       else json.dumps(data), capture_output=True, text=True, env=env)
    return p.returncode, p.stdout, p.stderr


def dirty(root, name="emperors.json", body='{"emperors": [1]}\n'):
    (root / "data" / name).write_text(body, encoding="utf-8")


def main():
    fails = []

    def check(label, cond, detail=""):
        print(("  ok   " if cond else "  FAIL ") + label + ("" if cond else f" — {detail}"))
        if not cond:
            fails.append(label)

    gates_ok = {"validate_emperors.py": GATE_OK, "verify_calendar.py": GATE_OK,
                "validate_kinship.py": GATE_OK, "check_regime_conventions.py": GATE_OK,
                "check_screenings.py": GATE_OK}
    gates_ng = {**gates_ok, "validate_emperors.py": GATE_NG}

    print("差分が無ければ何もしない")
    with tempfile.TemporaryDirectory() as tmp:
        root = make_repo(tmp, gates_ok)
        rc, out, err = fire(root)
        check("差分なし → 素通し", rc == 0 and not out.strip() and not err.strip(), f"{rc} {out} {err}")

    print("差分があればゲートを流す")
    with tempfile.TemporaryDirectory() as tmp:
        root = make_repo(tmp, gates_ok)
        dirty(root)
        rc, out, err = fire(root)
        check("ゲート合格 → 素通し", rc == 0 and not err.strip(), f"{rc} {err}")
        log = (root / ".claude" / "hook-log.jsonl").read_text(encoding="utf-8")
        check("通過も記録される（0件の block を分母と区別する）",
              '"decision": "pass"' in log, log)

    with tempfile.TemporaryDirectory() as tmp:
        root = make_repo(tmp, gates_ng)
        dirty(root)
        rc, out, err = fire(root)
        check("ゲート不合格 → 止める", rc == 2, f"{rc} {err}")
        check("落ちたスクリプト名が出る", "validate_emperors.py" in err, err)
        check("落ちた理由の本文が出る", "endDate" in err, err)
        check("合格したゲートは出さない", "verify_calendar" not in err, err)

    print("止めるのは1回だけ")
    with tempfile.TemporaryDirectory() as tmp:
        root = make_repo(tmp, gates_ng)
        dirty(root)
        rc, out, err = fire(root, stop_hook_active=True)
        check("stop_hook_active → 素通し（意図的に途中で止める turn を潰さない）",
              rc == 0, f"{rc} {err}")

    print("変更したファイルに対応するゲートだけを流す")
    with tempfile.TemporaryDirectory() as tmp:
        root = make_repo(tmp, {**gates_ok, "validate_kinship.py": GATE_NG})
        dirty(root, "kinship.json", '{"persons": [1]}\n')
        rc, out, err = fire(root)
        check("kinship の差分 → validate_kinship が落ちる", rc == 2 and "validate_kinship" in err,
              f"{rc} {err}")
        check("emperors 用のゲートは流れない", "validate_emperors" not in err, err)

    with tempfile.TemporaryDirectory() as tmp:
        root = make_repo(tmp, {**gates_ok, "check_regime_conventions.py": GATE_NG})
        dirty(root, "regime-conventions.json", '{"conventions": [1]}\n')
        rc, out, err = fire(root)
        check("政権慣行の差分 → check_regime_conventions が落ちる",
              rc == 2 and "check_regime_conventions" in err, f"{rc} {err}")

    with tempfile.TemporaryDirectory() as tmp:
        root = make_repo(tmp, {**gates_ok, "check_screenings.py": GATE_NG})
        dirty(root, "screenings.json", '{"screenings": [1]}\n')
        rc, out, err = fire(root)
        check("絞り込みの差分 → check_screenings が落ちる",
              rc == 2 and "check_screenings" in err, f"{rc} {err}")

    # 母集団は emperors.json から出るので、値を埋めれば絞り込みの記録が古くなる
    with tempfile.TemporaryDirectory() as tmp:
        root = make_repo(tmp, {**gates_ok, "check_screenings.py": GATE_NG})
        dirty(root, "emperors.json", '{"emperors": [1]}\n')
        rc, out, err = fire(root)
        check("emperors の差分 → check_screenings も流れる",
              rc == 2 and "check_screenings" in err, f"{rc} {err}")

    # coverage.py は既定の動作が検査ではない（報告を出して 0 で返る）。
    # 引数が渡っていなければ素通しになるので、渡っていることを直接見る
    with tempfile.TemporaryDirectory() as tmp:
        root = make_repo(tmp, {**gates_ok, "coverage.py": ARGV_NG})
        dirty(root, "emperors.json", '{"emperors": [1]}\n')
        rc, out, err = fire(root)
        check("emperors の差分 → coverage.py に --check が渡る",
              rc == 2 and "進捗表記が実測とずれています" in err, f"{rc} {err}")

    with tempfile.TemporaryDirectory() as tmp:
        root = make_repo(tmp, {**gates_ok, "coverage.py": ARGV_NG})
        dirty(root, "emperor-profiles.json", '{"profiles": {}}\n')
        rc, out, err = fire(root)
        check("紹介文の差分 → coverage.py も流れる",
              rc == 2 and "coverage.py --check" in err, f"{rc} {err}")

    print("重いゲートは走らせず、走っていないことだけ告げる")
    with tempfile.TemporaryDirectory() as tmp:
        root = make_repo(tmp, gates_ok)
        dirty(root, body='{"emperors": [{"quote": "崩于西堂"}]}\n')
        rc, out, err = fire(root)
        msg = json.loads(out) if out.strip() else {}
        check("引用を触った → verify_quotes 未起動を告げる",
              rc == 0 and "verify_quotes" in (msg.get("systemMessage") or ""), f"{rc} {out}")
        check("告げるだけで止めない", msg.get("continue") is True, out)

    with tempfile.TemporaryDirectory() as tmp:
        root = make_repo(tmp, gates_ok)
        dirty(root, body='{"emperors": [{"posthumousName": "武帝"}]}\n')
        rc, out, err = fire(root)
        check("引用・日付を触っていなければ黙る", rc == 0 and not out.strip(), f"{rc} {out}")

    with tempfile.TemporaryDirectory() as tmp:
        root = make_repo(tmp, gates_ok)
        dirty(root, body='{"emperors": [{"quote": "崩于西堂"}]}\n')
        time.sleep(1.1)   # ts は秒精度なので、確実に mtime より後になるようにする
        (root / ".claude" / "hook-log.jsonl").write_text(json.dumps({
            "rule": "R-GATES-BEFORE-COMMIT", "decision": "gate",
            "detail": "python3 scripts/verify_quotes.py --check",
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }, ensure_ascii=False) + "\n", encoding="utf-8")
        rc, out, err = fire(root)
        check("変更より後に起動されていれば黙る", rc == 0 and not out.strip(), f"{rc} {out}")

    with tempfile.TemporaryDirectory() as tmp:
        root = make_repo(tmp, gates_ok)
        (root / ".claude" / "hook-log.jsonl").write_text(json.dumps({
            "rule": "R-GATES-BEFORE-COMMIT", "decision": "gate",
            "detail": "python3 scripts/verify_quotes.py --check-coverage",
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }, ensure_ascii=False) + "\n", encoding="utf-8")
        time.sleep(1.1)
        dirty(root, body='{"emperors": [{"quote": "崩于西堂"}]}\n')
        rc, out, err = fire(root)
        check("--check-coverage は --check の代わりにならない",
              rc == 0 and "verify_quotes" in out, f"{rc} {out}")

    print("壊れた入力・想定外の場所で turn を終われなくしない")
    with tempfile.TemporaryDirectory() as tmp:
        root = make_repo(tmp, gates_ng)
        dirty(root)
        rc, out, err = fire(root, payload="{ not json")
        check("読めない入力 → 素通し", rc == 0, f"{rc} {err}")
    with tempfile.TemporaryDirectory() as tmp:
        rc, out, err = fire(Path(tmp))   # data/ が無い
        check("data/ が無い場所 → 素通し", rc == 0, f"{rc} {err}")

    print(f"\n{len(fails)} failed")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
