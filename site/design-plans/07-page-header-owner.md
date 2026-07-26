# トップページと404を PageHeader に載せ替えて、全ルートのページ見出しを1つの所有者に統一する

Written against: 1540d63

## Evidence chain

- Surface: `/`（概要ダッシュボード）と 404（`/this-route-does-not-exist` 等）
- Problem: この2ルートだけページ見出しの下に罫線がなく、見出し帯が他の11ルートと違って見える。サイトで最も見られるページが、他と違う入り方をしている
- Design evidence: `src/components/layout/page-header.tsx:17` の `PageHeader` が `border-b border-border bg-background px-6 py-8 md:px-10` を持つ共有所有者であり、`/about`・`/emperors`・`/emperors/[id]`・`/reign`・`/death-accession`・`/court-events`・`/military`・`/ages`・`/dynasties`・`/timeline`・`/kinship` の11ルートがこれを通っている
- Owner: `src/components/layout/page-header.tsx`
- Scope and affected surfaces: `src/app/page.tsx:47-57`（見出し 47-52＋説明 53-57）、`src/app/not-found.tsx:13-21`（見出し 13-18＋説明 19-21）
- Uncertainty: トップは本文列が `mx-auto max-w-4xl` で中央寄せ。`PageHeader` の `contained` / `containedWidth` を使う必要がある（`/emperors/[id]:106-109` が `contained containedWidth="max-w-4xl"` の先行例）

## Design decision

両ファイルで手書きしている見出しブロック（朱の縦バー＋`font-heading text-2xl font-semibold text-foreground md:text-3xl` の h1）を `PageHeader` の呼び出しに置き換える。

見出しブロック本体（朱バー＋h1）は `page-header.tsx:21-24` とバイト単位で同一で、周辺だけがずれている。`page.tsx:43` のラッパーは `bg-background px-6 py-8 md:px-10` で `border-b border-border` だけが落ちており、`not-found.tsx:12` はそれに加えて `flex flex-col items-start gap-4` が乗っている。説明文の `<p>` も `PageHeader` の `mt-2 max-w-2xl text-sm text-muted-foreground`（`page-header.tsx:27`）に対し、`page.tsx:53` は `mt-3 … leading-relaxed`、`not-found.tsx:19` は `mt-2` も `max-w-2xl` も持たない。

つまり意図的な差分ではなく、`PageHeader` を作る前に書かれたものが取り残されている。新しいバリアントを足すのではなく、既存の所有者に載せ替える。

## Reuse

- `PageHeader`（`src/components/layout/page-header.tsx`）の `title` / `description` / `contained` / `containedWidth`
- Exemplar: `src/app/emperors/[id]/page.tsx:106-109`（`contained` + `containedWidth="max-w-4xl"` の使い方）

新しいプリミティブは不要。

## Changes

1. `src/app/page.tsx`
   - Change: 47-52行目の `<div className="flex items-center gap-3">…</h1></div>` と 53-57行目の `<p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">` を、`<PageHeader contained containedWidth="max-w-4xl" title="中国皇帝統計" description={...} />` に置き換える。`description` には現在の説明文（`始皇帝から溥儀まで、…${stats.emperorCount}名の統計情報を可視化したサイトです。`）をそのまま渡す。`PageHeader` は自前で `px-6 py-8 md:px-10` を持つため、外側の `<div className="bg-background px-6 py-8 md:px-10">` からページ見出し分の padding を外し、StatTile グリッド以降を包む形に組み替える
   - Preserve: `JsonLd`（`websiteJsonLd()`）の出力位置、`stats.emperorCount` の埋め込み、StatTile グリッドと SITE_SECTIONS カードの `mx-auto max-w-4xl` 中央寄せ、`mt-8` の間隔
   - Verify: 見出し帯の下に他ルートと同じ罫線が出る。見出しと StatTile が同じ列幅・同じ中心に揃う

2. `src/app/not-found.tsx`
   - Change: 13-18行目の見出しブロックと 19-21行目の `<p className="text-sm text-muted-foreground">` を `<PageHeader title="ページが見つかりません" description="お探しのページは移動または削除された可能性があります。" />` に置き換える。「概要ダッシュボードへ戻る」ボタンは `PageHeader` の下に残す
   - Preserve: `metadata`（`robots: { index: false, follow: true }`）、`Button variant="outline" asChild` のリンク
   - Verify: 罫線が出る。ボタンが見出し帯の外側に置かれている

## Scope

- Inherit: `/` と 404 のみ
- Verify: `PageHeader` に変更を入れないこと（他11ルートに影響が出ていないこと）
- Exclude: `Section`（h2）側、`SiteShell`、`SiteFooter`、StatTile の朱色・`border-t-seal/70`

## Validation

- Product: どのページから入っても同じ見出しの出方をする
- Interface: `/` と 404 を 1440px・375px で開き、罫線・見出しサイズ・左右の余白が `/reign`・`/about` と一致すること。トップでは見出しと StatTile グリッドの左端が揃っていること
- System: `PageHeader` の props だけで表現できており、`className` による上書きを足していないこと
- Repository: `npx tsc --noEmit` → エラー0、`npm run lint` → エラー0、`npm run build` → 成功

## Stop conditions

- トップの中央寄せが `PageHeader` の `contained` で再現できない場合は停止して報告する（`max-w-4xl` は `/emperors/[id]` で実績があるので通るはずだが、`bg-background` の帯の広がり方が変わる可能性がある）
- 404 ページで Next.js の `not-found` が `SiteShell` の外側で描画される構成だった場合は停止する

## Design documentation

- 受け入れ・検証後: `docs/site-design/LAYOUT.md` に「ページタイトルは必ず `PageHeader` から供給する（手書きの h1 を作らない）」を1行追記する
