# サイト実装記録（2026-07-18〜22・2026-07-27 SEO 追補）

雛形作成から MVP・全統計ページ・SEO・皇帝個別ページ・/kinship 試作までの、実装ごとの決定事項と教訓の時系列記録。
末尾の「SEO 監査 Phase 1」節だけは 2026-07-27 の追記で、同日のデザイン再構成（REDESIGN_2026-07.md）ではなく
本ファイル内の「SEO対策の徹底実装」「読み取れること」の各節を直接改めるものなので、ここに置いている。
方針・規範は [LAYOUT.md](./LAYOUT.md)、性能・計測は [PERFORMANCE.md](./PERFORMANCE.md)、
2026-07-27 のデザイン再構成は [REDESIGN_2026-07.md](./REDESIGN_2026-07.md) にある
（2026-07-27、LAYOUT.md が941行に肥大したため分離）。

## 雛形作成（2026-07-18）

`site/`ディレクトリに`create-next-app`（TypeScript・Tailwind CSS v4・App Router・`src/`構成）でNext.js 16プロジェクトを作成。

- **静的書き出し設定**: `next.config.ts`で`output: 'export'`・`basePath: '/emperor-stats'`・`images.unoptimized: true`を設定済み（GitHub Pagesプロジェクトページ向け）。`npm run build`で`out/`にbasePath付きのアセットパスが出力されることを確認済み。
- **shadcn/ui**: `npx shadcn@latest init`（`nova`プリセット＝Lucideアイコン、Radixベース）で初期化し、`Accordion`/`Sheet`（オフキャンバス代わり）/`Card`/`Table`/`Button`/`Badge`/`Separator`を導入済み。
- **フォント**: `next/font/google`で見出し=`Noto_Serif_JP`、本文/UI=`Noto_Sans_JP`を設定（`--font-heading`/`--font-sans`）。中国語繁体字/簡体字表記はサイト上で使わない方針のためSCフォントは導入せず。
- **配色**: `src/app/globals.css`の`:root`に水墨文人パレット（background `#F5F1E8`・foreground `#3A3530`・primary `#4A4038`・border `#DDD5C7`）を反映し、朱印アクセント用に`--seal`/`--color-seal`トークンを独自追加（`#A6321C`、`bg-seal text-seal-foreground`で使用）。ダークモードは方針通り未実装（`.dark`定義なし）。shadcn初期化時に入っていた`--chart-1`〜`5`（王朝別カテゴリカルパレット用の予約トークン・暫定グレースケール）は、2026-07-27に王朝色を`--series-N`＋`--kinship-minor`で確定させたため役目を終え、削除した。
- **Nivo**: `@nivo/core`・`bar`・`pie`・`line`・`scatterplot`をインストール済み（LAYOUT.md記載のグラフ種に対応）。
- **Stitch MCP不使用の経緯**: 当初`google-labs-code/stitch-skills`（Google Stitch AIデザイン生成）の利用を検討したが、Stitch MCPサーバー側のツールスキーマ不具合（`can't resolve reference #/$defs/ScreenInstance`）で接続不可のため、手動での`create-next-app`+shadcn/uiによる雛形作成に切り替えた。`stitch-build:shadcn-ui`スキル（MCP不要）はセットアップ手順のガイダンスとして活用。MCP不具合が解消すれば`stitch::generate-design`等でのデザイン生成を後日試す余地あり。

## MVPページ実装（2026-07-18）

在位データ・死因・即位経路・宮廷イベントの3ページを実装し、メニュー・グラフ・データ連携までMVP範囲が動作する状態になった。

- **データ連携**: `site/src/lib/emperors.ts`が`fs.readFileSync(path.join(process.cwd(), "..", "data", "emperors.json"))`でビルド時に`data/emperors.json`を読み込み、在位年数ランキング・死因/即位経路の分布・宮廷イベント4種のランキングを集計する関数群を提供する。**Turbopackは`site/`の外側のファイルを静的import（`import x from "../../../data/emperors.json"`）で解決できずビルドエラーになるため、`fs`経由の読み込みに統一した**（次にビルドエラーになったら真っ先にこの制約を疑うこと）。
- **メニュー**: `site/src/lib/nav-data.ts`にLAYOUT.mdのメニュー構成をそのままデータ化。実装済み（在位データ/死因・即位/宮廷イベント）は有効リンク、未実装項目（皇帝一覧/軍事/遷都/年齢/王朝横断）は「準備中」バッジ付きで無効表示。`site/src/components/layout/site-shell.tsx`がPC固定サイドバー（`md:`以上で表示）とスマホ用Sheetオフキャンバス（ハンバーガーボタン）を切り替える。
- **グラフ**: dataviz skillの手順に従い、既定の検証済み8色カテゴリカルパレット（`references/palette.md`のデフォルト）をsurface `#F5F1E8`に対し`validate_palette.js`で検証（全項目PASS、4スロットはコントラストWARNのため凡例+直接ラベル表示で緩和）。`globals.css`に`--series-1`〜`8`として追加。ランキング棒グラフ（在位年数・宮廷イベント4種）は当初、単一エンティティのnominal categoricalとして単色（実装は`--seal`の朱・凡例なし）、死因・即位経路の円グラフは8色カテゴリカルパレット＋凡例＋直接ラベルで実装した。**2026-07-27に、ランキング棒は王朝色・全チャートの塗りは淡彩化へ変更**（[REDESIGN_2026-07.md](./REDESIGN_2026-07.md)「王朝色システムとチャートの淡彩化」節）。
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
- **王朝・時代で見る**（`/dynasties`）: 平均在位年数（皇帝数をラベル併記）と死因の内訳（検証済み8色死因パレットの積み上げ横棒、`enableTotals`で合計表示）。**集計単位トグル（王朝別/時代別）**と時代順ソートを装備。実装当初は平均在位年数が朱の単一系列、積み上げのセグメント間はsurface色`borderWidth:1`で区切っていたが、**2026-07-27に平均在位年数は1棒＝1王朝の王朝色（時代別集計時のみ`--series-1`単色にフォールバック）、積み上げのセグメント区切りは各カテゴリ色の82%濃度の輪郭に変更**（[REDESIGN_2026-07.md](./REDESIGN_2026-07.md)「王朝色システムとチャートの淡彩化」節）。この画面は上下2チャートが同じ色の言語になっているかを見る基準面になる。
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

## 通史年表（タイムライン）の設計・実装（2026-07-20）

「時代の流れを視覚的にわかるようにしたい」という要望を受け、`/timeline`（通史年表）ページを設計し同日実装した。詳細は **[TIMELINE.md](./TIMELINE.md)** に分離（本ドキュメントに散在していた「通史タイムライン」「在位期間ガントチャート」「王朝存続期間タイムライン」の3構想を統合する位置づけ。実装時の設計変更も同ファイルの「実装記録」節に記録）。要点: 時代帯・王朝帯・皇帝セグメントの3層構造、王朝帯は収録皇帝の在位カバレッジの合併として描画（帯内ギャップ7王朝は点線接続）、レーンは正統/非正統の2ブロック分離でlane 0に本流が連なる（計10レーン）、皇帝不在の4期間（楚漢戦争期・王莽居摂期・民国期2区間）を斜線ハッチで明示、離散3段ズーム＋ミニマップ、描画はNivoでなくdiv絶対配置の自前実装（ウィンドウイング不要）。ナビのトップレベル「通史年表」とトップページのセクションカードも追加。

## 皇帝個別ページ（deep-link）と年表キーボード操作（2026-07-20）

チャート横断性改善で残っていた将来案（deep-link・皇帝個別ページ）と、通史年表実装時に将来案とした年表のキーボードナビをまとめて実装した。これでサイト実装の既知バックログはすべて解消。

### 皇帝個別ページ `/emperors/[id]/`（deep-linkはこの形で実装）

- 当初案の `/emperors?id=xxx`（クエリで詳細ダイアログを開く）は**採用せず**、`generateStaticParams` で全365名分を静的書き出しする個別ページを deep-link の実体とした。理由: (1) 静的ページの方が共有リンク・SEO・OGPの器として素直、(2) `output: "export"` で `useSearchParams` を使うと Suspense 境界が必要になり、ダイアログ開閉だけのために /emperors 全体の構造が複雑化する。`dynamicParams = false` で列挙外idは404。
- **表示本体を `emperor-detail-body.tsx`（`EmperorDetailBody`・`dynastyContextLabel`）へ抽出**し、詳細ダイアログと個別ページで共用する。`"use client"` を付けない純粋な表示部品なので、ダイアログ経由ではクライアント、個別ページではサーバーで描画される。内容（全12項目+順位+注記）は両者で完全に同一。
- 個別ページの固有要素: `PageHeader`（contained・王朝＋在位期間のサブラベル）、収録順の前後皇帝ナビ、皇帝一覧へ戻る、about/通史年表への誘導。metadata の title/description も皇帝ごとに生成。
- **詳細ダイアログの末尾に「この皇帝の個別ページを開く（リンク共有用）」リンクを追加**。どのページのダイアログからでも共有可能なURLへ辿り着ける（これが deep-link の導線）。一覧カード・チャート行クリックの挙動は従来どおりダイアログ（ページ遷移させない）。

### 通史年表のキーボード操作（timeline-explorer.tsx）

- スクロールコンテナを `tabIndex=0`・`role="application"` にし、**左右キー＝同じレーンの皇帝を時代順に移動（帯の端では同レーンの前後の帯へ渡る。lane 0なら本流を通しで辿れる）、上下キー＝同時期に並立する最も近いレーンの王朝へ移動（同時期に重なる帯が無ければ移動しない）、Enter/Space＝全体ズームではその地点へ拡大・拡大/詳細ズームでは詳細ダイアログ、Escape＝解除**。マウスのクリック導線（全体→時代→皇帝）と同じ段階構造。
- フォーカスは `{bandIdx, segIdx}` のインデックスで保持し、リング（朱色の枠）の座標は描画時にズーム倍率から再計算する（ズーム切替後もそのまま追従）。フォーカス移動時はセグメントを画面内へスクロールし、ホバーと同じ `EmperorTooltip` をセグメント位置に表示する。
- **プログラムスクロールでツールチップが消える問題**: フォーカス移動での `scrollLeft` 書き換えも scroll イベントを発火させ、既存の「スクロール時は tip を消す」処理が直後にツールチップを消してしまう。`suppressTipClearRef` で1回分だけ抑制する。
- a11y: `aria-live="polite"` の sr-only 領域で選択中の皇帝名＋王朝を読み上げる。`role="application"` のラベルに操作方法を記載し、「表で見る」も引き続き代替導線として案内。役割を持ったので図本体の `role="img"` の aria-label から「キーボードでは表を参照」の文言を削除した。

### 検証

`tsc --noEmit`・`eslint`・`next build`（380ページ生成）通過。ヘッドレスChromeの実操作で確認: 個別ページの表示（太宗: 16項目・順位・前後ナビ 高祖⇔高宗）と前後リンク遷移、/emperors カード→ダイアログ→個別ページリンクの遷移（始皇帝）、年表の矢印キー移動（フォーカスリング+ツールチップ+読み上げ領域の更新: 朱全忠→朱友珪）、全体ズームでのEnter拡大、拡大ズームでのEnterダイアログ（末帝・朱友貞）、下キーでの並立王朝移動（後唐→遼）、コンソールエラー0件。

## 皇帝個別ページ・詳細ダイアログへのYouTube動画埋め込み（2026-07-20）

ユーザーが用意した`data/youtube-playlist.json`（中国史解説専門チャンネル「ゆっくり解説」の公開プレイリスト、527動画・タイトル/サムネイルURL/公開日）を各皇帝の動画紹介として埋め込みたいという要望を受けて実装した。GitHub Pages配信の静的サイトでもYouTube iframe埋め込み自体は問題なく可能（`next.config.ts`が`images: { unoptimized: true }`のため`next/image`のドメイン許可設定も不要）。

### マッチングデータ（`data/emperor-videos.json`）

- **CLAUDE.mdの「スクリプトによるデータの自動生成は禁止」原則に倣い、動画↔皇帝の対応付けも機械マッチのみで確定させず目視確認を経た**: 皇帝の諱・廟号・諡号・別名（`name`各フィールド）を動画タイトルへの文字列マッチで候補抽出（527動画中83動画・88候補ペアに絞り込み）→ 各候補のタイトルを1件ずつ確認し、動画の主役が皇帝本人であるものだけ採用。家臣・皇后・暗殺者・王朝史概説回など皇帝本人が主題でない動画（例:「劉邦家臣団」「暴君煬帝のヨメ　蕭皇后」）は除外し、逆に周王朝の厲王など時代違いの同名衝突による誤マッチ（前秦苻生「厲王」への誤爆）も除外した。結果、365名中40名・60動画リンクが確定（`data/emperor-videos.json`の`meta.method`に判定基準を記載）。
- データは`data/emperors.json`本体に混ぜず**別ファイルに分離**（動画メタデータは正史調査データと性質が異なるため）。`data/youtube-playlist.json`（ユーザー提供の生データ、リポジトリ直下から`data/`へ移動）と`data/emperor-videos.json`（`emperorId → videoId[]`のマッチング結果）の2ファイル構成。
- 新規収録皇帝や新規動画が追加された場合、このマッチング作業（候補抽出→目視確認）を再度行う必要がある（自動生成しない設計のため）。

### サイト側実装

- `emperors.ts`が`data/youtube-playlist.json`と`data/emperor-videos.json`をビルド時に`fs`で読み込み、`EmperorRecord.videos`（`EmperorVideo[]`・空配列もあり得る）として合成する。
- **クリック読み込み式のfacade実装（`youtube-embed.tsx`）**: YouTube公式iframeを最初から埋め込むと1本あたり数百KBのJSが自動で読み込まれ、363ページ×最大5本/皇帝という規模ではperfへの影響が大きい（`AGENTS.md`に記録済みの通りこのサイトはLighthouse perfに継続的に配慮している）。サムネイル画像＋再生ボタンのみを初期表示し、クリックした時だけ実iframe（`autoplay=1`）に差し替える方式にした。
- **表示本体は`emperor-detail-body.tsx`（`EmperorDetailBody`）に追加**し、皇帝個別ページ・詳細ダイアログ両方に自動反映（このサイトの既定パターンを踏襲）。動画が0本の皇帝（325名）はセクション自体を非表示にする。

### 検証

`tsc --noEmit`・`eslint`・`next build`（380ページ）通過。dev サーバー＋ブラウザ実操作で確認: 個別ページ（高帝＝劉邦、動画5本）でのサムネイル表示・クリック→iframe読み込み・自動再生開始、詳細ダイアログでも同一表示（スクロール内で正常表示）、動画0本の皇帝（恵帝）でセクション非表示。

### レイアウト調整+制作者表記（同日第2弾）

初版（`aspect-video` サムネイル2カラム＋グラデーション上にタイトル重ね）は、外部チャンネルの派手なサムネイル画像（大きな朱色文字入り）が2カラムで巨大表示され、サイトの水墨文人調と喧嘩する上、サムネイル内の文字とタイトル文字が重なって読みにくかった。以下に再設計:

- **行型リストのfacadeに変更**: 小サムネイル（`w-32 sm:w-40`）を左、タイトル（`line-clamp-2`）+「YouTube・チャンネル名」を右に置くカード行の縦積み。派手なサムネイルが小さく抑えられ、タイトルは画像の外で常に読める。クリックすると行が全幅の `aspect-video` iframe（autoplay）に置き換わる。
- **制作者表記の追加**: 動画は当サイトと無関係の外部チャンネル「鳥人間 中国史三昧」（`https://www.youtube.com/@c-history`・oEmbed APIでチャンネル名確認）の制作物であることを、(1) 関連動画セクション冒頭の注記（チャンネルへのリンク付き）、(2) `/about` の新設「関連動画について」節、の2箇所に明記。チャンネル名・URLは `site/src/lib/video-channel.ts` の `VIDEO_CHANNEL` 定数を単一情報源とし、`data/emperor-videos.json` の `meta.channel` にも記録（`EmperorDetailBody` は `"use client"` なしの純表示部品でビルド時データを持たないため、fs不要の定数モジュールに分離した）。
- **タイトルの定型プレフィックス除去**: 全動画に共通の「【ゆっくり解説】」はリスト表示では冗長なため、`emperors.ts` の `videoDisplayTitle` でビルド時に除去（チャンネル名を別途表記するため情報は失われない）。
- 検証: `tsc`・`eslint`・`next build` 通過。puppeteer-core（lighthouse同梱）実操作で、個別ページの行クリック→全幅iframe自動再生、詳細ダイアログ内の注記リンク（@c-history）と動画5行表示、コンソールエラー0件を確認。headless Chrome はウィンドウ幅約500px未満に縮まらないため390px撮影では全ページが右側見切れに見える（アーティファクト。狭幅検証は500pxで行う）。

## 細部UX改善4点（2026-07-20）

ユーザー指摘「ダイアログ開閉でレイアウトシフト」「動画があるとダイアログがスクロール必須」「個別ページは左右余白が多いのに縦長」「前後ボタンの位置がページごとに違い連打できない」を受けた修正。

- **ダイアログ開閉時の横ずれ解消（`globals.css`）**: Radix系ポップアップ（Dialog/Select）のスクロールロック（react-remove-scroll）は body に `margin-right: <スクロールバー幅> !important` を注入してバー消失分を補うが、本サイトは `html { scrollbar-gutter: stable }` で既にガターを確保しているため**二重補正**になり、開閉のたびにコンテンツが横に約10pxずれていた。`body[data-scroll-locked][data-scroll-locked] { margin-right: 0 !important; padding-right: 0 !important; }` と属性セレクタを重ねて詳細度でライブラリ注入スタイルに勝たせて打ち消した（ライブラリ側も `!important` のため詳細度勝負にする必要がある。`data-scroll-locked` は react-remove-scroll-bar が付与する属性）。
- **ダイアログの動画折りたたみ**: 動画持ち皇帝のダイアログは動画リスト分縦に伸びてスクロール必須だった。`EmperorDetailBody` に `wide` prop を追加し、ダイアログ（`wide=false`）では動画をネイティブ `details/summary`（既定閉・「関連動画（N本）」表記）にした。状態不要の details なら `"use client"` なしの共用部品でもそのまま使える。ダイアログを開いた直後の summary の枠は Radix の初期フォーカスリング（サイト共通 `outline-ring/50`）で意図通り。
- **個別ページの2カラム化**: 本文列を `max-w-2xl`→`max-w-4xl` に広げ（`PageHeader` に `containedWidth` prop 追加で見出し列も追随）、`wide=true` で lg 以上は基本情報（肖像 `w-36` に拡大+dl）と回数系 dl を左右2カラム、動画は `sm:grid-cols-2` グリッドに。ダイアログ側は `display: contents` ラッパーで従来の縦積みを維持。動画facadeは再生開始時に `sm:col-span-full` で全幅に広がる（グリッドセル幅の小さいプレイヤーを避ける）。ページ全高は光武帝（動画3本）で約1400px→1106px。
- **ページ送りの位置固定**: 前後ナビは本文末尾にあり、本文の長さ（動画有無等）で位置が毎ページ変わって連打できなかった。本文先頭右端（「皇帝一覧へ戻る」と同じ行）に固定サイズ（`size-8`）のアイコンボタンを新設。皇帝名は `title`/`aria-label` で提示し、名前付きリンクの nav は本文末尾に残した。端（最初/最後の皇帝）では同サイズの無効プレースホルダーを置いて位置を保つ。

検証: `tsc`・`eslint`・`next build` 通過。puppeteer 実測で、ダイアログ開閉前後の h1 の x 座標差 0px（修正前は約10px）・body の margin-right が 0px のまま・details 既定閉と開閉動作・lg 2カラム配置・隣接2ページ間で「次へ」ボタンの座標差 (0, 0)・コンソールエラー0件を確認。

## noteの個別ページ活用 第1弾: 経緯2節+出典+調査メモ（2026-07-20）

ユーザー要望「emperors.jsonのnoteがサイトに一切生かされていない。出典も乗せたい」を受けた第1弾（全体計画はリポジトリ直下 `task.md`。note の3層分類・出典の所在と穴の分析も同ファイルに記載）。

- **個別ページ（`/emperors/[id]`）限定で表示**: note 全文は総量約100万字あり、全統計ページのクライアント props に埋め込まれる `EmperorRecord` に足すとペイロードが数百KB膨らむ。個別ページは Server Component の静的書き出しでクライアント負荷ゼロのため、`emperors.ts` に個別ページ専用の `getEmperorNarrative(id)` を新設し、`EmperorRecord` には一切含めない構成にした。詳細ダイアログへの反映は第3弾（`public/emperor-notes/{id}.json` の lazy fetch）で行う予定。
- **表示部品は `emperor-narrative.tsx`（新規・`"use client"` なし）**: `EmperorDetailBody` の下に「即位の経緯」「死因の経緯」（lg 以上2カラム・note 原文ママ＋「出典: 旧唐書 巻一（高祖、武徳九年条）」形式。`source.note` があれば「補記:」で併記）→「復位の経緯」（復位者8名のみ、`reigns[].note` 全文を期間ラベル付きで）→「調査メモ（回数・年齢の数え方と判定根拠）」（`details` 折りたたみ・既定閉。回数系8指標の `count.note`＋`ages.note` を原文ママ掲載、調査プロセスの透明性担保）。共用部品 `EmperorDetailBody` には手を入れず、ダイアログ側の描画・ペイロードに影響しない。
- **Wikipedia 記事名風出典の暫定表示**: `deathCause.source.page` の28件（前漢初期など初期調査分）は正史巻名でなく Wikipedia 記事名（例: "恵帝 (漢)"）が入っている。巻・紀・伝等の字を含まない page を記事名とみなすヒューリスティック（`HISTORY_SOURCE_PATTERN`）で判別し、「Wikipedia日本語版記事「恵帝 (漢)」」と正直に表示する。正史出典への差し替えは task.md 第4弾（データ側追加調査）。
- 検証: `tsc`・`eslint`・`next build`（380ページ）通過。書き出し HTML で太宗（経緯2節＋出典複数巻併記＋調査メモ9項目）・恵帝（Wikipedia 表記）・宣統帝（復位の経緯2件）の表示を確認。

## noteの個別ページ活用 第2弾: 在位中の出来事年表（2026-07-20）

8指標（改元・大赦・立后・皇太子廃立・親征・反乱鎮圧・被反乱・遷都）の `events[]` 約5,600件を、個別ページの「在位中の出来事」節として日付順マージ表示した（task.md 第2弾）。

- **ビルド時マージ（`emperors.ts` の `getEmperorEvents(id)`）**: 指標ごとに構造の異なる events を共通の `EmperorEventRow`（種別・日付ラベル・1行要約・構造化フィールド内訳・note全文・出典ラベル）へ正規化して日付順に整列。1行要約は構造化フィールド優先 — 親征=target、反乱系=name（無ければ「{leader}の反乱」）、遷都=「旧都 → 新都」、宮廷イベント系=note の先頭一文（既存 `firstSentence` を流用）。
- **datePrecision の正規化（`normalizeDatePrecision`）**: 実データの datePrecision は "day"/"month"/"year" のほか「day（干支のみ:…グレゴリオ暦未換算）」「lunar-month（…）」「月まで特定」等の自由記述が大量に混在する。接頭辞正規表現で3値に正規化し、**判別できないものは年精度に落とす**（date 値の月日が01埋めのことがあり、精度を過大に見せないための安全側）。日付表示は精度で丸め（「627年」「627年1月」「627年1月10日」）、期間（startDate/endDate）は両端を同精度で丸めて同値なら単一表示。ソートキーは `astroYear`（0年なし対策）ベース。
- **西暦未換算の日付（元号+旧暦表記）が250件・18人分ある**: 北宋仁宗（69/69件全部）・晋恵帝・唐睿宗など。ISO風にパースできない date はソート不能のため、**原文ママの日付ラベルで表示しつつ種別順・原文順のまま末尾にまとめる**（安定ソート）。多くは「慶暦八年(1029)四月庚寅」のように括弧内に西暦年を含むため読める。date が null のものは「日付不詳」表示で同じく末尾。
- **表示（`emperor-event-timeline.tsx`・"use client"）**: 種別ドット（--series-1〜8 を静的クラス名で対応付け）＋種別名（固定幅 w-[5.5rem]）＋日付＋要約1行（truncate）の行リスト。note 全文・対象/首謀者/結果・出典はネイティブ `details` の行内折りたたみ。クライアント状態は種別フィルタチップ（単一選択トグル・件数付き・aria-pressed）のみで、件数最多の南宋高宗（223件）でもハイドレーションは軽い。この events データは個別ページ専用で `EmperorRecord` には含めない（第1弾と同じペイロード方針）。
- 検証: `tsc`・`eslint`・`next build` 通過。puppeteer-core 実操作で南宋高宗（223件）のフィルタ絞り込み（大赦20件・被反乱114件→すべて223件に復帰）・行展開・コンソールエラー0件を確認。高帝（親征・反乱の同一事件が種別別に並ぶ日付順マージ）・北宋仁宗（全件元号表記の末尾グループ）の表示も確認。

### note表示化に伴うデータ側の文言・整合訂正（同日）

経緯 note の原文ママ表示開始により、訪問者に見える文章へ内部用語（`reigns[].note`・`accessionRoute`・`reignData`・`CLAUDE.md`・「ユーザー承認済み」「要修正」等）が混入していることが判明。全365人を走査して16件を意味を変えずに平文へ言い換え、走査中に見つかった訂正漏れ2件（北斉幼主の `endYear` 578→577、明玉珍の在位noteの享年38→36）も整合修正した。詳細は `docs/PROJECT_STATUS.md`「対応済みの訂正（2026-07-20）」。調査メモ（count.note等）内の「本フィールド」等は調査記録としてラベリング済みの枠内のため原文ママを維持。

## noteの個別ページ活用 第3弾: 詳細ダイアログへの経緯反映（lazy fetch、2026-07-20）

第1弾で個別ページに出した「即位の経緯」「死因の経緯」を、統計ページ横断の詳細ダイアログ（`emperor-detail-dialog.tsx`）にも出す（task.md 第3弾）。ただし全統計ページのクライアント props（`EmperorRecord`）に note 全文を載せない方針は維持するため、**ダイアログを開いた時だけ JSON を fetch する**方式にした。

- **ビルド時に経緯 JSON を生成（`scripts/build-emperor-notes.mjs`）**: `data/emperors.json` から各皇帝の経緯2節＋出典だけを抜き出し `public/emperor-notes/{id}.json`（365件・平均約760バイト・合計約280KB）を書き出す。`predev`/`prebuild` で `sync-portraits` に続けて実行。生成物は `.gitignore` 済み（ソースは `data/emperors.json`）。出典ラベル整形（`HISTORY_SOURCE_PATTERN`/`sourceLabelOf`）は `emperors.ts` と同ロジックを .mjs 側にも複製している（.mjs から TS を import できないため。変更時は両方直す）。`next export` で `out/emperor-notes/` にそのまま配信される。
- **ダイアログ側の lazy fetch（`emperor-narrative-dialog.tsx`・"use client"）**: `useEffect` で `${BASE_PATH}/emperor-notes/${id}.json` を取得し、経緯2節を `NarrativeBlock`（`emperor-narrative.tsx` から export・純表示部品）で描画。取得失敗・経緯なし（404）のときは何も出さず既存表示を壊さない。年表はダイアログには載せない（個別ページへの既存導線に任せる）。
- **ダイアログの使い回し対策**: `DetailOutlet`（`useDetailOutlet`）は単一インスタンスを使い回し `id` だけが変わる。effect 内の同期 setState を避けるため、取得結果を `{ id, notes }` で持ち、表示する notes は `id` 一致時のみ派生させる（id 変更直後は自動的に非表示 → 新 id の fetch 完了で差し替え）。React 19 の `react-hooks/set-state-in-effect` にも抵触しない。`useDetailOutlet` のチャート再レンダリング分離は崩していない。
- 検証: `tsc`・`eslint`・`next build`（`out/emperor-notes/` に365件）通過。Chrome 実操作で `/emperors` カードから始皇帝（即位=史記・秦始皇本紀／死因=Wikipedia日本語版）→高帝（即位=史記・高祖本紀／死因=Wikipedia日本語版「劉邦」）と開き直し、経緯が正しく差し替わること・古い皇帝の内容が残らないこと・コンソールエラー0件を確認。

## 品質担保の方針（2026-07-17）

実装着手時に導入する開発フロー・ツール。

- **dataviz skill の活用**: 本サイトはグラフ・KPIカード・統計テーブルが中心のため、チャート／カラー／レイアウトを新規作成する際は必ず dataviz skill を通す。配色は [LAYOUT.md](./LAYOUT.md)「デザイン世界観決定」の王朝別カテゴリカルパレット同様、`scripts/validate_palette.js` でCVD安全性を検証してから確定する。人物ごとに個別実装するとグラフごとに配色・体裁がばらつくリスクがあるため、一貫性担保の主手段と位置づける。dataviz skillがこのドキュメントでアンチパターンを見つけた場合はdataviz skillの推奨に従う。
- **Storybook + Chromatic（ビジュアルリグレッションテスト）**: 皇帝カード（グリッド表示）・ランキング棒グラフ・タイムラインなど再利用コンポーネントが多い設計のため、Storybookでコンポーネント単位に切り出し、Chromaticでスクリーンショット差分を検知する。特に肖像画プレースホルダー（153名分の実画像／211名分のモノグラム）が混在するカードは、実装変更時の意図しない見た目崩れが起きやすいため優先的にカバーする。

## SEO対策の徹底実装（2026-07-20）

技術的SEO（sitemap・robots・構造化データ・OGP画像・Search Console連携）が未実装だったため一通り整備した。

- **`src/lib/seo.tsx` に一本化**: `SITE_URL`/`SITE_NAME`・トップページのカード説明文と各ページの meta description を共有する `SITE_SECTIONS`・`buildMetadata()`（canonical・openGraph・twitter を一貫生成）・JSON-LD生成関数（`personJsonLd`/`breadcrumbJsonLd`/`websiteJsonLd`/`datasetJsonLd`）・`<JsonLd>`/`<BreadcrumbJsonLd>` コンポーネントを集約。各 `page.tsx` の `export const metadata` はこれを呼ぶだけにし、`layout.tsx` の `title` は `{ default, template }` 化して各ページの手書きサフィックス `"◯◯ | 中国皇帝統計"` を廃止した。
- **構造化データ**: 皇帝個別ページに `Person`（`birthDate`/`deathDate` は `data/emperors.json` の `ages.birthDate`/`deathDatePrecision` が ISO風に解析できる場合のみ設定。「不明」「推定」等の自由記述は捏造せず省略。既存のイベント日付パース処理 `parseEventDate`/`normalizeDatePrecision`/`clampToPrecision` を流用する `emperors.ts` の `getEmperorStructuredDates(id)` で計算）と `BreadcrumbList`、トップに `WebSite`、`/about` に `Dataset`（ライセンス表記が確立していないため `license` フィールドは付けない）を追加。
- **`sitemap.ts`/`robots.ts`/`manifest.ts`**: `output: "export"` では metadata route も `export const dynamic = "force-static"` が無いとビルド時に落ちる（`next build` のエラーで判明）。sitemap は静的9ページ＋365皇帝ページの計375件。
- **OGP画像は皇帝ごとに動的生成（`next/og` の `ImageResponse`）**: 共通レンダラは `src/lib/og-image.tsx`（`renderEmperorOgImage`/`renderStatPageOgImage`）に集約し、各ルートの `opengraph-image.tsx` は数行で呼ぶだけ。
  - **フォント**: Noto Sans JP は Google Fonts の可変フォント（`ofl/notosansjp/NotoSansJP[wght].ttf`）しか配布されていないため、`fonttools varLib.instancer` で Regular(400)/Bold(700) の静的インスタンスを作り、`pyftsubset` でこのサイトの全皇帝名・王朝名・era ラベル・UI文言だけの約1,280字に絞った（各約320KB、`site/assets/fonts/`。`public/` には置かないためクライアント配信物は増えない）。個人名の異体字7字（武則天が作った則天文字「㻋」、明世宗の諱「熜」等）は Noto Sans JP 自体に存在せず断念したが、いずれも `commonName` があるため表示上使われるのは `commonName` 側で実害なし（`displayName()` のフォールバック順）。
  - **WebP肖像画は next/og では未対応（既知のはまりどころ）**: `public/portraits/*.webp` を `<img src="data:image/webp;...">` として渡すと `TypeError: u2 is not iterable` で該当ルートのビルドが落ちる（satori の webp デコードの不具合。PNG/JPEGは問題なし）。Next.js が依存として同梱している `sharp`（`node_modules/next` 配下、`package.json` に明示追加済み）でビルド時に PNG へ変換してから埋め込むことで回避した。
  - ビルド時間は365件のOGP画像生成込みで実測 約8秒（`next build` 全体）。
- 検証: `tsc`・`eslint`・`next build`（758ページ）通過。生成された `out/sitemap.xml`（375件）・`out/robots.txt`・`out/BingSiteAuth.xml`・`out/manifest.webmanifest`、複数の `opengraph-image`（始皇帝・肖像画付きの武則天・トップ・about）を目視確認、日本語グリフの文字化けなし。

## グラフページの「読み取れること」SSR テキスト（2026-07-21・task.md 4-1）

グラフは `LazyMount` で画面外未マウント＝クローラ（と JS 前の未訪問ユーザー）は棒/円の数値を一切受け取らない。そこで各グラフページの結論を1〜2文の総括文にしてビルド時にサーバーレンダリングし、**`LazyMount` の外＝常時 DOM** に置いた。静的 HTML への純増（`out/*.html` で総括文が存在し、同 HTML のチャート領域は `min-height` プレースホルダのみ・バー0 を確認）。

- **単一情報源**: 文面は `lib/emperors.ts` の `getChartTakeaway(page)`、描画は `components/charts/chart-takeaway.tsx` の `ChartTakeaway`（`"use client"` なしの純表示部品）。ページ側は代表 Section の children 先頭（LazyMount の兄弟）に1本だけ置く。
- **チャートとの整合を構造で担保（本作業の肝）**: 総括文の数値・母集団・1位は手書き `.filter` を一切挟まず、チャート行と同じ単一情報源から導く。/reign・/death-accession は `getOverviewStats`（チャートと同じ集計）、回数系・年齢は `record.ranks[key]`（チャート行と同じ `computeRanks` 由来のマップ）を使い、1位＝`ranks[key].rank===1`（＝チャート最上段）・母集団＝`ranks[key].total`（＝0回除外／年齢判明者のみの対象人数）。`isRanked`/`RANK_DIRECTIONS`/`collapsesZeros` を将来変えても本文が勝手にずれない。
- **同順位ガード**: `ranks[key].tied` を `leaderLabel` で処理し「○○と△△の2名」「○○ら3名」と表記（1位が同点でも「○○が最多」と誤らない）。区切りは「と」を使う — 名前自体が「聖祖・康熙帝」のように「・」を含むため、「・」で繋ぐと1人か2人か判別できなくなる。
- **最上級主張の人数しきい値ガード**: /dynasties の平均在位比較は `DYNASTY_MIN_EMPERORS=5` 未満の王朝を除外し、**除外を本文に明記**（1人王朝アーティファクト回避）。
- **粒度**: 各ページ1本（代表 Section 直下）に限定。/death-accession だけ対等な2円グラフのためグリッド上に1本置き死因＋即位経路の両方に触れる。
- 検証: `tsc`・`eslint`・`next build` 通過。`out/{reign,ages,death-accession,court-events,military,dynasties}.html` 6ページとも総括文1本・チャート領域は空を確認。

## 皇帝一覧ページの改善一式（2026-07-21）

「詳細ダイアログの個別ページリンクがスクロールしないと見えない」というユーザー指摘を起点に、/emperors とダイアログをまとめて改善した。

- **ダイアログヘッダーに個別ページ導線を常設**（`emperor-detail-dialog.tsx`）: 従来の「この皇帝の個別ページを開く」は本文＋経緯2節の最下部にしかなく、経緯の長い皇帝ではダイアログを最後までスクロールしないと到達できなかった（経緯は開いた後に lazy fetch で挿入されるため、リンクは常に下へ押し出される）。王朝サブラベルの行の右端に「個別ページへ」リンクを常設し、最下部のリンクは読了後の導線として残した。
- **ダイアログの広幅化**: `sm:max-w-lg lg:max-w-3xl` とし、`EmperorDetailBody` の `wide`（個別ページ用2カラム）を流用。動画は折りたたみのままにするため `collapseVideos` prop を新設して `wide` から分離した（既定は従来互換の `!wide`）。
- **ダイアログの前後送りナビ**: 一覧の表示順（絞り込み後）で前後の皇帝へ送る ‹ › ボタン＋←/→キー。props（`prev`/`next`/`onNavigate`）が渡された時だけ表示するので、ランキングチャート・年表からの利用（一覧文脈が無い）は従来どおり。
- **時代セクション見出し＋ページ内ジャンプ**（`emperor-grid.tsx`）: 365枚のフラットなグリッドに `eraLabel` ごとの sticky 見出し（`sticky top-0` + `bg-background/95`）と冒頭のアンカーリンク列を追加。時代は**初出順にプール**するため、データ順で時代の途中に挟まっていた5名（更始帝ら「新〜後漢初」4名・袁術）だけ時系列寄りの位置に移動する。見出しは静的HTMLに入るためSEO上も見出し構造が増える。
- **絞り込み状態のURLクエリ同期**: `?q=&dynasty=&category=` を `history.replaceState` で同期し、リロード・共有・個別ページからの戻りで状態が消えないようにした。**復元は hydration 不一致を避けてマウント後 effect で行い（`react-hooks/set-state-in-effect` は理由付き disable）、書き込み effect は初回1回だけスキップする** — 復元 effect より先にデフォルト値で URL を上書きしてパラメータを消す事故の回避（両 effect は同一コミットで順に走るため ref フラグでは防げない）。
- **かな検索**: `lib/kana-readings.ts`（サーバー専用）に名前・王朝名の全漢字561字の音読みテーブルを手書きし、ビルド時に読み展開 `searchKana` を生成（読み揺れは1名称8展開まで・王朝/時代ラベルは慣用読みのみ）。**未登録漢字はビルド時に throw**（timeline-river の `STREAM_DEFS` assert と同じ設計。皇帝追加時に読みの追記漏れで落ちる）。クエリはカタカナ→ひらがな正規化（`lib/kana.ts`、クライアント共用）して `searchText`＋`searchKana` に照合するため「こうぶてい」「くびらい」のどちらでも引ける。`searchKana` は **`EmperorRecord` 本体ではなく /emperors 専用の `EmperorListRecord`**（`getEmperorListRecords()`）に載せ、統計各ページのクライアント props を太らせない（合計約34KB・/emperors のみ）。
- 検証: `tsc`・`eslint`・`next build` 通過。`out/emperors.html` に個別365リンク＋時代見出し15件を確認。dev サーバー実機で、ヘッダー導線・2カラム・←/→送り・かな検索（「こうぶてい」→光武帝/孝武帝ら5名・「くびらい」→世祖）・URLクエリの復元/無効値の破棄を確認。個別ページ側は回帰なし（動画グリッド展開のまま）。

## 王朝フィルタの検索可能Combobox化（2026-07-21）

「王朝フィルタが長すぎて使いづらい」というユーザー指摘への対応。王朝の選択肢は87件（時代グループ15個。五代十国13・五胡十六国11・南北朝11・隋末9が特に多い）あり、素の `Select` では目当ての王朝までのスクロールが長すぎた。

- **`components/charts/dynasty-combobox.tsx` を新設**: cmdk（`ui/command.tsx`）+ `ui/popover.tsx` によるテキスト検索付きコンボボックス。開くと即入力でき、ラベル・時代名の部分一致で87件を絞り込める。一覧は従来どおり `groupByEra` の時代グループ見出し付き・先頭に「すべての王朝」・選択中はチェック表示。cmdk・radix-ui は導入済み依存で新規追加なし。
  - **cmdk 既定のあいまい一致は使わない**: 漢字1字でも飛び石マッチして候補が絞れないため、`filter` プロップで部分一致（`includes`）に差し替えた。`CommandItem` の `value` は dynastyKey（`名前__section`）、表示ラベルと era は `keywords` で照合対象に加えるため「五代」で後漢（五代十国）も引ける。
  - かな読み検索は同日の「検索正規化の強化」（次節）で対応済み。
- **重複実装の解消**: 従来は同じ87件Selectが `chart-filter-controls.tsx`（統計6ページ共通）と `emperor-grid.tsx`（/emperors、インライン）の2箇所にあった。両方を `DynastyCombobox` に差し替え、`groupByEra` の定義も dynasty-combobox.tsx へ移動（フィルタUIの実体が1箇所になった）。state・URLクエリ同期（`?dynasty=`）は値をそのまま使うため無変更。
- **既存制約の踏襲**: トリガーは固定幅 `w-[200px]`（自動幅だとWebフォント読込でフィルタ行の折り返しがずれCLSになる）・`aria-label="王朝で絞り込み"` 必須（role=combobox のボタンは中身がアクセシブルネームにならない）。見た目は `SelectTrigger` のクラスに揃えた。
- 検証: `tsc`・`eslint`・`next build` 通過。区分（3件）・並び順のSelectは短いため現状維持。

## 検索正規化の強化（2026-07-21）

検索UXレビュー（読み仮名・簡繁字形・NFKC の3点指摘）を受けた対応。かな検索自体は実装済み（「/emperors 一覧の改善」のかな検索）だったが、実例検証で本物の穴が3つ見つかり修正した。

- **クエリの NFKC 正規化**: /emperors の検索トークンと `DynastyCombobox` の `filter` に `.normalize("NFKC")` を追加。半角カタカナ入力（ﾖｳﾃｲ等）・全角英数を吸収する。検索対象側（`searchText`/`searchKana`）はデータ由来の通常形のため正規化しない。
- **読み揺れ・別名の個別補強**: `kana-readings.ts` の `帝` に慣用の呉音「だい」を追加（「ようだい」→煬帝が引けなかった）。武則天に別名「則天武后」を `data/emperors.json` の `aliases` へ追加し `后:こう` をテーブルに登録（「そくてんぶこう」が引けなかった。データ編集のため `validate_emperors.py` 通過を確認）。読み追加は `MAX_EXPANSIONS=8` の組合せ上限と干渉しうるが、展開は先頭読み優先で切り詰められるため慣用読みは常に残る。
- **王朝コンボボックスのかな検索対応**: `DynastyOption` に `kana: string[]`（ビルド時に `kanaExpansionsOf` で生成。ラベルは読み揺れ込み・時代は慣用読みのみ）を追加し、`CommandItem` の `keywords` に載せて `filter` 側で `toHiragana` 併用照合。「とう」→唐、「ずい」→隋などが引ける。ペイロード増は87件×数読みで軽微。
- **簡体字・繁体字・旧字体の正規化（`刘`→劉・`楊廣`→楊広など）は見送り**: 対象569字の異体字変換テーブルの手作業構築が必要で、日本語サイトとしての便益と釣り合わないため保留。要望が出たら王朝名+頻出姓の縮小版から着手する。
- 検証: 読み展開ロジックの再現スクリプトで「ようだい」「そくてんぶこう」のヒットを確認、`tsc`・`eslint`・`next build` 通過、`out/` のペイロードに新しい読み・別名が含まれることを grep で確認。

## ランキング上位10名の静的テーブル（2026-07-21）

「統計ページ→個別ページのクローラブルなリンクがない」というレビュー指摘（実測: `out/` の reign/court-events/military/ages のHTMLに `/emperors/[id]` への `<a>` が0件）への対応。ランキングチャートは `LazyMount` 配下の Client Component、「表で見る」も `TableDetails` が開くまで children を構築しない設計（閉時コストゼロ、意図的）のため、静的HTMLには内部リンクが出ない。365ページ自体は一覧グリッド・sitemap・prev/next で発見可能なのでインデックス阻害ではないが、トピックページからの文脈付き内部リンク・非JS環境のフォールバックとして価値がある。

- **`components/tables/top-ranked-table.tsx` を新設**（Server Component）: 各ランキング Section の `LazyMount` の直後に「◯◯の上位10名」を静的リスト（`<ol>` 2段組・`columns-2`）で併記。名前が `/emperors/[id]` への素の `<a>`。reign 1件・court-events 5件・military 3件・ages 2件の計11リストで、静的HTMLに重複除去後 10〜37 リンク/ページが載る。
- **順位はビルド時計算の `record.ranks` をそのまま使う**（competition ranking・回数系は1回以上のみ・年齢は判明者のみ・即位時年齢は若い順）。チャート・詳細ダイアログと必ず一致する。同順位内の並びはデータ順＝チャートの安定ソートと同じ。タイは「3位タイ」表示。
- **値のフォーマットはチャートと共用**: `rawValueOf`/`formatOf`/`collapsesZeros` を `ranking-bar-chart.tsx` から `lib/ranking-metrics.ts`（"use client" なしの中立モジュール）へ移動して両者で import。"use client" ファイルの関数はServer Componentから呼べないため分離が必須だった。
- 全365行のテーブルをHTMLに載せない判断は従来どおり（1ページ数千行のHTML肥大とのトレードオフで上位10名のみ）。

## ダイアログとブラウザ履歴の同期（2026-07-21）

「ダイアログを開いてもURL・履歴が変わらない」レビュー指摘（モバイルの戻るボタンで一覧ごと離脱／開いた状態を共有できない）への対応。**intercepting routes は `output: "export"` 非対応**（Next同梱docsのUnsupported Features明記・devでエラー）のため、指摘自身が挙げていたフォールバックの native History API 手実装を採った。

- **仕組み（`emperor-detail-dialog.tsx` の `useDialogHistory`）**: Next.js 16 は native `pushState`/`replaceState` をパッチしており、渡した state に内部キー（`__NA`・`__PRIVATE_NEXTJS_INTERNALS_TREE`＝現在のレンダーツリー）を合成して `usePathname` だけ同期する。これにより**一覧のツリーを表示したまま URL だけ `/emperors/[id]` に差し替え**られ、popstate 時はエントリ保存済みツリーで復元されるため一覧に戻っても state が保たれる。リロード時は静的書き出し済みの個別ページ本体が開く（望ましい挙動）。
- **状態遷移は `history.state` の marker（`{emperorDialog: id}`）だけで冪等に管理**し、抑制フラグを持たない: 開＝markerが自分でなければ pushState／前後送り＝replaceState（履歴を増やさない。←/→で何人送っても戻る1回で閉じる）／UI閉（×・ESC・外側）＝markerが自分なら `history.back()`（戻る経由の閉では popstate 後で marker が既に消えているため二重backにならない）／popstate＝marker無しなら閉・markerが最後に開いた皇帝なら開き直し（進むで再入）。
- **利用箇所で挙動を分ける**: /emperors 一覧は `historyUrlFor` でURL差し替えあり。チャートの `useDetailOutlet` 経由（統計ページ）は URL を変えず履歴エントリだけ積む＝戻るで閉じるのみ（statsページのURLを維持）。
- **ダイアログ内「個別ページへ」リンクの `onClick={onClose}` は削除**: onClose の `history.back()` とルーター遷移の pushState が競合するため。遷移すればページごとアンマウントされる。実測では同一URLへの Link 遷移は履歴エントリが置換され、個別ページから戻ると（ダイアログを飛ばして）素の一覧に直帰する自然な挙動になる。
- **一覧グリッド側の防御**（`emperor-grid.tsx`）: フィルタURL書き込み effect は pathname が `/emperors` でない間はスキップ（検索入力の deferred 反映がダイアログ表示直後に届いて `?q=` を個別URLへ書く競合の回避。`replaceState(null,…)` は marker を消すため必須）。マウント時に marker が残っていればダイアログを復元する安全網も追加。
- 検証（dev実機・Chrome）: カードクリック→URL `/emperors/qin-shi-huang`＋ダイアログ／戻る→閉じて `/emperors`（フィルタ `?category=` も保持）／進む→再び開く／←→送り→URLだけ差し替わり `history.length` 不変／ESC→URL復帰／/reign のチャート行→URL `/reign` のまま開閉・戻る進むも同様。`tsc`・`eslint`・`next build` 通過。閉アニメーション中の `[role=dialog]` 残留はバックグラウンドタブでCSSアニメーションが停止していただけで実害なし。

## 在位日付の典拠表示とWikipediaラベル撤去（2026-07-21・task.md B-4）

task.md 3-1 フェーズB完了（`reigns[].duration.source` への正史原文 `quote`・暦換算 `conversion` 整備）を受けた後始末。

- **旧Wikipedia判別ヒューリスティックを撤去**: `emperors.ts` の `HISTORY_SOURCE_PATTERN`／`sourceLabelOf` は「pageに巻・紀等の字が無ければWikipedia記事名」とみなす暫定表示だったが、Wikipedia出典が一掃された現在は**簡体字巻名（例: jin-wudi の「晋书帝纪第三」24件）・JACAR資料・「近現代の学術的に信頼できる複数情報源」を誤って「Wikipedia◯◯語版記事「…」」と表示する実害だけが残っていた**ため削除し、`source.page` をそのまま表示ラベルにした。`build-emperor-notes.mjs` 側の複製ロジックも同時に撤去（「変更時は両方直す」運用の対象コードは消滅）。受け入れテストは `out/emperors/` 全HTMLに「Wikipedia◯◯版記事」が0件であることを grep で確認。
- **個別ページに「在位日付の典拠（正史原文と暦換算）」節を新設**: `getEmperorNarrative` に `reignSources`（在位期間ごとの `periodLabel`・`page`・`quote`・`conversion`・`note`）を追加し、`EmperorNarrativeSections` で調査メモと同型の折りたたみ `details`（既定閉）として表示。quote は正史原文の直接引用（「」付き本文サイズ）、conversion・note は muted の小サイズ。複数在位の皇帝のみ期間ラベルを前置。**ダイアログの lazy fetch（emperor-notes JSON）には含めない**（個別ページ限定・EmperorNarrativeNotes は不変）。`duration.source.note` に空文字列 `""` が実在する（beizhou-wudi 等3件）ため `nonEmptyOrNull` で正規化。
- **/about に「日付の暦と西暦への換算」節を追加**: 旧暦（元号年・月・干支日）→ sxtwl（寿星天文暦、リンクは pip の Home-page https://github.com/yuangu/sxtwl_cpp ）換算・1582年10月改暦前はユリウス暦・旧暦年末が西暦翌年に入る非対応・史料対立時は正史優先・紀元前の内部表現は天文年表記（前210年＝-209年）という方法論を明文化。
- **フォローアップ（データQA）→ 同日 B-5 として解消**: `duration.source` 374件中12件が `quote`/`conversion` 未付与で、うち9件は page にWikipedia記事名が正史書名と混在したまま残っていた（`detect_wikipedia_sources.py` の HISTORY_KEYWORDS 部分一致で3-1の検出から漏れた既知の限界パターン）。同日中に原典調査で全件正史出典へ整備し、日付訂正5名（ユーザー承認済み）も反映（task.md B-5・`docs/PROJECT_STATUS.md`「出典 QA」節・`meta.reignDurationSourceBlocks[12]` 参照）。個別ページの「在位日付の典拠」節は現在365人全員が正史出典表示になっている。

## /emperors のRSCペイロード軽量化と肖像srcset（2026-07-21）

/emperors 一覧が 365件×フル `EmperorRecord`（searchText・ranks12項目・videos込み）をそのままクライアントpropsに渡していた構造の解消と、`images.unoptimized` で srcset が効いていなかった肖像画の2サイズ出し分け。

- **一覧propsを軽量レコード化**: `EmperorListRecord` を「`EmperorRecord` 拡張」から**カード表示・検索・絞り込みに必要な10フィールドだけの独立型**へ再定義（id・name・personalName・dynastyLabel・eraLabel・dynastyKey・dynastyCategory・portraitUrl・searchText・searchKana）。実測で `out/emperors.html` 942KB→485KB（gzip 76KB→42KB）、RSCペイロード `emperors.txt` 592KB→172KB（gzip 60KB→26KB）。
- **フルレコードはダイアログ開時に lazy fetch**: Route Handler `app/emperor-records/[id]/route.ts`（`force-static`・`generateStaticParams`）が `out/emperor-records/{id}`（拡張子なし・1人約2KB）へ静的書き出しし、グリッドはカードクリック時に fetch → `Map` キャッシュ → ダイアログ表示する（経緯noteの `public/emperor-notes/{id}.json` と同じ方式。ロジックは `lib/emperors.ts` を直接 import できるため .mjs 複製が不要な Route Handler を採った）。連打・閉直後の古い fetch 解決には `wantedIdRef` の一致確認で対処、fetch 失敗時は個別ページへ遷移するフォールバック。前後送り・←→キーは `EmperorNavTarget`（id+name）だけで動くよう `EmperorDetailDialog` の props 型を緩めた。マウント時のダイアログ復元（履歴marker）も同じ fetch 経路。
- **肖像画の2サイズ出し分け**: `sync-portraits.mjs` が sharp で 320px幅サムネ（quality 65・mtime比較で差分再生成）を `public/portraits/thumb/` に生成し、`Portrait` を `next/image` から素の `<img srcset="thumb 320w, full 360w">` に変更（unoptimized の next/image は srcset を出せない。`fill` 相当は `absolute inset-0` で再現、priority は `loading="eager"`+`fetchpriority="high"`）。**元画像がそもそも 360×480・quality65 のサムネ相当のため削減幅は限定的**: サムネ合計 2.2MB vs 元 2.9MB（−35%）で、恩恵は 1x ディスプレイの一覧と、ダイアログ・個別ページの 112〜144px 表示（DPR2 でも 288px≦320w でサムネが選ばれる）。DPR2 の一覧カード（要求 300〜490px）は従来どおり 360w フルが選ばれ劣化なし。チャートホバーの `EmperorTooltip`（44px表示）もサムネ参照に変更。
- 検証（out を serve・Chrome実機）: カードクリック→fetch→全項目ダイアログ（順位・経緯・動画）／←→送り・戻るで閉・進むで再入・別ページ→戻るのダイアログ復元／かな検索`?q=`復元／チャート行クリックのダイアログ（従来経路）すべて動作。`tsc`・`eslint`・`next build` 通過。

## 一覧カードの補助名（諱・通用名）表示（2026-07-22）

一覧カードは皇帝号＋王朝名のみで、諱のほうが馴染みのある人物（劉邦・李世民など）はクリックして詳細を開かないと誰か分からない問題への対応。カード1行目を「**皇帝号 補助名**」（補助名は xs・muted のインライン span）にした。レイアウトはユーザー選択（独立行案・王朝行併記案は不採用）。

- **導出はビルド時**: `lib/card-subtitle.ts` の `cardSubtitleOf` で `EmperorListRecord.cardSubtitle` を導出（RSCペイロード増はごく僅か）。デフォルト規則は「諱の（…）以降を省略し、皇帝号に同じ文字列が含まれる場合は非表示」— これで五代十国の「太祖（朱全忠）」型・「王莽」「侯景」等の群雄107人は自動的に重複回避され、元朝は「クビライ（忽必烈）」→「クビライ」になる。
- **人物別上書きテーブル `CARD_SUBTITLE_OVERRIDES`（21件）**: 「日本での知名度」という編集判断のためデータ本体には置かず、`kana-readings.ts` と同じサイト側手書きテーブル（id → 文字列 or null）。①遼8人は諱が「契丹名（漢風名）」の並びでデフォルトだと馴染みの薄い契丹名側が残るため括弧内（耶律徳光等）を採用（**金は逆順「漢風名（女真名）」なので上書き不要、西遼・耶律阿保機は括弧なしでデフォルトのまま**）、②清11人は「愛新覚羅」姓を省略（太宗はホンタイジ、宣統帝は溥儀）、③胡亥（「嬴胡亥」は非通用）、④武則天は皇帝号に通用名を含むため null。存在しないidはビルド時 throw（STREAM_DEFS と同方針。皇帝追加時にテーブル追記は不要＝デフォルト規則が適用される）。
- **別名併記は見送り**: 「別名のほうが有名な場合は併記」の厳密な該当はほぼ無し（劉邦に「漢高祖」を足すのは諱自体が最有名なので冗長。唯一の実候補「劉賀（海昏侯）」も皇帝号「廃帝（昌邑王）」が長く過長になるため見送り。必要なら上書き1行で対応可）。
- 全365人分のレビュー（表示あり258人/皇帝号のみ107人）をユーザー承認済み。受け入れ確認は `out/emperors.html` に `>ホンタイジ</span>` 等が出ること・`>武曌</span>`・`>愛新覚羅…</span>` が無いことを grep。

## 系譜・即位経路グラフの可視化方式決定（2026-07-22・実装は未着手）

新規調査プロジェクト「系譜・即位経路グラフ」（task.md 6-3、データは `data/kinship.json`）の可視化方式を、データ調査**開始前に**決定した（表示要件からスキーマの必須フィールドを逆算して凍結するため。捏造サンプルデータのモックで検証済み）。**方式③「全体1画面のインタラクティブグラフ」＋縦軸=時間（上→下に時代が下る）**。エンコーディング（皇帝=在位期間カプセル・ブリッジ人物=固定サイズ破線ノード・エッジ線種の使い分け）・モックで判明した必須処理（短在位カプセルの衝突押し下げ等）・実装バックログ（ズーム/パン・経路ハイライト・SEO テキスト等）の詳細は [../../data/schema/KINSHIP_SCHEMA.md](../../data/schema/KINSHIP_SCHEMA.md) の可視化節を参照。サイト実装着手時はこのファイルに設計記録を追記すること。

## 系譜グラフ試作ページ /kinship（2026-07-22・調査済み36人での描画検証）

フェーズ1調査の途中（ブロック1・2＝秦〜後漢36人・継承エッジ29本・ブリッジ人物2完了時点）で、**残り約330エッジの調査を続ける前に現データ・スキーマが方式③の描画に耐えるかを検証する**ための試作ページを実装した（描画範囲を調査済み36人に絞るのはユーザー決定。worktree ブランチ上のみ・main 未マージ）。検証結果は **go（スキーマ変更なしで調査続行可）**。

- **構成は /timeline の3層パターン踏襲**: `lib/kinship-layout.ts`（fs非依存の純関数。レーン curation 表 `KINSHIP_LANE_DEFS`＋配色表 `KINSHIP_COLOR_BY_DYNKEY` の被覆をビルド時 assert）→ `lib/emperors.ts` の `getKinshipGraphData()`（kinship.json を fs 読み・36人フィルタ・件数/端点解決/在位年数値の assert）→ `app/kinship/page.tsx`（Server Component）→ `components/kinship/kinship-chart.tsx`（`"use client"`・SVG描画のみ）。timeline と違い **レイアウトは全てビルド時計算**（KINSHIP_SCHEMA.md の決定どおり）で、固定幅 SVG（約1,440×1,660px）を `overflow-x-auto` に置く。クライアント再計算が無いため `useChartWidth` 等は不要だった。
- **試作ページの非公開運用**: `nav-data.ts`／`SITE_SECTIONS` に登録しない（ナビ・トップカード・sitemap から自動除外される）＋ `metadata` に `robots: {index:false}`。`buildMetadata` には description を直接渡す（`sectionDescription()` は未登録 href で throw するため使わない）。この組み合わせで「ビルドには載るが導線・検索に出ないページ」が成立する（前例のなかったパターン）。
- **レイアウト**: 縦=基準3px/年、レーン7本（=section）・幅160px。**当初のモック方式「線形スケール＋同一レーン内押し下げ」は実装後に廃止した** — 押し下げは密集帯（前漢初期・後漢の幼帝連鎖）でノードが左軸の年目盛りから系統的に最大数十px（十数年分）ずれ、ユーザー指摘を受けた。代わりに**「年→pxの単調な区分線形写像を、最小高が守れない密集期間だけ局所的に引き伸ばす」方式**へ変更: 全ノードの実効年区間の端点をブレークポイントとし、各ノードの必要px（最小高26+間隔8）に足りない区間へ不足分を右端区間に加算（右端点昇順の貪欲で処理済み制約を壊さない）。目盛りもノードも同じ写像を共有するため**位置と年が常に一致**し、引き伸ばした期間は目盛り間隔の広がりとして視覚化される。同一年内の連続即位（在位0年の劉賀・少帝懿・少帝弁）のみ0.5年の小数年オフセットで順序を保証（1年未満は年軸で表現不能な原理的限界）。連続即位の矢印描画余地はカプセルを年境界から上下4pxずつ内側に描いて確保。軸は全レーン共有なので、あるレーンの引き伸ばしは同期間の他レーンのカプセルも伸ばす（光武帝が並立群雄の引き伸ばし分だけ太る等）— 時間整合としては正しい挙動。
- **「上→下」規則が破れるエッジの側面アタッチ**: 孺子嬰→王莽（禅譲）は from（生没中点配置のブリッジ）の下辺が to の上辺より下に来る唯一のケース。`from.bottom ≥ to.top` かつ別レーンのときは**両ノードの側面どうしを水平ベジェで結ぶ**フォールバックを実装し、目視で違和感なしを確認。**ラベルは水平区間の中点上に置くと隣接レーンの縦エッジラベル列（レーン右外）と接近する**ので、本実装でエッジが増えたらラベル衝突回避の一般解（ずらし or リーダー線）が必要。
- **ホバー/クリック**: `useTipOutlet`+`FixedTooltip`（サイト共通原則）でノード（名前/王朝/在位。ブリッジは「生没年推定」表示）・エッジ（カテゴリ/relationToPredecessor/確度/note抜粋160字/出典）のツールチップ。クリックは近傍強調（選択と隣接以外 opacity 0.16）・背景クリック解除。エッジ note はサーバ側で160字に切り詰め（RSC ペイロード対策）。EmperorDetailDialog 連携・キーボードナビ・凡例トグルは本実装へ deferred。
- **SSRテキスト**: 「テキストで見る継承の流れ」（レーン別に `先代 →〔カテゴリ〕 新帝` を機械列挙）を client 外に配置（a11y 代替兼用）。
- **検証で行使できたスキーマ機能**: succession 3カテゴリ（世襲/擁立/禅譲）・veracity disputed（呂后期3エッジの点線+?表示）・relationToPredecessor・ブリッジ人物2種・yearsApproximate・section=レーン語彙・根ノード（◆建国5・◆擁立2）・note/source。**未行使（フェーズ2以降のデータ待ち）**: kinship/marriage/genealogicalClaims・isRestoration・複数在位コネクタ（`getKinshipGraphData` は複数在位を検出したら throw する仕込み）。
- **36人検証で言えないこと**: 365人時のレーン数爆発（レーン=section 1:1 はこの範囲でのみ成立。群雄クラスタ集約が必須）・縦2,200px超でのズーム/パン/ミニマップ・かな検索。これらは本実装バックログ（KINSHIP_SCHEMA.md 可視化節）のまま。
- **血縁エッジの初描画（同日追記・光武帝チェーン）**: ユーザー要望「光武帝は前漢と血のつながりがあることを図で示したい」を受け、フェーズ2の先行調査として景帝→劉発→劉買→劉外→劉回→劉欽→光武帝の kinship エッジ6本＋ブリッジ人物5人をデータ化し、描画対応を追加した。実装: ①kinship エッジ＝灰実線・矢印なし・グラフ内ラベルなし（続柄はツールチップとテキスト版で表示）②**生没年不明（null）のブリッジ人物は「エッジで隣接するノードのアンカー年平均」への緩和反復で配置年を推定**（データ側に推定値は入れない方針。チェーン上では既知アンカー間の線形補間に収束。ツールチップに「配置は系譜から推定」と明示）③**皇帝の在位期間と時間的に重なるブリッジ人物はレーン内の左サブカラムに配置**（継承カラムの縦系列に割り込めないため。該当レーンだけ幅を SIDE_W=118px 拡張。重ならない荘襄王・孺子嬰型は従来どおり系列内に挟む）。レーン幅が可変になったので laneX は累積計算に変更。


## SEO 監査 Phase 1: 既存パターンの横展開（2026-07-27）

`emperorstats.com-audit/ACTION-PLAN.md` の Phase 1（1-1〜1-4）の実装。監査で Critical 判定は0件で、
このフェーズは全項目が「他ページではすでに正しく実装されている型を、抜けている場所に当てる」作業。

### 静的な数値リストを /death-accession・/dynasties にも出す（1-1）

- **問題**: `/death-accession` の本文は314字で、死因8分類のうち実数がテキストにあるのは最多の1件だけだった。残り7分類も、円グラフに渡している**分類の定義文**（`deathCauseDescriptions`/`accessionRouteDescriptions`）も、`LazyMount` 配下の Client Component の中にしか無いため静的 HTML には1文字も出ていない。トップページの方が死因8分類すべてをテキストで持っていて、専用ページが情報量で負けている状態だった。
- **計画が名指ししていた `TopRankedTable` は使えない**。あの部品は `record.ranks[metricKey]` を持つ**皇帝**専用で、分類の内訳（死因・即位経路）にも王朝集計にも当たらない。横展開したのは部品そのものではなく「チャートと同じ集計から SSR の静的リストを `LazyMount` の外に出す」という型で、実体は新規の2部品:
  - `components/tables/category-breakdown-list.tsx` — 分類の全区分を「区分名・件数・割合・**定義文**」で並べる。数値は `getCategoryBreakdown()`（円グラフの絞り込み無しと同じ数え方）、並びは円グラフの既定 `categoryOrder`、定義文は円グラフに渡すのと**同一のオブジェクト**を受け取って二重管理を作らない。
  - `components/tables/dynasty-avg-reign-table.tsx` — 王朝別平均在位の上位10件。集計はチャート本体と同じ `aggregateByGroup(records,"dynasty","all")` を呼び、既定状態（単位＝王朝・絞り込みなし・長い順）をそのまま写す。**小標本の王朝も除外しない**（除外するとチャートの行と食い違う）。代わりに各行へ皇帝数を併記する。
- **効果（実測）**: `/death-accession` の本文 314字 → **950字**（計画の合格ラインは800字）。`/dynasties` は 483字 → 692字。字数の主因は分類の定義文17本で、件数リストだけでは800字に届かない。
- **見出しの「N分類」は手で書かない**（検証で1件検出して修正）。即位経路はスキーマ上9区分だが「受禅（擁立）」は**該当者0名**で、円グラフにもこのリストにも行が出ない。当初「即位経路9分類の内訳と定義」と手書きしていて、表示行8件と食い違っていた。区分数は実際の行数から導出する形に変えたので、以後データが動いてもずれない（部品の prop も `title` から `label` へ変更）。

### 「読み取れること」を全16節へ（1-2・**2026-07-21 の決定の変更**）

- 初版（本ファイル「グラフページの『読み取れること』SSR テキスト」節）は**粒度を「各ページ1本（代表 Section 直下）」に限定**していた。監査で、統計6ページ16節のうち総括文があるのは7節（44%）＝**残り9節はチャートを描かない限り数値がどこにも出ない**と判明したため、全16節に1本ずつ置く方針へ改めた。置き場所の規範（その主張が対象とする節の中に置く・ページ先頭へ持ち上げない）は初版のまま有効。
- キーを**ページ単位から節単位へ**変えた（`TakeawayPage` → `TakeawaySection`、値は `"court-events/amnesty"` のように `ページ/節id`）。`/death-accession` が `getChartTakeaway("death-accession").slice(0,1)` / `.slice(1)` と**配列の位置**で節へ振り分けていた仕掛けは、16節では成立しないのでこの変更で消した。`/court-events`・`/military` は節定義の配列に `takeaway: TakeawaySection` を持たせ、節と総括文の対応を型で縛っている。
- **整合の担保は初版と同じ**。新規9文も手書きの `.filter` を挟まず、回数系6本は既存の `countTakeaway`（`record.ranks[key]` 由来＝チャート行と同一）、没年齢は `topRanked`+`leaderLabel`、復位者は `getOverviewStats().restorationCount`（＝その節の表の行数と同じ定義）、王朝別死因は `aggregateByGroup`（＝隣のチャートと同一）から導く。
- **王朝の同率ガードを新設**: 皇帝の `leaderLabel` に対応する `dynastyLeaderLabel` を足し、区切りは同じく「と」を使う。王朝別死因の割合は平均在位の節と同じ `DYNASTY_MIN_EMPERORS=5` で小標本を除外する（1人王朝では割合が0%か100%にしかならない）。
- 検証: ビルド後の `out/*.html` から `<script>`（RSC ペイロード）を除いた DOM 上で「読み取れること」が **7→16**。生の `grep -c` は行数を数えるため、Next.js の1行 HTML では常に1を返す（計画に書かれていた指標コマンドの誤り）。

### /emperors の meta description を独立させる（1-3）

サイト最大のハブページだけが、ナビ用の短い説明（`sectionDescription("/emperors")`＝22字）を meta description に流用していた（統計8ページは60〜76字の専用文）。他ページと同じく `PAGE_TITLE`/`PAGE_DESCRIPTION` 定数を持たせ、`collectionPageJsonLd` にも同じ定数を渡した（67字）。`SITE_SECTIONS` 側の短い説明は**変更しない** — ナビは短いままが正しいという既存の規約どおり。

### GitHub リポジトリのメタ情報（1-4）

`homepage`・`description`・`topics` がいずれも未設定だった。コード変更ゼロで、リポジトリページ上部・GitHub 検索・トピック集約ページからの導線が増える。設定値は同節の実施記録（コミットメッセージ）参照。

### 検証のやり方

新設した総括文9本と静的リスト2種の数値は、**実装を使わずに** `data/emperors.json` から独立に数え直して突き合わせた（11エージェントで並行検証）。実装の関数を呼んで確かめるのでは実装のバグを検出できないため、母集団の定義（0回除外・年齢判明者のみ 等）を `emperors.ts` から読んだ上で、集計そのものは `jq`/`python3` で書き直している。11件中10件が一致、1件が上記の見出し不一致。同率1位の有無も各件で個別に確認した（新設分では同率は発生していない）。

### 意図的にやらなかったこと

Phase 2 以降（サイドバーの空 `<h3>`・皇帝個別ページの見出しレベル飛び・個別365ページ→統計ページの文脈内リンク・Cloudflare のセキュリティヘッダと URL 正規化・OG 画像の Content-Type）はこのブランチに含めない。計画上も別フェーズで、うち2件はコードでなくインフラ設定の変更。**このうちコード側の3件は次節（Phase 2）で実施した。**

## SEO 監査 Phase 2: 構造の是正（2026-07-27）

同じ計画の 2-1〜2-3 と 3-2、および 2-5 の実施記録。Cloudflare の2件（2-4）はインフラ設定なので触っていない。

### サイドバーの空 `<h3>` を解消（2-1）

- **問題**: 全378ページに、テキストが空の `<h3>` が **7個ずつ h1 より前に**出ていた。shadcn/ui の `AccordionTrigger` が `AccordionPrimitive.Header`（既定で `h3`）を必ず出すのに対し、ナビのトリガーはシェブロンだけでテキストを持たないため（見出しの役割は左隣のカテゴリリンクが担っている）。
- **対応**: `AccordionTrigger` に `asHeading` prop を足し、false のとき `Header` を `asChild` で `div` として描く。`Header` を丸ごと外すのではなく `asChild` にしたのは、Radix が付ける `data-state`/`data-orientation` を保つため。ナビは見出しではないので `h3` である必然性がない。
- **条件分岐でラッパー用の関数コンポーネントを作らないこと** — レンダーごとに型が変わってトリガーがアンマウントされ、フォーカスが飛ぶ。要素を組んで置いてから分岐する。
- 検証: ビルド後の全378ページで `<h3 ... data-orientation>` が **0件**。実機（Playwright）でアコーディオンの開閉・キーボード操作も確認。

### 皇帝個別365ページの h1→h3 レベル飛びを解消（2-2）

- 365ページ全件で h2 が無く、h1（`PageHeader`）から「即位の経緯」「死因の経緯」「復位の経緯」「関連動画」「在位中の出来事」の h3 へ飛んでいた。サイトの96%を占める面。
- これらの見出しを持つ部品（`NarrativeBlock`・`EmperorVideosSection`）は**詳細ダイアログと共用**で、ダイアログでは `DialogTitle`（h2）の下なので h3 が正しい。そのため `headingLevel?: "h2" | "h3"`（既定 h3）を prop で受け、個別ページ側だけ h2 を渡す。`EmperorNarrativeSections` は個別ページ専用（ダイアログは `emperor-narrative-dialog.tsx` が `NarrativeBlock` を直接使う）なので h2 を直に書いている。
- **見た目のサイズは階層に関わらず変えない**（`text-base font-semibold` のまま）。統計ページの h2 は `text-xl` だが、個別ページの節見出しはこの大きさが正しい。

### 皇帝個別ページ → 統計ページの文脈内リンク（2-3）

- 365ページすべてで、本文から統計6ページへの発リンクが **0件**だった。「365名中12位」という順位は大量に表示されているのに、その順位表へ導いていない。
- **順位・分類の表示そのものをリンクにする**（`emperor-detail-body.tsx` の `StatLink`/`withStatLink`）。在位期間・即位時年齢・没年齢・回数系8項目の順位補足はそれぞれのランキング節へ、死因・即位経路は値のテキストが `/death-accession` の該当節へ飛ぶ。アンカーは `nav-data.ts` のものと同じ。
- **ダイアログには出さない**（`linkStats` prop・既定 false）。ダイアログはランキングチャートの行クリックからも開くので、そこから同じランキング節へ戻すリンクは循環になる。
- リンクは順位が付く行にだけ出る（0回・年齢不詳は順位対象外で補足自体が無い）。そのため件数はページごとに違う。`/dynasties` はレコードの項目に対応する順位が無く上の仕掛けでは辿れないので、本文末尾の案内文から送る。
- 検証: ビルド後、`<main>` 内の統計ページ発リンクが 365ページすべてで **4〜14本**（0本のページなし）。リンク先アンカーが実在するかも突き合わせた。

### 運営者情報の明示（3-2）

- 監査時点で、著者・運営者の実在性を示す情報が本文にも構造化データにも無く、Dataset の `creator` が**サイト自身を指す自己言及**（`sameAs` なし）だった。
- `/about` に「運営者について」節（`id="operator"`）を新設。名乗りは実名でなく GitHub のハンドル。所属・資金提供・広告の有無まで書いた。ハンドルと URL の単一情報源は `lib/seo.tsx` の `OPERATOR` 定数で、本文と JSON-LD が同じ値を使う。
- JSON-LD は `creator` を `Person`（`@id` = `.../about#operator`・`sameAs` に GitHub のプロフィールとリポジトリ）へ差し替え、`publisher` にサイトの `Organization` を分けた。`@id` の指すアンカーは本文の見出し id と一致させてある。
- **「制作者は歴史学の専門家ではありません」という開示は残した**。計画はこれを Expertise シグナルとのトレードオフとして「方針の問題なので判断しない」としていたが、透明性を落とす変更は監査の指摘に含まれない。代わりに計画が両立案として挙げていた**検証可能性の側**（全員ぶんの原文引用・暦換算・調査メモを公開しており、集計結果から根拠の原文まで遡れる）を運営者節で明記した。

### OGP 画像に実データを載せる（2-5）

- Content-Type（`application/octet-stream`）は**ユーザーが OGP プレビューアで実害なしと確認済み**のため、リネーム対応はしない。次の論点は「カードがクリックされるか」。
- 従来の共有カードはページ名と短い説明だけで、開くと何が分かるのかが画像から読めなかった。統計ページには**代表的な数値を事実カード2枚**（`getOgFacts`）、皇帝個別ページには**順位・死因・即位経路のチップ**（`getEmperorOgChips`）を足した。
- **数値は手書きしない**。「読み取れること」と同じく `getOverviewStats`・`topRanked`・`aggregateByGroup` から導く。画像はビルド時に焼かれてSNS側にもキャッシュされるため、本文とずれると訂正が最も届きにくい面になる。
- **溢れの罠**（実際に踏んだ）: 皇帝名は2文字（「太宗」）から14文字（「承天応運啓聖睿文宣武皇帝黄巣」）まで幅があり、固定88pxだと長い名前が2行になってチップがフッターに重なる。収まる幅から逆算して1行に保つ（`emperorNameFontSize`）。チップは**3枚まで** — 肖像がある皇帝は左カラムが約724pxしかなく、4枚だと「即位経路 受禅（易姓）」のような幅広チップで2段になって同じ事故が起きる。
- 見出しの文字は72→64pxに下げた（事実カードのぶん縦を空けるため）。「カード画像は短い名前・長い文字列は og:title が運ぶ」という 2026-07-27 の判断自体は変えていない。
- 意匠の試作には `site/design-plans/tools/og-preview.mjs`（`next/og` を素の node から呼ぶ）を使った。本番レンダラを直すたびに `npm run build` する往復を避けるための道具で、採用した案だけを `og-image.tsx` へ移している。生成物は同ディレクトリの `og-shots/`。
