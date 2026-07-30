# オンページSEO 監査 — emperorstats.com

計測対象: `/home/sakis/emperor-stats/site/out/` 配下の 378 HTML（本番配信物と同一）。
計測日: 2026-07-27。担当: メイン会話（サブエージェントではない）。

## サマリ

| 項目 | 結果 |
|---|---|
| title 欠落 | **0 / 378** |
| title 重複 | 1組（`404.html` と `_not-found.html`・どちらも noindex なので実害なし） |
| title 60文字超 | **0** |
| meta description 欠落 | **0 / 378** |
| meta description 重複 | 1組3ページ（`index` / `404` / `_not-found`。404系は noindex なので実質重複なし） |
| canonical 欠落 | 2（404系のみ・仕様どおり） |
| h1 が1個でないページ | **0 / 378** |
| `<img>` の alt 欠落 | **0**（`alt=""` の装飾用途が60件） |
| 内部リンク切れ | **0** |
| 孤立ページ（被リンク0） | 2（404系のみ） |

オンページの基礎衛生は**非常に良好**で、通常の監査で挙がる指摘（title/description/h1/alt の欠落・重複）はほぼ存在しない。以下は、その水準を前提にした一段深い指摘。

---

## Critical

なし。

---

## High

### H-1. 統計ページ2件（`/death-accession`・`/dynasties`）に静的な数値が存在せず、内容が SVG の中にしかない

**証拠**（script/style/タグ除去後の本文文字数。共通ナビ＋フッター約200字を含む）:

| ページ | 本文文字数 | 静的な順位リスト | `<svg>` |
|---|---|---|---|
| `/death-accession` | **314字** | **なし** | 15 |
| `/dynasties` | **483字** | **なし** | 15 |
| `/ages` | 914字 | あり（上位10名 ×2） | 15 |
| `/military` | 1093字 | あり | 15 |
| `/reign` | 1144字 | あり（上位10名＋復位者表） | 19 |
| `/court-events` | 1540字 | あり | 15 |
| 皇帝個別365ページ | 中央値 5350字 | — | — |

`/death-accession` の本文に含まれる数値は次の2文だけ:

> 365名の死因で最も多いのは「病死」で、161名（44%）です。
> 即位経路で最も多いのは「世襲」で、120名（33%）です。

死因8分類のうち **7分類の実数がテキストとして一切存在しない**（円グラフの SVG 内にのみ存在）。`/dynasties` も同様で、87の王朝別平均在位年数のうち本文にあるのは清の1件のみ。

**なぜ問題か（第一原理）**: このサイトの価値は「正史から数え上げた数値そのもの」であり、検索エンジンにも AI にも、数値がテキストとして存在しなければ引用の対象にならない。「中国 皇帝 死因」「王朝 平均在位」といった、このサイトが本来最も強いはずのクエリで、当たるべきページが空に近い。

**これは横展開漏れである（ソースで確認済み）**: 静的な上位10名リストは共通部品 `site/src/components/tables/top-ranked-table.tsx` として実装されており、これを import しているのは次の4ページだけ:

```
site/src/app/reign/page.tsx
site/src/app/ages/page.tsx
site/src/app/military/page.tsx
site/src/app/court-events/page.tsx
```

円グラフ主体の `site/src/app/death-accession/page.tsx` と `site/src/app/dynasties/page.tsx` は import していない。部品はすでに存在するので、**新規実装ではなく既存部品の適用**で済む。

**修正案**: 既存4ページと同じ「読み取れること＋静的リスト」パターンを2ページへ横展開する。
- `/death-accession`: 死因8分類・即位経路の各分類について「〈分類〉 〈人数〉名（〈%〉）」の静的リストを追加（円グラフの下に凡例兼データ表として置けば UI 上の追加負担も小さい）。
- `/dynasties`: 皇帝5名以上の王朝について「〈王朝〉 平均〈N〉年（〈M〉名）」の静的リストを追加。

**依存関係**: この修正は [geo.md](geo.md) の引用適性と [sxo.md](sxo.md) のクエリ対応の前提になる。先にこれを行わないと、両者の改善提案は効果を発揮しない。

**失敗判定**: 本文に数値を出したあと、`site:emperorstats.com` で `/death-accession` のスニペットに実数（「161名」等）が現れない場合、原因はテキスト不足ではなく被リンク不足・ドメイン評価（[backlinks.md](backlinks.md)）にある。

**先行指標**: ビルド後に本文文字数を測り、314字 → 800字以上になったことを確認する。順位ではなくまず「クロール可能な数値の件数」を見る。

```bash
curl -s https://emperorstats.com/death-accession \
  | python3 -c "import sys,re;t=sys.stdin.read();t=re.sub(r'<(script|style).*?</\1>','',t,flags=re.S);print(len(re.sub(r'\s+',' ',re.sub('<[^>]+>',' ',t)).strip()))"
```

---

### H-2. 全378ページに、テキストが空の `<h3>` が7個ずつ、h1 より前に出力されている

**証拠**: `site/out/index.html` ほか全ページ。サイドバーの Radix Accordion トリガーが `<h3>` でラップされており、見出しテキストは h3 の外側の `<a>` にある。

```html
<div class="flex items-center">
  <a class="..." href="/reign">在位データ</a>   ← 見出しテキストはここ（h3の外）
  <h3 data-orientation="vertical" data-state="closed" class="flex">
    <button type="button" aria-expanded="false" ...>   ← h3の中身はボタンのみ = テキスト空
```

`shadcn/ui` の `AccordionTrigger` が既定で `AccordionPrimitive.Header`（= `h3`）を出力するのが原因。

**なぜ問題か**: 空の見出しは見出し階層のノイズであり、支援技術の見出しジャンプで7個の無名見出しに当たる。SEO 上のペナルティではないが、見出し構造の解析（Google・AI クローラの両方）を確実に劣化させる。

**修正案**: `site/src/components/ui/accordion.tsx`（該当ファイル）の `AccordionPrimitive.Header` に `asChild` を渡して `div` として描画するか、ナビゲーション用アコーディオンだけ `Header` を使わない派生コンポーネントにする。ナビゲーションは見出しではないので、`h3` である必然性がない。

**失敗判定**: 修正後に見出し階層が乱れる／アコーディオンのキーボード操作が壊れる場合は、`Header` を残したまま `sr-only` のテキストを入れる方式に切り替える。

**先行指標**: ビルド後に `grep -o '<h3[^>]*data-orientation' out/index.html | wc -l` が 0 になること。

---

## Medium

### M-1. 皇帝個別365ページの見出しが h1 → h3 に飛んでいる（h2 が存在しない）

**証拠**: 365ページすべてで見出しレベル飛びを検出。例 `site/out/emperors/qin-shi-huang.html`:

```
h1: 始皇帝
  h3: 即位の経緯      ← h2 が無い
  h3: 死因の経緯
  h3: 関連動画
```

**修正案**: これらのセクション見出しを `h2` に変更する。皇帝ページはサイト内で最大の面（365/378ページ）なので、構造の正しさの影響範囲が大きい。

**失敗判定**: 見出しレベルを上げた結果、視覚上の階層が壊れるなら、CSS のサイズ指定と意味論を切り離す（`h2` にして見た目だけ従来の h3 相当にする）。

**先行指標**: ビルド後に見出しレベル飛びを検出するスクリプトが 0 件を返すこと。

---

### M-2. OG 画像の HTTP Content-Type が `application/octet-stream`

**証拠**（本番実測・2026-07-27）:

```
https://emperorstats.com/opengraph-image                      → 200  54343B  application/octet-stream
https://emperorstats.com/reign/opengraph-image                → 200  40513B  application/octet-stream
https://emperorstats.com/emperors/qin-shi-huang/opengraph-image → 200 138647B application/octet-stream
```

HTML 側では `og:image:type: image/png` と宣言しているが、実際のレスポンスヘッダは `application/octet-stream`。原因は、Next.js の静的書き出しが OG 画像を**拡張子なしのファイル** `out/*/opengraph-image` として出力し、GitHub Pages が拡張子から MIME を決められないため。375件すべてが該当。

**なぜ問題か**: 一部の SNS・チャットアプリのリンクプレビュー生成器は Content-Type を見て画像を判定するため、カードが表示されない可能性がある。画像自体は 200 で取得できているので致命ではないが、宣言と実態が食い違っている。

**修正案**: 実害の有無をまず確認する（下記「失敗判定」）。対応するなら、ビルド後スクリプトで `opengraph-image` → `opengraph-image.png` にリネームし、メタタグの URL も揃える（`site/scripts/` に既存のビルド後処理があるのでそこに追加できる）。GitHub Pages はカスタムヘッダを設定できないため、拡張子を付けるのが唯一の手段。

**失敗判定**: X（Twitter）の Card Validator、Facebook の Sharing Debugger、Slack/Discord へのURL貼り付けでカードが正常表示されるなら、この指摘は実害なしとして見送ってよい。**まずこの確認を行い、問題が再現しなければ修正不要。**

**先行指標**: `curl -sI <og画像URL> | grep content-type` が `image/png` を返すこと。

---

### M-3. `/emperors` の meta description が他ページに比べて明確に手薄

**証拠**:

```
/emperors : 「全皇帝の図鑑。名前・王朝で検索し、詳細を表示」（22字）
/reign    : 「皇帝を名乗った365人の在位年数を長い順に並べたランキングと、廃位・退位を経て再び即位した復位者の一覧です。王朝ごとに絞り込めます。」（66字）
```

`/emperors` はサイト内で最も被リンクを集めるハブページ（375本の発リンク）でありながら、description だけが他8ページの水準（60〜76字）から外れて 22字。2026-07-21 に統計6ページの title/description を具体化した際の**横展開漏れ**と見られる。

**修正案**: 他ページと同水準（全角60〜80字）で、収録数・絞り込み軸・掲載項目を含む文へ差し替える。例:
> 始皇帝から溥儀まで、皇帝を名乗った365人の一覧です。王朝・時代で絞り込み、名前やよみで検索できます。各人の在位期間・死因・即位経路など全12項目を掲載しています。

**失敗判定**: description は順位要因ではないので順位は動かない。差し替え後、`site:emperorstats.com/emperors` の検索結果スニペットが新しい description のままなら成功。Google が本文から別の文を拾って書き換えているなら、description の問題ではなく本文側の問題なので、そちらを見る。

**先行指標**: `site:emperorstats.com/emperors` のスニペット表示文（ブラウザで目視。1〜2週間で反映される）。

---

## Low

### L-1. `<img>` の 185/194 に width/height 属性がない

**証拠**: 皇帝ページ50件＋`/`＋`/emperors` の抽出で、`width=` と `height=` を両方持つ `<img>` は 9件のみ、185件が未指定。`loading="lazy"` は176件に付与済みで、この点は良好。

肖像画の縦横比はまちまち（PD/CC0 素材のため）なので、CSS の `aspect-ratio` またはコンテナ側の固定寸法で吸収されている可能性がある。**CLS の実測が伴わない限り指摘を確定できない**ため、[performance.md](performance.md) の CLS 実測結果と突き合わせて判断すること。CLS が良好なら本項目は対応不要。

**失敗判定**: CrUX または実測で CLS < 0.1 が安定しているなら、この指摘は却下してよい。

---

### L-2. `alt=""` の装飾画像が60件

装飾目的の空 alt は**正しい実装**であり、それ自体は問題ではない。ただし60件が本当にすべて装飾かどうかは未検証。肖像画には `「〈皇帝名〉の肖像」` という適切な alt が付いていることを確認済み。

---

## 良好な点（維持すべき）

- **title / description / canonical / h1 / alt の欠落がゼロ**。378ページ規模でこの水準は稀。
- **内部リンク切れゼロ、孤立ページゼロ**（404系を除く）。皇帝365ページはすべて中央値3本の被リンクを持ち、`/emperors` ハブから全件が静的 `<a>` で到達可能（375本）。JavaScript なしでクロールできる。
- **OG / Twitter Card がページ単位で動的生成**されている（375件）。`og:image:alt` まで指定されており、この規模のサイトとしては丁寧。
- **`/ages`・`/reign`・`/military`・`/court-events` の「読み取れること」＋静的上位10名リスト**は、AI 引用と抜粋表示の両方に効く優れた実装。H-1 はこれを残り2ページへ広げる話であり、方式自体は既に正しい。
- 統計ページの description が「何を・何人分・どう数えたか」を含む具体的な文になっている。
