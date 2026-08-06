export interface NavLink {
  label: string;
  href: string;
}

export interface NavCategory {
  label: string;
  /** カテゴリ見出し自体の遷移先（配下ページの先頭）。 */
  href: string;
  /**
   * モバイルヘッダー（56px の1行）に直接並べるときの短縮名。
   * **これを持つ項目だけがヘッダーに出る。**
   */
  shortLabel?: string;
  items?: NavLink[];
}

// 2026-07-31 に /timeline・/kinship と統計5ページ（死因・即位／宮廷イベント／軍事／
// 年齢／王朝・時代で見る）を廃止し、ファイルごと削除した。同日「データベース」を新設し、
// 「在位データ」（/reign）もデータベースへ吸収して廃止した。**これで最終形の4エントリ。**
export const navCategories: NavCategory[] = [
  { label: "概要ダッシュボード", href: "/", shortLabel: "概要" },
  { label: "皇帝一覧", href: "/emperors", shortLabel: "皇帝一覧" },
  { label: "データベース", href: "/database", shortLabel: "データベース" },
  { label: "このサイトについて", href: "/about" },
];

/**
 * モバイルヘッダーに直接並べる項目（2026-08-06・GitHub Issue #92）。
 *
 * ハンバーガーを畳んだのは、`/emperors`（全高5万px級）・`/database`（同1.8万px）で
 * **本文の中に他ページへの出口が最下部のフッター1本しか無かった**ため。押す手間ではなく
 * 「気づかない」が問題だったので、Sheet を挟まず文字で出す。
 *
 * **4項目目を足さない。** 320px の実測で3項目＋印＋ふりがなでほぼ埋まっており、
 * 「このサイトについて」を正式名で並べると溢れる（横スクロールする帯にはしない
 * ＝ SITE_DESIGN.md の時代ジャンプバーと同じ理由）。`/about` への出口は
 * 全ページ共通のフッターの常設リンクが担う。
 */
export const mobileNavCategories = navCategories.filter(
  (category) => category.shortLabel !== undefined,
);

/** モバイルヘッダー・サイドバーの現在地判定（皇帝個別ページは「皇帝一覧」に属する）。 */
export function isCurrentSection(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
