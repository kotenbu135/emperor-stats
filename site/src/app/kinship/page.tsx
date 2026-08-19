// 系譜図（Issue #174）の**試作**。この URL は最初の章（秦・漢）。章の一覧は
// chapters.ts、ページの共通部は components/kinship/chapter-page.tsx。
//
// **まだ SITE_SECTIONS・nav-data.ts・sitemap・capture-site.mjs のどれにも登録していない**
// （/lab と同じ非公開の作業ページ）。前回の版は登録して配信し、数時間後に取り下げた。
// 見た目がユーザーの水準に届いたと確認できるまで、この面は登録しない。
//
// **noindex は /lab より強い理由で要る** — このURLは 2026-08-17 に数時間だけ公開されて
// 取り下げた先で、廃止済みURLには表示が残っている（GSC 実測）。次の配信で out/ に入る以上、
// 登録していないことは検索エンジンに出ないことを意味しない。
import type { Metadata } from "next";

import { KinshipChapterPage } from "@/components/kinship/chapter-page";
import { buildMetadata } from "@/lib/seo";
import { KINSHIP_CHAPTERS } from "./chapters";

export const metadata: Metadata = {
  ...buildMetadata({
    path: "/kinship",
    title: "系譜図（試作）",
    description: "秦・漢の系譜図の試作（非公開・検索エンジンには出さない）",
  }),
  robots: { index: false, follow: false },
};

export default function KinshipPage() {
  return <KinshipChapterPage chapter={KINSHIP_CHAPTERS[0]} />;
}
