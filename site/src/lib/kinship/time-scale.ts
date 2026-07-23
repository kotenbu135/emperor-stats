// 年→pxの単調な区分線形写像(章ごとに1つ構築)。
//
// 旧kinship-layout.tsの「密集期だけ局所的に引き伸ばす」機構の汎用化移植。
// 基準スケール(pxPerYear)で初期化した区間長へ、最小pxを満たさない制約の不足分を
// 右端の区間に加算していく(右端点の昇順に処理するため、加算が処理済み制約を
// 壊すことはない)。ノードと年目盛りが同じ写像を共有するので位置と年は常に一致する
// (引き伸ばした期間は目盛り間隔が広がることで視覚的に分かる)。

/** 「年区間 [start,end] は写像後に minPx 以上の高さを持つ」という制約。 */
export interface YearSpanConstraint {
  start: number;
  end: number;
  minPx: number;
}

export interface YearScale {
  /** 天文年 → px(topPx起点)。 */
  yOf: (astro: number) => number;
  minYear: number;
  maxYear: number;
}

export function buildYearScale(
  constraints: YearSpanConstraint[],
  pxPerYear: number,
  topPx: number,
): YearScale {
  if (constraints.length === 0) {
    throw new Error("kinship/time-scale: 制約が空です(章にノードがありません)");
  }
  const bps = [...new Set(constraints.flatMap((c) => [c.start, c.end]))].sort(
    (p, q) => p - q,
  );
  const bpIndex = new Map(bps.map((y, i) => [y, i]));
  const segLen = bps.slice(1).map((y, i) => (y - bps[i]) * pxPerYear);
  const posOf = () => {
    const pos = [0];
    for (const len of segLen) pos.push(pos[pos.length - 1] + len);
    return pos;
  };
  for (const c of [...constraints].sort((p, q) => p.end - q.end)) {
    if (c.end <= c.start)
      throw new Error(
        `kinship/time-scale: 制約の年区間が不正です(${c.start}〜${c.end})`,
      );
    const pos = posOf();
    const deficit =
      c.minPx - (pos[bpIndex.get(c.end)!] - pos[bpIndex.get(c.start)!]);
    if (deficit > 0) segLen[bpIndex.get(c.end)! - 1] += deficit;
  }
  const pos = posOf();
  const yOf = (astro: number): number => {
    if (astro <= bps[0]) return topPx + (astro - bps[0]) * pxPerYear;
    if (astro >= bps[bps.length - 1])
      return topPx + pos[pos.length - 1] + (astro - bps[bps.length - 1]) * pxPerYear;
    let lo = 0;
    let hi = bps.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (bps[mid] <= astro) lo = mid;
      else hi = mid;
    }
    const t = (astro - bps[lo]) / (bps[hi] - bps[lo]);
    return topPx + pos[lo] + t * (pos[hi] - pos[lo]);
  };
  return { yOf, minYear: bps[0], maxYear: bps[bps.length - 1] };
}
