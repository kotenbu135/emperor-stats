import { PageHeader } from "@/components/layout/page-header";
import { EmperorTable } from "@/components/database/emperor-table";
import { getDynastyOptions, getEmperorTableRecords } from "@/lib/emperors";
import { BreadcrumbJsonLd, buildMetadata, StatsPageJsonLd } from "@/lib/seo";

// title/descriptionはナビの短いラベル（SITE_SECTIONS）とは別物にする。
// ナビは短いままが正しく、検索結果に出るのはこちら。JSON-LDにも同じ定数を渡す。
const PAGE_TITLE = "データベース";
const PAGE_DESCRIPTION =
  "皇帝を名乗った365人を1つの表にまとめたデータベースです。在位年数・即位経路・死因・即位年齢・没年齢などの列で並べ替え、時代・王朝・即位経路・死因で絞り込めます。";

export const metadata = buildMetadata({
  path: "/database",
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
});

export default function DatabasePage() {
  // クライアントへ渡すのは表が描く列だけを持つ専用レコード（EmperorTableRecord）。
  // 一覧グリッド用の EmperorListRecord を流用しないこと（理由は型側のコメント）。
  const records = getEmperorTableRecords();
  const dynastyOptions = getDynastyOptions();

  return (
    <>
      <BreadcrumbJsonLd label={PAGE_TITLE} path="/database" />
      <StatsPageJsonLd
        name={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        path="/database"
      />
      <PageHeader
        title={PAGE_TITLE}
        description={`全${records.length}名の皇帝のデータベースの表。行の名前から個別ページへ移動できます。`}
      />
      {/* 余白は Section と同じガタートークンで揃える。本文列の上限（max-w-content）は
          EmperorTable 側で内側に掛ける — 絞り込みの帯だけは全幅に保つため
          （/emperors と同じ組み方）。 */}
      <div className="px-gutter py-section md:px-gutter-wide">
        <EmperorTable records={records} dynastyOptions={dynastyOptions} />
      </div>
    </>
  );
}
