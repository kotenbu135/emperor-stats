# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# サイト概要

`../data/emperors.json`（中国皇帝365人・全12項目）を可視化する統計サイト。Next.js 16（App Router / Turbopack）+ Tailwind v4 + shadcn/ui + Tremor（vendored）+ Recharts + TanStack Table。`output: "export"` で `out/` に静的書き出しし、GitHub Pages + カスタムドメイン **emperorstats.com**（`public/CNAME`）のルート直下で配信する。

**2026-07-31 に作り替えの途中にある。** 最終形は**4ページ**（概要ダッシュボード `/`・皇帝一覧 `/emperors`・データベース `/database`・このサイトについて `/about`）＋皇帝個別 `/emperors/[id]` の365ページ。できているのは**概要ダッシュボードとデータベース**で、`/emperors` は改修の途中（肖像なしカード・時代ジャンプバー・カード比率3:4まで）、`/emperors/[id]`・`/about` は旧実装のまま残っている（外側のシェル＝サイドバー・ヘッダー・フッターも旧実装）。同日、`/timeline`・`/kinship`・`/death-accession`・`/court-events`・`/military`・`/ages`・`/dynasties`・**`/reign`** はファイルごと削除した（公開済みURLは 404 に着地させる方針）。`/reign` の2節はデータベースの状態として残っていて、リンクは `/database?sort=reignApproxDays&order=desc`（在位年数ランキング）と `/database?reign=restoration`（復位者一覧）へ付け替えてある。**`@nivo/*` はこの削除で消えた** — チャートは Recharts（vendored Tremor 経由）だけ。

このファイルには**崩すとビルドが落ちる契約**だけを置いてある。ページ構成・スタックの使い分け・配色・各ページの設計方針は [design-plans/SITE_PLAN.md](design-plans/SITE_PLAN.md) が正。旧サイトの設計記録・実装ログ・デザイン契約は同日すべて削除したので、**この2本以外から方針を引かないこと**。

# コマンド

Node は nvm の v26.4.0（`source ~/.nvm/nvm.sh && nvm use 26.4.0`）。テストは無い。

```bash
npm run dev        # http://localhost:3000/（basePath なし）
npm run build      # 静的書き出し → out/
npm run lint       # ESLint
npx tsc --noEmit   # 型チェック
```

`predev`/`prebuild` で3つの生成スクリプトが走る:

- `scripts/sync-portraits.mjs` — `../docs/site-design/mockups/card-preview/` の肖像画 webp を `public/portraits/` へ同期し、sharp で 320px 幅サムネを `public/portraits/thumb/` に生成する。**`card-preview/` はビルド入力なので消さないこと。**
- `scripts/build-emperor-notes.mjs` — 経緯 note を `public/emperor-notes/{id}.json` へ
- `scripts/build-data-distribution.mjs` — 配布用データを `public/data/` へ

# 崩してはいけない契約

## データ読み込みはビルド時のみ

`src/lib/emperors.ts` が `fs` で `../data/emperors.json`・肖像画 `manifest.json`・`../data/emperor-videos.json`（`../data/youtube-playlist.json` と合成し `EmperorRecord.videos` を生成）を読み、集計関数群を提供する。各ページ（`src/app/*/page.tsx`）は Server Component で集計し、`"use client"` のコンポーネントへ props で渡す。

**クライアント側から `emperors.ts` を import しない。** この Server/Client 境界を崩すと `data/emperors.json`（約7MB）がバンドルに入る。

## スキーマ v3 の ID→ラベル解決は `src/lib/data-source.ts` に閉じる

`data/emperors.json`・`data/kinship.json`（2026-07-29 の v3・`schemaVersion` 3.0.0／2.0.0）はレコードが安定 ID しか持たず、日本語ラベルは `meta.catalogs` にある。サイトには表示ラベルで集計・分岐・配色を引くコードが広いため、**読み込みの一点でカタログを引いてラベルへ解決し、下流には従来どおりラベルを流す**。旧 `dynasty` オブジェクトも `regimeId`＋`researchSection` からここで組み立てる。

ラベルで分岐している値は `assertLabels()` に列挙してあり、カタログのラベルを変えるとビルドが落ちる（黙って配色や分岐が外れない）。

**`.mjs` のビルドスクリプト（`scripts/build-emperor-notes.mjs`・`build-data-distribution.mjs`）は TS を import できないため同じ解決を自前で持つ** — 軸や enum を増減したら両方直す。

v3 の `catalogs.eras`（11区分）は**使っていない**（サイトの時代ラベルは `emperors.ts` の `ERA_BY_SECTION` の15区分）。

## /emperors 一覧のペイロード分離

一覧グリッドのクライアント props は軽量な `EmperorListRecord`（10フィールドのみ）に限定し、フルの `EmperorRecord` は詳細ダイアログを開いた時に `/emperor-records/{id}`（`app/emperor-records/[id]/route.ts` が静的書き出しする1人約2KBのJSON）を fetch して取得する。

**一覧の props にフルレコードを戻すと RSC ペイロードが約420KB太る。** カードに表示項目を増やすときは `EmperorListRecord` へ必要フィールドだけ足すこと。

`/database` も同じ理由で専用レコード `EmperorTableRecord`（`getEmperorTableRecords()`）を持つ。**`EmperorListRecord` と流用し合わないこと** — 図鑑カードの10フィールドと表の8列は一致せず、片方に必要なフィールド（`searchKana`・`portraitUrl` / `reignApproxDays`・`deathAge`）を相互に持ち込むと両方のペイロードが太る。列を足すときは `EmperorTableRecord` → `getEmperorTableRecords()` → `emperor-table.tsx` の `COLUMNS` の3箇所をそろえる。**列数は `emperor-types.ts` の `DATABASE_COLUMN_COUNT` が単一情報源**（OGP画像の事実カードがこの値を出す）で、`COLUMNS.length` との突合 assert があるため増減時は同時に直す。

## ページを1枚足すときに揃える3箇所

`SITE_SECTIONS`（`src/lib/seo.tsx`）へ**先に**足してからページの `metadata` を書く。`sectionDescription()` は未登録の href で throw するので、順序を逆にするとビルドが止まる。`sitemap.xml` はここから導出される。

**OGP画像も同時に足す** — `src/lib/emperors.ts` の `OgFactPage` の union にパスを足し、`getOgFacts()` に分岐を書き、`app/<path>/opengraph-image.tsx` を置く。union に足さないと `getOgFacts("/新パス")` が型エラーになる。

グローバルナビは `src/lib/nav-data.ts`。

## 単一情報源

- **`src/lib/base-path.ts` の `BASE_PATH`** — `next.config.ts` の basePath と肖像画 URL が共用。カスタムドメイン移行済みのため現在は `""`。`next/image` は `images.unoptimized` 時に basePath を自動付与しないので、`public/` 配下を参照する箇所は必ず `BASE_PATH` を明示する。
- **`src/lib/seo.tsx`** — `SITE_URL`/`SITE_NAME`・`buildMetadata()`・JSON-LD 生成関数・`SITE_SECTIONS`。各ページの `metadata` はこれ経由、`layout.tsx` の `title` は template 化済み。`app/sitemap.ts`・`app/robots.ts`・`app/manifest.ts` は `export const dynamic = "force-static"` が無いと `output: "export"` でビルドが落ちる。
- **`src/lib/video-channel.ts` の `VIDEO_CHANNEL`** — 動画はすべて当サイトと無関係の外部チャンネルの制作物のため、セクション冒頭と `/about` に必ず制作者表記を出す。
- **`src/app/globals.css`** — 配色トークン（`--series-1〜8`・`--bar*`・`--seal`）と本文列の上限 `--container-content`。
- **`src/lib/dynasty-colors.ts` の `DYNASTY_COLOR_SLOT`** — 政権→配色スロット（**キーは政権 ID**・89政権）。未割当のキーは throw する。
- **`../data/images/portraits/manifest.json` の `focusY`** — 肖像の中で顔が縦のどこにあるか（0〜1）。一覧カードの肖像枠は実体（3:4）より横長で `object-cover` が縦を切るため、この値が切る位置を決める。**肖像がある全員に無いとビルドが落ちる**（`emperors.ts`）。肖像を足したら値も入れること（読み取り方は `docs/site-design/PORTRAITS.md`）。

# 皇帝を追加収録するときのチェックリスト

データ側（`../data/emperors.json` への原典調査・`meta.count`/completedBlocks 系の更新・`python3 ../scripts/validate_emperors.py`）に加えて:

1. **`src/lib/kana-readings.ts` の音読みテーブルに新出漢字の読みを追記**（かな検索用・手書きテーブル）。未登録漢字はビルド時に throw するため、漏れるとビルドが落ちる
2. **政権が増えたら `src/lib/dynasty-colors.ts` の `DYNASTY_COLOR_SLOT` に政権 ID を追記**（既存政権に皇帝を足すだけなら不要）。未割当のキーは throw する。スロットの選び方は意味ベース（漢系=4金・北族=1青・晋系=7紫・宋=2緑・明=8赤・隋/梁系=5青緑）で、政権の性格（v3 の `catalogs.regimes[].category`）が「並立政権」「反乱・自称政権」の割拠政権は 0（`--kinship-minor`・無彩色）
3. **人数のハードコード表記を更新**: サイト表示本体は `stats.emperorCount` から動的導出のためコード変更不要だが、ドキュメント類（`site/AGENTS.md`・ルート `README.md`/`CLAUDE.md`）と `CHANGELOG.md` の人数表記は手動更新
4. 肖像画を載せる場合は `../docs/site-design/PORTRAITS.md` の「肖像の増減手順」に従う（PD/CC0 のみ・manifest 管理）
5. `npx tsc --noEmit`・`npm run lint`・`npm run build` で検証（1・2 の漏れはここで検出される）

# ハマりどころ

- **Radix系ポップアップのスクロールロックは `scrollbar-gutter: stable` と二重補正になり横ずれする** — react-remove-scroll が body に `margin-right` 補正を注入するため。`globals.css` の `body[data-scroll-locked][data-scroll-locked]` 上書きで打ち消し済み（属性セレクタ2連は `!important` 同士の詳細度勝負のため）。この上書きを消さないこと。
- **`prefers-reduced-motion: reduce` は `globals.css` の一括指定で潰してある**。Radix / tw-animate-css の開閉アニメーションはクラスで直接 `animation` を当てるため JS の `matchMedia` 分岐では止まらない。`animation: none` にはしないこと（Radix は `animationend` を待って要素を外すため、閉じたダイアログが DOM に残る）。なお **CSS アニメーションしか止まらない** ので、Recharts の JS アニメーション（`isAnimationActive`）は別途止める必要がある。
- **`overflow-x: auto` を当てた箱は、縦に溢れていなくてもスクロールコンテナになる** — 中の `position: sticky` の基準がビューポートからその箱へ移り、**見出しの固定が静かに効かなくなる**（`overflow-y: clip` を併せても変わらない）。`/database` の表は「収まっている間は `overflow-x: clip`、溢れた幅でだけ `auto`」に切り替えてこれを避けている（経緯は SITE_PLAN の「6. データベース」節）。
- **`design-plans/tools/` の確認用スクリプトは npm の依存操作のたびに動かなくなる** — playwright は site の依存に入れておらず、`node_modules/playwright{,-core}` へ npx キャッシュから張った symlink で動いている。`npm install`/`uninstall` がこの symlink を消すため、`ERR_MODULE_NOT_FOUND: playwright` が出たら張り直す（`ln -sfn ~/.npm/_npx/<hash>/node_modules/playwright{,-core} node_modules/`・版は `~/.cache/ms-playwright` の chromium と合わせる）。
- **`.next` キャッシュ残存でハイドレーションが静かに失敗する**（コンソールエラーなし・画像404・フィルタ無反応）。設定変更後は `rm -rf .next` してから dev サーバーを再起動する。
- **Recharts は 2.15.4 に固定**。3.x では vendored した Tremor のチャートが動かない。**shadcn の `chart` レジストリ項目は `recharts@3.8.0` を要求する**ので、Tremor のチャートを残したまま shadcn の `Chart` を足すことはできない（二者択一）。
