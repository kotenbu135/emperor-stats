import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "site";

/**
 * ランキングの行クリックで開く皇帝の詳細ダイアログ（/emperors の一覧カードと共用）。
 * 静的にレンダリングするため open を固定し、トリガーは省いている。
 */
export function EmperorDetail() {
  return (
    <Dialog open modal={false}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">武帝（劉徹）</DialogTitle>
          <DialogDescription>前漢 / 第7代 / 前141年–前87年</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">在位年数</p>
            <p className="mt-0.5 tabular-nums">54.1年</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">即位時年齢</p>
            <p className="mt-0.5 tabular-nums">16歳（数え年）</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">死因</p>
            <p className="mt-0.5">病死</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">即位経路</p>
            <p className="mt-0.5">前代君主から継承（皇太子）</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">在位 54.1年</Badge>
          <Badge variant="secondary">没年齢 70歳</Badge>
          <Badge variant="outline">出典: 漢書・武帝紀</Badge>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm">
            閉じる
          </Button>
          <Button size="sm">個別ページを開く</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 確認だけを求める最小構成。 */
export function Confirm() {
  return (
    <Dialog open modal={false}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading">絞り込みを解除しますか</DialogTitle>
          <DialogDescription>
            選択中の王朝・区分の条件がすべて外れ、365人全員が対象に戻ります。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" size="sm">
            やめる
          </Button>
          <Button variant="destructive" size="sm">
            解除する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
