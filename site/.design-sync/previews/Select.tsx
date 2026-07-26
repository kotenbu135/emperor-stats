import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "site";

/**
 * チャート上部の絞り込み行。SelectTrigger は必ず固定幅 + aria-label を付ける
 * （自動幅はフォント読み込みで折り返しがずれ CLS になる）。
 */
export function FilterRow() {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">集計単位</span>
        <Select defaultValue="dynasty">
          <SelectTrigger className="w-[130px]" aria-label="集計単位">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dynasty">王朝別</SelectItem>
            <SelectItem value="era">時代別</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">王朝の区分</span>
        <Select defaultValue="all">
          <SelectTrigger className="w-[170px]" aria-label="王朝の区分で絞り込み">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="unified">統一王朝</SelectItem>
            <SelectItem value="parallel">並立政権</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">並び順</span>
        <Select defaultValue="desc">
          <SelectTrigger className="w-[180px]" aria-label="並び順">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">在位年数が長い順</SelectItem>
            <SelectItem value="asc">在位年数が短い順</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/**
 * 見出し付きグループを含む展開状態。SelectContent の既定は position="item-aligned"
 * で、選択中の項目がトリガーに重なる位置に開く — 上下に余白のある枠で見せる。
 */
export function OpenWithGroups() {
  return (
    <div className="flex h-[300px] items-center">
      <Select defaultValue="houhan" open>
        <SelectTrigger className="w-[200px]" aria-label="王朝を選ぶ">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>秦漢</SelectLabel>
            <SelectItem value="qin">秦</SelectItem>
            <SelectItem value="qianhan">前漢</SelectItem>
            <SelectItem value="houhan">後漢</SelectItem>
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>隋唐</SelectLabel>
            <SelectItem value="sui">隋</SelectItem>
            <SelectItem value="tang">唐</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

/** 無効状態（対象データが1件もない絞り込み）。 */
export function Disabled() {
  return (
    <Select defaultValue="none" disabled>
      <SelectTrigger className="w-[170px]" aria-label="王朝を選ぶ">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">該当なし</SelectItem>
      </SelectContent>
    </Select>
  );
}
