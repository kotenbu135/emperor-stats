"use client";

import { useEffect, useRef, useState } from "react";
import { ResponsivePie, type PieCustomLayerProps } from "@nivo/pie";
import { categoryColorMaps, nivoTheme } from "@/components/charts/nivo-theme";
import {
  DYNASTY_EDGE_MIX,
  DYNASTY_FILL_MIX,
  mixHex,
  readableTextOn,
} from "@/lib/dynasty-colors";
import {
  ChartFilterControls,
  type SortDirection,
} from "@/components/charts/chart-filter-controls";
import { TableDetails } from "@/components/charts/scroll-bar-chart";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type {
  CategoryMetricKey,
  DynastyCategory,
  DynastyOption,
  EmperorRecord,
} from "@/lib/emperor-types";

interface PieDatum {
  id: string;
  label: string;
  value: number;
  /** 割合をデータ側に持たせる。ラベル側で live な合計から割ると、絞り込みで消える
   *  スライスが退場アニメーション中（実測で約0.7秒）だけ「世襲 6000%」のような値を
   *  出す（古い人数を新しい合計で割るため）。datum に持たせれば退場中も整合する。 */
  percent: number;
}

/** nivoの外側ラベル(arcLinkLabel)が弧の縁から水平に消費する幅。
 *  内訳: activeOuterRadiusOffset 6 + diagonalLength 16 + straightLength 24 + textOffset 6。
 *  真横に出るラベル(sinθ=1)が最悪ケースなので、この値をそのまま片側の必要量に足す。 */
const LINK_WIDTH = 52;
/** 外側ラベルを出すために最低限確保する円の直径。これを下回るなら外側ラベルをやめる。 */
const MIN_OUTSIDE_DIAMETER = 200;
/** margin.top + margin.bottom。縦方向の直径上限を出すのに使う。 */
const VERTICAL_MARGIN = 56;

/** 全角=1em・半角=0.56em で文字列の描画幅を見積もる（nivo-themeのlabels.text.fontSize基準）。
 *  実測との誤差は3px以内。Canvasで測るとフォント読み込み前に外すため、字幅で見積もる。 */
function estimateTextWidth(text: string, fontSize: number) {
  let em = 0;
  for (const ch of text) em += /[\u0000-\u00FF]/.test(ch) ? 0.56 : 1;
  return em * fontSize;
}

/** 描画コンテナの幅をResizeObserverで測る。外側ラベルが収まるかは
 *  ビューポート幅でなく「この列の幅」で決まる（2カラムか1カラムかで倍違う）。 */
function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function CategoryPieChart({
  records,
  dynastyOptions,
  metricKey,
  categoryOrder,
  categoryDescriptions,
  chartLabel,
  height = 420,
}: {
  records: EmperorRecord[];
  dynastyOptions: DynastyOption[];
  metricKey: CategoryMetricKey;
  categoryOrder: string[];
  categoryDescriptions: Record<string, string>;
  /** チャートのアクセシブルネーム（例: "死因別分布"）。 */
  chartLabel: string;
  height?: number;
}) {
  const [chartBoxRef, measuredWidth] = useMeasuredWidth<HTMLDivElement>();
  const [dynastyValue, setDynastyValue] = useState("all");
  const [categoryValue, setCategoryValue] = useState<DynastyCategory | "all">("all");
  // "asc" = カテゴリ順（既定・固定順で識別性を保つ）, "desc" = 件数の多い順
  const [order, setOrder] = useState<SortDirection>("asc");

  const filtered = records.filter(
    (r) =>
      (dynastyValue === "all" || r.dynastyKey === dynastyValue) &&
      (categoryValue === "all" || r.dynastyCategory === categoryValue),
  );

  const counts = new Map<string, number>();
  for (const r of filtered) {
    const c = r[metricKey];
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }

  // カテゴリの意味に対応した固定色（nivo-theme.tsでdataviz検証済み）。色の割り当て
  // そのものは変えず、塗りは地色に混ぜた濃度で出す（生の彩度だと宣紙色のクロームから
  // 浮き、グラフだけ別のサイトのように見える。/timeline・/kinship と同じ規則）。
  const colorMap = categoryColorMaps[metricKey];
  const fallbackColor = "#6b6258";
  const rawOf = (category: string) => colorMap[category] ?? fallbackColor;
  const fillOf = (category: string) => mixHex(rawOf(category), DYNASTY_FILL_MIX);
  const edgeOf = (category: string) => mixHex(rawOf(category), DYNASTY_EDGE_MIX);
  /** 凡例・表・ツールチップのスウォッチ。実際の弧とまったく同じ塗り＋縁で描く。 */
  const swatchStyle = (category: string) => ({
    backgroundColor: fillOf(category),
    border: `1px solid ${edgeOf(category)}`,
  });

  let entries = categoryOrder
    .filter((c) => (counts.get(c) ?? 0) > 0)
    .map((c) => ({ category: c, count: counts.get(c) ?? 0 }));
  if (order === "desc") {
    entries = [...entries].sort((a, b) => b.count - a.count);
  }

  const totalCount = entries.reduce((sum, d) => sum + d.count, 0);
  const percentOf = (value: number) =>
    totalCount > 0 ? Math.round((value / totalCount) * 100) : 0;
  const pieData: PieDatum[] = entries.map((d) => ({
    id: d.category,
    label: d.category,
    value: d.count,
    percent: percentOf(d.count),
  }));

  // 外側ラベルが収まるかを、列の実測幅と「この分類で最も長いラベル」から決める。
  // 見積もりは絞り込みの影響を受けない2点で固定する — 割合は常に3桁(100%)で、
  // カテゴリは表示中のものでなく categoryOrder の全件で測る。表示中のカテゴリや
  // 実際の桁数で計算すると、王朝を絞り込むたびに内側/外側が入れ替わってしまう。
  const labelFontSize = 11;
  const widestLabel = categoryOrder.reduce(
    (w, c) => Math.max(w, estimateTextWidth(`${c} 100%`, labelFontSize)),
    0,
  );
  const outsideDiameter = Math.min(
    2 * (measuredWidth / 2 - LINK_WIDTH - widestLabel),
    height - VERTICAL_MARGIN,
  );
  // 幅が未計測(初回フレーム)のうちは外側ラベルを出さない。切り詰めた円を一瞬見せるより、
  // 内側ラベルのまま確定させるほうが目に留まらない。
  const useOutsideLabels =
    measuredWidth > 0 && outsideDiameter >= MIN_OUTSIDE_DIAMETER;
  const sideMargin = useOutsideLabels
    ? Math.round((measuredWidth - outsideDiameter) / 2)
    : 32;

  // 外側ラベルを出さないときは、弧の中に入るぶんだけカテゴリ名を併記する。
  // 割合だけにすると、コントラストの低いスロットの識別が凡例だけに頼ることになる
  // （直接ラベルを併記することがこの配色を採用した前提。DESIGN.md の Colors 節）。
  const innerDiameter = Math.min(measuredWidth - 64, height - VERTICAL_MARGIN);
  const arcLabelOf = (d: PieDatum) => {
    const pct = `${d.percent}%`;
    if (useOutsideLabels) return `${d.value}`;
    const r = innerDiameter / 2;
    const rad = (d.percent / 100) * 2 * Math.PI;
    // 水平に置く文字が使える幅は、リングの厚み（innerRadius 0.5）と
    // ラベル位置の半径で測った弦のうち小さいほう。半円を超えると弦は再び縮んで
    // 100%で0になるため、π で頭打ちにする（最大のスライスほど名前が消えるのを防ぐ）。
    const chord = 2 * r * 0.75 * Math.sin(Math.min(rad, Math.PI) / 2);
    const available = Math.min(r * 0.5, chord);
    const withName = `${d.id} ${pct}`;
    return estimateTextWidth(withName, labelFontSize) <= available ? withName : pct;
  };

  // ドーナツ中央に合計人数を表示する独自レイヤー。
  const CenteredTotal = ({ centerX, centerY }: PieCustomLayerProps<PieDatum>) => (
    <g>
      <text
        x={centerX}
        y={centerY - 10}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#3a3530"
        fontSize={24}
        fontWeight={600}
      >
        {totalCount}
      </text>
      <text
        x={centerX}
        y={centerY + 14}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#6b6258"
        fontSize={12}
      >
        人
      </text>
    </g>
  );

  return (
    <div>
      <ChartFilterControls
        dynastyOptions={dynastyOptions}
        dynastyValue={dynastyValue}
        onDynastyChange={setDynastyValue}
        categoryValue={categoryValue}
        onCategoryChange={setCategoryValue}
        sortDirection={order}
        onSortDirectionChange={setOrder}
        sortLabel={{ asc: "カテゴリ順（既定）", desc: "件数の多い順" }}
        resultCount={totalCount}
        resultUnit="人"
      />
      {/* @nivo/pieはSVGへのariaLabel指定に未対応のため、コンテナ側にrole="img"と
          アクセシブルネームを付け、SVG自体はrole="presentation"にする
          （Lighthouse svg-img-alt対応）。 */}
      <div
        ref={chartBoxRef}
        style={{ height }}
        role="img"
        aria-label={`${chartLabel}の円グラフ`}
      >
        <ResponsivePie
          data={pieData}
          role="presentation"
          theme={nivoTheme}
          colors={(d) => fillOf(d.id as string)}
          margin={{ top: 28, right: sideMargin, bottom: 28, left: sideMargin }}
          innerRadius={0.5}
          padAngle={1.5}
          cornerRadius={2}
          activeOuterRadiusOffset={6}
          borderWidth={1}
          borderColor={(d) => edgeOf(d.data.id)}
          // 列が狭いと外側ラベルは弧の縁から52px＋文字幅を消費し、どんなmarginでも
          // コンテナに収まらない（375pxでは半径0の円でも足りない）。収まらない幅では
          // 外側ラベルを出さず、割合を弧の中に置いて直下の凡例と表で識別させる。
          arcLinkLabel={(d) => `${d.id} ${d.data.percent}%`}
          arcLinkLabelsSkipAngle={useOutsideLabels ? 4 : 360}
          arcLinkLabelsTextColor="#3a3530"
          // 引き出し線は弧と同じ色相の82%濃度（＝弧の縁と同じ）で引く。既定の
          // { from: "color" } だと55%の塗りをそのまま継いで対地色1.44:1まで落ち、
          // 弧とラベルの対応を示す唯一の線が見えなくなる。
          arcLinkLabelsColor={(d) => edgeOf(d.id as string)}
          // 外側ラベルを出すときは人数（割合は外側ラベルが運ぶ）、出さないときは
          // 割合と、弧に入るならカテゴリ名も弧の中に置く。
          arcLabel={(d) => arcLabelOf(d.data)}
          arcLabelsSkipAngle={12}
          // 弧の上に載せる文字色は混色後の実値からコントラスト比で選ぶ
          // （生の彩度を前提にした固定リストは淡彩化後には当てはまらない）。
          arcLabelsTextColor={(d) => readableTextOn(fillOf(d.id as string))}
          layers={
            useOutsideLabels
              ? ["arcs", "arcLabels", "arcLinkLabels", CenteredTotal]
              : ["arcs", "arcLabels", CenteredTotal]
          }
          legends={[]}
          tooltip={({ datum }) => (
            // Nivoのツールチップラッパーは幅0のアンカーに絶対配置されるため、max-widthだけだと
            // 数文字ごとに折り返された細長い箱になる。width: max-contentで内容幅に広げる。
            <div
              className="rounded-md border border-border bg-background p-3 text-xs text-foreground shadow-md"
              style={{ width: "max-content", maxWidth: 260 }}
            >
              <div className="font-medium">{datum.label}</div>
              <div className="mt-0.5 text-muted-foreground">
                {datum.value}人（{datum.data.percent}%）
              </div>
              <p className="mt-1 text-muted-foreground">
                {categoryDescriptions[datum.id as string]}
              </p>
            </div>
          )}
        />
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2">
        {entries.map((d) => (
          <HoverCard key={d.category} openDelay={100} closeDelay={50}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm text-foreground/80 hover:text-foreground"
              >
                <span
                  className="inline-block size-3 rounded-full"
                  style={swatchStyle(d.category)}
                />
                {d.category}
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-64 text-sm">
              <div className="font-medium">{d.category}</div>
              <p className="mt-1 text-muted-foreground">
                {categoryDescriptions[d.category]}
              </p>
            </HoverCardContent>
          </HoverCard>
        ))}
      </div>
      <TableDetails summary="表で見る">
        {() => (
          <div className="mt-2 max-h-[480px] overflow-y-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">カテゴリ</th>
                  <th className="px-3 py-2 text-right font-medium">人数</th>
                  <th className="px-3 py-2 text-right font-medium">割合</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((d) => (
                  <tr key={d.category} className="border-t border-border">
                    <td className="px-3 py-1.5">
                      <span
                        className="mr-2 inline-block size-2.5 rounded-full align-middle"
                        style={swatchStyle(d.category)}
                      />
                      {d.category}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {d.count}人
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {percentOf(d.count)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TableDetails>
    </div>
  );
}
