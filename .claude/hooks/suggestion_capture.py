#!/usr/bin/env python3
"""Stop フック — 手順の改善提案を提案ノートへ自動で写す。

規則 R-PROCESS-FEEDBACK（docs/process/RULES.yml）の L1 実装。

これを足した理由: 提案が出る場所は2つある。調査エージェントの出力契約の
`processSuggestion` と、検証エージェントの報告本文の「手順の提案」節。どちらも
**親セッションが読んで、ユーザーへ話して、それで終わっていた**。話した内容は
turn が流れると消えるので、`PROCESS_IMPROVEMENTS.md` に残るのは親が明示的に書いた
ぶんだけになる。2026-08-03 の Issue #61 では4件出て、記録されたのは0件だった。

設計で決めたこと:

- **止めない。** 提案の記録は turn の正しさに関わらないので、`Stop` を block する筋のものでは
  ない（block してよいのは R-GATES-BEFORE-COMMIT のようにデータが壊れている場合だけ）。
  書いたことは systemMessage で親へ返し、親がユーザーへ上げる。
- **本文ではなく末尾の「自動採取」節へ積む。** 提案ノートは採否の記録なので、未提示のものを
  本文へ混ぜると「採否が空欄の行」が増えて決着済みかどうかが読めなくなる。
- **重複はファイル自身に埋めた sha で見る。** フックは同じ transcript を毎 turn 走査するし、
  同じエージェントが同じ提案を返すこともある。別の帳簿を持つと帳簿のほうが腐る。
- **親セッション自身の提案は拾えない。** 地の文の提案には機械が読める印が無い。そこは
  `python3 scripts/add_suggestion.py` を手で呼ぶ（フックが拾えた件数を systemMessage で
  出すので、自分の提案がその数に入っていないことは親から見える）。
"""
import html
import json
import os
import re
import sys
from pathlib import Path

RULE_ID = "R-PROCESS-FEEDBACK"
MAX_BYTES = 24 * 1024 * 1024  # これを超える transcript は末尾だけ読む
PROSE_RE = re.compile(r"[*_]{0,2}(?:手順の提案|プロセスの提案)[*_]{0,2}\s*[:：]\s*(.+)")


def load_hook_input():
    try:
        return json.loads(sys.stdin.read() or "{}")
    except Exception:  # noqa: BLE001
        return {}


def repo_root():
    root = os.environ.get("CLAUDE_PROJECT_DIR")
    if root and Path(root, "docs/process/PROCESS_IMPROVEMENTS.md").is_file():
        return Path(root)
    here = Path.cwd()
    for cand in [here, *here.parents]:
        if (cand / "docs/process/PROCESS_IMPROVEMENTS.md").is_file():
            return cand
    return None


# 値の中に「…","<キー>":"…」が現れたら、そこから先は隣の欄が紛れ込んでいる。
# 背景エージェントの <result> は長いと途中で切り詰められて JSON が壊れるので、
# raw_decode が閉じ引用符を見誤って隣の欄まで1つの文字列として読むことがある
# （2026-08-06 に find_biography の提案が discrepancies ごと取り込まれた）。
SPILL_RE = re.compile(r'","[A-Za-z][A-Za-z0-9_]*":')


def json_string_after(text, pos):
    """text[pos:] の先頭にある JSON 文字列を1つ読む（エスケープを解く）。"""
    dec = json.JSONDecoder()
    m = re.compile(r"\s*:\s*").match(text, pos)
    if not m:
        return None
    try:
        value, _ = dec.raw_decode(text, m.end())
    except ValueError:
        return None
    if not isinstance(value, str):
        return None
    return trim_spill(value)


def trim_spill(value):
    """隣の欄がこぼれ込んでいたら、そこから先を捨てる。

    **JSON を解いた側（(a)）だけでなく、報告本文から拾った側（(b)）にも掛ける。**
    「手順の提案: …」は JSON の値の中に埋まっていることがあり、その場合 PROSE_RE は
    行末まで＝隣の欄まで取ってしまう（2026-08-06 に (a) だけ直して取りこぼした）。
    """
    spill = SPILL_RE.search(value)
    return value[: spill.start()] if spill else value


def agent_results(obj):
    """1行ぶんの transcript から、サブエージェントが返した本文だけを取り出す。

    **拾う場所を絞るのが肝。** 行の全文を走査すると、提案ノートを Read した結果や
    このフック自身のソースを Write した結果まで「提案」として拾ってしまう
    （どちらも `processSuggestion` という語を含む）。エージェントの結果が入るのは
    次の2つだけなので、そこだけを見る。
    """
    out = []
    # (1) 背景エージェント: <task-notification> の <result> ブロック
    content = (obj.get("message") or {}).get("content")
    if isinstance(content, str) and "<task-notification>" in content:
        out += re.findall(r"<result>(.*?)</result>", content, re.S)
    # (2) 同期エージェント: 出力契約そのものを返した tool_result だけ。
    # ツール名は同じ行に無いので、**中身が claims-first の契約かどうか**で見分ける。
    # ここを「文字列なら何でも」に緩めると、提案ノートを Read した結果を拾う。
    result = obj.get("toolUseResult")
    if isinstance(result, str):
        body = re.sub(r"^```[a-z]*\n|\n```$", "", result.strip())
        try:
            parsed = json.loads(body)
        except Exception:  # noqa: BLE001
            parsed = None
        if isinstance(parsed, dict) and "processSuggestion" in parsed:
            out.append(result)
    return [s for s in out if s]


def harvest_from_line(line):
    """transcript の1行から手順の提案を取り出す。"""
    try:
        obj = json.loads(line)
    except Exception:  # noqa: BLE001
        return []
    found = []
    for text in agent_results(obj):
        # (a) 出力契約の欄。JSON の中に居ることも、コードブロックの中に居ることもある
        for m in re.finditer(r'"processSuggestion"', text):
            val = json_string_after(text, m.end())
            if val:
                found.append(val)
        # (b) 報告本文の「手順の提案:」節（検証エージェントは JSON を返さない）
        for m in PROSE_RE.finditer(text):
            found.append(trim_spill(m.group(1)))
    return [f for f in (html.unescape(s).strip() for s in found) if len(f) >= 20]


def read_transcript(path):
    p = Path(path)
    if not p.is_file():
        return []
    size = p.stat().st_size
    with p.open("r", encoding="utf-8", errors="replace") as f:
        if size > MAX_BYTES:
            f.seek(size - MAX_BYTES)
            f.readline()
        return f.readlines()


def log(root, rec):
    try:
        with (Path(root) / ".claude" / "hook-log.jsonl").open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except Exception:  # noqa: BLE001
        pass


def main():
    data = load_hook_input()
    root = repo_root()
    if root is None:
        sys.exit(0)
    sys.path.insert(0, str(root / "scripts"))
    try:
        from add_suggestion import append_auto
    except Exception:  # noqa: BLE001
        sys.exit(0)

    found = []
    for line in read_transcript(data.get("transcript_path") or ""):
        if "processSuggestion" not in line and "手順の提案" not in line:
            continue
        found += harvest_from_line(line)

    written = 0
    for body in found:
        if append_auto(root, "エージェント発の手順の提案", "サブエージェントの報告", body):
            written += 1

    log(root, {"decision": "note" if written else "pass", "tool": "Stop",
               "actor": "main", "rule": RULE_ID,
               "detail": f"提案 {len(found)} 件を検出・{written} 件を新規記録"})

    if written:
        print(json.dumps({
            "continue": True,
            "systemMessage": (
                f"エージェント発の手順の提案 {written} 件を "
                "docs/process/PROCESS_IMPROVEMENTS.md の「自動採取」節へ書き足しました"
                "（採否は未定）。ユーザーへ上げてください。**あなた自身が地の文で出した提案は"
                "ここに入りません** — `python3 scripts/add_suggestion.py --auto` で足してください。"),
        }, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        print(f"[suggestion_capture.py] 内部エラーのため素通しします: {exc}", file=sys.stderr)
        sys.exit(0)
