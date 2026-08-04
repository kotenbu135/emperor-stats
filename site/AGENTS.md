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
```

`tools/capture-site.mjs` は `out/` を自前の静的サーバーで配信する（`output: "export"` なので `/about` → `about.html` の解決が要り、素の静的サーバーでは 404 になる）。**ページを増減したらスクリプトの `SHOTS` も直すこと** — `page.goto` は 404 でも throw しないので、廃止済みのパスを撮ると 404 ページが「撮れた」ことになる（実装側で status を検証している）。

`predev`/`prebuild` で2つの生成スクリプトが走る:

- `scripts/sync-portraits.mjs` — `../docs/site-design/mockups/card-preview/` の肖像画 webp を `public/portraits/` へ同期し、sharp で 320px 幅サムネを `public/portraits/thumb/` に生成する。**`card-preview/` はビルド入力なので消さないこと。**
- `scripts/build-data-distribution.mjs` — 配布用データを `public/data/` へ

# 崩してはいけない契約

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
- **経緯の3節（即位・死因・復位）と「判定の軸」は出さない**（2026-08-03 ユーザー指示）。`accessionRoute.note`／`deathCause.note`／`reigns[].note`・その出典・即位経路の4軸はいずれも配布データ側にあり、**サイトには判定結果だけが出る**（基本情報の「即位経路」「死因」の行・在位経歴の「のちに復位」）。部品 `emperor-narrative.tsx` と `getEmperorNarrative` はファイルごと消えている。**戻すときは `/about` の運営者の節の文と対で動かすこと**（上の年表の行と同じ対で、いまは「これらの調査メモと引用はサイトの画面には出しておらず」と書いてある）。**この3節は紹介文が未執筆の皇帝ではページ上で唯一の散文だった**ので、戻す／戻さないの判断は SITE_DESIGN.md の「経緯3節（④）は表示ごと廃止した」節を読んでから

紹介文は `../data/emperor-profiles.json`（`emperors.json` とは別ファイル）。**存在しない皇帝idのキーがあるとビルドが落ちる**（`kana-readings`・`DYNASTY_COLOR_SLOT` と同じ書き間違い検出の assert）。未執筆でもページは成立する作りなので、フィールドが無い皇帝では紹介文の節が出ず `description` は機械生成文に落ちる。

**`lead` は総ルビ・`description` は平文**（Issue #20 の T2）。`lead` は `<RubyText>` に通し、行送りは `leading-loose` ではなく **`leading-ruby`**（ルビのある行だけ高くなって段落の中で行間がばらつく）。**置き場所は導入 `lead` がヒーローの中**（`emperor-hero.tsx` の名前チップの下）・**逸話を含む `body` が「人物紹介」節**（ページ直書き・基本情報の上）で、**肖像は sm 以上で `float`**（長い紹介文が肖像の下へ回り込む・末尾の `clear-both` を消すとヒーローの下境界が肖像を跨いで縮む）。**`lead` の段落区切りは空行（`\n\n`）で、ページ側が split して `<p>` に分ける** — 逸話を交えるようになって1本500字級になったため（`basis` はサイトに出さない編集メモ）。`description` は `<meta>` と Person JSON-LD にしか出ないのでルビを持たせず、**ルビ記法が混ざっていたら `emperors.ts` の読み込み時に throw する**（描画側で strip すると、呼び出し2箇所のうち片方を直し忘れる事故になる）。ゲートは `../scripts/validate_profiles.py`（文字数はルビを剥がした長さで数える）と `../scripts/validate_readings.py`。**執筆規約 `meta.policy` は 2026-08-04 に削除した**（既存の紹介文76本と `docs/process/profile-writing/` も同時に全削除・掲載する方針は変えていない）。**いま `profiles` は0本**なので、皇帝個別ページはどのidでも紹介文の節が出ず `description` は機械生成文に落ちる。

## ページを1枚足すときに揃える3箇所

`SITE_SECTIONS`（`src/lib/seo.tsx`）へ**先に**足してからページの `metadata` を書く。`sectionDescription()` は未登録の href で throw するので、順序を逆にするとビルドが止まる。`sitemap.xml` はここから導出される。

**OGP画像も同時に足す** — `src/lib/emperors.ts` の `OgFactPage` の union にパスを足し、`getOgFacts()` に分岐を書き、`app/<path>/opengraph-image.tsx` を置く。union に足さないと `getOgFacts("/新パス")` が型エラーになる。

グローバルナビは `src/lib/nav-data.ts`。

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

## 画面上端に固定される帯は1行48pxを超えない

外枠は `src/components/layout/sticky-bar.tsx` の `StickyBar` 1本で、中身が2種類ある —
/emperors・/about の時代／章ジャンプ（`SectionJumpNav`）と、**/database の絞り込み一式**
（検索・時代・王朝・在位回数・列・件数）。どちらも**絞り込みを帯へ移したのは 2026-08-04
のユーザー指示**で、それまでは本文先頭に置いていて少し送ると条件を変える手段が画面から
消えていた。

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
  の1本だけになる
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
