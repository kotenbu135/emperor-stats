// ランキング指標（RankingMetricKey）の値取得・表示フォーマットの共通ヘルパー。
// クライアントのランキング棒グラフ（ranking-bar-chart.tsx）とサーバーの上位10名
// テーブル（tables/top-ranked-table.tsx）で共用するため、"use client" を付けない
// 中立モジュールに置く（表示のブレ防止の単一情報源）。

import type { EmperorRecord, RankingMetricKey } from "@/lib/emperor-types";

/** 指標の値。年齢は生年不詳などで算出できない皇帝がいるためnullを返しうる。 */
export function rawMetricValue(
  r: EmperorRecord,
  metricKey: RankingMetricKey,
): number | null {
  if (metricKey === "reignYears") return r.reignYears;
  return r[metricKey];
}

export function formatMetricValue(
  r: EmperorRecord,
  metricKey: RankingMetricKey,
): string {
  if (metricKey === "reignYears") return r.reignDurationLabel;
  const value = r[metricKey];
  if (metricKey === "accessionAge" || metricKey === "deathAge") return `${value}歳`;
  return `${value}回`;
}

/** 0回の皇帝をグラフから省略する指標（回数系のみ）。在位期間の0日（1日未満）や
 *  年齢は歴史的事実としてそのままランキングに含める。 */
export function metricCollapsesZeros(metricKey: RankingMetricKey): boolean {
  return (
    metricKey !== "reignYears" &&
    metricKey !== "accessionAge" &&
    metricKey !== "deathAge"
  );
}
