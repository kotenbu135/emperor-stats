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
  sectionDescription,
} from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/emperors",
  title: "皇帝一覧",
  description: sectionDescription("/emperors"),
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
          name: "皇帝一覧",
          description: sectionDescription("/emperors"),
          path: "/emperors",
          numberOfItems: records.length,
          items: listItems,
        })}
      />
      <PageHeader
        title="皇帝一覧"
        description={`収録している全${records.length}名の一覧です。カードを押すと在位期間・死因・各種回数などの詳細を表示します。`}
      />
      <div className="px-6 py-8 md:px-10">
        <EmperorGrid records={records} dynastyOptions={dynastyOptions} />
      </div>
    </>
  );
}
