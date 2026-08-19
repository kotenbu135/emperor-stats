// 系譜図の第3章（東晋・十六国）。公開の経緯と登録先は ../page.tsx の頭のコメント。
import type { Metadata } from "next";

import { KinshipChapterPage } from "@/components/kinship/chapter-page";
import { BreadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { KINSHIP_CHAPTERS } from "../chapters";

const PAGE_TITLE = "系譜図（東晋・十六国）";

export const metadata: Metadata = buildMetadata({
  path: "/kinship/eastern-jin-sixteen",
  title: PAGE_TITLE,
  description: "東晋と十六国（前趙・後趙・前燕・前秦・後燕・後秦など）の皇帝とその親族の家系図。全8章の第3章。",
});

export default function KinshipEasternJinSixteenPage() {
  return (
    <>
      <BreadcrumbJsonLd label={PAGE_TITLE} path="/kinship/eastern-jin-sixteen" />
      <KinshipChapterPage chapter={KINSHIP_CHAPTERS[2]} />
    </>
  );
}
