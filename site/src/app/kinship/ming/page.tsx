// 系譜図の第9章（明）。公開の経緯と登録先は ../page.tsx の頭のコメント。
import type { Metadata } from "next";

import { KinshipChapterPage } from "@/components/kinship/chapter-page";
import { BreadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { KINSHIP_CHAPTERS } from "../chapters";

const PAGE_TITLE = "系譜図（明）";

export const metadata: Metadata = buildMetadata({
  path: "/kinship/ming",
  title: PAGE_TITLE,
  description:
    "明と南明・明末の順（李自成）・西（張献忠）の皇帝とその親族の家系図。全10章の第9章。",
});

export default function KinshipMingPage() {
  return (
    <>
      <BreadcrumbJsonLd label={PAGE_TITLE} path="/kinship/ming" />
      <KinshipChapterPage chapter={KINSHIP_CHAPTERS[8]} />
    </>
  );
}
