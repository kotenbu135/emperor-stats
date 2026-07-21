"""data/emperors.json の恒久 QA チェック（task.md 3-3・GitHub Actions CI 用）。

使い方: python3 scripts/validate_emperors.py
終了コード: 0=合格（警告のみ含む） / 1=エラーあり

チェック内容（エラー＝CI 失敗）:
  - JSON Schema 適合（data/schema/emperors.schema.json＝配布用の寛容版）
  - 構造ドリフト検出（同スキーマに additionalProperties:false を機械付与した厳格版。
    キーの改名・typo・スキーマ未記載フィールドの追加を検出する。
    新フィールドを正式追加する際は配布スキーマと EMPERORS_SCHEMA.md を先に更新する）
  - id（slug）の形式・一意性、meta.count と配列長の一致
  - sources.wikidata の QID 形式・非 null・一意性
  - 在位日付: ISO 形式・値域、start≦end（精度を揃えた比較）、複数在位の時系列順、
    datePrecision（year/month/day）と日付形式の整合（形式は精度以上の深さを持つ）、
    startYear/endYear（歴史年）と ISO 日付（天文年）の対応
  - duration: exactDays は両端 day 精度のときのみ・needsPreciseDays との排他
  - 回数系 8 指標: count == len(events)
  - ages: birthDate≦deathDate、deathDate が最終 reign endDate より前ならエラー
    （退位後死去の deathDate > endDate は正当なので警告どまり。task.md 3-3 の2段階方式）
  - reignSummary の reignCount / firstStartYear / lastEndYear と reigns の整合
  - confidence 値（high/medium/low/null 以外・空文字はエラー）
  - 出典禁止語: deathCause/accessionRoute/events の source が Wikipedia/百度等のままならエラー
    （判定は scripts/detect_wikipedia_sources.py の is_wiki_like を共用）
  - 肖像画 manifest: id 実在・ファイル 1:1 対応・各キー重複・画像 MD5 重複

警告（CI は通す・出力で可視化）:
  - reigns[].duration.source の Wikipedia 出典残数（task.md 3-1 フェーズB進行中の進捗計）
  - deathDate > endDate（退位・被廃後死去など。正当ケース多数のため件数と id のみ）
  - ages/events の datePrecision 非標準トークン（表記ゆれ。正規化方針は 3-3 で未確定）
  - ages の非 ISO 日付（元号・歴史年表記のまま。フェーズBの ages 同期で順次解消想定）
  - KNOWN_ISSUES の陳腐化（訂正済みなのに残っているエントリ＝削除してよい）

既知の未解決データ問題は KNOWN_ISSUES 参照。ここに載せる＝容認ではなく
「フェーズB等での個別調査待ち」の明示。新規追加時は必ず根拠コメントを付ける。
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import Counter
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "emperors.json"
SCHEMA_PATH = ROOT / "data" / "schema" / "emperors.schema.json"
PORTRAITS_DIR = ROOT / "data" / "images" / "portraits"

sys.path.insert(0, str(ROOT / "scripts"))
from detect_wikipedia_sources import is_wiki_like  # noqa: E402

# ---------------------------------------------------------------------------
# 既知の未解決データ問題（個別調査待ち）。訂正されたら該当エントリを削除する。
# 陳腐化（データ側が直っているのに残っている）は警告で知らせる。
# ---------------------------------------------------------------------------

# reigns[i] の startDate > endDate。
# beiwei-yuanfasheng: 0525-02-08 > 0525-02-01。フェーズB北朝ブロックで原典突合予定
KNOWN_REIGN_ORDER = {("beiwei-yuanfasheng", 0)}

# ages.deathDate が最終 reign の endDate より前（精度を揃えた比較）。
# 旧暦月表記と西暦換算日の混在が主因とみられ、フェーズBの ages 同期で個別解消予定
KNOWN_DEATH_BEFORE_END = {
    "chen-wendi",             # 0566-04-01 < 0566-05-31
    "beiwei-tuobayu",         # 0452-10-01 < 0452-10-29
    "shiguo-qianshu-wangjian",  # 0918-06 < 0918-07-11
    "shiguo-nanhan-liusheng",   # 0958-08-01 < 0958-09-18
    "liao-jingzong",          # 0982-09-24 < 0982-10-13
    "liao-daozong",           # 1101-01-13 < 1101-02-12
    "xixia-huizong",          # 1086-07 < 1086-08-21
    "xixia-chongzong",        # 1139-06-04 < 1139-07-01
    "shun-lichengzheng",      # 1645-09 < 1645-10-01
}

# confidence が空文字のまま（2-1 スキーマ検証で判明・値の確定は調査判断待ち）
KNOWN_EMPTY_CONFIDENCE = {
    ("yuan-shizu", "personalCampaignCount"),
    ("yuanmo-xushouhui", "personalCampaignCount"),
    ("yuanmo-xushouhui", "rebellionSuppressionCount"),
    ("yuanmo-xushouhui", "rebellionSufferedCount"),
}

# reignSummary と reigns の不一致（現状該当なし。
# qianzhao-liuyuanのfirstStartYear不一致はブロック3〈2026-07-21〉のreignSummary再計算で解消済み）。
KNOWN_REIGN_SUMMARY = set()

# ---------------------------------------------------------------------------

ISO_DATE = re.compile(r"^(-?\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$")
PRECISION_DEPTH = {"year": 1, "month": 2, "day": 3}
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
# 標準の datePrecision 基本トークン（reigns は year/month/day の3値に統一済み。
# ages/events は自由記述が混在するため先頭トークンのみ照合し、非標準は警告）
STANDARD_PRECISION_TOKENS = {"year", "month", "day", "unknown", "none"}

errors: list[str] = []
warnings: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def warn(msg: str) -> None:
    warnings.append(msg)


def parse_date(v):
    """ISO 風日付（負年含む）を (year, month, day) タプルに。month/day 欠落は None。"""
    if not isinstance(v, str):
        return None
    m = ISO_DATE.match(v)
    if not m:
        return None
    y = int(m.group(1))
    mo = int(m.group(2)) if m.group(2) else None
    da = int(m.group(3)) if m.group(3) else None
    if mo is not None and not 1 <= mo <= 12:
        return None
    if da is not None and not 1 <= da <= 31:
        return None
    return (y, mo, da)


def date_depth(t) -> int:
    return sum(1 for x in t if x is not None)


def cmp_truncated(a, b):
    """共通精度に切り詰めて比較。-1/0/1 を返す。"""
    n = min(date_depth(a), date_depth(b))
    xa = [x for x in a if x is not None][:n]
    xb = [x for x in b if x is not None][:n]
    return (xa > xb) - (xa < xb)


def check_schema(data, schema):
    try:
        import jsonschema
    except ImportError:
        err("jsonschema ライブラリがありません（pip install jsonschema）")
        return
    validator = jsonschema.Draft202012Validator(schema)
    for e in list(validator.iter_errors(data))[:20]:
        err(f"[schema] {e.json_path}: {e.message[:200]}")

    # 厳格版: 全オブジェクト定義に additionalProperties:false を機械付与して
    # キーの改名・typo・未記載フィールド（構造ドリフト）を検出する
    strict = deepcopy(schema)

    def harden(node):
        if isinstance(node, dict):
            if "properties" in node and "additionalProperties" not in node:
                node["additionalProperties"] = False
            for v in node.values():
                harden(v)
        elif isinstance(node, list):
            for x in node:
                harden(x)

    harden(strict)
    validator = jsonschema.Draft202012Validator(strict)
    for e in list(validator.iter_errors(data))[:20]:
        err(f"[schema-strict] {e.json_path}: {e.message[:200]}")


def check_ids(data):
    ids = [e.get("id") for e in data["emperors"]]
    dup = [i for i, c in Counter(ids).items() if c > 1]
    if dup:
        err(f"[id] slug 重複: {dup}")
    for i in ids:
        if not (isinstance(i, str) and re.fullmatch(r"[a-z0-9-]+", i)):
            err(f"[id] slug 形式不正: {i!r}")
    n = data.get("meta", {}).get("count")
    if n != len(ids):
        err(f"[meta] meta.count={n} だが emperors 配列は {len(ids)} 件")


def check_wikidata(data):
    seen = {}
    for e in data["emperors"]:
        qid = (e.get("sources") or {}).get("wikidata")
        if not (isinstance(qid, str) and re.fullmatch(r"Q[1-9]\d*", qid)):
            err(f"[wikidata] {e['id']}: QID 形式不正または未設定: {qid!r}")
            continue
        if qid in seen:
            err(f"[wikidata] QID 重複 {qid}: {seen[qid]} / {e['id']}")
        seen[qid] = e["id"]


def check_reigns(data):
    for e in data["emperors"]:
        eid = e["id"]
        reigns = e.get("reigns", [])
        prev_end = None
        for i, r in enumerate(reigns):
            dp = r.get("datePrecision") or {}
            for key, val in dp.items():
                if key not in ("start", "end") or val not in PRECISION_DEPTH:
                    err(f"[reigns] {eid}[{i}]: datePrecision 不正 {key}={val!r}")
            parsed = {}
            for pkey, dkey in (("start", "startDate"), ("end", "endDate")):
                v = r.get(dkey)
                if v is None:
                    continue
                t = parse_date(v)
                if t is None:
                    err(f"[reigns] {eid}[{i}]: {dkey} が ISO 形式でない: {v!r}")
                    continue
                parsed[pkey] = t
                need = PRECISION_DEPTH.get(dp.get(pkey))
                if need and date_depth(t) < need:
                    err(
                        f"[reigns] {eid}[{i}]: {dkey}={v} は datePrecision.{pkey}="
                        f"{dp.get(pkey)} より浅い形式"
                    )
                # 歴史年（startYear/endYear）と天文年（ISO 日付）の対応:
                # 紀元後は一致、紀元前は +1、旧暦年の年末が翌 1〜2 月に食い込む場合のみ +2
                ykey = "startYear" if pkey == "start" else "endYear"
                y = r.get(ykey)
                if isinstance(y, int):
                    off = t[0] - y
                    ok = off == 0 if y > 0 else (
                        off == 1 or (off == 2 and (t[1] or 0) <= 2)
                    )
                    if not ok:
                        err(f"[reigns] {eid}[{i}]: {ykey}={y} と {dkey}={v} の年対応が不正")
            if "start" in parsed and "end" in parsed:
                if cmp_truncated(parsed["start"], parsed["end"]) > 0:
                    if (eid, i) in KNOWN_REIGN_ORDER:
                        KNOWN_REIGN_ORDER.discard((eid, i))
                    else:
                        err(
                            f"[reigns] {eid}[{i}]: startDate {r['startDate']} > "
                            f"endDate {r['endDate']}"
                        )
            if prev_end and "start" in parsed:
                if cmp_truncated(parsed["start"], prev_end) < 0:
                    err(f"[reigns] {eid}[{i}]: 前の在位の endDate より前に開始している")
            prev_end = parsed.get("end") or prev_end

            du = r.get("duration") or {}
            both_day = dp.get("start") == "day" and dp.get("end") == "day"
            if du.get("exactDays") is not None and not both_day:
                err(f"[reigns] {eid}[{i}]: exactDays があるのに両端 day 精度でない")
            if (du.get("exactDays") is None) != bool(du.get("needsPreciseDays")):
                err(f"[reigns] {eid}[{i}]: exactDays と needsPreciseDays が矛盾")
            if du.get("approxDays") is None:
                err(f"[reigns] {eid}[{i}]: approxDays がない")


def check_counts(data):
    for e in data["emperors"]:
        for g in COUNT_GROUPS:
            o = e.get(g)
            if not isinstance(o, dict):
                continue
            events = o.get("events")
            count = o.get("count")
            if isinstance(events, list) and isinstance(count, int) and count != len(events):
                err(f"[counts] {e['id']}.{g}: count={count} だが events は {len(events)} 件")


def check_ages(data):
    death_after_end = []
    non_iso = 0
    for e in data["emperors"]:
        eid = e["id"]
        a = e.get("ages") or {}
        bd, dd = parse_date(a.get("birthDate")), parse_date(a.get("deathDate"))
        for k in ("birthDate", "deathDate"):
            if a.get(k) is not None and parse_date(a.get(k)) is None:
                non_iso += 1
        if bd and dd and cmp_truncated(bd, dd) > 0:
            err(f"[ages] {eid}: birthDate {a['birthDate']} > deathDate {a['deathDate']}")
        reigns = e.get("reigns", [])
        ed = parse_date(reigns[-1].get("endDate")) if reigns else None
        if dd and ed:
            c = cmp_truncated(dd, ed)
            if c < 0:
                if eid in KNOWN_DEATH_BEFORE_END:
                    KNOWN_DEATH_BEFORE_END.discard(eid)
                else:
                    err(
                        f"[ages] {eid}: deathDate {a['deathDate']} が最終在位の "
                        f"endDate {reigns[-1]['endDate']} より前"
                    )
            elif c > 0:
                death_after_end.append(eid)
    if death_after_end:
        warn(
            f"[ages] deathDate > 最終 endDate（退位後死去等・正当の可能性）: "
            f"{len(death_after_end)} 件"
        )
    if non_iso:
        warn(f"[ages] 非 ISO 日付（元号・歴史年表記のまま）: {non_iso} 件（フェーズBで順次解消）")


def check_reign_summary(data):
    for e in data["emperors"]:
        eid = e["id"]
        rs = e.get("reignSummary") or {}
        reigns = e.get("reigns", [])
        checks = [("reignCount", rs.get("reignCount"), len(reigns))]
        if reigns:
            checks.append(("firstStartYear", rs.get("firstStartYear"), reigns[0].get("startYear")))
            checks.append(("lastEndYear", rs.get("lastEndYear"), reigns[-1].get("endYear")))
        for field, got, want in checks:
            if got != want:
                if (eid, field) in KNOWN_REIGN_SUMMARY:
                    KNOWN_REIGN_SUMMARY.discard((eid, field))
                else:
                    err(f"[reignSummary] {eid}: {field}={got} だが reigns からは {want}")


def check_confidence(data):
    nonstandard_precision = Counter()

    def walk(node, eid, path):
        if isinstance(node, dict):
            for k, v in node.items():
                if k == "confidence":
                    if v == "":
                        top = path.split(".")[0] if path else ""
                        if (eid, top) in KNOWN_EMPTY_CONFIDENCE:
                            KNOWN_EMPTY_CONFIDENCE.discard((eid, top))
                        else:
                            err(f"[confidence] {eid}.{path}: 空文字")
                    elif v is not None and v not in ("high", "medium", "low"):
                        err(f"[confidence] {eid}.{path}: 不正値 {v!r}")
                if k.endswith("Precision") or k == "datePrecision":
                    for val in (v.values() if isinstance(v, dict) else [v]):
                        if isinstance(val, str):
                            token = re.split(r"[^a-z-]", val, 1)[0]
                            if token not in STANDARD_PRECISION_TOKENS:
                                nonstandard_precision[val[:30]] += 1
                walk_children(v, eid, path, k)
        elif isinstance(node, list):
            for i, x in enumerate(node):
                walk(x, eid, f"{path}[{i}]")

    def walk_children(v, eid, path, k):
        if isinstance(v, (dict, list)):
            walk(v, eid, f"{path}.{k}" if path else k)

    for e in data["emperors"]:
        walk(e, e["id"], "")
    if nonstandard_precision:
        warn(
            f"[precision] ages/events の datePrecision 非標準トークン: "
            f"計 {sum(nonstandard_precision.values())} 件 "
            f"{len(nonstandard_precision)} 種（表記ゆれ・task.md 3-3 で正規化方針未確定）"
        )


def check_forbidden_sources(data):
    reign_wiki = 0
    for e in data["emperors"]:
        eid = e["id"]
        for f in ("deathCause", "accessionRoute"):
            s = (e.get(f) or {}).get("source")
            if s and is_wiki_like(s):
                err(f"[source] {eid}.{f}: Wikipedia/百度等の出典が残存: {s.get('page')!r}")
        for g in COUNT_GROUPS:
            o = e.get(g)
            if not isinstance(o, dict):
                continue
            for i, ev in enumerate(o.get("events") or []):
                s = ev.get("source")
                if s and is_wiki_like(s):
                    err(f"[source] {eid}.{g}.events[{i}]: Wikipedia/百度等の出典が残存: {s.get('page')!r}")
        for r in e.get("reigns", []):
            s = (r.get("duration") or {}).get("source")
            if s and is_wiki_like(s):
                reign_wiki += 1
    if reign_wiki:
        # task.md 3-1 フェーズB進行中。完了（0 件到達）後はエラーに格上げする
        warn(f"[source] reigns[].duration.source の Wikipedia 出典残: {reign_wiki} 件（フェーズB進行中）")


def check_portraits(data):
    manifest_path = PORTRAITS_DIR / "manifest.json"
    if not manifest_path.exists():
        warn("[portraits] manifest.json が見つからないためスキップ")
        return
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    ids = {e["id"] for e in data["emperors"]}
    for key in ("id", "localFile", "sourceFilename", "commonsPageUrl"):
        dup = [v for v, c in Counter(x.get(key) for x in manifest).items() if c > 1]
        if dup:
            err(f"[portraits] manifest の {key} 重複: {dup}")
    for x in manifest:
        if x.get("id") not in ids:
            err(f"[portraits] manifest の id が emperors.json に存在しない: {x.get('id')}")
    files = {p.name for p in PORTRAITS_DIR.iterdir() if p.name != "manifest.json"}
    listed = {x.get("localFile") for x in manifest}
    if files - listed:
        err(f"[portraits] manifest に載っていないファイル: {sorted(files - listed)}")
    if listed - files:
        err(f"[portraits] manifest にあるがファイルが無い: {sorted(listed - files)}")
    md5 = Counter()
    for name in files & listed:
        md5[hashlib.md5((PORTRAITS_DIR / name).read_bytes()).hexdigest()] += 1
    dup_md5 = [h for h, c in md5.items() if c > 1]
    if dup_md5:
        err(f"[portraits] 画像 MD5 重複（同一画像の使い回し疑い）: {dup_md5}")


def main() -> int:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))

    check_schema(data, schema)
    check_ids(data)
    check_wikidata(data)
    check_reigns(data)
    check_counts(data)
    check_ages(data)
    check_reign_summary(data)
    check_confidence(data)
    check_forbidden_sources(data)
    check_portraits(data)

    # 訂正済みなのに KNOWN_ISSUES に残っているエントリ（削除してよい）
    for name, left in (
        ("KNOWN_REIGN_ORDER", KNOWN_REIGN_ORDER),
        ("KNOWN_DEATH_BEFORE_END", KNOWN_DEATH_BEFORE_END),
        ("KNOWN_EMPTY_CONFIDENCE", KNOWN_EMPTY_CONFIDENCE),
        ("KNOWN_REIGN_SUMMARY", KNOWN_REIGN_SUMMARY),
    ):
        # 消費されなかった（=データ側が既に正しい）エントリが残っていれば陳腐化
        if left:
            warn(f"[allowlist] {name} の陳腐化エントリ（訂正済み・削除可）: {sorted(left)}")

    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"ERROR {e}")
    print(f"---\n{len(errors)} errors, {len(warnings)} warnings "
          f"({data['meta'].get('count')} emperors)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
