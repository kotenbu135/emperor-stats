#!/usr/bin/env python3
"""生母フェーズ（maternalLineage）のブロック単位 Wikidata P25 突合スクリーニング。

usage: python3 crosscheck_mothers_p25.py <皇帝id カンマ区切り>

情報源ではなく**漏れ・取り違えの検出用**（既存 QA 運用と同じ・CI 非組込）。
1ブロック1リクエスト（SPARQL の VALUES で一括）。判定は必ず原典に戻して行う。

出力の見方:
  MATCH        我々の実母ノードと WD の P25 ラベルが（正規化後の部分一致で）対応
  MISMATCH     双方に値があるが名前が対応しない → 要原典再確認
  WD-NONE      WD に P25 が無い（我々のデータのみ・所見なし）
  OURS-NONE    我々が confirmedMotherUnknown / 未調査で WD には母がある → 要確認
  BOTH-NONE    双方とも母なし
"""
import json, sys, os, subprocess, urllib.parse

sys.path.insert(0, os.path.join(os.getcwd(), "scripts"))
from hanzi_norm import norm_for_match

# hanzi_norm が吸収しない異体（姬/姫・媪/媼 等）と括弧類を潰す照合用の追加正規化。
# 名前照合の当たり判定を広げるだけで、判定そのものは常に原典に戻して行う。
VARIANTS = str.maketrans({"姬": "姫", "媪": "媼", "妃": "妃", "呂": "吕",
                          "〔": "", "〕": "", "（": "", "）": "", "(": "", ")": "",
                          "[": "", "]": "", " ": "", "　": ""})


def norm2(s: str) -> str:
    return norm_for_match(s.translate(VARIANTS)).translate(VARIANTS)

ENDPOINT = "https://query.wikidata.org/sparql"
UA = "emperor-stats-kinship-qa/1.0 (https://emperorstats.com; local research QA)"


def sparql(qids):
    values = " ".join(f"wd:{q}" for q in qids)
    query = f"""
SELECT ?e ?m ?mLabelZh ?mLabelJa ?mLabelEn WHERE {{
  VALUES ?e {{ {values} }}
  OPTIONAL {{
    ?e wdt:P25 ?m .
    OPTIONAL {{ ?m rdfs:label ?mLabelZh . FILTER(LANG(?mLabelZh) IN ("zh","zh-hans","zh-hant")) }}
    OPTIONAL {{ ?m rdfs:label ?mLabelJa . FILTER(LANG(?mLabelJa) = "ja") }}
    OPTIONAL {{ ?m rdfs:label ?mLabelEn . FILTER(LANG(?mLabelEn) = "en") }}
  }}
}}"""
    url = ENDPOINT + "?format=json&query=" + urllib.parse.quote(query)
    out = subprocess.run(["curl", "-sS", "-H", f"User-Agent: {UA}", url],
                         capture_output=True, text=True, timeout=180)
    if out.returncode != 0:
        print("SPARQL 取得失敗:", out.stderr[:400])
        sys.exit(1)
    return json.loads(out.stdout)["results"]["bindings"]


def main():
    ids = sys.argv[1].split(",")
    kin = json.load(open("data/kinship.json", encoding="utf-8"))
    emp = json.load(open("data/emperors.json", encoding="utf-8"))
    qid_by_id, name_by_id = {}, {}
    for e in emp["emperors"]:
        if e["id"] in ids:
            qid_by_id[e["id"]] = (e.get("sources") or {}).get("wikidata")
            name_by_id[e["id"]] = e["name"].get("commonName") or e["name"].get("posthumousName")
    persons = {p["id"]: p for p in kin["persons"]}
    mothers = {}
    for edge in kin["edges"]:
        if edge["type"] == "kinship" and edge.get("relation") in ("実母", "養母"):
            mothers.setdefault(edge["to"], []).append(edge["from"])
    unknown = {c["id"] for c in kin["meta"].get("confirmedMotherUnknown", [])}

    qids = [q for q in (qid_by_id.get(i) for i in ids) if q]
    rows = sparql(qids)
    wd = {}
    for r in rows:
        eq = r["e"]["value"].rsplit("/", 1)[-1]
        if "m" not in r:
            wd.setdefault(eq, [])
            continue
        labels = [r[k]["value"] for k in ("mLabelZh", "mLabelJa", "mLabelEn") if k in r]
        wd.setdefault(eq, []).append((r["m"]["value"].rsplit("/", 1)[-1], labels))

    counts = {}
    for eid in ids:
        q = qid_by_id.get(eid)
        ours = []
        for mid in mothers.get(eid, []):
            p = persons.get(mid)
            ours.append((mid, [p["name"]] + list(p.get("aliases") or []) if p else [mid]))
        theirs = wd.get(q, [])
        if not ours and not theirs:
            verdict = "BOTH-NONE"
        elif ours and not theirs:
            verdict = "WD-NONE"
        elif theirs and not ours:
            verdict = "OURS-NONE" + ("（confirmedMotherUnknown 登録済み）" if eid in unknown else "（未調査）")
        else:
            hit = False
            # QID 一致（最強の同定シグナル。名前表記差による偽 MISMATCH を防ぐ）
            our_qids = {persons[m].get("wikidata") for m, _ in ours if persons.get(m)}
            if our_qids & {tq for tq, _ in theirs} - {None}:
                hit = True
            for _, onames in ours:
                for on in onames:
                    a = norm2(on)
                    for _, tlabels in theirs:
                        for tl in tlabels:
                            b = norm2(tl)
                            if a and b and (a in b or b in a):
                                hit = True
            verdict = "MATCH" if hit else "MISMATCH"
        counts[verdict.split("（")[0]] = counts.get(verdict.split("（")[0], 0) + 1
        ours_s = " / ".join(f"{m}({names[0]})" for m, names in ours) or "-"
        theirs_s = " / ".join(f"{m}({'|'.join(l)})" for m, l in theirs) or "-"
        mark = "!!" if verdict.startswith(("MISMATCH", "OURS-NONE")) else "  "
        print(f"{mark}{verdict:12} {eid}({q}) ours=[{ours_s}] wd=[{theirs_s}]")
    print("---", " ".join(f"{k}={v}" for k, v in sorted(counts.items())))


if __name__ == "__main__":
    main()
