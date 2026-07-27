# emperorstats.com SEO 総合監査レポート

- 監査日: 2026-07-27
- 対象: https://emperorstats.com/（378ページ／うちインデックス対象375）
- サイト種別: **リファレンス／データセット公開サイト（Publisher 相当）** — SaaS・EC・ローカルビジネスのいずれでもない
- **サイト公開から9日**（初回コミット 2026-07-18）

---

## SEO Health Score: **72 / 100**

| カテゴリ | 重み | スコア | 一行評価 |
|---|---:|---:|---|
| Technical SEO | 22% | **78** | 設計は堅牢。減点はセキュリティヘッダ全欠と trailing slash 404 |
| Content Quality | 23% | **58** | 検証可能性は極めて高いが、著者情報の不在と統計2ページの空洞が足を引く |
| On-Page SEO | 20% | **80** | title/description/h1/alt の欠落ゼロ。見出しマークアップと横展開漏れが残る |
| Schema / 構造化データ | 10% | **72** | Critical・High ゼロ。`@id` によるグラフ結合と Organization が未整備 |
| Performance (CWV) | 10% | **80** | ラボ計測では LCP/CLS/INP代理 すべて good 域。フォント転送量が唯一の実課題 |
| AI Search Readiness | 10% | **60** | 皇帝365ページは優秀、統計ページ側が非対称に弱い |
| Images | 5% | **88** | 全300点 webp・alt 欠落ゼロ・lazy/srcset/aspect-ratio 適用済み |

**加重合計 = 71.8 → 72**

### スコアの読み方（配分の明示）

重み表は7カテゴリだが、実施したサブエージェントは9本ある。対応は次のとおり:

- `sitemap` の所見は **Technical SEO** に合算（sitemap 単体はほぼ Pass のため減点はほとんど発生していない）
- `sxo`（検索体験）と `backlinks`（被リンク）は **スコア対象外**。前者は診断の文脈、後者はデータ取得不可のため（下記）
- **Images** を担当したサブエージェントは存在しない。オンページ実測（alt 欠落0／`loading="lazy"` 143件／webp 300件／`srcset`・`aspect-ratio` 適用）と performance.md の画像節から採点した
- `visual`（視覚・モバイル）は **High・Medium ともにゼロ**（Info 2件・Low 1件）だったため、いずれのカテゴリのスコアも動かしていない

---

## この監査で「測れなかったもの」（先に明示）

正直に区別しておく。以下は推測で埋めていない。

| 項目 | 状態 | 理由 |
|---|---|---|
| CrUX フィールドデータ（実ユーザーの CWV 75パーセンタイル） | **取得不可** | Google API 認証情報が未設定 |
| PageSpeed Insights API | **取得不可** | キーなし呼び出しの日次クォータが現在 **0**（HTTP 429・`quota_limit_value: 0`）。「低頻度ならキーなしで呼べる」は現在の PSI v5 には当てはまらない |
| 実際の検索順位・表示回数・CTR | **取得不可** | Search Console 連携は **ユーザー決定で対応しない方針**（2026-07-24）。本レポートは GSC を前提とする指標を推奨に使っていない |
| 被リンクの定量評価 | **算出不可** | Moz/Bing キー未設定。Common Crawl は公開9日のため計測期間外で未収載。実地確認できた外部リンクは GitHub README の1件（nofollow）のみ |
| Google のインデックス収録状況 | **未確定** | 手元の Web 検索（Google ではない・US ロケール）では `emperorstats.com` は1件もヒットしない。ただしこれは Google の収録状況の証拠にならない。**公開9日の新規ドメインとして未収録でも異常ではない**。判定するならブラウザで `site:emperorstats.com` を実行するのが唯一の確実な方法 |

---

## エグゼクティブサマリー

**このサイトのオンページ品質は、378ページ規模のサイトとして例外的に高い。** 通常の監査で最初に挙がる指摘（title/description/canonical/h1/alt の欠落、リンク切れ、孤立ページ、JSON-LD のパースエラー、JS 依存で本文が読めない）は**すべてゼロ**である。Critical 判定の指摘は1件もない。

したがって本監査の価値は「壊れている箇所の発見」ではなく、**「すでに正しく作られたパターンが、なぜか一部のページにだけ適用されていない」という横展開漏れの特定**にある。検出した High 級の指摘は、ほぼすべてこの形をしている。

### 最重要の指摘 5件

1. **統計ページの「読み取れること」実装が16セクション中7セクションのみ（44%）** — `/death-accession` と `/dynasties` には静的な数値が一切なく、本文はそれぞれ314字・483字。死因8分類のうち7分類の実数がテキストとして存在しない（円グラフ SVG の中だけ）。**同じ数値がトップページ `/` には全カテゴリ分テキストで載っている**という逆転が起きている。→ [geo.md](findings/geo.md) §3.4-3.5 / [on-page.md](findings/on-page.md) H-1 / [content.md](findings/content.md) #4
2. **静的上位10名リストの共通部品はすでに存在する** — `site/src/components/tables/top-ranked-table.tsx` を import しているのは `reign`・`ages`・`military`・`court-events` の4ページのみ。`death-accession` と `dynasties` は未適用。**新規実装ではなく既存部品の適用**で済む。
3. **皇帝個別365ページ本文から統計6ページへの文脈内リンクが0件** — 個別ページには順位（「365人中◯位」）が大量に表示されているのに、対応するランキングページへ本文から一切リンクしていない。365ページ分のリンク資産が統計ページに流れていない。→ [content.md](findings/content.md) #8
4. **フォントが最大のページ重量要因** — `/emperors` は Noto Sans/Serif JP のサブセット **150ファイル・5.9MB**（総転送量の75%）。CJK の `unicode-range` 分割が、365人分の人名・諡号・異体字の字種の多さで爆発している。ラボ計測の LCP/CLS は good 域だが、低速回線とデータ通信量には直撃する。→ [performance.md](findings/performance.md) §4
5. **trailing slash 付き URL が全ページ404** — `/reign/`・`/emperors/`・`/about/` はいずれも404（`/reign` は200）。GitHub Pages の拡張子省略解決の仕様による。外部から `/` 付きでリンクされた場合に取りこぼす。→ [technical.md](findings/technical.md)

### すぐ効く小さな改善 5件（Quick Wins）

1. `/emperors` の meta description が22字（他ページは60〜76字）。ハブページなのにここだけ手薄 → [on-page.md](findings/on-page.md) M-3
2. GitHub リポジトリの `homepage` フィールドが未設定。設定するだけで恒常的な外部リンクが1本増える → [backlinks.md](findings/backlinks.md) §5-1
3. 全378ページに**テキストが空の `<h3>` が7個ずつ**出力されている（サイドバーの Radix Accordion トリガー）→ [on-page.md](findings/on-page.md) H-2
4. `/timeline` にだけ WebPage の JSON-LD が無い（他5統計ページにはある）→ [schema.md](findings/schema.md) §1-6
5. 404ページで `<meta name="robots">` が2つ重複出力されている → [technical.md](findings/technical.md)

---

## カテゴリ別の要点

### Technical SEO — 78/100

Pass: クロール性・インデックス性・モバイル・構造化データ・JS レンダリング。canonical の自己参照は376ページすべて正しく、sitemap 375件と `site/out/` 378 HTML の差分は仕様どおり（404系2件＋意図的 noindex の `/kinship`）で、**未収載0件・noindex混入0件・実体なしURL 0件**。ランキング上位10名も皇帝一覧365件もサーバー側 HTML にリンクとして存在し、JavaScript なしでクロールできる。

Fail: セキュリティヘッダ（HSTS・X-Content-Type-Options・Referrer-Policy・CSP・Permissions-Policy）が全欠。GitHub Pages はカスタムヘッダ非対応だが、**本サイトはすでに Cloudflare を通っている**ため Transform Rules で付与できる。URL 構造は trailing slash 404 と `/index.html` の200二重配信。`www.emperorstats.com` は DNS 未解決（NXDOMAIN）。

なお sitemap の `lastmod` は、皇帝個別365ページには**そもそも出力されていない**（`site/src/app/sitemap.ts` が意図的に省略）。固定値なのはトップ＋統計8＋about の10件のみで、当初の想定より軽微。

### Content Quality — 58/100

E-E-A-T 加重 47/100。内訳は Trustworthiness 65 / Experience 55 / Expertise 40 / **Authoritativeness 25**。

Trustworthiness が高いのは、365人全件の正史原文引用・暦換算の調査記録・正誤表・CHANGELOG・CC BY 4.0・生データ配布・GitHub Issue 窓口が揃っているため。**この検証可能性はこのサイト最大の資産であり、維持すべき**。

Authoritativeness が低いのは、著者・運営者の実在性を示す情報が本文にも構造化データにも一切ないため（Dataset の `creator` はサイト自身を指す自己言及で `sameAs` なし）。`/about` の「制作者は歴史学の専門家ではありません」という開示は、透明性としては正しいが Expertise シグナルを直接押し下げるトレードオフになっている。

皇帝個別365ページの本文は中央値5350字（最小2540字・最大20113字）、定型文比率は平均6.9%。**文字数で薄いと判定すべきではない**水準にある。

### On-Page SEO — 80/100

詳細は [on-page.md](findings/on-page.md)。基礎衛生は満点に近い。減点は (a) 統計2ページの本文空洞、(b) 全ページの空 `<h3>` ×7、(c) 皇帝365ページの h1→h3 レベル飛び（h2 が存在しない）、(d) `/emperors` の description、(e) OG 画像の Content-Type が `application/octet-stream`（375件すべて。`og:image:type` の宣言 `image/png` と食い違う）。

(e) は**まず実害の確認から**。X の Card Validator／Slack・Discord へのURL貼り付けでカードが正常表示されるなら対応不要。`docs/site-design/` の OGP 記録は画像の見た目の検証のみで、Content-Type の検証は行われていない。

### Schema / 構造化データ — 72/100

Critical・High ともにゼロ。BreadcrumbList 373・Person 365・WebPage 6・Dataset 1・CollectionPage 1・WebSite 1、パースエラーなし。

改善余地は Medium 5件: Dataset の `creator` が孤立（`sameAs` なし）・`keywords` 欠落、ランキングページへの `ItemList` 未実装、Organization ノード不在、`@id` によるエンティティ結合が未実施（各 JSON-LD がバラバラのグラフになっている）、Person の `name` 重複（「太祖」「世宗」等が複数王朝に存在）への曖昧性緩和。`/timeline` のみ WebPage が欠落。

FAQPage・HowTo は不使用で、新規追加も推奨しない（Google は 2026-05-07 に FAQ リッチリザルトを全廃）。永続識別子は Zenodo DOI が見送り済みのため、GitHub リポジトリ URL を `identifier`/`sameAs` に使う案で代替。

### Performance (CWV) — 80/100

ラボ計測（本番同等ビルドをローカル配信、Lighthouse 13.4.0、WSL2）で4ページとも Performance 99〜100、**LCP 703〜864ms・CLS ≒0・Long Task 最大106ms**。本番 TTFB は curl 実測で全ページ 47〜65ms（Cloudflare + Fastly）。既存の改善（`/emperors` 先頭カードの priority 画像、`transform` ベースのツールチップ、LazyMount）は本番に反映されたまま維持されており、**退行は検出されなかった**。

唯一の実課題がフォント転送量（上記・最重要5件の4番）。`/timeline` 839KB・`/court-events` 717KB という HTML の重さは、82〜86% が Next.js の RSC フライトペイロード（365人分のデータを hydration 用にシリアライズしてインライン化したもの）で、マークアップの重さではない。

**フィールドデータが無いため、実ユーザーの75パーセンタイルでの合否は判定できない。**

### AI Search Readiness (GEO) — 60/100

内訳: Citability 62 / Structural Readability 58 / **Multi-Modal 50** / Authority & Brand 50 / Technical Accessibility 75。

全 AI クローラ UA へ200応答し、robots.txt はブロックしていない。`/llms.txt` は不在。**Multi-Modal が低いのは、円グラフ・棒グラフがすべてクライアント描画で、素の HTML に `<svg><text>` が1件も無いため** — JS を実行しない AI クローラにはグラフの数値がまったく見えない。皇帝個別365ページは一次史料引用付きで「AI が引用したくなる」水準に達している一方、集計を担う統計ページ側が非対称に弱い。

### Images — 88/100

`<img>` の alt 欠落 **0件**（`alt=""` の装飾用途60件は正しい実装）。肖像画は**全300ファイル webp**、`loading="lazy"` 143件、LCP 要素は `fetchpriority="high"` + `srcset`/`sizes` 指定済み。`width`/`height` 属性は多くの `<img>` に無いが、**CSS の `aspect-ratio` で吸収されており実測 CLS はほぼ0** — この点は指摘として成立しない（当初の懸念は却下）。

### 視覚・モバイル — 減点なし（Info 2 / Low 1）

デスクトップ1440×900・モバイル390×844で5ページを撮影（12枚・`screenshots/`）。**5ページすべてでモバイル幅の意図しない横スクロールなし**（`scrollWidth` と `innerWidth` が390で一致）。`/timeline` の横スクロールはチャート内に限定された意図的な設計（「横スクロールで続き→」のアフォーダンスあり）として機能している。base font 16px、キャプション文字のコントラスト比 約5.5:1（WCAG AA 4.5:1 を満たす）、ハンバーガーメニューのタップターゲットは約48×48CSSpx相当。レイアウト崩れ・要素の重なり・テキスト切れは1件も検出されず。

未検証として残るのは `/timeline` モバイル版のチャート内ラベルの実測フォントサイズのみ。

### 検索体験（SXO）— スコア対象外

ページタイプの適合自体は概ね妥当。`/reign` は「読み取れること」＋上位10名の静的リストを持ち、「在位期間 最長」系クエリに対する型と深さは SERP 上位と整合している。**改善の主眼はページ改修ではなく可視性（インデックス・被リンク）の確保**にある。

「皇帝 暗殺 割合」は上位10件が完全に無関係（映画作品等）というキーワード空白地帯で、`/death-accession` の死因データを文章化すれば占有できる可能性が高い — これは最重要指摘1と同じ修正で解決する。

### 被リンク — スコア対象外（データ不足）

公開9日のため Common Crawl のウェブグラフに未収載。実地確認できた外部リンクは GitHub README の1件（nofollow）のみ。**数値化すると誤った印象を与えるため、スコアは提示しない。** 実行可能な獲得経路は [backlinks.md](findings/backlinks.md) §5 に優先度順で記載（GitHub の `homepage` 設定・awesome list への PR・Kaggle Datasets・Wikidata の出典追加・Wikipedia はノートページ経由での提案・Show HN・Reddit）。Zenodo DOI は見送り済みの決定として提案から除外している。

---

## 良好な点（維持すべきもの）

監査の主眼は改善点だが、この規模で以下が揃っているのは稀なので明記する。

- title・description・canonical・h1・alt の欠落が **378ページすべてでゼロ**、内部リンク切れゼロ、孤立ページゼロ
- 皇帝365ページが `/emperors` から静的 `<a>` 375本で全件到達可能。JavaScript なしでクロールできる
- OG/Twitter Card がページ単位で動的生成（375件・`og:image:alt` まで指定）
- 365人全員に Wikidata QID を付与済み
- 一次史料の原文引用を全件に持ち、暦換算・正誤表・CHANGELOG・CC BY 4.0 のデータ配布まで揃った検証可能性
- `/kinship` の段階公開に伴う noindex と robots.txt の `Disallow: /kinship-source` が意図どおり機能し、sitemap にも混入していない
- 既存の性能対策が本番で維持されており退行がない

---

## 参照

| ファイル | 内容 |
|---|---|
| [ACTION-PLAN.md](ACTION-PLAN.md) | 優先度・依存関係つきの実行計画 |
| [CONTEXT.md](CONTEXT.md) | 各サブエージェントに与えた共通前提 |
| [findings/technical.md](findings/technical.md) | 技術的SEO 9カテゴリ |
| [findings/content.md](findings/content.md) | E-E-A-T・薄いコンテンツ・内部リンク |
| [findings/on-page.md](findings/on-page.md) | オンページ（本レポート作成者による実測） |
| [findings/schema.md](findings/schema.md) | 構造化データ（実データ入りの JSON-LD 例つき） |
| [findings/sitemap.md](findings/sitemap.md) | sitemap 突合・lastmod |
| [findings/performance.md](findings/performance.md) | Lighthouse・フォント・RSC ペイロード |
| [findings/geo.md](findings/geo.md) | AI 引用適性（パッセージ単位） |
| [findings/sxo.md](findings/sxo.md) | SERP 逆算・ペルソナ採点 |
| [findings/backlinks.md](findings/backlinks.md) | 被リンクとリンク獲得経路 |
| [findings/visual.md](findings/visual.md) | 視覚・モバイル（スクリーンショット目視） |
| `screenshots/` | デスクトップ・モバイル各5ページ（計12枚） |
