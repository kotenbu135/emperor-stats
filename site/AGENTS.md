<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# サイト概要

`../data/emperors.json`（中国皇帝365人・全12項目）を可視化する統計サイト。Next.js 16（App Router / Turbopack）+ Tailwind v4 + shadcn/ui + Nivo。`output: "export"` で `out/` に静的書き出しし、GitHub Pages + カスタムドメイン **emperorstats.com**（`public/CNAME`）のルート直下で配信する。

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
- **ページ構成**: `/`（概要ダッシュボード）・`/timeline`（通史年表）・`/emperors`（一覧カード）・`/emperors/[id]`（皇帝個別ページ。`generateStaticParams` で全365名分を静的書き出し・deep-link用）・`/reign`・`/death-accession`・`/court-events`（改元・大赦・立后・皇太子廃立・遷都）・`/military`・`/ages`・`/dynasties`（王朝横断）・`/about`（収録基準・数え方・出典・免責事項）。
- **通史年表（`/timeline`）**: Nivoでなくdiv絶対配置の自前実装（`components/timeline/`）。データは `getTimelineData()`（ビルド時計算・収録皇帝のreigns[]の純粋な写像）。レーンは正統/非正統の2ブロック、座標は天文年（`astroYear`、0年なし対策）、px↔年変換を跨ぐ値は絶対astro年で持ち回す。総ノード数が小さいためウィンドウイング不要だが、ツールチップ/ダイアログ分離（`useTipOutlet`/`useDetailOutlet`）・transform配置・スクロール直後ホバー抑制は他チャート同様に踏襲。キーボード操作あり（`role="application"`・左右=同レーン移動/上下=並立王朝/Enter=拡大または詳細。フォーカス移動のプログラムスクロールでは `suppressTipClearRef` で tip 消去を1回抑制する）。設計・実装記録は `../docs/site-design/TIMELINE.md`。
- **`src/lib/base-path.ts` の `BASE_PATH` が単一情報源**（`next.config.ts` の basePath と肖像画 URL が共用）。カスタムドメイン移行済みのため現在は `""`。`next/image` は `images.unoptimized` 時に basePath を自動付与しないので、`public/` 配下を参照する箇所は必ず `BASE_PATH` を明示する。
- **チャート**: Nivo。ランキング系は 1 カラム＋グラフ内スクロールで全件表示（`scroll-bar-chart`）、スクロール枠内は `position: fixed` の自前ツールチップ（`emperor-tooltip`）を使う（Nivo 標準ツールチップは枠で切れる）。ホバー・クリックの当たり判定は Nivo のバー矩形でなく行全体を覆う `RowOverlay`（`scroll-bar-chart.tsx`）で受ける（バーが短い行でも操作できる。オーバーレイが SVG を覆うため Nivo 側の `onMouseEnter` 等は付けない）。皇帝ランキングは行クリック・「表で見る」の皇帝名クリックで全項目詳細ダイアログを開く（`emperors/emperor-detail-dialog.tsx` の `EmperorDetailDialog`。開閉 state は `useDetailOutlet` でチャートから分離。/emperors の一覧カードと共有）。ダイアログには `EmperorRecord.ranks`（`lib/emperors.ts` の `computeRanks` がビルド時計算）による全指標の順位が付く。ダイアログの表示本体は `emperors/emperor-detail-body.tsx`（`EmperorDetailBody`。`"use client"` なしの純表示部品）で、皇帝個別ページ `/emperors/[id]` と共用する — 項目を増減するときは必ずこの共用部品を変更する（ダイアログには個別ページへの共有リンクが付く）。**順位は同値同順位（competition ranking）で、チャートの行ラベル・表ビューも同方式** — 回数系は0回除外・年齢は判明者のみ・即位時年齢だけ若い順という対象と方向の定義を、チャート（`collapsesZeros`/`rankDirection`）と `RANK_DIRECTIONS` で必ず一致させること。軸は `nice: false` 必須。配色は `globals.css` の水墨文人パレット（`--seal` = 朱アクセント）と意味ベースの dataviz 配色。王朝ラベルは `dynasty.section` を直接表示せず `ERA_BY_SECTION` を使う。
- **チャートのパフォーマンス**: 364行チャートの全件 SVG 描画は TBT が秒単位になるため、(1) 各ページのチャートは `lazy-mount.tsx` の `LazyMount` で包み画面外はマウントしない、(2) スクロール棒グラフは `scroll-bar-chart.tsx` の `useWindowedRows` で可視行±オーバースキャンだけ Nivo に渡す。ウィンドウ範囲は `STEP_ROWS` 境界で量子化した state で持ち、境界をまたがないスクロールでは再レンダリングしない。スライスの縦位置は **`top` でなく `transform: translateY()`** で動かす（`top` 書き換えは layout-shift として CLS に計上される）。スクロール直後 150ms はホバーを無視する（`hoverAllowed()`）。**ホバーツールチップの state をチャートコンポーネントに持たない** — `useTipOutlet`＋`TipOutlet`（`scroll-bar-chart.tsx`）で分離する（`useState` に持つとバー／セグメント通過ごとに Nivo 全体が再レンダリングされ、実機 timespan で TBT 18 秒・遅延レイアウトシフトで CLS 1.1 を記録した）。「表で見る」の開閉も `TableDetails` で分離する。新しいランキング系チャートを追加するときはすべて踏襲すること（経緯: `../docs/site-design/LAYOUT.md`「実機Lighthouse timespanレポート」2節）。フィルタ行の `SelectTrigger` は必ず固定幅+`aria-label` 付き（自動幅はフォント読み込みで折り返しがずれ CLS になる。Nivo SVG には `ariaLabel`（pie はコンテナ `role="img"`）を付ける）。/emperors の一覧カードは `memo` 化した `EmperorCard`＋検索語 `useDeferredValue` を維持する。
- **レイアウト**: `site-shell` + `nav-menu`（デフォルト閉・見出し自体がリンク）+ `page-header`（記事型ページは `contained` prop で本文と同じ中央寄せ列に）+ `site-footer`（1行 flex-wrap・GitHub Issue への誘導リンク）。

# ハマりどころ

- **`.next` キャッシュ残存でハイドレーションが静かに失敗する**（コンソールエラーなし・画像404・フィルタ無反応）。basePath 等の設定変更後は `rm -rf .next` してから dev サーバーを再起動する。
- `name.commonName` が `null` のレコードが2件ある（データ側の申し送り事項）。表示は `emperors.ts` の `displayName()` フォールバックで回避済み。
- 旧バックログ（Nivo チャートの TBT・`/emperors` の LCP・CLS・a11y 2件）は 2026-07-18 に解消済み（Lighthouse: a11y 全ページ 100・perf 66〜100）。WSL2 上の Lighthouse は TBT を実測比 10〜20 倍に増幅するので、絶対値でなく相対比較+Long Task 実測で評価する。詳細は `../docs/site-design/LAYOUT.md` の「Lighthouse改善の実装」節。

# 設計記録

レイアウト・配色・実装判断の経緯と教訓は `../docs/site-design/LAYOUT.md` に時系列で記録している。大きめの UI 変更をしたら同ファイルに追記する。
