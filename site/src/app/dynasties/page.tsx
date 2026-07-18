import { PageHeader, Section } from "@/components/layout/page-header";
import { LazyMount } from "@/components/lazy-mount";
import { DynastyAvgReignChart } from "@/components/charts/dynasty-avg-reign-chart";
import { DynastyDeathCauseChart } from "@/components/charts/dynasty-death-cause-chart";
import { getAllEmperorRecords } from "@/lib/emperors";

export const metadata = {
  title: "王朝・時代で見る | 中国皇帝統計",
};

export default function DynastiesPage() {
  const records = getAllEmperorRecords();

  return (
    <>
      <PageHeader
        title="王朝・時代で見る"
        description="皇帝個人の統計を王朝（または時代）単位に集計した横断ビューです。"
      />
      <Section
        id="avg-reign"
        title="平均在位年数"
        description="王朝ごとの皇帝1人あたりの平均在位年数です。皇帝が少ない王朝ほど個人の影響が大きく出る点にご注意ください（各行に皇帝数を併記しています）。"
      >
        <LazyMount estimatedHeight={680}>
          <DynastyAvgReignChart records={records} />
        </LazyMount>
      </Section>
      <Section
        id="death-cause"
        title="死因の内訳"
        description="王朝ごとの死因の内訳です。帯の長さは皇帝数を表し、色は死因の分類を表します。"
      >
        <LazyMount estimatedHeight={710}>
          <DynastyDeathCauseChart records={records} />
        </LazyMount>
      </Section>
    </>
  );
}
