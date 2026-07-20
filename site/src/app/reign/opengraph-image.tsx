import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE, renderStatPageOgImage } from "@/lib/og-image";
import { sectionDescription } from "@/lib/seo";

export const dynamic = "force-static";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
export const alt = "在位データ | 中国皇帝統計";

export default function Image() {
  return renderStatPageOgImage({ title: "在位データ", description: sectionDescription("/reign") });
}
