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
      <header className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 md:hidden">
        <Link
          href="/"
          className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground"
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
          <SheetContent side="left" className="w-3/4 overflow-y-auto bg-sidebar">
            <SheetHeader>
              <SheetTitle>メニュー</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6">
              <NavMenu onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <aside className="hidden shrink-0 border-r border-border bg-sidebar md:block md:w-60">
        <div className="sticky top-0 flex h-screen flex-col overflow-y-auto px-4 py-6">
          <Link
            href="/"
            className="mb-6 flex items-center gap-2.5 font-heading text-xl font-semibold text-foreground"
          >
            <SiteMark className="size-7 text-base" />
            中国皇帝統計
          </Link>
          <NavMenu />
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </main>
    </div>
  );
}
