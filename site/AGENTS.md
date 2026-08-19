# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# サイト概要

`../data/emperors.json`（中国皇帝365人・全12項目）を可視化する統計サイト。Next.js 16（App Router / Turbopack）+ Tailwind v4 + shadcn/ui + Tremor（vendored）+ Recharts + TanStack Table。`output: "export"` で `out/` に静的書き出しし、GitHub Pages + カスタムドメイン **emperorstats.com**（`public/CNAME`）のルート直下で配信する。

**2026-07-31 に作り替えて一旦完成した。** 構成は**4ページ**（概要ダッシュボード `/`・皇帝一覧 `/emperors`・データベース `/database`・このサイトについて `/about`）＋皇帝個別 `/emperors/[id]` の365ページ。ただし**外側のシェル（サイドバー・ヘッダー・フッター）・`/emperors/[id]` は旧実装のまま**残っている（申し送りの全文は SITE_DESIGN.md の「2. ページ構成」節）。**詳細ダイアログは 2026-08-01 に廃止**し、一覧カードは個別ページへ直接遷移する。**廃止した8ページ**（`/timeline`・`/kinship`・`/death-accession`・`/court-events`・`/military`・`/ages`・`/dynasties`・`/reign`）はファイルごと削除済みで、**公開済みURLは無言で 404 に着地させる**（リダイレクト・410 は設けない）。`/reign` の2節はデータベースの状態が担い、リンクは `/database?sort=reignApproxDays&order=desc`（在位年数ランキング）と `/database?reign=restoration`（復位者一覧）へ付け替えてある。**チャートは Recharts（vendored Tremor 経由）だけ**（`@nivo/*` はこの削除で消えた）。なお `/lab` はチャート候補の見比べ用に残してあるが、`SITE_SECTIONS`・`sitemap.xml`・ナビのいずれにも載せていない**非公開の作業ページ**。

このファイルには**崩すとビルドが落ちる契約**だけを置いてある。ページ構成・スタックの使い分け・配色の考え方・各ページの設計判断・決着済みで再提案しないことは [../docs/site-design/SITE_DESIGN.md](../docs/site-design/SITE_DESIGN.md) が正。旧サイトの設計記録・実装ログ・デザイン契約は同日すべて削除したので、**この2本以外から方針を引かないこと**。

# コマンド

Node は nvm の v26.4.0（`source ~/.nvm/nvm.sh && nvm use 26.4.0`）。テストは無い。

```bash
npm run dev        # http://localhost:3000/（basePath なし）
npm run build      # 静的書き出し → out/
npm run lint       # ESLint
npx tsc --noEmit   # 型チェック

node tools/capture-site.mjs   # out/ を静的配信して全ページの確認用スクショを撮る（→ tools/shots/・.gitignore 対象）
node tools/font-audit.mjs     # 主要4面のフォント本数・転送量・総転送量に占める比率（Issue #79 の指標）

python3 tools/build-font-subset.py   # 書体のサブセットを作り直す（out/ が要る。下の「書体は自前で配る」）
```

`tools/capture-site.mjs` は `out/` を自前の静的サーバーで配信する（`output: "export"` なので `/about` → `about.html` の解決が要り、素の静的サーバーでは 404 になる）。**ページを増減したらスクリプトの `SHOTS` も直すこと** — `page.goto` は 404 でも throw しないので、廃止済みのパスを撮ると 404 ページが「撮れた」ことになる（実装側で status を検証している）。

`tools/font-audit.mjs` は同じ静的配信を使ってフォントの転送を測る（引数に別ビルドの `out/` を渡せば突き合わせられる）。**ページごとに新しいブラウザコンテキストで開いている** — フォントは4面で共通なので、使い回すと2ページ目以降がキャッシュに当たって「0本」に見える。**capture-site.mjs と同じく playwright の symlink に依存する**ので、`ERR_MODULE_NOT_FOUND` が出たら下の「ハマりどころ」を見る。

`predev`/`prebuild` で2つの生成スクリプトが走る:

- `scripts/sync-portraits.mjs` — `../docs/site-design/mockups/card-preview/` の肖像画 webp を `public/portraits/` へ同期し、sharp で 320px 幅サムネを `public/portraits/thumb/` に生成する。**`card-preview/` はビルド入力なので消さないこと。**
- `scripts/build-data-distribution.mjs` — 配布用データを `public/data/` へ

# 崩してはいけない契約

## 書体は自前で配る（`next/font/google` に戻さない）

2026-08-05 に `next/font/google` をやめ、Noto Sans JP を**このサイトが実際に描く文字だけ**に
絞って自前で配っている。理由は PSI の実測で、`next/font/google` は全 17,936 グリフの
unicode-range 割り当て表を出すため **@font-face だけで 283KB（gz 98KB）のレンダーブロッキング
CSS** になり、モバイルのパフォーマンスが 56・レンダリングブロックの推定削減が 9,090ms だった
（Issue #79 で明朝を落としたときに消したのと同じ構造の負債がサンセリフ側に残っていた）。
実際に描く文字は 3,404 字しかない。

| | 差し替え前 | 後 |
|---|---|---|
| レンダーブロッキング CSS | 400.6KB / gz 118KB | 195.8KB / **gz 31.5KB** |
| `/` のフォント | 50本 1,180KB | **34本 661KB** |
| `/emperors` のフォント | 102本 4,189KB | **38本 753KB** |

構成は4つ。**どれか1つでも欠けると静かに壊れる。**

- **`tools/build-font-subset.py`** — 生成器。設計の理由（なぜ頻度順に切るのか・
  なぜ `out/data/` を数えないのか）はこのファイルの docstring が正
- **`src/app/fonts/*.woff2`（87本）と `src/app/fonts.css`** — 生成物で、**commit する**。
  CSS は `globals.css` の `@import "./fonts.css"` で読む（この1行を消すと書体が全部落ちる）。
  woff2 は Next が `_next/static/media` へ指紋つきで吐くので `BASE_PATH` に依存しない
- **`tools/font-coverage.json`** — 検査用の台帳。サブセットに入れた字と、**底本の cmap 全体**を
  持つ。2つ要るのは「取り直せば入る字（＝直せる）」と「底本 Noto Sans JP がそもそも
  持っていない字（原文引用の簡体字など・231字・差し替え前から同じ）」を分けるため
- **`tools/check-font-coverage.mjs`** — `postbuild` で自動的に走る。フォントに無い字は
  **豆腐にならず次の書体へ落ちる**ので、目視では気づけない。だから機械で見る

**紹介文（Issue #16）が入るたびに新しい漢字が出るので、そのたびにここが落ちる。**
直し方は `npm run build`（out/ を作る）→ `python3 tools/build-font-subset.py` → `npm run build`。
**woff2 のバイト列は収録字が同じでも再生成のたびに全ファイル変わる**ので、取り直したら
`node tools/compare-font-subset.mjs` で HEAD と収録字を比べ、追加も削除も 0 なら
`git checkout -- src/app/fonts.css src/app/fonts/` で生成物ごと捨てる（無意味な
84ファイル差分をコミットしない — 2026-08-19 の実測）。
`--font-sans` は `globals.css` が `"Noto Sans JP", "Noto Sans JP Fallback"` で持っていて、
**Fallback 側の `size-adjust` / `ascent-override` を消すと swap の瞬間に行が動く**（CLS 0 を
守っている1行。値は差し替え前に Next が出していたものをそのまま引き継いでいる）。

## データ読み込みはビルド時のみ

`src/lib/emperors.ts` が `fs` で `../data/emperors.json`・肖像画 `manifest.json`・`../data/emperor-videos.json`（`../data/youtube-playlist.json` と合成し `EmperorRecord.videos` を生成）・`../data/emperor-profiles.json`（紹介文）を読み、集計関数群を提供する。各ページ（`src/app/*/page.tsx`）は Server Component で集計し、`"use client"` のコンポーネントへ props で渡す。

**`src/lib/quote-verification.ts` は `../data/quote-refs.json`（引用照合台帳・配布物ではない）もビルド時に読む。** `/about` が出す「底本と機械で照合した件数・確認できていない件数」の出どころで、**数を直書きしない**ため（Issue #69・引用の全件照合を完走しない決定を明示する文なので、件数がずれると説明そのものが嘘になる）。クライアントに載るのは5つの数値だけ。

**クライアント側から `emperors.ts` を import しない。** この Server/Client 境界を崩すと `data/emperors.json`（約7MB）がバンドルに入る。

## スキーマ v3 の ID→ラベル解決は `src/lib/data-source.ts` に閉じる

`data/emperors.json`・`data/kinship.json`（2026-07-29 の v3・`schemaVersion` 3.0.0／2.0.0）はレコードが安定 ID しか持たず、日本語ラベルは `meta.catalogs` にある。サイトには表示ラベルで集計・分岐・配色を引くコードが広いため、**読み込みの一点でカタログを引いてラベルへ解決し、下流には従来どおりラベルを流す**。旧 `dynasty` オブジェクトも `regimeId`＋`researchSection` からここで組み立てる。

ラベルで分岐している値は `assertLabels()` に列挙してあり、カタログのラベルを変えるとビルドが落ちる（黙って配色や分岐が外れない）。

**`.mjs` のビルドスクリプト（`scripts/build-emperor-notes.mjs`・`build-data-distribution.mjs`）は TS を import できないため同じ解決を自前で持つ** — 軸や enum を増減したら両方直す。

v3 の `catalogs.eras`（11区分）は**使っていない**（サイトの時代ラベルは `emperors.ts` の `ERA_BY_SECTION` の16区分）。

## /emperors 一覧のペイロード分離

一覧グリッドのクライアント props は軽量な `EmperorListRecord`（カードに出る項目だけ）に限定する。フルの `EmperorRecord` は個別ページ `/emperors/[id]` が Server Component で読む（一覧側は持たない）。

**一覧の props にフルレコードを戻すと RSC ペイロードが約420KB太る。** カードに表示項目を増やすときは `EmperorListRecord` へ必要フィールドだけ足すこと。

2026-08-01 に詳細ダイアログを廃止（カードは個別ページへ素の遷移）した時点で、フルレコードを取りに行く先だった Route Handler `app/emperor-records/[id]/route.ts` と経緯 JSON `public/emperor-notes/`（`scripts/build-emperor-notes.mjs`）は消えている。**この契約は分離の理由が「ダイアログ用のfetch元を分ける」から「一覧のRSCペイロードを188KBに留める」へ変わっただけで、そのまま生きている。**

`/database` も同じ理由で専用レコード `EmperorTableRecord`（`getEmperorTableRecords()`）を持つ。**`EmperorListRecord` と流用し合わないこと** — 図鑑カードのフィールドと表の8列は一致せず、片方に必要なフィールド（`searchKana`・`portraitUrl` / `reignApproxDays`・`deathAge`）を相互に持ち込むと両方のペイロードが太る。列を足すときは `EmperorTableRecord` → `getEmperorTableRecords()` → `emperor-table.tsx` の `COLUMNS` の3箇所をそろえる。**列数は `emperor-types.ts` の `DATABASE_COLUMN_COUNT` が単一情報源**（OGP画像の事実カードがこの値を出す）で、`COLUMNS.length` との突合 assert があるため増減時は同時に直す。

## 皇帝個別ページで静的HTMLから本文を落とさない

`/emperors/[id]` の365ページは**皇帝名での検索結果に出ること**が目的（GitHub Issue #16）なので、本文が静的HTMLに載っていることが前提の面。

- **`ui/accordion.tsx` を本文に使わない。** `forceMount` を渡していないので閉じた本文が DOM から消える。畳むなら素の `<details>`（閉じていても DOM に残る）。在位中の出来事は「先頭10件＋残りを `<details>`」で、宋高宗（142件）でも全件が `out/emperors/nansong-gaozong.html` に載る
- **受け入れ確認は行数ではなく末尾のテキストでとる。** 畳み方を間違えたときに落ちるのは末尾なので `grep -c` の件数では検出できない
- **10件の境目は種別フィルタで絞ったあとの集合に対して数える**（元の集合を基準にすると `<details>` が空になる・件数表示が嘘になる）
- **年表に反乱鎮圧（`rebellionSuppressionCount`）を出さない** — 被反乱と同じ反乱を両面から数えたもので、両方出すと同じ事件が2行並ぶ（`emperors.ts` の `EVENT_METRICS`。件数の根拠は SITE_DESIGN.md の「反乱鎮圧は年表に出さない」節）。**回数の表（`emperor-facts.tsx`）には両方出る**ので、そちらと混同しないこと
- **年表の行は開かない**（2026-08-03 ユーザー決定・Issue #69）。1行＝種別・日付・要約で、`getEmperorEvents` は首謀者・結果・note全文・出典（`source.page`）を**返さない**。理由は主張の範囲（note は作業ログ・その中の引用は「読んだ形跡」で、配布データが底本に実在すると主張するものではない）で、線引きは `/about` の運営者の節に出してある。**note を年表へ戻すときは `/about` の文と対で動かすこと**
- **出来事の日付は保存値の深さをそのまま出す**（`datePrecision` で丸め直さない・同上）。`events` と `ages` は深さそのものが主張なので、表示側で丸めると**あとから確定した日付を黙って捨てる**。`reigns[]` だけは別規約（フル ISO ＋ `datePrecision`）で据え置き
- **経緯の3節（即位・死因・復位）と「判定の軸」は出さない**（2026-08-03 ユーザー指示）。`accessionRoute.note`／`deathCause.note`／`reigns[].note`・即位経路の4軸はいずれも配布データ側にあり、**サイトには判定結果だけが出る**（基本情報の「即位経路」「死因」の行・在位経歴の「のちに復位」）。部品 `emperor-narrative.tsx` と `getEmperorNarrative` はファイルごと消えている。**戻すときは `/about` の運営者の節の文と対で動かすこと**（上の年表の行と同じ対で、いまは「調査メモと原文の引用はサイトの画面には出しておらず」と書いてある）。**この3節は紹介文が未執筆の皇帝ではページ上で唯一の散文だった**ので、戻す／戻さないの判断は SITE_DESIGN.md の「経緯3節（④）は表示ごと廃止した」節を読んでから
- **出典（`source.page`）だけは 2026-08-05 に戻した**（Issue #75・畳んだ「出典」ブロック＝③基本情報の直後）。**note は戻していない**（第2段階は不採用）。3点だけ守る:
  - **素の `<details>`。** `ui/accordion.tsx` に替えると閉じた本文が DOM から消え、書名・巻が静的HTMLから落ちる（＝このブロックを足した目的が消える）
  - **露出する欄は `emperors.ts` の登録表 `SOURCE_ENTRIES` に1行足す。** レコードを走査して `source` を持つ欄を自動収集しないこと — `reigns[].duration` と回数系 `events[]` にも `source` があり、**どちらも出さない決定が別にある**（年表の出典・在位日付の典拠）ので自動収集は黙ってそれを反転させる
  - **`/about` の運営者の節と対。** いまは「死因と即位の経緯の出典（書名・巻）は各皇帝の個別ページにも出しています」と書いてあり、出す欄を増減したらこの文も動かす

紹介文は `../data/emperor-profiles.json`（`emperors.json` とは別ファイル）。**存在しない皇帝idのキーがあるとビルドが落ちる**（`kana-readings`・`DYNASTY_COLOR_SLOT` と同じ書き間違い検出の assert）。未執筆でもページは成立する作りなので、フィールドが無い皇帝では紹介文の節が出ず `description` は機械生成文に落ちる。

**`lead`・`body` は選択的ルビ・`description` は平文**（Issue #20 の T2／総ルビは 2026-08-05 に廃止）。
ルビを振るのは難読語と中国史特有の語だけで、**同じ本の中では2回目以降の出現にも振る**
（`data/profile-ruby-lexicon.json` に載る語は必須。振り漏れは `../scripts/validate_readings.py` が落とす）。`lead` は `<RubyText>` に通し、行送りは `leading-loose` ではなく **`leading-ruby`**（ルビのある行だけ高くなって段落の中で行間がばらつく）。**置き場所は導入 `lead` がヒーローの中**（`emperor-hero.tsx` の名前チップの下）・**逸話を含む `body` が「人物紹介」節**（ページ直書き・基本情報の上）で、**肖像は全幅で `float`**（長い紹介文が肖像の下へ回り込む・末尾の `clear-both` を消すとヒーローの下境界が肖像を跨いで縮む）。**480px 未満では紹介文だけ `clear-both min-[480px]:hidden` で肖像の下へ落とす**（128px の肖像の右に流すと1行13字になる。名前チップまでは回り込ませる — 2026-08-04 に縦積みをやめた理由が「肖像の右が空く」なので、ここを clear すると空白が戻る）。**この 480px という値をビューポート幅で書けるのは 640px 未満＝サイドバーが出ない帯だけ**（md 以上は240pxのサイドバーが挟まり、768pxの画面でもヒーロー内幅は448px＝200pxの肖像を引いた本文は224px。sm 以上の回り込みは 2026-08-01 からの据え置き）。**`lead` の段落区切りは空行（`\n\n`）で、ページ側が split して `<p>` に分ける** — 逸話を交えるようになって1本500字級になったため（`basis` はサイトに出さない編集メモ）。`description` は `<meta>` と Person JSON-LD にしか出ないのでルビを持たせず、**ルビ記法が混ざっていたら `emperors.ts` の読み込み時に throw する**（描画側で strip すると、呼び出し2箇所のうち片方を直し忘れる事故になる）。ゲートは `../scripts/validate_profiles.py`（文字数はルビを剥がした長さで数える）と `../scripts/validate_readings.py`。**執筆規約 `meta.policy` は 2026-08-04 に削除した**（既存の紹介文76本と `docs/process/profile-writing/` も同時に全削除・掲載する方針は変えていない）。**いま `profiles` は228本**で、残る137人は紹介文の節が出ず `description` は機械生成文に落ちる。

**ただし 2026-08-13 から Web 公開を一時停止している**（ユーザー指示）。旗は `emperors.ts` の
**`PROFILES_PUBLISHING_PAUSED`** 1つで、`true` の間は `getEmperorProfile` が全員 null を返し、
**228本ぶんの `lead`・`body`・`description` がサイトに1文字も出ない**（＝365人全員が上の
「未執筆」と同じ見え方になり、`<meta description>` と Person JSON-LD は機械生成文に落ちる）。
**データ `../data/emperor-profiles.json` は消していない**・**執筆と各ゲートもそのまま**なので、
再開はこの定数を `false` に戻して再ビルド・再配信するだけ。**表示側（`page.tsx`・
`emperor-hero.tsx`）に停止用の分岐を足さないこと** — 止め方はこの1箇所に閉じてある。
なお**止めているあいだも書体のサブセットは取り直さない**（紹介文の字が落ちて、再開時に
`check-font-coverage.mjs` が落ちる）。

## 系譜図（`/kinship`）— 2026-08-19 に全6章そろえて**公開済み**（同日、第7章 宋・遼・西夏・金／2026-08-20 に第8章 元・第9章 明を追加）

2026-08-17 に一度作り直して配信したが、出来が公開に耐えないとユーザーが判断し数時間後に
取り下げた（Issue #174・PR #185）。2026-08-19 に「一般的な家系図のつなぎ方」で作り直し、
全6章そろえてユーザー指示で公開した — `SITE_SECTIONS`・`nav-data.ts`（shortLabel なし＝
モバイルヘッダーには出さない・モバイルの出口はトップの「次に見る」カード）・`sitemap`
（第2章以降は sitemap.ts が `KINSHIP_CHAPTERS` から導出）・`capture-site.mjs` の4箇所に
登録済みで、`robots` の noindex も外した。取り下げた前の版の失敗（面積の8割が白・淡彩8%・
在位の長い皇帝が空の縦棒・小さな塊が図幅の2/3・線の交差）は SITE_DESIGN.md と Issue #174 に
残してあるので、同じ形へ戻さない。

**章を増やすときの規範（図の文法・検査・チェックリスト）は
[../docs/site-design/KINSHIP_RULES.md](../docs/site-design/KINSHIP_RULES.md)** が正。

構成は4つ。**レイアウト（＝座標と線の形）を描画側で決めないこと**が全体の設計。
章は9つ（秦・漢 `/kinship`・三国・西晋 `/kinship/three-kingdoms-jin`・
東晋・十六国 `/kinship/eastern-jin-sixteen`・南北朝 `/kinship/northern-southern`・
隋・唐 `/kinship/sui-tang`・五代十国 `/kinship/five-dynasties`・
宋・遼・西夏・金 `/kinship/song-liao-jin-xia`・元 `/kinship/yuan`・明 `/kinship/ming`）。
**系譜図に人物を足すと `../data/name-readings.json` の読みも要る**（2026-08-19 にカードの
名前へふりがなを付けた。親族の名前は emperors.json に無いので、皇帝追加のチェックリスト
だけでは拾えない — 未登録は chapter-page の `rubyOf` でビルドが落ちる）。皇帝カードの
「第N代」は `reigns[].dynastyOrder` が確定している政権だけに出る（在位順から推論しない）。

- **`scripts/build-kinship-layout.mjs`** — `prebuild` で elkjs を回して章ごとに
  `src/lib/kinship/layout.<eraId>.json` を吐く（elkjs は devDependencies・`out/` に混ざらない）。
  章の一覧・客人（章の eraId でない人物: 献帝など）・枡の幅 `bucket` は冒頭の `CHAPTERS`。
  **線の折れ線 `points` までここで確定する。** 描画側で曲げ方を決めると、線がカードを
  突き抜けても機械で見られない。**夫婦は1つの「家族ブロック」に固めて elk へ渡す**
  （2026-08-19「一般的な家系図みたいなつなぎ方に」）— 夫婦を別ノードで渡すと隣に並ぶ
  保証が無い。子の線は FIXED_POS ポートで「夫婦の間の下ろし点」から出し、
  `mergeEdges: true` で兄弟を1本の幹にまとめる（旧 union 方式では逆効果だった設定）
- **`src/components/kinship/chapter-flow.tsx`** — React Flow v12 の描画層。位置は props で
  受け取るだけ
- **`src/app/kinship/chapters.ts`** — 章の表（URL・見出し・入口の皇帝・レイアウト JSON）。
  スクリプト側 `CHAPTERS` と1対1で、章を足すときは両方へ足す
- **`src/components/kinship/chapter-page.tsx`** — 見出し・章ナビ・凡例。
  `src/app/kinship/**/page.tsx` はこれに章を渡すだけ

### 崩すとサイレントに壊れる6つ

- **`ReactFlowProvider` に `initialNodes`/`initialEdges`/`initialWidth`/`initialHeight`/
  `fitView` を渡す。** 自分で Provider を置くと React Flow 内部の `Wrapper` が
  「もう Provider がある」と見て素通りするので、`<ReactFlow nodes= edges= fitView>` は
  **サーバー描画に一切届かない**。渡し忘れると静的 HTML からカードも線も `<a>` も全部消え、
  **tsc・lint・build はどれも落ちない**。受け入れ確認は
  `grep -o 'href="/emperors/' out/kinship.html | wc -l`（35）と
  `grep -o 'react-flow__edge-path' out/kinship.html | wc -l`（132）。
  三国・西晋は `out/kinship/three-kingdoms-jin.html` で同じ2本（18・74）、
  東晋・十六国は `out/kinship/eastern-jin-sixteen.html`（55・145）、
  南北朝は `out/kinship/northern-southern.html`（70・234）、
  隋・唐は `out/kinship/sui-tang.html`（50・109）、
  五代十国は `out/kinship/five-dynasties.html`（35・93）、
  宋・遼・西夏・金は `out/kinship/song-liao-jin-xia.html`（53・160）、
  元は `out/kinship/yuan.html`（18・49）、
  明は `out/kinship/ming.html`（22・75）
- **`CardPorts` の6ハンドルと `buildGraph` の `ports()` は同じ id・同じ数で並べる。**
  片方だけ増やすと静的 HTML とクライアントで線の出入り口が変わる
- **`window.__kinshipSetViewport` を消さない。** `tools/shoot-kinship.mjs` が図を動かす口。
  `.react-flow__viewport` の CSS transform を直に書き換えると React Flow の store が
  更新されず、**store を読んでいる部品（時代の帯・左端の年）だけが動かない写真**が撮れる
  （2026-08-18 に実際に撮って「帯の年がでたらめ」と読み違えた）
- **カードの `<a>` の `pointer-events-auto` を外さない。** ノードは draggable/selectable
  とも false なので React Flow がラッパーに `pointer-events: none` を敷く。この1クラスが
  無いと**クリックしても個別ページへ遷移しない**（2026-08-19 に実測でだけ発見。tsc・lint・
  build はどれも落ちない）。ホイール＝縦パン・Ctrl/⌘＋ホイール＝拡大縮小も 2026-08-19 の
  ユーザー指示なので `zoomOnScroll={false} panOnScroll` を外さないこと
- **図を動かすコードは `clampViewport` を通す（`setCenter` を直接呼ばない）。**
  React Flow の `setCenter`/`fitView` は `translateExtent` の制約を**通らない**。制約の外の
  座標に置くと、**次のドラッグ・ホイールの開始時に d3-zoom が補正して画面がぱっと飛ぶ**
  （2026-08-19 ユーザー指摘「後漢を押してからドラッグすると画面が切り替わる」。とくに
  余白込みの図が画面より狭い軸は d3 が中央へ固定するので、ずれが必ず出る）。ジャンプ・
  検索は `clampViewport`、初期表示は `onInit={clampNow}`、アニメ中に掴んだときは
  `finishAnim`（即完了）が受け持つ — どれも外すと tsc・lint・build は落ちないまま戻る
- **`regimeBandColor` は `--kinship-minor` を返さない。** あれは無彩色の識別色で白文字との
  コントラストが **2.58:1**。カードの帯は8色とも「白文字が 5.2:1」で作ってあり、
  割拠政権（スロット0）用に `--kinship-band-0` を同じ目標で足してある

### 時代の帯に**数値の目盛りを引かない**

縦は世代の段で、時代順はそこに寄せてあるだけ。上下に並ぶカード 3,320 組のうち **135 組
（4.1%）は年が前後する**（劉立 3年 が 王政君 前70年 の上、など）。数値の軸を引くと読者が
その 4% を1件ずつ突き合わせられてしまい、**いままで見えなかった段のずれが「見える嘘」に
変わる**。だから帯は「前200年ごろ」の丸めた6本で、境目は**どのカードも跨がない切れ目**
からしか選ばず、代表年が前へ戻る帯は隣と併合する（`buildEraBands`）。
凡例にも「おおよそ」と明記してある。**精度を上げる方向で直さないこと。**

### 触ったら流し直す

```bash
node scripts/build-kinship-layout.mjs     # 全章ぶん。欠陥＋兄弟の横棒＋時代の帯を数える
npm run build && node tools/shoot-kinship.mjs   # 字の切り詰め件数＋図の全面をタイルで撮る
# 章を選んで撮る: SHOT_DIR=tools/shots/kinship-3kj KINSHIP_PATH=/kinship/three-kingdoms-jin node tools/shoot-kinship.mjs
```

**「監査 0件」を見た目の根拠にしないこと。** 2026-08-18 の外部レビュー13件のうち、既存の
監査項目に当たったのは0件だった（字の大きさ・切り詰め・凡例・検索の不在・帯の
コントラストは、どれも幾何の検査では拾えない）。**撮ったタイルを最後まで自分で見る。**

## 紹介文を止めている間に書体のサブセットを取り直すときの手順

`PROFILES_PUBLISHING_PAUSED` が `true` のあいだ、素直に
`python3 tools/build-font-subset.py` を流すと**紹介文の字が `out/` に出ていないので
サブセットから落ちる**（再開したときに `check-font-coverage.mjs` が落ちる）。
新しいページを足して字が増えたときは、次の順で回す:

1. `PROFILES_PUBLISHING_PAUSED = false` にする
2. `npm run build`（postbuild のフォント検査は落ちてよい。`out/` はもう書けている）
3. `python3 tools/build-font-subset.py`
4. `PROFILES_PUBLISHING_PAUSED = true` に戻す
5. `npm run build`

## ページを1枚足すときに揃える3箇所

`SITE_SECTIONS`（`src/lib/seo.tsx`）へ**先に**足してからページの `metadata` を書く。`sectionDescription()` は未登録の href で throw するので、順序を逆にするとビルドが止まる。`sitemap.xml` はここから導出される。

**OGP画像も同時に足す** — `src/lib/emperors.ts` の `OgFactPage` の union にパスを足し、`getOgFacts()` に分岐を書き、`app/<path>/opengraph-image.tsx` を置く。union に足さないと `getOgFacts("/新パス")` が型エラーになる。

グローバルナビは `src/lib/nav-data.ts`。**モバイルヘッダーには出さない**（`shortLabel` を
付けない） — 3項目で 320px の余りが7pxしかないため。上の「モバイルヘッダーは56pxの1行」を見る。

## ページを1枚消すときに落とす4箇所

**ページを消しても TypeScript は通る。** `/reign` を削除したときは 404 へのリンクが2本残った。

`SITE_SECTIONS`・`nav-data.ts`・`OgFactPage` の union と `getOgFacts()` の分岐から落としたうえで、本文中のリンクを `grep -rn '"/<パス>' src/` で洗う。最後に `out/**.html` を grep して 404 リンクが残っていないことを見る。**`tools/capture-site.mjs` の `SHOTS` からも落とす。**

**ESLint の `no-unused-vars` は使われていない export を報告しない。** ページを消したあとは export ごとに `grep -rn '<名前>' src/` で消費者を数えること（lint が 0 error でも死んだ export が残る）。

## 操作の反応で守ること

2026-08-01 に直した「押せるものが押せるように見えるか」（設計の記録は SITE_DESIGN.md の
「インタラクションの強化」節）。**部品を足したら必ず流し直す:**

```bash
npm run dev -- --port 3100     # 別のターミナルで
node tools/hover-audit.mjs     # 各ページの操作要素の cursor と hover を実測 → NG: 0 を保つ
```

- **`button` の cursor は Tailwind v4 が `default` にする。** globals.css の base で
  `button:not(:disabled)`・`summary`・`label[for]`・`[role=tab|switch|radio|option|menuitem*]`
  にまとめて `cursor: pointer` を当ててある。**この規則を消すと押せる部品のほぼ全部が
  矢印カーソルに戻る**（実測で70種類中46種類が不合格だった状態）
- **hover の言い方は2つだけ** — 面がわずかに沈む（`hover:bg-accent`）／文字が朱になる
  （`hover:text-seal`）。**選択中の項目は「非選択の見た目＝hover 後の見た目」になりがち**
  （現在地のナビ・選択中のタブ／トグル・押されている種別チップ）。選択中は文字を朱にする
- **フォーカスリングは `focus-visible:outline-2 focus-visible:outline-seal`**（インライン
  のリンクとポップオーバー内の項目は `focus-visible:outline-offset-2` も付ける。カードの
  ように隣と接する箱は offset なし）。**`outline-ring` を使わないこと** — `--ring`
  （`oklch(0.708 0 0)` = `#a1a1a1`）は白地でコントラスト **2.59:1** で、非テキストの
  3:1 に届かない。`globals.css` の base は `*` に `outline-ring/50` を当てているので、
  **focus-visible を書き忘れた要素はブラウザ既定の輪郭ごと 1.7:1 まで落ちる**（＝
  「フォーカスが見えない」の既定値になる）。hover を足したら focus も足す
  （`tools/hover-audit.mjs` は hover しか見ないので、これは grep で確かめる:
  `grep -rn "hover:text-seal\|hover:bg-accent" src/ | grep -v focus-visible`）
- **スピナーには必ず `motion-reduce:hidden` を付ける。** `globals.css` の
  reduced-motion 一括指定は `animation-iteration-count: 1` なので、無限ループの
  スピナーは1回転して固まる。その環境では出さず `sr-only` の文言で伝える
- **絞り込みの deferred は「条件まとめ」1つに載せる。** `useMemo` で束ねた
  オブジェクトを `useDeferredValue` へ通し、`filters !== deferredFilters` を
  「結果が古い」の判定に使う。個別の state を deferred にすると、コントロールの
  表示まで後追いになって選んだ値が遅れて出る
- **チップ（効いている条件）は生の state から作る**（deferred から作ると外した条件が残って見える）

## モバイルヘッダーは56pxの1行・行き先は3つ

`src/components/layout/site-shell.tsx` の `<header ... md:hidden>`。2026-08-06（Issue #92）に
ハンバーガー＋Sheet をやめ、`nav-data.ts` の **`shortLabel` を持つ3項目**（概要／皇帝一覧／
データベース）を直接置いた。理由と測った数字は SITE_DESIGN.md の
「モバイルヘッダーは行き先を文字で出す」節。

- **高さ 56px は寸法ではなく契約** — `globals.css` の `--chrome-top: 3.5rem` と対で、
  下の帯の `BELOW_STICKY_BAR` がこれを足して /emperors の節見出しと /database の表見出しの
  止め位置を決める。中身が折り返すと黙ってずれる（`flex-nowrap`・`whitespace-nowrap` を崩さない）
- **項目を4つ目にしない。** 320px での余りは **7px** しかなく、リンクの左右余白を `px-1.5` から
  `px-2` に戻すだけでふりがなトグルと重なる。**ページを1枚足しても `shortLabel` は付けない**
  （出口を増やしたいときは畳む・短くするではなく、まず 320px で測る）
- **ふりがなトグル（Issue #20）はこの帯の右端**（`RubyToggle` の `variant="compact"`）。
  状態の持ち主は `<html data-ruby>` ひとつのままで、`variant` は見た目だけ。**別のボタンを
  書いて `dataset.ruby` を直接触らないこと**（`RUBY_STORAGE_KEY` と layout.tsx の
  初期化スクリプトが1つの持ち主を前提にしている）
- **現在地の朱は前方一致**（`isCurrentSection`）で、皇帝個別365ページでは「皇帝一覧」に付く。
  `aria-current="page"` はそのページ自身にだけ
- 触ったら実測し直す（`hover-audit.mjs` はデスクトップ幅で走るのでこの帯を見ない）:

```bash
npm run build && node tools/header-audit.mjs   # 高さ56px・溢れ・折り返し・押せる高さ・現在地・cursor → NG: 0
```

## 画面上端に固定される帯は1行48pxを超えない

外枠は `src/components/layout/sticky-bar.tsx` の `StickyBar` 1本で、中身が2種類ある —
/emperors・/about の時代／章ジャンプ（`SectionJumpNav`）と、**/database の絞り込み一式**
（検索・時代・王朝・在位回数・**即位経路・死因**・列・件数）。どちらも**絞り込みを帯へ移したのは 2026-08-04
のユーザー指示**で、それまでは本文先頭に置いていて少し送ると条件を変える手段が画面から
消えていた。

**即位経路・死因（2026-08-17・Issue #94）は帯に出さず、どの幅でも「絞り込み」ポップオーバーの
中だけに置く** — 帯は @5xl の時点で検索・時代・王朝・在位回数・列・件数で埋まっており、
1920px の画面でも余りは321pxしかない（セレクト2つでほぼ使い切る）。**そのぶん「絞り込み」
ボタンを `@5xl/bar:hidden` で消さないこと** — 消すと広い画面からこの2つへ到達できなくなる。

**`STICKY_BAR_H`（48px）は寸法ではなく契約**。この値は /emperors の節見出しの sticky `top`
と節の `scrollMarginTop`、/database の**表見出しの sticky `top`** を兼ねているので、中身が
折り返して2行になると見出しと着地位置が黙ってずれる（tsc・lint・build はどれも落ちない）。
止め位置は直値で書かず `BELOW_STICKY_BAR` を使う（モバイルはサイトヘッダー
`--chrome-top` も画面上端を占める）。

- 帯に部品を足すときは**幅の分岐を `@container/bar`**（帯の内幅）で書く。ビューポート幅で
  分岐しないこと — md 以上はサイドバー240pxが挟まり、768pxの画面でも内幅は438pxしかない
- **ポップオーバーの中身はポータルで帯の外に出る**ので `@xl/bar:` 等の変種は効かない
- **0件でも帯は残す**（/emperors は `items` が空でも `trailing` があれば描く・/database は
  帯を `filtered.length === 0` の分岐の外に置く）。消すと絞り込みを外す導線が `NoResults`
  の1本だけになる。**/emperors はジャンプ側を逆に丸ごと消す** — 見出しと群を仕切る
  罫線はトリガーとは別の要素なので、`current` のガードを書き忘れると「指す相手のいない
  見出し」と「片側が空の群を仕切る罫線」が残る。ジャンプのトリガーは実測でも
  `data-jump-trigger` で引くこと（`[data-slot="popover-trigger"]` は王朝コンボボックスと
  絞り込みパネルにも付いていて、ジャンプが消えた場面では別のトリガーを拾う）
- **右詰めするのは件数だけ**（2026-08-04・2面共通）。件数を `ml-auto` の箱に入れ、余りを
  「操作の並び」と「結果の表示」の間に集める。`SectionJumpNav` は `trailing` の箱を
  右詰めしない（箱ごと右詰めすると余りが帯の中央に戻る。実測: ビューポート1920で321px）。
  /database は逆に、持たせないと余りが最後の要素の後ろ＝右端に残る（同241px）。
  **群を仕切る罫線（`data-bar-rule`）と「時代へジャンプ」の見出しは内幅42rem以上でだけ**
  出す（それ未満は群の間が8pxしかなく、足した分の縮み代を縮む側がかぶる）
- **帯の上に本文の `py-section` を残さない**（2面共通）。呼び出し側で `-mt-section` を
  左右の `-mx-gutter` と同じ理由で打ち消し、ページヘッダーの罫線に密着させる（残すと
  初期表示で上40px・下8pxの非対称になる。帯そのものは48pxの中で上下7.5pxの中央）
- **縮む側には幅の下限を置く**（/emperors はジャンプのトリガー・/database は検索窓）。
  条件が効くと帯の右側が太り、その増分を縮み代のある要素が全部かぶる（下限が無いと
  時代名が2文字・検索窓が72pxまで潰れた）。**溢れてはいないので `scrollWidth` の検査では
  拾えない**ので、`bar-audit.mjs` がその要素の実幅を測っている
- **帯の下を通る箱には `isolate` が要る**（/database の表）。表の右端フェード（z-40）は
  帯（z-30）と同じ重ね合わせ文脈に居ると、帯の右側（件数・列）の上に描かれる
- 触ったら実測し直す:

```bash
npm run build && node tools/bar-audit.mjs   # 高さ48px・横溢れ・縮む側の実幅・表見出しの位置・0件時 → NG: 0
```

## 図・カードから `/database` へ飛ばすときは区分名の全文を渡す

2026-08-17（Issue #94 の案5）に、概要ダッシュボードの内訳帯（死因・即位経路）の**凡例1行**を
`/database` の絞り込みへの導線にした。URL の組み立ては
**`emperor-types.ts` の `databaseFilterHref()` 1本**に閉じる（直に文字列を組まない）。

- **鍵は `shortCategoryLabel()` を掛ける前の全文。** 表も凡例も「受禅（易姓）」を「受禅」と
  短く描くが、`emperor-table.tsx` の復元は `deathCauseCategoryOrder` /
  `accessionRouteCategoryOrder` への**完全一致**で検査する。短縮形を渡すと**エラーにならず
  黙って捨てられ、絞り込みなしの365名が出る**（`?accession=受禅` で実測）
- **「その他（N区分）」はリンクにしない。** 1つの絞り込みに落ちないため。`BreakdownRow` に
  `filterValue` を持つ行だけがリンクになる（`foldRest` は畳んだ行に持たせない）。**死因は
  上位5区分で畳んでいるので、残り3区分へ届くのは絞り込みパネルのセレクトだけ**
- **リンク行では区分名の `sr-only` 併記を出さない**（`aria-label` が中身の読み上げを
  上書きするため、括弧つきの全文はそちらへ入れる）。**可視ラベルは `text-foreground` のまま
  動かさない** — 区分名は `--series-*` が 3:1 未満であることの免除条件そのもの
- `/lab` も同じ部品を使う。`facet` を渡さなければ従来どおりただの表示になる

**受け入れ確認はクリック（ソフトナビゲーション）でとる。** `page.goto('?death=…')` は
ハードナビゲーションで、復元 effect が `window.location.search` を読む経路しか見ない。
導線・件数・鍵の3つをまとめて見る道具がある（**凡例やカードを触ったら流し直す**）:

```bash
npm run dev -- --port 3100     # 別のターミナルで
node tools/nav-audit.mjs       # 件数の一致・区分名の全文・クリックでの復元 → NG: 0
```

区分を増減したら `nav-audit.mjs` 冒頭の `DEATH` / `ACCESSION` も直す（古いままだと
「カタログ外の鍵」で落ちる）。

## 「次に見る」を置くのは `/` と皇帝個別ページだけ

`src/components/layout/next-up.tsx`（2026-08-17・Issue #94 の案4）。

- **`/emperors`・`/database` には置かない。** 全高44,772px・18,226px でページ末尾まで
  到達しないので回遊にならない（この2面はモバイルヘッダーの3項目＝Issue #92 の案2が担う）
- **フッターの1行には触らない**（2026-08-03 の決定）。帯は本文の中・フッターの直上
- **皇帝個別ページでは前後ナビより上**に置く（前後ナビはフッターに接した位置で実測済み）
- **3枚に固定する。** 4枚目を足すと sm の2列・lg の3列のどちらでも末尾に穴が空く
- **カードに書く件数と着地先の件数を必ず一致させる。** 個別ページの3枚は
  `getAllEmperorRecords()` の `deathCauseCategory` / `accessionRouteCategory` / `dynastyKey` で
  数えている — `/database` の `EmperorTableRecord` が写しているのと同じフィールドなので
  一致するが、**別の集計に差し替えると「162名」のカードが161名の一覧へ着地する**
  （見るのは `tools/nav-audit.mjs` だけで、tsc・lint・build はどれも落ちない）
- 王朝で絞ると自分1人になる政権が34ある。**2名以上のときだけ王朝カードを出し**、
  それ未満は全員の一覧へ落とす（パンくずの王朝の項と同じ条件）

## shadcn CLI を叩くときの注意

**`npx shadcn init` は実行しない。** このプロジェクトは CLI から見ると未設定（`config: null`）で、`init` は `globals.css` を書き換える。パレットは受領値を無改変で入れてあるので上書きさせない。部品を足すときも `--dry-run` / `--diff` で差分を見てから。

## 単一情報源

- **`src/lib/base-path.ts` の `BASE_PATH`** — `next.config.ts` の basePath と肖像画 URL が共用。カスタムドメイン移行済みのため現在は `""`。`next/image` は `images.unoptimized` 時に basePath を自動付与しないので、`public/` 配下を参照する箇所は必ず `BASE_PATH` を明示する。
- **`src/lib/seo.tsx`** — `SITE_URL`/`SITE_NAME`・`buildMetadata()`・JSON-LD 生成関数・`SITE_SECTIONS`。各ページの `metadata` はこれ経由、`layout.tsx` の `title` は template 化済み。`app/sitemap.ts`・`app/robots.ts`・`app/manifest.ts` は `export const dynamic = "force-static"` が無いと `output: "export"` でビルドが落ちる。
- **`src/lib/video-channel.ts` の `VIDEO_CHANNEL`** — 動画はすべて当サイトと無関係の外部チャンネルの制作物のため、セクション冒頭と `/about` に必ず制作者表記を出す。
- **`src/app/globals.css`** の `/* @palette:start */`〜`end` — **配色と書体の唯一の正**（`--series-1〜8`・`--bar*`・`--seal`）と本文列の上限 `--container-content`。ここ以外に色を書かない。**`--series-*` は8色で、9区分目の色を作らない**（9つ目のカテゴリは「その他」へ畳むか面を分ける）。`--series-*` の3色は面 `#ffffff` に対してコントラストが 3:1 未満で、**「可視ラベルまたは表ビューがあること」が免除条件**（現状は凡例に区分名と実数を併記して満たしている）。**凡例のラベルを外す変更をするときは必ず再確認する。**
- **`src/lib/display-name.ts`** — **皇帝の表示名を決める唯一の場所**（2026-08-02）。カード1行目・h1・`<title>`・OGP・チャートの軸ラベルはすべてここを通す。`name.commonName` の括弧（諱・元号帝・爵位・別諡号が同じ記号を兼ねている）を解体し、明・南明・清は元号＋帝を1行目に上げる。**上書き表は2つ**（1行目の `DISPLAY_NAME_OVERRIDES` と補助名の `SUBTITLE_OVERRIDES`）で、存在しない id を入れると throw する。**冠称形（「漢の武帝」）は365人で一意**であることを `resolveQualifiedNameCollisions` が検査し、区別できない組があるとビルドが落ちる。**表示名を変えたら `data/name-readings.json` に読みを足す**（`rubyOf` が throw する）。設計は [../docs/site-design/NAME_DISPLAY_PLAN_2026-08-02.md](../docs/site-design/NAME_DISPLAY_PLAN_2026-08-02.md)。
- **`src/lib/dynasty-colors.ts` の `DYNASTY_COLOR_SLOT`** — 政権→配色スロット（**キーは政権 ID**・89政権）。未割当のキーは throw する。
- **`src/components/about/article.tsx` の `ARTICLE_WIDTH`** — `/about` の本文列（読み物幅・768px）。データページの `max-w-content`（1200px）とは別で、`PageHeader` の `containedWidth`・`SectionJumpNav` の `innerWidth`・各 `Section` の `containedWidth` へ**同じ値を渡す**（ずらすとジャンプバーだけ本文より左へ出る）。
- **`/about` の節の id 9つ** — `#operator` を `seo.tsx` の `OPERATOR_ID`（JSON-LD の Person）、`#dataset` を `DATASET_ID` が指している。id は見出しではなく `<section>` に付ける（`SectionJumpNav` の現在地判定が拾えなくなる）。**数え方11項目を Accordion で畳まない** — `ui/accordion.tsx` は `forceMount` を渡していないので閉じた本文が DOM から消え、サイトで唯一の「数え方」の記述が静的HTMLから落ちる。
- **`../data/images/portraits/manifest.json` の `focusY`** — 肖像の中で顔が縦のどこにあるか（0〜1）。一覧カードの肖像枠は実体（3:4）より横長で `object-cover` が縦を切るため、この値が切る位置を決める。**肖像がある全員に無いとビルドが落ちる**（`emperors.ts`）。肖像を足したら値も入れること（読み取り方は `docs/site-design/PORTRAITS.md`）。

## 配色の実値を焼き込んでいる箇所（CSS 変数が使えないところ）

`globals.css` の値を動かしたら、次も**同時に**直す。いずれも OKLCh → sRGB へ換算した実値が入っている。
ビルドは落ちないので、忘れると画面と OGP・ファビコンだけが別の色になる。

| ファイル | 何に出るか |
|---|---|
| `src/lib/og-image.tsx` の `PALETTE` | OGP画像（satori は CSS 変数を解決できない） |
| `src/app/icon.svg` | ファビコン（朱 `#c70036` 地に白の「帝」） |
| `src/app/manifest.ts` | PWA マニフェストの `background_color` / `theme_color` |
| `globals.css` のスクロールバー | `scrollbar-color` は変数を受けないブラウザがあるため実値 |
| `src/lib/dynasty-colors.ts` | 王朝色の計算（`SURFACE_HEX` / `INK_HEX` / `SLOT_HEX`） |

**`dynasty-colors.ts` の `SLOT_HEX` の番号は `--series-N` の N ではない** — 王朝の性格に色を当てる意味ベースの割り当て（下の「皇帝を追加収録するときのチェックリスト」2番）。

# 皇帝を追加収録するときのチェックリスト

データ側（`../data/emperors.json` への原典調査・`meta.count`/completedBlocks 系の更新・`python3 ../scripts/validate_emperors.py`）に加えて:

1. **`src/lib/kana-readings.ts` の音読みテーブルに新出漢字の読みを追記**（かな検索用・手書きテーブル）。未登録漢字はビルド時に throw するため、漏れるとビルドが落ちる
1. **`../data/name-readings.json` にふりがなを追記**（Issue #20・表示用のルビ。かな検索の 1 とは別物で、こちらは読みを1つに決め打つ）。**漢字を含む未登録の表示名は `rubyOf` が throw してビルドが落ちる。** 対象の一覧はビルドが `.ruby-displayed.json`（gitignore 対象）へ書き出すので、そこから引く — **時代ラベル16区分・王朝名の時代サフィックス（「呉・三国」）・カードの補助名は `emperors.json` に無い形**なので、data 側だけ見ても足りない。追記後は `python3 ../scripts/validate_readings.py`（記法・親文字一致）
2. **政権が増えたら `src/lib/dynasty-colors.ts` の `DYNASTY_COLOR_SLOT` に政権 ID を追記**（既存政権に皇帝を足すだけなら不要）。未割当のキーは throw する。スロットの選び方は意味ベース（漢系=4金・北族=1青・晋系=7紫・宋=2緑・明=8赤・隋/梁系=5青緑）で、政権の性格（v3 の `catalogs.regimes[].category`）が「並立政権」「反乱・自称政権」の割拠政権は 0（`--kinship-minor`・無彩色）
3. **人数のハードコード表記を更新**: サイト表示本体は `stats.emperorCount` から動的導出のためコード変更不要だが、ドキュメント類（`site/AGENTS.md`・ルート `README.md`/`CLAUDE.md`）と `CHANGELOG.md` の人数表記は手動更新
4. 肖像画を載せる場合は `../docs/site-design/PORTRAITS.md` の「肖像の増減手順」に従う（PD/CC0 のみ・manifest 管理）
5. `npx tsc --noEmit`・`npm run lint`・`npm run build` で検証（1〜3 の漏れはここで検出される）

# ハマりどころ

- **Radix系ポップアップのスクロールロックは `scrollbar-gutter: stable` と二重補正になり横ずれする** — react-remove-scroll が body に `margin-right` 補正を注入するため。`globals.css` の `body[data-scroll-locked][data-scroll-locked]` 上書きで打ち消し済み（属性セレクタ2連は `!important` 同士の詳細度勝負のため）。この上書きを消さないこと。
- **`prefers-reduced-motion: reduce` は `globals.css` の一括指定で潰してある**。Radix / tw-animate-css の開閉アニメーションはクラスで直接 `animation` を当てるため JS の `matchMedia` 分岐では止まらない。`animation: none` にはしないこと（Radix は `animationend` を待って要素を外すため、閉じたダイアログが DOM に残る）。なお **CSS アニメーションしか止まらない** ので、Recharts の JS アニメーション（`isAnimationActive`）は別途止める必要がある。
- **`overflow-x: auto` を当てた箱は、縦に溢れていなくてもスクロールコンテナになる** — 中の `position: sticky` の基準がビューポートからその箱へ移り、**見出しの固定が静かに効かなくなる**（`overflow-y: clip` を併せても変わらない）。`/database` の表は「収まっている間は `overflow-x: clip`、溢れた幅でだけ `auto`」に切り替えてこれを避けている（経緯は SITE_DESIGN.md の「6. データベース」節）。
- **worktree の `site/node_modules` を primary から symlink すると Turbopack が拒否する** — `Symlink [project]/node_modules is invalid, it points out of the filesystem root`。用意するのは `scripts/setup_worktree.sh` で、`npm run dev`／`npm run build` の `predev`/`prebuild` が自動で呼ぶ（primary からの `cp -al` ハードリンク複製・約0.75秒・ファイル実体は共有するのでディスクはほぼ増えない。下の playwright symlink もそのまま複製されるので `capture-site.mjs` が動く）。**このエラーを見たということは、そのスクリプトが走っていない**（手で symlink を張った、など）ので、`bash ../scripts/setup_worktree.sh --site` を流す。**ハードリンクなので worktree での `npm install` は primary 側の実体にも及びうる**（npm は unlink→作成なので通常は安全だが、in-place で書き換えるパッチ系ツールは primary を壊す）
- **`tools/capture-site.mjs` は npm の依存操作のたびに動かなくなる** — playwright は site の依存に入れておらず、`node_modules/playwright{,-core}` へ npx キャッシュから張った symlink で動いている。`npm install`/`uninstall` がこの symlink を消すため、`ERR_MODULE_NOT_FOUND: playwright` が出たら張り直す（`ln -sfn ~/.npm/_npx/<hash>/node_modules/playwright{,-core} node_modules/`・版は `~/.cache/ms-playwright` の chromium と合わせる）。
- **`.next` キャッシュ残存でハイドレーションが静かに失敗する**（コンソールエラーなし・画像404・フィルタ無反応）。設定変更後は `rm -rf .next` してから dev サーバーを再起動する。
- **Recharts は 2.15.4 に固定**。3.x では vendored した Tremor のチャートが動かない。**shadcn の `chart` レジストリ項目は `recharts@3.8.0` を要求する**ので、Tremor のチャートを残したまま shadcn の `Chart` を足すことはできない（二者択一）。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
