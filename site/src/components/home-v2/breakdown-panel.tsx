import { CategoryBar } from "@/components/tremor/CategoryBar";
import { shortCategoryLabel } from "@/lib/emperor-types";

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
 * 積み上げ1本帯 + 凡例カード。円より割合どうしの比較がしやすく、縦を食わない。
 *
 * 帯の幅は count をそのまま渡して CategoryBar に合計で割らせる（上位N件だけを
 * 渡すと残りが消えて幅が水増しされるので、呼び出し側で必ず「その他」まで
 * 畳んだ全区分を渡すこと）。凡例は帯の並び順と1対1で、名前・実数・割合を必ず併記する
 * （細い区分は帯の中では読めないため、色だけが手掛かりの区分を作らない）。
 */
export function BreakdownBar({ slices }: { slices: BreakdownRow[] }) {
  return (
    // 凡例の列数は**この箱の幅**で決める（@container）。盤面は lg で 3:2 に割れるため、
    // ビューポート幅と凡例が使える幅は比例しない（1024px 幅ではむしろ 768px 幅より狭い）。
    <div className="@container">
      <CategoryBar
        values={slices.map((s) => s.count)}
        colors={[...BREAKDOWN_SERIES]}
        showLabels={false}
      />
      {/* 区分名と数値を行の両端に振り分けると、カード幅ぶん離れて目で追えない。
          1区分＝1枚の小カードにして2列に並べる。**1枚は1行**に収める — 名前と数値を
          2行に分けると凡例だけで縦を200px以上使い、隣のランキングと高さが合わない
          （ユーザー指摘・2026-07-31）。
          **2列に並べるのは箱が広いときだけ**（`@xs` = 320px）— 1枚に要る幅は実測で149px、
          2列の下限は約304pxで、それを下回ると区分名から先に消える。1024〜1180px 幅では
          凡例の箱が218〜280pxしかなく、2列のままだと「病死」が幅0になる（実測・2026-08-02）。
          区分名は `--series-*` の3色がコントラスト 3:1 未満であることの**免除条件そのもの**
          （site/AGENTS.md）なので、切り詰まる幅では縦に伸ばしてでも名前を残す。 */}
      <ul className="mt-4 grid grid-cols-1 gap-1.5 @xs:grid-cols-2">
        {slices.map((d, i) => {
          const label = shortCategoryLabel(d.name);
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
