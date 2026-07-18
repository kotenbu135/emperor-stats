import { PageHeader } from "@/components/layout/page-header";
import { CategoryPieChart } from "@/components/charts/category-pie-chart";
import {
  accessionRouteCategoryOrder,
  accessionRouteDescriptions,
  deathCauseCategoryOrder,
  deathCauseDescriptions,
  getAllEmperorRecords,
  getDynastyOptions,
} from "@/lib/emperors";

export const metadata = {
  title: "死因・即位 | 中国皇帝統計",
};

export default function DeathAccessionPage() {
  const records = getAllEmperorRecords();
  const dynastyOptions = getDynastyOptions();

  return (
    <>
      <PageHeader
        title="死因・即位"
      />
      <div className="grid gap-10 px-6 py-8 md:grid-cols-2 md:px-10">
        <section id="death-cause" className="scroll-mt-20">
          <h2 className="font-heading text-xl font-semibold text-foreground">
            死因別分布
          </h2>
          <div className="mt-6">
            <CategoryPieChart
              records={records}
              dynastyOptions={dynastyOptions}
              metricKey="deathCauseCategory"
              categoryOrder={deathCauseCategoryOrder}
              categoryDescriptions={deathCauseDescriptions}
            />
          </div>
        </section>
        <section id="accession" className="scroll-mt-20">
          <h2 className="font-heading text-xl font-semibold text-foreground">
            即位経路別分布
          </h2>
          <div className="mt-6">
            <CategoryPieChart
              records={records}
              dynastyOptions={dynastyOptions}
              metricKey="accessionRouteCategory"
              categoryOrder={accessionRouteCategoryOrder}
              categoryDescriptions={accessionRouteDescriptions}
            />
          </div>
        </section>
      </div>
    </>
  );
}
