// レイアウトの当たりを取るための計測用スクリプト（配信物には関係しない）。
//
// 第1段（2026-08-18 午前）は寸法と充填率で NETWORK_SIMPLEX / 112×140 を選んだ。
// 第2段（このファイルの現状）は**列を政権に割る**（B = UsefulCharts の作法）ために、
// 横の並び順を elk にどう伝えるかを3通り比べる。
//
//   node scripts/probe-kinship-layout.mjs
//
// 見る指標:
//   外寸・充填率・段数 … 図の疎さ（前回の取り下げ理由の筆頭）
//   列の純度          … 各段で政権が何回入れ替わるか。列が政権で分かれていれば小さい
//   交差              … 親子の線どうしの交差数（直線近似）
import { readFileSync } from "node:fs";
import path from "node:path";
import ELK from "elkjs/lib/elk.bundled.js";

const ERA_ID = "qin-han";
const root = path.join(process.cwd(), "..");
const emperors = JSON.parse(readFileSync(path.join(root, "data", "emperors.json"), "utf8"));
const kinship = JSON.parse(readFileSync(path.join(root, "data", "kinship.json"), "utf8"));

const emp = emperors.emperors.filter((e) => e.eraId === ERA_ID);
const per = kinship.persons.filter((p) => p.eraId === ERA_ID);
const ids = new Set([...emp.map((e) => e.id), ...per.map((p) => p.id)]);

const father = new Map();
const mother = new Map();
for (const [f, m] of [
  ["birth-father", "birth-mother"],
  ["adoptive-father", "adoptive-mother"],
]) {
  for (const ed of kinship.edges) {
    if (ed.type !== "kinship") continue;
    if (!ids.has(ed.from) || !ids.has(ed.to)) continue;
    if (ed.relation === f && !father.has(ed.to)) father.set(ed.to, ed.from);
    if (ed.relation === m && !mother.has(ed.to)) mother.set(ed.to, ed.from);
  }
}
const spouses = new Set();
for (const ed of kinship.edges) {
  if (ed.type !== "marriage") continue;
  if (!ids.has(ed.from) || !ids.has(ed.to)) continue;
  spouses.add([ed.from, ed.to].sort().join("|"));
}

// ---------------------------------------------------------------- 政権の割り当て
const regimeOf = new Map(emp.map((e) => [e.id, e.regimeId]));
const firstYear = new Map();
for (const e of emp) {
  const ys = (e.reigns ?? []).map((r) => r.startYear).filter((y) => y != null);
  if (!ys.length) continue;
  const cur = firstYear.get(e.regimeId);
  const y = Math.min(...ys);
  if (cur === undefined || y < cur) firstYear.set(e.regimeId, y);
}
// 皇帝を持つ政権を時代順に並べ、**後漢だけは最後**へ（前漢と同じ劉氏の続きなので、
// 同年に立った赤眉・成家・梁の手前に置くと列をまたぐ線が увеличと交差する）。
const regimeOrder = [...firstYear.keys()].sort((a, b) => firstYear.get(a) - firstYear.get(b));
const idx = new Map(regimeOrder.map((r, i) => [r, i]));

const adj = new Map();
const push = (a, b) => {
  const cur = adj.get(a);
  if (cur) cur.add(b);
  else adj.set(a, new Set([b]));
};
for (const ed of kinship.edges) {
  if (ed.type !== "kinship" && ed.type !== "marriage") continue;
  if (!ids.has(ed.from) || !ids.has(ed.to)) continue;
  push(ed.from, ed.to);
  push(ed.to, ed.from);
}
const groupOf = new Map(regimeOf);
let frontier = [...regimeOf.keys()];
while (frontier.length) {
  const next = [];
  for (const n of frontier) {
    for (const m of adj.get(n) ?? []) {
      if (groupOf.has(m)) continue;
      groupOf.set(m, groupOf.get(n));
      next.push(m);
    }
  }
  frontier = next;
}

function build(cardW, cardH, unionSize) {
  const unions = new Map();
  const direct = [];
  for (const id of ids) {
    const f = father.get(id);
    const m = mother.get(id);
    if (f && m) {
      const key = `${f}|${m}`;
      if (!unions.has(key)) unions.set(key, { id: `u-${unions.size}`, f, m, children: [] });
      unions.get(key).children.push(id);
    } else if (f) direct.push([f, id]);
    else if (m) direct.push([m, id]);
  }
  for (const key of spouses) {
    const [a, b] = key.split("|");
    if (unions.has(`${a}|${b}`) || unions.has(`${b}|${a}`)) continue;
    unions.set(`${a}|${b}`, { id: `u-${unions.size}`, f: a, m: b, children: [] });
  }
  const nodes = [...ids].map((id) => ({ id, width: cardW, height: cardH }));
  for (const u of unions.values()) nodes.push({ id: u.id, width: unionSize, height: unionSize });
  const edges = [];
  let i = 0;
  for (const u of unions.values()) {
    edges.push({ id: `e${i++}`, sources: [u.f], targets: [u.id] });
    edges.push({ id: `e${i++}`, sources: [u.m], targets: [u.id] });
    for (const c of u.children) edges.push({ id: `e${i++}`, sources: [u.id], targets: [c] });
  }
  for (const [a, b] of direct) edges.push({ id: `e${i++}`, sources: [a], targets: [b] });
  // union の政権は父方に合わせる（帯の色は付けないが、並び順の鍵として要る）
  for (const u of unions.values()) groupOf.set(u.id, groupOf.get(u.f) ?? groupOf.get(u.m));
  return { nodes, edges, unions };
}

/** 各段で政権が何回入れ替わるか（小さいほど列が政権で分かれている）。 */
function columnPurity(persons) {
  const rows = new Map();
  for (const n of persons) {
    const y = Math.round(n.y);
    const cur = rows.get(y);
    if (cur) cur.push(n);
    else rows.set(y, [n]);
  }
  let switches = 0;
  for (const row of rows.values()) {
    row.sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i += 1) {
      if (groupOf.get(row[i].id) !== groupOf.get(row[i - 1].id)) switches += 1;
    }
  }
  return switches;
}

/** 親子の線を直線と見なした交差数。 */
function crossings(g, edges) {
  const pos = new Map(g.children.map((n) => [n.id, { x: n.x + n.width / 2, y: n.y + n.height / 2 }]));
  const segs = edges
    .map((e) => [pos.get(e.sources[0]), pos.get(e.targets[0])])
    .filter(([a, b]) => a && b);
  const ccw = (a, b, c) => (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  let n = 0;
  for (let i = 0; i < segs.length; i += 1) {
    for (let j = i + 1; j < segs.length; j += 1) {
      const [a, b] = segs[i];
      const [c, d] = segs[j];
      if (a === c || a === d || b === c || b === d) continue;
      if (ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d)) n += 1;
    }
  }
  return n;
}

const elk = new ELK();
const W = 112;
const H = 140;

const CASES = [
  { name: "既定（LAYER_SWEEP）", cross: "LAYER_SWEEP" },
  { name: "政権順で初期xを与えて INTERACTIVE", cross: "INTERACTIVE", seed: true },
  { name: "政権順にノードを渡して modelOrder", cross: "LAYER_SWEEP", modelOrder: true },
];

for (const c of CASES) {
  const { nodes, edges } = build(W, H, 10);
  let children = nodes;
  if (c.seed) {
    // 政権の時代順に横の帯域を割り当てて初期位置を置く。INTERACTIVE はこの x を見る。
    children = nodes.map((n) => ({
      ...n,
      x: (idx.get(groupOf.get(n.id)) ?? regimeOrder.length) * 2000,
      y: 0,
    }));
  }
  if (c.modelOrder) {
    children = [...nodes].sort(
      (a, b) =>
        (idx.get(groupOf.get(a.id)) ?? 99) - (idx.get(groupOf.get(b.id)) ?? 99),
    );
  }
  const g = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.layered.layering.strategy": "NETWORK_SIMPLEX",
      "elk.layered.crossingMinimization.strategy": c.cross,
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.spacing.nodeNode": "14",
      "elk.layered.spacing.nodeNodeBetweenLayers": "40",
      "elk.spacing.edgeNode": "12",
      "elk.edgeRouting": "ORTHOGONAL",
      ...(c.modelOrder
        ? { "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES" }
        : {}),
    },
    children,
    edges,
  });
  const persons = g.children.filter((n) => !n.id.startsWith("u-"));
  const ink = persons.length * W * H;
  const area = g.width * g.height;
  const ys = new Set(persons.map((n) => Math.round(n.y)));
  console.log(
    `${c.name.padEnd(36)} ${String(Math.round(g.width)).padStart(5)}×${String(Math.round(g.height)).padStart(5)}px  充填 ${((100 * ink) / area).toFixed(1).padStart(5)}%  段 ${String(ys.size).padStart(3)}  列の乱れ ${String(columnPurity(persons)).padStart(3)}  交差 ${crossings(g, edges)}`,
  );
}
