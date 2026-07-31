import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { LabVariants } from "@/components/home-v2/lab-variants";
import { getHomeHighlights, getOverviewStats } from "@/lib/emperors";

/**
 * 概要ダッシュボードの各パネルを、Tremor のブロックに沿った複数の型で
 * 並べて見比べるための場。公開ページではない。
 * noindex にしてあり、SITE_SECTIONS に無いので sitemap にも載らない。
 */
export const metadata: Metadata = {
  title: "パネル比較（作業用）",
  robots: { index: false, follow: false },
};

export default function Lab() {
  const stats = getOverviewStats();
  const highlights = getHomeHighlights(8);

  return (
    <>
      <PageHeader
        title="パネル比較（作業用）"
        description="概要ダッシュボードの各パネルを、Tremor のブロックに沿った複数の型で並べたもの。実データを流してあるので、そのまま採否を決められる。公開ページではない。"
      />
      <div className="px-gutter py-section md:px-gutter-wide">
        <div className="mx-auto w-full max-w-content">
          <LabVariants
            longestReigns={highlights.longestReigns}
            deathCauses={highlights.deathCauses}
            accessionRoutes={highlights.accessionRoutes}
            eras={highlights.eras}
            emperorCount={stats.emperorCount}
            dynastyCount={highlights.dynastyCount}
            portraitCount={stats.portraitCount}
            restorationCount={stats.restorationCount}
          />
        </div>
      </div>
    </>
  );
}
