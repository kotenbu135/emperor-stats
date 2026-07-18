import { PageHeader, Section } from "@/components/layout/page-header";
import { RankingBarChart } from "@/components/charts/ranking-bar-chart";
import { getAllEmperorRecords, getDynastyOptions } from "@/lib/emperors";

export const metadata = {
  title: "年齢 | 中国皇帝統計",
};

export default function AgesPage() {
  const records = getAllEmperorRecords();
  const dynastyOptions = getDynastyOptions();
  const accessionKnown = records.filter((r) => r.accessionAge !== null).length;
  const deathKnown = records.filter((r) => r.deathAge !== null).length;

  return (
    <>
      <PageHeader
        title="年齢"
        description="年齢はすべて数え年（生まれた年を1歳とする中国伝統の数え方）です。正史に生年や享年の記載がない皇帝も多く、算出できた皇帝のみを表示しています。"
      />
      <Section
        id="accession-age"
        title="即位時年齢ランキング"
        description={`皇帝として即位した時点の年齢です（生年が判明している${accessionKnown}名分）。幼くして即位した皇帝から順に表示します。`}
      >
        <RankingBarChart
          records={records}
          dynastyOptions={dynastyOptions}
          metricKey="accessionAge"
          axisLabel="歳"
          valueLabel="即位時年齢"
          defaultSort="asc"
          rankDirection="asc"
          sortLabel={{ desc: "年長順", asc: "若い順" }}
          missingNoteLabel="生年不詳などで年齢不明"
        />
      </Section>
      <Section
        id="death-age"
        title="没年齢ランキング"
        description={`崩御・死去した時点の年齢です（享年が判明している${deathKnown}名分）。長寿の皇帝から順に表示します。`}
      >
        <RankingBarChart
          records={records}
          dynastyOptions={dynastyOptions}
          metricKey="deathAge"
          axisLabel="歳"
          valueLabel="没年齢"
          sortLabel={{ desc: "長寿順", asc: "若い順" }}
          missingNoteLabel="享年不詳などで年齢不明"
        />
      </Section>
    </>
  );
}
