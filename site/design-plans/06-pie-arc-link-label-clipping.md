# 円グラフの外側ラベルがコンテナ左右で切れないようにする

Written against: 1540d63

## Evidence chain

- Surface: `/death-accession`（死因別分布・即位経路別分布の2枚）
- Problem: `arcLinkLabel` が描画領域からはみ出して切り落とされ、ラベルが読めない。実レンダリングで「処刑 10%」→「刑 10%」、「受禅（易姓）5%」→「姓）5%」、「継承（経緯記載なし）5%」→「し）5%」
- Design evidence: `docs/site-design/LAYOUT.md:175`「4スロットはコントラストWARNのため凡例+**直接ラベル表示**で緩和」。同じ判断が `src/components/charts/nivo-theme.ts:41` にも「コントラストWARNの4色（橙・青緑・黄・桃）は直接ラベル＋表ビューで緩和（dataviz skillの緩和条件）」と記録されている。直接ラベルが読めることは、この配色を採用した際の前提条件になっている
- Owner: `src/components/charts/category-pie-chart.tsx:138`（`margin={{ top: 28, right: 32, bottom: 28, left: 32 }}`）
- Scope and affected surfaces: `/death-accession`（2枚）。`CategoryPieChart` の他の利用箇所があれば同時に効く
- Uncertainty: 最長ラベル「継承（経緯記載なし） 5%」は日本語で13文字あり、`text-[12px]` 相当で約160px。左右 margin をいくつにすれば全ラベルが収まるかは実測が必要（下記 Validation で確認する）

## Design decision

左右の margin を最長ラベルが収まる幅まで広げる。ラベルを省略・改行して短くする方向は取らない。「継承（経緯記載なし）」のような区分名はこのサイト固有の概念で、短縮すると意味が伝わらないため。

2カラムグリッド（`md:grid-cols-2`）の中で描画されるため、margin を広げると円自体は小さくなる。円の視認性よりラベルの可読性を優先する（円の大きさは中央の総数表示と `innerRadius` で十分に読める）。

## Reuse

- `src/components/charts/category-pie-chart.tsx` の既存 `margin` prop
- `nivoTheme`（`src/components/charts/nivo-theme.ts`）のフォントサイズ定義（ラベル幅の算出根拠）
- Exemplar: 同ファイル内の `arcLinkLabelsSkipAngle={4}` — すでに「小さすぎるスライスはラベルを出さない」判断が入っている

新しいプリミティブは不要。

## Changes

1. `src/components/charts/category-pie-chart.tsx:138`
   - Change: `margin` の `left` / `right` を、最長カテゴリ名＋パーセント表記が収まる値に広げる。まず `left: 120, right: 120` から始め、Validation で全ラベルの描画を確認しながら最小値まで詰める
   - Preserve: `top` / `bottom`、`innerRadius`、`padAngle`、`cornerRadius`、`arcLinkLabelsSkipAngle`、`CenteredTotal` レイヤー、`colorMap` による配色、ツールチップの `width: max-content` 対策
   - Verify: `/death-accession` の両チャートで、全カテゴリの `arcLinkLabel` がコンテナ内に完全に収まる

2. `src/components/charts/category-pie-chart.tsx`（同ファイル・必要な場合のみ）
   - Change: 1440px 幅の2カラムでは収まるが 375px 幅では円が潰れる場合、`height` と連動した margin の出し分けを入れる
   - Preserve: 既存の `height` prop の受け取り方
   - Verify: 375px 幅で円が視認可能な大きさを保っている

## Scope

- Inherit: `CategoryPieChart` を使う全サーフェス
- Verify: `/death-accession` desktop（1440）・mobile（375）
- Exclude: 凡例（`entries.map` の HoverCard 行）・`darkSlices` のラベル色反転・`/dynasties` の積み上げ横棒（別コンポーネント）

## Validation

- Product: 死因・即位経路の内訳を、凡例を見に行かずに円だけで読み取れる
- Interface: `/death-accession` を 1440px と 375px で開き、死因8カテゴリ・即位経路9カテゴリの全ラベルが欠けずに描画されること。とくに最長の「継承（経緯記載なし）」と、左端に来る「処刑」「受禅（易姓）」
- System: margin 以外のチャート設定に手を入れていないこと。`nivoTheme` を変更していないこと
- Repository: `npx tsc --noEmit` → エラー0、`npm run lint` → エラー0、`npm run build` → 成功

## Stop conditions

- margin を広げた結果、375px 幅で円の直径が 160px を下回る場合は停止して報告する（モバイルでは別の解法——ラベルを外側リンクから内側に切り替える等——の判断が要る）
- `arcLinkLabelsSkipAngle` を上げてラベル自体を減らす解法に切り替えたくなった場合は停止する。それは「直接ラベルで緩和」という配色前提を壊す

## Design documentation

- 受け入れ・検証後: `docs/site-design/LAYOUT.md` の該当節（:175）に「直接ラベルが収まる左右 margin を確保すること（円グラフを狭い列に置く場合の前提）」を追記する
