import { PageHeader, Section } from "@/components/layout/page-header";
import { LazyMount } from "@/components/lazy-mount";
import { DynastyAvgReignChart } from "@/components/charts/dynasty-avg-reign-chart";
import { DynastyDeathCauseChart } from "@/components/charts/dynasty-death-cause-chart";
import { ChartTakeaway } from "@/components/charts/chart-takeaway";
import { DynastyAvgReignTable } from "@/components/tables/dynasty-avg-reign-table";
import { getAllEmperorRecords, getChartTakeaway } from "@/lib/emperors";
import { BreadcrumbJsonLd, buildMetadata, StatsPageJsonLd } from "@/lib/seo";

// title/descriptionはナビの短いラベル（SITE_SECTIONS）とは別物にする。
// ナビは短いままが正しく、検索結果に出るのはこちら。JSON-LDにも同じ定数を渡す。
const PAGE_TITLE = "王朝別の平均在位年数と死因の内訳";
const PAGE_DESCRIPTION =
  "皇帝365人の統計を王朝・時代の単位に集計した横断ビューです。王朝ごとの皇帝1人あたりの平均在位年数と、死因の内訳を比較できます。";

export const metadata = buildMetadata({
  path: "/dynasties",
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
});

export default function DynastiesPage() {
  const records = getAllEmperorRecords();

  return (
    <>
      <BreadcrumbJsonLd label="王朝・時代で見る" path="/dynasties" />
      <StatsPageJsonLd
        name={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        path="/dynasties"
      />
      <PageHeader
        title="王朝・時代で見る"
        description="皇帝個人の統計を王朝（または時代）単位に集計した横断ビューです。"
      />
      <Section
        id="avg-reign"
        title="平均在位年数"
        description="王朝ごとの皇帝1人あたりの平均在位年数です。皇帝が少ない王朝ほど個人の影響が大きく出る点にご注意ください（各行に皇帝数を併記しています）。"
      >
        <ChartTakeaway sentences={getChartTakeaway("dynasties/avg-reign")} />
        <LazyMount estimatedHeight={680}>
          <DynastyAvgReignChart records={records} />
        </LazyMount>
        <DynastyAvgReignTable
          records={records}
          title="平均在位年数が長い王朝10件"
        />
      </Section>
      <Section
        id="death-cause"
        title="死因の内訳"
        description="王朝ごとの死因の内訳です。帯の長さは皇帝数を表し、色は死因の分類を表します。"
      >
        <ChartTakeaway sentences={getChartTakeaway("dynasties/death-cause")} />
        <LazyMount estimatedHeight={710}>
          <DynastyDeathCauseChart records={records} />
        </LazyMount>
      </Section>
    </>
  );
}
