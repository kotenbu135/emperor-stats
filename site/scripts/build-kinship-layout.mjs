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
// 名前の補足を2行目に落とすぶんだけ親族の箱を高くする。**幅は広げない** — 長い名前は
// 105 人中 5 人（全部「竇氏〔孝文竇皇后〕」型）で、幅で解くと図の総幅が全員ぶん太る
// （2026-08-18 の外部レビュー「テキストの省略」）。
const KIN_ANNOT_H = 50;
// 夫婦の点。**線より明らかに太い**こと（2026-08-18 の外部レビュー2巡目「線と同化して
// 見落とす」）。線が 1.9px なので 14px＝7倍強。
const UNION_SIZE = 14;
const heightOf = (c) => (c.isEmperor ? EMPEROR_H : c.annot ? KIN_ANNOT_H : KIN_H);

/**
 * 表示名を「主部」と「補足」に割る。`竇氏〔孝文竇皇后〕` → `竇氏` ＋ `孝文竇皇后`。
 * 括弧は史料側の表記ゆれで〔〕と（）の2種類あるので両方見る。
 */
function splitLabel(label) {
  const m = /^(.+?)[（〔(]([^）〕)]+)[）〕)]$/.exec(label);
  if (!m) return { main: label, annot: null };
  return { main: m[1], annot: m[2] };
}

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
    ...splitLabel(e.name?.commonName ?? e.id),
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
    ...splitLabel(p.name ?? p.id),
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

// ---------------------------------------------------------------- 家族ブロック
//
// **一般的な家系図の形にする**（2026-08-19 ユーザー指示「この線のつなぎ方がキモい、
// 一般的な家系図みたいなつなぎ方にして」）。夫婦は必ず隣に並べて中央の高さの横棒で結び、
// 子はその横棒の中点から下ろす。elk に夫婦を別々のノードで渡すと隣に置く保証が無い
// （旧実装の実測で最大 267px 離れ、結び目が1段下にぶら下がる Y 字になっていた）ので、
// **夫婦の鎖ごと1つのブロックに固めて elk へ渡し、ブロックの中の並びは自前で決める**。
// 複数婚は鎖（呂雉—高帝—薄姫）になる。この章で1人が持つ相手は最大2人 — 3人以上は
// 鎖にならないので、データが増えたとき黙って崩れないよう throw する。
const SPOUSE_GAP = 24;

const spouseLinks = new Map(); // person -> 相手[]（union で隣り合う）
for (const u of unions.values()) {
  pushTo(spouseLinks, u.father, u.mother);
  pushTo(spouseLinks, u.mother, u.father);
}
for (const [pid, mates] of spouseLinks)
  if (new Set(mates).size > 2)
    throw new Error(`家族ブロックが鎖にならない（相手が3人以上）: ${pid}`);

const blocks = [];
const blockOf = new Map(); // personId -> block
{
  const seenP = new Set();
  const mkBlock = (memberIds) => {
    const h = Math.max(...memberIds.map((id) => heightOf(cards.get(id))));
    const members = [];
    let x = 0;
    for (const id of memberIds) {
      const mh = heightOf(cards.get(id));
      // 縦はブロックの中央に揃える。全員の中央が同じ高さになるので、夫婦の横棒が
      // どの組み合わせ（皇帝×親族・親族×親族）でも水平の1本線で引ける。
      members.push({ id, x, y: (h - mh) / 2, w: CARD_W, h: mh });
      x += CARD_W + SPOUSE_GAP;
    }
    const b = { id: `blk-${blocks.length}`, members, w: x - SPOUSE_GAP, h, unions: [] };
    blocks.push(b);
    for (const id of memberIds) blockOf.set(id, b);
    return b;
  };
  for (const id of cards.keys()) {
    if (seenP.has(id)) continue;
    const mates = [...new Set(spouseLinks.get(id) ?? [])].filter((m) => cards.has(m));
    if (!mates.length) {
      seenP.add(id);
      mkBlock([id]);
      continue;
    }
    const comp = new Set([id]);
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      for (const nx of spouseLinks.get(cur) ?? []) {
        if (!cards.has(nx) || comp.has(nx)) continue;
        comp.add(nx);
        stack.push(nx);
      }
    }
    const ends = [...comp].filter((p) => new Set(spouseLinks.get(p) ?? []).size < 2);
    if (comp.size > 1 && ends.length !== 2)
      throw new Error(`夫婦の鎖が輪になっている: ${[...comp].join("・")}`);
    // 並びの向き: 2人なら父を左に。3人の鎖なら年の古い端を左に（決め打ちの規則が
    // 要るだけで、どちら向きでも図としては読める）。
    let head = ends[0];
    if (comp.size === 2) {
      const u = [...unions.values()].find((x) => comp.has(x.father) && comp.has(x.mother));
      head = u ? u.father : ends[0];
    } else {
      const y0 = yearOf(cards.get(ends[0])) ?? 9999;
      const y1 = yearOf(cards.get(ends[1])) ?? 9999;
      head = y0 <= y1 ? ends[0] : ends[1];
    }
    const ordered = [head];
    while (ordered.length < comp.size) {
      const cur = ordered[ordered.length - 1];
      const nx = [...new Set(spouseLinks.get(cur) ?? [])].find(
        (p) => comp.has(p) && !ordered.includes(p),
      );
      ordered.push(nx);
    }
    for (const p of ordered) seenP.add(p);
    mkBlock(ordered);
  }
}

// union の下ろし点（ブロック内の相対座標）。夫婦は構成上必ず隣にいる。
const unionGeo = new Map(); // unionId -> {block, dropX, midY}
for (const u of unions.values()) {
  const b = blockOf.get(u.father);
  const fi = b.members.findIndex((m) => m.id === u.father);
  const mi = b.members.findIndex((m) => m.id === u.mother);
  if (b !== blockOf.get(u.mother) || Math.abs(fi - mi) !== 1)
    throw new Error(`夫婦が隣に並んでいない: ${u.father}×${u.mother}`);
  const left = b.members[Math.min(fi, mi)];
  unionGeo.set(u.id, { block: b, dropX: left.x + left.w + SPOUSE_GAP / 2, midY: b.h / 2 });
  b.unions.push(u.id);
}

// ---------------------------------------------------------------- elk
//
// ブロックがノード。線の出入り口は FIXED_POS のポートで決め打ちする —
// **子へ下りる線は夫婦の間の下ろし点から出る**・**人へ入る線はそのカードの真上に入る**。
// ポートを使わないと elk はブロックの縁の好きな場所から線を出すので、
// 「夫婦の間から下りる」という家系図の文法が座標に残らない。
const portsOf = (b) => [
  ...b.members.flatMap((m) => [
    { id: `Pt-${m.id}`, x: m.x + m.w / 2, y: 0, width: 0, height: 0 },
    { id: `Pb-${m.id}`, x: m.x + m.w / 2, y: b.h, width: 0, height: 0 },
  ]),
  ...b.unions.map((uid) => ({
    id: `Pu-${uid}`,
    x: unionGeo.get(uid).dropX,
    y: b.h,
    width: 0,
    height: 0,
  })),
];
const elkNodes = blocks.map((b) => ({
  id: b.id,
  width: b.w,
  height: b.h,
  layoutOptions: { "elk.portConstraints": "FIXED_POS" },
  ports: portsOf(b),
}));

// 論理の辺。from/to は「union か 人 → 人」のまま持ち、elk へはブロック＋ポートで渡す。
const logical = []; // {from, to, srcPort, tgtPort, srcBlk, tgtBlk}
for (const u of unions.values())
  for (const ch of u.children)
    logical.push({
      from: u.id,
      to: ch,
      srcPort: `Pu-${u.id}`,
      tgtPort: `Pt-${ch}`,
      srcBlk: unionGeo.get(u.id).block.id,
      tgtBlk: blockOf.get(ch).id,
    });
for (const x of extra)
  logical.push({
    from: x.from,
    to: x.to,
    srcPort: `Pb-${x.from}`,
    tgtPort: `Pt-${x.to}`,
    srcBlk: blockOf.get(x.from).id,
    tgtBlk: blockOf.get(x.to).id,
  });
// 親子が同じブロック（子が親の配偶者の鎖にいる）は elk に渡せない。この章には無いが、
// 出たら線が消えるので必ず声を出す。
for (const e of logical.filter((e) => e.srcBlk === e.tgtBlk))
  console.warn(`  ⚠ 同じブロック内の親子は引けない: ${e.from}→${e.to}`);

let ei = 0;

// **段を2回に分けて解く。**
//
// elk の段は世代であって時代ではない。しかも世代の深さは記録に残った親族の数で決まるので、
// 6世代の後漢の祖先鎖（劉発→劉買→劉外→劉回→劉欽→光武帝）は8世代の前漢本流より**13段も
// 上**に来ていた（光武帝 25 が王莽 9・哀帝 前7 より上・2026-08-18「前漢末、新、後漢初の
// 人物の配置を時代感を考慮した配置に」）。
//
// 1回目は**年の背骨**（見えない鎖 T0→T1→… を BUCKET 年ごとに立て、年 y のブロックへ
// T_k → ブロック の辺を張る）を足して解き、**段の番号だけ**を取る。
// 2回目は背骨を捨て、代わりに**辺の途中へ見えないスペーサを挟んで段差だけを再現する**。
const BUCKET = Number(process.env.KINSHIP_BUCKET ?? 20);
const LAYOUT_OPTIONS = {
    "elk.algorithm": "layered",
    "elk.direction": "DOWN",
    "elk.layered.layering.strategy": "NETWORK_SIMPLEX",
    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
    "elk.layered.nodePlacement.strategy":
      process.env.KINSHIP_NODE_PLACEMENT ?? "LINEAR_SEGMENTS",
    // カード同士の横の間隔。14px だと「ノードと線が密集して関係が分かりにくい」と
    // 外部レビューで言われた（2026-08-18）。
    "elk.spacing.nodeNode": process.env.KINSHIP_NODE_GAP ?? "20",
    "elk.layered.spacing.nodeNodeBetweenLayers": process.env.KINSHIP_LAYER_GAP ?? "36",
    "elk.spacing.edgeNode": process.env.KINSHIP_EDGE_NODE ?? "12",
    "elk.layered.spacing.edgeNodeBetweenLayers": process.env.KINSHIP_EDGE_NODE_LAYER ?? "14",
    "elk.edgeRouting": "ORTHOGONAL",
    // 同じ下ろし点から出る兄弟の線を1本の幹にまとめる（本物の櫛になる）。旧 union 方式では
    // 交差が増えて外していたが、ポート付きの家族ブロックでは逆で、交差 3→2・図の高さ
    // 5338→4856px・「行って戻る」ジグザグ（章帝→劉寿）も消えた（2026-08-19 実測）。
    "elk.layered.mergeEdges": process.env.KINSHIP_MERGE ?? "true",
};

const elk = new ELK();
const solve = (children, edges) =>
  elk.layout({ id: "root", layoutOptions: LAYOUT_OPTIONS, children, edges });

// --- 1回目: 年の背骨つき。段の番号だけを取る
const layerOf = new Map(); // blockId -> 段
{
  const spine = new Set();
  const nodesA = blocks.map((b) => ({ id: b.id, width: b.w, height: b.h }));
  const edgesA = logical
    .filter((e) => e.srcBlk !== e.tgtBlk)
    .map((e) => ({ id: `a${ei++}`, sources: [e.srcBlk], targets: [e.tgtBlk] }));
  const years = [...cards.values()].map(yearOf).filter((v) => v != null);
  const lo = Math.min(...years);
  const hi = Math.max(...years);
  for (let k = 0; k <= Math.floor((hi - lo) / BUCKET); k += 1) {
    const id = `t-${k}`;
    spine.add(id);
    nodesA.push({ id, width: 0, height: 0 });
    if (k > 0) edgesA.push({ id: `a${ei++}`, sources: [`t-${k - 1}`], targets: [id] });
  }
  // ブロックの枡は構成員の最古の年。夫婦を同じ枡に入れる問題はブロック化で消えている
  // （高帝 前202 と 呂雉 前179 は同じブロック）。兄弟はここで下限を揃える。
  const bucket = new Map();
  for (const b of blocks) {
    const ys = b.members.map((m) => yearOf(cards.get(m.id))).filter((v) => v != null);
    if (ys.length) bucket.set(b.id, Math.floor((Math.min(...ys) - lo) / BUCKET));
  }
  const pull = (group) => {
    const vals = group.map((id) => bucket.get(id)).filter((v) => v != null);
    if (vals.length < 2) return;
    const b = Math.min(...vals);
    for (const id of group) if (bucket.has(id)) bucket.set(id, b);
  };
  for (const u of unions.values()) pull(u.children.map((c) => blockOf.get(c).id));
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

// **段の番号を家族の単位で揃える。** 兄弟（同じ union の子）が別の段へ割れると、
// 親から下ろす横棒が段違いになって別の子のカードを突き抜ける。**下げる方向にだけ
// 動かす**ので必ず収束する。夫婦はブロックが1つなので最初から同じ段。
{
  const kids = new Map(); // 親（union か 人）-> 子ブロック[]
  for (const u of unions.values())
    if (u.children.length)
      kids.set(u.id, u.children.map((c) => blockOf.get(c).id));
  for (const x of extra) pushTo(kids, x.from, blockOf.get(x.to).id);

  for (let it = 0; it < 12; it += 1) {
    let changed = false;
    const bump = (id, v) => {
      if (v > layerOf.get(id)) {
        layerOf.set(id, v);
        changed = true;
      }
    };
    for (const cs of kids.values()) {
      const m = Math.max(...cs.map((c) => layerOf.get(c)));
      for (const c of cs) bump(c, m);
    }
    for (const e of logical)
      if (e.srcBlk !== e.tgtBlk) bump(e.tgtBlk, layerOf.get(e.srcBlk) + 1);
    if (!changed) break;
  }
  // 空いた段は詰める
  const packed = new Map(
    [...new Set(layerOf.values())].sort((a, b) => a - b).map((v, i) => [v, i]),
  );
  for (const [id, v] of layerOf) layerOf.set(id, packed.get(v));
}

// --- 2回目: 背骨は捨て、段差をスペーサで固定して解く
//
// **線の形も elk に引かせる。** 段をいくつも跨ぐ線はスペーサで刻んであるので、
// 鎖の区間をつなぎ直して1本にする。
const nodesB = [...elkNodes];
const edgesB = [];
const spacers = new Set();
const chainOf = new Map(); // `${from}>${to}` -> [elk の辺 id...]（つなぎ直す順）
let si = 0;
const addChain = (key, srcPort, tgtPort, srcBlk, tgtBlk) => {
  const gap = layerOf.get(tgtBlk) - layerOf.get(srcBlk);
  const chain = [];
  let prev = srcPort;
  for (let k = 1; k < gap; k += 1) {
    const id = `s-${si++}`;
    spacers.add(id);
    nodesB.push({ id, width: 0, height: 0 });
    const eid = `b${ei++}`;
    edgesB.push({ id: eid, sources: [prev], targets: [id] });
    chain.push(eid);
    prev = id;
  }
  const eid = `b${ei++}`;
  edgesB.push({ id: eid, sources: [prev], targets: [tgtPort] });
  chain.push(eid);
  chainOf.set(key, chain);
};
for (const e of logical)
  if (e.srcBlk !== e.tgtBlk) addChain(`${e.from}>${e.to}`, e.srcPort, e.tgtPort, e.srcBlk, e.tgtBlk);
// **継承も elk に引かせる**（逆向き＝行き先が上にある継承だけは足さず、後で自前で引く）。
const succRouted = new Set();
for (const s of succession) {
  const sb = blockOf.get(s.from).id;
  const tb = blockOf.get(s.to).id;
  if (sb === tb) continue;
  if (!(layerOf.get(tb) > layerOf.get(sb))) continue;
  addChain(`${s.from}>${s.to}`, `Pb-${s.from}`, `Pt-${s.to}`, sb, tb);
  succRouted.add(`${s.from}>${s.to}`);
}
const graph = await solve(nodesB, edgesB);

// ブロックの座標を人と union（下ろし点）の絶対座標へほどく。**以降の工程はすべて
// 人・union の座標で進める**（時代で動かす・原点へ寄せる・出力）。
const blockPos = new Map(graph.children.map((n) => [n.id, { x: n.x, y: n.y }]));
const pos = new Map();
for (const b of blocks) {
  const p = blockPos.get(b.id);
  for (const m of b.members) pos.set(m.id, { x: p.x + m.x, y: p.y + m.y });
}
for (const [uid, g] of unionGeo) {
  const p = blockPos.get(g.block.id);
  pos.set(uid, {
    x: p.x + g.dropX - UNION_SIZE / 2,
    y: p.y + g.midY - UNION_SIZE / 2,
  });
}

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

// **端をポートの位置から実際の付け根へ伸ばす。** elk の線はブロックの縁で始まり終わる。
// カードはブロックの中で上下中央に置くので、背の低いカードは縁との間に段差がある。
// union の線は夫婦の横棒の中点（ブロックの中の高さ）まで引き上げる。
for (const [key, pts] of routeOf) {
  const [from, to] = key.split(">");
  const head = pts[0];
  const tail = pts[pts.length - 1];
  if (unionGeo.has(from)) {
    const p = pos.get(from);
    pts.unshift([p.x + UNION_SIZE / 2, p.y + UNION_SIZE / 2]);
  } else if (cards.has(from)) {
    const p = pos.get(from);
    const bottom = p.y + heightOf(cards.get(from));
    if (head[1] > bottom + 0.5) pts.unshift([head[0], bottom]);
  }
  if (cards.has(to)) {
    const p = pos.get(to);
    if (tail[1] < p.y - 0.5) pts.push([tail[0], p.y]);
  }
}

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

// 同じ家族ブロックの中は「近い」のが正しい（夫婦の間 24px を下ろし点の線が通る）。
// 距離の検査からは家族ブロック内の組み合わせを除く。
const blockKeyOf = (id) => blockOf.get(id)?.id ?? unionGeo.get(id)?.block.id ?? null;
const sameBlock = (a, b) => {
  const ka = blockKeyOf(a);
  return ka != null && ka === blockKeyOf(b);
};

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
 * **数 px の「折れ」を吸収する。** elk は稀に数 px だけ横へずらして下ろす経路を返し、
 * それが図では「不要な曲がり」に見える（2026-08-18 の指摘）。折れの前後の
 * 「まっすぐな区間」のうち短い側を、もう一方の座標へ寄せて消す。旧実装は線の
 * 前半分・後半分を丸ごと動かしていたので、途中に別の曲がりがある線では付け根が
 * 箱から出て諦めていた（7px の折れが2件残っていた）。
 * 区間が線の端に届くときは付け根の箱の中に収まる範囲でだけ動かす —
 * **union（下ろし点）は夫婦の横棒の上ならどこでもよい**（横棒の幅 SPOUSE_GAP ぶん動ける。
 * 一般的な家系図でも子の線は横棒の中央からとは限らない）。
 */
const JOG_SNAP = 10;
const endWindow = (id, x, y) => {
  const b = boxes.get(id);
  if (!cards.has(id)) {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    return Math.abs(x - cx) <= SPOUSE_GAP / 2 - 2 && Math.abs(y - cy) <= b.h;
  }
  return x >= b.x + 2 && x <= b.x + b.w - 2 && y >= b.y - 1 && y <= b.y + b.h + 1;
};
const absorbJogs = (input, fromId, toId) => {
  let pts = cleanPolyline(input);
  for (let guard = 0; guard < 20; guard += 1) {
    let done = true;
    for (let i = 0; i + 1 < pts.length; i += 1) {
      const dx = Math.abs(pts[i + 1][0] - pts[i][0]);
      const dy = Math.abs(pts[i + 1][1] - pts[i][1]);
      const len = dx + dy;
      if (len === 0 || len >= JOG_SNAP) continue;
      const axis = dx > 0 ? 0 : 1; // 折れで揃え直す軸
      // 折れの前後の「まっすぐな区間」（axis 座標が一定の連続点）
      let a = i;
      while (a > 0 && pts[a - 1][axis] === pts[i][axis]) a -= 1;
      let b = i + 1;
      while (b + 1 < pts.length && pts[b + 1][axis] === pts[i + 1][axis]) b += 1;
      const lenOf = (s, t) => {
        let v = 0;
        for (let k = s; k < t; k += 1)
          v += Math.abs(pts[k + 1][0] - pts[k][0]) + Math.abs(pts[k + 1][1] - pts[k][1]);
        return v;
      };
      const tryMove = (s, t, target) => {
        const next = pts.map((q) => [...q]);
        for (let k = s; k <= t; k += 1) next[k][axis] = target;
        if (s === 0 && !endWindow(fromId, next[0][0], next[0][1])) return null;
        if (t === pts.length - 1 && !endWindow(toId, next[next.length - 1][0], next[next.length - 1][1]))
          return null;
        return cleanPolyline(next);
      };
      // 短い側を長い側へ寄せる。動かせなければ逆側を試す
      const order =
        lenOf(a, i) <= lenOf(i + 1, b)
          ? [[a, i, pts[i + 1][axis]], [i + 1, b, pts[i][axis]]]
          : [[i + 1, b, pts[i][axis]], [a, i, pts[i + 1][axis]]];
      let moved = null;
      for (const [s, t, target] of order) {
        moved = tryMove(s, t, target);
        if (moved) break;
      }
      if (moved) {
        pts = moved;
        done = false;
        break;
      }
    }
    if (done) break;
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
  // **夫婦の横棒**（一般的な家系図の結び方・2026-08-19）。左の配偶者の右辺から
  // 右の配偶者の左辺まで、カードの中央の高さを水平に1本。React Flow の辺は
  // 2点をつなぐ器なので、下ろし点（union）を挟んで2本に割って持つ。
  // 実父の異説（呂不韋）は点線にして、確定した夫婦と見た目で分ける。
  const f = boxes.get(u.father);
  const m = boxes.get(u.mother);
  const kind = u.kind === "disputed" ? "disputed" : "marriage";
  const y = Math.round(u.y + u.h / 2);
  const cx = Math.round(u.x + u.w / 2);
  const [L, R] = f.x < m.x ? [f, m] : [m, f];
  lines.push({ id: `l${li++}`, kind, from: L.id, to: u.id, points: [[L.x + L.w, y], [cx, y]] });
  lines.push({ id: `l${li++}`, kind, from: u.id, to: R.id, points: [[cx, y], [R.x, y]] });
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
    if (!cards.has(b.id)) continue; // union は見えない結節点なので距離を見ない
    if (sameBlock(e.from, b.id) || sameBlock(e.to, b.id)) continue;
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

// ---------------------------------------------------------------- 廊下の重なりをほどく
//
// 別々の親の線が同じ高さの横の廊下を選ぶと、重なった区間が「1本の線が途中で分岐した」
// ように読める（2026-08-19「線がいっぱい出ていてキモい」の一因。王禁→王政君と
// 劉囂→劉勛が 30px 重なっていた）。横の区間が重なった組は、**兄弟バスを持たない側・
// 短い側の区間を数 px 上下へずらして分離する** — 区間の両端は縦の区間なので、伸縮する
// だけで新しい折れは生まれない。ずらした先がカードや別の線に寄るなら諦める（残りは
// 監査が数える）。
{
  const fromCount = new Map();
  for (const e of lines) fromCount.set(e.from, (fromCount.get(e.from) ?? 0) + 1);
  const hRuns = (e) => {
    const out = [];
    for (let i = 1; i + 1 < e.points.length; i += 1) {
      if (e.points[i][1] !== e.points[i + 1][1]) continue;
      if (i + 1 === e.points.length - 1) continue; // 端の区間は付け根が動くので触らない
      out.push(i);
    }
    return out;
  };
  const segAt = (e, i) => {
    const [x0, y] = e.points[i];
    const [x1] = e.points[i + 1];
    return [Math.min(x0, x1), y, Math.max(x0, x1), y];
  };
  const clearAt = (e, i, newY) => {
    const [x0, , x1] = segAt(e, i);
    for (const bx of boxes.values()) {
      if (!cards.has(bx.id)) continue;
      if (bx.id === e.from || bx.id === e.to) continue;
      if (sameBlock(e.from, bx.id) || sameBlock(e.to, bx.id)) continue;
      if (gap([x0, newY, x1, newY], bx) <= 10) return false;
    }
    for (const o of lines) {
      if (o === e || o.from === e.from) continue;
      for (const j of hRuns(o)) {
        const [ox0, oy, ox1] = segAt(o, j);
        if (Math.abs(oy - newY) <= 4 && Math.min(x1, ox1) - Math.max(x0, ox0) > 2) return false;
      }
    }
    return true;
  };
  for (let pass = 0; pass < 4; pass += 1) {
    // いま重なっている組を1つ拾う
    let pair = null;
    outer: for (const e of lines) {
      for (const i of hRuns(e)) {
        const [x0, y, x1] = segAt(e, i);
        for (const o of lines) {
          if (o === e || o.from === e.from) continue;
          for (const j of hRuns(o)) {
            const [ox0, oy, ox1] = segAt(o, j);
            if (Math.abs(oy - y) <= 1 && Math.min(x1, ox1) - Math.max(x0, ox0) > 2) {
              pair = [
                { e, i, len: x1 - x0 },
                { e: o, i: j, len: ox1 - ox0 },
              ];
              break outer;
            }
          }
        }
      }
    }
    if (!pair) break;
    // 動かす候補: 兄弟バスを持たない（＝子が1人の）側を先に、次に短い側
    pair.sort((a, b) => (fromCount.get(a.e.from) - fromCount.get(b.e.from)) || (a.len - b.len));
    let moved = false;
    for (const cand of pair) {
      const y = cand.e.points[cand.i][1];
      for (const d of [-6, 6, -12, 12]) {
        if (!clearAt(cand.e, cand.i, y + d)) continue;
        cand.e.points[cand.i][1] = y + d;
        cand.e.points[cand.i + 1][1] = y + d;
        cand.e.points = cleanPolyline(cand.e.points);
        moved = true;
        break;
      }
      if (moved) break;
    }
    if (!moved) break; // どちらも動かせない重なりは監査に任せる
  }
}

const faults = {
  カードどうしの重なり: [],
  カードの中を通る: [],
  カードに近すぎる: [],
  線どうしの交差: [],
  線どうしの重なり: [],
  端が浮いている: [],
  不要な折れ: [],
};
// カードが被っていないか（2026-08-19 ユーザー指摘。elk はブロックを重ねないはずだが、
// 時代で動かした成分の置き直しは自前なので、機械で見ないと黙って重なる）。
{
  const ns = [...boxes.values()].filter((b) => cards.has(b.id));
  for (let i = 0; i < ns.length; i += 1)
    for (let j = i + 1; j < ns.length; j += 1) {
      const a = ns[i];
      const b = ns[j];
      if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y)
        faults.カードどうしの重なり.push(`${a.label} × ${b.label}`);
    }
}

for (const e of lines) {
  const segs = segsOf(e);
  for (const b of boxes.values()) {
    if (b.id === e.from || b.id === e.to) continue;
    if (!cards.has(b.id)) continue; // union は見えない結節点
    if (sameBlock(e.from, b.id) || sameBlock(e.to, b.id)) continue;
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

/**
 * 図の縦に敷く「おおよその時代」の帯。
 *
 * **年の目盛りにはしない。** 段は世代の順なので、上下関係にあるカード 3,320 組のうち
 * 135 組（4.1%）は年が前後している（劉立 3年 が 王政君 前70年 の上、など）。数値の軸を
 * 引くと読者がその 4% を1件ずつ突き合わせられてしまい、**いままで見えなかった段の
 * ずれが「見える嘘」に変わる**（2026-08-18 の外部レビュー「年代の基準線が不明確」への
 * 答えは、精度を上げることではなく精度を名乗らないこと）。
 *
 * 境目は**どのカードも跨がない横の切れ目**からしか選ばない。代表年が前へ戻る帯は隣と
 * 併合する（戻る帯が1つでも出ると帯そのものが嘘になる）。
 */
function buildEraBands(ns, totalH) {
  const yr = (n) =>
    n.isEmperor
      ? (n.reignFrom ?? n.birthYear ?? n.deathYear ?? null)
      : (n.birthYear ?? n.deathYear ?? null);
  const iv = ns.map((n) => [n.y, n.y + n.h]).sort((a, b) => a[0] - b[0]);
  const free = [];
  let end = -Infinity;
  for (const [a, b] of iv) {
    if (a > end && end > -Infinity) free.push((end + a) / 2);
    end = Math.max(end, b);
  }
  const TARGET = 6;
  const cuts = [];
  for (let i = 1; i < TARGET; i += 1) {
    const want = (totalH * i) / TARGET;
    let best = null;
    let bd = Infinity;
    for (const f of free) {
      const d = Math.abs(f - want);
      if (d < bd && !cuts.includes(f)) {
        bd = d;
        best = f;
      }
    }
    if (best != null) cuts.push(best);
  }
  cuts.sort((a, b) => a - b);
  let bounds = [0, ...cuts, totalH];
  const yearOf = (y0, y1) => {
    const v = ns
      .filter((n) => n.y + n.h / 2 >= y0 && n.y + n.h / 2 < y1)
      .map(yr)
      .filter((x) => x != null)
      .sort((a, b) => a - b);
    return v.length ? Math.round(v[Math.floor(v.length / 2)] / 25) * 25 : null;
  };
  for (let pass = 0; pass < 12; pass += 1) {
    let merged = false;
    for (let i = 1; i < bounds.length - 1; i += 1) {
      const a = yearOf(bounds[i - 1], bounds[i]);
      const b = yearOf(bounds[i], bounds[i + 1]);
      if (a == null || b == null || b <= a) {
        bounds = [...bounds.slice(0, i), ...bounds.slice(i + 1)];
        merged = true;
        break;
      }
    }
    if (!merged) break;
  }
  const bandsOut = [];
  for (let i = 0; i < bounds.length - 1; i += 1) {
    const year = yearOf(bounds[i], bounds[i + 1]);
    if (year == null) continue;
    bandsOut.push({
      y0: Math.round(bounds[i]),
      y1: Math.round(bounds[i + 1]),
      year,
      label: year < 0 ? `前${-year}年ごろ` : `${year}年ごろ`,
    });
  }
  return bandsOut;
}

const eraBands = buildEraBands(nodes, height);
console.log(
  `  時代の帯: ${eraBands.length}本 — ${eraBands.map((b) => b.label).join(" → ")}`,
);

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
  eraBands,
  nodes,
  unions: unionNodes,
  // **描画はこの1本だけを見る。** union / extraParent / succession の3つの器を
  // 部品側でほどき直すと、バスの高さ（＝線の形）が図の外で決まってしまう。
  edges: edgeOut,
};

const destDir = path.join(process.cwd(), "src", "lib", "kinship");
mkdirSync(destDir, { recursive: true });
writeFileSync(path.join(destDir, "layout.qin-han.json"), JSON.stringify(out), "utf8");

console.log(
  `kinship layout: ${nodes.length}人（除外 ${dropped.length}: ${dropped.map((d) => d.label).join("・")}） / union ${unionNodes.length} / 追加の親子 ${extra.length} / 継承 ${succession.length} / 時代で動かした成分 ${shifted.length} / 段 ${layerYs.length} / ${width}×${height}px`,
);
