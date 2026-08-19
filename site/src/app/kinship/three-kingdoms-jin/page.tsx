// 系譜図の第2章（三国・西晋）。公開の経緯と登録先は ../page.tsx の頭のコメント。
import type { Metadata } from "next";

import { KinshipChapterPage } from "@/components/kinship/chapter-page";
import { BreadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { KINSHIP_CHAPTERS } from "../chapters";

const PAGE_TITLE = "系譜図（三国・西晋）";

export const metadata: Metadata = buildMetadata({
  path: "/kinship/three-kingdoms-jin",
  title: PAGE_TITLE,
  description: "魏・蜀漢・呉と西晋の皇帝とその親族の家系図。後漢の献帝から魏への禅譲もたどれる。全8章の第2章。",
});

export default function KinshipThreeKingdomsJinPage() {
  return (
    <>
      <BreadcrumbJsonLd label={PAGE_TITLE} path="/kinship/three-kingdoms-jin" />
      <KinshipChapterPage chapter={KINSHIP_CHAPTERS[1]} />
    </>
  );
}
