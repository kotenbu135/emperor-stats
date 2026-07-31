import { PageHeader } from "@/components/layout/page-header";
import { OverviewBoard } from "@/components/home-v2/overview-board";
import { getHomeHighlights, getOverviewStats } from "@/lib/emperors";
import { buildMetadata, JsonLd, websiteJsonLd } from "@/lib/seo";

export const metadata = buildMetadata({ path: "/" });

export default function Home() {
  const stats = getOverviewStats();
  // 各ランキングの上位10名（同値が続く場合は10位と同値のところまで伸びる）。
  // 3タブとも同じ件数にすること（1つだけ増やすと切り替えでカードの高さが跳ねる）。
  const highlights = getHomeHighlights(10);

  const figures = [
    {
      label: "収録した皇帝",
      value: String(stats.emperorCount),
      unit: "名",
      note: "生前に「皇帝」を名乗った人物のみ",
      seal: true,
    },
    {
      label: "王朝・政権",
      value: String(highlights.dynastyCount),
      note: "並立政権・自称政権を含む",
    },
    {
      // 下限は始皇帝の即位、上限は宣統帝・溥儀の最後の在位（満洲国）。
      // 「清の滅亡（1912年）」ではないので注記でそう書かない。
      label: "対象年代",
      value: highlights.yearSpanLabel,
      note: "始皇帝から溥儀まで",
    },
    {
      label: "平均在位期間",
      value: stats.avgReignLabel.replace("約", ""),
      note: `最長は${stats.longestReign.durationLabel}、最短は${stats.shortestReign.durationLabel}`,
    },
  ];

  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <PageHeader
        title="中国皇帝統計"
        description={`始皇帝から溥儀まで、中国史上で実際に「皇帝」を名乗った人物のデータセットです`}
      />
      <div className="px-gutter py-section md:px-gutter-wide">
        <div className="mx-auto w-full max-w-content">
          <OverviewBoard
            figures={figures}
            rankings={highlights.rankings}
            deathCauses={highlights.deathCauses}
            accessionRoutes={highlights.accessionRoutes}
            reignDeath={highlights.reignDeath}
            centuries={highlights.centuries}
          />
        </div>
      </div>
    </>
  );
}
