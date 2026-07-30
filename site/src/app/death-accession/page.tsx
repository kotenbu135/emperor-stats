import { PageHeader } from "@/components/layout/page-header";
import { LazyMount } from "@/components/lazy-mount";
import { CategoryPieChart } from "@/components/charts/category-pie-chart";
import { ChartTakeaway } from "@/components/charts/chart-takeaway";
import { CategoryBreakdownList } from "@/components/tables/category-breakdown-list";
import {
  accessionRouteCategoryOrder,
  accessionRouteDescriptions,
  deathCauseCategoryOrder,
  deathCauseDescriptions,
  getAllEmperorRecords,
  getCategoryBreakdown,
  getChartTakeaway,
  getDynastyOptions,
} from "@/lib/emperors";
import { BreadcrumbJsonLd, buildMetadata, StatsPageJsonLd } from "@/lib/seo";

// title/descriptionはナビの短いラベル（SITE_SECTIONS）とは別物にする。
// ナビは短いままが正しく、検索結果に出るのはこちら。JSON-LDにも同じ定数を渡す。
const PAGE_TITLE = "死因別・即位経路別の分布";
const PAGE_DESCRIPTION =
  "皇帝365人の死因を病死・暗殺・処刑・戦死・自尽など8分類で、即位の経緯を世襲・擁立・簒奪・受禅などの分類で集計した円グラフです。";

export const metadata = buildMetadata({
  path: "/death-accession",
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
});

export default function DeathAccessionPage() {
  const records = getAllEmperorRecords();
  const dynastyOptions = getDynastyOptions();

  return (
    <>
      <BreadcrumbJsonLd label="死因・即位" path="/death-accession" />
      <StatsPageJsonLd
        name={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        path="/death-accession"
      />
      <PageHeader
        title="死因・即位"
      />
      {/* 2つの節を横並びにするため Section を使わず自前の箱で組んでいる。余白と
          本文列の上限（max-w-content）は Section と同じ値に揃えること。 */}
      <div className="px-gutter py-section md:px-gutter-wide">
        <div className="mx-auto grid w-full max-w-content gap-10 md:grid-cols-2">
          <section id="death-cause" className="scroll-mt-20">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-seal/80" />
              <h2 className="font-heading text-xl font-semibold text-foreground">
                死因別分布
              </h2>
            </div>
            <div className="mt-6">
              <ChartTakeaway
                sentences={getChartTakeaway("death-accession/death-cause")}
              />
              <LazyMount estimatedHeight={580}>
                <CategoryPieChart
                  records={records}
                  dynastyOptions={dynastyOptions}
                  metricKey="deathCauseCategory"
                  categoryOrder={deathCauseCategoryOrder}
                  categoryDescriptions={deathCauseDescriptions}
                  chartLabel="死因別分布"
                />
              </LazyMount>
              {/* 円グラフは LazyMount 配下なので、区分名・件数・定義は画面外では
                  DOM に出ない。8分類すべてを静的に出すのはこのリストの役割。 */}
              <CategoryBreakdownList
                slices={getCategoryBreakdown("deathCauseCategory")}
                categoryOrder={deathCauseCategoryOrder}
                categoryDescriptions={deathCauseDescriptions}
                label="死因"
              />
            </div>
          </section>
          <section id="accession" className="scroll-mt-20">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-seal/80" />
              <h2 className="font-heading text-xl font-semibold text-foreground">
                即位経路別分布
              </h2>
            </div>
            <div className="mt-6">
              <ChartTakeaway
                sentences={getChartTakeaway("death-accession/accession")}
              />
              <LazyMount estimatedHeight={580}>
                <CategoryPieChart
                  records={records}
                  dynastyOptions={dynastyOptions}
                  metricKey="accessionRouteCategory"
                  categoryOrder={accessionRouteCategoryOrder}
                  categoryDescriptions={accessionRouteDescriptions}
                  chartLabel="即位経路別分布"
                />
              </LazyMount>
              <CategoryBreakdownList
                slices={getCategoryBreakdown("accessionRouteCategory")}
                categoryOrder={accessionRouteCategoryOrder}
                categoryDescriptions={accessionRouteDescriptions}
                label="即位経路"
              />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
