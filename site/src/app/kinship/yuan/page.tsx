// 系譜図の第8章（元）。公開の経緯と登録先は ../page.tsx の頭のコメント。
import type { Metadata } from "next";

import { KinshipChapterPage } from "@/components/kinship/chapter-page";
import { BreadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { KINSHIP_CHAPTERS } from "../chapters";

const PAGE_TITLE = "系譜図（元）";

export const metadata: Metadata = buildMetadata({
  path: "/kinship/yuan",
  title: PAGE_TITLE,
  description:
    "元・北元と元末の韓宋・天完・陳漢・明夏の皇帝とその親族の家系図。全10章の第8章。",
});

export default function KinshipYuanPage() {
  return (
    <>
      <BreadcrumbJsonLd label={PAGE_TITLE} path="/kinship/yuan" />
      <KinshipChapterPage chapter={KINSHIP_CHAPTERS[7]} />
    </>
  );
}
