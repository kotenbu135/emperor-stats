import { PageHeader, Section } from "@/components/layout/page-header";
import { RankingBarChart } from "@/components/charts/ranking-bar-chart";
import { RestorationTable } from "@/components/tables/restoration-table";
import {
  getAllEmperorRecords,
  getDynastyOptions,
  getRestorationRows,
} from "@/lib/emperors";

export const metadata = {
  title: "在位データ | 中国皇帝統計",
};

export default function ReignPage() {
  const records = getAllEmperorRecords();
  const dynastyOptions = getDynastyOptions();

  return (
    <>
      <PageHeader
        title="在位データ"
      />
      <Section
        id="ranking"
        title="在位年数ランキング"
        description="在位期間のランキングです。複数回即位した皇帝は、在位期間の合計で集計しています。"
      >
        <RankingBarChart
          records={records}
          dynastyOptions={dynastyOptions}
          metricKey="reignYears"
          axisLabel="年"
          valueLabel="在位期間"
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
