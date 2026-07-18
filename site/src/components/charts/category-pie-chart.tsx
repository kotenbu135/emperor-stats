"use client";

import { useState } from "react";
import { ResponsivePie, type PieCustomLayerProps } from "@nivo/pie";
import {
  categoryColorMaps,
  darkSlices,
  nivoTheme,
} from "@/components/charts/nivo-theme";
import {
  ChartFilterControls,
  type SortDirection,
} from "@/components/charts/chart-filter-controls";
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
  const [dynastyValue, setDynastyValue] = useState("all");
  const [categoryValue, setCategoryValue] = useState<DynastyCategory | "all">("all");
  // "asc" = カテゴリ順（既定・固定順で識別性を保つ）, "desc" = 件数の多い順
  const [order, setOrder] = useState<SortDirection>("asc");
  const [tableOpen, setTableOpen] = useState(false);

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

  // カテゴリの意味に対応した固定色（nivo-theme.tsでdataviz検証済み）。
  const colorMap = categoryColorMaps[metricKey];
  const fallbackColor = "#6b6258";

  let entries = categoryOrder
    .filter((c) => (counts.get(c) ?? 0) > 0)
    .map((c) => ({ category: c, count: counts.get(c) ?? 0 }));
  if (order === "desc") {
    entries = [...entries].sort((a, b) => b.count - a.count);
  }

  const pieData: PieDatum[] = entries.map((d) => ({
    id: d.category,
    label: d.category,
    value: d.count,
  }));
  const totalCount = entries.reduce((sum, d) => sum + d.count, 0);
  const percentOf = (value: number) =>
    totalCount > 0 ? Math.round((value / totalCount) * 100) : 0;

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
      <div style={{ height }} role="img" aria-label={`${chartLabel}の円グラフ`}>
        <ResponsivePie
          data={pieData}
          role="presentation"
          theme={nivoTheme}
          colors={(d) => colorMap[d.id as string] ?? fallbackColor}
          margin={{ top: 28, right: 32, bottom: 28, left: 32 }}
          innerRadius={0.5}
          padAngle={1.5}
          cornerRadius={2}
          activeOuterRadiusOffset={6}
          borderWidth={0}
          arcLinkLabel={(d) => `${d.id} ${percentOf(d.value)}%`}
          arcLinkLabelsSkipAngle={4}
          arcLinkLabelsTextColor="#3a3530"
          arcLinkLabelsColor={{ from: "color" }}
          arcLabelsSkipAngle={12}
          arcLabelsTextColor={(d) =>
            darkSlices.has(colorMap[d.id as string] ?? "") ? "#f5f1e8" : "#3a3530"
          }
          layers={["arcs", "arcLabels", "arcLinkLabels", CenteredTotal]}
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
                {datum.value}人（{percentOf(datum.value)}%）
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
                  style={{ backgroundColor: colorMap[d.category] ?? fallbackColor }}
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
      <details
        className="mt-3"
        open={tableOpen}
        onToggle={(e) => setTableOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
          表で見る
        </summary>
        {tableOpen && (
          <div className="mt-2 rounded-md border border-border">
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
                        style={{
                          backgroundColor: colorMap[d.category] ?? fallbackColor,
                        }}
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
      </details>
    </div>
  );
}
