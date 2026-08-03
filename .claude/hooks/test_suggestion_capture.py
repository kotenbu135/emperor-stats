#!/usr/bin/env python3
"""suggestion_capture.py の検出力を合成 transcript で測る。

**「0件で通った」を合格と読まないため**の器。誤検出（提案でないものを拾う）と
取りこぼし（提案を拾えない）を両方置く。誤検出のほうが害が大きい — 提案ノートは
人が読む記録なので、Read の結果やフック自身のソースが混ざると読めなくなる。

    python3 .claude/hooks/test_suggestion_capture.py
"""
import importlib.util
import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


sc = load("sc", HERE / "suggestion_capture.py")
adds = load("adds", ROOT / "scripts" / "add_suggestion.py")

SUGGESTION = ("素材抽出はコマンドで渡すべきで、プロンプトの中にワンライナーを書くと"
              "既定もフックも掛からない。抽出コマンド側に寄せたい。")
PROSE = ("「在位N年」のような史書側の勘定規約に依存する逆算は、判定を書く前に"
         "同じ書の他の用例で内包か経過かを実測してから当てる。")


def line_notification(result_text):
    return json.dumps({"type": "user", "message": {"role": "user", "content":
        f"<task-notification>\n<task-id>x</task-id>\n<result>{result_text}</result>\n"
        "</task-notification>"}}, ensure_ascii=False)


def line_tool_result(payload):
    return json.dumps({"type": "user", "toolUseResult": payload}, ensure_ascii=False)


CASES = [
    # (名前, transcript の1行, 拾えてほしい件数)
    ("契約の欄（背景エージェント）",
     line_notification(json.dumps({"id": "x", "claims": [],
                                   "processSuggestion": SUGGESTION}, ensure_ascii=False)), 1),
    ("報告本文の「手順の提案:」（検証エージェント）",
     line_notification(f"## 反証できなかったもの\n\n**手順の提案:** {PROSE}"), 1),
    ("HTML 実体参照が混ざった契約の欄",
     line_notification(json.dumps({"processSuggestion": SUGGESTION + " --for &lt;id&gt; を見る"},
                                  ensure_ascii=False)), 1),
    ("同期エージェントが契約そのものを返した tool_result",
     line_tool_result(json.dumps({"claims": [], "processSuggestion": SUGGESTION},
                                 ensure_ascii=False)), 1),
    # --- ここから下は拾ってはいけない ---
    ("提案ノートを Read した結果",
     line_tool_result({"type": "text", "file": {"filePath": "docs/process/PROCESS_IMPROVEMENTS.md",
                                                "content": f"- **提案**: {SUGGESTION}"}}), 0),
    ("フック自身のソースを Write した結果",
     line_tool_result({"type": "create", "filePath": ".claude/hooks/suggestion_capture.py",
                       "content": '報告本文の「手順の提案:」節（検証エージェントは JSON を返さない）'}), 0),
    ("親セッションが地の文で書いた提案（印が無いので拾えない＝仕様）",
     json.dumps({"type": "assistant", "message": {"role": "assistant",
                 "content": [{"type": "text", "text": f"手順の提案: {PROSE}"}]}},
                ensure_ascii=False), 0),
    ("短すぎる断片は捨てる",
     line_notification(json.dumps({"processSuggestion": "直す"}, ensure_ascii=False)), 0),
]


def check_dedup():
    """同じ提案を2回足しても1件にしかならないこと。"""
    with tempfile.TemporaryDirectory() as tmp:
        doc = Path(tmp) / "docs" / "process"
        doc.mkdir(parents=True)
        (doc / "PROCESS_IMPROVEMENTS.md").write_text("# 手順の改善提案\n\n### 2026-01-01 既存\n",
                                                     encoding="utf-8")
        first = adds.append_auto(tmp, "t", "s", SUGGESTION)
        second = adds.append_auto(tmp, "t", "s", SUGGESTION)
        text = (doc / "PROCESS_IMPROVEMENTS.md").read_text(encoding="utf-8")
        ok = first and not second and text.count("<!-- auto:") == 1
        # 本文への追記は自動採取節より前に入ること（末尾に積むと節が割れる）
        adds.append_main(tmp, "手で足した", "場面", "本文", "採用")
        text = (doc / "PROCESS_IMPROVEMENTS.md").read_text(encoding="utf-8")
        ok = ok and text.index("手で足した") < text.index(adds.AUTO_HEADING)
        return ok


def check_hook_end_to_end():
    """フックを実際に起動して、書き込みと systemMessage まで通ること。"""
    with tempfile.TemporaryDirectory() as tmp:
        doc = Path(tmp) / "docs" / "process"
        doc.mkdir(parents=True)
        (doc / "PROCESS_IMPROVEMENTS.md").write_text("# 手順の改善提案\n", encoding="utf-8")
        (Path(tmp) / "scripts").mkdir()
        (Path(tmp) / "scripts" / "add_suggestion.py").write_text(
            (ROOT / "scripts" / "add_suggestion.py").read_text(encoding="utf-8"), encoding="utf-8")
        (Path(tmp) / ".claude").mkdir()
        tr = Path(tmp) / "t.jsonl"
        tr.write_text(line_notification(json.dumps({"processSuggestion": SUGGESTION},
                                                   ensure_ascii=False)) + "\n", encoding="utf-8")
        proc = subprocess.run(
            [sys.executable, str(HERE / "suggestion_capture.py")],
            input=json.dumps({"transcript_path": str(tr)}), capture_output=True, text=True,
            env={**dict(**{"PATH": "/usr/bin:/bin"}), "CLAUDE_PROJECT_DIR": tmp})
        written = SUGGESTION[:20] in (doc / "PROCESS_IMPROVEMENTS.md").read_text(encoding="utf-8")
        said = "systemMessage" in proc.stdout
        return proc.returncode == 0 and written and said


def main():
    bad = 0
    for name, line, want in CASES:
        got = len(sc.harvest_from_line(line))
        mark = "ok " if got == want else "NG "
        if got != want:
            bad += 1
        print(f"{mark}{name}: 期待 {want} / 実際 {got}")
    for name, fn in (("重複と挿入位置", check_dedup), ("フックの端から端まで", check_hook_end_to_end)):
        ok = fn()
        print(f"{'ok ' if ok else 'NG '}{name}")
        bad += 0 if ok else 1
    print(f"\n{bad} errors / ケース {len(CASES) + 2} 件"
          f"（うち拾ってはいけないもの {sum(1 for c in CASES if c[2] == 0)} 件）")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
