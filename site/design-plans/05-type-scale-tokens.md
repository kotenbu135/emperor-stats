# 承認されたタイポ・スペーシングのスケールを、実体のある分だけコードに落とす

Written against: 1540d63

> `site/DESIGN.md` に記載済みのスケール（typography 6段・spacing 5段）をコードへ反映する計画。
> **スケールの全段をトークン化はしない。** 既存の Tailwind 既定値と一致する段にトークンを足すと、
> 同じ値に2つの名前ができて、かえって揺れる。実体があるのは下記の2点だけ。

## Evidence chain

- Surface: 全ルート
- Problem: 承認されたスケールのうち、既存の Tailwind 既定値に対応するものがない段が1つある（`{typography.micro}` = 0.6875rem）。その結果、チャートやツールチップの極小テキストが `text-[9px]` から `text-[13px]` まで**7種類の生ピクセル値**で書かれている。またスケールを供給すべき共有コンポーネント（`PageHeader` / `Section`）自身が余白を裸の数値クラスで持っており、契約がコードから読めない
- Design evidence:
  - `site/DESIGN.md` Typography 節「サイズは6段に限る」「`{typography.micro}` はチャートとSVG内のラベル専用であり、これ以外の用途に生のピクセル値を書かない」
  - `site/DESIGN.md` Layout 節「余白も5段に限る」「これらの余白は共有の見出し・セクションコンポーネントが供給する」
  - 実測: `text-[10px]` 8件・`text-[11px]` 6件・`text-[10.5px]` 4件・`text-[9.5px]` 2件・`text-[9px]` 1件・`text-[13px]` 1件・`text-[11.5px]` 1件
- Owner: `src/app/globals.css`（`@theme inline`）、`src/components/layout/page-header.tsx`
- Scope and affected surfaces: `river-timeline.tsx:504,897,919`、`kinship-chart.tsx:512`、`emperor-detail-body.tsx:194`、`emperor-tooltip.tsx:72`、`page-header.tsx`
- Uncertainty: **`/kinship` の生px値は SVG の内外を問わず触ってはいけない。** `src/lib/kinship/layout.ts:265-267` の `LABEL_CHAR_W`（値11・「皇帝カプセルの1行目(text-[11px])の1文字あたりの概算幅」）は `:2139` で「固定幅のカプセルに通用名を併記して収まるか」の判定にのみ使われる。ノード座標自体は別の値から決まるため崩れるのは配置ではなく**ラベルのはみ出し**だが、いずれにせよ `/kinship` は配置凍結中で見た目を変えられない

## Design decision

**実体のある2点だけを入れる。**

1. `--text-micro`（0.6875rem = 11px）を `@theme` に足し、**SVG の外にあり、かつ `/kinship` の凍結対象でない**極小テキスト6箇所をこれに揃える。10px は日本語の可読性の下限を割っており、11px に統一すると読めるようになる

   SVG の外にある生px指定は全部で8箇所ある。うち `kinship-chart.tsx:138,153` の `text-[10.5px]`（年ラベルの sticky オーバーレイ。`<svg>` の開始は164行なのでHTML側）は **`/kinship` の見た目を変えるため対象外**とする（下記 Changes 4 参照）。
2. `PageHeader` / `Section` の余白を `--spacing-*` トークン経由にする。この2つがサイト全体の余白を供給する所有者なので、ここだけ名前で書けば契約がコードに現れる

**入れないもの**: `--text-body`（0.875rem）・`--text-caption`（0.75rem）・`--text-title`（1.5rem）・`--text-section`（1.25rem）・`--text-subsection`（1rem）は、Tailwind 既定の `text-sm` / `text-xs` / `text-2xl` / `text-xl` / `text-base` と**同じ値**になる。トークンを足すと1つの値に2つの名前ができ、どちらを書くべきか揺れる。DESIGN.md が段を定義している以上、コード側は既定クラスのままでよい。

**`/kinship` の生px値は残す**（SVG内14箇所＝`kinship-chart.tsx` 7件・`kinship-legend.tsx` 7件、SVG外のオーバーレイ2箇所＝`kinship-chart.tsx:138,153`）。ラベル幅の見積もりと結合しており、`/kinship` は配置凍結中。DESIGN.md に明示的な例外として記録する。

## Reuse

- Tailwind v4 の `@theme` によるトークン定義（`src/app/globals.css:7-59` の既存の書き方）
- 既存の `--radius` からの派生パターン（`--radius-sm: calc(var(--radius) * 0.6)` など）
- Exemplar: `src/app/globals.css:15-22`（`--color-series-1` 〜 `8` を `@theme inline` に並べている書き方）

新しいプリミティブは不要。

## Changes

1. `src/app/globals.css`（`@theme inline` 内）
   - Change: `--text-micro: 0.6875rem;` を足す
   - Preserve: 既存の `--color-*`・`--font-*`・`--radius-*` の定義、`:root` のパレット、`@layer base` の各ルール
   - Verify: `text-micro` ユーティリティが生成される

2. `src/components/timeline/river-timeline.tsx:504`
   - Change: 時代ジャンプのピルの `text-[11px]` を `text-micro` にする
   - Preserve: `rounded-full border border-border px-2.5 py-0.5 font-heading font-medium text-foreground/70 transition-colors hover:border-seal hover:text-seal`
   - Verify: 見た目が変わらない（同値のため）

3. `src/components/timeline/river-timeline.tsx:897,919`
   - Change: `text-[10px]` を `text-micro` にする（10px → 11px。わずかに大きくなる）
   - Preserve: `mt-1.5 text-muted-foreground/70`、「クリックでたたむ」の文言
   - Verify: ツールチップ内の補助文が読みやすくなる。ツールチップの幅が広がって画面外へはみ出さない

4. `src/components/kinship/kinship-chart.tsx:512`
   - Change: 横スクロール告知バッジの `text-[11px]` を `text-micro` にする（同値なので見た目は変わらない）。**これは SVG の外側の `<span>` であり、ノードにも年ラベルにも関係しない**
   - Preserve: `pointer-events-none absolute right-2 top-2 z-20 rounded-full border border-border bg-background/90 px-2 py-0.5 text-muted-foreground`。**同ファイルの他の生px値は一切触らない** — SVG 内の `<text>`（`:277,:316,:348,:368,:468,:469,:480`）に加え、**SVG外だが年ラベルのオーバーレイである `:138,:153` の `text-[10.5px]` も対象外**（11px に上げると `/kinship` の見た目が変わる）。`kinship-legend.tsx` の7件も同様に触らない
   - Verify: `/kinship` のノード配置が1ピクセルも変わらない

5. `src/components/emperors/emperor-detail-body.tsx:194`
   - Change: `text-[10px]` を `text-micro` にする
   - Preserve: `block leading-tight text-muted-foreground`、8項目の回数グリッドのレイアウト
   - Verify: 順位の補助表記（「332名中3位タイ」等）が読みやすくなる。グリッドの行高が崩れない

6. `src/components/charts/emperor-tooltip.tsx:72`
   - Change: `text-[10px]` を `text-micro` にする
   - Preserve: `mt-1.5 text-muted-foreground/70`、`position: fixed` の自前ツールチップの寸法計算
   - Verify: 全ランキングチャートのホバーで確認。ツールチップが画面端で切れない

7. `src/components/layout/page-header.tsx:17,55`
   - Change: `px-6 py-8 md:px-10` を `--spacing-*` 由来のクラスに置き換える（`@theme` に `--spacing-gutter: 1.5rem; --spacing-gutter-wide: 2.5rem; --spacing-section: 2rem;` を足したうえで `px-gutter py-section md:px-gutter-wide`）。`Section` の `mt-6`（:67）を `mt-block` にする
   - Preserve: `border-b border-border bg-background`、`contained` / `containedWidth` の挙動、`scroll-mt-20` と `scrollMt` prop の分岐、朱の縦バーの寸法（`h-7 w-1` / `h-5 w-1`）
   - Verify: 全ルートで余白が1ピクセルも変わらない（同値のため）

## Scope

- Inherit: `PageHeader` / `Section` を通す11ルート、上記6ファイル
- Verify: `/kinship`（**ノード配置が変わらないこと**）、`/timeline`（ストリームラベルの位置が変わらないこと）、全ランキングチャートのツールチップ
- Exclude: `src/components/ui/` 配下の shadcn プリミティブ（`button.tsx:27` の `text-[0.8rem]` を含む。ベンダーコードで再取得時に上書きされる）、`/kinship`・`/timeline` の SVG `<text>` 内の生px値、`text-sm` / `text-xs` / `text-base` / `text-xl` / `text-2xl` の既存呼び出し

## Validation

- Product: ツールチップと補助表記が読める大きさになる。新しくコードを書くとき、極小サイズの選択肢が1つしかない
- Interface: `/timeline`（ツールチップ・時代ジャンプ）・`/emperors/han-wudi`（回数グリッドの順位表記）・`/reign`（ホバーのツールチップ）・`/kinship`（バッジとノード）を 1440px・375px で確認。**`/kinship` は変更前後のスクリーンショットが一致すること**
- System: `rg 'text-\[[0-9.]+px\]' src/` の結果が **`kinship-chart.tsx`（`:138,:153` のオーバーレイ＋SVG内7件）・`kinship-legend.tsx`（7件）・`lib/kinship/layout.ts` のコメント のみ**になること。`river-timeline.tsx`・`emperor-detail-body.tsx`・`emperor-tooltip.tsx` の一致は0件になる（`river-timeline.tsx` の SVG テキストは `fontSize={10}` 等の数値属性でこの正規表現には当たらない）。同じ値に2つの名前を作っていないこと（`--text-body` などを足していないこと）
- Repository: `npx tsc --noEmit` → エラー0、`npm run lint` → エラー0、`npm run build` → 成功

## Stop conditions

- `/kinship` の描画が変更前と1ピクセルでも変わった場合は停止する。配置は凍結済み
- 10px → 11px でツールチップの幅が広がり、画面端での位置補正が破綻した場合は停止して報告する
- `--spacing-*` トークンの導入で Tailwind の `--spacing()` 関数（`card.tsx:15` の `[--card-spacing:--spacing(4)]`）と競合した場合は停止する

## Design documentation

- 受け入れ・検証後、`site/DESIGN.md` に追記する:
  - Typography 節 — `/kinship`・`/timeline` の SVG 内ラベルは、レイアウト計算と結合しているため段の適用外とする（明示的な例外）
  - Layout 節 — 余白トークンは `PageHeader` / `Section` が供給し、他は既定クラスで同値を書く
