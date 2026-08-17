#!/usr/bin/env python3
"""kinship フェーズ2b（maternalLineage 生母の全域収録）Workflow 結果のマージスクリプト。

usage: python3 merge_kinship_mother.py <journal.jsonl> <block名> <期待id カンマ区切り>

merge_kinship_parentage.py からの差分:
- motherStatus（recorded | unknown-confirmed）とエッジ実体の突合（実母/養母エッジ）
- verified 実母エッジは子ごとに最大1本
- marriage エッジ（生母が父の正妻の場合のみ・relation キーを持たない）を許容
- 母方祖先チェーン用の 実父/実母 エッジ（to = 母ノード）も許容する
- confirmedMotherUnknown の未登録リマインダー
- パッセージは _corpus_cache/kinship/<id>.txt へ「フェーズ2b」セクションとして追記
- completedBlocks の phase は "maternalLineage"

判定には一切関与しない（構造チェックと機械的マージのみ）。
"""
import json, sys, os

KINSHIP_EDGE_KEYS = {"type", "relation", "from", "to", "childOrder", "primaryLineage",
                     "veracity", "confidence", "note", "source"}
KINSHIP_EDGE_REQUIRED = {"type", "relation", "from", "to", "veracity", "confidence", "note", "source"}
MARRIAGE_EDGE_KEYS = {"type", "from", "to", "veracity", "confidence", "note", "source"}
MARRIAGE_EDGE_REQUIRED = MARRIAGE_EDGE_KEYS
RELATIONS = {"実父", "実母", "養父", "養母", "兄弟姉妹"}
MOTHER_RELATIONS = {"実母", "養母"}
PERSON_KEYS = {"id", "name", "kana", "aliases", "kind", "gender", "section", "birthYear",
               "deathYear", "yearsApproximate", "posthumous", "inclusionReason", "note",
               "wikidata", "source"}
PERSON_REQUIRED = {"id", "name", "kana", "kind", "gender", "section", "birthYear",
                   "deathYear", "yearsApproximate", "inclusionReason", "note", "wikidata", "source"}


def main():
    journal_path, block_name, id_csv = sys.argv[1], sys.argv[2], sys.argv[3]
    expected = id_csv.split(",")

    results = {}
    with open(journal_path, encoding="utf-8") as f:
        for line in f:
            ev = json.loads(line)
            if ev.get("type") in ("agent_result", "result", "agent_completed", "completed"):
                val = ev.get("result", ev.get("value"))
                if isinstance(val, dict) and "id" in val and "edges" in val and "motherStatus" in val:
                    results[val["id"]] = val

    with open("data/kinship.json", encoding="utf-8") as f:
        kin = json.load(f)
    with open("data/emperors.json", encoding="utf-8") as f:
        emp = json.load(f)
    emperor_ids = {e["id"] for e in emp["emperors"]}
    existing_pids = {p["id"] for p in kin["persons"]}
    existing_pname = {p["id"]: p.get("name") for p in kin["persons"]}
    existing_edges = {}
    for e in kin["edges"]:
        if e["type"] == "marriage":
            existing_edges[("marriage", None) + tuple(sorted((e["from"], e["to"])))] = e
        else:
            existing_edges[(e["type"], e.get("relation"), e["from"], e["to"])] = e

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
                errors.append(f"{eid}: エッジ type が不正 ({et})（このフェーズは kinship / marriage のみ）")
                continue
            bad = set(edge) - keys
            if bad:
                errors.append(f"{eid}: エッジに余計なキー {bad}")
            miss = required - set(edge)
            if miss:
                errors.append(f"{eid}: エッジに必須キー欠落 {miss}")
                continue
            if et == "kinship" and edge["relation"] not in RELATIONS:
                errors.append(f"{eid}: relation が enum 外 ({edge['relation']})")
            if edge["from"] not in allowed_nodes:
                errors.append(f"{eid}: from が未知ノード ({edge['from']})")
            if edge["to"] not in allowed_nodes:
                errors.append(f"{eid}: to が未知ノード ({edge['to']})")
            if edge["from"] == edge["to"]:
                errors.append(f"{eid}: 自己ループ ({edge['from']})")
            if "childOrder" in edge and (not isinstance(edge["childOrder"], int) or edge["childOrder"] < 1):
                errors.append(f"{eid}: childOrder が1以上の整数でない ({edge.get('childOrder')})")
            if et == "kinship" and edge["to"] == eid and edge["relation"] in MOTHER_RELATIONS:
                mother_edges += 1
                if edge["relation"] == "実母" and edge["veracity"] == "verified":
                    verified_mother.setdefault(edge["to"], []).append(edge["from"])
        for to, mothers in verified_mother.items():
            if len(mothers) > 1:
                errors.append(f"{eid}: verified 実母エッジが複数 ({mothers})")
        existing_mother = any(
            e["type"] == "kinship" and e.get("relation") in MOTHER_RELATIONS and e["to"] == eid
            for e in kin["edges"])
        ms = r.get("motherStatus")
        if ms == "recorded" and mother_edges == 0 and not existing_mother:
            errors.append(f"{eid}: motherStatus=recorded だが本人への実母/養母エッジなし")
        elif ms == "unknown-confirmed":
            if mother_edges > 0:
                errors.append(f"{eid}: motherStatus=unknown-confirmed だが実母/養母エッジあり")
            elif eid not in {x.get("id") for x in kin["meta"].get("confirmedMotherUnknown", [])}:
                warnings.append(f"{eid}: motherStatus=unknown-confirmed —— meta.confirmedMotherUnknown への登録が必要（マージ後に flags を基に reason を書いて手動追加すること。忘れると maternalLineage 完了時の網羅性チェックで落ちる）")
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
                errors.append(f"{eid}: persons {pid} に必須キー欠落 {miss}")
            if not str(pid).startswith("p-"):
                errors.append(f"{eid}: persons id が p- で始まらない ({pid})")
            if pid in existing_pids:
                ex_name = existing_pname.get(pid)
                if ex_name is not None and ex_name != p.get("name"):
                    errors.append(f"{eid}: persons {pid} は既存の別人と id 衝突の疑い（既存 name={ex_name} / 提案 name={p.get('name')}）——接尾辞方式で別 id を割り当てて調停すること")
                else:
                    warnings.append(f"{eid}: persons {pid} は既存——新規レコードを破棄し既存を参照させる（内容差分は要目視: 提案 name={p.get('name')}）")
                continue
            if pid in new_persons:
                if new_persons[pid][1].get("name") != p.get("name"):
                    errors.append(f"persons {pid}: 別人の id 衝突疑い（{new_persons[pid][0]} 提案 name={new_persons[pid][1].get('name')} / {eid} 提案 name={p.get('name')}）——接尾辞方式で別 id を割り当てて調停すること")
                elif new_persons[pid][1] == p:
                    infos.append(f"persons {pid}: 複数エージェントが同一内容を提案（1件採用）")
                else:
                    warnings.append(f"persons {pid}: 複数提案に差分あり——先勝ち（{new_persons[pid][0]}）を採用、{eid} 案を破棄。差分要目視:\n    採用: {json.dumps(new_persons[pid][1], ensure_ascii=False)}\n    破棄: {json.dumps(p, ensure_ascii=False)}")
                continue
            new_persons[pid] = (eid, p)
        passages[eid] = {"mother": r.get("passages", {}).get("mother", "")}

    if errors:
        print("MERGE ABORTED:")
        for e in errors:
            print(" -", e)
        sys.exit(1)

    flat_edges, dup_conflicts = [], []
    seen_new = set()
    for eid, edges in new_edges:
        for edge in edges:
            if edge["type"] == "marriage":
                key = ("marriage", None) + tuple(sorted((edge["from"], edge["to"])))
            else:
                key = (edge["type"], edge.get("relation"), edge["from"], edge["to"])
            if key in existing_edges:
                if existing_edges[key] == edge:
                    infos.append(f"既存エッジと完全一致のためスキップ: {key}")
                else:
                    dup_conflicts.append((eid, key))
                continue
            if key in seen_new:
                prev = next(e for e in flat_edges
                            if (("marriage", None) + tuple(sorted((e["from"], e["to"])))
                                if e["type"] == "marriage"
                                else (e["type"], e.get("relation"), e["from"], e["to"])) == key)
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
        sys.exit(1)

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
    with open("data/kinship.json", "w", encoding="utf-8") as f:
        json.dump(kin, f, ensure_ascii=False, indent=2)
        f.write("\n")

    os.makedirs("_corpus_cache/kinship", exist_ok=True)
    for eid, ps in passages.items():
        txt = (ps.get("mother") or "").strip()
        with open(f"_corpus_cache/kinship/{eid}.txt", "a", encoding="utf-8") as f:
            f.write(f"\n## フェーズ2b maternalLineage 生母調査時の原文パッセージ (mother)\n{txt}\n")

    for w in warnings:
        print("WARNING:", w)
    for i in infos:
        print("INFO:", i)
    marriages = sum(1 for e in flat_edges if e["type"] == "marriage")
    print(f"OK: edges+{len(flat_edges)}（うち marriage {marriages}） persons+{len(new_persons)} passages={len(passages)}")


if __name__ == "__main__":
    main()
