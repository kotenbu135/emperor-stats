# 日本語の改行を制御し、熟語が行をまたいで割れないようにする

Written against: 1540d63

## Evidence chain

- Surface: 全ルートの見出しとリード文・本文
- Problem: 改行制御が一切ないため、日本語が任意の文字位置で折り返され、熟語が分断される。実レンダリングでの例:
  - `/ages` のリード文 → 「正史に生年や享年の記載がない**皇** / **帝**も多く、算出できた皇帝のみを表示しています。」（「皇帝」が行をまたいで割れている）
  - `/timeline` のリード文 → 3行すべてが句の途中で折り返している
  - `/about` の本文 → 段落末尾に1〜2文字だけが残る行が複数ある
- Design evidence: `baseline-ui`「**MUST** use `text-balance` for headings and `text-pretty` for body/paragraphs」。加えて `site/DESIGN.md` Typography 節「日本語は任意の文字位置で改行されるため、見出しと本文には改行制御を必ず添える。制御のない見出しは単語の途中で折り返す」
- Owner: `src/components/layout/page-header.tsx`（`PageHeader` の h1 と説明文、`Section` の h2 と説明文）、`src/app/globals.css`（`@layer base` の `body`）
- Scope and affected surfaces: 全13ルート。`PageHeader` / `Section` を通す11ルートは所有者側の1回の変更で全部に効く
- Uncertainty: `word-break: auto-phrase` は Chrome 119+ / Edge のみ対応で、Safari と Firefox では無視される。無視された場合は現在と同じ挙動になるだけで劣化はしないが、ブラウザ間で改行位置が変わる。`text-wrap: pretty` の CJK 対応もブラウザによって挙動が異なる

## Design decision

**共有の見出しコンポーネントと `body` の3箇所だけに改行制御を入れ、各ページには書かない。**

- 見出し（h1 / h2）に `text-balance` — 行ごとの長さを均す。2行に折り返す見出しで極端に短い2行目が出るのを防ぐ
- 説明文・本文に `text-pretty` — 段落末尾に1〜2文字だけが残る行（孤立行）を防ぐ
- 本文の基底に `word-break: auto-phrase` — 日本語を文節単位で折り返す。「記載がない皇/帝」のような熟語の分断はこれで解消する

ページ側に個別に書かない。11ルートが `PageHeader` / `Section` を通っているため、所有者に入れれば横断的に効く。個別に書くと、新しいページを足したときに必ず漏れる。

`auto-phrase` は未対応ブラウザでは無視されるだけなので、フォールバックの分岐は書かない。

## Reuse

- `PageHeader` / `Section`（`src/components/layout/page-header.tsx`）
- `@layer base` の `body`（`src/app/globals.css:122-124`）
- Exemplar: `src/components/layout/site-footer.tsx:9`（`leading-relaxed` を1箇所に置いて全体に効かせている書き方）

新しいプリミティブは不要。ユーティリティクラスの追加のみ。

## Changes

1. `src/app/globals.css`（`@layer base` 内）
   - Change: `body` に `word-break: auto-phrase;` を足す
   - Preserve: `@apply bg-background text-foreground`、`html` の `font-sans` と `scrollbar-gutter: stable`、`body[data-scroll-locked][data-scroll-locked]` の二重補正打ち消し、カスタムスクロールバーの定義
   - Verify: Chrome で日本語の折り返しが文節単位になる。Safari / Firefox で現在と同じ挙動のままである

2. `src/components/layout/page-header.tsx:22`（`PageHeader` の h1）
   - Change: クラスに `text-balance` を足す
   - Preserve: `font-heading text-2xl font-semibold text-foreground md:text-3xl`、朱の縦バー、`contained` / `containedWidth` の挙動、`border-b border-border`
   - Verify: 長いタイトルが2行になったとき、1行目と2行目の長さが近づく

3. `src/components/layout/page-header.tsx:27`（`PageHeader` の説明文）
   - Change: クラスに `text-pretty` を足す
   - Preserve: `mt-2 max-w-2xl text-sm text-muted-foreground`
   - Verify: `/timeline` の長いリード文で、最終行に1〜2文字だけが残らない

4. `src/components/layout/page-header.tsx:60`（`Section` の h2）
   - Change: クラスに `text-balance` を足す
   - Preserve: `font-heading text-xl font-semibold text-foreground`、朱の縦バー（`bg-seal/80`）、`scroll-mt` の扱い
   - Verify: 375px 幅で「復位者一覧（複数回即位）」のような長い見出しが均等に折り返す

5. `src/components/layout/page-header.tsx:65`（`Section` の説明文）
   - Change: クラスに `text-pretty` を足す
   - Preserve: `mt-1 text-sm text-muted-foreground`
   - Verify: `/military` の3セクションの説明文で確認

6. `src/app/about/page.tsx`
   - Change: 散文が主体のページのため、本文段落のクラスに `text-pretty` を足す（`Prose` 的な共通ラッパーがあればそこに1回だけ）
   - Preserve: `mx-auto max-w-2xl` の中央寄せ、h2 / h3 の体裁、`leading-relaxed`、`#disclaimer` などのアンカー
   - Verify: 免責事項を含む長い段落で孤立行が減る

## Scope

- Inherit: `PageHeader` / `Section` を使う11ルート、`body` を通す全ルート
- Verify: `/kinship` と `/timeline` の SVG 内テキスト（`<text>` は `word-break` の影響を受けないが、`foreignObject` を使っている箇所があれば確認する）、チャートの軸ラベル
- Exclude: `tabular-nums` を当てた数値列（改行しない）、`truncate` / `line-clamp` を当てた箇所（1行に収める意図が既にある）、`ui/` 配下の shadcn プリミティブ

## Validation

- Product: リード文と見出しが、意味の切れ目で折り返されて読める
- Interface: `/ages`（「記載がない皇/帝」が解消していること）・`/timeline`（3行のリード文）・`/about`（長い段落）・`/reign` を、1440px と 375px で開く。Chrome と Firefox の両方で崩れがないこと
- System: 改行制御が `PageHeader` / `Section` / `body` / `/about` の本文ラッパーの4箇所にだけ存在し、各ページに散らばっていないこと（`rg 'text-balance|text-pretty' src/app` が `/about` の本文ラッパー以外で空。`*/page.tsx` のグロブは1階層しか展開せずトップと `/emperors/[id]` を取りこぼすので使わない）
- Repository: `npx tsc --noEmit` → エラー0、`npm run lint` → エラー0、`npm run build` → 成功

## Stop conditions

- `word-break: auto-phrase` を `body` に当てた結果、チャートの軸ラベルや `/kinship` のノードラベルで意図しない折り返しが起きた場合は停止して報告する。その場合は `body` ではなく本文コンテナに限定して当てる
- `text-balance` が長い見出し（4行以上）でブラウザの上限に当たって効かない場合は、そのまま受け入れる（劣化はしない）

## Design documentation

- 受け入れ・検証後: `site/DESIGN.md` Typography 節の「見出しと本文には改行制御を必ず添える」に、それが共有コンポーネント側で供給されること（ページ側で書かないこと）を追記する
