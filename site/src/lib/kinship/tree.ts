// 王朝バンド内の家系図レイアウト(パッキング)。純関数。
//
// 座標系: x=px(バンド内相対)・y=年(天文年)。yはtime-scale.tsの写像で後からpxに
// 変換されるため、ここでは「年区間どうしの衝突」を扱う。
//
// 方式: tidy tree(post-order・兄弟は左から・親は子の中央)を基本に、
// 「時間的に重ならないサブツリーはx空間を再利用してよい」という矩形パッキングで
// 幅を圧縮する。兄弟ノード自身の横並び順(childOrder→アンカー年)は維持しつつ、
// 途絶えた分家の下の空間へ後続の分家の子孫が滑り込める。
// - 夫婦: 配偶者(皇后・生母)は独立ノードにせず夫の脇のサブスロットに置く
//   (yは夫のアンカー年に整列。生没年はツールチップで示す)。
// - 親子コネクタ(垂下線)は細い矩形としてパッキングに参加させ、他の分家が
//   線の経路に割り込まないようにする。
// - 同一カラムで親子の年区間が重なる場合(生没中点配置の人物チェーン等)は、
//   実効年区間をカーソル方式で押し下げる(押し下げ分はtime-scaleの制約が
//   局所引き伸ばしで吸収するため、位置と年目盛りの対応は保たれる)。

// --- レイアウト定数 ---
export const PX_PER_YEAR = 3;
export const NODE_GAP = 8; // 縦方向のノード間隔(年境界から上下4pxずつ内側に描く)
export const EMPEROR_W = 96;
/** 皇帝カプセルの最小高(名前+「第N代・経路」の2行が成立する高さ)+間隔。 */
export const EMPEROR_MIN_PX = 52 + NODE_GAP;
export const PERSON_H = 26;
export const PERSON_MIN_PX = PERSON_H + NODE_GAP;
const GAP_X = 12; // 横方向の最小間隔
const TIE_LEN = 10; // 夫婦の連結線の長さ
const MIN_SIB_SEP = 24; // 兄弟ルート間の最小x差(横並び順の保証)
/** 人物ノードが年空間で占有する片側幅。 */
export const PERSON_HALF_SPAN = PERSON_MIN_PX / 2 / PX_PER_YEAR;
/** 衝突判定の年方向パディング(px換算でNODE_GAP相当)。 */
const PAD_Y = NODE_GAP / 2 / PX_PER_YEAR;

// --- 入力 ---

export interface KinNodeInfo {
  id: string;
  isEmperor: boolean;
  name: string;
  female: boolean;
  /** 配置アンカー年(不明者は隣接からの推定値)。 */
  anchor: number;
  /** 皇帝のみ: 在位区間(天文年)。 */
  reign?: { a: number; b: number };
}

export interface SpouseAttach {
  id: string;
  /** 婚姻エッジあり(皇后)=二重線。なし(妃嬪等の生母)=細単線。 */
  double: boolean;
}

/** バンド1本ぶんの家系図グラフ(layout.tsが構築して渡す)。 */
export interface BandGraph {
  label: string;
  /** 配置ノード(皇帝+単独人物)。配偶者(attached)は含まない。 */
  memberIds: string[];
  info: Map<string, KinNodeInfo>;
  /** 同バンド内の主親(構造エッジ)。バンド外の親はここに含めない。 */
  primaryFather: Map<string, string>;
  spousesOf: Map<string, SpouseAttach[]>;
  /** childId → childOrder(排行)。 */
  childOrderOf: Map<string, number>;
  /** childId → 実母id(配偶者としてattachされている場合のみ)。 */
  motherOf: Map<string, string>;
}

// --- 出力 ---

export interface PackedItem {
  id: string;
  role: "node" | "consort";
  /** consortのみ: 夫のid。 */
  attachedTo?: string;
  cx: number;
  w: number;
  /** 実効年区間(カーソル押し下げ解決後)。y座標とtime-scale制約の両方に使う。 */
  effStart: number;
  effEnd: number;
  minPx: number;
}

export interface PackedJunction {
  fatherId: string;
  /** nullは母不明グループ(父単独の垂下)。 */
  motherId: string | null;
  x: number;
  children: string[];
}

export interface PackedTie {
  husbandId: string;
  spouseId: string;
  double: boolean;
  /** 連結線のx区間(バンド相対)。連なった第2妃は内側の妃の外縁から引く。 */
  x1: number;
  x2: number;
}

export interface PackedBand {
  label: string;
  width: number;
  items: PackedItem[];
  junctions: PackedJunction[];
  ties: PackedTie[];
}

// --- パッキングの内部表現 ---

interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

function nodeWidth(info: KinNodeInfo): number {
  if (info.isEmperor) return EMPEROR_W;
  return Math.max(48, Math.min(132, info.name.length * 11 + 16));
}

function consortWidth(name: string): number {
  return Math.max(48, Math.min(124, name.length * 10.5 + 12));
}

/** ノードが占有する年区間(パッキング用の初期値)。 */
function yearSpan(info: KinNodeInfo): { start: number; end: number } {
  if (info.isEmperor && info.reign) {
    const start = info.reign.a;
    // 同年内の即位・退位(0年区間)にも最小の区間を与える。
    const end = Math.max(info.reign.b, start + 0.5);
    return { start, end };
  }
  return { start: info.anchor - PERSON_HALF_SPAN, end: info.anchor + PERSON_HALF_SPAN };
}

function collideAmount(placed: Rect[], cand: Rect[]): number {
  // candをどれだけ右へ押せば衝突が消えるか(1回分)。0なら衝突なし。
  let push = 0;
  for (const a of placed) {
    for (const b of cand) {
      const yOverlap = a.y0 < b.y1 + PAD_Y && b.y0 < a.y1 + PAD_Y;
      if (!yOverlap) continue;
      const xOverlap = a.x0 < b.x1 + GAP_X && b.x0 < a.x1 + GAP_X;
      if (!xOverlap) continue;
      push = Math.max(push, a.x1 + GAP_X - b.x0);
    }
  }
  return push;
}

/**
 * バンド1本の家系図をパッキングする。
 * itemsのeffStart/effEndは「同一カラムの親子チェーン押し下げ」まで解決済み。
 */
export function packBand(g: BandGraph): PackedBand {
  const childrenOf = new Map<string, string[]>();
  for (const [child, father] of g.primaryFather) {
    childrenOf.set(father, [...(childrenOf.get(father) ?? []), child]);
  }
  const sortKey = (id: string): [number, number] => [
    g.childOrderOf.get(id) ?? Number.POSITIVE_INFINITY,
    g.info.get(id)!.anchor,
  ];
  for (const arr of childrenOf.values()) {
    arr.sort((p, q) => {
      const [po, pa] = sortKey(p);
      const [qo, qa] = sortKey(q);
      return po - qo || pa - qa;
    });
  }

  const items: PackedItem[] = [];
  const junctions: PackedJunction[] = [];
  const ties: PackedTie[] = [];
  // 後段のチェーン押し下げ用に、木構造の辺(親→子。DFSで親の処理が先)を記録する。
  const treeEdges: { parent: string; child: string }[] = [];
  const itemById = new Map<string, PackedItem>();

  /** サブツリーの座標シフトをitems/junctions/tiesへも伝播する。 */
  const shiftPlaced = (
    itemFrom: number,
    juncFrom: number,
    tieFrom: number,
    rects: Rect[],
    dx: number,
  ): void => {
    for (const r of rects) {
      r.x0 += dx;
      r.x1 += dx;
    }
    for (let i = itemFrom; i < items.length; i++) items[i].cx += dx;
    for (let i = juncFrom; i < junctions.length; i++) junctions[i].x += dx;
    for (let i = tieFrom; i < ties.length; i++) {
      ties[i].x1 += dx;
      ties[i].x2 += dx;
    }
  };

  /**
   * サブツリー群を左から順に詰める共通処理。各サブツリーのレイアウト実行
   * (layoutSubtree)の前後でitems/junctionsのindexを控え、シフトを伝播する。
   * 戻り値は各ルートの確定x。
   */
  const packSequence = (rootIds: string[], baseRects: Rect[]): { id: string; x: number }[] => {
    const rootXs: { id: string; x: number }[] = [];
    let prevRootX = Number.NEGATIVE_INFINITY;
    for (const rootId of rootIds) {
      const itemFrom = items.length;
      const juncFrom = junctions.length;
      const tieFrom = ties.length;
      const sub = layoutSubtree(rootId);
      // 左端0起点に寄せてから、衝突がなくなる最小シフトを探す
      // (押す量は単調に増えるだけなので反復は収束する)。
      const minX = Math.min(...sub.rects.map((r) => r.x0));
      shiftPlaced(itemFrom, juncFrom, tieFrom, sub.rects, -minX);
      let rootX = sub.rootX - minX;
      let guard = 0;
      for (;;) {
        const push = collideAmount(baseRects, sub.rects);
        // 兄弟(ルート)の横並び順: 自ルートは前のルートより必ず右。
        const orderPush =
          rootX < prevRootX + MIN_SIB_SEP ? prevRootX + MIN_SIB_SEP - rootX : 0;
        const dx = Math.max(push, orderPush);
        if (dx <= 0.01) break;
        shiftPlaced(itemFrom, juncFrom, tieFrom, sub.rects, dx);
        rootX += dx;
        if (++guard > 500)
          throw new Error(`kinship/tree: パッキングが収束しません(${rootId})`);
      }
      baseRects.push(...sub.rects);
      rootXs.push({ id: rootId, x: rootX });
      prevRootX = rootX;
    }
    return rootXs;
  };

  /** サブツリーをレイアウトし、矩形群(このサブツリーのローカル座標)を返す。 */
  const layoutSubtree = (id: string): { rects: Rect[]; rootX: number } => {
    const info = g.info.get(id)!;
    const children = childrenOf.get(id) ?? [];
    const w = nodeWidth(info);
    const span = yearSpan(info);

    // --- 子サブツリーを左から詰める(時間非重複なら空間再利用) ---
    const rects: Rect[] = [];
    const childRoots = packSequence(children, rects);
    for (const { parent, child } of childRoots.map((c) => ({ parent: id, child: c.id })))
      treeEdges.push({ parent, child });

    // --- 自ノード(+配偶者)を子の中央に置く ---
    const rootX =
      childRoots.length === 0
        ? 0
        : (childRoots[0].x + childRoots[childRoots.length - 1].x) / 2;
    rects.push({ x0: rootX - w / 2, x1: rootX + w / 2, y0: span.start, y1: span.end });
    const item: PackedItem = {
      id,
      role: "node",
      cx: rootX,
      w,
      effStart: span.start,
      effEnd: span.end,
      minPx: info.isEmperor ? EMPEROR_MIN_PX : PERSON_MIN_PX,
    };
    items.push(item);
    itemById.set(id, item);

    // 配偶者: 自分の産んだ子のいる側に置く(いなければ右)。同じ側が複数なら外へ連結。
    const spouses = g.spousesOf.get(id) ?? [];
    const anchorMid =
      info.isEmperor && info.reign ? (info.reign.a + info.reign.b) / 2 : info.anchor;
    const spouseSpan = {
      start: anchorMid - PERSON_HALF_SPAN,
      end: anchorMid + PERSON_HALF_SPAN,
    };
    const childXById = new Map(childRoots.map((c) => [c.id, c.x]));
    const sideEdge: Record<"L" | "R", number> = {
      L: rootX - w / 2,
      R: rootX + w / 2,
    };
    const spouseX = new Map<string, number>();
    const tieMid = new Map<string, number>();
    for (const sp of spouses) {
      const own = children.filter((c) => g.motherOf.get(c) === sp.id);
      const meanX =
        own.length > 0
          ? own.reduce((s, c) => s + (childXById.get(c) ?? rootX), 0) / own.length
          : Number.POSITIVE_INFINITY; // 子なしは右へ
      const side: "L" | "R" = meanX < rootX ? "L" : "R";
      const sw = consortWidth(g.info.get(sp.id)?.name ?? sp.id);
      // 連結線は現在の側の境界(初回=夫の枠、連なった場合=内側の妃の外縁)から引く。
      const tieFromX = sideEdge[side];
      const tieToX = side === "L" ? tieFromX - TIE_LEN : tieFromX + TIE_LEN;
      const cx =
        side === "L"
          ? sideEdge.L - TIE_LEN - sw / 2
          : sideEdge.R + TIE_LEN + sw / 2;
      sideEdge[side] = side === "L" ? cx - sw / 2 : cx + sw / 2;
      spouseX.set(sp.id, cx);
      tieMid.set(sp.id, (tieFromX + tieToX) / 2);
      items.push({
        id: sp.id,
        role: "consort",
        attachedTo: id,
        cx,
        w: sw,
        effStart: spouseSpan.start,
        effEnd: spouseSpan.end,
        minPx: PERSON_MIN_PX,
      });
      ties.push({
        husbandId: id,
        spouseId: sp.id,
        double: sp.double,
        x1: Math.min(tieFromX, tieToX),
        x2: Math.max(tieFromX, tieToX),
      });
      rects.push({
        x0: cx - sw / 2,
        x1: cx + sw / 2,
        y0: spouseSpan.start,
        y1: spouseSpan.end,
      });
    }

    // --- 垂下グループ(母ごと+母不明)と垂下線の占有矩形 ---
    if (children.length > 0) {
      const groups = new Map<string | null, string[]>();
      for (const c of children) {
        const m = g.motherOf.get(c);
        const key = m !== undefined && spouseX.has(m) ? m : null;
        groups.set(key, [...(groups.get(key) ?? []), c]);
      }
      for (const [motherId, kids] of groups) {
        // 母のいるグループは父と母の連結線の真ん中から、母不明は父の下辺中央から。
        const jx = motherId === null ? rootX : tieMid.get(motherId)!;
        junctions.push({ fatherId: id, motherId, x: jx, children: kids });
        const topKid = Math.min(...kids.map((c) => yearSpan(g.info.get(c)!).start));
        if (topKid > span.end)
          rects.push({ x0: jx - 2, x1: jx + 2, y0: span.end, y1: topKid });
      }
    }

    return { rects, rootX };
  };

  // --- 森: ルート(バンド内に主親を持たないノード)をアンカー年順に詰める ---
  // childOrderの明示指定(CHILD_ORDER_OVERRIDES)はルートの並びにも効かせる
  // (孺子嬰を右端に寄せて禅譲矢印の横断を短くする等)。指定なしは0扱い。
  const rootOrder = (id: string): number => g.childOrderOf.get(id) ?? 0;
  const roots = g.memberIds
    .filter((id) => !g.primaryFather.has(id))
    .sort(
      (p, q) =>
        rootOrder(p) - rootOrder(q) ||
        g.info.get(p)!.anchor - g.info.get(q)!.anchor,
    );
  if (roots.length === 0)
    throw new Error(`kinship/tree: バンド「${g.label}」に森のルートがありません`);
  packSequence(roots, []);

  // --- 左端0起点へ正規化 ---
  const minX = Math.min(...items.map((i) => i.cx - i.w / 2));
  for (const i of items) i.cx -= minX;
  for (const j of junctions) j.x -= minX;
  for (const t of ties) {
    t.x1 -= minX;
    t.x2 -= minX;
  }
  const width = Math.max(...items.map((i) => i.cx + i.w / 2));

  // --- 同一カラムの親子チェーン押し下げ(実効年区間のカーソル解決) ---
  // 浅い親から順(深さ昇順)に見て、x方向に重なる親子の年区間が食い込んでいたら
  // 子を押し下げる。押し下げは子孫の辺の処理で連鎖する(treeEdgesはDFSの
  // post-orderで深い辺が先に並ぶため、必ず深さ順に並べ替えてから処理する)。
  const depth = new Map<string, number>();
  const depthOf = (id: string): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    const f = g.primaryFather.get(id);
    const d = f === undefined ? 0 : depthOf(f) + 1;
    depth.set(id, d);
    return d;
  };
  treeEdges.sort((p, q) => depthOf(p.parent) - depthOf(q.parent));
  for (const { parent, child } of treeEdges) {
    const p = itemById.get(parent);
    const c = itemById.get(child);
    if (!p || !c) continue;
    const xOverlap =
      p.cx - p.w / 2 < c.cx + c.w / 2 && c.cx - c.w / 2 < p.cx + p.w / 2;
    if (!xOverlap) continue;
    if (c.effStart < p.effEnd + PAD_Y) {
      const len = c.effEnd - c.effStart;
      c.effStart = p.effEnd + PAD_Y;
      c.effEnd = c.effStart + len;
    }
  }
  // 配偶者は夫の実効区間に追従させる(夫が押し下げられた場合)。
  for (const it of items) {
    if (it.role !== "consort" || !it.attachedTo) continue;
    const h = itemById.get(it.attachedTo);
    if (!h) continue;
    const mid = (h.effStart + h.effEnd) / 2;
    const len = it.effEnd - it.effStart;
    it.effStart = mid - len / 2;
    it.effEnd = mid + len / 2;
  }

  return { label: g.label, width, items, junctions, ties };
}
