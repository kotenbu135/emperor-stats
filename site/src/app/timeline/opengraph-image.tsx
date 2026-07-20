import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE, renderStatPageOgImage } from "@/lib/og-image";

export const dynamic = "force-static";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
export const alt = "通史年表 | 中国皇帝統計";

export default function Image() {
  return renderStatPageOgImage({
    title: "通史年表",
    description:
      "始皇帝から溥儀まで、皇帝を名乗った365人の在位期間を1本の年表に。並立王朝の分裂期と統一期、皇帝不在の期間まで一望できます。",
  });
}
