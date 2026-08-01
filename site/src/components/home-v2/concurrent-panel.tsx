"use client";

// 同時に帝号を持っていた人数（盤面3段目・左）。
//
// **線は1本**（2026-08-01 ユーザー決定）。`/lab` の検討では年単位と日単位の2本を並べたが、
// 日単位は在位に日付が無い33年で0へ落ち、折れ線では「皇帝がいなかった年」に見えてしまう。
// 集計側（emperors.ts の getConcurrentReigns）で日付の無い側だけ在位年で埋めたので、
// **全374在位が区間になり、残る0人の年は実在の空位だけ**になっている。

import { LineChart, LineLegend, type LineSeries } from "@/components/charts/line-chart";
import type { HomeConcurrentReigns } from "@/lib/emperors";

const SERIES: LineSeries[] = [
  { key: "count", name: "同時に帝号を持っていた人数", series: 1 },
];

/** 横軸の目盛り。歴史紀年なので0年は無い（0.0001 で「1年」の位置へ寄せる）。 */
const TICKS = [-200, 0.0001, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800];

function yearLabel(y: number): string {
  const n = Math.round(y);
  return n < 0 ? `前${-n}` : `${n}`;
}

export function ConcurrentPanel({ data }: { data: HomeConcurrentReigns }) {
  // 点は段の変化年だけなので、ツールチップの見出しは**その段が続く範囲**で出す
  // （点の年だけを出すと、平らな区間の途中を指しているのに段の開始年が見出しに立つ）。
  const spanLabels = new Map(
    data.points.map((p) => [
      p.year,
      p.year === p.endYear
        ? `${yearLabel(p.year)}年`
        : `${yearLabel(p.year)}〜${yearLabel(p.endYear)}年`,
    ]),
  );

  return (
    <div className="mt-5">
      <LineChart
        className="h-64"
        data={data.points}
        index="year"
        series={SERIES}
        ticks={TICKS}
        // 人数は年ごとの段なので階段で結ぶ（曲線で結ぶとデータに無い山と谷が出る）。
        curveType="stepAfter"
        tickFormatter={yearLabel}
        labelFormatter={(v) =>
          spanLabels.get(Number(v)) ?? `${yearLabel(Number(v))}年`
        }
        valueFormatter={(v) => `${v}人`}
        // ピークは図の上に焼き付ける。**ホバーでは指せない** — 横軸2133年を609pxへ
        // 描くので1px＝3.8年で、618〜622年は1pxに潰れて最寄り点になれない。
        markers={[
          {
            x: data.peak.year,
            y: data.peak.count,
            label: `${data.peak.dateLabel} ${data.peak.count}人`,
          },
        ]}
        xAxisLabel="年"
        yAxisWidth={36}
        ariaLabel={`${data.range.fromLabel}から${data.range.toLabel}までの、同時に帝号を持っていた人数の推移`}
      />
      <LineLegend
        series={SERIES}
        notes={[`${data.range.fromLabel}〜${data.range.toLabel}`]}
      />
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {`全${data.coverage.total}在位を日付で区間にして重なりを数えた（日付が無い${data.coverage.filled}件は在位年で埋めているので上限側の見積り）。1人だけだった年は${data.soleYears}年で${data.solePercent}%。${data.excluded
          .map((e) => e.name)
          .join("・")}は${data.range.toLabel}より後にも在位しており、表示範囲の外にある。`}
      </p>
    </div>
  );
}
