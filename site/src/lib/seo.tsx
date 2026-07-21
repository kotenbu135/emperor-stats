// SEO関連の単一情報源。node:fsに依存しないためクライアント安全（emperor-types.tsと同じ方針）。
// metadata生成・JSON-LD構造化データ生成をこのファイルに集約し、各page.tsxからは呼ぶだけにする。

import type { Metadata } from "next";

export const SITE_URL = "https://emperorstats.com";
export const SITE_NAME = "中国皇帝統計";
export const DEFAULT_DESCRIPTION =
  "始皇帝から溥儀まで、中国史上で実際に「皇帝」を名乗った365人の在位期間・死因・即位経路などを集計・可視化したサイトです。";

export interface SiteSection {
  href: string;
  label: string;
  description: string;
}

/** トップページのカード一覧と各ページのmeta descriptionが共有する内容（説明文の重複・drift防止）。 */
export const SITE_SECTIONS: SiteSection[] = [
  {
    href: "/timeline",
    label: "通史年表",
    description: "始皇帝から溥儀まで、全皇帝の在位を1本の年表で一望",
  },
  {
    href: "/emperors",
    label: "皇帝一覧",
    description: "全皇帝の図鑑。名前・王朝で検索し、詳細を表示",
  },
  {
    href: "/reign",
    label: "在位データ",
    description: "在位年数ランキングと復位者（複数回即位）の一覧",
  },
  {
    href: "/death-accession",
    label: "死因・即位",
    description: "死因別・即位経路別の内訳",
  },
  {
    href: "/court-events",
    label: "宮廷イベント",
    description: "改元・大赦・立后・皇太子廃立・遷都の回数ランキング",
  },
  {
    href: "/military",
    label: "軍事",
    description: "親征・反乱鎮圧・被反乱の回数ランキング",
  },
  {
    href: "/ages",
    label: "年齢",
    description: "即位時年齢・没年齢のランキング（数え年）",
  },
  {
    href: "/dynasties",
    label: "王朝・時代で見る",
    description: "平均在位年数・死因の内訳を王朝単位で横断比較",
  },
];

export function absoluteUrl(path: string): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

/** SITE_SECTIONSの説明文をmeta descriptionにも流用し、トップページのカードと文言がずれないようにする。 */
export function sectionDescription(href: string): string {
  const section = SITE_SECTIONS.find((s) => s.href === href);
  if (!section) throw new Error(`SITE_SECTIONSに存在しないhrefです: ${href}`);
  return section.description;
}

/**
 * 各ページの metadata export はこれ経由に統一する。title は省略時
 * layout.tsx の title.default（サイト名そのもの）を継承し、指定時は
 * title.template（"%s | 中国皇帝統計"）が自動で付与される。
 * openGraph/twitter向けにはサイト名サフィックスを付けない短い形を使う。
 */
export function buildMetadata({
  path,
  title,
  description = DEFAULT_DESCRIPTION,
}: {
  path: string;
  title?: string;
  description?: string;
}): Metadata {
  const ogTitle = title ?? SITE_NAME;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: ogTitle,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "ja_JP",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
    },
  };
}

export interface JsonLdPerson {
  name: string;
  /** 諱・廟号・諡号・別名。nameと重複しない値のみ、呼び出し側で整形して渡す。 */
  alternateName?: string[];
  url: string;
  description: string;
  image?: string;
  birthDate?: string;
  deathDate?: string;
  /** 同一人物を指す外部の権威あるURL（Wikidata等）。機械生成の推測URLは渡さないこと。 */
  sameAs?: string[];
}

export function personJsonLd(p: JsonLdPerson): Record<string, unknown> {
  const alternateName = p.alternateName?.filter((n) => n && n !== p.name);
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.name,
    ...(alternateName && alternateName.length
      ? { alternateName: alternateName.length === 1 ? alternateName[0] : alternateName }
      : {}),
    url: p.url,
    description: p.description,
    ...(p.image ? { image: p.image } : {}),
    ...(p.birthDate ? { birthDate: p.birthDate } : {}),
    ...(p.deathDate ? { deathDate: p.deathDate } : {}),
    ...(p.sameAs && p.sameAs.length
      ? { sameAs: p.sameAs.length === 1 ? p.sameAs[0] : p.sameAs }
      : {}),
  };
}

export function breadcrumbJsonLd(
  items: { name: string; url: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function websiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    inLanguage: "ja",
  };
}

export function datasetJsonLd({
  description,
  dateModified,
  emperorCount,
  version,
  temporalCoverage,
}: {
  description: string;
  dateModified: string;
  emperorCount: number;
  version: string;
  temporalCoverage: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: SITE_NAME,
    description,
    url: SITE_URL,
    dateModified,
    version,
    temporalCoverage,
    inLanguage: "ja",
    license: "https://creativecommons.org/licenses/by/4.0/",
    isAccessibleForFree: true,
    creator: { "@type": "Organization", name: SITE_NAME },
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: absoluteUrl("/data/emperors.json"),
      },
      {
        "@type": "DataDownload",
        encodingFormat: "text/csv",
        contentUrl: absoluteUrl("/data/emperors.csv"),
      },
    ],
    variableMeasured: [
      "在位年数",
      "死因",
      "即位経路",
      "改元回数",
      "大赦回数",
      "立后回数",
      "皇太子廃立回数",
      "親征回数",
      "反乱鎮圧回数",
      "被反乱回数",
      "遷都回数",
      "即位時年齢",
      "没年齢",
    ],
    measurementTechnique:
      "正史原典（本紀・列伝）を第一情報源とした個別調査",
    size: `${emperorCount}件`,
  };
}

/** 統計ページ用の簡易パンくずJSON-LD（トップ › ページ名の2階層）。 */
export function BreadcrumbJsonLd({ label, path }: { label: string; path: string }) {
  return (
    <JsonLd
      data={breadcrumbJsonLd([
        { name: SITE_NAME, url: SITE_URL },
        { name: label, url: absoluteUrl(path) },
      ])}
    />
  );
}

/** JSON-LD構造化データの埋め込み用。値はすべてこのサイト自身が生成したデータのみを渡すこと。 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  // </script> によるスクリプト早期終了を防ぐため "<" をエスケープする。
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  );
}
