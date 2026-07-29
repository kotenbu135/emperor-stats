# emperorstats デザインシステムの使い方

中国皇帝統計（emperorstats.com）の UI レイヤーです。**水墨文人**の世界観 — 宣紙色の地に墨色の文字、
差し色は印章の朱（`--seal`）ひとつだけ — で組んでください。派手な色面や複数のアクセント色は使いません。

## セットアップ

**Provider は不要です。** どのコンポーネントも単体で正しく描画されます。必要なのは 2 つだけ:

1. `styles.css` を読み込むこと。トークン・フォント・コンポーネント CSS はすべてこのファイルの
   `@import` 閉包に入っています（`_ds_bundle.css` を直接読み込まないでください）。
2. 明示的なダークモード切り替えは**ありません**。`.dark` は未定義なので、ダーク配色を前提にしないこと。

日本語主体のサイトです。本文は Noto Sans JP（`--font-sans`）、見出しは **Noto Serif JP**（`--font-serif`）。
見出しに明朝を当てるのがこの DS の最大の見分けどころで、`font-heading` を付け忘れた見出しは
「らしくない」仕上がりになります。

```jsx
<h2 className="font-heading text-xl font-semibold text-foreground">王朝別の平均在位年数</h2>
```

## スタイルの書き方 — Tailwind v4 のユーティリティ＋意味色トークン

素の色（`bg-gray-100`, `text-red-500`）は使いません。**必ず下の意味トークン**を使ってください。
`@theme inline` 経由で CSS 変数に解決されるので、配色を変えてもすべての画面が追随します。

| 用途 | クラス |
|---|---|
| 地・文字 | `bg-background` `text-foreground` |
| 面（カード・ポップオーバー） | `bg-card` `text-card-foreground` `bg-popover` `text-popover-foreground` |
| 主・副・抑制・強調 | `bg-primary` `text-primary-foreground` / `bg-secondary` `text-secondary-foreground` / `bg-muted` `text-muted-foreground` / `bg-accent` `text-accent-foreground` |
| 朱アクセント（印章） | `bg-seal` `text-seal` `text-seal-foreground` `border-seal` `ring-seal` |
| 破壊的操作・エラー | `bg-destructive` `text-destructive` `border-destructive` `ring-destructive` |
| 罫線・入力枠・フォーカス | `border-border` `border-input` `border-ring` `ring-ring` |
| 書体 | `font-sans` `font-heading` `font-mono` |
| 角丸 | `rounded-sm` `rounded-md` `rounded-lg` `rounded-xl` `rounded-2xl` `rounded-3xl` `rounded-4xl` |

**データ可視化の系列色**は専用パレットがあります（CVD 安全性を検証済み・地色 `#f5f1e8` で検証）。
カテゴリ分けにはこれを順に使ってください: `bg-series-1` 〜 `bg-series-8`（文字色は `text-series-1` 〜 `text-series-8`）。
グレースケール系の `bg-chart-1` 〜 `bg-chart-5` は王朝別の横断ビュー用の暫定色です。

数値は必ず `tabular-nums` を付けて桁を揃えます（年数・日数・順位が縦に並ぶ画面が多いため）。

```jsx
<span className="tabular-nums text-muted-foreground">61.9年</span>
```

## 朱の使いどころ

朱（`--seal`）は**一点差し**です。使ってよいのは次の 3 か所だけだと考えてください:

- 見出しの左に立てるアクセントバー（`PageHeader` / `Section` が内蔵しているもの）
- 統計タイルの上罫（`border-t-2 border-t-seal/70`）と、その数値（`text-seal`）
- リンクのホバー（`hover:text-seal`）

ボタンの主要アクションは朱ではなく `bg-primary`（墨色）です。朱をボタン全面に敷かないでください。

## 真実の所在

- **`styles.css` とその `@import` 先** — トークンの実際の値・`@theme` の定義はここにあります。
  配色や余白で迷ったら、要約ではなくこのファイルを読んでください。
- **`components/<group>/<Name>/<Name>.prompt.md`** — コンポーネントごとの props と用例。
- **`components/<group>/<Name>/<Name>.d.ts`** — props の型（唯一の API 契約）。

`window.EmperorStatsDS` に 20 のコンポーネントと、その下位パーツ（`CardHeader` `DialogFooter`
`SelectItem` `TableRow` など）が入っています。カード化されているのは
`Accordion` `Badge` `Button` `Card` `Command` `Dialog` `HoverCard` `Input` `InputGroup`
`Popover` `Select` `Separator` `Sheet` `Table` `Textarea`（汎用）と
`NavMenu` `PageHeader` `Section` `SiteFooter` `SiteShell`（レイアウト）です。

## 組み立ての例

ページの型は「`PageHeader` で入り、`Section` で区切り、中身をカードや表で見せる」です。

```jsx
<div className="min-h-screen bg-background">
  <PageHeader
    title="在位期間"
    description="始皇帝から宣統帝まで365人の在位年数を、正史の即位日・退位日から実日数で算出しています。"
  />
  <Section title="上位の皇帝" description="順位は同値同順位（competition ranking）。">
    <div className="grid gap-4 sm:grid-cols-3">
      <Card className="border-t-2 border-t-seal/70">
        <CardContent>
          <p className="text-xs text-muted-foreground">最長在位</p>
          <p className="mt-1 font-heading text-2xl font-semibold text-seal tabular-nums">61.9年</p>
          <p className="mt-1 text-xs text-muted-foreground">清・聖祖（康熙帝）</p>
        </CardContent>
      </Card>
    </div>
  </Section>
</div>
```

# EmperorStatsDS (site@0.1.0)

This design system is the published site React library, bundled as a single
browser global. All 20 components are the real upstream code.

## Where things are

- `_ds_bundle.js` — the whole-DS bundle at the project root; loads every component to `window.EmperorStatsDS`. First line is a `/* @ds-bundle: … */` metadata header.
- `styles.css` — the single stylesheet entry: it `@import`s the tokens, fonts, and component styles (`_ds_bundle.css`). Link this one file.
- `components/<group>/<Name>/<Name>.prompt.md` (example JSX + variants), `<Name>.d.ts` (types), `<Name>.html` (variant grid).
- `tokens/*.css` — CSS custom properties, names verbatim from upstream.
- `fonts/` — `@font-face` files + `fonts.css` (when the package ships fonts).

For a specific component, `read_file("components/<group>/<Name>/<Name>.prompt.md")`.

## Loading

Add these two lines to your page once (React must be on the page first):

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
```

Components are then available at `window.EmperorStatsDS.*`. Mount into a dedicated child node (e.g. `<div id="ds-root">`), not the host page's own React root, so the two trees don't collide:

```jsx
const { Accordion } = window.EmperorStatsDS;
ReactDOM.createRoot(document.getElementById('ds-root')).render(<Accordion />);
```

## Tokens

185 CSS custom properties from site. Names are
preserved verbatim from upstream. They are declared inside `_ds_bundle.css` (this DS ships one compiled stylesheet rather than separate token files).

- **color** (31): `--color-red-500`, `--color-gray-100`, `--color-black`, …
- **spacing** (5): `--tw-space-y-reverse`, `--tw-inset-shadow`, `--tw-inset-shadow-alpha`, …
- **typography** (10): `--font-sans`, `--font-serif`, `--font-weight-normal`, …
- **radius** (2): `--radius-md`, `--radius`
- **shadow** (7): `--tw-shadow`, `--tw-ring-shadow`, `--tw-shadow-alpha`, …
- **other** (130): `--spacing`, `--container-xs`, `--container-sm`, …

## Components

### general
- `Accordion`
- `Badge`
- `Button`
- `Card`
- `Command`
- `Dialog`
- `HoverCard`
- `Input`
- `InputGroup`
- `Popover`
- `Select`
- `Separator`
- `Sheet`
- `Table`
- `Textarea`

### layout
- `NavMenu`
- `PageHeader`
- `Section`
- `SiteFooter`
- `SiteShell`
