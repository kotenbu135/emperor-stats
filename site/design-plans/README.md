# design-plans — サイト全体のデザイン改善計画

このディレクトリは **実装待ちの計画書**を優先度順に並べたもの。1ファイル = 1つの変更で、実行者が会話の文脈なしで着手できるよう自己完結させてある。

作成: 2026-07-27／ブランチ `design-audit`／基準コミット `1540d63`

---

## 現在の状態

| | |
|---|---|
| ブランチ | `design-audit`（`main` から分岐） |
| 追加済みファイル | `site/DESIGN.md`（新規・承認済み）、このディレクトリ一式 |
| 実装済みの計画 | **01・02・03・04・05・07・08・09・11**（`1f96524`／`8318d29`／`c12301b`／`050ed68`／`d80f00b`／本コミット） |
| 破棄した計画 | **10**（統計3ページのリード文・下記） |
| 未着手の計画 | **06**（円グラフのラベル切れ・**計画の解法が成立しないことが実測で判明。別解の判断待ち**） |

### 05 の逸脱1件

`Section` の `mt-6` → `mt-block` は実施していない。`--spacing-block` を `@theme` に足すと Tailwind v4 の `inline-*`（`inline-size`）ユーティリティが `--spacing-*` 名前空間を食い、`.inline-block{inline-size:1.5rem}` が display ユーティリティの `.inline-block` と同名衝突するため（`/timeline` 5箇所・`/kinship` 2箇所・円グラフ2箇所が壊れる）。ユーザー判断で `mt-6` のまま残した。経緯は `docs/site-design/LAYOUT.md` の該当節。

### 10 を破棄した理由（再提案しない）

計画自身が Uncertainty に書いていた反証が、実データの照合で裏づけられた。**停止条件1「`sectionDescription()` が返す文字列が、そのページの `Section` の説明とほぼ同一だった場合は停止」に該当する。**

- `/reign` — リード候補 `在位年数ランキングと復位者（複数回即位）の一覧` に対し、節の h2 は `在位年数ランキング`（完全一致）と `復位者一覧（複数回即位）`（語順違いの同一表現）。新しい事実を1つも足さない
- `/death-accession` — リード候補 `死因別・即位経路別の内訳` に対し h2 は `死因別分布`・`即位経路別分布`。「分布」→「内訳」の同義語置換のみ。しかもこのページは `Section` を使っておらず、計画が拠り所にした「`Section` 側とは粒度が違う」という弁護が成立しない
- `/military` — リード候補 `親征・反乱鎮圧・被反乱の回数ランキング` は3つの h2 の主語を並べて「回数ランキング」を括り出しただけ

加えて計画の前提2つが事実と違っていた。(1) **`sectionDescription()` を `PageHeader` に渡している既存ルートは0件**（`description` を渡す8ルートはすべて手書きの散文）。計画は「既存パターンの再利用」と称しているが実際には新しいパターンの導入になる。(2) 計画が手本に挙げた `court-events/page.tsx:75-78` は `sectionDescription()` ではなく手書き文字列。既に `description` を持つ `/ages`・`/dynasties`・`/court-events` は、いずれも**見出しの括り出しを避けて**「数え年の定義」「個人→王朝への集計軸の変換」「在位中に朝廷で起きた出来事という上位カテゴリ」を書いている。

`SITE_SECTIONS` の description はトップページのカード本文そのものでもあるため、渡すと直前にクリックしたカードのコピーが h1 直下で反響する。

**別案（3ページに手書きのリード文を書き足す）は筋が通るが、計画の Design decision「文言を新しく書かない」に反するため、この計画としては実行しない。** 実施するなら新規計画とユーザー承認を経ること。

`site/DESIGN.md` はユーザー承認済みの設計契約。計画はすべてこれを根拠に書かれている。`npx @google/design.md lint DESIGN.md` が errors 0 / warnings 0 で通る状態を保つこと。

### 引用の検証状況

11件の計画に含まれる **331件の `パス:行番号` 引用を、計画1件につき1エージェントで並列照合済み**（2026-07-27）。行ずれ・識別子の誤り・存在しないファイルへの参照・相互参照の不整合を約30件検出し、すべて修正した。したがって**この計画群に書かれている行番号・クラス名・関数名は、基準コミット `1540d63` の作業ツリーに対して照合済み**である。

ただし `src/` に手を入れ始めると行番号はずれる。**1件実装するごとに、次の計画の引用を読み直してから着手すること。**

---

## 実装順（この番号順に進める）

番号は優先度順。**依存関係がある場合を除き、番号順に1件ずつ実装して検証する。**

| # | 計画 | 何が変わるか | 依存 |
|---|---|---|---|
| **01** | [王朝色システム＋チャート淡彩化](01-dynasty-color-system.md) | ランキング棒の朱一色をやめ、王朝ごとの色にする。チャートの塗りを地色と混ぜた濃度に揃える | — |
| **02** | [面と奥行き](02-surface-and-depth.md) | `--card` を地色から分離し、hover で1px 持ち上がる | 01 の後（モノグラムの濃度と干渉） |
| **03** | [日本語の改行制御](03-japanese-typesetting.md) | `text-balance` / `text-pretty` / `word-break: auto-phrase` | — |
| **04** | [モバイル固有の破綻](04-mobile-breakage.md) | 軸目盛りの重なり・横スクロールの手掛かり・行の折り返し | — |
| **05** | [タイポ/スペーシングのトークン化](05-type-scale-tokens.md) | `--text-micro` の導入と生px整理、`PageHeader` の余白トークン化 | 04 の後（`text-[11px]` の扱いが重なる） |
| **06** | [円グラフのラベル切れ](06-pie-arc-link-label-clipping.md) | 外側ラベルが切れないよう margin を広げる | 01 の後（同じチャートを触る） |
| **07** | [PageHeader の所有者統一](07-page-header-owner.md) | トップと404を `PageHeader` に載せ替える | — |
| **08** | [王朝の区分ヒント](08-dynasty-category-hint.md) | `/dynasties`・`/emperors` に ⓘ を足す | — |
| **09** | [サブセクション見出しのサイズ統一](09-subsection-heading-size.md) | h3 を `text-base` に揃える | 05 の後が望ましい |
| **10** | [統計ページのリード文](10-page-header-description.md) | 3ページに `description` を渡す | **反証あり。実施しない判断も妥当** |
| **11** | [`h-dvh` と重なりの段](11-baseline-hygiene.md) | `h-screen` → `h-dvh`、z-index の段を文書化 | — |

付属: [`01-dynasty-color-map.reference.txt`](01-dynasty-color-map.reference.txt) — 87王朝→配色スロットの対応表（01 の実装に必須）

---

## 全計画に共通する絶対条件

1. **`/kinship` の描画を1ピクセルも変えない。** 第1〜4章のノード配置はユーザーがドラッグ編集で確定させた凍結済みの成果物。01・04・05 が `/kinship` のコードに触れるが、いずれも純粋なリファクタリングとしてのみ触る
2. **`/timeline` の描画を1ピクセルも変えない。** 01 では対応表の供給元として扱うだけ。淡彩の混合比（`river-timeline.tsx:106-117` の塗り42%/縁82%）は第2世代「大河ビュー」の設計判断
3. **既存のパフォーマンス対策を退行させない。** `LazyMount`・行ウィンドウイング・量子化ウィンドウ・スクロール直後150msのホバー抑制・`useTipOutlet` による state 分離。経緯は `docs/site-design/LAYOUT.md` の「実機Lighthouse timespanレポート」2節（これを外すと実機 TBT 18秒・CLS 1.1 を記録した実績がある）
4. **`globals.css` の2つの回避ハックを消さない。** `html { scrollbar-gutter: stable }` と `body[data-scroll-locked][data-scroll-locked]` の二重補正打ち消し
5. **`src/components/ui/` は shadcn のベンダーコード。** 原則触らない（`npx shadcn` の再取得で上書きされる）
6. **各計画の `Stop conditions` に該当したら止めて報告する。** 独断で回避策を書かない

---

## 検証手順

### ビルドと静的ゲート（全計画共通）

```bash
source ~/.nvm/nvm.sh && nvm use 26.4.0
cd site
npx tsc --noEmit    # エラー0
npm run lint        # エラー0
npm run build       # 成功
```

### 見た目の回帰確認（before/after 比較）

実装前に**必ずベースラインを撮る**。`/kinship`・`/timeline` の同一性確認はこれでしか担保できない。

```bash
cd site
npm run build
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
- `BASE_URL` 環境変数でポートを変更できる

`/kinship` と `/timeline` は before/after のバイト比較（`cmp`）で一致すること。

### 実機性能（大きめの変更の後）

WSL2 上の Lighthouse は TBT を実測比10〜20倍に増幅する。**絶対値でなく相対比較と Long Task 実測で評価する。** 詳細は `docs/site-design/LAYOUT.md`「計測環境に関する重要な知見（WSL2）」

---

## 受け入れ後にやること

各計画の末尾に `## Design documentation` があり、**受け入れ・検証後に更新すべきドキュメントが具体的に指定してある**。実装と同じタイミングで反映する（プロジェクトの規約: データやUIを変更したら関連ドキュメントを同時に更新する）。

とくに 01 は `docs/site-design/LAYOUT.md` の6箇所・`TIMELINE.md` の3箇所・`site/DESIGN.md` の Colors 節・`site/AGENTS.md` のチェックリストに波及する。

---

## この計画群の出自（背景の要約）

1. `create-design-md` で `site/DESIGN.md` を作成（統制ソース: `globals.css`・`docs/site-design/LAYOUT.md`・shadcn 15プリミティブ）
2. 全13ルート×2幅のレンダリング証拠を取得（26枚）
3. `improve-ui` で6面を監査 → 3証明ゲート（Contract / Runtime / Correction）を通った5件が **06〜10**
4. ユーザー決定「王朝ごとに色を決めて皇帝はその色を利用する」→ **01**
5. `baseline-ui` で「古臭い・長く滞在したくならない」の原因を分析 → **02・03・11**
6. タイポ/スペーシングのスケールをユーザー承認 → DESIGN.md に記載、**05・09**
7. モバイル12ルートを目視確認 → **04**

未実施のまま残っている確認: なし（デスクトップ12ルート・モバイル12ルートとも目視済み）
