# モバイル固有の破綻を直す（軸目盛り・横スクロールの手掛かり・行の折り返し）

Written against: 1540d63

> 390×844（iPhone 14 相当）で全12ルートを目視確認して見つかった、**モバイルでのみ起きる実装漏れ**をまとめる。
> いずれもデザイン判断を伴わず、デスクトップの見え方は変わらない。
> 撮影スクリプトは `design-plans/tools/capture-mobile.mjs`（フルページ撮影では `/emperors` が 54,355px に
> なり判読できないため、上端・中間・下端の3スライスを連結して確認する）。使い方は `design-plans/README.md`
> の「検証手順」節。以下に挙げる観察は、実装前にこのスクリプトを走らせれば再現できる。

## Evidence chain

- Surface: `/dynasties`・`/reign`・`/court-events`・`/military`・`/ages`（ランキング）、`/timeline`、`/kinship`、`/emperors/[id]`
- Problem: 5つの独立した破綻がある。すべて幅の狭い画面でのみ発現する
  - **M1** ランキングチャート上部の目盛りが重なって読めない（`/dynasties` を390px幅で開くと「0 2 4 6 810121416182022426」のように密着する）
  - **M2** `/timeline` が横スクロールできることを示す手掛かりがなく、前漢〜更始帝より右の約2000年分が画面外にあると気づけない
  - **M3** `/kinship` の章ジャンプが横に切れ、4章あるうち3つ目までしか見えない。手掛かりもない
  - **M4** `/emperors/[id]` のイベント行で、テキストが折り返すとシェブロン `>` だけが次の行に落ちる
  - **M5** `/timeline` の「時代へ移動」ラベルが1行目末尾に残り、対象のピル群が2〜3行目へ折り返して対応が読めない
- Design evidence:
  - M1 — `src/components/charts/nivo-theme.ts:81-91` `integerTickValues(maxValue)` が**刻み幅を最大値だけから決めており、描画幅を引数に取っていない**。`/dynasties` は max≒26 → step 2 → 目盛り14本。`scroll-bar-chart.tsx:340-343` が左マージンにコンテナ幅の42%を確保するため、390px 画面では残り約200pxに14本が入り衝突する
  - M2・M3 — `src/components/kinship/kinship-chart.tsx:496-513` に**同じ問題への解決が既に実装済み**。コメントに「図が枠の中で切れているのか続きがあるのか分からない、というユーザー指摘(2026-07-26)への対応」と経緯が記録されている。`/timeline`（`river-timeline.tsx:524`）と章ジャンプ（`kinship-chapter-nav.tsx`）はこの対策から漏れている
  - M4 — `src/components/emperors/emperor-event-timeline.tsx:77` の `summary` が `flex … flex-wrap items-baseline` で、本文 `<span>` に `basis-48`（`:63`）が付いている。狭い画面では本文が1行を占め、兄弟要素の `ChevronRight`（`:79`）が次の行へ押し出される
  - M5 — `river-timeline.tsx:482` のコンテナが `mb-3 flex flex-wrap items-center gap-2` で、「時代へ移動」ラベル（`:495`）とピル群の `<span className="flex flex-wrap gap-1.5">`（`:496`）が同列の兄弟になっている
- Owner: `nivo-theme.ts`（M1）、`kinship-chart.tsx`（M2・M3 の参照実装）、`emperor-event-timeline.tsx`（M4）、`river-timeline.tsx`（M5）
- Scope and affected surfaces: 上記のほか、M1 は `scroll-bar-chart.tsx` の部品群（`useRankingChartLayout` / `WindowedChartFrame` / `useWindowedRows` / `useChartWidth`）を使う全ランキング13本に及ぶ。内訳は `RankingBarChart`（`/reign` 1本・`/court-events` 5本・`/military` 3本・`/ages` 2本）と `DynastyAvgReignChart`・`DynastyDeathCauseChart`（`/dynasties` 2本）
- Uncertainty: M2・M3 で `kinship-chart.tsx` の端フェード実装を共有部品へ切り出す際、**`/kinship` の描画が変わってはいけない**（配置凍結中）。切り出しは純粋なリファクタリングに留める

## Design decision

**5件をまとめて1つの計画にする。** いずれもモバイル固有の実装漏れで、デザイン判断を含まない。分けると「どれを採用するか」の判断が5回発生するが、その判断に意味がない。

M2・M3 は**新しく作らず、`/kinship` の既存実装を共有部品に切り出して再利用する。** 同じ問題に対する解法がすでにサイト内にあり、しかも経緯（ユーザー指摘）まで記録されている。3つ目の実装を書く理由がない。

M1 は目盛りを「間引く」のではなく、**目盛り間隔の下限（40px）を満たす最小の step を選ぶ**形にする。値域と画面幅の両方で決まるため、どの画面幅でも重ならない。

## Reuse

- `src/components/kinship/kinship-chart.tsx:98-118`（`atStart` / `atEnd` を `ResizeObserver` 込みで管理するフック相当のロジック）と `:496-513`（端フェードと「横スクロールで続き →」バッジ）
- `src/components/timeline/river-timeline.tsx:513-515` の既存 `scrollRef` と `handleScroll`（`/timeline` 側はスクロール監視の土台が既にある）
- `integerTickValues`（`src/components/charts/nivo-theme.ts:81`）
- `chartWidth`（`src/components/charts/scroll-bar-chart.tsx:291-307` の `useChartWidth` が ResizeObserver で計測し、`:318` で `useRankingChartLayout` へ渡している。`:343` は利用箇所）
- Exemplar: `kinship-chart.tsx:496-513`

**新しいプリミティブが必要な理由**（M2・M3）: 横スクロールの手掛かりを必要とする面が3つ（系譜図・年表・章ジャンプ）あり、うち1つにしか実装がない。共有部品を作らないと同じコードが3つに増える。置き場所は `src/components/ui/` ではなく `src/components/charts/`（チャート系の横スクロール枠に固有の関心事のため）。共有すべき利用者は上記3面と、将来の横スクロールする表（`/reign` の復位者一覧など）。

## Changes

1. `src/components/charts/nivo-theme.ts:81-91`
   - Change: `integerTickValues(maxValue)` の第2引数に描画幅 `plotWidth` を足す。刻み候補（1・2・5・10・20・50・100…）を小さい順に試し、**目盛り本数 × 40px ≦ plotWidth** を最初に満たす step を選ぶ。`plotWidth` を渡さない呼び出しは現行と同じ挙動にする（後方互換）
   - Preserve: 目盛りが必ず整数であること、0 から始まり step の倍数で max 以下まで進むこと。**刻みに乗らない終端値（例: 最大62に対する62）は現行が意図的に省いている**（`nivo-theme.ts:78-79` のコメントに理由が記録されている）。この挙動を変えない
   - Verify: `/dynasties` を 390px で開いて目盛りが重ならない。1440px では現在と同じ本数のまま

2. `src/components/charts/scroll-bar-chart.tsx:336`
   - Change: `integerTickValues(maxValue)` に、左マージンを引いた実際の描画幅（`chartWidth - marginLeft - MARGIN_RIGHT`）を渡す
   - Preserve: `marginLeft` の算出式（`:340-343`）、`MARGIN_RIGHT`、`ROW_HEIGHT`、行ウィンドウイング（`useWindowedRows`）、量子化ウィンドウ、スクロール直後150msのホバー抑制、`TipOutlet` による state 分離、`gridXValues={ticks}`
   - Verify: 全ランキングチャートで目盛りとグリッド線が一致したまま本数だけ減る

3. `src/components/charts/horizontal-scroll-hint.tsx`（新規）
   - Change: `kinship-chart.tsx:98-118` の端検出ロジックと `:496-513` の描画を、`useHorizontalScrollEdges(ref)` フックと `<HorizontalScrollHint atStart atEnd />` 部品として切り出す。**マークアップと クラス名は一字も変えずに移す**
   - Preserve: `ResizeObserver` による再計算、`z-10`（フェード）と `z-20`（バッジ）の関係、`pointer-events-none`、`bg-gradient-to-r/l from-background to-transparent`、`w-10`、バッジの文言「横スクロールで続き →」
   - Verify: 単体で `/kinship` に戻したとき、描画が変更前と完全に一致する

4. `src/components/kinship/kinship-chart.tsx`
   - Change: 3 で切り出した部品を使う形に置き換える（純粋なリファクタリング）
   - Preserve: **描画結果が1ピクセルも変わらないこと。** ノード座標・章スタック・年ラベルの sticky オーバーレイ・`--kinship-minor` の配色・編集モードのオーバーレイ
   - Verify: 変更前後のスクリーンショットが一致する

5. `src/components/timeline/river-timeline.tsx:513-524`
   - Change: 既存の `scrollRef` に対して 3 のフックを当て、年表コンテナに端フェードとバッジを追加する。**`river-timeline.tsx` には `relative` な親が存在しない**（`:480` の `<div ref={chartAreaRef}>` は className なし）ため、`kinship-chart.tsx:125` の `relative rounded-md border …` に相当するラッパーを新設し、その中に `overflow-x-auto` のコンテナを収める
   - Preserve: `overscroll-x-contain`、`tabIndex={0}`・`role="application"`・`aria-label`（キーボード操作）、`onKeyDown` / `onBlur`、`handleScroll` によるラベルのクランプ処理（rAF の transform 更新）、`aria-live` の読み上げ、`focus-visible:outline-2`
   - Verify: 390px で「横スクロールで続き →」が出る。1440px で全体が収まっている場合は出ない。キーボード操作とツールチップが変わらない

6. `src/components/kinship/kinship-chapter-nav.tsx`
   - Change: 章ジャンプのピル行に 3 のフックと部品を当てる。行が横スクロールしていることを示す
   - Preserve: `sticky top-0 z-30`、`border-b border-border`、現在章の朱色ハイライト、章見出しへのジャンプ挙動、`src/app/kinship/page.tsx:74` のコメントにある固定バー高さと `:76` の `scrollMt={KINSHIP_NAV_H}` との整合
   - Verify: 390px で第4章が画面外にあることが分かる。1440px では手掛かりが出ない

7. `src/components/emperors/emperor-event-timeline.tsx:76-81`
   - Change: `summary` の直下を「`min-w-0 flex-1` で `head` を包むコンテナ」と「`ChevronRight`」の2要素にし、`summary` 自身は `flex flex-nowrap items-start` にする。`head` の中は現行どおり `flex flex-wrap` で折り返させる
   - Preserve: `KindBadge`、日付の `tabular-nums`、本文の `truncate`、`basis-48`、`group-open:rotate-90` の回転、`[&::-webkit-details-marker]:hidden`、`hasDetails` が false のときの分岐（この場合はシェブロンが無いので触らない）、開いた後の `facts` / `note` / `sourceLabel` の表示
   - Verify: 390px で `>` が単独行に落ちない。テキストが2行になってもシェブロンが縦中央に留まる

8. `src/components/timeline/river-timeline.tsx:482-510`
   - Change: 「表示範囲＋ズームボタン」と「時代へ移動＋時代ピル」を、それぞれ1つの `flex` コンテナに包んでから並べる。ラベルが対象から切り離されて折り返さないようにする
   - Preserve: `Button size="sm"` の `variant` 切り替えと `aria-pressed`、`jumpTo` の挙動、ピルのクラス（`design-plans/05` で `text-[11px]` → `text-micro` になる箇所）、`mb-3`
   - Verify: 390px で「時代へ移動」がピル群の直前に留まる。1440px で1行に収まる見た目が変わらない

## Scope

- Inherit: M1 は `scroll-bar-chart.tsx` の部品群を使う13本のランキング全部（`RankingBarChart` 11本＋`DynastyAvgReignChart`・`DynastyDeathCauseChart`）。M2・M3 は `/timeline`・`/kinship`
- Verify: `/kinship`（**描画が1ピクセルも変わらないこと**）、全ランキングの 1440px での見え方（目盛り本数が変わっていないこと）
- Exclude: `/reign` の復位者一覧テーブルの横切れ（同じ「手掛かりがない」問題だが、対象が `<table>` でチャート枠ではない。3 の部品が安定してから別途判断する）、ランキングの皇帝名の省略（`design-plans/01` の王朝色で緩和されるため単独対応しない）、円グラフのラベル切れ（`design-plans/06`）

## Validation

- Product: スマートフォンで年表と系譜図を開いたときに、右に続きがあることが分かる。グラフの目盛りが読める
- Interface: `design-plans/tools/capture-mobile.mjs` を再実行して12枚の連結シートを撮り直し、実装前に撮ったベースラインと比較する。とくに (a) `/dynasties` の目盛り (b) `/timeline` の右端バッジ (c) `/kinship` の章ナビ (d) `/emperors/han-wudi` のイベント行 (e) `/timeline` のコントロール行。あわせて `design-plans/tools/capture-desktop.mjs` の26枚も撮り直し、**デスクトップの見え方が変わっていないこと**を確認する
- System: 端フェードの実装が `horizontal-scroll-hint.tsx` の1箇所だけに存在すること（`rg 'bg-gradient-to-r from-background' src/` が新部品のみ）。`integerTickValues` の呼び出しが幅を渡す形に統一されていること
- Repository: `npx tsc --noEmit` → エラー0、`npm run lint` → エラー0、`npm run build` → 成功

## Stop conditions

- 4 で `/kinship` の描画が変更前と1ピクセルでも変わった場合は停止する。配置は凍結済みで、この計画は純粋なリファクタリングとしてしか触らない
- 5 で年表に端フェードを足した結果、`handleScroll` の rAF によるラベルのクランプ処理と干渉した場合は停止して報告する（フェードは `sticky` ではなく親の `absolute` に置く前提だが、年表は既に sticky なラベル層を持っている）
- 1 の刻み選択を変えた結果、`gridXValues` とグリッド線がずれた場合は停止する
- 7 で `summary` を `flex-nowrap` にした結果、日付が長い行（「前91年7月〜前91年8月」）でバッジが潰れる場合は停止して報告する

## Design documentation

- 受け入れ・検証後、`site/DESIGN.md` に追記する:
  - Layout 節 — 横スクロールする領域は、続きがあることを示す手掛かり（端のフェードと告知）を必ず伴う。共有部品から供給し、面ごとに書かない
  - 新規または Components 節 — チャートの軸目盛りは、値域だけでなく描画幅からも本数を決める。狭い画面で目盛りが重ならないことを実機幅で確認する
