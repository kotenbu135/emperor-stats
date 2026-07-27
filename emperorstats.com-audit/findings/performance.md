# emperorstats.com パフォーマンス監査（Core Web Vitals）

計測日: 2026-07-27。対象4ページ: `/`（トップ）、`/timeline`、`/emperors`、`/emperors/qin-shi-huang`。

## 0. 前提・既知情報（再掲しない）

- 本監査は既存の性能改善履歴（`docs/site-design/PERFORMANCE.md`）を読了した上で実施。LazyMount・行ウィンドウイング・`useTipOutlet`分離・`transform`配置は実装済みであり、本レポートでは「未対応」として再指摘しない。
- **WSL2 環境の Lighthouse 実測値は絶対値として信用しないこと**。同ドキュメントに記録の通り、同一タスクが実機比で最大18倍に膨らむ増幅が確認されている。本レポートの数値は相対比較・診断用と位置づけ、実ユーザー体感は同ドキュメントのLong Task実測（PerformanceObserver）を優先する。
- チャート系5ページ（`/reign` `/ages` `/dynasties` `/military` `/court-events`）のTBT・CLS対策は既に実施・計測済み（同ドキュメント）のため本レポートでは再計測しない。今回の対象4ページはいずれもNivoチャートを持たないページ。

## 1. PageSpeed Insights API / CrUX フィールドデータ ― 取得不可

キーなしで `pagespeedonline.googleapis.com` を直接叩いたところ、レート制限ではなく **匿名利用のデフォルト日次クォータが 0 に設定されている**ことを確認した。

```
$ curl "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://emperorstats.com/&strategy=mobile..."
HTTP 429
"quota_limit_value": "0", "quota_limit": "defaultPerDayPerProject", "reason": "RATE_LIMIT_EXCEEDED"
```

`claude-seo run pagespeed_check.py` 経由でも同一エラー。CrUX API も同一プロジェクト経由のため同様に取得不可。**キーなしPSIは現在は全く呼び出せない**（数年前の「低頻度なら呼べる」という前提は現状のPSI v5には当てはまらない）。CrUXフィールドデータは Google API 認証情報が未設定のため取得不可（CONTEXT.md記載どおり）。→ 本レポートは全面的にローカルLighthouse（ラボデータ）+ 本番の実測ネットワークタイミング（TTFB等）に基づく。

## 2. Lighthouse計測（本番ビルド `site/out/` を `npx serve` でルート直下配信、desktop preset、Lighthouse 13.4.0、WSL2 headless Chrome）

| ページ | perf | a11y | LCP | TBT | CLS | FCP |
|---|---|---|---|---|---|---|
| `/` | 100 | 97 | 724ms | 0ms | 0.000001 | 328ms |
| `/timeline` | 99 | 100 | 748ms | 0ms | 0.000018 | 405ms |
| `/emperors` | 99 | 96 | 864ms | 0ms | 0 | 404ms |
| `/emperors/qin-shi-huang` | 100 | 98 | 703ms | 0ms | 0 | 363ms |

4ページとも **LCP・CLS・TBTは"good"域**（WSL2増幅を割り引いてもTBT=0msは実測Long Task件数の少なさと整合）。`long-tasks`監査の該当件数は `/`=1件(60ms)・`/timeline`=1件(73ms)・`/emperors`=2件(106ms,51ms)・詳細ページ=0件で、いずれもチャート系ページ（370〜9,300ms台）と比べ桁違いに軽い。これは対象4ページがNivoチャートを持たないためで、既知の課題（Nivo初回全描画）の影響を受けない。

**注意**: 上記はローカル配信（レイテンシほぼ0）のラボ計測であり、TTFB・resourceLoadDelayは本番の実ネットワーク条件を反映しない。本番の実TTFBは §6 を参照。

### LCP要素の内訳（`lcp-breakdown-insight`）

| ページ | LCP要素 | element render delay |
|---|---|---|
| `/` | ヒーロー説明文（`<p>`テキスト） | 184ms |
| `/timeline` | ヒーロー説明文（`<p>`テキスト） | 199ms |
| `/emperors` | 先頭カード（始皇帝）の肖像画 `<img loading="eager" fetchpriority="high">` | 253ms |
| `/emperors/qin-shi-huang` | 本文冒頭の`<p>`テキスト | 126ms |

`/emperors`のLCP要素が画像である点は既知（PERFORMANCE.md記載の`priority`対応済み）で、`fetchpriority="high"` `loading="eager"`が実際に出力されていることを確認した（`grep`で先頭カードの`<img>`要素を確認、`src=".../qin-shi-huang.webp"`）。既知の対策が本番ビルドに反映されたままであることの再確認であり、新規の劣化はない。

## 3. HTML実サイズと `_next/static` バンドル

`site/out/` 実測（本番と同一の378 HTMLファイル）:

| ページ | HTML実サイズ | 内訳（インラインscript合計） | うち最大の単一ブロック |
|---|---|---|---|
| `/timeline` | 839.2 KB | 686.7 KB (82%) | 671.9 KB＝1本 |
| `/kinship` | 757.5 KB | 330.5 KB (44%) | 108.6+88.3+67.0 KB＝上位3本で263.9KB |
| `/court-events` | 717.3 KB | 614.7 KB (86%) | 559.8 KB＝1本 |
| `/emperors` | 622.3 KB | 156.1 KB (25%) | 137.1 KB＝1本 |
| `/` | 123.5 KB | — | — |
| `/emperors/qin-shi-huang` | 90.6 KB | — | — |

内訳の正体を確認: `/timeline`・`/court-events`の最大ブロックはいずれも `self.__next_f.push([1,"..."])` という **Next.js の RSC（React Server Components）フライトペイロード**で、サーバー側でレンダリング済みのReactツリーとデータ（365人分の在位年数・ランク・タイの有無等のオブジェクト）をJSON文字列としてそのままHTMLに埋め込んだもの。マークアップの重さではなく、**全365人分のデータをクライアント側hydration用にシリアライズしてインライン化していることがHTMLサイズの支配要因**（`/timeline`は82%、`/court-events`は86%がこの1ブロック）。`/kinship`も同種だが3ブロックに分散（系譜グラフのノード・エッジ・`manual-layout.json`座標データと推定）。対して`/emperors`はインラインJSONが25%のみで、残りは365枚のカードの実マークアップ（既知どおりSEO用クロール可能リンクとして必要）。

`_next/static/chunks` 合計JSは **1.86MB**（非圧縮、gzip前）。最大チャンクは既知の`0a68mj1bg-len.js`（227KB、Nivo/d3系と推定・PERFORMANCE.md既知）で全ページ共通ロード。

- **重大度**: Medium
- **証拠**: 上記実測（`site/out/timeline.html`・`court-events.html`のインラインscriptサイズ、`self.__next_f.push`パターン）
- **推奨**: `/timeline`と`/court-events`は全件データを初回HTMLに埋め込んでいるため、初回転送量が大きい（本番実測 859KB、§6のcurl結果と一致）。表示自体はLCPに影響していない（LCP要素はテキストで704〜748ms、goodのまま）ため緊急ではないが、遅い回線ではダウンロード完了までのTTIに影響しうる。改善案: 初期表示に不要な項目（例: 統計ランク情報等、スクロールで初めて必要になるデータ）を分離し、クライアント側で必要時にfetchする、または`gzip`/`br`圧縮後サイズを確認しHTTP圧縮が効いているか確認する（GitHub Pagesは自動でbr/gzip圧縮するため転送量自体は実測より小さいはずだが、圧縮後サイズの実測はしていない）。
- **失敗判定**: 圧縮後の転送サイズ（`content-encoding: br`のレスポンスヘッダ＋実転送バイト数）を計測してKB単位で無視できる小ささだと分かれば、この指摘は撤回できる。
- **先行指標**: 本番の`curl -H "Accept-Encoding: br" -w "%{size_download}"`で圧縮後サイズを都度確認できる。

## 4. フォント読み込み ― 新規発見・優先度高

Lighthouseの`network-requests`監査を4ページ全てで集計したところ、**フォント（woff2）の転送量がJS・画像を上回り、ページ重量の最大要因**になっていた。

| ページ | フォントrequest数 | フォント転送量 | 総転送量に占める割合 |
|---|---|---|---|
| `/` | 81件 | 2,123 KB | 61%（総3,473KB） |
| `/timeline` | 96件 | 3,009 KB | 71%（総4,259KB） |
| `/emperors` | **150件** | **5,955 KB** | 75%（総7,900KB） |
| `/emperors/qin-shi-huang` | 80件 | 2,068 KB | 56%（総3,663KB） |

原因特定: `site/src/app/layout.tsx`で`next/font/google`の`Noto_Sans_JP`・`Noto_Serif_JP`を使用（`grep`で確認）。CJKフォントは字形数が膨大なため、next/fontはUnicode範囲ごとに細分化された`@font-face`サブセットを大量生成する（`site/out/_next/static/chunks/*.css`に**373個の`@font-face`ルール・372個の`unicode-range`**を確認）。ブラウザは実際にページ内で使われている文字を含むサブセットだけを個別リクエストするため、**表示される固有漢字の種類が多いページほどリクエスト数が増える**。`/emperors`は365人分の人名・諡号・廟号を一覧表示するため異体字・generational文字種が非常に多く、150件・5.9MBものフォント断片を読み込む結果になっている。`<head>`での`<link rel=preload as=font>`は2件のみ（クリティカルな最初の2サブセット）で、残りは非プリロードの高優先度リクエストとして後続で発生。

- **重大度**: High（帯域の細い回線・モバイル実機で特に効く。デスクトップLighthouseではLCP/TBTへの影響が隠れて見えるが、これは§0で述べたローカル配信のため転送に実時間がかからないことが一因。実際の3G/4G回線ではこの5.9MBがLCP後もダウンロードを続け、ページ全体のロード完了・データ通信量に直結する）
- **証拠**: 上記実測表、`site/src/app/layout.tsx:2`（`import { Noto_Sans_JP, Noto_Serif_JP } from "next/font/google"`）、`site/out/_next/static/chunks/02r-1ddwap0sg.css`の`@font-face`373件
- **推奨**: (1) 本当に必要なウェイト・スタイルの数を精査し使用ウェイトを絞る（現状複数ウェイトを読み込んでいる可能性）。(2) 表示に使う代表的な字種（人名でよく使う漢字）が偏っているなら、サブセットの粒度やプリロード対象を見直す。(3) 最も効果的なのは、`/emperors`のような一覧ページで並び順・表示件数を制御し、初期表示に必要な字種だけを先に描画してrestは遅延させることでサブセットリクエストの初回集中を緩和する。(4) `font-display: swap`は既に設定済み（CSSで確認）でFOIT自体は起きないため、CLSへの直接影響は小さいと見られる。
- **失敗判定**: 実機モバイル（Slow 4G等）でHARを取り、フォント読み込みがLCP後の完了時間・データ通信量に実質影響していない（例: LCPが完了した時点で既に主要フォントが揃っている、体感の追加ロードが発生しない）と確認できれば、この指摘の優先度は下げられる。
- **先行指標**: 本番でChrome DevTools Networkタブの「Font」フィルタで転送量・リクエスト数を都度確認できる。件数がリリースのたびに増える（サブセット総数`373`が今後の漢字追加で増加する）かどうかも簡易な先行指標になる。

補足（ポジティブな点）: フォントファイルは content-hash 付きファイル名で配信され、本番のレスポンスヘッダは`cache-control: max-age=691200`（8日）を確認。HTML（`max-age=600`固定・PERFORMANCE.md既知の制約）と異なり、フォント自体は長期キャッシュされるため2回目以降の訪問には影響しない。問題は主に初回訪問時の転送量。

## 5. 画像配信（肖像画）

- 形式: `site/out/portraits/`配下は**全300ファイルがwebp**（jpg/png 0件）。既知の対策（quality 65再圧縮、PERFORMANCE.md記載）が反映された状態。
- サイズ: `portraits/`合計5.3MB（サムネイル`thumb/`込み）。
- 遅延読み込み: `/emperors`のHTML実測で `loading="lazy"` 143件・`loading="eager"` 7件・`fetchPriority="high"` 14件（`grep -o`集計）。既知の「先頭カード群をpriority化」対策が反映されている状態と整合（前回記録は先頭12枚、今回実測は7 eager + 14 high-priorityで内訳はやや異なるが、いずれも先頭数十枚のみeager/high-priority化という設計方針自体は維持されている）。
- レスポンシブ配信: LCP要素の`<img>`で`srcset`（320w/360w）・`sizes`（`(max-width: 640px) 50vw, ...`）を確認、`next/image`のレスポンシブ配信が機能している。
- `/emperors/qin-shi-huang`の`total-byte-weight`上位に`i.ytimg.com`のYouTubeサムネイル2件（163KB, 158KB）が含まれる。これは埋め込み動画（関連史料動画等）由来のサードパーティ画像で、肖像画とは別枠。LCPには寄与していないが、皇帝個別ページ365件に同様の埋め込みがあれば合計データ量として無視できない可能性がある（本監査では1件のみ確認、他ページの横展開有無は未調査）。

## 6. 本番の実ネットワークタイミング（curlによる直接計測、ラボ計測を補完）

```
/                         ttfb=52ms  total=64ms  size=126,436B
/timeline                 ttfb=50ms  total=130ms size=859,324B
/emperors                 ttfb=64ms  total=119ms size=637,201B
/emperors/qin-shi-huang   ttfb=47ms  total=56ms  size=92,751B
```

Cloudflare+Fastly経由のTTFBは全ページ50〜65msで**良好**。HTMLサイズは`site/out/`実測とほぼ一致（`/timeline`のみ本番859KBがローカル839KBよりやや大きいが、デプロイ差分の範囲内で誤差）。TTFBが問題化する兆候はない。

## 7. INP関連（Long Task）

対象4ページはNivoチャートを持たないため、既知のホバー起因Long Task問題（`useTipOutlet`対策済み）の対象外。今回のLighthouse `long-tasks`監査でも該当4ページの初期ロード時Long Taskは0〜2件・最大106ms（§2表）で、INPを悪化させる主要因は見当たらない。`/kinship`・`/court-events`のような大量データ埋め込みページで操作時（フィルタ・検索）にLong Taskが発生するかは本監査のスコープ外（対象4ページに含まれず、`/court-events`はチャート系として既存記録で計測済み）。

## 8. 総合評価とCore Web Vitals合否

| メトリクス | `/` | `/timeline` | `/emperors` | `/emperors/qin-shi-huang` |
|---|---|---|---|---|
| LCP | ○ good (724ms) | ○ good (748ms) | ○ good (864ms) | ○ good (703ms) |
| CLS | ○ good (~0) | ○ good (~0) | ○ good (0) | ○ good (0) |
| INP/TBT代理指標 | ○ good (Long Task最大60ms) | ○ good (最大73ms) | ○ good (最大106ms) | ○ good (Long Task 0件) |

**フィールドデータ（CrUX）は取得不可のため、75パーセンタイルでの実ユーザー合否は判定できない**。ラボ計測（本番同等ビルド・本番同等TTFB確認済み）ベースでは4ページとも全指標がgood域。

## 優先度付き推奨事項（上位3件）

1. **[High] フォント（Noto Sans/Serif JP）の転送量削減**（§4）: `/emperors`で150リクエスト・5.9MBは4ページ中最大の改善余地。実機モバイル回線での実測（HAR）を取り、影響の実大きさを確認した上でウェイト数の見直し・サブセット戦略の再検討を推奨。
2. **[Medium] `/timeline`・`/court-events`の初回HTMLに埋め込まれるRSCペイロード（全365人分データ）の削減**（§3）: 表示のcorrectnessやSEO用クロール可能性を損なわない範囲で、初期表示に不要な項目の遅延fetch化を検討。圧縮後サイズの実測が先行タスク。
3. **[Info] `/emperors/qin-shi-huang`のYouTube埋め込みサムネイル（321KB分）の他ページ横展開状況を確認**（§5）: 365ページ全体でのサードパーティ画像の合計データ量が未把握。

いずれも現行のLCP/CLS/TBT（good域）を直接悪化させている証拠はなく、今回発見した課題は「良好な指標を維持しつつ転送量・帯域コストを下げる」という性質の改善（低速回線ユーザー・データ通信量の観点）である点を明記しておく。
