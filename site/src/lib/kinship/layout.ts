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
  BAND_LABEL_ANCHOR,
  BAND_X_EXTRA,
  CHILD_ORDER_OVERRIDES,
  CLAIM_LINE_DEFS,
  CONSORT_BOTTOM_ATTACH,
  DYNASTY_HEAD_OFFSET,
  KINSHIP_CHAPTER_DEFS,
  KINSHIP_COLOR_BY_DYNKEY,
  KINSHIP_ENABLED_CHAPTER_IDS,
  PERSON_BAND_OVERRIDES,
  PERSON_DISPLAY_OVERRIDES,
  PERSON_HEAD_ROOM_PX,
} from "./chapters";
import {
  manualChapterOf,
  type ManualChapter,
  type ManualLayout,
} from "./manual";
import {
  type BandGraph,
  type KinNodeInfo,
  LINK_GAP_YEARS,
  NODE_GAP,
  PERSON_H,
  PERSON_HALF_SPAN,
  PERSON_ROLE_H,
  PRE_RATE,
  PX_PER_YEAR,
  packBand,
  type PackedBand,
  type SpouseAttach,
} from "./tree";

// --- 入力(emperors.tsが整形して渡す) ---

export interface KinshipSourceEmperor {
  id: string;
  name: string;
  dynastyLabel: string;
  portraitUrl: string | null;
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

/** 皇帝ノードのツールチップ(統計ページ共通のEmperorTooltipに渡す)。 */
export interface KinshipEmperorTip {
  name: string;
  dynastyLabel: string;
  portraitUrl: string | null;
  /** 在位期間の表示(複数在位は「、」区切り)。 */
  reignLabel: string;
  details: { label: string; value: string; clamp?: boolean; wrap?: boolean }[];
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
  /** 複数在位(廃位→復位)の可視カプセルの分割(在位期間ごとの矩形)。単一在位はnull。
   *  x・wは共通(統合矩形と同じ)。segments間の隙間=廃位期間に点線コネクタを描く。 */
  segments: { y: number; h: number }[] | null;
  colorSlot: number;
  female: boolean;
  claimBadge: boolean;
  /** 皇帝以外(person/consort)の簡易ツールチップ。皇帝はempTipを使う。 */
  tipLines: TipLine[];
  empTip: KinshipEmperorTip | null;
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
  /** 線上に出すラベル(遠祖の系譜主張の点線のみ)。 */
  label?: string;
  labelX?: number;
  labelY?: number;
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

export interface KinshipChapterLayout {
  id: string;
  title: string;
  period: string;
  width: number;
  height: number;
  axisX: number;
  ticks: { y: number; label: string }[];
  bands: { label: string; x: number; width: number; labelX: number; labelY: number }[];
  dynastyHeads: { key: string; label: string; x: number; y: number }[];
  nodes: KinshipNodeOut[];
  ties: KinshipTieOut[];
  drops: KinshipDropOut[];
  auxEdges: KinshipAuxOut[];
  arrows: KinshipArrowOut[];
  /** 年→pxの写像(編集モードがpx→年の逆変換に使う)。
   *  y >= zeroY: startYear + (y-zeroY)/PX_PER_YEAR / y < zeroY: startYear - (zeroY-y)/PRE_RATE */
  axis: { startYear: number; zeroY: number };
  /** 手動配置(凍結)の章か。 */
  manual: boolean;
  /** 品質ゲート違反(手動配置の章では警告として持ち回り、編集モードで表示する)。 */
  violations: string[];
}

// --- レイアウト定数 ---
const AXIS_X = 64;
// バンド間の横マージン。広げすぎると列共有バンド(秦など)が隣の幹から不必要に
// 離れて空白が目立つ(レビュー⑦)。矢印・補助線のガター兼用の最小限にする。
const BAND_GAP = 40;
const M_TOP = 96;
const M_BOTTOM = 48;
const CONSORT_H = 24;
// 複数在位の可視サブカプセルの最小高(在位0年の期間も見える高さ。唐中宗など)。
const MIN_SEG_H = 16;
// この高さ(px)以下の在位間ギャップは連続とみなしカプセルをマージする(恵帝の廃位は
// 301年内で年目盛り上ほぼ0のため単一カプセルに。唐中宗の684→705の21年は分割)。
const SEG_GAP_MIN = 6;
// 品質ゲートで線と当事者以外の箱の間に要求する余白(px)。この距離まで近づく線は
// 「かぶり」として違反にする(縁を掠める線も自動検出する)。
const GATE_CLEAR = 1.5;

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

export function buildKinshipLayout(
  src: KinshipSource,
  /** 手動レイアウト(章ごとの凍結座標)。省略時は manual-layout.json。 */
  manual?: ManualLayout,
): KinshipChapterLayout[] {
  const emperorById = new Map(src.emperors.map((e) => [e.id, e]));
  const personById = new Map(src.persons.map((p) => [p.id, p]));
  // 1人が複数の系譜主張を持つ場合がある(蜀漢昭烈帝=中山靖王＋漢法統、魏文帝=曹参
  // 後裔＋顓頊舜同祖など)。claimant→主張配列でグルーピングし、全件を保持する
  // (Mapで単純にkey化すると最後の1件しか残らない)。
  const claimsByClaimant = new Map<string, KinshipSourceClaim[]>();
  for (const c of src.claims)
    claimsByClaimant.set(c.claimant, [...(claimsByClaimant.get(c.claimant) ?? []), c]);

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
  const primaryFatherAdopted = new Set<string>(); // childId(主親が養父=養子縁組)
  for (const [child, edges] of fatherEdges) {
    const score = (e: KinshipSourceEdge): number =>
      (e.from === successionFrom.get(child) ? 4 : 0) +
      (e.relation === "養父" ? 2 : 0) +
      (e.veracity === "verified" ? 1 : 0);
    const best = [...edges].sort((p, q) => score(q) - score(p))[0];
    primaryFather.set(child, best.from);
    if (best.veracity !== "verified") primaryFatherDisputed.add(child);
    if (best.relation === "養父") primaryFatherAdopted.add(child);
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
    const consortAlignYears = (6 + CONSORT_H / 2) / PX_PER_YEAR;
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
    // 逆向き(皇帝 → 別バンドの人物の妻。明帝→南康公主〔桓温の妻〕)は水平整列しない。
    // 親子は「親が上・子が下」で示すのが家系図の文法で、娘を父と同じ高さに置くと
    // 夫の連結線と一直線になり「女性どうしが婚姻したように見える」(ユーザー指摘)。
    // 娘は本来の配置年(夫のピル位置)のまま親より下に置き、両親の兄弟バーから
    // 垂下させる(下のcrossBandChildren)。
  }

  // --- 家系図の上下整合 ---
  // 人物ノードの配置年は「代表位置」(生没中点等)に過ぎず、親の死年が子の在位中に
  // かかる等で主親子の上下(親が上)が崩れることがある。皇帝の在位は動かせないため、
  // 人物側の配置年を動かして整合させる(実際の生没年はツールチップで示す)。
  // 下方向(皇帝の親より子の人物を下へ)→上方向(子より親の人物を上へ)の順で数回
  // 反復し、上方向を最後にする(親が上に見えることを優先。残る食い込みは
  // tree.tsの実効区間カーソルが吸収する)。
  {
    // 人物→皇帝の辺で皇帝が押し下げられないよう、コネクタの縦室(LINK_GAP_YEARS)
    // ぶんまで人物側を上へ寄せておく(皇帝カプセルの上辺=即位年を動かさない)。
    const GAP_YEARS = PERSON_HALF_SPAN + LINK_GAP_YEARS + 0.01;
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
      buildChapter(def, src, manualChapterOf(manual, chapterId), {
        emperorById,
        personById,
        claimsByClaimant,
        primaryFather,
        primaryFatherDisputed,
        primaryFatherAdopted,
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
  claimsByClaimant: Map<string, KinshipSourceClaim[]>;
  primaryFather: Map<string, string>;
  primaryFatherDisputed: Set<string>;
  primaryFatherAdopted: Set<string>;
  attachedTo: Map<string, string>;
  attachDouble: Map<string, boolean>;
  motherOf: Map<string, string>;
  childOrderOf: Map<string, number>;
  est: Map<string, number>;
}

function buildChapter(
  def: (typeof KINSHIP_CHAPTER_DEFS)[number],
  src: KinshipSource,
  /** この章の手動配置(mode=manualのときだけ渡る)。 */
  man: ManualChapter | undefined,
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
    // 複数在位(廃位→復位。恵帝・唐中宗睿宗昭宗など)は、レイアウト・系譜機構では
    // 先頭即位〜末回退位を覆う「統合矩形」1つとして扱う(パッキング・垂下線・連結線・
    // 品質ゲートは1人1矩形の前提を崩さない)。可視カプセルは描画時に在位期間ごとの
    // サブカプセル+点線コネクタへ分割する(buildNodeのsegments)。
    info.set(e.id, {
      id: e.id,
      isEmperor: true,
      name: e.name,
      female: e.female,
      anchor: rel.est.get(e.id)!,
      reign: { a: e.reigns[0].a, b: e.reigns[e.reigns.length - 1].b },
    });
  }
  for (const p of src.persons) {
    if (!bandOfNode.has(p.id) && !rel.attachedTo.has(p.id)) continue;
    const disp = PERSON_DISPLAY_OVERRIDES[p.id];
    info.set(p.id, {
      id: p.id,
      isEmperor: false,
      // 幅計算・表示は短名(「竇氏〔孝文竇皇后〕」→「竇氏」)。全名はツールチップ。
      name: shortName(p.name),
      female: p.female,
      anchor: rel.est.get(p.id)!,
      dispLabel: disp?.label,
      dispRole: disp?.role,
    });
  }

  // 年目盛りの開始年(章の最初の在位の直前の25年目盛り)。パッキングでも使うため
  // 年→px写像より先に確定させる(これより前の人物は圧縮領域=PRE_RATE px/年)。
  const startHist =
    Math.floor(
      fromAstroYear(Math.min(...chapterEmperors.map((e) => e.reigns[0].a))) / 25,
    ) * 25;
  const startYear = startHist < 0 ? startHist + 1 : startHist;

  // 見出しの置き場所を作るための人物ピルの持ち上げ(PERSON_HEAD_ROOM_PX)。px指定を
  // 年に直すスケールは、圧縮領域(章開始年より前)かどうかで変わる。
  // 祖先側も同量持ち上げる: パッキングの親子チェーン押し下げ
  // (tree.tsのLINK_GAP_YEARS)で子は親の直下に貼り付くため、本人だけ上げても
  // 押し戻される(李特は父・李慕に貼り付いていた)。
  for (const [id, px] of Object.entries(PERSON_HEAD_ROOM_PX)) {
    for (let cur: string | undefined = id; cur !== undefined; cur = rel.primaryFather.get(cur)) {
      const it = info.get(cur);
      if (!it || it.isEmperor) break;
      it.anchor -= px / (it.anchor < startYear ? PRE_RATE : PX_PER_YEAR);
    }
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
      // 実家(父)が別バンドにいる配偶者は、そのバンド側の脇に置く(親エッジが
      // 夫・他の妃をすり抜けずに実家側から直接入る)。
      const wifeFatherBand = ((): number | undefined => {
        const f = rel.primaryFather.get(wife);
        return f !== undefined ? bandOfNode.get(f) : undefined;
      })();
      const preferSide =
        wifeFatherBand === undefined || wifeFatherBand === bi
          ? undefined
          : wifeFatherBand < bi
            ? ("L" as const)
            : ("R" as const);
      spousesOf.set(husband, [
        ...(spousesOf.get(husband) ?? []),
        { id: wife, double: rel.attachDouble.get(wife) ?? false, preferSide },
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
      // startYearは既に天文年(startHistの負年補正済み)。
      preStartYear: startYear,
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
      // バンド間の線の通り道を広げるキュレーション(右のバンドも同量押される)。
      x += BAND_X_EXTRA[pb.label] ?? 0;
      bandXs.push(x);
      placedRects.push(
        ...rects.map((r) => ({ x0: r.x0 + x, x1: r.x1 + x, y0: r.y0, y1: r.y1 })),
      );
    }
  }
  // --- 年→px写像(完全等間隔) ---
  // 章の最初の皇帝在位の直前の25年目盛りを軸の開始とし、そこから下は
  // 1年=PX_PER_YEAR(8px)の完全等間隔(局所引き伸ばしはしない。短い在位の
  // カプセル最小高はyearSpanの区間延長+LINK_GAP_YEARSの押し下げで吸収する)。
  // 開始より前(章の祖先人物: 荘襄王・呂不韋など)は1年=PRE_RATE(2px)に圧縮して
  // 開始線の上のヘッダー領域に置く(目盛り・グリッドは開始年から)。
  const allItems = packed.flatMap((pb) => pb.items);
  const minEff = Math.min(...allItems.map((it) => it.effStart));
  const maxEff = Math.max(...allItems.map((it) => it.effEnd));
  const preH = (startYear - Math.min(minEff, startYear)) * PRE_RATE;
  const yOf = (y: number): number =>
    y >= startYear
      ? M_TOP + preH + (y - startYear) * PX_PER_YEAR
      : M_TOP + preH - (startYear - y) * PRE_RATE;

  const nameOf = (id: string): string =>
    rel.emperorById.get(id)?.name ?? rel.personById.get(id)?.name ?? id;
  const femaleOf = (id: string): boolean =>
    rel.emperorById.get(id)?.female ?? rel.personById.get(id)?.female ?? false;

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
  // 夫ごとの配偶者数。生母/后妃が1人だけの夫は連結線を夫カプセルの上下中央から
  // 出す(ユーザー指摘:「母の線が箱の上のほうで固定」の是正)。2人以上attachする夫
  // (高帝の呂雉+薄姫など)は上下に振り分けたまま(重なり回避)にする。
  const consortCountByHusband = new Map<string, number>();
  for (const husband of rel.attachedTo.values())
    consortCountByHusband.set(husband, (consortCountByHusband.get(husband) ?? 0) + 1);
  packed.forEach((pb, bi) => {
    for (const it of pb.items) {
      const isConsort = it.role === "consort";
      const nodeInfo = info.get(it.id)!;
      // カプセルは実効区間に正確に一致させる(上辺=即位年・下辺=退位年。レビュー⑧:
      // 区間から内側に寄せるインセットは年目盛りとの系統ズレになるため廃止。
      // ノード間の視覚的間隔はtree.tsのパッキングパディングが確保する)。
      const top = yOf(it.effStart);
      const bottom = yOf(it.effEnd);
      // 皇帝カプセルは実効区間いっぱい(高さ=在位期間)。人物は固定高で区間中央。
      // 配偶者は夫カプセルの「上部」にpx整列する(子は必ず夫の下端より後に始まるため、
      // 連結線を子グループの真上まで伸ばしても子や垂下帯と交差しない)。
      let h: number;
      let y: number;
      if (isConsort) {
        h = CONSORT_H;
        const husband = it.attachedTo !== undefined ? rectById.get(it.attachedTo) : undefined;
        if (husband !== undefined && info.get(it.attachedTo!)?.isEmperor) {
          // CONSORT_BOTTOM_ATTACH指定は下辺側(生母の垂下線と遠祖主張の点線が交差する
          // のを避けるための個別指定)。夫にattachする配偶者が1人だけなら上下中央から
          // 連結線を出す。2人以上は上辺(既定)に置き、下辺指定と振り分けて重なりを防ぐ。
          y = CONSORT_BOTTOM_ATTACH.has(it.id)
            ? husband.y + husband.h - h - 6
            : (consortCountByHusband.get(it.attachedTo!) ?? 0) <= 1
              ? husband.y + husband.h / 2 - h / 2
              : husband.y + 6;
        } else if (husband !== undefined) {
          y = husband.y + husband.h / 2 - h / 2;
        } else {
          y = (top + bottom) / 2 - h / 2;
        }
      } else if (nodeInfo.isEmperor) {
        h = bottom - top;
        y = top;
      } else {
        // 人物は固定高(開始年より前の圧縮領域でも潰れない)。肩書き行つきは2行分。
        h = nodeInfo.dispRole !== undefined ? PERSON_ROLE_H : PERSON_H;
        y = (top + bottom) / 2 - h / 2;
      }
      // 手動配置(凍結座標)を最優先。表に無いノードは自動配置のまま(データ追加時の
      // 取りこぼしは編集モードが「未配置」として示す)。皇帝の縦は年目盛りに固定。
      const mp = man?.nodes[it.id];
      let rx = bandXs[bi] + it.cx - it.w / 2;
      let ry = y;
      if (mp) {
        if (typeof mp.x === "number") rx = mp.x;
        if (typeof mp.year === "number" && !nodeInfo.isEmperor) ry = yOf(mp.year) - h / 2;
      }
      const r: PlacedRect = {
        x: rx,
        y: ry,
        w: it.w,
        h,
        cx: rx + it.w / 2,
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
  const tieXOf = new Map<string, [number, number]>(); // spouseId → 連結線のx区間
  /**
   * 手動配置の章では、連結線は「夫の辺 → 妃の辺」を最終座標から引き直す
   * (パッキングが出したx区間は手で動かした後の位置と合わないため)。
   * 同じ夫に妃が複数いて間に挟まる場合は、内側の妃の外縁から引く。
   */
  const manualTieX = (husbandId: string, spouseId: string): [number, number] => {
    const h = rectById.get(husbandId)!;
    const s = rectById.get(spouseId)!;
    const toRight = s.cx > h.cx;
    let edge = toRight ? h.x + h.w : h.x;
    for (const [other, hus] of rel.attachedTo) {
      if (hus !== husbandId || other === spouseId) continue;
      const o = rectById.get(other);
      if (!o) continue;
      if (o.y >= s.y + s.h || s.y >= o.y + o.h) continue; // 高さが重ならない妃は経路外
      if (toRight ? o.x + o.w <= s.x && o.x >= h.x : o.x >= s.x && o.x + o.w <= h.x + h.w)
        edge = toRight ? Math.max(edge, o.x + o.w) : Math.min(edge, o.x);
    }
    return toRight ? [edge, s.x] : [s.x + s.w, edge];
  };
  packed.forEach((pb, bi) => {
    for (const t of pb.ties) {
      const s = rectById.get(t.spouseId);
      if (!s) continue;
      const y = s.y + s.h / 2;
      const [tx1, tx2] = man
        ? manualTieX(t.husbandId, t.spouseId)
        : [bandXs[bi] + t.x1, bandXs[bi] + t.x2];
      tieXOf.set(t.spouseId, [tx1, tx2]);
      ties.push({
        husbandId: t.husbandId,
        spouseId: t.spouseId,
        x1: tx1,
        x2: tx2,
        y,
        double: t.double,
      });
      qsegs.push({
        x1: tx1,
        y1: y,
        x2: tx2,
        y2: y,
        ids: [t.husbandId, t.spouseId],
        what: `連結線 ${t.husbandId}═${t.spouseId}`,
      });
      tieYOf.set(t.spouseId, y);
    }
  });

  // --- 垂下線(junction) ---
  const drops: KinshipDropOut[] = [];
  // 垂下点が子グループのx範囲から外れると、バーに水平ジョグ(無駄な曲がり)が
  // 生じる。tree.tsのshiftKidsToJunctionが揃えきれなかったものはハード制約
  // 違反として品質ゲートで落とす。
  const jogViolations: string[] = [];
  // バンド跨ぎの子(夫の脇に配偶者として置かれた娘など)は、パッキングの垂下グループに
  // 入らないので補助線1本になってしまう。両親の兄弟バーを伸ばしてそこから垂下させ、
  // 同母の兄弟(成帝・康帝)と同じ形にする(ユーザー指摘: 明帝→南康公主が庾文君との
  // 連結線の延長に見え、女性どうしの婚姻に見える。娘なら兄妹と分かる図にすべき)。
  // キーは「父|母(父にattachした実母。無ければ空)」= 垂下グループの識別子。
  const crossKids = new Map<string, string[]>();
  const bandOfAny = (id: string): number | undefined => {
    const b = bandOfNode.get(id);
    if (b !== undefined) return b;
    const h = rel.attachedTo.get(id);
    return h !== undefined ? bandOfNode.get(h) : undefined;
  };
  for (const [child, father] of rel.primaryFather) {
    if (!rectById.has(child) || !rectById.has(father)) continue;
    const fb = bandOfAny(father);
    const cb = bandOfAny(child);
    if (fb === undefined || cb === undefined || fb === cb) continue; // 同バンドはパッキングが扱う
    const m = rel.motherOf.get(child);
    const motherKey = m !== undefined && rel.attachedTo.get(m) === father ? m : "";
    const key = `${father}|${motherKey}`;
    crossKids.set(key, [...(crossKids.get(key) ?? []), child]);
  }
  const crossDrawn = new Set<string>(); // `${father}→${child}` 実際にバーから垂下させたもの
  packed.forEach((pb, bi) => {
    for (const j of pb.junctions) {
      const father = rectById.get(j.fatherId);
      if (!father) continue;
      // 手動配置の章では垂下点も最終座標から決める: 子の中央に合わせ、
      // 夫婦の連結線(母がいる場合)または父カプセルの幅の内側にクランプする
      // (段差=無駄な曲がりを作らないため)。
      let jx = bandXs[bi] + j.x;
      if (man) {
        const kidCxs = j.children
          .map((c) => rectById.get(c)?.cx)
          .filter((v): v is number => v !== undefined);
        const mid =
          kidCxs.length > 0
            ? (Math.min(...kidCxs) + Math.max(...kidCxs)) / 2
            : father.cx;
        const range =
          j.motherId !== null && tieXOf.has(j.motherId)
            ? tieXOf.get(j.motherId)!
            : ([father.x + 10, father.x + father.w - 10] as [number, number]);
        jx = Math.min(Math.max(mid, Math.min(...range)), Math.max(...range));
      }
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
      if (
        jx < Math.min(...kids.map((k) => k.cx)) - 4 ||
        jx > Math.max(...kids.map((k) => k.cx)) + 4
      ) {
        jogViolations.push(
          `垂下点の段差 ${nameOf(j.fatherId)}${j.motherId !== null ? `═${nameOf(j.motherId)}` : ""}→${j.children.map(nameOf).join("・")} [jx=${jx.toFixed(0)} 子cx=${kids.map((k) => k.cx.toFixed(0)).join(",")}]`,
        );
      }
      const minKidTop = Math.min(...kids.map((k) => k.y));
      // バーは最年長の子の直上。親と子が接している場合も子の枠内には入れない。
      // 親カプセルの下辺からもクリアランスを取る: 品質ゲートは線を「当事者」の
      // ノードとの接触では落とさない(線が箱に届くために必要な除外)ため、
      // 自分の親の箱に貼り付いたバーはゲートでは検出できない(ユーザー指摘の
      // 「箱と線がほぼ重なっている」= 明帝・孝武帝の兄弟バーが下辺の2px下)。
      // 構造側で最低6pxを確保する。親カプセルが子の上辺より下まで伸びている
      // 場合(長い在位)は従来どおり子の直上に置く。
      const clearTop = Math.max(topY + 6, father.y + father.h + 6);
      const barY = Math.min(Math.max(minKidTop - 10, clearTop), minKidTop - 2);
      // バンド跨ぎの子: バーより下にいるものだけバーを伸ばして垂下させる
      // (上にいる場合は形にならないので従来どおり補助線1本)。
      const cross = (crossKids.get(`${j.fatherId}|${j.motherId ?? ""}`) ?? []).filter(
        (c) => rectById.get(c)!.y > barY + 10,
      );
      for (const c of cross) crossDrawn.add(`${j.fatherId}→${c}`);
      const allKidIds = [...j.children, ...cross];
      const allKids = allKidIds.map((c) => rectById.get(c)!);
      const groupIds = [
        j.fatherId,
        ...(j.motherId !== null ? [j.motherId] : []),
        ...allKidIds,
      ];
      // 垂下点が子の真上に揃っている単独子は1本の直線で落とす(無駄な段差を作らない)。
      if (allKids.length === 1 && Math.abs(kids[0].cx - jx) < 4) {
        drops.push({
          path: `M ${jx} ${topY} L ${jx} ${kids[0].y}`,
          dashed:
            rel.primaryFatherDisputed.has(j.children[0]) ||
            rel.primaryFatherAdopted.has(j.children[0]),
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
      const barX0 = Math.min(jx, ...allKids.map((k) => k.cx));
      const barX1 = Math.max(jx, ...allKids.map((k) => k.cx));
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
      for (const c of allKidIds) {
        const k = rectById.get(c);
        if (!k) continue;
        drops.push({
          path: `M ${k.cx} ${barY} L ${k.cx} ${k.y}`,
          dashed:
            rel.primaryFatherDisputed.has(c) || rel.primaryFatherAdopted.has(c),
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
  // 兄弟バーを伸ばして垂下させたバンド跨ぎの子も構造で表現済み。
  for (const k of crossDrawn) structuralParent.add(k);

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
    // 到達先の縦範囲に始点高さが収まるなら水平の直線。収まらない場合、中心どうしを
    // 結ぶと大きく曲がる(元帝→武帝の禅譲: 武帝が長大な箱で中心が遥か下)。始点が
    // 到達先の上端より上なら上端付近へ、下端より下なら下端付近へ入れて曲がりを抑える。
    const y2 =
      y1 < b.y + 8
        ? b.y + 12
        : y1 > b.y + b.h - 8
          ? b.y + b.h - 12
          : y1;
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  };

  // 補助エッジ(血縁)用: 家系図の直交線に揃えたポリライン(点列)。無用な曲がりを
  // 避け、水平区間は到達先の直前(枠の外)を通す。到達点は垂下線(cx)と重ならないよう
  // 10pxずらす。
  // 「同じ高さで左右に離れている」= 水平1本で結ぶ形。この形は上下関係が出ないため
  // 親子であることが読めない(ユーザー指摘: 明帝→南康公主が庾文君との連結線の
  // 延長に見え、明帝・庾文君・南康公主・桓温の関係が分からない)。kinAuxはこの
  // 判定で続柄ラベルを付ける。
  const isSideBySide = (a: PlacedRect, b: PlacedRect): boolean =>
    Math.abs(a.y + a.h / 2 - (b.y + b.h / 2)) <= 4 &&
    (a.x >= b.x + b.w || b.x >= a.x + a.w);
  const orthoPoints = (a: PlacedRect, b: PlacedRect): [number, number][] => {
    // 中心の高さが揃っていて左右に離れている場合は、曲がりのない水平1本で結ぶ
    // (王禁→王政君など。整列は上のconsortAlignYearsパスで作る)。
    const bcy = b.y + b.h / 2;
    if (isSideBySide(a, b)) {
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

  /**
   * 補助線の始点側に「同じ高さで連なる配偶者ピル」があるとき、始点の矩形を
   * その外縁まで広げる(明帝→南康公主の水平線が、明帝の右脇の庾文君を横切る
   * のを防ぐ。線は 明帝═庾文君 の連結線の延長として妃の外縁から出る)。
   */
  const withConsortChain = (
    ownerId: string,
    a: PlacedRect,
    b: PlacedRect,
  ): { rect: PlacedRect; ids: string[] } => {
    const ids: string[] = [];
    let x0 = a.x;
    let x1 = a.x + a.w;
    const toRight = a.cx < b.cx;
    for (const [spouseId, husbandId] of rel.attachedTo) {
      if (husbandId !== ownerId) continue;
      const r = rectById.get(spouseId);
      if (!r) continue;
      // 高さが重ならない(上下に振り分けた)妃は線の経路に無いので対象外。
      if (r.y >= a.y + a.h || a.y >= r.y + r.h) continue;
      if (toRight ? r.x + 1 >= x1 : r.x + r.w <= x0 + 1) {
        ids.push(spouseId);
        x0 = Math.min(x0, r.x);
        x1 = Math.max(x1, r.x + r.w);
      }
    }
    return { rect: { ...a, x: x0, w: x1 - x0 }, ids };
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
        const gx0 = leftToRight ? a.x + a.w : b.x + b.w;
        const gx1 = leftToRight ? b.x : a.x;
        midX = (gx0 + gx1) / 2;
        // 矢印の水平区間の真上に置くのが第一(ラベルが矢印から離れると
        // どの線の注記か読めない。ユーザー指摘: 安帝→桓玄の「禅譲・無血縁」が
        // 孝武帝の箱の下辺に載っていた)。両カプセルの間隔がラベル幅に足りない
        // 場合だけ、従来どおり両カプセルの上端より上の空きへ逃がす。
        const labelW = label.length * 10.5;
        midY =
          gx1 - gx0 >= labelW + 16
            ? a.y + a.h / 2 - 5
            : Math.min(a.y, b.y) - 5;
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

  // --- 遠祖の系譜主張の点線(CLAIM_LINE_DEFS) ---
  // 主張上の遠祖ノードの右下から出て、到達先バンドの左脇コリドー(バンド間の
  // ガター)を垂直に降り、終点ノードの左辺中央へ入る。中間世代は収録されて
  // いないため1本の長い点線で、主張の全文と出典はツールチップに出す。
  for (const cl of CLAIM_LINE_DEFS) {
    const a = rectById.get(cl.fromId);
    const b = rectById.get(cl.toId);
    const claims = rel.claimsByClaimant.get(cl.claimant) ?? [];
    if (!a || !b || claims.length === 0) continue;
    // 起点カプセルの出る高さ。上辺(top)は下の生母の垂下線を避ける。
    const ay = cl.fromAnchor === "top" ? a.y + 14 : a.y + a.h - 14;
    // 垂直コリドー: 終点ノードの脇のバンド間ガター。バンド見出しテキストは
    // ゲート対象外のため、通る側は def.side でキュレーションする。
    const vx = cl.side === "R" ? b.x + b.w + 24 : b.x - 24;
    const my = b.y + b.h / 2;
    const pts: [number, number][] = [
      [a.x + a.w, ay],
      [vx, ay],
      [vx, my],
      [cl.side === "R" ? b.x + b.w : b.x, my],
    ];
    pushAuxSegs(pts, [cl.fromId, cl.toId], `遠祖主張 ${cl.claimant}`);
    auxEdges.push({
      key: `c:${cl.claimant}:${cl.fromId}→${cl.toId}`,
      fromId: cl.fromId,
      toId: cl.toId,
      path: toPath(pts),
      dashed: true,
      disputed: false,
      marriage: false,
      label: cl.label,
      labelX: vx,
      labelY: (ay + my) / 2,
      tipLines: [
        { text: "◇遠祖の系譜主張" },
        ...claims.flatMap((c) => [
          { text: `${nameOf(cl.claimant)}: ${c.claimedAncestry}`, muted: true },
          ...(c.sourcePage ? [{ text: `出典: ${c.sourcePage}`, muted: true }] : []),
        ]),
      ],
    });
  }

  function kinAux(
    e: KinshipSourceEdge,
    a0: PlacedRect,
    b: PlacedRect,
    dashed: boolean,
  ): KinshipAuxOut {
    const disputed = e.veracity === "disputed";
    const { rect: a, ids: chainIds } = withConsortChain(e.from, a0, b);
    const pts = orthoPoints(a, b);
    pushAuxSegs(pts, [e.from, e.to, ...chainIds], `血縁 ${e.from}→${e.to}〔${e.relation}〕`);
    // 親子は「親が上・子が下」の位置関係で示すのが基本だが、年代が重なる相手
    // (配偶者として夫の年区間に整列した娘など)へは横向きの線になり、上下関係が
    // 出ないので親子と読めない。この形のときだけ線の上に続柄を出す
    // (ユーザー指摘: 明帝→南康公主が庾文君との連結線の延長に見え、明帝・庾文君・
    //  南康公主・桓温の関係が分からない)。位置は最長の水平区間の中央。
    const flat = b.y - (a.y + a.h) < 14 && a.y - (b.y + b.h) < 14;
    let label: string | undefined;
    let labelX = 0;
    let labelY = 0;
    if (flat) {
      const kin =
        e.relation === "実父" || e.relation === "実母"
          ? femaleOf(e.to)
            ? "娘"
            : "子"
          : e.relation === "養父" || e.relation === "養母"
            ? femaleOf(e.to)
              ? "養女"
              : "養子"
            : stripParen(e.relation ?? "");
      label = `${nameOf(e.from)}の${kin}`;
      let longest = -1;
      for (let i = 1; i < pts.length; i++) {
        if (pts[i - 1][1] !== pts[i][1]) continue;
        const len = Math.abs(pts[i][0] - pts[i - 1][0]);
        if (len > longest) {
          longest = len;
          labelX = (pts[i][0] + pts[i - 1][0]) / 2;
          labelY = pts[i][1] - 5;
        }
      }
    }
    return {
      key: `k:${e.from}→${e.to}:${e.relation}`,
      fromId: e.from,
      toId: e.to,
      label,
      labelX,
      labelY,
      path: toPath(pts),
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
  // 手動配置(mode=manual)の章では警告に留め、編集モードのパネルに出す。
  let gateViolations: string[] = [];
  {
    const violations: string[] = [...jogViolations];
    for (const seg of qsegs) {
      const sx0 = Math.min(seg.x1, seg.x2);
      const sx1 = Math.max(seg.x1, seg.x2);
      const sy0 = Math.min(seg.y1, seg.y2);
      const sy1 = Math.max(seg.y1, seg.y2);
      for (const [nid, r] of rectById) {
        if (seg.ids.includes(nid)) continue;
        // 箱を GATE_CLEAR px 外側に広げて判定する。線が当事者以外の箱の縁を掠める・
        // 接する(=見た目の「かぶり」)も検出するため、内側インセットではなく外側マージン
        // を要求する。近接だが交差でないルーティングはこの余白を確保して回避する。
        const rx0 = r.x - GATE_CLEAR;
        const rx1 = r.x + r.w + GATE_CLEAR;
        const ry0 = r.y - GATE_CLEAR;
        const ry1 = r.y + r.h + GATE_CLEAR;
        if (sx0 < rx1 && sx1 > rx0 && sy0 < ry1 && sy1 > ry0) {
          violations.push(
            `${seg.what} が ${nameOf(nid)}(${nid}) に接触/交差 [seg(${seg.x1.toFixed(0)},${seg.y1.toFixed(0)})-(${seg.x2.toFixed(0)},${seg.y2.toFixed(0)}) rect(${r.x.toFixed(0)},${r.y.toFixed(0)},w${r.w.toFixed(0)},h${r.h.toFixed(0)})]`,
          );
        }
      }
    }
    // 皇帝カプセルの年線整合(レビュー⑧): 上辺が即位年より上・下辺が退位年より上に
    // 来ることは許さない(「安帝の箱が125年の線より上で終わる」の再発防止)。
    // 下方向のズレのみ許容(短在位の最小高・隣接即位の押し下げという承認済みの近似)。
    for (const e of chapterEmperors) {
      const r = rectById.get(e.id);
      if (!r) continue;
      const etop = yOf(e.reigns[0].a);
      const ebot = yOf(e.reigns[e.reigns.length - 1].b);
      if (r.y < etop - 0.5 || r.y + r.h < ebot - 0.5) {
        violations.push(
          `年線整合違反 ${e.name}(${e.id}) [上辺${(r.y - etop).toFixed(1)}px 下辺${(r.y + r.h - ebot).toFixed(1)}px]`,
        );
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
      const msg =
        `kinship/layout: 章「${def.title}」で品質ゲート違反(横断・重なり・垂下点の段差・年線整合)があります(${violations.length}件):\n` +
        violations.join("\n");
      // 手動配置の章では配置の決定権はユーザーにあるので、ビルドは落とさず
      // 警告として編集モードのパネル・ビルドログに出す。
      if (man) console.warn(msg);
      else throw new Error(msg);
    }
    gateViolations = violations;
  }

  // --- バンド見出し・王朝見出し・目盛り ---
  const bands = def.bands.map((b, i) => {
    const bandNodes = packed[i].items.map((it) => rectById.get(it.id)!);
    const topY = Math.min(...bandNodes.map((n) => n.y));
    // 見出しは「バンド最上部のノード群」の中央に置く。バンド全幅の中央だと、
    // 幅の広いバンド(漢)で見出しが最上部ノードから離れた空白に浮く(レビュー⑦)。
    const topNodes = bandNodes.filter((n) => n.y < topY + 60);
    const tx0 = Math.min(...topNodes.map((n) => n.x));
    const tx1 = Math.max(...topNodes.map((n) => n.x + n.w));
    // アンカー上書き(新（王氏）を王莽の直上に置く等)。基準ノードの上に配置する。
    const anchor = BAND_LABEL_ANCHOR[b.label];
    const anchorRect = anchor ? rectById.get(anchor.anchorId) : undefined;
    return {
      // hideLabelのバンドは見出しを描かない(labelは内部キーとしてのみ使う)。
      label: b.hideLabel === true ? "" : b.label,
      x: bandXs[i],
      width: packed[i].width,
      labelX: anchorRect
        ? anchorRect.x + anchorRect.w / 2 + (anchor!.dx ?? 0)
        : (tx0 + tx1) / 2,
      labelY: anchorRect
        ? anchorRect.y + (anchor!.dy ?? 0)
        : topY - 34,
    };
  });
  // 王朝見出しは複数王朝が同居するバンドのみ(単独王朝バンドはバンド見出しで足りる)。
  // 位置は最初のカプセルの左肩(中央上は垂下線が通るため、文字と線が必ず被る)。
  const dynastyHeads: { key: string; label: string; x: number; y: number }[] = [];
  for (const bandDef of def.bands) {
    if (bandDef.dynastyKeys.length < 2) continue;
    for (const dk of bandDef.dynastyKeys) {
      const first = chapterEmperors
        .filter((e) => e.dynastyKey === dk)
        .map((e) => ({ e, r: rectById.get(e.id)! }))
        .filter((x) => x.r !== undefined)
        .sort((p, q) => p.r.y - q.r.y)[0];
      if (!first) continue;
      const off = DYNASTY_HEAD_OFFSET[dk];
      dynastyHeads.push({
        key: dk,
        label: dk.split("__")[0],
        x: first.r.x + (off?.dx ?? 0),
        y: first.r.y - 7 + (off?.dy ?? 0),
      });
    }
  }

  // --- 見出しテキストとノードの重なり検査(報告のみ) ---
  // 見出しはハロー付きで線の上に描くため線とは重ならないが、ノードのカプセル・
  // ピルに重なると文字が読めない(ユーザー指摘: 「前趙（漢趙）」が劉豹・呼延氏の
  // ピルに被る)。テキストのbboxは字数×フォントサイズの概算。ビルドは落とさず
  // 開発ログに出し、キュレーション(PERSON_ANCHOR_NUDGE_YEARS・見出しdx/dy)で潰す。
  {
    const hits: string[] = [];
    const check = (
      what: string,
      x0: number,
      x1: number,
      y0: number,
      y1: number,
    ): void => {
      for (const [nid, r] of rectById) {
        if (x0 < r.x + r.w && r.x < x1 && y0 < r.y + r.h && r.y < y1)
          hits.push(
            `${what} × ${nameOf(nid)}(${nid}) [text(${x0.toFixed(0)},${y0.toFixed(0)})-(${x1.toFixed(0)},${y1.toFixed(0)}) rect(${r.x.toFixed(0)},${r.y.toFixed(0)},w${r.w.toFixed(0)},h${r.h.toFixed(0)})]`,
          );
      }
    };
    for (const b of bands) {
      if (b.label === "") continue;
      const w = b.label.length * 13;
      check(`バンド見出し「${b.label}」`, b.labelX - w / 2, b.labelX + w / 2, b.labelY - 12, b.labelY + 3);
    }
    for (const h of dynastyHeads) {
      check(`王朝見出し「${h.label}」`, h.x, h.x + h.label.length * 11.5, h.y - 10.5, h.y + 2.5);
    }
    if (hits.length > 0)
      console.error(
        `kinship/layout: 章「${def.title}」の見出しがノードに重なっています(${hits.length}件・報告のみ):\n` +
          hits.join("\n"),
      );
  }

  // --- 見出し・ラベルの手動位置(編集モードでドラッグしたもの)を反映 ---
  // キー: band:<バンド名> / dyn:<dynastyKey> / arrow:<key> / aux:<key>
  if (man?.labels) {
    for (const b of bands) {
      const p = man.labels[`band:${b.label}`];
      if (p) {
        b.labelX = p.x;
        b.labelY = p.y;
      }
    }
    for (const h of dynastyHeads) {
      const p = man.labels[`dyn:${h.key}`];
      if (p) {
        h.x = p.x;
        h.y = p.y;
      }
    }
    for (const a of arrows) {
      const p = man.labels[`arrow:${a.key}`];
      if (p) {
        a.labelX = p.x;
        a.labelY = p.y;
      }
    }
    for (const e of auxEdges) {
      const p = man.labels[`aux:${e.key}`];
      if (p && e.label !== undefined) {
        e.labelX = p.x;
        e.labelY = p.y;
      }
    }
  }

  // 目盛り(歴史年の25年刻み・開始年から。0年は暦に存在しないため1年へ置換)。
  const ticks: { y: number; label: string }[] = [];
  for (let h = startHist; ; h += 25) {
    const hist = h === 0 ? 1 : h;
    const astro = hist < 0 ? hist + 1 : hist;
    if (astro > maxEff) break;
    ticks.push({ y: yOf(astro), label: formatYear(hist) });
  }

  const height =
    Math.max(...[...rectById.values()].map((r) => r.y + r.h), yOf(maxEff)) +
    M_BOTTOM;
  // バンドは列共有で最後のバンドが右端とは限らないため、全バンドの右端の最大をとる。
  // 手動配置でバンド幅の外へ出したノードも収める。
  const width =
    Math.max(
      ...packed.map((pb, i) => bandXs[i] + pb.width),
      ...[...rectById.values()].map((r) => r.x + r.w),
    ) + 60;

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
    axis: { startYear, zeroY: yOf(startYear) },
    manual: man !== undefined,
    violations: gateViolations,
  };

  function buildNode(
    id: string,
    isConsort: boolean,
    r: PlacedRect,
    src2: KinshipSource,
    rel2: ResolvedRelations,
  ): KinshipNodeOut {
    const emp = rel2.emperorById.get(id);
    const claims = rel2.claimsByClaimant.get(id) ?? [];
    if (emp) {
      const succ = src2.edges.find((x) => x.type === "succession" && x.to === id);
      const category = succ?.category ?? emp.routeCategory;
      const disputed = succ?.veracity === "disputed";
      const sub = `${ordinalLabel(emp.ordinals[0])}・${category}${disputed ? "?" : ""}`;
      // ツールチップは統計ページ共通のEmperorTooltip(肖像+名前+王朝+在位+補足)。
      // クリックで全項目ダイアログを開くため、系譜固有の補足だけをdetailsに載せる。
      const details: { label: string; value: string; clamp?: boolean; wrap?: boolean }[] = [
        {
          label: "即位",
          value: `${ordinalLabel(emp.ordinals[0])}・${category}${disputed ? "（諸説あり）" : ""}`,
        },
      ];
      const fatherId = rel2.primaryFather.get(id);
      const motherId = rel2.motherOf.get(id);
      // 養子縁組(明帝→曹芳など)は「父：○○（養父）」と明示。図では垂下線を破線にする。
      if (fatherId)
        details.push({
          label: "父",
          value: `${nameOf(fatherId)}${rel2.primaryFatherAdopted.has(id) ? "（養父）" : ""}`,
        });
      if (motherId) details.push({ label: "母", value: nameOf(motherId) });
      // 遠祖の主張は長文(高帝の堯後裔説など)。ツールチップに全文を折り返して出す
      // (以前は1行に切り詰めてページ末尾の一覧で全文を補っていたが、一覧は廃止した)。
      // 1人が複数主張を持つ場合(蜀漢昭烈帝・魏文帝)は各主張を別行で全件出す。
      for (const c of claims)
        details.push({ label: "◇遠祖の主張", value: c.claimedAncestry, wrap: true });
      // 複数在位は在位期間ごとの可視カプセルに分割(統合矩形r内に配置)。ただし年粒度で
      // 隙間のない連続在位(恵帝の廃位は301年内で年目盛り上ほぼ0)はマージして単一
      // カプセルにする。実際に年をまたぐ廃位(唐中宗の684→705など)だけ分割し、間に
      // 点線コネクタを描く。両端は統合矩形の上下辺に合わせる(パッキング押し下げを保つ)。
      let segments: { y: number; h: number }[] | null = null;
      if (emp.reigns.length > 1) {
        const runs: { top: number; bot: number }[] = [];
        for (const rg of emp.reigns) {
          const top = yOf(rg.a);
          const bot = yOf(rg.b);
          const last = runs[runs.length - 1];
          if (last && top - last.bot <= SEG_GAP_MIN) last.bot = Math.max(last.bot, bot);
          else runs.push({ top, bot });
        }
        if (runs.length > 1) {
          segments = runs.map((run, i) => {
            const top = i === 0 ? r.y : run.top;
            const bot = i === runs.length - 1 ? r.y + r.h : run.bot;
            return { y: top, h: Math.max(bot - top, MIN_SEG_H) };
          });
        }
      }
      // ラベルは最も高い在位カプセルの中央に置く(廃位期間の隙間に載らないように)。
      const labelSeg = segments
        ? segments.reduce((a, b) => (b.h > a.h ? b : a))
        : { y: r.y, h: r.h };
      return {
        key: id,
        id,
        kind: "emperor",
        x: r.x,
        y: labelSeg.y,
        w: r.w,
        h: labelSeg.h,
        label: `${emp.female ? "♀" : ""}${emp.name}`,
        segments,
        sub: labelSeg.h >= 40 ? sub : null,
        colorSlot: KINSHIP_COLOR_BY_DYNKEY[emp.dynastyKey] ?? 0,
        female: emp.female,
        claimBadge: claims.length > 0,
        tipLines: [],
        empTip: {
          name: emp.name,
          dynastyLabel: emp.dynastyLabel,
          portraitUrl: emp.portraitUrl,
          reignLabel: emp.reigns.map((rg) => fmtPeriod(rg.a, rg.b)).join("、"),
          details,
        },
      };
    }
    const p = rel2.personById.get(id)!;
    const disp = PERSON_DISPLAY_OVERRIDES[id];
    const tipName =
      disp?.label !== undefined && disp.label !== p.name
        ? `${disp.label}（${p.name}）`
        : p.name;
    const tipLines: TipLine[] = [
      { text: `${p.female ? "♀ " : ""}${tipName}` },
      { text: personPeriod(p), muted: true },
    ];
    const label = `${p.female ? "♀" : ""}${disp?.label ?? shortName(p.name)}`;
    if (isConsort) {
      const husband = rel2.attachedTo.get(id);
      const kids = [...rel2.motherOf.entries()]
        .filter(([, m]) => m === id)
        .map(([c]) => nameOf(c));
      const parts: string[] = [];
      // 「夫:」は正式な婚姻(=婚姻エッジのある皇后)のみ。妃嬪は礼制上は妾であり
      // 「夫」は嫡妻を含意するため使わない(収録・検証済みなのも母子関係のみ)。
      // 皇帝の後宮は「〇〇の妃嬪」と所属で示し、attach先が皇帝でない人物
      // (史皇孫劉進に付く王翁須など)は関係語を出さず子のみ示す。
      if (husband) {
        if (rel2.attachDouble.get(id)) parts.push(`夫: ${nameOf(husband)}`);
        else if (rel2.emperorById.has(husband))
          parts.push(`${nameOf(husband)}の妃嬪`);
      }
      if (kids.length > 0) parts.push(`子: ${kids.join("・")}`);
      if (parts.length > 0) tipLines.push({ text: parts.join("／"), muted: true });
    } else {
      const fatherId = rel2.primaryFather.get(id);
      if (fatherId) tipLines.push({ text: `父: ${nameOf(fatherId)}`, muted: true });
    }
    if (disp?.tipNote) tipLines.push({ text: disp.tipNote, muted: true });
    for (const c of claims)
      tipLines.push({ text: `◇遠祖の主張: ${c.claimedAncestry}`, muted: true });
    return {
      key: id,
      id,
      kind: isConsort ? "consort" : "person",
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      label,
      segments: null,
      sub: disp?.role ?? null,
      colorSlot: 0,
      female: p.female,
      claimBadge: claims.length > 0,
      tipLines,
      empTip: null,
    };
  }
}
