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
  militaryEventLabels,
  type MilitaryEventKey,
  type TakeawaySection,
} from "@/lib/emperors";
import { BreadcrumbJsonLd, buildMetadata, StatsPageJsonLd } from "@/lib/seo";

// title/descriptionはナビの短いラベル（SITE_SECTIONS）とは別物にする。
// ナビは短いままが正しく、検索結果に出るのはこちら。JSON-LDにも同じ定数を渡す。
const PAGE_TITLE = "親征・反乱鎮圧・被反乱の回数ランキング";
const PAGE_DESCRIPTION =
  "皇帝自身が軍を率いた親征、政権側として鎮圧した反乱、自らに対して起こされた反乱。365人分の回数を数えた3つのランキングです。";

export const metadata = buildMetadata({
  path: "/military",
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
});

const sections: {
  id: string;
  key: MilitaryEventKey;
  takeaway: TakeawaySection;
  description: string;
}[] = [
  {
    id: "campaign",
    key: "personalCampaignCount",
    takeaway: "military/campaign",
    description:
      "皇帝自身が軍を率いて戦場に赴いた回数です。将軍を派遣しただけの場合は含めません。同じ相手への一連の遠征は1回と数えています。",
  },
  {
    id: "suppression",
    key: "rebellionSuppressionCount",
    takeaway: "military/suppression",
    description:
      "在位中に、政権側として反乱の鎮圧にあたった件数です（首謀者・蜂起単位で1件）。鎮圧に成功したかどうかは問いません。",
  },
  {
    id: "suffered",
    key: "rebellionSufferedCount",
    takeaway: "military/suffered",
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
      <StatsPageJsonLd
        name={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        path="/military"
      />
      <PageHeader title="軍事" />
      {/* 3つのランキングが縦に並び、狭い画面では1画面スクロールしてもまだ1つ目の
          途中にいる。サイドバーの節リンクはモバイルではハンバーガーの中なので、
          ページ内にも索引を出す。 */}
      <SectionJumpNav
        label="ランキングへジャンプ"
        items={sections.map(({ id, key }) => ({
          id,
          label: militaryEventLabels[key],
        }))}
      />
      {sections.map(({ id, key, takeaway, description }) => (
        <Section
          key={key}
          id={id}
          scrollMt={BELOW_SECTION_NAV}
          title={`${militaryEventLabels[key]}ランキング`}
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
              valueLabel={militaryEventLabels[key]}
            />
          </LazyMount>
          <TopRankedTable
            records={records}
            metricKey={key}
            title={`${militaryEventLabels[key]}の上位10名`}
          />
        </Section>
      ))}
    </>
  );
}
