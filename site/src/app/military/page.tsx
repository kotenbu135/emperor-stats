import { PageHeader, Section } from "@/components/layout/page-header";
import { LazyMount } from "@/components/lazy-mount";
import { RankingBarChart } from "@/components/charts/ranking-bar-chart";
import {
  getAllEmperorRecords,
  getDynastyOptions,
  militaryEventLabels,
  type MilitaryEventKey,
} from "@/lib/emperors";
import { BreadcrumbJsonLd, buildMetadata, sectionDescription } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/military",
  title: "軍事",
  description: sectionDescription("/military"),
});

const sections: { id: string; key: MilitaryEventKey; description: string }[] = [
  {
    id: "campaign",
    key: "personalCampaignCount",
    description:
      "皇帝自身が軍を率いて戦場に赴いた回数です。将軍を派遣しただけの場合は含めません。同じ相手への一連の遠征は1回と数えています。",
  },
  {
    id: "suppression",
    key: "rebellionSuppressionCount",
    description:
      "在位中に、政権側として反乱の鎮圧にあたった件数です（首謀者・蜂起単位で1件）。鎮圧に成功したかどうかは問いません。",
  },
  {
    id: "suffered",
    key: "rebellionSufferedCount",
    description:
      "在位中に自分（の政権）に対して起こされた反乱の件数です。農民反乱から宮廷クーデターまで、兵力を伴う反抗を広く含みます。対等な勢力どうしの抗争や外国との戦争は含めません。",
  },
];

export default function MilitaryPage() {
  const records = getAllEmperorRecords();
  const dynastyOptions = getDynastyOptions();

  return (
    <>
      <BreadcrumbJsonLd label="軍事" path="/military" />
      <PageHeader title="軍事" />
      {sections.map(({ id, key, description }) => (
        <Section
          key={key}
          id={id}
          title={`${militaryEventLabels[key]}ランキング`}
          description={description}
        >
          <LazyMount estimatedHeight={680}>
            <RankingBarChart
              records={records}
              dynastyOptions={dynastyOptions}
              metricKey={key}
              axisLabel="回"
              valueLabel={militaryEventLabels[key]}
            />
          </LazyMount>
        </Section>
      ))}
    </>
  );
}
