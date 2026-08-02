#!/usr/bin/env python3
"""規則台帳（docs/process/RULES.yml）の自己検査。

台帳そのものが古くなると、強制層の一覧という値が消える。見るのは3つだけ:

  1. 全規則が scope（適用範囲）と evidence（根拠になった失敗）を持つ
     — scope が空だったために規則を自己解釈で広げた事故がある
  2. guard.py が実装している規則 ID と、台帳で enforcement に L1 を持つ規則が一致する
     — 片方だけ増えると「掛かっているつもり」になる
  3. L4 だけの規則（＝人の記憶頼り・次に破られる候補）を必ず出力する
     — 0 件の deny は「守られている」と「掛かっていない」を区別しない
"""
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
RULES = ROOT / "docs" / "process" / "RULES.yml"
GUARD = ROOT / ".claude" / "hooks" / "guard.py"


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
    implemented = set(re.findall(r'"(R-[A-Z0-9\-]+)"', GUARD.read_text(encoding="utf-8")))
    # SessionStart フックの報告だけの規則は guard.py に実装が無い（弱い L1）
    soft = {"R-PRIMARY-ON-MAIN", "R-RMW"}
    for rid in sorted(implemented - declared):
        errors.append(f"{rid}: guard.py にあるのに台帳の enforcement に L1 がありません")
    for rid in sorted(declared - implemented - soft):
        errors.append(f"{rid}: 台帳は L1 と言っていますが guard.py に実装がありません")

    memory_only = [r["id"] for r in rules if (r.get("enforcement") or []) == ["L4"]]
    for e in errors:
        print(f"ERROR  {e}")
    print(f"\n{len(errors)} errors / 規則 {len(rules)}件・L1 実装 {len(implemented)}件")
    print(f"人の記憶頼り（L4 のみ・次に破られる候補）: {', '.join(memory_only) or 'なし'}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
