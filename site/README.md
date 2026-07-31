# 中国皇帝統計サイト（site/）

`../data/emperors.json`（始皇帝から溥儀まで365人・全12項目）を可視化する統計サイトです。
Next.js 16（App Router）+ Tailwind v4 + shadcn/ui で構築し、`output: "export"` による静的書き出しを GitHub Pages + カスタムドメイン [emperorstats.com](https://emperorstats.com) で配信します。

**このサイトは 2026-07-31 から作り替えの途中です。** トップページ（概要ダッシュボード）だけが新実装で完成し、
残りのページと外側のシェルは旧実装のまま。チャートも**トップは recharts（Tremor Blocks を vendoring）、
他は Nivo** の二本立てになっています。配色・見出しフォントも同日に全面差し替えました。
**触る前に [AGENTS.md](AGENTS.md) 冒頭の「現在の状態」を読んでください。**

## 開発

Node は nvm の v26.4.0 を使います。

```bash
source ~/.nvm/nvm.sh && nvm use 26.4.0
npm install
npm run dev        # http://localhost:3000/
npm run build      # 静的書き出し → out/
npm run lint
```

`predev`/`prebuild` で肖像画アセットが `public/portraits/` に同期されます（`scripts/sync-portraits.mjs`）。

## ドキュメント

- 開発時の注意点・アーキテクチャ・**現在の状態**: [AGENTS.md](AGENTS.md)
- いま有効な設計判断（2026-07-31 の再構築）: [design-plans/STACK_OPTIONS_2026-07-31.md](design-plans/STACK_OPTIONS_2026-07-31.md)
- レイアウト方針・規範: [../docs/site-design/LAYOUT.md](../docs/site-design/LAYOUT.md)（実装記録は同ディレクトリの PERFORMANCE.md・IMPLEMENTATION_LOG.md・REDESIGN_2026-07.md）。**配色・書体・トップ構成の節は 2026-07-31 に失効**しているので、冒頭の断り書きを読むこと
- `DESIGN.md` は**失効した旧設計契約**。配色・フォントの正は `src/app/globals.css`
- データセットのスキーマ: [../data/schema/](../data/schema/)
