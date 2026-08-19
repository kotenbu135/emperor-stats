// 系譜図の第4章（南北朝）。公開の経緯と登録先は ../page.tsx の頭のコメント。
import type { Metadata } from "next";

import { KinshipChapterPage } from "@/components/kinship/chapter-page";
import { BreadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { KINSHIP_CHAPTERS } from "../chapters";

const PAGE_TITLE = "系譜図（南北朝）";

export const metadata: Metadata = buildMetadata({
  path: "/kinship/northern-southern",
  title: PAGE_TITLE,
  description: "南朝（宋・斉・梁・陳）と北朝（北魏・東魏・西魏・北斉・北周）の皇帝とその親族の家系図。全9章の第4章。",
});

export default function KinshipNorthernSouthernPage() {
  return (
    <>
      <BreadcrumbJsonLd label={PAGE_TITLE} path="/kinship/northern-southern" />
      <KinshipChapterPage chapter={KINSHIP_CHAPTERS[3]} />
    </>
  );
}
