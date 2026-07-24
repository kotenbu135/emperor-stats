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
// 縦スケールは固定(1年=8px。約100〜150年が1画面に収まる密度)。時間写像の局所
// 引き伸ばしは「在位が短くカプセル最小高に満たない皇帝」の周辺でのみ発生する
// (3px/年の頃はほぼ全区間が引き伸ばされ年目盛りが不均等で分かりにくかった)。
export const PX_PER_YEAR = 8;
export const NODE_GAP = 10; // 縦方向のノード間隔(年境界から上下5pxずつ内側に描く)
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
  // 兄弟の並び: 「同じ母の子は必ず連続」させる(母別の垂下グループのバーが
  // 交差しない必須条件)。グループの順・グループ内の順とも
  // 「明示指定(childOrderOf。無指定=0)→アンカー年」。
  const sortKey = (id: string): [number, number] => [
    g.childOrderOf.get(id) ?? 0,
    g.info.get(id)!.anchor,
  ];
  const cmpKey = (p: string, q: string): number => {
    const [po, pa] = sortKey(p);
    const [qo, qa] = sortKey(q);
    return po - qo || pa - qa;
  };
  for (const [father, arr] of childrenOf) {
    const spouseIds = new Set((g.spousesOf.get(father) ?? []).map((sp) => sp.id));
    const keyOf = (c: string): string => {
      const m = g.motherOf.get(c);
      return m !== undefined && spouseIds.has(m) ? m : "";
    };
    const groups = new Map<string, string[]>();
    for (const c of arr) groups.set(keyOf(c), [...(groups.get(keyOf(c)) ?? []), c]);
    const ordered = [...groups.values()];
    for (const kids of ordered) kids.sort(cmpKey);
    ordered.sort((p, q) => cmpKey(p[0], q[0]));
    childrenOf.set(father, ordered.flat());
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
  const packSequence = (
    rootIds: string[],
    baseRects: Rect[],
    corridor?: (id: string, rootX: number) => Rect | null,
  ): { id: string; x: number }[] => {
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
      // 右端固定(childOrder指定900以上): 空きスペースへの左詰めをせず、既存の
      // 全矩形の右側から詰め始める(孺子嬰を新バンド寄りに置き禅譲矢印を短くする等)。
      if ((g.childOrderOf.get(rootId) ?? 0) >= 900 && baseRects.length > 0) {
        const pinDx = Math.max(...baseRects.map((r) => r.x1)) + GAP_X;
        shiftPlaced(itemFrom, juncFrom, tieFrom, sub.rects, pinDx);
        rootX += pinDx;
      }
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
      // 親からこの子へ降りる垂下線の通り道(コリドー)を予約し、後続の兄弟サブツリーが
      // 線の経路に割り込まないようにする(兄弟バー・長い降下線がノードを横切る事故の防止)。
      const cor = corridor?.(rootId, rootX);
      if (cor) baseRects.push(cor);
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
    const childRoots = packSequence(children, rects, (childId, childRootX) => {
      const childTop = yearSpan(g.info.get(childId)!).start;
      if (childTop <= span.end + PAD_Y) return null;
      return { x0: childRootX - 2, x1: childRootX + 2, y0: span.end, y1: childTop };
    });
    for (const { parent, child } of childRoots.map((c) => ({ parent: id, child: c.id })))
      treeEdges.push({ parent, child });

    // --- 自ノード(+配偶者)の配置 ---
    // 子は母別グループで連続に並んでいる(packBand冒頭のソート)。
    // 目標は「すべての垂下線をまっすぐ落とす」こと:
    // - 母不明グループがあれば、父をその平均xの真上に置く(父下辺中央から垂直)。
    // - 母グループは、夫婦連結線の長さを伸縮させて連結線の中点をそのグループの
    //   平均xに正確に合わせる(＝の長さは固定しない。表示が美しくなる長さを選ぶ)。
    const spouses = g.spousesOf.get(id) ?? [];
    const childXById = new Map(childRoots.map((c) => [c.id, c.x]));
    const spouseIdSet = new Set(spouses.map((sp) => sp.id));
    const groupKeyOf = (c: string): string => {
      const m = g.motherOf.get(c);
      return m !== undefined && spouseIdSet.has(m) ? m : "";
    };
    const groupsHere = new Map<string, string[]>();
    for (const c of children)
      groupsHere.set(groupKeyOf(c), [...(groupsHere.get(groupKeyOf(c)) ?? []), c]);
    const meanXOf = (kids: string[]): number =>
      kids.reduce((sum, c) => sum + (childXById.get(c) ?? 0), 0) / kids.length;

    const nullKids = groupsHere.get("");
    let rootX: number;
    if (childRoots.length === 0) {
      rootX = 0;
    } else if (nullKids !== undefined) {
      rootX = meanXOf(nullKids);
    } else {
      // 母グループのみ: 父は最初のグループの左脇(標準長の連結線の中点が真上に来る)。
      rootX =
        meanXOf(groupsHere.get(groupKeyOf(children[0]))!) - w / 2 - TIE_LEN / 2;
    }

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

    // 配偶者: 産んだ子のいる側(いなければ右)。同じ側では子持ちを内側に置く
    // (連結線が他の妃をまたがない)。
    interface SpousePlan {
      sp: SpouseAttach;
      hasKids: boolean;
      sw: number;
    }
    const sidePlans: Record<"L" | "R", SpousePlan[]> = { L: [], R: [] };
    for (const sp of spouses) {
      const kids = groupsHere.get(sp.id);
      const side: "L" | "R" =
        kids !== undefined && meanXOf(kids) < rootX ? "L" : "R";
      sidePlans[side].push({
        sp,
        hasKids: kids !== undefined,
        sw: consortWidth(g.info.get(sp.id)?.name ?? sp.id),
      });
    }
    for (const arr of [sidePlans.L, sidePlans.R])
      arr.sort((p, q) => Number(q.hasKids) - Number(p.hasKids));

    // 配偶者の占有年区間は夫と同一にする(描画は夫カプセルの上部にpx整列。
    // 子は必ず夫の実効区間の後に始まるため、連結線を横に伸ばしても子と交差しない)。
    const spouseSpan = { start: span.start, end: span.end };
    const tieMid = new Map<string, number>();
    for (const side of ["L", "R"] as const) {
      let edge = side === "L" ? rootX - w / 2 : rootX + w / 2;
      for (const pl of sidePlans[side]) {
        let innerX: number;
        if (pl.hasKids) {
          // 連結線の中点 = 自分の子グループの平均x になるよう長さを決める。
          const target = meanXOf(groupsHere.get(pl.sp.id)!);
          innerX = 2 * target - edge;
          innerX =
            side === "L"
              ? Math.min(innerX, edge - TIE_LEN)
              : Math.max(innerX, edge + TIE_LEN);
        } else {
          innerX = side === "L" ? edge - TIE_LEN : edge + TIE_LEN;
        }
        tieMid.set(pl.sp.id, (edge + innerX) / 2);
        const cx = side === "L" ? innerX - pl.sw / 2 : innerX + pl.sw / 2;
        items.push({
          id: pl.sp.id,
          role: "consort",
          attachedTo: id,
          cx,
          w: pl.sw,
          effStart: spouseSpan.start,
          effEnd: spouseSpan.end,
          minPx: PERSON_MIN_PX,
        });
        ties.push({
          husbandId: id,
          spouseId: pl.sp.id,
          double: pl.sp.double,
          x1: Math.min(edge, innerX),
          x2: Math.max(edge, innerX),
        });
        // 伸ばした連結線の下(夫の在位年幅)は垂下線の始点が通るため、通り道として
        // 予約し、他のサブツリーが隙間に滑り込まないようにする。
        if (pl.hasKids) {
          rects.push({
            x0: Math.min(edge, innerX),
            x1: Math.max(edge, innerX),
            y0: spouseSpan.start,
            y1: spouseSpan.end,
          });
        }
        rects.push({
          x0: cx - pl.sw / 2,
          x1: cx + pl.sw / 2,
          y0: spouseSpan.start,
          y1: spouseSpan.end,
        });
        edge = side === "L" ? innerX - pl.sw : innerX + pl.sw;
      }
    }

    // --- 垂下グループ(母ごと+母不明)と垂下線の占有矩形 ---
    for (const [key, kids] of groupsHere) {
      const motherId = key === "" ? null : key;
      const jx = motherId === null ? rootX : tieMid.get(motherId)!;
      junctions.push({ fatherId: id, motherId, x: jx, children: kids });
      const topKid = Math.min(...kids.map((c) => yearSpan(g.info.get(c)!).start));
      if (topKid > span.end)
        rects.push({ x0: jx - 2, x1: jx + 2, y0: span.end, y1: topKid });
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
    // 真に食い込んでいる場合のみ押し下げる(在位が隣接する親子皇帝は年境界を共有
    // するのが正常で、描画時のNODE_GAPインセットが間隔を作る。ここでPAD_Yまで
    // 要求すると幹の全皇帝が真の即位年から数pxずつ下へずれてしまう)。
    if (c.effStart < p.effEnd) {
      const len = c.effEnd - c.effStart;
      c.effStart = p.effEnd;
      c.effEnd = c.effStart + len;
    }
  }
  // 配偶者は夫の実効区間に追従させる(夫が押し下げられた場合)。
  for (const it of items) {
    if (it.role !== "consort" || !it.attachedTo) continue;
    const h = itemById.get(it.attachedTo);
    if (!h) continue;
    it.effStart = h.effStart;
    it.effEnd = h.effEnd;
  }

  return { label: g.label, width, items, junctions, ties };
}
