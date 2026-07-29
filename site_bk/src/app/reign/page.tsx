import { PageHeader, Section } from "@/components/layout/page-header";
import { LazyMount } from "@/components/lazy-mount";
import { RankingBarChart } from "@/components/charts/ranking-bar-chart";
import { ChartTakeaway } from "@/components/charts/chart-takeaway";
import { RestorationTable } from "@/components/tables/restoration-table";
import { TopRankedTable } from "@/components/tables/top-ranked-table";
import {
  getAllEmperorRecords,
  getChartTakeaway,
  getDynastyOptions,
  getRestorationRows,
} from "@/lib/emperors";
import { BreadcrumbJsonLd, buildMetadata, StatsPageJsonLd } from "@/lib/seo";

// title/descriptionはナビの短いラベル（SITE_SECTIONS）とは別物にする。
// ナビは短いままが正しく、検索結果に出るのはこちら。JSON-LDにも同じ定数を渡す。
const PAGE_TITLE = "在位年数ランキングと復位者一覧";
const PAGE_DESCRIPTION =
  "皇帝を名乗った365人の在位年数を長い順に並べたランキングと、廃位・退位を経て再び即位した復位者の一覧です。王朝ごとに絞り込めます。";

export const metadata = buildMetadata({
  path: "/reign",
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
});

export default function ReignPage() {
  const records = getAllEmperorRecords();
  const dynastyOptions = getDynastyOptions();

  return (
    <>
      <BreadcrumbJsonLd label="在位データ" path="/reign" />
      <StatsPageJsonLd
        name={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        path="/reign"
      />
      <PageHeader
        title="在位データ"
      />
      <Section
        id="ranking"
        title="在位年数ランキング"
        description="在位期間のランキングです。複数回即位した皇帝は、在位期間の合計で集計しています。"
      >
        <ChartTakeaway sentences={getChartTakeaway("reign/ranking")} />
        <LazyMount estimatedHeight={680}>
          <RankingBarChart
            records={records}
            dynastyOptions={dynastyOptions}
            metricKey="reignYears"
            axisLabel="年"
            valueLabel="在位期間"
          />
        </LazyMount>
        <TopRankedTable
          records={records}
          metricKey="reignYears"
          title="在位期間の上位10名"
        />
      </Section>
      <Section
        id="restoration"
        title="復位者一覧（複数回即位）"
        description="廃位・退位を経て再び即位した皇帝の一覧です。"
      >
        <ChartTakeaway sentences={getChartTakeaway("reign/restoration")} />
        <RestorationTable
          rows={getRestorationRows()}
          dynastyOptions={dynastyOptions}
        />
      </Section>
    </>
  );
}
