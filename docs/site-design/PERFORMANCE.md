# 性能・計測の記録（Lighthouse / 実機 timespan）

サイトの性能計測と、その結果として入れた対策の記録。**`site/src/` のコード側コメントが「LAYOUT.md の計測記録」として参照しているのはこのファイル**
（2026-07-27、LAYOUT.md が941行に肥大したため性能関連の節をここへ分離した）。

対策そのものを外すと何が起きるかが実測値つきで書いてあるので、`LazyMount`・行ウィンドウイング・`useTipOutlet`・
量子化ウィンドウ・スクロール直後のホバー抑制を触る前に読むこと。運用上の要点は [../../site/AGENTS.md](../../site/AGENTS.md) にも要約がある。

## 品質計測の結果（初回ベースライン・2026-07-18）

- **コンソール**: 全9ページ＋詳細ダイアログ操作でエラー・警告0件（dev mode）
- **Lighthouse**（本番ビルドをdesktop presetで計測）: Best Practices全ページ100
  - トップ 99（mobile 98）／ /emperors 76（LCP 6.0s＝遅延読み込み画像がLCP要素）／ /reign 67（TBT 4.2s）／ /court-events 62（TBT 10.0s）
  - **既知の課題（未対応）**: ①ランキング系ページはNivoが364本×セクション数のSVGを初回に全描画するためTBTが大きい（対策候補: 画面外チャートの遅延マウント等）②/emperorsは最初の数枚を`loading="eager"`にするとLCP改善見込み ③a11y: shadcn `SelectTrigger`にアクセシブルネームなし（button-name）、Nivoの`role="img"`なSVGにアクセシブルネームなし（svg-img-alt）
  - 計測方法: `out/`を`/tmp/lhroot/emperor-stats`シンボリックリンク経由で`npx serve`し、WSL内Chrome（`CHROME_PATH=/usr/bin/google-chrome`、`--headless=new`）で`npx lighthouse`

## 全9ページ計測・根本原因の特定（2026-07-18）

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
