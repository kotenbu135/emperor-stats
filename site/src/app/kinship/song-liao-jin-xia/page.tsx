// 系譜図の第7章（宋・遼・西夏・金）。公開の経緯と登録先は ../page.tsx の頭のコメント。
import type { Metadata } from "next";

import { KinshipChapterPage } from "@/components/kinship/chapter-page";
import { BreadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { KINSHIP_CHAPTERS } from "../chapters";

const PAGE_TITLE = "系譜図（宋・遼・西夏・金）";

export const metadata: Metadata = buildMetadata({
  path: "/kinship/song-liao-jin-xia",
  title: PAGE_TITLE,
  description:
    "北宋・南宋と遼・西遼・金・西夏の皇帝とその親族の家系図。後周からの禅譲もたどれる。全7章の第7章。",
});

export default function KinshipSongLiaoJinXiaPage() {
  return (
    <>
      <BreadcrumbJsonLd label={PAGE_TITLE} path="/kinship/song-liao-jin-xia" />
      <KinshipChapterPage chapter={KINSHIP_CHAPTERS[6]} />
    </>
  );
}
