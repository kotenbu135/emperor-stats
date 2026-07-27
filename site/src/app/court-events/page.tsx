import { PageHeader, Section } from "@/components/layout/page-header";
import {
  BELOW_SECTION_NAV,
  SectionJumpNav,
} from "@/components/layout/section-jump-nav";
import { LazyMount } from "@/components/lazy-mount";
import { RankingBarChart } from "@/components/charts/ranking-bar-chart";
import { ChartTakeaway } from "@/components/charts/chart-takeaway";
import { TopRankedTable } from "@/components/tables/top-ranked-table";
import {
  getAllEmperorRecords,
  getChartTakeaway,
  getDynastyOptions,
  type RankingMetricKey,
  type TakeawaySection,
} from "@/lib/emperors";
import { BreadcrumbJsonLd, buildMetadata, StatsPageJsonLd } from "@/lib/seo";

// title/descriptionはナビの短いラベル（SITE_SECTIONS）とは別物にする。
// ナビは短いままが正しく、検索結果に出るのはこちら。JSON-LDにも同じ定数を渡す。
const PAGE_TITLE = "改元・大赦・立后・遷都の回数ランキング";
const PAGE_DESCRIPTION =
  "皇帝365人が在位中に行った改元・大赦・立后・皇太子廃立・遷都の回数を正史から数えた5つのランキングです。王朝ごとに絞り込めます。";

export const metadata = buildMetadata({
  path: "/court-events",
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
});

const sections: {
  id: string;
  key: RankingMetricKey;
  takeaway: TakeawaySection;
  title: string;
  description: string;
}[] = [
  {
    id: "era",
    key: "eraChangeCount",
    takeaway: "court-events/era",
    title: "改元回数ランキング",
    description: "即位時の建元を含め、在位中に何回改元したかを表示します。",
  },
  {
    id: "amnesty",
    key: "amnestyCount",
    takeaway: "court-events/amnesty",
    title: "大赦回数ランキング",
    description: "本紀に「大赦天下」等と明記された全国規模の大赦の回数です。",
  },
  {
    id: "empress",
    key: "empressInstallationCount",
    takeaway: "court-events/empress",
    title: "立后回数ランキング",
    description:
      "皇后として正式に冊立された回数です（廃后後の再冊立も別カウント）。",
  },
  {
    id: "deposition",
    key: "crownPrinceDepositionCount",
    takeaway: "court-events/deposition",
    title: "皇太子廃立回数ランキング",
    description: "立てられていた皇太子（皇太弟等を含む）を廃した回数です。",
  },
  {
    id: "capital",
    key: "capitalRelocationCount",
    takeaway: "court-events/capital",
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
      <StatsPageJsonLd
        name={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        path="/court-events"
      />
      <PageHeader
        title="宮廷イベント"
        description="改元・大赦・立后・皇太子廃立・遷都という、在位中に朝廷で起きた出来事の回数を集計しています。"
      />
      {/* 5つのランキングが縦に並ぶ。サイドバーの節リンクはモバイルでは
          ハンバーガーの中なので、ページ内にも索引を出す。 */}
      <SectionJumpNav
        label="ランキングへジャンプ"
        items={sections.map(({ id, title }) => ({
          id,
          label: title.replace(/回数ランキング$/, ""),
        }))}
      />
      {sections.map(({ id, key, takeaway, title, description }) => (
        <Section
          key={id}
          id={id}
          scrollMt={BELOW_SECTION_NAV}
          title={title}
          description={description}
        >
          {/* 総括文は全 Section に1本ずつ置く（2026-07-27 に「ページ1本のみ」から変更。
              グラフは LazyMount 配下なので、総括文の無い節は数値がどこにも出ない）。 */}
          <ChartTakeaway sentences={getChartTakeaway(takeaway)} />
          <LazyMount estimatedHeight={680}>
            <RankingBarChart
              records={records}
              dynastyOptions={dynastyOptions}
              metricKey={key}
              axisLabel="回"
              valueLabel={valueLabels[id]}
            />
          </LazyMount>
          <TopRankedTable
            records={records}
            metricKey={key}
            title={`${valueLabels[id]}の上位10名`}
          />
        </Section>
      ))}
    </>
  );
}
