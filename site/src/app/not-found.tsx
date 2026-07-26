import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "ページが見つかりません",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <PageHeader
        title="ページが見つかりません"
        description="お探しのページは移動または削除された可能性があります。"
      />
      <div className="px-6 py-8 md:px-10">
        <Button variant="outline" asChild>
          <Link href="/">概要ダッシュボードへ戻る</Link>
        </Button>
      </div>
    </>
  );
}
