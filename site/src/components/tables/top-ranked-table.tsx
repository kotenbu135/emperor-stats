// ランキング上位10名の静的リスト。ランキング棒グラフ（LazyMount配下のClient
// Component）は静的HTMLに<a>を出せないため、統計ページ→個別ページのクローラブルな
// 内部リンク・非JS環境のフォールバック・上位の即読を兼ねてサーバー側で描画する。
// 順位はビルド時計算のrecord.ranks（competition ranking・回数系は1回以上のみ・
// 年齢は判明者のみ）をそのまま使い、チャート・詳細ダイアログと必ず一致させる。

import Link from "next/link";
import type { EmperorRecord, RankingMetricKey } from "@/lib/emperor-types";
import { formatMetricValue } from "@/lib/ranking-metrics";

export function TopRankedTable({
  records,
  metricKey,
  title,
  count = 10,
}: {
  records: EmperorRecord[];
  metricKey: RankingMetricKey;
  /** 見出し（例: "在位期間の上位10名"・"即位時年齢の若い順10名"）。 */
  title: string;
  count?: number;
}) {
  // 同順位（タイ）内の並びはデータ順（おおむね時代順）＝チャートの安定ソートと同じ。
  const top = records
    .filter((r) => r.ranks[metricKey] !== null)
    .sort((a, b) => a.ranks[metricKey]!.rank - b.ranks[metricKey]!.rank)
    .slice(0, count);
  if (top.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="font-heading text-sm font-semibold text-foreground">
        {title}
      </h3>
      <ol className="mt-1 gap-x-10 text-sm sm:columns-2" aria-label={title}>
        {top.map((r) => {
          const rank = r.ranks[metricKey]!;
          return (
            <li
              key={r.id}
              className="flex break-inside-avoid items-baseline gap-2 border-b border-border/60 py-1.5"
            >
              <span className="w-16 shrink-0 tabular-nums text-muted-foreground">
                {rank.rank}位{rank.tied ? "タイ" : ""}
              </span>
              <Link
                href={`/emperors/${r.id}`}
                className="min-w-0 truncate underline-offset-2 hover:text-seal hover:underline focus-visible:outline-2 focus-visible:outline-ring"
              >
                {r.name}
              </Link>
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {r.dynastyLabel}
              </span>
              <span className="ml-auto shrink-0 tabular-nums">
                {formatMetricValue(r, metricKey)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
