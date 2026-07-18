"use client";

import { useEffect, useState } from "react";
import { ResponsiveBar, type BarDatum } from "@nivo/bar";
import {
  categoryColorMaps,
  integerTickValues,
  nivoTheme,
} from "@/components/charts/nivo-theme";
import {
  AxisHeader,
  FixedTooltip,
  MARGIN_RIGHT,
  ROW_HEIGHT,
  SCROLL_MAX_HEIGHT,
  useChartWidth,
  useWindowedRows,
} from "@/components/charts/scroll-bar-chart";
import {
  aggregateByGroup,
  type GroupAggRow,
  type GroupUnit,
} from "@/components/charts/dynasty-aggregate";
import {
  GroupFilterControls,
  type GroupSort,
} from "@/components/charts/group-filter-controls";
import {
  deathCauseCategoryOrder,
  type DeathCauseCategory,
  type DynastyCategory,
  type EmperorRecord,
} from "@/lib/emperor-types";

const colors = categoryColorMaps.deathCauseCategory;

interface SegmentTip {
  rowLabel: string;
  category: DeathCauseCategory;
  count: number;
  total: number;
  x: number;
  y: number;
}

export function DynastyDeathCauseChart({ records }: { records: EmperorRecord[] }) {
  const [unit, setUnit] = useState<GroupUnit>("dynasty");
  const [categoryValue, setCategoryValue] = useState<DynastyCategory | "all">("all");
  const [sort, setSort] = useState<GroupSort>("desc");
  const [tableOpen, setTableOpen] = useState(false);
  const [hoverTip, setHoverTip] = useState<SegmentTip | null>(null);

  const { chartAreaRef, chartWidth } = useChartWidth();

  const chronological = aggregateByGroup(records, unit, categoryValue);
  const sorted =
    sort === "chrono"
      ? chronological
      : [...chronological].sort((a, b) =>
          sort === "desc"
            ? b.emperorCount - a.emperorCount
            : a.emperorCount - b.emperorCount,
        );

  const chartData = sorted.map((row) => ({
    id: row.key,
    label: `${row.label}（${row.emperorCount}名）`,
    total: row.emperorCount,
    ...row.deathCauseCounts,
  }));

  const maxValue = Math.max(1, ...chartData.map((d) => d.total));
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

  // 行ウィンドウイング（ranking-bar-chart.tsxと同じ方式）。
  const rowCount = chartData.length;
  const { scrollRef, start, end, handleScroll } = useWindowedRows(rowCount);
  const windowData = displayData.slice(rowCount - end, rowCount - start);
  const isFullRange = start === 0 && end === rowCount;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [scrollRef, unit, categoryValue, sort]);

  const rowByKey = new Map<string, GroupAggRow>(sorted.map((r) => [r.key, r]));

  return (
    <div>
      <GroupFilterControls
        unit={unit}
        onUnitChange={setUnit}
        categoryValue={categoryValue}
        onCategoryChange={setCategoryValue}
        sort={sort}
        onSortChange={setSort}
        sortLabel={{ desc: "皇帝数の多い順", asc: "皇帝数の少ない順" }}
      >
        <span className="pb-2 text-sm text-muted-foreground">
          全{sorted.length}件を表示中
        </span>
      </GroupFilterControls>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {deathCauseCategoryOrder.map((c) => (
          <span key={c} className="flex items-center gap-1.5 text-xs text-foreground/90">
            <span
              className="inline-block size-2.5 rounded-[3px]"
              style={{ backgroundColor: colors[c] }}
            />
            {c}
          </span>
        ))}
      </div>
      <div className="rounded-md border border-border">
        <div className="border-b border-border">
          <AxisHeader
            width={chartWidth}
            marginLeft={marginLeft}
            domainMax={domainMax}
            ticks={ticks}
            label="人"
          />
        </div>
        <div
          ref={scrollRef}
          className="overflow-y-auto overscroll-contain"
          style={{ maxHeight: SCROLL_MAX_HEIGHT }}
          onScroll={() => {
            setHoverTip(null);
            handleScroll();
          }}
        >
          <div ref={chartAreaRef} className="relative" style={{ height: chartHeight }}>
            <div
              className="absolute inset-x-0"
              style={{
                top: isFullRange ? 0 : start * ROW_HEIGHT,
                height: isFullRange
                  ? chartHeight
                  : (end - start) * ROW_HEIGHT + 12,
              }}
            >
            <ResponsiveBar
              data={windowData as unknown as BarDatum[]}
              keys={deathCauseCategoryOrder}
              indexBy="id"
              layout="horizontal"
              theme={nivoTheme}
              // role="img"のSVGに必要なアクセシブルネーム（Lighthouse svg-img-alt対応）。
              ariaLabel={`${unit === "dynasty" ? "王朝" : "時代"}別の死因内訳の積み上げ横棒グラフ`}
              colors={({ id }) => colors[id as DeathCauseCategory]}
              // 積み上げセグメント間はサーフェス色の枠線で区切る（dataviz skillのスペーサー指針）。
              borderWidth={1}
              borderColor="#f5f1e8"
              margin={{ top: 6, right: MARGIN_RIGHT, bottom: 6, left: marginLeft }}
              padding={0.35}
              borderRadius={2}
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
              enableTotals
              totalsOffset={6}
              layers={["grid", "axes", "bars", "totals"]}
              tooltip={() => null}
              onMouseEnter={(datum, event) => {
                const row = rowByKey.get(String(datum.indexValue));
                if (!row) return;
                setHoverTip({
                  rowLabel: row.label,
                  category: datum.id as DeathCauseCategory,
                  count: datum.value ?? 0,
                  total: row.emperorCount,
                  x: event.clientX,
                  y: event.clientY,
                });
              }}
              onMouseLeave={() => setHoverTip(null)}
              animate={false}
            />
            </div>
          </div>
        </div>
      </div>
      {hoverTip && (
        <FixedTooltip x={hoverTip.x} y={hoverTip.y}>
          <div
            className="rounded-md border border-border bg-background p-3 text-xs text-foreground shadow-md"
            style={{ width: "max-content", maxWidth: 240 }}
          >
            <div className="font-medium">{hoverTip.rowLabel}</div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-[3px]"
                style={{ backgroundColor: colors[hoverTip.category] }}
              />
              {hoverTip.category}：{hoverTip.count}名（
              {Math.round((hoverTip.count / hoverTip.total) * 100)}%）
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
          <div className="mt-2 max-h-[480px] overflow-x-auto overflow-y-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-secondary text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">
                    {unit === "dynasty" ? "王朝" : "時代"}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">皇帝数</th>
                  {deathCauseCategoryOrder.map((c) => (
                    <th key={c} className="px-3 py-2 text-right font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.key} className="border-t border-border">
                    <td className="px-3 py-1.5">{row.label}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {row.emperorCount}
                    </td>
                    {deathCauseCategoryOrder.map((c) => (
                      <td
                        key={c}
                        className="px-3 py-1.5 text-right tabular-nums text-muted-foreground"
                      >
                        {row.deathCauseCounts[c] || 0}
                      </td>
                    ))}
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
