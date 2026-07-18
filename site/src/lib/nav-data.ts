export interface NavLink {
  label: string;
  href: string;
}

export interface NavCategory {
  label: string;
  /** カテゴリ見出し自体の遷移先（配下ページの先頭）。 */
  href: string;
  items?: NavLink[];
}

export const navCategories: NavCategory[] = [
  { label: "概要ダッシュボード", href: "/" },
  { label: "皇帝一覧", href: "/emperors" },
  {
    label: "在位データ",
    href: "/reign",
    items: [
      { label: "在位年数ランキング", href: "/reign#ranking" },
      { label: "復位者一覧（複数回即位）", href: "/reign#restoration" },
    ],
  },
  {
    label: "死因・即位",
    href: "/death-accession",
    items: [
      { label: "死因別分布", href: "/death-accession#death-cause" },
      { label: "即位経路別分布", href: "/death-accession#accession" },
    ],
  },
  {
    label: "宮廷イベント",
    href: "/court-events",
    items: [
      { label: "改元回数ランキング", href: "/court-events#era" },
      { label: "大赦回数ランキング", href: "/court-events#amnesty" },
      { label: "立后回数ランキング", href: "/court-events#empress" },
      { label: "皇太子廃立回数ランキング", href: "/court-events#deposition" },
      { label: "遷都回数ランキング", href: "/court-events#capital" },
    ],
  },
  {
    label: "軍事",
    href: "/military",
    items: [
      { label: "親征回数ランキング", href: "/military#campaign" },
      { label: "反乱鎮圧回数ランキング", href: "/military#suppression" },
      { label: "被反乱回数ランキング", href: "/military#suffered" },
    ],
  },
  {
    label: "年齢",
    href: "/ages",
    items: [
      { label: "即位時年齢ランキング", href: "/ages#accession-age" },
      { label: "没年齢ランキング", href: "/ages#death-age" },
    ],
  },
  {
    label: "王朝・時代で見る",
    href: "/dynasties",
    items: [
      { label: "平均在位年数", href: "/dynasties#avg-reign" },
      { label: "死因の内訳", href: "/dynasties#death-cause" },
    ],
  },
  { label: "このサイトについて", href: "/about" },
];
