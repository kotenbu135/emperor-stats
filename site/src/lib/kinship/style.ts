// /kinship の描画に使う色トークン。チャート本体(kinship-chart.tsx)と凡例
// (kinship-legend.tsx)で共用する。凡例は「図で示す」方針(ユーザー・2026-07-26)なので、
// 実際の描画とまったく同じ色・線幅・破線パターンで描く必要がある。

/** 血縁・婚姻の補助線。 */
export const KIN_STROKE = "color-mix(in srgb, var(--foreground) 42%, var(--background))";
/** 家系図の構造線(垂下線・兄弟バー・夫婦の連結線)。 */
export const STRUCT_STROKE = "color-mix(in srgb, var(--foreground) 52%, var(--background))";

/** 皇帝でないつなぎ人物のピル(破線枠)。 */
export const PERSON_FILL = "color-mix(in srgb, var(--foreground) 10%, var(--background))";
export const PERSON_EDGE = "color-mix(in srgb, var(--foreground) 38%, var(--background))";
/** 后妃など配偶者のピル(丸枠)。 */
export const CONSORT_FILL = "color-mix(in srgb, var(--foreground) 5%, var(--background))";
export const CONSORT_EDGE = "color-mix(in srgb, var(--foreground) 30%, var(--background))";

/** 皇帝カプセル。slot 0 は群雄・並立政権の専用色(--kinship-minor)。 */
export const seriesFill = (slot: number): string =>
  slot === 0
    ? "color-mix(in srgb, var(--kinship-minor) 40%, var(--background))"
    : `color-mix(in srgb, var(--series-${slot}) 42%, var(--background))`;
export const seriesEdge = (slot: number): string =>
  slot === 0
    ? "color-mix(in srgb, var(--kinship-minor) 80%, var(--background))"
    : `color-mix(in srgb, var(--series-${slot}) 82%, var(--background))`;
