import { PageHeader, Section } from "@/components/layout/page-header";
import { LazyMount } from "@/components/lazy-mount";
import { RankingBarChart } from "@/components/charts/ranking-bar-chart";
import { ChartTakeaway } from "@/components/charts/chart-takeaway";
import { TopRankedTable } from "@/components/tables/top-ranked-table";
import {
  getAllEmperorRecords,
  getChartTakeaway,
  getDynastyOptions,
} from "@/lib/emperors";
import { BreadcrumbJsonLd, buildMetadata, StatsPageJsonLd } from "@/lib/seo";

// title/descriptionはナビの短いラベル（SITE_SECTIONS）とは別物にする。
// ナビは短いままが正しく、検索結果に出るのはこちら。JSON-LDにも同じ定数を渡す。
const PAGE_TITLE = "即位時年齢・没年齢ランキング";
const PAGE_DESCRIPTION =
  "即位した時点の年齢を年長順、没年齢を長寿順に並べたランキングです。年齢はすべて数え年で、正史から算出できた皇帝のみを対象にしています。";

export const metadata = buildMetadata({
  path: "/ages",
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
});

export default function AgesPage() {
  const records = getAllEmperorRecords();
  const dynastyOptions = getDynastyOptions();
  const accessionKnown = records.filter((r) => r.accessionAge !== null).length;
  const deathKnown = records.filter((r) => r.deathAge !== null).length;

  return (
    <>
      <BreadcrumbJsonLd label="年齢" path="/ages" />
      <StatsPageJsonLd
        name={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        path="/ages"
      />
      <PageHeader
        title="年齢"
        description="年齢はすべて数え年（生まれた年を1歳とする中国伝統の数え方）です。正史に生年や享年の記載がない皇帝も多く、算出できた皇帝のみを表示しています。"
      />
      <Section
        id="accession-age"
        title="即位時年齢ランキング"
        description={`皇帝として即位した時点の年齢です（生年が判明している${accessionKnown}名分）。年長で即位した皇帝から順に表示します。`}
      >
        <ChartTakeaway sentences={getChartTakeaway("ages/accession-age")} />
        <LazyMount estimatedHeight={680}>
          <RankingBarChart
            records={records}
            dynastyOptions={dynastyOptions}
            metricKey="accessionAge"
            axisLabel="歳"
            valueLabel="即位時年齢"
            sortLabel={{ desc: "年長順", asc: "若い順" }}
            missingNoteLabel="生年不詳などで年齢不明"
          />
        </LazyMount>
        <TopRankedTable
          records={records}
          metricKey="accessionAge"
          title="即位時年齢の年長順10名"
        />
      </Section>
      <Section
        id="death-age"
        title="没年齢ランキング"
        description={`崩御・死去した時点の年齢です（享年が判明している${deathKnown}名分）。長寿の皇帝から順に表示します。`}
      >
        <ChartTakeaway sentences={getChartTakeaway("ages/death-age")} />
        <LazyMount estimatedHeight={680}>
          <RankingBarChart
            records={records}
            dynastyOptions={dynastyOptions}
            metricKey="deathAge"
            axisLabel="歳"
            valueLabel="没年齢"
            sortLabel={{ desc: "長寿順", asc: "若い順" }}
            missingNoteLabel="享年不詳などで年齢不明"
          />
        </LazyMount>
        <TopRankedTable
          records={records}
          metricKey="deathAge"
          title="没年齢の長寿順10名"
        />
      </Section>
    </>
  );
}
