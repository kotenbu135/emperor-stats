// トップページ（概要ダッシュボード）の表示部品。
//
// すべて Server Component（`Portrait` だけが "use client"）。トップは静的な
// 抜粋を出すだけで操作を持たないため、チャートライブラリを持ち込まず素の
// div/SVGなしで組む — LazyMount で遅延させるほどの重さを最初から作らない。
//
// 配色は DESIGN.md の規約に従う:
//   - 面は明度3段（background / card / sidebar）だけで区別し、色相で塗り分けない
//   - --seal は「ここぞという箇所」限定。この画面では見出しのアクセントバーと
//     概況の代表値1つに限る（旧トップは6つの数値すべてを朱にしていた）
//   - 列挙カテゴリの識別色は series-1〜8 を地色と混ぜた濃度で使い、
//     塗りより一段濃い同色の輪郭で締める（生の彩度で置かない）

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Portrait } from "@/components/emperors/portrait";
import {
  DYNASTY_EDGE_MIX,
  DYNASTY_FILL_MIX,
  dynastyEdgeHex,
  dynastyFillHex,
  mixHex,
} from "@/lib/dynasty-colors";
import type { HomeBreakdownSlice, HomeEraBand, HomeRankedEmperor } from "@/lib/emperors";

/* -------------------------------------------------------------------------- */
/* 共通                                                                        */
/* -------------------------------------------------------------------------- */

/** 抜粋から本体ページへ送る導線。矢印は hover で0.5px進む（transformのみ）。 */
export function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-seal hover:underline"
    >
      {children}
      <ArrowRight
        aria-hidden
        className="size-3.5 transition-transform duration-150 ease-out motion-safe:group-hover:translate-x-0.5 motion-reduce:transition-none"
      />
    </Link>
  );
}

/** パネル見出し＋「すべて見る」導線。パネルの中身より前に読ませる。 */
export function PanelHeading({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 className="font-heading text-base font-semibold text-foreground">{title}</h3>
      <MoreLink href={href}>{linkLabel}</MoreLink>
    </div>
  );
}

/** 中身を載せる面。静止状態に影を置かず、明度1段で地から分ける。 */
export function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[0.5rem] border border-border bg-card p-5">{children}</div>
  );
}

/* -------------------------------------------------------------------------- */
/* 在位ランキングの抜粋                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 上位を肖像つきで出す。順位・王朝名・実測値をすべてマークに直接添えるため、
 * 王朝の色は「どの王朝か」を解読させる鍵ではなく、同じ王朝が固まっている手掛かり
 * としてだけ働く（87王朝に凡例は成立しない）。
 */
export function RankedEmperorList({ rows }: { rows: HomeRankedEmperor[] }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row, i) => (
        <li key={row.id}>
          <Link
            href={`/emperors/${row.id}`}
            className="flex items-center gap-3 rounded-[0.5rem] border border-border bg-background p-2.5 transition-[translate,border-color] duration-150 ease-out hover:border-seal/50 motion-safe:hover:-translate-y-px motion-safe:hover:shadow-sm motion-reduce:transition-none"
          >
            <span className="relative aspect-[3/4] w-11 shrink-0 overflow-hidden rounded-[0.25rem] border border-border">
              <Portrait record={row} sizes="44px" priority={i < 3} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-1.5">
                <span className="shrink-0 font-heading text-xs tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="truncate font-heading text-sm font-semibold text-foreground">
                  {row.name}
                </span>
                <span className="shrink-0 text-micro text-muted-foreground">
                  {row.dynastyLabel}
                </span>
              </span>
              <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.max(row.ratio * 100, 4)}%`,
                    backgroundColor: dynastyFillHex(row.dynastyKey),
                    boxShadow: `inset 0 0 0 1px ${dynastyEdgeHex(row.dynastyKey)}`,
                  }}
                />
              </span>
              <span className="mt-1 block text-xs tabular-nums text-muted-foreground">
                {row.valueLabel}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* 内訳（死因・即位経路）                                                      */
/* -------------------------------------------------------------------------- */

/** 帯の中に文字を置ける最小の割合。これを下回る区分は下の一覧だけで識別させる。 */
const INLINE_LABEL_MIN_SHARE = 0.11;

/**
 * 100%積み上げ帯＋全区分の一覧。帯だけでは小さい区分が読めず、一覧だけでは
 * 全体に占める重みが分からないため、必ず対にして出す。区分名は略さない
 * （このデータセット固有の概念で、短縮すると意味が変わる）。
 */
export function BreakdownPanel({
  slices,
  colors,
  unit,
}: {
  slices: HomeBreakdownSlice[];
  colors: Record<string, string>;
  /** 一覧の件数に付ける単位（例: "名"）。 */
  unit: string;
}) {
  const fill = (category: string) =>
    mixHex(colors[category] ?? "#6b6258", DYNASTY_FILL_MIX);
  const edge = (category: string) =>
    mixHex(colors[category] ?? "#6b6258", DYNASTY_EDGE_MIX);

  return (
    <div>
      <div
        className="flex h-7 w-full overflow-hidden rounded-[0.25rem] border border-border"
        role="img"
        aria-label={slices
          .map((s) => `${s.category} ${s.count}${unit}（${s.percentLabel}）`)
          .join("、")}
      >
        {slices.map((s) => (
          <span
            key={s.category}
            className="flex h-full items-center justify-center overflow-hidden"
            style={{
              width: `${s.share * 100}%`,
              backgroundColor: fill(s.category),
              boxShadow: `inset 0 0 0 1px ${edge(s.category)}`,
            }}
          >
            {s.share >= INLINE_LABEL_MIN_SHARE && (
              <span className="truncate px-1 text-micro font-semibold tabular-nums text-foreground">
                {s.percent}%
              </span>
            )}
          </span>
        ))}
      </div>

      <ul className="mt-3 grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
        {slices.map((s) => (
          <li key={s.category} className="flex items-center gap-1.5 text-xs">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-[2px]"
              style={{
                backgroundColor: fill(s.category),
                boxShadow: `inset 0 0 0 1px ${edge(s.category)}`,
              }}
            />
            <span className="min-w-0 flex-1 truncate text-foreground">{s.category}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {s.count}
              {unit}
            </span>
            <span className="w-11 shrink-0 text-right tabular-nums text-muted-foreground">
              {s.percentLabel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 時代ごとの厚み                                                              */
/* -------------------------------------------------------------------------- */

/**
 * 時代区分ごとの皇帝数。並びは収録順（＝時系列）で、値の大小で並べ替えない。
 * 「皇帝が何人いた時代か」の濃淡を、帯の長さと墨の濃さの両方で示す。
 */
export function EraBands({ eras }: { eras: HomeEraBand[] }) {
  const max = Math.max(...eras.map((e) => e.count));
  return (
    <ul className="grid gap-x-6 gap-y-1.5 md:grid-cols-2 xl:grid-cols-3">
      {eras.map((e) => (
        <li key={e.label} className="flex items-center gap-2 text-xs">
          <span className="w-24 shrink-0 truncate text-foreground" title={e.label}>
            {e.label}
          </span>
          <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-foreground/45"
              style={{ width: `${Math.max((e.count / max) * 100, 3)}%` }}
            />
          </span>
          <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
            {e.count}名
          </span>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* そのほかの導線                                                              */
/* -------------------------------------------------------------------------- */

/**
 * 抜粋を出していないページへの導線。旧トップはこの形の巨大カードを8枚並べ、
 * サイドバーと同じ内容を繰り返していた。行に落として面積を返す。
 */
export function SectionLinks({
  links,
}: {
  links: { href: string; label: string; description: string }[];
}) {
  return (
    <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {links.map((l) => (
        <li key={l.href}>
          <Link
            href={l.href}
            className="group flex h-full items-start gap-2.5 rounded-[0.5rem] border border-border bg-card px-4 py-3 transition-[translate,border-color] duration-150 ease-out hover:border-seal/50 motion-safe:hover:-translate-y-px motion-safe:hover:shadow-sm motion-reduce:transition-none"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-sm font-semibold text-foreground">
                {l.label}
              </span>
              <span className="mt-0.5 block text-pretty text-xs text-muted-foreground">
                {l.description}
              </span>
            </span>
            <ArrowRight
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out group-hover:text-seal motion-safe:group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
