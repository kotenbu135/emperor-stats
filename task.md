# emperorstats.com デファクトスタンダード化ロードマップ

戦略の骨子: 個別ページの質は既に標準を名乗れる水準にある。当面の課題はそれを「発見可能」「引用可能」「検証可能」にすること。項目 0 が品質是正（2026-07-22 レビュー起点・最優先）、1〜4 が基盤、5 が市場拡大、6 が差別化の再加速。

2026-07-22 更新。同日実施の多角的レビュー（サイトコード・データ品質・ドキュメント整合性・SEO/ライセンス/公開運用の4観点＋実機確認）の所見を項目 0 として追加し、完了済み項目（旧項目4）の詳細記述を圧縮した。完了内容の詳細は `CHANGELOG.md`・`docs/PROJECT_STATUS.md`・`docs/site-design/LAYOUT.md`・`data/emperors.json` の `meta.*Blocks` を参照。

---

## 0. 品質是正（2026-07-22 多角的レビュー起点）

**目的**: レビューで検出された欠陥・不整合の解消。データ訂正は `docs/process/RESEARCH_PROCESS.md` の手順に従い、`meta` とドキュメントを同時更新する。

### 0-1. High — **完了（2026-07-22）**

トップ `<title>` 欠落（`seo.tsx` の `title: undefined` 明示キー）修正・`reignSummary.totalReignDuration` 同期漏れ9件の再計算・`check_reign_summary()` への totalReignDuration 検証追加（訂正前データで9件全検出を回帰確認済み）。詳細は `CHANGELOG.md` 2026-07-22 訂正・`docs/PROJECT_STATUS.md`「reignSummary.totalReignDuration の同期漏れ訂正」節。

### 0-2. Medium — **完了（2026-07-22。OGP の公式バリデータ最終確認のみユーザー主導で残**）

- **BCE イベント年規約統一 — 完了**: レビュー見立て8件に対し実際は BCE イベント127件中105件が歴史年直記で、全件を天文年規約へ統一（不規則な5件は原典キャッシュで個別確認）。規約は `ADDITIONAL_SCHEMA.md` に明文化、CI に `check_bce_event_years()` 追加（訂正前データ16件検出を回帰確認）。詳細は `CHANGELOG.md`・`docs/PROJECT_STATUS.md`
- **usedEmperorTitleFrom — 完了**: 規約を「歴史紀年ベース」と確定し `EMPERORS_SCHEMA.md` に明記（旧暦年またぎ4件は正当な -1 乖離として確定）、旧値残存3件を原典確認のうえ訂正、CI に `check_used_emperor_title_from()` 追加
- [ ] **OGP 画像の Content-Type 問題 — 簡易確認では実害なし・公式バリデータ確認のみ残**: 2026-07-22 に curl で `application/octet-stream` 配信を再確認した上で socialsharepreview.com（バックエンド実取得型）で検証し、FB 形式カードの画像描画・画像チェック3項目（found/ratio/size）とも合格。ブラウザ系レンダラは Content-Type を無視して sniffing するため実害は観測されず。**X/Facebook 公式バリデータでの最終確認は要ログインのためユーザー主導**。実害が確認された場合のみ拡張子付きパス化（ビルド後リネーム＋meta 書き換え）に着手
- **デプロイ CI ゲート強化 — 完了**: `deploy-site.yml` build ジョブ冒頭に `validate_emperors.py`（デプロイゲート）＋ `npm run lint`・`npx tsc --noEmit` を追加（ローカルで全て通過確認済み）
- **ドキュメント陳腐化の是正 — 完了**: PROJECT_STATUS 未解決問題リストの現況更新・deathDate>endDate 49件追記・deploy-site.yml の経緯ドキュメント化、ADDITIONAL_SCHEMA の deferred 矛盾・CLAUDE.md 消滅節参照5箇所の誘導し直し、METHODOLOGY/PORTRAITS 冒頭の現況化、completedBlocks 24・「10項目」・`note` キー・日本語破綻2箇所・簡体字・AGENTS.md 365行
- **npm audit — 完了**: `fast-uri`(high) を `npm audit fix` で解消、`shadcn`・`sharp` を devDependencies へ移動。残5件は upstream 待ちのみ（production 視点 `--omit=dev` では next 内包 sharp の high 2件のみ、dev 側は shadcn→MCP SDK→hono の moderate 3件）。ビルド・lint・tsc 通過確認済み

### 0-3. Low（次に該当箇所を触る際に併せて）

- [ ] chen-feidi の没年齢矛盾（birthDate 554・deathDate 570-04・deathAge 19 → 数え年17でズレ。原典記載同士の矛盾、生年552年説の有無を要原典確認）
- [ ] コード小修正: `emperors.ts:63` `videoById.get(id)!` の fail-fast ガード化／`sync-portraits.mjs` の削除追従（ローカル限定の影響）／`eraOrder` 未登録時のサイレント末尾落ち（`?? 99`）の throw 化／`emperors.ts:204` の存在しない `ERA_BY_SELF_SECTION` 参照コメント削除／ランキング系チャート3ファイルの定型約30行の共通化
- [ ] データ構造の小さな不統一: nanming-zongzong の date キー欠落イベント1件・反乱系 events の `name` 欠落28件・houzhao-shishi の `confidence` 欠落・qin-shi-huang/qin-er-shi の displayYears 算出基準揺れ（events の `source` 有無混在は 3-4 で対応）・han-xuandi 立后3件の `datePrecision: "day"` なのに date が年のみ（干支は note に記録済みだが漢代太初暦の月境界を sxtwl が再現する保証がなく、日付確定には個別調査が必要。0-2 の年訂正時に判明）
- [ ] サイト小修正: sitemap の lastmod 一律 `datasetGeneratedAt`（データ更新で全365ページが「更新」扱い）／`timeline/page.tsx:79` のみ素の `<a href="/about">`

---

## 1. カード・ランキングの `<a>` 化＋Search Console 調査

**目的**: クローラが一覧→個別を辿れるようにし、内部リンク経由で PageRank を365ページに流す。

**実装は完了（2026-07-21）**: 詳細は `docs/site-design/LAYOUT.md`・`site/AGENTS.md`（SEO リンクは LazyMount 外必須・受け入れテストは `out/**.html` を grep）。Intercepting Routes は SEO 利得ゼロのため**却下済み**（再提案しない）。

残タスク（**ユーザー主導・デプロイ後2〜6週**）:

- [ ] Search Console:「インデックス作成 > ページ」で個別365ページの内訳（検出-未登録／クロール済-未登録／登録済）を確認 → `<a>` 化前後で比較
- [ ] Search Console: URL 検査で代表ページ（qin-shi-huang 等）のライブテスト、レンダリング後 HTML に本文（調査メモまで）が含まれるか確認（個別ページは完全SSR済みなので本文は含まれるはず）
- [ ] Search Console: sitemap の「検出された URL」数が 365＋固定ページ数と一致するか確認

---

## 2. データ公開（引用される基盤づくり）

**目的**:「emperorstats のデータに依拠した」と書かれる状態を作る。標準はビューではなくデータセットに宿る。

- **2-1. 配布物 — 完了（2026-07-21）**・**2-2. ライセンス — 完了**・**2-5. Wikidata QID — 完了**: 詳細は `docs/PROJECT_STATUS.md` の各節。2-5 の残る後続は `nameEn` 初期値の enwiki サイトリンク取得のみ（項目5で実施）
- **2-3. バージョニング — ほぼ完了（2026-07-21）**:
  - [ ] GitHub Releases でタグを切る（**push 後にユーザー主導**。`v2026.07` 推奨。順序制約なし）
- **2-4. Zenodo DOI — 中止（2026-07-21 ユーザー決定・再提案しない）**: 引用基盤は CC BY 4.0＋CalVer＋CHANGELOG＋Dataset JSON-LD で成立済み。`CITATION.cff` のみ将来の独立項目として余地あり、現時点では見送り

---

## 3. 出典 QA（信頼性の穴埋め）

**目的**:「正史を1件ずつ原典確認」の看板に例外がない状態にする。※訂正は `docs/process/RESEARCH_PROCESS.md` の手順（原典調査・スクリプト自動生成禁止）に従い、`meta.status` とドキュメントを同時更新。

- **3-1. Wikipedia 出典の一掃 — 完了（2026-07-21・全365人）**: 詳細は `meta.deathCauseCompletedBlocks`・`meta.reignDurationSourceBlocks`・`docs/PROJECT_STATUS.md`「出典 QA」節。※フェーズBの派生同期漏れ（reignSummary 9件・usedEmperorTitleFrom 7件）が 0-1/0-2 で検出されており、そちらで是正
- **3-2. 肖像マッピング QA — 完了（2026-07-21）**: 経緯は `docs/site-design/PORTRAITS.md`
  - [ ] **残存リスク**: 「同時代の別人」誤マッチは目視では原理的に拾えない。潰すには Wikidata P18 / Wikipedia リード画像との突き合わせが必要（QID 付与済みで前提は揃っている）
- **3-3. QA の恒久化（CI）— 完了（2026-07-21）**: 運用ルールは `docs/PROJECT_STATUS.md`「データ QA の CI 恒久化」節。※カバレッジ拡張（totalReignDuration・events 年規約）は 0-1/0-2 で対応
  - [ ] ~~`datePrecision` 非標準トークン（115件77種）の正規化~~ **申し送り**（2026-07-21ユーザー判断: 語彙標準の方針確定が先）
  - [ ] ~~`deathDate > endDate` 警告（49件・2026-07-22 実測）の解消~~ **見送り**（2026-07-21ユーザー判断: 在位終了事由フィールドの新設が前提）
  - [ ] 別途（調査判断が必要な残件）: `confidence: ""` 4件の値確定

### 3-4. events[].source の穴埋め（旧第4弾・規模大／要方針判断）
確認済み欠落数（source フィールドを持つ / 全件）:
- 改元 576/681・大赦 1110/1338・立后 227/278・廃立 28/35（**source フィールドあり・欠落補完**）
- 親征 0/291・鎮圧 0/1494・被反乱 0/1853・遷都 0/58（**source フィールド自体が無い**。出典は note 本文・指標レベル `count.note` に埋め込み）

**検討済み（2026-07-21・実データ集計に基づく方針判断）**:
- **欠落391件の正体は「記録様式の世代差」**: 欠落は46人（秦・前漢・新〜後漢・明＝グループ2の初期ブロック）に完全集中し、全員が「配列内全件欠落」。per-event source 記録開始前に調査されたブロックで、データ信頼性でなく記録粒度の問題。正しい source はほぼ全件「当該皇帝の本紀巻名」に帰着する見込み
- **46人全員の `_corpus_cache` が生成済み**: キャッシュ原文で照合→確認できたものだけ source を付す「個別確認つき補完」が低コストで可能（自動一括付与はしない・CONSTRAINTS 準拠）
- **G2側（約3,700件）は note 書名言及率が指標で大きく違う**: 鎮圧・被反乱は出典が列伝・載記に分散しコスト大、サイトは count.note で既に出典を見せておりユーザー可視の増分が小さい

- [ ] 優先度中: 改元105件・大赦228件・立后51件・廃立7件の欠落分補完（46皇帝・キャッシュ照合方式・Workflow で半日〜1日）
- [ ] オプション: 遷都58件への source フィールド追加（note 書名ほぼ完備・件数最小・+2〜3時間。転記は個別確認つき）
- [ ] ~~親征・鎮圧・被反乱の events[] への source 追加~~ **見送り**（指標レベル `count.note` の書名表示で代替済み。外部から出典照会が来た指標だけ個別に格上げ）
- [ ] スキーマ文書（`data/schema/`）へ events[].source 正式化の追記（補完完了と同時）
- [ ] 完了時に 3-3 CI へ「改元/大赦/立后/廃立イベントの source 必須」チェックを追加

---

## 4. グラフページの SSR テキスト＋JSON-LD 補完 — **完了（2026-07-21）**

詳細は `docs/site-design/LAYOUT.md`・`docs/PROJECT_STATUS.md`「ライセンス確定・データ公開基盤」節。

---

## 5. 英語版

**目的**: 中華皇帝への関心人口は英語圏＋中華圏が圧倒的多数。日本語限定は市場を自ら狭めている。

**検討済み（2026-07-21・site 実装の全数調査＋Next.js 16 同梱ドキュメント確認。着手は項目1〜4完了後）**:

- **ルーティングは「日本語＝ルート直下のまま・英語＝`/en/` 配下を追加」の Route Group 方式を採用**。`output:"export"` では proxy（旧 middleware）・redirects・headers がすべて使えず、Accept-Language による locale 自動判定は原理的に不可能。公式 i18n ガイドの `app/[lang]` 全面移行方式は既存 URL を全部 `/ja/...` に変え既存インデックス・被リンクを毀損する → **却下**。multiple root layouts で `app/(ja)/` に既存全ページを移動（URL 不変・`<html lang="ja">`）、`app/(en)/en/` 配下を新設。metadata routes は `app/` 直下に維持
- **i18n ライブラリ（next-intl 等）は導入しない**。翻訳対象の大半が定数マップに集約済みで、最難関の文章生成は TypeScript 関数のため「locale 別フォーマッタ関数」の方が既存構造に合う。dictionary パターン（TS 定数＋`Record<Category, string>` 型で網羅性担保）＋ locale 引数の貫通で足りる
- **hreflang・多言語 sitemap は Next 標準 API で対応可能**: `metadata.alternates.languages`＋sitemap エントリの `alternates.languages`。`buildMetadata()` に locale 引数を追加して全ページ ja/en/x-default(=ja) 相互参照にする。現状 `openGraph.locale`・`<html lang>`・JSON-LD `inLanguage` がすべて固定値で、ここの引数化が構造改修の本体
- **翻訳対象の規模（実測）**: 日本語を含むのは `src/` 下58ファイル。難易度3層 — （易）分類ラベル・ナビ・SEO 定数、（中）各 page.tsx 本文・OGP 画像9本、（難）`emperors.ts` の文章テンプレート群（助詞・単位・複数形が日本語に密結合、言語別関数実装が必要）
- **enum 値・データ結合キーが日本語である問題への方針**: `emperors.json` 側は一切変えず、表示直前に翻訳マップを通す。データ側に足すのは `nameEn` のみ
- **調査メモ（note）・出典は Phase 1 では翻訳しない**: 機械翻訳の誤訳リスクが最も高い領域。英語 UI では「Research notes (Japanese only)」と明示して日本語のまま表示
- **言語自動判定・自動リダイレクトはしない**: GitHub Pages ではサーバー判定不可。ヘッダに言語切替リンクを置くのみ

### 実装（Phase 1 のタスク分解）
- [ ] Route Group 再構成: 既存ページを `app/(ja)/` へ `git mv`。**受け入れテスト: 再構成前後で `out/` のファイル一覧 diff が空**を先に単独コミットしてから en 側に着手
- [ ] locale 貫通: `seo.tsx`・`emperors.ts` のフォーマッタ群に locale 引数（既定 `"ja"`・既存呼び出し無改修）。辞書は `src/lib/i18n/` に TS 定数
- [ ] 分類ラベル・ナビ・UI 固定文言の英訳テーブル
- [ ] 文章テンプレートの英語実装: `getChartTakeaway`・`leaderLabel`・`formatYear`（前221→221 BC）・`formatReignDuration`・`formatPeriod`・`eventSummaryOf`・`rankText`・`ageText`（数え年→ "age 8 (East Asian age reckoning)" 注記）
- [ ] データに `nameEn` 追加。初期値は QID から enwiki サイトリンク（英語版 Wikipedia 記事名）を取得。王朝名・時代区分は site 側マップで対応
- [ ] hreflang 相互参照＋sitemap 言語別 alternates＋ヘッダ言語切替リンク
- [ ] OGP 画像の英語対応: 9本に locale。ラテン文字がサブセット済みフォントに含まれるか要確認
- [ ] `/en/about` は翻訳でなく**英語版書き下ろし**（methodology 中心の要約版で開始可。センシティブな判定の盾になる文書なので Phase 1 に含める）
- [ ] ビルド検証: ページ・OGP 画像が約2倍になるためビルド時間と `out/` サイズを計測。`npx tsc --noEmit`・lint・`out/en/**.html` の hreflang/lang 属性 grep

### 段階戦略（調査メモ365名分の翻訳が最重量）
- [ ] Phase 1: UI＋基本データのみ英語化して公開。調査メモは「日本語のみ（原文）」と明示
- [ ] Phase 2: 調査メモを LLM 翻訳＋「機械翻訳です」表記で追加、指摘が来たら直す
- [ ] Phase 3: 反応を見て繁体字。センシティブな判定は方法論ページ（要英訳・中訳）が盾になる

**工数目安（2026-07-21 再見積り）**: Phase 1 で **4〜6日**。前提依存は項目 2-5（QID→nameEn）のみ（完了済み）で、項目 0・3 の残件とは技術的に独立。

---

## 6. 差別化の第二波（基盤 1〜4 の後・各独立に出せる）

### 6-1. クロス分析（データは既に揃い・ビューを足すだけ）
- [ ] **即位経路×死因**のクロス表／ヒートマップ（「簒奪で即位した皇帝は何%が暗殺されるか」＝このサイトにしか出せない数字・SNS 拡散性最大）
- [ ] 即位時年齢×在位年数の散布図（幼帝の短命傾向の定量化）
- [ ] 世紀別の死因構成推移（stacked area・「皇帝が最も死にやすかった時代」）
- [ ] 王朝内の代数×在位年数（「王朝は何代目から衰えるか」）
- [ ] 各グラフに旧項目4と同要領で結論文。1本ずつ「新着分析」として出せば更新性の演出にも

### 6-2. 比較機能
- [ ] `/compare?ids=kangxi,qianlong` のように URL で状態保持(共有可能が肝)。2〜4名の全項目並べる表＋レーダー可視化
- [ ] 「康熙 vs 乾隆」等の定番カードを一覧ページから提案

### 6-3. 系図（最重量だが最大の差別化・既存サイトに存在しない）
- [ ] 「先代との血縁関係」フィールドを先に付け、系図本体の前に「世襲137名の内訳」統計を1本出す
- [ ] データモデル: `father`/`mother`/`adoptiveFather`（＋非皇帝の中継人物テーブル）。傍系継承・非血縁継承をエッジ種別で区別
- [ ] 可視化は王朝単位ツリーから。工数はデータ整備が主で数週間規模・分割して進める

### 6-4. 元号データベース
- [ ] 改元回数を数えた副産物の元号リストを `/eras` として独立ページ化: 元号→皇帝の逆引き・期間・改元契機
- [ ] 「元号名」は単独の検索需要あり。個別ページ化でロングテール1山追加
- [ ] サイト内検索インデックスに元号・諱・ピンインを統合する改修と同時にやると効率的

---

## 残作業まとめ（2026-07-22 更新）

| 項目 | 内容 | 主導 |
|---|---|---|
| 0-1 | ~~High: トップ title 欠落・reignSummary 9件＋CI 検証追加~~ **完了（2026-07-22）** | — |
| 0-2 | ~~Medium: BCE 年規約105件・usedEmperorTitleFrom・デプロイ CI ゲート・ドキュメント陳腐化・npm audit~~ **完了（2026-07-22）**。OGP Content-Type の X/FB 公式バリデータ最終確認のみ残（簡易確認では実害なし） | ユーザー |
| 0-3 | Low: chen-feidi 原典確認・コード/データ/サイト小修正 | 該当箇所を触る際に |
| 1 残 | Search Console 観測3件（デプロイ後2〜6週） | ユーザー |
| 2-3 残 | GitHub Releases タグ `v2026.07` | ユーザー（push 後） |
| 3-2 残 | 肖像の外部照合（Wikidata P18 突き合わせ） | 任意 |
| 3-4 | events[].source 補完（優先度中391件＋遷都58件） | 要着手判断 |
| 5 | 英語版 Phase 1（4〜6日） | 要着手判断 |
| 6 | クロス分析→比較→元号→系図 | 各独立・軽い 6-1 から |
