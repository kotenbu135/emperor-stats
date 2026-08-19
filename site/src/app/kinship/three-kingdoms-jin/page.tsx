// 系譜図の第2章（三国・西晋）。非公開・noindex の理由は ../page.tsx の頭のコメント。
import type { Metadata } from "next";

import { KinshipChapterPage } from "@/components/kinship/chapter-page";
import { buildMetadata } from "@/lib/seo";
import { KINSHIP_CHAPTERS } from "../chapters";

export const metadata: Metadata = {
  ...buildMetadata({
    path: "/kinship/three-kingdoms-jin",
    title: "系譜図（試作・三国西晋）",
    description: "三国・西晋の系譜図の試作（非公開・検索エンジンには出さない）",
  }),
  robots: { index: false, follow: false },
};

export default function KinshipThreeKingdomsJinPage() {
  return <KinshipChapterPage chapter={KINSHIP_CHAPTERS[1]} />;
}
