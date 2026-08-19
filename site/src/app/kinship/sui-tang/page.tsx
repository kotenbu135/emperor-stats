// 系譜図の第5章（隋・唐）。公開の経緯と登録先は ../page.tsx の頭のコメント。
import type { Metadata } from "next";

import { KinshipChapterPage } from "@/components/kinship/chapter-page";
import { BreadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { KINSHIP_CHAPTERS } from "../chapters";

const PAGE_TITLE = "系譜図（隋・唐）";

export const metadata: Metadata = buildMetadata({
  path: "/kinship/sui-tang",
  title: PAGE_TITLE,
  description: "隋と唐の皇帝とその親族の家系図。北周からの禅譲、武則天の周、安史の乱の燕もたどれる。全7章の第5章。",
});

export default function KinshipSuiTangPage() {
  return (
    <>
      <BreadcrumbJsonLd label={PAGE_TITLE} path="/kinship/sui-tang" />
      <KinshipChapterPage chapter={KINSHIP_CHAPTERS[4]} />
    </>
  );
}
