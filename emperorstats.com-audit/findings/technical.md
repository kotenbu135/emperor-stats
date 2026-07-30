# 技術的SEO監査 — emperorstats.com

対象: https://emperorstats.com/ （HTTP/2, Cloudflare + Fastly + GitHub Pages, `<html lang="ja">`）
検証方法: ローカル `site/out/`（378 HTMLファイル、本番と同一）の機械的検査 + 本番へのライブ確認（robots.txt / sitemap.xml / レスポンスヘッダ / リダイレクト挙動）。`claude-seo run sitemap_discovery.py` / `render_page.py` を使用。

## サマリー

| カテゴリ | 判定 |
|---|---|
| 1. クロール性 | Pass（sitemapとout/の差分は仕様通り。robots.txt妥当） |
| 2. インデックス性 | Pass（canonical自己参照は376ページ全て正しい）／trailing slash挙動はURL構造の指摘へ |
| 3. セキュリティ | Fail（主要セキュリティヘッダが全て不在） |
| 4. URL構造・リダイレクト | Fail（trailing slash全滅・/index.html非リダイレクト） |
| 5. モバイル | Pass（viewport全378ページに存在、画像はaspect-ratioでCLS対策済み） |
| 6. Core Web Vitals（ソース推測） | Pass相当（LazyMount・自前srcset・font preload・aspect-ratioなど積極対策済み） |
| 7. 構造化データ | Pass（既知情報の通り、パースエラーなし） |
| 8. JavaScriptレンダリング | Pass（ランキング上位10名・皇帝一覧365件ともサーバー側HTMLにリンクあり） |
| 9. IndexNow | 未導入（Low、費用対効果は限定的） |

**技術スコア: 78/100**（セキュリティヘッダ全滅とtrailing slash 404が主な減点要因。それ以外は設計が意図的かつ堅牢）

---

## 指摘一覧（重大度順）

### [High] trailing slash付きURLが全滅（`/emperors/` `/reign/` `/about/` 等 → 404）

- **証拠**:
  - `curl -o /dev/null -w '%{http_code}' https://emperorstats.com/emperors` → `200`
  - `curl -o /dev/null -w '%{http_code}' https://emperorstats.com/emperors/` → `404`
  - 同様に `/reign/` → 404、`/about/` → 404、`/emperors/qin-shi-huang/` → 404（末尾スラッシュを付けたページは例外なく404）
  - 原因: `site/out/` はNext.js静的書き出しで `emperors.html` 単体ファイルとして出力され（`emperors/` ディレクトリは存在するが中身は `__next.*.txt`（RSCプリフェッチ用データ）と個別皇帝の `id.html`/`id/` のみで `index.html` が無い）、GitHub Pagesの拡張子省略解決（`/emperors` → `emperors.html`）は効くが、末尾スラッシュ付きは `emperors/index.html` を探しに行き見つからず404になる。
- **影響**: 外部サイトからの被リンク、ソーシャル共有、SEOツール、ユーザーの手入力URLは慣習的に末尾スラッシュを付けることが多く、376ページ全ての「スラッシュ付きバリアント」がクロールエラー・リンク切れになる。Search Consoleのカバレッジで「見つかりませんでした(404)」が大量検出される典型パターン。
- **修正案**: GitHub Pagesは直接のURL書き換えができないため、フロントにいるCloudflareでRedirect Rules（末尾に`/`が付き、かつそのパスに対応する静的ファイルが存在する場合は301で除去）を設定する。Cloudflare無料プランのRedirect Rulesで実現可能（正規表現1本: `http.request.uri.path matches "^/.+/$"` → 末尾スラッシュを取り除いた同一パスへ301)。ただし `/`（ルート）自体は除外すること。
- **失敗判定**: Cloudflareで既にこの正規化ルールが設定済みで、上記curl結果が実際の挙動と異なる（別セッション・別リージョンのエッジで200が返る）場合はこの指摘は誤り。
- **先行指標**: `curl -o /dev/null -w '%{http_code}' https://emperorstats.com/emperors/` を再実行し200になれば解消確認。Search Consoleの「ページ」レポートで404理由に「見つかりませんでした」の急増がないかも参考になる。

### [Medium] `/index.html` が301されず200で二重配信（正規URLとの重複）

- **証拠**: `curl -o /dev/null -w '%{http_code}' https://emperorstats.com/index.html` → `200`（`/` と同一内容）。canonicalタグ自体は `index.html` 内も `https://emperorstats.com`（`/`相当）を指しており正しいため、Googleのインデックス上の実害は限定的だが、3xxで正規化されていないため他クローラ・ソーシャルカード生成ツール・被リンク元では別URL扱いされ得る。
- **修正案**: Cloudflare Redirect Rulesで `/index.html` → `/` の301を追加（trailing slashルールと合わせて1ルールセットにまとめられる）。
- **失敗判定**: `/index.html` へのリクエストが実際には検索結果や被リンクで観測されていない、かつcanonicalで完全に無害化されていると判断できるならMedium→Lowへ引き下げてよい。
- **先行指標**: 同curlコマンドで301になれば解消。Search Consoleの重複URL（正規化されたURL）レポートで `/index.html` の出現有無も確認材料。

### [Medium] セキュリティヘッダが全滅（HSTS・X-Content-Type-Options・Referrer-Policy・CSP・Permissions-Policy）

- **証拠**: `curl -sI https://emperorstats.com/` と `https://emperorstats.com/emperors/qin-shi-huang` の両方でレスポンスヘッダに `strict-transport-security`・`x-content-type-options`・`x-frame-options`・`referrer-policy`・`content-security-policy`・`permissions-policy` のいずれも存在しない（CONTEXT.mdの既知事実と一致、複数ページで再確認済み）。
- **現実的な制約**: GitHub Pagesはカスタムレスポンスヘッダに対応していない（`_headers`ファイル等の仕組みはNetlify/Cloudflare Pages固有でGH Pagesでは機能しない）。ただし本サイトは既にCloudflareでプロキシされている（`server: cloudflare`・`cf-ray`ヘッダの存在で確認）ため、GH Pagesの制約を回避してCloudflare側でヘッダ付与が可能。
- **修正案**: Cloudflare の Transform Rules（Modify Response Header、無料プランで利用可）または Cloudflare Workers で以下を付与する。
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`（http→https 301は既に確認済みのためHSTS導入の前提は満たしている）
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: geolocation=(), microphone=(), camera=()`（機能を使わないページなので広めに閉じてよい）
  - CSPは静的サイトでインラインscriptがNext.jsのチャンク読み込み用に最小限（`index.html`内`<script>`は1個のみ、外部originはなし）のため、`script-src 'self'` を軸にした比較的シンプルなポリシーから段階導入可能。ただし本番投入前にレポート専用モード（`Content-Security-Policy-Report-Only`）で全ページ疎通確認すること。
- **失敗判定**: Cloudflareの設定がFree以外のプラン制限で使えない、またはドメインがCloudflareでproxied（オレンジ雲）ではなくDNSのみ（グレー雲）である場合はこの手段が使えない。ヘッダ追加のヘッダ自体がCDN経由で剥がされている可能性も要確認。
- **先行指標**: `curl -sI` の応答に上記ヘッダが出現すること。securityheaders.com等の外部スキャンでのグレード変化。

### [Low] 404/`_not-found`ページで `<meta name="robots">` が重複出力（`noindex` と `noindex, follow` の2つ）

- **証拠**: `site/out/404.html` と `site/out/_not-found.html`（本番も同一、`curl`で確認済み）に
  ```html
  <meta name="robots" content="noindex"/>
  ...
  <meta name="robots" content="noindex, follow"/>
  ```
  の2つのrobotsメタタグが存在。`site/src/app/layout.tsx:23` のデフォルト `robots: { index: true, follow: true }` に対し `site/src/app/not-found.tsx:8` が `robots: { index: false, follow: true }` で上書きしているが、Next.jsの静的書き出し特有の404生成経路でフレームワーク側が別途 `noindex` のみのメタも注入しており、結果的に2つのrobotsメタが併存する。
- **影響**: 両方とも方向性は「noindex」で一致しているため実害（インデックスされてしまう等）はない。HTMLの妥当性・保守性の観点での軽微な指摘。
- **修正案**: 実害がないため優先度は低いが、直すなら`not-found.tsx`側の設定を見直すか、Next.jsのバージョンアップで解消されるか確認。
- **失敗判定**: 2つのrobotsメタのうち後者（`noindex, follow`）が実際にはクローラに無視され前者（`noindex`のみ、followの記載なし＝Googleはfollowをデフォルト許可と解釈）だけが有効だとしても、結論（noindexである）は変わらないため実害面での結論は揺らがない。
- **先行指標**: 該当ページのHTML中の`<meta name="robots">`出現数が1つになること。

### [Low] sitemap.xmlの`lastmod`がデータセット生成日（2026-07-22）固定で、同日以降のテンプレート変更（2026-07-27のtitle/description改稿等）を反映していない

- **証拠**: `site/src/app/sitemap.ts` はトップ・8統計ページ・`/about`に `lastModified: new Date(datasetGeneratedAt)` を設定し、`datasetGeneratedAt = data.meta.generatedAt`（`data/emperors.json`の値、`"2026-07-22"`）を使用。一方 `git log` によれば `/reign` 等6統計ページのtitle・descriptionは2026-07-27のコミット `1511913`（"SEO: 統計6ページのtitle・descriptionを具体化し、一覧に構造化データを足す"）で変更されている。ビルド済み`site/out/sitemap.xml`（`stat`で2026-07-27 15:49生成を確認）でも該当ページの`lastmod`は`2026-07-22T00:00:00.000Z`のまま。
  - なお、365件の個別皇帝ページに`lastmod`が意図的に付与されていない設計（`sitemap.ts`のコメントに理由明記: 「データセットには人物単位の更新日時が無く、一律付けると1件の訂正で365ページ全部が更新済みと主張することになる」）は合理的であり、これ自体は問題ではない。
- **影響**: 軽微。Googleは`lastmod`の信頼性が低いと判断すると無視する傾向があるため実害は限定的だが、テンプレート・コピー変更が実際にあった日付を反映できていない点はsitemapの情報としては不正確。
- **修正案**: 主要9ページ（トップ・8統計ページ・about）の`lastModified`を「データセット生成日」と「ビルド時刻（テンプレート変更を含む）」の新しい方（`Math.max`）にする。あるいはビルド時刻そのものを使う設計に変更する（コメントの懸念は365件の個別ページ側にのみ当てはまり、9ページ側には当てはまらない）。
- **失敗判定**: Googleがこの種の`lastmod`を全く参照せず優先度計算にも影響しないと確定できるならCVITICAL性はさらに下がる（現状Low据え置きは妥当）。
- **先行指標**: 次回ビルド後の`sitemap.xml`で該当9ページの`lastmod`が実際の変更日以降になっていること。

### [Low] `www.emperorstats.com` がDNS未解決（NXDOMAIN、リダイレクトすら発生しない）

- **証拠**: `curl -v https://www.emperorstats.com/` → `Could not resolve host: www.emperorstats.com`。apex（`emperorstats.com`）は正常にAレコード解決（`104.21.86.2` / `172.67.213.78`、Cloudflare Anycast）。
- **影響**: サイト内リンク・sitemap・canonicalは全て apex 統一なので実運用上の実害はほぼ無い。ただし将来的に`www.emperorstats.com`宛の被リンクやブックマーク、名刺・印刷物等での誤記が発生した場合、リダイレクトではなく即座に接続不可（DNSエラー）になる点は、301で拾える設計に比べ機会損失が大きい。
- **修正案**: 優先度は低いが、余力があればCloudflareで`www`のCNAME/Aレコードを追加し、apexへの301リダイレクトを設定する（防御的措置）。
- **失敗判定**: `www`サブドメインを一切広報・使用する予定がなく、外部からの参照実績もないと確認できるなら対応不要でよい。
- **先行指標**: `curl -v https://www.emperorstats.com/`が301でapexへ転送されること。

### [Info] IndexNow（Bing/Yandex/Naver）未導入

- **証拠**: `/indexnow.txt` → 404、`/.well-known/indexnow` → 404。`BingSiteAuth.xml`（Bing Webmaster Tools所有権確認ファイル、IndexNowキーとは別物）は200で存在するが、IndexNow用キーファイルは無い。
- **評価**: 本サイトは365人の皇帝データという静的でほぼ更新頻度の低いデータセットが中心（更新は個別の訂正やテンプレート改善が中心で、ニュースサイトのような高頻度更新ではない）。IndexNowの主な価値は更新をリアルタイムでBing/Yandexに通知し再クロールを早めることだが、本サイトの更新頻度・規模ではSEO効果は限定的。導入コスト自体は低い（キーファイル1つ配置＋更新時にAPIへPingするビルドスクトップまたは手動実行）。
- **推奨**: 優先度Low。導入するなら、キーファイルを`public/`直下に追加し、`meta.generatedAt`が更新された（＝データ訂正があった）タイミングでビルド後に手動またはCI経由で `https://api.indexnow.org/indexnow` へ変更URLをPOSTする運用を検討。必須ではない。
- **失敗判定**: 既にBing Webmaster Tools経由で十分な再クロール頻度が確保できているなら追加の効果はほぼゼロ。
- **先行指標**: 導入後、Bing Webmaster ToolsのIndexNowダッシュボードで送信URL数・処理状況が確認できること。

---

## 検証済みで「問題なし」と判定した項目（証拠つき）

- **sitemap.xml (375件) と `site/out/` (378件) の差分は仕様通り**: 差分3件は `404.html`・`_not-found.html`・`kinship.html`。全てrobotsメタが`noindex`（404系は仕様、`/kinship`はCONTEXT.mdの通り「段階公開中で意図的にnoindex」）。sitemapに漏れは無く、逆にsitemapにあってファイルが存在しないURLも無い（Pythonスクリプトで378ファイル⇔375 URLを全数突合）。
- **robots.txt妥当性**: `claude-seo run sitemap_discovery.py https://emperorstats.com --json` で robots.txt宣言のsitemap.xmlが`valid: true`（urlset形式、200）。`sitemap_index.xml`・`sitemap-index.xml`・`wp-sitemap.xml`等の一般的フォールバックパスは全て404で他に隠れたsitemapは無い。
- **canonicalの自己参照**: `site/out/**/*.html` 378ファイルを全数チェックした結果、404/`_not-found`を除く376ページ全てでcanonical URLとファイルパスの対応が一致。唯一「不一致」に見えたのは`index.html`のcanonicalが`https://emperorstats.com`（末尾スラッシュ無し）だった点だが、これはURI仕様上オリジン単独表記＝`/`と同一であり、他の全ページのcanonicalパターン（`SITE_URL + パス`、末尾スラッシュ無し）とも整合しているため実際は不一致ではない。
- **リダイレクト（http→https）**: `curl http://emperorstats.com/` → `301 → https://emperorstats.com/`。正常。
- **404ステータスコード**: 存在しないパス（`/this-page-does-not-exist-xyz`）・末尾スラッシュ付きパスとも実際に`404`ステータスで応答（見せかけの200＝ソフト404ではない）。GitHub Pagesのカスタム404が正しく機能している。
- **JavaScriptレンダリング**: `claude-seo run render_page.py https://emperorstats.com/reign --mode auto --json` で `is_spa: false`（SPAシェル検出なし、生HTMLに実コンテンツあり）。`site/out/emperors.html`には365人分の`/emperors/{id}`リンクが全て静的HTML内に存在（`grep`で365件のユニークhref確認）。ランキング系ページ（`reign.html`等）は`site/src/components/tables/top-ranked-table.tsx`（Server Component、"use client"なし）が上位10名を`<Link>`付きで静的出力し、JS無効環境・クローラでも内部リンクを辿れる設計（コンポーネント内コメントにも設計意図明記）。重量級のNivoチャート部分のみ`LazyMount`（`site/src/components/lazy-mount.tsx`）でIntersectionObserverによる遅延マウントだが、SEO上重要なリンク・本文はLazyMount外。
- **モバイル・CLS対策**: 全378ページに`<meta name="viewport" content="width=device-width, initial-scale=1"/>`あり（欠落0件）。肖像画`<img>`にネイティブ`width`/`height`属性は無いが、親要素が`aspect-[3/4]`（Tailwind CSSのaspect-ratio）でスペースを事前確保する設計（`emperor-grid.tsx:75`）のため、CLSへの実害は無いと判断（width/height属性方式とCSS aspect-ratio方式は同等のCLS対策として認められている）。
- **フォント**: Google Fonts CDN（`fonts.googleapis.com`/`fonts.gstatic.com`）への外部リクエストなし。セルフホスト＋`rel="preload"`使用。サードパーティフォント読み込みによるレンダリングブロック・LCP遅延のリスクは低い。
- **構造化データ**: CONTEXT.mdの既知情報（BreadcrumbList 373 / Person 365 / WebPage 6 / Dataset 1 / CollectionPage 1 / WebSite 1、JSONパースエラーなし）を前提とし、追加のパースエラーは検出せず。

---

## 補足: 未検証・取得不可の項目

- 実測のCore Web Vitals（フィールドデータ）はCrUX API等の認証情報未設定のため取得不可（CONTEXT.mdの既知事項通り）。本レポートのCWV評価はソースコード上の対策（LazyMount・aspect-ratio・フォントセルフホスト等）からの推測にとどまる。
- Cloudflareのプラン種別・既存のTransform Rules設定有無は外部から確認不可のため、セキュリティヘッダ導入の実現可能性は「一般的にCloudflareで可能」という前提での提案。
