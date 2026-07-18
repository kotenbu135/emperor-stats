import { PageHeader } from "@/components/layout/page-header";
import { EmperorGrid } from "@/components/emperors/emperor-grid";
import { getAllEmperorRecords, getDynastyOptions } from "@/lib/emperors";

export const metadata = {
  title: "皇帝一覧 | 中国皇帝統計",
};

export default function EmperorsPage() {
  const records = getAllEmperorRecords();
  const dynastyOptions = getDynastyOptions();

  return (
    <>
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
