"""data/kinship.json（系譜・即位経路グラフ）の恒久 QA チェック（task.md 6-3・GitHub Actions CI 用）。

使い方: python3 scripts/validate_kinship.py
終了コード: 0=合格（警告のみ含む） / 1=エラーあり

スキーマ・収録基準は data/schema/KINSHIP_SCHEMA.md を参照。

チェック内容（エラー＝CI 失敗）:
  - persons: id 一意・`p-` プレフィックス＋kebab-case・emperors.json の id と非衝突・
    enum（kind/gender/inclusionReason）・kana 必須（ひらがな）・
    researchSection 必須（emperors.json の researchSection 語彙集合に所属）・eraId 必須・source 必須・
    birthYear/deathYear の型と前後関係・yearsApproximate は bool
  - edges: from/to が実在ノード（皇帝 id または persons）・自己ループなし・
    enum（type/relation/categoryId/relationToPredecessor/veracity/confidence・すべて ID）・source 必須・
    重複エッジなし（marriage/兄弟姉妹は無向正規化して判定）
  - succession: to は皇帝・relationToPredecessor 必須（「その他」は note 必須）・
    主エッジ（isRestoration=false・veracity≠disputed）は皇帝ごとに最大1本
    （disputed は対立説の併記として複数可）・
    非 disputed 主エッジの categoryId が emperors.json の accessionRoute.categoryId と整合
    （復位は 2026-07-26 の多軸化で category から消え reigns[].isRestoration に一本化された。
    主エッジ categoryId=初回即位の経路、復位は categoryId="restoration" の isRestoration エッジで持つ）
  - kinship: 実父/養父の from は male・実母/養母の from は female（gender 判明時のみ）・
    verified の実父エッジ・実母エッジはそれぞれ子ごとに最大1本・親子エッジ（実父/実母/養父/養母）の循環なし・
    childOrder は 1 以上の整数・primaryLineage:true は子ごとに最大1本
  - 続柄の実体整合（Issue #40 G3）: relationToPredecessor（子・養子・孫・兄弟・甥）が
    名指す相手が、血縁エッジから導ける親・祖父母・兄弟・オジに実在する
  - グラフ内部整合（Issue #40 G4）: 親子・兄弟エッジから割り当てた相対世代の無矛盾・
    succession の relationToPredecessor が主張する世代差と血縁エッジの一致・
    実親と子の生年差（12〜70年）と「親の没後に生まれた子」・養親が子より年下・
    復位でない継承エッジの双方向重複
  - 孤立ブリッジ（どのエッジからも参照されない persons）なし
  - genealogicalClaims: claimant の実在・source 必須
  - 出典禁止語（detect_wikipedia_sources.is_wiki_like を共用。正史書名ホワイトリスト方式の
    ため、Wikipedia 等の禁止出典だけでなく正史書名として認識できない表記不備も検出される）

網羅性チェック（meta.status.phases の該当フェーズが completed のときのみ有効化・エラー）:
  - succession 完了後: 全皇帝が succession エッジを持つ（disputed 主エッジのみ・復位エッジ
    のみでも可）、または accessionRoute=自立/推戴（ROOT_CATEGORIES）、または meta.confirmedRootless
    （原典確認済みの並立根・傀儡根リスト。id 実在・reason 必須・陳腐化は常時検証）に記載
  - parentage 完了後: 実父/養父エッジを持たず meta.confirmedFatherUnknown にも未登録の
    皇帝をエラーで列挙（confirmedFatherUnknown の構造検証は常時。「調査済みだが不明」の確定は
    ブロック調査ノート側で担保するため、機械判定はエラーにしない）
  - maternalLineage 完了後: 実母/養母エッジを持たず meta.confirmedMotherUnknown にも未登録の
    皇帝をエラーで列挙（confirmedMotherUnknown の構造検証は常時・confirmedFatherUnknown と同型）

警告（CI は通す・出力で可視化）:
  - marriage エッジの from/to が辞書順でない（無向の正規化推奨）
  - 兄弟姉妹エッジの両端に共通の親エッジが既にある（導出可能＝明示エッジ不要の疑い）
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KINSHIP_PATH = ROOT / "data" / "kinship.json"
EMPERORS_PATH = ROOT / "data" / "emperors.json"

sys.path.insert(0, str(ROOT / "scripts"))
from detect_wikipedia_sources import is_wiki_like  # noqa: E402

PERSON_ID_RE = re.compile(r"^p-[a-z0-9]+(-[a-z0-9]+)*$")

# v3: 値はすべて ID（日本語ラベルは emperors.json の meta.catalogs.enums 側）
KIND_ENUM = {"posthumous-emperor", "imperial-clan", "consort-kin", "consort-princess", "other"}
GENDER_ENUM = {"male", "female"}
INCLUSION_ENUM = {"on-path", "first-degree", "posthumous-emperor", "marriage-party",
                  "coup-party", "ruler"}
EDGE_TYPE_ENUM = {"succession", "kinship", "marriage"}
RELATION_ENUM = {"birth-father", "birth-mother", "adoptive-father", "adoptive-mother",
                 "sibling", "remote-ancestor"}
# remote-ancestor エッジの任意フィールド relationDetail（祖先方向の続柄）
RELATION_DETAIL_ENUM = {"grandfather", "great-grandfather"}
PARENT_RELATIONS = {"birth-father", "birth-mother", "adoptive-father", "adoptive-mother"}
MALE_RELATIONS = {"birth-father", "adoptive-father"}
FEMALE_RELATIONS = {"birth-mother", "adoptive-mother"}
# 旧 enum 9値と、多軸化（2026-07-26・ADDITIONAL_SCHEMA.md 1節）で導出される新ラベルが移行完了まで併存する
# 2026-07-26 の多軸化完了で、emperors.json 側の旧 enum（禅譲・建国・不詳・諸説あり）は消滅した。
# 「restoration（復位）」は isRestoration=true の復位エッジ専用の値として kinship 側にのみ残る
# （emperors.accessionRoute.categoryId には現れない）。
CATEGORY_ENUM = {
    "hereditary", "enthroned", "usurpation", "inner-abdication", "succession-unspecified",
    "abdication-received", "self-established", "acclamation", "restoration",
}
REL_TO_PRED_ENUM = {
    "son", "adopted-son", "grandson", "great-grandson", "younger-brother", "elder-brother",
    "nephew", "niece", "uncle-younger", "uncle-elder", "cousin", "distant-kin",
    "father", "mother", "grandfather", "maternal-grandfather", "son-in-law", "father-in-law",
    "affinal-kin", "unrelated", "unknown", "other",
}
KANA_RE = re.compile(r"^[ぁ-ゖー]+$")
# 主エッジ不在を許容する accessionRoute（新ラベルの 自立／推戴 は旧 建国 に対応）
# 前代君主から位を受けていない＝succession エッジを持たなくてよいラベル。
ROOT_CATEGORIES = {"self-established", "acclamation"}
VERACITY_ENUM = {"verified", "claimed", "disputed"}
CONFIDENCE_ENUM = {"high", "medium", "low"}

errors: list[str] = []
warnings: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def warn(msg: str) -> None:
    warnings.append(msg)


def check_source(owner: str, source, required: bool = True) -> None:
    if source is None:
        if required:
            err(f"[source] {owner}: source がない")
        return
    if not isinstance(source, dict):
        err(f"[source] {owner}: source が object でない: {type(source).__name__}")
        return
    if not source.get("page"):
        err(f"[source] {owner}: source.page が空")
    if is_wiki_like(source):
        err(f"[source] {owner}: 出典が正史書名等として認識できない"
            f"（Wikipedia 等の禁止出典または表記不備）: {source.get('page')!r}")


def check_persons(persons, emperor_ids, sections, era_ids=frozenset()) -> dict[str, str]:
    """persons を検証し {id: gender} を返す（gender はエッジ側の整合チェックに使う）。"""
    seen: dict[str, str] = {}
    for p in persons:
        pid = p.get("id")
        label = f"persons[{pid}]"
        if not isinstance(pid, str) or not PERSON_ID_RE.match(pid):
            err(f"[persons] id が p- プレフィックスの kebab-case でない: {pid!r}")
            continue
        if pid in seen:
            err(f"[persons] id 重複: {pid}")
        seen[pid] = p.get("gender")
        if pid in emperor_ids:
            err(f"[persons] id が emperors.json と衝突: {pid}")
        if not p.get("name"):
            err(f"[persons] {label}: name が空")
        kana = p.get("kana")
        if not isinstance(kana, str) or not KANA_RE.match(kana):
            err(f"[persons] {label}: kana がひらがなでない/空: {kana!r}")
        if p.get("researchSection") not in sections:
            err(f"[persons] {label}: researchSection が emperors.json の "
                f"researchSection 語彙にない: {p.get('researchSection')!r}")
        if p.get("eraId") not in era_ids:
            err(f"[persons] {label}: eraId が emperors.json の catalogs.eras にない: "
                f"{p.get('eraId')!r}")
        ya = p.get("yearsApproximate")
        if ya is not None and not isinstance(ya, bool):
            err(f"[persons] {label}: yearsApproximate が bool でない: {ya!r}")
        if p.get("kind") not in KIND_ENUM:
            err(f"[persons] {label}: kind が不正: {p.get('kind')!r}")
        if p.get("gender") not in GENDER_ENUM:
            err(f"[persons] {label}: gender が不正: {p.get('gender')!r}")
        reasons = p.get("inclusionReason")
        if not isinstance(reasons, list) or not reasons or not set(reasons) <= INCLUSION_ENUM:
            err(f"[persons] {label}: inclusionReason が不正: {reasons!r}")
        for k in ("birthYear", "deathYear"):
            v = p.get(k)
            if v is not None and not isinstance(v, int):
                err(f"[persons] {label}: {k} が int/null でない: {v!r}")
        by, dy = p.get("birthYear"), p.get("deathYear")
        if isinstance(by, int) and isinstance(dy, int) and by > dy:
            err(f"[persons] {label}: birthYear > deathYear ({by} > {dy})")
        check_source(label, p.get("source"))
    return seen


def check_edges(edges, emperor_ids, gender_by_person, accession_by_id,
                restoration_reigns_by_id):
    person_ids = set(gender_by_person)
    node_ids = emperor_ids | person_ids
    dedup = Counter()
    primary_by_emperor = Counter()
    restoration_by_emperor = Counter()
    succession_covered: set[str] = set()  # succession エッジ（disputed・復位含む）を持つ皇帝
    verified_father_by_child = Counter()
    verified_mother_by_child = Counter()
    primary_lineage_by_child = Counter()
    parent_edges: list[tuple[str, str]] = []  # (親, 子)
    father_covered: set[str] = set()  # 実父/養父エッジを持つ子（parentage 網羅性チェック用）
    mother_covered: set[str] = set()  # 実母/養母エッジを持つ子（maternalLineage 網羅性チェック用）
    referenced: set[str] = set()

    for i, e in enumerate(edges):
        et = e.get("type")
        f, t = e.get("from"), e.get("to")
        label = f"edges[{i}]({et} {f}->{t})"
        if et not in EDGE_TYPE_ENUM:
            err(f"[edges] {label}: type が不正: {et!r}")
            continue
        # 先代不在型復位（KINSHIP_SCHEMA.md: 復位時に皇位を得た相手が存在しない場合。
        # 例: 宣統帝の張勲復辟1917・満洲国1934）は復位エッジに限り from=null を許容する
        rootless_restoration = (
            et == "succession" and f is None and e.get("isRestoration") is True)
        bad_endpoint = False
        for end, v in (("from", f), ("to", t)):
            if v not in node_ids and not (end == "from" and rootless_restoration):
                err(f"[edges] {label}: {end} が実在ノードでない: {v!r}")
                bad_endpoint = True
        if bad_endpoint:
            continue
        referenced.update(v for v in (f, t) if v is not None)
        if f == t:
            err(f"[edges] {label}: 自己ループ")
        if e.get("veracity") not in VERACITY_ENUM:
            err(f"[edges] {label}: veracity が不正: {e.get('veracity')!r}")
        if e.get("confidence") not in CONFIDENCE_ENUM:
            err(f"[edges] {label}: confidence が不正: {e.get('confidence')!r}")
        check_source(label, e.get("source"))

        if et == "succession":
            if t not in emperor_ids:
                err(f"[edges] {label}: succession の to が皇帝でない")
            else:
                succession_covered.add(t)
            cat = e.get("categoryId")
            if cat not in CATEGORY_ENUM:
                err(f"[edges] {label}: categoryId が不正: {cat!r}")
            rel = e.get("relationToPredecessor")
            if rel not in REL_TO_PRED_ENUM:
                err(f"[edges] {label}: relationToPredecessor が不正: {rel!r}")
            elif rel == "other" and not e.get("note"):
                err(f"[edges] {label}: relationToPredecessor=other（その他）は note 必須")
            is_rest = e.get("isRestoration")
            disputed = e.get("veracity") == "disputed"
            if not isinstance(is_rest, bool):
                err(f"[edges] {label}: isRestoration が bool でない: {is_rest!r}")
            elif not is_rest:
                if not disputed:
                    primary_by_emperor[t] += 1
                    route = accession_by_id.get(t)
                    if route == "restoration":
                        if cat == "restoration":
                            err(f"[edges] {label}: 復位皇帝の主エッジ categoryId は初回即位の経路"
                                "（復位は isRestoration:true の別エッジ）")
                    elif cat != route:
                        err(f"[edges] {label}: categoryId={cat!r} が "
                            f"accessionRoute.categoryId={route!r} と不一致")
            else:
                if cat != "restoration":
                    err(f"[edges] {label}: isRestoration:true なのに categoryId={cat!r}")
                restoration_by_emperor[t] += 1
            key = ("succession", f, t, e.get("isRestoration"), disputed)
            if rootless_restoration:
                # 先代不在型復位は from で区別できないため重複判定から除外する
                # （本数は下の「復位在位数を超えない」チェックで上限を検査する）
                key += (i,)
            dedup[key] += 1

        elif et == "kinship":
            rel = e.get("relation")
            if rel not in RELATION_ENUM:
                err(f"[edges] {label}: relation が不正: {rel!r}")
            detail = e.get("relationDetail")
            if detail is not None and detail not in RELATION_DETAIL_ENUM:
                err(f"[edges] {label}: relationDetail が不正: {detail!r}")
                continue
            if rel in PARENT_RELATIONS:
                # 親側の gender 整合（from がブリッジ人物で gender 判明時のみ。
                # 皇帝は gender フィールドを持たず、武則天のような女性皇帝の
                # 実母エッジが正当にあり得るため皇帝ノードには適用しない）
                g = gender_by_person.get(f)
                if rel in MALE_RELATIONS and g == "female":
                    err(f"[edges] {label}: relation={rel} だが from の gender が female")
                if rel in FEMALE_RELATIONS and g == "male":
                    err(f"[edges] {label}: relation={rel} だが from の gender が male")
                co = e.get("childOrder")
                if co is not None and (not isinstance(co, int) or co < 1):
                    err(f"[edges] {label}: childOrder が1以上の整数でない: {co!r}")
                pl = e.get("primaryLineage")
                if pl is not None and not isinstance(pl, bool):
                    err(f"[edges] {label}: primaryLineage が bool でない: {pl!r}")
                if pl:
                    primary_lineage_by_child[t] += 1
                parent_edges.append((f, t))
                if rel in MALE_RELATIONS:
                    father_covered.add(t)
                if rel in FEMALE_RELATIONS:
                    mother_covered.add(t)
                if rel == "birth-father" and e.get("veracity") == "verified":
                    verified_father_by_child[t] += 1
                if rel == "birth-mother" and e.get("veracity") == "verified":
                    verified_mother_by_child[t] += 1
                dedup[("kinship", rel, f, t)] += 1
            else:  # 兄弟姉妹は無向
                dedup[("kinship", rel) + tuple(sorted((f, t)))] += 1

        elif et == "marriage":
            if f > t:
                warn(f"[edges] {label}: marriage は from/to を辞書順で持つことを推奨")
            dedup[("marriage",) + tuple(sorted((f, t)))] += 1

    for key, c in dedup.items():
        if c > 1:
            err(f"[edges] 重複エッジ ×{c}: {key}")
    for t, c in primary_by_emperor.items():
        if c > 1:
            err(f"[edges] 主継承エッジ（isRestoration:false）が複数 ×{c}: {t}")
    for t, c in restoration_by_emperor.items():
        allowed = restoration_reigns_by_id.get(t, 0)
        if c > allowed:
            err(f"[edges] 復位エッジ {c}本が emperors.json の復位在位数 {allowed} を超える: {t}")
    for t, c in verified_father_by_child.items():
        if c > 1:
            err(f"[edges] verified の実父エッジが複数 ×{c}: {t}")
    # 実母版（2026-07-24 生母フェーズで追加）。別 id の同一人物を後続ブロックが
    # 重複ノード化した場合の自動バックストップ（disputed の併記は許容）
    for t, c in verified_mother_by_child.items():
        if c > 1:
            err(f"[edges] verified の実母エッジが複数 ×{c}: {t}")
    for t, c in primary_lineage_by_child.items():
        if c > 1:
            err(f"[edges] primaryLineage:true の親エッジが複数 ×{c}: {t}")

    # 親子エッジの循環検出（実父/実母/養父/養母を親→子の有向グラフとして DFS）
    children: dict[str, list[str]] = {}
    for parent, child in parent_edges:
        children.setdefault(parent, []).append(child)
    WHITE, GRAY, BLACK = 0, 1, 2
    color: dict[str, int] = {}

    def dfs(node: str, path: list[str]) -> None:
        color[node] = GRAY
        for nxt in children.get(node, []):
            if color.get(nxt, WHITE) == GRAY:
                err(f"[edges] 親子エッジに循環: {' -> '.join(path + [node, nxt])}")
            elif color.get(nxt, WHITE) == WHITE:
                dfs(nxt, path + [node])
        color[node] = BLACK

    for n in list(children):
        if color.get(n, WHITE) == WHITE:
            dfs(n, [])

    # 兄弟姉妹エッジの導出可能性（両端が共通の親エッジを持つなら明示エッジ不要）
    parents_of: dict[str, set[str]] = {}
    for parent, child in parent_edges:
        parents_of.setdefault(child, set()).add(parent)
    for e in edges:
        if e.get("type") == "kinship" and e.get("relation") == "sibling":
            common = parents_of.get(e.get("from"), set()) & parents_of.get(e.get("to"), set())
            if common:
                warn(f"[edges] 兄弟姉妹エッジ {e.get('from')}<->{e.get('to')} は共通親 "
                     f"{sorted(common)} から導出可能（明示エッジ不要の疑い）")

    return (referenced, primary_by_emperor, succession_covered, parents_of,
            father_covered, mother_covered)


def check_claims(claims, emperor_ids):
    for i, c in enumerate(claims):
        label = f"genealogicalClaims[{i}]({c.get('claimant')})"
        if c.get("claimant") not in emperor_ids:
            err(f"[claims] {label}: claimant が emperors.json に存在しない")
        if not c.get("claimedAncestry"):
            err(f"[claims] {label}: claimedAncestry が空")
        check_source(label, c.get("source"))


def check_coverage(meta, emperors, emperor_ids, succession_covered, parents_of, father_covered,
                   mother_covered):
    phases = meta.get("status", {}).get("phases", {})
    # confirmedRootless（原典確認済みの並立根・傀儡根）の構造検証は常時行う
    confirmed: set[str] = set()
    for i, c in enumerate(meta.get("confirmedRootless", [])):
        cid = c.get("id")
        label = f"confirmedRootless[{i}]({cid})"
        if cid not in emperor_ids:
            err(f"[coverage] {label}: id が emperors.json に存在しない")
            continue
        if not c.get("reason"):
            err(f"[coverage] {label}: reason が空")
        if cid in confirmed:
            err(f"[coverage] {label}: id 重複")
        if cid in succession_covered:
            err(f"[coverage] {label}: succession エッジを持つ皇帝が登録されている"
                "（陳腐化・エントリを削除すること）")
        confirmed.add(cid)
    if phases.get("succession", {}).get("status") == "completed":
        for e in emperors:
            route = e["accessionRoute"]["categoryId"]
            if (e["id"] not in succession_covered and route not in ROOT_CATEGORIES
                    and e["id"] not in confirmed):
                err(f"[coverage] succession 完了済みだが継承エッジがない: "
                    f"{e['id']} (accessionRoute={route})")
    # confirmedFatherUnknown（原典調査済みだが実父・養父を特定できない皇帝の明示リスト。
    # 2026-07-23 ユーザー承認・confirmedRootless と同型）の構造検証は常時行う
    father_unknown: set[str] = set()
    for i, c in enumerate(meta.get("confirmedFatherUnknown", [])):
        cid = c.get("id")
        label = f"confirmedFatherUnknown[{i}]({cid})"
        if cid not in emperor_ids:
            err(f"[coverage] {label}: id が emperors.json に存在しない")
            continue
        if not c.get("reason"):
            err(f"[coverage] {label}: reason が空")
        if cid in father_unknown:
            err(f"[coverage] {label}: id 重複")
        if cid in father_covered:
            err(f"[coverage] {label}: 実父/養父エッジを持つ皇帝が登録されている"
                "（陳腐化・エントリを削除すること）")
        father_unknown.add(cid)
    # TODO(両フェーズ完了時に実装): relationToPredecessor と kinship グラフから導出した
    # 続柄の突合（KINSHIP_SCHEMA.md の網羅性チェック3項目め。succession/parentage の
    # 両方が completed になった時点で追加する。矛盾＝どちらかの調査ミスの機械検出。
    # 進行中のブロック単位スクリーニングは crosscheck_parentage.py が担う）
    if phases.get("parentage", {}).get("status") == "completed":
        for e in emperors:
            if e["id"] not in father_covered and e["id"] not in father_unknown:
                err(f"[coverage] parentage 完了済みだが実父/養父エッジがなく "
                    f"confirmedFatherUnknown にも未登録: {e['id']}")
    # confirmedMotherUnknown（原典調査済みだが実母・養母を特定できない皇帝の明示リスト。
    # 2026-07-24 ユーザー承認・生母全域収録フェーズ maternalLineage 用。confirmedFatherUnknown と同型）
    mother_unknown: set[str] = set()
    for i, c in enumerate(meta.get("confirmedMotherUnknown", [])):
        cid = c.get("id")
        label = f"confirmedMotherUnknown[{i}]({cid})"
        if cid not in emperor_ids:
            err(f"[coverage] {label}: id が emperors.json に存在しない")
            continue
        if not c.get("reason"):
            err(f"[coverage] {label}: reason が空")
        if cid in mother_unknown:
            err(f"[coverage] {label}: id 重複")
        if cid in mother_covered:
            err(f"[coverage] {label}: 実母/養母エッジを持つ皇帝が登録されている"
                "（陳腐化・エントリを削除すること）")
        mother_unknown.add(cid)
    if phases.get("maternalLineage", {}).get("status") == "completed":
        for e in emperors:
            if e["id"] not in mother_covered and e["id"] not in mother_unknown:
                err(f"[coverage] maternalLineage 完了済みだが実母/養母エッジがなく "
                    f"confirmedMotherUnknown にも未登録: {e['id']}")


def check_axes_sync(edges, emperors):
    """emperors.json の accessionRoute.axes.relationToPredecessor と
    kinship.json の主 succession エッジの relationToPredecessor の一致を検査する。

    軸4は kinship.json（Wikidata 突合済み）を正として転記する規約のため、
    片方だけ直すとここで落ちる（ADDITIONAL_SCHEMA.md 1節 軸4）。
    """
    primary_edge = {}
    for e in edges:
        if e.get("type") != "succession" or e.get("isRestoration"):
            continue
        primary_edge.setdefault(e.get("to"), e)
    for e in emperors:
        axes = (e.get("accessionRoute") or {}).get("axes")
        if not axes:
            continue
        ours = axes.get("relationToPredecessor")
        edge = primary_edge.get(e["id"])
        if edge is None:
            if ours != "none":
                err(f"[axes-sync] {e['id']}: succession 主エッジがないのに "
                    f"axes.relationToPredecessor={ours!r}（none〈該当なし〉であるべき）")
            continue
        theirs = edge.get("relationToPredecessor")
        if ours != theirs:
            err(f"[axes-sync] {e['id']}: axes.relationToPredecessor={ours!r} が "
                f"kinship の succession エッジ {theirs!r} と不一致")


# ---------------------------------------------------------------------------
# G4: 系譜グラフの内部整合（Issue #40）
# ---------------------------------------------------------------------------

# relationToPredecessor が主張する世代差（先代を 0 としたときの当人の世代。下が正）。
# 姻族・遠縁・不明（distant-kin / affinal-kin / son-in-law / father-in-law / unrelated /
# unknown / other）は血縁の世代差が定まらないので入れない＝検査対象外。
GENERATION_DELTA = {
    "son": 1, "adopted-son": 1, "grandson": 2, "great-grandson": 3,
    "nephew": 1, "niece": 1,
    "younger-brother": 0, "elder-brother": 0, "cousin": 0,
    "uncle-younger": -1, "uncle-elder": -1,
    "father": -1, "mother": -1, "grandfather": -2, "maternal-grandfather": -2,
}
BIRTH_PARENT_RELATIONS = {"birth-father", "birth-mother"}
# 実父の最小年齢差。北魏文成帝（440年生）と実父・拓跋晃（428年生）の12差が現存最小で、
# これは原典どおり。12を下回る＝入力ミスか人物の取り違えとみなす。
MIN_PARENT_GAP = 12
MAX_PARENT_GAP = 70


def _year(v):
    """ISO 日付・年から西暦年を取り出す（BCE の先頭マイナスを含む）。"""
    if v is None:
        return None
    m = re.match(r"^(-?\d{1,4})", str(v))
    return int(m.group(1)) if m else None


def build_generations(edges):
    """親子・兄弟エッジから相対世代を割り当てる: (世代, 連結成分, 矛盾ペア)。

    養親エッジは「実親エッジを持たない人物」の接続にだけ使う。養子縁組は世代をまたぐ
    ことがあり（石虎は実系では石勒の従子＝石弘と同世代だが、石勒の父・周曷朱の養子でも
    あるため養子系では石弘の一世代上になる。原典も「或称勒弟焉」と両様に記す）、
    実系を優先しないと原典どおりの続柄が矛盾に見える。
    """
    has_birth = {e.get("to") for e in edges
                 if e.get("type") == "kinship" and e.get("relation") in BIRTH_PARENT_RELATIONS}
    adj: dict[str, list[tuple[str, int]]] = {}

    def link(a, b, d):
        adj.setdefault(a, []).append((b, d))
        adj.setdefault(b, []).append((a, -d))

    for e in edges:
        if e.get("type") != "kinship":
            continue
        r, f, t = e.get("relation"), e.get("from"), e.get("to")
        if f is None or t is None:
            continue
        if r in BIRTH_PARENT_RELATIONS or (r in PARENT_RELATIONS and t not in has_birth):
            link(f, t, 1)
        elif r == "sibling":
            link(f, t, 0)

    gen: dict[str, int] = {}
    comp: dict[str, str] = {}
    conflicts: list[tuple[str, str]] = []
    for root in list(adj):
        if root in gen:
            continue
        gen[root], comp[root] = 0, root
        stack = [root]
        while stack:
            n = stack.pop()
            for m, d in adj[n]:
                if m not in gen:
                    gen[m], comp[m] = gen[n] + d, root
                    stack.append(m)
                elif gen[m] != gen[n] + d:
                    conflicts.append((n, m))
    return gen, comp, conflicts


def check_relation_edges(edges) -> None:
    """relationToPredecessor が名指す続柄が、血縁エッジの実体と合うか（Issue #40 G3）。

    世代差だけを見る check_graph_integrity より強い。「子」なら先代が本人の親エッジに
    実在すること、「甥」なら先代が親の兄弟であることまで確かめるので、世代は合っている
    別人を先代に置いた取り違えが残らない。

    続柄語を note の地の文から拾う案（Issue #40 G3 の当初案）は測って捨てた。
    「桓帝は子がなく崩御し」「明帝の実子ではなく養子」のように否定・第三者・連鎖
    （「李雄の兄李蕩の子」）が多数を占め、続柄語 354件のうち先代を指すものは
    2割に満たない。判定材料は散文でなくエッジに置く。
    """
    parents: dict[str, set[str]] = {}
    adoptive: dict[str, set[str]] = {}
    siblings: dict[str, set[str]] = {}
    children: dict[str, set[str]] = {}
    for e in edges:
        if e.get("type") != "kinship":
            continue
        r, f, t = e.get("relation"), e.get("from"), e.get("to")
        if f is None or t is None:
            continue
        if r in BIRTH_PARENT_RELATIONS:
            parents.setdefault(t, set()).add(f)
            children.setdefault(f, set()).add(t)
        elif r in PARENT_RELATIONS:
            adoptive.setdefault(t, set()).add(f)
            children.setdefault(f, set()).add(t)
        elif r == "sibling":
            siblings.setdefault(f, set()).add(t)
            siblings.setdefault(t, set()).add(f)

    def all_parents(x):
        return parents.get(x, set()) | adoptive.get(x, set())

    def brothers(x):
        """明示の兄弟エッジ＋同じ親を持つ者。"""
        out = set(siblings.get(x, set()))
        for p in all_parents(x):
            out |= children.get(p, set()) - {x}
        return out

    for i, e in enumerate(edges):
        if (e.get("type") != "succession" or e.get("isRestoration")
                or e.get("veracity") == "disputed"):
            continue
        r, f, t = e.get("relationToPredecessor"), e.get("from"), e.get("to")
        if f is None:
            continue
        if r == "son":
            expected, what = parents.get(t, set()), "実親"
        elif r == "adopted-son":
            expected, what = all_parents(t), "親"
        elif r == "grandson":
            expected = {gp for p in all_parents(t) for gp in all_parents(p)}
            what = "祖父母"
        elif r in ("younger-brother", "elder-brother"):
            expected, what = brothers(t), "兄弟"
        elif r == "nephew":
            expected = {u for p in all_parents(t) for u in brothers(p)}
            what = "オジ・オバ"
        else:
            continue
        # エッジが未収録で導けないものは判定しない（網羅性は check_coverage の担当）
        if expected and f not in expected:
            err(f"[graph] edges[{i}]({f}->{t}): relationToPredecessor={r!r} だが、"
                f"血縁エッジから導ける{what}は {sorted(expected)} で先代を含まない")


def check_graph_integrity(edges, emperors, persons) -> None:
    """世代パリティ・親子の生没年・相互継承（Issue #40 G4）。

    どれも「片方だけ直した」ときに落ちる型の検査で、系譜調査を進めるあいだ
    エッジと続柄がずれていくのを機械で止めるためにある。判定そのもの
    （誰が誰の子か）は検査しない。
    """
    gen, comp, conflicts = build_generations(edges)
    for a, b in conflicts:
        err(f"[graph] 親子・兄弟エッジの世代が矛盾: {a} と {b}"
            "（同一人物を別世代に置く重複ノード・向き違いの疑い）")

    for i, e in enumerate(edges):
        if e.get("type") != "succession" or e.get("veracity") == "disputed":
            continue
        f, t = e.get("from"), e.get("to")
        exp = GENERATION_DELTA.get(e.get("relationToPredecessor"))
        if exp is None or f not in gen or t not in gen or comp[f] != comp[t]:
            continue
        actual = gen[t] - gen[f]
        if actual != exp:
            err(f"[graph] edges[{i}]({f}->{t}): relationToPredecessor="
                f"{e.get('relationToPredecessor')!r} は世代差 {exp} を主張するが、"
                f"親子エッジから導かれる世代差は {actual}"
                "（続柄と血縁エッジのどちらかが誤り）")

    years = {p["id"]: (p.get("birthYear"), p.get("deathYear")) for p in persons}
    for e in emperors:
        a = e.get("ages") or {}
        years[e["id"]] = (_year(a.get("birthDate")), _year(a.get("deathDate")))
    for i, e in enumerate(edges):
        if e.get("type") != "kinship" or e.get("relation") not in PARENT_RELATIONS:
            continue
        r, f, t = e.get("relation"), e.get("from"), e.get("to")
        pb, pd = years.get(f, (None, None))
        cb, _ = years.get(t, (None, None))
        if pb is None or cb is None:
            continue
        label = f"[graph] edges[{i}]({f}->{t} {r})"
        if r in BIRTH_PARENT_RELATIONS:
            gap = cb - pb
            if gap < MIN_PARENT_GAP or gap > MAX_PARENT_GAP:
                err(f"{label}: 実親と子の生年差が {gap}（許容 {MIN_PARENT_GAP}〜{MAX_PARENT_GAP}）: "
                    f"親 {pb} / 子 {cb}")
            # 遺腹子があるので父は1年、母は0年まで許容する
            slack = 1 if r == "birth-father" else 0
            if pd is not None and cb > pd + slack:
                err(f"{label}: 実親の没年 {pd} より後に子が生まれている（子 {cb}）")
        elif cb <= pb:
            err(f"{label}: 養親が子より後（または同年）に生まれている: 親 {pb} / 子 {cb}")

    # 復位でない継承が双方向に立つ＝どちらかの向きが誤り（復位は isRestoration で持つ）
    forward = {(e.get("from"), e.get("to")) for e in edges
               if e.get("type") == "succession" and not e.get("isRestoration")}
    for f, t in sorted(p for p in forward if (p[1], p[0]) in forward and p[0] < p[1]):
        err(f"[graph] 復位でない継承エッジが双方向にある: {f} <-> {t}")


def check_enum_catalogs(emp: dict) -> None:
    """kinship 側の語彙が emperors.json の meta.catalogs.enums と一致することを検査する。

    v3 の原則（D3）で日本語ラベルはカタログにしか置かないため、サイトなどの消費側は
    カタログを引いてラベルへ解決する。このスクリプトの ID 集合とカタログが食い違うと、
    「バリデータは通るのに表示ラベルが引けない」ID が生まれるので、両者を突き合わせる。
    """
    enums = emp["meta"].get("catalogs", {}).get("enums", {})
    for name, expected in (
        ("kinshipPersonKind", KIND_ENUM),
        ("kinshipInclusionReason", INCLUSION_ENUM),
        ("kinshipRelation", RELATION_ENUM),
        ("kinshipRelationDetail", RELATION_DETAIL_ENUM),
        ("kinshipSuccessionCategory", CATEGORY_ENUM),
        ("relationToPredecessor", REL_TO_PRED_ENUM),
        ("veracity", VERACITY_ENUM),
        ("confidence", CONFIDENCE_ENUM),
    ):
        items = enums.get(name)
        if items is None:
            # veracity のようにカタログ未投入の語彙は対象外（投入されたら突合が効き始める）
            continue
        catalog_ids = {i["id"] for i in items}
        missing = expected - catalog_ids
        if missing:
            err(f"[catalog-enum] enums.{name} にラベルが無い ID: {sorted(missing)}")
        # kinship 専用の語彙はカタログ側の余剰も誤り（共有語彙の relationToPredecessor は
        # emperors 側だけが使う "none"（該当なし）を含むため、余剰は許す）
        extra = catalog_ids - expected
        if extra and name.startswith("kinship"):
            err(f"[catalog-enum] enums.{name} に kinship で使わない ID: {sorted(extra)}")


def main() -> int:
    kin = json.loads(KINSHIP_PATH.read_text(encoding="utf-8"))
    emp = json.loads(EMPERORS_PATH.read_text(encoding="utf-8"))
    emperors = emp["emperors"]
    emperor_ids = {e["id"] for e in emperors}
    accession_by_id = {e["id"]: e["accessionRoute"]["categoryId"] for e in emperors}

    for key in ("meta", "persons", "edges", "genealogicalClaims"):
        if key not in kin:
            err(f"[structure] トップレベルに {key} がない")
    phases = kin.get("meta", {}).get("status", {}).get("phases", {})
    for ph in ("succession", "parentage", "maternalLineage", "interdynastic", "crosscheck"):
        if ph not in phases:
            err(f"[structure] meta.status.phases に {ph} がない")

    sections = {e["researchSection"] for e in emperors}
    era_ids = {e["id"] for e in emp["meta"].get("catalogs", {}).get("eras", [])}
    check_enum_catalogs(emp)
    gender_by_person = check_persons(kin.get("persons", []), emperor_ids, sections, era_ids)
    restoration_reigns_by_id = {
        e["id"]: sum(1 for r in e["reigns"] if r.get("isRestoration")) for e in emperors}
    (referenced, primary_by_emperor, succession_covered, parents_of, father_covered,
     mother_covered) = check_edges(
        kin.get("edges", []), emperor_ids, gender_by_person, accession_by_id,
        restoration_reigns_by_id)
    # 孤立ブリッジは原則禁止。ただしスコープルール6（歴代君主）で収録した人物だけは、
    # 血縁・婚姻が原典に一切記されない君主（西燕第3代の段随＝慕容沖の将）がありうるため
    # 例外とする。図では代数の欠番を埋める灰ピルとして単独で置かれる。
    dynastic_only = {p["id"] for p in kin.get("persons", [])
                     if p.get("inclusionReason") == ["ruler"]}
    orphan = set(gender_by_person) - referenced - dynastic_only
    if orphan:
        err(f"[persons] 孤立ブリッジ（どのエッジからも参照されない）: {sorted(orphan)}")
    check_axes_sync(kin.get("edges", []), emperors)
    check_relation_edges(kin.get("edges", []))
    check_graph_integrity(kin.get("edges", []), emperors, kin.get("persons", []))
    check_claims(kin.get("genealogicalClaims", []), emperor_ids)
    check_coverage(kin.get("meta", {}), emperors, emperor_ids, succession_covered, parents_of,
                   father_covered, mother_covered)

    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"ERROR {e}")
    print(f"---\n{len(errors)} errors, {len(warnings)} warnings "
          f"({len(kin.get('persons', []))} persons, {len(kin.get('edges', []))} edges)")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
