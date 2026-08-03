#!/usr/bin/env python3
"""手順の改善提案を docs/process/PROCESS_IMPROVEMENTS.md へ1件足す。

規則 R-PROCESS-FEEDBACK（docs/process/RULES.yml）の書き込み口。
**採否を決める道具ではない** — 決めるのはユーザーで、ここは記録の器を揃えるだけ。

設計で決めたこと:

- **人が書く提案と、エージェント発の自動採取を同じファイルの別セクションに置く。**
  提案ノートは「採否の記録」なので、ユーザーへまだ上げていないものを本文へ混ぜると
  「採否が空欄の行」が増えて、どれが決着済みかが読めなくなる。自動採取は末尾の
  `## 自動採取` の下へ積み、ユーザーに上げて採否が決まった時点で本文へ手で昇格させる。
- **重複は本文の sha で見る。** 同じエージェントが同じ提案を2回返すこと・同じ turn で
  フックが2回走ることがあるので、`<!-- auto:<sha12> -->` を行に埋めて突合する。
  ファイルが唯一の状態で、別の帳簿を持たない。
- **落ちない。** フックから呼ばれるので、書けない・読めないときは黙って 0 で終わる
  （提案の取りこぼしより turn を終われないほうが害が大きい）。
"""
import argparse
import datetime as _dt
import hashlib
import re
import sys
from pathlib import Path

DOC = Path("docs/process/PROCESS_IMPROVEMENTS.md")
AUTO_HEADING = "## 自動採取（エージェント発・ユーザーへ未提示）"
AUTO_INTRO = """
**この節は `.claude/hooks/suggestion_capture.py` が turn の終わりに書き足します。**
調査エージェントが出力契約の `processSuggestion` で返したもの、および報告本文に
「手順の提案」と書いたものを、そのまま写しています。**採否は決まっていません**
（ユーザーへ上げて決まったら、上の本文へ節ごと昇格させてここから消してください）。
"""

MAX_LEN = 1500


def norm(text):
    return re.sub(r"\s+", " ", (text or "").strip())


def digest(text):
    return hashlib.sha1(norm(text).encode("utf-8")).hexdigest()[:12]


def existing_digests(doc_text):
    return set(re.findall(r"<!-- auto:([0-9a-f]{12}) -->", doc_text))


def render(title, scene, body, verdict, sha=None):
    head = f"### {_dt.date.today().isoformat()} {title}"
    if sha:
        head += f" <!-- auto:{sha} -->"
    return (f"{head}\n"
            f"- **気づいた場面**: {scene}\n"
            f"- **提案**: {body}\n"
            f"- **採否**: {verdict}\n")


def append_auto(root, title, scene, body):
    """自動採取セクションへ1件足す。既に在れば False。"""
    path = Path(root) / DOC
    if not path.is_file():
        return False
    text = path.read_text(encoding="utf-8")
    body = norm(body)[:MAX_LEN]
    if not body:
        return False
    sha = digest(body)
    if sha in existing_digests(text):
        return False
    entry = render(title, scene, body, "未提示（ユーザーへ上げていない）", sha)
    if AUTO_HEADING not in text:
        text = text.rstrip("\n") + "\n\n---\n\n" + AUTO_HEADING + "\n" + AUTO_INTRO + "\n" + entry
    else:
        text = text.rstrip("\n") + "\n\n" + entry
    path.write_text(text, encoding="utf-8")
    return True


def append_main(root, title, scene, body, verdict):
    """本文（採否を書く側）へ1件足す。自動採取と違い重複判定をしない。"""
    path = Path(root) / DOC
    text = path.read_text(encoding="utf-8")
    entry = render(title, scene, norm(body), verdict)
    if AUTO_HEADING in text:
        # 自動採取は必ず末尾に置く。本文はその手前へ差す
        i = text.index(AUTO_HEADING)
        sep = text.rfind("\n---\n", 0, i)
        cut = sep if sep != -1 else i
        text = text[:cut].rstrip("\n") + "\n\n" + entry + text[cut:]
    else:
        text = text.rstrip("\n") + "\n\n" + entry
    path.write_text(text, encoding="utf-8")
    return True


def main():
    ap = argparse.ArgumentParser(
        description="手順の改善提案を PROCESS_IMPROVEMENTS.md へ1件足す（R-PROCESS-FEEDBACK）")
    ap.add_argument("--title", required=True, help="一行の見出し")
    ap.add_argument("--scene", required=True, help="気づいた場面（どの作業のどこで）")
    ap.add_argument("--body", required=True, help="提案の本文（何をどう変えるか）")
    ap.add_argument("--verdict", default="保留（ユーザーへ提示済み・未決）",
                    help="採否。既定は保留。自動採取には --auto を使う")
    ap.add_argument("--auto", action="store_true",
                    help="自動採取セクションへ足す（重複は sha で弾く）")
    ap.add_argument("--root", default=".", help="リポジトリのルート")
    a = ap.parse_args()
    if a.auto:
        ok = append_auto(a.root, a.title, a.scene, a.body)
        print("足しました" if ok else "同じ提案が既にあります（何もしていません）")
        return 0
    append_main(a.root, a.title, a.scene, a.body, a.verdict)
    print("足しました")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"[add_suggestion.py] {exc}", file=sys.stderr)
        sys.exit(1)
