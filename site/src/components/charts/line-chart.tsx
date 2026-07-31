"use client";

// 折れ線。**vendored Tremor には LineChart を入れていない**（BarChart だけで890行あり、
// 折れ線を1本引くために同じ規模をもう1本持つ理由が無い）。Recharts 2.15.4 を直接使い、
// 軸・グリッド・ツールチップの見た目は `components/tremor/BarChart.tsx` に合わせてある
// ので、同じ盤面に並べても2つ目のデザインシステムには見えない。
//
// 注意:
//  - **`isAnimationActive={false}` を明示する。** globals.css の
//    `prefers-reduced-motion` 一括指定は CSS アニメーションしか止められず、
//    Recharts の JS アニメーションは別に止める必要がある（site/AGENTS.md）
//  - 色は `--series-*`（globals.css が唯一の正）。ここで実値を書かない
//  - 系列名は必ず凡例に出す。`--series-*` の3色は面 #ffffff に対して 3:1 未満で、
//    「可視ラベルがあること」が免除条件になっている

import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

export interface LineSeries {
  /** データのキー。 */
  key: string;
  /** 凡例・ツールチップに出す名前。 */
  name: string;
  /** globals.css の --series-N（1〜8）。 */
  series: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
}

const STROKE_CLASS: Record<number, string> = {
  1: "stroke-series-1",
  2: "stroke-series-2",
  3: "stroke-series-3",
  4: "stroke-series-4",
  5: "stroke-series-5",
  6: "stroke-series-6",
  7: "stroke-series-7",
  8: "stroke-series-8",
};

const BG_CLASS: Record<number, string> = {
  1: "bg-series-1",
  2: "bg-series-2",
  3: "bg-series-3",
  4: "bg-series-4",
  5: "bg-series-5",
  6: "bg-series-6",
  7: "bg-series-7",
  8: "bg-series-8",
};

interface TooltipPayloadItem {
  dataKey?: string | number;
  value?: number;
}

function ChartTooltip({
  active,
  payload,
  label,
  series,
  labelFormatter,
  valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  series: LineSeries[];
  labelFormatter: (value: string | number) => string;
  valueFormatter: (value: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-border bg-card text-sm shadow-md">
      <div className="border-b border-inherit px-4 py-2">
        <p className="font-medium text-foreground">
          {label === undefined ? "" : labelFormatter(label)}
        </p>
      </div>
      <div className="space-y-1 px-4 py-2">
        {payload.map((item) => {
          const s = series.find((x) => x.key === item.dataKey);
          if (!s || item.value === undefined) return null;
          return (
            <div
              key={s.key}
              className="flex items-center justify-between space-x-8"
            >
              <div className="flex items-center space-x-2">
                <span
                  aria-hidden
                  className={cn("size-2 shrink-0 rounded-sm", BG_CLASS[s.series])}
                />
                <p className="whitespace-nowrap text-foreground">{s.name}</p>
              </div>
              <p className="whitespace-nowrap text-right font-medium tabular-nums text-foreground">
                {valueFormatter(item.value)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LineChart({
  data,
  index,
  series,
  className,
  yAxisWidth = 44,
  xAxisLabel,
  yAxisLabel,
  yDomain,
  ticks,
  valueFormatter = (v) => String(v),
  labelFormatter = (v) => String(v),
  tickFormatter,
  ariaLabel,
  curveType = "linear",
}: {
  data: Record<string, number>[];
  /** 横軸に使うキー。 */
  index: string;
  series: LineSeries[];
  className?: string;
  yAxisWidth?: number;
  xAxisLabel?: string;
  yAxisLabel?: string;
  yDomain?: [number, number];
  /** 横軸の目盛り位置（省略時は Recharts の自動）。 */
  ticks?: number[];
  valueFormatter?: (value: number) => string;
  labelFormatter?: (value: string | number) => string;
  tickFormatter?: (value: number) => string;
  /** 図そのものの読み上げ名。凡例と数値は下の凡例リストが担う。 */
  ariaLabel?: string;
  /** 線の結び方。**既定は linear** — 整数を数え上げた系列に monotone を当てると、
   *  データに無い山と谷を勝手に作る。段の系列（人数など）は "stepAfter"。 */
  curveType?: "linear" | "stepAfter" | "monotone";
}) {
  return (
    <div className={cn("w-full", className)}>
      <div className="h-full w-full" role="img" aria-label={ariaLabel}>
        <ResponsiveContainer>
          <RechartsLineChart
            data={data}
            margin={{ top: 5, right: 8, bottom: xAxisLabel ? 24 : 4, left: 0 }}
          >
            <CartesianGrid className="stroke-border stroke-1" vertical={false} />
            <XAxis
              dataKey={index}
              type="number"
              domain={["dataMin", "dataMax"]}
              ticks={ticks}
              tickFormatter={tickFormatter}
              tick={{ transform: "translate(0, 6)" }}
              fill=""
              stroke=""
              className="fill-muted-foreground text-xs"
              tickLine={false}
              axisLine={false}
              label={
                xAxisLabel
                  ? {
                      value: xAxisLabel,
                      position: "insideBottom",
                      offset: -14,
                      className: "fill-foreground text-xs font-medium",
                    }
                  : undefined
              }
            />
            <YAxis
              width={yAxisWidth}
              domain={yDomain}
              tickFormatter={valueFormatter}
              tick={{ transform: "translate(-3, 0)" }}
              fill=""
              stroke=""
              className="fill-muted-foreground text-xs"
              tickLine={false}
              axisLine={false}
              label={
                yAxisLabel
                  ? {
                      value: yAxisLabel,
                      position: "insideLeft",
                      angle: -90,
                      style: { textAnchor: "middle" },
                      className: "fill-foreground text-xs font-medium",
                    }
                  : undefined
              }
            />
            <Tooltip
              wrapperStyle={{ outline: "none" }}
              isAnimationActive={false}
              cursor={{ className: "stroke-border stroke-1" }}
              content={({ active, payload, label }) => (
                <ChartTooltip
                  active={active}
                  payload={payload as TooltipPayloadItem[] | undefined}
                  label={label as string | number | undefined}
                  series={series}
                  labelFormatter={labelFormatter}
                  valueFormatter={valueFormatter}
                />
              )}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.name}
                type={curveType}
                dot={false}
                strokeWidth={2}
                className={STROKE_CLASS[s.series]}
                stroke=""
                // globals.css の reduced-motion 一括指定では止まらない（JS アニメーション）。
                isAnimationActive={false}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** 折れ線の凡例（系列名を必ず見せる）。図の外に置くので、図の高さを食わない。 */
export function LineLegend({
  series,
  notes,
}: {
  series: LineSeries[];
  /** 系列ごとの補足（母集団など）。series と同じ並び。 */
  notes?: (string | undefined)[];
}) {
  return (
    <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {series.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn("h-0.5 w-4 shrink-0 rounded-full", BG_CLASS[s.series])}
          />
          <span className="text-xs text-muted-foreground">
            {s.name}
            {notes?.[i] ? (
              <span className="ml-1 tabular-nums">{notes[i]}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
