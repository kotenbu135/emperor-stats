// 系譜図（Issue #174）の座標をビルド前に確定する。
//
// **なぜスクリプトなのか** — elkjs の API が非同期で、Server Component の同期レンダーからは
// 呼べない。座標は入力（emperors.json・kinship.json）が変わらなければ変わらないので、
// prebuild で 1 回だけ解いて JSON に落とし、ページはそれを読むだけにする。
// 「レイアウト = elkjs（ビルド時のみ・devDependencies・配布物 out/ に混ぜない）」は
// 2026-08-01 のユーザー決定（Issue #174）。
//
// **縦軸は世代の段**（実時間スケールではない）。elk の NETWORK_SIMPLEX レイヤ割り当てが
// そのまま世代になる。前回の版は在位年数で箱の高さを伸ばしていて、在位の長い皇帝が
// 「名前だけ書かれた空の縦棒」になった — その形はここでは作らない（カードは固定寸法）。
//
// **ただし世代の段は時代順とは限らない。** 別々の系統は世代が独立なので、elk に任せると
// 「親が分からない人」が時代を無視して最上段に横一列に並ぶ（呂不韋 前290 と 明德馬皇后 40 が
// 同じ段に出ていた）。そこで**巨大成分の段から「段→年」の対応を作り、小さい成分を
// その年に合う段まで平行移動する**（2026-08-18 のユーザー指示「ある程度の時代感は反映したい」）。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import ELK from "elkjs/lib/elk.bundled.js";

const ERA_ID = "qin-han";

// 寸法と間隔は probe-kinship-layout.mjs で測って選んだ。
const CARD_W = 112;
// 皇帝のカードだけが縦長（上半分が肖像）。**皇帝以外は肖像アセットが1枚も無い**ので、
// 縦長の枠を用意しても中身は姓一文字のモノグラムにしかならない（2026-08-18 ユーザー指示で
// 名前と年の帯だけに縮めた）。図が縦にも横にも詰まり、親子の線が短くなる副次効果がある。
const EMPEROR_H = 140;
const KIN_H = 38;
const UNION_SIZE = 10;
const heightOf = (c) => (c.isEmperor ? EMPEROR_H : KIN_H);

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

// 章の外にいる人物も名前だけ引けるようにする（章をまたぐ親子を出すため）。
const outsideEra = new Map();
for (const e of emperors.emperors) if (e.eraId !== ERA_ID) outsideEra.set(e.id, e);
for (const p of kinship.persons) if (p.eraId !== ERA_ID) outsideEra.set(p.id, p);
const labelOf = (id) => {
  const o = outsideEra.get(id);
  if (!o) return id;
  return o.name?.commonName ?? o.name ?? id;
};
const eraOf = (id) => outsideEra.get(id)?.eraId ?? null;

// ---------------------------------------------------------------- ノード
const cards = new Map();
for (const e of emp) {
  const reigns = e.reigns ?? [];
  const s = reigns.length ? reigns[0].startYear : null;
  const t = reigns.length ? reigns[reigns.length - 1].endYear : null;
  // 配信されるのは public/portraits/<id>.webp（manifest の localFile は元画像の .jpg で、
  // サイトに出るファイル名ではない）。**実在で判定する**。
  const hasPortrait = existsSync(path.join(process.cwd(), "public", "portraits", `${e.id}.webp`));
  const portrait = hasPortrait ? portraitById.get(e.id) : null;
  cards.set(e.id, {
    id: e.id,
    emperorId: e.id,
    label: e.name?.commonName ?? e.id,
    regimeId: e.regimeId,
    isEmperor: true,
    gender: "male",
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
    gender: p.gender ?? null,
    reignFrom: null,
    reignTo: null,
    birthYear: p.birthYear ?? null,
    deathYear: p.deathYear ?? null,
    portrait: null,
    focusY: null,
  });
}

/** カードの代表年（時代の並べ替えに使う）。在位開始 → 生年 → 没年の順。 */
const yearOf = (c) => c.reignFrom ?? c.birthYear ?? c.deathYear ?? null;

// ---------------------------------------------------------------- 親子・夫婦
//
// **親を1人に絞らない。** 絞ると (a) 始皇帝のように実父が2人記録されている人物
// （荘襄王と呂不韋＝史料の異説）で片方が図から消え、(b) 養母しか結び付きが無い人物
// （明德馬皇后＝章帝の養母）が誰ともつながらない人になる。実際 2026-08-18 の
// 「誰とも線がつながっていない人物」の2件はどちらもこれが原因だった。
const FATHER = { "birth-father": "birth", "adoptive-father": "adoptive" };
const MOTHER = { "birth-mother": "birth", "adoptive-mother": "adoptive" };

const fathers = new Map(); // child -> [{id, kind}]
const mothers = new Map();
const crossEra = []; // 章をまたぐ親子（子が章外）
const dropped = []; // 図から外した人物
const pushTo = (m, k, v) => {
  const cur = m.get(k);
  if (cur) cur.push(v);
  else m.set(k, [v]);
};

for (const ed of kinship.edges) {
  if (ed.type !== "kinship") continue;
  const fk = FATHER[ed.relation];
  const mk = MOTHER[ed.relation];
  if (!fk && !mk) continue; // remote-ancestor（遠祖）は段が飛ぶので引かない
  const inFrom = ids.has(ed.from);
  const inTo = ids.has(ed.to);
  if (inFrom && inTo) {
    pushTo(fk ? fathers : mothers, ed.to, { id: ed.from, kind: fk ?? mk });
  } else if (inFrom && !inTo) {
    // 親が章内・子が章外（劉弘→昭烈帝、袁逢→袁術）。**図から消さずに行き先を出す**。
    crossEra.push({ from: ed.from, toLabel: labelOf(ed.to), toEra: eraOf(ed.to), toId: ed.to });
  }
}

const spouses = new Set();
for (const ed of kinship.edges) {
  if (ed.type !== "marriage") continue;
  if (!ids.has(ed.from) || !ids.has(ed.to)) continue;
  spouses.add([ed.from, ed.to].sort().join("|"));
}

// 実父と実母が揃う子は union（夫婦の結び目）から下ろす。**union に使うのは実親だけ**で、
// 2人目の実父・養親は「直接の線」として別に引く（線の見た目で区別する）。
const unions = new Map();
const extra = []; // {from, to, kind:"second-father"|"adoptive"|"single"}
for (const child of cards.keys()) {
  const fs = fathers.get(child) ?? [];
  const ms = mothers.get(child) ?? [];
  const bf = fs.find((x) => x.kind === "birth");
  const bm = ms.find((x) => x.kind === "birth");
  if (bf && bm) {
    const key = `${bf.id}|${bm.id}`;
    if (!unions.has(key)) {
      unions.set(key, { id: `u-${unions.size}`, father: bf.id, mother: bm.id, children: [] });
    }
    unions.get(key).children.push(child);
  } else if (bf) extra.push({ from: bf.id, to: child, kind: "single" });
  else if (bm) extra.push({ from: bm.id, to: child, kind: "single" });
  for (const x of [...fs, ...ms]) {
    if (x === bf || x === bm) continue;
    extra.push({ from: x.id, to: child, kind: x.kind === "adoptive" ? "adoptive" : "second" });
  }
}
// 夫婦だが子が（この章に）いない組も、横に並べたいので union を立てる
for (const key of spouses.keys()) {
  const [a, b] = key.split("|");
  const ca = cards.get(a);
  const cb = cards.get(b);
  if (!ca || !cb) continue;
  if (unions.has(`${a}|${b}`) || unions.has(`${b}|${a}`)) continue;
  const male = ca.gender === "female" ? b : a;
  const female = male === a ? b : a;
  unions.set(`${male}|${female}`, {
    id: `u-${unions.size}`,
    father: male,
    mother: female,
    children: [],
  });
}

// ---------------------------------------------------------------- 継承（家族関係以外）
//
// succession の辺は**親子で既に描かれているものを除いて**引く（`relationToPredecessor`
// が `son` の分は父子の線と同じ2人を結ぶので、重ねると線が二重になるだけ）。
// 残るのが禅譲・簒奪・傍系継承といった「家族の線では説明が付かない継ぎ方」。
const parentPairs = new Set();
for (const u of unions.values()) {
  for (const c of u.children) {
    parentPairs.add(`${u.father}>${c}`);
    parentPairs.add(`${u.mother}>${c}`);
  }
}
for (const x of extra) parentPairs.add(`${x.from}>${x.to}`);

// **擁立（enthroned）と世襲（hereditary）は引かない**（2026-08-18 ユーザー指示）。
// 数が多いうえに「誰が誰を担いだか」は家系の形とほぼ重なり、図では線が増えるだけだった。
// 残すのは禅譲・簒奪・内禅・復位・推戴・自立 — **家系では説明が付かない継ぎ方**。
const SUCCESSION_SKIP = new Set(["enthroned", "hereditary"]);

const succession = [];
for (const ed of kinship.edges) {
  if (ed.type !== "succession") continue;
  if (!ids.has(ed.from) || !ids.has(ed.to)) continue;
  if (parentPairs.has(`${ed.from}>${ed.to}`)) continue;
  if (SUCCESSION_SKIP.has(ed.categoryId)) continue;
  succession.push({
    from: ed.from,
    to: ed.to,
    categoryId: ed.categoryId ?? null,
    relation: ed.relationToPredecessor ?? null,
  });
}

// **この章の誰ともつながらない人物は図から外す**（2026-08-18 ユーザー指示）。
// 秦漢では袁逢（子＝袁術）と劉弘（子＝昭烈帝）の2人で、どちらも子が三国西晋章にいる。
// 章の切り方の副作用であって、この章の系譜を読むうえでは意味を持たない。
{
  const linked = new Set();
  for (const u of unions.values()) {
    linked.add(u.father);
    linked.add(u.mother);
    for (const c of u.children) linked.add(c);
  }
  for (const x of extra) {
    linked.add(x.from);
    linked.add(x.to);
  }
  for (const s of succession) {
    linked.add(s.from);
    linked.add(s.to);
  }
  for (const id of [...cards.keys()]) {
    if (!linked.has(id)) {
      dropped.push({ id, label: cards.get(id).label, reason: "章内に線が1本も無い" });
      cards.delete(id);
      ids.delete(id);
    }
  }
}

// ---------------------------------------------------------------- elk
const elkNodes = [];
for (const c of cards.values()) elkNodes.push({ id: c.id, width: CARD_W, height: heightOf(c) });
for (const u of unions.values()) elkNodes.push({ id: u.id, width: UNION_SIZE, height: UNION_SIZE });

const elkEdges = [];
let ei = 0;
for (const u of unions.values()) {
  elkEdges.push({ id: `e${ei++}`, sources: [u.father], targets: [u.id] });
  elkEdges.push({ id: `e${ei++}`, sources: [u.mother], targets: [u.id] });
  for (const ch of u.children) elkEdges.push({ id: `e${ei++}`, sources: [u.id], targets: [ch] });
}
for (const x of extra) elkEdges.push({ id: `e${ei++}`, sources: [x.from], targets: [x.to] });

const elk = new ELK();
const graph = await elk.layout({
  id: "root",
  layoutOptions: {
    "elk.algorithm": "layered",
    "elk.direction": "DOWN",
    "elk.layered.layering.strategy": "NETWORK_SIMPLEX",
    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
    // 夫婦（union の父と母）がどれだけ近く並ぶかはこの戦略で決まる。2026-08-18 に
    // 「竇氏と文帝の間が広がりすぎ」と指摘されて4通り測った（KINSHIP_NODE_PLACEMENT で
    // 差し替えられる）:
    //
    //   BRANDES_KOEPF   夫婦の隔たり 最大 1550px / 3枚ぶん以上 5組 / 幅 2717px
    //   NETWORK_SIMPLEX             688px /            2組 /     2056px
    //   LINEAR_SEGMENTS             430px /            1組 /     1886px  ← 採用
    //
    // 直線性を優先する BRANDES_KOEPF は、親子の柱をまっすぐ通すために夫婦を遠くへ
    // 押しやっていた。図の幅も 3 割縮む。
    "elk.layered.nodePlacement.strategy":
      process.env.KINSHIP_NODE_PLACEMENT ?? "LINEAR_SEGMENTS",
    "elk.spacing.nodeNode": "14",
    "elk.layered.spacing.nodeNodeBetweenLayers": "40",
    "elk.spacing.edgeNode": "12",
    "elk.edgeRouting": "ORTHOGONAL",
  },
  children: elkNodes,
  edges: elkEdges,
});

const pos = new Map(graph.children.map((n) => [n.id, { x: n.x, y: n.y }]));

// ---------------------------------------------------------------- 時代で縦を整える
//
// elk の段は世代であって時代ではない。**いちばん大きい連結成分の「段→年」を物差しにして、
// 小さい成分を年の合う段まで平行移動する。** 物差しに使うのは中央値（外れ値に強い）。
const adjacency = new Map();
const link = (a, b) => {
  const cur = adjacency.get(a);
  if (cur) cur.add(b);
  else adjacency.set(a, new Set([b]));
};
for (const u of unions.values()) {
  link(u.father, u.id);
  link(u.id, u.father);
  link(u.mother, u.id);
  link(u.id, u.mother);
  for (const c of u.children) {
    link(u.id, c);
    link(c, u.id);
  }
}
for (const x of extra) {
  link(x.from, x.to);
  link(x.to, x.from);
}

const allNodeIds = [...cards.keys(), ...[...unions.values()].map((u) => u.id)];
const seen = new Set();
const components = [];
for (const id of allNodeIds) {
  if (seen.has(id)) continue;
  const stack = [id];
  seen.add(id);
  const comp = [];
  while (stack.length) {
    const cur = stack.pop();
    comp.push(cur);
    for (const nx of adjacency.get(cur) ?? []) {
      if (seen.has(nx)) continue;
      seen.add(nx);
      stack.push(nx);
    }
  }
  components.push(comp);
}
components.sort((a, b) => b.length - a.length);

const median = (arr) => {
  const v = [...arr].sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
};

// 物差し: 巨大成分の段ごとの年（中央値）
const ruler = [];
{
  const rows = new Map();
  for (const id of components[0]) {
    const c = cards.get(id);
    if (!c) continue;
    const y = Math.round(pos.get(id).y);
    const v = yearOf(c);
    if (v == null) continue;
    const cur = rows.get(y);
    if (cur) cur.push(v);
    else rows.set(y, [v]);
  }
  for (const [y, vals] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
    ruler.push({ y, year: median(vals) });
  }
  // 年は前後の段で行き来する（別系統の枝）ので、単調になるようにならす。
  for (let i = 1; i < ruler.length; i += 1) {
    if (ruler[i].year < ruler[i - 1].year) ruler[i].year = ruler[i - 1].year;
  }
}

// 巨大成分が段ごとに占めている横の範囲（小さい成分を寄せる先）
const mainSpan = new Map();
for (const id of components[0]) {
  const c = cards.get(id);
  if (!c) continue;
  const p = pos.get(id);
  const y = Math.round(p.y);
  const cur = mainSpan.get(y);
  const lo = p.x;
  const hi = p.x + CARD_W;
  if (cur) {
    cur.lo = Math.min(cur.lo, lo);
    cur.hi = Math.max(cur.hi, hi);
  } else mainSpan.set(y, { lo, hi });
}

const shifted = [];
const placed = []; // 既に小さい成分を置いた矩形（重ねないため）
const GAP = 60;
for (const comp of components.slice(1)) {
  const years = comp.map((id) => cards.get(id)).filter(Boolean).map(yearOf).filter((v) => v != null);
  if (!years.length || !ruler.length) continue;
  const want = median(years);
  const box = {
    x0: Math.min(...comp.map((id) => pos.get(id).x)),
    x1: Math.max(...comp.map((id) => pos.get(id).x + (cards.has(id) ? CARD_W : UNION_SIZE))),
    y0: Math.min(...comp.map((id) => pos.get(id).y)),
    y1: Math.max(
      ...comp.map((id) =>
        pos.get(id).y + (cards.has(id) ? heightOf(cards.get(id)) : UNION_SIZE),
      ),
    ),
  };

  // 年がいちばん近い段。**物差しの最古より古い成分は、その上へ押し出す**
  // （秦の一族は前漢の柱の真上に来る。同じ段へ寄せると横に離れて置かれてしまう）。
  let targetY;
  let anchor;
  if (want < ruler[0].year) {
    targetY = ruler[0].y - (box.y1 - box.y0) - GAP;
    anchor = mainSpan.get(ruler[0].y);
  } else {
    let best = ruler[0];
    for (const r of ruler) if (Math.abs(r.year - want) < Math.abs(best.year - want)) best = r;
    targetY = best.y;
    anchor = mainSpan.get(best.y);
  }

  // 横は寄せ先の段の左端に合わせる。上へ押し出した成分は柱の真上に置けるが、
  // 同じ段に入る成分は巨大成分と重なるので左へ逃がす。
  const width = box.x1 - box.x0;
  let targetX = anchor ? anchor.lo : box.x0;
  if (want >= ruler[0].year && anchor) targetX = anchor.lo - width - GAP;

  // 既に置いた小さい成分と重なるならさらに左へ
  const overlaps = (x0, y0) =>
    placed.some(
      (r) =>
        x0 < r.x1 + GAP && x0 + width > r.x0 - GAP && y0 < r.y1 + GAP && y0 + (box.y1 - box.y0) > r.y0 - GAP,
    );
  while (overlaps(targetX, targetY)) targetX -= width + GAP;

  const dx = targetX - box.x0;
  const dy = targetY - box.y0;
  if (dx === 0 && dy === 0) continue;
  for (const id of comp) {
    pos.get(id).x += dx;
    pos.get(id).y += dy;
  }
  placed.push({
    x0: targetX,
    x1: targetX + width,
    y0: targetY,
    y1: targetY + (box.y1 - box.y0),
  });
  shifted.push({ size: comp.length, year: want, dx, dy });
}

// ---------------------------------------------------------------- 出力
const minY = Math.min(...[...pos.values()].map((p) => p.y));
if (minY < 0) for (const p of pos.values()) p.y -= minY;
const minX = Math.min(...[...pos.values()].map((p) => p.x));
if (minX < 0) for (const p of pos.values()) p.x -= minX;

const nodes = [];
for (const c of cards.values()) {
  const p = pos.get(c.id);
  nodes.push({
    ...c,
    x: Math.round(p.x),
    y: Math.round(p.y),
    w: CARD_W,
    h: heightOf(c),
    // 章の外に子がいる人物（この章では線が引けない）
    crossEra: crossEra
      .filter((x) => x.from === c.id)
      .map((x) => ({ label: x.toLabel, era: x.toEra })),
  });
}
const unionNodes = [...unions.values()].map((u) => {
  const p = pos.get(u.id);
  return {
    id: u.id,
    x: Math.round(p.x),
    y: Math.round(p.y),
    w: UNION_SIZE,
    h: UNION_SIZE,
    father: u.father,
    mother: u.mother,
    children: u.children,
  };
});

const width = Math.round(Math.max(...nodes.map((n) => n.x + n.w)));
const height = Math.round(Math.max(...nodes.map((n) => n.y + n.h)));
const layerYs = [...new Set(nodes.map((n) => n.y))].sort((a, b) => a - b);

const out = {
  eraId: ERA_ID,
  generatedFrom: {
    emperors: emp.length,
    persons: per.length,
    unions: unionNodes.length,
    extraParent: extra.length,
    succession: succession.length,
    crossEra: crossEra.length,
    shiftedComponents: shifted.length,
    dropped,
  },
  width,
  height,
  cardW: CARD_W,
  cardH: EMPEROR_H,
  kinH: KIN_H,
  layers: layerYs.length,
  nodes,
  unions: unionNodes,
  extraParent: extra,
  succession,
};

const destDir = path.join(process.cwd(), "src", "lib", "kinship");
mkdirSync(destDir, { recursive: true });
writeFileSync(path.join(destDir, "layout.qin-han.json"), JSON.stringify(out), "utf8");

// 夫婦がどれだけ離れて置かれているか（指摘の出どころを数で見る）
{
  const gaps = unionNodes
    .map((u) => {
      const f = nodes.find((n) => n.id === u.father);
      const m = nodes.find((n) => n.id === u.mother);
      if (!f || !m) return null;
      return Math.abs(f.x - m.x);
    })
    .filter((v) => v != null)
    .sort((a, b) => a - b);
  const far = gaps.filter((g) => g > CARD_W * 3).length;
  console.log(
    `  夫婦の横の隔たり: 中央値 ${gaps[Math.floor(gaps.length / 2)]}px / 最大 ${gaps[gaps.length - 1]}px / カード3枚ぶん以上 ${far}/${gaps.length}`,
  );
}

console.log(
  `kinship layout: ${nodes.length}人（除外 ${dropped.length}: ${dropped.map((d) => d.label).join("・")}） / union ${unionNodes.length} / 追加の親子 ${extra.length} / 継承 ${succession.length} / 時代で動かした成分 ${shifted.length} / 段 ${layerYs.length} / ${width}×${height}px`,
);
