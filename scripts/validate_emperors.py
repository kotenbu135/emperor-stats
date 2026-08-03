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
import hanzi_norm  # noqa: E402
from detect_wikipedia_sources import is_wiki_like  # noqa: E402
from hanzi_norm import norm_for_match  # noqa: E402
from event_date_scope import (  # noqa: E402
    ARCHIVE_PATH, boundary_years, depth_of, is_boundary_event,
)

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
    # beiwei-tuobayu は 2026-08-03 に解消。deathDate は月精度なのに `0452-10-01` と
    # 埋め草を持っていたため endDate `0452-10-29` より前に見えていた（Issue #69 の7節の3で
    # `0452-10` へ切り詰め、月精度で比較すると一致する）。**矛盾ではなく埋め草の副作用だった**
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
# 鍵は **events[].id**（2026-08-03 の Issue #69 で焼いた安定 id）。同じ人物に該当 event が
# 2つあるとき id だけでは足りず、以前は添字まで持っていたが、添字は event を1件挿入すると
# 全部ずれて**別の event を黙って許可する**。安定 id はずれない。
# 未トリアージだった5件は Issue #50 で原典に当て直し、いずれも event 側の欠陥
# （旧暦の月日を西暦欄へ直書き2件・在位終了日を訂正した際の取り残し3件）と確定して
# データを訂正したため、2026-08-03 にリストから外した。
KNOWN_DEATH_EVENT_DATE = {
    # 廃位・禅譲後に殺害された（在位終了日と没日が別なのが正しい）
    "hou-han-shaodi-bian.rebellionSufferedCount.e001",  # 0189-09-28 廃位 → 0190-03-06 鴆殺
    "sui-gongdi-tong.rebellionSufferedCount.e001",      # 0619-05-23 禅譲 → 0619-07-19 弑逆
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
# 鍵は **events[].id**（2026-08-03・Issue #69。以前は (皇帝id, 容器, 添字) で、
# 容器に event を1件挿入すると以降の許可が1つずつ隣へずれた）。
KNOWN_PREACCESSION_EVENTS = {
    "wu-dadi.capitalRelocationCount.e001",             # 0221 呉王冊命前の遷都
    "qianzhao-liuyuan.eraChangeCount.e001",            # 0304 漢王期の建元
    "qianzhao-liuyuan.capitalRelocationCount.e001",    # 0305 漢王期の遷都
    "qianyan-murongjun.capitalRelocationCount.e001",   # 0350 燕王期(即位前)の遷都。父・慕容皝の0341は2026-07-22に他者事績として削除済み
    "houzhao-shile.eraChangeCount.e001",               # 0319 趙王期の建元（趙王元年）
    "houzhao-shile.eraChangeCount.e002",               # 0328 趙王期の太和改元
    "houzhao-shile.amnestyCount.e001",                 # 0328 趙王期の大赦
    "xia-helianbobo.eraChangeCount.e001",              # 0407 天王・大単于期の龍昇建元
    "xia-helianbobo.amnestyCount.e001",                # 0407 天王期の赦其境内
    "nanyan-murongde.eraChangeCount.e001",             # 0398 燕王自立の称元
    "nanyan-murongde.amnestyCount.e001",               # 0398 燕王期の大赦境内
    "houqin-yaochang.eraChangeCount.e001",             # 0384 万年秦王期の白雀建元
    "houqin-yaochang.amnestyCount.e001",               # 0384 万年秦王期の大赦境内
    "houyan-murongchui.eraChangeCount.e001",           # 0384 燕王自立の燕元建元
    "houzhao-shihu.eraChangeCount.e001",               # 0335 趙天王期
    "houzhao-shihu.amnestyCount.e001",                 # 0335 趙天王期
    "houzhao-shihu.amnestyCount.e002",                 # 0337 大趙天王期
    "houzhao-shihu.empressInstallationCount.e001",     # 0337 天王皇后
    "houzhao-shihu.empressInstallationCount.e002",     # 0337 天王皇后
    "houzhao-shihu.crownPrinceDepositionCount.e001",   # 0337 天王期
    "houzhao-shihu.capitalRelocationCount.e001",       # 0335 趙天王期
    "tangmo-huangchao.eraChangeCount.e001",            # 0878 王霸建元(称帝前)
    "shiguo-wu-yangpu.eraChangeCount.e001",            # 0921 呉王期の改元
    "shiguo-wu-yangpu.amnestyCount.e001",              # 0921 呉王期の大赦
    "shiguo-min-wangyanxi.eraChangeCount.e001",        # 0939 閩国王期(称帝は941)
    "liao-taizu.empressInstallationCount.e001",        # 0907 可汗即位期(公式在位は916-)
    "xixia-jingzong.eraChangeCount.e001",              # 1033 西平王期
    "xixia-jingzong.eraChangeCount.e002",              # 1034 西平王期
    "xixia-jingzong.eraChangeCount.e003",              # 1035 西平王期
    "xixia-jingzong.amnestyCount.e001",                # 1034 西平王期
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
                    key = ev.get("id") or f"{e['id']}.{g}[{i}]"
                    if key in KNOWN_PREACCESSION_EVENTS:
                        KNOWN_PREACCESSION_EVENTS.discard(key)
                    else:
                        err(f"[event-range] {key}: date={ev['date']} が在位 ISO 年範囲 "
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
        # 深さ＝主張（events と同じ規則・Issue #69 の計画7節の3）。埋め草は置かない。
        # 非 ISO 値（元号・自由記述）は上の non_iso が別に数えているのでここでは飛ばす
        for k, pk in (("birthDate", "birthDatePrecision"), ("deathDate", "deathDatePrecision")):
            v, tok = a.get(k), a.get(pk)
            t = parse_date(v)
            want = PRECISION_DEPTH.get(tok) if isinstance(tok, str) else None
            if t is not None and want is not None and date_depth(t) > want:
                err(f"[ages] {eid}.{k}: {pk}={tok} に対し日付 {v} が深すぎる"
                    f"（深さ＝主張。埋め草は置かない・Issue #69）")
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


def check_dynasty_order(data):
    """`reigns[].dynastyOrder` の欄の在り方が `dynastyOrderSurveyed` と噛み合うか（Issue #69）。

    2026-08-03 に「未調査は欄を持たない」へ寄せた（計画7節の3・D）。それまでは `null` が
    「その政権をまだ調べていない」と「調べた上で歴代に数えない在位」の**両方**を意味していて、
    レコード単体からは区別できなかった（`meta.catalogs.regimes` を引いて初めて分かる）。

      - `dynastyOrderSurveyed: false` の政権 … `dynastyOrder` の欄そのものが無い（未調査）
      - `dynastyOrderSurveyed: true`  の政権 … 欄が必ず在り、値か `null`。
        **`null` は「歴代に数えない」の主張**（僭称・並立で帝紀を立てられていない在位）

    このゲートが無いと、欄を落としただけで「未調査と該当なしを区別できる」保証は残らない
    （`R-CLAIM-GATED`：新しい主張の欄を作るときは検査するゲートを同じ変更で足す）。
    未調査の残量は Issue の器ではなく docs/process/RESIDUAL.md の行で持つ。
    """
    surveyed = {r["id"]: r.get("dynastyOrderSurveyed")
                for r in (data["meta"].get("catalogs") or {}).get("regimes") or []}
    unsurveyed_reigns = 0
    for e in data["emperors"]:
        s = surveyed.get(e.get("regimeId"))
        for i, r in enumerate(e.get("reigns") or []):
            where = f"{e['id']}.reigns[{i}]"
            has = "dynastyOrder" in r
            if s is False:
                if has:
                    err(f"[dynasty-order] {where}: dynastyOrderSurveyed: false の政権"
                        f"（{e.get('regimeId')}）なのに dynastyOrder の欄が在る"
                        f"（値 {r['dynastyOrder']!r}）。未調査は欄を持たない・Issue #69")
                else:
                    unsurveyed_reigns += 1
            elif s is True and not has:
                err(f"[dynasty-order] {where}: dynastyOrderSurveyed: true の政権"
                    f"（{e.get('regimeId')}）なのに dynastyOrder の欄が無い。"
                    f"歴代に数えないなら null を明示する・Issue #69")
    return unsurveyed_reigns


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
                ref = ev.get("id") or f"{e['id']}.rebellionSufferedCount[{i}]"
                if ref in KNOWN_DEATH_EVENT_DATE:
                    KNOWN_DEATH_EVENT_DATE.discard(ref)
                else:
                    hits.append(f"{ref}.{key}={val} ≠ reigns[-1].endDate={end}")
    if hits:
        warn(f"[death-event-date] 本人の死を結末とする被反乱 event の日付が在位終了日と食い違う"
             f"（在位終了≠没日なら正当・許可リストへ）: {len(hits)}件 {hits}")
    if KNOWN_DEATH_EVENT_DATE:
        # 消費されずに残ったエントリ＝ずれが解消した・event が消えた・添字がずれた。
        # 黙って残すと、同じ (id, 添字) で将来ずれが出ても許可リストが吸って通してしまう。
        warn(f"[death-event-date] 許可リストの未消費エントリ（ずれが解消したか対象が動いた・"
             f"外すか鍵を直す）: {sorted(KNOWN_DEATH_EVENT_DATE)}")
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

    **2026-08-03（Issue #69）に深さの規則を反転した。** 旧実装は「深さは datePrecision 以上」を
    要求していた（＝年精度でもフル ISO で保存し、`-01-01` の埋め草が入る）。反転後は:

      1. **深さは datePrecision を超えない** — 埋め草を廃止し、**保存値の深さそのものが主張**
         （年 `"1211"`・月 `"1211-05"`・日 `"1211-05-07"`）。値の形から主張が読める
      2. **月日の深さを持てるのは在位の境界年に在る event だけ** — 配布物が主張するのは
         「年精度 ＋ 在位境界年の月日」で、それ以外の月日は
         `data/internal/event-date-archive.json` に退避してある

    2 は移行直後 0 件で、**0 件を保つことが主張範囲の凍結**（新しい event を足したときに
    黙って主張が広がるのを止める）。判定は scripts/event_date_scope.py に1つだけ置き、
    移行スクリプト・verify_calendar・絞り込みも同じ関数を呼ぶ（BCE で歴史年と天文年が
    1年ずれるので、2実装に分かれると「移行では丸めたのにゲートが違反と言う」が起きる）。
    """
    for e in data["emperors"]:
        years = boundary_years(e)
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
                where = ev.get("id") or f"{e['id']}.{g}[{i}]"
                boundary = is_boundary_event(years, ev)
                for k in ("date", "startDate", "endDate"):
                    v = ev.get(k)
                    if v is None:
                        continue
                    if not isinstance(v, str) or not ISO_DATE.match(v):
                        err(f"[event-date] {where}.{k}: 非ISO形式 {str(v)[:40]!r}")
                        continue
                    if isinstance(prec, dict):
                        tok = prec.get("end" if k == "endDate" else "start")
                    else:
                        tok = prec
                    depth = len(v.lstrip("-").split("-"))
                    if isinstance(tok, str) and tok in PRECISION_DEPTH and depth > PRECISION_DEPTH[tok]:
                        err(
                            f"[event-date] {where}.{k}: datePrecision={tok} に対し日付 {v} が"
                            f"深すぎる（深さ＝主張。埋め草は置かない・Issue #69）"
                        )
                    if depth > 1 and not boundary:
                        err(
                            f"[event-date] {where}.{k}: 在位の境界年でない {v} が月日の深さを"
                            f"持っている。配布物が主張するのは「年精度 ＋ 在位境界年の月日」だけ"
                            f"（丸めた月日は data/internal/event-date-archive.json）"
                        )


# --- 元号名（Issue #37 単位2・2026-08-03 新設）--------------------------------
# 主張は「**この改元 event が建てた元号の名は eraName である**」。
# 転記は原典を読む作業で一度に終わらないので、条件（全 event が eraName を持つ）は
# **強制しない**。ここが強制するのは形と根拠と**ラチェット**だけで、不足は
# docs/process/RESIDUAL.md の行として持つ（SCHEMA_CHANGE_CHECKLIST.md 手順5）。
#
# **eraName が空であることは「元号が無い」ではない。** 前漢初期のように元号制以前で
# 名前そのものが無い改元と、まだ読んでいない改元の両方が空になる。埋め草を書かせると
# R-DATE-CLAIM-SCOPE が日付で捨てた形をここで作り直すので、任意のままにしてある。
ERA_NAME_BASELINE = 5

# 元号の名だけを書く欄なので、記事の一節を丸ごと入れた形（「改元康熙」「為天啓元年」）を弾く。
# **「建元」は実在する元号**（漢武帝の最初の元号・東晋康帝・前秦苻堅・南斉高帝）なので、
# **それ単体のときだけ通す**（「改元建元」「建元元年」は弾いたまま）。史実の日本語と衝突する語を
# 印に入れると、最初に転記する人が誤検出に当たって「このゲートは壊れている」と結論する
# （claim 欄で実際に起きかけた型。test_claim_field.py の同じコメントを参照）。
ERA_NAME_FORBIDDEN = ("元年", "改元", "建元", "年号", "年號", "改號", "改号")
ERA_NAME_ALLOW_EXACT = ("建元",)
ERA_NAME_RE = re.compile(r"^[㐀-鿿]{2,4}$")


def check_era_names(data):
    """改元 event の元号名 eraName / eraNameRaw（Issue #37 単位2）。

    A 形         … 漢字2〜4字・記事の語を含まない
    B 再演       … eraNameRaw があるとき norm_for_match(eraName) == norm_for_match(eraNameRaw)。
                    **「表示の字体を勝手に作った」を落とす**
    C 根拠       … norm_for_match(eraName) が同じ event の note・quotes・dateRaw の
                    正規化本文に在る
    E ラチェット … eraName を持つ改元 event の数が基準線を下回ったら落ちる

    **C は「建てた側」と「捨てた側」を区別しない。** 「章武から建興へ改元」の note では
    章武（捨てた側）を入れても C は通る。区別できるのは改元アンカーと同じ行を見る
    verify_quotes.py --check-era-names（ゲートD）だけで、C はそこまでは言っていない
    （scripts/test_era_name.py にこの限界を測るケースを置いてある）。
    """
    total = named = 0
    can_norm = hanzi_norm._T2S is not None
    for e in data["emperors"]:
        for g in COUNT_GROUPS:
            o = e.get(g)
            if not isinstance(o, dict):
                continue
            for i, ev in enumerate(o.get("events") or []):
                if not isinstance(ev, dict):
                    continue
                if g == "eraChangeCount":
                    total += 1
                name, raw = ev.get("eraName"), ev.get("eraNameRaw")
                if name is None and raw is None:
                    continue
                where = ev.get("id") or f"{e['id']}.{g}[{i}]"
                # 型で禁じている（eraChangeCountObject を別定義にした）が、
                # 合成レコードでも同じ判定が要るのでここでも見る
                if g != "eraChangeCount":
                    err(f"[era-name] {where}: eraName を持てるのは改元 event だけ")
                    continue
                if name is None:
                    err(f"[era-name] {where}: eraNameRaw だけがあり eraName が無い"
                        f"（底本の字体は新字体の側と対で持つ）")
                    continue
                # A 形
                ok = True
                for label, v in (("eraName", name), ("eraNameRaw", raw)):
                    if v is None:
                        continue
                    if not isinstance(v, str) or not ERA_NAME_RE.match(v):
                        err(f"[era-name] {where}.{label}: 漢字2〜4字でない {str(v)[:40]!r}")
                        ok = ok and label != "eraName"
                        continue
                    bad = [w for w in ERA_NAME_FORBIDDEN
                           if w in v and not (v in ERA_NAME_ALLOW_EXACT and v == w)]
                    if bad:
                        err(f"[era-name] {where}.{label}: 記事の語 {'／'.join(bad)} を含む"
                            f"（元号の名だけを書く）: {v!r}")
                        ok = ok and label != "eraName"
                if not ok:
                    continue
                named += 1
                if not can_norm:
                    continue
                key = norm_for_match(name)
                # B 新字体変換の再演
                if isinstance(raw, str) and ERA_NAME_RE.match(raw) and norm_for_match(raw) != key:
                    err(f"[era-name] {where}: eraName {name!r} と eraNameRaw {raw!r} が"
                        f"別の元号（新字体への書き換えが再演できない）")
                # C 同じ event の中に根拠がある
                hay = [ev.get("note") or "", ev.get("dateRaw") or ""]
                for q in ev.get("quotes") or []:
                    if isinstance(q, dict):
                        hay.append(q.get("text") or "")
                if key not in norm_for_match("　".join(hay)):
                    err(f"[era-name] {where}: eraName {name!r} が同じ event の note・quotes に"
                        f"見当たらない（原典を読んで根拠と一緒に入れる）")
    if not can_norm:
        warn("[era-name] opencc が無いため B（字体の再演）と C（note に根拠がある）を"
             "評価していない。形とラチェットだけが掛かっている")
    info(f"[era-name] 改元 event {total}件のうち eraName を持つのは {named}件"
         f"（基準線 {ERA_NAME_BASELINE}・残りは docs/process/RESIDUAL.md の行）")
    # E ラチェット。**条件は強制していない**（転記は別段）ので、減らないことだけを見る
    if named < ERA_NAME_BASELINE:
        err(f"[era-name] eraName を持つ改元 event が {named}件で基準線 "
            f"{ERA_NAME_BASELINE} を下回った（転記を消した／ERA_NAME_BASELINE を"
            f"下げるなら理由を書く）")
    return total, named


# --- 民族名（Issue #37 単位3・2026-08-03 新設）--------------------------------
# 主張は「**この人物の name.ethnicName.value は kind の言語・民族の名である**」。
#
# 移行前は「漢字名（民族名）」の1文字列に畳んであり、**括弧の並びが政権ごとに逆**
# （遼＝契丹名（漢風名）／金＝漢名（女真名）／元＝カナ（漢字音写）／清＝漢字諱（カナ））。
# 分けるだけの作業に見えるが、**括弧ごと消す形の欠落は「分けた」と区別できない**ので、
# 移行前の32件を data/internal/personal-name-originals.json に凍結し、
# kind が決める並び（catalogs.ethnicNameKinds[].order）で組み直して原文字列に戻ることを見る。
#
# 転記と同じく条件は強制しない（32件を1件ずつ原典で確かめる作業なので一度に終わらない）。
# ここが強制するのは形・政権との整合・**組み直し**・括弧の天井だけ。
ETHNIC_ORIGINALS_PATH = ROOT / "data" / "internal" / "personal-name-originals.json"
# 括弧つき personalName の天井。**単位2のラチェットと向きが逆**（あちらは床・こちらは
# 天井）で、移行が進むと減る。**2026-08-03 に32件すべてを分けたので0**。
# この0が、サイト側から括弧を割る経路（display-name.ts の ETHNIC_NAME_LABEL・
# RENAMED_NAME_IDS）を消せる根拠 — 括弧つきのレコードはもう入って来られない。
ETHNIC_PAREN_CEILING = 0
ETHNIC_VALUE_RE = {
    "han": re.compile(r"^[㐀-鿿]{1,12}$"),
    "kana": re.compile(r"^[ァ-ヶー・]{2,20}$"),
}


def check_ethnic_names(data):
    """民族名 name.ethnicName（Issue #37 単位3）。

    A kind の実在   … meta.catalogs.ethnicNameKinds に在る
    B 政権との整合   … その kind を名乗れる政権（カタログの regimes）である。
                      **取り違えを落とす主力**（クビライに「女真名」が生える形）
    C 字種           … kind の script（han＝漢字のみ／kana＝カナのみ）
    F 組み直し       … 凍結標本の原文字列へ戻る（**括弧ごとの欠落を落とす唯一の検査**）
    E 括弧の天井     … personalName に「（」を含むレコードが基準線を超えたら落ちる

    **底本照合はここには無い**（ローカルコーパスが要るため
    verify_quotes.py --check-ethnic-names に置いた＝ゲートD）。
    """
    kinds = {}
    for k in (data.get("meta", {}).get("catalogs", {}) or {}).get("ethnicNameKinds") or []:
        if isinstance(k, dict) and k.get("id"):
            kinds[k["id"]] = k
    try:
        originals = json.loads(ETHNIC_ORIGINALS_PATH.read_text(encoding="utf-8"))["records"]
    except (OSError, KeyError, ValueError):
        originals = {}
        warn("[ethnic-name] data/internal/personal-name-originals.json が読めないため"
             "組み直し（F）を評価していない")

    named = paren = 0
    for e in data["emperors"]:
        name = e.get("name") or {}
        personal = name.get("personalName") or ""
        if "（" in personal:
            paren += 1
        en = name.get("ethnicName")
        orig = (originals.get(e["id"]) or {}).get("personalName")
        if en is None:
            # 凍結標本の id から括弧が消えたのに民族名も別名も無い＝**値を捨てた形**。
            # 天井だけだと「（阿骨打）を消す」で満たせてしまうので対で見る。
            # **ただしこの対は既存の aliases でも満たせる**（移行前から別名を持つ人物が
            # いる）ので、値が保たれたことの証人は下の F だけ
            if orig and "（" not in personal and not (name.get("aliases") or []):
                err(f"[ethnic-name] {e['id']}: personalName から括弧が消えたのに"
                    f"ethnicName も aliases も無い（{orig!r} の民族名・別名の行き先が無い）")
            continue
        if not isinstance(en, dict):
            err(f"[ethnic-name] {e['id']}: ethnicName が object でない")
            continue
        kind, value = en.get("kind"), en.get("value")
        if not isinstance(value, str) or not value.strip():
            err(f"[ethnic-name] {e['id']}: ethnicName.value が空")
            continue
        named += 1
        # A
        if kind not in kinds:
            err(f"[ethnic-name] {e['id']}: kind {kind!r} が"
                f"meta.catalogs.ethnicNameKinds に無い")
            continue
        spec = kinds[kind]
        # B **取り違えの主力**
        if e.get("regimeId") not in (spec.get("regimes") or []):
            err(f"[ethnic-name] {e['id']}: 政権 {e.get('regimeId')!r} は kind {kind!r}"
                f"（{spec.get('label')}）を名乗れない"
                f"（名乗れるのは {'／'.join(spec.get('regimes') or [])}）")
        # C 字種
        rx = ETHNIC_VALUE_RE.get(spec.get("script"))
        if rx is None:
            err(f"[ethnic-name] {e['id']}: kind {kind!r} の script が不正 "
                f"{spec.get('script')!r}")
        elif not rx.match(value):
            err(f"[ethnic-name] {e['id']}: ethnicName.value {value!r} が "
                f"{spec.get('script')}（{spec.get('label')}）の字種でない")
        if "（" in personal:
            err(f"[ethnic-name] {e['id']}: ethnicName を分けたのに personalName に"
                f"括弧が残っている {personal!r}")
        # F 組み直し。移行が値を作り替えていないことの証人
        if orig:
            order = spec.get("order")
            rebuilt = (f"{value}（{personal}）" if order == "ethnic-first"
                       else f"{personal}（{value}）")
            if rebuilt != orig:
                err(f"[ethnic-name] {e['id']}: 組み直すと {rebuilt!r} で、移行前の"
                    f"{orig!r} に戻らない（分ける以外のことをしている）")
    info(f"[ethnic-name] ethnicName を持つ人物 {named}人"
         f"／personalName に括弧が残るのは {paren}人（天井 {ETHNIC_PAREN_CEILING}・"
         f"移行の残りは docs/process/RESIDUAL.md の行）")
    # E 天井
    if paren > ETHNIC_PAREN_CEILING:
        err(f"[ethnic-name] personalName に括弧を含む人物が {paren}人で天井 "
            f"{ETHNIC_PAREN_CEILING} を超えた（民族名は ethnicName へ分ける）")
    return named, paren


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


def check_conflicts(data):
    """史料対立の構造フィールド `conflicts` の形を見る（Issue #51 P3）。

    **「対立を書け」というゲートではない。** 書かれていないことが「気づかなかった」なのか
    「対立が無い」なのかは機械では決まらないので、検査するのは書かれたものの形だけ。
    `conflicts: []` は「確認して対立なし」・キー自体が無いのは「未確認」で、この2つが
    区別できることが P3 の値打ちそのもの（Issue #43 の「測れない」と「書き忘れた」を
    区別する形で null を置く）。

    `conflicts: []` を「確定」と読まないこと（`coverage.py` は conflicts を見ない）。
    """
    seen = with_items = 0

    def walk(node, path, eid):
        nonlocal seen, with_items
        if isinstance(node, dict):
            if "conflicts" in node:
                seen += 1
                if check_one(node, path, eid):
                    with_items += 1
            for k, v in node.items():
                walk(v, f"{path}.{k}" if path else k, eid)
        elif isinstance(node, list):
            for i, v in enumerate(node):
                walk(v, f"{path}[{i}]", eid)

    def check_one(node, path, eid) -> bool:
        conflicts = node["conflicts"]
        label = f"{eid}.{path}.conflicts" if path else f"{eid}.conflicts"
        if not isinstance(conflicts, list):
            err(f"[conflicts] {label}: 配列でない: {type(conflicts).__name__}"
                "（対立が無いと確認したなら [] を置く）")
            return False
        for i, c in enumerate(conflicts):
            at = f"{label}[{i}]"
            if not isinstance(c, dict):
                err(f"[conflicts] {at}: object でない")
                continue
            field = c.get("field")
            if not isinstance(field, str) or field not in node:
                err(f"[conflicts] {at}: field={field!r} が同じコンテナに実在しません"
                    f"（隣: {'・'.join(k for k in node if k != 'conflicts') or '（空）'}）")
            reason = c.get("reason")
            if not isinstance(reason, str) or not reason.strip():
                err(f"[conflicts] {at}: reason が非空文字列でない。"
                    "**なぜその値を採ったか**が無いと、対立を書いた意味がありません")
            adopted = c.get("adopted")
            if not isinstance(adopted, dict) or "value" not in adopted:
                err(f"[conflicts] {at}.adopted: value を持つ object でない"
                    "（採用側にも出典が要る — 片側だけだと採用と未記入が区別できません）")
            else:
                if not isinstance(adopted.get("source"), dict):
                    err(f"[conflicts] {at}.adopted: source が object でない")
                if isinstance(field, str) and field in node and node[field] != adopted["value"]:
                    err(f"[conflicts] {at}.adopted.value={adopted['value']!r} が "
                        f"{field}={node[field]!r} と食い違います"
                        "（採用値を訂正したときに conflicts が置き去りになった形）")
            alts = c.get("alternatives")
            if not isinstance(alts, list) or not alts:
                err(f"[conflicts] {at}.alternatives: 非空の配列でない"
                    "（対立値が無いなら conflicts の要素を作らない。"
                    "「確認して対立なし」は conflicts: [] で表します）")
                continue
            for j, a in enumerate(alts):
                if not isinstance(a, dict) or "value" not in a:
                    err(f"[conflicts] {at}.alternatives[{j}]: value を持つ object でない")
                    continue
                if not isinstance(a.get("source"), dict):
                    err(f"[conflicts] {at}.alternatives[{j}]: source が object でない"
                        "（どの書がそう言っているかが対立の実体です）")
                if isinstance(adopted, dict) and a["value"] == adopted.get("value"):
                    err(f"[conflicts] {at}.alternatives[{j}]: 採用値と同じ値 {a['value']!r} "
                        "が対立値に入っています")
        return bool(conflicts)

    for e in data["emperors"]:
        walk(e, "", e["id"])
    info(f"[conflicts] conflicts を持つコンテナ {seen} 件を評価（うち対立あり {with_items} 件）。"
         "欄は任意・既存 note に遡及しないため0件でも異常ではない")


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
# conflicts は note・claim と同じ位置に置ける史料対立の置き場（Issue #51 P3）。
# 続柄（relationToPredecessor）のように **軸の中にしか実フィールドが無い**対立があり、
# check_conflicts は field が同じコンテナに実在することを要求するので axes 内に置けないと
# 書く場所が無くなる（Issue #53 の曹髦）。中身の検査は check_conflicts が行う。
AXES_OPTIONAL = {"decidedByAgents", "conflicts"}


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


EVENT_ID = re.compile(r"^(?P<emperor>[a-z0-9-]+)\.(?P<group>[A-Za-z]+Count)\.e(?P<n>\d{3,})$")
# 外部から event を指す参照（`<event id>` か `<event id>.<日付キー>`）
EVENT_REF_TAIL = ("date", "startDate", "endDate")


def check_event_ids(data):
    """events[].id が「配布物の中の安定した宛先」として使えることを検査する（Issue #69）。

    id は 2026-08-03 に一度だけ焼いたもので、**添字から作り直してはいけない**。
    焼いた直後は `eNNN` の連番と添字が1ずれで対応するので、再生成しても全てのテストが
    通ってしまい、**最初の1件を挿入した瞬間に黙って番号が振り直される** — id を置いた
    目的そのものが消える型の失敗になる。だから「形・一意・外部参照が解決する」の3つを見る。

    外部参照は `data/screenings.json` の `audit.findings[].id`。ここが解決することが
    「id が参照の宛先として機能している」ことの実際の証拠で、これを見ないなら
    id は増えただけの欄になる（規則案 R-CLAIM-GATED）。
    """
    seen: dict[str, str] = {}
    missing = []
    for e in data["emperors"]:
        for g in COUNT_GROUPS:
            o = e.get(g)
            if not isinstance(o, dict):
                continue
            for i, ev in enumerate(o.get("events") or []):
                if not isinstance(ev, dict):
                    continue
                where = f"{e['id']}.{g}[{i}]"
                eid = ev.get("id")
                if not eid:
                    missing.append(where)
                    continue
                m = EVENT_ID.match(eid)
                if not m:
                    err(f"[event-id] {where}: id の形が違います: {eid!r}"
                        f"（<皇帝id>.<容器>.eNNN）")
                elif m.group("emperor") != e["id"] or m.group("group") != g:
                    err(f"[event-id] {where}: id が所在と食い違います: {eid!r}")
                if eid in seen:
                    err(f"[event-id] id が重複しています: {eid!r}"
                        f"（{seen[eid]} と {where}）")
                else:
                    seen[eid] = where
    if missing:
        err(f"[event-id] id の無い event が {len(missing)}件（新しく足した event には "
            f"`python3 scripts/migrations/bake_event_ids.py --fill` で振る）: "
            f"{missing[:5]}{' …' if len(missing) > 5 else ''}")

    # 外部参照が1つの event に解決するか
    path = ROOT / "data" / "screenings.json"
    if not path.exists():
        return
    refs = []

    def collect(node):
        if isinstance(node, dict):
            for k, v in node.items():
                if k == "findings" and isinstance(v, list):
                    refs.extend(f.get("id") for f in v if isinstance(f, dict))
                else:
                    collect(v)
        elif isinstance(node, list):
            for v in node:
                collect(v)

    collect(json.loads(path.read_text(encoding="utf-8")))
    emperor_ids = {e["id"] for e in data["emperors"]}
    for ref in refs:
        if not isinstance(ref, str) or ref in emperor_ids:
            continue    # person-field 単位の絞り込みは event を指していない
        head, _, tail = ref.rpartition(".")
        target = head if tail in EVENT_REF_TAIL else ref
        if target not in seen:
            err(f"[event-id] data/screenings.json の参照が解決しません: {ref!r}"
                f"（指す event が無い。id を振り直したか event を消した）")


def check_event_date_archive(data):
    """退避した月日（data/internal/event-date-archive.json）と配布物の対応（Issue #69）。

    アーカイブは**配布しない・ゲートで中身を検査しない・追記しない**置き場だが、
    「配布物の値を丸めた結果である」という関係だけは機械で確かめる。見るのは2つ:

      1. 鍵が実在の event を指すか（id を振り直したり event を消したりすると宙に浮く）
      2. **いま保存されている値が、退避した値の接頭辞になっているか**
         （`"1211"` ← `"1211-05-07"`）。丸めた結果でない値が入っていたら、
         アーカイブと配布物が別の日付を持っていることになる

    2 が成り立たない例: 配布物の日付を後から訂正したのにアーカイブが旧値のまま。
    そのとき「精度を戻す」と誤った月日が復活するので、**戻せることが可逆性の主張**である以上
    ここは検査対象になる（欄を作るならゲートも作る＝ R-CLAIM-GATED）。

    返り値は評価件数（0 件を「綺麗」と読まないため main が必ず出す）。
    """
    if not ARCHIVE_PATH.exists():
        return 0
    doc = json.loads(ARCHIVE_PATH.read_text(encoding="utf-8"))
    entries = doc.get("events") or {}
    index = {}
    for e in data["emperors"]:
        for g in COUNT_GROUPS:
            o = e.get(g)
            if not isinstance(o, dict):
                continue
            for ev in o.get("events") or []:
                if isinstance(ev, dict) and ev.get("id"):
                    index[ev["id"]] = ev
    checked = 0
    for key, saved in sorted(entries.items()):
        ev = index.get(key)
        if ev is None:
            err(f"[event-archive] {key}: 退避した月日の鍵が実在の event を指していません")
            continue
        for k in ("date", "startDate", "endDate"):
            old = saved.get(k)
            if not isinstance(old, str):
                continue
            checked += 1
            now = ev.get(k)
            if not isinstance(now, str):
                err(f"[event-archive] {key}.{k}: 退避 {old!r} に対し配布物側の値がありません")
            elif not old.startswith(now):
                err(f"[event-archive] {key}.{k}: 配布物の {now!r} が退避した {old!r} の"
                    f"接頭辞になっていません（丸めた結果ではない＝どちらかが後から動いた）")
            elif depth_of(now) >= depth_of(old):
                err(f"[event-archive] {key}.{k}: 退避 {old!r} が配布物の {now!r} より"
                    f"細かくありません（退避する必要が無かった値）")
    return checked


def check_event_date_claim_residual(data):
    """月日を主張する event のうち、原表記と換算を持つものの割合（Issue #69 の有界な残量）。

    **エラーにしない。** 移行直後は 1,173件すべてが未充足で、error にすると CI が
    真っ赤になるだけで何も測れない。ここは弱いゲートではなく**残量の計器**で、
    `docs/process/RESIDUAL.md` の行と同じ数字を出すのが役目
    （規則 R-EVENT-DATE-RAW を満たすと `verify_calendar.py` の B-5 が再演できるようになる）。
    """
    claimed = witnessed = 0
    for e in data["emperors"]:
        for g in COUNT_GROUPS:
            o = e.get(g)
            if not isinstance(o, dict):
                continue
            for ev in o.get("events") or []:
                if not isinstance(ev, dict):
                    continue
                if not any(depth_of(ev[k]) > 1 for k in ("date", "startDate", "endDate")
                           if isinstance(ev.get(k), str)):
                    continue
                claimed += 1
                src = ev.get("source")
                if (any(str(k).endswith("Raw") and ev.get(k) for k in ev)
                        and isinstance(src, dict) and src.get("conversion")):
                    witnessed += 1
    return claimed, witnessed


# ---------------------------------------------------------------------------
# 引用の器（Issue #69・計画7節の4）
# ---------------------------------------------------------------------------

VOLUME_INDEX_KINDS = ("daizhige-heading", "china-history-file")
VOLUME_SCOPES = ("all", "benji")

# 床＝集計に効く判定。最終的に「構造化引用 quotes[] を1断片以上持つ」をゲート条件に
# する容器（計画5-3）。**いまは条件を強制していない**（転記が別段のため）。
# ここが数えるのは充足数で、不足は docs/process/RESIDUAL.md の行として持つ。
# 主張する日付 1,173件の witness（*Raw ＋ conversion）は
# check_event_date_claim_residual が別に数えるので、ここには入れない。
FLOOR_UNITS = ("reigns[].duration", "deathCause", "accessionRoute") + tuple(COUNT_GROUPS)

# 床の充足数の基準線（ラチェット）。**下げるのは床の定義を変えるときだけ**で、
# それはユーザー決定が要る。転記を進めたら上げる。
QUOTE_FLOOR_BASELINE = dict({name: 0 for name in FLOOR_UNITS},
                            **{"reigns[].duration": 1})

# 散文寄りの引用（`source.quote` の1本の文字列）は**増やさない**。
# quotes[] へ移したぶんだけこの数を下げる。増える形の変更はここで落ちる。
LEGACY_SOURCE_QUOTE_MAX = 373


# 床の単位になるパス（添字を落とした形）。ここに無いパスも器の検査は受ける。
_FLOOR_BY_PATH = dict({g: g for g in COUNT_GROUPS},
                      **{"reigns[].duration": "reigns[].duration",
                         "deathCause": "deathCause",
                         "accessionRoute": "accessionRoute"})
_INDEX = re.compile(r"\[\d+\]")


def iter_quote_containers(data):
    """`source` か `quotes` を持つ容器を (皇帝id, パス, 容器, 床の名前) で列挙する。

    **置ける場所を列挙せずレコード全体を走査する**（`conflicts` の拾い方と同じ理由）。
    `conflicts` はどのコンテナにも置けるので、パスを数え上げると
    「スキーマは通すのにこの走査からは見えない」場所が残り、そこでは `bookId` が
    カタログの検査を素通りする。**この関数が唯一の入口**で、
    `verify_quotes.py --check-volumes` も同じものを使う。

    床の名前は FLOOR_UNITS のどれか。床の外（events の各要素・conflicts の中など）は None。
    """
    for e in data["emperors"]:
        eid = e["id"]

        def walk(node, path):
            if isinstance(node, dict):
                if isinstance(node.get("source"), dict) or "quotes" in node:
                    yield eid, path, node, _FLOOR_BY_PATH.get(_INDEX.sub("[]", path))
                for k, v in node.items():
                    yield from walk(v, f"{path}.{k}" if path else k)
            elif isinstance(node, list):
                for i, v in enumerate(node):
                    yield from walk(v, f"{path}[{i}]")

        yield from walk(e, "")


def iter_floor_units(data):
    """床の単位を (皇帝id, パス, 容器, 床の名前) で列挙する。

    **`source` も `quotes` も持たない容器も数える。** 床は「これから引用を持つべき器」の
    母集団なので、いま何も持っていない容器こそが残量そのもの
    （`iter_quote_containers` は持っているものしか通らないので分けてある）。
    """
    for e in data["emperors"]:
        eid = e["id"]
        for i, r in enumerate(e.get("reigns") or []):
            if isinstance(r.get("duration"), dict):
                yield eid, f"reigns[{i}].duration", r["duration"], "reigns[].duration"
        for name in ("deathCause", "accessionRoute", *COUNT_GROUPS):
            o = e.get(name)
            if isinstance(o, dict):
                yield eid, name, o, name


def check_quote_containers(data):
    """書カタログと構造化引用の器を検査する（Issue #69・計画7節の4）。

    ここは**コーパスを必要としない側**だけを見る（CI にコーパスは無い）。
    `(bookId, volume)` が実在の巻を指すか・引用がその巻の中に在るかは
    `verify_quotes.py --check-volumes`（ローカル専用）が見る。

    戻り値は (床の充足数, 散文寄り source.quote の件数)。
    """
    books = (data["meta"].get("catalogs") or {}).get("books")
    if books is None:
        err("[books] meta.catalogs.books が無い（scripts/build_books_catalog.py で作る）")
        return {}, 0, 0

    ids = [b.get("id") for b in books]
    dup = sorted({i for i in ids if ids.count(i) > 1})
    if dup:
        err(f"[books] カタログの id が重複: {dup}")
    catalog = {}
    for b in books:
        bid = b.get("id")
        if not isinstance(bid, str) or not bid:
            err(f"[books] id が文字列でない: {b!r}")
            continue
        catalog[bid] = b
        kind = b.get("volumeIndex")
        if kind is not None and kind not in VOLUME_INDEX_KINDS:
            err(f"[books] {bid}: volumeIndex が不正: {kind!r}"
                f"（{VOLUME_INDEX_KINDS} か null）")
        has_detail = any(k in b for k in
                         ("volumePath", "volumeScope", "corpusVolumeMax", "corpusVolumeCount"))
        if kind is None and has_detail:
            err(f"[books] {bid}: volumeIndex が null なのに巻の索引の詳細が在る")
        if kind is not None:
            if b.get("volumeScope") not in VOLUME_SCOPES:
                err(f"[books] {bid}: volumeScope が不正: {b.get('volumeScope')!r}")
            for k in ("volumePath", "corpusVolumeMax", "corpusVolumeCount"):
                if not b.get(k):
                    err(f"[books] {bid}: volumeIndex が在るのに {k} が無い")

    floor = {name: 0 for name in FLOOR_UNITS}
    floor_total = 0
    for _eid, _path, unit, name in iter_floor_units(data):
        floor_total += 1
        if unit.get("quotes"):
            floor[name] += 1

    legacy = 0
    for eid, path, unit, _floor_name in iter_quote_containers(data):
        where = f"{eid}.{path}"
        src = unit.get("source")
        if isinstance(src, dict):
            if src.get("quote"):
                legacy += 1
            _check_book_ref(where + ".source", src, catalog)
        quotes = unit.get("quotes")
        if quotes is not None:
            if not isinstance(quotes, list) or not quotes:
                err(f"[quotes] {where}: quotes は1件以上の配列（空なら欄を置かない）")
                continue
            if isinstance(src, dict) and src.get("quote"):
                err(f"[quotes] {where}: source.quote と quotes[] が同居している。"
                    f"引用の在りかを2つ持たない（移したら source.quote を消す）")
            for i, q in enumerate(quotes):
                if not isinstance(q, dict):
                    err(f"[quotes] {where}.quotes[{i}]: オブジェクトでない")
                    continue
                if not isinstance(q.get("text"), str) or not q["text"].strip():
                    err(f"[quotes] {where}.quotes[{i}]: text が空")
                if not q.get("bookId"):
                    err(f"[quotes] {where}.quotes[{i}]: bookId が無い"
                        f"（どの書に在ると主張するのかを書く）")
                _check_book_ref(f"{where}.quotes[{i}]", q, catalog)

    for name, n in sorted(floor.items()):
        base = QUOTE_FLOOR_BASELINE.get(name, 0)
        if n < base:
            err(f"[quote-floor] {name}: 構造化引用を持つ容器が {n}件で、"
                f"基準線 {base}件を下回った（床は減らさない・Issue #69）")
    if legacy > LEGACY_SOURCE_QUOTE_MAX:
        err(f"[quotes] source.quote（引用の在りかが散文寄りの旧い器）が {legacy}件で、"
            f"上限 {LEGACY_SOURCE_QUOTE_MAX}件を超えた。新しい引用は quotes[] へ書く")
    return floor, legacy, floor_total


def _check_book_ref(where, obj, catalog):
    """`bookId` と `volume` の対がカタログと整合するか（コーパスは見ない）。"""
    bid = obj.get("bookId")
    if bid is not None:
        if not isinstance(bid, str) or bid not in catalog:
            err(f"[books] {where}: bookId が meta.catalogs.books にない: {bid!r}")
            return
    vol = obj.get("volume")
    if vol is None:
        return
    if bid is None:
        err(f"[books] {where}: volume だけ在って bookId が無い（どの書の巻か決まらない）")
        return
    if not isinstance(vol, int) or isinstance(vol, bool) or vol < 1:
        err(f"[books] {where}: volume は1以上の整数: {vol!r}")
        return
    book = catalog.get(bid) or {}
    if book.get("volumeIndex") is None:
        err(f"[books] {where}: {bid} はコーパスに巻の索引が無いので volume を主張できない"
            f"（巻番号を機械で確かめられない・Issue #69）")


def main() -> int:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))

    check_schema(data, schema)
    check_catalogs(data)
    check_record_catalog_refs(data)
    check_ids(data)
    check_event_ids(data)
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
    unsurveyed_n = check_dynasty_order(data)
    check_reign_summary(data)
    check_confidence(data)
    death_event_n = check_death_event_date(data)
    check_event_date_format(data)
    era_total_n, era_named_n = check_era_names(data)
    ethnic_n, ethnic_paren_n = check_ethnic_names(data)
    archive_n = check_event_date_archive(data)
    claimed_n, witnessed_n = check_event_date_claim_residual(data)
    floor, legacy_quote_n, floor_total_n = check_quote_containers(data)
    check_forbidden_sources(data)
    check_claim_fields(data)
    check_conflicts(data)
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
          f"／death-event-date の評価件数 {death_event_n}"
          f"／第N代が未調査の在位 {unsurveyed_n}件（欄なし）"
          f"／退避した月日 {archive_n}値を配布物と照合"
          f"／月日を主張する event {claimed_n}件のうち *Raw＋conversion を持つのは "
          f"{witnessed_n}件"
          f"／改元 event {era_total_n}件のうち eraName を持つのは {era_named_n}件"
          f"／ethnicName {ethnic_n}人・括弧が残る personalName {ethnic_paren_n}人"
          f"／構造化引用を持つ床の容器 {sum(floor.values())}/{floor_total_n}件"
          f"（旧い器 source.quote は {legacy_quote_n}件）)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
