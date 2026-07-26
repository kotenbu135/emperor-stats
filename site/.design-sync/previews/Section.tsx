import { Badge, Section } from "site";

/** ページ内の節。PageHeader より一段細い朱バーで階層を示す。 */
export function Default() {
  return (
    <Section
      id="death-cause"
      title="死因の内訳"
      description="病死・暗殺・処刑・自尽・戦死・事故死・諸説あり・不詳の8分類。判定基準は「このサイトについて」を参照。"
    >
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">病死 161人</Badge>
        <Badge variant="secondary">暗殺 96人</Badge>
        <Badge variant="secondary">処刑 35人</Badge>
        <Badge variant="secondary">自尽 15人</Badge>
        <Badge variant="secondary">戦死 7人</Badge>
        <Badge variant="outline">不詳 35人</Badge>
      </div>
    </Section>
  );
}

/** 説明文なしの節。 */
export function TitleOnly() {
  return (
    <Section title="王朝別の平均在位年数">
      <p className="text-sm text-muted-foreground">
        並立政権を含む87王朝を対象に、王朝ごとの平均在位年数を集計しています。
      </p>
    </Section>
  );
}
