"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NavMenu } from "@/components/layout/nav-menu";
import { RubyToggle } from "@/components/layout/ruby-toggle";
import { SiteFooter } from "@/components/layout/site-footer";
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
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      {/* キーボード操作でナビゲーション（デスクトップは11項目・モバイルはメニュー
          ボタン）を飛ばして本文へ入るための導線。フォーカスされたときだけ現れる。 */}
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
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-sidebar px-4 md:hidden">
        <Link
          href="/"
          className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground transition-colors hover:text-seal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal"
        >
          <SiteMark className="size-6 text-sm" />
          中国皇帝統計
        </Link>
        <Sheet open={open} onOpenChange={setOpen}>
          <Button
            variant="outline"
            size="icon"
            aria-label="メニューを開く"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </Button>
          {/* overscroll-contain: メニューの端まで来たスクロールを裏のページへ
              渡さない（/emperors は全高5万px級なので、渡すと閉じたあとに
              まったく違う位置に居ることになる）。 */}
          <SheetContent
            side="left"
            className="w-3/4 overflow-y-auto overscroll-contain bg-sidebar"
          >
            <SheetHeader>
              <SheetTitle>メニュー</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6">
              <NavMenu onNavigate={() => setOpen(false)} />
              {/* ふりがなの切り替え（Issue #20）。モバイルはヘッダーに置く幅が
                  無いのでメニューの中に入れる。 */}
              <RubyToggle className="mt-6" />
            </div>
          </SheetContent>
        </Sheet>
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
