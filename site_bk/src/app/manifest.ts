import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/seo";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description:
      "始皇帝から溥儀まで、中国史上の皇帝365人の在位期間・死因・即位経路などを集計・可視化したサイト",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f1e8",
    theme_color: "#a6321c",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  };
}
