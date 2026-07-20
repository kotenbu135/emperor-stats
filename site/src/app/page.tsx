import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getOverviewStats } from "@/lib/emperors";

const sections = [
  {
    href: "/timeline",
    label: "通史年表",
    description: "始皇帝から溥儀まで、全皇帝の在位を1本の年表で一望",
  },
  {
    href: "/emperors",
    label: "皇帝一覧",
    description: "全皇帝の図鑑。名前・王朝で検索し、詳細を表示",
  },
  {
    href: "/reign",
    label: "在位データ",
    description: "在位年数ランキングと復位者（複数回即位）の一覧",
  },
  {
    href: "/death-accession",
    label: "死因・即位",
    description: "死因別・即位経路別の内訳",
  },
  {
    href: "/court-events",
    label: "宮廷イベント",
    description: "改元・大赦・立后・皇太子廃立・遷都の回数ランキング",
  },
  {
    href: "/military",
    label: "軍事",
    description: "親征・反乱鎮圧・被反乱の回数ランキング",
  },
  {
    href: "/ages",
    label: "年齢",
    description: "即位時年齢・没年齢のランキング（数え年）",
  },
  {
    href: "/dynasties",
    label: "王朝・時代で見る",
    description: "平均在位年数・死因の内訳を王朝単位で横断比較",
  },
];

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
      <CardContent className="px-4">
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
    <div className="bg-background px-6 py-10 md:px-10 md:py-12">
      {/* ワイド画面では左寄せだと右側の余白が目立つため中央寄せにする */}
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-3">
          <span aria-hidden className="h-8 w-1 shrink-0 rounded-full bg-seal" />
          <h1 className="font-heading text-3xl font-semibold text-foreground">
            中国皇帝統計
          </h1>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          始皇帝から溥儀まで、中国史上で実際に「皇帝」を名乗った
          {stats.emperorCount}
          の統計情報を可視化したサイトです。
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
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
              className="transition-colors hover:border-seal/50"
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
  );
}
