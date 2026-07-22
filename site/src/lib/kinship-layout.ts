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
  birthYear: number;
  deathYear: number;
  yearsApproximate: boolean;
}

export interface KinshipSourceEdge {
  from: string;
  to: string;
  category: string;
  relationToPredecessor: string;
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
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
  path: string;
  labelX: number;
  labelY: number;
  labelAnchor: "start" | "middle";
  /** 表示ラベル(カテゴリ。disputedは「?」付き)。 */
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
const NODE_GAP = 8; // 同一レーン内の押し下げ間隔(矢印の視認用)
const EMPEROR_W = 104;
const PERSON_W = 130;
const PERSON_H = 30;

interface PlacedNode extends KinshipNodeOut {
  section: string;
  nominalTop: number;
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

  // 年→px(線形)。ドメインはノードの実配置から算出する。
  const minYear = Math.min(
    ...src.emperors.map((e) => e.reigns[0].a),
    ...src.persons.map((p) => (p.birthYear + p.deathYear) / 2 - PERSON_H / 2 / PX_PER_YEAR),
  );
  const maxYear = Math.max(
    ...src.emperors.map((e) => e.reigns[0].b),
    ...src.persons.map((p) => (p.birthYear + p.deathYear) / 2 + PERSON_H / 2 / PX_PER_YEAR),
  );
  const yOf = (astro: number) => M_TOP + (astro - minYear) * PX_PER_YEAR;

  const laneX = (i: number) => AXIS_X + 16 + i * (LANE_W + LANE_GAP);
  const incoming = new Set(src.edges.map((e) => e.to));

  const fmtPeriod = (a: number, b: number) => {
    const fa = formatYear(fromAstroYear(a));
    const fb = formatYear(fromAstroYear(b));
    return fa === fb ? `${fa}年` : `${fa}–${fb}年`;
  };

  // --- ノードの名目配置 ---
  const placed: PlacedNode[] = [];
  for (const e of src.emperors) {
    // 試作範囲に複数在位者はいない(呼び出し側でassert済み)。reigns[0]のみ描画する。
    const r = e.reigns[0];
    const lane = laneBySection.get(e.section)!;
    const cx = laneX(lane) + LANE_W / 2;
    const nominalH = (r.b - r.a) * PX_PER_YEAR;
    const h = Math.max(nominalH, MIN_H);
    placed.push({
      id: e.id,
      kind: "emperor",
      section: e.section,
      nominalTop: yOf(r.a),
      cx,
      x: cx - EMPEROR_W / 2,
      y: 0,
      w: EMPEROR_W,
      h,
      label: e.name,
      labelOutside: nominalH < MIN_H,
      colorSlot: KINSHIP_COLOR_BY_DYNKEY[e.dynastyKey],
      rootBadge: incoming.has(e.id) ? null : `◆${e.accessionRouteCategory}`,
      tip: {
        title: e.name,
        subtitle: e.dynastyLabel,
        period: `在位 ${fmtPeriod(r.a, r.b)}`,
      },
    });
  }
  for (const p of src.persons) {
    const lane = laneBySection.get(p.section)!;
    const cx = laneX(lane) + LANE_W / 2;
    const mid = yOf((p.birthYear + p.deathYear) / 2);
    placed.push({
      id: p.id,
      kind: "person",
      section: p.section,
      nominalTop: mid - PERSON_H / 2,
      cx,
      x: cx - PERSON_W / 2,
      y: 0,
      w: PERSON_W,
      h: PERSON_H,
      label: p.name,
      labelOutside: false,
      colorSlot: 0,
      rootBadge: null,
      tip: {
        title: p.name,
        subtitle: `非皇帝（${p.kind}）`,
        period: `${p.yearsApproximate ? "生没年推定 " : ""}${fmtPeriod(p.birthYear, p.deathYear)}`,
      },
    });
  }

  // --- 同一レーン内の衝突押し下げ(短在位の最小高で重なる分を下へ。時間軸は近似線形になる) ---
  const byLane = new Map<number, PlacedNode[]>();
  for (const n of placed) {
    const lane = laneBySection.get(n.section)!;
    const arr = byLane.get(lane) ?? [];
    arr.push(n);
    byLane.set(lane, arr);
  }
  for (const arr of byLane.values()) {
    arr.sort((p, q) => p.nominalTop - q.nominalTop);
    let bottom = -Infinity;
    for (const n of arr) {
      n.y = Math.max(n.nominalTop, bottom + NODE_GAP);
      bottom = n.y + n.h;
    }
  }

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
    return {
      from: e.from,
      to: e.to,
      fromLabel: a.label,
      toLabel: b.label,
      path,
      labelX,
      labelY,
      labelAnchor,
      label: disputed ? `${e.category}?` : e.category,
      disputed,
      tip: {
        title: `継承〔${e.category}〕${disputed ? "（諸説あり）" : ""}`,
        detail: `${a.label} → ${b.label}／新帝は先代の${e.relationToPredecessor}／確度: ${e.confidence}`,
        noteExcerpt: e.noteExcerpt,
        source: e.sourcePage,
      },
    };
  });

  // --- レーン見出し・目盛り ---
  const lanes: KinshipLaneOut[] = KINSHIP_LANE_DEFS.map((def, i) => {
    const members = byLane.get(i) ?? [];
    const firstTop = Math.min(...members.map((n) => n.y));
    return { label: def.label, x: laneX(i), width: LANE_W, labelY: firstTop - 14 };
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
  const width = laneX(KINSHIP_LANE_DEFS.length - 1) + LANE_W + 60;

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
