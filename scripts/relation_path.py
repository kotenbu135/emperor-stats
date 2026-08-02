"""続柄をグラフパスから導出する（Issue #51 P1）。

**呼称を選ぶ工程を消すための道具**。「従叔父」「従兄弟」のような漢語・日本語の呼称は、
書く人が語彙から選ぶと外れる（Issue #36 の A類型6件は、いずれも同一レコードの別フィールドが
正しいパスを持っていながら、散文へ落とす段で呼称を取り違えていた）。
呼称は `data/kinship.json` の血縁エッジから導出できるので、**調査者・エージェントは
パス（誰の子の子か）だけを確定し、呼称はこのスクリプトの出力をそのまま使う**。

使い方:
  python3 scripts/relation_path.py --for <皇帝id>     # 先代から見た当人の続柄
  python3 scripts/relation_path.py --between A B       # 任意の2人（A から見た B）
  python3 scripts/relation_path.py --check             # succession エッジ全件を記録値と突合

終了コードは常に 0（**報告専用でゲートではない**）。`--check` の不一致は
「エッジと記録値のどちらかが誤り」を意味するだけで機械では決着しないため、
CI へ載せない（Issue #51 の「判断が要るものはゲートにしない」）。

**このスクリプトは値を作らない**（規則 R-NO-AUTOGEN）。出すのは既に kinship.json に
入っているエッジの読み替えだけで、エッジが無ければ「導出不能」と言う。
`--check` の不一致は「エッジと記録値のどちらかが誤り」を意味するだけで、
どちらが誤りかは原典で決める。

養子系の扱い: 世代の割り当てと同じく**実系を優先**する（`validate_kinship.py`
の build_generations と同じ理由 — 石虎は実系では石勒の従子だが、石勒の父・周曷朱の
養子でもあるため養系では石弘の一世代上になり、原典も「或称勒弟焉」と両様に記す）。
実系で到達できないときだけ養系を通し、呼称に「養」を冠する。

**この出力を根拠にデータを書き換えない。** 出るのは kinship.json のエッジの読み替え
なので、記録値と食い違ったときに誤っているのはエッジの側かもしれない。
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict, deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KINSHIP_PATH = ROOT / "data" / "kinship.json"
EMPERORS_PATH = ROOT / "data" / "emperors.json"

BIRTH_PARENT = {"birth-father", "birth-mother"}
ADOPTIVE_PARENT = {"adoptive-father", "adoptive-mother"}
PARENT_RELATIONS = BIRTH_PARENT | ADOPTIVE_PARENT

# relationToPredecessor（emperors.json / kinship.json の共有語彙）へ潰すときの対応。
# 導出は粒度が細かいので、突合のためにこの粗さへ落とす。
# adopted-son は実系パスでは決まらない（養子は実系で甥・従甥のまま繋がっていることが多い）。
# 養親エッジの直接確認で突合するので、この表からは外す。
ENUM_GROUP = {
    "son": "son",
    "grandson": "grandson",
    "father": "parent", "mother": "parent",
    "elder-brother": "brother", "younger-brother": "brother",
    "nephew": "nephew",
    "uncle-elder": "uncle", "uncle-younger": "uncle",
    "cousin": "cousin",
    "grandfather": "distant-kin", "maternal-grandfather": "maternal-grandparent",
    "great-grandson": "distant-kin", "niece": "nephew",
    "distant-kin": "distant-kin", "affinal-kin": "affinal-kin",
    # 判定の外（血縁グラフでは決まらない）
    "adopted-son": None, "unrelated": None, "other": None, "none": None,
}

ORDINAL_ANCESTOR = {1: "父", 2: "祖父", 3: "曾祖父", 4: "高祖父"}
ORDINAL_DESCENDANT = {1: "子", 2: "孫", 3: "曾孫", 4: "玄孫", 5: "来孫", 6: "昆孫"}
COLLATERAL_PREFIX = {2: "従", 3: "再従", 4: "三従"}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


class Graph:
    """kinship.json の血縁・婚姻エッジを、パス探索できる形に持つ。"""

    def __init__(self, kinship, emperors):
        self.parents = defaultdict(list)   # child -> [(parent, relation)]
        self.children = defaultdict(list)  # parent -> [(child, relation)]
        self.siblings = defaultdict(list)
        self.spouses = defaultdict(list)
        for e in kinship.get("edges", []):
            t, f, to = e.get("type"), e.get("from"), e.get("to")
            if f is None or to is None:
                continue
            if t == "kinship":
                r = e.get("relation")
                if r in PARENT_RELATIONS:
                    self.parents[to].append((f, r))
                    self.children[f].append((to, r))
                elif r == "sibling":
                    self.siblings[f].append(to)
                    self.siblings[to].append(f)
            elif t == "marriage":
                self.spouses[f].append(to)
                self.spouses[to].append(f)
        self.name = {}
        self.birth_year = {}
        for p in kinship.get("persons", []):
            self.name[p["id"]] = p.get("name", p["id"])
            self.birth_year[p["id"]] = p.get("birthYear")
        for e in emperors.get("emperors", []):
            self.name[e["id"]] = _display_name(e)
            self.birth_year[e["id"]] = _year(e)
        # 記録値 adopted-son の突合に使う（先代が当人の養親エッジに直接いるか）
        self.adoptive_parents = {
            c: {p for p, r in ps if r in ADOPTIVE_PARENT}
            for c, ps in self.parents.items()
        }

    def _steps(self, node, *, adoptive: bool, affinal: bool):
        out = []
        for p, r in self.parents[node]:
            if adoptive or r in BIRTH_PARENT:
                out.append((p, "up", r))
        for c, r in self.children[node]:
            if adoptive or r in BIRTH_PARENT:
                out.append((c, "down", r))
        for s in self.siblings[node]:
            out.append((s, "sib", "sibling"))
        if affinal:
            for s in self.spouses[node]:
                out.append((s, "spouse", "marriage"))
        return out

    def path(self, a, b, *, adoptive: bool, affinal: bool, max_depth=12):
        """a から b への最短パス。ノード列とステップ列を返す（見つからなければ None）。"""
        if a == b:
            return [], []
        seen = {a}
        q = deque([(a, [], [])])
        while q:
            n, nodes, steps = q.popleft()
            if len(steps) >= max_depth:
                continue
            for m, kind, rel in self._steps(n, adoptive=adoptive, affinal=affinal):
                if m in seen:
                    continue
                if m == b:
                    return nodes + [m], steps + [(kind, rel)]
                seen.add(m)
                q.append((m, nodes + [m], steps + [(kind, rel)]))
        return None

    def find(self, a, b, *, allow_adoptive=True):
        """実系 → （姻族）→ （養系）の順に探す。(nodes, steps, mode) を返す。

        養系は最後に置く。実系で引けないものを養系で埋めると、原典が実系で語る続柄
        （石虎は「勒之从子」）を養系の続柄（「或称勒弟焉」）で上書きしてしまう。
        突合（--check）では `allow_adoptive=False` で呼び、実系で引けないものは
        「導出不能」のまま残す。
        """
        candidates = [(False, False, "birth"), (False, True, "affinal")]
        if allow_adoptive:
            candidates += [(True, False, "adoptive"), (True, True, "adoptive-affinal")]
        for adoptive, affinal, mode in candidates:
            r = self.path(a, b, adoptive=adoptive, affinal=affinal)
            if r is not None:
                return r[0], r[1], mode
        return None, None, None


def _display_name(emperor):
    """emperors.json の name は {personalName, commonName, ...} の辞書。"""
    n = emperor.get("name")
    if isinstance(n, dict):
        return n.get("commonName") or n.get("personalName") or emperor["id"]
    return n or emperor["id"]


def _year(emperor):
    v = emperor.get("birthYear")
    if v is None:
        for key in ("birth", "lifespan"):
            sub = emperor.get(key)
            if isinstance(sub, dict) and sub.get("year") is not None:
                v = sub["year"]
                break
    if isinstance(v, str):
        v = v.lstrip("0") or "0"
        try:
            return int(v)
        except ValueError:
            return None
    return v if isinstance(v, int) else None


def classify(steps):
    """ステップ列を (up, down, spouse数, 養系を通ったか, 母系エッジ数) に潰す。

    兄弟エッジは「共通の親を1つ経由した」と同じ扱いにする（up1・down1）。
    """
    up = down = spouse = maternal = 0
    adoptive = False
    for kind, rel in steps:
        if kind == "up":
            up += 1
        elif kind == "down":
            down += 1
        elif kind == "sib":
            up += 1
            down += 1
        elif kind == "spouse":
            spouse += 1
        if rel in ADOPTIVE_PARENT:
            adoptive = True
        if rel in ("birth-mother", "adoptive-mother"):
            maternal += 1
    return up, down, spouse, adoptive, maternal


def seniority(graph, subject, other):
    """subject と other の長幼。生年が両方あるときだけ '兄'/'弟' を決める。"""
    a, b = graph.birth_year.get(subject), graph.birth_year.get(other)
    if a is None or b is None:
        return None
    if a == b:
        return None
    return "elder" if a < b else "younger"


def label(graph, subject, base, steps):
    """base（先代・基準の人物）から見た subject の続柄を、日本語呼称と enum で返す。

    返すのは (日本語呼称, 突合用 enum)。呼称は「subject は base の〈X〉」の X。
    """
    up, down, spouse, adoptive, maternal = classify(steps)
    prefix = "養" if adoptive else ""
    if spouse:
        return (prefix + "姻族", "affinal-kin")

    # 同母兄弟は「外」ではない（共通の親が母でも兄弟は兄弟）。母系の判定より前に置く。
    if up == 1 and down == 1:
        s = seniority(graph, subject, base)
        word = {"elder": "兄", "younger": "弟"}.get(s, "兄弟")
        if maternal:
            word = "同母" + word
        return (prefix + word, "brother")

    # 女性を経由するパスは宗族（父系）の外へ出るので、父系の続柄語彙をそのまま当てられない。
    # 母・子・外祖父・外孫までは固有の語があるが、それより遠いものは一括して「外戚」。
    # 記録側の語彙も同じ設計（`affinal-kin` = 外戚（その他）・`maternal-grandfather` = 外祖父）。
    if maternal:
        if up + down == 1:
            return (prefix + ("母" if up else "子"), "parent" if up else "son")
        if up == 2 and down == 0:
            return (prefix + "外祖父母", "maternal-grandparent")
        if up == 0 and down == 2:
            return (prefix + "外孫", "affinal-kin")
        return (prefix + "外戚", "affinal-kin")

    # 直系（下）: base の子・孫・曾孫…
    if up == 0 and down >= 1:
        word = ORDINAL_DESCENDANT.get(down, f"{down - 1}世孫")
        enum = {1: "son", 2: "grandson"}.get(down, "distant-kin")
        return (prefix + word, enum)
    # 直系（上）: base の父・祖父…
    if down == 0 and up >= 1:
        word = ORDINAL_ANCESTOR.get(up, f"{up - 1}世祖")
        return (prefix + word, "parent" if up == 1 else "distant-kin")

    m = min(up, down)          # 共通祖先までの段数（1=同じ親, 2=同じ祖父…）
    d = up - down              # 正なら subject が上の世代
    branch = COLLATERAL_PREFIX.get(m, f"{m - 1}従") if m >= 2 else ""

    if d == 0:                 # 同世代
        if m == 1:
            s = seniority(graph, subject, base)
            word = {"elder": "兄", "younger": "弟"}.get(s, "兄弟")
            return (prefix + word, "brother")
        return (prefix + branch + "兄弟", "cousin" if m == 2 else "distant-kin")
    if d > 0:                  # subject が上の世代（オジ方向）
        if d == 1:
            # 伯/叔は base の親と subject の長幼で決まる（base 本人との比較ではない）
            parent = next((p for p, r in graph.parents[base] if r in BIRTH_PARENT), None)
            s = seniority(graph, subject, parent) if parent else None
            core = {"elder": "伯父", "younger": "叔父"}.get(s, "伯叔父")
        else:
            core = f"{d}世上の伯叔父"
        if m == 1:
            enum = "uncle" if d == 1 else "distant-kin"
            return (prefix + ("大" * (d - 1)) + core, enum)
        return (prefix + branch + core, "distant-kin")
    # d < 0: subject が下の世代（オイ方向）
    k = -d
    core = "甥" if k == 1 else ("又甥" if k == 2 else f"{k}世下の甥")
    if m == 1:
        return (prefix + core, "nephew" if k == 1 else "distant-kin")
    return (prefix + branch + core, "distant-kin")


def render(graph, base, subject, nodes, steps, mode):
    arrows = []
    prev = base
    for node, (kind, rel) in zip(nodes, steps):
        sym = {"up": "→親", "down": "→子", "sib": "→同胞", "spouse": "→配偶"}[kind]
        arrows.append(f"{graph.name.get(prev, prev)} {sym}({rel}) {graph.name.get(node, node)}")
        prev = node
    word, enum = label(graph, subject, base, steps)
    up, down, spouse, adoptive, maternal = classify(steps)
    return word, enum, arrows, f"up={up} down={down} spouse={spouse} 母系={maternal} 系統={mode}"


def cmd_between(graph, base, subject, recorded=None):
    """base から見た subject の続柄を出す。recorded を渡すと記録値との異同も言う。

    異同を黙っていると、出力の1行目をそのまま note へ写した人が、記録値と食い違う
    呼称を書いてしまう。導出と記録が割れているときは「どちらが誤りかは原典で決める」
    ところまで出力に書く。
    """
    bn, sn = graph.name.get(base, base), graph.name.get(subject, subject)
    derived = []
    if base in graph.adoptive_parents.get(subject, set()):
        print(f"{sn} は {bn} の【養子】   （relationToPredecessor 相当: adopted-son）")
        print(f"  パス: {bn} →養子(adoptive-father/mother) {sn}")
        derived.append("adopted-son")
    nodes, steps, mode = graph.find(base, subject)
    if nodes is None:
        print(f"{sn} は {bn} の … 実系での導出不能（血縁・婚姻エッジで到達しない）")
    else:
        word, enum, arrows, meta = render(graph, base, subject, nodes, steps, mode)
        print(f"{sn} は {bn} の【{word}】   （relationToPredecessor 相当: {enum}）")
        print(f"  パス: {' / '.join(arrows)}")
        print(f"  {meta}")
        derived.append(enum)
    if recorded is not None:
        expected = ENUM_GROUP.get(recorded, "?")
        groups = {ENUM_GROUP.get(d, d) if d != "adopted-son" else "adopted-son"
                  for d in derived}
        ok = (recorded in groups) or (expected is not None and expected in groups)
        if not derived:
            print("  ※ 記録値と突き合わせられない（パスが引けない）")
        elif not ok:
            print(f"  ※ 記録値 {recorded} と食い違う。"
                  "どちらが誤りかは原典で決める（この出力を根拠に書き換えない）")
    return 0


def cmd_for(graph, kinship, emperor_id):
    edges = [e for e in kinship.get("edges", [])
             if e.get("type") == "succession" and e.get("to") == emperor_id]
    if not edges:
        print(f"{emperor_id}: succession エッジが無い（初代・自立・推戴か、未調査）")
        return 0
    for e in edges:
        tag = "（復位）" if e.get("isRestoration") else ""
        rec = e.get("relationToPredecessor")
        print(f"■ 先代 {graph.name.get(e['from'], e['from'])}{tag} / 記録値: {rec}")
        cmd_between(graph, e["from"], emperor_id, recorded=rec)
        print()
    return 0


def cmd_check(graph, kinship):
    agree = disagree = unresolved = out_of_scope = 0
    adopted_ok = 0
    rows = []
    for e in kinship.get("edges", []):
        if e.get("type") != "succession":
            continue
        rec = e.get("relationToPredecessor")
        if rec == "adopted-son":
            # 養子は実系（甥・従甥のまま繋がっていることが多い）では決まらない。
            # 養親エッジに先代が直接いるかだけを見る。
            if e["from"] in graph.adoptive_parents.get(e["to"], set()):
                adopted_ok += 1
            else:
                disagree += 1
                rows.append((e["from"], e["to"], rec, "養親エッジ無し", "-",
                             "（kinship.json に adoptive-father/mother エッジが無い）", ""))
            continue
        expected = ENUM_GROUP.get(rec, "?")
        if expected is None:
            out_of_scope += 1
            continue
        nodes, steps, mode = graph.find(e["from"], e["to"], allow_adoptive=False)
        if nodes is None:
            unresolved += 1
            continue
        _, got = label(graph, e["to"], e["from"], steps)
        if got == expected:
            agree += 1
        else:
            disagree += 1
            word, _, arrows, meta = render(graph, e["from"], e["to"], nodes, steps, mode)
            rows.append((e["from"], e["to"], rec, word, got, " / ".join(arrows), meta))
    for f, t, rec, word, got, arrows, meta in rows:
        print(f"不一致 {f} -> {t}: 記録={rec} / パス導出={word}({got})")
        print(f"       {arrows}")
        print(f"       {meta}")
    print(f"---\n照合 {agree + disagree} 件（一致 {agree} / 不一致 {disagree}）"
          f"・養子エッジ確認 {adopted_ok} 件・パス導出不能 {unresolved} 件"
          f"・判定外 {out_of_scope} 件")
    if disagree:
        print("不一致はエッジと記録値のどちらかが誤り。どちらかは原典で決める。")
    # 報告専用。不一致は「どちらかが誤り」を意味するだけで、機械では決着しないので
    # 終了コードには出さない（Issue #51 の「ゲートにしない」）。非ゼロで返すと
    # CI へ載せた誰かが抑制リストを足すことになり、その時点で読まれなくなる。
    return 0


def main():
    ap = argparse.ArgumentParser(description="続柄をグラフパスから導出する（Issue #51 P1）")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--for", dest="emperor", metavar="皇帝id",
                   help="先代から見たその皇帝の続柄を出す")
    g.add_argument("--between", nargs=2, metavar=("基準", "対象"),
                   help="基準から見た対象の続柄を出す")
    g.add_argument("--check", action="store_true",
                   help="succession エッジ全件を記録値と突合する")
    args = ap.parse_args()

    kinship = load(KINSHIP_PATH)
    emperors = load(EMPERORS_PATH)
    graph = Graph(kinship, emperors)

    if args.check:
        return cmd_check(graph, kinship)
    if args.emperor:
        return cmd_for(graph, kinship, args.emperor)
    return cmd_between(graph, args.between[0], args.between[1])


if __name__ == "__main__":
    sys.exit(main())
