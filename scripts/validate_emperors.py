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
    "shun-lichengzheng",      # 1645-09 < 1645-10-01
}

# confidence が空文字のまま（現状該当なし。2-1 スキーマ検証で判明した4セル
# 〈yuan-shizu の親征・yuanmo-xushouhui の親征/反乱鎮圧/被反乱〉は 2026-08-02 の
# Issue #42 で原典に当て直して high/medium を確定済み）。
KNOWN_EMPTY_CONFIDENCE = set()

# 被反乱 event の日付が最終 reign の endDate と食い違うが正当なもの（check_death_event_date）。
# 「在位終了 ≠ 没日」（廃位・禅譲のあとで殺された）が主因で、これは食い違って当然。
# 未トリアージのものは Issue #50 で原典に当て直す。
# 鍵は (皇帝 id, events の添字) — 同じ人物に該当 event が2つあるとき、id だけだと
# 1つ目で許可リストを消費して2つ目が「新しいずれ」として警告に出てしまう
# （KNOWN_PREACCESSION_EVENTS が同じ理由で添字まで持っている）。
KNOWN_DEATH_EVENT_DATE = {
    # 廃位・禅譲後に殺害された（在位終了日と没日が別なのが正しい）
    ("hou-han-shaodi-bian", 0),    # 0189-09-28 廃位 → 0190-03-06 鴆殺
    ("sui-gongdi-tong", 0),        # 0619-05-23 禅譲 → 0619-07-19 弑逆
    # 未トリアージ（Issue #50）。在位終了日と event 日付が2日〜45日ずれる
    ("liu-song-houfeidi", 2),      # event 0477-07-07 刺殺 / reigns 0477-08-01
    ("qi-yulinwang", 0),           # event 0494-07-22 / reigns 0494-09-05
    ("liang-xiaoyuanming", 0),     # event 0555-10-29 / reigns 0555-10-27
    ("tangmo-shisiming", 0),       # event 0761-04-18 縊殺 / reigns 0761-04-22
    ("shiguo-beihan-liujien", 0),  # event 0968-11-01 刺殺 / reigns 0968-10-23
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
    ("houyan-murongchui", "eraChangeCount", 0),           # 0384 燕王自立の燕元建元
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
    # 梁師都/蕭銑・林士弘/朱粲は 2026-07-31（Issue #27）に regimeId を分割したため許容不要になった
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
# 2026-08-02（Issue #40 G2）に検出した3件（tang-wuzong・beisong-zhenzong・yuan-wenzong の
# birthDate）は、いずれも「暦換算が未実施なので null」と note が書いたあと後続パスが換算値を
# 入れて note を直し忘れたもの。3件とも sxtwl で換算を裏取りして値が正しいことを確かめ、
# note の側を訂正したので登録は空になった（残す場合は個別調査の理由を書くこと）。
KNOWN_NULL_SAID: set = set()

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
infos: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def warn(msg: str) -> None:
    warnings.append(msg)


def info(msg: str) -> None:
    """0 エラーが「綺麗」なのか「そもそも評価していない」のかを見せるための実測値。"""
    infos.append(msg)


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
    """同一政権内で在位期間が重複していないか（並立・対立政権は正当なので除外）。

    regimeId 単位で reigns を開始日順に並べ、次の reign の startDate が前の reign の endDate
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
                name = e.get("regimeId")
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


# null 宣言の対象になりうるフィールド（ages 側と reigns 側）
NULL_SAID_FIELDS = ("accessionAge", "deathAge", "birthDate", "deathDate", "startDate", "endDate")
NULL_SAID_FIELD_RE = re.compile("|".join(NULL_SAID_FIELDS))
# 「birthDate は年精度のみとし、月日は null」型。欄そのものではなく欄の一部を指す宣言
NULL_SAID_PARTIAL = re.compile(r"月日|時刻|精度|干支")


def check_note_value_sync(data):
    """note の「〜は null とした」宣言とフィールド値の矛盾検出（2026-07-22 note 全件検証の恒久化）。

    調査 note が「原文明記なしのため null とした」と宣言しているのに後続パスが値を埋めると、
    note と値が矛盾したまま残る（beisong-shenzong 等 7 レコード 9 件で実在）。
    2026-08-02（Issue #40 G2）に対象を ages 以外の note と日付フィールドへ広げた。

    null 直前 40 字以内に現れる**直近の**フィールド名だけを見る。「deathDate に反映したが
    享年不明のため deathAge は null」のように1文に2つ出るとき、遠いほうを拾うと誤検出になる。

    note の散文をこれ以上フィールドへ突き合わせる案（西暦年・ISO 日付・年齢語の全面突合）は
    測って捨てた。これらの note は作業ログで、「現行 X → Y に訂正した」という**捨てた側の値**を
    書くのが主用途のため、素朴に突き合わせると訂正前の値を主張として読む
    （ISO 日付 306件で不一致10件・年齢語 260件で不一致57件、いずれもほぼ全部が誤検出）。
    宣言の形をとる「null とした」「旧→新」だけが突合できる。
    """
    pending = 0
    for e in data["emperors"]:
        a = e.get("ages") or {}
        reigns = e.get("reigns") or []
        targets = [(a.get("note"), None), ((e.get("deathCause") or {}).get("note"), None)]
        for i, r in enumerate(reigns):
            targets.append((r.get("note"), i))
            targets.append((((r.get("duration") or {}).get("source") or {}).get("conversion"), i))
        claimed = set()
        for note, ridx in targets:
            if not isinstance(note, str):
                continue
            for m in re.finditer(r"null", note):
                back = note[max(0, m.start() - 40):m.start()]
                names = list(NULL_SAID_FIELD_RE.finditer(back))
                if not names or NULL_SAID_PARTIAL.search(back[names[-1].end():]):
                    continue
                f = names[-1].group(0)
                if f in ("startDate", "endDate"):
                    if ridx is not None and reigns[ridx].get(f) is not None:
                        claimed.add((f, f"reigns[{ridx}]", reigns[ridx][f]))
                elif a.get(f) is not None:
                    claimed.add((f, "ages", a[f]))
        for f, owner, value in sorted(claimed):
            if (e["id"], f) in KNOWN_NULL_SAID:
                KNOWN_NULL_SAID.discard((e["id"], f))
                pending += 1
            else:
                err(f"[note-sync] {e['id']}.{owner}: note は {f}=null と明記しているが値 {value} が"
                    f"入っている（note と値を同時に更新すること）")
    if pending:
        warn(f"[note-sync] note「null とした」と値の矛盾（検出済み・訂正待ち）: {pending} 件"
             f"（docs/qa/note-verification-2026-07-22/REPORT.md・Issue #40）")


ARROW_VALUE = re.compile(
    r"(?:reigns\[(\d+)\]\.)?(startDate|endDate|birthDate|deathDate)[^。\n]{0,20}?"
    r"[「(]?(-?\d{1,4}-\d{2}-\d{2})[」)]?\s*(?:→|->|から)\s*[「(]?(-?\d{1,4}-\d{2}-\d{2})[」)]?")


def _pad_iso(s: str) -> str:
    neg = s.startswith("-")
    y, m, d = s.lstrip("-").split("-")
    return ("-" if neg else "") + y.zfill(4) + f"-{m}-{d}"


def check_note_arrow_sync(data):
    """note の「欄名 旧→新」表記の**新しいほうの値**とフィールドの一致（Issue #40 G2）。

    訂正の記録は「deathDate 705-11-26→0705-12-16」の形で書かれる。矢印の右は
    「いまこの欄はこの値である」という宣言なので、これだけは突合できる。
    左（捨てた値）と突き合わせてはいけない。
    """
    for e in data["emperors"]:
        a = e.get("ages") or {}
        reigns = e.get("reigns") or []
        targets = [a.get("note"), (e.get("deathCause") or {}).get("note")]
        for r in reigns:
            targets.append(r.get("note"))
            targets.append(((r.get("duration") or {}).get("source") or {}).get("conversion"))
        for note in targets:
            if not isinstance(note, str):
                continue
            for m in ARROW_VALUE.finditer(note):
                idx, field, _, new = m.groups()
                new = _pad_iso(new)
                if field in ("birthDate", "deathDate"):
                    current = {a.get(field)}
                elif idx is not None:
                    current = {reigns[int(idx)].get(field)} if int(idx) < len(reigns) else set()
                else:
                    current = {r.get(field) for r in reigns}
                if new not in current - {None}:
                    err(f"[note-sync] {e['id']}: note が「{field} …→{new}」と訂正を記録しているが、"
                        f"欄の値は {sorted(x for x in current if x)} （note か値のどちらかが古い）")


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


DEATH_OUTCOME_RE = re.compile(
    "弑逆|弑殺|弑され|被弑|崩御|殺害され|謀殺され|鴆殺|毒殺され|絞殺され|縊殺|刺殺され"
)


def check_death_event_date(data):
    """本人の死を結末とする被反乱 event の日付が、最終 reign の endDate と一致するか（警告）。

    2026-08-02（Issue #42）追加。`yuanmo-xushouhui` で、`reigns[0].endDate` を 2026-07-21 に
    1360-07-29 → 1360-06-16 へ訂正した際に `rebellionSufferedCount.events[1].endDate` が旧値の
    まま取り残されていた（event の note は「既存 deathCause/reigns と一致」と書いており、その
    記述自体が偽になっていた）。**構造フィールド同士の突合**なので、在位 ISO 年範囲を見る
    check_event_reign_range も、note の散文を見る check_note_value_sync も拾わない領域。

    絞り込みは3つ。(1) `rebellionSufferedCount` だけを見る — 親征・鎮圧の outcome は他人の死を
    書くのが普通で、主語の判別が機械ではできない。(2) 両端とも day 精度のものだけ比べる
    （year/month 精度の "-01" は埋め草で、日の一致を問えない）。(3) outcome が本人の死を述べて
    いるものだけ（note まで広げると「〜のまま崩御」の言及で誤検出が10倍になる）。

    それでも「在位終了 ≠ 没日」（廃位・禅譲のあとで殺された）は正当に食い違うので、
    KNOWN_DEATH_EVENT_DATE で除外する。
    """
    hits = []
    evaluated = 0
    for e in data["emperors"]:
        reigns = e.get("reigns") or []
        if not reigns:
            continue
        end = reigns[-1].get("endDate")
        rp = reigns[-1].get("datePrecision")
        rp = rp.get("end") if isinstance(rp, dict) else rp
        if not end or len(end) != 10 or rp != "day":
            continue
        for i, ev in enumerate(e.get("rebellionSufferedCount", {}).get("events", []) or []):
            if not DEATH_OUTCOME_RE.search(str(ev.get("outcome") or "")):
                continue
            for key in ("endDate", "date"):
                val = ev.get(key)
                if not val or len(val) != 10:
                    continue
                p = ev.get("datePrecision")
                p = p.get("end" if key == "endDate" else "start") if isinstance(p, dict) else p
                if p != "day":
                    continue
                evaluated += 1
                if val == end:
                    continue
                if (e["id"], i) in KNOWN_DEATH_EVENT_DATE:
                    KNOWN_DEATH_EVENT_DATE.discard((e["id"], i))
                else:
                    hits.append(
                        f"{e['id']}.rebellionSufferedCount.events[{i}].{key}={val} "
                        f"≠ reigns[-1].endDate={end}"
                    )
    if hits:
        warn(f"[death-event-date] 本人の死を結末とする被反乱 event の日付が在位終了日と食い違う"
             f"（在位終了≠没日なら正当・許可リストへ）: {len(hits)}件 {hits}")
    return evaluated


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
                    # 語彙標準は year/month/day/null（2026-07-22 ユーザー確定・正規化完了）。
                    # 完全一致で検査（旧実装は先頭 ascii トークンのみ照合し「day（説明…）」形式を見逃していた）。
                    for val in (v.values() if isinstance(v, dict) else [v]):
                        if val is not None and val not in STANDARD_PRECISION_TOKENS:
                            err(f"[precision] {eid}.{path}.{k}: 非標準トークン {str(val)[:40]!r}（year/month/day/null のみ許可）")
                walk_children(v, eid, path, k)
        elif isinstance(node, list):
            for i, x in enumerate(node):
                walk(x, eid, f"{path}[{i}]")

    def walk_children(v, eid, path, k):
        if isinstance(v, (dict, list)):
            walk(v, eid, f"{path}.{k}" if path else k)

    for e in data["emperors"]:
        walk(e, e["id"], "")


def check_event_date_format(data):
    """events の date/startDate/endDate は ISO 形式必須（2026-07-22 正規化完了に伴い恒久化・エラー）。
    datePrecision は単一トークン（year/month/day/null）に加え、startDate/endDate で実確認精度が
    異なるイベントに限り reigns[] と同形式の {"start": ..., "end": ...} オブジェクトを許可
    （2026-07-23 混在精度44キー解消・ユーザー確定。語彙自体は check_confidence が検査）。
    precision に対する日付深さ不足は全キーでエラー（旧実装の startDate/endDate 警告を格上げ）。"""
    for e in data["emperors"]:
        for g in COUNT_GROUPS:
            o = e.get(g)
            if not isinstance(o, dict):
                continue
            for i, ev in enumerate(o.get("events") or []):
                if not isinstance(ev, dict):
                    continue
                prec = ev.get("datePrecision")
                if isinstance(prec, dict):
                    if set(prec) != {"start", "end"}:
                        err(
                            f"[event-date] {e['id']}.{g}[{i}]: datePrecision オブジェクトは "
                            f"start/end の両キー必須: {prec!r}"
                        )
                    elif prec.get("start") == prec.get("end"):
                        err(
                            f"[event-date] {e['id']}.{g}[{i}]: datePrecision の start と end が"
                            f"同値（単一トークンで表現する）: {prec!r}"
                        )
                    if ev.get("date") is not None:
                        err(
                            f"[event-date] {e['id']}.{g}[{i}]: 単一日付 date にオブジェクト形式 "
                            f"datePrecision は使えない"
                        )
                for k in ("date", "startDate", "endDate"):
                    v = ev.get(k)
                    if v is None:
                        continue
                    if not isinstance(v, str) or not ISO_DATE.match(v):
                        err(f"[event-date] {e['id']}.{g}[{i}].{k}: 非ISO形式 {str(v)[:40]!r}")
                        continue
                    if isinstance(prec, dict):
                        tok = prec.get("end" if k == "endDate" else "start")
                    else:
                        tok = prec
                    depth = len(v.lstrip("-").split("-"))
                    if isinstance(tok, str) and tok in PRECISION_DEPTH and depth < PRECISION_DEPTH[tok]:
                        err(
                            f"[event-date] {e['id']}.{g}[{i}].{k}: datePrecision={tok} に対し"
                            f"日付 {v} の深さが不足"
                        )


# --- claim（主張）欄 ---------------------------------------------------------
# note は**作業ログ**で、訂正の経緯として「現行 X → Y に訂正」のように**捨てた側の値**が
# 本文に残る。だからフィールドとの突合は向きが反転し、散文は witness にならない
# （Issue #40 の G2/G3 の当初案が測定で否定された経路がこれ）。claim は同じコンテナに
# 置く**前向きだけの1〜2文**で、突合の向きが反転しない witness になる。
#
# **claim が無いことは根拠の不在を意味しない** — 既存 10,912件の note には遡及しないので、
# 無いのが既定。したがって coverage.py は claim を確定の根拠にせず、ここでも
# 「claim を持つコンテナ」だけを評価して**評価件数を必ず出す**。
CLAIM_REVERSAL = (
    # 「捨てた側」を書いた印。claim にこれが出たら、その文は作業ログであって主張ではない。
    # **史実の日本語と衝突しない語だけを置く。** 「に改め」「差し替え」「から変更」は
    # 改元・遷都・皇太子廃立の主張そのものに出る自然な語で、入れると最初に claim を
    # 書いた人が誤検出に当たり「このゲートは壊れている」と結論する。
    "訂正", "現行", "旧値", "→", "->",
)
# verify_quotes.py の引用ユニットと同じ形（かな無し・漢字6字以上の「」スパン）。
# claim は照合台帳の抽出対象外なので、ここに引用を書くと照合を素通りする
KANA_RE = re.compile(r"[ぁ-んァ-ヶー]")
HAN_RE = re.compile(r"[㐀-䶿一-鿿豈-﫿]")


def check_claim_fields(data):
    seen = 0

    def walk(node, path, eid):
        nonlocal seen
        if isinstance(node, dict):
            if "claim" in node:
                seen += 1
                check_one(node, path, eid)
            for k, v in node.items():
                walk(v, f"{path}.{k}" if path else k, eid)
        elif isinstance(node, list):
            for i, v in enumerate(node):
                walk(v, f"{path}[{i}]", eid)

    def check_one(node, path, eid):
        claim = node["claim"]
        if not isinstance(claim, str) or not claim.strip():
            err(f"[claim] {eid}.{path}: claim が非空文字列でない: {claim!r}")
            return
        for marker in CLAIM_REVERSAL:
            if marker in claim:
                err(f"[claim] {eid}.{path}: claim に作業ログの印「{marker}」があります。"
                    "捨てた側の値・訂正の経緯は note へ。claim はいま正しいと判断している"
                    "内容だけを前向きに書く欄です")
        for m in re.finditer(r"「([^」]+)」", claim):
            span = m.group(1)
            if not KANA_RE.search(span) and len(HAN_RE.findall(span)) >= 6:
                err(f"[claim] {eid}.{path}: claim に原文引用らしい「{span[:20]}…」があります。"
                    "引用は note へ — verify_quotes.py の抽出対象は note と quote だけなので、"
                    "claim に書いた引用は照合台帳を素通りします")
        count = node.get("count")
        if isinstance(count, int) and str(count) not in claim:
            err(f"[claim] {eid}.{path}: count={count} ですが claim に「{count}」が出ません。"
                "件数は算用数字で書いてください（これがフィールドとの突合そのものです）")

    for e in data["emperors"]:
        walk(e, "", e["id"])
    info(f"[claim] claim を持つコンテナ {seen} 件を評価（欄は任意・既存 note に遡及しないため"
         "0件でも異常ではない。0エラーを「綺麗」と読まないための分母）")


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


# v3: 値はすべて meta.catalogs.enums の ID（日本語ラベルはカタログ側にしか置かない）
THRONE_SOURCE_ENUM = {"inherited", "abdication-received", "self-established"}
TITLE_ORIGIN_ENUM = {"inherited", "new"}
DECIDED_BY_ENUM = {"self", "predecessor", "third-party", "undetermined"}
DECIDED_BY_AGENT_ENUM = {"officials", "military", "eunuchs", "consort-kin",
                         "empress-dowager", "imperial-clan"}
DECIDED_BY_BASIS_ENUM = {"existing-note", "source-reread"}
PREDECESSOR_FATE_ENUM = {"natural-death", "violent-death", "abdicated", "deposed", "none"}
PROCEDURE_ENUM = {"abdication-ceremony", "inner-abdication", "normal",
                  "no-ceremony", "forged-edict"}
# kinship.json の REL_TO_PRED_ENUM と同一語彙（ADDITIONAL_SCHEMA.md 軸4）＋
# succession エッジを持たない人物（自立等）用の「該当なし」。
# 値の一致は validate_kinship.py の check_axes_sync が突合する
RELATION_ENUM = {
    "son", "adopted-son", "grandson", "great-grandson", "younger-brother", "elder-brother",
    "nephew", "niece", "uncle-younger", "uncle-elder", "cousin", "distant-kin",
    "father", "mother", "grandfather", "maternal-grandfather", "son-in-law", "father-in-law",
    "affinal-kin", "unrelated", "unknown", "other", "none",
}
# note の陳腐化検出に使う日本語ラベル（表示ラベルは meta.catalogs.enums が正）
ACCESSION_LABEL = {
    "hereditary": "世襲",
    "enthroned": "擁立",
    "self-established": "自立",
    "usurpation": "簒奪",
    "acclamation": "推戴",
    "abdication-received": "受禅（易姓）",
    "succession-unspecified": "継承（経緯記載なし）",
    "inner-abdication": "内禅",
}
AXES_REQUIRED = {
    "throneSource", "titleOrigin", "decidedBy", "decidedByBasis",
    "predecessorFate", "relationToPredecessor", "procedure",
}
AXES_OPTIONAL = {"decidedByAgents"}


def derive_category(axes):
    """ADDITIONAL_SCHEMA.md「導出ルール」に従い axes から categoryId を算出する。

    判定そのものではなく、確定済みの軸値からの機械的な写像（CONSTRAINTS.md の
    「確定済み調査結果の構造チェック」の範囲）。
    """
    src = axes.get("throneSource")
    # 複数値のときは 本人 > 先帝 > 第三者 の優先順位で1つに畳む
    decided = axes.get("decidedBy") or []
    if "self" in decided:
        agent = "self"
    elif "predecessor" in decided:
        agent = "predecessor"
    elif "third-party" in decided:
        agent = "third-party"
    elif decided == ["undetermined"]:
        agent = "undetermined"
    else:
        return None

    if src == "abdication-received":
        # 受禅（擁立）は実データ 0 件のため v3 の enum から除外済み（該当時は導出不能）
        return "abdication-received" if agent == "self" else None
    if src == "self-established":
        return "self-established" if agent == "self" else "acclamation"
    if src == "inherited":
        if axes.get("procedure") == "inner-abdication":
            return "inner-abdication"
        return {
            "self": "usurpation",
            "predecessor": "hereditary",
            "third-party": "enthroned",
            "undetermined": "succession-unspecified",
        }[agent]
    return None


def check_accession_axes(data):
    """accessionRoute.axes（2026-07-26 多軸化）の enum と category 導出の整合を検査する。

    2026-07-26 に全365人の移行が完了したため、axes は必須（欠落はエラー）。
    """
    for e in data["emperors"]:
        route = e.get("accessionRoute") or {}
        axes = route.get("axes")
        eid = e["id"]
        if axes is None:
            err(f"[axes] {eid}: accessionRoute.axes が無い（多軸化は全員必須）")
            continue
        if not isinstance(axes, dict):
            err(f"[axes] {eid}: accessionRoute.axes が object でない")
            continue

        missing = AXES_REQUIRED - set(axes)
        if missing:
            err(f"[axes] {eid}: 必須の軸が欠落: {sorted(missing)}")
        extra = set(axes) - AXES_REQUIRED - AXES_OPTIONAL
        if extra:
            err(f"[axes] {eid}: 未定義のキー: {sorted(extra)}")

        for key, enum in (
            ("throneSource", THRONE_SOURCE_ENUM),
            ("titleOrigin", TITLE_ORIGIN_ENUM),
            ("decidedByBasis", DECIDED_BY_BASIS_ENUM),
            ("predecessorFate", PREDECESSOR_FATE_ENUM),
            ("relationToPredecessor", RELATION_ENUM),
            ("procedure", PROCEDURE_ENUM),
        ):
            if key in axes and axes[key] not in enum:
                err(f"[axes] {eid}.{key}: enum 外の値: {axes[key]!r}")

        decided = axes.get("decidedBy")
        if decided is not None:
            if not isinstance(decided, list) or not decided:
                err(f"[axes] {eid}.decidedBy: 非空の配列であること: {decided!r}")
            else:
                bad = [v for v in decided if v not in DECIDED_BY_ENUM]
                if bad:
                    err(f"[axes] {eid}.decidedBy: enum 外の値: {bad}")
                if len(set(decided)) != len(decided):
                    err(f"[axes] {eid}.decidedBy: 値が重複: {decided}")
                if "undetermined" in decided and len(decided) > 1:
                    err(f"[axes] {eid}.decidedBy: undetermined（史料から決着不能）は単独でのみ使用: "
                        f"{decided}")

        agents = axes.get("decidedByAgents") or []
        if not isinstance(agents, list):
            err(f"[axes] {eid}.decidedByAgents: 配列であること")
        else:
            bad = [v for v in agents if v not in DECIDED_BY_AGENT_ENUM]
            if bad:
                err(f"[axes] {eid}.decidedByAgents: enum 外の値: {bad}")
            if agents and "third-party" not in (decided or []):
                err(f"[axes] {eid}.decidedByAgents: decidedBy に第三者を含まないのに類型が指定されている")

        # note が旧カテゴリでの判定文言を残したままだと、表示（category は軸から導出）と
        # 説明文が食い違う。多軸化でラベルが変わった人物の note 書き換え漏れを検出する。
        note = route.get("note") or ""
        current_label = ACCESSION_LABEL.get(route.get("categoryId"))
        for lab in ("世襲", "簒奪", "禅譲", "内禅", "擁立", "復位", "建国"):
            for pat in (f"{lab}と判定", f"{lab}に分類", f"{lab}を採用"):
                if pat in note and current_label != lab:
                    err(f"[axes] {eid}: note に旧判定文言「{pat}」が残っているが "
                        f"categoryId は {route.get('categoryId')!r}")

        derived = derive_category(axes)
        if derived is None:
            err(f"[axes] {eid}: 軸の組み合わせから categoryId を導出できない（導出ルール未該当）")
        elif route.get("categoryId") != derived:
            err(
                f"[axes] {eid}: categoryId が軸から導出される値と不一致: "
                f"{route.get('categoryId')!r} ≠ {derived!r}"
            )


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


def check_catalogs(data):
    """meta.catalogs（v3）の内部整合を検査する。

    レコード側の参照整合（eraId/regimeId/各 ID が catalogs に存在するか）は
    フィールド追加後に check_record_catalog_refs が担当する。ここはカタログ単体の健全性。
    """
    catalogs = data["meta"].get("catalogs")
    if catalogs is None:
        err("[catalogs] meta.catalogs が無い（v3 必須）")
        return

    eras = catalogs.get("eras") or []
    regimes = catalogs.get("regimes") or []
    enums = catalogs.get("enums") or {}

    era_ids = [e.get("id") for e in eras]
    if len(set(era_ids)) != len(era_ids):
        err(f"[catalogs] eras の id が重複: {[i for i in era_ids if era_ids.count(i) > 1]}")
    era_orders = [e.get("sortOrder") for e in eras]
    if len(set(era_orders)) != len(era_orders):
        err("[catalogs] eras の sortOrder が重複")

    regime_ids = [r.get("id") for r in regimes]
    if len(set(regime_ids)) != len(regime_ids):
        err(f"[catalogs] regimes の id が重複: "
            f"{sorted({i for i in regime_ids if regime_ids.count(i) > 1})}")
    regime_orders = [r.get("sortOrder") for r in regimes]
    if len(set(regime_orders)) != len(regime_orders):
        err("[catalogs] regimes の sortOrder が重複")

    category_ids = {c["id"] for c in enums.get("regimeCategory", [])}
    for r in regimes:
        if r.get("eraId") not in set(era_ids):
            err(f"[catalogs] regime {r.get('id')!r}: eraId が eras にない: {r.get('eraId')!r}")
        if r.get("category") not in category_ids:
            err(f"[catalogs] regime {r.get('id')!r}: category が enums.regimeCategory にない: "
                f"{r.get('category')!r}")

    for name, items in enums.items():
        ids = [i.get("id") for i in items]
        if len(set(ids)) != len(ids):
            err(f"[catalogs] enums.{name} の id が重複: "
                f"{sorted({i for i in ids if ids.count(i) > 1})}")
        labels = [i.get("label") for i in items]
        if len(set(labels)) != len(labels):
            err(f"[catalogs] enums.{name} の label が重複: "
                f"{sorted({i for i in labels if labels.count(i) > 1})}")


def check_record_catalog_refs(data):
    """レコード側の ID がカタログを正しく参照しているかを検査する（v3）。

    - eraId / regimeId / standing / accessionRoute.categoryId がカタログに存在する
    - eraId は regimes[regimeId].eraId の非正規化コピーなので一致する
    - rebel 政権（政権そのものが反乱・自称）に rival（政権内の対立皇帝）は現れない
    - 1 人も所属しない政権がカタログに残っていない
    """
    catalogs = data["meta"].get("catalogs") or {}
    regimes = {r["id"]: r for r in catalogs.get("regimes", [])}
    era_ids = {e["id"] for e in catalogs.get("eras", [])}
    enums = catalogs.get("enums", {})
    standing_ids = {i["id"] for i in enums.get("emperorStanding", [])}
    accession_ids = {i["id"] for i in enums.get("accessionCategory", [])}
    used_regimes = set()

    for e in data["emperors"]:
        eid = e["id"]
        rid = e.get("regimeId")
        regime = regimes.get(rid)
        if regime is None:
            err(f"[catalog-ref] {eid}: regimeId が catalogs.regimes にない: {rid!r}")
        else:
            used_regimes.add(rid)
            if e.get("eraId") != regime["eraId"]:
                err(f"[catalog-ref] {eid}: eraId が regime の eraId と不一致: "
                    f"{e.get('eraId')!r} ≠ {regime['eraId']!r}")
            if regime["category"] == "rebel" and e.get("standing") == "rival":
                err(f"[catalog-ref] {eid}: rebel 政権に standing=rival は不整合"
                    f"（政権そのものが反乱政権なら所属者は regular）")
        if e.get("eraId") not in era_ids:
            err(f"[catalog-ref] {eid}: eraId が catalogs.eras にない: {e.get('eraId')!r}")
        if e.get("standing") not in standing_ids:
            err(f"[catalog-ref] {eid}: standing が不正: {e.get('standing')!r}")

        cat_id = (e.get("accessionRoute") or {}).get("categoryId")
        if cat_id not in accession_ids:
            err(f"[catalog-ref] {eid}: accessionRoute.categoryId が不正: {cat_id!r}")

    orphans = sorted(set(regimes) - used_regimes)
    if orphans:
        err(f"[catalog-ref] 所属者が 0 人の政権がカタログに残っている: {orphans}")


def main() -> int:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))

    check_schema(data, schema)
    check_catalogs(data)
    check_record_catalog_refs(data)
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
    check_note_arrow_sync(data)
    check_used_emperor_title_from(data)
    check_ages(data)
    check_reign_summary(data)
    check_confidence(data)
    death_event_n = check_death_event_date(data)
    check_event_date_format(data)
    check_forbidden_sources(data)
    check_claim_fields(data)
    check_accession_axes(data)
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
        ("KNOWN_DEATH_EVENT_DATE", KNOWN_DEATH_EVENT_DATE),
    ):
        # 消費されなかった（=データ側が既に正しい）エントリが残っていれば陳腐化
        if left:
            warn(f"[allowlist] {name} の陳腐化エントリ（訂正済み・削除可）: {sorted(left)}")

    for i in infos:
        print(f"INFO  {i}")
    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"ERROR {e}")
    print(f"---\n{len(errors)} errors, {len(warnings)} warnings "
          f"({data['meta'].get('count')} emperors"
          f"／death-event-date の評価件数 {death_event_n})")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
