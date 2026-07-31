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
    href: "/emperors",
    label: "皇帝一覧",
    description: "全皇帝の図鑑。名前・王朝で検索し、詳細を表示",
  },
  {
    href: "/reign",
    label: "在位データ",
    description: "在位年数ランキングと復位者（複数回即位）の一覧",
  },
];

/**
 * 運営者。実名は出さず GitHub のハンドルを名乗りとして使う（2026-07-27 の SEO 監査 3-2）。
 * 監査時点では著者・運営者の実在性を示す情報が本文にも構造化データにも無く、
 * Dataset の creator がサイト自身を指す自己言及になっていた。
 * ハンドル・URL の単一情報源はここ（/about の本文と JSON-LD が同じ値を使う）。
 */
export const OPERATOR = {
  /** 名乗り（GitHub のハンドル）。 */
  handle: "kotenbu135",
  profileUrl: "https://github.com/kotenbu135",
  repoUrl: "https://github.com/kotenbu135/emperor-stats",
} as const;

/** 運営者ノードのIRI。Dataset の creator と /about の記載が同じ主体を指すよう @id で結ぶ。 */
export const OPERATOR_ID = `${SITE_URL}/about#operator`;

/** 運営者（Person）ノード。sameAs は本人が管理していると確認できる URL のみ。 */
export function operatorNode(): Record<string, unknown> {
  return {
    "@type": "Person",
    "@id": OPERATOR_ID,
    name: OPERATOR.handle,
    url: absoluteUrl("/about"),
    sameAs: [OPERATOR.profileUrl, OPERATOR.repoUrl],
  };
}

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
    // title を undefined の明示キーとして含めると layout.tsx の title.default 継承が
    // 打ち消され、トップページの <title> が空になる（2026-07-22 実測）。省略時はキー自体を出さない。
    ...(title !== undefined ? { title } : {}),
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

/**
 * 一覧ページ用のCollectionPage＋ItemList。itemsは先頭N件だけを渡してよく、
 * リスト全体の規模はnumberOfItemsで伝える（全件を書き出すとHTMLが太るため。
 * itemsの順序＝ページの既定表示順で、positionはその順に振る）。
 * ListItemのURLは詳細ページを指すため item ではなく url に置く。
 */
export function collectionPageJsonLd({
  name,
  description,
  path,
  numberOfItems,
  items,
}: {
  name: string;
  description: string;
  path: string;
  numberOfItems: number;
  items: { name: string; url: string }[];
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url: absoluteUrl(path),
    inLanguage: "ja",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems,
      itemListElement: items.map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: item.name,
        url: item.url,
      })),
    },
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

/**
 * /about に置くDatasetノードのIRI。統計ページのWebPageから isPartOf で
 * 参照するため、@idを与えて指せるようにしている（Dataset本体の内容は変えない）。
 */
export const DATASET_ID = `${SITE_URL}/about#dataset`;

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
    "@id": DATASET_ID,
    name: SITE_NAME,
    description,
    url: SITE_URL,
    dateModified,
    version,
    temporalCoverage,
    inLanguage: "ja",
    license: "https://creativecommons.org/licenses/by/4.0/",
    isAccessibleForFree: true,
    // creator はサイト自身でなく運営者を指す（自己言及だと E-E-A-T の
    // Authoritativeness シグナルにならない）。publisher はサイトのまま。
    creator: operatorNode(),
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
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

/**
 * 統計ページ用のWebPage。isPartOfで /about のDatasetを指し、どのページも
 * 同一データセットの可視化であることを機械可読にする。
 */
export function statsPageJsonLd({
  name,
  description,
  path,
}: {
  name: string;
  description: string;
  path: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name,
    description,
    url: absoluteUrl(path),
    inLanguage: "ja",
    isPartOf: {
      "@type": "Dataset",
      "@id": DATASET_ID,
      name: SITE_NAME,
      url: absoluteUrl("/about"),
    },
  };
}

/** 統計ページ用のWebPage JSON-LD。name/descriptionはページ側の metadata と
 *  同じ定数を渡すこと（検索結果に出る文言とのdrift防止）。 */
export function StatsPageJsonLd({
  name,
  description,
  path,
}: {
  name: string;
  description: string;
  path: string;
}) {
  return <JsonLd data={statsPageJsonLd({ name, description, path })} />;
}

/** JSON-LD構造化データの埋め込み用。値はすべてこのサイト自身が生成したデータのみを渡すこと。 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  // </script> によるスクリプト早期終了を防ぐため "<" をエスケープする。
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  );
}
