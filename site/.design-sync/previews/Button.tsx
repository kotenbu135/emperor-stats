import { Button } from "site";

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button>見る</Button>
      <Button variant="outline">表で見る</Button>
      <Button variant="secondary">絞り込みを解除</Button>
      <Button variant="ghost">閉じる</Button>
      <Button variant="destructive">この条件を削除</Button>
      <Button variant="link">このサイトについて</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="xs" variant="outline">
        xs
      </Button>
      <Button size="sm" variant="outline">
        sm
      </Button>
      <Button variant="outline">default</Button>
      <Button size="lg" variant="outline">
        lg
      </Button>
    </div>
  );
}

export function States() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button>通常</Button>
      <Button disabled>無効</Button>
      <Button variant="outline" aria-expanded>
        開いている
      </Button>
      <Button variant="outline" aria-invalid>
        入力エラー
      </Button>
    </div>
  );
}

export function InPageActions() {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background px-4 py-3">
      <p className="text-sm text-muted-foreground">
        在位年数ランキング（365人・競争順位）
      </p>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm">
          表で見る
        </Button>
        <Button size="sm">グラフを開く</Button>
      </div>
    </div>
  );
}
