"use client";

import { useEffect, useState } from "react";
import { ResponsiveBar, type BarDatum } from "@nivo/bar";
import {
  nivoTheme,
  rankingSeriesColor,
} from "@/components/charts/nivo-theme";
import {
  FixedTooltip,
  MARGIN_RIGHT,
  MARGIN_TOP,
  OutsideValueLabels,
  RowOverlay,
  TableDetails,
  useChartWidth,
  useRankingChartLayout,
  useTipOutlet,
  WindowedChartFrame,
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
  // ホバー状態はチャート本体に持たない（バー通過ごとの全体再レンダリング防止）。
  const { setTip, TipOutlet } = useTipOutlet<{
    row: GroupAggRow;
    x: number;
    y: number;
  }>();

  const { chartAreaRef, chartWidth } = useChartWidth();

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

  // 軸ドメイン・マージン・行ウィンドウイングの定型は共通フックにまとめている。
  const maxValue = Math.max(1, ...chartData.map((d) => d.value));
  const {
    domainMax,
    ticks,
    marginLeft,
    truncate,
    idToLabel,
    chartHeight,
    windowData,
    isFullRange,
    scrollRef,
    start,
    end,
    handleScroll,
    hoverAllowed,
  } = useRankingChartLayout(chartData, maxValue, chartWidth);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [scrollRef, unit, categoryValue, sort]);

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
      <WindowedChartFrame
        axisLabel="年"
        chartWidth={chartWidth}
        marginLeft={marginLeft}
        domainMax={domainMax}
        ticks={ticks}
        scrollRef={scrollRef}
        chartAreaRef={chartAreaRef}
        chartHeight={chartHeight}
        start={start}
        end={end}
        isFullRange={isFullRange}
        onScroll={() => {
          setTip(null);
          handleScroll();
        }}
      >
        <ResponsiveBar
              data={windowData as unknown as BarDatum[]}
              keys={["value"]}
              indexBy="id"
              layout="horizontal"
              theme={nivoTheme}
              // role="img"のSVGに必要なアクセシブルネーム（Lighthouse svg-img-alt対応）。
              ariaLabel={`${unit === "dynasty" ? "王朝" : "時代"}別の平均在位年数の横棒グラフ`}
              colors={[rankingSeriesColor]}
              margin={{ top: MARGIN_TOP, right: MARGIN_RIGHT, bottom: 6, left: marginLeft }}
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
              animate={false}
            />
            {/* ホバーは行全体を覆うオーバーレイで受ける（平均在位が短い政権はバーが
                数pxしかなく狙えないため）。ranking-bar-chart.tsxと同じ方式。 */}
            <RowOverlay
              rows={chartData.slice(start, end)}
              hoverAllowed={hoverAllowed}
              onHover={(d, event) =>
                setTip({ row: d.row, x: event.clientX, y: event.clientY })
              }
              onLeave={() => setTip(null)}
            />
      </WindowedChartFrame>
      <TipOutlet
        render={(tip) => (
          <FixedTooltip x={tip.x} y={tip.y}>
            <div
              className="rounded-md border border-border bg-background p-3 text-xs text-foreground shadow-md"
              style={{ width: "max-content", maxWidth: 240 }}
            >
              <div className="font-medium">{tip.row.label}</div>
              {unit === "dynasty" && (
                <div className="text-muted-foreground">{tip.row.era}</div>
              )}
              <div className="mt-1">
                皇帝{tip.row.emperorCount}名・平均在位{avgLabel(tip.row)}
              </div>
              <div className="text-muted-foreground">
                最長：{tip.row.longest.name}（{tip.row.longest.durationLabel}）
              </div>
            </div>
          </FixedTooltip>
        )}
      />
      <TableDetails summary={<>表で見る（全{sorted.length}件）</>}>
        {() => (
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
      </TableDetails>
    </div>
  );
}
