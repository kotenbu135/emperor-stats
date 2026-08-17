import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE, renderStatPageOgImage } from "@/lib/og-image";
import { getOgFacts } from "@/lib/emperors";

export const dynamic = "force-static";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
export const alt = "系譜図 | 中国皇帝統計";

export default function Image() {
  return renderStatPageOgImage({
    title: "系譜図",
    // page.tsx の description（縦軸の取り方まで説明する長い版）とは別に、
    // 画像に収まる短縮版を持つ。3行に折り返すと事実カードがフッターに被る。
    description:
      "皇帝どうしの血縁を、縦軸を実時間にした図で見られます。秦・漢から五代十国までの6章。",
    facts: getOgFacts("/kinship"),
  });
}
