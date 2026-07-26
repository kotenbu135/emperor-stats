import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { getOverviewStats } from "@/lib/emperors";
import { buildMetadata, JsonLd, SITE_SECTIONS, websiteJsonLd } from "@/lib/seo";

export const metadata = buildMetadata({ path: "/" });

const sections = SITE_SECTIONS;

function StatTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <Card className="border-t-2 border-t-seal/70">
      <CardContent>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 font-heading text-2xl font-semibold text-seal">
          {value}
        </p>
        {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const stats = getOverviewStats();

  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <PageHeader
        contained
        containedWidth="max-w-4xl"
        title="中国皇帝統計"
        description={`始皇帝から溥儀まで、中国史上で実際に「皇帝」を名乗った${stats.emperorCount}名の統計情報を可視化したサイトです。`}
      />
      {/* ワイド画面では左寄せだと右側の余白が目立つため中央寄せにする（PageHeaderのcontainedと同じ列幅） */}
      <div className="px-6 py-8 md:px-10">
        <div className="mx-auto w-full max-w-4xl">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatTile
              label="収録皇帝数"
              value={`${stats.emperorCount}名`}
              note="実際に皇帝を名乗った人物のみ"
            />
            <StatTile
              label="平均在位期間"
              value={stats.avgReignLabel}
              note="全収録皇帝の単純平均"
            />
            <StatTile
              label="最長在位"
              value={stats.longestReign.durationLabel}
              note={`${stats.longestReign.name}（${stats.longestReign.dynastyLabel}）`}
            />
            <StatTile
              label="最短在位"
              value={stats.shortestReign.durationLabel}
              note={`${stats.shortestReign.name}（${stats.shortestReign.dynastyLabel}）`}
            />
            <StatTile
              label={`最多の死因「${stats.topDeathCause.category}」`}
              value={`${stats.topDeathCause.percent}%`}
              note={`${stats.topDeathCause.count}名`}
            />
            <StatTile
              label={`最多の即位経路「${stats.topAccessionRoute.category}」`}
              value={`${stats.topAccessionRoute.percent}%`}
              note={`${stats.topAccessionRoute.count}名`}
            />
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {sections.map((s) => (
              <Card
                key={s.href}
                // transition-[...] を渡すとCardの基底 transition-transform を上書きするので、
                // 持ち上がり(translate)と枠色の両方をここで指定する。
                className="transition-[translate,border-color] duration-150 ease-out hover:border-seal/60 motion-safe:hover:-translate-y-px motion-safe:hover:shadow-sm motion-reduce:transition-none"
              >
                <CardHeader>
                  <CardTitle className="font-heading text-lg">{s.label}</CardTitle>
                  <CardDescription>{s.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" asChild>
                    <Link href={s.href}>見る</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="mt-8 text-xs text-muted-foreground">
            数え方・収録基準は
            <Link href="/about" className="underline underline-offset-2 hover:text-seal">
              このサイトについて
            </Link>
            をご覧ください。
          </p>
        </div>
      </div>
    </>
  );
}
