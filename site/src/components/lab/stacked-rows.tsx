import { CategoryBar } from "@/components/tremor/CategoryBar";
import type { AvailableChartColorsKeys } from "@/lib/tremor/chartUtils";

/**
 * 100%積み上げ帯の複数行（`home-v2/reign-death-panel.tsx` と同じ組み方）。
 * 候補2（建前と実態）・候補3（一世一元）・候補5（政権の性格）で共用する。
 *
 * ヒートマップにしないのはセルが薄いから — 5×4のうち実数を持つのは12個で、
 * うち7個が20未満。行ごとの帯なら薄いセルも「ほぼゼロ」として正しく読める。
 *
 * **凡例は必ず出す**（`--series-*` の3色は面に対して 3:1 未満で、可視ラベルが
 * あることが免除条件になっている・site/AGENTS.md）。帯そのものは色しか持たないので、
 * 全区分の実数を title と aria-label に入れる。
 */

export interface StackedRow {
  label: string;
  count: number;
  values: number[];
  highlight: string;
}

export interface StackedSegment {
  name: string;
  detail?: string;
}

/** 区分の色。並びは segments と1対1。「その他」側は系列色を使わず灰にする。 */
export function StackedRows({
  segments,
  rows,
  colors,
  bgClasses,
  unit = "名",
}: {
  segments: StackedSegment[];
  rows: StackedRow[];
  colors: AvailableChartColorsKeys[];
  bgClasses: string[];
  unit?: string;
}) {
  return (
    <div>
      <ul className="space-y-3">
        {rows.map((r) => {
          const detail = segments
            .map((s, i) => `${s.name} ${r.values[i]}${unit}`)
            .join(" / ");
          return (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-foreground">
                  {r.label}
                  <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                    {r.count}
                    {unit}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                  {r.highlight}
                </span>
              </div>
              <CategoryBar
                className="mt-1.5"
                values={r.values}
                colors={colors}
                showLabels={false}
                title={detail}
                aria-label={`${r.label} ${detail}`}
              />
            </li>
          );
        })}
      </ul>
      <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {segments.map((s, i) => (
          <li key={s.name} className="flex items-center gap-1.5" title={s.detail}>
            <span
              className={`size-2.5 shrink-0 rounded-xs ${bgClasses[i % bgClasses.length]}`}
              aria-hidden
            />
            <span className="text-xs text-muted-foreground">{s.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
