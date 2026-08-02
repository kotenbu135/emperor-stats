"""note/quote 内の正史原文引用の実在照合ゲート（層A の恒久化・task 由来: 2026-07-22 note 全件検証）。

使い方:
  python3 scripts/verify_quotes.py --check           # 台帳突合＋コーパス再照合（ローカル完了ゲート・要コーパス）
  python3 scripts/verify_quotes.py --check-coverage  # 台帳カバレッジのみ（コーパス不要・CI 用）。
                                                     # 全引用ユニットが台帳にハッシュ一致で登録済みかを検証し、
                                                     # 台帳未更新の引用追加・改変をコミット段階で確実に検出する
  python3 scripts/verify_quotes.py --backfill        # 未解決ユニットをコーパス走査で解決し台帳を更新
  python3 scripts/verify_quotes.py --backfill --retry-unresolved
                                                     # 走査済みの未解決も当て直す（コーパスを入れ替えた・書を足したとき）

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
import os
import re
import subprocess
import sys
from collections import Counter
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from hanzi_norm import (AMBIGUOUS_JP, han_only, norm_for_match, norm_strict,  # noqa: E402
                        norm_variants, to_traditional)

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

# 正規化結果のディスクキャッシュ（2026-08-02 導入）。
#
# --check の実行時間の 99.6% は「台帳が指すコーパス 789ファイル・472MB を opencc で
# 2通り（照合用・字体ゲート用）に正規化する」ことに費やされていた（純 Python の
# opencc-python-reimplemented は 0.918 秒/MB。断片の照合そのものは全体の 0.3%）。
# 底本が変わらなければ正規化結果も変わらないので、結果をそのまま持ち越す。
#
# 判定は変わらない: 保存するのは norm_for_match / norm_strict の出力そのもので、
# 鍵に mtime+size を含めるため底本を差し替えれば必ず作り直される。壊れた・読めない
# キャッシュは黙って捨てて計算し直すので、キャッシュの有無で結論は動かない。
# 検証を外部から切るには EMPSTATS_NORM_CACHE=0（現行実装との突き合わせ用）。
NORM_CACHE_DIR = (CORPUS_ROOT / "_norm_cache") if CORPUS_ROOT else None


def _norm_version():
    """正規化のしかたが変わったらキャッシュを捨てるための版。

    鍵を底本の mtime+size だけにすると、hanzi_norm.py の新字体表を足したときに
    キャッシュが生き残り、古い正規化のまま照合し続ける（表は 2026-08-02 にも
    132字を追加している＝実際に変わる）。表の中身と opencc の版を鍵へ混ぜておく。
    """
    h = hashlib.sha1((ROOT / "scripts" / "hanzi_norm.py").read_bytes())
    try:
        import importlib.metadata as md
        h.update(md.version("opencc-python-reimplemented").encode())
    except Exception:
        pass
    return h.hexdigest()[:8]


_NORM_VERSION = _norm_version()


def _cache_path(relpath, kind):
    return NORM_CACHE_DIR / f"{hashlib.sha1(relpath.encode()).hexdigest()[:16]}.{kind}"


def _cached_norm(relpath, kind, fn):
    p = CORPUS_ROOT / relpath
    if not p.exists():
        return ""
    if os.environ.get("EMPSTATS_NORM_CACHE") == "0" or NORM_CACHE_DIR is None:
        return fn(p.read_text(encoding="utf-8", errors="ignore"))
    st = p.stat()
    stamp = f"{_NORM_VERSION}\t{st.st_mtime_ns}:{st.st_size}\t{relpath}"
    cp = _cache_path(relpath, kind)
    try:
        with cp.open(encoding="utf-8") as fh:
            # 1行目が鍵、2行目以降が本文。正規化結果は漢字だけになる（han_only が
            # 改行も落とす）ので、この1行で本文と混ざる余地がない
            if fh.readline().rstrip("\n") == stamp:
                return fh.read()
    except OSError:
        pass
    text = fn(p.read_text(encoding="utf-8", errors="ignore"))
    try:
        NORM_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        # 別セッションが同じ底本を書いている最中でも半端なファイルを読ませない
        tmp = cp.with_name(f"{cp.name}.tmp{os.getpid()}")
        try:
            tmp.write_text(f"{stamp}\n{text}", encoding="utf-8")
            os.replace(tmp, cp)
        finally:
            if tmp.exists():   # 書けなかったぶんを置き去りにしない
                tmp.unlink()
    except OSError:
        pass
    return text


_file_cache: dict[str, str] = {}


def normalized_file(relpath, memo=True):
    """底本1ファイルの照合用正規化本文。

    memo=False は「一度しか見ないファイルを大量に舐める」用（--check-books の
    書まるごと走査）。全部を辞書に溜めると数百MBが常駐するので持ち回らない。
    """
    if not memo:
        return _file_cache.get(relpath) or _cached_norm(relpath, "match", norm_for_match)
    if relpath not in _file_cache:
        _file_cache[relpath] = _cached_norm(relpath, "match", norm_for_match)
    return _file_cache[relpath]


_strict_cache: dict[str, str] = {}


def strict_file(relpath):
    """底本本文を「新字体表なし」で正規化したもの（字体混入ゲート用）。"""
    if relpath not in _strict_cache:
        _strict_cache[relpath] = _cached_norm(relpath, "strict", norm_strict)
    return _strict_cache[relpath]


@lru_cache(maxsize=200_000)
def strict_variants(frag):
    base = han_only(frag)
    return tuple({norm_strict(v) for v in (base, base.translate(AMBIGUOUS_JP))})


# 判定結果のスタンプ（2026-08-02 導入）。
#
# --check は台帳 6,432 件を底本へ当て直すが、そのために _norm_cache 1.5GB を読む。
# ページキャッシュが生きていれば数秒、落ちていれば 168 秒（WSL2 実測）で、
# 落ちるのは直前にコーパス全文を走査したとき＝訂正ループのまさに最中だった。
#
# 同じ断片を同じ底本に同じ正規化で当てれば結果は同じなので、合格したことを
# 「引用ユニットのキー＋底本の mtime/size＋断片＋正規化の版＋glyphAllow の状態」の
# ハッシュで覚えておき、次回はその1件を読まずに済ませる。どれか1つでも動けば
# スタンプが変わって必ず読み直す。合格したものだけを覚える（不合格は毎回出す）。
#
# 覚えた件数は要約行に出す（0エラーが「綺麗」なのか「空回り」なのかを見えるようにする）。
# 全件を実際に読み直させるには EMPSTATS_NORM_CACHE=0。
VERDICT_PATH = (NORM_CACHE_DIR / "verdicts.json") if NORM_CACHE_DIR else None


def load_verdicts():
    """前回まで合格していたスタンプ集合。無効時は None（＝毎回読み直す）。"""
    if VERDICT_PATH is None or os.environ.get("EMPSTATS_NORM_CACHE") == "0":
        return None
    try:
        return set(json.loads(VERDICT_PATH.read_text(encoding="utf-8")))
    except (OSError, ValueError):
        return set()


def save_verdicts(stamps):
    if VERDICT_PATH is None or stamps is None:
        return
    try:
        NORM_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        tmp = VERDICT_PATH.with_name(f"verdicts.json.tmp{os.getpid()}")
        try:
            tmp.write_text(json.dumps(sorted(stamps)), encoding="utf-8")
            os.replace(tmp, VERDICT_PATH)
        finally:
            if tmp.exists():
                tmp.unlink()
    except OSError:
        pass


def verdict_stamp(key, ent, glyph_allowed):
    rel = ent.get("corpusFile") or ""
    try:
        st = (CORPUS_ROOT / rel).stat()
    except OSError:
        return None
    h = hashlib.sha1(f"{_NORM_VERSION}\t{st.st_mtime_ns}:{st.st_size}\t{rel}\t"
                     f"{glyph_allowed}\t{key}".encode())
    for f in ent.get("frags") or []:
        h.update(b"\t")
        h.update(f.encode())
    return h.hexdigest()[:16]


def frag_in_strict(frag, strict_text):
    """新字体表の助けなしに断片が底本に在るか。

    歳/歲 は底本側にも両方の字形が出るため候補を並べる（AMBIGUOUS_JP と同じ扱い）。
    """
    return any(v in strict_text for v in strict_variants(frag))


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
                    if rel not in seen and len(seen) < 24:
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
            # 書名まで含めて並べる。rg の返す順に任せると、同じ引用が実行ごとに
            # 別の書へ解決したり、上限に弾かれて未解決に落ちたりする
            cands.sort(key=lambda rel: (source_rank(rel), rel))
            hit = next((rel for rel in cands[:12]
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

# ---------------------------------------------------------------------------
# G1: note が名乗る書名と、引用が実在する書の突合（Issue #40）
# ---------------------------------------------------------------------------

def build_book_index():
    """コーパスのファイル名から書名→実体パスの索引を作る。

    書名を手で列挙すると、辞書に無い書（元史紀事本末）を「別の書を名乗っている」と
    誤読する。実体のファイル名だけを根拠にする。
    """
    idx: dict[str, list[str]] = {}
    for p in (CORPUS_ROOT / "daizhigev20/史藏").rglob("*.txt"):
        stem = p.stem[:-2] if p.stem.endswith("四库") else p.stem
        idx.setdefault(norm_for_match(stem), []).append(str(p.relative_to(CORPUS_ROOT)))
    for p in (CORPUS_ROOT / "daizhigev20/子藏/类书").glob("*.txt"):
        idx.setdefault(norm_for_match(p.stem), []).append(str(p.relative_to(CORPUS_ROOT)))
    for d in (CORPUS_ROOT / "china-history").iterdir():
        # 白話訳は書名としては同じ書。原文側だけを索引に入れる
        if d.is_dir() and not d.name.endswith("-白话"):
            idx.setdefault(norm_for_match(d.name), []).append(str(d.relative_to(CORPUS_ROOT)))
    return {k: v for k, v in idx.items() if len(k) >= 2}


# 同一の書の別名。前漢書＝漢書
BOOK_ALIAS = {"汉书": ("汉书", "前汉书"), "前汉书": ("汉书", "前汉书")}


def book_of_file(rel):
    """コーパスの相対パスから書名（正規化済み）。本紀キャッシュは書が特定できない。"""
    if rel.startswith("_corpus_cache"):
        return None
    if rel.startswith("china-history/"):
        return norm_for_match(rel.split("/")[1].replace("-白话", ""))
    stem = Path(rel).stem
    return norm_for_match(stem[:-2] if stem.endswith("四库") else stem)


def claimed_books(text, book_re):
    """本文が名乗る書名。地続きの書名（三国志魏書）は外側だけを採る。

    「三国志魏書武帝紀」を2書に割ると、魏書（北魏の正史）を名乗っていることになる。
    """
    out, prev_end = [], -99
    for m in book_re.finditer(text or ""):
        if m.start() - prev_end <= 1:
            prev_end = m.end()
            continue
        out.append(m.group(0))
        prev_end = m.end()
    return out


def book_files(book, index):
    """書名に対応する実ファイルの相対パス一覧。"""
    # 同じ書が daizhigev20 の単一ファイルと china-history の章分割 HTML の両方にあるとき、
    # 版が違って一方にしか無い記事がある。片方だけを読むと 67 件が誤検出になったので全部読む
    out = []
    for name in BOOK_ALIAS.get(book, (book,)):
        for rel in index.get(name) or []:
            p = CORPUS_ROOT / rel
            if p.is_dir():
                out += [str(f.relative_to(CORPUS_ROOT)) for f in sorted(p.rglob("*")) if f.is_file()]
            else:
                out.append(rel)
    return out


GROUP_EVENT_RE = re.compile(r"^([A-Za-z]+)\[(\d+)\]\.note$")


def source_text(e, path):
    """引用ユニットの path から「書名が書かれている本文」を取り出す。

    note 系はその note 自身、reigns の quote/conversion は duration.source.page。
    """
    m = re.match(r"^reigns\[(\d+)\]\.(.+)$", path)
    if m:
        i, rest = int(m.group(1)), m.group(2)
        reigns = e.get("reigns") or []
        if i >= len(reigns):
            return None
        if rest == "note":
            return reigns[i].get("note")
        return ((reigns[i].get("duration") or {}).get("source") or {}).get("page")
    m = GROUP_EVENT_RE.match(path)
    if m:
        events = (e.get(m.group(1)) or {}).get("events") or []
        k = int(m.group(2))
        return events[k].get("note") if k < len(events) else None
    m = re.match(r"^([A-Za-z]+)\.note$", path)
    return (e.get(m.group(1)) or {}).get("note") if m else None


def scan_claimed_books(data, refs, log=print):
    """名乗る書名のどれにも引用が無いユニットを返す（#32 型の検出）。

    note が複数の書を挙げること自体は正常なので、「名乗ったどれか1つに在る」を合格とする。
    引用の位置に一番近い書名だけを見る案は測って捨てた（「三国志魏書」の分断や、
    複数書から合成した引用で誤検出が3倍になる）。
    コーパスに無い書・断片が1つも無いユニットは判定不能として黙って飛ばす。
    """
    index = build_book_index()
    book_re = re.compile("|".join(sorted((re.escape(b) for b in index), key=len, reverse=True)))
    known = refs["refs"]
    units: dict[str, dict] = {}
    by_book: dict[str, list[str]] = {}
    skipped = Counter()
    by_id = {e["id"]: e for e in data["emperors"]}
    for eid, path, span in extract_units(data):
        ent = known.get(unit_key(eid, path, span))
        rel = (ent or {}).get("corpusFile")
        if not rel:
            skipped["底本が未解決"] += 1
            continue
        text = source_text(by_id[eid], path)
        if not isinstance(text, str):
            continue
        claimed = claimed_books(norm_for_match(text), book_re)
        if not claimed:
            skipped["書名を名乗っていない"] += 1
            continue
        actual = book_of_file(rel)
        if actual and any(actual == c or c in actual or actual in c for c in claimed):
            continue
        frags = [f for f in (ent.get("frags") or []) if len(han_only(f)) >= 5]
        if not frags:
            skipped["断片が取れない"] += 1
            continue
        key = f"{eid}|{path}|{span[:20]}"
        units[key] = {"id": eid, "path": path, "actual": actual or rel, "claimed": claimed,
                      "frags": frags, "span": span[:30], "found": None, "best": 0, "bestbook": None}
        for c in claimed:
            by_book.setdefault(c, []).append(key)

    for book, keys in sorted(by_book.items(), key=lambda kv: -len(kv[1])):
        keys = [k for k in keys if units[k]["found"] is None]
        if not keys or (book not in index and book not in BOOK_ALIAS):
            continue
        # 書はファイル単位で見て「どれかのファイルに在る」を採る。全ファイルを "\n" で
        # 連結してから正規化すると han_only が改行を落とし、ファイル境界をまたぐ並びが
        # 生まれて実在しない一致を作る（連結方式の欠陥）。ファイル単位なら
        # _norm_cache がそのまま効くので、書ごとの再正規化（約100秒）も消える。
        found = {k: set() for k in keys}
        for rel in book_files(book, index):
            text = normalized_file(rel, memo=False)
            if not text:
                continue
            for k in keys:
                frags = units[k]["frags"]
                for i in range(len(frags)):
                    if i not in found[k] and frag_in(frags[i], text):
                        found[k].add(i)
        for k in keys:
            u = units[k]
            n = len(found[k])
            if n == len(u["frags"]):
                u["found"] = book
            elif n > u["best"]:
                u["best"], u["bestbook"] = n, book
    rows = [u for u in units.values() if u["found"] is None]
    log(f"照合対象 {len(units)} 件 / 名乗る書に無い {len(rows)} 件 "
        f"（判定不能 {dict(skipped)}）")
    return sorted(rows, key=lambda u: (u["id"], u["path"]))


def cmd_check_books():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    rows = scan_claimed_books(data, load_refs())
    zero = [u for u in rows if not u["best"]]
    partial = [u for u in rows if u["best"]]
    print(f"\n=== 名乗る書に引用が1断片も無い: {len(zero)} 件 / 人物 {len(set(u['id'] for u in zero))} ===")
    for u in zero:
        print(f"{u['id']} | {u['path']} | 実={u['actual']} | 名乗り={'/'.join(u['claimed'])} | {u['span']}")
    print(f"\n=== 名乗る書に一部だけ在る（複数書から合成した引用の疑い）: {len(partial)} 件 ===")
    for u in partial:
        print(f"{u['id']} | {u['path']} | 実={u['actual']} | 名乗り={'/'.join(u['claimed'])} "
              f"| {u['best']}/{len(u['frags'])}@{u['bestbook']} | {u['span']}")
    return 0


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


def cmd_backfill(rebuild=False, retry_unresolved=False):
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    units = extract_units(data)
    refs = load_refs()
    known = refs["refs"]
    pending = {}
    skipped_unresolved = 0
    for eid, path, span in units:
        key = unit_key(eid, path, span)
        ent = known.get(key)
        # --rebuild は照合器を変えたときに機械判定だけを作り直す。
        # 人が curation した status（manual/external/defect）は残す。
        if ent is None or (rebuild and ent.get("status") not in CURATED):
            pending[key] = (eid, path, span)
        elif ent.get("status") == "unresolved":
            # 未解決の再走査は 5GB のコーパス全文 grep を2周する（本文の 9割以上を
            # 占める）。同じ引用を同じ正規化で同じコーパスに当てれば結果も同じなので、
            # 正規化の版（_NORM_VERSION）が変わったときだけやり直す。引用を直せば
            # ハッシュが変わって別のキーになるため、直した分は必ず再走査される。
            # コーパス側を入れ替えたときは --retry-unresolved で明示的に回す。
            if retry_unresolved or ent.get("nv") != _NORM_VERSION:
                pending[key] = (eid, path, span)
            else:
                skipped_unresolved += 1
    # 調査待ちの印は作り直しでも残す（印が消えると既知の残件が「新規の混入」に化ける）。
    # 引用を直すとハッシュが変わるので id|path でも引けるようにしておく。
    # 注意: id|path での引き継ぎは「同じフィールドの別の引用」にも印を渡してしまう。
    # 新規の未解決を確実にエラーへ落としたいときは --rebuild 後に印を見直すこと。
    triage_by_key = {k: v["triage"] for k, v in known.items() if v.get("triage")}
    triage_by_path = {f'{v["id"]}|{v["path"]}': v["triage"] for v in known.values() if v.get("triage")}
    if rebuild:
        # 作り直す対象の古い判定は先に落とす。残すと、新しい基準で解決できなかった
        # ユニットが古い cache/corpus 判定のまま台帳に居座る（setdefault のため）。
        live = {unit_key(eid, path, span) for eid, path, span in units}
        for key in list(known):
            if key in pending or key not in live:
                known.pop(key)
    # 字体だけを直したときはハッシュが変わらないので台帳がそのまま残る。
    # 記録済みの span/frags が古いままだとゲートが古い字を見続けるため、ここで貼り直す。
    refreshed = 0
    for eid, path, span in units:
        key = unit_key(eid, path, span)
        ent = known.get(key)
        if ent is None or key in pending:
            continue
        # 40字より後ろを直した場合は span[:40] が変わらないので、断片の側でも見る
        cands = [fragments(span), sliding_fragments(span)]
        if ent.get("span") == span[:40] and ent.get("frags") in cands:
            continue
        ent["span"] = span[:40]
        if ent.get("status") in ("cache", "corpus") and ent.get("corpusFile"):
            text = normalized_file(ent["corpusFile"])
            frags = next((c for c in cands if c and all(frag_in(f, text) for f in c)), None)
            if frags:
                ent["frags"] = frags
                ent["line"] = line_of(ent["corpusFile"], frags[0])
            else:
                pending[key] = (eid, path, span)   # 直した結果あたらなくなった＝解決し直す
        refreshed += 1
    if refreshed:
        print(f"span を貼り直した既存エントリ: {refreshed} 件")
    print(f"引用ユニット {len(units)} / 台帳既存 {len(units) - len(pending)} / 解決対象 {len(pending)}"
          f"{f' / 走査済みの未解決を据え置き {skipped_unresolved}' if skipped_unresolved else ''}")
    if not pending:
        save_refs(refs)
        return 0
    resolved, unresolved = resolve_units(pending)
    for key, entry in resolved.items():
        eid, path, span = pending[key]
        known[key] = {"id": eid, "path": path, "span": span[:40], **entry}
    for key, (eid, path, span) in unresolved.items():
        ent = {"id": eid, "path": path, "span": span[:40], "status": "unresolved"}
        why = triage_by_key.get(key) or triage_by_path.get(f"{eid}|{path}")
        if why:
            ent["triage"] = why
        # 「この正規化の版では走査済み」の印。次回はここを見て再走査を省く
        known.setdefault(key, ent)["nv"] = _NORM_VERSION
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
    glyph_fail = []
    glyph_allow = refs.get("glyphAllow", {})
    verdicts = None if coverage_only else load_verdicts()
    keep = set()
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
            allowed = f"{eid}|{path}" in glyph_allow
            stamp = verdict_stamp(key, ent, allowed) if verdicts is not None else None
            if stamp is not None and stamp in verdicts:
                keep.add(stamp)
                counts["再照合を省略"] += 1
                continue
            frags = ent.get("frags") or []
            text = normalized_file(ent.get("corpusFile", ""))
            passed = False
            if not text:
                warnings.append(f"[quote-refs] {eid} {path}: corpusFile が読めない: {ent.get('corpusFile')}")
            elif frags and not all(frag_in(f, text) for f in frags):
                recheck_fail.append(f"{eid} {path} ({ent.get('corpusFile')})")
            elif frags and not allowed:
                # 字体混入ゲート: 照合が通るのが「新字体表のおかげ」なら、引用に
                # 底本と違う字形（応・広・徳…）が混ざっている。表の網羅性に依存せず、
                # 底本そのものを基準に判定する（2026-08-02 に368件を訂正した際の恒久化）。
                strict = strict_file(ent.get("corpusFile", ""))
                bad = [f for f in frags if not frag_in_strict(f, strict)]
                if bad:
                    glyph_fail.append(f"{eid} {path}: {bad[0]}")
                else:
                    passed = True
            else:
                passed = True
            if passed:
                counts["再照合した"] += 1
                if stamp is not None:
                    keep.add(stamp)
    stale = [k for k in known if k not in seen_keys]
    if stale:
        warnings.append(f"[quote-refs] 台帳の陳腐化エントリ（引用の変更・削除済み・掃除可）: {len(stale)} 件")
    if recheck_fail:
        errors.append(f"[quote-refs] 台帳の再照合失敗（コーパス変更または台帳破損）: {recheck_fail[:10]}")
    if glyph_fail:
        errors.append(f"[quote-refs] 底本と字体が違う引用（日本語新字体の混入）: {len(glyph_fail)} 件。"
                      f"底本の字へ直すこと。底本側が壊れている場合のみ quote-refs.json の "
                      f"glyphAllow に \"id|path\": \"理由\" を足す: {glyph_fail[:10]}")
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
    if verdicts is not None:
        # 今回合格したぶんだけを残す（消えた引用・落ちた引用のスタンプは落ちる）。
        # 他の引用が落ちた回でも保存する: 訂正ループは「1件直す→まだ別が落ちる」を
        # 繰り返すので、合格が確定した引用まで毎回読み直すと目的の場面で効かなくなる
        save_verdicts(keep)
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
    ap.add_argument("--check-books", action="store_true",
                    help="note が名乗る書名と引用の実在する書を突合して一覧を出す（Issue #40 G1・要コーパス）")
    ap.add_argument("--rebuild", action="store_true",
                    help="--backfill と併用。照合器を変えたとき機械判定を作り直す"
                         "（manual/external/defect の curation は残す）")
    ap.add_argument("--retry-unresolved", action="store_true",
                    help="--backfill と併用。走査済みの未解決ユニットもコーパスへ当て直す"
                         "（コーパスを入れ替えた・書を足したとき）")
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
    if args.check_books:
        return cmd_check_books()
    if args.backfill:
        return cmd_backfill(rebuild=args.rebuild, retry_unresolved=args.retry_unresolved)
    return cmd_check()


if __name__ == "__main__":
    sys.exit(main())
