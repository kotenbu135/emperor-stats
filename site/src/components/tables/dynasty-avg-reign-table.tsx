// 王朝別の平均在位年数の上位を出す静的リスト（/dynasties）。
//
// TopRankedTable と同じ趣旨の部品だが、行が皇帝ではなく王朝なので別部品にした
// （TopRankedTable は record.ranks[metricKey] を持つ皇帝レコード専用）。
// 集計はチャート本体（DynastyAvgReignChart）と同じ aggregateByGroup を呼び、
// 既定の状態（単位＝王朝・区分の絞り込みなし・平均の長い順）をそのまま写す。
// 小標本の王朝も除外しない — 除外するとチャートと行が食い違うため、代わりに
// 各行へ皇帝数を併記する（節の説明文と「読み取れること」でも注意を促している）。

import { aggregateByGroup } from "@/components/charts/dynasty-aggregate";
import type { EmperorRecord } from "@/lib/emperor-types";

export function DynastyAvgReignTable({
  records,
  title,
  count = 10,
}: {
  records: EmperorRecord[];
  /** 見出し（例: "平均在位年数の長い王朝10件"）。 */
  title: string;
  count?: number;
}) {
  const rows = [...aggregateByGroup(records, "dynasty", "all")]
    .sort((a, b) => b.avgReignDays - a.avgReignDays)
    .slice(0, count);
  if (rows.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="font-heading text-base font-semibold text-foreground">
        {title}
      </h3>
      <ol className="mt-1 gap-x-10 text-sm sm:columns-2" aria-label={title}>
        {rows.map((row, i) => (
          <li
            key={row.key}
            className="flex break-inside-avoid items-baseline gap-2 border-b border-border/60 py-1.5"
          >
            <span className="w-10 shrink-0 tabular-nums text-muted-foreground">
              {i + 1}位
            </span>
            <span className="min-w-0 truncate text-foreground">{row.label}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {row.emperorCount}名
            </span>
            <span className="ml-auto shrink-0 tabular-nums">
              約{(row.avgReignDays / 365).toFixed(1)}年
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
