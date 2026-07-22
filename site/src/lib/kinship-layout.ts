// 系譜・即位経路グラフ(/kinship)のビルド時レイアウト計算。
// 設計: data/schema/KINSHIP_SCHEMA.md「可視化の決定事項」(方式③: 縦=時間・横=王朝レーン)。
//
// - 現段階は「調査済み範囲(フェーズ1ブロック1・2 = 秦〜後漢36人・継承エッジ29本)での
//   描画検証」が目的の試作。KINSHIP_LANE_DEFS / KINSHIP_COLOR_BY_DYNKEY はこの範囲のみを
//   キュレーションし、被覆をビルド時にassertする(範囲拡大時は表への追記が必要)。
// - KINSHIP_SCHEMA.mdの決定どおりレイアウトはビルド時計算(クライアント側での再計算なし・
//   固定幅SVG+横スクロール)。本モジュール内の年はすべて天文年(astro済み。emperors.tsの
//   getKinshipGraphData()が変換して渡す)。fsに依存しない純関数群。
// - kinship/marriage エッジ・genealogicalClaims はフェーズ2以降でデータ未存在のため未実装。
//   複数在位(isRestoration)も範囲内に該当者がいないため reigns[0] のみ描画する
//   (複数カプセル+点線コネクタは未検証のシーム。範囲拡大時に実装・検証する)。

import { formatYear } from "@/lib/emperor-types";
import { fromAstroYear } from "@/lib/timeline-river";

// --- 入力(emperors.tsが整形して渡す。年はすべて天文年) ---

export interface KinshipSourceEmperor {
  id: string;
  name: string;
  dynastyLabel: string;
  /** `name__section`(emperors.tsのdynastyKeyと同一)。配色キュレーションのキー。 */
  dynastyKey: string;
  section: string;
  accessionRouteCategory: string;
  reigns: { a: number; b: number; isRestoration: boolean }[];
}

export interface KinshipSourcePerson {
  id: string;
  name: string;
  kind: string;
  section: string;
  /** 天文年。不明はnull(配置は系譜エッジの隣接ノードから推定する)。 */
  birthYear: number | null;
  deathYear: number | null;
  yearsApproximate: boolean;
}

export interface KinshipSourceEdge {
  type: "succession" | "kinship";
  from: string;
  to: string;
  /** succession のみ。 */
  category?: string;
  relationToPredecessor?: string;
  /** kinship のみ(実父/実母/養父/養母/兄弟姉妹)。 */
  relation?: string;
  veracity: string;
  confidence: string;
  /** 呼び出し側で約160字に切り詰め済み(RSCペイロード対策)。 */
  noteExcerpt: string;
  sourcePage: string;
}

export interface KinshipSource {
  emperors: KinshipSourceEmperor[];
  persons: KinshipSourcePerson[];
  edges: KinshipSourceEdge[];
}

// --- 出力(そのままクライアントのpropsになる) ---

export interface KinshipLaneOut {
  label: string;
  /** レーン左端x。ノードはレーン中央に置く。 */
  x: number;
  width: number;
  /** レーン見出しのy(レーン内の最初のノードの上)。 */
  labelY: number;
}

export interface KinshipNodeOut {
  id: string;
  kind: "emperor" | "person";
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** 最小高に圧縮されたカプセルはラベルを左外に置く(枠内に収まらないためではなく密集対策)。 */
  labelOutside: boolean;
  /** globals.cssの--series-N。0は灰(並立群雄)。 */
  colorSlot: number;
  /** 入エッジを持たない皇帝の「◆建国」「◆擁立」バッジ。 */
  rootBadge: string | null;
  tip: { title: string; subtitle: string; period: string };
}

export interface KinshipEdgeOut {
  edgeType: "succession" | "kinship";
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
  path: string;
  labelX: number;
  labelY: number;
  labelAnchor: "start" | "middle";
  /** 表示ラベル(succession=カテゴリ・disputedは「?」付き。kinship=続柄でグラフ内には描かずテキスト版でのみ使う)。 */
  label: string;
  disputed: boolean;
  tip: {
    title: string;
    detail: string;
    noteExcerpt: string;
    source: string;
  };
}

export interface KinshipLayout {
  width: number;
  height: number;
  lanes: KinshipLaneOut[];
  ticks: { y: number; label: string }[];
  axisX: number;
  nodes: KinshipNodeOut[];
  edges: KinshipEdgeOut[];
}

// --- キュレーション: レーン(=section)と配色 ---
// レーン順は左→右。唯一のレーン間エッジ(孺子嬰→王莽の禅譲)のため秦・前漢と新を隣接させる。
interface KinshipLaneDef {
  label: string;
  sections: string[];
}

const KINSHIP_LANE_DEFS: KinshipLaneDef[] = [
  { label: "秦・前漢", sections: ["秦（始皇帝以降）"] },
  { label: "新・玄漢", sections: ["新"] },
  { label: "後漢", sections: ["後漢"] },
  { label: "漢（赤眉軍）", sections: ["漢（赤眉軍）"] },
  { label: "成家", sections: ["成家"] },
  { label: "梁（劉永）", sections: ["梁"] },
  { label: "仲家（袁術）", sections: ["仲家"] },
];

// 配色はtimeline-river.tsのSTREAM_DEFSと同値(意味ベース: 漢系=4金・新=1青・秦=8朱・群雄=0灰)。
const KINSHIP_COLOR_BY_DYNKEY: Record<string, number> = {
  "秦__秦（始皇帝以降）": 8,
  "前漢__秦（始皇帝以降）": 4,
  新__新: 1,
  "玄漢（更始）__新": 4,
  後漢__後漢: 4,
  "漢（赤眉軍）__漢（赤眉軍）": 0,
  成家__成家: 0,
  梁__梁: 0,
  仲家__仲家: 0,
};

// --- レイアウト定数 ---
const AXIS_X = 64;
const LANE_W = 160;
const LANE_GAP = 30;
const M_TOP = 72;
const M_BOTTOM = 40;
const PX_PER_YEAR = 3;
const MIN_H = 26; // カプセル最小高(短在位もホバー・ラベルが成立する高さ)
const NODE_GAP = 8; // 連続するノード間の間隔(矢印の視認用。年境界から上下4pxずつ内側に描いて作る)
const EMPEROR_W = 104;
const PERSON_W = 130;
const PERSON_H = 30;
// 皇帝の在位期間と重なるブリッジ人物を置くレーン内左サブカラム(該当レーンのみ幅を拡張)
const SIDE_W = 118;
const SIDE_PERSON_W = 102;

interface PlacedNode extends KinshipNodeOut {
  lane: number;
  cx: number;
}

export function buildKinshipLayout(src: KinshipSource): KinshipLayout {
  // キュレーション表の被覆assert(timeline-riverのSTREAM_DEFSと同方式)。
  const laneBySection = new Map<string, number>();
  KINSHIP_LANE_DEFS.forEach((def, i) => {
    for (const s of def.sections) {
      if (laneBySection.has(s))
        throw new Error(`kinship-layout: sectionがレーン間で重複しています: "${s}"`);
      laneBySection.set(s, i);
    }
  });
  for (const e of src.emperors) {
    if (!laneBySection.has(e.section))
      throw new Error(
        `kinship-layout: KINSHIP_LANE_DEFSに未割当のsectionです: "${e.section}"(${e.id})`,
      );
    if (!(e.dynastyKey in KINSHIP_COLOR_BY_DYNKEY))
      throw new Error(
        `kinship-layout: KINSHIP_COLOR_BY_DYNKEYに未割当のdynastyKeyです: "${e.dynastyKey}"`,
      );
  }
  for (const p of src.persons) {
    if (!laneBySection.has(p.section))
      throw new Error(
        `kinship-layout: KINSHIP_LANE_DEFSに未割当のsectionです: "${p.section}"(${p.id})`,
      );
  }

  // 根バッジは「継承エッジの入次数」で判定する(血縁エッジは継承の根に影響しない)。
  const incoming = new Set(
    src.edges.filter((e) => e.type === "succession").map((e) => e.to),
  );

  const fmtPeriod = (a: number, b: number) => {
    const fa = formatYear(fromAstroYear(a));
    const fb = formatYear(fromAstroYear(b));
    return fa === fb ? `${fa}年` : `${fa}–${fb}年`;
  };
  const personPeriod = (p: KinshipSourcePerson): string => {
    if (p.birthYear === null && p.deathYear === null)
      return "生没年不詳（配置は系譜から推定）";
    if (p.birthYear !== null && p.deathYear !== null)
      return `${p.yearsApproximate ? "生没年推定 " : ""}${fmtPeriod(p.birthYear, p.deathYear)}`;
    const known = (p.birthYear ?? p.deathYear)!;
    const label = `${formatYear(fromAstroYear(known))}年${p.yearsApproximate ? "頃" : ""}`;
    return p.birthYear !== null ? `生 ${label}（没年不詳）` : `没 ${label}（生年不詳）`;
  };

  // --- ステップ0: 配置アンカー年 ---
  // 皇帝=在位中央、ブリッジ人物=生没中点(片方のみ判明ならその年)。両方不明の人物は
  // 「エッジで隣接するノードのアンカー平均」への緩和反復で推定する(データ側に推定値は
  // 入れない方針のため表示側で行う。チェーン上では既知アンカー間の線形補間に収束する)。
  const est = new Map<string, number>();
  for (const e of src.emperors) est.set(e.id, (e.reigns[0].a + e.reigns[0].b) / 2);
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
        if (vals.length > 0)
          est.set(id, vals.reduce((s, v) => s + v, 0) / vals.length);
      }
    }
    for (const id of unknown) {
      if (!est.has(id))
        throw new Error(
          `kinship-layout: ${id} の配置年を推定できません(年の判明したノードにエッジで到達しない)`,
        );
    }
  }

  // --- ステップ1: レーンごとに時系列順へ並べ、各ノードに「実効年区間」を割り当てる ---
  // 当初は「線形スケール+同一レーン内の押し下げ」だったが、押し下げは密集帯で
  // ノードが左軸の年目盛りから系統的にずれる(最大で十数年分)ため廃止し、
  // 「年→pxの単調な区分線形写像を、最小高が守れない密集期間だけ局所的に引き伸ばす」
  // 方式に変更した。ノードと目盛りが同じ写像を共有するので位置と年は常に一致する
  // (引き伸ばした期間は目盛り間隔が広がることで視覚的に分かる)。
  // 同一年内の連続即位(在位が年単位で0年の劉賀・少帝懿・少帝弁など)だけは
  // 0.5年の小数年オフセットで順序を保証する(1年未満の誤差は年単位の軸では表現不能)。
  interface Block {
    id: string;
    kind: "emperor" | "person";
    lane: number;
    /** main=継承カラム(皇帝と系列内ブリッジ)、side=レーン内左サブカラム。 */
    col: "main" | "side";
    effStart: number;
    effEnd: number;
    /** この区間が確保すべき最小px(ノード高+間隔)。 */
    minPx: number;
    node: Omit<KinshipNodeOut, "x" | "y" | "h"> & { cx: number; w: number };
  }

  // ブリッジ人物が実効区間として占有する年幅(片側)。基準スケールで
  // PERSON_H+NODE_GAP をほぼ満たす幅にし、通常は引き伸ばしを発生させない。
  const PERSON_HALF_SPAN = (PERSON_H + NODE_GAP) / 2 / PX_PER_YEAR;

  const seeds: Block[] = [];
  for (const e of src.emperors) {
    // 試作範囲に複数在位者はいない(呼び出し側でassert済み)。reigns[0]のみ描画する。
    const r = e.reigns[0];
    seeds.push({
      id: e.id,
      kind: "emperor",
      lane: laneBySection.get(e.section)!,
      col: "main",
      effStart: r.a,
      effEnd: r.b,
      minPx: MIN_H + NODE_GAP,
      node: {
        id: e.id,
        kind: "emperor",
        cx: 0, // レーン幅確定後に割り当て
        w: EMPEROR_W,
        label: e.name,
        labelOutside: (r.b - r.a) * PX_PER_YEAR < MIN_H,
        colorSlot: KINSHIP_COLOR_BY_DYNKEY[e.dynastyKey],
        rootBadge: incoming.has(e.id) ? null : `◆${e.accessionRouteCategory}`,
        tip: {
          title: e.name,
          subtitle: e.dynastyLabel,
          period: `在位 ${fmtPeriod(r.a, r.b)}`,
        },
      },
    });
  }
  // 皇帝の名目在位区間(レーン別)。ブリッジ人物のカラム判定に使う。
  const emperorIvsByLane = new Map<number, [number, number][]>();
  for (const s of seeds) {
    const arr = emperorIvsByLane.get(s.lane) ?? [];
    arr.push([s.effStart, s.effEnd]);
    emperorIvsByLane.set(s.lane, arr);
  }
  for (const p of src.persons) {
    const lane = laneBySection.get(p.section)!;
    const mid = est.get(p.id)!;
    const start = mid - PERSON_HALF_SPAN;
    const end = mid + PERSON_HALF_SPAN;
    // 皇帝の在位期間と時間的に重なるブリッジ人物(光武帝の前漢側祖先チェーン等)は、
    // 継承カラムの縦系列に割り込めないためレーン内の左サブカラムに置く。
    // 重ならない人物(荘襄王・孺子嬰型)は従来どおり継承カラムの系列に挟む。
    const overlaps = (emperorIvsByLane.get(lane) ?? []).some(
      ([a, b]) => start < b && end > a,
    );
    seeds.push({
      id: p.id,
      kind: "person",
      lane,
      col: overlaps ? "side" : "main",
      effStart: start,
      effEnd: end,
      minPx: PERSON_H + NODE_GAP,
      node: {
        id: p.id,
        kind: "person",
        cx: 0,
        w: overlaps ? SIDE_PERSON_W : PERSON_W,
        label: p.name,
        labelOutside: false,
        colorSlot: 0,
        rootBadge: null,
        tip: {
          title: p.name,
          subtitle: `非皇帝（${p.kind}）`,
          period: personPeriod(p),
        },
      },
    });
  }

  // --- レーン幅とx割り当て(サブカラムを持つレーンだけ幅を広げる) ---
  const laneHasSide = KINSHIP_LANE_DEFS.map((_, i) =>
    seeds.some((s) => s.lane === i && s.col === "side"),
  );
  const laneXs: number[] = [];
  {
    let x = AXIS_X + 16;
    for (let i = 0; i < KINSHIP_LANE_DEFS.length; i++) {
      laneXs.push(x);
      x += (laneHasSide[i] ? SIDE_W : 0) + LANE_W + LANE_GAP;
    }
  }
  const laneWidth = (i: number) => (laneHasSide[i] ? SIDE_W : 0) + LANE_W;
  for (const s of seeds) {
    s.node.cx =
      s.col === "side"
        ? laneXs[s.lane] + SIDE_W / 2
        : laneXs[s.lane] + (laneHasSide[s.lane] ? SIDE_W : 0) + LANE_W / 2;
  }

  // --- カラムごとに時系列順へ並べ、実効年区間を確定する ---
  const byColumn = new Map<string, Block[]>();
  for (const s of seeds) {
    const key = `${s.lane}:${s.col}`;
    byColumn.set(key, [...(byColumn.get(key) ?? []), s]);
  }
  const blocks: Block[] = [];
  for (const arr of byColumn.values()) {
    arr.sort((p, q) => p.effStart - q.effStart || p.effEnd - q.effEnd);
    let cursor = -Infinity;
    for (const b of arr) {
      b.effStart = Math.max(b.effStart, cursor);
      // 同一年内の連続即位(0年区間)は0.5年ずらして順序を保証する。
      if (b.effEnd <= b.effStart) b.effEnd = b.effStart + 0.5;
      cursor = b.effEnd;
      blocks.push(b);
    }
  }

  // --- ステップ2: 年→pxの単調な区分線形写像を構築する ---
  // 実効区間の端点をブレークポイントとし、基準スケール(PX_PER_YEAR)で初期化した
  // 区間長へ、最小pxを満たさないブロックの不足分を右端の区間に加算していく
  // (右端点の昇順に処理するため、加算が処理済みブロックを壊すことはない)。
  const bps = [...new Set(blocks.flatMap((b) => [b.effStart, b.effEnd]))].sort(
    (p, q) => p - q,
  );
  const bpIndex = new Map(bps.map((y, i) => [y, i]));
  const segLen = bps.slice(1).map((y, i) => (y - bps[i]) * PX_PER_YEAR);
  const posOf = () => {
    const pos = [0];
    for (const len of segLen) pos.push(pos[pos.length - 1] + len);
    return pos;
  };
  for (const b of [...blocks].sort((p, q) => p.effEnd - q.effEnd)) {
    const pos = posOf();
    const deficit =
      b.minPx - (pos[bpIndex.get(b.effEnd)!] - pos[bpIndex.get(b.effStart)!]);
    if (deficit > 0) segLen[bpIndex.get(b.effEnd)! - 1] += deficit;
  }
  const pos = posOf();
  // 写像本体: ブレークポイント間は線形補間。範囲外は基準スケールで外挿。
  const yOf = (astro: number): number => {
    if (astro <= bps[0]) return M_TOP + (astro - bps[0]) * PX_PER_YEAR;
    if (astro >= bps[bps.length - 1])
      return M_TOP + pos[pos.length - 1] + (astro - bps[bps.length - 1]) * PX_PER_YEAR;
    let lo = 0;
    let hi = bps.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (bps[mid] <= astro) lo = mid;
      else hi = mid;
    }
    const t = (astro - bps[lo]) / (bps[hi] - bps[lo]);
    return M_TOP + pos[lo] + t * (pos[hi] - pos[lo]);
  };
  const minYear = bps[0];
  const maxYear = bps[bps.length - 1];

  // --- ステップ3: ノード配置(実効区間の写像そのまま。上下NODE_GAP/2ずつ内側に
  //     描くことで、年境界を接して連続する即位でも矢印の描画余地を確保する) ---
  const placed: PlacedNode[] = blocks.map((b) => {
    const top = yOf(b.effStart) + NODE_GAP / 2;
    const bottom = yOf(b.effEnd) - NODE_GAP / 2;
    return {
      ...b.node,
      lane: b.lane,
      x: b.node.cx - b.node.w / 2,
      y: top,
      h: bottom - top,
    };
  });

  const nodeById = new Map(placed.map((n) => [n.id, n]));

  // --- エッジ ---
  const edges: KinshipEdgeOut[] = src.edges.map((e) => {
    const a = nodeById.get(e.from);
    const b = nodeById.get(e.to);
    if (!a || !b)
      throw new Error(`kinship-layout: エッジの端点が解決できません: ${e.from} → ${e.to}`);
    const disputed = e.veracity === "disputed";
    const sameLane = a.cx === b.cx;
    let path: string;
    let labelX: number;
    let labelY: number;
    let labelAnchor: "start" | "middle";
    if (!sameLane && a.y + a.h >= b.y) {
      // 「上→下(from.bottom→to.top)」規則が成り立たないレーン間エッジ(孺子嬰→王莽:
      // fromの生没中点がtoの即位年より下)は、側面どうしを水平ベジェで結ぶフォールバック。
      // ここが本試作の主検証対象のひとつ(見た目の判断はLAYOUT.mdに記録する)。
      const leftToRight = a.cx < b.cx;
      const x1 = leftToRight ? a.x + a.w : a.x;
      const x2 = leftToRight ? b.x : b.x + b.w;
      const y1 = a.y + a.h / 2;
      const y2 = b.y + b.h / 2;
      const mx = (x1 + x2) / 2;
      path = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
      labelX = mx;
      labelY = Math.min(y1, y2) - 6;
      labelAnchor = "middle";
    } else {
      // 通常: fromの下辺中央→toの上辺中央(時間順)。
      const y1 = a.y + a.h;
      const y2 = b.y;
      const my = (y1 + y2) / 2;
      path = `M ${a.cx} ${y1} C ${a.cx} ${my}, ${b.cx} ${my}, ${b.cx} ${y2}`;
      if (sameLane) {
        // 同一レーンの縦エッジはラベルをレーン右外へ(カプセル内テキストとの衝突回避)。
        labelX = a.cx + LANE_W / 2 + 6;
        labelY = my + 3;
        labelAnchor = "start";
      } else {
        labelX = (a.cx + b.cx) / 2;
        labelY = my - 5;
        labelAnchor = "middle";
      }
    }
    const isKin = e.type === "kinship";
    return {
      edgeType: e.type,
      from: e.from,
      to: e.to,
      fromLabel: a.label,
      toLabel: b.label,
      path,
      labelX,
      labelY,
      labelAnchor,
      // kinshipのラベルはグラフ内には描かない(チャート側でedgeTypeを見て抑制)が、
      // テキスト版「継承の流れ」の表示に使う。
      label: isKin ? (e.relation ?? "血縁") : disputed ? `${e.category}?` : e.category!,
      disputed,
      tip: isKin
        ? {
            title: `血縁〔${e.relation}〕`,
            detail: `${a.label} → ${b.label}／確度: ${e.confidence}`,
            noteExcerpt: e.noteExcerpt,
            source: e.sourcePage,
          }
        : {
            title: `継承〔${e.category}〕${disputed ? "（諸説あり）" : ""}`,
            detail: `${a.label} → ${b.label}／新帝は先代の${e.relationToPredecessor}／確度: ${e.confidence}`,
            noteExcerpt: e.noteExcerpt,
            source: e.sourcePage,
          },
    };
  });

  // --- レーン見出し・目盛り ---
  const lanes: KinshipLaneOut[] = KINSHIP_LANE_DEFS.map((def, i) => {
    const firstTop = Math.min(...placed.filter((n) => n.lane === i).map((n) => n.y));
    return { label: def.label, x: laneXs[i], width: laneWidth(i), labelY: firstTop - 14 };
  });

  // 目盛りは歴史年の50年刻み(0年は暦に存在しないため1年に置き換える)。
  const ticks: { y: number; label: string }[] = [];
  for (let h = Math.ceil(fromAstroYear(minYear) / 50) * 50; ; h += 50) {
    const hist = h === 0 ? 1 : h;
    const astro = hist < 0 ? hist + 1 : hist;
    if (astro > maxYear) break;
    if (astro < minYear) continue;
    ticks.push({ y: yOf(astro), label: formatYear(hist) });
  }

  const height =
    Math.max(...placed.map((n) => n.y + n.h), yOf(maxYear)) + M_BOTTOM;
  const width =
    laneXs[KINSHIP_LANE_DEFS.length - 1] +
    laneWidth(KINSHIP_LANE_DEFS.length - 1) +
    60;

  return {
    width,
    height,
    lanes,
    ticks,
    axisX: AXIS_X,
    nodes: placed.map((n) => ({
      id: n.id,
      kind: n.kind,
      x: n.x,
      y: n.y,
      w: n.w,
      h: n.h,
      label: n.label,
      labelOutside: n.labelOutside,
      colorSlot: n.colorSlot,
      rootBadge: n.rootBadge,
      tip: n.tip,
    })),
    edges,
  };
}
