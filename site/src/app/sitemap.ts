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

  const emperorPages: MetadataRoute.Sitemap = getAllEmperorRecords().map((r) => ({
    url: `${SITE_URL}/emperors/${r.id}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticPages, ...emperorPages];
}
