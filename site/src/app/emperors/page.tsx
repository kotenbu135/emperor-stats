import { PageHeader } from "@/components/layout/page-header";
import { EmperorGrid } from "@/components/emperors/emperor-grid";
import { getDynastyOptions, getEmperorListRecords } from "@/lib/emperors";
import type { EmperorListRecord } from "@/lib/emperor-types";
import {
  absoluteUrl,
  BreadcrumbJsonLd,
  buildMetadata,
  collectionPageJsonLd,
  JsonLd,
} from "@/lib/seo";

// title/descriptionはナビの短いラベル（SITE_SECTIONS）とは別物にする。
// ナビは短いままが正しく、検索結果に出るのはこちら。JSON-LDにも同じ定数を渡す。
// （2026-07-27 まではナビ用の短い説明22字をそのまま meta description に流用していた。
//  統計8ページが60〜76字なのに対しサイト最大のハブページだけ手薄だったため独立させた。）
const PAGE_TITLE = "皇帝一覧";
const PAGE_DESCRIPTION =
  "始皇帝から溥儀まで、皇帝を名乗った365人の一覧です。名前・王朝・時代で絞り込み、在位年数や死因など全12項目を1人ずつ確認できます。";

export const metadata = buildMetadata({
  path: "/emperors",
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
});

/**
 * ItemListに書き出す件数。365件すべてを載せるとHTMLとRSCペイロードの両方に
 * 同じ配列が乗って数十KB太る一方、全365名のリンクは同じHTML内にクロール可能な
 * <a href="/emperors/{id}"> として既に出ている。リストの規模はnumberOfItemsで
 * 伝わるため、先頭の一部だけを列挙する。
 */
const JSON_LD_ITEM_COUNT = 30;

/** 一覧グリッドの既定表示順（emperor-grid.tsx の sections＝eraLabel ごとの初出順プール）と同じ並び。
 *  グリッド側の並べ方を変えたらここも合わせる（順位の意味がずれるため）。 */
function displayOrder(records: EmperorListRecord[]): EmperorListRecord[] {
  const byEra = new Map<string, EmperorListRecord[]>();
  for (const r of records) {
    const list = byEra.get(r.eraLabel);
    if (list) list.push(r);
    else byEra.set(r.eraLabel, [r]);
  }
  return [...byEra.values()].flat();
}

export default function EmperorsPage() {
  const records = getEmperorListRecords();
  const dynastyOptions = getDynastyOptions();
  const listItems = displayOrder(records)
    .slice(0, JSON_LD_ITEM_COUNT)
    .map((r) => ({ name: r.name, url: absoluteUrl(`/emperors/${r.id}`) }));

  return (
    <>
      <BreadcrumbJsonLd label="皇帝一覧" path="/emperors" />
      <JsonLd
        data={collectionPageJsonLd({
          name: PAGE_TITLE,
          description: PAGE_DESCRIPTION,
          path: "/emperors",
          numberOfItems: records.length,
          items: listItems,
        })}
      />
      <PageHeader
        title="皇帝一覧"
        description={`収録している全${records.length}名の一覧です。`}
      />
      {/* 余白は Section と同じガタートークンで揃える。本文列の上限（max-w-content）は
          EmperorGrid 側で内側に掛ける — 時代ジャンプバーだけは帯を全幅に保つため。 */}
      <div className="px-gutter py-section md:px-gutter-wide">
        <EmperorGrid records={records} dynastyOptions={dynastyOptions} />
      </div>
    </>
  );
}
