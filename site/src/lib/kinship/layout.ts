/**
 * 系譜図のレイアウト（ビルド時に一度だけ解く）。
 *
 * **縦軸は実時間**（1年 = 8px の完全等間隔・箱の上辺が即位年、下辺が退位年）。
 * 2026-08-01 に「縦軸を世代の段へ変える」と決めたことがあるが、やってみて満足のいく
 * ものにならず 2026-08-17 に却下された。段のグラフ向けに測った候補比較（ELK・dagre）は
 * その前提の上に乗っていたので効力が無い。決定は GitHub Issue #174 が正。
 *
 * 解くのは**横位置だけ**なので、手でレイアウトを調整する工程は無い。
 * 線は React Flow の経路生成器（`@xyflow/system` の `getSmoothStepPath`・MIT）を
 * ビルド時に呼んで path 文字列にする。純関数なので DOM が要らず、そのまま静的 SVG へ焼ける。
 *
 * 見えている数字は全部ファイルから引く（配色は dynasty-colors.ts、時代の区切りは
 * emperors.json の meta.catalogs）。このファイルに色や政権名を書き写さないこと。
 */

import { getSmoothStepPath, Position } from "@xyflow/system";

import { dynastyColorHex, dynastyColorSlot } from "@/lib/dynasty-colors";
import { emperorDisplayName } from "@/lib/display-name";
import { emperorsJson, eraCatalog, loadKinshipJson } from "@/lib/data-source";
// **emperors.ts を import しないこと。** あちらの getOgFacts がこのファイルを呼ぶので
// 循環参照になる。表示名は display-name.ts（唯一の正）から直接引き、
// 政権キーは `regimeId` そのもの（emperors.ts の dynastyKey() も同じ値を返す）。

// ---------------------------------------------------------------- 承認済みの規範
// レビュー⑥〜⑧（2026-07-24・ユーザー承認）から。この4つは選ばずに従う。
const PX_PER_YEAR = 8;
/** 短い在位でも読める最小の高さ。**下辺だけが延びる**（上辺＝即位年は動かさない）。 */
const MIN_CAPSULE_H = 44;
/** 非皇帝（妃・親）は在位を持たないので固定高。 */
const PERSON_H = 38;
/** 親子の縦室。在位が隣接していても垂下線が見える。 */
const LINK_GAP_Y = 12;

const COL_GAP = 26;
const SPOUSE_GAP = 14;
/** 線の通り道と箱の間に空ける最小の隙間。 */
const CORRIDOR_GAP = 8;
/**
 * 通り道を避けるために遠回りしてよい上限（px）。
 * **硬い制約にしてはいけない** — 避け場所の無い人が図の右端の外まで飛び、
 * 南北朝が下限の 9.22 倍（17,775px）に破裂した。近くに空きが無ければ通り道は譲る。
 */
const CORRIDOR_YIELD = 420;
const PAD_X = 40;
const PAD_TOP = 72;
const CORNER = 8;
const TICK_EVERY = 25;

/** 章（時代区分）。(a) 五代十国までの6章 ＝ 2026-08-17 のユーザー決定。 */
const CHAPTER_IDS = [
  "qin-han",
  "three-kingdoms-jin",
  "eastern-jin-sixteen",
  "northern-southern",
  "sui-tang",
  "five-dynasties",
] as const;

export interface KinshipBox {
  key: string;
  label: string;
  /** 複数在位の皇帝で「第2期」のように添える。 */
  sub: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "emperor" | "person";
  /** 皇帝だけ。個別ページへの素の `<a>` を出すため（クローラの導線）。 */
  href: string | null;
  fill: string;
  stroke: string;
  /** 政権の印（3px の帯）。非皇帝は null。 */
  mark: string | null;
  /** 生没年が原典に無く、最初の子から推定した人物。 */
  inferred: boolean;
}

export interface KinshipEdge {
  d: string;
  /** 養子縁組による親子（破線で描く）。 */
  adoptive: boolean;
}

export interface KinshipChapter {
  id: string;
  label: string;
  width: number;
  height: number;
  ticks: { y: number; label: string }[];
  boxes: KinshipBox[];
  /** 親子の線（垂下 → 兄弟バー → 各子）。 */
  links: KinshipEdge[];
  /** 夫婦の連結線。 */
  ties: { x1: number; x2: number; y: number }[];
  emperorCount: number;
  personCount: number;
  inferredCount: number;
}

// ---------------------------------------------------------------- 内部の型
interface Box {
  id: string;
  key: string;
  label: string;
  sub: string;
  /** 年（px ではない）。上辺と下辺。 */
  y0: number;
  y1: number;
  w: number;
  kind: "emperor" | "person";
  dynastyKey: string | null;
  /** 解いた横位置（左端・px）。 */
  X0: number | null;
  /** 夫婦連結線の始点（外側の妃では内側の妃の外縁）。 */
  tieX: number | null;
  /** unit の中での妃の相対位置。 */
  spouseDx: number | null;
  tieDx: number | null;
}

interface Union {
  key: string;
  parents: string[];
  kids: string[];
}

interface UnitRect {
  dx0: number;
  dx1: number;
  y0: number;
  y1: number;
  box: Box;
}

interface Unit {
  id: string;
  own: Box[];
  spouses: Box[];
  rects: UnitRect[];
  w: number;
  /** 線が着くのは本人の箱の中心で、妃を含めた unit の中心ではない。 */
  headW: number;
}

interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  u?: string;
  own?: Set<string>;
}

const yearOf = (v: unknown): number | null => {
  if (v == null) return null;
  const s = String(v);
  const neg = s.startsWith("-");
  const head = (neg ? s.slice(1) : s).split("-")[0];
  if (!/^\d+$/.test(head)) return null;
  return neg ? -Number(head) : Number(head);
};

/** 半角は 8px・それ以外は 15px で見積もる（実測フォントに依らない近似）。 */
const charW = (s: string) =>
  [...s].reduce((a, c) => a + (/[\u0000-\u007F]/.test(c) ? 8 : 15), 0);

let cache: KinshipChapter[] | null = null;

export function getKinshipChapters(): KinshipChapter[] {
  if (cache) return cache;
  const kin = loadKinshipJson();
  const eraLabelById = new Map(eraCatalog.map((e) => [e.id, e.label]));

  cache = CHAPTER_IDS.map((eraId) => {
    const label = eraLabelById.get(eraId);
    if (!label) {
      throw new Error(
        `kinship/layout: meta.catalogs.eras に無い章 id です: ${eraId}`,
      );
    }
    return solveChapter(eraId, label, kin);
  });
  return cache;
}

type KinshipData = ReturnType<typeof loadKinshipJson>;

function solveChapter(eraId: string, eraLabel: string, kin: KinshipData): KinshipChapter {
  // ---------------------------------------------------------------- 箱を作る
  const boxes = new Map<string, Box>();
  const mkBox = (b: Partial<Box> & { id: string; key: string; label: string }): Box => ({
    sub: "",
    y0: 0,
    y1: 0,
    w: 0,
    kind: "person",
    dynastyKey: null,
    X0: null,
    tieX: null,
    spouseDx: null,
    tieDx: null,
    ...b,
  }) as Box;

  // data-source の解決済みレコードはラベルの型が広く、reigns まで型が届かないので
  // このファイルが使う欄だけを名指しで受け取る（`as unknown as` の範囲を最小にする）。
  interface KinshipEmperor {
    id: string;
    eraId: string;
    regimeId: string;
    name: { commonName: string | null };
    reigns?: { startYear: number; endYear: number; startDate?: string | null; endDate?: string | null }[];
  }
  for (const e of emperorsJson.emperors as unknown as KinshipEmperor[]) {
    if (e.eraId !== eraId) continue;
    const reigns = e.reigns ?? [];
    reigns.forEach((r, i) => {
      const s = yearOf(r.startDate) ?? r.startYear;
      if (s == null) return;
      const t = yearOf(r.endDate) ?? r.endYear ?? s;
      // 短い在位でも読めるように**下辺だけ**を延ばす（上辺＝即位年は動かさない）。
      const y1 = t - s < MIN_CAPSULE_H / PX_PER_YEAR ? s + MIN_CAPSULE_H / PX_PER_YEAR : t;
      const key = reigns.length > 1 ? `${e.id}#${i}` : e.id;
      boxes.set(
        key,
        mkBox({
          id: e.id,
          key,
          label: emperorDisplayName(e.id, e.name.commonName ?? "", e.regimeId),
          sub: reigns.length > 1 ? `第${i + 1}期` : "",
          y0: s,
          y1,
          kind: "emperor",
          dynastyKey: e.regimeId,
        }),
      );
    });
  }

  for (const p of kin.persons as unknown as {
    id: string;
    eraId?: string;
    name?: string;
    birthYear?: number | null;
    deathYear?: number | null;
  }[]) {
    if (p.eraId !== eraId) continue;
    if (boxes.has(p.id)) continue; // 皇帝は上で入っている
    const mid =
      p.birthYear != null && p.deathYear != null
        ? (p.birthYear + p.deathYear) / 2
        : (p.birthYear ?? p.deathYear ?? null);
    boxes.set(
      p.id,
      mkBox({
        id: p.id,
        key: p.id,
        label: p.name ?? p.id,
        y0: mid == null ? Number.NaN : mid - PERSON_H / PX_PER_YEAR / 2,
        y1: mid == null ? Number.NaN : mid + PERSON_H / PX_PER_YEAR / 2,
      }),
    );
  }

  /** 人物 id → 主在位（複数在位の1つ目）の箱 key。 */
  const primaryKey = new Map<string, string>();
  for (const b of boxes.values()) if (!primaryKey.has(b.id)) primaryKey.set(b.id, b.key);
  const boxOf = (id: string) => {
    const k = primaryKey.get(id);
    return k ? boxes.get(k) ?? null : null;
  };

  // ---------------------------------------------------------------- 親子（union）
  // 続柄は data-source が日本語ラベルへ解決済み（ID で分岐しないこと）。
  const FATHER = new Set(["実父", "養父"]);
  const MOTHER = new Set(["実母", "養母"]);
  const parentsOf = new Map<
    string,
    { father: string | null; mother: string | null; fatherIsBirth: boolean; motherIsBirth: boolean; adoptive: boolean }
  >();
  for (const e of kin.edges as unknown as { type: string; from: string; to: string; relation?: string }[]) {
    if (e.type !== "kinship" || !e.relation) continue;
    const isFather = FATHER.has(e.relation);
    if (!isFather && !MOTHER.has(e.relation)) continue;
    if (!boxOf(e.to) || !boxOf(e.from)) continue;
    const cur =
      parentsOf.get(e.to) ??
      { father: null, mother: null, fatherIsBirth: false, motherIsBirth: false, adoptive: false };
    const isBirth = e.relation === "実父" || e.relation === "実母";
    // 実親を養親・異説より優先する。素直に上書きすると実親が図から消える。
    if (isFather) {
      if (cur.father == null || (isBirth && !cur.fatherIsBirth)) {
        cur.father = e.from;
        cur.fatherIsBirth = isBirth;
        if (!isBirth) cur.adoptive = true;
      }
    } else if (cur.mother == null || (isBirth && !cur.motherIsBirth)) {
      cur.mother = e.from;
      cur.motherIsBirth = isBirth;
      if (!isBirth) cur.adoptive = true;
    }
    parentsOf.set(e.to, cur);
  }

  const unions = new Map<string, Union>();
  for (const [child, pp] of parentsOf) {
    const parents = [pp.father, pp.mother].filter((v): v is string => Boolean(v));
    if (!parents.length) continue;
    const key = [...parents].sort().join("+");
    if (!unions.has(key)) unions.set(key, { key, parents, kids: [] });
    unions.get(key)!.kids.push(child);
  }

  const birthOf = (id: string) => boxOf(id)?.y0 ?? Number.POSITIVE_INFINITY;
  for (const u of unions.values()) u.kids.sort((a, b) => birthOf(a) - birthOf(b));

  const unionsOfParent = new Map<string, Union[]>();
  for (const u of unions.values()) {
    const head = u.parents[0];
    if (!unionsOfParent.has(head)) unionsOfParent.set(head, []);
    unionsOfParent.get(head)!.push(u);
  }
  /** 連れ添いは親の脇に置く（独立したノードにしない）。 */
  const spouseOf = new Map<string, string>();
  for (const u of unions.values()) {
    if (u.parents.length === 2) spouseOf.set(u.parents[1], u.parents[0]);
  }
  const headOf = (id: string) => spouseOf.get(id) ?? id;

  const parentUnionOf = new Map<string, Union>();
  for (const u of unions.values()) for (const k of u.kids) parentUnionOf.set(k, u);

  // ---------------------------------------------------------------- 幅
  for (const b of boxes.values()) b.w = Math.max(96, Math.min(220, charW(b.label) + 28));

  // ---------------------------------------------------------------- 生没年が無い人物
  // 旧実装は圧縮した最上部の帯に押し込んでいた。ここでは「最初の子の少し前」に推定して
  // 図を切らずに出し、**推定であることを見た目で示す**（薄く描く）。
  const inferred = new Set<string>();
  for (let changed = true; changed; ) {
    changed = false;
    for (const u of unions.values()) {
      for (const p of u.parents) {
        const b = boxOf(p);
        if (!b || Number.isFinite(b.y0)) continue;
        const kidYs = u.kids.map((k) => boxOf(k)?.y0).filter((v): v is number => v != null && Number.isFinite(v));
        if (!kidYs.length) continue;
        const y = Math.min(...kidYs) - 22;
        b.y0 = y - PERSON_H / PX_PER_YEAR / 2;
        b.y1 = y + PERSON_H / PX_PER_YEAR / 2;
        inferred.add(b.key);
        changed = true;
      }
    }
  }
  // 手がかりが無い人は出さない（図の外に飛ぶより、載せないほうが誠実）。
  for (const [k, b] of [...boxes]) if (!Number.isFinite(b.y0)) boxes.delete(k);

  // ---------------------------------------------------------------- unit を組む
  // unit ＝ 1人ぶんのまとまり（複数在位のカプセル ＋ 脇に付く妃）。x はこの単位で決める。
  const units = new Map<string, Unit>();
  const spouseAnchor = new Map<string, number>();
  for (const b of boxes.values()) {
    if (spouseOf.has(b.id)) continue;
    const head = headOf(b.id);
    if (!units.has(head)) {
      units.set(head, { id: head, own: [], spouses: [], rects: [], w: 0, headW: 0 });
    }
    if (b.id === head) units.get(head)!.own.push(b);
  }
  for (const u of unions.values()) {
    if (u.parents.length < 2) continue;
    // 同じ人が2つの union で「妃」に立つことがある（南漢の劉氏など）。両方の unit へ
    // 付けると予約した場所と実際に描く場所が食い違い、**箱が重なる**。
    // spouseOf が持つ1人だけを正とする（もう一方の線は夫の箱の右端から引く）。
    if (spouseOf.get(u.parents[1]) !== u.parents[0]) continue;
    const unit = units.get(headOf(u.parents[0]));
    const s = boxOf(u.parents[1]);
    if (!unit || !s || unit.spouses.includes(s)) continue;
    unit.spouses.push(s);
  }
  for (const u of units.values()) {
    if (!u.own.length) continue;
    u.headW = Math.max(...u.own.map((b) => b.w));
    const anchor = u.own.reduce((a, b) => (a && a.y0 <= b.y0 ? a : b));
    u.rects = u.own.map((b) => ({ dx0: 0, dx1: b.w, y0: b.y0, y1: b.y1, box: b }));
    let off = u.headW;
    for (const s of u.spouses) {
      // 妃が複数いる夫では、外側の妃への連結線は**内側の妃の外縁**が始点になる
      // （夫の右端から引くと、線が内側の妃のピルを突き抜ける）。
      s.tieDx = off;
      off += SPOUSE_GAP;
      // 妃は夫のカプセルの上部に整列する（子は必ず夫の下端より後に来る）。
      s.spouseDx = off;
      spouseAnchor.set(s.key, anchor.y0);
      u.rects.push({
        dx0: off,
        dx1: off + s.w,
        y0: anchor.y0,
        y1: anchor.y0 + PERSON_H / PX_PER_YEAR,
        box: s,
      });
      off += s.w;
    }
    u.w = off;
  }
  for (const [k, u] of [...units]) if (!u.own.length) units.delete(k);

  // 妃は「生没の中点」ではなく夫のカプセルの上部に描かれるので、線と通り道の計算では
  // **描かれる位置**を使う（生の y を使うと線と箱がずれる）。
  const topYear = (b: Box) => spouseAnchor.get(b.key) ?? b.y0;
  const botYear = (b: Box) =>
    spouseAnchor.has(b.key) ? spouseAnchor.get(b.key)! + PERSON_H / PX_PER_YEAR : b.y1;

  // ---------------------------------------------------------------- 横位置ソルバ
  //
  // 衝突判定の縦の余白は **0**。父の退位年＝子の即位年という直系継承を「時間が
  // 重なっている」と読むと、王朝が縦の柱ではなく横の鎖になり、幅が代数にそのまま比例する
  // （垂下線の余裕は描画側の話で、置き方の制約ではない）。
  const hits = (a: Rect, b: Rect, gap = COL_GAP) =>
    a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 && b.y0 < a.y1;

  const placedRects: Rect[] = [];
  let corridorRects: Rect[] = [];
  const ux = new Map<string, number>();

  const absRects = (u: Unit, X: number): Rect[] =>
    u.rects.map((r) => ({ x0: X + r.dx0, x1: X + r.dx1, y0: r.y0, y1: r.y1, u: u.id }));

  const boxClear = (u: Unit, X: number) =>
    !absRects(u, X).some((r) => placedRects.some((p) => p.u !== u.id && hits(r, p)));
  /** 線の通り道は「当事者以外」だけを弾く（自分の親子線は自分を通ってよい）。 */
  const corridorClear = (u: Unit, X: number) =>
    !absRects(u, X).some((r) =>
      corridorRects.some((c) => !c.own!.has(u.id) && hits(r, c, CORRIDOR_GAP)),
    );

  /** 望む x のいちばん近くにある空きへ置く。 */
  function bestX(u: Unit, desired: number): number {
    const cands = new Set<number>([Math.max(0, desired)]);
    for (const p of [...placedRects, ...corridorRects]) {
      const gap = p.own ? CORRIDOR_GAP : COL_GAP;
      for (const r of u.rects) {
        cands.add(p.x1 + gap - r.dx0);
        cands.add(p.x0 - gap - r.dx1);
      }
    }
    let strict: { X: number; d: number } | null = null;
    let loose: { X: number; d: number } | null = null;
    for (const c of cands) {
      const X = Math.max(0, Math.round(c));
      if (!boxClear(u, X)) continue;
      const d = Math.abs(X - desired);
      if (loose === null || d < loose.d) loose = { X, d };
      if (corridorClear(u, X) && (strict === null || d < strict.d)) strict = { X, d };
    }
    if (strict && (!loose || strict.d <= loose.d + CORRIDOR_YIELD)) return strict.X;
    if (loose) return loose.X;
    return Math.max(0, ...placedRects.map((p) => p.x1 + COL_GAP));
  }

  /** その union の垂下点（＝夫婦連結線の実区間の中点）。**線の始点**。 */
  function junctionOf(un: Union): number | null {
    const bs = un.parents.map(boxOf).filter((b): b is Box => Boolean(b) && b!.X0 != null);
    if (!bs.length) return null;
    if (bs.length === 2 && bs[1].tieX != null) return (bs[1].tieX + bs[1].X0!) / 2;
    if (bs.length === 2) return (bs[0].X0! + bs[0].w + bs[1].X0!) / 2;
    return bs[0].X0! + bs[0].w / 2;
  }

  /**
   * 子を置くときに寄せる先。**線の始点（垂下点）とは別物**。
   *
   * 垂下点は夫の箱の右端より右にあるので、そこへ子を寄せると世代ごとに
   * 「夫の幅の半分＋隙間」だけ右へずれ、王朝が縦の柱ではなく**斜めの階段**になる。
   * 唐27人が図の幅の85%に散っていた原因がこれ。置く先は**本人の箱の中心**にして、
   * 垂下点から兄弟バーまでの横のずれは線側で吸収する。
   */
  function anchorOf(un: Union): number | null {
    const b = boxOf(un.parents[0]);
    if (!b || b.X0 == null) return junctionOf(un);
    return b.X0 + (units.get(headOf(un.parents[0]))?.headW ?? b.w) / 2;
  }

  /** 兄弟バーの高さ（年）。全ての子で共有するので getSmoothStepPath には centerY で渡す。 */
  function barYearOf(un: Union): number | null {
    const bs = un.parents.map(boxOf).filter((b): b is Box => Boolean(b));
    if (!bs.length) return null;
    return Math.max(...bs.map(botYear)) + LINK_GAP_Y / PX_PER_YEAR;
  }

  /**
   * その union の線が通る場所を矩形にする（＝箱を置いてはいけない場所）。
   * これが無いと、箱を詰めた分だけ線が箱を横切る。
   */
  function corridorsOf(un: Union): Rect[] {
    const ps = un.parents.map(boxOf).filter((b): b is Box => Boolean(b) && b!.X0 != null);
    const kids = un.kids.map(boxOf).filter((b): b is Box => Boolean(b) && b!.X0 != null);
    if (!ps.length || !kids.length) return [];
    const jx = junctionOf(un);
    const barY = barYearOf(un);
    if (jx == null || barY == null) return [];
    const jy = Math.max(...ps.map(botYear));
    const own = new Set([...un.parents, ...un.kids].map(headOf));
    const xs = [jx, ...kids.map((k) => k.X0! + k.w / 2)];
    const out: Rect[] = [
      { x0: Math.min(...xs) - 2, x1: Math.max(...xs) + 2, y0: barY - 0.5, y1: barY + 0.5, own },
      { x0: jx - 2, x1: jx + 2, y0: jy, y1: barY, own },
    ];
    for (const k of kids) {
      if (topYear(k) <= barY) continue; // 親より上に置かれた子は垂下できない
      out.push({ x0: k.X0! + k.w / 2 - 2, x1: k.X0! + k.w / 2 + 2, y0: barY, y1: topYear(k), own });
    }
    return out.filter((r) => r.y1 > r.y0);
  }
  const rebuildCorridors = () => {
    corridorRects = [...unions.values()].flatMap(corridorsOf);
  };

  const setX = (u: Unit, X: number) => {
    ux.set(u.id, X);
    for (const r of u.rects) r.box.X0 = X + r.dx0;
    for (const s of u.spouses) s.tieX = X + (s.tieDx ?? 0);
  };

  // ---------------------------------------------------------------- 政権の帯
  // 同時代の政権が x 方向に噛み合うと、線は必ず他家の箱を通る。
  // 帯の幅を決め打ちすると時代の重ならない政権にも場所を取ってしまうので、
  // 起点は「その政権の在位年に重なる、すでに置いた箱の右端」からその場で引く。
  const regimeSpan = new Map<string, { y0: number; y1: number }>();
  for (const b of boxes.values()) {
    if (!b.dynastyKey) continue;
    const s = regimeSpan.get(b.dynastyKey) ?? { y0: Infinity, y1: -Infinity };
    s.y0 = Math.min(s.y0, b.y0);
    s.y1 = Math.max(s.y1, b.y1);
    regimeSpan.set(b.dynastyKey, s);
  }
  const regimeIdOf = (id: string): string | null => {
    const b = boxOf(id);
    if (b?.dynastyKey) return b.dynastyKey;
    const h = headOf(id);
    if (h !== id) return boxOf(h)?.dynastyKey ?? null;
    for (const un of unionsOfParent.get(id) ?? []) {
      for (const k of un.kids) {
        const r = boxOf(k)?.dynastyKey;
        if (r) return r;
      }
    }
    return null;
  };
  const bandBase = new Map<string, number>();
  function bandBaseOf(rid: string | null): number {
    if (rid == null) return 0;
    const hit = bandBase.get(rid);
    if (hit != null) return hit;
    const s = regimeSpan.get(rid);
    let x = 0;
    if (s) for (const p of placedRects) if (p.y0 < s.y1 && s.y0 < p.y1) x = Math.max(x, p.x1 + COL_GAP);
    bandBase.set(rid, x);
    return x;
  }

  /** 望む x。親がいれば兄弟の並びの中の自分の枠、根なら自分の政権の帯の起点。 */
  function desiredOf(u: Unit): number {
    const pu = parentUnionOf.get(u.id);
    if (!pu) return bandBaseOf(regimeIdOf(u.id));
    const j = anchorOf(pu);
    if (j == null) return 0;
    const i = pu.kids.indexOf(u.id);
    return j + (i - (pu.kids.length - 1) / 2) * (u.w + COL_GAP) - u.headW / 2;
  }

  // 置く順序: 親が先（トポロジカル）・同順位は年代順。
  const order: Unit[] = [];
  {
    const seen = new Set<string>();
    const visit = (id: string) => {
      const h = headOf(id);
      if (seen.has(h) || !units.has(h)) return;
      const pu = parentUnionOf.get(h);
      if (pu) for (const p of pu.parents) if (!seen.has(headOf(p))) visit(p);
      if (seen.has(h)) return;
      seen.add(h);
      order.push(units.get(h)!);
    };
    for (const id of [...units.keys()].sort((a, b) => birthOf(a) - birthOf(b))) visit(id);
  }

  for (const u of order) {
    const X = bestX(u, Math.round(desiredOf(u)));
    setX(u, X);
    placedRects.push(...absRects(u, X));
    rebuildCorridors(); // 置いた瞬間に、その人へ下りる線の通り道を予約する
  }

  // 仕上げ: 線が短くなる向きへ、空きがあるぶんだけ動かす（重なりは増えない）。
  function idealOf(u: Unit): number | null {
    const targets: number[] = [];
    const pu = parentUnionOf.get(u.id);
    if (pu) {
      const j = anchorOf(pu);
      if (j != null) targets.push(j);
    }
    for (const cu of unionsOfParent.get(u.id) ?? []) {
      const cs = cu.kids.map(boxOf).filter((b): b is Box => Boolean(b) && b!.X0 != null);
      if (cs.length) targets.push(cs.reduce((a, c) => a + c.X0! + c.w / 2, 0) / cs.length);
    }
    if (!targets.length) return null;
    return Math.round(targets.reduce((a, b) => a + b, 0) / targets.length - u.headW / 2);
  }

  for (let pass = 0; pass < 6; pass++) {
    const seq = pass % 2 ? [...order].reverse() : order;
    for (const u of seq) {
      const cur = ux.get(u.id)!;
      // 通り道は「後から置いた線」の側にしか効かない。ここで自分の現在地が通り道を
      // 塞いでいないかを見て、塞いでいたら必ず動かす（箱だけを見ていると一度も動かない）。
      const blocking = !boxClear(u, cur) || !corridorClear(u, cur);
      const want = idealOf(u);
      if (want == null && !blocking) continue;
      if (want === cur && !blocking) continue;
      for (let i = placedRects.length - 1; i >= 0; i--) {
        if (placedRects[i].u === u.id) placedRects.splice(i, 1);
      }
      const X = bestX(u, Math.max(0, want ?? cur));
      setX(u, X);
      placedRects.push(...absRects(u, X));
      rebuildCorridors();
    }
  }

  // ---------------------------------------------------------------- px 座標へ
  const minX = Math.min(...[...boxes.values()].map((b) => b.X0 ?? 0));
  for (const b of boxes.values()) if (b.X0 != null) b.X0 -= minX;

  const years = [...boxes.values()].flatMap((b) => [b.y0, b.y1]);
  const Y0 = Math.floor(Math.min(...years) / TICK_EVERY) * TICK_EVERY;
  const toY = (y: number) => PAD_TOP + (y - Y0) * PX_PER_YEAR;

  const laid = [...boxes.values()].map((b) => {
    const isSpouse = spouseAnchor.has(b.key);
    const X = PAD_X + (b.X0 ?? 0);
    const Y = toY(isSpouse ? spouseAnchor.get(b.key)! : b.y0);
    const H = isSpouse
      ? PERSON_H
      : Math.max(b.kind === "emperor" ? MIN_CAPSULE_H : PERSON_H, (b.y1 - b.y0) * PX_PER_YEAR);
    return { b, X, Y, H };
  });
  const pos = new Map(laid.map((l) => [l.b.key, l]));

  const width = Math.ceil(Math.max(...laid.map((l) => l.X + l.b.w)) + PAD_X);
  const height = Math.ceil(Math.max(...laid.map((l) => l.Y + l.H)) + 48);

  // ---------------------------------------------------------------- 線
  // 承認済みの文法: 夫婦連結線（＝）→ その上の1点から垂下 → 兄弟バー → 各子へ。
  // getSmoothStepPath は「1点 → 1点」を（下る・角丸・横へ・角丸・下る）で結ぶので、
  // 同じ始点と同じ centerY を全ての子に渡すと、横に走る区間がそろって兄弟バーになる。
  const links: KinshipEdge[] = [];
  const ties: { x1: number; x2: number; y: number }[] = [];
  for (const u of unions.values()) {
    const ps = u.parents.map(boxOf).filter((b): b is Box => Boolean(b));
    if (!ps.length) continue;
    const head = pos.get(ps[0].key);
    if (!head) continue;
    const second = ps.length === 2 ? pos.get(ps[1].key) : null;
    const from = ps[1]?.tieX != null ? PAD_X + ps[1].tieX! : head.X + head.b.w;
    const junctionX = second ? (from + second.X) / 2 : head.X + head.b.w / 2;
    const junctionY = Math.max(...ps.map((p) => (pos.get(p.key)?.Y ?? 0) + (pos.get(p.key)?.H ?? 0)));
    const barYear = barYearOf(u);
    if (barYear == null) continue;
    const barY = toY(barYear);

    if (second) ties.push({ x1: from, x2: second.X, y: second.Y + PERSON_H / 2 });

    for (const kid of u.kids) {
      const kb = pos.get(primaryKey.get(kid) ?? "");
      if (!kb) continue;
      const [d] = getSmoothStepPath({
        sourceX: junctionX,
        sourceY: junctionY,
        targetX: kb.X + kb.b.w / 2,
        targetY: kb.Y,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        borderRadius: CORNER,
        offset: LINK_GAP_Y,
        centerY: barY,
      });
      links.push({ d, adoptive: Boolean(parentsOf.get(kid)?.adoptive) });
    }
  }

  // ---------------------------------------------------------------- 目盛りと箱
  const ticks: { y: number; label: string }[] = [];
  for (let y = Y0; toY(y) <= height; y += TICK_EVERY) {
    ticks.push({ y: toY(y), label: y < 0 ? `前${-y}` : String(y) });
  }

  const outBoxes: KinshipBox[] = laid.map(({ b, X, Y, H }) => {
    const slot = b.dynastyKey ? dynastyColorSlot(b.dynastyKey) : null;
    return {
      key: b.key,
      label: b.label,
      sub: b.sub,
      x: X,
      y: Y,
      w: b.w,
      h: H,
      kind: b.kind,
      href: b.kind === "emperor" ? `/emperors/${b.id}` : null,
      // 淡彩は **in srgb** で混ぜる（dynastyColorHex がそれ）。oklch で混ぜると
      // 白の色相 0 に引かれて、どの王朝の箱も同じ桃色になる。
      fill: slot == null ? "#ffffff" : dynastyColorHex(slot, 8),
      stroke: slot == null ? "#e5e5e5" : dynastyColorHex(slot, 45),
      mark: slot == null ? null : dynastyColorHex(slot, 100),
      inferred: inferred.has(b.key),
    };
  });

  return {
    id: eraId,
    label: eraLabel,
    width,
    height,
    ticks,
    boxes: outBoxes,
    links,
    ties,
    emperorCount: outBoxes.filter((b) => b.kind === "emperor").length,
    personCount: outBoxes.filter((b) => b.kind === "person").length,
    inferredCount: inferred.size,
  };
}
