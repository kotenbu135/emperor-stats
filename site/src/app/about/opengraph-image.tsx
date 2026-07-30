import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE, renderStatPageOgImage } from "@/lib/og-image";
import { getOgFacts } from "@/lib/emperors";

export const dynamic = "force-static";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
export const alt = "このサイトについて | 中国皇帝統計";

export default function Image() {
  return renderStatPageOgImage({
    title: "このサイトについて",
    // page.tsx の description（データセットのダウンロードにも触れる長い版）とは
    // 別に、画像に収まる短縮版を持つ。3行に折り返すと事実カードがフッターに被る。
    // 節を増やしたらこちらも直すこと（page.tsx:17 と PageHeader の文と対で管理）。
    description:
      "中国皇帝統計の収録基準・各統計項目の数え方・典拠とした史料・肖像画の出典・運営者情報・免責事項について説明します。",
    facts: getOgFacts("/about"),
  });
}
