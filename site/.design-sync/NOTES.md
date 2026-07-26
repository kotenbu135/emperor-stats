# design-sync のリポジトリ固有メモ

`site` は **Next.js アプリであってコンポーネントライブラリではない**。この前提から来る制約が
ほとんどすべてなので、再同期の前に必ず読むこと。

## ビルドまわり

- **`dist/` も shipped `.d.ts` も無い**（`private: true` / `main`・`exports`・`types` なし）。
  そのため `--entry .design-sync/ds-entry.tsx` を渡し、`componentSrcMap` で 20 件を明示している。
  コンバータ既定の「`.d.ts` から export を拾う」経路は 0 件になるので当てにしない。
  → `exported PascalCase symbols: 0` は正常。
- **Node は nvm の v26.4.0**（`source ~/.nvm/nvm.sh && nvm use 26.4.0`）。`.nvmrc` は無い。
  ロックファイルは `package-lock.json`（`npm ci`）。
- コンバータの依存は `.ds-sync/` に隔離してある（`esbuild` / `ts-morph` / `@types/react` /
  `playwright` / `@tailwindcss/cli`）。この npm は install スクリプトを既定でブロックするので、
  `npm approve-scripts esbuild` / `playwright` が必要。忘れると esbuild のバイナリが無い、
  chromium が起動しないという形で出る。
- ビルドコマンド（4 手順・順番が重要）:

  ```bash
  source ~/.nvm/nvm.sh && nvm use 26.4.0
  cd site
  ./.ds-sync/node_modules/.bin/tailwindcss -i .design-sync/tailwind-entry.css -o .design-sync/compiled/ds.css
  node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./node_modules \
    --entry ./.design-sync/ds-entry.tsx --out ./ds-bundle
  ```

## CSS — ここが一番の落とし穴

- コンバータの CSS 段は**スタイルシートをコピーして `@import` を並べるだけで、CSS ツールチェーンを
  一切走らせない**。`src/app/globals.css` をそのまま `cssEntry` に指定すると `@import "tailwindcss"` が
  未解決のまま上がり、**全プレビューが無スタイルで描画される**。
  → `.design-sync/tailwind-entry.css` を先にコンパイルし、その出力 `.design-sync/compiled/ds.css` を
  `cssEntry` にしている。**プレビューを書き足したら必ず CSS を再コンパイルしてからビルドする**
  （Tailwind v4 は JIT なので、新しく使ったクラスは再コンパイルしないと出力に存在しない）。
- 同じ理由で `@source inline(...)` の safelist を `tailwind-entry.css` に置いている。設計エージェントは
  アプリが使っていない組み合わせ（`bg-series-3` など）も使うため。**この safelist を削ると
  `conventions.md` が「存在しないクラス名」を教えることになる**。
- `--font-sans` / `--font-serif` はアプリでは `next/font` が実行時に注入している。DS 側には
  next のランタイムが無いので `tailwind-entry.css` の `:root` で定義し直し、Google Fonts の
  リモート `@import` で実体を供給している。

## next/* の混入

- `layout/` の 4 件（NavMenu / PageHeader / SiteFooter / SiteShell）は `next/link`・`next/image` に
  依存する。これらの module body が `process.env.__NEXT_*` を評価するため、素のブラウザでは
  `ReferenceError: process is not defined` で **IIFE 全体が eval 時に落ち、`window.EmperorStatsDS` が
  未定義になる**（症状は「全 20 件がブランク」）。
  → `.design-sync/ds-process-shim.ts` を `ds-entry.tsx` の**先頭で** import して `globalThis.process`
  を空 env で用意している。この import 行を動かさないこと。
- 副作用としてバンドルに next の内部モジュールが入り、約 830KB になっている。

## 収録スコープ

- 収録は `src/components/ui`（15 件）と `src/components/layout`（5 件・PageHeader.tsx が
  `PageHeader` と `Section` の 2 つを export）の計 20 件。
- `charts/` `emperors/` `kinship/` `tables/` `timeline/` は**意図的に除外**。`../data/emperors.json`
  由来のデータと Nivo に密結合していて、デザインエージェントの実行環境では描画できない。
  収録範囲を広げたくなったら、まずこの前提が変わったかを確認すること。
- グループ名は src のディレクトリ名から導出される。`ui` は汎用ディレクトリ名として無視されるため
  15 件は `general` に落ちる。細かく分けたい場合は `docsMap` にカテゴリ frontmatter だけの
  スタブ `.md` を置く（未実施）。

## プレビュー

- 11 件を作り込み（Accordion / Badge / Button / Card / Command / Dialog / Input / PageHeader /
  Section / Select / Table）、残り 9 件はフロアカード。
- `Select` の `SelectContent` は既定が `position="item-aligned"` で、選択中の項目がトリガーに
  重なる位置に開く。素の状態でキャプチャすると**上下が切れる**ので、
  `OpenWithGroups` は高さ 300px の枠に入れている。
- オーバーレイ・広幅コンポーネントは `cfg.overrides` でカードモードを指定済み
  （Dialog=single / Select=single / Table=column / PageHeader=column / Section=column）。
- **プレビュー内の数値は `data/emperors.json` の実測値**（365 人・最長 61.9 年・平均 9.9 年・
  死因の内訳・han-wudi の各項目）。このリポジトリは数値の正確さが売りなので、
  プレビューでも作り話の統計を出さないこと。
- `Command` の `EmptyState` は項目ゼロで空状態を直接描いている（検索絞り込みの結果ではない）。
- ホバー・ドラッグ・フォーカスリング等の動的状態は静的キャプチャできないため未収録。

## 既知の render warn（再同期時に「新規」と読まないこと）

- `[RENDER_BLANK]` / `[RENDER_THIN]` がフロアカードの 9 件に出ることがある。フロアカードは
  「まだプレビューを書いていない」の意で、故障ではない。

## 再同期のリスク（次回に見るべきところ）

- **フォントがリモート依存**。Google Fonts の `@import` が届かない環境では見出しがゴシックに落ちる。
  自己ホストに切り替えるなら `cfg.extraFonts` に woff2 を渡す。
- **next の内部 API 依存**。Next のバージョンを上げると `process.env.__NEXT_*` 以外のグローバル
  （`window.next` など）を読み始める可能性がある。layout/ の 4 件がブランクになったら真っ先に疑う。
- **Tailwind の safelist は手書き**。`globals.css` にトークンを足したら
  `tailwind-entry.css` の `@source inline` と `conventions.md` の表を両方更新する。
- `shadcn/ui` を更新して `src/components/ui/*.tsx` の props が変わると `.d.ts` が変わる。
  プレビューの grade は自動で無効化されるので、そのとき作り直す。
- 収録 20 件の `.d.ts` は synth-entry 由来で、published package の型より弱い。
  `dtsPropsFor` で補える。
