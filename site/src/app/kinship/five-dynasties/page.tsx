// 系譜図の第6章（五代十国）。公開の経緯と登録先は ../page.tsx の頭のコメント。
import type { Metadata } from "next";

import { KinshipChapterPage } from "@/components/kinship/chapter-page";
import { BreadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { KINSHIP_CHAPTERS } from "../chapters";

const PAGE_TITLE = "系譜図（五代十国）";

export const metadata: Metadata = buildMetadata({
  path: "/kinship/five-dynasties",
  title: PAGE_TITLE,
  description: "五代（後梁・後唐・後晋・後漢・後周）と十国の皇帝とその親族の家系図。唐からの禅譲もたどれる。全8章の第6章。",
});

export default function KinshipFiveDynastiesPage() {
  return (
    <>
      <BreadcrumbJsonLd label={PAGE_TITLE} path="/kinship/five-dynasties" />
      <KinshipChapterPage chapter={KINSHIP_CHAPTERS[5]} />
    </>
  );
}
