import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "site";

/** 概要ダッシュボードの統計タイル。朱の上罫が数値カードの目印。 */
export function StatTiles() {
  const tiles = [
    { label: "収録皇帝数", value: "365人", note: "始皇帝〜宣統帝" },
    { label: "最長在位", value: "61.9年", note: "清・聖祖（康熙帝）" },
    { label: "平均在位年数", value: "9.9年", note: "365人の平均" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {tiles.map((t) => (
        <Card key={t.label} className="border-t-2 border-t-seal/70">
          <CardContent>
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-seal">
              {t.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t.note}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** 各統計ページへの導線カード。見出しは明朝（font-heading）で組む。 */
export function NavigationCard() {
  return (
    <Card className="max-w-sm transition-colors hover:border-seal/60">
      <CardHeader>
        <CardTitle className="font-heading text-lg">在位期間</CardTitle>
        <CardDescription>
          在位年数・在位日数のランキングと王朝別の平均。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline">見る</Button>
      </CardContent>
    </Card>
  );
}

/** ヘッダー右のアクションとフッターを備えた最大構成。 */
export function WithActionAndFooter() {
  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="font-heading">聖祖（康熙帝）</CardTitle>
        <CardDescription>清 / 1661年–1722年 / 在位61.9年</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm">
            個別ページ
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        在位61.9年は収録365人中の最長。次点は同じ清の高宗（乾隆帝）の60.4年で、
        3位の西夏・仁宗（54.3年）とは6年以上の開きがある。
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        出典: 清史稿 巻六〜巻八 聖祖本紀
      </CardFooter>
    </Card>
  );
}
