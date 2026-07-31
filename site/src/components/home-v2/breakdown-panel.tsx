import { CategoryBar } from "@/components/tremor/CategoryBar";

/**
 * 内訳パネルが受け取る1区分。emperors.ts の HomeBreakdownSlice を
 * 「その他」に畳んだ後の形（畳む処理は overview-board.tsx の foldRest）。
 */
export interface BreakdownRow {
  name: string;
  count: number;
  share: number;
  percentLabel: string;
  /** 「その他」に畳んだ区分名など、短い表示では落ちる情報（title に出す）。 */
  detail?: string;
}

export const BREAKDOWN_SERIES = [
  "series1",
  "series2",
  "series3",
  "series4",
  "series5",
  "series6",
  "series7",
  "series8",
] as const;

export const BREAKDOWN_SERIES_BG = [
  "bg-series-1",
  "bg-series-2",
  "bg-series-3",
  "bg-series-4",
  "bg-series-5",
  "bg-series-6",
  "bg-series-7",
  "bg-series-8",
];

/**
 * 凡例に出す短い名前。末尾の丸括弧を落とす（「受禅（易姓）」→「受禅」・
 * 「その他（3区分）」→「その他」）。落とした全文は title に残す。
 * 現行のカタログでは括弧を落としても重複する区分名は無い
 * （括弧つきは「受禅（易姓）」「継承（経緯記載なし）」の2つだけ）。
 */
function shortLabel(name: string): string {
  return name.replace(/（[^）]*）$/, "");
}

/**
 * 積み上げ1本帯 + 凡例カード。円より割合どうしの比較がしやすく、縦を食わない。
 *
 * 帯の幅は count をそのまま渡して CategoryBar に合計で割らせる（上位N件だけを
 * 渡すと残りが消えて幅が水増しされるので、呼び出し側で必ず「その他」まで
 * 畳んだ全区分を渡すこと）。凡例は帯の並び順と1対1で、名前・実数・割合を必ず併記する
 * （細い区分は帯の中では読めないため、色だけが手掛かりの区分を作らない）。
 */
export function BreakdownBar({ slices }: { slices: BreakdownRow[] }) {
  return (
    <div>
      <CategoryBar
        values={slices.map((s) => s.count)}
        colors={[...BREAKDOWN_SERIES]}
        showLabels={false}
      />
      {/* 区分名と数値を行の両端に振り分けると、カード幅ぶん離れて目で追えない。
          1区分＝1枚の小カードにして2列に並べる。**1枚は1行**に収める — 名前と数値を
          2行に分けると凡例だけで縦を200px以上使い、隣のランキングと高さが合わない
          （ユーザー指摘・2026-07-31）。 */}
      <ul className="mt-4 grid grid-cols-2 gap-1.5">
        {slices.map((d, i) => {
          const label = shortLabel(d.name);
          const title = d.detail ?? (label === d.name ? undefined : d.name);
          return (
            <li
              key={d.name}
              className="flex items-baseline gap-2 rounded-md border border-border px-2.5 py-1.5"
              title={title}
            >
              <span
                className={`size-2.5 shrink-0 translate-y-px rounded-xs ${
                  BREAKDOWN_SERIES_BG[i % BREAKDOWN_SERIES_BG.length]
                }`}
                aria-hidden
              />
              <span className="truncate text-sm text-foreground">{label}</span>
              <span className="ml-auto shrink-0 text-sm font-medium tabular-nums text-foreground">
                {d.count}名
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {d.percentLabel}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
