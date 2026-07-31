// 「このサイトについて」（/about）の組みもの。
//
// このサイトで唯一の**記事型ページ**で、他の3面（盤面・図鑑・表）とは読み方が違う。
// データページは「数値を見に来て、見たら帰る」面なので text-sm・max-w-content で
// 情報を詰めるが、こちらは上から下まで読ませる面なので、本文は 16px・行間 1.75、
// 列幅は読み物幅（max-w-3xl = 768px・全角48字前後）に絞ってある。
//
// **文章そのものは 2026-07-31 の作り替えでも変えていない**（ユーザー指示）。
// 変えたのは組み方だけ — 節へ飛ぶ索引を足し、11項目の数え方を左に用語を出す
// 定義リストにし、配布ファイル3本をカードにし、正誤表を日付と本文の2列にした。
//
// **見出しを畳まないこと。** 数え方11項目は Accordion にすると読み込み時に本文が
// DOM から消える（`ui/accordion.tsx` は radix で forceMount を渡していない）。
// この節はサイト内で唯一「数え方」を書いている場所で、フッターからも
// 「収録基準・数え方・出典の詳細」として名指しでリンクされている。畳んで良いのは
// 肖像画クレジットの表のような末尾の参照だけで、そこは素の <details> を使う。

import type { ReactNode } from "react";
// 型だけの import（コンパイルで消える）。この部品は Server Component なので
// AGENTS.md の「クライアント側から emperors.ts を import しない」には触れない。
import type { PortraitCredit } from "@/lib/emperors";
import { cn } from "@/lib/utils";

/** 記事の本文列。PageHeader の containedWidth・SectionJumpNav の innerWidth と同値。 */
export const ARTICLE_WIDTH = "max-w-3xl";

/**
 * 見出しの無い導入部（PageHeader と最初の節のあいだ）。
 * 本文列の供給元を PageHeader / Section / SectionJumpNav に限る規約
 * （globals.css の --container-content のコメント）に合わせて、ページ側へ
 * `mx-auto max-w-*` を書かずに済むようここへ寄せている。
 */
export function ArticleIntro({ children }: { children: ReactNode }) {
  return (
    <div className="px-gutter pt-section md:px-gutter-wide">
      <div className={cn("mx-auto w-full", ARTICLE_WIDTH)}>{children}</div>
    </div>
  );
}

/** 本文の段落。段落間は gap で空けるので、親（Prose）が縦の間隔を持つ。 */
export function Prose({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 text-pretty text-base leading-7 text-foreground/90",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** 導入の2段落。1段落目だけ少し大きくして入口だと分かるようにする。 */
export function Lead({ children }: { children: ReactNode }) {
  return (
    // 狭い画面では本文と同じ 16px に落とす。390px では1行20字ほどしか入らず、
    // 18px にすると導入だけで1画面を使い切る。
    <p className="text-pretty text-base leading-7 text-foreground md:text-lg md:leading-8">
      {children}
    </p>
  );
}

/**
 * 節の中でいちばん強い一文を囲む枠。朱の縦線＋淡い地で、地の文から浮かせる。
 * 使うのは「収録基準の定義」「免責」のように**それだけ読めば用が足りる一文**に限る。
 */
export function Callout({
  children,
  tone = "seal",
}: {
  children: ReactNode;
  /** seal = 主張（朱）／muted = 但し書き（無彩色）。 */
  tone?: "seal" | "muted";
}) {
  return (
    <div
      className={cn(
        "rounded-r-md border-l-2 py-3 pl-4 pr-4",
        tone === "seal"
          ? "border-seal bg-seal/[0.04] text-foreground"
          : "border-border bg-muted/60 text-foreground/90",
      )}
    >
      <div className="flex flex-col gap-3 text-pretty text-base leading-7">
        {children}
      </div>
    </div>
  );
}

/** 本文中のリンク。外部リンクは呼び出し側で target/rel を付ける。 */
export function A({
  href,
  external = false,
  children,
}: {
  href: string;
  external?: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      {...(external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : undefined)}
      // 下線は本文より薄い程度に留める。**--border（1.1:1）まで落とさないこと** —
      // 地の文が text-foreground/90 なので、下線が消えるとリンクが本文と見分けられなくなる。
      // このページは外部の出典（sxtwl・Commons・スキーマ文書・CHANGELOG・コーパス）を
      // 指すのが仕事なので、リンクが目立たないと目的を果たさない。
      className="underline decoration-foreground/40 underline-offset-2 transition-colors hover:text-seal hover:decoration-seal"
    >
      {children}
    </a>
  );
}

export interface TermItem {
  term: string;
  body: ReactNode;
}

/**
 * 「各統計項目の数え方」の11項目。用語を左の桁に出し、本文を右に流す定義リスト。
 *
 * 元は項目ごとに h3 ＋ 段落を縦に積んでいた。11項目ぶんの見出し行が本文の間に
 * 挟まるので、**どの項目があるのかを一覧できない**（読むには11回スクロールする）。
 * 用語を左の桁へ出すと、左端に11語が縦に並んで索引になり、本文は右に通しで流れる。
 * 狭い画面（md 未満）では桁を畳んで用語が本文の上に乗る。
 */
export function TermList({ items }: { items: TermItem[] }) {
  return (
    <dl className="border-t border-border">
      {items.map((item) => (
        <div
          key={item.term}
          className="grid gap-x-6 gap-y-1 border-b border-border py-4 md:grid-cols-[9.5rem_1fr]"
        >
          {/* 用語は本文1行目と天を揃える（本文 leading-7 = 28px、用語 leading-7 で同値）。 */}
          <dt className="font-heading text-base font-semibold leading-7 text-foreground">
            {item.term}
          </dt>
          <dd className="flex flex-col gap-4 text-pretty text-base leading-7 text-foreground/90">
            {item.body}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export interface DownloadItem {
  file: string;
  href: string;
  /** ファイル形式の短い名前（カードの右肩）。 */
  format: string;
  size: string;
  note: string;
}

/**
 * 配布ファイル3本。元は箇条書き1つに「ファイル名（形式・サイズ・注記）」を
 * 詰めていたので、押せる場所（ファイル名だけ）が文の途中にあり、サイズと注記が
 * 括弧の中に埋まっていた。カードにしてカード全体を押せるようにし、サイズを
 * 右肩の定位置へ出している。
 */
export function DownloadCards({ items }: { items: DownloadItem[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <li key={item.file} className="flex">
          <a
            href={item.href}
            className="group flex w-full flex-col gap-2 rounded-md border border-border bg-card p-4 transition-colors hover:border-seal/60 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="rounded-sm bg-muted px-1.5 py-0.5 text-micro font-medium uppercase tracking-wide text-muted-foreground">
                {item.format}
              </span>
              <span className="text-micro tabular-nums text-muted-foreground">
                {item.size}
              </span>
            </div>
            {/* ファイル名は等幅。押す対象がファイルであることを字面で示す。 */}
            <span className="break-all font-mono text-sm text-foreground group-hover:text-seal">
              {item.file}
            </span>
            <span className="text-sm leading-6 text-muted-foreground">
              {item.note}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export interface ErratumItem {
  date: string;
  body: ReactNode;
}

/** 正誤表。日付を左の桁に固定して、いつ何を直したかを縦に読めるようにする。 */
export function ErrataList({ items }: { items: ErratumItem[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {items.map((item) => (
        <li
          key={item.date}
          className="grid gap-x-6 gap-y-1 border-l-2 border-border pl-4 md:grid-cols-[7rem_1fr]"
        >
          <time
            dateTime={item.date}
            className="font-mono text-sm leading-7 tabular-nums text-muted-foreground"
          >
            {item.date}
          </time>
          <p className="text-pretty text-base leading-7 text-foreground/90">
            {item.body}
          </p>
        </li>
      ))}
    </ol>
  );
}

/**
 * 肖像画のクレジット一覧。**素の <details>** で畳む（Radix の Accordion にしない）
 * — 閉じたままでも中身が DOM に残り、静的書き出しの HTML に出典が載る。
 */
export function PortraitCredits({ credits }: { credits: PortraitCredit[] }) {
  return (
    <details className="group rounded-md border border-border bg-card">
      {/* list-none だけでは Safari の三角（::-webkit-details-marker）が残り、
          自前の ▼ と二重に出る。 */}
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
        <span>使用画像の一覧（{credits.length}件）</span>
        <span
          aria-hidden
          className="text-micro transition-transform group-open:rotate-180"
        >
          ▼
        </span>
      </summary>
      <div className="max-h-[28rem] overflow-y-auto border-t border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-secondary text-left">
            <tr>
              <th className="px-4 py-2 font-medium">皇帝</th>
              <th className="px-4 py-2 font-medium">王朝</th>
              <th className="px-4 py-2 font-medium">ライセンス</th>
              <th className="px-4 py-2 font-medium">出典</th>
            </tr>
          </thead>
          <tbody>
            {credits.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-1.5">{c.commonName}</td>
                <td className="px-4 py-1.5 text-muted-foreground">
                  {c.dynasty}
                </td>
                <td className="px-4 py-1.5 text-muted-foreground">
                  {c.licenseShortName}
                </td>
                <td className="px-4 py-1.5">
                  <a
                    href={c.commonsPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground underline underline-offset-2 hover:text-seal"
                  >
                    Commons
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
