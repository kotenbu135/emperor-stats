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
// 年齢／王朝・時代で見る）を廃止し、ファイルごと削除した。同日「データベース」を新設し、
// 「在位データ」（/reign）もデータベースへ吸収して廃止した。**これで最終形の4エントリ。**
export const navCategories: NavCategory[] = [
  { label: "概要ダッシュボード", href: "/" },
  { label: "皇帝一覧", href: "/emperors" },
  { label: "データベース", href: "/database" },
  { label: "このサイトについて", href: "/about" },
];
