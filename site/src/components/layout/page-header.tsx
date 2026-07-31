import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  contained = false,
  containedWidth = "max-w-2xl",
}: {
  title: string;
  description?: string;
  /** 本文を狭い読み物幅にする記事型ページ（/about等）で、見出しも本文と同じ列に揃える */
  contained?: boolean;
  /** contained時の列幅クラス。ページ本文の列幅と必ず揃えること。 */
  containedWidth?: string;
}) {
  return (
    <div className="border-b border-border bg-background px-gutter py-section md:px-gutter-wide">
      {/* contained でないデータページも max-w-content（1200px）で止める。2560px幅で
          表やチャートが2240pxまで伸びる間延びを防ぐのが目的で、上限の単一情報源は
          globals.css の --container-content。 */}
      <div
        className={cn(
          "mx-auto w-full",
          contained ? containedWidth : "max-w-content",
        )}
      >
        <div className="flex items-center gap-3">
          {/* 印章の朱をイメージしたアクセントバー（--seal） */}
          <span aria-hidden className="h-7 w-1 shrink-0 rounded-full bg-seal" />
          {/* サイズは text-page-title（従来の text-2xl → md:text-3xl と両端は同値で、
              間をフルイドに繋いだもの）。 */}
          <h1 className="text-balance font-heading text-page-title font-semibold text-foreground">
            {title}
          </h1>
        </div>
        {description && (
          <p className="mt-2 max-w-2xl text-pretty text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

export function Section({
  id,
  title,
  description,
  scrollMt,
  bleed = false,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  /** 中身だけ本文列の上限（max-w-content = 1200px）を外して全幅に出す。自前の固定
   *  キャンバスを横スクロールで見せる図の専用で、
   *  上限で囲むと窓が狭くなるだけのものにしか付けないこと。
   *  見出しは全ページで同じ列に揃えるため上限側に残す（図だけが本文列の左右へ
   *  はみ出す「全幅の図版」の形）。 */
  bleed?: boolean;
  /** アンカージャンプ時に上へ空ける量。既定は80px。ページ内に固定バーが
   *  あるページは、そのバーの高さぴったりにする（大きいと前セクションの末尾
   *  （横スクロールバーなど）が覗き、小さいとバーに隠れる）。
   *  モバイルでは sticky なサイトヘッダーも上端を占めるため、直値でなく
   *  BELOW_SECTION_NAV のような calc 式（string）を渡すこと。 */
  scrollMt?: number | string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn("px-gutter py-section md:px-gutter-wide", scrollMt === undefined && "scroll-mt-20")}
      style={scrollMt === undefined ? undefined : { scrollMarginTop: scrollMt }}
    >
      <div className="mx-auto w-full max-w-content">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-seal/80" />
          <h2 className="text-balance font-heading text-xl font-semibold text-foreground">
            {title}
          </h2>
        </div>
        {description && (
          <p className="mt-1 text-pretty text-sm text-muted-foreground">
            {description}
          </p>
        )}
        {!bleed && <div className="mt-6">{children}</div>}
      </div>
      {bleed && <div className="mt-6">{children}</div>}
    </section>
  );
}
