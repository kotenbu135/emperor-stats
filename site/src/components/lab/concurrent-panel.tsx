"use client";

// 候補7「同時に何人が帝号を持っていたか」の折れ線。
//
// **2本引くのが本体**。検討記録が「14人」を否定して「10人」を採ったのは数え方の違いで、
// 年単位（その年のうちに帝号を持った人数）と日単位（その年の最大同時在位数）を
// 並べて初めて、見出しの言葉をどちらにするかが判断できる。

import { LineChart, LineLegend, type LineSeries } from "@/components/charts/line-chart";

const SERIES: LineSeries[] = [
  { key: "yearBased", name: "年単位（その年のうちに帝号を持った人数）", series: 4 },
  { key: "dayBased", name: "日単位（その年の最大同時在位数）", series: 1 },
];

/** 横軸の目盛り。歴史紀年なので0年は無い。 */
const TICKS = [-200, 0.0001, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800];

function yearLabel(y: number): string {
  const n = Math.round(y);
  return n < 0 ? `前${-n}` : `${n}`;
}

export function ConcurrentPanel({
  points,
  usable,
  total,
}: {
  points: { year: number; yearBased: number; dayBased: number }[];
  usable: number;
  total: number;
}) {
  return (
    <div>
      <LineChart
        className="h-72"
        data={points}
        index="year"
        series={SERIES}
        ticks={TICKS}
        tickFormatter={yearLabel}
        labelFormatter={(v) => `${yearLabel(Number(v))}年`}
        valueFormatter={(v) => `${v}人`}
        xAxisLabel="年"
        yAxisWidth={36}
        ariaLabel="年ごとの同時在位数（年単位と日単位の2本）"
      />
      <LineLegend
        series={SERIES}
        notes={[`全${total}在位`, `日付で区間を作れる${usable}在位`]}
      />
    </div>
  );
}
