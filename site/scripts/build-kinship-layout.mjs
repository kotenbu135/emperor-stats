// 系譜図（Issue #174）の座標をビルド前に確定する。
//
// **なぜスクリプトなのか** — elkjs の API が非同期で、Server Component の同期レンダーからは
// 呼べない。座標は入力（emperors.json・kinship.json）が変わらなければ変わらないので、
// prebuild で 1 回だけ解いて JSON に落とし、ページはそれを読むだけにする。
// 「レイアウト = elkjs（ビルド時のみ・devDependencies・配布物 out/ に混ぜない）」は
// 2026-08-01 のユーザー決定（Issue #174）。
//
// **縦軸は世代の段**（実時間スケールではない）。elk の LONGEST_PATH レイヤ割り当てが
// そのまま世代になる。前回の版は在位年数で箱の高さを伸ばしていて、在位の長い皇帝が
// 「名前だけ書かれた空の縦棒」になった — その形はここでは作らない（カードは固定寸法）。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import ELK from "elkjs/lib/elk.bundled.js";

const ERA_ID = "qin-han";

// カードの寸法。肖像の有無で変えない（A: Die Welt der Habsburger の作法。肖像が無い人は
// 同じ寸法の色板になるだけで、図の格子は崩れない）。
// 寸法と間隔は probe-kinship-layout.mjs で6通り測って選んだ（外寸 3023×4144px・
// 段24）。LONGEST_PATH は直系の鎖に引きずられて 4798×5002px まで広がるので採らない。
const CARD_W = 112;
const CARD_H = 140;
const UNION_SIZE = 10;

const root = path.join(process.cwd(), "..");
const emperors = JSON.parse(readFileSync(path.join(root, "data", "emperors.json"), "utf8"));
const kinship = JSON.parse(readFileSync(path.join(root, "data", "kinship.json"), "utf8"));
const portraits = JSON.parse(
  readFileSync(path.join(root, "data", "images", "portraits", "manifest.json"), "utf8"),
);

const portraitById = new Map(portraits.map((p) => [p.id, p]));

const emp = emperors.emperors.filter((e) => e.eraId === ERA_ID);
const per = kinship.persons.filter((p) => p.eraId === ERA_ID);
const ids = new Set([...emp.map((e) => e.id), ...per.map((p) => p.id)]);

// ---------------------------------------------------------------- ノード
const cards = new Map();
for (const e of emp) {
  const reigns = e.reigns ?? [];
  const s = reigns.length ? reigns[0].startYear : null;
  const t = reigns.length ? reigns[reigns.length - 1].endYear : null;
  // 配信されるのは public/portraits/<id>.webp（manifest の localFile は元画像の .jpg で、
  // サイトに出るファイル名ではない）。**実在で判定する** — manifest にあってサイトに無い
  // 人物を「肖像あり」にすると、カードの上半分が壊れた画像になる。
  const hasPortrait = existsSync(path.join(process.cwd(), "public", "portraits", `${e.id}.webp`));
  const portrait = hasPortrait ? portraitById.get(e.id) : null;
  cards.set(e.id, {
    id: e.id,
    emperorId: e.id,
    label: e.name?.commonName ?? e.id,
    regimeId: e.regimeId,
    isEmperor: true,
    reignFrom: s,
    reignTo: t,
    birthYear: e.ages?.birthYear ?? null,
    deathYear: e.ages?.deathYear ?? null,
    portrait: hasPortrait ? `${e.id}.webp` : null,
    focusY: portrait ? (portrait.focusY ?? 0.25) : null,
  });
}
for (const p of per) {
  if (cards.has(p.id)) continue;
  cards.set(p.id, {
    id: p.id,
    emperorId: null,
    label: p.name ?? p.id,
    regimeId: null,
    isEmperor: false,
    reignFrom: null,
    reignTo: null,
    birthYear: p.birthYear ?? null,
    deathYear: p.deathYear ?? null,
    kind: p.kind ?? null,
    gender: p.gender ?? null,
    portrait: null,
    focusY: null,
  });
}

// ---------------------------------------------------------------- 親子・夫婦
const FATHER = new Set(["birth-father", "adoptive-father"]);
const MOTHER = new Set(["birth-mother", "adoptive-mother"]);

const father = new Map(); // child -> parent id
const mother = new Map();
const parentEdges = []; // {from, to, relation}
for (const ed of kinship.edges) {
  if (ed.type !== "kinship") continue;
  if (!ids.has(ed.from) || !ids.has(ed.to)) continue;
  const rel = ed.relation;
  if (FATHER.has(rel)) {
    if (!father.has(ed.to)) father.set(ed.to, ed.from);
    parentEdges.push({ from: ed.from, to: ed.to, relation: rel });
  } else if (MOTHER.has(rel)) {
    if (!mother.has(ed.to)) mother.set(ed.to, ed.from);
    parentEdges.push({ from: ed.from, to: ed.to, relation: rel });
  }
  // remote-ancestor（遠祖）は段が飛ぶので図には引かない
}

const spouses = new Map(); // "a|b" -> true
for (const ed of kinship.edges) {
  if (ed.type !== "marriage") continue;
  if (!ids.has(ed.from) || !ids.has(ed.to)) continue;
  spouses.set([ed.from, ed.to].sort().join("|"), true);
}

// 両親が揃う子は union（夫婦の結び目）から下ろす。片親しか分からない子は親から直接。
const unions = new Map(); // key -> {id, father, mother, children[]}
const directParent = []; // {from, to, relation}
for (const child of cards.keys()) {
  const f = father.get(child);
  const m = mother.get(child);
  if (f && m) {
    const key = `${f}|${m}`;
    if (!unions.has(key)) {
      unions.set(key, { id: `u-${unions.size}`, father: f, mother: m, children: [] });
    }
    unions.get(key).children.push(child);
  } else if (f) {
    directParent.push({ from: f, to: child, relation: "father" });
  } else if (m) {
    directParent.push({ from: m, to: child, relation: "mother" });
  }
}
// 夫婦だが子が（この章に）いない組も、横に並べたいので union を立てる
for (const key of spouses.keys()) {
  const [a, b] = key.split("|");
  const ca = cards.get(a);
  const cb = cards.get(b);
  if (!ca || !cb) continue;
  const k1 = `${a}|${b}`;
  const k2 = `${b}|${a}`;
  if (unions.has(k1) || unions.has(k2)) continue;
  const male = ca.gender === "female" ? b : a;
  const female = male === a ? b : a;
  unions.set(`${male}|${female}`, {
    id: `u-${unions.size}`,
    father: male,
    mother: female,
    children: [],
  });
}

// ---------------------------------------------------------------- elk へ
const elkNodes = [];
for (const c of cards.values()) {
  elkNodes.push({ id: c.id, width: CARD_W, height: CARD_H });
}
for (const u of unions.values()) {
  elkNodes.push({ id: u.id, width: UNION_SIZE, height: UNION_SIZE });
}

const elkEdges = [];
let ei = 0;
for (const u of unions.values()) {
  elkEdges.push({ id: `e${ei++}`, sources: [u.father], targets: [u.id] });
  elkEdges.push({ id: `e${ei++}`, sources: [u.mother], targets: [u.id] });
  for (const ch of u.children) {
    elkEdges.push({ id: `e${ei++}`, sources: [u.id], targets: [ch] });
  }
}
for (const d of directParent) {
  elkEdges.push({ id: `e${ei++}`, sources: [d.from], targets: [d.to] });
}

const elk = new ELK();
const graph = await elk.layout({
  id: "root",
  layoutOptions: {
    "elk.algorithm": "layered",
    "elk.direction": "DOWN",
    // 世代の段。LONGEST_PATH は「親より必ず下の段」を最短ではなく最長経路で置く。
    "elk.layered.layering.strategy": "NETWORK_SIMPLEX",
    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
    "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
    "elk.spacing.nodeNode": "14",
    "elk.layered.spacing.nodeNodeBetweenLayers": "40",
    "elk.spacing.edgeNode": "12",
    "elk.edgeRouting": "ORTHOGONAL",
  },
  children: elkNodes,
  edges: elkEdges,
});

const pos = new Map(graph.children.map((n) => [n.id, { x: n.x, y: n.y }]));

// ---------------------------------------------------------------- 出力
const nodes = [];
for (const c of cards.values()) {
  const p = pos.get(c.id);
  nodes.push({ ...c, x: Math.round(p.x), y: Math.round(p.y), w: CARD_W, h: CARD_H });
}
const unionNodes = [];
for (const u of unions.values()) {
  const p = pos.get(u.id);
  unionNodes.push({
    id: u.id,
    x: Math.round(p.x),
    y: Math.round(p.y),
    w: UNION_SIZE,
    h: UNION_SIZE,
    father: u.father,
    mother: u.mother,
    children: u.children,
  });
}

const width = Math.round(graph.width);
const height = Math.round(graph.height);

// 段（世代）— elk が置いた y をそのまま段の代表値として使う
const layerYs = [...new Set(nodes.map((n) => n.y))].sort((a, b) => a - b);

const out = {
  eraId: ERA_ID,
  generatedFrom: {
    emperors: emp.length,
    persons: per.length,
    unions: unionNodes.length,
    parentEdges: elkEdges.length,
  },
  width,
  height,
  cardW: CARD_W,
  cardH: CARD_H,
  layers: layerYs.length,
  nodes,
  unions: unionNodes,
  directParent,
};

const destDir = path.join(process.cwd(), "src", "lib", "kinship");
mkdirSync(destDir, { recursive: true });
writeFileSync(path.join(destDir, "layout.qin-han.json"), JSON.stringify(out), "utf8");

console.log(
  `kinship layout: ${nodes.length} 人 / union ${unionNodes.length} / 段 ${layerYs.length} / ${width}×${height}px`,
);
