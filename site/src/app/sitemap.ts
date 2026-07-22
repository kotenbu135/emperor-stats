import type { MetadataRoute } from "next";
import { datasetGeneratedAt, getAllEmperorRecords } from "@/lib/emperors";
import { SITE_SECTIONS, SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(datasetGeneratedAt);

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified, changeFrequency: "weekly", priority: 1 },
    ...SITE_SECTIONS.map(
      (s): MetadataRoute.Sitemap[number] => ({
        url: `${SITE_URL}${s.href}`,
        lastModified,
        changeFrequency: "weekly",
        priority: 0.8,
      }),
    ),
    {
      url: `${SITE_URL}/about`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  // 個別ページに lastModified は付けない。データセットには人物単位の更新日時が
  // 無く、一律 datasetGeneratedAt を付けるとデータ訂正1件で365ページ全部が
  // 「更新済み」と主張することになる（信頼できない lastmod はクローラに
  // 無視される方が害が大きい）。集計が実際に変わる統計ページ側のみ付ける。
  const emperorPages: MetadataRoute.Sitemap = getAllEmperorRecords().map((r) => ({
    url: `${SITE_URL}/emperors/${r.id}`,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticPages, ...emperorPages];
}
