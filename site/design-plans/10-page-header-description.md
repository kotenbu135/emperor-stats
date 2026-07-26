# 統計ページのリード文の有無を揃える

Written against: 1540d63

## Evidence chain

- Surface: `/reign`・`/death-accession`・`/military`
- Problem: 統計6ページのうちこの3つだけ `PageHeader` に `description` を渡しておらず、タイトル直下が空の帯になる。同じ「統計ページ」でヘッダーの高さと重さが揃っていない
- Design evidence: `PageHeader`（`src/components/layout/page-header.tsx:26-30`）の `description` prop。**12ルート中8ルート**（`/about`・`/ages`・`/court-events`・`/dynasties`・`/emperors`・`/emperors/[id]`・`/kinship`・`/timeline`）が渡している。残る4ルートのうち3つが本計画の対象で、`/`（トップ）は `PageHeader` 自体を使っていない（`design-plans/07` の対象）
- Owner: `src/components/layout/page-header.tsx`
- Scope and affected surfaces: `src/app/reign/page.tsx:28-30`、`src/app/death-accession/page.tsx:29-31`、`src/app/military/page.tsx:49`
- Uncertainty: **反証がある**。`/reign` と `/military` はどちらも各 `Section` 側に説明文を持っており（`reign/page.tsx:34,55`、`military/page.tsx` の `sections` 配列）、ページ冒頭との重複を避けて意図的に省いた可能性がある。また「8/12 が渡している」という反復自体は設計上の契約ではない。**この計画は `design-plans/06`〜`09` の4件より根拠が弱く、実施しない判断も同じだけ妥当**

## Design decision

3ページに `description={sectionDescription("<path>")}` を渡す。

文言を新しく書かない。`sectionDescription()` は3ファイルとも `metadata` 用にすでに同一ファイル内で import・使用済みで（例 `src/app/reign/page.tsx:13,18`）、トップページのセクションカードに出ている説明文と同じ文字列を返す。つまり「このページが何か」の一文は既に確定していて、ページ本文にだけ出ていない状態にある。

`Section` 側の説明と重複するのではないかという懸念に対しては、粒度が違うと整理する：`PageHeader` の説明は「このページは何を集計したものか」、`Section` の説明は「この節の数え方はどうか」。`/ages`・`/dynasties`・`/court-events` は既に両方を持っており、重複して読めていない。

## Reuse

- `PageHeader` の `description` prop
- `sectionDescription()`（`src/lib/seo.tsx`）— トップのセクションカードと `metadata.description` の単一情報源
- Exemplar: `src/app/court-events/page.tsx:75-78`（`title` + `description` の両方を渡し、配下の各 `Section` も個別説明を持つ構成）

新しいプリミティブは不要。

## Changes

1. `src/app/reign/page.tsx:28-30`
   - Change: `<PageHeader title="在位データ" />` に `description={sectionDescription("/reign")}` を追加する
   - Preserve: `BreadcrumbJsonLd`、`metadata`、2つの `Section` とそれぞれの `description`、`LazyMount` の `estimatedHeight`
   - Verify: タイトル直下にリード文が出て、罫線までの余白が `/dynasties` と揃う

2. `src/app/death-accession/page.tsx:29-31`
   - Change: 同様に `description={sectionDescription("/death-accession")}` を追加する
   - Preserve: `ChartTakeaway` を2列グリッドの上に1本だけ置く構成（`src/app/death-accession/page.tsx:32-33` のコメントに記録された判断・実体は 34-36行）、`grid gap-10 md:grid-cols-2`
   - Verify: リード文と `ChartTakeaway` が二重の総括にならず読めること

3. `src/app/military/page.tsx:49`
   - Change: `<PageHeader title="軍事" />` に `description={sectionDescription("/military")}` を追加する
   - Preserve: `sections.map` による3セクションの生成と各 `description`
   - Verify: 3つのランキングの前に、ページ全体の説明が1本入る

## Scope

- Inherit: 上記3ルートのみ
- Verify: `/court-events`・`/ages`・`/dynasties`（変わらないこと）
- Exclude: `/`・404（`design-plans/07-page-header-owner.md` の対象）、`/kinship`・`/timeline`・`/emperors`・`/about`（既に `description` を持つ）

## Validation

- Product: どの統計ページを開いても、最初の1文でそのページが何の集計かが分かる
- Interface: `/reign`・`/death-accession`・`/military` を 1440px・375px で開き、ヘッダーの高さと構成が `/ages`・`/dynasties` と揃うこと。`description` は `max-w-2xl` で折り返されるため、375px で3行を超えて縦に伸びすぎないこと
- System: 文言をハードコードしておらず `sectionDescription()` 経由であること。`metadata.description` と同じ文字列が出ていること
- Repository: `npx tsc --noEmit` → エラー0、`npm run lint` → エラー0、`npm run build` → 成功

## Stop conditions

- `sectionDescription()` が返す文字列が、そのページの `Section` の説明とほぼ同一だった場合は停止して報告する。その場合は「意図的な省略だった」という反証が正しかったことになり、この計画は破棄すべき
- `/death-accession` で `PageHeader` の説明と `ChartTakeaway` が同じ内容を2回言う形になった場合も停止する

## Design documentation

- 受け入れ・検証後: `docs/site-design/LAYOUT.md` に「統計ページは `PageHeader` に `sectionDescription()` のリード文を必ず渡す（節ごとの数え方の説明は `Section` 側に置く）」を1行追記する
