# 中国皇帝統計サイト（site/）

`../data/emperors.json`（始皇帝から溥儀まで365人・全12項目）を可視化する統計サイトです。
Next.js 16（App Router）+ Tailwind v4 + shadcn/ui + Nivo で構築し、`output: "export"` による静的書き出しを GitHub Pages + カスタムドメイン [emperorstats.com](https://emperorstats.com) で配信します。

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

- 開発時の注意点・アーキテクチャ: [AGENTS.md](AGENTS.md)
- レイアウト・設計判断の記録: [../docs/site-design/LAYOUT.md](../docs/site-design/LAYOUT.md)
- データセットのスキーマ: [../data/schema/](../data/schema/)
