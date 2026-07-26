# サブセクション見出し（h3）のサイズを1つに統一する

Written against: 1540d63

## Evidence chain

- Surface: `/about`、`/emperors/[id]`、詳細ダイアログ、ランキング上位10名テーブル
- Problem: h2 配下の小見出しという同じ役割に対して、`/about` は `text-base`、他の5箇所は `text-sm` を使っている。`text-sm` は本文と同じサイズであり、実レンダリングで `/emperors/[id]` の「即位の経緯」「死因の経緯」は見出しとして立っていない
- Design evidence: 同一役割に対する user-facing presentation の直接矛盾。`/about` の「在位年数」「死因」は本文より明確に大きく描画され、`/emperors/[id]` の同階層の見出しは本文と同じ大きさで描画される
- Owner: なし（h3 に共有所有者が存在せず、各サーフェスが直接クラスを書いている）
- Scope and affected surfaces: `src/app/about/page.tsx:44`（`text-base`）、`src/app/emperors/[id]/page.tsx:180`、`src/components/emperors/emperor-narrative.tsx:61,120`、`src/components/emperors/emperor-detail-body.tsx:206`、`src/components/tables/top-ranked-table.tsx:32`（いずれも `text-sm`）
- Uncertainty: この計画の根拠は `site/DESIGN.md` の `typography.subsection`（1rem）である。**スケールはユーザー承認済みで DESIGN.md に記載済みのため、この計画は単独で実施できる。** ただしトークンの導入（`design-plans/05`）を先に済ませたほうが、`text-micro` 以外の生px整理と同じ回の変更にまとまる

## Design decision

`text-base`（1rem）に統一する。

`text-sm` 側に寄せる案は取らない。`text-sm` は本文サイズであり、見出しと本文が同一サイズになると階層が失われる。実レンダリングでその状態が起きているのが `/emperors/[id]` で、これは矛盾の解消ではなく劣化の追認になる。

`CardTitle`（`src/components/ui/card.tsx`）がすでに `font-heading text-base font-medium` を使っており、「カード見出し＝1rem」は共有プリミティブ側に存在する。h3 をここに合わせることでサイト全体の見出し階層が h1 1.5rem → h2 1.25rem → h3/カード 1rem → 本文 0.875rem と単調になる。

## Reuse

- `CardTitle`（`src/components/ui/card.tsx:36-46`）の `font-heading text-base leading-snug font-medium` — 同じ視覚的重さの先行例
- `Section`（`src/components/layout/page-header.tsx:36-69`）の h2 — 上位階層の基準
- Exemplar: `src/app/about/page.tsx:44`（`mt-6 font-heading text-base font-semibold text-foreground`）

新しいプリミティブは作らない。h3 の共有コンポーネント化は、`/about` が `mt-6` を伴い他は伴わないなど周辺の余白が揃っていないため、タイポグラフィ・スケール確定後に別途判断する。

## Changes

1. `src/app/emperors/[id]/page.tsx:180`
   - Change: `text-sm` を `text-base` にする
   - Preserve: `font-heading font-semibold text-foreground`、周囲の余白
   - Verify: 直下の本文（`text-sm`）より明確に大きい

2. `src/components/emperors/emperor-narrative.tsx:61` と `:120`
   - Change: 同上
   - Preserve: 「即位の経緯」「死因の経緯」の見出し文言、出典行の体裁、`<details>` の開閉
   - Verify: 個別ページと詳細ダイアログの両方で反映される

3. `src/components/emperors/emperor-detail-body.tsx:206`
   - Change: 同上
   - Preserve: ダイアログ内のスクロール領域の高さ、`text-[10px]` の補助ラベル（`:194`）はこの計画では触らない
   - Verify: ダイアログを開いた状態で見出しが立つ

4. `src/components/tables/top-ranked-table.tsx:32`
   - Change: 同上
   - Preserve: 「在位期間の上位10名」等のタイトル文言、2カラムの表レイアウト、`tabular-nums`
   - Verify: `/reign`・`/ages`・`/military`・`/court-events` の全ランキング直下で反映される

5. `src/app/about/page.tsx:44`
   - Change: 変更しない（すでに `text-base`）
   - Preserve: `mt-6`
   - Verify: 他4箇所と同じ大きさで描画される

## Scope

- Inherit: 上記5ファイル、および `TopRankedTable` を使う4ルート
- Verify: `/about`（変わらないこと）・`/emperors/[id]`・詳細ダイアログ・`/reign`
- Exclude: h1（`PageHeader`）・h2（`Section`）・`CardTitle`・`/emperors` の時代見出し（`emperor-grid.tsx:319` のスティッキーな索引ラベルで、階層見出しではない）・SVG 内の生px指定（`/kinship`・`/timeline`）

## Validation

- Product: 個別ページの「即位の経緯」「死因の経緯」が、スクロール中に見出しとして拾える
- Interface: `/emperors/han-wudi` と `/about` を 1440px・375px で開き、h3 が同じ大きさで、直下の本文より大きいこと。375px で見出しが2行に折り返しても崩れないこと
- System: 5箇所すべてが同じクラス列になっていること。`text-sm` の h3 が残っていないこと（`rg '<h3[^>]*text-sm' src/` が空）
- Repository: `npx tsc --noEmit` → エラー0、`npm run lint` → エラー0、`npm run build` → 成功

## Stop conditions

- `site/DESIGN.md` の frontmatter に `typography.subsection: 1rem` が存在しない場合は停止する。スケールが先に決まらないと「1rem」が根拠を持たない
- 詳細ダイアログで見出しを大きくした結果、既定の高さで本文が見えなくなる場合は停止して報告する

## Design documentation

- 受け入れ・検証後: `site/DESIGN.md` の Typography 節に「h2 配下の小見出しは本文より1段大きい（`typography.subsection` = 1rem。Tailwind 既定の `text-base` と同値のため専用トークンは作らない）」を記載する
