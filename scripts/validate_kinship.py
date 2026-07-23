"""data/kinship.json（系譜・即位経路グラフ）の恒久 QA チェック（task.md 6-3・GitHub Actions CI 用）。

使い方: python3 scripts/validate_kinship.py
終了コード: 0=合格（警告のみ含む） / 1=エラーあり

スキーマ・収録基準は data/schema/KINSHIP_SCHEMA.md を参照。

チェック内容（エラー＝CI 失敗）:
  - persons: id 一意・`p-` プレフィックス＋kebab-case・emperors.json の id と非衝突・
    enum（kind/gender/inclusionReason）・kana 必須（ひらがな）・
    section 必須（emperors.json の dynasty.section 語彙集合に所属）・source 必須・
    birthYear/deathYear の型と前後関係・yearsApproximate は bool
  - edges: from/to が実在ノード（皇帝 id または persons）・自己ループなし・
    enum（type/relation/category/relationToPredecessor/veracity/confidence）・source 必須・
    重複エッジなし（marriage/兄弟姉妹は無向正規化して判定）
  - succession: to は皇帝・relationToPredecessor 必須（「その他」は note 必須）・
    主エッジ（isRestoration=false・veracity≠disputed）は皇帝ごとに最大1本
    （disputed は対立説の併記として複数可）・
    非 disputed 主エッジの category が emperors.json の accessionRoute.category と整合
    （accessionRoute=復位 の皇帝は主エッジ category=初回経路＋isRestoration エッジを別途持つ規約）
  - kinship: 実父/養父の from は male・実母/養母の from は female（gender 判明時のみ）・
    verified の実父エッジは子ごとに最大1本・親子エッジ（実父/実母/養父/養母）の循環なし・
    childOrder は 1 以上の整数・primaryLineage:true は子ごとに最大1本
  - 孤立ブリッジ（どのエッジからも参照されない persons）なし
  - genealogicalClaims: claimant の実在・source 必須
  - 出典禁止語（detect_wikipedia_sources.is_wiki_like を共用。正史書名ホワイトリスト方式の
    ため、Wikipedia 等の禁止出典だけでなく正史書名として認識できない表記不備も検出される）

網羅性チェック（meta.status.phases の該当フェーズが completed のときのみ有効化・エラー）:
  - succession 完了後: 全皇帝が succession エッジを持つ（disputed 主エッジのみ・復位エッジ
    のみでも可）、または accessionRoute=建国/不詳/諸説あり、または meta.confirmedRootless
    （原典確認済みの並立根・傀儡根リスト。id 実在・reason 必須・陳腐化は常時検証）に記載
  - parentage 完了後: 実父/養父エッジを持たず meta.confirmedFatherUnknown にも未登録の
    皇帝をエラーで列挙（confirmedFatherUnknown の構造検証は常時。「調査済みだが不明」の確定は
    ブロック調査ノート側で担保するため、機械判定はエラーにしない）

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

KIND_ENUM = {"追尊皇帝", "宗室", "外戚", "后妃・公主", "その他"}
GENDER_ENUM = {"male", "female"}
INCLUSION_ENUM = {"経路上", "一親等", "追尊皇帝", "婚姻当事者"}
EDGE_TYPE_ENUM = {"succession", "kinship", "marriage"}
RELATION_ENUM = {"実父", "実母", "養父", "養母", "兄弟姉妹"}
PARENT_RELATIONS = {"実父", "実母", "養父", "養母"}
MALE_RELATIONS = {"実父", "養父"}
FEMALE_RELATIONS = {"実母", "養母"}
CATEGORY_ENUM = {"世襲", "簒奪", "禅譲", "内禅", "擁立", "復位", "建国", "不詳", "諸説あり"}
REL_TO_PRED_ENUM = {
    "子", "養子", "孫", "曾孫", "弟", "兄", "甥", "姪", "叔父", "伯父", "従兄弟",
    "同族（遠縁）", "父", "母", "祖父", "外祖父", "女婿", "舅（妻の父）",
    "外戚（その他）", "無血縁", "不明", "その他",
}
KANA_RE = re.compile(r"^[ぁ-ゖー]+$")
ROOT_CATEGORIES = {"建国", "不詳", "諸説あり"}  # 主エッジ不在を許容する accessionRoute
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


def check_persons(persons, emperor_ids, sections) -> dict[str, str]:
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
        if p.get("section") not in sections:
            err(f"[persons] {label}: section が emperors.json の dynasty.section 語彙にない: "
                f"{p.get('section')!r}")
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
    primary_lineage_by_child = Counter()
    parent_edges: list[tuple[str, str]] = []  # (親, 子)
    father_covered: set[str] = set()  # 実父/養父エッジを持つ子（parentage 網羅性チェック用）
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
            cat = e.get("category")
            if cat not in CATEGORY_ENUM:
                err(f"[edges] {label}: category が不正: {cat!r}")
            rel = e.get("relationToPredecessor")
            if rel not in REL_TO_PRED_ENUM:
                err(f"[edges] {label}: relationToPredecessor が不正: {rel!r}")
            elif rel == "その他" and not e.get("note"):
                err(f"[edges] {label}: relationToPredecessor=その他 は note 必須")
            is_rest = e.get("isRestoration")
            disputed = e.get("veracity") == "disputed"
            if not isinstance(is_rest, bool):
                err(f"[edges] {label}: isRestoration が bool でない: {is_rest!r}")
            elif not is_rest:
                if not disputed:
                    primary_by_emperor[t] += 1
                    route = accession_by_id.get(t)
                    if route == "復位":
                        if cat == "復位":
                            err(f"[edges] {label}: 復位皇帝の主エッジ category は初回即位の経路"
                                "（復位は isRestoration:true の別エッジ）")
                    elif cat != route:
                        err(f"[edges] {label}: category={cat!r} が accessionRoute={route!r} と不一致")
            else:
                if cat != "復位":
                    err(f"[edges] {label}: isRestoration:true なのに category={cat!r}")
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
                if rel == "実父" and e.get("veracity") == "verified":
                    verified_father_by_child[t] += 1
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
        if e.get("type") == "kinship" and e.get("relation") == "兄弟姉妹":
            common = parents_of.get(e.get("from"), set()) & parents_of.get(e.get("to"), set())
            if common:
                warn(f"[edges] 兄弟姉妹エッジ {e.get('from')}<->{e.get('to')} は共通親 "
                     f"{sorted(common)} から導出可能（明示エッジ不要の疑い）")

    return referenced, primary_by_emperor, succession_covered, parents_of, father_covered


def check_claims(claims, emperor_ids):
    for i, c in enumerate(claims):
        label = f"genealogicalClaims[{i}]({c.get('claimant')})"
        if c.get("claimant") not in emperor_ids:
            err(f"[claims] {label}: claimant が emperors.json に存在しない")
        if not c.get("claimedAncestry"):
            err(f"[claims] {label}: claimedAncestry が空")
        check_source(label, c.get("source"))


def check_coverage(meta, emperors, emperor_ids, succession_covered, parents_of, father_covered):
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
            route = e["accessionRoute"]["category"]
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


def main() -> int:
    kin = json.loads(KINSHIP_PATH.read_text(encoding="utf-8"))
    emp = json.loads(EMPERORS_PATH.read_text(encoding="utf-8"))
    emperors = emp["emperors"]
    emperor_ids = {e["id"] for e in emperors}
    accession_by_id = {e["id"]: e["accessionRoute"]["category"] for e in emperors}

    for key in ("meta", "persons", "edges", "genealogicalClaims"):
        if key not in kin:
            err(f"[structure] トップレベルに {key} がない")
    phases = kin.get("meta", {}).get("status", {}).get("phases", {})
    for ph in ("succession", "parentage", "interdynastic", "crosscheck"):
        if ph not in phases:
            err(f"[structure] meta.status.phases に {ph} がない")

    sections = {e["dynasty"]["section"] for e in emperors}
    gender_by_person = check_persons(kin.get("persons", []), emperor_ids, sections)
    restoration_reigns_by_id = {
        e["id"]: sum(1 for r in e["reigns"] if r.get("isRestoration")) for e in emperors}
    referenced, primary_by_emperor, succession_covered, parents_of, father_covered = check_edges(
        kin.get("edges", []), emperor_ids, gender_by_person, accession_by_id,
        restoration_reigns_by_id)
    orphan = set(gender_by_person) - referenced
    if orphan:
        err(f"[persons] 孤立ブリッジ（どのエッジからも参照されない）: {sorted(orphan)}")
    check_claims(kin.get("genealogicalClaims", []), emperor_ids)
    check_coverage(kin.get("meta", {}), emperors, emperor_ids, succession_covered, parents_of,
                   father_covered)

    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"ERROR {e}")
    print(f"---\n{len(errors)} errors, {len(warnings)} warnings "
          f"({len(kin.get('persons', []))} persons, {len(kin.get('edges', []))} edges)")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
