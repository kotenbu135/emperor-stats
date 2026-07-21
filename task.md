# emperorstats.com デファクトスタンダード化ロードマップ

戦略の骨子: 個別ページの質は既に標準を名乗れる水準にある。当面の課題はそれを「発見可能」「引用可能」「検証可能」にすること。項目 1〜4 が基盤、5 が市場拡大、6 が差別化の再加速。

2026-07-21 更新。外部 AI（emperorstats.com のみを閲覧）からの改善提案を、リポジトリの実装現状と突き合わせて再構成した。**同日、完了済み項目の詳細記述は削除して圧縮した** — 完了内容の詳細は `CHANGELOG.md`・`docs/PROJECT_STATUS.md`（出典 QA／Wikidata QID／CI 恒久化／ライセンス・データ公開基盤の各節）・`docs/site-design/LAYOUT.md`・`data/emperors.json` の `meta.*Blocks` を参照。

---

## 1. カード・ランキングの `<a>` 化＋Search Console 調査

**目的**: クローラが一覧→個別を辿れるようにし、内部リンク経由で PageRank を365ページに流す。

**実装は完了（2026-07-21）**: 一覧カード・ランキング行・各表を progressive-enhancement 型 `<a>` でリンク化し、静的 HTML に365リンク出力を実証済み。統計ページの「上位10名」静的テーブル・個別ページの王朝リンクも新設済み（詳細: `docs/site-design/LAYOUT.md`・`site/AGENTS.md`。SEO リンクは LazyMount 外必須・受け入れテストは `out/**.html` を grep）。Intercepting Routes は SEO 利得ゼロのため**却下済み**（再提案しない）。

残タスク（**ユーザー主導・デプロイ後2〜6週**）:

- [ ] Search Console:「インデックス作成 > ページ」で個別365ページの内訳（検出-未登録／クロール済-未登録／登録済）を確認 → `<a>` 化前後で比較
- [ ] Search Console: URL 検査で代表ページ（qin-shi-huang 等）のライブテスト、レンダリング後 HTML に本文（調査メモまで）が含まれるか確認（個別ページは完全SSR済みなので本文は含まれるはず）
- [ ] Search Console: sitemap の「検出された URL」数が 365＋固定ページ数と一致するか確認

---

## 2. データ公開（引用される基盤づくり）

**目的**:「emperorstats のデータに依拠した」と書かれる状態を作る。標準はビューではなくデータセットに宿る。

- **2-1. 配布物 — 完了（2026-07-21）**: `/data/emperors.json`（バイト一致コピー）・`/data/emperors.csv`（41列・raw フィールドの純射影・精度フラグ同梱）・`/data/emperors.schema.json`（手書き・git 管理）を `site/scripts/build-data-distribution.mjs` が prebuild で生成。`/about` にダウンロード節設置済み
- **2-2. ライセンス — 完了（2026-07-21）**: データ=CC BY 4.0／コード=MIT の二重ライセンス。宣言前に CC BY-SA 混入スクリーニング実施済み
- **2-3. バージョニング — ほぼ完了（2026-07-21）**: `meta.version`（CalVer）・`CHANGELOG.md`・`/about` 正誤表節を新設済み
  - [ ] GitHub Releases でタグを切る（**push 後にユーザー主導**。`v2026.07` 推奨。Zenodo 中止により順序制約はなく、いつ切ってもよい）
- **2-4. Zenodo DOI — 中止（2026-07-21 ユーザー決定・再提案しない）**: DOI なしでも引用基盤は CC BY 4.0＋CalVer＋CHANGELOG＋Dataset JSON-LD で成立。`CITATION.cff` の配置（GitHub「Cite this repository」ボタン・DOI 不要）だけは将来の独立項目として余地あり、現時点では見送り
- **2-5. Wikidata QID 紐付け — 完了（2026-07-21）**: 365人全員の `sources.wikidata` に付与（3パス方式、詳細: `docs/PROJECT_STATUS.md`「Wikidata QID 紐付け」節）。後続の `sameAs`・CSV 列・CI チェックも完了済み。残る後続は `nameEn` 初期値の enwiki サイトリンク取得のみ（項目5で実施）

---

## 3. 出典 QA（信頼性の穴埋め）

**目的**:「正史を1件ずつ原典確認」の看板に例外がない状態にする。※訂正は `docs/process/RESEARCH_PROCESS.md` の手順（原典調査・スクリプト自動生成禁止）に従い、`meta.status` とドキュメントを同時更新。

- **3-1. Wikipedia 出典の一掃 — 完了（2026-07-21・全365人）**: フェーズA（deathCause 28件＋events 1件）・フェーズB（`reigns[].duration.source` 全365人・12ブロック＋B-4 サイト表示・B-5 検出漏れ12名整備）とも完了。`scripts/detect_wikipedia_sources.py` の残存検出数0件。過程で日付訂正約90件超を実施。詳細は `meta.deathCauseCompletedBlocks`・`meta.reignDurationSourceBlocks[0..12]`・`docs/PROJECT_STATUS.md`「出典 QA」節
- **3-2. 肖像マッピング QA — 完了（2026-07-21）**: 153件全数目視で1件差し替え・3件除外 → 150件。経緯は `docs/site-design/PORTRAITS.md`「肖像マッピングQA」節
  - [ ] **残存リスク**: 単独人物・正しい時代の服飾・題字なしの「同時代の別人」は目視では原理的に拾えない。潰すには外部の正解データ（Wikidata P18 / Wikipedia リード画像）との突き合わせが必要（QID は付与済みで前提は揃っている）
- **3-3. QA の恒久化（CI）— 完了（2026-07-21）**: `scripts/validate_emperors.py`＋`.github/workflows/validate-data.yml`。運用ルールは `docs/PROJECT_STATUS.md`「データ QA の CI 恒久化」節
  - [ ] ~~`datePrecision` 非標準トークン（115件77種）の正規化~~ **申し送り**（2026-07-21ユーザー判断: 語彙標準の方針確定が先。ages フィールド分のみ標準トークン化済み）
  - [ ] ~~`deathDate > endDate` 警告（47件）の解消~~ **見送り**（2026-07-21ユーザー判断: 在位終了事由フィールドが無く機械判別不能。解消するなら終了事由フィールドの新設が前提）
  - [ ] 別途（調査判断が必要な残件）: `confidence: ""` 4件の値確定

### 3-4. events[].source の穴埋め（旧第4弾・規模大／要方針判断）
確認済み欠落数（source フィールドを持つ / 全件）:
- 改元 576/681・大赦 1110/1338・立后 227/278・廃立 28/35（**source フィールドあり・欠落補完**）
- 親征 0/291・鎮圧 0/1494・被反乱 0/1853・遷都 0/58（**source フィールド自体が無い**。出典は note 本文・指標レベル `count.note` に埋め込み）

**検討済み（2026-07-21・実データ集計に基づく方針判断）**:
- **欠落391件の正体は「記録様式の世代差」**: 欠落は46人（秦・前漢・新〜後漢・明＝グループ2の初期ブロック）に完全集中し、全員が「配列内全件欠落」（source あり/なし混在の皇帝はゼロ）。per-event source を記録し始める前に調査されたブロックで、データ信頼性の問題ではなく記録粒度の問題。回数系はもともと正史直読み確定済みなので、正しい source はほぼ全件「当該皇帝の本紀巻名」（漢書・後漢書・明史）に帰着する見込み
- **46人全員の `_corpus_cache` が生成済み**: イベントごとに元号名・大赦記事・立后記事をキャッシュ原文で照合→確認できたものだけ source を付す「個別確認つき補完」が低コストで可能（自動一括付与はしない・CONSTRAINTS 準拠）。明の立后など本紀に無く后妃伝由来の可能性があるものは、照合不成立分だけ列伝確認または要調査として報告させる
- **G2側（約3,700件）は note 書名言及率が指標で大きく違う**: 遷都 57/58・親征 113/291・鎮圧 374/1494・被反乱 226/1853。鎮圧・被反乱は出典が本紀でなく列伝・載記（反乱者側の伝）に分散し1件あたりの個別確認コストが大きい一方、サイトは count.note の書名表示で既に出典を見せておりユーザー可視の増分が小さい

- [ ] 優先度中: 改元105件・大赦228件・立后51件・廃立7件の欠落分補完（46皇帝・キャッシュ照合方式・Workflow で半日〜1日）
- [ ] オプション: 遷都58件への source フィールド追加（note 書名ほぼ完備・件数最小・+2〜3時間。転記は個別確認つき）
- [ ] ~~親征・鎮圧・被反乱の events[] への source 追加~~ **見送り**（指標レベル `count.note` の書名表示で代替済み。将来外部から出典照会が来た指標だけ個別に格上げ）
- [ ] スキーマ文書（`data/schema/`）へ events[].source 正式化の追記（補完完了と同時）
- [ ] 完了時に 3-3 CI へ「改元/大赦/立后/廃立イベントの source 必須」チェックを追加

---

## 4. グラフページの SSR テキスト＋JSON-LD 補完 — **完了（2026-07-21）**

- **4-1. SSR テキスト**: 6グラフページの代表 Section 直下（LazyMount の外＝常時 DOM）に `getChartTakeaway` の総括文を配置済み。チャートと同一の単一情報源（`getOverviewStats`／`record.ranks`）から導出し構造的にずれない設計
- **4-2. JSON-LD**: `personJsonLd`（`alternateName`・`sameAs`=Wikidata 込み）・`breadcrumbJsonLd`・`Dataset`（license/distribution/temporalCoverage/version）・`WebSite` すべて出力実証済み。Google Dataset Search の発火条件が揃った

詳細は `docs/site-design/LAYOUT.md`・`docs/PROJECT_STATUS.md`「ライセンス確定・データ公開基盤」節。

---

## 5. 英語版

**目的**: 中華皇帝への関心人口は英語圏＋中華圏が圧倒的多数。日本語限定は市場を自ら狭めている。

**検討済み（2026-07-21・site 実装の全数調査＋Next.js 16 同梱ドキュメント確認。着手は項目1〜4完了後）**:

- **ルーティングは「日本語＝ルート直下のまま・英語＝`/en/` 配下を追加」の Route Group 方式を採用**。`output:"export"` では proxy（旧 middleware）・redirects・headers がすべて使えず（`static-exports.md` の Unsupported Features で確認）、Accept-Language による locale 自動判定は原理的に不可能。公式 i18n ガイドの `app/[lang]` 全面移行方式は既存 URL を全部 `/ja/...` に変えることになり、静的 export ではリダイレクトも張れないため既存インデックス・被リンクを毀損する → **却下**。代わりに multiple root layouts を使い、`app/(ja)/` に既存全ページを移動（URL 不変・`<html lang="ja">`）、`app/(en)/layout.tsx`（`<html lang="en">`）＋ `app/(en)/en/` 配下に新設する。URL は原案どおり `/en/emperors/qin-shi-huang`。ページ種は12個なので en 側は「共通実装を import する薄いラッパ」で複製コスト小。sitemap/robots/manifest 等の metadata routes は root layout 不要のため `app/` 直下に維持
- **i18n ライブラリ（next-intl 等）は導入しない**。現状未インストール。翻訳対象の大半が既に定数マップ（`emperor-types.ts` の `deathCauseDescriptions`・`accessionRouteCategoryOrder`・`emperorEventKindLabels` 等）に集約済みで、最難関の文章生成は TypeScript 関数のため、ICU MessageFormat より「locale 別フォーマッタ関数」の方が既存構造に合う。公式ガイドの dictionary パターン（TS 定数＋`Record<Category, string>` 型で網羅性を担保）＋ locale 引数の貫通で足りる
- **hreflang・多言語 sitemap は Next 標準 API で対応可能**（追加ライブラリ不要）: `metadata.alternates.languages`（`<link rel="alternate" hreflang>` 出力）と sitemap エントリの `alternates.languages` が存在。`buildMetadata()`（`seo.tsx`）に locale 引数を追加して全ページ ja/en/x-default(=ja) 相互参照にする。現状は `openGraph.locale: "ja_JP"`・`<html lang="ja">`・JSON-LD `inLanguage: "ja"` がすべて固定値なので、ここの引数化が構造改修の本体
- **翻訳対象の規模（実測）**: 日本語を含むのは `src/` 下58ファイル。難易度3層 — （易）分類ラベル・ナビ（`nav-data.ts`）・SEO 定数＝集約済みマップへの英訳テーブル追加のみ。（中）各 page.tsx の本文・metadata（`about/page.tsx` の62行が最大）・コンポーネント固定ラベル・OGP 画像9本。（難）`emperors.ts` の文章テンプレート群（`getChartTakeaway`・`countTakeaway`・`leaderLabel`「○○ら3名」・`formatYear`「前221」・`formatReignDuration`「1年30日」・数え年表記等）— 助詞・単位・複数形が日本語に密結合しており、英語版は言語別関数実装が必要
- **enum 値・データ結合キーが日本語である問題への方針**: `deathCause`「病死」等の enum 値や `ERA_BY_SECTION` の日本語キーは**データ結合子なので `emperors.json` 側は一切変えない**。表示直前に翻訳マップ（既存 `deathCauseDescriptions` と同型の `xxxLabelsEn`）を通す。データ側に足すのは `nameEn` のみ
- **調査メモ（note）・出典は Phase 1 では翻訳しない**: 正史原文引用を含む自由記述365名分で、機械翻訳の誤訳リスクが最も高い領域。英語 UI では「Research notes (Japanese only)」と明示して日本語のまま表示（出典として機能はする）。翻訳するなら Phase 2 で `public/emperor-notes/` の lazy-fetch JSON に en 版を並置する形が既存構造と整合
- **言語自動判定・自動リダイレクトはしない**: GitHub Pages ではサーバー判定不可。ヘッダ（`site-shell`）に言語切替リンクを置くのみ。SEO 的にもクローキング誤認リスクがなく安全

### 実装（Phase 1 のタスク分解）
- [ ] Route Group 再構成: 既存ページを `app/(ja)/` へ `git mv`（root layout 含む）。**受け入れテスト: 再構成前後で `out/` のファイル一覧 diff が空**（URL 不変の実証）を先に単独コミットしてから en 側に着手
- [ ] locale 貫通: `seo.tsx`（`buildMetadata`/JSON-LD 群/`SITE_SECTIONS`）・`emperors.ts` のフォーマッタ群に locale 引数（既定 `"ja"`・既存呼び出し無改修）。辞書は `src/lib/i18n/` に TS 定数
- [ ] 分類ラベル・ナビ・UI 固定文言の英訳テーブル（`emperor-types.ts` の各マップ・`nav-data.ts`・チャート/フィルタ/詳細ダイアログのラベル）
- [ ] 文章テンプレートの英語実装: `getChartTakeaway`・`leaderLabel`・`formatYear`（前221→221 BC）・`formatReignDuration`・`formatPeriod`・`eventSummaryOf`・`rankText`・`ageText`（数え年→ "age 8 (East Asian age reckoning)" 注記）
- [ ] データに `nameEn` 追加。初期値は項目 2-5 の QID から **enwiki サイトリンク（英語版 Wikipedia 記事名）**を取得（英語ラベルより記事名が検索最適。ピンイン単独「Qin Shi Huang」と「Emperor Wu of Han」型の混在はそのまま記事名慣行に従う）。王朝名・時代区分の英語名は有限個なので site 側マップで対応
- [ ] hreflang 相互参照（`alternates.languages`）＋ sitemap 言語別 alternates ＋ ヘッダ言語切替リンク
- [ ] OGP 画像の英語対応: `og-image.tsx`・`opengraph-image.tsx` 9本に locale。ラテン文字はサブセット済み Noto Sans JP に含まれるか要確認（含まれなければ英語用サブセット追加）
- [ ] `/en/about` は翻訳でなく**英語版書き下ろし**（収録基準・数え方・出典方針＝ methodology 中心の要約版で開始可。正統/僭称・満洲国等のセンシティブな判定の盾になる文書なので Phase 1 に含める）
- [ ] ビルド検証: 静的ページ・OGP 画像が約2倍（365×2＋固定ページ）になるためビルド時間と `out/` サイズを計測。`npx tsc --noEmit`・lint・`out/en/**.html` の hreflang/lang 属性 grep

### 段階戦略（調査メモ365名分の翻訳が最重量）
- [ ] Phase 1: UI＋基本データ（名前・在位・死因・即位経路・各回数・順位）のみ英語化して公開。調査メモは「日本語のみ（原文）」と明示して日本語のまま（出典として機能はする）
- [ ] Phase 2: 調査メモを LLM 翻訳＋「機械翻訳です」表記で追加、指摘が来たら直す
- [ ] Phase 3: 反応を見て繁体字。正統/僭称・満洲国の扱い等センシティブな判定は方法論ページ（要英訳・中訳）が盾になる

**工数目安（2026-07-21 再見積り）**: Phase 1 で **4〜6日**（Route Group 再構成＋locale 貫通 1〜2日・英訳テーブル＋固定文言 1〜2日・テンプレート英語実装 1日・nameEn 整備 0.5〜1日・OGP/about/検証 1日）。**前提依存は項目 2-5（QID→nameEn）のみ**（完了済み）で、項目 3 の残件とは技術的に独立。

---

## 6. 差別化の第二波（基盤 1〜4 の後・各独立に出せる）

### 6-1. クロス分析（データは既に揃い・ビューを足すだけ）
- [ ] **即位経路×死因**のクロス表／ヒートマップ（「簒奪で即位した皇帝は何%が暗殺されるか」＝このサイトにしか出せない数字・SNS 拡散性最大）
- [ ] 即位時年齢×在位年数の散布図（幼帝の短命傾向の定量化）
- [ ] 世紀別の死因構成推移（stacked area・「皇帝が最も死にやすかった時代」）
- [ ] 王朝内の代数×在位年数（「王朝は何代目から衰えるか」）
- [ ] 各グラフに 4-1 と同要領で結論文。1本ずつ「新着分析」として出せば更新性の演出にも

### 6-2. 比較機能
- [ ] `/compare?ids=kangxi,qianlong` のように URL で状態保持（共有可能が肝）。2〜4名の全項目並べる表＋レーダー可視化
- [ ] 「康熙 vs 乾隆」等の定番カードを一覧ページから提案

### 6-3. 系図（最重量だが最大の差別化・既存サイトに存在しない）
- [ ] 「先代との血縁関係」フィールド（子/弟/甥/従兄弟/血縁なし…）を先に付け、系図本体の前に「世襲137名の内訳」統計を1本出す
- [ ] データモデル: `father`/`mother`/`adoptiveFather`（＋非皇帝の中継人物テーブル）。傍系継承・非血縁継承（禅譲・簒奪）をエッジ種別で区別
- [ ] 可視化は王朝単位ツリーから（全365名の単一グラフは読めない）。工数はデータ整備が主で数週間規模・分割して進める

### 6-4. 元号データベース
- [ ] 改元回数を数えた副産物の元号リストを `/eras` として独立ページ化: 元号→皇帝の逆引き・期間・改元契機
- [ ] 「元号名」は単独の検索需要あり（永楽・康熙・貞観…）。個別ページ化でロングテール1山追加
- [ ] サイト内検索インデックスに元号・諱・ピンインを統合する改修と同時にやると効率的

---

## 残作業まとめ（2026-07-21 圧縮時点）

| 項目 | 内容 | 主導 |
|---|---|---|
| 1 残 | Search Console 観測3件（デプロイ後2〜6週） | ユーザー |
| 2-3 残 | GitHub Releases タグ `v2026.07` | ユーザー（push 後） |
| 3-2 残 | 肖像の外部照合（Wikidata P18 突き合わせ） | 任意 |
| 3-4 | events[].source 補完（優先度中391件＋遷都58件） | 要着手判断 |
| 5 | 英語版 Phase 1（4〜6日） | 要着手判断 |
| 6 | クロス分析→比較→元号→系図 | 各独立・軽い 6-1 から |
