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
import { BreadcrumbJsonLd, buildMetadata, sectionDescription } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/reign",
  title: "在位データ",
  description: sectionDescription("/reign"),
});

export default function ReignPage() {
  const records = getAllEmperorRecords();
  const dynastyOptions = getDynastyOptions();

  return (
    <>
      <BreadcrumbJsonLd label="在位データ" path="/reign" />
      <PageHeader
        title="在位データ"
      />
      <Section
        id="ranking"
        title="在位年数ランキング"
        description="在位期間のランキングです。複数回即位した皇帝は、在位期間の合計で集計しています。"
      >
        <ChartTakeaway sentences={getChartTakeaway("reign")} />
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
        <RestorationTable
          rows={getRestorationRows()}
          dynastyOptions={dynastyOptions}
        />
      </Section>
    </>
  );
}
