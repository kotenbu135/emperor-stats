"""note/quote 内の正史原文引用の実在照合ゲート（層A の恒久化・task 由来: 2026-07-22 note 全件検証）。

使い方:
  python3 scripts/verify_quotes.py --check           # 台帳突合＋コーパス再照合（ローカル完了ゲート・要コーパス）
  python3 scripts/verify_quotes.py --check-coverage  # 台帳カバレッジのみ（コーパス不要・CI 用）。
                                                     # 全引用ユニットが台帳にハッシュ一致で登録済みかを検証し、
                                                     # 台帳未更新の引用追加・改変をコミット段階で確実に検出する
  python3 scripts/verify_quotes.py --backfill        # 未解決ユニットをコーパス走査で解決し台帳を更新

注意: 台帳キーのハッシュは正規化（hanzi_norm）に opencc を使うため、CI にも
opencc-python-reimplemented を導入すること（無いとハッシュがずれ全件不一致になる）。
照合は断片ベースのため「引用がコーパスに実在する」ことの保証であり、逐語完全一致の保証ではない。

仕組み:
  - emperors.json から「引用ユニット」（reigns[].duration.source.quote の各引用＋全 note 系フィールドの
    かな無し・漢字6字以上の「」内スパン）を抽出し、正規化ハッシュをキーに data/quote-refs.json（照合台帳）と対応させる
  - 台帳 status: cache / corpus（機械照合済み・再検証可能） / manual（2026-07-22 エージェント個別確認済み） /
    external（コーパス外資料・非引用の慣用句等＝照合対象外） / defect（引用の誤字・改変が確認済み＝訂正待ち） /
    lacuna（コーパス側欠落） / unresolved（未解決＝エラー）
  - 引用を変更・追加するとハッシュが変わり台帳エントリが無くなる → --check がエラー
    → 調査者は quote_helper.py で原文から引用を作り、--backfill で台帳を更新してからコミットする
  - 正規化は scripts/hanzi_norm.py（漢字のみ＋新字体→繁体→簡体）。ルール詳細は
    docs/process/RESEARCH_PROCESS.md「引用の取り扱い規約」を参照
  - コーパス（china-history/・daizhigev20/・_corpus_cache/）はローカル限定のため、
    無い環境（GitHub Actions 等）では自動スキップ（exit 0）。このゲートはローカルで実行する

終了コード: 0=合格（警告含む） / 1=エラー（unresolved・台帳未登録・照合失敗）
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from hanzi_norm import han_only, norm_for_match, to_traditional  # noqa: E402

DATA_PATH = ROOT / "data" / "emperors.json"
REFS_PATH = ROOT / "data" / "quote-refs.json"
# コーパスの実体はメインリポジトリ側（worktree では ROOT 直下に無い場合がある）
CORPUS_ROOTS = [p for p in (ROOT, Path("/home/sakis/emperor-stats")) if (p / "_corpus_cache").is_dir()]
CORPUS_ROOT = CORPUS_ROOTS[0] if CORPUS_ROOTS else None
SCAN_DIRS = ["daizhigev20/史藏", "china-history", "daizhigev20/子藏/类书"]

GROUPS = ("eraChangeCount", "amnestyCount", "empressInstallationCount", "crownPrinceDepositionCount",
          "personalCampaignCount", "rebellionSuppressionCount", "rebellionSufferedCount", "capitalRelocationCount")
KANA = re.compile(r"[ぁ-んァ-ヶ]")


def quoted_spans(text):
    out = []
    for m in re.finditer(r"「([^」]+)」", text or ""):
        s = m.group(1)
        if KANA.search(s):
            continue
        if len(han_only(s)) >= 6:
            out.append(s)
    return out


def extract_units(data):
    """引用ユニット一覧: (eid, path, span)。抽出規則を変えると台帳キーが変わるため変更時は要バックフィル。"""
    units = []
    for e in data["emperors"]:
        eid = e["id"]
        for i, r in enumerate(e.get("reigns") or []):
            s = (r.get("duration") or {}).get("source") or {}
            q = s.get("quote")
            if q:
                for j, part in enumerate(re.split(r"[／/]", q)):
                    part2 = re.sub(r"（[^）]{0,30}）|【[^】]{0,30}】", "", part)
                    if len(han_only(part2)) >= 6:
                        units.append((eid, f"reigns[{i}].quote#{j}", part2))
            for span in quoted_spans(s.get("conversion")):
                units.append((eid, f"reigns[{i}].conversion", span))
            for span in quoted_spans(r.get("note")):
                units.append((eid, f"reigns[{i}].note", span))
        for g in GROUPS:
            o = e.get(g)
            if not isinstance(o, dict):
                continue
            for span in quoted_spans(o.get("note")):
                units.append((eid, f"{g}.note", span))
            for k, ev in enumerate(o.get("events") or []):
                for span in quoted_spans(ev.get("note")):
                    units.append((eid, f"{g}[{k}].note", span))
        for f in ("deathCause", "accessionRoute"):
            for span in quoted_spans((e.get(f) or {}).get("note")):
                units.append((eid, f"{f}.note", span))
        for span in quoted_spans((e.get("ages") or {}).get("note")):
            units.append((eid, "ages.note", span))
    return units


def unit_key(eid, path, span):
    h = hashlib.sha1(norm_for_match(span).encode()).hexdigest()[:12]
    return f"{eid}|{path}|{h}"


def fragments(span, size=10):
    frags = []
    for seg in re.split(r"[…⋯]+|\.{3,}|——|／|/", span):
        s = norm_for_match(seg)
        if len(s) >= 6:
            frags.append(s[:size])
            if len(s) >= 2 * size:
                frags.append(s[len(s) // 2:len(s) // 2 + size])
    return frags[:4]


def sliding_fragments(span, size=6, step=3, cap=8):
    s = norm_for_match(span)
    out = [s[i:i + size] for i in range(0, max(1, len(s) - size + 1), step)]
    return [f for f in out[:cap] if len(f) == size] or ([s] if len(s) >= 4 else [])


def gap_pattern(f):
    return "[^㐀-鿿]{0,3}".join(re.escape(c) for c in f)


def load_refs():
    if REFS_PATH.exists():
        return json.loads(REFS_PATH.read_text(encoding="utf-8"))
    return {"meta": {"description": "引用照合台帳（verify_quotes.py が生成・更新。手編集は status の curation のみ）"},
            "refs": {}}


def save_refs(refs):
    refs["refs"] = dict(sorted(refs["refs"].items()))
    REFS_PATH.write_text(json.dumps(refs, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------

_file_cache: dict[str, str] = {}


def normalized_file(relpath):
    if relpath not in _file_cache:
        p = CORPUS_ROOT / relpath
        _file_cache[relpath] = norm_for_match(p.read_text(encoding="utf-8", errors="ignore")) if p.exists() else ""
    return _file_cache[relpath]


def rg_provenance_scan(frag_list):
    """断片→初出コーパスファイル。ギャップ許容 regex を rg --json で一括走査。"""
    hits = {}
    todo = []
    for f in frag_list:
        for form in {f, to_traditional(f)}:
            todo.append((f, form))
    BATCH = 80
    for i in range(0, len(todo), BATCH):
        batch = todo[i:i + BATCH]
        args = ["rg", "--json", "-N"]
        for _, form in batch:
            args += ["-e", gap_pattern(form)]
        args += [str(CORPUS_ROOT / d) for d in SCAN_DIRS]
        r = subprocess.run(args, capture_output=True, text=True, timeout=900)
        for line in r.stdout.splitlines():
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if obj.get("type") != "match":
                continue
            path = obj["data"]["path"]["text"]
            for sm in obj["data"].get("submatches", []):
                h = norm_for_match(sm["match"]["text"])
                if h and h not in hits:
                    hits[h] = str(Path(path).relative_to(CORPUS_ROOT))
    return hits


def resolve_units(pending, log=print):
    """機械照合: 本人キャッシュ → コーパス走査（10字断片）→ 短断片再試行（6字）。"""
    resolved = {}
    cache_norm = {}

    def cache_text(eid):
        if eid not in cache_norm:
            p = CORPUS_ROOT / "_corpus_cache" / f"{eid}.txt"
            cache_norm[eid] = norm_for_match(p.read_text(encoding="utf-8", errors="ignore")) if p.exists() else ""
        return cache_norm[eid]

    still = []
    for key, (eid, path, span) in pending.items():
        frags = fragments(span)
        if frags and sum(f in cache_text(eid) for f in frags) * 2 >= len(frags):
            resolved[key] = {"status": "cache", "corpusFile": f"_corpus_cache/{eid}.txt", "frags": frags}
        else:
            still.append((key, eid, path, span))
    log(f"  cache 照合: {len(resolved)} / 残 {len(still)}")

    for size_name, frag_fn in (("10字", fragments), ("6字", sliding_fragments)):
        if not still:
            break
        frag_map = {key: frag_fn(span) for key, _, _, span in still}
        all_frags = sorted({f for fs in frag_map.values() for f in fs})
        hits = rg_provenance_scan(all_frags)
        nxt = []
        for key, eid, path, span in still:
            fs = frag_map[key]
            found = [f for f in fs if f in hits]
            need = 1 if len(fs) <= 2 else (len(fs) + 1) // 2
            if fs and len(found) >= need:
                resolved[key] = {"status": "corpus", "corpusFile": hits[found[0]], "frags": found}
            else:
                nxt.append((key, eid, path, span))
        log(f"  コーパス走査({size_name}): 累計 {len(resolved)} / 残 {len(nxt)}")
        still = nxt
    return resolved, {key: (eid, path, span) for key, eid, path, span in still}


# ---------------------------------------------------------------------------

def cmd_backfill():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    units = extract_units(data)
    refs = load_refs()
    known = refs["refs"]
    pending = {}
    for eid, path, span in units:
        key = unit_key(eid, path, span)
        if key not in known or known[key].get("status") == "unresolved":
            pending[key] = (eid, path, span)
    print(f"引用ユニット {len(units)} / 台帳既存 {len(units) - len(pending)} / 解決対象 {len(pending)}")
    if not pending:
        save_refs(refs)
        return 0
    resolved, unresolved = resolve_units(pending)
    for key, entry in resolved.items():
        eid, path, span = pending[key]
        known[key] = {"id": eid, "path": path, "span": span[:40], **entry}
    for key, (eid, path, span) in unresolved.items():
        known.setdefault(key, {"id": eid, "path": path, "span": span[:40], "status": "unresolved"})
    save_refs(refs)
    print(f"解決 {len(resolved)} / 未解決 {len(unresolved)} → {REFS_PATH.relative_to(ROOT)}")
    if unresolved:
        print("未解決ユニット（手動確認して status を curation するか、引用を修正すること）:")
        for key, (eid, path, span) in list(unresolved.items())[:40]:
            print(f"  {eid} {path}: 「{span[:36]}…」")
    return 0


def cmd_check(coverage_only=False):
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    units = extract_units(data)
    refs = load_refs()
    known = refs["refs"]
    errors, warnings = [], []
    counts = Counter()
    seen_keys = set()
    recheck_fail = []
    for eid, path, span in units:
        key = unit_key(eid, path, span)
        seen_keys.add(key)
        ent = known.get(key)
        if ent is None:
            errors.append(f"[quote-refs] {eid} {path}: 台帳に未登録の引用（新規・変更時は "
                          f"scripts/quote_helper.py で作成し --backfill を実行）:「{span[:30]}…」")
            continue
        st = ent.get("status")
        counts[st] += 1
        if st == "unresolved":
            errors.append(f"[quote-refs] {eid} {path}: 未解決のまま:「{span[:30]}…」")
        elif coverage_only:
            pass  # カバレッジ検査ではコーパス再照合を行わない
        elif st in ("cache", "corpus"):
            frags = ent.get("frags") or []
            text = normalized_file(ent.get("corpusFile", ""))
            if not text:
                warnings.append(f"[quote-refs] {eid} {path}: corpusFile が読めない: {ent.get('corpusFile')}")
            elif frags and not any(f in text for f in frags):
                recheck_fail.append(f"{eid} {path} ({ent.get('corpusFile')})")
    stale = [k for k in known if k not in seen_keys]
    if stale:
        warnings.append(f"[quote-refs] 台帳の陳腐化エントリ（引用の変更・削除済み・掃除可）: {len(stale)} 件")
    if recheck_fail:
        errors.append(f"[quote-refs] 台帳の再照合失敗（コーパス変更または台帳破損）: {recheck_fail[:10]}")
    if counts.get("defect"):
        warnings.append(f"[quote-refs] defect（引用の誤字・改変が確認済み・訂正待ち）: {counts['defect']} 件 "
                        f"（一覧: docs/qa/note-verification-2026-07-22/REPORT.md）")
    if counts.get("lacuna"):
        warnings.append(f"[quote-refs] lacuna（コーパス側欠落で照合不能）: {counts['lacuna']} 件")

    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"ERROR {e}")
    mode = "coverage" if coverage_only else "full"
    print(f"---\n{len(errors)} errors, {len(warnings)} warnings / units={len(units)} mode={mode} "
          f"status={dict(counts)}")
    return 1 if errors else 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--backfill", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--check-coverage", action="store_true",
                    help="台帳カバレッジのみ検証（コーパス不要・CI 用）")
    args = ap.parse_args()
    import hanzi_norm
    if hanzi_norm._T2S is None:
        print("ERROR opencc が見つかりません（pip install opencc-python-reimplemented）。"
              "台帳ハッシュの正規化に必須のため、無いまま実行すると全件不一致になります")
        return 1
    if args.check_coverage:
        return cmd_check(coverage_only=True)
    if CORPUS_ROOT is None:
        print("NOTICE: ローカルコーパス（_corpus_cache 等）が見つからないため --backfill/--check を"
              "スキップ（コーパス不要の検証は --check-coverage を使う。CI はそちらを実行する）")
        return 0
    if args.backfill:
        return cmd_backfill()
    return cmd_check()


if __name__ == "__main__":
    sys.exit(main())
