#!/usr/bin/env python3
"""PreToolUse ガード — 機械で決着する運用規則を、実行の直前に止める。

規則の一覧・適用範囲・根拠になった失敗は docs/process/RULES.yml が正。
このスクリプトは「強制層 L1（hook）」を持つ規則だけを実装する。

- サブエージェント・Workflow エージェントのツール呼び出しでも発火する（2026-08-02 実測）。
  入力 JSON に agent_id が入っているかどうかで主会話と区別できる。
- 逃げ道は1本だけ: 環境変数 EMPSTATS_ALLOW="<規則ID>:<理由>"、
  または Bash コマンド先頭の EMPSTATS_ALLOW=<規則ID>:<理由> 指定。理由は必須。
  逃げ道の無いゲートは、正しい操作を落とすか最初にぶつかった人に無効化される。
- 発火は毎回 .claude/hook-log.jsonl に残す（deny だけでなく通過も）。
  0 件の deny は「守られている」と「そもそも掛かっていない」を区別しないため、
  規則ごとに分母（守るべき操作が何回起きたか）を数える。
"""
import json
import os
import re
import sys
import time
from pathlib import Path

CORPUS = re.compile(r"china-history|daizhigev20|_corpus_cache|史藏")
# ugrep が暴走するコンテキスト抽出パターン（.{0,40}KW.{0,40} 型）
CTX_EXTRACT = re.compile(r"\.\{\d+,\d+\}")
BARE_GREP = re.compile(r"(?:^|[|;&(]\s*|\s)grep\b")
ABS_GREP = re.compile(r"/usr/bin/grep\b")


def log(project_dir, rec):
    try:
        p = Path(project_dir) / ".claude" / "hook-log.jsonl"
        p.parent.mkdir(parents=True, exist_ok=True)
        rec["ts"] = time.strftime("%Y-%m-%dT%H:%M:%S")
        with p.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except Exception:
        pass  # ログの失敗でツール呼び出しを止めない


def escape_reason(rule_id, command):
    """逃げ道が使われているなら理由を返す。無ければ None。"""
    for src in (os.environ.get("EMPSTATS_ALLOW", ""), command):
        m = re.search(r"EMPSTATS_ALLOW=([A-Z0-9\-]+):(\S[^\s;&|]*)", src)
        if m and m.group(1) in (rule_id, "ALL"):
            return m.group(2)
    return None


def check(tool, ti, is_subagent, command):
    """当てはまった規則を全部返す: [(規則ID, deny 理由 or None), ...]

    1つ目で return しない。`cd daizhigev20 && git add -A` のように
    複数の規則に掛かるコマンドがあり、先に当たったほうで打ち切ると残りが素通りする。
    """
    hits = []

    # R-CORPUS-GREP — コーパスへの .{0,N} 型コンテキスト抽出 grep
    # 素の grep は ugrep で、単一 10MB ファイルでもメモリ 4GB 超に暴走し WSL ごと落ちる。
    if tool == "Bash" and CORPUS.search(command) and BARE_GREP.search(command):
        deny = None
        if CTX_EXTRACT.search(command) and not ABS_GREP.search(command):
            deny = ("コーパスへの `.{0,N}` 型コンテキスト抽出 grep は ugrep がメモリ 4GB 超に暴走し "
                    "WSL ごと落ちます。/usr/bin/grep か rg を使うか、抽出幅を使わない検索にしてください"
                    "（docs/process/CORPUS_NOTES.md「コーパス検索のメモリ事故対策」）")
        hits.append(("R-CORPUS-GREP", deny))
    if tool == "Grep" and CTX_EXTRACT.search(ti.get("pattern", "")):
        target = f"{ti.get('path','')} {ti.get('glob','')}"
        deny = None
        if CORPUS.search(target) or not ti.get("path"):
            deny = ("Grep ツールは ugrep です。`.{0,N}` 型の抽出パターンをコーパスに掛けると "
                    "WSL ごと落ちます。/usr/bin/grep か rg を Bash から使ってください")
        hits.append(("R-CORPUS-GREP", deny))

    # R-GIT-ADDALL — 並行セッションの変更を巻き込む一括 add
    if tool == "Bash" and re.search(r"\bgit\s+add\b", command):
        deny = None
        if re.search(r"\bgit\s+add\s+(-A|--all|-u\s*$|\.\s*($|[;&|]))", command):
            deny = ("同じ作業ツリーで別セッションが編集していることがあります。"
                    "`git add -A` / `git add .` は他セッションの変更を巻き込むので、"
                    "パスを明示して add してください")
        hits.append(("R-GIT-ADDALL", deny))

    # R-GIT-STASH — stash スタックは全 worktree で共有され、他セッションの退避を pop しうる
    if tool == "Bash" and re.search(r"\bgit\s+stash\b", command):
        deny = None
        if re.search(r"\bgit\s+stash\s*($|[;&|])", command) or \
           re.search(r"\bgit\s+stash\s+(pop|clear)\b", command):
            deny = ("stash スタックは主リポジトリと全 worktree で共有されます。"
                    "裸の `git stash` / `git stash pop` は他セッションの退避を奪います。"
                    "`git stash push -u -m \"<タグ>\"` で積み、`git stash apply <sha>` で戻してください"
                    "（退避が要らないなら一時 WIP コミットのほうが安全）")
        hits.append(("R-GIT-STASH", deny))

    # R-JSON-READ-MAIN — メイン会話で emperors.json 全体を Read しない（コンテキスト効率）
    # 規則の適用範囲は「メイン会話」なので、サブエージェントには掛けない。
    if tool == "Read" and str(ti.get("file_path", "")).endswith("data/emperors.json"):
        deny = None
        if not (is_subagent or ti.get("offset") or ti.get("limit")):
            deny = ("data/emperors.json は約 3.8MB で、メイン会話に載せると以降の全ターンで再送されます。"
                    "jq / python3 を Bash 経由で使って必要なフィールドだけ抽出してください"
                    "（docs/process/RESEARCH_PROCESS.md「コンテキスト効率」）")
        hits.append(("R-JSON-READ-MAIN", deny))

    return hits


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)  # 読めない入力でツール呼び出しを止めない

    tool = data.get("tool_name", "")
    ti = data.get("tool_input") or {}
    command = ti.get("command", "") or ""
    is_subagent = bool(data.get("agent_id"))
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or "."

    denials = []
    for rule_id, deny in check(tool, ti, is_subagent, command):
        reason = escape_reason(rule_id, command) if deny else None
        decision = "deny" if (deny and not reason) else ("escaped" if reason else "pass")
        log(project_dir, {
            "rule": rule_id, "decision": decision, "tool": tool,
            "actor": data.get("agent_type") if is_subagent else "main",
            "detail": (command or str(ti.get("file_path") or ti.get("pattern") or ""))[:160],
            "escape_reason": reason,
        })
        if decision == "deny":
            denials.append((rule_id, deny))

    if denials:
        for rule_id, deny in denials:
            print(f"[{rule_id}] {deny}\n"
                  f"どうしても必要なら理由を添えて "
                  f"EMPSTATS_ALLOW={rule_id}:<理由> を付けて再実行してください。",
                  file=sys.stderr)
        sys.exit(2)
    sys.exit(0)


if __name__ == "__main__":
    # 想定外の例外でツール呼び出しを止めない。ガードが落ちると
    # このリポジトリの全セッションで Bash が止まり、直すのにその Bash が要る。
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        print(f"[guard.py] 内部エラーのため素通しします: {exc}", file=sys.stderr)
        sys.exit(0)
