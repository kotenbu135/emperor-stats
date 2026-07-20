import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE, renderStatPageOgImage } from "@/lib/og-image";

export const dynamic = "force-static";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
export const alt = "このサイトについて | 中国皇帝統計";

export default function Image() {
  return renderStatPageOgImage({
    title: "このサイトについて",
    description:
      "中国皇帝統計の収録基準・各統計項目の数え方・典拠とした史料・肖像画の出典・免責事項について説明します。",
  });
}
