"use client";

// 候補8「在位継続率カーブ」。即位からN年後に、まだ在位している皇帝が何%残っているか。
//
// **2本引くのが本体**。approxDays は年=365換算の概算で、日まで下りていない95名は
// 在位が短い側に偏る。除いた側（270名）の曲線が上へ持ち上がるところが、
// 「欠損ゼロ」と言えるのが概算値を使う場合だけであることの見え方になる。

import { LineChart, LineLegend, type LineSeries } from "@/components/charts/line-chart";

const SERIES: LineSeries[] = [
  { key: "all", name: "全365名（approxDays＝年365換算の概算）", series: 4 },
  { key: "exact", name: "日まで確定した270名", series: 1 },
];

const TICKS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

export function SurvivalPanel({
  curve,
}: {
  curve: { years: number; all: number; exact: number }[];
}) {
  return (
    <div>
      <LineChart
        className="h-72"
        data={curve}
        index="years"
        series={SERIES}
        ticks={TICKS}
        tickFormatter={(v) => String(v)}
        labelFormatter={(v) => `即位から${v}年`}
        valueFormatter={(v) => `${v}%`}
        yDomain={[0, 100]}
        xAxisLabel="即位からの経過年"
        yAxisWidth={40}
        ariaLabel="在位継続率カーブ（全365名と日まで確定した270名の2本）"
      />
      <LineLegend series={SERIES} />
    </div>
  );
}
