"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavMenu } from "@/components/layout/nav-menu";
import { RubyToggle } from "@/components/layout/ruby-toggle";
import { SiteFooter } from "@/components/layout/site-footer";
import { isCurrentSection, mobileNavCategories } from "@/lib/nav-data";
import { cn } from "@/lib/utils";

/** サイトの印章風ロゴ（篆刻の朱印をイメージした「帝」の一文字）。 */
function SiteMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[3px] bg-seal font-heading font-semibold text-seal-foreground",
        className,
      )}
    >
      帝
    </span>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      {/* キーボード操作でナビゲーション（デスクトップはサイドバー・モバイルは
          ヘッダーの3項目）を飛ばして本文へ入るための導線。フォーカスされたときだけ
          現れる。 */}
      <a
        href="#main"
        className="sr-only z-50 rounded-md border border-seal bg-background px-3 py-2 text-sm text-seal focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
      >
        本文へスキップ
      </a>
      {/* モバイルは sticky。/emperors は全高5万px級で、固定しないと一度スクロール
          した時点でメニューへ戻る手段が無くなる（サイドバーはこの画面幅では
          ハンバーガーの中にしか無い）。高さは h-14 に固定し、globals.css の
          --chrome-top と必ず同じ値にする。
          重なりは「画面に固定される要素」の段(z-50)。ページ内の固定索引(z-30)より
          上に出す必要があり、ダイアログ等はポータルでこの後ろのDOMに出るため
          同じ段でも上に描かれる。 */}
      {/* 2026-08-06（Issue #92）: ハンバーガー＋Sheet をやめ、行き先を文字で出す。
          `/emperors`・`/database` は本文の中に他ページへの出口が最下部のフッター
          1本しか無く、メニューボタンに気づかないと移動できなかった。
          **項目は nav-data.ts の shortLabel を持つ3つだけ**（4つ目は320〜360pxで
          溢れる・理由と `/about` の扱いは nav-data.ts のコメント）。
          折り返すと帯の高さが 56px を超えるので nowrap を崩さないこと。 */}
      <header className="sticky top-0 z-50 flex h-14 items-center gap-1 border-b border-border bg-sidebar px-3 md:hidden">
        <Link
          href="/"
          aria-label="中国皇帝統計 トップページ"
          className="flex shrink-0 items-center rounded-md p-0.5 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-seal"
        >
          <SiteMark className="size-6 text-sm" />
        </Link>
        <nav
          aria-label="サイト内のページ"
          className="flex min-w-0 flex-1 flex-nowrap items-center gap-1"
        >
          {mobileNavCategories.map((category) => {
            const current = isCurrentSection(pathname, category.href);
            return (
              <Link
                key={category.href}
                href={category.href}
                // 現在地の強調は皇帝個別ページ（365枚）でも「皇帝一覧」に付くよう
                // 前方一致で見るが、aria-current はそのページ自身にだけ付ける。
                aria-current={pathname === category.href ? "page" : undefined}
                className={cn(
                  // px-1.5 は 320px（iPhone SE 相当）で3項目＋印＋ふりがなが
                  // 収まる下限。px-2 に戻すと 320px でトグルと重なる（tools/header-audit.mjs）。
                  "flex h-11 shrink-0 items-center rounded-md px-1.5 font-heading text-sm font-semibold whitespace-nowrap transition-colors hover:bg-accent hover:text-seal focus-visible:outline-2 focus-visible:outline-seal",
                  current ? "text-seal" : "text-foreground",
                )}
              >
                {category.shortLabel}
              </Link>
            );
          })}
        </nav>
        {/* ふりがなの切り替え（Issue #20）。Sheet を畳んだので置き場所がここへ移った。 */}
        <RubyToggle variant="compact" />
      </header>

      <aside className="hidden shrink-0 border-r border-border bg-sidebar md:block md:w-60">
        <div className="sticky top-0 flex h-dvh flex-col overflow-y-auto overscroll-contain px-4 py-6">
          <Link
            href="/"
            className="mb-6 flex items-center gap-2.5 font-heading text-xl font-semibold text-foreground transition-colors hover:text-seal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal"
          >
            <SiteMark className="size-7 text-base" />
            中国皇帝統計
          </Link>
          <NavMenu />
          {/* ふりがなの切り替え（Issue #20）はサイドバーの最下部。ナビゲーションの
              項目ではなく表示の設定なので、mt-auto で本文リンクから離して置く。 */}
          <div className="mt-auto pt-6">
            <RubyToggle />
          </div>
        </div>
      </aside>

      <main id="main" tabIndex={-1} className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </main>
    </div>
  );
}
