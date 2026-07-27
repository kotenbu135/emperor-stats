import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /kinship 本体は noindex だが、系譜データを返す /kinship-source は
      // Route Handler（HTMLでない）ため noindex メタを付けられない。
      // /kinship を全章そろえて公開するとき（メニュー追加・noindex 解除）に、
      // この Disallow も一緒に外す。
      disallow: ["/kinship-source"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
