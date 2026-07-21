import { PageHeader } from "@/components/layout/page-header";
import { LazyMount } from "@/components/lazy-mount";
import { CategoryPieChart } from "@/components/charts/category-pie-chart";
import { ChartTakeaway } from "@/components/charts/chart-takeaway";
import {
  accessionRouteCategoryOrder,
  accessionRouteDescriptions,
  deathCauseCategoryOrder,
  deathCauseDescriptions,
  getAllEmperorRecords,
  getChartTakeaway,
  getDynastyOptions,
} from "@/lib/emperors";
import { BreadcrumbJsonLd, buildMetadata, sectionDescription } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/death-accession",
  title: "死因・即位",
  description: sectionDescription("/death-accession"),
});

export default function DeathAccessionPage() {
  const records = getAllEmperorRecords();
  const dynastyOptions = getDynastyOptions();

  return (
    <>
      <BreadcrumbJsonLd label="死因・即位" path="/death-accession" />
      <PageHeader
        title="死因・即位"
      />
      {/* 死因・即位経路は対等な2つの円グラフ。総括文はグリッドの上に1本だけ置き、
          両方（死因＋即位経路）に触れる（片方が総括文なしにならないように）。 */}
      <div className="px-6 pt-8 md:px-10">
        <ChartTakeaway sentences={getChartTakeaway("death-accession")} />
      </div>
      <div className="grid gap-10 px-6 pb-8 md:grid-cols-2 md:px-10">
        <section id="death-cause" className="scroll-mt-20">
          <h2 className="font-heading text-xl font-semibold text-foreground">
            死因別分布
          </h2>
          <div className="mt-6">
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
          </div>
        </section>
        <section id="accession" className="scroll-mt-20">
          <h2 className="font-heading text-xl font-semibold text-foreground">
            即位経路別分布
          </h2>
          <div className="mt-6">
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
          </div>
        </section>
      </div>
    </>
  );
}
