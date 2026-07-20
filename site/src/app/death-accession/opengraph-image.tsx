import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE, renderStatPageOgImage } from "@/lib/og-image";
import { sectionDescription } from "@/lib/seo";

export const dynamic = "force-static";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
export const alt = "死因・即位 | 中国皇帝統計";

export default function Image() {
  return renderStatPageOgImage({
    title: "死因・即位",
    description: sectionDescription("/death-accession"),
  });
}
