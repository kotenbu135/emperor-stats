"""data/emperors.json の恒久 QA チェック（task.md 3-3・GitHub Actions CI 用）。

使い方: python3 scripts/validate_emperors.py
終了コード: 0=合格（警告のみ含む） / 1=エラーあり

チェック内容（エラー＝CI 失敗）:
  - JSON Schema 適合（data/schema/emperors.schema.json＝配布用の寛容版）
  - 構造ドリフト検出（同スキーマに additionalProperties:false を機械付与した厳格版。
    キーの改名・typo・スキーマ未記載フィールドの追加を検出する。
    新フィールドを正式追加する際は配布スキーマと EMPERORS_SCHEMA.md を先に更新する）
  - id（slug）の形式・一意性、meta.count と配列長の一致
  - name.commonName が非空文字列（表示名の必須フィールド。かつて null 2件が
    サイト側フォールバックで凌がれていた経緯があり、再発をスキーマと二重に検出する）
  - sources.wikidata の QID 形式・非 null・一意性
  - 在位日付: ISO 形式・値域、start≦end（精度を揃えた比較）、複数在位の時系列順、
    datePrecision（year/month/day）と日付形式の整合（形式は精度以上の深さを持つ）、
    startYear/endYear（歴史年）と ISO 日付（天文年）の対応
  - duration: exactDays は両端 day 精度のときのみ・needsPreciseDays との排他
  - 回数系 8 指標: count == len(events)
  - BCE イベント日付の年規約（reigns と同じ天文年〈前n年→-(n-1)〉。在位 ISO 年範囲チェック＋
    note「前n年」明記との突合。2026-07-22 の前漢105件統一〔task.md 0-2〕の再発防止）
  - flags.usedEmperorTitleFrom: reigns[0].startYear と一致、または旧暦年またぎの -1 のみ許容
    （歴史紀年ベースの規約は EMPERORS_SCHEMA.md 参照。task.md 0-2）
  - ages: birthDate≦deathDate、deathDate が最終 reign endDate より前ならエラー
    （退位後死去の deathDate > endDate は正当なので警告どまり。task.md 3-3 の2段階方式）
  - reignSummary の reignCount / firstStartYear / lastEndYear と reigns の整合
  - reignSummary.totalReignDuration: approxDays が reigns の合計と一致・
    isExact / needsPreciseDays が reigns の exactDays 確定状況と一致・
    displayYears が approxDays の年換算（÷365 または ÷365.25、小数 0〜2 桁丸め）と一致
    （フェーズB の日付訂正時に summary 側の同期が漏れた9件が CI をすり抜けた事故〔task.md 0-1・
    2026-07-22 訂正済み〕の再発防止）
  - confidence 値（high/medium/low/null 以外・空文字はエラー）
  - 出典禁止語: emperor レコードを再帰走査し、キー名 `source` の出典すべてが対象
    （deathCause/accessionRoute/events/reigns[].duration ほか将来の新設フィールドも自動的に
    掛かる。判定は scripts/detect_wikipedia_sources.py の is_wiki_like を共用。
    reigns[].duration はフェーズB完了〔2026-07-21・残数0件〕を受けて警告からエラーに格上げ済み）
  - 肖像画 manifest: id 実在・ファイル 1:1 対応・各キー重複・画像 MD5 重複

警告（CI は通す・出力で可視化）:
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
# beiwei-yuanfasheng の逆転はブロック6〈2026-07-21〉の北朝ブロックで解消済み（現状該当なし）。
KNOWN_REIGN_ORDER = set()

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

# displayYears が標準の年換算（÷365 / ÷365.25・0〜2桁丸め）に合わない既知例。
# 2026-07-22 の 0-3 対応（qin-shi-huang / qin-er-shi の算出基準統一）で全件解消済み
KNOWN_DISPLAY_YEARS = set()

# CE イベント日付が在位 ISO 年範囲外（min-1〜max+1）だが正当なもの＝称帝前（王号・天王・僭号期）に
# 本人が君主として行った行為で、ADDITIONAL_SCHEMA.md「回数系指標の計上期間（本人の実権掌握期）」
# の方針により意図的に計上しているもの（各 note に【皇帝即位前】等を明示）。全件が本人自身の行為で
# あることを 2026-07-22 に確認済み（他者＝父・慕容皝の行為だった qianyan-murongjun の 0341 龍城遷都は
# 同日に計上から削除）。ここに載る＝在位範囲チェックの既知の正当例。
# （BCE イベントの範囲チェックは check_bce_event_years が別途担当）
KNOWN_PREACCESSION_EVENTS = {
    ("wu-dadi", "capitalRelocationCount", 0),             # 0221 呉王冊命前の遷都
    ("qianzhao-liuyuan", "eraChangeCount", 0),            # 0304 漢王期の建元
    ("qianzhao-liuyuan", "capitalRelocationCount", 0),    # 0305 漢王期の遷都
    ("qianyan-murongjun", "capitalRelocationCount", 0),   # 0350 燕王期(即位前)の遷都。父・慕容皝の0341は2026-07-22に他者事績として削除済み
    ("houzhao-shile", "eraChangeCount", 0),               # 0319 趙王期の建元（趙王元年）
    ("houzhao-shile", "eraChangeCount", 1),               # 0328 趙王期の太和改元
    ("houzhao-shile", "amnestyCount", 0),                 # 0328 趙王期の大赦
    ("xia-helianbobo", "eraChangeCount", 0),              # 0407 天王・大単于期の龍昇建元
    ("xia-helianbobo", "amnestyCount", 0),                # 0407 天王期の赦其境内
    ("nanyan-murongde", "eraChangeCount", 0),             # 0398 燕王自立の称元
    ("nanyan-murongde", "amnestyCount", 0),               # 0398 燕王期の大赦境内
    ("houqin-yaochang", "eraChangeCount", 0),             # 0384 万年秦王期の白雀建元
    ("houqin-yaochang", "amnestyCount", 0),               # 0384 万年秦王期の大赦境内
    ("houzhao-shihu", "eraChangeCount", 0),               # 0335 趙天王期
    ("houzhao-shihu", "amnestyCount", 0),                 # 0335 趙天王期
    ("houzhao-shihu", "amnestyCount", 1),                 # 0337 大趙天王期
    ("houzhao-shihu", "empressInstallationCount", 0),     # 0337 天王皇后
    ("houzhao-shihu", "empressInstallationCount", 1),     # 0337 天王皇后
    ("houzhao-shihu", "crownPrinceDepositionCount", 0),   # 0337 天王期
    ("houzhao-shihu", "capitalRelocationCount", 0),       # 0335 趙天王期
    ("tangmo-huangchao", "eraChangeCount", 0),            # 0878 王霸建元(称帝前)
    ("shiguo-wu-yangpu", "eraChangeCount", 0),            # 0921 呉王期の改元
    ("shiguo-wu-yangpu", "amnestyCount", 0),              # 0921 呉王期の大赦
    ("shiguo-min-wangyanxi", "eraChangeCount", 0),        # 0939 閩国王期(称帝は941)
    ("liao-taizu", "empressInstallationCount", 0),        # 0907 可汗即位期(公式在位は916-)
    ("xixia-jingzong", "eraChangeCount", 0),              # 1033 西平王期
    ("xixia-jingzong", "eraChangeCount", 1),              # 1034 西平王期
    ("xixia-jingzong", "eraChangeCount", 2),              # 1035 西平王期
    ("xixia-jingzong", "amnestyCount", 0),                # 1034 西平王期
}

# 同一王朝内で在位期間が重複するが正当なもの（並立・対立政権の非対称処理・母后称制の空位挟み・
# 同名別政権・year/month 精度プレースホルダ由来の見かけの重複）で、重複する2在位の note/
# duration.source（note・conversion）に並立系キーワードが現れない既知例。すべて 2026-07-22 の
# 全31重複トリアージで正当（A/C 判定）と確認済み。内禅・禅譲の同期漏れ（前帝 endDate ≠ 次帝
# startDate）を検出するのが check_reign_overlap の主目的で、光宗/寧宗の2日不一致（2026-07-22
# 訂正済み）がこの型だった。ペアは (前在位, 次在位) の "id[reignIndex]" 表記。
KNOWN_REIGN_OVERLAP = {
    ("suimo-liangshidu[0]", "suimo-xiaoxian[0]"),      # 同名別政権(梁師都/蕭銑・隋末群雄「梁」)
    ("beiwei-xuanwudi[0]", "beiwei-yuanyu[0]"),        # 元愉の冀州反乱称帝(建平)
    ("beizhou-xuandi[0]", "beizhou-jingdi[0]"),        # 宣帝が内禅後も天元皇帝を自称し在位計上
    ("shiguo-min-wangyanxi[0]", "shiguo-min-wangyanzheng[0]"),  # 王延政の建州称帝「殷」並立
    ("yuan-tianshundi[0]", "yuan-wenzong[0]"),         # 両都の戦い(天暦の内乱)の並立
    ("yuan-wenzong[0]", "yuan-mingzong[0]"),           # 明宗漠北即位→文宗譲位までの移行期並存
    ("yuanmo-chenyouliang[0]", "yuanmo-chenli[0]"),    # 陳理は父戦死後継承・year精度プレースホルダの見かけ重複
    ("nanming-anzong[0]", "nanming-zongzong[0]"),      # 弘光帝が処刑まで帝号保持 vs 隆武帝並存
    ("nanming-shaowudi[0]", "nanming-zhaozong[0]"),    # 紹武/永暦の並立
    ("wuzhou-wushifan[0]", "wuzhou-wusangui[0]"),      # 呉世璠は呉三桂崩御後継承・year精度プレースホルダの見かけ重複
}

# 数え年チェック（CE 生年限定）で「原典由来の矛盾を note に明示済み」等の既知の乖離。
KNOWN_COUNTING_AGE = {
    ("chen-feidi", "deathAge"),   # 生554 vs 時年19 の原典3書共通矛盾を note に明示済み(2026-07-22)
}

# ages.note が「〜は null とした」と明記しているのにフィールドに値が入っている既知の矛盾
# （後続パスで値を埋めた際の note 同期漏れ。2026-07-22 検出の9件は同日、値を規定10節の
#  逆算値として立証したうえで note 側を訂正済み・現在は空。新規検出をここに登録する）
KNOWN_NULL_SAID = set()

# 在位重複判定に使う並立・対立政権系キーワード（レコード JSON 全体を対象に部分一致）。
# これらのいずれも含まない同王朝内重複は継承同期バグの疑いとしてエラーにする。
COEXIST_KEYWORDS = (
    "並立", "対立", "對立", "僭", "擁立", "拥立", "自立", "対抗", "対峙", "對峙",
    "奪門", "復位", "两都", "兩都", "非対称", "傀儡", "别立", "別立", "分裂",
    "反乱政権", "対立政権", "簒奪", "篡", "割拠", "割據", "自号", "自號",
)

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


def check_names(data):
    for e in data["emperors"]:
        cn = (e.get("name") or {}).get("commonName")
        if not (isinstance(cn, str) and cn.strip()):
            err(f"[name] {e['id']}: commonName が非空文字列でない: {cn!r}")


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


BCE_NOTE_YEAR = re.compile(r"前(\d{1,4})年")


def check_bce_event_years(data):
    """BCE イベント日付の年規約チェック（task.md 0-2、2026-07-22 統一）。

    events[].date は reigns と同じ ISO 8601 天文年（前n年 → -(n-1)）で表記する。
    - 在位範囲: BCE イベントの年は在位期間の ISO 年範囲内に収まるはず
      （即位年の大赦・崩御年の遺詔大赦も同一 ISO 年に落ちることを全件で確認済み）
    - 歴史年直記の検出: note に「前n年」の明記があるのに date の年がどの n とも
      -(n-1) で一致せず、いずれかの n と -n で一致する場合は旧規約（歴史年直記）の疑い
    """
    for e in data["emperors"]:
        reign_years = []
        for r in e.get("reigns") or []:
            for k in ("startDate", "endDate"):
                t = parse_date(r.get(k))
                if t:
                    reign_years.append(t[0])
        for g in COUNT_GROUPS:
            o = e.get(g)
            if not isinstance(o, dict):
                continue
            for i, ev in enumerate(o.get("events") or []):
                t = parse_date(ev.get("date"))
                if not t or t[0] > 0:
                    continue
                y = t[0]
                if reign_years and not (min(reign_years) <= y <= max(reign_years)):
                    err(f"[bce-events] {e['id']}.{g}[{i}]: date={ev['date']} が在位 ISO 年範囲 "
                        f"[{min(reign_years)}, {max(reign_years)}] 外（年規約違反の疑い）")
                note_years = [int(n) for n in BCE_NOTE_YEAR.findall(ev.get("note") or "")]
                if note_years and not any(y == -(n - 1) for n in note_years):
                    if any(y == -n for n in note_years):
                        err(f"[bce-events] {e['id']}.{g}[{i}]: date={ev['date']} が note の"
                            f"「前n年」{note_years} と歴史年直記（-n）で一致（天文年 -(n-1) に統一する）")


def check_event_reign_range(data):
    """CE イベント日付が在位 ISO 年範囲（min-1〜max+1）に収まるか。

    reigns の startDate/endDate（ISO）と startYear/endYear（歴史年→ISO換算）の双方から
    在位 ISO 年範囲を取り、CE イベントがその外に出ていればエラー。称帝前イベントの既知例は
    KNOWN_PREACCESSION_EVENTS で許容（task.md 問題5 の方針判断待ち）。旧暦月番号の無変換など
    events[].date の誤変換（在位範囲外に飛ぶ型）を将来検出する。BCE は check_bce_event_years 担当。
    """
    for e in data["emperors"]:
        years = []
        for r in e.get("reigns") or []:
            for k in ("startDate", "endDate"):
                t = parse_date(r.get(k))
                if t:
                    years.append(t[0])
            for yk in ("startYear", "endYear"):
                y = r.get(yk)
                if isinstance(y, int):
                    years.append(y if y > 0 else y + 1)
        if not years:
            continue
        lo, hi = min(years) - 1, max(years) + 1
        for g in COUNT_GROUPS:
            o = e.get(g)
            if not isinstance(o, dict):
                continue
            for i, ev in enumerate(o.get("events") or []):
                t = parse_date(ev.get("date"))
                if not t or t[0] <= 0:
                    continue
                if not (lo <= t[0] <= hi):
                    key = (e["id"], g, i)
                    if key in KNOWN_PREACCESSION_EVENTS:
                        KNOWN_PREACCESSION_EVENTS.discard(key)
                    else:
                        err(f"[event-range] {e['id']}.{g}[{i}]: date={ev['date']} が在位 ISO 年範囲 "
                            f"[{lo+1}, {hi-1}] 外（誤変換または称帝前イベントの疑い）")


def check_reign_overlap(data):
    """同一王朝内で在位期間が重複していないか（並立・対立政権は正当なので除外）。

    dynasty.name 単位で reigns を開始日順に並べ、次の reign の startDate が前の reign の endDate
    より前なら重複。並立・対立政権（COEXIST_KEYWORDS のいずれかをレコード JSON に含む）は正当として
    除外し、キーワードを一切含まない重複のみエラーにする（内禅・禅譲で前帝 endDate と次帝 startDate が
    食い違う同期漏れ＝光宗/寧宗型を検出）。KNOWN_REIGN_OVERLAP で個別許容可。
    """
    from collections import defaultdict
    def reign_kw(r):
        # 並立キーワードは重複する在位オブジェクト自身の解釈欄に限定して探す
        # （レコード全体を対象にすると、長期在位の反乱鎮圧 note 等に出る「僭」「擁立」で
        #   継承同期漏れが誤って免除されてしまう＝光宗/寧宗の呉曦「僭號」で実証済み）。
        s = (r.get("duration") or {}).get("source") or {}
        text = (r.get("note") or "") + (s.get("note") or "") + (s.get("conversion") or "")
        return any(k in text for k in COEXIST_KEYWORDS)

    dyn = defaultdict(list)
    for e in data["emperors"]:
        for i, r in enumerate(e.get("reigns") or []):
            st = parse_date(r.get("startDate"))
            en = parse_date(r.get("endDate"))
            if st:
                name = (e.get("dynasty") or {}).get("name")
                dyn[name].append((st, en, f"{e['id']}[{i}]", reign_kw(r)))
    for name, lst in dyn.items():
        lst.sort(key=lambda x: (x[0][0], x[0][1] or 0, x[0][2] or 0))
        for (s1, e1, id1, kw1), (s2, e2, id2, kw2) in zip(lst, lst[1:]):
            if e1 and cmp_truncated(s2, e1) < 0:
                if kw1 or kw2:
                    continue  # 並立・対立政権として重複在位の note で説明あり
                pair = (id1, id2)
                if pair in KNOWN_REIGN_OVERLAP:
                    KNOWN_REIGN_OVERLAP.discard(pair)
                else:
                    err(f"[reign-overlap] {name}: {id1}(endDate {e1 and '-'.join(str(x) for x in e1 if x)}) "
                        f"と {id2}(startDate {'-'.join(str(x) for x in s2 if x)}) が重複し並立系の記述なし"
                        f"（内禅・禅譲の同期漏れの疑い）")


def check_counting_age(data):
    """数え年（虚歳）の逆算整合チェック（CE 生年限定・警告）。

    ages.accessionAge/deathAge は数え年統一方針。CE 生年（BCE の天文年↔歴史年ずれを避ける）で、
    accessionAge は reigns[0].startYear（歴史年）、deathAge は ages.deathDate の年（在位 endYear で
    はない＝太上皇の退位後死去で誤検知しないため）を基準に「年ラベル差＋1」を計算し、記録値との差が
    2 以上（旧暦年またぎ由来の ±1 は許容）の場合に警告として一覧化。満年齢の紛れ込み（袁世凱で実在→
    2026-07-22 訂正、満年齢は数え比 -2 前後で顕在化）や粗い入力ミスを可視化する。原典由来の ±1 矛盾
    （後唐荘宗・元成宗等・note 未記載）は許容内なので surface しない。KNOWN_COUNTING_AGE で
    明示済みの既知乖離（差2以上でも note 説明済み）を除外。
    """
    hits = []
    for e in data["emperors"]:
        a = e.get("ages") or {}
        bd = parse_date(a.get("birthDate"))
        if not bd or bd[0] <= 0:
            continue  # CE 生年のみ
        by = bd[0]
        reigns = e.get("reigns") or []
        dd = parse_date(a.get("deathDate"))
        bases = {
            "accessionAge": reigns[0].get("startYear") if reigns else None,
            "deathAge": dd[0] if dd else None,
        }
        for field, base in bases.items():
            val = a.get(field)
            if not isinstance(val, int) or not isinstance(base, int):
                continue
            calc = base - by + 1
            if abs(val - calc) >= 2:  # ±1 は旧暦年またぎ許容
                if (e["id"], field) in KNOWN_COUNTING_AGE:
                    KNOWN_COUNTING_AGE.discard((e["id"], field))
                else:
                    hits.append(f"{e['id']}.{field}={val}(数え逆算{calc})")
    if hits:
        warn(f"[counting-age] 数え年逆算と2以上乖離（満年齢混入・入力ミスの疑い、要確認）: "
             f"{len(hits)}件 {hits}")


def check_note_value_sync(data):
    """ages.note の「〜は null とした」記述とフィールド値の矛盾検出（2026-07-22 note 全件検証の恒久化）。

    調査 note が「原文明記なしのため null とした」と宣言しているのに後続パスが値を埋めると、
    note と値が矛盾したまま残る（beisong-shenzong 等 7 レコード 9 件で実在）。null 直前 40 字以内に
    現れるフィールド名を「null 宣言されたフィールド」とみなし、そのフィールドに値が入っていれば検出。
    既知分は KNOWN_NULL_SAID（訂正待ち・警告で件数を出し続ける）。新規発生はエラー。
    """
    pending = 0
    for e in data["emperors"]:
        a = e.get("ages") or {}
        note = a.get("note") or ""
        claimed = set()
        for m in re.finditer(r"null", note):
            back = note[max(0, m.start() - 40):m.start()]
            for f in ("accessionAge", "deathAge"):
                if f in back:
                    claimed.add(f)
        for f in claimed:
            if a.get(f) is None:
                continue  # note どおり null → 矛盾なし
            if (e["id"], f) in KNOWN_NULL_SAID:
                KNOWN_NULL_SAID.discard((e["id"], f))
                pending += 1
            else:
                err(f"[note-sync] {e['id']}.ages: note は {f}=null と明記しているが値 {a[f]} が入っている"
                    f"（note と値を同時に更新すること）")
    if pending:
        warn(f"[note-sync] note「null とした」と値の矛盾（検出済み・訂正待ち）: {pending} 件"
             f"（docs/qa/note-verification-2026-07-22/REPORT.md）")


def check_used_emperor_title_from(data):
    """flags.usedEmperorTitleFrom の規約チェック（task.md 0-2、2026-07-22 確定）。

    歴史紀年ベース（称帝時点の旧暦年に対応する西暦年）。旧暦年またぎ（十二月称帝等）で
    reigns[0].startYear（実日付の年）より1小さくなるのは正当。それ以外の乖離はエラー。
    """
    for e in data["emperors"]:
        f_ = (e.get("flags") or {}).get("usedEmperorTitleFrom")
        reigns = e.get("reigns") or []
        sy = reigns[0].get("startYear") if reigns else None
        if not isinstance(f_, int) or not isinstance(sy, int):
            continue
        if f_ not in (sy, sy - 1):
            err(f"[flags] {e['id']}: usedEmperorTitleFrom={f_} が reigns[0].startYear={sy} と"
                f"乖離（許容は一致または旧暦年またぎの -1 のみ）")


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

        # totalReignDuration と reigns[].duration の整合（フェーズB同期漏れ9件の再発防止）
        t = rs.get("totalReignDuration")
        if not (isinstance(t, dict) and reigns):
            continue
        durations = [r.get("duration") or {} for r in reigns]
        if any(d.get("approxDays") is None for d in durations):
            continue  # approxDays 欠落は check_reigns 側でエラーになる
        total = sum(d["approxDays"] for d in durations)
        if t.get("approxDays") != total:
            err(
                f"[reignSummary] {eid}: totalReignDuration.approxDays={t.get('approxDays')} "
                f"だが reigns の合計は {total}"
            )
        exact_all = all(d.get("exactDays") is not None for d in durations)
        if bool(t.get("isExact")) != exact_all:
            err(
                f"[reignSummary] {eid}: isExact={t.get('isExact')} だが "
                f"全 reigns の exactDays 確定は {exact_all}"
            )
        if bool(t.get("needsPreciseDays")) == exact_all:
            err(
                f"[reignSummary] {eid}: needsPreciseDays={t.get('needsPreciseDays')} が "
                f"reigns の exactDays 確定状況（全確定={exact_all}）と矛盾"
            )
        # displayYears: ÷365 または ÷365.25 を 0〜2 桁で丸めた値のいずれかに一致すること
        dy = t.get("displayYears")
        if isinstance(dy, (int, float)):
            candidates = [
                round(total / divisor, nd)
                for divisor in (365, 365.25)
                for nd in (0, 1, 2)
            ]
            if not any(abs(dy - c) < 1e-9 for c in candidates):
                if eid in KNOWN_DISPLAY_YEARS:
                    KNOWN_DISPLAY_YEARS.discard(eid)
                else:
                    err(
                        f"[reignSummary] {eid}: displayYears={dy} が approxDays 合計 "
                        f"{total} の年換算（÷365/÷365.25・0〜2桁丸め）と一致しない"
                    )


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
    """emperor レコード全体を再帰走査し、キー名 `source` の出典をすべて判定する。

    かつてはパス列挙方式（deathCause/accessionRoute/events/reigns[].duration）だったが、
    将来 source フィールドを持つ項目が増えたときに検査から漏れるため走査方式に変更した
    （現データの実在パスは列挙時代の対象と完全一致＝挙動は不変）。
    トップレベル `sources`（wikidata QID）はキー名が異なるため対象外。
    """

    def walk(node, path, eid):
        if isinstance(node, dict):
            for k, v in node.items():
                p = f"{path}.{k}" if path else k
                if k == "source" and v is not None:
                    if not isinstance(v, dict):
                        err(f"[source] {eid}.{p}: source が object でない: {type(v).__name__}")
                    elif is_wiki_like(v):
                        err(f"[source] {eid}.{p}: Wikipedia/百度等の出典が残存: {v.get('page')!r}")
                walk(v, p, eid)
        elif isinstance(node, list):
            for i, v in enumerate(node):
                walk(v, f"{path}[{i}]", eid)

    for e in data["emperors"]:
        walk(e, "", e["id"])


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
    check_names(data)
    check_wikidata(data)
    check_reigns(data)
    check_counts(data)
    check_bce_event_years(data)
    check_event_reign_range(data)
    check_reign_overlap(data)
    check_counting_age(data)
    check_note_value_sync(data)
    check_used_emperor_title_from(data)
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
        ("KNOWN_DISPLAY_YEARS", KNOWN_DISPLAY_YEARS),
        ("KNOWN_PREACCESSION_EVENTS", KNOWN_PREACCESSION_EVENTS),
        ("KNOWN_REIGN_OVERLAP", KNOWN_REIGN_OVERLAP),
        ("KNOWN_COUNTING_AGE", KNOWN_COUNTING_AGE),
        ("KNOWN_NULL_SAID", KNOWN_NULL_SAID),
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
