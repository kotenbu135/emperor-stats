// 系譜図の第6章（五代十国）。非公開・noindex の理由は ../page.tsx の頭のコメント。
import type { Metadata } from "next";

import { KinshipChapterPage } from "@/components/kinship/chapter-page";
import { buildMetadata } from "@/lib/seo";
import { KINSHIP_CHAPTERS } from "../chapters";

export const metadata: Metadata = {
  ...buildMetadata({
    path: "/kinship/five-dynasties",
    title: "系譜図（試作・五代十国）",
    description: "五代十国の系譜図の試作（非公開・検索エンジンには出さない）",
  }),
  robots: { index: false, follow: false },
};

export default function KinshipFiveDynastiesPage() {
  return <KinshipChapterPage chapter={KINSHIP_CHAPTERS[5]} />;
}
