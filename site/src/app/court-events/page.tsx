import { PageHeader, Section } from "@/components/layout/page-header";
import { LazyMount } from "@/components/lazy-mount";
import { RankingBarChart } from "@/components/charts/ranking-bar-chart";
import {
  getAllEmperorRecords,
  getDynastyOptions,
  type RankingMetricKey,
} from "@/lib/emperors";
import { BreadcrumbJsonLd, buildMetadata, sectionDescription } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/court-events",
  title: "宮廷イベント",
  description: sectionDescription("/court-events"),
});

const sections: {
  id: string;
  key: RankingMetricKey;
  title: string;
  description: string;
}[] = [
  {
    id: "era",
    key: "eraChangeCount",
    title: "改元回数ランキング",
    description: "即位時の建元を含め、在位中に何回改元したかを表示します。",
  },
  {
    id: "amnesty",
    key: "amnestyCount",
    title: "大赦回数ランキング",
    description: "本紀に「大赦天下」等と明記された全国規模の大赦の回数です。",
  },
  {
    id: "empress",
    key: "empressInstallationCount",
    title: "立后回数ランキング",
    description:
      "皇后として正式に冊立された回数です（廃后後の再冊立も別カウント）。",
  },
  {
    id: "deposition",
    key: "crownPrinceDepositionCount",
    title: "皇太子廃立回数ランキング",
    description: "立てられていた皇太子（皇太弟等を含む）を廃した回数です。",
  },
  {
    id: "capital",
    key: "capitalRelocationCount",
    title: "遷都回数ランキング",
    description:
      "自分の在位中に正式な遷都（恒久的な都の移転）を行った回数です。戦乱による一時的な避難・行幸や、副都の新設は含めません。",
  },
];

const valueLabels: Record<string, string> = {
  era: "改元回数",
  amnesty: "大赦回数",
  empress: "立后回数",
  deposition: "皇太子廃立回数",
  capital: "遷都回数",
};

export default function CourtEventsPage() {
  const records = getAllEmperorRecords();
  const dynastyOptions = getDynastyOptions();

  return (
    <>
      <BreadcrumbJsonLd label="宮廷イベント" path="/court-events" />
      <PageHeader
        title="宮廷イベント"
        description="改元・大赦・立后・皇太子廃立・遷都という、在位中に朝廷で起きた出来事の回数を集計しています。"
      />
      {sections.map(({ id, key, title, description }) => (
        <Section key={id} id={id} title={title} description={description}>
          <LazyMount estimatedHeight={680}>
            <RankingBarChart
              records={records}
              dynastyOptions={dynastyOptions}
              metricKey={key}
              axisLabel="回"
              valueLabel={valueLabels[id]}
            />
          </LazyMount>
        </Section>
      ))}
    </>
  );
}
