#!/usr/bin/env python3
"""events[] に安定 id を焼き、位置参照を id 参照へ移す（Issue #69・計画7節の1）。

## なぜ patch_emperor.py を通さないか

`patch_emperor.py` は**1回の起動で皇帝1人**・**値を作らない**転記ツールで、
6,026件へ連番を焼く構造移行はその設計の外にある（id は「入力に literally 書かれていた値」
ではなく位置から作る）。そこで一度きりの移行として別に置くが、`patch_emperor.py` が
持っている防護のうち**書き出しの作法だけは同じものを使う**:

- 出力は `json.dumps(..., ensure_ascii=False, indent=1) + "\\n"`（整形がずれると
  触っていない364人ぶんが差分に出る）
- 読み込み時の sha256 を書き込み直前に照合する（`R-RMW`・並行セッション）
- 触ったパスが要求するゲートを最後に出す

## R-NO-AUTOGEN との関係

歴史的判断はしない。やるのは「どの event がどれか」を後から言えるようにする**識別子の付与**で、
値・日付・判定には触れない。id の中身は `<皇帝id>.<コンテナ>.e<連番>` の機械的な文字列。

## id の形と不変条件

    beisong-renzong.amnestyCount.e003

- **連番は1始まり**（0始まりの添字とわざと1ずれる）。`e` 接頭辞と合わせて
  「id は添字ではない」を目で見て分かるようにする — 焼いた直後は id と添字が
  対応するので、後から「添字から作り直せる」と誤解されるのが一番危ない失敗
- **一度焼いたら二度と作り直さない**。このスクリプトは id を既に持つ event を飛ばす（冪等）
- 新しく event を足したときは、そのコンテナの既存 id の最大値＋1 を振る（`--fill` ）

## 移す参照

- `data/emperors.json`: 6,026 events に `id`
- `data/screenings.json`: `audit.findings[].id`（`<皇帝id>.<コンテナ>[i].<日付キー>` と
  `<皇帝id>#<i>` の2形式）→ `<event id>.<日付キー>` / `<event id>`
  あわせて `audit.sampleKey: "legacy-index"` を足す（下記）
- `scripts/validate_emperors.py` の許可リスト・`docs/process/RESIDUAL.md` は
  このスクリプトが出す対応表を見て手で移す（散文とコードなので機械置換しない）

## audit.sampleKey を足す理由

種つき無作為標本は `md5(seed:id)` の順で引いている。**id を変えると抽選し直しになり、
既に原典を読んで積み上げた38件の監査が全部「標本の外」へ落ちる**。抽選の鍵と参照の同一性は
別の関心事なので、移行前に引いた標本は「抽選の鍵＝移行前の位置文字列」と明示して凍結し、
以後の新しい標本は event id で引く（`sampleKey` が無い記録は `"event-id"` とみなす）。

使い方:
    python3 scripts/migrations/bake_event_ids.py --dry-run
    python3 scripts/migrations/bake_event_ids.py
    python3 scripts/migrations/bake_event_ids.py --map > /tmp/map.tsv   # 対応表だけ出す
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DATA = ROOT / "data" / "emperors.json"
SCREENINGS = ROOT / "data" / "screenings.json"

# validate_emperors.py の COUNT_GROUPS と同じ並び（events を持つ容器はこの8つだけ）
COUNT_GROUPS = (
    "eraChangeCount",
    "amnestyCount",
    "empressInstallationCount",
    "crownPrinceDepositionCount",
    "personalCampaignCount",
    "rebellionSuppressionCount",
    "rebellionSufferedCount",
    "capitalRelocationCount",
)

# 移行前の位置参照。`beisong-renzong.amnestyCount[2].date` と `jin-huidi#0` の2形式
REF_PATH = re.compile(r"^([a-z0-9-]+)\.([A-Za-z]+Count)\[(\d+)\]\.([A-Za-z]+)$")
REF_HASH = re.compile(r"^([a-z0-9-]+)#(\d+)$")


def event_id(emperor_id: str, group: str, index: int) -> str:
    """位置から id を作るのはこの1回だけ（以後は保存された値を読む）。"""
    return f"{emperor_id}.{group}.e{index + 1:03d}"


def bake_inplace(data, fill_only=False):
    """events へ id を焼く。既に持っているものは触らない（冪等）。

    戻り値は (対応表, 新しく焼いた件数, 既にあった件数)。対応表の鍵は
    移行前の位置 (皇帝id, コンテナ, 添字)。**id は先頭キーに置く**ので要素ごとに作り直す。
    """
    mapping, baked, kept = {}, 0, 0
    for e in data["emperors"]:
        eid = e["id"]
        for g in COUNT_GROUPS:
            o = e.get(g)
            if not isinstance(o, dict) or not isinstance(o.get("events"), list):
                continue
            events = o["events"]
            used = {ev["id"] for ev in events if isinstance(ev, dict) and ev.get("id")}
            for i, ev in enumerate(events):
                if not isinstance(ev, dict):
                    continue
                if ev.get("id"):
                    kept += 1
                    mapping[(eid, g, i)] = ev["id"]
                    continue
                if fill_only:
                    nums = [int(m.group(1)) for s in used
                            if (m := re.search(r"\.e(\d+)$", s))]
                    new_id = f"{eid}.{g}.e{(max(nums) + 1) if nums else 1:03d}"
                else:
                    new_id = event_id(eid, g, i)
                if new_id in used:
                    sys.exit(f"id が衝突しました: {new_id}")
                used.add(new_id)
                events[i] = {"id": new_id, **ev}
                mapping[(eid, g, i)] = new_id
                baked += 1
    return mapping, baked, kept


def resolve_ref(ref: str, mapping) -> str | None:
    """移行前の位置参照を id 参照へ。読めなければ None（呼び出し側で報告）。"""
    m = REF_PATH.match(ref)
    if m:
        key = (m.group(1), m.group(2), int(m.group(3)))
        new = mapping.get(key)
        return f"{new}.{m.group(4)}" if new else None
    m = REF_HASH.match(ref)
    if m:
        # campaign_span.py は personalCampaignCount の中の添字だけを書いていた
        return mapping.get((m.group(1), "personalCampaignCount", int(m.group(2))))
    return None


def migrate_screenings(mapping, report):
    """audit.findings[].id を id 参照へ移し、抽選の鍵を凍結する。"""
    raw = SCREENINGS.read_text(encoding="utf-8")
    doc = json.loads(raw)
    # 整形は元のファイルに合わせる（emperors.json は indent=1・screenings.json は indent=2）。
    # 揃えないと 39 件の書き換えが 500 行の差分になって、レビューで中身が見えなくなる
    indent = next((n for n in (1, 2, 4)
                   if json.dumps(doc, ensure_ascii=False, indent=n) + "\n" == raw), None)
    if indent is None:
        sys.exit("data/screenings.json の整形を判定できません（indent 1/2/4 のいずれでもない）")
    moved, failed = 0, []
    for rec in doc.get("screenings") or []:
        for b in rec.get("buckets") or []:
            audit = b.get("audit")
            if not isinstance(audit, dict):
                continue
            touched = False
            for f in audit.get("findings") or []:
                old = f.get("id")
                if not isinstance(old, str):
                    continue
                new = resolve_ref(old, mapping)
                if new is None:
                    # 人物 id そのもの（name_fields）は event 参照ではないので触らない
                    if REF_PATH.match(old) or REF_HASH.match(old):
                        failed.append(f"{rec.get('id')}／{b.get('name')}: {old}")
                    continue
                f["id"] = new
                moved += 1
                touched = True
            if touched and "sampleKey" not in audit:
                # 抽選の鍵は移行前の位置文字列に凍結する（標本を引き直さないため）
                audit["sampleKey"] = "legacy-index"
    report.append(f"screenings.json: findings {moved} 件を id 参照へ移した")
    if failed:
        report.append("  移せなかった参照（要確認）:\n    " + "\n    ".join(failed))
    return json.dumps(doc, ensure_ascii=False, indent=indent) + "\n", failed


def main() -> int:
    ap = argparse.ArgumentParser(description="events[] に安定 id を焼く（一度きりの移行）")
    ap.add_argument("--dry-run", action="store_true", help="差分の件数だけ出して書かない")
    ap.add_argument("--map", action="store_true",
                    help="対応表（移行前の位置 → id）をTSVで標準出力へ。書き込みはしない")
    ap.add_argument("--fill", action="store_true",
                    help="id の無い event にだけ、その容器の最大連番＋1を振る"
                         "（events を足したあとに使う。初回移行では使わない）")
    args = ap.parse_args()

    raw = DATA.read_text(encoding="utf-8")
    before_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    data = json.loads(raw)
    if json.dumps(data, ensure_ascii=False, indent=1) + "\n" != raw:
        sys.exit("data/emperors.json の整形が既定（ensure_ascii=False, indent=1）と違います。"
                 "このまま書くと触っていない箇所まで差分に出ます")

    mapping, baked, kept = bake_inplace(data, fill_only=args.fill)

    if args.map:
        for (eid, g, i), new in mapping.items():
            print(f"{eid}.{g}[{i}]\t{new}")
        return 0

    report = [f"emperors.json: {baked} 件に id を焼いた（既に持っていた {kept} 件は触っていない）"]
    screenings_out, failed = migrate_screenings(mapping, report)

    print("■ 移行の内容")
    for line in report:
        print(f"  {line}")
    if failed:
        print("\n移せなかった参照があるので書きません")
        return 1
    if args.dry_run:
        print("\n--dry-run のため書き込んでいません")
        return 0

    if hashlib.sha256(DATA.read_bytes()).hexdigest() != before_hash:
        sys.exit("\n読み込みから書き込みまでの間に data/emperors.json が変わりました"
                 "（別セッションの編集）。書かずに終わります")
    out = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
    tmp = DATA.with_suffix(".json.tmp")
    tmp.write_text(out, encoding="utf-8")
    os.replace(tmp, DATA)
    tmp2 = SCREENINGS.with_suffix(".json.tmp")
    tmp2.write_text(screenings_out, encoding="utf-8")
    os.replace(tmp2, SCREENINGS)
    print(f"\n書き込みました: {DATA.relative_to(ROOT)} / {SCREENINGS.relative_to(ROOT)}")
    print("""
■ このあと通すゲート（コミット条件・R-GATES-BEFORE-COMMIT）
  python3 scripts/validate_emperors.py
  python3 scripts/check_screenings.py
  python3 scripts/coverage.py --check

■ 手で移す参照（このスクリプトは触らない）
  scripts/validate_emperors.py の KNOWN_PREACCESSION_EVENTS / KNOWN_DEATH_EVENT_DATE
  docs/process/RESIDUAL.md の「旧暦月番号の直書きが疑われる9件」
  → `--map` で対応表を出して引く""")
    return 0


if __name__ == "__main__":
    sys.exit(main())
