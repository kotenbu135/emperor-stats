"use client";

import { useEffect, useRef, useState } from "react";
import { ResponsiveBar, type BarDatum } from "@nivo/bar";
import {
  integerTickValues,
  nivoTheme,
  rankingSeriesColor,
} from "@/components/charts/nivo-theme";
import {
  AxisHeader,
  FixedTooltip,
  MARGIN_RIGHT,
  OutsideValueLabels,
  ROW_HEIGHT,
  SCROLL_MAX_HEIGHT,
  useChartWidth,
} from "@/components/charts/scroll-bar-chart";
import {
  aggregateByGroup,
  type GroupAggRow,
  type GroupUnit,
} from "@/components/charts/dynasty-aggregate";
import { GroupFilterControls, type GroupSort } from "@/components/charts/group-filter-controls";
import type { DynastyCategory, EmperorRecord } from "@/lib/emperor-types";

function avgLabel(row: GroupAggRow): string {
  return `約${(row.avgReignDays / 365).toFixed(1)}年`;
}

export function DynastyAvgReignChart({ records }: { records: EmperorRecord[] }) {
  const [unit, setUnit] = useState<GroupUnit>("dynasty");
  const [categoryValue, setCategoryValue] = useState<DynastyCategory | "all">("all");
  const [sort, setSort] = useState<GroupSort>("desc");
  const [tableOpen, setTableOpen] = useState(false);
  const [hoverTip, setHoverTip] = useState<{
    row: GroupAggRow;
    x: number;
    y: number;
  } | null>(null);

  const { chartAreaRef, chartWidth } = useChartWidth();
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [unit, categoryValue, sort]);

  const chronological = aggregateByGroup(records, unit, categoryValue);
  const sorted =
    sort === "chrono"
      ? chronological
      : [...chronological].sort((a, b) =>
          sort === "desc"
            ? b.avgReignDays - a.avgReignDays
            : a.avgReignDays - b.avgReignDays,
        );

  // 順位は「長い順の順位」で固定表示する（並び替えても変わらない）。
  const rankByKey = new Map(
    [...chronological]
      .sort((a, b) => b.avgReignDays - a.avgReignDays)
      .map((row, i) => [row.key, i + 1]),
  );

  const chartData = sorted.map((row) => ({
    id: row.key,
    label: `${rankByKey.get(row.key)}. ${row.label}（${row.emperorCount}名）`,
    value: row.avgReignDays / 365,
    formatted: avgLabel(row),
    row,
  }));

  const maxValue = Math.max(1, ...chartData.map((d) => d.value));
  const domainMax = Math.ceil(maxValue);
  const ticks = integerTickValues(maxValue);

  const maxLabelLength = Math.max(0, ...chartData.map((d) => d.label.length));
  const marginLeft = Math.min(
    260,
    Math.max(100, maxLabelLength * 11 + 24),
    Math.max(90, Math.floor(chartWidth * 0.42)),
  );
  const charBudget = Math.max(4, Math.floor((marginLeft - 16) / 11));
  const truncate = (label: string) =>
    label.length <= charBudget ? label : `${label.slice(0, charBudget - 1)}…`;

  const displayData = [...chartData].reverse();
  const idToLabel = new Map(displayData.map((d) => [d.id, d.label]));
  const chartHeight = Math.max(chartData.length * ROW_HEIGHT + 12, 96);

  return (
    <div>
      <GroupFilterControls
        unit={unit}
        onUnitChange={setUnit}
        categoryValue={categoryValue}
        onCategoryChange={setCategoryValue}
        sort={sort}
        onSortChange={setSort}
        sortLabel={{ desc: "長い順", asc: "短い順" }}
      >
        <span className="pb-2 text-sm text-muted-foreground">
          全{sorted.length}件を表示中
        </span>
      </GroupFilterControls>
      <div className="rounded-md border border-border">
        <div className="border-b border-border">
          <AxisHeader
            width={chartWidth}
            marginLeft={marginLeft}
            domainMax={domainMax}
            ticks={ticks}
            label="年"
          />
        </div>
        <div
          ref={scrollRef}
          className="overflow-y-auto overscroll-contain"
          style={{ maxHeight: SCROLL_MAX_HEIGHT }}
          onScroll={() => setHoverTip(null)}
        >
          <div ref={chartAreaRef} style={{ height: chartHeight }}>
            <ResponsiveBar
              data={displayData as unknown as BarDatum[]}
              keys={["value"]}
              indexBy="id"
              layout="horizontal"
              theme={nivoTheme}
              colors={[rankingSeriesColor]}
              margin={{ top: 6, right: MARGIN_RIGHT, bottom: 6, left: marginLeft }}
              padding={0.35}
              borderRadius={3}
              valueScale={{ type: "linear", min: 0, max: domainMax, nice: false }}
              enableGridY={false}
              enableGridX
              gridXValues={ticks}
              axisLeft={{
                tickSize: 0,
                tickPadding: 8,
                format: (id: string) => truncate(idToLabel.get(id) ?? id),
              }}
              axisBottom={null}
              enableLabel={false}
              layers={["grid", "axes", "bars", OutsideValueLabels]}
              tooltip={() => null}
              onMouseEnter={(datum, event) => {
                const row = (datum.data as unknown as { row: GroupAggRow }).row;
                setHoverTip({ row, x: event.clientX, y: event.clientY });
              }}
              onMouseLeave={() => setHoverTip(null)}
              animate={false}
            />
          </div>
        </div>
      </div>
      {hoverTip && (
        <FixedTooltip x={hoverTip.x} y={hoverTip.y}>
          <div
            className="rounded-md border border-border bg-background p-3 text-xs text-foreground shadow-md"
            style={{ width: "max-content", maxWidth: 240 }}
          >
            <div className="font-medium">{hoverTip.row.label}</div>
            {unit === "dynasty" && (
              <div className="text-muted-foreground">{hoverTip.row.era}</div>
            )}
            <div className="mt-1">
              皇帝{hoverTip.row.emperorCount}名・平均在位{avgLabel(hoverTip.row)}
            </div>
            <div className="text-muted-foreground">
              最長：{hoverTip.row.longest.name}（{hoverTip.row.longest.durationLabel}）
            </div>
          </div>
        </FixedTooltip>
      )}
      <details
        className="mt-3"
        open={tableOpen}
        onToggle={(e) => setTableOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
          表で見る（全{sorted.length}件）
        </summary>
        {tableOpen && (
          <div className="mt-2 max-h-[480px] overflow-y-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-secondary text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">順位</th>
                  <th className="px-3 py-2 font-medium">
                    {unit === "dynasty" ? "王朝" : "時代"}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">皇帝数</th>
                  <th className="px-3 py-2 text-right font-medium">平均在位</th>
                  <th className="px-3 py-2 font-medium">最長在位</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.key} className="border-t border-border">
                    <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                      {rankByKey.get(row.key)}
                    </td>
                    <td className="px-3 py-1.5">{row.label}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {row.emperorCount}名
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {avgLabel(row)}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {row.longest.name}（{row.longest.durationLabel}）
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
