import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE, renderStatPageOgImage } from "@/lib/og-image";
import { getOgFacts } from "@/lib/emperors";
import { sectionDescription } from "@/lib/seo";

export const dynamic = "force-static";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
export const alt = "王朝・時代で見る | 中国皇帝統計";

export default function Image() {
  return renderStatPageOgImage({
    title: "王朝・時代で見る",
    description: sectionDescription("/dynasties"),
    facts: getOgFacts("/dynasties"),
  });
}
