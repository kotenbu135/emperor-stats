#!/usr/bin/env python3
"""規則台帳（docs/process/RULES.yml）の自己検査。

台帳そのものが古くなると、強制層の一覧という値が消える。見るのは4つだけ:

  1. 全規則が scope（適用範囲）と evidence（根拠になった失敗）を持つ
     — scope が空だったために規則を自己解釈で広げた事故がある
  2. .claude/hooks/ が実装している規則 ID と、台帳で enforcement に L1 を持つ規則が一致する
     — 片方だけ増えると「掛かっているつもり」になる
  3. L4 だけの規則（＝人の記憶頼り・次に破られる候補）を必ず出力する
     — 0 件の deny は「守られている」と「掛かっていない」を区別しない
  4. data/schema/SCHEMA_CHANGE_CHECKLIST.md の対応表に空欄が無く、名前を挙げたゲートが
     実在する（R-CLAIM-GATED・2026-08-03）
     — 「この欄を検査するのはどのスクリプトか」を書けない欄は配布物に足さない、という
       運用の唯一の機械側。**表に書いた名前と実装のずれ**だけは機械で見られる
       （新しい欄が表を素通りすることは見られない＝L3 が上限）
"""
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
RULES = ROOT / "docs" / "process" / "RULES.yml"
HOOKS = ROOT / ".claude" / "hooks"
CHECKLIST = ROOT / "data" / "schema" / "SCHEMA_CHANGE_CHECKLIST.md"


def check_schema_checklist():
    """主張と検査の対応表を見る（空欄が無いか・挙げたゲートが実在するか）。"""
    errors = []
    if not CHECKLIST.exists():
        return [f"{CHECKLIST.relative_to(ROOT)} がありません（R-CLAIM-GATED の運用面）"], 0
    # **表の行は見出しからの位置で拾う。** 「`::` を含む行」で拾うと、検査の欄を空にした行が
    # 母集団から消えて空欄検査が素通りする（＝この検査が止めたい形そのもの）。
    lines = CHECKLIST.read_text(encoding="utf-8").splitlines()
    head = next((i for i, s in enumerate(lines) if s.startswith("| 欄 |")), None)
    if head is None:
        return [f"{CHECKLIST.relative_to(ROOT)}: 対応表の見出し行（| 欄 | …）が見つかりません"], 0
    body = []
    for line in lines[head + 2:]:          # +2 は見出しと罫線
        if not line.startswith("|"):
            break
        body.append(line)

    rows = 0
    for line in body:
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) != 4:
            errors.append(f"対応表の列数が4ではありません: {line[:40]}…")
            continue
        rows += 1
        field, claim, gate, power = cells
        for name, value in (("欄", field), ("主張", claim), ("検査", gate), ("検出力", power)):
            if not value:
                errors.append(f"対応表 {field or '(欄なし)'}: {name} の欄が空です")
        # 「validate_emperors.py::check_ages」の形をすべて実体に当てる。
        # **表に名前を書けることと実装が在ることは別**で、ずれるのはたいてい改名のとき。
        for script, func in re.findall(r"`([a-z_]+\.py)::([a-z_]+)`", gate):
            path = ROOT / "scripts" / script
            if not path.exists():
                errors.append(f"対応表 {field}: {script} がありません")
            elif f"def {func}(" not in path.read_text(encoding="utf-8"):
                errors.append(f"対応表 {field}: {script} に {func}() がありません")
        for test in re.findall(r"`(test_[a-z_]+\.py)`", power):
            if not (ROOT / "scripts" / test).exists():
                errors.append(f"対応表 {field}: 検出力テスト {test} がありません")
    if rows == 0:
        errors.append(f"{CHECKLIST.relative_to(ROOT)} の対応表が空です")
    return errors, rows


def main():
    data = yaml.safe_load(RULES.read_text(encoding="utf-8"))
    rules = data.get("rules") or []
    errors = []

    ids = [r.get("id") for r in rules]
    for r in rules:
        rid = r.get("id") or "(id なし)"
        for field in ("summary", "scope", "enforcement", "evidence", "source"):
            if not r.get(field):
                errors.append(f"{rid}: {field} が空です")
        for layer in r.get("enforcement") or []:
            if layer not in ("L0", "L1", "L2", "L3", "L4"):
                errors.append(f"{rid}: 未知の強制層です: {layer}")
    for rid in ids:
        if ids.count(rid) > 1:
            errors.append(f"{rid}: id が重複しています")

    declared = {r["id"] for r in rules if "L1" in (r.get("enforcement") or [])}
    implemented = set()
    hook_files = sorted(p for p in HOOKS.glob("*.py") if not p.name.startswith("test_"))
    for p in hook_files:
        implemented |= set(re.findall(r'"(R-[A-Z0-9\-]+)"', p.read_text(encoding="utf-8")))
    # SessionStart フックの報告だけの規則はフックに実装が無い（弱い L1）
    soft = {"R-PRIMARY-ON-MAIN", "R-RMW"}
    where = "/".join(p.name for p in hook_files)
    for rid in sorted(implemented - declared):
        errors.append(f"{rid}: {where} にあるのに台帳の enforcement に L1 がありません")
    for rid in sorted(declared - implemented - soft):
        errors.append(f"{rid}: 台帳は L1 と言っていますが {where} に実装がありません")

    # 4. CLAUDE.md の要点一覧と台帳がずれていない
    #    — CLAUDE.md は毎ターン読み込まれる唯一の面で、台帳（RULES.yml）は読まれない。
    #      規則が一覧から落ちれば実質的に消えるし、★（＝hook が実行の直前に止める）の
    #      印がずれると「守らなくても止まらない」規則を止まると誤読する。
    claude_md = ROOT / "CLAUDE.md"
    text = claude_md.read_text(encoding="utf-8")
    mentioned = set(re.findall(r"`(R-[A-Z0-9\-]+)`", text))
    starred = set(re.findall(r"★`(R-[A-Z0-9\-]+)`", text))
    for rid in sorted(set(ids) - mentioned):
        errors.append(f"{rid}: CLAUDE.md の「守るべき運用ルール」に出てきません")
    for rid in sorted(mentioned - set(ids)):
        errors.append(f"{rid}: CLAUDE.md にありますが台帳に規則がありません")
    for rid in sorted(implemented - starred):
        errors.append(f"{rid}: {where} が止める規則なのに CLAUDE.md で ★ が付いていません")
    for rid in sorted(starred - implemented):
        errors.append(f"{rid}: CLAUDE.md で ★ が付いていますが {where} に実装がありません")

    checklist_errors, checklist_rows = check_schema_checklist()
    errors += checklist_errors

    memory_only = [r["id"] for r in rules if (r.get("enforcement") or []) == ["L4"]]
    for e in errors:
        print(f"ERROR  {e}")
    print(f"\n{len(errors)} errors / 規則 {len(rules)}件・L1 実装 {len(implemented)}件"
          f"・スキーマ変更チェックリスト {checklist_rows}行")
    print(f"人の記憶頼り（L4 のみ・次に破られる候補）: {', '.join(memory_only) or 'なし'}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
