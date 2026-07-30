# design-plans — 2026-07-27 デザイン監査の記録と、撮り比べツール

2026-07-27 の設計監査で作った実装計画11件は**全件処理済み**（01〜09・11 を実装、10 は破棄）のため、
計画書の本体（`01-*.md`〜`11-*.md` と `01-dynasty-color-map.reference.txt`）は 2026-07-27 に削除した。
**実装後の正は各ドキュメントの側にある** — 何をどう変えたかは `docs/site-design/REDESIGN_2026-07.md`、
設計契約は `site/DESIGN.md`、王朝→配色スロットの対応表は `src/lib/dynasty-colors.ts` の `DYNASTY_COLOR_SLOT`
（87王朝を網羅・未知キーは throw する単一情報源）。計画書はこれらに置き換わったので消してよい、という判断。

このディレクトリに残すのは、**再提案を防ぐための決定記録**（下記）と、**回帰確認に使い続ける撮り比べツール `tools/`**、
そして2026-07-27 の第2回監査の記録（`AUDIT_2026-07-27-visual.md`・`TODO_2026-07-27-visual-seo.md`・**全16項目とも実装済み**）。
後者2つも、実装後の正が `docs/site-design/REDESIGN_2026-07.md` と `DESIGN.md` に移った時点で、11件の計画書と同じ理由で消してよい。

計画書を消した副次効果として、Tailwind v4 のソース走査が `design-plans/*.md` の散文中のクラス名
（`px-gutter` 等）を拾い、実装前からビルド出力に現れる紛らわしさも消えた。

## 計画11件の顛末

`docs/site-design/REDESIGN_2026-07.md` の各節が「design-plans/NN」として参照している番号の対応。

| # | 計画 | 結果 |
|---|---|---|
| 01 | 王朝色システム＋チャート淡彩化 | 実装 |
| 02 | 面と奥行き（`--card` 分離・hover で1px 持ち上げ） | 実装 |
| 03 | 日本語の改行制御（`text-balance` / `word-break: auto-phrase`） | 実装 |
| 04 | モバイル固有の破綻（軸目盛りの重なり・横スクロールの手掛かり） | 実装 |
| 05 | タイポ/スペーシングのトークン化 | 実装（逸脱1件・下記） |
| 06 | 円グラフのラベル切れ | **別解法で実施**（下記） |
| 07 | `PageHeader` の所有者統一 | 実装 |
| 08 | 王朝の区分ヒント（ⓘ） | 実装 |
| 09 | サブセクション見出しのサイズ統一 | 実装 |
| 10 | 統計ページのリード文 | **破棄**（下記・再提案しない） |
| 11 | `h-dvh` と z-index の段 | 実装 |

第2回監査（`AUDIT_2026-07-27-visual.md`）から起こした `TODO_2026-07-27-visual-seo.md` の16項目は
**全件実装済み**（2026-07-27）。うち06の再決着・即位時年齢の順位定義変更・DESIGN.md の5点改訂は
`docs/site-design/REDESIGN_2026-07.md`「見た目強化＋SEO 改修」節に記録した。
据え置きを明文化したもの（再提案しない）: 時代バンドは無彩色のまま・ダークモードは実装しない・サイドバー幅は凍結。

### 06 は計画とは別の解法で実施したが、その解法も 2026-07-27 に捨てた

**最終形は「弧内ラベルへの一本化」**（`TODO_2026-07-27-visual-seo.md` 項目6・ユーザー決定）。
列幅で外側ラベルを出し分けると、同じページに並ぶ2つのドーナツでラベル方式も描画半径も揃わない
（第2回監査 A-6）。以下は捨てた解法の記録として残す。

### 06 の当初の解法（2026-07-27 に廃止）

「左右 margin を広げる」は成立しない（375px では半径0の円でも収まらず、768〜1024px では計画の初期値がチャートを消し、
1440px でも直径149pxとなり計画自身の停止条件160pxを割る）。ユーザー確定により、`ResizeObserver` で列の実測幅を取り、
外側ラベルが成立する幅では margin を算出して出し、成立しない幅では弧の中に割合＋（入るなら）カテゴリ名を置く形にした。
全幅で切れがゼロになったことを実測済み。詳細は `docs/site-design/REDESIGN_2026-07.md` の該当節。

### 05 の逸脱1件

`Section` の `mt-6` → `mt-block` は実施していない。`--spacing-block` を `@theme` に足すと Tailwind v4 の
`inline-*`（`inline-size`）ユーティリティが `--spacing-*` 名前空間を食い、`.inline-block{inline-size:1.5rem}` が
display ユーティリティの `.inline-block` と同名衝突するため（`/timeline` 5箇所・`/kinship` 2箇所・円グラフ2箇所が壊れる）。
ユーザー判断で `mt-6` のまま残した。

### 10 を破棄した理由（再提案しない）

計画自身が Uncertainty に書いていた反証が、実データの照合で裏づけられた。**停止条件1「`sectionDescription()` が返す文字列が、
そのページの `Section` の説明とほぼ同一だった場合は停止」に該当する。**

- `/reign` — リード候補 `在位年数ランキングと復位者（複数回即位）の一覧` に対し、節の h2 は `在位年数ランキング`（完全一致）と `復位者一覧（複数回即位）`（語順違いの同一表現）。新しい事実を1つも足さない
- `/death-accession` — リード候補 `死因別・即位経路別の内訳` に対し h2 は `死因別分布`・`即位経路別分布`。「分布」→「内訳」の同義語置換のみ。しかもこのページは `Section` を使っておらず、計画が拠り所にした「`Section` 側とは粒度が違う」という弁護が成立しない
- `/military` — リード候補 `親征・反乱鎮圧・被反乱の回数ランキング` は3つの h2 の主語を並べて「回数ランキング」を括り出しただけ

加えて計画の前提2つが事実と違っていた。(1) **`sectionDescription()` を `PageHeader` に渡している既存ルートは0件**（`description` を渡す8ルートはすべて手書きの散文）。
計画は「既存パターンの再利用」と称しているが実際には新しいパターンの導入になる。(2) 計画が手本に挙げた `court-events/page.tsx` は
`sectionDescription()` ではなく手書き文字列。既に `description` を持つ `/ages`・`/dynasties`・`/court-events` は、いずれも
**見出しの括り出しを避けて**「数え年の定義」「個人→王朝への集計軸の変換」「在位中に朝廷で起きた出来事という上位カテゴリ」を書いている。

`SITE_SECTIONS` の description はトップページのカード本文そのものでもあるため、渡すと直前にクリックしたカードのコピーが h1 直下で反響する。

**別案（3ページに手書きのリード文を書き足す）は筋が通るが、計画の Design decision「文言を新しく書かない」に反するため実行しなかった。**
実施するなら新規計画とユーザー承認を経ること。

## UI を変更するときの絶対条件（計画群から引き継ぐ）

1. **`/kinship` の描画を1ピクセルも変えない。** 第1〜4章のノード配置はユーザーがドラッグ編集で確定させた凍結済みの成果物
2. **`/timeline` の描画を1ピクセルも変えない。** 淡彩の混合比（`river-timeline.tsx` の塗り42%/縁82%）は第2世代「大河ビュー」の設計判断
3. **既存のパフォーマンス対策を退行させない。** `LazyMount`・行ウィンドウイング・量子化ウィンドウ・スクロール直後150msのホバー抑制・`useTipOutlet` による state 分離（経緯: `docs/site-design/PERFORMANCE.md`。これを外すと実機 TBT 18秒・CLS 1.1 を記録した実績がある）
4. **`globals.css` の2つの回避ハックを消さない。** `html { scrollbar-gutter: stable }` と `body[data-scroll-locked][data-scroll-locked]` の二重補正打ち消し
5. **`src/components/ui/` は shadcn のベンダーコード。** 原則触らない（`npx shadcn` の再取得で上書きされる）
6. `site/DESIGN.md` はユーザー承認済みの設計契約。`npx @google/design.md lint DESIGN.md` が errors 0 / warnings 0 で通る状態を保つ

## 見た目の回帰確認（before/after 比較）

`/kinship`・`/timeline` の同一性確認はこれでしか担保できない。**実装前に必ずベースラインを撮る。**

```bash
source ~/.nvm/nvm.sh && nvm use 26.4.0
cd site
npx tsc --noEmit && npm run lint && npm run build
npx serve out -p 4599 &          # 静的書き出しを配信

cd design-plans/tools
npm i                            # 初回のみ（package.json に playwright 1.62.0 / sharp を固定済み）
SHOT_DIR=./before-desktop node capture-desktop.mjs   # 13ルート×2幅 = 26枚
SHOT_DIR=./before-mobile  node capture-mobile.mjs    # 390×844 の3スライス連結 = 12枚

# …実装…

SHOT_DIR=./after-desktop node capture-desktop.mjs
SHOT_DIR=./after-mobile   node capture-mobile.mjs
```

- `capture-desktop.mjs` — 1440×900 と 375×812 のフルページ。LazyMount を起こすため全高までスクロールしてから先頭に戻して撮る
- `capture-mobile.mjs` — 390×844（iPhone 14 相当）。**フルページだと `/emperors` が54,000px超になり判読できない**ため、上端・中間・下端の3スライスを sharp で1枚に連結する
- `verify-tooltips.mjs` — 円グラフのラベル・ツールチップの実測（06 の検証に使ったもの。実際に見るのは `/reign` と `/timeline`）
- `perf-check.mjs` — CLS と Long Task の実測（`node perf-check.mjs`。5ルート×375/1440px を回して
  レイアウトシフトの累積と50ms以上のタスク数を出す）。**絶対値でなく変更前との相対比較で見る** —
  1440px の CLS 0.0015〜0.0029 と読み込み時の Long Task 1〜2件は 2026-07-27 時点の素の値
- `BASE_URL` 環境変数でポートを変更できる。出力先（`before*/`・`after*/`・`shots*/`・`rebuild-shots/`）は `.gitignore` 済み

ユーザーに確認用スクリーンショットを見せるときは `/tmp` でなくこのディレクトリ配下（`rebuild-shots/` 等）へ出し、パスを本文で伝えること。

WSL2 上の Lighthouse は TBT を実測比10〜20倍に増幅する。**絶対値でなく相対比較と Long Task 実測で評価する。**
詳細は `docs/site-design/PERFORMANCE.md`「計測環境に関する重要な知見（WSL2）」。
