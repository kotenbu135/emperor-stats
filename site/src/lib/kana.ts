// かな正規化の小さなユーティリティ。検索クエリ（クライアント側）と
// searchKana生成（ビルド側）の両方で使うため、音読みテーブル
// （kana-readings.ts・サーバー専用）とはファイルを分けてある
// （クライアントバンドルにテーブルを含めないため）。

/** カタカナをひらがなへ変換する（長音「ー」・その他の文字はそのまま）。 */
export function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60),
  );
}
