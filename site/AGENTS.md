<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# サイト概要

`../data/emperors.json`（中国皇帝364人・全12項目）を可視化する統計サイト。Next.js 16（App Router / Turbopack）+ Tailwind v4 + shadcn/ui + Nivo。`output: "export"` で `out/` に静的書き出しし、GitHub Pages + カスタムドメイン **emperorstats.com**（`public/CNAME`）のルート直下で配信する。

# コマンド

Node は nvm の v26.4.0（`source ~/.nvm/nvm.sh && nvm use 26.4.0`）。テストは無い。

```bash
npm run dev        # http://localhost:3000/（basePath なし）
npm run build      # 静的書き出し → out/
npm run lint       # ESLint
npx tsc --noEmit   # 型チェック
```

`predev`/`prebuild` で `scripts/sync-portraits.mjs` が走り、`../docs/site-design/mockups/card-preview/` の肖像画 webp を `public/portraits/` に同期する。

# アーキテクチャ

- **データ読み込みはビルド時のみ**: `src/lib/emperors.ts` が `fs` で `../data/emperors.json` と肖像画 `manifest.json` を直接読み、集計関数群を提供する。各ページ（`src/app/*/page.tsx`）は Server Component で集計し、`"use client"` のチャート/フィルタコンポーネントへ props で渡す。この **Server/Client 境界**を崩さないこと（クライアント側から `emperors.ts` を import しない）。
- **ページ構成**: `/`（概要ダッシュボード）・`/emperors`（一覧カード）・`/reign`・`/death-accession`・`/court-events`（改元・大赦・立后・皇太子廃立・遷都）・`/military`・`/ages`・`/dynasties`（王朝横断）・`/about`（収録基準・数え方・出典・免責事項）。
- **`src/lib/base-path.ts` の `BASE_PATH` が単一情報源**（`next.config.ts` の basePath と肖像画 URL が共用）。カスタムドメイン移行済みのため現在は `""`。`next/image` は `images.unoptimized` 時に basePath を自動付与しないので、`public/` 配下を参照する箇所は必ず `BASE_PATH` を明示する。
- **チャート**: Nivo。ランキング系は 1 カラム＋グラフ内スクロールで全件表示（`scroll-bar-chart`）、スクロール枠内は `position: fixed` の自前ツールチップ（`emperor-tooltip`）を使う（Nivo 標準ツールチップは枠で切れる）。軸は `nice: false` 必須。配色は `globals.css` の水墨文人パレット（`--seal` = 朱アクセント）と意味ベースの dataviz 配色。王朝ラベルは `dynasty.section` を直接表示せず `ERA_BY_SECTION` を使う。
- **チャートのパフォーマンス**: 364行チャートの全件 SVG 描画は TBT が秒単位になるため、(1) 各ページのチャートは `lazy-mount.tsx` の `LazyMount` で包み画面外はマウントしない、(2) スクロール棒グラフは `scroll-bar-chart.tsx` の `useWindowedRows` で可視行±12行だけ Nivo に渡す（スライスを `top = start×ROW_HEIGHT` に絶対配置すれば全件描画と行位置が一致する）。新しいランキング系チャートを追加するときは両方を踏襲すること。フィルタ行の `SelectTrigger` は必ず固定幅+`aria-label` 付き（自動幅はフォント読み込みで折り返しがずれ CLS になる。Nivo SVG には `ariaLabel`（pie はコンテナ `role="img"`）を付ける）。
- **レイアウト**: `site-shell` + `nav-menu`（デフォルト閉・見出し自体がリンク）+ `page-header`（記事型ページは `contained` prop で本文と同じ中央寄せ列に）+ `site-footer`（1行 flex-wrap・GitHub Issue への誘導リンク）。

# ハマりどころ

- **`.next` キャッシュ残存でハイドレーションが静かに失敗する**（コンソールエラーなし・画像404・フィルタ無反応）。basePath 等の設定変更後は `rm -rf .next` してから dev サーバーを再起動する。
- `name.commonName` が `null` のレコードが2件ある（データ側の申し送り事項）。表示は `emperors.ts` の `displayName()` フォールバックで回避済み。
- 旧バックログ（Nivo チャートの TBT・`/emperors` の LCP・CLS・a11y 2件）は 2026-07-18 に解消済み（Lighthouse: a11y 全ページ 100・perf 66〜100）。WSL2 上の Lighthouse は TBT を実測比 10〜20 倍に増幅するので、絶対値でなく相対比較+Long Task 実測で評価する。詳細は `../docs/site-design/LAYOUT.md` の「Lighthouse改善の実装」節。

# 設計記録

レイアウト・配色・実装判断の経緯と教訓は `../docs/site-design/LAYOUT.md` に時系列で記録している。大きめの UI 変更をしたら同ファイルに追記する。
