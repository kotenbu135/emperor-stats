import { Badge } from "site";

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>統一王朝</Badge>
      <Badge variant="secondary">改元 11回</Badge>
      <Badge variant="outline">親征あり</Badge>
      <Badge variant="destructive">暗殺</Badge>
      <Badge variant="ghost">不詳</Badge>
      <Badge variant="link">出典を見る</Badge>
    </div>
  );
}

/** 皇帝カードの属性ピル。回数系はsecondary、真偽系はoutlineで出す。 */
export function OnEmperorCard() {
  return (
    <div className="max-w-sm rounded-lg border border-border bg-background p-4">
      <p className="font-heading text-base font-semibold">煬帝（楊広）</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        隋 / 第2代 / 604年–618年
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="secondary">在位 15年</Badge>
        <Badge variant="secondary">遷都 2回</Badge>
        <Badge variant="outline">被反乱あり</Badge>
        <Badge variant="destructive">殺害</Badge>
      </div>
    </div>
  );
}

/** 一覧の絞り込みチップ。選択中はdefault、未選択はoutline。 */
export function FilterChips() {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge>秦漢</Badge>
      <Badge variant="outline">魏晋南北朝</Badge>
      <Badge variant="outline">隋唐</Badge>
      <Badge variant="outline">五代十国</Badge>
      <Badge variant="outline">宋遼西夏金</Badge>
      <Badge variant="outline">元明清</Badge>
    </div>
  );
}
