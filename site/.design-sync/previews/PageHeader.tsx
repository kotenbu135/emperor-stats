import { PageHeader } from "site";

/** 統計ページの見出し。朱のアクセントバー + 明朝見出しがサイト共通の型。 */
export function Default() {
  return (
    <PageHeader
      title="在位期間"
      description="始皇帝から宣統帝まで365人の在位年数・在位日数を、正史の即位日・退位日から実日数で算出しています。"
    />
  );
}

/** 説明文を省いた最小構成。 */
export function TitleOnly() {
  return <PageHeader title="王朝・時代で見る" />;
}

/** 記事型ページ（/about 等）。本文と同じ列幅に見出しを揃える。 */
export function Contained() {
  return (
    <PageHeader
      contained
      title="このサイトについて"
      description="収録基準・数え方・出典・免責事項をまとめています。"
    />
  );
}
