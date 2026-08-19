// 系譜図の第1章（秦・漢）。この URL が章の入口で、章の一覧は chapters.ts、
// ページの共通部は components/kinship/chapter-page.tsx。
//
// 2026-08-17 の版は出来が公開に耐えないと判断して同日取り下げた（Issue #174）。
// 2026-08-19 に「一般的な家系図のつなぎ方」で作り直し、全6章そろえてユーザー承認のうえ
// 再公開した（SITE_SECTIONS・nav-data.ts・sitemap・capture-site.mjs に登録済み・index可）。
import type { Metadata } from "next";

import { KinshipChapterPage } from "@/components/kinship/chapter-page";
import { BreadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { KINSHIP_CHAPTERS } from "./chapters";

const PAGE_TITLE = "系譜図（秦・漢）";

export const metadata: Metadata = buildMetadata({
  path: "/kinship",
  title: PAGE_TITLE,
  description:
    "始皇帝から後漢まで、秦・漢の皇帝とその親族のつながりを描いた家系図。全6章の第1章。",
});

export default function KinshipPage() {
  return (
    <>
      <BreadcrumbJsonLd label={PAGE_TITLE} path="/kinship" />
      <KinshipChapterPage chapter={KINSHIP_CHAPTERS[0]} />
    </>
  );
}
