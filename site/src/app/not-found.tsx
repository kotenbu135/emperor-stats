import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4 bg-background px-6 py-16 md:px-10">
      <h1 className="font-heading text-3xl font-semibold text-foreground">
        ページが見つかりません
      </h1>
      <p className="text-sm text-muted-foreground">
        お探しのページは移動または削除された可能性があります。
      </p>
      <Button variant="outline" asChild>
        <Link href="/">概要ダッシュボードへ戻る</Link>
      </Button>
    </div>
  );
}
