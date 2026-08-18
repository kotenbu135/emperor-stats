// レイアウトの当たりを取るための計測用スクリプト（配信物には関係しない）。
// 「面積の8割が白」を数字で潰すため、設定を変えて外寸・充填率・段数を並べて出す。
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

const FATHER = new Set(["birth-father", "adoptive-father"]);
const MOTHER = new Set(["birth-mother", "adoptive-mother"]);
const father = new Map();
const mother = new Map();
for (const ed of kinship.edges) {
  if (ed.type !== "kinship") continue;
  if (!ids.has(ed.from) || !ids.has(ed.to)) continue;
  if (FATHER.has(ed.relation) && !father.has(ed.to)) father.set(ed.to, ed.from);
  if (MOTHER.has(ed.relation) && !mother.has(ed.to)) mother.set(ed.to, ed.from);
}
const spouses = new Set();
for (const ed of kinship.edges) {
  if (ed.type !== "marriage") continue;
  if (!ids.has(ed.from) || !ids.has(ed.to)) continue;
  spouses.add([ed.from, ed.to].sort().join("|"));
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
    if (!ids.has(a) || !ids.has(b)) continue;
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
  return { nodes, edges, personCount: ids.size };
}

const elk = new ELK();

const CASES = [
  { name: "LONGEST_PATH  132x168 gap22/56", layering: "LONGEST_PATH", w: 132, h: 168, nn: 22, ll: 56 },
  { name: "NETWORK_SIMPLEX 132x168 gap22/56", layering: "NETWORK_SIMPLEX", w: 132, h: 168, nn: 22, ll: 56 },
  { name: "COFFMAN_GRAHAM 132x168 gap22/56", layering: "COFFMAN_GRAHAM", w: 132, h: 168, nn: 22, ll: 56 },
  { name: "NETWORK_SIMPLEX 112x140 gap14/40", layering: "NETWORK_SIMPLEX", w: 112, h: 140, nn: 14, ll: 40 },
  { name: "NETWORK_SIMPLEX 112x140 gap14/40 +comp", layering: "NETWORK_SIMPLEX", w: 112, h: 140, nn: 14, ll: 40, comp: true },
  { name: "NETWORK_SIMPLEX 96x120 gap12/34 +comp", layering: "NETWORK_SIMPLEX", w: 96, h: 120, nn: 12, ll: 34, comp: true },
];

for (const c of CASES) {
  const { nodes, edges, personCount } = build(c.w, c.h, 10);
  const g = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.layered.layering.strategy": c.layering,
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.spacing.nodeNode": String(c.nn),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(c.ll),
      "elk.spacing.edgeNode": "12",
      "elk.edgeRouting": "ORTHOGONAL",
      ...(c.comp ? { "elk.separateConnectedComponents": "true", "elk.spacing.componentComponent": "40" } : {}),
    },
    children: nodes,
    edges,
  });
  const persons = g.children.filter((n) => !n.id.startsWith("u-"));
  const ink = persons.length * c.w * c.h;
  const area = g.width * g.height;
  const ys = new Set(persons.map((n) => Math.round(n.y)));
  console.log(
    `${c.name.padEnd(42)} ${String(Math.round(g.width)).padStart(5)}×${String(Math.round(g.height)).padStart(5)}px  充填 ${((100 * ink) / area).toFixed(1).padStart(5)}%  段 ${String(ys.size).padStart(3)}  人 ${personCount}`,
  );
}
