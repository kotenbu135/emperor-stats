# 監査対象コンテキスト（全サブエージェント共通）

## サイト
- 本番 URL: https://emperorstats.com/ （HTTP/2, Cloudflare + Fastly + GitHub Pages）
- 言語: **日本語のみ**（`<html lang="ja">`、hreflang なし・多言語展開なし）
- 種別: 学術寄りのリファレンス／データセット公開サイト（Publisher 相当）。EC・ローカルビジネス・SaaS ではない。
- 内容: 中国史の皇帝365人の在位年数・死因・即位経路など全12項目を正史から調査したデータセットの可視化。

## ローカル資産（クロールより優先して使うこと）
- ビルド済み静的 HTML: `/home/sakis/emperor-stats/site/out/` （**378 HTML ファイル = 本番と同一**）
- ソース: `/home/sakis/emperor-stats/site/src/`（Next.js App Router / 静的書き出し）
- サイト設計ドキュメント: `/home/sakis/emperor-stats/docs/site-design/`（LAYOUT.md が方針・規範。PERFORMANCE.md に性能の既知事情）
- サイト実装メモ: `/home/sakis/emperor-stats/site/AGENTS.md`
- データ本体: `/home/sakis/emperor-stats/data/emperors.json`（約7MB・**全体を Read しないこと**。必要なら jq/python で部分抽出）

**本番サイトを大量クロールする必要はない**。`site/out/` がそのまま配信物なので、静的解析はローカルで行うこと。ライブ確認は robots.txt・sitemap.xml・レスポンスヘッダ・実測性能など「本番でしか取れないもの」に限定する。

## ページ構成（378 HTML）
- トップ `/`
- 統計ページ 8: `/reign` `/death-accession` `/court-events` `/military` `/ages` `/dynasties` `/timeline` `/emperors`
- 皇帝個別ページ 365: `/emperors/[id]`
- `/about`（このサイトについて・免責事項）
- `/kinship`（系譜・家系図。**段階公開中で意図的に `noindex`**。robots.txt で `/kinship-source` を Disallow）
- `404.html` / `_not-found.html`（noindex・canonical なしは仕様どおり）

## すでに判明している事実（再調査不要・重複させない）
- title: 全378ページに存在、60文字超ゼロ。
- meta description: 全378ページに存在、160文字超ゼロ。
- canonical: 404/_not-found を除く376ページに存在。
- h1: 全ページちょうど1個。
- `<img>` の alt 欠落: **0件**（`alt=""` の装飾画像が計60件）。
- 構造化データ: BreadcrumbList 373 / Person 365 / WebPage 6 / Dataset 1（/about）/ CollectionPage 1（/emperors）/ WebSite 1（/）。JSON パースエラーなし。
- robots meta: `index, follow` 375 / `noindex` 3（404・_not-found・kinship）。
- robots.txt: `Allow: /`＋`Disallow: /kinship-source`、Sitemap 宣言あり。
- sitemap.xml: 375 URL。
- `/llms.txt` は **404**（存在しない）。
- レスポンスヘッダに `strict-transport-security` / `x-content-type-options` / `content-security-policy` が**無い**。
- Google API 認証情報は未設定（GSC・CrUX・GA4・PageSpeed のフィールドデータは取得不可）。Moz / Bing API キーも未設定。

## 重要な制約（必ず守る）
1. **これは監査＝報告のみ。ソースコード・データを一切変更しないこと。** `site/src/`・`data/`・`docs/` への書き込み禁止。
2. 書き込んでよいのは指定された `/home/sakis/emperor-stats/emperorstats.com-audit/` 配下のみ。
3. **日本語サイトである**。title/description の文字数評価に英語圏のバイト・文字数基準をそのまま当てない（日本語では全角のため、title 全角30文字前後・description 全角80〜120文字前後が実用上の目安）。「短すぎる」と機械的に指摘しない。
4. FAQPage スキーマは新規推奨しない（2026-05-07 に Google がリッチリザルトを全廃）。HowTo も推奨しない。Core Web Vitals は INP を使い FID は使わない。
5. 根拠のない推測を書かない。指摘には必ず「どのファイル／どのURL／どの値」を証拠として添える。データが取れなかった項目は「取得不可」と明記する。

## 出力
所定の findings ファイルに Markdown で書く。各指摘は次を含めること:
- 重大度（Critical / High / Medium / Low / Info）
- 証拠（ファイルパス:行 または URL と実測値）
- 具体的な修正案
- **失敗判定**: 「この指摘が誤りだったとどう分かるか」
- **先行指標**: 監査を再実行せずに効果を観測する方法
