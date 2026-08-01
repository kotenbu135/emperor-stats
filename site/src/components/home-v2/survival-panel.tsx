"use client";

// 在位継続率カーブ（盤面3段目・右）。KPI「平均在位期間」の歪みを直す図。
//
// **線は1本＝全365名**（2026-08-01 ユーザー決定）。`/lab` では「日まで確定した270名」を
// 重ねたが、差は5年で6ポイントと図では読み取れず、その線は「どの人物の日付を復元できたか」の
// 分布を混ぜる。母集団の断り書きは図の下の1行が持つ。

import { LineChart, LineLegend, type LineSeries } from "@/components/charts/line-chart";
import type { HomeReignSurvival } from "@/lib/emperors";

const SERIES: LineSeries[] = [
  { key: "percent", name: "まだ在位している皇帝の割合", series: 1 },
];

const TICKS = [0, 10, 20, 30, 40, 50];

export function SurvivalPanel({ data }: { data: HomeReignSurvival }) {
  return (
    <div className="mt-5">
      <LineChart
        className="h-64"
        data={data.curve}
        index="years"
        series={SERIES}
        ticks={TICKS}
        tickFormatter={(v) => String(v)}
        labelFormatter={(v) => `即位から${v}年`}
        valueFormatter={(v) => `${v}%`}
        yDomain={[0, 100]}
        xAxisLabel="即位からの経過年"
        yAxisWidth={40}
        ariaLabel="即位からの経過年ごとに、まだ在位している皇帝の割合"
      />
      <LineLegend series={SERIES} notes={[`全${data.count}名`]} />
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {`在位日数は年365換算の概算（${data.approxOnlyCount}名は日まで下りていない）。複数回在位した${data.multiReignCount}名は合算値で数えている。`}
      </p>
    </div>
  );
}
