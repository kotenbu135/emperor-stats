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
      unions.set(key, {
        id: `u-${unions.size}`,
        father: bf.id,
        mother: bm.id,
        children: [],
        kind: "parents",
      });
    }
    unions.get(key).children.push(child);
    // 片親しか分かっていない子。**結び目は立てず直接つなぐ**が、線は実父・実母の
    // 書き分けをそのまま使う（凡例が「実父＝実線／実母＝破線」と名乗っているので、
    // ここだけ母を実線で描くと凡例が嘘になる）。
  } else if (bf) extra.push({ from: bf.id, to: child, kind: "father" });
  else if (bm) extra.push({ from: bm.id, to: child, kind: "mother" });
  for (const x of [...fs, ...ms]) {
    if (x === bf || x === bm) continue;
    if (x.kind === "adoptive") {
      extra.push({ from: x.id, to: child, kind: "adoptive" });
      continue;
    }
    // **2人目の実父・実母（史料の異説）は子へ直線を引かない**（2026-08-18 ユーザー指示
    // 「呂不韋は趙姫と結婚していた線にする。ただし始皇帝は荘襄王の子である」）。
    // 直線を引くと「父が2人いる」図になり、線が図を横切る。代わりに**もう一方の実親と
    // 組ませて結び目を立てる** — 系図でよくある「母にもう1人の相手が並ぶ」形になり、
    // 子の系統は確定している側（荘襄王×趙姫）からだけ下りる。
    // **これは婚姻の主張ではない。** kinship.json に呂不韋と趙姫の marriage エッジは無く、
    // 趙姫の note は「荘襄王の正妻であったことは原典で確認できないため婚姻エッジは張らない」
    // と明記している。だから結び目は点線で描き、凡例も「実父の異説」と名乗る。
    const isFather = fs.includes(x);
    const mate = isFather ? bm : bf;
    if (mate && cards.has(mate.id) && cards.has(x.id)) {
      const father = isFather ? x.id : mate.id;
      const mother = isFather ? mate.id : x.id;
      const key = `${father}|${mother}`;
      if (!unions.has(key)) {
        unions.set(key, {
          id: `u-${unions.size}`,
          father,
          mother,
          children: [],
          kind: "disputed",
        });
      }
    } else {
      extra.push({ from: x.id, to: child, kind: "second" });
    }
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
    kind: "marriage",
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

// **段を2回に分けて解く。**
//
// elk の段は世代であって時代ではない。しかも世代の深さは記録に残った親族の数で決まるので、
// 6世代の後漢の祖先鎖（劉発→劉買→劉外→劉回→劉欽→光武帝）は8世代の前漢本流より**13段も
// 上**に来ていた（光武帝 25 が王莽 9・哀帝 前7 より上・2026-08-18「前漢末、新、後漢初の
// 人物の配置を時代感を考慮した配置に」）。
//
// 1回目は**年の背骨**（見えない鎖 T0→T1→… を BUCKET 年ごとに立て、年 y の人物へ
// T_k → 人物 の辺を張る）を足して解き、**段の番号だけ**を取る。背骨は層の制約としては
// 効くが、そのまま描くと横の置き方まで背骨に引っ張られて図が崩れる（実測で横棒の総延長
// +78%・高さ +57%・夫婦の隔たり最大 262→548px）。
//
// そこで2回目は背骨を捨て、代わりに**辺の途中へ見えないスペーサを挟んで段差だけを再現する**。
// スペーサは辺の上に乗るので、elk はそれを1本の線分として素直に縦へ通す — 横の置き方は
// 1回目の背骨に引っ張られない。
const BUCKET = Number(process.env.KINSHIP_BUCKET ?? 20);
const LAYOUT_OPTIONS = {
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
    // カード同士の横の間隔。14px だと「ノードと線が密集して関係が分かりにくい」と
    // 外部レビューで言われた（2026-08-18）。20px で図の幅は 1193→1225px しか増えない。
    "elk.spacing.nodeNode": process.env.KINSHIP_NODE_GAP ?? "20",
    "elk.layered.spacing.nodeNodeBetweenLayers": process.env.KINSHIP_LAYER_GAP ?? "32",
    "elk.spacing.edgeNode": process.env.KINSHIP_EDGE_NODE ?? "12",
    // 段と段のあいだで線がカードに寄る距離（既定10px だと夫婦の横棒がカードの真下を
    // かすめる）。2026-08-18「線とカードが近すぎる」への対応。
    "elk.layered.spacing.edgeNodeBetweenLayers": process.env.KINSHIP_EDGE_NODE_LAYER ?? "14",
    "elk.edgeRouting": "ORTHOGONAL",
    // 同じ親から出る線を1本のバスにまとめる（櫛の形になる）
    // mergeEdges は測って外した（線の交差 1→8・夫婦の隔たり最大 324→482px）。
    // 兄弟のバスは下で自前に揃えるので、elk に束ねさせる必要がない。
    "elk.layered.mergeEdges": process.env.KINSHIP_MERGE ?? "false",
};

const elk = new ELK();
const solve = (children, edges) =>
  elk.layout({ id: "root", layoutOptions: LAYOUT_OPTIONS, children, edges });

// --- 1回目: 年の背骨つき。段の番号だけを取る
const layerOf = new Map();
{
  const spine = new Set();
  const nodesA = [...elkNodes];
  const edgesA = [...elkEdges];
  const years = [...cards.values()].map(yearOf).filter((v) => v != null);
  const lo = Math.min(...years);
  const hi = Math.max(...years);
  for (let k = 0; k <= Math.floor((hi - lo) / BUCKET); k += 1) {
    const id = `t-${k}`;
    spine.add(id);
    nodesA.push({ id, width: 0, height: 0 });
    if (k > 0) edgesA.push({ id: `a${ei++}`, sources: [`t-${k - 1}`], targets: [id] });
  }
  // **家族の単位で同じ枡に入れる。** 人ごとの年でそのまま縛ると、高帝（前202）と
  // 呂雉（前179）のように年が離れた夫婦が別の段へ割れ、父から結び目へ下ろす線が
  // 母のカードを突き抜ける（実測で交差19件のうち12件がこれだった）。兄弟も同じで、
  // 同じ親の子は1段に並べたい。**下限だけを揃える**ので、時代の前後は保たれる。
  const bucket = new Map();
  for (const c of cards.values()) {
    const y = yearOf(c);
    if (y != null) bucket.set(c.id, Math.floor((y - lo) / BUCKET));
  }
  const pull = (group) => {
    const vals = group.map((id) => bucket.get(id)).filter((v) => v != null);
    if (vals.length < 2) return;
    const b = Math.min(...vals);
    for (const id of group) if (bucket.has(id)) bucket.set(id, b);
  };
  for (const u of unions.values()) {
    pull([u.father, u.mother]);
    pull(u.children);
  }
  for (const [id, k] of bucket) {
    edgesA.push({ id: `a${ei++}`, sources: [`t-${k}`], targets: [id] });
  }
  const gA = await solve(nodesA, edgesA);
  const real = gA.children.filter((n) => !spine.has(n.id));
  const rank = new Map(
    [...new Set(real.map((n) => n.y))].sort((a, b) => a - b).map((y, i) => [y, i]),
  );
  for (const n of real) layerOf.set(n.id, rank.get(n.y));
}

// **段の番号を家族の単位で揃える。** 年で縛ると夫婦・兄弟が別の段へ割れ、父から結び目へ
// 下ろす線が母のカードを、親から子へ下ろす線が別の子のカードを突き抜ける（実測15本のうち
// 12本がこれ）。**下げる方向にだけ動かす**ので必ず収束する。
{
  const kids = new Map(); // 親 -> 子[]（結び目をまたいだ兄弟も同じ段に並べる）
  const addKid = (p, c) => {
    const cur = kids.get(p);
    if (cur) cur.push(c);
    else kids.set(p, [c]);
  };
  for (const u of unions.values())
    for (const c of u.children) {
      addKid(u.father, c);
      addKid(u.mother, c);
    }
  for (const x of extra) addKid(x.from, x.to);

  for (let it = 0; it < 12; it += 1) {
    let changed = false;
    const bump = (id, v) => {
      if (v > layerOf.get(id)) {
        layerOf.set(id, v);
        changed = true;
      }
    };
    for (const u of unions.values()) {
      const m = Math.max(layerOf.get(u.father), layerOf.get(u.mother));
      bump(u.father, m);
      bump(u.mother, m);
    }
    for (const cs of kids.values()) {
      const m = Math.max(...cs.map((c) => layerOf.get(c)));
      for (const c of cs) bump(c, m);
    }
    for (const e of elkEdges) bump(e.targets[0], layerOf.get(e.sources[0]) + 1);
    if (!changed) break;
  }
  // 空いた段は詰める（スペーサは段差の下限しか決めないので、詰めても順序は変わらない）
  const packed = new Map(
    [...new Set(layerOf.values())].sort((a, b) => a - b).map((v, i) => [v, i]),
  );
  for (const [id, v] of layerOf) layerOf.set(id, packed.get(v));
}

// --- 2回目: 背骨は捨て、段差をスペーサで固定して解く
//
// **線の形も elk に引かせる。** 自前でバスを選んでいた版は、カードとの交差・線どうしの
// 交差しか数えていなかったので「カードに寄りすぎ」「短い折れ」「行って戻る余分な棒」
// （2026-08-18 の指摘6件）が全部素通りした。elk の直交ルータはノードを避け、同じ親から
// 出る線を1本のバスにまとめ（`mergeEdges`）、交差も減らす。返ってくる `sections` を
// そのまま折れ線として使う。
//
// 段をいくつも跨ぐ線はスペーサで刻んであるので、鎖の区間をつなぎ直して1本にする。
const nodesB = [...elkNodes];
const edgesB = [];
const spacers = new Set();
const chainOf = new Map(); // `${from}>${to}` -> [elk の辺 id...]（つなぎ直す順）
let si = 0;
const addChain = (from, to, extra) => {
  const gap = layerOf.get(to) - layerOf.get(from);
  const chain = [];
  let prev = from;
  for (let k = 1; k < gap; k += 1) {
    const id = `s-${si++}`;
    spacers.add(id);
    nodesB.push({ id, width: 0, height: 0 });
    const eid = `b${ei++}`;
    edgesB.push({ id: eid, sources: [prev], targets: [id], ...extra });
    chain.push(eid);
    prev = id;
  }
  const eid = `b${ei++}`;
  edgesB.push({ id: eid, sources: [prev], targets: [to], ...extra });
  chain.push(eid);
  chainOf.set(`${from}>${to}`, chain);
};
for (const e of elkEdges) addChain(e.sources[0], e.targets[0]);
// **継承も elk に引かせる。** 段の差はスペーサで固定してあるので、辺を足しても段は動かない
// （逆向き＝行き先が上にある継承だけは足さず、後で自前で引く）。
const succRouted = new Set();
for (const s of succession) {
  if (!(layerOf.get(s.to) > layerOf.get(s.from))) continue;
  addChain(s.from, s.to);
  succRouted.add(`${s.from}>${s.to}`);
}
const graph = await solve(nodesB, edgesB);

const pos = new Map(graph.children.map((n) => [n.id, { x: n.x, y: n.y }]));

// elk の区間を折れ線に戻す
const sectionsById = new Map(graph.edges.map((e) => [e.id, e.sections?.[0]]));
const routeOf = new Map();
for (const [key, chain] of chainOf) {
  const pts = [];
  for (const eid of chain) {
    const s = sectionsById.get(eid);
    if (!s) continue;
    for (const p of [s.startPoint, ...(s.bendPoints ?? []), s.endPoint]) {
      const q = pts[pts.length - 1];
      if (!q || Math.abs(q[0] - p.x) > 0.5 || Math.abs(q[1] - p.y) > 0.5) pts.push([p.x, p.y]);
    }
  }
  if (pts.length >= 2) routeOf.set(key, pts);
}
console.log(`  段のスペーサ: ${si}個 / elk が引いた線: ${routeOf.size}本`);

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

  // 既に置いた小さい成分・**巨大成分から伸びている線**と重なるならさらに左へ。
  // 線を見ないと、成分を寄せた先に他人の線が走っていて図の上で交差する
  // （2026-08-18「線とカードの重なり」— 王莽から出た線が公孫述のカードを通っていた）。
  const inComp = new Set(comp);
  const others = [];
  for (const [key, pts] of routeOf) {
    if (inComp.has(key.split(">")[0])) continue;
    for (let i = 1; i < pts.length; i += 1) {
      others.push({
        x0: Math.min(pts[i - 1][0], pts[i][0]),
        x1: Math.max(pts[i - 1][0], pts[i][0]),
        y0: Math.min(pts[i - 1][1], pts[i][1]),
        y1: Math.max(pts[i - 1][1], pts[i][1]),
      });
    }
  }
  const h = box.y1 - box.y0;
  const hits = (x0, y0, list, pad) =>
    list.some((r) => x0 < r.x1 + pad && x0 + width > r.x0 - pad && y0 < r.y1 + pad && y0 + h > r.y0 - pad);
  while (hits(targetX, targetY, placed, GAP) || hits(targetX, targetY, others, 12))
    targetX -= width + GAP;

  const dx = targetX - box.x0;
  const dy = targetY - box.y0;
  if (dx === 0 && dy === 0) continue;
  for (const id of comp) {
    pos.get(id).x += dx;
    pos.get(id).y += dy;
  }
  // 線も一緒に動かす（置いていくと、線だけ元の位置へ向かって走る）。
  for (const [key, pts] of routeOf) {
    if (!inComp.has(key.split(">")[0])) continue;
    for (const q of pts) {
      q[0] += dx;
      q[1] += dy;
    }
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
// **原点へ必ず寄せる。** 負のときだけ寄せていたので、elk が左に 633px の余白を空けた
// ぶんが図の幅にそのまま残り、画面の3分の1が地のままになっていた（2026-08-18）。
// **線も一緒に動かす** — ノードだけ動かすと端が宙に浮く。
const minY = Math.min(...[...pos.values()].map((p) => p.y));
const minX = Math.min(...[...pos.values()].map((p) => p.x));
for (const p of pos.values()) {
  p.x -= minX;
  p.y -= minY;
}
for (const pts of routeOf.values())
  for (const q of pts) {
    q[0] -= minX;
    q[1] -= minY;
  }

const nodes = [];
for (const c of cards.values()) {
  const p = pos.get(c.id);
  nodes.push({
    ...c,
    x: Math.round(p.x),
    y: Math.round(p.y),
    w: CARD_W,
    h: heightOf(c),
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
    kind: u.kind,
  };
});

// ---------------------------------------------------------------- 線
//
// **形は elk が引いた折れ線をそのまま使う。** 自前でバスの高さを選んでいた版は、
// カードとの交差と線どうしの交差しか数えていなかったので、2026-08-18 に指摘された
// 「線の飛び出し」「線とカードの重なり」「線とカードが近すぎる」「不要な曲がり」
// 「線の重なり」がどれも素通りした。**見えている欠陥はすべて数える**（下の audit）。
const boxes = new Map();
for (const n of nodes) boxes.set(n.id, n);
for (const n of unionNodes) boxes.set(n.id, n);

/** 重複点・一直線上の中継点・行って戻る折り返しを落とす。 */
const cleanPolyline = (input) => {
  // **先に丸める。** 丸める前に重複を落とすと、0.6px 離れた2点が生き残って
  // 丸めたあとに長さ0の区間になる（それが「不要な折れ 0px」として出ていた）。
  let pts = [];
  for (const raw of input) {
    const p = [Math.round(raw[0]), Math.round(raw[1])];
    const q = pts[pts.length - 1];
    if (!q || q[0] !== p[0] || q[1] !== p[1]) pts.push(p);
  }
  for (let again = true; again; ) {
    again = false;
    for (let i = 1; i + 1 < pts.length; i += 1) {
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      const [cx, cy] = pts[i + 1];
      const collinear =
        (Math.abs(ax - bx) < 0.5 && Math.abs(bx - cx) < 0.5) ||
        (Math.abs(ay - by) < 0.5 && Math.abs(by - cy) < 0.5);
      if (collinear) {
        pts.splice(i, 1);
        again = true;
        break;
      }
    }
  }
  return pts;
};

/** 行き先が上にある継承だけ elk に渡していない。段の隙間を選んで自前で引く。 */
const sideRoute = (from, to) => {
  const a = boxes.get(from);
  const b = boxes.get(to);
  const rightward = b.x + b.w / 2 > a.x + a.w / 2;
  const sx = rightward ? a.x + a.w : a.x;
  const sy = a.y + a.h / 2;
  const tx = rightward ? b.x : b.x + b.w;
  const ty = b.y + b.h / 2;
  const bus = Math.round((sx + tx) / 2);
  return cleanPolyline([
    [sx, sy],
    [bus, sy],
    [bus, ty],
    [tx, ty],
  ]);
};

/**
 * **1〜6px の「折れ」を吸収する。** elk は稀に数 px だけ横へずらして下ろす経路を返し、
 * それが図では「不要な曲がり」に見える（2026-08-18 の指摘）。短い区間の左右どちらか
 * 短い側を、もう一方の座標へ寄せて消す。端点はカードの縁の内側に収まる範囲で動かす。
 */
const absorbJogs = (input, fromId, toId) => {
  const JOG_SNAP = 10;
  let pts = input.map(([x, y]) => [x, y]);
  const inside = (i, x, y) => {
    const b = boxes.get(i);
    return x >= b.x + 2 && x <= b.x + b.w - 2 && y >= b.y - 1 && y <= b.y + b.h + 1;
  };
  for (let guard = 0; guard < 20; guard += 1) {
    let hit = -1;
    for (let i = 1; i + 2 < pts.length; i += 1) {
      const len = Math.abs(pts[i + 1][0] - pts[i][0]) + Math.abs(pts[i + 1][1] - pts[i][1]);
      if (len > 0 && len < JOG_SNAP) {
        hit = i;
        break;
      }
    }
    if (hit < 0) break;
    const axis = Math.abs(pts[hit + 1][0] - pts[hit][0]) > 0 ? 0 : 1;
    const head = hit + 1; // 前側の点数
    const tail = pts.length - (hit + 1);
    const moveHead = head <= tail;
    const target = moveHead ? pts[hit + 1][axis] : pts[hit][axis];
    const next = pts.map(([x, y]) => [x, y]);
    if (moveHead) for (let i = 0; i <= hit; i += 1) next[i][axis] = target;
    else for (let i = hit + 1; i < next.length; i += 1) next[i][axis] = target;
    if (
      !inside(fromId, next[0][0], next[0][1]) ||
      !inside(toId, next[next.length - 1][0], next[next.length - 1][1])
    )
      break;
    pts = cleanPolyline(next);
  }
  return pts;
};

const lines = [];
let li = 0;
const push = (kind, from, to, extra) => {
  const pts = routeOf.get(`${from}>${to}`);
  if (!pts) return;
  lines.push({ id: `l${li++}`, kind, from, to, points: absorbJogs(cleanPolyline(pts), from, to), ...extra });
};
for (const u of unionNodes) {
  const pk = u.kind === "disputed" ? "disputed" : null;
  push(pk ?? "father", u.father, u.id);
  push(pk ?? "mother", u.mother, u.id);
  for (const c of u.children) push("child", u.id, c);
}
for (const x of extra) push(x.kind, x.from, x.to);
for (const s of succession) {
  const key = `${s.from}>${s.to}`;
  const pts = succRouted.has(key) ? routeOf.get(key) : sideRoute(s.from, s.to);
  if (!pts) continue;
  lines.push({
    id: `l${li++}`,
    kind: "succession",
    from: s.from,
    to: s.to,
    categoryId: s.categoryId,
    points: absorbJogs(cleanPolyline(pts), s.from, s.to),
  });
}

// ---------------------------------------------------------------- 見た目の検査
//
// **指摘された欠陥はすべてここで数える。** 目で見て見つかるものを機械で見つけられない
// 状態で「直った」と報告して3度差し戻された（2026-08-18）。
const CLEAR = Number(process.env.KINSHIP_CLEAR ?? 12); // カード・結び目から最低これだけ離す
const JOG = 8; // これより短い折れは「不要な曲がり」

const segsOf = (e) => {
  const out = [];
  for (let i = 1; i < e.points.length; i += 1) {
    const [x0, y0] = e.points[i - 1];
    const [x1, y1] = e.points[i];
    out.push([Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)]);
  }
  return out;
};
/** 区間と矩形の距離（0 = 触れている・負にはしない）。 */
const gap = (s, b) => {
  const dx = Math.max(b.x - s[2], s[0] - (b.x + b.w), 0);
  const dy = Math.max(b.y - s[3], s[1] - (b.y + b.h), 0);
  return Math.max(dx, dy);
};
const overlapLen = (p, q) => {
  const hp = p[1] === p[3];
  if (hp !== (q[1] === q[3])) return 0;
  if (hp) {
    if (Math.abs(p[1] - q[1]) > 0.5) return 0;
    return Math.max(0, Math.min(p[2], q[2]) - Math.max(p[0], q[0]));
  }
  if (Math.abs(p[0] - q[0]) > 0.5) return 0;
  return Math.max(0, Math.min(p[3], q[3]) - Math.max(p[1], q[1]));
};
const crossAt = (p, q) => {
  const ph = p[1] === p[3];
  if (ph === (q[1] === q[3])) return false;
  const h = ph ? p : q;
  const v = ph ? q : p;
  return v[0] > h[0] && v[0] < h[2] && h[1] > v[1] && h[1] < v[3];
};

/** 線1本の「悪さ」。バスを揃えるときの選択にも、最後の集計にも同じ数え方を使う。 */
const costOf = (e) => {
  let c = 0;
  const segs = segsOf(e);
  for (const b of boxes.values()) {
    if (b.id === e.from || b.id === e.to) continue;
    let worst = Infinity;
    for (const seg of segs) worst = Math.min(worst, gap(seg, b));
    if (worst <= 0) c += 10;
    else if (worst < CLEAR) c += 3;
  }
  for (const o of lines) {
    if (o === e || o.from === e.from || o.to === e.to) continue;
    for (const seg of segs)
      for (const t of segsOf(o)) {
        if (crossAt(seg, t)) c += 2;
        if (overlapLen(seg, t) > 2) c += 1;
      }
  }
  return c;
};

// ---------------------------------------------------------------- 兄弟のバスを揃える
//
// elk は線を1本ずつ引くので、同じ親から出る4本が少しずつ違う高さの横棒になることがある
// （2026-08-18「線がぐちゃぐちゃ」の正体）。**elk が選んだ廊下はそのままに、親から出て
// 最初の横棒の高さだけを束で揃える。** 揃えた結果カードや他の線とぶつかるなら採らない
// （下の検査と同じ数え方で点数を付けて選ぶ）。

/** 親から出て最初の横棒の高さ（縦→横 の並びのときだけ）。 */
function firstBusY(e) {
  const p = e.points;
  if (p.length < 3) return null;
  if (p[0][0] !== p[1][0]) return null; // 最初が縦でない
  if (p[1][1] !== p[2][1]) return null; // 次が横でない
  return p[1][1];
}
const setFirstBusY = (e, y) => {
  const p = e.points.map(([x, yy]) => [x, yy]);
  p[1][1] = y;
  p[2][1] = y;
  return p;
};

{
  const byParent = new Map();
  for (const e of lines) {
    if (e.kind === "succession") continue;
    const cur = byParent.get(e.from);
    if (cur) cur.push(e);
    else byParent.set(e.from, [e]);
  }
  for (let pass = 0; pass < 2; pass += 1) {
    for (const es of byParent.values()) {
      const movable = es.filter((e) => firstBusY(e) != null);
      if (movable.length < 2) continue;
      const cands = [...new Set(movable.map(firstBusY))];
      if (cands.length < 2) continue;
      const before = movable.map((e) => e.points);
      let best = null;
      let bestScore = Infinity;
      for (const y of cands) {
        movable.forEach((e, i) => {
          e.points = setFirstBusY({ points: before[i] }, y);
        });
        const sc = movable.reduce((a, e) => a + costOf(e), 0);
        if (sc < bestScore) {
          bestScore = sc;
          best = y;
        }
      }
      movable.forEach((e, i) => {
        // 揃えた結果、長さ0の区間ができることがあるので必ず掃除する
        e.points = cleanPolyline(setFirstBusY({ points: before[i] }, best));
      });
    }
  }
}

const faults = {
  カードの中を通る: [],
  カードに近すぎる: [],
  線どうしの交差: [],
  線どうしの重なり: [],
  端が浮いている: [],
  不要な折れ: [],
};
for (const e of lines) {
  const segs = segsOf(e);
  for (const b of boxes.values()) {
    if (b.id === e.from || b.id === e.to) continue;
    let worst = Infinity;
    for (const s of segs) worst = Math.min(worst, gap(s, b));
    if (worst <= 0) faults.カードの中を通る.push(`${e.from}→${e.to} / ${b.label ?? b.id}`);
    else if (worst < CLEAR) faults.カードに近すぎる.push(`${e.from}→${e.to} / ${b.label ?? b.id} ${worst}px`);
  }
  // 端はカードの縁に付いているか
  for (const [pt, id] of [[e.points[0], e.from], [e.points[e.points.length - 1], e.to]]) {
    const b = boxes.get(id);
    const d = gap([pt[0], pt[1], pt[0], pt[1]], b);
    if (d > 1) faults.端が浮いている.push(`${e.from}→${e.to} ${JSON.stringify(pt)} が ${b.label ?? id} から ${d}px`);
  }
  // 短い折れ（前後が直交している短い区間）
  for (let i = 0; i < segs.length; i += 1) {
    const len = Math.max(segs[i][2] - segs[i][0], segs[i][3] - segs[i][1]);
    if (i > 0 && i + 1 < segs.length && len < JOG) {
      faults.不要な折れ.push(`${e.from}→${e.to} ${len}px`);
    }
  }
}
for (let i = 0; i < lines.length; i += 1) {
  const a = segsOf(lines[i]);
  for (let j = i + 1; j < lines.length; j += 1) {
    const b = segsOf(lines[j]);
    // 同じ親から出た兄弟はバスを共有するので、重なりは意図どおり
    // 同じ親から出た兄弟・同じ結び目へ入る夫婦は棒を共有するので、重なりは意図どおり
    const sameBus = lines[i].from === lines[j].from || lines[i].to === lines[j].to;
    for (const p of a)
      for (const q of b) {
        if (crossAt(p, q)) faults.線どうしの交差.push(`${lines[i].from}→${lines[i].to} × ${lines[j].from}→${lines[j].to}`);
        if (!sameBus && overlapLen(p, q) > 2)
          faults.線どうしの重なり.push(
            `${lines[i].from}→${lines[i].to} と ${lines[j].from}→${lines[j].to} が ${Math.round(overlapLen(p, q))}px`,
          );
      }
  }
}

const edgeOut = lines.map((e) => ({
  id: e.id,
  kind: e.kind,
  from: e.from,
  to: e.to,
  categoryId: e.categoryId ?? null,
  points: e.points,
}));

// **兄弟の線が1本の横棒にまとまっているか。** 「線がぐちゃぐちゃ」の正体は、同じ親から
// 出る線が少しずつ違う高さの横棒になって帯に何本も並ぶことだった。親ごとに横棒の高さが
// いくつあるかを数える（1なら櫛・2以上だと段違いの棒が並ぶ）。
{
  const byParent = new Map();
  for (const e of lines) {
    if (e.kind === "succession") continue;
    const cur = byParent.get(e.from);
    if (cur) cur.push(e);
    else byParent.set(e.from, [e]);
  }
  let split = 0;
  let groups = 0;
  const worst = [];
  for (const [from, es] of byParent) {
    if (es.length < 2) continue;
    groups += 1;
    const ys = new Set(es.map(firstBusY).filter((v) => v != null));
    if (ys.size > 1) {
      split += 1;
      worst.push(`${boxes.get(from)?.label ?? from}:${ys.size}本`);
    }
  }
  console.log(
    `  兄弟の横棒が1本にまとまっていない親: ${split}/${groups}` +
      (worst.length ? ` — ${worst.slice(0, 6).join(" / ")}` : ""),
  );
}

{
  const total = Object.values(faults).reduce((a, v) => a + v.length, 0);
  console.log(`  線の欠陥: ${total}件` + (total ? "" : "（ゼロ）"));
  for (const [k, v] of Object.entries(faults)) {
    if (!v.length) continue;
    console.log(`    ${k}: ${v.length}件 — ${v.slice(0, 4).join(" / ")}`);
  }
}

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
  // **描画はこの1本だけを見る。** union / extraParent / succession の3つの器を
  // 部品側でほどき直すと、バスの高さ（＝線の形）が図の外で決まってしまう。
  edges: edgeOut,
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
