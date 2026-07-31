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

// 2026-07-31 に /timeline・/kinship と統計5ページ（死因・即位／宮廷イベント／軍事／
// 年齢／王朝・時代で見る）を廃止し、ファイルごと削除した。同日「データベース」を新設。
// **「在位データ」はデータベースへ吸収して廃止する予定**（未実施）— 消すときは
// ここのエントリと SITE_SECTIONS の両方から落とす。最終形は4エントリ。
export const navCategories: NavCategory[] = [
  { label: "概要ダッシュボード", href: "/" },
  { label: "皇帝一覧", href: "/emperors" },
  { label: "データベース", href: "/database" },
  {
    label: "在位データ",
    href: "/reign",
    items: [
      { label: "在位年数ランキング", href: "/reign#ranking" },
      { label: "復位者一覧（複数回即位）", href: "/reign#restoration" },
    ],
  },
  { label: "このサイトについて", href: "/about" },
];
