#!/usr/bin/env python3
"""kinship の生母（maternalLineage）ブロックの Workflow 結果を kinship.json へマージする。

usage:
    python3 scripts/merge_kinship_mother.py <journal.jsonl> <ブロック名> <期待id カンマ区切り>
    python3 scripts/merge_kinship_mother.py --selftest   # 既存レコードを定数に通す

**判定には一切関与しない**（構造チェックと機械的マージだけ）。中身の正しさは
`validate_kinship.py`（構造・網羅性）と `check_kinship_quotes.py`（引用の実在）が見る。

チェックの中身:
- `motherStatus`（recorded | unknown-confirmed）とエッジ実体の突合
- verified な実母（`birth-mother`）エッジは子ごとに最大1本
- marriage エッジ（生母が父の正妻の場合・`relation` を持たない）を許容
- 母方祖先チェーン用の実父・実母エッジ（`to` が母ノード）も許容
- `meta.confirmedMotherUnknown` への未登録リマインダー
- パッセージを `_corpus_cache/kinship/<id>.txt` へ追記

**語彙は `validate_kinship.py` から import する**（2026-08-17）。v2 の頃はこのファイルが
`section`・`実母` という自前の定数を持っていて、スキーマ v3（`4e80815`・`a2c78dd`・
`53e689c`）で `researchSection`＋`eraId`・`birth-mother` へ移ったあと**丸ごと死んでいた**。
同じことを繰り返さないよう、enum はここに書かず1箇所から引く。
"""
import argparse
import importlib.util
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location(
    "validate_kinship", Path(__file__).resolve().parent / "validate_kinship.py")
_vk = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_vk)  # main() は __main__ ガードの中なので副作用は無い

RELATIONS = _vk.RELATION_ENUM
MOTHER_RELATIONS = _vk.FEMALE_RELATIONS
VERACITY = _vk.VERACITY_ENUM
CONFIDENCE = _vk.CONFIDENCE_ENUM

# 実データのキー（`data/kinship.json` の 415 persons・721 kinship エッジ・81 marriage
# エッジの全数から引いたもの。posthumous・aliases・childOrder・primaryLineage・
# relationDetail は一部にしか無い任意キー）
KINSHIP_EDGE_KEYS = {"type", "relation", "from", "to", "childOrder", "primaryLineage",
                     "relationDetail", "veracity", "confidence", "note", "source"}
KINSHIP_EDGE_REQUIRED = {"type", "relation", "from", "to", "veracity", "confidence",
                         "note", "source"}
MARRIAGE_EDGE_KEYS = {"type", "from", "to", "veracity", "confidence", "note", "source"}
MARRIAGE_EDGE_REQUIRED = MARRIAGE_EDGE_KEYS
PERSON_KEYS = {"id", "name", "kana", "aliases", "kind", "gender", "researchSection",
               "eraId", "birthYear", "deathYear", "yearsApproximate", "posthumous",
               "inclusionReason", "note", "wikidata", "source"}
PERSON_REQUIRED = {"id", "name", "kana", "kind", "gender", "researchSection", "eraId",
                   "birthYear", "deathYear", "yearsApproximate", "inclusionReason",
                   "note", "wikidata", "source"}

KINSHIP_PATH = ROOT / "data" / "kinship.json"
EMPERORS_PATH = ROOT / "data" / "emperors.json"


def edge_key(edge):
    """重複判定の鍵。marriage は無向なので端点を辞書順に揃える。"""
    if edge["type"] == "marriage":
        return ("marriage", None) + tuple(sorted((edge["from"], edge["to"])))
    return (edge["type"], edge.get("relation"), edge["from"], edge["to"])


def selftest():
    """**いま入っている v3 のレコードを、この定数にそのまま通す。**

    v2 の定数が死んでいたのを見逃したのは、道具が一度も実データに当たっていなかったため。
    エージェントの出力を待たずに、既存の persons・エッジで枠が生きているかを確かめる。
    """
    kin = json.loads(KINSHIP_PATH.read_text(encoding="utf-8"))
    bad = []
    for p in kin["persons"]:
        extra = set(p) - PERSON_KEYS
        missing = PERSON_REQUIRED - set(p)
        if extra or missing:
            bad.append(f"persons[{p.get('id')}]: 余計 {sorted(extra)} / 欠落 {sorted(missing)}")
    for i, e in enumerate(kin["edges"]):
        if e["type"] == "succession":
            continue
        keys = MARRIAGE_EDGE_KEYS if e["type"] == "marriage" else KINSHIP_EDGE_KEYS
        req = MARRIAGE_EDGE_REQUIRED if e["type"] == "marriage" else KINSHIP_EDGE_REQUIRED
        extra = set(e) - keys
        missing = req - set(e)
        if extra or missing:
            bad.append(f"edges[{i}]({e['type']} {e['from']}->{e['to']}): "
                       f"余計 {sorted(extra)} / 欠落 {sorted(missing)}")
        if e["type"] == "kinship" and e.get("relation") not in RELATIONS:
            bad.append(f"edges[{i}]: relation が enum 外 ({e.get('relation')})")
        if e.get("veracity") not in VERACITY or e.get("confidence") not in CONFIDENCE:
            bad.append(f"edges[{i}]: veracity/confidence が enum 外")
    if bad:
        print("SELFTEST FAILED（この道具の枠が実データとずれています）:")
        for b in bad[:40]:
            print(" -", b)
        print(f"  … 計 {len(bad)}件")
        return 1
    kinship_edges = [e for e in kin["edges"] if e["type"] != "succession"]
    print(f"SELFTEST OK: persons {len(kin['persons'])}件・"
          f"kinship/marriage エッジ {len(kinship_edges)}件が枠を通りました")
    print(f"  relation の語彙: {sorted(RELATIONS)}")
    print(f"  実母とみなす relation: {sorted(MOTHER_RELATIONS)}")
    return 0


def merge(journal_path, block_name, expected):
    results = {}
    with open(journal_path, encoding="utf-8") as f:
        for line in f:
            ev = json.loads(line)
            if ev.get("type") in ("agent_result", "result", "agent_completed", "completed"):
                val = ev.get("result", ev.get("value"))
                if isinstance(val, dict) and "id" in val and "edges" in val \
                        and "motherStatus" in val:
                    results[val["id"]] = val

    kin = json.loads(KINSHIP_PATH.read_text(encoding="utf-8"))
    emp = json.loads(EMPERORS_PATH.read_text(encoding="utf-8"))
    emperor_ids = {e["id"] for e in emp["emperors"]}
    sections = {e.get("researchSection") for e in emp["emperors"]}
    era_ids = {e["id"] for e in (emp["meta"]["catalogs"].get("eras") or [])}
    existing_pids = {p["id"] for p in kin["persons"]}
    existing_pname = {p["id"]: p.get("name") for p in kin["persons"]}
    existing_edges = {edge_key(e): e for e in kin["edges"]}

    errors, warnings, infos = [], [], []
    missing = [i for i in expected if i not in results]
    if missing:
        errors.append(f"結果欠落: {missing}")
    extra = [i for i in results if i not in expected]
    if extra:
        errors.append(f"期待外のid: {extra}")

    block_pids = {p.get("id") for r in results.values() for p in r.get("persons", [])}

    new_edges, new_persons, passages = [], {}, {}
    for eid in expected:
        r = results.get(eid)
        if not r:
            continue
        allowed_nodes = emperor_ids | existing_pids | block_pids
        mother_edges = 0
        verified_mother = {}
        for edge in r["edges"]:
            et = edge.get("type")
            if et == "marriage":
                keys, required = MARRIAGE_EDGE_KEYS, MARRIAGE_EDGE_REQUIRED
            elif et == "kinship":
                keys, required = KINSHIP_EDGE_KEYS, KINSHIP_EDGE_REQUIRED
            else:
                errors.append(f"{eid}: エッジ type が不正 ({et})"
                              f"（このフェーズは kinship / marriage のみ）")
                continue
            bad = set(edge) - keys
            if bad:
                errors.append(f"{eid}: エッジに余計なキー {bad}")
            miss = required - set(edge)
            if miss:
                errors.append(f"{eid}: エッジに必須キー欠落 {miss}")
                continue
            if et == "kinship" and edge["relation"] not in RELATIONS:
                errors.append(f"{eid}: relation が enum 外 ({edge['relation']})"
                              f" — v3 は ID（{'・'.join(sorted(RELATIONS))}）")
            if edge.get("veracity") not in VERACITY:
                errors.append(f"{eid}: veracity が enum 外 ({edge.get('veracity')})")
            if edge.get("confidence") not in CONFIDENCE:
                errors.append(f"{eid}: confidence が enum 外 ({edge.get('confidence')})")
            if edge["from"] not in allowed_nodes:
                errors.append(f"{eid}: from が未知ノード ({edge['from']})")
            if edge["to"] not in allowed_nodes:
                errors.append(f"{eid}: to が未知ノード ({edge['to']})")
            if edge["from"] == edge["to"]:
                errors.append(f"{eid}: 自己ループ ({edge['from']})")
            if "childOrder" in edge and (not isinstance(edge["childOrder"], int)
                                         or edge["childOrder"] < 1):
                errors.append(f"{eid}: childOrder が1以上の整数でない "
                              f"({edge.get('childOrder')})")
            if et == "kinship" and edge["to"] == eid and edge["relation"] in MOTHER_RELATIONS:
                mother_edges += 1
                if edge["relation"] == "birth-mother" and edge["veracity"] == "verified":
                    verified_mother.setdefault(edge["to"], []).append(edge["from"])
        for to, mothers in verified_mother.items():
            if len(mothers) > 1:
                errors.append(f"{eid}: verified な実母エッジが複数 ({mothers})")
        existing_mother = any(
            e["type"] == "kinship" and e.get("relation") in MOTHER_RELATIONS
            and e["to"] == eid for e in kin["edges"])
        ms = r.get("motherStatus")
        if ms == "recorded" and mother_edges == 0 and not existing_mother:
            errors.append(f"{eid}: motherStatus=recorded だが本人への実母/養母エッジなし")
        elif ms == "unknown-confirmed":
            if mother_edges > 0:
                errors.append(f"{eid}: motherStatus=unknown-confirmed だが実母/養母エッジあり")
            elif eid not in {x.get("id") for x
                             in kin["meta"].get("confirmedMotherUnknown", [])}:
                warnings.append(
                    f"{eid}: motherStatus=unknown-confirmed —— "
                    f"meta.confirmedMotherUnknown への登録が要る"
                    f"（flags を基に reason を書いて手で足す。忘れると maternalLineage "
                    f"完了時の網羅性チェックで落ちる）")
            fl = (r.get("flags") or "").strip()
            if not fl or fl == "なし":
                errors.append(f"{eid}: unknown-confirmed の根拠が flags に無い")
        elif ms not in ("recorded", "unknown-confirmed"):
            errors.append(f"{eid}: motherStatus が不正 ({ms})")
        new_edges.append((eid, r["edges"]))
        for p in r.get("persons", []):
            pid = p.get("id")
            bad = set(p) - PERSON_KEYS
            if bad:
                errors.append(f"{eid}: persons {pid} に余計なキー {bad}")
            miss = PERSON_REQUIRED - set(p)
            if miss:
                errors.append(f"{eid}: persons {pid} に必須キー欠落 {miss}"
                              f" — v3 は researchSection＋eraId（section ではない）")
            if p.get("researchSection") not in sections:
                errors.append(f"{eid}: persons {pid} の researchSection が emperors.json の"
                              f" 語彙にない ({p.get('researchSection')})")
            if p.get("eraId") not in era_ids:
                errors.append(f"{eid}: persons {pid} の eraId が catalogs.eras にない "
                              f"({p.get('eraId')})")
            if p.get("kind") not in _vk.KIND_ENUM:
                errors.append(f"{eid}: persons {pid} の kind が enum 外 ({p.get('kind')})")
            if p.get("gender") not in _vk.GENDER_ENUM:
                errors.append(f"{eid}: persons {pid} の gender が enum 外 ({p.get('gender')})")
            reasons = p.get("inclusionReason")
            if not isinstance(reasons, list) or not reasons \
                    or not set(reasons) <= _vk.INCLUSION_ENUM:
                errors.append(f"{eid}: persons {pid} の inclusionReason が enum 外 ({reasons})")
            if not str(pid).startswith("p-"):
                errors.append(f"{eid}: persons id が p- で始まらない ({pid})")
            if pid in existing_pids:
                ex_name = existing_pname.get(pid)
                if ex_name is not None and ex_name != p.get("name"):
                    errors.append(
                        f"{eid}: persons {pid} は既存の別人と id 衝突の疑い"
                        f"（既存 name={ex_name} / 提案 name={p.get('name')}）"
                        f"——接尾辞方式で別 id を割り当てて調停すること")
                else:
                    warnings.append(
                        f"{eid}: persons {pid} は既存——新規レコードを破棄し既存を参照させる"
                        f"（内容差分は要目視: 提案 name={p.get('name')}）")
                continue
            if pid in new_persons:
                if new_persons[pid][1].get("name") != p.get("name"):
                    errors.append(
                        f"persons {pid}: 別人の id 衝突疑い"
                        f"（{new_persons[pid][0]} 提案 name={new_persons[pid][1].get('name')}"
                        f" / {eid} 提案 name={p.get('name')}）"
                        f"——接尾辞方式で別 id を割り当てて調停すること")
                elif new_persons[pid][1] == p:
                    infos.append(f"persons {pid}: 複数エージェントが同一内容を提案（1件採用）")
                else:
                    warnings.append(
                        f"persons {pid}: 複数提案に差分あり——先勝ち"
                        f"（{new_persons[pid][0]}）を採用、{eid} 案を破棄。差分要目視:\n"
                        f"    採用: {json.dumps(new_persons[pid][1], ensure_ascii=False)}\n"
                        f"    破棄: {json.dumps(p, ensure_ascii=False)}")
                continue
            new_persons[pid] = (eid, p)
        passages[eid] = {"mother": r.get("passages", {}).get("mother", "")}

    if errors:
        print("MERGE ABORTED:")
        for e in errors:
            print(" -", e)
        return 1

    flat_edges, dup_conflicts = [], []
    seen_new = set()
    for eid, edges in new_edges:
        for edge in edges:
            key = edge_key(edge)
            if key in existing_edges:
                if existing_edges[key] == edge:
                    infos.append(f"既存エッジと完全一致のためスキップ: {key}")
                else:
                    dup_conflicts.append((eid, key))
                continue
            if key in seen_new:
                prev = next(e for e in flat_edges if edge_key(e) == key)
                if prev == edge:
                    infos.append(f"ブロック内重複エッジ（同一内容・1件採用）: {key}")
                else:
                    dup_conflicts.append((eid, key))
                continue
            seen_new.add(key)
            flat_edges.append(edge)
    if dup_conflicts:
        print("MERGE ABORTED: エッジ重複に内容差分あり（要調停）:")
        for eid, key in dup_conflicts:
            print(f" - {eid}: {key}")
        return 1

    # marriage エッジは from/to を辞書順に正規化（validator の WARNING 回避）
    for e in flat_edges:
        if e["type"] == "marriage" and e["from"] > e["to"]:
            e["from"], e["to"] = e["to"], e["from"]

    kin["persons"].extend(p for _, p in new_persons.values())
    kin["edges"].extend(flat_edges)
    blocks = kin["meta"].setdefault("completedBlocks", [])
    blocks.append({"phase": "maternalLineage", "block": block_name,
                   "emperors": len(expected), "edges": len(flat_edges),
                   "persons": len(new_persons)})
    with open(KINSHIP_PATH, "w", encoding="utf-8") as f:
        json.dump(kin, f, ensure_ascii=False, indent=2)
        f.write("\n")

    os.makedirs(ROOT / "_corpus_cache" / "kinship", exist_ok=True)
    for eid, ps in passages.items():
        txt = (ps.get("mother") or "").strip()
        with open(ROOT / "_corpus_cache" / "kinship" / f"{eid}.txt", "a",
                  encoding="utf-8") as f:
            f.write(f"\n## maternalLineage 生母調査時の原文パッセージ (mother)\n{txt}\n")

    for w in warnings:
        print("WARNING:", w)
    for i in infos:
        print("INFO:", i)
    marriages = sum(1 for e in flat_edges if e["type"] == "marriage")
    print(f"OK: edges+{len(flat_edges)}（うち marriage {marriages}） "
          f"persons+{len(new_persons)} passages={len(passages)}")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("journal", nargs="?", help="Workflow の journal.jsonl")
    ap.add_argument("block", nargs="?", help="completedBlocks に書くブロック名")
    ap.add_argument("ids", nargs="?", help="期待する皇帝 id（カンマ区切り）")
    ap.add_argument("--selftest", action="store_true",
                    help="既存の v3 レコードをこの道具の枠に通して、枠が生きているか確かめる")
    args = ap.parse_args()
    if args.selftest:
        return selftest()
    if not (args.journal and args.block and args.ids):
        ap.error("journal・block・ids の3つが要ります（または --selftest）")
    return merge(args.journal, args.block, args.ids.split(","))


if __name__ == "__main__":
    sys.exit(main())
