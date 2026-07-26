# カードに面を与え、触れたときに持ち上がるようにする

Written against: 1540d63

> この計画はユーザーの要望「今のデザインに古臭さを感じる／長く滞在しようという気になれない」に対する
> `baseline-ui` の分析結果に基づく。世界観（水墨文人）は変えない。

## Evidence chain

- Surface: 全ルート。とくに `/`（StatTile 6枚＋セクションカード8枚）、`/emperors`（皇帝カード365枚）、`/emperors/[id]`
- Problem: カードが背景と同じ色で、1px の罫線と角丸だけで存在を示している。奥行きが一切なく、2010年代前半の「囲み枠」レイアウトに見える。さらに hover が色の変化だけで、触れた手応えが返ってこない
- Design evidence:
  - `src/app/globals.css:70,72` — `--background: #f5f1e8` と `--card: #f5f1e8` が**同一値**
  - `src/components/ui/card.tsx:15` — `border border-border bg-card` のみで影を持たない
  - 全サイトの `shadow-*` は16件（`shadow-md` 10・`shadow-none` 4・`shadow-lg` 2）。影を実際に出す12件は Popover / Dialog / ツールチップと、`kinship-editor.tsx:793` のレイアウト編集パネル。**コンテンツのカードには1件もない**
  - 全サイトの `hover:*` は91件で、内訳は色の変化（`hover:text-seal` 39・`hover:bg-muted` 11・`hover:border-seal` 7 ほか）と下線（`hover:underline` 6）のみ。**`transform` を伴う hover は1件も存在しない**（rg で0件）
  - `baseline-ui`「SHOULD use Tailwind CSS default shadow scale unless explicitly requested」「MUST animate only compositor props」「NEVER exceed 200ms for interaction feedback」「SHOULD respect prefers-reduced-motion」
  - `site/DESIGN.md:91`「面の区別は色相ではなく明度で行い、サイドバー・モバイルヘッダー・オフキャンバスメニューには生成り `{colors.sidebar}` を当てて本文の面と分ける。」— 明度で面を分ける方針は確立しており、この計画はその反対側（1段明るい面）を埋める
- Owner: `src/app/globals.css`（`--card`）、`src/components/ui/card.tsx`（`Card`）
- Scope and affected surfaces: `Card` を使う全サーフェス、`src/components/emperors/emperor-grid.tsx:65`（皇帝カードは `Card` を使わず直接クラスを書いている）、`src/components/emperors/youtube-embed.tsx:38`
- Uncertainty: `--card` を明るくすると `--popover` との差がなくなる（現在は両方 `#f5f1e8`）。Popover / Dialog は影と枠を持つため面の色で区別する必要はないが、Dialog 内に `Card` を置いた場合の見え方は実物で確認が要る

## Design decision

**面の明度を3段にし、静止時の奥行きは色だけで、動きは hover にだけ与える。**

`--sidebar`（`#ede7d8`・1段暗い）< `--background`（`#f5f1e8`・地）< `--card`（1段明るい）という3段にする。宣紙の上に紙を重ねた関係で、水墨文人の世界観と矛盾しない。すでにサイドバーで「明度で面を分ける」方針は実装されており、その反対側を埋めるだけになる。

静止状態には影を足さない。影を常時置くと、365枚のカードが並ぶ `/emperors` で画面がざらつき、抑制的という世界観から外れる。**影は hover のときだけ、1段だけ**出す。

hover は `transform: translateY(-1px)` と影1段の組み合わせにする。`baseline-ui` の制約（compositor プロパティのみ・200ms 以内・`prefers-reduced-motion` 対応）に収める。色の変化（`hover:border-seal/60` など）は既存のものをそのまま残し、動きを重ねる。

## Reuse

- `--sidebar`（`src/app/globals.css:108`）— 明度で面を分ける既存の実装
- Tailwind 既定の `shadow-sm`（`baseline-ui` の指定どおり既定スケールから選ぶ）
- `Card` / `CardHeader` / `CardTitle` / `CardContent`（`src/components/ui/card.tsx`）
- `cn`（`src/lib/utils.ts`）
- Exemplar: `src/components/emperors/emperor-grid.tsx:65`（`group block … transition-colors hover:border-seal/60 focus-visible:outline-2`）— hover とフォーカスの既存の書き方

新しいプリミティブは不要。`Card` に新しいバリアントも足さない。

## Changes

1. `src/app/globals.css:72-73`
   - Change: `--card` を `#faf7f0`（地色 `#f5f1e8` より約2%明るい）にする。`--card-foreground` は据え置く
   - Preserve: `--background`・`--sidebar`・`--popover`・`--secondary`・`--muted`・`--border` の各値。`--seal` の用途
   - Verify: カードが地色から浮いて見える。`--sidebar` < `--background` < `--card` の明度順になっている

2. `src/components/ui/card.tsx:15`
   - Change: `Card` のクラスに `transition-transform duration-150 ease-out motion-reduce:transition-none` を足す。影と移動はここでは付けない（静止カードは動かないため）
   - Preserve: `--card-spacing` の仕組み、`data-[size=sm]` バリアント、`has-data-[slot=card-footer]:pb-0`、`overflow-hidden rounded-md border border-border bg-card`、`*:[img:first-child]:rounded-t-md`
   - Verify: 見た目が変わらない（トランジションの土台を入れるだけ）

3. `src/app/page.tsx:96` のセクションカード（`SITE_SECTIONS` を回している箇所）
   - Change: 既存の `transition-colors hover:border-seal/60` に `hover:-translate-y-px hover:shadow-sm motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none` を足す
   - Preserve: `hover:border-seal/60` の色変化、カード内の `CardTitle` / `CardDescription` / 「見る」ボタン、`mx-auto max-w-4xl` の中央寄せ
   - Verify: ホバーで1px 持ち上がり、影が1段出る。150ms 以内に落ち着く

4. `src/components/emperors/emperor-grid.tsx:65`（`EmperorCard`）
   - Change: `transition-colors` を `transition-[transform,border-color] duration-150 ease-out motion-reduce:transition-none` にし、`hover:-translate-y-px hover:shadow-sm motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none` を足す。`bg-background` を `bg-card` にする
   - Preserve: `memo` 化、`group` と `group-hover:text-seal`、`focus-visible:outline-2 focus-visible:outline-ring`、`overflow-hidden rounded-md`、3:4 の固定枠、肖像の `object-fit: cover` + `object-position: top`
   - Verify: 365枚のカードでスクロールが引っかからない（`transform` のみのため再レイアウトは起きない）

5. `src/components/emperors/youtube-embed.tsx:38`
   - Change: 同様に `transition-colors` へ `transform` を足し、`hover:-translate-y-px` を付ける
   - Preserve: facade → iframe の差し替え挙動、`border-border/60`、`hover:bg-secondary/60`
   - Verify: 動画のある40名の個別ページで確認

6. StatTile（`src/app/page.tsx:17-37`）
   - Change: 変更しない（クリックできない表示専用のため hover を付けない）
   - Preserve: `border-t-2 border-t-seal/70`、朱の数値
   - Verify: `--card` の変更で地色から浮くこと。それ以上の装飾を足していないこと

## Scope

- Inherit: `Card` を使う全サーフェス、`/emperors` の365枚、`/` のセクションカード
- Verify: `/emperors/[id]` の情報テーブル・詳細ダイアログ（`bg-card` の変更が読みづらさを生んでいないか）、`/kinship` のノードカプセル（`--card` を参照していないこと）
- Exclude: Dialog / Sheet / Popover / HoverCard / Select（既に影と枠を持つ）、ツールチップ、`--sidebar` の面、チャートの描画

## Validation

- Product: トップと一覧をスクロールしたときに、カードが紙の重なりとして読める。カードに触れると反応が返る
- Interface: `/`・`/emperors`・`/emperors/han-wudi` を 1440px・375px で開く。(a) カードが地色から分離して見えること (b) hover で1px 持ち上がり影が1段出ること (c) OS の「視差効果を減らす」を有効にした状態で移動と影が出ないこと (d) `/emperors` を高速スクロールしてもカクつかないこと
- System: 影は Tailwind 既定スケールの `shadow-sm` のみを使っていること。`transition` の対象が `transform` と `border-color` に限られ、`width`/`height`/`top`/`margin` を含まないこと。新しいカードバリアントを作っていないこと
- Repository: `npx tsc --noEmit` → エラー0、`npm run lint` → エラー0、`npm run build` → 成功

## Stop conditions

- `/emperors` で hover の `transform` がスクロール性能に影響した場合は停止して報告する。365枚は行ウィンドウイングの対象外（グリッドは全件 DOM に載る）ため、実機で確認が要る
- `--card` を明るくした結果、肖像なしカードの淡彩モノグラム（`design-plans/01` で導入）とのコントラストが不足する場合は停止する。01 の実施後にこの計画を当てるなら、モノグラムの混合比の再調整が要る
- Dialog 内に置かれた `Card` が背景から浮きすぎる場合は停止して報告する

## Design documentation

- 受け入れ・検証後、`site/DESIGN.md` に以下を記載する:
  - Colors 節 — 面は3段（サイドバー < 地 < カード）で、明度だけで区別する
  - 新規 `## Elevation & Depth` 節 — 静止状態に影を置かない。影は操作に応答する要素の hover 時に1段だけ出す。動きは `transform` と `opacity` に限り、150ms を超えない。`prefers-reduced-motion` では移動と影を出さない
  - frontmatter — `--card` の新しい値
