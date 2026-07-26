"use client";

import { useEffect, useState } from "react";
import { ResponsiveBar, type BarDatum } from "@nivo/bar";
import { categoryColorMaps, nivoTheme } from "@/components/charts/nivo-theme";
import { DYNASTY_EDGE_MIX, DYNASTY_FILL_MIX, mixHex } from "@/lib/dynasty-colors";
import {
  FixedTooltip,
  MARGIN_RIGHT,
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

// 色の割り当てそのものは nivo-theme.ts のまま。塗りは地色に混ぜた濃度で出す
// （/timeline・/kinship と同じ規則。生の彩度だとグラフだけクロームから浮く）。
const rawColors = categoryColorMaps.deathCauseCategory;
const fillOf = (c: DeathCauseCategory) => mixHex(rawColors[c], DYNASTY_FILL_MIX);
const edgeOf = (c: DeathCauseCategory) => mixHex(rawColors[c], DYNASTY_EDGE_MIX);
/** 凡例・ツールチップのスウォッチ。塗りは実際のセグメントと同じ55%混色。10px角の
 *  マークは面積が小さく淡彩だけだと地に埋もれるため、縁だけ82%で締める
 *  （セグメント本体の区切りは地色スペーサーなので、そこは意図的に揃えない）。 */
const swatchStyle = (c: DeathCauseCategory) => ({
  backgroundColor: fillOf(c),
  border: `1px solid ${edgeOf(c)}`,
});

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
  // ホバー状態はチャート本体に持たない（セグメント通過ごとの全体再レンダリング防止）。
  const { setTip, TipOutlet } = useTipOutlet<SegmentTip>();

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

  // 軸ドメイン・マージン・行ウィンドウイングの定型は共通フックにまとめている。
  const maxValue = Math.max(1, ...chartData.map((d) => d.total));
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
              style={swatchStyle(c)}
            />
            {c}
          </span>
        ))}
      </div>
      <WindowedChartFrame
        axisLabel="人"
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
              keys={deathCauseCategoryOrder}
              indexBy="id"
              layout="horizontal"
              theme={nivoTheme}
              // role="img"のSVGに必要なアクセシブルネーム（Lighthouse svg-img-alt対応）。
              ariaLabel={`${unit === "dynasty" ? "王朝" : "時代"}別の死因内訳の積み上げ横棒グラフ`}
              colors={({ id }) => fillOf(id as DeathCauseCategory)}
              // 積み上げセグメント間はサーフェス色の枠線で区切る（dataviz skillのスペーサー指針）。
              // 同色系の縁で締めたくなるが、この面は色以外の符号化を持たないため、
              // カテゴリ色と無関係な地色のスペーサーでないと2型色覚下で境界ごと溶ける
              // （淡彩化後の8色は2型色覚シミュレーションで最小ペア間ΔE 11.6→6.1まで接近する。
              //   地色スペーサーなら全8色に対しΔE 17.8以上を保つ）。
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
                if (!hoverAllowed()) return;
                const row = rowByKey.get(String(datum.indexValue));
                if (!row) return;
                setTip({
                  rowLabel: row.label,
                  category: datum.id as DeathCauseCategory,
                  count: datum.value ?? 0,
                  total: row.emperorCount,
                  x: event.clientX,
                  y: event.clientY,
                });
              }}
              onMouseLeave={() => setTip(null)}
              animate={false}
            />
      </WindowedChartFrame>
      <TipOutlet
        render={(tip) => (
          <FixedTooltip x={tip.x} y={tip.y}>
            <div
              className="rounded-md border border-border bg-background p-3 text-xs text-foreground shadow-md"
              style={{ width: "max-content", maxWidth: 240 }}
            >
              <div className="font-medium">{tip.rowLabel}</div>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className="inline-block size-2.5 rounded-[3px]"
                  style={swatchStyle(tip.category)}
                />
                {tip.category}：{tip.count}名（
                {Math.round((tip.count / tip.total) * 100)}%）
              </div>
            </div>
          </FixedTooltip>
        )}
      />
      <TableDetails summary={<>表で見る（全{sorted.length}件）</>}>
        {() => (
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
      </TableDetails>
    </div>
  );
}
