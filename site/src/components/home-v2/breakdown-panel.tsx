import Link from "next/link";
import { CategoryBar } from "@/components/tremor/CategoryBar";
import { databaseFilterHref, shortCategoryLabel } from "@/lib/emperor-types";

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
  /**
   * `/database` の絞り込みへ渡す区分名の**全文**（`shortCategoryLabel` を掛ける前）。
   * これを持つ行だけがリンクになる — 「その他（3区分）」は1つの絞り込みに落ちないので
   * 持たせない（畳まれた区分へは絞り込みパネルのセレクトから届く）。
   */
  filterValue?: string;
}

/**
 * 凡例から `/database` の絞り込みへ飛ばすときの軸（2026-08-17・Issue #94 の案5）。
 * 渡さなければ凡例はただの表示になる（`/lab` の見比べはこちら）。
 */
export interface BreakdownFacet {
  /** `/database` のクエリパラメータ名。 */
  param: "death" | "accession";
  /** 読み上げ用の軸名（「死因」「即位経路」）。可視ラベルには出さない。 */
  label: string;
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
export function BreakdownBar({
  slices,
  facet,
}: {
  slices: BreakdownRow[];
  facet?: BreakdownFacet;
}) {
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
          **2列に並べるのは箱が広いときだけ**（`@[19rem]` = 304px）— 1枚に要る幅は実測で149px
          （「その他」のような3文字の区分名まで入れて）、2列の下限は約304pxで、それを
          下回ると区分名から先に消える。区分名は `--series-*` の3色がコントラスト 3:1 未満で
          あることの**免除条件そのもの**（site/AGENTS.md）なので、切り詰まる幅では縦に
          伸ばしてでも名前を残す。
          **閾値は 320px（`@xs`）ではなく実測の下限 304px に置く**（2026-08-04）— xl の
          右列は幅372pxで箱が324pxしかなく、`@xs` だと 1280〜1284px の数pxだけ1列へ落ちて、
          overview-board 側で直した空白が細い帯で再発する。**304px を下回る側へ動かさない**
          （2026-08-02 の実測で、箱が218〜280pxのとき2列にすると「病死」が幅0になった）。 */}
      <ul className="mt-4 grid grid-cols-1 gap-1.5 @[19rem]:grid-cols-2">
        {slices.map((d, i) => {
          const label = shortCategoryLabel(d.name);
          const title = d.detail ?? (label === d.name ? undefined : d.name);
          const href =
            facet && d.filterValue
              ? databaseFilterHref({ [facet.param]: d.filterValue })
              : undefined;
          const row = (
            <>
              <span
                className={`size-2.5 shrink-0 translate-y-px rounded-xs ${
                  BREAKDOWN_SERIES_BG[i % BREAKDOWN_SERIES_BG.length]
                }`}
                aria-hidden
              />
              <span className="truncate text-sm text-foreground">{label}</span>
              {/* 畳んだ区分名・省いた括弧は title だけに置かない（title は
                  キーボード・タッチ・読み上げのどれでも出ない）。可視の区分名は
                  そのまま — **`--series-*` の 3:1 未満の免除条件は「可視ラベル」**
                  なので、ここを sr-only へ移し替えないこと（AGENTS.md）。
                  **リンクの行では出さない** — aria-label が中身の読み上げを
                  上書きするので、括弧つきの全文はそちらへ入れてある。 */}
              {title && !href && <span className="sr-only">（{title}）</span>}
              <span className="ml-auto shrink-0 text-sm font-medium tabular-nums text-foreground">
                {d.count}名
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {d.percentLabel}
              </span>
            </>
          );
          // sr-only（絶対配置）の基準を枠にするため relative は枠側に置く。
          // **`h-full` を外さないこと** — 枠が `<li>` そのものだった頃は grid の
          // stretch が2列の高さを揃えていたが、中の要素になったぶん自分では伸びない
          // （区分名が折り返す幅で片方の枠だけ低くなる）。
          const boxClass =
            "relative flex h-full items-baseline gap-2 rounded-md border border-border px-2.5 py-1.5";
          return (
            <li key={d.name}>
              {href ? (
                // 面がわずかに沈む側の hover（AGENTS.md の「操作の反応で守ること」）。
                // 可視ラベルは text-foreground のまま — 区分名は `--series-*` が
                // コントラスト 3:1 未満であることの免除条件そのものなので、
                // 休止状態の色を hover 用に落とさない。
                <Link
                  href={href}
                  title={title}
                  aria-label={`${facet!.label}が${d.name}の皇帝${d.count}名をデータベースで見る`}
                  className={`${boxClass} transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-seal`}
                >
                  {row}
                </Link>
              ) : (
                <div className={boxClass} title={title}>
                  {row}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
