#!/usr/bin/env python3
"""Stop フック — データに未コミット差分があるまま turn を終えるのを止める。

規則 R-GATES-BEFORE-COMMIT（docs/process/RULES.yml）の L1 実装。
ゲートは既に揃っているのに「走らせること自体」が人の記憶頼りで、
遼景宗の即位日1日ズレはそこをすり抜けて note に埋もれた。

設計で決めたこと:

- **走ったかどうかを帳簿で追わず、その場で走らせる。**「実行済みか」を記録から judge すると
  「走ったが落ちていた」を通してしまう。軽いゲートは全部合わせて 1 秒未満なので、
  差分があるときだけ実際に流したほうが正確で安い。
- **引用照合ゲートもここで流す（2026-08-02 変更）。** もとは verify_quotes.py --check が
  344 秒かかるため「走っていないことだけ告げる」設計だったが、判定結果のスタンプで
  1 秒未満になったので実際に流して落ちていれば止める。ただし初回（キャッシュ構築）は
  数分かかりうるので QUOTE_TIMEOUT で打ち切り、**打ち切ったときは止めずに旧来の
  「まだ走っていない」通知へ落とす**（turn の終了をキャッシュ構築で人質に取らない）。
- **--backfill はここから流さない。** 台帳（data/quote-refs.json）を書き換えるフックは
  「止めるために data を触る」ことになる。台帳が未更新なら --check が
  「台帳に未登録の引用」で落ちるので、検出はそちらで足りる。
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
# 引用・日付を触ったときだけ流す 2 本（--check は R-QUOTE-GLYPH、--check-books は R-QUOTE-BOOK）
QUOTE_RULE_IDS = ("R-QUOTE-GLYPH", "R-QUOTE-BOOK")

# 変更されたファイル → 必ず流す軽いゲート（いずれも 1 秒未満）
LIGHT_GATES = [
    # 絞り込みの母集団も進捗表記も emperors.json から出るので、値を埋めれば
    # 記録の数字が古くなる（coverage.py --check は PROJECT_STATUS.md の生成領域を見る）
    ("data/emperors.json", ["validate_emperors.py", "verify_calendar.py",
                            "check_screenings.py", "coverage.py --check"]),
    ("data/kinship.json", ["validate_kinship.py", "coverage.py --check"]),
    ("data/name-readings.json", ["validate_readings.py"]),
    ("data/emperor-profiles.json", ["validate_readings.py", "validate_profiles.py",
                                    "coverage.py --check"]),
    ("data/regime-conventions.json", ["check_regime_conventions.py"]),
    ("data/screenings.json", ["check_screenings.py"]),
    ("data/verification.json", ["check_verification.py"]),
]

# 引用・日付を触ったときだけ必要になるゲート
QUOTE_TRIGGER = re.compile(r'"(quote|date|startDate|endDate|deathDate|birthDate|note)"')
# キャッシュが温まっていれば 0.3 秒。初回のキャッシュ構築だけは数分かかるので打ち切る
QUOTE_TIMEOUT = 40


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


def uncommitted_capture(root):
    """suggestion_capture.py が追記したまま置き去りになっている採取差分の件数。

    フックは primary（main）へ直接書くので、書かせたセッションがコミットせずに
    終わると差分だけが main に残る。実際に29件ぶんが4日にわたって溜まり、
    次のセッションが `git pull` できなくなった（2026-08-08 ユーザー指摘）。
    """
    target = "docs/process/PROCESS_IMPROVEMENTS.md"
    rc, out = run(["git", "status", "--porcelain", "--", target], root, timeout=30)
    if rc != 0 or not out.strip():
        return 0
    rc, diff = run(["git", "diff", "HEAD", "--", target], root, timeout=30)
    if rc != 0:
        return 0
    return len([ln for ln in diff.splitlines()
                if ln.startswith("+### ") and "auto:" in ln])


def quote_gate_needed(root, changed):
    """引用・日付を触ったか（触っていなければ照合ゲートは要らない）。"""
    if not any(f in ("data/emperors.json", "data/quote-refs.json") for f in changed):
        return False
    rc, diff = run(["git", "diff", "-U0", "HEAD", "--", "data/emperors.json",
                    "data/quote-refs.json"], root, timeout=60)
    return rc == 0 and bool(QUOTE_TRIGGER.search(diff))


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

    captured = uncommitted_capture(root)
    capture_msg = (
        f"docs/process/PROCESS_IMPROVEMENTS.md に未コミットの採取が{captured}件あります"
        "（suggestion_capture.py が turn の終わりに書いたもの）。"
        "`git add docs/process/PROCESS_IMPROVEMENTS.md` で今回の変更と一緒にコミットしてください"
        "（パスは明示・R-GIT-ADDALL）。溜めると次のセッションが pull できなくなります。"
    ) if captured else None

    changed = changed_data_files(root)
    if not changed:
        if capture_msg:
            log(root, {"decision": "block", "tool": "Stop", "actor": "main",
                       "detail": f"採取{captured}件が未コミット"})
            print(capture_msg +
                  "\n\n意図的に残すなら、その旨を述べてもう一度終えてください"
                  "（2回目は止めません）。", file=sys.stderr)
            sys.exit(2)
        sys.exit(0)

    scripts, why = [], {}
    for path, gates in LIGHT_GATES:
        if path in changed:
            for g in gates:
                # 引数つきで書ける（"coverage.py --check" のように、既定の動作が
                # 検査ではないスクリプトがある）
                if g not in scripts and (Path(root) / "scripts" / g.split()[0]).exists():
                    scripts.append(g)
                    why.setdefault(g, path)

    failures = []
    for g in scripts:
        head, *rest = g.split()
        rc, out = run(["python3", f"scripts/{head}", *rest], root)
        if rc != 0:
            tail = "\n".join([ln for ln in out.strip().splitlines() if ln.strip()][-12:])
            failures.append(f"■ scripts/{g}（{why[g]} を変更したため実行）\n{tail}")

    note = None
    if quote_gate_needed(root, changed):
        scripts.append("verify_quotes.py --check")
        rc, out = run(["python3", "scripts/verify_quotes.py", "--check"], root,
                      timeout=QUOTE_TIMEOUT)
        if rc == 1:
            tail = "\n".join([ln for ln in out.strip().splitlines() if ln.strip()][-12:])
            failures.append("■ scripts/verify_quotes.py --check（引用・日付を変更したため実行）\n"
                            "台帳が古いだけなら `python3 scripts/verify_quotes.py --backfill` "
                            "を先に流してください。\n" + tail)
        elif rc != 0:
            # 打ち切り・起動失敗では止めない（キャッシュ構築で turn を人質に取らない）
            note = ("引用または日付を変更しています。`python3 scripts/verify_quotes.py --backfill && "
                    "--check` の合格がコミット条件ですが、このフックからは終わりませんでした"
                    f"（{QUOTE_TIMEOUT}秒で打ち切り＝初回のキャッシュ構築中の可能性）。"
                    "手で1回流してください")
        # 書名の整合（Issue #40 G1）。--check と同じくコーパスが要るが2回目以降は数秒で、
        # 流さないと「名乗る書に引用が無い 0 件」は次に書名を書き足した瞬間に黙って腐る
        scripts.append("verify_quotes.py --check-books")
        rc, out = run(["python3", "scripts/verify_quotes.py", "--check-books"], root,
                      timeout=QUOTE_TIMEOUT)
        if rc == 1:
            tail = "\n".join([ln for ln in out.strip().splitlines() if ln.strip()][-6:])
            failures.append("■ scripts/verify_quotes.py --check-books（引用・書名を変更したため実行）\n"
                            "note が名乗る書に引用が無いユニットがあります。書名の誤りなら note を直し、"
                            "コーパス側の欠陥なら quote-refs.json の bookAllow に理由を書いてください。\n"
                            + tail)
    if capture_msg:
        failures.append("■ 手順の提案の採取が未コミット\n" + capture_msg)

    log(root, {
        "decision": "block" if failures else ("note" if note else "pass"),
        "tool": "Stop", "actor": "main",
        "detail": f"{','.join(changed)} → {','.join(scripts) or '該当ゲートなし'}",
    })

    if failures:
        head = ("コミット前に片付ける項目があります。\n\n"
                if len(failures) == 1 and capture_msg else
                "データに未コミットの差分があり、ゲートが落ちています。"
                "訂正してからもう一度終えてください。\n\n")
        print(head + "\n\n".join(failures) +
              (f"\n\n【あわせて】{note}" if note else "") +
              "\n\nこの差分が意図的に途中の状態なら、その旨を述べてもう一度終えてください"
              "（2回目は止めません）。", file=sys.stderr)
        sys.exit(2)

    if note:
        # 流しきれなかった側は止めない。走っていないことだけ伝える。
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
