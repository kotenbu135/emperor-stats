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
from hanzi_norm import han_only, norm_for_match, norm_variants, to_traditional  # noqa: E402

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


ELLIPSIS_RE = re.compile(r"[…⋯‥・]+|\.{2,}|。{2,}|——|／|/")
PUNCT_RE = re.compile(r"[、。，,；;：:！!？?（）()「」『』〔〕【】\s]")


def fragments(span, size=10, min_len=5):
    """引用を中略・句読点で節に割り、各節の先頭 size 字を照合単位にする。

    句読点をまたいで機械的に10字取ると原文に無い並びが生まれ（「…冬十月戊辰帝崩…」）、
    実在する引用まで不検出になる。節の内側だけを見ること。
    """
    frags = []
    for seg in ELLIPSIS_RE.split(span or ""):
        for part in PUNCT_RE.split(seg):
            h = han_only(part)
            if len(h) >= min_len:
                frags.append(h[:size])
    return frags[:8]


def sliding_fragments(span, size=6, step=3, cap=8):
    """節分割で断片が取れない短い引用の救済。中略はまたがない。"""
    segs = [han_only(s) for s in ELLIPSIS_RE.split(span or "")]
    s = max(segs, key=len) if segs else ""
    out = [s[i:i + size] for i in range(0, max(1, len(s) - size + 1), step)]
    return [f for f in out[:cap] if len(f) == size] or ([s] if len(s) >= 4 else [])


def source_rank(rel):
    """同じ断片が複数の書に在るときの採用順。低いほど優先。

    白話訳は「原文ラベルなのに中身が現代語訳」という既知の罠（CORPUS_NOTES）なので
    最下位に落とす。類書・地方志より正史の本紀を先に採る。
    """
    if "白话" in rel or "白話" in rel:
        return 9
    if rel.startswith("_corpus_cache"):
        return 0
    if rel.startswith("china-history/") or "/正史/" in rel:
        return 1
    if "/编年/" in rel or "/纪事本末/" in rel:
        return 2
    if "/载记/" in rel or "/别史/" in rel:
        return 3
    return 4


def frag_in(frag, normalized_text):
    """断片が本文にあるか。底本にも現れうる字体差は候補を並べて判定する。"""
    return any(v in normalized_text for v in norm_variants(frag))


_lines_cache: dict[str, list] = {}


def normalized_lines(relpath):
    if relpath not in _lines_cache:
        p = CORPUS_ROOT / relpath
        raw = p.read_text(encoding="utf-8", errors="ignore") if p.exists() else ""
        _lines_cache[relpath] = [norm_for_match(x) for x in raw.splitlines()]
    return _lines_cache[relpath]


def line_of(relpath, frag):
    """断片が最初に現れる行番号（1始まり）。再調査でその場を開くために台帳へ残す。"""
    for i, s in enumerate(normalized_lines(relpath), 1):
        if frag_in(frag, s):
            return i
    return None


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
        forms = set(norm_variants(f)) | {to_traditional(f)}
        for form in forms:
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
            rel = str(Path(path).relative_to(CORPUS_ROOT))
            for sm in obj["data"].get("submatches", []):
                for h in norm_variants(sm["match"]["text"]):
                    if not h:
                        continue
                    seen = hits.setdefault(h, [])
                    if rel not in seen and len(seen) < 12:
                        seen.append(rel)
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
        rel = f"_corpus_cache/{eid}.txt"
        # 全断片が当たることを要求する。半数一致で通していた頃は、断片が節をまたいで
        # 切られていたぶんの取りこぼしを「半分当たれば良い」で吸収してしまっていた。
        if frags and all(frag_in(f, cache_text(eid)) for f in frags):
            resolved[key] = {"status": "cache", "corpusFile": rel, "frags": frags,
                             "line": line_of(rel, frags[0])}
        else:
            still.append((key, eid, path, span))
    log(f"  cache 照合: {len(resolved)} / 残 {len(still)}")

    for size_name, frag_fn in (("節", fragments), ("6字", sliding_fragments)):
        if not still:
            break
        frag_map = {key: frag_fn(span) for key, _, _, span in still}
        all_frags = sorted({f for fs in frag_map.values() for f in fs})
        hits = rg_provenance_scan(all_frags)
        nxt = []
        for key, eid, path, span in still:
            fs = frag_map[key]
            cands = []
            for f in fs:
                for v in norm_variants(f):
                    for rel in hits.get(v, ()):
                        if rel not in cands:
                            cands.append(rel)
            cands.sort(key=source_rank)
            hit = next((rel for rel in cands[:6]
                        if all(frag_in(f, normalized_file(rel)) for f in fs)), None)
            if fs and hit:
                resolved[key] = {"status": "corpus", "corpusFile": hit, "frags": fs,
                                 "line": line_of(hit, fs[0])}
            else:
                nxt.append((key, eid, path, span))
        log(f"  コーパス走査({size_name}): 累計 {len(resolved)} / 残 {len(nxt)}")
        still = nxt
    return resolved, {key: (eid, path, span) for key, eid, path, span in still}


# ---------------------------------------------------------------------------

CURATED = ("manual", "external", "defect")


def cmd_triage(reason):
    """未解決のうち印の無いものへ「調査待ち」を付ける（既知の残件と新規混入を分ける）。"""
    refs = load_refs()
    n = 0
    for ent in refs["refs"].values():
        if ent.get("status") == "unresolved" and not ent.get("triage"):
            ent["triage"] = reason
            n += 1
    save_refs(refs)
    print(f"調査待ちの印を付けた: {n} 件（reason={reason}）")
    return 0


def cmd_list_triaged():
    refs = load_refs()
    rows = [(v.get("id"), v.get("path"), v.get("span", ""), v.get("triage"))
            for v in refs["refs"].values() if v.get("triage")]
    for eid, path, span, why in sorted(rows):
        print(f"{eid}\t{path}\t{span}\t{why}")
    print(f"--- {len(rows)} 件")
    return 0


def cmd_backfill(rebuild=False):
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    units = extract_units(data)
    refs = load_refs()
    known = refs["refs"]
    pending = {}
    for eid, path, span in units:
        key = unit_key(eid, path, span)
        ent = known.get(key)
        # --rebuild は照合器を変えたときに機械判定だけを作り直す。
        # 人が curation した status（manual/external/defect）は残す。
        if ent is None or ent.get("status") == "unresolved" or (
                rebuild and ent.get("status") not in CURATED):
            pending[key] = (eid, path, span)
    if rebuild:
        # 作り直す対象の古い判定は先に落とす。残すと、新しい基準で解決できなかった
        # ユニットが古い cache/corpus 判定のまま台帳に居座る（setdefault のため）。
        live = {unit_key(eid, path, span) for eid, path, span in units}
        for key in list(known):
            if key in pending or key not in live:
                known.pop(key)
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
            # triage 済み＝「底本で確認できないことを把握したうえで調査待ちにした」分。
            # 印の無い未解決は新規発生なのでエラーにする（印は隠すためではなく、
            # 既知の残件と新規の混入を分けるためにある）。
            if ent.get("triage"):
                counts["triaged"] += 1
            else:
                errors.append(f"[quote-refs] {eid} {path}: 未解決のまま:「{span[:30]}…」")
        elif coverage_only:
            pass  # カバレッジ検査ではコーパス再照合を行わない
        elif st in ("cache", "corpus"):
            frags = ent.get("frags") or []
            text = normalized_file(ent.get("corpusFile", ""))
            if not text:
                warnings.append(f"[quote-refs] {eid} {path}: corpusFile が読めない: {ent.get('corpusFile')}")
            elif frags and not all(frag_in(f, text) for f in frags):
                recheck_fail.append(f"{eid} {path} ({ent.get('corpusFile')})")
    stale = [k for k in known if k not in seen_keys]
    if stale:
        warnings.append(f"[quote-refs] 台帳の陳腐化エントリ（引用の変更・削除済み・掃除可）: {len(stale)} 件")
    if recheck_fail:
        errors.append(f"[quote-refs] 台帳の再照合失敗（コーパス変更または台帳破損）: {recheck_fail[:10]}")
    if counts.get("triaged"):
        warnings.append(f"[quote-refs] 調査待ちの未解決引用（底本で確認できず・原典の再調査が要る）: "
                        f"{counts['triaged']} 件（一覧: python3 scripts/verify_quotes.py --list-triaged）")
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
    ap.add_argument("--triage", metavar="REASON",
                    help="未解決のうち印の無いものへ調査待ちの印を付ける（REASON に経緯・Issue番号）")
    ap.add_argument("--list-triaged", action="store_true", help="調査待ちの一覧を出す")
    ap.add_argument("--rebuild", action="store_true",
                    help="--backfill と併用。照合器を変えたとき機械判定を作り直す"
                         "（manual/external/defect の curation は残す）")
    args = ap.parse_args()
    import hanzi_norm
    if hanzi_norm._T2S is None:
        print("ERROR opencc が見つかりません（pip install opencc-python-reimplemented）。"
              "台帳ハッシュの正規化に必須のため、無いまま実行すると全件不一致になります")
        return 1
    if args.list_triaged:
        return cmd_list_triaged()
    if args.triage:
        return cmd_triage(args.triage)
    if args.check_coverage:
        return cmd_check(coverage_only=True)
    if CORPUS_ROOT is None:
        print("NOTICE: ローカルコーパス（_corpus_cache 等）が見つからないため --backfill/--check を"
              "スキップ（コーパス不要の検証は --check-coverage を使う。CI はそちらを実行する）")
        return 0
    if args.backfill:
        return cmd_backfill(rebuild=args.rebuild)
    return cmd_check()


if __name__ == "__main__":
    sys.exit(main())
