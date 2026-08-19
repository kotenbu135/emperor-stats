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
// **皇帝の表示名はサイト共通の唯一の場所（display-name.ts）を通す**（2026-08-19
// ユーザー指摘「一覧では高祖なのに系譜図では高帝」— このスクリプトだけが
// commonName を生で出していた）。Node 26 の type stripping で .ts を直接 import できる。
import { emperorDisplayName, emperorSubtitle } from "../src/lib/display-name.ts";


// 寸法と間隔は probe-kinship-layout.mjs で測って選んだ。
const CARD_W = 112;
// 皇帝のカードだけが縦長（上半分が肖像）。**皇帝以外は肖像アセットが1枚も無い**ので、
// 縦長の枠を用意しても中身は姓一文字のモノグラムにしかならない（2026-08-18 ユーザー指示で
// 名前と年の帯だけに縮めた）。図が縦にも横にも詰まり、親子の線が短くなる副次効果がある。
// 2026-08-19: ふりがな（rt ≈ 名前の半分の字高）と皇帝カードの「第N代」の行が入るぶん
// 高くした（140/38/50 → 164/48/62）。ふりがな OFF のときの余りは、皇帝カードは肖像
// （flex-1）が、親族カードは中央寄せ（justify-center）が吸収する。
const EMPEROR_H = 164;
const KIN_H = 48;
// 名前の補足を2行目に落とすぶんだけ親族の箱を高くする。**幅は広げない** — 長い名前は
// 105 人中 5 人（全部「竇氏〔孝文竇皇后〕」型）で、幅で解くと図の総幅が全員ぶん太る
// （2026-08-18 の外部レビュー「テキストの省略」）。
const KIN_ANNOT_H = 62;
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

// ---------------------------------------------------------------- 章
//
// 章ごとに独立して解いて layout.<eraId>.json に落とす。**guests は「章の eraId では
// ないが、この章に出す人物」** —
//   (a) 禅譲の前帝: 後漢の献帝（2026-08-19 ユーザー指示「後漢の献帝だけいれて
//       禅譲がわかるようにする」。継承の線だけでつながる。妻の曹節ら後漢の家族は
//       この章には出さない — 献「だけ」入れる指示）
//   (b) 前の章で「章内に線が1本も無い」として外した親: 袁逢（子＝袁術）・劉弘
//       （子＝昭烈帝）。子がこの章にいるので、ここで初めて線を持てる
const CHAPTERS = [
  { eraId: "qin-han", guests: [], bucket: 20 },
  {
    eraId: "three-kingdoms-jin",
    guests: ["hou-han-xiandi", "p-yuan-feng", "p-liu-hong-shu"],
    bucket: 12,
  },
  // 客人なし。西晋→東晋は禅譲ではなく（愍帝→元帝の succession エッジはデータに無い）、
  // 元帝の父・司馬覲は前の章に線を持って出ているので、章をまたぐ親子（crossEra）として
  // 前の章の側に記録されるだけでよい。
  { eraId: "eastern-jin-sixteen", guests: [], bucket: 10 },
  // 客人＝禅譲の前帝（東晋の恭帝→宋の武帝）。家族は連れて来ない（献帝と同じ）。
  { eraId: "northern-southern", guests: ["dongjin-gongdi"], bucket: 20, thoroughness: 30 },
  // 客人＝禅譲の前帝（北周の静帝→隋の文帝）。
  { eraId: "sui-tang", guests: ["beizhou-jingdi"], bucket: 10, thoroughness: 100 },
  // 客人＝禅譲の前帝（唐の哀帝→後梁の太祖）。
  { eraId: "five-dynasties", guests: ["tang-aidi"], bucket: 15 },
];

async function buildChapter({ eraId: ERA_ID, guests, bucket, thoroughness }) {
const guestSet = new Set(guests);
const emp = emperors.emperors.filter((e) => e.eraId === ERA_ID || guestSet.has(e.id));
const per = kinship.persons.filter((p) => p.eraId === ERA_ID || guestSet.has(p.id));
const ids = new Set([...emp.map((e) => e.id), ...per.map((p) => p.id)]);

// 章の外にいる人物も名前だけ引けるようにする（章をまたぐ親子を出すため）。
const outsideEra = new Map();
for (const e of emperors.emperors) if (!ids.has(e.id)) outsideEra.set(e.id, e);
for (const p of kinship.persons) if (!ids.has(p.id)) outsideEra.set(p.id, p);
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
  // 王朝内の代数（第N代）。**dynastyOrder が確定している在位だけ**から引く — 欄が無い
  // 政権（隋・唐・五代十国など dynastyOrderSurveyed: false の53政権）は未調査なので
  // 出さないし、在位順から推論もしない（EMPERORS_SCHEMA.md・Issue #69）。
  // 復位（晋恵帝の第2・4代など）は在位ごとに別カウントなので全部並べる。
  const ordinal = [
    ...new Set(reigns.map((r) => r.dynastyOrder).filter((n) => typeof n === "number")),
  ].sort((a, b) => a - b);
  // 配信されるのは public/portraits/<id>.webp（manifest の localFile は元画像の .jpg で、
  // サイトに出るファイル名ではない）。**実在で判定する**。
  const hasPortrait = existsSync(path.join(process.cwd(), "public", "portraits", `${e.id}.webp`));
  const portrait = hasPortrait ? portraitById.get(e.id) : null;
  // 一覧・個別ページと同じ通用名（高帝→高祖・則天大聖皇帝→武則天）＋補助名（諱）。
  // splitLabel（括弧を2行目へ割る素朴な方式）は親族カード専用に残す。
  const dn = emperorDisplayName(e.id, e.name?.commonName ?? e.id, e.regimeId);
  const fullPersonal = e.name?.personalName
    ? `${e.name?.familyName ?? ""}${e.name.personalName}`
    : null;
  const sub = emperorSubtitle(
    e.id,
    fullPersonal,
    e.name?.personalName ?? null,
    e.regimeId,
    dn,
    e.name?.ethnicName ?? null,
  );
  cards.set(e.id, {
    id: e.id,
    emperorId: e.id,
    main: dn,
    annot: sub,
    ordinal: ordinal.length ? ordinal : null,
    label: sub ? `${dn}（${sub}）` : dn,
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

// **相手が3人以上いる人は、夫婦の鎖に入れるのを2人までにする。** 鎖（呂雉—高帝—薄姫）は
// 両隣の2枠しか無いので、3人目の union は結び目を解いて「父の実線＋母の破線」の
// 2本の直線に落とす（片親しか確定していない子と同じ描き方の器に乗せる）。
// 残す2人は「子の多い union」優先・同数なら子の年が古い側 — 家の本流が鎖に残る。
// この章では慕容皝（段氏・蘭氏・公孫氏）だけで、demote されるのは公孫氏（子＝南燕の
// 慕容徳1人・3人の中で最も遅い）。
{
  const partnerUnions = new Map(); // person -> union[]
  for (const u of unions.values()) {
    pushTo(partnerUnions, u.father, u);
    pushTo(partnerUnions, u.mother, u);
  }
  const oldestChildYear = (u) =>
    Math.min(
      ...u.children.map((c) => {
        const cc = cards.get(c);
        return cc?.birthYear ?? cc?.reignFrom ?? 9999;
      }),
      9999,
    );
  for (const [pid, us] of partnerUnions) {
    if (us.length <= 2) continue;
    // 相手が別の誰かとも夫婦の鎖を持つ union は残さない（partnerCount 昇順を2番目の鍵に）。
    // 唐の太宗（長孫氏・武則天・楊妃）で、武則天（相手2人＝太宗と高宗）を鎖に残すと
    // 鎖が 長孫氏—太宗—武則天—高宗 と伸び、高宗が実の両親（太宗×長孫氏）と同じ
    // ブロックに入って親子の線が引けなくなる。楊妃（相手1人）を残せば鎖は閉じる。
    // 代償として太宗×武則天の婚姻線は図から消える（demote された union に子が無いと
    // 引く線が無い）— 下の warn がそれを声に出す。
    const other = (u) => (u.father === pid ? u.mother : u.father);
    const partnerCount = (u) => partnerUnions.get(other(u))?.length ?? 0;
    const ranked = [...us].sort(
      (a, b) =>
        b.children.length - a.children.length ||
        partnerCount(a) - partnerCount(b) ||
        oldestChildYear(a) - oldestChildYear(b),
    );
    for (const u of ranked.slice(2)) {
      for (const c of u.children) {
        extra.push({ from: u.father, to: c, kind: "father" });
        extra.push({ from: u.mother, to: c, kind: "mother" });
      }
      const key = [...unions.entries()].find(([, v]) => v === u)?.[0];
      unions.delete(key);
      console.warn(
        u.children.length
          ? `  ⚠ 相手が3人以上: ${pid} — union ${u.father}×${u.mother}（子 ${u.children.join("・")}）を直線2本に落とした`
          : `  ⚠ 相手が3人以上: ${pid} — 子の無い union ${u.father}×${u.mother} を落とした（この婚姻は図に出ない）`,
      );
    }
  }
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

// **遠祖（remote-ancestor）は原則引かないが、これを引かないと章内に線が1本も
// 無くなる人だけは例外として引く。** 西燕の慕容永は実父が史料に無く（晋書載記・
// 十六国春秋とも欠字）祖父＝慕容運までしか判明しない。原則のまま外すと**章の皇帝が
// 図から消える**。曾祖父しか判らない慕容詳は簒奪の線で章につながるので例外に
// 掛からない — 段が3つ飛ぶ線をむやみに増やさないための「線が無い人だけ」。
{
  const linked0 = new Set();
  for (const u of unions.values()) {
    linked0.add(u.father);
    linked0.add(u.mother);
    for (const c of u.children) linked0.add(c);
  }
  for (const x of extra) {
    linked0.add(x.from);
    linked0.add(x.to);
  }
  for (const s of succession) {
    linked0.add(s.from);
    linked0.add(s.to);
  }
  const REMOTE_LABEL = { grandfather: "祖父", "great-grandfather": "曾祖父" };
  for (const ed of kinship.edges) {
    if (ed.type !== "kinship" || ed.relation !== "remote-ancestor") continue;
    if (!ids.has(ed.from) || !ids.has(ed.to)) continue;
    if (linked0.has(ed.to)) continue;
    extra.push({
      from: ed.from,
      to: ed.to,
      kind: "remote",
      label: REMOTE_LABEL[ed.relationDetail] ?? "遠祖",
    });
  }
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
    if (linked.has(id)) continue;
    // **皇帝は外さない。** 隋末・唐末の群雄（輔公祏・李軌・黄巣ら8人）は家族も
    // 引ける継承も一切データに無いが、章の皇帝が図から消えるのは章の嘘になる。
    // 線ゼロの1人ブロックとして残し、小成分の時代合わせがその在位年の段へ置く。
    if (cards.get(id).isEmperor) continue;
    dropped.push({ id, label: cards.get(id).label, reason: "章内に線が1本も無い" });
    cards.delete(id);
    ids.delete(id);
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
// **枡の幅は章ごとに選ぶ**（BUCKET=20 の全章一律だと、章の年代の密度で密集の
// ほどけ方が大きく違った — 2026-08-19 の実測: 三国西晋は 12 で交差 10→1、
// 秦・漢は 20 が最少）。値は章の表（CHAPTERS）が持つ。
const BUCKET = Number(process.env.KINSHIP_BUCKET ?? bucket ?? 20);
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
    // LAYER_SWEEP の反復数。既定 7。南北朝（172人・блок間の婚姻が多い）は 7 だと
    // 交差 15〜20 件で頭打ちだった — 大きい章では上げる価値がある（ビルド時のみの
    // コストなので遅くなってよい）。
    "elk.layered.thoroughness": process.env.KINSHIP_THOROUGHNESS ?? String(thoroughness ?? 7),
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
  // **背骨に繋ぐ年は在位開始年か生年だけ。没年では繋がない** — 没年しか無い人は
  // 「長生きした年」に世代ごと引きずり下ろされる。三国西晋の実測: 曹宇（278没・生年
  // 不明）が孫の世代の段に落ち、兄弟の段揃えで曹彰も道連れ、その子孫（曹楷・曹芳・
  // 元帝）が図の最下段へ玉突きした。没年しか無い人は背骨に繋がず、家族の制約だけで
  // 段が決まる。
  const spineYearOf = (c) => c.reignFrom ?? c.birthYear ?? null;
  const years = [...cards.values()].map(spineYearOf).filter((v) => v != null);
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
    const ys = b.members.map((m) => spineYearOf(cards.get(m.id))).filter((v) => v != null);
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
  // **家族の線を1本も持たないブロック（客人の前帝＝献帝）は、継承の行き先の1段上へ。**
  // 年の背骨にしかつながれていないので、段が行き先と同じ・下になることがあり、そうなると
  // 継承の辺を elk に渡せず（下りの辺しか渡さない）、phase B で孤立して図の隅に置かれる。
  {
    const hasFamily = new Set();
    for (const e of logical) {
      hasFamily.add(e.srcBlk);
      hasFamily.add(e.tgtBlk);
    }
    for (const s of succession) {
      const sb = blockOf.get(s.from).id;
      const tb = blockOf.get(s.to).id;
      if (hasFamily.has(sb)) continue;
      layerOf.set(sb, Math.min(layerOf.get(sb), layerOf.get(tb) - 1));
    }
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
// **継承も elk に引かせる。** 下向き（行き先が下の段）はそのまま。
// **上向きは向きを逆にして elk に渡し、出力時に折れ線を反転して戻す** — 旧実装は
// 中点へまっすぐ引く sideRoute だけで、三国西晋の元帝→晋武帝（禅譲）が司馬家の
// カード2枚を突き抜けた。逆向きなら elk が空きを縫って引く。
// **両方向の対（恵帝⇄司馬倫＝簒奪と復位）だけは逆向きを足さない** — 同じポート対の
// 2本になって完全に重なる。対の上向き側は sideRoute で別の廊下に引く。
const succRouted = new Set();
const succReversed = new Set();
const succPairKeys = new Set(succession.map((s) => `${s.from}>${s.to}`));
// 継承専用のポート。**Pb/Pt を使い回すと mergeEdges が家族の線と同じ幹に
// 束ねてしまい**、朱の破線が実の親子の幹の上へ 70px 重なった（三国西晋の実測）。
// カード中央から +18px ずらした口を、要るブロックにだけ足す。ずらしてあるので
// 親からの下ろし線と同じ点に刺さらず、継承と家族の線が入口で見分けられる。
const succPort = (personId, side) => {
  const b = blockOf.get(personId);
  const m = b.members.find((x) => x.id === personId);
  const id = `${side === "bottom" ? "Psb" : "Pst"}-${personId}`;
  const node = elkNodes.find((n) => n.id === b.id);
  if (!node.ports.some((pt) => pt.id === id))
    node.ports.push({
      id,
      x: m.x + m.w / 2 + 18,
      y: side === "bottom" ? b.h : 0,
      width: 0,
      height: 0,
    });
  return id;
};
for (const s of succession) {
  const sb = blockOf.get(s.from).id;
  const tb = blockOf.get(s.to).id;
  if (sb === tb) continue;
  const key = `${s.from}>${s.to}`;
  // **同段（＝別々の家で背骨の枡がたまたま同じ）も下向き扱いで渡す** — elk の layered は
  // 辺の向きに1段割って置き直すので、前帝が上・後帝が下という時代の向きに揃う。
  // 元帝→晋武帝（ともに枡5）を同段のまま残すと sideRoute になり、武帝の横腹へ
  // 夫婦の横棒と重なって刺さった（実測 2026-08-19）。
  if (layerOf.get(tb) >= layerOf.get(sb)) {
    addChain(key, succPort(s.from, "bottom"), succPort(s.to, "top"), sb, tb);
    succRouted.add(key);
  } else if (!succPairKeys.has(`${s.to}>${s.from}`)) {
    addChain(key, succPort(s.to, "bottom"), succPort(s.from, "top"), tb, sb);
    succRouted.add(key);
    succReversed.add(key);
  }
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

// 逆向きに引かせた継承を from→to の向きへ戻す（矢印・ラベルは to 側に付く）
for (const key of succReversed) {
  if (!routeOf.get(key)) console.warn(`  ⚠ 逆向き継承の経路が elk から返らなかった: ${key}`);
  routeOf.get(key)?.reverse();
}

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
    else if (head[1] < p.y - 0.5) pts.unshift([head[0], p.y]);
  }
  if (cards.has(to)) {
    const p = pos.get(to);
    const bottom = p.y + heightOf(cards.get(to));
    if (tail[1] < p.y - 0.5) pts.push([tail[0], p.y]);
    else if (tail[1] > bottom + 0.5) pts.push([tail[0], bottom]);
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
// **図に引く継承の線は、成分の判定にだけ入れる。** 禅譲でつながる王朝（献帝→魏→晋）を
// 別成分として時代側へ平行移動すると、elk が引いた継承の線の端が浮く。ただし
// familyRegimeId の BFS は家族の線だけを見る（継承は家族ではない）ので adjacency 本体には
// 足さず、写しに足す。
const compAdj = new Map([...adjacency].map(([k, v]) => [k, new Set(v)]));
{
  const linkC = (a, b) => {
    const cur = compAdj.get(a);
    if (cur) cur.add(b);
    else compAdj.set(a, new Set([b]));
  };
  for (const s of succession) {
    linkC(s.from, s.to);
    linkC(s.to, s.from);
  }
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
    for (const nx of compAdj.get(cur) ?? []) {
      if (seen.has(nx)) continue;
      seen.add(nx);
      stack.push(nx);
    }
  }
  components.push(comp);
}
components.sort((a, b) => b.length - a.length);

// 親族カードへ「その家の政権」を写す（2026-08-19 ユーザー指示「同じ王朝の人物を
// わかりやすく表示したい」）。**家族の線（union・追加の親子）だけをたどって最寄りの
// 皇帝の政権を採る** — 継承の線は家族ではないのでたどらない。同じ近さで政権が
// 割れたら多数決 → 政権 id 順で決め打ち（決定的にするためだけの規則）。
for (const c of cards.values()) {
  if (c.isEmperor) continue;
  let frontier = [c.id];
  const seenB = new Set(frontier);
  let found = null;
  for (let depth = 0; depth < 16 && frontier.length && !found; depth += 1) {
    const next = [];
    const hits = [];
    for (const cur of frontier)
      for (const nx of adjacency.get(cur) ?? []) {
        if (seenB.has(nx)) continue;
        seenB.add(nx);
        const cc = cards.get(nx);
        if (cc?.isEmperor && cc.regimeId) hits.push(cc.regimeId);
        next.push(nx);
      }
    if (hits.length) {
      const tally = new Map();
      for (const r of hits) tally.set(r, (tally.get(r) ?? 0) + 1);
      found = [...tally.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
    }
    frontier = next;
  }
  c.familyRegimeId = found;
}

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
    // **成分の上端を「成分全体の年の中央値」の段に置かない。** 縦に長い成分では上端が
    // 中央値の年の段へ沈む — 南北朝の実測: 北朝の成分（道武帝386〜北斉577・12世代）の
    // 上端が年500ごろの段に置かれ、道武帝が劉裕（420）より2400px下に出た。
    // 代わりに**構成員ごとに「自分の年の段」との差を測り、その中央値で平行移動する**
    // （成分は1枚の板として動かすので、ずれの合計が最小になる寄せ方）。
    const dys = [];
    for (const id of comp) {
      const c = cards.get(id);
      if (!c) continue;
      const v = yearOf(c);
      if (v == null) continue;
      let best = ruler[0];
      for (const r of ruler) if (Math.abs(r.year - v) < Math.abs(best.year - v)) best = r;
      dys.push(best.y - pos.get(id).y);
    }
    if (dys.length) {
      targetY = box.y0 + median(dys);
      // x の寄せ先は、動かした後に縦で重なる巨大成分の段の左端の最小（1段だけ見ると
      // 下の段が左へ張り出している場合にカードへ重なる）。
      let lo = null;
      for (const [y, span] of mainSpan) {
        if (y + 200 < targetY || y > targetY + (box.y1 - box.y0)) continue;
        lo = lo == null ? span.lo : Math.min(lo, span.lo);
      }
      anchor = lo == null ? null : { lo };
    } else {
      let best = ruler[0];
      for (const r of ruler) if (Math.abs(r.year - want) < Math.abs(best.year - want)) best = r;
      targetY = best.y;
      anchor = mainSpan.get(best.y);
    }
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

/**
 * elk に渡さなかった継承（両方向の対の上向き側・同じ段どうし）を自前で引く。
 * **縦の廊下はカードにぶつからない x を探して選ぶ** — 中点固定だと、三国西晋の
 * 簒奪・復位の対で廊下が司馬穎のカードへ 8px まで寄った。
 */
const sideRoute = (from, to) => {
  const a = boxes.get(from);
  const b = boxes.get(to);
  const rightward = b.x + b.w / 2 > a.x + a.w / 2;
  const sx = rightward ? a.x + a.w : a.x;
  const sy = a.y + a.h / 2;
  const tx = rightward ? b.x : b.x + b.w;
  const ty = b.y + b.h / 2;
  // 検査側の gap() は宣言がまだ先なのでここでは使えない（TDZ）。同じ式の局所版。
  const gp = (s, bx) => {
    const dx = Math.max(bx.x - s[2], s[0] - (bx.x + bx.w), 0);
    const dy = Math.max(bx.y - s[3], s[1] - (bx.y + bx.h), 0);
    return Math.max(dx, dy);
  };
  const clearBus = (x) => {
    const segs = [
      [Math.min(sx, x), sy, Math.max(sx, x), sy],
      [x, Math.min(sy, ty), x, Math.max(sy, ty)],
      [Math.min(x, tx), ty, Math.max(x, tx), ty],
    ];
    for (const bx of boxes.values()) {
      if (!cards.has(bx.id) || bx.id === from || bx.id === to) continue;
      for (const s of segs) if (gp(s, bx) < 12) return false;
    }
    return true;
  };
  const mid = Math.round((sx + tx) / 2);
  let bus = mid;
  for (let d = 0; d <= 120; d += 4) {
    if (clearBus(mid - d)) {
      bus = mid - d;
      break;
    }
    if (clearBus(mid + d)) {
      bus = mid + d;
      break;
    }
  }
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
        const cleaned = cleanPolyline(next);
        // **縦だった端の区間を横へ変える寄せは不採用** — 12px の垂直の入りを「折れ」と
        // 見なして潰すと、線がカードの縁と同じ高さを横に走る（文帝→劉武で顕在化。
        // 自分の from/to との距離検査は除外されているので監査も素通りした）
        const horiz = (a, b) => a && b && a[1] === b[1];
        const vert = (a, b) => a && b && a[0] === b[0];
        if (vert(pts[0], pts[1]) && horiz(cleaned[0], cleaned[1])) return null;
        if (
          vert(pts[pts.length - 2], pts[pts.length - 1]) &&
          horiz(cleaned[cleaned.length - 2], cleaned[cleaned.length - 1])
        )
          return null;
        return cleaned;
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

/**
 * 両方向の対（簒奪→復位）の上向き側。**下向き側（elk が引いた線）を 12px 平行に
 * ずらして逆順にする** — 別の廊下を探すと2本が図の別々の場所を走って「同じ2人の
 * 往復」に見えない。ずらすのは各区間の直交方向（縦は x・横は y）。端の点は区間の
 * 向きに沿ってだけ動くのでカードの縁から外れない。ずらす向きは**カードから遠くなる
 * 側**を選ぶ（+12 固定だと、下向き側が愍帝の上端 14px を通っていたとき、ずらした側が
 * 上端の中へ入った）。下向き側は後処理で形が変わるので、**これは後処理の最後に
 * もう一度作り直す**（途中の形から作ると対が平行でなくなる）。
 */
const mirrorRoute = (down, fromId, toId) => {
  const rev = [...down].reverse();
  const isV = [];
  for (let i = 1; i < rev.length; i += 1) isV.push(rev[i - 1][0] === rev[i][0]);
  const shifted = (d) =>
    rev.map(([x, y], i) => [
      isV[i - 1] || isV[i] ? x + d : x,
      (i > 0 && !isV[i - 1]) || (i < isV.length && !isV[i]) ? y + d : y,
    ]);
  const clearance = (cand) => {
    let worst = Infinity;
    for (let i = 1; i < cand.length; i += 1) {
      const s0 = [
        Math.min(cand[i - 1][0], cand[i][0]),
        Math.min(cand[i - 1][1], cand[i][1]),
        Math.max(cand[i - 1][0], cand[i][0]),
        Math.max(cand[i - 1][1], cand[i][1]),
      ];
      for (const bx of boxes.values()) {
        if (!cards.has(bx.id) || bx.id === fromId || bx.id === toId) continue;
        const dx = Math.max(bx.x - s0[2], s0[0] - (bx.x + bx.w), 0);
        const dy = Math.max(bx.y - s0[3], s0[1] - (bx.y + bx.h), 0);
        worst = Math.min(worst, Math.max(dx, dy));
      }
    }
    return worst;
  };
  const a = shifted(12);
  const b = shifted(-12);
  return clearance(a) >= clearance(b) ? a : b;
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
for (const x of extra) push(x.kind, x.from, x.to, x.label ? { label: x.label } : undefined);
for (const s of succession) {
  const key = `${s.from}>${s.to}`;
  let pts = succRouted.has(key) ? routeOf.get(key) : null;
  if (!pts && succPairKeys.has(`${s.to}>${s.from}`)) {
    // **両方向の対（簒奪→復位）は同じ廊下を往復で見せる。** 下向き側（elk が引いた線）を
    // 12px 平行にずらして逆順にする — 別の廊下を探すと2本が図の別々の場所を走って
    // 「同じ2人の往復」に見えない。12px は二重線の監査（10px 以下）に掛からない間隔。
    // **ずらすのは各区間の直交方向**（縦は x・横は y。x だけずらすと横の区間が
    // そのまま重なる — 実測 487px）。端の点は区間の向きに沿ってだけ動くので
    // カードの縁から外れない。
    const down = routeOf.get(`${s.to}>${s.from}`);
    if (down) pts = mirrorRoute(down, s.from, s.to);
  }
  if (!pts) pts = sideRoute(s.from, s.to);
  if (!pts) continue;
  lines.push({
    id: `l${li++}`,
    kind: "succession",
    from: s.from,
    to: s.to,
    categoryId: s.categoryId,
    // 鏡写しの線は後処理の最後に下向き側から作り直す（その印）
    mirrorOf: succRouted.has(key) ? null : succPairKeys.has(`${s.to}>${s.from}`) ? `${s.to}>${s.from}` : null,
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
    if (o === e) continue;
    // 同じ親のバス・同じ子へ入る線の**重なり**は共有であって欠陥ではない。
    // **交差は誰が相手でも欠陥**（最後の監査と同じ数え方。ここで除くと、簡略化が
    // 「親の下ろし線を2回またぐ継承」を同点と誤認して採ってしまった）。
    const sameEnd = o.from === e.from || o.to === e.to;
    for (const seg of segs)
      for (const t of segsOf(o)) {
        if (crossAt(seg, t)) c += 2;
        if (!sameEnd && overlapLen(seg, t) > 2) c += 1;
      }
    // 二重線に見える並走（監査と同じ: 別親・x差10px以内・60px以上）も悪さに数える
    if (o.from !== e.from) {
      for (const seg of segs) {
        if (seg[0] !== seg[2]) continue;
        for (const t of segsOf(o)) {
          if (t[0] !== t[2]) continue;
          const d = Math.abs(seg[0] - t[0]);
          if (d === 0 || d > 10) continue;
          if (Math.min(seg[3], t[3]) - Math.max(seg[1], t[1]) >= 60) c += 2;
        }
      }
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

// ---------------------------------------------------------------- 行って戻る折り返しを消す
//
// elk はスペーサの段を律儀に経由するので、目的の廊下を**通り過ぎてから戻る U 字**が
// 稀に出る（武帝→劉髆が y1606 まで下りてから y1438 へ戻っていた＝並走する縦線が
// 増えて「二重線」に見える一因）。縦→横→縦 の並びで2本目の縦が逆向きなら:
//   形B: 戻りが1本目の付け根を越えて進む → 1本目の縦は丸ごと迂回。枝ごと落として
//        横棒を付け根の高さに引き直す（兄弟のバスの高さが保たれるので先に試す）
//   形A: 戻り先が1本目の縦の途中 → 横棒を戻り先の高さへ引き上げる
// どちらも、引き直した線がカードに寄るなら諦める。
{
  const clearSeg = (e, xa, ya, xb, yb) => {
    const s = [Math.min(xa, xb), Math.min(ya, yb), Math.max(xa, xb), Math.max(ya, yb)];
    for (const bx of boxes.values()) {
      if (!cards.has(bx.id)) continue;
      if (bx.id === e.from || bx.id === e.to) continue;
      if (sameBlock(e.from, bx.id) || sameBlock(e.to, bx.id)) continue;
      if (gap(s, bx) <= 6) return false;
    }
    return true;
  };
  for (const e of lines) {
    for (let guard = 0; guard < 8; guard += 1) {
      const p = e.points;
      let changed = false;
      const detect = (i) => {
        const v1 = p[i - 1][0] === p[i][0] && p[i][1] !== p[i - 1][1];
        const h = p[i][1] === p[i + 1][1] && p[i][0] !== p[i + 1][0];
        const v2 = p[i + 1][0] === p[i + 2][0] && p[i + 2][1] !== p[i + 1][1];
        if (!v1 || !h || !v2) return null;
        const d1 = Math.sign(p[i][1] - p[i - 1][1]);
        if (Math.sign(p[i + 2][1] - p[i + 1][1]) === d1) return null;
        return d1;
      };
      // 形B
      for (let i = 1; i + 2 < p.length; i += 1) {
        const d1 = detect(i);
        if (d1 == null) continue;
        const P = p[i - 1];
        const R = p[i + 1];
        const S = p[i + 2];
        if (Math.sign(S[1] - P[1]) === d1 || S[1] === P[1]) continue; // 付け根を越えていない
        if (!clearSeg(e, P[0], P[1], R[0], P[1])) continue;
        if (!clearSeg(e, R[0], P[1], R[0], S[1])) continue;
        e.points = cleanPolyline([...p.slice(0, i), [R[0], P[1]], ...p.slice(i + 2)]);
        changed = true;
        break;
      }
      if (changed) continue;
      // 形A
      for (let i = 1; i + 2 < p.length; i += 1) {
        const d1 = detect(i);
        if (d1 == null) continue;
        const yTurn = p[i + 2][1];
        if (Math.sign(yTurn - p[i - 1][1]) !== d1) continue;
        if (Math.sign(p[i][1] - yTurn) !== d1) continue;
        if (!clearSeg(e, p[i][0], yTurn, p[i + 1][0], yTurn)) continue;
        e.points = cleanPolyline([
          ...p.slice(0, i),
          [p[i][0], yTurn],
          [p[i + 1][0], yTurn],
          ...p.slice(i + 2),
        ]);
        changed = true;
        break;
      }
      if (!changed) break;
    }
  }
}

// ---------------------------------------------------------------- 兄弟の櫛を組み直す
//
// elk は段のスペーサを律儀に経由するので、兄弟の1人だけが「早く曲がって階段状に
// 下りる」経路になることがある（章帝→劉開が兄弟3人のバス y3468 に乗らず y3282 で
// 曲がった・司馬懿→司馬伷が3段の階段になり司馬亮の線と交差した）。同じ親から
// 2本以上出ていたら、**多数派のバスに乗る「幹→バス→垂下」の櫛へ組み直せるか試す**。
// 悪さ（costOf）が増えるなら1本ずつ諦める。
{
  const byParent = new Map();
  for (const e of lines) {
    if (e.kind === "succession" || e.kind === "marriage" || e.kind === "disputed") continue;
    pushTo(byParent, e.from, e);
  }
  for (const es of byParent.values()) {
    if (es.length < 2) continue;
    const busYs = es.map(firstBusY).filter((v) => v != null);
    if (!busYs.length) continue;
    // 多数派のバスへ。同数なら深い方（付け根から遠いほど、途中のカードを跨ぎにくい）
    const tally = new Map();
    for (const y of busYs) tally.set(y, (tally.get(y) ?? 0) + 1);
    const bus = [...tally.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
    for (const e of es) {
      const head = e.points[0];
      const tail = e.points[e.points.length - 1];
      if (!(head[1] < bus && bus < tail[1])) continue; // バスが幹と垂下の間に無い形は組めない
      const cand = cleanPolyline([head, [head[0], bus], [tail[0], bus], tail]);
      if (JSON.stringify(cand) === JSON.stringify(e.points)) continue;
      const before = e.points;
      const costBefore = costOf(e);
      e.points = cand;
      if (costOf(e) > costBefore) e.points = before;
    }
  }
}

// ---------------------------------------------------------------- ひとり線の遠回りをほどく
//
// 兄弟を持たない線（子が1人・継承）も、elk のスペーサ経由で「右へ大回りしてから
// 戻る」廊下になることがある（司馬懿×柏夫人→司馬倫が x1513 まで出て 382px 戻る・
// 恵帝→司馬倫が左へ 80px 出てから戻る）。既に通っている横の廊下それぞれを候補に、
// **「幹→廊下→垂下」の3折れに組み直して悪さが増えないなら採る**。兄弟のいる線は
// 上の櫛の組み直しが持ち場（ここで1本ずつ触るとバスが割れる）。
{
  const familyFrom = new Map();
  for (const e of lines) {
    if (e.kind === "succession" || e.kind === "marriage" || e.kind === "disputed") continue;
    familyFrom.set(e.from, (familyFrom.get(e.from) ?? 0) + 1);
  }
  for (const e of lines) {
    if (e.kind === "marriage" || e.kind === "disputed" || e.mirrorOf) continue;
    if (e.kind !== "succession" && (familyFrom.get(e.from) ?? 0) > 1) continue;
    const p = e.points;
    if (p.length <= 4) continue;
    const head = p[0];
    const tail = p[p.length - 1];
    if (!(tail[1] > head[1])) continue;
    const busYs = [...new Set(p.slice(1).filter((q, i) => p[i][1] === q[1]).map((q) => q[1]))];
    let best = null;
    let bestCost = costOf(e);
    const before = e.points;
    for (const bus of busYs) {
      if (!(head[1] < bus && bus < tail[1])) continue;
      const cand = cleanPolyline([head, [head[0], bus], [tail[0], bus], tail]);
      e.points = cand;
      const c = costOf(e);
      if (c < bestCost || (c === bestCost && cand.length < before.length)) {
        bestCost = c;
        best = cand;
      }
      e.points = before;
    }
    if (best) e.points = best;
  }
}

// ---------------------------------------------------------------- 兄弟の幹を束ねる
//
// 同じ親から出た線は elk 上では別々のスペーサ鎖なので、段をまたぐ幹が数 px ずれて
// 並走し「二重線」に見える（2026-08-19 ユーザー指摘。武帝→劉髆と武帝→劉拠が
// 7px ずれで 414px 並走していた）。**同じ親の縦の区間が近くを並走していたら同じ x に
// 束ねる** — 同じ親の線の重なりは T 字の幹として意図どおりで、監査も sameBus として
// 除外している。束ねた先がカードに寄るなら諦める。
{
  const vRuns = (e) => {
    const out = [];
    for (let i = 1; i < e.points.length; i += 1) {
      if (e.points[i - 1][0] !== e.points[i][0]) continue;
      if (Math.abs(e.points[i][1] - e.points[i - 1][1]) < 20) continue;
      out.push(i - 1);
    }
    return out;
  };
  const clearV = (e, x, y0, y1) => {
    for (const bx of boxes.values()) {
      if (!cards.has(bx.id)) continue;
      if (bx.id === e.from || bx.id === e.to) continue;
      if (sameBlock(e.from, bx.id) || sameBlock(e.to, bx.id)) continue;
      if (gap([x, Math.min(y0, y1), x, Math.max(y0, y1)], bx) <= 4) return false;
    }
    return true;
  };
  const byParent = new Map();
  for (const e of lines) {
    if (e.kind === "succession") continue;
    pushTo(byParent, e.from, e);
  }
  for (const es of byParent.values()) {
    if (es.length < 2) continue;
    for (let pass = 0; pass < 4; pass += 1) {
      let moved = false;
      for (const ea of es)
        for (const eb of es) {
          if (ea === eb) continue;
          for (const i of vRuns(ea))
            for (const j of vRuns(eb)) {
              const xa = ea.points[i][0];
              const xb = eb.points[j][0];
              const d = Math.abs(xa - xb);
              if (d === 0 || d > 12) continue;
              const ya = [ea.points[i][1], ea.points[i + 1][1]].sort((p, q) => p - q);
              const yb = [eb.points[j][1], eb.points[j + 1][1]].sort((p, q) => p - q);
              if (Math.min(ya[1], yb[1]) - Math.max(ya[0], yb[0]) < 40) continue;
              const next = eb.points.map((q) => [...q]);
              next[j][0] = xa;
              next[j + 1][0] = xa;
              const okHead = j > 0 || endWindow(eb.from, next[0][0], next[0][1]);
              const okTail =
                j + 1 < next.length - 1 ||
                endWindow(eb.to, next[next.length - 1][0], next[next.length - 1][1]);
              if (!okHead || !okTail) continue;
              if (!clearV(eb, xa, yb[0], yb[1])) continue;
              eb.points = cleanPolyline(next);
              moved = true;
            }
        }
      if (!moved) break;
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

// ---------------------------------------------------------------- 端の横入りを直す
//
// 家族・継承の線はカードへ**必ず縦で**出入りする。elk と後処理の組み合わせが稀に
// 「カードの縁と同じ高さを横に走って端へ届く」形を残し（文帝→劉武 —
// [[790,876],[790,1088],[716,1088]] が劉武の上辺 y=1088 を横に走る）、監査は自分の
// from/to カードとの距離を除外しているので素通りしていた（2026-08-19 ユーザー指摘
// 「線と箱が重ならないように」）。横向きの端の区間を、カードの CLEAR(12px) 手前の
// 廊下＋垂直の出入りへ曲げ直す。折れは1つ増えるが、縁を走るよりよい。
{
  const skip = new Set(["marriage", "disputed", "second"]);
  for (const e of lines) {
    if (skip.has(e.kind) || e.mirrorOf) continue;
    for (let guard = 0; guard < 2; guard += 1) {
      const pts = e.points;
      if (pts.length < 2) break;
      let cand = null;
      const last = pts[pts.length - 1];
      const prev = pts[pts.length - 2];
      if (prev[1] === last[1]) {
        // 端が横向き（入り）。カードのどちらの縁かで廊下を上下に振る
        const b = boxes.get(e.to);
        const yC = Math.abs(last[1] - b.y) <= Math.abs(last[1] - (b.y + b.h)) ? last[1] - CLEAR : last[1] + CLEAR;
        cand = [...pts.slice(0, -2), [prev[0], yC], [last[0], yC], last];
      } else {
        const first = pts[0];
        const second = pts[1];
        if (first[1] === second[1]) {
          const b = boxes.get(e.from);
          const yC = Math.abs(first[1] - b.y) <= Math.abs(first[1] - (b.y + b.h)) ? first[1] - CLEAR : first[1] + CLEAR;
          cand = [first, [first[0], yC], [second[0], yC], ...pts.slice(2)];
        }
      }
      if (!cand) break;
      const before = e.points;
      const beforeCost = costOf(e);
      e.points = cleanPolyline(cand);
      if (costOf(e) > beforeCost) {
        if (process.env.KINSHIP_DEBUG)
          console.log(`    [横入り直し却下] ${e.from}→${e.to} cost ${beforeCost}→${costOf(e)}`);
        e.points = before;
        break;
      } else if (process.env.KINSHIP_DEBUG) {
        console.log(`    [横入り直し] ${e.from}→${e.to}`);
      }
    }
  }
}

// ---------------------------------------------------------------- 単独カードの中心合わせ
//
// 親の下ろし点と子カードの中心が数十 px ずれているとき、線の端をカードの縁に
// 沿ってずらすと直線にはなるが「カードの端から線が出る」形になり、それが不格好
// （2026-08-19 ユーザー指摘「線の出ている場所がきもい」— 始皇帝の底の左端から
// 二世皇帝へ降りていた）。**線ではなくカードのほうを平行移動して、線がカードの
// 中心から中心へ落ちる形にする。** 動かすのは1人だけのブロックで、上から入る
// 家族の線が1本のカードだけ（夫婦ブロックを動かすと横棒と下ろし点が連鎖する）。
// 動かした先で隣と 24px を切る・触っている線の悪さ（costOf）が増えるなら諦める。
{
  const FAMILY_IN = new Set(["father", "mother", "child", "adoptive", "remote"]);
  const cxOf = (b) => b.x + b.w / 2;
  for (const c of cards.values()) {
    const blk = blockOf.get(c.id);
    if (!blk || blk.members.length !== 1) continue;
    const box = boxes.get(c.id);
    const incoming = lines.filter((e) => e.to === c.id && FAMILY_IN.has(e.kind));
    if (incoming.length !== 1) continue;
    const e0 = incoming[0];
    const dx = Math.round(e0.points[0][0] - cxOf(box));
    if (dx === 0 || Math.abs(dx) > 56) continue;
    // 移動後の水平クリアランス（y が重なる相手と 24px）
    const nx = box.x + dx;
    let clear = true;
    for (const b of boxes.values()) {
      if (b.id === box.id || sameBlock(box.id, b.id)) continue;
      if (b.y < box.y + box.h && box.y < b.y + b.h) {
        const gapX = Math.max(b.x - (nx + box.w), nx - (b.x + b.w));
        if (gapX < 24) {
          clear = false;
          break;
        }
      }
    }
    if (!clear) continue;
    const touched = lines.filter((e) => e.from === c.id || e.to === c.id);
    // 鏡写しの対（簒奪⇄復位）に関わるカードは動かさない — 下向き側の形を変えると
    // 最後の作り直し（mirrorRoute）が対を平行に保てず、重なり・浮いた端になった
    // （司馬倫 +19px の実測）。
    const mirrorKeys = new Set(lines.filter((e) => e.mirrorOf).map((e) => e.mirrorOf));
    if (touched.some((e) => e.mirrorOf || mirrorKeys.has(`${e.from}>${e.to}`))) continue;
    // **採否は最終監査と同じ物差しで見る**（costOf の合計だけだと、+1 の重なりが
    // -2 の交差改善に相殺されて must-zero の欠陥が紛れ込む — 実際に紛れ込んだ）。
    const worstGapToCards = (e) => {
      let w = Infinity;
      for (const b of boxes.values()) {
        if (!cards.has(b.id)) continue;
        if (b.id === e.from || b.id === e.to) continue;
        if (sameBlock(e.from, b.id) || sameBlock(e.to, b.id)) continue;
        for (const sg of segsOf(e)) w = Math.min(w, gap(sg, b));
      }
      return w;
    };
    const endsAttached = (e) => {
      const chk = (pt, id) => {
        const b = boxes.get(id);
        return b && gap([pt[0], pt[1], pt[0], pt[1]], b) <= 1;
      };
      return chk(e.points[0], e.from) && chk(e.points[e.points.length - 1], e.to);
    };
    const overlapsOf = (e) => {
      let n = 0;
      for (const o of lines) {
        if (o === e || o.from === e.from || o.to === e.to) continue;
        for (const sg of segsOf(e)) for (const t of segsOf(o)) if (overlapLen(sg, t) > 2) n += 1;
      }
      return n;
    };
    const crossingsOf = (e) => {
      let n = 0;
      for (const o of lines) {
        if (o === e) continue;
        for (const sg of segsOf(e)) for (const t of segsOf(o)) if (crossAt(sg, t)) n += 1;
      }
      return n;
    };
    const nearMovedBox = () => {
      let n = 0;
      const touchedSet = new Set(touched);
      for (const o of lines) {
        if (touchedSet.has(o)) continue;
        if (sameBlock(o.from, c.id) || sameBlock(o.to, c.id)) continue;
        let w = Infinity;
        for (const sg of segsOf(o)) w = Math.min(w, gap(sg, box));
        if (w < CLEAR) n += 1;
      }
      return n;
    };
    const beforePts = new Map(touched.map((e) => [e, e.points]));
    const beforeCost = touched.reduce((v, e) => v + costOf(e), 0);
    const beforeGaps = new Map(touched.map((e) => [e, worstGapToCards(e)]));
    const beforeOverlaps = touched.reduce((v, e) => v + overlapsOf(e), 0);
    const beforeCrossings = touched.reduce((v, e) => v + crossingsOf(e), 0);
    const beforeNear = nearMovedBox();
    box.x = nx; // costOf・endWindow は boxes を見るので先に動かす
    for (const e of touched) {
      const pts = e.points.map((q) => [...q]);
      if (e === e0) {
        // 錨の線は入り口を下ろし点の真下（＝新しい中心）へ
        pts[pts.length - 1][0] = e0.points[0][0];
      } else {
        if (e.to === c.id) pts[pts.length - 1][0] += dx;
        if (e.from === c.id) pts[0][0] += dx;
      }
      e.points = absorbJogs(cleanPolyline(pts), e.from, e.to);
    }
    const afterCost = touched.reduce((v, e) => v + costOf(e), 0);
    const bad =
      afterCost > beforeCost ||
      e0.points.length > beforePts.get(e0).length ||
      touched.some((e) => !endsAttached(e)) ||
      touched.some((e) => {
        const w = worstGapToCards(e);
        return w < CLEAR && w < beforeGaps.get(e);
      }) ||
      touched.reduce((v, e) => v + overlapsOf(e), 0) > beforeOverlaps ||
      touched.reduce((v, e) => v + crossingsOf(e), 0) > beforeCrossings ||
      nearMovedBox() > beforeNear;
    if (bad) {
      box.x = nx - dx;
      for (const e of touched) e.points = beforePts.get(e);
    } else if (process.env.KINSHIP_DEBUG) {
      console.log(`    [中心合わせ] ${c.label ?? c.id} を ${dx}px`);
    }
  }
}

// ---------------------------------------------------------------- 大きめの折れの直線化
//
// absorbJogs が消すのは 10px 未満の折れだけで、始皇帝→二世皇帝のような
// 「親と子のカードが数十 px ずれているだけ」の Z 字クランクは残っていた
// （2026-08-19 ユーザー指摘「不要な折り曲げがなるべくなくなるように」）。
// 端の点はカードの縁に沿って動かせる（endWindow・子の入りはカードの真上なら
// 中央でなくてよい）ので、**56px（カード半幅）までの折れを、costOf が悪化しない
// ときだけ**同じ寄せ方で消す。兄弟のいる線は触らない（幹・バスの共有が割れて
// 「同じ親から2本の幹」に見える。単独子・継承・実母・養親の線だけが持ち場）。
{
  const BIG_JOG = 56;
  const familyFrom = new Map();
  for (const e of lines) {
    if (e.kind === "succession" || e.kind === "marriage" || e.kind === "disputed") continue;
    familyFrom.set(e.from, (familyFrom.get(e.from) ?? 0) + 1);
  }
  for (const e of lines) {
    if (e.kind === "marriage" || e.kind === "disputed" || e.mirrorOf) continue;
    if (e.kind !== "succession" && (familyFrom.get(e.from) ?? 0) > 1) continue;
    for (let guard = 0; guard < 6; guard += 1) {
      const pts = e.points;
      let applied = false;
      for (let i = 0; i + 1 < pts.length; i += 1) {
        const dx = Math.abs(pts[i + 1][0] - pts[i][0]);
        const dy = Math.abs(pts[i + 1][1] - pts[i][1]);
        const len = dx + dy;
        if (len === 0 || len > BIG_JOG) continue;
        const axis = dx > 0 ? 0 : 1;
        let a = i;
        while (a > 0 && pts[a - 1][axis] === pts[i][axis]) a -= 1;
        let b = i + 1;
        while (b + 1 < pts.length && pts[b + 1][axis] === pts[i + 1][axis]) b += 1;
        const lenOf = (sIdx, tIdx) => {
          let v = 0;
          for (let k = sIdx; k < tIdx; k += 1)
            v += Math.abs(pts[k + 1][0] - pts[k][0]) + Math.abs(pts[k + 1][1] - pts[k][1]);
          return v;
        };
        const tryMove = (sIdx, tIdx, target) => {
          const next = pts.map((q) => [...q]);
          for (let k = sIdx; k <= tIdx; k += 1) next[k][axis] = target;
          if (sIdx === 0 && !endWindow(e.from, next[0][0], next[0][1])) return null;
          if (tIdx === pts.length - 1 && !endWindow(e.to, next[next.length - 1][0], next[next.length - 1][1]))
            return null;
          // カードの端点はカードの中心から 10px までしかずらさない — それ以上は
          // 「カードの端から線が出る」不格好になる（直線化はカード側の平行移動
          // ＝上の中心合わせの持ち場。union の端は横棒の上ならどこでもよいので従来通り）
          const offCenter = (id, x) => {
            const b = boxes.get(id);
            return cards.has(id) && Math.abs(x - (b.x + b.w / 2)) > 10;
          };
          if (axis === 0 && sIdx === 0 && offCenter(e.from, target)) return null;
          if (axis === 0 && tIdx === pts.length - 1 && offCenter(e.to, target)) return null;
          const cleaned = cleanPolyline(next);
          // 縦だった端の区間を横へ変える寄せは不採用（absorbJogs と同じ理由 — 垂直の
          // 入りを潰すとカードの縁を横に走る線になる）
          const horiz = (a, b) => a && b && a[1] === b[1];
          const vert = (a, b) => a && b && a[0] === b[0];
          if (vert(pts[0], pts[1]) && horiz(cleaned[0], cleaned[1])) return null;
          if (
            vert(pts[pts.length - 2], pts[pts.length - 1]) &&
            horiz(cleaned[cleaned.length - 2], cleaned[cleaned.length - 1])
          )
            return null;
          return cleaned;
        };
        const order =
          lenOf(a, i) <= lenOf(i + 1, b)
            ? [[a, i, pts[i + 1][axis]], [i + 1, b, pts[i][axis]]]
            : [[i + 1, b, pts[i][axis]], [a, i, pts[i + 1][axis]]];
        const overlapsOf = () => {
          let n = 0;
          for (const o of lines) {
            if (o === e || o.from === e.from || o.to === e.to) continue;
            for (const sg of segsOf(e)) for (const t of segsOf(o)) if (overlapLen(sg, t) > 2) n += 1;
          }
          return n;
        };
        const before = e.points;
        const beforeCost = costOf(e);
        const beforeOverlaps = overlapsOf();
        for (const [sIdx, tIdx, target] of order) {
          const cand = tryMove(sIdx, tIdx, target);
          if (!cand || cand.length >= before.length) continue;
          e.points = cand;
          // 重なりは must-zero の欄なので、コストの相殺（交差 -2 と重なり +1 など）に
          // 紛れさせず単独で見る（明帝→順帝が禅譲の線と 18px 重なった実測）。
          if (costOf(e) <= beforeCost && overlapsOf() <= beforeOverlaps) {
            applied = true;
            break;
          }
          e.points = before;
        }
        if (applied) break;
      }
      if (!applied) break;
    }
  }
}

// 鏡写し（復位など）は、後処理で形が変わった下向き側からここで作り直す
for (const e of lines) {
  if (!e.mirrorOf) continue;
  const down = lines.find((o) => `${o.from}>${o.to}` === e.mirrorOf);
  if (!down) continue;
  e.points = mirrorRoute(down.points, e.from, e.to);
  // **往復のラベルは線の上に置けない**（2本は 12px 差で並走し、どこに置いても
  // チップどうしが重なる — 出発点寄り 30% でも重なった）。**最長区間の中点から、
  // 相手の線と反対側へ 26px 離して**左右（横の廊下なら上下）に振り分ける。
  const longestMid = (pts) => {
    let best = -1;
    let seg = null;
    for (let i = 1; i < pts.length; i += 1) {
      const len = Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
      if (len > best) {
        best = len;
        seg = [pts[i - 1], pts[i]];
      }
    }
    return {
      mid: [(seg[0][0] + seg[1][0]) / 2, (seg[0][1] + seg[1][1]) / 2],
      vertical: seg[0][0] === seg[1][0],
    };
  };
  const md = longestMid(down.points);
  const me = longestMid(e.points);
  const axis = md.vertical ? 0 : 1;
  const side = Math.sign(md.mid[axis] - me.mid[axis]) || -1; // 相手と反対側へ
  const OFF = 26;
  down.labelAt = [...md.mid];
  e.labelAt = [...me.mid];
  down.labelAt[axis] = Math.round(md.mid[axis] + side * OFF);
  e.labelAt[axis] = Math.round(me.mid[axis] - side * OFF);
}

const faults = {
  カードどうしの重なり: [],
  二重線に見える並走: [],
  カードの中を通る: [],
  カードに近すぎる: [],
  線どうしの交差: [],
  線どうしの重なり: [],
  端が浮いている: [],
  端の区間が横向き: [],
  不要な折れ: [],
};
// 家族・継承の線はカードへ縦で出入りする（横向きの端はカードの縁を走る形＝
// from/to 自身との距離検査の除外をすり抜けるので、向きそのものを数える）。
for (const e of lines) {
  if (e.kind === "marriage" || e.kind === "disputed" || e.kind === "second") continue;
  const pts = e.points;
  if (pts.length < 2) continue;
  if (pts[0][1] === pts[1][1])
    faults.端の区間が横向き.push(`${e.from}→${e.to} 出が横`);
  if (pts[pts.length - 2][1] === pts[pts.length - 1][1])
    faults.端の区間が横向き.push(`${e.from}→${e.to} 入りが横`);
}
// 別の親の縦の区間が近くを長く並走していないか（同じ親は幹の共有なので除く）。
{
  const runs = [];
  for (const e of lines)
    for (let i = 1; i < e.points.length; i += 1) {
      if (e.points[i - 1][0] !== e.points[i][0]) continue;
      if (Math.abs(e.points[i][1] - e.points[i - 1][1]) < 20) continue;
      runs.push({ e, x: e.points[i][0], y0: Math.min(e.points[i - 1][1], e.points[i][1]), y1: Math.max(e.points[i - 1][1], e.points[i][1]) });
    }
  for (let a = 0; a < runs.length; a += 1)
    for (let b = a + 1; b < runs.length; b += 1) {
      const A = runs[a];
      const B = runs[b];
      if (A.e === B.e || A.e.from === B.e.from) continue;
      const d = Math.abs(A.x - B.x);
      if (d === 0 || d > 10) continue;
      if (Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0) < 60) continue;
      faults.二重線に見える並走.push(
        `${A.e.from}→${A.e.to} と ${B.e.from}→${B.e.to} が x差${d}px`,
      );
    }
}

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
  label: e.label ?? null,
  labelAt: e.labelAt ?? null,
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
    console.log(`    ${k}: ${v.length}件 — ${v.slice(0, 8).join(" / ")}`);
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
    guests,
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
writeFileSync(path.join(destDir, `layout.${ERA_ID}.json`), JSON.stringify(out), "utf8");

console.log(
  `kinship layout[${ERA_ID}]: ${nodes.length}人（除外 ${dropped.length}: ${dropped.map((d) => d.label).join("・")}） / union ${unionNodes.length} / 追加の親子 ${extra.length} / 継承 ${succession.length} / 時代で動かした成分 ${shifted.length} / 段 ${layerYs.length} / ${width}×${height}px`,
);
}

// KINSHIP_ONLY=<eraId> で1章だけ解く（bucket の走査中に他の章の JSON を
// 別の bucket で上書きしないため。KINSHIP_BUCKET は全章に掛かる）。
const only = process.env.KINSHIP_ONLY;
for (const chapter of CHAPTERS) {
  if (only && chapter.eraId !== only) continue;
  console.log(`--- ${chapter.eraId} ---`);
  await buildChapter(chapter);
}
