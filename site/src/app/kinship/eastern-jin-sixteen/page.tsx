// 系譜図の第3章（東晋・十六国）。非公開・noindex の理由は ../page.tsx の頭のコメント。
import type { Metadata } from "next";

import { KinshipChapterPage } from "@/components/kinship/chapter-page";
import { buildMetadata } from "@/lib/seo";
import { KINSHIP_CHAPTERS } from "../chapters";

export const metadata: Metadata = {
  ...buildMetadata({
    path: "/kinship/eastern-jin-sixteen",
    title: "系譜図（試作・東晋十六国）",
    description: "東晋・十六国の系譜図の試作（非公開・検索エンジンには出さない）",
  }),
  robots: { index: false, follow: false },
};

export default function KinshipEasternJinSixteenPage() {
  return <KinshipChapterPage chapter={KINSHIP_CHAPTERS[2]} />;
}
