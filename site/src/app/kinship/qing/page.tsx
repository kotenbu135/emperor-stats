// 系譜図の第10章（清・最終章）。公開の経緯と登録先は ../page.tsx の頭のコメント。
import type { Metadata } from "next";

import { KinshipChapterPage } from "@/components/kinship/chapter-page";
import { BreadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { KINSHIP_CHAPTERS } from "../chapters";

const PAGE_TITLE = "系譜図（清）";

export const metadata: Metadata = buildMetadata({
  path: "/kinship/qing",
  title: PAGE_TITLE,
  description:
    "清と三藩の周（呉三桂）・中華帝国（袁世凱）の皇帝とその親族の家系図。全10章の第10章。",
});

export default function KinshipQingPage() {
  return (
    <>
      <BreadcrumbJsonLd label={PAGE_TITLE} path="/kinship/qing" />
      <KinshipChapterPage chapter={KINSHIP_CHAPTERS[9]} />
    </>
  );
}
