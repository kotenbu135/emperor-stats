// 系譜・即位経路グラフ(/kinship)のビルド時レイアウト計算(オーケストレータ)。
//
// 設計(2026-07-24全面再設計・docs/site-design/LAYOUT.md):
// - 時代チャプター縦積み。章ごとに独立した年→px写像(time-scale.ts)。
// - 章内は王朝バンドを横に並べ、バンド内は家系図パッキング(tree.ts)。
// - 王朝内の継承は矢印にせず、カプセル内の「第N代・即位経路」表記で示す。
//   矢印は王朝間の交代(禅譲・簒奪など)のみ。親子は垂下線(junction)の構造で示し、
//   続柄ラベルは付けない(ツールチップとテキスト版で示す)。
// - fsに依存しない純関数群。年はすべて天文年(emperors.tsが変換して渡す)。

import { formatYear } from "@/lib/emperor-types";
import { fromAstroYear } from "@/lib/timeline-river";
import {
  CHILD_ORDER_OVERRIDES,
  KINSHIP_CHAPTER_DEFS,
  KINSHIP_COLOR_BY_DYNKEY,
  KINSHIP_ENABLED_CHAPTER_IDS,
  PERSON_BAND_OVERRIDES,
} from "./chapters";
import {
  type BandGraph,
  type KinNodeInfo,
  NODE_GAP,
  PERSON_H,
  PERSON_HALF_SPAN,
  PX_PER_YEAR,
  packBand,
  type PackedBand,
  type SpouseAttach,
} from "./tree";
import { buildYearScale, type YearSpanConstraint } from "./time-scale";

// --- 入力(emperors.tsが整形して渡す) ---

export interface KinshipSourceEmperor {
  id: string;
  name: string;
  dynastyLabel: string;
  /** `name__section`(emperors.tsのdynastyKeyと同一)。 */
  dynastyKey: string;
  female: boolean;
  /** accessionRoute.category(継承エッジが無い根の表示用)。 */
  routeCategory: string;
  /** 王朝内の即位順(dynastyOrder。無いものはビルド時導出)。在位ごと。 */
  ordinals: number[];
  reigns: { a: number; b: number; isRestoration: boolean }[];
}

export interface KinshipSourcePerson {
  id: string;
  name: string;
  kind: string;
  female: boolean;
  birthYear: number | null;
  deathYear: number | null;
  yearsApproximate: boolean;
}

export interface KinshipSourceEdge {
  type: "succession" | "kinship" | "marriage";
  from: string;
  to: string;
  category?: string;
  relationToPredecessor?: string;
  relation?: string;
  childOrder?: number;
  veracity: string;
  confidence: string;
  noteExcerpt: string;
  sourcePage: string;
}

export interface KinshipSourceClaim {
  claimant: string;
  claimedAncestry: string;
  noteExcerpt: string;
  sourcePage: string;
}

export interface KinshipSource {
  emperors: KinshipSourceEmperor[];
  persons: KinshipSourcePerson[];
  edges: KinshipSourceEdge[];
  claims: KinshipSourceClaim[];
}

// --- 出力(そのままクライアントのpropsになる) ---

export interface TipLine {
  text: string;
  muted?: boolean;
}

export interface KinshipNodeOut {
  key: string;
  id: string;
  kind: "emperor" | "person" | "consort";
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** カプセル2行目(「第N代・世襲」等)。高さ不足時はnull。 */
  sub: string | null;
  colorSlot: number;
  female: boolean;
  claimBadge: boolean;
  tipLines: TipLine[];
}

export interface KinshipTieOut {
  husbandId: string;
  spouseId: string;
  x1: number;
  x2: number;
  y: number;
  /** 皇后(婚姻エッジあり)=二重線。 */
  double: boolean;
}

export interface KinshipDropOut {
  path: string;
  /** disputedな親子(前少帝・後少帝の実父等)の最終降下線。 */
  dashed: boolean;
  /** 関与ノードid(クリック強調のグルーピング用)。 */
  ids: string[];
}

export interface KinshipAuxOut {
  key: string;
  fromId: string;
  toId: string;
  path: string;
  dashed: boolean;
  disputed: boolean;
  /** 婚姻(二重線)の補助エッジか。 */
  marriage: boolean;
  tipLines: TipLine[];
}

export interface KinshipArrowOut {
  key: string;
  fromId: string;
  toId: string;
  path: string;
  label: string;
  labelX: number;
  labelY: number;
  disputed: boolean;
  tipLines: TipLine[];
}

export interface KinshipTextEmperor {
  id: string;
  label: string;
  sub: string;
  detail: string;
}

export interface KinshipChapterLayout {
  id: string;
  title: string;
  period: string;
  width: number;
  height: number;
  axisX: number;
  ticks: { y: number; label: string }[];
  bands: { label: string; x: number; width: number; labelY: number }[];
  dynastyHeads: { label: string; x: number; y: number }[];
  nodes: KinshipNodeOut[];
  ties: KinshipTieOut[];
  drops: KinshipDropOut[];
  auxEdges: KinshipAuxOut[];
  arrows: KinshipArrowOut[];
  /** テキスト版(王朝ごとの歴代列挙)。 */
  textDynasties: { label: string; emperors: KinshipTextEmperor[] }[];
  /** 章内の王朝間交代(テキスト版)。 */
  textTransitions: string[];
  claims: { claimant: string; ancestry: string; note: string; source: string }[];
}

// --- レイアウト定数 ---
const AXIS_X = 64;
const BAND_GAP = 56;
const M_TOP = 96;
const M_BOTTOM = 48;
const CONSORT_H = 24;

const fmtPeriod = (a: number, b: number) => {
  const fa = formatYear(fromAstroYear(a));
  const fb = formatYear(fromAstroYear(b));
  return fa === fb ? `${fa}年` : `${fa}–${fb}年`;
};

function personPeriod(p: KinshipSourcePerson): string {
  if (p.birthYear === null && p.deathYear === null)
    return "生没年不詳（配置は系譜から推定）";
  if (p.birthYear !== null && p.deathYear !== null)
    return `${p.yearsApproximate ? "生没年推定 " : ""}${fmtPeriod(p.birthYear, p.deathYear)}`;
  const known = (p.birthYear ?? p.deathYear)!;
  const label = `${formatYear(fromAstroYear(known))}年${p.yearsApproximate ? "頃" : ""}`;
  return p.birthYear !== null ? `生 ${label}（没年不詳）` : `没 ${label}（生年不詳）`;
}

function ordinalLabel(n: number): string {
  return n === 1 ? "初代" : `第${n}代`;
}

/** 「外戚（その他）」→「外戚」のように括弧の注記を落とす(グラフ内ラベル用)。 */
function stripParen(s: string): string {
  return s.replace(/（[^）]*）/g, "");
}

/** 「竇氏〔孝文竇皇后〕」→「竇氏」。ノード表示は短名にし、全名はツールチップで示す。 */
function shortName(s: string): string {
  const t = s.replace(/〔[^〕]*〕/g, "");
  return t.length > 0 ? t : s;
}

export function buildKinshipLayout(src: KinshipSource): KinshipChapterLayout[] {
  const emperorById = new Map(src.emperors.map((e) => [e.id, e]));
  const personById = new Map(src.persons.map((p) => [p.id, p]));
  const claimByClaimant = new Map(src.claims.map((c) => [c.claimant, c]));

  // --- 主親(実父/養父)の解決: succession先代と同一 > 養父 > 実父。 ---
  // verifiedを優先し、disputedしか無ければdisputedを主親にする(垂下線を点線化)。
  const fatherEdges = new Map<string, KinshipSourceEdge[]>();
  for (const e of src.edges) {
    if (e.type !== "kinship" || (e.relation !== "実父" && e.relation !== "養父")) continue;
    fatherEdges.set(e.to, [...(fatherEdges.get(e.to) ?? []), e]);
  }
  const successionFrom = new Map<string, string>();
  for (const e of src.edges) {
    if (e.type === "succession") successionFrom.set(e.to, e.from);
  }
  const primaryFather = new Map<string, string>();
  const primaryFatherDisputed = new Set<string>(); // childId
  for (const [child, edges] of fatherEdges) {
    const score = (e: KinshipSourceEdge): number =>
      (e.from === successionFrom.get(child) ? 4 : 0) +
      (e.relation === "養父" ? 2 : 0) +
      (e.veracity === "verified" ? 1 : 0);
    const best = [...edges].sort((p, q) => score(q) - score(p))[0];
    primaryFather.set(child, best.from);
    if (best.veracity !== "verified") primaryFatherDisputed.add(child);
  }

  // --- 実母・養母・婚姻: 配偶者attach(母は子の主親の脇へ、婚姻相手は夫の脇へ) ---
  const motherEdges = src.edges.filter(
    (e) => e.type === "kinship" && (e.relation === "実母" || e.relation === "養母"),
  );
  const marriageEdges = src.edges.filter((e) => e.type === "marriage");
  // attachedTo: 女性人物id → 夫(配置ノード)id
  const attachedTo = new Map<string, string>();
  const attachDouble = new Map<string, boolean>(); // 婚姻エッジあり=皇后
  for (const e of marriageEdges) {
    // marriageは無向。人物側(p-)と配置側の組を判定: 女性(persons)を夫に付ける。
    const pa = personById.get(e.from);
    const pb = personById.get(e.to);
    const wife = pa?.female ? e.from : pb?.female ? e.to : null;
    if (!wife) continue;
    const husband = wife === e.from ? e.to : e.from;
    attachedTo.set(wife, husband);
    attachDouble.set(wife, true);
  }
  for (const e of motherEdges) {
    if (e.relation !== "実母") continue;
    const mother = e.from;
    if (attachedTo.has(mother)) continue;
    const father = primaryFather.get(e.to);
    if (father !== undefined && (emperorById.has(father) || personById.has(father))) {
      attachedTo.set(mother, father);
      attachDouble.set(mother, false);
    }
  }
  // 養母も夫(=子の主親)の脇に置く(明帝の馬皇后など)。子への線は補助点線。
  for (const e of motherEdges) {
    if (e.relation !== "養母") continue;
    const mother = e.from;
    if (attachedTo.has(mother)) continue;
    const father = primaryFather.get(e.to);
    if (father !== undefined && (emperorById.has(father) || personById.has(father))) {
      attachedTo.set(mother, father);
      attachDouble.set(mother, false);
    }
  }
  // childId → 実母id(attach済みのもののみ。junctionのグループ分けに使う)
  const motherOf = new Map<string, string>();
  for (const e of motherEdges) {
    if (e.relation === "実母" && attachedTo.has(e.from)) motherOf.set(e.to, e.from);
  }

  // --- childOrder ---
  // 兄弟の並び順はアンカー年(在位・生没からの代表位置)を基本とし、明示指定
  // (CHILD_ORDER_OVERRIDES)だけを優先キーにする。データのchildOrder(排行)は兄弟の
  // 一部にしか付いておらず、付いている子だけが端に寄って時系列が壊れるため使わない。
  const childOrderOf = new Map<string, number>(
    Object.entries(CHILD_ORDER_OVERRIDES),
  );

  // --- 配置アンカー年の推定(スコープ全体で1回。緩和反復) ---
  const est = new Map<string, number>();
  for (const e of src.emperors) {
    est.set(e.id, (e.reigns[0].a + e.reigns[e.reigns.length - 1].b) / 2);
  }
  const unknown: string[] = [];
  for (const p of src.persons) {
    if (p.birthYear !== null && p.deathYear !== null)
      est.set(p.id, (p.birthYear + p.deathYear) / 2);
    else if (p.birthYear !== null) est.set(p.id, p.birthYear);
    else if (p.deathYear !== null) est.set(p.id, p.deathYear);
    else unknown.push(p.id);
  }
  if (unknown.length > 0) {
    const neighbors = new Map<string, string[]>();
    for (const e of src.edges) {
      neighbors.set(e.from, [...(neighbors.get(e.from) ?? []), e.to]);
      neighbors.set(e.to, [...(neighbors.get(e.to) ?? []), e.from]);
    }
    for (let i = 0; i < 200; i++) {
      for (const id of unknown) {
        const vals = (neighbors.get(id) ?? [])
          .map((n) => est.get(n))
          .filter((v): v is number => v !== undefined);
        if (vals.length > 0) est.set(id, vals.reduce((s, v) => s + v, 0) / vals.length);
      }
    }
    for (const id of unknown) {
      if (!est.has(id))
        throw new Error(
          `kinship/layout: ${id} の配置年を推定できません(年の判明したノードにエッジで到達しない)`,
        );
    }
  }

  // --- バンド跨ぎの「単独人物 → 妃」親エッジの水平整列 ---
  // 王禁→王政君(元帝の皇后)のように、別バンドの人物から妃へ引く親エッジは、
  // 人物側の配置年を妃の描画位置(夫カプセル上部)に揃える。これで補助線が
  // 曲がりのない水平1本の直線になる(実際の生没年はツールチップで示す)。
  {
    const consortAlignYears =
      (NODE_GAP / 2 + 6 + CONSORT_H / 2) / PX_PER_YEAR;
    for (const e of src.edges) {
      if (e.type !== "kinship") continue;
      if (e.relation !== "実父" && e.relation !== "実母") continue;
      if (!personById.has(e.from) || attachedTo.has(e.from)) continue;
      const husband = attachedTo.get(e.to);
      if (husband === undefined) continue;
      const h = emperorById.get(husband);
      if (!h) continue;
      est.set(e.from, h.reigns[0].a + consortAlignYears);
    }
  }

  // --- 家系図の上下整合 ---
  // 人物ノードの配置年は「代表位置」(生没中点等)に過ぎず、親の死年が子の在位中に
  // かかる等で主親子の上下(親が上)が崩れることがある。皇帝の在位は動かせないため、
  // 人物側の配置年を動かして整合させる(実際の生没年はツールチップで示す)。
  // 下方向(皇帝の親より子の人物を下へ)→上方向(子より親の人物を上へ)の順で数回
  // 反復し、上方向を最後にする(親が上に見えることを優先。残る食い込みは
  // tree.tsの実効区間カーソルが吸収する)。
  {
    const GAP_YEARS = PERSON_HALF_SPAN + NODE_GAP / PX_PER_YEAR;
    const depth = new Map<string, number>();
    const depthOf = (id: string): number => {
      const cached = depth.get(id);
      if (cached !== undefined) return cached;
      const f = primaryFather.get(id);
      const d = f === undefined ? 0 : depthOf(f) + 1;
      depth.set(id, d);
      return d;
    };
    const treeEdges = [...primaryFather.entries()].map(([child, father]) => ({
      child,
      father,
      d: depthOf(child),
    }));
    const topOf = (id: string): number => {
      const e = emperorById.get(id);
      return e ? e.reigns[0].a : est.get(id)! - PERSON_HALF_SPAN;
    };
    const bottomOf = (id: string): number => {
      const e = emperorById.get(id);
      return e ? e.reigns[e.reigns.length - 1].b : est.get(id)! + PERSON_HALF_SPAN;
    };
    for (let i = 0; i < 10; i++) {
      for (const e of [...treeEdges].sort((p, q) => p.d - q.d)) {
        if (!personById.has(e.child)) continue;
        const minAnchor = bottomOf(e.father) + GAP_YEARS;
        if (est.get(e.child)! < minAnchor) est.set(e.child, minAnchor);
      }
      for (const e of [...treeEdges].sort((p, q) => q.d - p.d)) {
        if (!personById.has(e.father)) continue;
        const maxAnchor = topOf(e.child) - GAP_YEARS;
        if (est.get(e.father)! > maxAnchor) est.set(e.father, maxAnchor);
      }
    }
  }

  // --- 章ごとのレイアウト ---
  const chapters: KinshipChapterLayout[] = [];
  for (const chapterId of KINSHIP_ENABLED_CHAPTER_IDS) {
    const def = KINSHIP_CHAPTER_DEFS.find((c) => c.id === chapterId);
    if (!def || def.bands.length === 0)
      throw new Error(`kinship/layout: 章 "${chapterId}" のバンドが未定義です`);
    chapters.push(
      buildChapter(def, src, {
        emperorById,
        personById,
        claimByClaimant,
        primaryFather,
        primaryFatherDisputed,
        attachedTo,
        attachDouble,
        motherOf,
        childOrderOf,
        est,
      }),
    );
  }
  return chapters;
}

interface ResolvedRelations {
  emperorById: Map<string, KinshipSourceEmperor>;
  personById: Map<string, KinshipSourcePerson>;
  claimByClaimant: Map<string, KinshipSourceClaim>;
  primaryFather: Map<string, string>;
  primaryFatherDisputed: Set<string>;
  attachedTo: Map<string, string>;
  attachDouble: Map<string, boolean>;
  motherOf: Map<string, string>;
  childOrderOf: Map<string, number>;
  est: Map<string, number>;
}

function buildChapter(
  def: (typeof KINSHIP_CHAPTER_DEFS)[number],
  src: KinshipSource,
  rel: ResolvedRelations,
): KinshipChapterLayout {
  const bandOfDynKey = new Map<string, number>();
  def.bands.forEach((b, i) => {
    for (const dk of b.dynastyKeys) {
      if (bandOfDynKey.has(dk))
        throw new Error(`kinship/layout: dynastyKeyがバンド間で重複: "${dk}"`);
      bandOfDynKey.set(dk, i);
    }
  });
  const bandOfLabel = new Map(def.bands.map((b, i) => [b.label, i]));

  // --- 章の皇帝(=バンドのdynastyKeyに属するもの) ---
  const chapterEmperors = src.emperors.filter((e) => bandOfDynKey.has(e.dynastyKey));
  const bandOfNode = new Map<string, number>();
  for (const e of chapterEmperors) bandOfNode.set(e.id, bandOfDynKey.get(e.dynastyKey)!);

  // --- ブリッジ人物のバンド帰属: 主親→主子→隣接の順で伝播し、明示指定が最優先 ---
  const standalonePersons = src.persons.filter((p) => !rel.attachedTo.has(p.id));
  const childrenGlobal = new Map<string, string[]>();
  for (const [child, father] of rel.primaryFather) {
    childrenGlobal.set(father, [...(childrenGlobal.get(father) ?? []), child]);
  }
  for (const p of standalonePersons) {
    const ov = PERSON_BAND_OVERRIDES[p.id];
    if (ov !== undefined) {
      const b = bandOfLabel.get(ov);
      if (b !== undefined) bandOfNode.set(p.id, b);
    }
  }
  for (let pass = 0; pass < 30; pass++) {
    let changed = false;
    for (const p of standalonePersons) {
      if (bandOfNode.has(p.id)) continue;
      const father = rel.primaryFather.get(p.id);
      let b = father !== undefined ? bandOfNode.get(father) : undefined;
      if (b === undefined) {
        for (const c of childrenGlobal.get(p.id) ?? []) {
          b = bandOfNode.get(c);
          if (b !== undefined) break;
        }
      }
      if (b !== undefined) {
        bandOfNode.set(p.id, b);
        changed = true;
      }
    }
    if (!changed) break;
  }
  // 残り(親子経由で決まらない)はエッジの隣接から。それでも決まらなければ章スコープ外。
  for (const p of standalonePersons) {
    if (bandOfNode.has(p.id)) continue;
    for (const e of src.edges) {
      const other = e.from === p.id ? e.to : e.to === p.id ? e.from : null;
      if (other === null) continue;
      const b = bandOfNode.get(other);
      if (b !== undefined) {
        bandOfNode.set(p.id, b);
        break;
      }
    }
  }

  // --- バンドごとの家系図グラフを構築してパッキング ---
  const info = new Map<string, KinNodeInfo>();
  for (const e of chapterEmperors) {
    if (e.reigns.length !== 1)
      throw new Error(
        `kinship/layout: ${e.id} は複数在位です。複数カプセル+コネクタはフェーズ2で実装します`,
      );
    info.set(e.id, {
      id: e.id,
      isEmperor: true,
      name: e.name,
      female: e.female,
      anchor: rel.est.get(e.id)!,
      reign: { a: e.reigns[0].a, b: e.reigns[0].b },
    });
  }
  for (const p of src.persons) {
    if (!bandOfNode.has(p.id) && !rel.attachedTo.has(p.id)) continue;
    info.set(p.id, {
      id: p.id,
      isEmperor: false,
      // 幅計算・表示は短名(「竇氏〔孝文竇皇后〕」→「竇氏」)。全名はツールチップ。
      name: shortName(p.name),
      female: p.female,
      anchor: rel.est.get(p.id)!,
    });
  }

  const packed: PackedBand[] = def.bands.map((bandDef, bi) => {
    const memberIds = [...bandOfNode.entries()]
      .filter(([, b]) => b === bi)
      .map(([id]) => id);
    const bandFather = new Map<string, string>();
    for (const id of memberIds) {
      const f = rel.primaryFather.get(id);
      if (f !== undefined && bandOfNode.get(f) === bi) bandFather.set(id, f);
    }
    const spousesOf = new Map<string, SpouseAttach[]>();
    for (const [wife, husband] of rel.attachedTo) {
      if (bandOfNode.get(husband) !== bi) continue;
      if (!info.has(wife)) continue;
      spousesOf.set(husband, [
        ...(spousesOf.get(husband) ?? []),
        { id: wife, double: rel.attachDouble.get(wife) ?? false },
      ]);
    }
    const g: BandGraph = {
      label: bandDef.label,
      memberIds,
      info,
      primaryFather: bandFather,
      spousesOf,
      childOrderOf: rel.childOrderOf,
      motherOf: rel.motherOf,
    };
    return packBand(g);
  });

  // --- バンドのx配置と年→px写像 ---
  // 単純な横一列(累積幅)ではなく、年代が重ならないバンドは同じx空間(列)を
  // 共有する(仲家=後漢末のような単発の群雄バンドが右へ一直線に伸びるのを防ぐ。
  // バンドの前後関係は縦=時間が示す)。バンドの各矩形は「年代が重なる既配置
  // 矩形すべての右」に置く — 左側の空きポケットへ滑り込ませると、そのバンドへ
  // 渡る線が既存バンドの中身を横切るため許さない。判定は年空間(yOfの単調性に
  // より、年で離れていればpxでも離れる)。
  const bandXs: number[] = [];
  {
    interface BRect {
      x0: number;
      x1: number;
      y0: number;
      y1: number;
    }
    const placedRects: BRect[] = [];
    const V_PAD = NODE_GAP / PX_PER_YEAR;
    for (const pb of packed) {
      const rects: BRect[] = pb.items.map((it) => ({
        x0: it.cx - it.w / 2,
        x1: it.cx + it.w / 2,
        y0: it.effStart,
        y1: it.effEnd,
      }));
      let x = AXIS_X + 24;
      for (const b of rects) {
        for (const a of placedRects) {
          const yOverlap = a.y0 < b.y1 + V_PAD && b.y0 < a.y1 + V_PAD;
          if (yOverlap) x = Math.max(x, a.x1 + BAND_GAP - b.x0);
        }
      }
      bandXs.push(x);
      placedRects.push(
        ...rects.map((r) => ({ x0: r.x0 + x, x1: r.x1 + x, y0: r.y0, y1: r.y1 })),
      );
    }
  }
  const constraints: YearSpanConstraint[] = packed.flatMap((pb) =>
    pb.items.map((it) => ({ start: it.effStart, end: it.effEnd, minPx: it.minPx })),
  );
  const scale = buildYearScale(constraints, PX_PER_YEAR, M_TOP);
  const { yOf } = scale;

  const nameOf = (id: string): string =>
    rel.emperorById.get(id)?.name ?? rel.personById.get(id)?.name ?? id;

  // --- ノード矩形の確定 ---
  interface PlacedRect {
    x: number;
    y: number;
    w: number;
    h: number;
    cx: number;
    bandIndex: number;
  }
  const rectById = new Map<string, PlacedRect>();
  const nodes: KinshipNodeOut[] = [];
  packed.forEach((pb, bi) => {
    for (const it of pb.items) {
      const isConsort = it.role === "consort";
      const nodeInfo = info.get(it.id)!;
      const top = yOf(it.effStart) + NODE_GAP / 2;
      const bottom = yOf(it.effEnd) - NODE_GAP / 2;
      // 皇帝カプセルは実効区間いっぱい(高さ=在位期間)。人物は固定高で区間中央。
      // 配偶者は夫カプセルの「上部」にpx整列する(子は必ず夫の下端より後に始まるため、
      // 連結線を子グループの真上まで伸ばしても子や垂下帯と交差しない)。
      let h: number;
      let y: number;
      if (isConsort) {
        h = Math.min(CONSORT_H, bottom - top);
        const husband = it.attachedTo !== undefined ? rectById.get(it.attachedTo) : undefined;
        if (husband !== undefined && info.get(it.attachedTo!)?.isEmperor) {
          y = husband.y + 6;
        } else if (husband !== undefined) {
          y = husband.y + husband.h / 2 - h / 2;
        } else {
          y = (top + bottom) / 2 - h / 2;
        }
      } else if (nodeInfo.isEmperor) {
        h = bottom - top;
        y = top;
      } else {
        h = Math.min(PERSON_H, bottom - top);
        y = (top + bottom) / 2 - h / 2;
      }
      const r: PlacedRect = {
        x: bandXs[bi] + it.cx - it.w / 2,
        y,
        w: it.w,
        h,
        cx: bandXs[bi] + it.cx,
        bandIndex: bi,
      };
      rectById.set(it.id, r);
      nodes.push(buildNode(it.id, isConsort, r, src, rel));
    }
  });

  // --- 品質ゲート用: 描いた線分(縦横のみ)を集めて後段でノード横断を検査する ---
  interface QSeg {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    /** この線の当事者(横断チェックから除外するノードid)。 */
    ids: string[];
    what: string;
  }
  const qsegs: QSeg[] = [];

  // --- 夫婦の連結線 ---
  const ties: KinshipTieOut[] = [];
  const tieYOf = new Map<string, number>(); // spouseId → tie y
  packed.forEach((pb, bi) => {
    for (const t of pb.ties) {
      const s = rectById.get(t.spouseId);
      if (!s) continue;
      const y = s.y + s.h / 2;
      ties.push({
        husbandId: t.husbandId,
        spouseId: t.spouseId,
        x1: bandXs[bi] + t.x1,
        x2: bandXs[bi] + t.x2,
        y,
        double: t.double,
      });
      qsegs.push({
        x1: bandXs[bi] + t.x1,
        y1: y,
        x2: bandXs[bi] + t.x2,
        y2: y,
        ids: [t.husbandId, t.spouseId],
        what: `連結線 ${t.husbandId}═${t.spouseId}`,
      });
      tieYOf.set(t.spouseId, y);
    }
  });

  // --- 垂下線(junction) ---
  const drops: KinshipDropOut[] = [];
  packed.forEach((pb, bi) => {
    for (const j of pb.junctions) {
      const father = rectById.get(j.fatherId);
      if (!father) continue;
      const jx = bandXs[bi] + j.x;
      let topY: number;
      if (j.motherId !== null && tieYOf.has(j.motherId)) {
        topY = tieYOf.get(j.motherId)!;
      } else {
        topY = father.y + father.h;
      }
      const kids = j.children
        .map((c) => rectById.get(c))
        .filter((r): r is PlacedRect => r !== undefined);
      if (kids.length === 0) continue;
      const minKidTop = Math.min(...kids.map((k) => k.y));
      // バーは最年長の子の直上。親と子が接している場合も子の枠内には入れない。
      const barY = Math.min(Math.max(minKidTop - 10, topY + 6), minKidTop - 2);
      const groupIds = [
        j.fatherId,
        ...(j.motherId !== null ? [j.motherId] : []),
        ...j.children,
      ];
      // 垂下点が子の真上に揃っている単独子は1本の直線で落とす(無駄な段差を作らない)。
      if (kids.length === 1 && Math.abs(kids[0].cx - jx) < 4) {
        drops.push({
          path: `M ${jx} ${topY} L ${jx} ${kids[0].y}`,
          dashed: rel.primaryFatherDisputed.has(j.children[0]),
          ids: groupIds,
        });
        qsegs.push({
          x1: jx,
          y1: topY,
          x2: jx,
          y2: kids[0].y,
          ids: groupIds,
          what: `垂下線 ${j.fatherId}→${j.children[0]}`,
        });
        continue;
      }
      const spineParts = [`M ${jx} ${topY} L ${jx} ${barY}`];
      qsegs.push({
        x1: jx,
        y1: topY,
        x2: jx,
        y2: barY,
        ids: groupIds,
        what: `垂下線 ${j.fatherId}(縦)`,
      });
      const barX0 = Math.min(jx, ...kids.map((k) => k.cx));
      const barX1 = Math.max(jx, ...kids.map((k) => k.cx));
      if (barX1 - barX0 > 0.5) {
        spineParts.push(`M ${barX0} ${barY} L ${barX1} ${barY}`);
        qsegs.push({
          x1: barX0,
          y1: barY,
          x2: barX1,
          y2: barY,
          ids: groupIds,
          what: `兄弟バー ${j.fatherId}`,
        });
      }
      drops.push({ path: spineParts.join(" "), dashed: false, ids: groupIds });
      for (const c of j.children) {
        const k = rectById.get(c);
        if (!k) continue;
        drops.push({
          path: `M ${k.cx} ${barY} L ${k.cx} ${k.y}`,
          dashed: rel.primaryFatherDisputed.has(c),
          ids: [j.fatherId, ...(j.motherId !== null ? [j.motherId] : []), c],
        });
        qsegs.push({
          x1: k.cx,
          y1: barY,
          x2: k.cx,
          y2: k.y,
          ids: groupIds,
          what: `垂下線 ${j.fatherId}→${c}`,
        });
      }
    }
  });

  // --- 構造で表現済みのエッジを控除し、残りを補助エッジ/矢印にする ---
  const structuralParent = new Set<string>(); // `${father}→${child}` 同一バンドの主親
  packed.forEach((pb) => {
    for (const j of pb.junctions) {
      for (const c of j.children) structuralParent.add(`${j.fatherId}→${c}`);
    }
  });

  const auxEdges: KinshipAuxOut[] = [];
  const arrows: KinshipArrowOut[] = [];

  const curvePath = (a: PlacedRect, b: PlacedRect): string => {
    // 矢印(王朝間交代)用: 上→下が成り立てば縦ベジェ、成り立たなければ側面どうしの
    // 水平ベジェ。
    if (a.y + a.h < b.y - 4 && Math.abs(a.cx - b.cx) < 600) {
      const y1 = a.y + a.h;
      const y2 = b.y;
      const my = (y1 + y2) / 2;
      return `M ${a.cx} ${y1} C ${a.cx} ${my}, ${b.cx} ${my}, ${b.cx} ${y2}`;
    }
    const leftToRight = a.cx < b.cx;
    const x1 = leftToRight ? a.x + a.w : a.x;
    const x2 = leftToRight ? b.x : b.x + b.w;
    const y1 = a.y + a.h / 2;
    const y2 = b.y + b.h / 2;
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  };

  // 補助エッジ(血縁)用: 家系図の直交線に揃えたポリライン(点列)。無用な曲がりを
  // 避け、水平区間は到達先の直前(枠の外)を通す。到達点は垂下線(cx)と重ならないよう
  // 10pxずらす。
  const orthoPoints = (a: PlacedRect, b: PlacedRect): [number, number][] => {
    // 中心の高さが揃っていて左右に離れている場合は、曲がりのない水平1本で結ぶ
    // (王禁→王政君など。整列は上のconsortAlignYearsパスで作る)。
    const acy = a.y + a.h / 2;
    const bcy = b.y + b.h / 2;
    if (
      Math.abs(acy - bcy) <= 4 &&
      (a.x >= b.x + b.w || b.x >= a.x + a.w)
    ) {
      const leftToRight = a.cx < b.cx;
      return [
        [leftToRight ? a.x + a.w : a.x, bcy],
        [leftToRight ? b.x : b.x + b.w, bcy],
      ];
    }
    const enterX = b.cx + (a.cx <= b.cx ? -10 : 10);
    if (b.y - (a.y + a.h) >= 14) {
      // 通常: 上の親から下の子へ(下辺→水平→上辺)。
      const laneY = b.y - 6;
      return [
        [a.cx, a.y + a.h],
        [a.cx, laneY],
        [enterX, laneY],
        [enterX, b.y],
      ];
    }
    if (a.y - (b.y + b.h) >= 14) {
      // 到達先が上にある場合(王莽→孝平王皇后など)は下辺側から入る。
      const laneY = b.y + b.h + 6;
      return [
        [a.cx, a.y],
        [a.cx, laneY],
        [enterX, laneY],
        [enterX, b.y + b.h],
      ];
    }
    // 年代が重なる場合は側面どうしを水平に結ぶ(到達側の直前で縦にずらす)。
    const leftToRight = a.cx < b.cx;
    const x1 = leftToRight ? a.x + a.w : a.x;
    const x2 = leftToRight ? b.x : b.x + b.w;
    const y1 = a.y + a.h / 2;
    const y2 = b.y + b.h / 2;
    const jogX = leftToRight ? x2 - 12 : x2 + 12;
    return [
      [x1, y1],
      [jogX, y1],
      [jogX, y2],
      [x2, y2],
    ];
  };
  const toPath = (pts: [number, number][]): string =>
    pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  const pushAuxSegs = (
    pts: [number, number][],
    ids: string[],
    what: string,
  ): void => {
    for (let i = 1; i < pts.length; i++) {
      qsegs.push({
        x1: pts[i - 1][0],
        y1: pts[i - 1][1],
        x2: pts[i][0],
        y2: pts[i][1],
        ids,
        what,
      });
    }
  };
  const orthoPath = (a: PlacedRect, b: PlacedRect, ids: string[], what: string): string => {
    const pts = orthoPoints(a, b);
    pushAuxSegs(pts, ids, what);
    return toPath(pts);
  };

  // 人物の「王朝コンテキスト」: 皇帝=dynastyKey、人物=所属バンドの先頭dynastyKey。
  const dynContext = (id: string): string => {
    const e = rel.emperorById.get(id);
    if (e) return e.dynastyKey;
    const b = bandOfNode.get(id);
    return b !== undefined ? def.bands[b].dynastyKeys[0] : "";
  };

  for (const e of src.edges) {
    const a = rectById.get(e.from);
    const b = rectById.get(e.to);
    if (!a || !b) continue; // 端点が章スコープ外
    if (e.type === "succession") {
      if (dynContext(e.from) === dynContext(e.to)) continue; // カプセル内表記で示す
      const disputed = e.veracity === "disputed";
      const relLabel =
        e.relationToPredecessor &&
        !["子", "不明"].includes(e.relationToPredecessor)
          ? `・${stripParen(e.relationToPredecessor)}`
          : "";
      const label = `${e.category ?? ""}${disputed ? "?" : ""}${relLabel}`;
      const path = curvePath(a, b);
      // ラベル位置: 縦の矢印は中間。横の矢印は「ノード枠間の空隙」の中央・線の上
      // (ノード中心間の中点だと、短い矢印でラベルがカプセルの下に隠れる)。
      const vertical = a.y + a.h < b.y - 4 && Math.abs(a.cx - b.cx) < 600;
      let midX: number;
      let midY: number;
      if (vertical) {
        midX = (a.cx + b.cx) / 2;
        midY = (a.y + a.h + b.y) / 2 - 5;
      } else {
        const leftToRight = a.cx < b.cx;
        midX = ((leftToRight ? a.x + a.w : a.x) + (leftToRight ? b.x : b.x + b.w)) / 2;
        midY = Math.min(a.y + a.h / 2, b.y + b.h / 2) - 8;
      }
      arrows.push({
        key: `s:${e.from}→${e.to}`,
        fromId: e.from,
        toId: e.to,
        path,
        label,
        labelX: midX,
        labelY: midY,
        disputed,
        tipLines: [
          { text: `王朝交代〔${e.category}〕${disputed ? "（諸説あり）" : ""}` },
          {
            text: `${nameOf(e.from)} → ${nameOf(e.to)}／新帝は先代の${e.relationToPredecessor ?? "不明"}／確度: ${e.confidence}`,
            muted: true,
          },
          ...(e.noteExcerpt ? [{ text: e.noteExcerpt, muted: true }] : []),
          ...(e.sourcePage ? [{ text: `出典: ${e.sourcePage}`, muted: true }] : []),
        ],
      });
      continue;
    }
    if (e.type === "marriage") {
      if (rel.attachedTo.has(e.from) || rel.attachedTo.has(e.to)) continue; // 連結線で表現済み
      auxEdges.push({
        key: `m:${e.from}→${e.to}`,
        fromId: e.from,
        toId: e.to,
        path: orthoPath(a, b, [e.from, e.to], `婚姻 ${e.from}═${e.to}`),
        dashed: false,
        disputed: false,
        marriage: true,
        tipLines: [
          { text: "婚姻" },
          { text: `${nameOf(e.from)} ═ ${nameOf(e.to)}`, muted: true },
          ...(e.noteExcerpt ? [{ text: e.noteExcerpt, muted: true }] : []),
        ],
      });
      continue;
    }
    // kinship
    if (e.relation === "実父" || e.relation === "養父") {
      if (
        structuralParent.has(`${e.from}→${e.to}`) &&
        rel.primaryFather.get(e.to) === e.from
      )
        continue; // 垂下線で表現済み
      if (rel.primaryFather.get(e.to) === e.from) {
        // 主親だがバンドをまたぐ(劉欽→光武帝など): 補助線1本で結ぶ。
        auxEdges.push(kinAux(e, a, b, false));
        continue;
      }
      // 副親(disputed実父・養父): 点線の補助線。
      auxEdges.push(kinAux(e, a, b, true));
      continue;
    }
    if (e.relation === "実母" || e.relation === "養母") {
      const father = rel.primaryFather.get(e.to);
      // 実母が子の主親(父)の配偶者としてattach済みなら、同一バンドでは母別の
      // 垂下グループ、バンド跨ぎでは父からの補助線1本で表現済み(母から重複して
      // 引かない。劉欽═樊嫻都→光武帝のような跨ぎで線が二重になるのを防ぐ)。
      if (
        e.relation === "実母" &&
        father !== undefined &&
        rel.attachedTo.get(e.from) === father
      )
        continue;
      // 夫の垂下に含まれない母子(養母・バンド跨ぎ等)は点線の補助線。
      auxEdges.push(kinAux(e, a, b, e.relation === "養母"));
      continue;
    }
    // 兄弟姉妹など: 補助線。
    auxEdges.push(kinAux(e, a, b, true));
  }

  function kinAux(
    e: KinshipSourceEdge,
    a: PlacedRect,
    b: PlacedRect,
    dashed: boolean,
  ): KinshipAuxOut {
    const disputed = e.veracity === "disputed";
    return {
      key: `k:${e.from}→${e.to}:${e.relation}`,
      fromId: e.from,
      toId: e.to,
      path: orthoPath(a, b, [e.from, e.to], `血縁 ${e.from}→${e.to}〔${e.relation}〕`),
      dashed: dashed || disputed,
      disputed,
      marriage: false,
      tipLines: [
        { text: `血縁〔${e.relation}〕${disputed ? "（諸説あり）" : ""}` },
        { text: `${nameOf(e.from)} → ${nameOf(e.to)}／確度: ${e.confidence}`, muted: true },
        ...(e.noteExcerpt ? [{ text: e.noteExcerpt, muted: true }] : []),
        ...(e.sourcePage ? [{ text: `出典: ${e.sourcePage}`, muted: true }] : []),
      ],
    };
  }

  // --- 品質ゲート: 線が当事者以外のノードを横切っていたらビルドを落とす ---
  // (「無駄な線の曲がり・線が他のものを横切るのは禁止」のハード制約化。
  //  横断が出る配置はキュレーション(バンド順・CHILD_ORDER_OVERRIDES)や
  //  ルーティングの修正で解消してからでないとビルドできない)
  {
    const violations: string[] = [];
    for (const seg of qsegs) {
      const sx0 = Math.min(seg.x1, seg.x2);
      const sx1 = Math.max(seg.x1, seg.x2);
      const sy0 = Math.min(seg.y1, seg.y2);
      const sy1 = Math.max(seg.y1, seg.y2);
      for (const [nid, r] of rectById) {
        if (seg.ids.includes(nid)) continue;
        const rx0 = r.x + 1.5;
        const rx1 = r.x + r.w - 1.5;
        const ry0 = r.y + 1.5;
        const ry1 = r.y + r.h - 1.5;
        if (sx0 < rx1 && sx1 > rx0 && sy0 < ry1 && sy1 > ry0) {
          violations.push(
            `${seg.what} が ${nameOf(nid)}(${nid}) を横断 [seg(${seg.x1.toFixed(0)},${seg.y1.toFixed(0)})-(${seg.x2.toFixed(0)},${seg.y2.toFixed(0)}) rect(${r.x.toFixed(0)},${r.y.toFixed(0)},w${r.w.toFixed(0)},h${r.h.toFixed(0)})]`,
          );
        }
      }
    }
    // ノードどうしの重なりも禁止(アンカー調整・チェーン押し下げの副作用を検出する)。
    const placedAll = [...rectById.entries()];
    for (let i = 0; i < placedAll.length; i++) {
      for (let j = i + 1; j < placedAll.length; j++) {
        const [pid, p] = placedAll[i];
        const [qid, q] = placedAll[j];
        if (
          p.x + 1 < q.x + q.w - 1 &&
          q.x + 1 < p.x + p.w - 1 &&
          p.y + 1 < q.y + q.h - 1 &&
          q.y + 1 < p.y + p.h - 1
        ) {
          violations.push(
            `ノードが重なっています ${nameOf(pid)}(${pid}) × ${nameOf(qid)}(${qid}) [rect(${p.x.toFixed(0)},${p.y.toFixed(0)},w${p.w.toFixed(0)},h${p.h.toFixed(0)}) rect(${q.x.toFixed(0)},${q.y.toFixed(0)},w${q.w.toFixed(0)},h${q.h.toFixed(0)})]`,
          );
        }
      }
    }
    if (violations.length > 0) {
      throw new Error(
        `kinship/layout: 章「${def.title}」で線がノードを横切っています(${violations.length}件):\n` +
          violations.join("\n"),
      );
    }
  }

  // --- バンド見出し・王朝見出し・目盛り ---
  const bands = def.bands.map((b, i) => {
    const bandNodes = packed[i].items.map((it) => rectById.get(it.id)!);
    const topY = Math.min(...bandNodes.map((n) => n.y));
    return {
      label: b.label,
      x: bandXs[i],
      width: packed[i].width,
      labelY: topY - 34,
    };
  });
  // 王朝見出しは複数王朝が同居するバンドのみ(単独王朝バンドはバンド見出しで足りる)。
  // 位置は最初のカプセルの左肩(中央上は垂下線が通るため、文字と線が必ず被る)。
  const dynastyHeads: { label: string; x: number; y: number }[] = [];
  for (const bandDef of def.bands) {
    if (bandDef.dynastyKeys.length < 2) continue;
    for (const dk of bandDef.dynastyKeys) {
      const first = chapterEmperors
        .filter((e) => e.dynastyKey === dk)
        .map((e) => ({ e, r: rectById.get(e.id)! }))
        .filter((x) => x.r !== undefined)
        .sort((p, q) => p.r.y - q.r.y)[0];
      if (!first) continue;
      dynastyHeads.push({
        label: dk.split("__")[0],
        x: first.r.x,
        y: first.r.y - 7,
      });
    }
  }

  // 目盛り(歴史年の25年刻み。0年は暦に存在しないため1年へ置換)。
  const ticks: { y: number; label: string }[] = [];
  for (let h = Math.ceil(fromAstroYear(scale.minYear) / 25) * 25; ; h += 25) {
    const hist = h === 0 ? 1 : h;
    const astro = hist < 0 ? hist + 1 : hist;
    if (astro > scale.maxYear) break;
    if (astro < scale.minYear) continue;
    ticks.push({ y: yOf(astro), label: formatYear(hist) });
  }

  const height =
    Math.max(...[...rectById.values()].map((r) => r.y + r.h), yOf(scale.maxYear)) +
    M_BOTTOM;
  // バンドは列共有で最後のバンドが右端とは限らないため、全バンドの右端の最大をとる。
  const width =
    Math.max(...packed.map((pb, i) => bandXs[i] + pb.width)) + 60;

  // --- テキスト版 ---
  const textDynasties: { label: string; emperors: KinshipTextEmperor[] }[] = [];
  for (const bandDef of def.bands) {
    for (const dk of bandDef.dynastyKeys) {
      const list = chapterEmperors
        .filter((e) => e.dynastyKey === dk)
        .sort((p, q) => p.reigns[0].a - q.reigns[0].a);
      if (list.length === 0) continue;
      textDynasties.push({
        label: dk.split("__")[0],
        emperors: list.map((e) => {
          const fatherId = rel.primaryFather.get(e.id);
          const motherId = rel.motherOf.get(e.id);
          const succ = src.edges.find((x) => x.type === "succession" && x.to === e.id);
          const parts: string[] = [];
          if (fatherId) parts.push(`父: ${nameOf(fatherId)}`);
          if (motherId) parts.push(`母: ${nameOf(motherId)}`);
          if (succ?.relationToPredecessor)
            parts.push(`先代の${succ.relationToPredecessor}`);
          return {
            id: e.id,
            label: e.name,
            sub: `${ordinalLabel(e.ordinals[0])}・${succ?.category ?? e.routeCategory}`,
            detail: parts.join("／"),
          };
        }),
      });
    }
  }
  const textTransitions = arrows.map(
    (a) => `${nameOf(a.fromId)} →〔${a.label}〕 ${nameOf(a.toId)}`,
  );
  const claims = src.claims
    .filter((c) => rectById.has(c.claimant))
    .map((c) => ({
      claimant: nameOf(c.claimant),
      ancestry: c.claimedAncestry,
      note: c.noteExcerpt,
      source: c.sourcePage,
    }));

  return {
    id: def.id,
    title: def.title,
    period: def.period,
    width,
    height,
    axisX: AXIS_X,
    ticks,
    bands,
    dynastyHeads,
    nodes,
    ties,
    drops,
    auxEdges,
    arrows,
    textDynasties,
    textTransitions,
    claims,
  };

  function buildNode(
    id: string,
    isConsort: boolean,
    r: PlacedRect,
    src2: KinshipSource,
    rel2: ResolvedRelations,
  ): KinshipNodeOut {
    const emp = rel2.emperorById.get(id);
    const claim = rel2.claimByClaimant.get(id);
    if (emp) {
      const succ = src2.edges.find((x) => x.type === "succession" && x.to === id);
      const category = succ?.category ?? emp.routeCategory;
      const disputed = succ?.veracity === "disputed";
      const sub = `${ordinalLabel(emp.ordinals[0])}・${category}${disputed ? "?" : ""}`;
      const tipLines: TipLine[] = [
        { text: `${emp.female ? "♀ " : ""}${emp.name}` },
        { text: `${emp.dynastyLabel}・${ordinalLabel(emp.ordinals[0])}`, muted: true },
        { text: `在位 ${fmtPeriod(emp.reigns[0].a, emp.reigns[0].b)}`, muted: true },
      ];
      if (succ) {
        tipLines.push({
          text: `即位: ${category}${disputed ? "（諸説あり）" : ""}／先代 ${nameOf(succ.from)} の${succ.relationToPredecessor ?? "不明"}`,
          muted: true,
        });
      } else {
        tipLines.push({ text: `即位: ${category}（先代を持たない起点）`, muted: true });
      }
      const fatherId = rel2.primaryFather.get(id);
      const motherId = rel2.motherOf.get(id);
      if (fatherId || motherId) {
        tipLines.push({
          text: [
            fatherId ? `父: ${nameOf(fatherId)}` : null,
            motherId ? `母: ${nameOf(motherId)}` : null,
          ]
            .filter(Boolean)
            .join("／"),
          muted: true,
        });
      }
      if (claim) tipLines.push({ text: `◇遠祖の主張: ${claim.claimedAncestry}`, muted: true });
      return {
        key: id,
        id,
        kind: "emperor",
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h,
        label: `${emp.female ? "♀" : ""}${emp.name}`,
        sub: r.h >= 40 ? sub : null,
        colorSlot: KINSHIP_COLOR_BY_DYNKEY[emp.dynastyKey] ?? 0,
        female: emp.female,
        claimBadge: claim !== undefined,
        tipLines,
      };
    }
    const p = rel2.personById.get(id)!;
    const tipLines: TipLine[] = [
      { text: `${p.female ? "♀ " : ""}${p.name}` },
      { text: `非皇帝（${p.kind}）`, muted: true },
      { text: personPeriod(p), muted: true },
    ];
    const label = `${p.female ? "♀" : ""}${shortName(p.name)}`;
    if (isConsort) {
      const husband = rel2.attachedTo.get(id);
      const kids = [...rel2.motherOf.entries()]
        .filter(([, m]) => m === id)
        .map(([c]) => nameOf(c));
      const parts: string[] = [];
      if (husband) parts.push(`夫: ${nameOf(husband)}`);
      if (kids.length > 0) parts.push(`子: ${kids.join("・")}`);
      if (parts.length > 0) tipLines.push({ text: parts.join("／"), muted: true });
    } else {
      const fatherId = rel2.primaryFather.get(id);
      if (fatherId) tipLines.push({ text: `父: ${nameOf(fatherId)}`, muted: true });
    }
    if (claim) tipLines.push({ text: `◇遠祖の主張: ${claim.claimedAncestry}`, muted: true });
    return {
      key: id,
      id,
      kind: isConsort ? "consort" : "person",
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      label,
      sub: null,
      colorSlot: 0,
      female: p.female,
      claimBadge: claim !== undefined,
      tipLines,
    };
  }
}
