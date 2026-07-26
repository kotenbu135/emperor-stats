# `h-screen` を `h-dvh` に直し、重なりの段を明文化する

Written against: 1540d63

> `baseline-ui` の機械的チェックで残った MUST 違反のうち、設計判断を伴わないものをまとめる。
> 小さい計画なので、`design-plans/02` と同じコミットに含めてよい。

## Evidence chain

- Surface: 全ルート（サイドバー）、`/kinship`・`/emperors`・チャートのスクロール枠
- Problem:
  1. デスクトップのサイドバーが `h-screen` を使っている。`100vh` はモバイルブラウザのツールバー伸縮で実際の表示高と一致しない
  2. `z-index` に名前付きの段が存在せず、`z-10` / `z-20` / `z-30` / `z-50` が箇所ごとに直接書かれている。どの層が何を意味するかがコードから読めない
- Design evidence: `baseline-ui`「**NEVER** use `h-screen`, use `h-dvh`」「**MUST** use a fixed z-index scale (no arbitrary `z-*`)」
- Owner: `src/components/layout/site-shell.tsx`（1）／所有者なし（2）
- Scope and affected surfaces:
  1. `src/components/layout/site-shell.tsx:66`（1箇所のみ）
  2. `emperor-grid.tsx:323`（時代見出しのスティッキー・`z-10`）、`kinship-chapter-nav.tsx:54`（章ナビのスティッキー・`z-30`）、`kinship-chart.tsx:134,147`（年ラベルのstickyオーバーレイ・`z-20`）・`:503,510`（横スクロールの端フェード・`z-10`）・`:512`（横スクロール告知バッジ・`z-20`）、`scroll-bar-chart.tsx:474`（固定ツールチップ・`z-50`）、`kinship-editor.tsx:793`（編集パネル・`z-50`）の**自前コード5ファイル**
- Uncertainty: `ui/` 配下の shadcn プリミティブ（`sheet` / `dialog` / `popover` / `select` / `hover-card`）も `z-50` を直接書いているが、これらはベンダーコードで `npx shadcn` の再取得で上書きされる。**リネームの対象に含めない**

## Design decision

1. `h-screen` を `h-dvh` に置き換える。現状は `md:block` のサイドバー内にあるためモバイルでの実害は限定的だが、規則違反であり1文字の修正で消せる
2. `z-index` は**リネームしない**。層の意図を DESIGN.md に文章として記録するにとどめる

2 の判断理由: 現在の値は場当たりに見えて、実際にはコード内のコメントで意図が説明されている（`kinship-chart.tsx:133`「横スクロールの端フェード(z-10)より上に出すため」、`:499`「年ラベルのstickyオーバーレイ(z-20)より下(z-10)に敷く」）。名前付きスケールへ移すと、shadcn 側の `z-50` と自前コードの命名が混在し、かえって読み解きにくくなる。**規則を満たすためだけに5ファイルを触る価値がない。** 代わりに層の定義を DESIGN.md に置き、新しい重なりを足すときの判断基準にする。

## Reuse

- Tailwind の `h-dvh`
- 既存の `z-10` / `z-20` / `z-30` / `z-50` の値（変更しない）
- Exemplar: `src/components/kinship/kinship-chart.tsx:133,499` のコメント（層の関係を書き残す既存の書き方）

新しいプリミティブは不要。

## Changes

1. `src/components/layout/site-shell.tsx:66`
   - Change: `sticky top-0 flex h-screen flex-col overflow-y-auto px-4 py-6` の `h-screen` を `h-dvh` にする
   - Preserve: `sticky top-0`、`overflow-y-auto`、`px-4 py-6`、外側 `aside` の `hidden shrink-0 border-r border-border bg-sidebar md:block md:w-60`、サイトマーク＋タイトルのリンクと `NavMenu`
   - Verify: デスクトップでサイドバーの高さと内部スクロールが変わらない。ブラウザ幅を `md` 境界の前後で変えても崩れない

2. z-index を使っている自前コード5ファイル
   - Change: **変更しない**
   - Preserve: 現在の値とコメント
   - Verify: 重なりの見え方が変わっていないこと

## Scope

- Inherit: 全ルートのサイドバー
- Verify: `/kinship`（章ナビのスティッキーとチャートのオーバーレイ）、`/emperors`（時代見出しのスティッキー）
- Exclude: `src/components/ui/` 配下の shadcn プリミティブ全般

## Validation

- Product: サイドバーの高さがどの環境でも表示領域と一致する
- Interface: 全ルートを 1440px と 375px で開き、サイドバー（md 以上）とモバイルヘッダーの切り替わりが変わらないこと。`/kinship` で章ナビが年ラベルより上に出続けること
- System: `rg 'h-screen' src/` が空。z-index を触っていないこと
- Repository: `npx tsc --noEmit` → エラー0、`npm run lint` → エラー0、`npm run build` → 成功

## Stop conditions

- `h-dvh` に変えた結果、サイドバーのスティッキー挙動が変わった場合は停止して報告する（`dvh` はスクロールに応じて再計算されるため、`sticky` との組み合わせで挙動が変わる環境がある）

## Design documentation

- 受け入れ・検証後、`site/DESIGN.md` の `## Layout` 節に重なりの段を記載する:
  - 本文の上に重なるスティッキーな索引（時代見出し・章ナビ）が最下段
  - スクロール枠の端を示すフェードとその上のラベルが中段
  - 画面に固定されるツールチップ・ダイアログ・ポップオーバーが最上段
  - 新しい重なりは既存のどの段に属するかを決めてから値を選ぶ。段の外に新しい値を作らない
