# サイトレイアウト方針

Next.js + GitHub Pages で構築する統計可視化サイトのレイアウト設計メモ。**サイト実装自体はデータ確定後（`meta.status.overall` が `in-progress` でなくなってから）に着手する**（[CLAUDE.md](../../CLAUDE.md)・[PROJECT_STATUS.md](../PROJECT_STATUS.md) 参照）。2026-07-18にデータ確定（`meta.status.overall: "completed"`）し着手可能な状態になったが、本稿執筆時点ではまだ着手していない。このドキュメントは実装開始時の出発点として先行して検討したもの。

## 基本レイアウト（2026-07-16 合意）

- **PC**: 左固定サイドバー（幅240px程度、カテゴリ別メニュー）+ 右にメインコンテンツ（グラフ・表）
- **スマホ**: ハンバーガー開閉のオフキャンバス（ドロワー）に切り替え
- メニューはカテゴリごとに**折りたたみ可能なアコーディオン構造**にする（統計項目が今後も増える見込みのため）
- アイコンは絵文字ではなく、アイコンライブラリ（Lucide/Heroicons等）を使用する

### 検討の背景

下部タブバー案も検討したが、頻繁に切り替えたいカテゴリが多いため、左メニュー＋オフキャンバスの方がシンプルという判断に至った。データ項目（在位年数・死因・即位経路・改元/大赦/立后/皇太子廃立・親征/反乱鎮圧/被反乱・遷都・年齢）が段階的に増えていく設計のため、フラットな一覧メニューだと将来肥大化する懸念があり、アコーディオンで拡張性を確保する。

## メニュー構成案

```
概要ダッシュボード
   在位年数トップ10、王朝数、死因分布の概況などサマリー

皇帝一覧
   364名の検索・フィルタ（王朝×section複合キー、時代、性別等）→ 個人詳細ページへ

在位データ
   ├ 在位年数ランキング
   └ 在位期間タイムライン（王朝別）

死因・即位
   ├ 死因別分布（病死/暗殺/処刑/戦死/自尽/事故死/不詳/諸説あり）
   └ 即位経路別分布（世襲/簒奪/禅譲/擁立/復位/建国/不詳/諸説あり）

宮廷イベント（改元・大赦・立后・皇太子廃立・遷都）
   ├ 改元回数ランキング
   ├ 大赦回数ランキング
   ├ 立后回数ランキング
   ├ 皇太子廃立回数ランキング
   └ 遷都回数ランキング（当初は独立項目だったが2026-07-18に統合。下記「メニュー・配色改善」参照）

軍事（親征・反乱鎮圧・被反乱）
   ├ 親征回数ランキング
   ├ 反乱鎮圧回数ランキング
   └ 被反乱回数ランキング

年齢
   （生年判明分のみ・グループ5 deferred、後日追加）

王朝・時代で見る
   王朝別の横断比較（在位年数平均、死因傾向など）
```

### 設計上のポイント

- **「宮廷イベント」「軍事」はスキーマ上は独立フィールド（`eraChangeCount`/`amnestyCount`/`empressInstallationCount`/`crownPrinceDepositionCount`、`personalCampaignCount`/`rebellionSuppressionCount`/`rebellionSufferedCount`）だが、UIでは1つのアコーディオン項目に集約する**。個々をトップレベルに並べるとスマホで項目数が多くなりすぎるため。
- **「遷都」「年齢」は調査未着手（`not-started`/`deferred`）のため、実装初期はメニューから外すかグレーアウト表示にし、データが埋まった時点で有効化する**（プロジェクト方針「データ未確定の間はサイト実装に着手しない」と整合）。
- **「王朝・時代で見る」は個人単位フィールドを王朝で集計する横断ビュー**。`dynasty.name`+`section`の複合キーでのフィルタが必要（同名王朝の区別、[EMPERORS_SCHEMA.md](../../data/schema/EMPERORS_SCHEMA.md) 参照）。
- **「皇帝一覧」は検索・フィルタの起点**として、他の統計ページから個人詳細ページに飛べる導線にもなる。

## グラフ・表の具体案

各メニュー項目に対応する具体的なビジュアライゼーション案。対応スキーマフィールドを併記する（詳細は [data/schema/](../../data/schema/) 参照）。

### 概要ダッシュボード

- KPIカード群: 総皇帝数(364)・王朝数・平均在位年数・最長/最短在位者名
- 在位年数分布ヒストグラム（`reignSummary.totalReignDuration.displayYears`）
- 死因ミニ円グラフ（`deathCause.category`、8カテゴリ）
- 通史タイムライン: 始皇帝〜溥儀を横軸に、王朝ごとに色分けした帯グラフ（`reigns[].startDate`〜`endDate`）

### 皇帝一覧

- ソート・フィルタ可能テーブル: 名前・王朝(`dynasty.name`+`section`)・在位期間・在位年数・死因・即位経路
- 検索ボックス（`name.commonName`/`aliases`）

### 在位データ

- 在位年数ランキング棒グラフ（トップ20・ワースト20、`reignSummary.totalReignDuration`）
- 在位期間ガントチャート（王朝別、複数即位者は`reigns[]`ごとにセグメント分割、`isRestoration`をマーカー表示）
- 複数回即位（復位）者テーブル（`reignSummary.reignCount >= 2`の人物一覧）

### 死因・即位

- 死因別分布 円グラフ（`deathCause.category`）
- 死因×時代 積み上げ棒グラフ（時代を横軸、カテゴリで色分け）
- 即位経路別分布 円グラフ（`accessionRoute.category`）
- 即位経路×死因 クロス集計表（例: 簒奪で即位した皇帝は暗殺・処刑で死ぬ率が高いか等の相関）

### 宮廷イベント（改元・大赦・立后・皇太子廃立）

- 4項目共通の回数ランキング棒グラフ（各`count`のトップ20、`events[]`で明細をツールチップ表示）
- 在位年数あたりの改元頻度 散布図（X=在位年数、Y=改元回数、外れ値＝頻繁な改元をした皇帝を強調）
- 立后回数複数の皇帝ハイライト表（`empressInstallationCount.count >= 2`）

### 軍事（親征・反乱鎮圧・被反乱）

- 3項目共通の回数ランキング棒グラフ
- 反乱鎮圧 vs 被反乱 散布図（X=鎮圧回数、Y=被反乱回数。乖離が大きい人物＝内乱に苦しんだ皇帝等が見える）
- 親征の勝敗内訳 円グラフ（`personalCampaignCount.events[].outcome`のテキストから勝敗を分類）

### 王朝・時代で見る（横断ビュー）

- 王朝別平均在位年数 棒グラフ
- 王朝別死因傾向 積み上げ棒グラフ（易姓革命で滅亡した王朝ほど暗殺/処刑が多い、等の傾向が見える想定）
- 王朝存続期間タイムライン（王朝単位のガントチャート、皇帝一覧ページへのドリルダウン導線）

### 遷都・年齢（データ確定後に追加）

- 遷都: 王朝別遷都回数・遷都地点の変遷（地図的表現は将来検討）
- 年齢: 即位時年齢×没年齢 散布図、ヒストグラム（生年判明分のみのため件数少なめの注記付き）

## デザイン世界観決定（2026-07-17）

3案（朱金・紫禁城／水墨文人／青花瓷・モダンエディトリアル）のHTMLモックアップ（`docs/site-design/mockups/design-directions.html`）を比較検討し、**水墨文人スタイル**を採用。

- **配色**: 墨の濃淡を基調にした抑制的な配色。朱色は印章的なワンポイント（ランキング1位バッジ等）のみに限定使用。
  - Surface（背景）: `#F5F1E8`（淡い宣紙色）
  - Ink（本文テキスト）: `#3A3530`（墨色）
  - Primary（見出し・罫線）: `#4A4038`
  - Accent（朱印ワンポイント）: `#A6321C`
  - Border/Divider: `#DDD5C7`（淡いグレー）
- **書体**: 見出し=明朝体系（Noto Serif JP/SC）、本文・UI=ゴシック体系（Noto Sans JP/SC）
- **モチーフ**: 筆致（ブラシストローク）風の淡い区切り線、朱印スタンプ風の強調要素（多用しない、ここぞという箇所のみ）
- **ダークモード**: 実装しない（ライトテーマのみ）
- **未確定**: 王朝別カテゴリカルパレット（Nivoのグラフで王朝を色分けする際の配色）は上記ブランドカラーとは別に、datavizスキルの手順（`scripts/validate_palette.js`によるCVD安全性検証）に沿って実装着手時に確定する。ブランドカラーの朱・墨をアンカーにしつつ、識別性を優先した配色にする方針。

## 皇帝一覧カードのレイアウト方針（2026-07-17）

「キャラ図鑑」的なグリッドカード表示（`docs/site-design/image.png`を参考画像として保存）を皇帝一覧のベースデザインに採用。カード内に肖像画＋名前等を表示する。

### 課題と対応

[肖像画収集（PORTRAITS.md）](./PORTRAITS.md)で確定した153件の画像は、サイズ・アスペクト比がまちまち（幅500pxサムネイル固定だが縦幅は436〜1057pxとバラバラ）で、そのままグリッドに並べると不揃いになる。実寸を調査した結果：

- アスペクト比（横/縦）は0.47〜1.08の範囲、横長は0件（全て縦長〜正方形）、中央値0.72
- 中国の伝統的な人物画（肖像・全身像）が主なため、**顔は画像上部寄り**に配置されている傾向

これを踏まえ、以下の方式を採用：

- **カード枠は固定アスペクト比**（3:4想定、実装時に調整）
- 画像は **`object-fit: cover` + `object-position: top`** で統一表示（顔を切らずに枠へフィットさせる）
- **画像なし211名分**は同じ枠サイズで、王朝色または朱印風の姓一文字モノグラムをプレースホルダー表示（水墨文人テーマと整合、欠番を目立たせない）

検討した代替案（`object-fit: contain` + 宣紙色の余白埋め）は、画像非切り抜きな一方、カードごとの画像占有面積がバラつき「図鑑」らしい均一感が弱まるため不採用とした。

## 技術スタック決定（2026-07-17）

- **チャートライブラリ**: [Nivo](https://nivo.rocks/)。デフォルトの見た目の完成度（ダークテーマ・グラデーション・アニメーション標準搭載）が高く「映え」を狙いやすい。加えて`tooltip` propが任意のReactコンポーネントをそのまま描画できるため、ホバー時に皇帝の肖像・名前・王朝・在位年数などをまとめたカードをポップアウト表示する要件に自然に対応できる。（比較検討したECharts・AntV G2・Rechartsはtooltipが基本HTML文字列ベースで、同じ体験には追加のportal的な工夫が必要）
- **UI/CSSライブラリ**: Tailwind CSS + [shadcn/ui](https://ui.shadcn.com/)。Radixベースでアクセシブル、Accordion/Drawer（左メニュー・スマホ用オフキャンバス）もコピペで導入できるコンポーネントとして提供される。静的書き出し（GitHub Pages）との相性も良い。
- **アイコンライブラリ**: [Lucide](https://lucide.dev/)。shadcn/ui標準のアイコンセットでストロークが統一されており種類も豊富。

## 実装着手時の技術判断（2026-07-18）

- **リポジトリ構成**: 別リポジトリを新規作成せず、**同一リポジトリ（emperor-stats）内**に配置する（例: `site/` ディレクトリ配下にNext.jsプロジェクトを作成）。`data/emperors.json`をビルド時に直接参照でき、データ更新とサイト実装が同じPR/コミット履歴で追跡できるため。
- **GitHub Pages公開形態**: プロジェクトページ（`https://<username>.github.io/emperor-stats/`）。Next.jsの`next.config.js`で`basePath`/`assetPrefix`の設定が必要になる点に注意。
- **実装の進め方**: 全メニュー一括ではなく**MVP優先で段階的に実装**する。データが早期に揃っていた在位年数・死因・即位経路・宮廷イベント（改元/大赦/立后/皇太子廃立）のページから着手し、動くサイトを早期に確認しながら軍事・遷都・年齢・王朝横断ビューへ広げる。
- **パッケージマネージャ／Node.jsバージョン**: npm + 既存のnvm（v26.4.0）を使用する（[[node-runtime-wsl]]参照）。追加ツールのセットアップ不要。

## 雛形作成（2026-07-18）

`site/`ディレクトリに`create-next-app`（TypeScript・Tailwind CSS v4・App Router・`src/`構成）でNext.js 16プロジェクトを作成。

- **静的書き出し設定**: `next.config.ts`で`output: 'export'`・`basePath: '/emperor-stats'`・`images.unoptimized: true`を設定済み（GitHub Pagesプロジェクトページ向け）。`npm run build`で`out/`にbasePath付きのアセットパスが出力されることを確認済み。
- **shadcn/ui**: `npx shadcn@latest init`（`nova`プリセット＝Lucideアイコン、Radixベース）で初期化し、`Accordion`/`Sheet`（オフキャンバス代わり）/`Card`/`Table`/`Button`/`Badge`/`Separator`を導入済み。
- **フォント**: `next/font/google`で見出し=`Noto_Serif_JP`、本文/UI=`Noto_Sans_JP`を設定（`--font-heading`/`--font-sans`）。中国語繁体字/簡体字表記はサイト上で使わない方針のためSCフォントは導入せず。
- **配色**: `src/app/globals.css`の`:root`に水墨文人パレット（background `#F5F1E8`・foreground `#3A3530`・primary `#4A4038`・border `#DDD5C7`）を反映し、朱印アクセント用に`--seal`/`--color-seal`トークンを独自追加（`#A6321C`、`bg-seal text-seal-foreground`で使用）。ダークモードは方針通り未実装（`.dark`定義なし）。`--chart-1`〜`5`（王朝別カテゴリカルパレット）は未確定のため暫定グレースケールのまま — 実チャート実装時に必ずdataviz skillで確定させること。
- **Nivo**: `@nivo/core`・`bar`・`pie`・`line`・`scatterplot`をインストール済み（LAYOUT.md記載のグラフ種に対応）。
- **Stitch MCP不使用の経緯**: 当初`google-labs-code/stitch-skills`（Google Stitch AIデザイン生成）の利用を検討したが、Stitch MCPサーバー側のツールスキーマ不具合（`can't resolve reference #/$defs/ScreenInstance`）で接続不可のため、手動での`create-next-app`+shadcn/uiによる雛形作成に切り替えた。`stitch-build:shadcn-ui`スキル（MCP不要）はセットアップ手順のガイダンスとして活用。MCP不具合が解消すれば`stitch::generate-design`等でのデザイン生成を後日試す余地あり。

## MVPページ実装（2026-07-18）

在位データ・死因・即位経路・宮廷イベントの3ページを実装し、メニュー・グラフ・データ連携までMVP範囲が動作する状態になった。

- **データ連携**: `site/src/lib/emperors.ts`が`fs.readFileSync(path.join(process.cwd(), "..", "data", "emperors.json"))`でビルド時に`data/emperors.json`を読み込み、在位年数ランキング・死因/即位経路の分布・宮廷イベント4種のランキングを集計する関数群を提供する。**Turbopackは`site/`の外側のファイルを静的import（`import x from "../../../data/emperors.json"`）で解決できずビルドエラーになるため、`fs`経由の読み込みに統一した**（次にビルドエラーになったら真っ先にこの制約を疑うこと）。
- **メニュー**: `site/src/lib/nav-data.ts`にLAYOUT.mdのメニュー構成をそのままデータ化。実装済み（在位データ/死因・即位/宮廷イベント）は有効リンク、未実装項目（皇帝一覧/軍事/遷都/年齢/王朝横断）は「準備中」バッジ付きで無効表示。`site/src/components/layout/site-shell.tsx`がPC固定サイドバー（`md:`以上で表示）とスマホ用Sheetオフキャンバス（ハンバーガーボタン）を切り替える。
- **グラフ**: dataviz skillの手順に従い、既定の検証済み8色カテゴリカルパレット（`references/palette.md`のデフォルト）をsurface `#F5F1E8`に対し`validate_palette.js`で検証（全項目PASS、4スロットはコントラストWARNのため凡例+直接ラベル表示で緩和）。`globals.css`に`--series-1`〜`8`として追加（王朝別横断ビュー用の`--chart-1`〜`5`とは別トークン、用途が異なるため混在させない）。ランキング棒グラフ（在位年数・宮廷イベント4種）は単一エンティティのnominal categoricalとして単色（`--series-1`固定、凡例なし）、死因・即位経路の円グラフは8色カテゴリカルパレット＋凡例＋直接ラベルで実装。
- **ハマった点**: Nivo Barの`labelPosition="end"` + 負の`labelOffset`でラベルをバー外側に出そうとしたところ、`labelTextColor`が背景色と同系統だったためバー外にはみ出た部分の文字が背景に溶けて見えなくなるバグを作り込んだ（ビルドは通るが視覚的に壊れる典型例）。`labelPosition`/`labelOffset`を指定せずデフォルト（`middle`・バー内側中央）に戻して解決。**Nivoのグラフはビルド成功だけでは検証にならず、実際にブラウザで見た目を確認する必要がある**（このバグはbuild/lint両方通過した状態で発生していた）。また、Nivo横棒グラフはデータ配列の先頭要素を下端に描画するため、降順ランキングをそのまま渡すと1位が最下段に来てしまう。`RankingBarChart`内で表示直前に配列を反転させて対応。
- **未実施**: 皇帝一覧・軍事・遷都・年齢・王朝横断ビューのページ、Storybook/Chromaticの導入。

## MVPページの機能拡充（2026-07-18・同日追加分）

MVP実装直後にユーザーから追加要望を受け、在位データ・死因即位・宮廷イベントの3ページを以下の点で拡充した。

- **スキーマ名の非表示**: ページ説明文からJSONフィールドパス（例: `deathCause.category`）を除去し、訪問者向けの自然文に統一。
- **全件表示化**: ランキング棒グラフをトップ20固定から**364名全員表示**に変更（`RankingBarChart`）。宮廷イベント4種も0回の皇帝を含め全員表示するよう変更（旧実装は`count>0`でフィルタしていたが「全員見れるように」の要望で撤廃）。
- **王朝・正統性フィルタ＋ソート（全グラフ共通）**: `site/src/components/charts/chart-filter-controls.tsx`が王朝（`dynasty.name`+`section`複合キー、87件、データ初出順）・正統性（`dynasty.category`の3値）・ソート方向（多い順/少ない順、またはカテゴリ順/件数順）の3コントロールを提供し、ランキング棒グラフ・円グラフ・復位者一覧テーブルすべてに適用。
- **肖像画ポップアップ**: `docs/site-design/mockups/card-preview/`の153件webpを`site/scripts/sync-portraits.mjs`で`site/public/portraits/`に同期（`predev`/`prebuild`で自動実行、git管理は同期元のみ）。ランキング棒グラフのツールチップ（`EmperorTooltip`）で該当皇帝の肖像があれば`next/image`で表示。
- **在位年数の表示形式変更**: 小数年（例: `61.91`）から「○年○日」形式（`formatReignDuration`、`reignApproxDays`基準）に変更。データ変更は不要（既存の`approxDays`から算出）。
- **死因・即位経路カテゴリの凡例説明**: 円グラフ下部にカスタム凡例を実装し、shadcnの`HoverCard`でカテゴリ定義（DEATH_CAUSE_SCHEMA.md/ADDITIONAL_SCHEMA.mdの定義文を短縮転記）をホバー表示。
- **復位者一覧のデフォルトソート**: 即位回数の多い順をデフォルトに変更。

### ハマった点・教訓（同日追加分）

- **サーバー→クライアントの関数props禁止に複数回引っかかった**: `getDynastyOptions()`等のfs依存関数や、`valueOf`/`categoryOf`等のアロー関数をServer ComponentからClient Componentへpropsで渡そうとすると、それぞれ別種のビルドエラー（`node:fs`をクライアントバンドルに含められない／関数を渡せない）になる。**対策として型・定数だけを`site/src/lib/emperor-types.ts`（fs非依存）に分離し、fs依存のデータ取得は`site/src/lib/emperors.ts`のServer Component専用関数に閉じ込め、Client Componentへは文字列キー（`metricKey`等）と配列・オブジェクトなどシリアライズ可能な値のみを渡す設計に統一した。** 今後Client Componentを追加する際もこの分離を踏襲すること。
- **同名同王朝の衝突でNivoの棒が1本消える**: `name.commonName`が`null`の皇帝が2名（赫連昌・赫連定、共に「夏」）存在し、表示ラベルが両方「null（夏）」になって`indexBy="label"`が衝突、364件のはずが363本しか描画されずグラフの一部が空白になるバグが発生した。**`indexBy`は表示ラベルでなく一意な`id`を使い、軸ラベルは`axisLeft.format`で`id→label`のMapを引く方式に変更して恒久対策**。`commonName`のnullは表示名フォールバック（`personalName`等）で吸収しつつ、データ側の是正は[PROJECT_STATUS.md「サイト実装で見つかったデータ品質の申し送り事項」](../PROJECT_STATUS.md)に記録した。
- **`next/image`は`images.unoptimized:true`のとき`basePath`を自動付与しない**: `images.unoptimized`（静的書き出しに必須）が有効だと、Next.js内部のデフォルトローダーを経由しないため`basePath`プレフィックスが一切付かず、`<Image src="/portraits/x.webp">`が本番相当の`/emperor-stats/`配下で404になる。`site/src/lib/base-path.ts`に`BASE_PATH`定数を新設し、`next.config.ts`と`portraitUrl`生成の両方で同じ値を参照する形にして解消。**publicディレクトリのアセットをnext/imageで参照する箇所は必ずこの定数を使うこと。**
- **スクロール用`overflow-y-auto`コンテナがNivoツールチップを切り抜いてしまう**: Nivoのツールチップは`position:absolute`で描画されるため、全件表示のために追加した内側スクロールコンテナ（`overflow-y-auto`）の外にはみ出す形（一覧の上端付近）で表示しようとすると見えなくなる。**内側スクロールをやめ、チャート自体をページの通常フローに置いてページ全体でスクロールさせる方式に変更**（364件×行高でセクションが縦に長くなるが、「スクロールして全員見れる」という要望どおりの挙動になり、ツールチップも問題なく表示される）。
- **Nivoのマウントアニメーション中はグラフが一時的に空白/歪んで見える**: スクリーンショットのタイミング次第でチャートが真っ白・数値ラベルが位置ずれして見えることがあったが、実際にはマウント/データ更新アニメーションの途中を捉えただけで、1〜2秒待てば正しい表示に収束する（実装バグではない）。目視確認時はアニメーション完了を待ってから判断すること。

## 全統計ページ実装（2026-07-18・MVP後の追加分）

MVPで「準備中」だった5項目をすべて実装し、メニュー構成案の全項目が稼働する状態になった。あわせてスクロールバーのデザインを水墨文人パレットに統一した。

- **皇帝一覧**（`/emperors`）: 「キャラ図鑑」グリッド（3:4固定枠・`object-fit: cover` + `object-position: top`、画像なし211名は姓一文字モノグラム）。検索（`name.*`各種名称+aliases+王朝名+時代の連結文字列に対する空白区切りAND部分一致）・王朝・区分フィルタ付き。**個人詳細は別ページでなくダイアログ（shadcn Dialog）で表示**（364ルート生成を避けつつ全12項目+名称類を表示できる）。王朝と時代の表示は「明（明）」「呉・三国（三国）」のような重複を避けるため、`dynastyLabel`と`eraLabel`が相互に含まれる場合は時代を省略する。
- **軍事**（`/military`）: 親征・反乱鎮圧・被反乱の3ランキング。LAYOUT.md提案の「鎮圧vs被反乱散布図」「親征勝敗円グラフ」は未実装（勝敗円グラフは`outcome`自然文の機械分類が必要でデータ正確性の原則と相容れないため見送り。散布図は将来検討）。
- **遷都回数**（`/capital`）・**年齢**（`/ages`）: `RankingBarChart`を指標拡張して実装。年齢はnull（生年不詳）を除外して件数注記する`missingNoteLabel`と、「少ない方が1位」を固定する`rankDirection`プロパティを追加（即位時年齢は若い順デフォルト・1位=最年少）。
- **王朝・時代で見る**（`/dynasties`）: 平均在位年数（単一系列・朱色、皇帝数をラベル併記）と死因の内訳（検証済み8色死因パレットの積み上げ横棒、セグメント間はsurface色`borderWidth:1`で区切り、`enableTotals`で合計表示）。**集計単位トグル（王朝別/時代別）**と時代順ソートを装備。未確定だった`--chart-1〜5`王朝パレットは、単一系列+死因パレット再利用の構成にしたため今回も不要（王朝タイムライン実装時に要確定）。
- **共通部品化**: グラフ内スクロール型チャートの共有部品（AxisHeader・OutsideValueLabels・FixedTooltip・useChartWidth・定数）を`charts/scroll-bar-chart.tsx`に抽出し、皇帝ランキング・王朝別2チャートで共用。
- **スクロールバー**: `globals.css`で標準`scrollbar-width: thin`+`scrollbar-color: #c9bda8 transparent`（Safari向けに`::-webkit-scrollbar`フォールバック併記）。OS既定の灰色バーが宣紙色背景から浮く問題を解消。
- ナビの「今後追加予定」ブロックは撤去し全項目を有効リンク化。トップページに8セクションカード、aboutに親征/反乱/遷都/年齢の数え方説明を追記。

## メニュー・配色改善（2026-07-18・全統計ページ実装の直後）

### 遷都回数の宮廷イベントへの統合

単独ページ`/capital`（1セクションのみ）を廃止し、`/court-events#capital`のセクションとして統合した。メニューのトップレベル項目が1つ減り、「回数もの」の宮廷・朝廷イベントが1ページに揃う。ナビ・トップページカード・LAYOUT.mdメニュー構成案も同期済み（aboutの数え方説明は元の位置のまま）。

### メニュー挙動（`nav-menu.tsx`）

- **カテゴリはデフォルトで閉じる**。現在表示中のページが属するカテゴリだけ自動で開く（初期表示・ページ遷移後とも）。
- **カテゴリ見出し自体もリンク**（`NavCategory.href`を必須化し配下ページ先頭へ遷移）。開閉は右端のシェブロン（`AccordionTrigger`をアイコンのみで使用、`aria-label`付与）で行い、見出しクリック＝遷移、シェブロンクリック＝開閉と役割を分離。
- **手動の開閉はページ遷移をまたいで維持**する。実装は「最後に操作したときのpathname＋開いていた値」を1つのstateに持ち表示時に導出するderived state方式（`useEffect`での`setState`はeslint `react-hooks/set-state-in-effect`違反になるため不可）。
- 現在ページのカテゴリ見出し・表示中セクションのサブ項目は朱色で強調、`aria-current="page"`付与。shadcn Accordion既定の`[&_a]:underline`はナビでは打ち消す。

### 配色の補強（水墨文人の雰囲気は維持）

「全体的に色味が足りない」というフィードバックへの対応。地色・墨色はそのまま、以下を追加：

- **サイドバー・モバイルヘッダー・Sheetを生成り（`--sidebar` #ede7d8）に**して本文の宣紙色と面で区別
- **印章風ロゴ**: サイトタイトル横に朱地に白抜き「帝」の角印（`SiteMark`、`aria-hidden`）
- **見出しアクセント**: PageHeaderのh1・Sectionのh2・aboutのH2に朱の縦バー（印泥をイメージ、`rounded-full bg-seal`）
- **StatTile**: 数値を朱色化＋上辺に`border-t-seal/70`
- トップのセクションカードに`hover:border-seal/50`、フッターを`bg-secondary/60`の帯に

## ワイド画面の中央寄せとLighthouse計測（2026-07-18・メニュー・配色改善の直後）

16:9モニタ最大化時に右側の余白が目立つという指摘への対応と、品質計測の初回実施。

### 記事型ページの中央寄せ

- **トップ（概要ダッシュボード）**: コンテンツ列（`max-w-4xl`）を`mx-auto`で中央寄せ
- **/about**: 本文列を`mx-auto max-w-2xl`で中央寄せ。`PageHeader`に`contained`プロップを追加し、見出しも本文と同じ列幅・同じ中心に揃える（統計ページの見出しは従来どおり左寄せ・全幅）
- **フッター**: 内側の`max-w-2xl`を`mx-auto`で中央寄せ（全ページ共通）
- グラフ中心の統計ページは全幅を使うため対象外

### フッターの圧縮とGitHub誘導（同日追加）

- フッターの縦幅が広すぎる指摘→短い句を`flex-wrap`で「・」区切りに並べる1行構成（`py-3`）に圧縮。ワイド画面では1行に収まり、狭い画面では句単位で折り返す
- **データの誤りのご指摘・お問い合わせはGitHubのIssue（kotenbu135/emperor-stats/issues）に誘導**する文言とリンクをフッターに追加（外部リンクは`target="_blank"`。当初PR誘導で実装したがIssue誘導に訂正）

### 免責事項の追加（同日）

/aboutの末尾に`免責事項`セクション（`#disclaimer`）を追加。内容：①AI（大規模言語モデル）を活用して調査・構築しており制作者は歴史学の専門家ではない②史料解釈の誤りや現代の通説と異なる整理がありうる（優しい目で・指摘はGitHubのIssueへ）③正確性・完全性の不保証と利用による不利益・損害の免責④正史原文の確認に利用したGitHub公開コーパス2種（hunterhug/china-history・garychowcmu/daizhigev20＝殆知閣古代文献）への謝辞。PageHeaderとmetadataのdescriptionにも「免責事項」を追記。

### basePathの廃止（同日・ユーザーによる変更）

- カスタムドメイン `emperorstats.com`（ルート直下配信）を使うことになったため、`src/lib/base-path.ts` の `BASE_PATH` を `""` に変更（next.config.tsの`basePath`と肖像画URLの単一情報源）。ローカルは `http://localhost:3000/`（`/emperor-stats`プレフィックスなし）
- **教訓**: basePath変更後は旧`.next`キャッシュが残っているとdevサーバーでReactのハイドレーションが静かに失敗する（コンソールエラーなしで画像404・フィルタ無反応）。`rm -rf .next`してからdevサーバーを再起動すること

### 品質計測の結果（初回ベースライン）

- **コンソール**: 全9ページ＋詳細ダイアログ操作でエラー・警告0件（dev mode）
- **Lighthouse**（本番ビルドをdesktop presetで計測）: Best Practices全ページ100
  - トップ 99（mobile 98）／ /emperors 76（LCP 6.0s＝遅延読み込み画像がLCP要素）／ /reign 67（TBT 4.2s）／ /court-events 62（TBT 10.0s）
  - **既知の課題（未対応）**: ①ランキング系ページはNivoが364本×セクション数のSVGを初回に全描画するためTBTが大きい（対策候補: 画面外チャートの遅延マウント等）②/emperorsは最初の数枚を`loading="eager"`にするとLCP改善見込み ③a11y: shadcn `SelectTrigger`にアクセシブルネームなし（button-name）、Nivoの`role="img"`なSVGにアクセシブルネームなし（svg-img-alt）
  - 計測方法: `out/`を`/tmp/lhroot/emperor-stats`シンボリックリンク経由で`npx serve`し、WSL内Chrome（`CHROME_PATH=/usr/bin/google-chrome`、`--headless=new`）で`npx lighthouse`

### 全9ページ計測・根本原因の特定（2026-07-18・同日追加）

初回ベースラインは4ページのみだったため、全9ページ（`/` `/about` `/ages` `/court-events` `/death-accession` `/dynasties` `/emperors` `/military` `/reign`）を本番ビルド・desktop presetで計測し、各スコアの根本原因をLighthouse監査データ（`largest-contentful-paint-element`・`mainthread-work-breakdown`・`cls-culprits-insight`・a11y `details.items`）から特定した。

**計測手順の訂正**: `npx serve <root> -l 3010`の`<root>`は`out/`ディレクトリそのものにすること。シンボリックリンク経由で`/emperor-stats`のようなプレフィックス配下に置くと、`BASE_PATH=""`によりHTML内のアセット参照がルート相対（`/_next/...`）になっているため全アセットが404し、「TBT 0ms・perf 100」という偽の好結果が出る（JS/CSSが読み込まれず空HTMLしか計測できていないだけ）。プレフィックスなしで直接`out/`をルート配信すること。

**スコアサマリ**（perf / a11y / bp / seo、bp・seoは全ページ100）:

| ページ | perf | a11y | LCP | TBT | CLS |
|---|---|---|---|---|---|
| `/` | 99 | 100 | 0.8s | 0ms | 0 |
| `/about` | 100 | 100 | 0.7s | 0ms | 0 |
| `/emperors` | 76 | 94 | 6.0s | 0ms | 0 |
| `/reign` | 67 | 93 | 0.9s | 4,070ms | 0.003 |
| `/ages` | 67 | 93 | 1.0s | 4,590ms | 0.001 |
| `/death-accession` | 79 | 93 | 0.8s | 310ms | **0.17** |
| `/dynasties` | 64 | 93 | 1.0s | 6,740ms | 0.001 |
| `/military` | 65 | 93 | 0.9s | 6,700ms | 0.003 |
| `/court-events` | 63 | 93 | 0.9s | 9,300ms | 0.006 |

**根本原因を特定**:

1. **TBT（チャート系6ページ共通）**: `mainthread-work-breakdown`でscriptEvaluationが支配的（court-eventsで9.4s）。`bootup-time`で単一チャンク`0a68mj1bg-len.js`（転送71KB・展開227KB、Nivo/d3本体と思われる）がほぼ全時間を占有。364人ぶんのSVGバーを画面外含め初回に全描画する設計（既存方針「グラフ内スクロールで全件表示」）が原因で、コード量ではなく実行時のレイアウト計算コストが支配的。対策候補は画面外チャートの遅延マウント・仮想化。
2. **LCP（/emperorsのみ）**: `lcp-discovery-insight`で確認、LCP要素は先頭カードの肖像画`<img loading="lazy">`（始皇帝）。lazy属性がdiscoverabilityを妨げ、シミュレーション上6.0sに悪化。ファーストビュー数枚を`loading="eager"`または`priority`にすれば改善見込み（既知の申し送り事項の裏付け）。
3. **CLS 0.17（/death-accessionのみ・新規発見）**: `cls-culprits-insight`で`section#accession`（即位経路別分布チャート）が0.168を占有。チャートが非同期マウントで後から挿入され、周囲のレイアウトを押し出している。他の統計ページはCLSがほぼ0のため、このセクション固有の高さ予約不足（アスペクト比のCSS未設定等）が疑われる。**未対応・要調査**。
4. **a11y 93〜94（チャート系ページ共通）**: 既知の`button-name`（shadcn `SelectTrigger`）・`svg-img-alt`（Nivo `role="img"` SVG）が`details.items`で実際に該当要素を確認できた。`/emperors`はSelectがあるがNivoチャートがないためbutton-nameのみで94。

**未対応の申し送り更新**: ①②③（Nivo TBT・/emperors LCP・a11y2件）に加え、④`/death-accession`のCLS 0.17（section#accession）を追加。着手はユーザー指示があってから。

## Lighthouse改善の実装（2026-07-18・全9ページ計測の直後）

上記「全9ページ計測」で特定した4課題をすべて実装した。

### 実装内容

1. **TBT対策（2段構え）**
   - **遅延マウント**: `src/components/lazy-mount.tsx`（IntersectionObserver・rootMargin 400px・マウント前は`estimatedHeight`のプレースホルダー）。5つの統計ページの全チャートを`<LazyMount>`で包み、画面外チャートは近づくまでマウントしない。プレースホルダー高さの多少のずれは、マウントがビューポート外で起きるためCLSに影響しない
   - **行ウィンドウイング**: `scroll-bar-chart.tsx`に`useWindowedRows`を追加。364行を全件SVG描画せず、可視範囲±オーバースキャン12行だけをNivoに渡す。行ピッチが`ROW_HEIGHT`固定なので、スライスを`top = start×ROW_HEIGHT`の絶対配置にすれば全件描画とピクセル単位で一致する。`RankingBarChart`・`DynastyAvgReignChart`・`DynastyDeathCauseChart`に適用（初回描画が364本→34本）。全行が範囲内に収まる少件数時は従来と同じ全高レンダリングで見た目を変えない
2. **LCP対策（/emperors）**: `EmperorGrid`の先頭12カード（最大6カラム×2行）の肖像を`next/image`の`priority`指定。`loading="lazy"`が外れ`<link rel="preload" as="image">`が出力される
3. **CLS対策（/death-accession ほか）**: 原因はトレース解析で判明——「並び順」Selectが自動幅のため、Webフォント読み込みで幅が変わりフィルタ行の折り返し位置がずれて下のコンテンツを24px押し下げていた。`SelectTrigger`を`w-[180px]`固定幅に（ChartFilterControls・GroupFilterControls）。加えて`html { scrollbar-gutter: stable }`で読み込み途中の縦スクロールバー出現による横シフトも防止
4. **a11y対策**: (a) `role=combobox`のボタンは中身のテキストがアクセシブルネームにならないため、全`SelectTrigger`に`aria-label`を明示（button-name対応）。(b) Nivoの`role="img"`なSVGにアクセシブルネームを付与——barチャートは`ariaLabel`プロップ、`@nivo/pie`は同プロップ未対応のためコンテナ`div`に`role="img"`+`aria-label`を付けSVG側を`role="presentation"`に（svg-img-alt対応）

### 改善結果（本番ビルド・desktop preset）

| ページ | perf | a11y | 主要メトリクス |
|---|---|---|---|
| `/` | 99→99 | 100 | 変化なし |
| `/about` | 100→100 | 100 | 変化なし |
| `/emperors` | 76→**98** | 94→**100** | LCP 6.0s→0.8s |
| `/reign` | 67→**97** | 93→**100** | TBT 4,070→140ms |
| `/ages` | 67→**79** | 93→**100** | TBT 4,590→450ms |
| `/death-accession` | 79→**99** | 93→**100** | CLS 0.17→0.003 |
| `/dynasties` | 64→**66** | 93→**100** | TBT 6,740→1,730ms |
| `/military` | 65→**79** | 93→**100** | TBT 6,700→450ms |
| `/court-events` | 63→**83** | 93→**100** | TBT 9,300→370ms |

Best Practices・SEOは全ページ100を維持。**a11yは全9ページ100**を達成。

### 計測環境に関する重要な知見（WSL2）

チャートページで残るLighthouse TBT（370〜1,730ms）は**計測環境による増幅を含む**。トレースの`tdur`（実CPU時間）検証で、同一タスクが手動ヘッドレスChromeでは283msなのにLighthouse実行下では5,053msと約18倍膨らむことを確認した（プリエンプションではなく実CPU消費。トレースカテゴリ・デバイスエミュレーション単体では再現せず、原因は未特定）。実ブラウザのLong Task実測（PerformanceObserver）では改善後、全ページで合計ブロッキング100ms前後・最長タスク140ms以下であり、実ユーザー体感のTBTはほぼ解消済み。dynastiesの見かけ上のTBT 1,730msも実測では合計89ms。今後この環境でTBTを評価する際は、Lighthouse絶対値ではなく相対比較とLong Task実測を併用すること。

### 動作検証（ヘッドレスChrome CDP実測）

- 遅延マウント: /court-events初期2チャート→全ページスクロール後5チャート
- ウィンドウイング: 初期34本描画・内部スクロール最下部で332位まで到達・スライス位置と順位ラベルの整合を確認・並び順変更で1位側へリセット
- コンソールエラー0件・スクリーンショット目視で従来と同一の見た目

## 実機Lighthouse timespanレポートに基づく改善（2026-07-18・Lighthouse改善の直後）

ユーザーがWindows実機Chromeで採取したLighthouse **timespanモード**（33秒の実操作: perf 0.28 / TBT 5,330ms / CLS 0.205）のレポートを解析して実装した改善。timespanはFCP/LCPを持たず、スコアはほぼTBTとCLSで決まる。

### 原因分析（playwright-core + ヘッドレスChromeで再現）

- **CLS 0.205の正体はグラフ内スクロール**: ウィンドウイングのスライスdivを`top`で再配置していたため、`top`書き換えのたびにlayout-shiftとして計上されていた（中身の見た目は1pxも動いていなくても、要素の矩形移動として扱われる）。ローカル再現ではグラフ内スクロールだけでCLS 2.2を記録。ページスクロール・SPA遷移では計上ゼロで、ハードロード計測では発見できない。**スクロールはhadRecentInputの除外対象にならない**ことも要因。
- **TBT 5,330msの主因は2つ**: (1) 旧`useWindowedRows`はスクロール毎フレーム`setScrollTop`していたため、ウィンドウが変わらなくてもチャートコンポーネント全体（364件のソート＋Nivo再レンダリング）が毎フレーム走っていた。(2) グラフ内スクロール中はマウスがチャート上にあるため、バーがカーソル下を通過するたびに`onMouseEnter`→`setHoverTip`→全体再レンダリングが連発していた。

### 実装した対策

- **スライス再配置を`top`→`transform: translateY()`に変更**（3チャート共通）: transformはlayout-shiftの計上対象外。修正後のグラフ内スクロールCLSは実測0.0000。
- **`useWindowedRows`のstateを「量子化済み行範囲」に変更**: `STEP_ROWS=8`の倍数境界をまたいだときだけ`setRange`し、それ以外はオブジェクト同一性でReactの再レンダリングを完全にスキップ。境界を越えないスクロールではDOM変異ゼロを確認済み。行数変化（フィルタ）への追従は`rowCount`依存のeffect＋レンダリング時クランプで担保。
- **スクロール直後150msはホバー無視**（`hoverAllowed()`）: スクロール中のホバー再レンダリング連発を止める。ツールチップがスクロール中にチラつくUX問題も同時に解消。停止後は通常どおり表示される（検証済み）。
- **肖像画webpの再圧縮**: `card-preview/`153枚をquality 65で再圧縮し合計5.3MB→2.9MB（-45%）。Lighthouseのimage-delivery指摘（791KiB）に対応。表示サイズは最大212×283px（グリッド）なので360×480のままで画質劣化は実用上見えない。

### 対応しない（できない）項目

- **cache-insight（985KiB・キャッシュ寿命10分）**: GitHub Pagesは`Cache-Control: max-age=600`固定でカスタムヘッダー不可。解消するにはCloudflare等のCDNを前段に置くインフラ変更が必要で、リポジトリ内では対応不能。
- **timespanモードのCLSにはSPA遷移由来の成分が含まれうる**（コンテンツ差し替えで既存要素が動く分）。ナビゲーションモードの計測では発生しない。

### 計測上の教訓

- timespanレポートは`gatherMode`を必ず確認する。navigationと混同するとFCP/LCP不在・TBTが操作時間全体の合算であることを見誤る。
- このWSL2環境のLong Task計測（CPU 6倍スロットル）は実行ごとのばらつきが大きく（同一ビルドで2,670↔7,261ms）、A/B比較には**DOM変異数（MutationObserver）のような決定的指標**を併用する。
- 再現ハーネスは`playwright-core`＋`executablePath=/usr/bin/google-chrome`で構築できる（ブラウザDLなし・`/tmp/clsprobe/`に一式）。layout-shiftのsources付き観測・CPUスロットルはCDP経由で可能。

## 実機Lighthouse timespanレポート第2弾に基づく改善（2026-07-19）

前回改善のデプロイ後にユーザーがWindows実機Chromeで採取した2本目のtimespanレポート（97秒の実操作: perf 0 / TBT 18,490ms / CLS 1.136 / INP 200ms）を解析して実装した改善。

### 原因分析

- **レポートのタイムライン復元**: network-requestsの時系列から、チャンク`185oq...js`（/dynasties専用）が74.1秒に読み込まれ、その直後75〜93秒に400〜600msのLong Taskが集中していた。**バーストの発生場所は/dynastiesページ**で、ホバー・フィルタ操作が引き金。
- **TBT 18.5秒の主因はホバーごとの全体再レンダリング**: `hoverTip`をチャートコンポーネントのstateに持っていたため、バー／積み上げセグメントがカーソル下を通過するたびに`setHoverTip`→Nivoチャート全体（数百SVGノード）の再レンダリングが走っていた。前回対策（`hoverAllowed`）はスクロール中のみの抑制で、**静止状態でマウスを動かすだけのホバーは対象外**だった。死因積み上げチャートは1行に最大8セグメントあるため特に悪化しやすい。
- **CLS 1.136は「クリック起因だが遅すぎたレイアウトシフト」**: フィルタ・集計単位切替によるチャート高さ変化のシフトは、通常はhadRecentInput（入力後500ms）でCLSから除外される。しかし実機ではレンダリングが400〜600msかかり、**シフトの発生が除外ウィンドウの外にずれてCLSに計上**されていた。同値のシフトがペアで並ぶのは切替→戻すの往復。加えて`FixedTooltip`の`left/top`書き換えは、fixed配置でも1回あたり0.0002〜0.002のlayout-shiftとして計上される（ローカル実測で確認）。
- ローカル（同一マシンのWindows Chrome・localhost配信）では同じ操作でLong Task合計100ms前後にしかならない。実機レポートとの差はLighthouse計測アタッチ＋拡張機能（広告ブロッカーのcontent scriptがforced reflow 100msを記録）による増幅で、**増幅されても破綻しないだけの根本的な再レンダリング削減が必要**という結論。

### 実装した対策

- **ホバーツールチップ状態のチャート本体からの分離**（`useTipOutlet` + `TipOutlet`、scroll-bar-chart.tsxに共通実装）: ツールチップの表示状態は小さな`TipOutlet`子コンポーネントだけが持ち、チャート側は安定参照の`setTip()`を呼ぶだけ。ホバーではNivoチャートが一切再レンダリングされなくなった（ranking-bar-chart / dynasty-avg-reign-chart / dynasty-death-cause-chartの3チャートに適用）。
- **`FixedTooltip`の位置指定を`left/top`→`transform: translate()`に変更**: transformはlayout-shiftの計上対象外。バー間ホバーでのCLS積み上げ（20ホバーで0.0088）が実測0になった。
- **「表で見る」開閉の分離**（`TableDetails`）: 開閉stateを自前で持つ共通コンポーネントにし、toggleで親チャート（Nivo含む）が再レンダリングされないようにした（棒3チャート＋円グラフに適用）。
- **/emperorsのカードmemo化＋検索のdeferred化**: カード1枚を`memo`化した`EmperorCard`に切り出し、検索語は`useDeferredValue`経由でフィルタに反映。1キー入力ごとの364カード再レンダリングがキー入力をブロックしなくなり、フィルタ変更時も変化のないカードの再レンダリングをスキップする。

### 検証（同一操作フローのA/B計測）

lighthouse@13.4.0のuser flow API（timespan）＋puppeteer-coreで実機レポートの操作（/reignホバー・スクロール・並び順切替 → /dynasties両チャートのホバー・集計単位切替 → /emperors検索・スクロール、計約40秒）を自動再現し、修正前後のビルドに同一フローを実行した（`/tmp/lh-flow/`、WSL2なので絶対値は増幅込み・相対比較が目的）:

| 指標 | 修正前 | 修正後 | 変化 |
|------|-------|-------|------|
| TBT | 55,128ms | 9,096ms | **-83%** |
| main-thread work | 66.8秒 | 13.7秒 | -80% |
| INP | 219ms | 41ms | -81% |
| CLS | 0.0057 | 0.0011 | -81% |

修正前はホバー中ずっと780ms級のLong Taskが連続していたのに対し、修正後の残りはページロード＋集計単位切替（正当な再レンダリング）のみ。機能面はブラウザ実操作で確認済み（ツールチップ表示・フィルタ・検索・詳細ダイアログ・表で見る、いずれも正常）。

### 教訓

- ホバーのような高頻度イベントでチャートを含むコンポーネントのstateを更新してはならない。**表示が小さい・安いものはstateごと小さいコンポーネントに隔離する**のが原則（`useTipOutlet`を今後の新チャートでも必ず使う）。
- 「クリック起因だからCLS除外」は**500ms以内にレンダリングが終わる場合だけ**成立する。重い再レンダリングはTBTだけでなくCLSにも化ける。
- timespanレポートの発生ページはnetwork-requestsの時系列（ページ専用チャンク・RSC payloadの読み込み時刻）から復元できる。

## チャート横断性改善 第1弾（2026-07-20）

「棒グラフで気になる皇帝を見つけても、ホバーにグラフから読み取れる以上の情報が出ない」「バーが短い皇帝はホバー自体が難しい」というフィードバックに基づく改善。検討時の全体案は、(1)行全体ヒット領域・(2)クリックで全項目詳細ダイアログ・(3)ダイアログに全指標順位（第2弾）・(4)ホバー要約の拡充・(5)deep-link/個別ページ（将来）の5点で、今回は(1)(2)(4)を実装した。

### 実装内容

- **行全体のヒット領域（`RowOverlay`、scroll-bar-chart.tsxに共通実装）**: Nivoのバー矩形でなく、行の全幅（ラベル＋グラフ領域）を覆う透明要素でホバー・クリックを受ける。在位「1日未満」の完顔承麟のようにバー幅0pxの皇帝でも行のどこでも操作できる。ホバー中は行を`bg-seal/5`で薄くハイライト。`onSelect`を渡すと`button`要素（aria-label付き・キーボード操作可）、省略時はホバー専用の`div`（aria-hidden）になる。ranking-bar-chart（クリック対応）と dynasty-avg-reign-chart（ホバーのみ）に適用。死因積み上げチャートはセグメント単位のホバー情報が本体のため行オーバーレイ化せず据え置き。
- **共有詳細ダイアログ（`emperor-detail-dialog.tsx` + `portrait.tsx`）**: /emperors のカード詳細ダイアログ（全12項目＋肖像/モノグラム）を emperor-grid.tsx から共有コンポーネントに切り出し、ランキング棒グラフの行クリックと「表で見る」の皇帝名クリック（下線リンク風button）から開けるようにした。どの統計ページからも1クリックで人物の横断プロフィールに到達できる。タッチ端末（ホバー不可）でもチャートから情報に到達できるようになった。
- **ホバーツールチップの拡充（emperor-tooltip.tsx）**: 指標値の下に補足行（在位期間・死因・即位経路・没年齢。いま見ている指標と重複する項目は省く）と「クリックで全項目を表示」ヒントを追加。全項目はダイアログに任せ、ホバーは要約に留める。

### パフォーマンス上の設計（既存制約の踏襲）

- ダイアログの開閉stateもチャート本体に持たない: `useDetailOutlet`（emperor-detail-dialog.tsx）が`useTipOutlet`と同じsetterRef方式で状態を`DetailOutlet`子コンポーネントに隔離し、チャート側は安定参照の`openDetail()`を呼ぶだけ。
- `RowOverlay`のkeyは行idでなく**ウィンドウ内index**を使う。ウィンドウがSTEP_ROWS境界をまたいでも各DOMノードの`top`が変わらず（中身のハンドラ・aria-labelだけ差し替わる）、位置の書き換えによるlayout-shiftの懸念がない。行位置はNivoの`margin.top`と揃える必要があるため`MARGIN_TOP`定数を共有。
- オーバーレイがSVGの上を覆うため、Nivo側の`onMouseEnter`/`onMouseLeave`は不要になり削除（イベントがSVGに届かなくなるため残すと死にコード）。`hoverAllowed()`によるスクロール直後のホバー抑制はオーバーレイ側で継続。

### 検証

dev サーバー＋ブラウザ実操作で確認: ラベル領域ホバーでのツールチップ表示・行ハイライト、バー幅0行（末帝・金）の操作、ウィンドウイング深部（350位前後）での行とツールチップの一致、行クリック→ダイアログ、表の名前クリック→ダイアログ、/dynasties の行ホバー、コンソールエラーなし。`tsc --noEmit`・`eslint`・`next build` 通過。

## チャート横断性改善 第2弾: 詳細ダイアログの全指標順位表示（2026-07-20）

第1弾の残バックログ（全体案の(3)）。詳細ダイアログの各指標に「全皇帝の中で何位か」を添え、どのページから開いても『改元 14回（332名中1位タイ）』のようにその皇帝の位置づけが分かるようにした。静的サイトなので順位はすべてビルド時計算で済む。

### 実装内容

- **ビルド時順位計算（emperors.ts）**: `computeRanks()` が全364名を対象に11指標（在位期間・回数系8種・即位時年齢・没年齢）の順位を計算し、`EmperorRecord.ranks`（`Record<RankingMetricKey, MetricRank | null>`）として全レコードに載せる。順位の定義はランキングチャートと完全に一致させる: 回数系は0回を対象外（チャートの0回省略と同じ）、年齢は判明者のみ、即位時年齢だけ若い順（`RANK_DIRECTIONS`）。対象外は`null`で、ダイアログでは順位行を出さない。在位期間の順位付けは`reignYears`（浮動小数）でなく`reignApproxDays`（整数）で行う（同値判定のため。単調変換なので順位は同じ）。
- **同値は同順位（competition ranking、1, 2, 2, 4, …）**: 回数系は同値が大量にあるため（改元14回の1位タイが2名など）、従来の「ソート順の連番」では同値内の順序が恣意的になる。ダイアログ・チャートとも同値同順位に統一し、`MetricRank.tied` で「タイ」を表示する。**ranking-bar-chart.tsx の行ラベル・表ビューの順位も同方式に変更**したので、フィルタなしのときチャートの順位とダイアログの順位は必ず一致する（王朝で絞り込むとチャートは絞り込み内順位・ダイアログは全体順位になるが、ダイアログ側は「332名中」と分母を明示しているので区別がつく）。
- **ダイアログの表示（emperor-detail-dialog.tsx）**: 在位期間・即位時年齢・没年齢は値の下に小さく順位行（`DetailRow`の`sub`）。年齢は方向が自明でないため「171名中・若い順16位タイ」「268名中・長寿順17位タイ」のように方向ラベルを添える。回数系グリッドは各セルの回数の下に「332名中142位タイ」を表示（0回は順位なし）。末尾に数え方の注記1行（同数同順位・回数は1回以上・年齢は判明者のみ）。
- **回数系グリッドを4列→2列に変更**: 順位行が付いたことで`sm:grid-cols-4`ではセル幅約98pxに「332名中142位タイ」が収まらず、ラベル「改元」まで縦に折り返した。2列固定（セル幅約220px）にし、順位行は`text-[10px]`。

### 検証

`jq`で独立に算出した期待値（在位1位=康熙帝22597日・改元対象332名・改元14回2名・即位年齢判明171名・1歳2名）とブラウザ表示を突き合わせて一致を確認。チャート側の同値同順位表示（改元: 1, 1, 3, 3, 5, 6×4, 10×5…）、並び順切り替え（年長順⇔若い順）で順位が固定されること、武則天の即位時年齢「171名中・若い順171位」（最年長即位）、0回・年齢不明で順位行が出ないこと、/emperors カード経由のダイアログも同表示になることを実操作で確認。`tsc --noEmit`・`eslint`・`next build` 通過、コンソールエラーなし。残る将来案は deep-link（`/emperors?id=xxx`）と皇帝個別ページ。

## 品質担保の方針（2026-07-17）

実装着手時に導入する開発フロー・ツール。

- **dataviz skill の活用**: 本サイトはグラフ・KPIカード・統計テーブルが中心のため、チャート／カラー／レイアウトを新規作成する際は必ず dataviz skill を通す。配色は上記「王朝別カテゴリカルパレット」同様、`scripts/validate_palette.js` でCVD安全性を検証してから確定する。人物ごとに個別実装するとグラフごとに配色・体裁がばらつくリスクがあるため、一貫性担保の主手段と位置づける。dataviz skillがこのドキュメントでアンチパターンを見つけた場合はdataviz skillの推奨に従う。
- **Storybook + Chromatic（ビジュアルリグレッションテスト）**: 皇帝カード（グリッド表示）・ランキング棒グラフ・タイムラインなど再利用コンポーネントが多い設計のため、Storybookでコンポーネント単位に切り出し、Chromaticでスクリーンショット差分を検知する。特に肖像画プレースホルダー（153名分の実画像／211名分のモノグラム）が混在するカードは、実装変更時の意図しない見た目崩れが起きやすいため優先的にカバーする。

## 関連ドキュメント

- [../PROJECT_STATUS.md](../PROJECT_STATUS.md) — データ調査の進捗・サイト実装着手条件
- [../../data/schema/EMPERORS_SCHEMA.md](../../data/schema/EMPERORS_SCHEMA.md) — 基本スキーマ
- [../../data/schema/DEATH_CAUSE_SCHEMA.md](../../data/schema/DEATH_CAUSE_SCHEMA.md) — 死因スキーマ
- [../../data/schema/ADDITIONAL_SCHEMA.md](../../data/schema/ADDITIONAL_SCHEMA.md) — その他の追加スキーマ
