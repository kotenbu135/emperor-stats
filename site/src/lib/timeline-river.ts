// 通史年表v2「大河」ビュー(/timeline)のビルド時データ構築。
// 設計: docs/site-design/TIMELINE.md「第2世代（大河ビュー）」・モック:
// docs/site-design/mockups/timeline-river.html。
//
// - 87王朝(dynastyKey単位)を約35本の「流れ(ストリーム)」+群雄クラスターに集約する。
//   集約と縦配置(row)・配色系統のみ下のSTREAM_DEFSで手動キュレーションし、期間・
//   太さ(唯一在位)・皇帝セグメント・空位・統一/分裂の判定はすべて在位データの写像。
// - row: 0=中央(天下統一の座)・負=北方・正=南方(縦軸に地理の意味を持たせる)。
// - 「唯一在位(sole)」= その年に在位する皇帝がこのストリームの王朝にしかいない。
//   歴史的な「全土統一」とは異なる機械的定義(東晋371-383・南宋1235-1259・
//   満洲国1934-45も該当する)。ページ側の脚注で明示する。
// - 本モジュール内の年はすべて天文年(astroYear済み。0年の無い暦との変換は
//   fromAstroYear)。fsに依存しない純関数群(emperors.tsから呼ばれる)。

export interface RiverSourceEmperor {
  id: string;
  dynasty: { name: string | null; section: string | null };
  reigns: { startYear: number; endYear: number; isRestoration?: boolean }[];
}

export interface RiverSeg {
  emperorId: string;
  a: number;
  b: number;
  isRestoration: boolean;
}
export interface RiverPiece {
  a: number;
  b: number;
  sole: boolean;
}
export interface RiverSpan {
  a: number;
  b: number;
  row: number;
  pieces: RiverPiece[];
}
export interface RiverMember {
  label: string;
  lane: number;
  emperorCount: number;
  spans: { a: number; b: number }[];
  segs: RiverSeg[];
  a: number;
  b: number;
}
export type RiverStreamKind = "major" | "tiny" | "cluster";
export interface RiverStream {
  label: string;
  kind: RiverStreamKind;
  /** globals.cssの--series-N。clusterは0(灰ハッチ)。 */
  colorSlot: number;
  sub?: string;
  labelPos: "in" | "out" | "below";
  spans: RiverSpan[];
  segs: RiverSeg[];
  emperorCount: number;
  a: number;
  b: number;
  members?: RiverMember[];
  laneCount?: number;
  /** 五代のような集約ストリーム内の王朝境界。 */
  subdivs?: { label: string; a: number; b: number }[];
}
export interface RiverEdge {
  from: number;
  to: number;
  kind: "succ" | "fork" | "merge" | "dash";
  year: number | null;
}
export interface RiverTimelineData {
  a: number;
  b: number;
  rowMin: number;
  rowMax: number;
  streams: RiverStream[];
  edges: RiverEdge[];
  chapters: { a: number; b: number; label: string }[];
  events: { a: number; label: string; level: 0 | 1 }[];
  vacancies: { a: number; b: number }[];
  runs: { a: number; b: number; state: "sole" | "split" | "vacant" }[];
}

export function toAstroYear(year: number): number {
  return year > 0 ? year : year + 1;
}
export function fromAstroYear(a: number): number {
  return a > 0 ? a : a - 1;
}

// --- キュレーション: 集約・縦配置・配色系統 ---
// colorSlot は意味ベース: 漢系=4(金)・晋系=7(紫)・北族=1(青)・宋=2(緑)・
// 明=8(朱)・隋/南朝梁系=5(青緑)など。同時期に隣接する流れが同色にならない
// ことをモックで目視確認済み(橙6と桃3は時空間で隣接させない)。
interface StreamDef {
  label: string;
  keys: string[]; // dynastyKey (`name__section`)
  row: number;
  colorSlot: number;
  kind?: RiverStreamKind;
  sub?: string;
  labelPos?: "in" | "out" | "below";
  /** この天文年でスパンを切断し(西暦年でなく天文年)、rowsを個別指定する(清の入関・元の北走)。 */
  splits?: number[];
  rows?: number[];
  subdiv?: boolean;
}

const STREAM_DEFS: StreamDef[] = [
  { label: "秦", keys: ["秦__秦（始皇帝以降）"], row: 0, colorSlot: 8, labelPos: "out" },
  { label: "前漢", keys: ["前漢__秦（始皇帝以降）"], row: 0, colorSlot: 4 },
  { label: "新", keys: ["新__新"], row: 0, colorSlot: 1, labelPos: "out" },
  { label: "更始帝", keys: ["玄漢（更始）__新"], row: 0, colorSlot: 4, kind: "tiny", labelPos: "out" },
  { label: "後漢", keys: ["後漢__後漢"], row: 0, colorSlot: 4 },
  {
    label: "赤眉・成家など",
    keys: ["漢（赤眉軍）__漢（赤眉軍）", "成家__成家", "梁__梁"],
    row: 1, colorSlot: 0, kind: "cluster", labelPos: "out",
  },
  { label: "袁術（仲）", keys: ["仲家__仲家"], row: 1, colorSlot: 0, kind: "cluster", labelPos: "out" },
  { label: "魏", keys: ["魏__三国時代"], row: 0, colorSlot: 1 },
  { label: "蜀漢", keys: ["蜀漢__三国時代"], row: 1, colorSlot: 4 },
  { label: "呉", keys: ["呉__三国時代"], row: 2, colorSlot: 2 },
  { label: "西晋", keys: ["西晋__晋"], row: 0, colorSlot: 7 },
  {
    label: "五胡十六国",
    keys: [
      "成漢__成漢", "前趙（漢趙）__前趙", "後趙__後趙", "前燕__前燕", "前秦__前秦",
      "前涼__前涼", "西燕__西燕", "後燕__後燕", "後秦__後秦", "南燕__南燕", "夏__夏",
    ],
    row: -1, colorSlot: 0, kind: "cluster",
  },
  { label: "東晋", keys: ["東晋__晋"], row: 1, colorSlot: 7 },
  { label: "桓玄（楚）", keys: ["楚（桓楚）__楚"], row: 2, colorSlot: 0, kind: "cluster", labelPos: "out" },
  { label: "北魏", keys: ["北魏__北朝"], row: -1, colorSlot: 1 },
  { label: "東魏", keys: ["東魏__北朝"], row: -1, colorSlot: 1, labelPos: "out" },
  { label: "北斉", keys: ["北斉__北朝"], row: -1, colorSlot: 1 },
  { label: "西魏", keys: ["西魏__北朝"], row: -2, colorSlot: 7, labelPos: "out" },
  { label: "北周", keys: ["北周__北朝"], row: -2, colorSlot: 7 },
  { label: "宋", keys: ["宋__南朝"], row: 1, colorSlot: 2 },
  { label: "斉", keys: ["斉__南朝"], row: 1, colorSlot: 6 },
  { label: "梁", keys: ["梁__南朝"], row: 1, colorSlot: 5 },
  { label: "侯景（漢）", keys: ["梁（簒奪・漢）__南朝"], row: 2, colorSlot: 0, kind: "cluster", labelPos: "below" },
  { label: "後梁（西梁）", keys: ["後梁__南朝"], row: 2, colorSlot: 5, kind: "tiny", labelPos: "out" },
  { label: "陳", keys: ["陳__南朝"], row: 1, colorSlot: 3 },
  { label: "隋", keys: ["隋__隋"], row: 0, colorSlot: 5 },
  {
    label: "隋末群雄",
    keys: [
      "定楊__隋末群雄", "秦（西秦）__隋末群雄", "楚__隋末群雄", "許__隋末群雄",
      "梁__隋末群雄", "涼__隋末群雄", "鄭__隋末群雄", "呉__隋末群雄", "宋__隋末群雄",
    ],
    row: -1, colorSlot: 0, kind: "cluster", labelPos: "out",
  },
  { label: "唐", keys: ["唐__唐"], row: 0, colorSlot: 4 },
  { label: "武周", keys: ["周__唐"], row: 0, colorSlot: 3, labelPos: "out" },
  {
    label: "燕（安史の乱）ほか",
    keys: ["燕__唐", "秦（漢）__唐", "楚__唐", "斉__唐"],
    row: -1, colorSlot: 0, kind: "cluster", labelPos: "out",
  },
  {
    label: "五代",
    keys: ["後梁__五代十国", "後唐__五代十国", "後晋__五代十国", "後漢__五代十国", "後周__五代十国"],
    row: 0, colorSlot: 6, sub: "5王朝", subdiv: true,
  },
  {
    label: "十国",
    keys: [
      "前蜀__五代十国", "桀燕__五代十国", "南漢__五代十国", "呉__五代十国",
      "閩__五代十国", "後蜀__五代十国", "南唐__五代十国", "北漢__五代十国",
    ],
    row: 1, colorSlot: 0, kind: "cluster",
  },
  { label: "遼", keys: ["遼__宋遼西夏金"], row: -1, colorSlot: 1 },
  { label: "西遼", keys: ["西遼__宋遼西夏金"], row: -1, colorSlot: 1 },
  { label: "金", keys: ["金__宋遼西夏金"], row: -2, colorSlot: 7 },
  { label: "西夏", keys: ["西夏__宋遼西夏金"], row: -3, colorSlot: 5 },
  { label: "北宋", keys: ["北宋__宋遼西夏金"], row: 0, colorSlot: 2 },
  { label: "南宋", keys: ["南宋__宋遼西夏金"], row: 1, colorSlot: 2 },
  {
    label: "楚・斉（金の傀儡）",
    keys: ["楚__宋遼西夏金", "斉__宋遼西夏金"],
    row: 0, colorSlot: 0, kind: "cluster", labelPos: "out",
  },
  {
    label: "元", keys: ["元__元"], row: 0, colorSlot: 1,
    splits: [toAstroYear(1368)], rows: [0, -1],
  },
  { label: "北元", keys: ["北元__元"], row: -1, colorSlot: 1, labelPos: "out" },
  {
    label: "元末群雄",
    keys: ["天完__元", "宋__元", "陳漢__元", "夏__元"],
    row: 1, colorSlot: 0, kind: "cluster", sub: "天完・宋・陳漢・夏", labelPos: "out",
  },
  { label: "明", keys: ["明__明"], row: 0, colorSlot: 8 },
  { label: "南明", keys: ["南明__明"], row: 1, colorSlot: 8, labelPos: "out" },
  {
    label: "順・西（李自成・張献忠）",
    keys: ["順__明", "西__明"],
    row: 2, colorSlot: 0, kind: "cluster", labelPos: "out",
  },
  {
    label: "清", keys: ["清__清"], row: 0, colorSlot: 1,
    splits: [toAstroYear(1644)], rows: [-1, 0, 0, -1],
  },
  { label: "三藩の乱（呉周）", keys: ["呉周__清"], row: 1, colorSlot: 0, kind: "cluster", labelPos: "below" },
  { label: "袁世凱（中華帝国）", keys: ["中華帝国__清"], row: 0, colorSlot: 0, kind: "cluster", labelPos: "below" },
];

// 主要な画期(注記フラグ)。年表上の注記テキストで、データ項目ではない
// (出典判定を伴わない周知の画期のみ。levelは注記の段: 0=上段/1=下段)。
const EVENT_DEFS: [number, string, 0 | 1][] = [
  [-221, "秦が天下を統一", 0],
  [220, "後漢滅亡・三国へ", 0],
  [280, "西晋が再統一", 1],
  [317, "晋、江南へ（南北分裂）", 0],
  [439, "北魏が華北を統一", 1],
  [589, "隋が南北を再統一", 0],
  [690, "武則天・唯一の女帝", 1],
  [755, "安史の乱", 0],
  [907, "唐滅亡・五代十国", 1],
  [960, "北宋建国", 0],
  [1127, "靖康の変・宋が南遷", 1],
  [1279, "元が南宋を滅ぼし統一", 0],
  [1368, "明建国・元は北走", 1],
  [1644, "明滅亡・清が入関", 0],
  [1912, "宣統帝退位・帝制終焉", 1],
  [1934, "満洲国", 0],
];

const CHAPTER_DEFS: [number, number, string][] = [
  [-221, 220, "秦・漢"],
  [220, 280, "三国"],
  [280, 420, "晋・五胡十六国"],
  [420, 581, "南北朝"],
  [581, 907, "隋・唐"],
  [907, 960, "五代十国"],
  [960, 1279, "宋と北方王朝"],
  [1279, 1368, "元"],
  [1368, 1644, "明"],
  [1644, 1912, "清"],
  [1912, 1945, ""],
];

// 継承・分岐・吸収エッジ(ストリームlabel参照。year=nullはto側の開始年)。
const EDGE_DEFS: [string, string, RiverEdge["kind"], number | null][] = [
  ["秦", "前漢", "dash", null],
  ["前漢", "新", "succ", null],
  ["新", "更始帝", "succ", null],
  ["更始帝", "後漢", "succ", null],
  ["後漢", "魏", "succ", null],
  ["蜀漢", "魏", "merge", 263],
  ["魏", "西晋", "succ", null],
  ["呉", "西晋", "merge", 280],
  ["西晋", "東晋", "succ", null],
  ["西晋", "五胡十六国", "fork", 306],
  ["五胡十六国", "北魏", "merge", 439],
  ["東晋", "宋", "succ", null],
  ["北魏", "東魏", "succ", null],
  ["北魏", "西魏", "fork", 535],
  ["東魏", "北斉", "succ", null],
  ["西魏", "北周", "succ", null],
  ["北斉", "北周", "merge", 577],
  ["北周", "隋", "succ", null],
  ["宋", "斉", "succ", null],
  ["斉", "梁", "succ", null],
  ["梁", "陳", "succ", null],
  ["梁", "後梁（西梁）", "fork", 555],
  ["陳", "隋", "merge", 589],
  ["後梁（西梁）", "隋", "merge", 587],
  ["隋", "唐", "succ", null],
  ["隋", "隋末群雄", "fork", 617],
  ["隋末群雄", "唐", "merge", 628],
  ["唐", "武周", "succ", 690],
  ["武周", "唐", "succ", 705],
  ["唐", "五代", "succ", null],
  ["唐", "十国", "fork", 907],
  ["五代", "北宋", "succ", null],
  ["十国", "北宋", "merge", 979],
  ["北宋", "南宋", "succ", null],
  ["南宋", "元", "merge", 1279],
  ["元", "北元", "succ", null],
  ["元末群雄", "明", "merge", 1368],
  ["明", "南明", "fork", 1644],
  ["南明", "清", "merge", 1662],
];

function mergeIntervals(ivs: [number, number][], gap = 1): [number, number][] {
  const sorted = [...ivs].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const out: [number, number][] = [[...sorted[0]] as [number, number]];
  for (const [s, e] of sorted.slice(1)) {
    const last = out[out.length - 1];
    if (s <= last[1] + gap) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

export function buildRiverTimeline(emperors: RiverSourceEmperor[]): RiverTimelineData {
  interface KeyEntry {
    ivs: [number, number][];
    segs: RiverSeg[];
    emperorCount: number;
  }
  const byKey = new Map<string, KeyEntry>();
  const yearDyns = new Map<number, Set<string>>();
  for (const e of emperors) {
    const key = `${e.dynasty.name}__${e.dynasty.section}`; // emperors.tsのdynastyKeyと同一
    let ent = byKey.get(key);
    if (!ent) {
      ent = { ivs: [], segs: [], emperorCount: 0 };
      byKey.set(key, ent);
    }
    ent.emperorCount++;
    for (const r of e.reigns) {
      const a = toAstroYear(r.startYear);
      const b = toAstroYear(r.endYear);
      ent.ivs.push([a, b]);
      ent.segs.push({ emperorId: e.id, a, b, isRestoration: !!r.isRestoration });
      for (let y = a; y <= b; y++) {
        let s = yearDyns.get(y);
        if (!s) {
          s = new Set();
          yearDyns.set(y, s);
        }
        s.add(key);
      }
    }
  }

  // キュレーション表が全王朝を漏れなく1回ずつ扱うことをビルド時に強制する
  // (皇帝の追加収録や王朝表記の変更で表の更新漏れがあればビルドを落とす)。
  const used = new Set<string>();
  for (const def of STREAM_DEFS) {
    for (const k of def.keys) {
      if (!byKey.has(k)) throw new Error(`timeline-river: 未知のdynastyKeyです: "${k}"`);
      if (used.has(k)) throw new Error(`timeline-river: dynastyKeyが重複しています: "${k}"`);
      used.add(k);
    }
  }
  for (const k of byKey.keys()) {
    if (!used.has(k))
      throw new Error(
        `timeline-river: STREAM_DEFSに未割当のdynastyKeyがあります: "${k}"(新規収録時はキュレーション表に追記してください)`,
      );
  }

  const solePieces = (keys: Set<string>, a: number, b: number): RiverPiece[] => {
    const out: RiverPiece[] = [];
    let cur: RiverPiece | null = null;
    for (let y = a; y <= b; y++) {
      const ds = yearDyns.get(y);
      const sole = !!ds && ds.size > 0 && [...ds].every((k) => keys.has(k));
      if (cur && cur.sole === sole) cur.b = y;
      else {
        cur = { a: y, b: y, sole };
        out.push(cur);
      }
    }
    return out;
  };

  const streams: RiverStream[] = STREAM_DEFS.map((def) => {
    const kind = def.kind ?? "major";
    const ivs = def.keys.flatMap((k) => byKey.get(k)!.ivs);
    let spans = mergeIntervals(ivs);
    if (def.splits) {
      const cut: [number, number][] = [];
      for (const [s0, e] of spans) {
        let s = s0;
        for (const c of def.splits) {
          if (s < c && c <= e) {
            cut.push([s, c - 1]);
            s = c;
          }
        }
        cut.push([s, e]);
      }
      spans = cut;
    }
    const rows = def.rows ?? spans.map(() => def.row);
    if (rows.length !== spans.length)
      throw new Error(`timeline-river: "${def.label}" のrows指定(${rows.length})がスパン数(${spans.length})と一致しません`);
    const keySet = new Set(def.keys);
    const segs = def.keys
      .flatMap((k) => byKey.get(k)!.segs)
      .sort((p, q) => p.a - q.a || p.b - q.b);
    const stream: RiverStream = {
      label: def.label,
      kind,
      colorSlot: def.colorSlot,
      sub: def.sub,
      labelPos: def.labelPos ?? "in",
      spans: spans.map(([a, b], i) => ({
        a,
        b,
        row: rows[i],
        pieces: kind === "cluster" ? [{ a, b, sole: false }] : solePieces(keySet, a, b),
      })),
      segs,
      emperorCount: def.keys.reduce((n, k) => n + byKey.get(k)!.emperorCount, 0),
      a: spans[0][0],
      b: spans[spans.length - 1][1],
    };
    if (kind === "cluster") {
      const members: RiverMember[] = def.keys.map((k) => {
        const ent = byKey.get(k)!;
        const mspans = mergeIntervals(ent.ivs);
        return {
          label: k.split("__")[0],
          lane: 0,
          emperorCount: ent.emperorCount,
          spans: mspans.map(([a, b]) => ({ a, b })),
          segs: [...ent.segs].sort((p, q) => p.a - q.a || p.b - q.b),
          a: mspans[0][0],
          b: mspans[mspans.length - 1][1],
        };
      });
      members.sort((p, q) => p.a - q.a || q.b - q.a - (p.b - p.a));
      const laneEnds: number[] = [];
      for (const m of members) {
        const lane = laneEnds.findIndex((end) => m.a > end);
        if (lane === -1) {
          m.lane = laneEnds.length;
          laneEnds.push(m.b);
        } else {
          m.lane = lane;
          laneEnds[lane] = m.b;
        }
      }
      stream.members = members;
      stream.laneCount = laneEnds.length;
    }
    if (def.subdiv) {
      stream.subdivs = def.keys
        .map((k) => {
          const iv = mergeIntervals(byKey.get(k)!.ivs);
          return { label: k.split("__")[0], a: iv[0][0], b: iv[iv.length - 1][1] };
        })
        .sort((p, q) => p.a - q.a);
    }
    return stream;
  });

  const byLabel = new Map(streams.map((s, i) => [s.label, i]));
  const edges: RiverEdge[] = EDGE_DEFS.map(([f, t, kind, year]) => {
    const from = byLabel.get(f);
    const to = byLabel.get(t);
    if (from === undefined || to === undefined)
      throw new Error(`timeline-river: エッジのストリーム名が不正です: ${f} → ${t}`);
    return { from, to, kind, year: year === null ? null : toAstroYear(year) };
  });

  const a0 = Math.min(...streams.map((s) => s.a));
  const b0 = Math.max(...streams.map((s) => s.b));
  const vacancies: { a: number; b: number }[] = [];
  const runs: RiverTimelineData["runs"] = [];
  for (let y = a0; y <= b0; y++) {
    const n = yearDyns.get(y)?.size ?? 0;
    const state = n === 1 ? "sole" : n === 0 ? "vacant" : "split";
    const last = runs[runs.length - 1];
    if (last && last.state === state) last.b = y;
    else runs.push({ a: y, b: y, state });
    if (n === 0) {
      const lv = vacancies[vacancies.length - 1];
      if (lv && lv.b === y - 1) lv.b = y;
      else vacancies.push({ a: y, b: y });
    }
  }

  return {
    a: a0,
    b: b0,
    rowMin: Math.min(...streams.flatMap((s) => s.spans.map((sp) => sp.row))),
    rowMax: Math.max(...streams.flatMap((s) => s.spans.map((sp) => sp.row))),
    streams,
    edges,
    chapters: CHAPTER_DEFS.map(([a, b, label]) => ({
      a: toAstroYear(a),
      b: toAstroYear(b),
      label,
    })),
    events: EVENT_DEFS.map(([y, label, level]) => ({ a: toAstroYear(y), label, level })),
    vacancies,
    runs,
  };
}
