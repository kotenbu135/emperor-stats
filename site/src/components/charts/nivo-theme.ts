// globals.css の水墨文人パレットと同値をハードコードで揃える（NivoテーマはCSS変数を解決できないため）。
export const nivoTheme = {
  background: "transparent",
  text: {
    fill: "#3a3530",
    fontFamily:
      "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
    fontSize: 12,
  },
  axis: {
    domain: { line: { stroke: "#ddd5c7", strokeWidth: 1 } },
    ticks: {
      line: { stroke: "#ddd5c7", strokeWidth: 1 },
      text: { fill: "#6b6258", fontSize: 11 },
    },
    legend: { text: { fill: "#3a3530", fontSize: 12 } },
  },
  grid: {
    line: { stroke: "#ddd5c7", strokeWidth: 1, strokeDasharray: "" },
  },
  legends: {
    text: { fill: "#3a3530", fontSize: 12 },
  },
  labels: {
    text: { fill: "#3a3530", fontSize: 11 },
  },
  tooltip: {
    container: {
      background: "#f5f1e8",
      color: "#3a3530",
      fontSize: 12,
      border: "1px solid #ddd5c7",
      borderRadius: 6,
    },
  },
};

// dataviz skillで検証済みのカテゴリカルパレット8色を、カテゴリの意味に合わせて割り当てる。
// 並び（＝円グラフの既定カテゴリ順で隣接する順序）は validate_palette.js で全チェックPASS済み:
//   "#2a78d6,#e34948,#4a3aa7,#eb6834,#1baf7a,#eda100,#e87ba4,#008300" (surface #f5f1e8)
// コントラストWARNの4色（橙・青緑・黄・桃）は直接ラベル＋表ビューで緩和（dataviz skillの緩和条件）。
export const categoryColorMaps: Record<string, Record<string, string>> = {
  deathCauseCategory: {
    病死: "#2a78d6",
    暗殺: "#e34948",
    処刑: "#4a3aa7",
    戦死: "#eb6834",
    自尽: "#1baf7a",
    事故死: "#eda100",
    不詳: "#e87ba4",
    諸説あり: "#008300",
  },
  accessionRouteCategory: {
    世襲: "#2a78d6",
    簒奪: "#e34948",
    禅譲: "#4a3aa7",
    擁立: "#eb6834",
    復位: "#1baf7a",
    建国: "#eda100",
    不詳: "#e87ba4",
    諸説あり: "#008300",
  },
};

/** 濃色スライス（クリーム文字が読める色）。それ以外は墨色文字を使う。 */
export const darkSlices = new Set(["#2a78d6", "#e34948", "#4a3aa7", "#008300"]);

// ランキング棒グラフ（単一系列）はサイトの印章朱に合わせる。
// #a6321c vs surface #f5f1e8 = 6.02:1（マーク3:1基準を満たす。数値ラベルはバー外側の墨色文字）。
export const rankingSeriesColor = "#a6321c";

/**
 * Nivoの数値軸はnice-numberアルゴリズムにより、値域が小さいと0.5刻みの目盛りを
 * 生成することがある（回数など整数しか取らない指標では不自然）。整数のみの
 * 目盛り配列を明示的に計算する。刻みに乗らない終端値（例: 最大62で60の隣に62）は
 * 目盛りが密集して読みにくいため追加しない（終端の値はバー横の数値ラベルで読める）。
 */
export function integerTickValues(maxValue: number): number[] {
  const max = Math.max(1, Math.ceil(maxValue));
  let step = 1;
  if (max > 60) step = 10;
  else if (max > 30) step = 5;
  else if (max > 12) step = 2;

  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  return ticks;
}
