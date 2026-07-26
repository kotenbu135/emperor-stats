import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "ページが見つかりません",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4 bg-background px-6 py-8 md:px-10">
      <div className="flex items-center gap-3">
        <span aria-hidden className="h-7 w-1 shrink-0 rounded-full bg-seal" />
        <h1 className="font-heading text-2xl font-semibold text-foreground md:text-3xl">
          ページが見つかりません
        </h1>
      </div>
      <p className="text-sm text-muted-foreground">
        お探しのページは移動または削除された可能性があります。
      </p>
      <Button variant="outline" asChild>
        <Link href="/">概要ダッシュボードへ戻る</Link>
      </Button>
    </div>
  );
}
