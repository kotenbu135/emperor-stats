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

`predev`/`prebuild` で `scripts/sync-portraits.mjs` が走り、`../docs/site-design/mockups/card-preview/` の肖像画 webp を `public/portraits/` に同期し、sharp で 320px 幅サムネを `public/portraits/thumb/` に生成する（`components/emperors/portrait.tsx` の `Portrait` が素の `<img srcset="thumb 320w, full 360w">` で出し分ける。`images.unoptimized` の `next/image` は srcset を出せないため）。

# アーキテクチャ

- **データ読み込みはビルド時のみ**: `src/lib/emperors.ts` が `fs` で `../data/emperors.json`・肖像画 `manifest.json`・`../data/emperor-videos.json`（皇帝↔YouTube動画の目視確認済みマッチング。`../data/youtube-playlist.json` と合成し `EmperorRecord.videos` を生成）を直接読み、集計関数群を提供する。各ページ（`src/app/*/page.tsx`）は Server Component で集計し、`"use client"` のチャート/フィルタコンポーネントへ props で渡す。この **Server/Client 境界**を崩さないこと（クライアント側から `emperors.ts` を import しない）。
- **/emperors 一覧のペイロード分離**: 一覧グリッドのクライアント props は軽量な `EmperorListRecord`（カード表示・検索・絞り込み用の10フィールドのみ）に限定し、フルの `EmperorRecord`（ranks・videos込み）は詳細ダイアログを開いた時に `/emperor-records/{id}`（`app/emperor-records/[id]/route.ts` の Route Handler が静的書き出しする1人約2KBのJSON・拡張子なし）を fetch して取得する（`emperor-grid.tsx` が `Map` キャッシュ＋最新要求idの一致確認つきで実装。経緯noteの `public/emperor-notes/{id}.json` lazy fetch と同じ方式）。**一覧の props にフルレコードを戻すと RSC ペイロードが約420KB太る**ので、カードに表示項目を増やすときは `EmperorListRecord` へ必要フィールドだけ足すこと（経緯: `../docs/site-design/LAYOUT.md`「/emperors のRSCペイロード軽量化」節）。
- **ページ構成**: `/`（概要ダッシュボード）・`/timeline`（通史年表）・`/emperors`（一覧カード）・`/emperors/[id]`（皇帝個別ページ。`generateStaticParams` で全365名分を静的書き出し・deep-link用）・`/reign`・`/death-accession`・`/court-events`（改元・大赦・立后・皇太子廃立・遷都）・`/military`・`/ages`・`/dynasties`（王朝横断）・`/about`（収録基準・数え方・出典・免責事項）。
- **通史年表（`/timeline`）**: 第2世代「大河ビュー」（`components/timeline/river-timeline.tsx`・SVG自前実装）。87王朝を約35本の「流れ」+群雄クラスター（クリックで構成政権に開閉）に集約し、縦=地理（上:北方/中央:統一の座/下:南方）・帯の太さ=唯一在位（統一）で描く。データは `getRiverTimelineData()`（構築ロジックは `lib/timeline-river.ts`。**キュレーション表 `STREAM_DEFS` が全dynastyKeyを被覆することをビルド時にassertするため、皇帝を追加収録したら必ずこの表へ追記する**。ラベル等の人数表記は手書きせず `emperorCount` から導出する）。座標は天文年（`astroYear`、0年なし対策）、px↔年変換を跨ぐ値は絶対astro年で持ち回す。ズーム時のストリームラベル・皇帝名は `data-clamp-min/max` 属性を scroll の rAF で transform 更新してスパン内へクランプ（React再レンダリングなし）。ツールチップ/ダイアログ分離（`useTipOutlet`/`useDetailOutlet`）・スクロール直後ホバー抑制は他チャート同様に踏襲。キーボード操作あり（`role="application"`・左右=同じ段/上下=並立/Enter=拡大・詳細・クラスター開閉。フォーカス移動のプログラムスクロールでは `suppressTipClearRef` で tip 消去を1回抑制する）。「表で見る」（`timeline-table.tsx`）は旧 `getTimelineData()` のまま。設計・実装記録は `../docs/site-design/TIMELINE.md`「第2世代（大河ビュー）」。
- **`src/lib/base-path.ts` の `BASE_PATH` が単一情報源**（`next.config.ts` の basePath と肖像画 URL が共用）。カスタムドメイン移行済みのため現在は `""`。`next/image` は `images.unoptimized` 時に basePath を自動付与しないので、`public/` 配下を参照する箇所は必ず `BASE_PATH` を明示する。
- **チャート**: Nivo。ランキング系は 1 カラム＋グラフ内スクロールで全件表示（`charts/scroll-bar-chart.tsx`）、スクロール枠内は `position: fixed` の自前ツールチップ（`charts/emperor-tooltip.tsx`）を使う（Nivo 標準ツールチップは枠で切れる）。ホバー・クリックの当たり判定は Nivo のバー矩形でなく行全体を覆う `RowOverlay`（`scroll-bar-chart.tsx`）で受ける（バーが短い行でも操作できる。オーバーレイが SVG を覆うため Nivo 側の `onMouseEnter` 等は付けない）。皇帝ランキングは行クリック・「表で見る」の皇帝名クリックで全項目詳細ダイアログを開く（`emperors/emperor-detail-dialog.tsx` の `EmperorDetailDialog`。開閉 state は `useDetailOutlet` でチャートから分離。/emperors の一覧カードと共有）。ダイアログには `EmperorRecord.ranks`（`lib/emperors.ts` の `computeRanks` がビルド時計算）による全指標の順位が付く。ダイアログの表示本体は `emperors/emperor-detail-body.tsx`（`EmperorDetailBody`。`"use client"` なしの純表示部品）で、皇帝個別ページ `/emperors/[id]` と共用する — 項目を増減するときは必ずこの共用部品を変更する（ダイアログには個別ページへの共有リンクが付く）。個別ページは `wide` prop で lg 以上2カラム（基本情報｜回数系）の広幅表示になり、ページ送り（前後の皇帝）は本文の長さに影響されない先頭右端の固定サイズボタン+本文末尾の名前付き nav の2箇所。動画がある皇帝（40名）は `EmperorDetailBody` 内に関連動画セクションが表示される（ダイアログでは `details` 折りたたみ・既定閉、`wide` ではグリッド展開）。YouTube公式iframeを即座に埋め込むとperf影響が大きいため、`emperors/youtube-embed.tsx`（`YoutubeEmbed`）で小サムネイル+タイトルのコンパクトな行のfacadeを出し、クリック時だけ全幅のiframeに置き換える（派手なサムネイルがページを支配しないよう行型リスト。タイトルの定型プレフィックス「【ゆっくり解説】」は `emperors.ts` の `videoDisplayTitle` でビルド時に除去）。動画はすべて当サイトと無関係の外部チャンネルの制作物のため、セクション冒頭と `/about` に必ず制作者表記を出す — チャンネル名・URLの単一情報源は `lib/video-channel.ts` の `VIDEO_CHANNEL` 定数（`data/emperor-videos.json` の `meta.channel` と同内容）。**順位は同値同順位（competition ranking）で、チャートの行ラベル・表ビューも同方式** — 回数系は0回除外・年齢は判明者のみ・即位時年齢だけ若い順という対象と方向の定義を、チャート（`collapsesZeros`/`rankDirection`）と `RANK_DIRECTIONS` で必ず一致させること。軸は `nice: false` 必須。配色は `globals.css` の水墨文人パレット（`--seal` = 朱アクセント）と意味ベースの dataviz 配色。王朝ラベルは `dynasty.section` を直接表示せず `ERA_BY_SECTION` を使う。
- **チャートのパフォーマンス**: 364行チャートの全件 SVG 描画は TBT が秒単位になるため、(1) 各ページのチャートは `lazy-mount.tsx` の `LazyMount` で包み画面外はマウントしない、(2) スクロール棒グラフは `scroll-bar-chart.tsx` の `useWindowedRows` で可視行±オーバースキャンだけ Nivo に渡す。ウィンドウ範囲は `STEP_ROWS` 境界で量子化した state で持ち、境界をまたがないスクロールでは再レンダリングしない。スライスの縦位置は **`top` でなく `transform: translateY()`** で動かす（`top` 書き換えは layout-shift として CLS に計上される）。スクロール直後 150ms はホバーを無視する（`hoverAllowed()`）。**ホバーツールチップの state をチャートコンポーネントに持たない** — `useTipOutlet`＋`TipOutlet`（`scroll-bar-chart.tsx`）で分離する（`useState` に持つとバー／セグメント通過ごとに Nivo 全体が再レンダリングされ、実機 timespan で TBT 18 秒・遅延レイアウトシフトで CLS 1.1 を記録した）。「表で見る」の開閉も `TableDetails` で分離する。新しいランキング系チャートを追加するときはすべて踏襲すること（経緯: `../docs/site-design/LAYOUT.md`「実機Lighthouse timespanレポート」2節）。フィルタ行の `SelectTrigger` は必ず固定幅+`aria-label` 付き（自動幅はフォント読み込みで折り返しがずれ CLS になる。Nivo SVG には `ariaLabel`（pie はコンテナ `role="img"`）を付ける）。/emperors の一覧カードは `memo` 化した `EmperorCard`＋検索語 `useDeferredValue` を維持する。
- **レイアウト**: `site-shell` + `nav-menu`（デフォルト閉・見出し自体がリンク）+ `page-header`（記事型ページは `contained` prop で本文と同じ中央寄せ列に）+ `site-footer`（1行 flex-wrap・GitHub Issue への誘導リンク）。
- **SEO**: `src/lib/seo.tsx` が単一情報源（`SITE_URL`/`SITE_NAME`・`buildMetadata()`・JSON-LD生成関数・`SITE_SECTIONS`）。各ページの `metadata` はこれ経由、`layout.tsx` の `title` は template 化済み。`app/sitemap.ts`・`app/robots.ts`・`app/manifest.ts` は `export const dynamic = "force-static"` が無いと `output: "export"` でビルドが落ちる。OGP画像は `src/lib/og-image.tsx`（`next/og` の `ImageResponse`）で皇帝ごとに動的生成、フォントは `assets/fonts/`（サブセット済みNoto Sans JP。`public/`には置かない）。詳細・はまりどころは `../docs/site-design/LAYOUT.md`「SEO対策の徹底実装」節。

# 皇帝を追加収録するときのチェックリスト

2026-07-20 の唐哀帝追加（364→365人）の経験に基づく。データ側（`../data/emperors.json` への原典調査・`meta.count`/completedBlocks 系の更新・`python3 ../scripts/validate_emperors.py`）に加え、site 側は以下を漏れなく行う:

1. **`src/lib/timeline-river.ts` の `STREAM_DEFS` に追記**（新王朝・新政権の場合）。全 dynastyKey の被覆をビルド時に assert しているため、漏れるとビルドが落ちる
2. **`src/lib/kana-readings.ts` の音読みテーブルに新出漢字の読みを追記**（かな検索用・手書きテーブル）。未登録漢字はビルド時に throw するため、漏れるとビルドが落ちる
3. **人数のハードコード表記を更新**: サイト表示本体は `stats.emperorCount` から動的導出のためコード変更不要だが、ドキュメント類（`site/README.md`・`site/AGENTS.md`・`docs/site-design/METHODOLOGY.md`・ルート `README.md`/`CLAUDE.md`）と `CHANGELOG.md` の人数表記は手動更新
4. 肖像画を載せる場合は `../docs/site-design/PORTRAITS.md` の「肖像の増減手順」に従う（PD/CC0 のみ・manifest 管理）
5. `npx tsc --noEmit`・`npm run lint`・`npm run build` で検証（1・2 の漏れはここで検出される）

# ハマりどころ

- **Radix系ポップアップのスクロールロックは `scrollbar-gutter: stable` と二重補正になり横ずれする** — react-remove-scroll が body に `margin-right` 補正を注入するため。`globals.css` の `body[data-scroll-locked][data-scroll-locked]` 上書きで打ち消し済み（属性セレクタ2連は `!important` 同士の詳細度勝負のため）。この上書きを消さないこと。
- **`.next` キャッシュ残存でハイドレーションが静かに失敗する**（コンソールエラーなし・画像404・フィルタ無反応）。basePath 等の設定変更後は `rm -rf .next` してから dev サーバーを再起動する。
- `name.commonName` の `null` 混在は 2026-07-21 にデータ側で解消済み（スキーマ・`validate_emperors.py` で非null必須化）。`emperors.ts` の `displayName()` フォールバックは防御的に維持している。
- 旧バックログ（Nivo チャートの TBT・`/emperors` の LCP・CLS・a11y 2件）は 2026-07-18 に解消済み（Lighthouse: a11y 全ページ 100・perf 66〜100）。WSL2 上の Lighthouse は TBT を実測比 10〜20 倍に増幅するので、絶対値でなく相対比較+Long Task 実測で評価する。詳細は `../docs/site-design/LAYOUT.md` の「Lighthouse改善の実装」節。

# 設計記録

レイアウト・配色・実装判断の経緯と教訓は `../docs/site-design/LAYOUT.md` に時系列で記録している。大きめの UI 変更をしたら同ファイルに追記する。
