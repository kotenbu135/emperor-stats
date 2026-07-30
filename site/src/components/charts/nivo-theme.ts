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
  // 2026-07-26の多軸化で語彙が入れ替わった。意味の連続性を保つため旧色を引き継いでいる
  //（旧禅譲→受禅（易姓）、旧建国→自立、旧復位→推戴、旧不詳→継承（経緯記載なし））。
  accessionRouteCategory: {
    世襲: "#2a78d6",
    擁立: "#eb6834",
    簒奪: "#e34948",
    内禅: "#12939a",
    自立: "#eda100",
    推戴: "#1baf7a",
    "受禅（易姓）": "#4a3aa7",
    "継承（経緯記載なし）": "#e87ba4",
  },
};

// 円グラフ・積み上げ棒の塗りは、これらの生の値ではなく地色と混ぜた濃度で渡す
// （lib/dynasty-colors.ts の mixHex／DYNASTY_FILL_MIX・DYNASTY_EDGE_MIX）。
// 塗りの上に載せる文字色も混色後の実値から選ぶ（同 readableTextOn）。
//
// ランキング棒グラフの色は王朝ごと（lib/dynasty-colors.ts）。かつては朱の単色
// （--seal #a6321c）だったが、朱は印章的なワンポイントに限定する方針に戻した。

/**
 * Nivoの数値軸はnice-numberアルゴリズムにより、値域が小さいと0.5刻みの目盛りを
 * 生成することがある（回数など整数しか取らない指標では不自然）。整数のみの
 * 目盛り配列を明示的に計算する。刻みに乗らない終端値（例: 最大62で60の隣に62）は
 * 目盛りが密集して読みにくいため追加しない（終端の値はバー横の数値ラベルで読める）。
 */
/** 目盛りラベルが重ならない最小の間隔（px）。「前221年」級の長いラベルは軸に出ない
 *  （数値のみ）ため、2〜3桁の整数が触れ合わない幅で足りる。 */
const MIN_TICK_GAP = 40;

export function integerTickValues(maxValue: number, plotWidth?: number): number[] {
  const max = Math.max(1, Math.ceil(maxValue));
  // 値域だけで決めた既定の刻み（デスクトップ幅ではこれで重ならない）。
  let step = 1;
  if (max > 60) step = 10;
  else if (max > 30) step = 5;
  else if (max > 12) step = 2;

  // 描画幅が分かる場合は、目盛り本数×MIN_TICK_GAP が幅に収まる刻みまで粗くする。
  // 値域だけで刻みを決めると、狭い画面（390px幅の/dynastiesはmax≒26→刻み2→14本）で
  // 目盛りが密着して読めなくなる。既定より細かくはしない（デスクトップの見え方を変えない）。
  if (plotWidth !== undefined && plotWidth > 0) {
    const fits = (s: number) => (Math.floor(max / s) + 1) * MIN_TICK_GAP <= plotWidth;
    for (const s of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]) {
      if (s < step) continue;
      // 刻みを粗くしても入らないほど狭い場合は、0と最大値付近の2本だけ残る
      // ところで打ち切る（1本だけの軸にはしない）。
      if (s > max) break;
      step = s;
      if (fits(s)) break;
    }
  }

  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  return ticks;
}
