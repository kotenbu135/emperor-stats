import { PageHeader } from "@/components/layout/page-header";
import { EmperorGrid } from "@/components/emperors/emperor-grid";
import { getDynastyOptions, getEmperorListRecords } from "@/lib/emperors";
import { BreadcrumbJsonLd, buildMetadata, sectionDescription } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/emperors",
  title: "皇帝一覧",
  description: sectionDescription("/emperors"),
});

export default function EmperorsPage() {
  const records = getEmperorListRecords();
  const dynastyOptions = getDynastyOptions();

  return (
    <>
      <BreadcrumbJsonLd label="皇帝一覧" path="/emperors" />
      <PageHeader
        title="皇帝一覧"
        description={`収録している全${records.length}名の一覧です。カードを押すと在位期間・死因・各種回数などの詳細を表示します。`}
      />
      <div className="px-6 py-8 md:px-10">
        <EmperorGrid records={records} dynastyOptions={dynastyOptions} />
      </div>
    </>
  );
}
