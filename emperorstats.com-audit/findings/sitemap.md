# サイトマップ監査（https://emperorstats.com/sitemap.xml）

対象: 本番 `sitemap.xml`（375 URL）／ 生成元 `site/src/app/sitemap.ts`（Next.js `MetadataRoute.Sitemap` の自前実装。`next-sitemap` 等の外部パッケージは不使用。`package.json` に sitemap 関連依存なしを確認済み）。ローカル資産 `site/out/`（378 HTML）と1本の Python（lxml）で機械突合。

## サマリ（重大度別件数）

| 重大度 | 件数 |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 2 |
| Info | 3 |
| Pass（問題なし・確認事項） | 5 |

---

## 1. 形式検証

**Pass** — XML は well-formed（`lxml.etree.parse` で例外なし、root は `{http://www.sitemaps.org/schemas/sitemap/0.9}urlset`）。
**Pass** — 配信ヘッダは `content-type: application/xml`、`cache-control: max-age=600`（`curl -sD- https://emperorstats.com/sitemap.xml`）。
**Pass** — URL はすべて絶対パス・`https://` スキームで、`https://emperorstats.com` 以外のホストを指す `<loc>` は0件（375件全チェック）。
**Pass** — トップページの `<loc>` は `https://emperorstats.com`（末尾スラッシュなし）。`site/out/index.html` の `<link rel="canonical" href="https://emperorstats.com"/>` と完全一致。生成元は `src/lib/seo.tsx` の `SITE_URL = "https://emperorstats.com"`（同一定数を sitemap 側 `SITE_URL` と canonical 側 `absoluteUrl()` の両方が参照しており、表記ズレが構造的に起きない設計）。個別ページも同様に確認（例: `/emperors/qin-shi-huang` の canonical と sitemap loc が一致）。
**Info（trailing slash の挙動、Low寄りだが実害なし）** — 本番はサブページで `/timeline/`（末尾スラッシュ付き）にアクセスすると404を返す（`/timeline` は200）。GitHub Pages の静的書き出し（`output: "export"`、`trailingSlash` 未設定＝false）の仕様どおりで、sitemap・canonical とも末尾スラッシュなしで統一されているため実害はない。ルート `/` のみ末尾スラッシュあり・なし両方が200（Cloudflareがドメインルートを正規化して両方受理している）。
  - 失敗判定: 外部クローラが `/timeline/` 等の末尾スラッシュ付きURLを独自にリンクしていて、それが404扱いされ続けている場合は要注意（現状 sitemap 自体は正しいため対応不要）。
  - 先行指標: 特になし（現状追加対応不要のため監視項目としてのみ記録）。

## 2. 網羅性の突合（sitemap 375 URL vs `site/out/` 378 HTML）

Python（lxml）で `sitemap.xml` の全 `<loc>` と `site/out/**/*.html` から導出したURL集合を突合した結果（スクリプトは1本の heredoc で実行、`site/out` の `index.html→/`、`xxx.html→/xxx`、`noindex` 判定は各HTMLの `<meta name="robots">` を正規表現で検出）。

| 項目 | 件数 |
|---|---|
| sitemap 総URL数 | 375（重複なし、全てユニーク） |
| `site/out/` 総HTML数 | 378 |
| (a) インデックス対象なのに sitemap 未収載 | **0件** |
| (b) sitemap 収載だが noindex | **0件** |
| (c) sitemap 収載だが `out/` に実体なし（404リスク） | **0件** |

**Pass** — 3つの必須チェックすべてゼロ。378 HTML の内訳は「10種類の統計・トップ系ページ＋皇帝個別365ページ＋`/about`」＝375（indexable）＋「`/kinship`・`404.html`・`_not-found.html`」＝3（意図的にnoindex）で、375と3が過不足なく分離できている。
**Pass（指定確認事項）** — `/kinship` は `site/out/kinship.html` の `<meta name="robots" content="noindex...">` を確認済みで、**sitemap 375件の中に `/kinship` は含まれていない**（`grep -i kinship sitemap.xml` で0件）。意図通りの状態であり、指摘対象の事象（誤って収載）は発生していない。
**Pass** — 皇帝個別ページは sitemap 側365件のID集合と `site/out/emperors/*.html` 365件のID集合が完全一致（`diff` の exit code 0）。欠落・余剰なし。
**Pass** — 統計ページ8種＋トップ＋`/about`＝10件は `SITE_SECTIONS`（`src/lib/seo.tsx`）8件＋固定2件と1対1対応し、sitemap側10件（lastmod付き）と完全一致。`/dynasties` も含め漏れなし。

## 3. lastmod

**タスク前提の訂正（重要）**: 依頼文では「全URLが `2026-07-22T00:00:00.000Z` 固定」とあったが、実際に lxml で数えたところ **`<lastmod>` を持つのは375件中10件のみ**（トップ＋統計8ページ＋`/about`）。**皇帝個別365ページには `<lastmod>` 要素自体が存在しない**（固定値ではなく「未出力」）。

生成元は `site/src/app/sitemap.ts`:

```ts
// 28-31行目のコメント（原文ママ）
// 個別ページに lastModified は付けない。データセットには人物単位の更新日時が
// 無く、一律 datasetGeneratedAt を付けるとデータ訂正1件で365ページ全部が
// 「更新済み」と主張することになる（信頼できない lastmod はクローラに
// 無視される方が害が大きい）。集計が実際に変わる統計ページ側のみ付ける。
const emperorPages: MetadataRoute.Sitemap = getAllEmperorRecords().map((r) => ({
  url: `${SITE_URL}/emperors/${r.id}`,
  changeFrequency: "monthly",
  priority: 0.5,
}));
```

トップ＋統計8ページ＋`/about` の10件だけが `lastModified: new Date(datasetGeneratedAt)` を持ち、`datasetGeneratedAt` は `data/emperors.json` の `meta.generatedAt`（現在値 `"2026-07-22"`）を1本のグローバル値として全10件に配っている。

**Medium（指摘）** — この10件についても、実態は「統計ページ8種＋トップ＋about」が本当に全て同一日に更新されたわけではない（`meta.generatedAt` はデータセット全体の生成日という単一フィールドで、ページ単位の更新粒度を持たない）。10件全部が同一 `lastmod` を名乗る点は、Google が「信用できないシグナル」として無視する典型パターンに該当する。ただし365件の個別ページについては **意図的に lastmod を省略する設計判断が既に取られており、これは正しい対応**（虚偽の lastmod を全365ページに付けるより優れている）。したがって指摘の実質的なスコープは「トップ＋統計8ページ＋about の10件のみ」であり、依頼文にあった「365ページ全部が固定値」という前提は誤り。
  - 証拠: `site/src/app/sitemap.ts` 8-26行目（10件生成部）、`site/src/lib/emperors.ts:194`（`datasetGeneratedAt = data.meta.generatedAt`）、`data/emperors.json` の `meta.generatedAt = "2026-07-22"`。
  - 改修案: (1) 現実的な最小改善として、10件のうち実際に更新頻度が異なるページ（例: `/about` は規約更新時のみ、`/dynasties` 等の統計ページはデータセット更新時のみ）を、Git 履歴から該当ソースファイル（`src/app/dynasties/page.tsx` 等）の最終コミット日時を `execSync("git log -1 --format=%cI -- <path>")` 等でビルド時に取得し個別に設定する方法がある（ビルド環境が `.git` を持つ前提が必要、CI環境で shallow clone の場合は depth 制限に注意）。(2) 皇帝個別365ページに関しては、`data/emperors.json` のスキーマに人物単位の `verifiedAt`/`updatedAt` フィールドが存在しない（`data/schema/EMPERORS_SCHEMA.md` に該当フィールドなしを確認済み）。単一JSONファイルのため `git log --follow` で行範囲から人物単位の最終更新日を機械的に割り出すのは脆く（配列内の位置がコミットごとに変わりうる、他人物の訂正で該当行が動く等）、精度を伴わない。恒久対応としてはスキーマに人物単位の更新日フィールドを追加する対応が必要だが、これは本監査のスコープ外（データスキーマ変更は `data/` 配下の変更でありデータ調査プロセスを要する）。現状の「省略」判断は次善策として妥当であり、無理に付けるべきではない。
  - 失敗判定: もし `data/emperors.json` に人物単位の信頼できる更新日時フィールドが既に存在していた場合（見落とし）、この指摘の(2)部分は成立しない。統計8ページが実際に同一頻度で自動更新される設計（例: 全ページが同じビルドパイプラインで同時に再生成され、実際に「同時更新」が正しい主張である）と判明した場合、(1)部分も成立しない。
  - 先行指標: Search Console の「ページ」→「インデックス登録」で、統計ページ群のクロール頻度・最終クロール日を追跡。lastmod 改善後にクロール頻度が上がるかを次回のSC確認時に見る（本監査ではGSC API未接続のため観測不可、`CONTEXT.md` に記載の既知制約）。

## 4. priority / changefreq

**Info** — Google は2020年以降 `priority`・`changefreq` を明示的に無視すると公言しており（本監査ルール上も既知情報）、現状の値付け（トップ1.0／統計0.8／about0.6／個別0.5、changefreq: weekly/weekly/monthly/monthly）はクロール優先度に一切影響しない。実害はないため急ぎの対応不要。
  - 対応案: 積極的に消す必要はないが、`sitemap.ts` のコード量・可読性を優先するなら削除して構わない。中途半端に「本当は無視されるが一応正しい値を保守し続ける」運用コストの方が問題（例えば今後ページが増減した際に priority の相対順位を都度考える手間）。**「消してよい／消さなくてもよい、どちらでも実害なし」という Info 止まりの指摘**であり、他チェック（lastmod・網羅性）より優先度は低い。
  - 失敗判定: 将来 Google がこれらのフィールドを再度シグナルとして採用した場合（公式発表があれば）、この指摘は無効化する。
  - 先行指標: なし（クロール挙動に影響しないため観測不可）。

## 5. 分割の要否（サイトマップインデックス化）

**Pass（現状で問題なし）** — 375 URL は Google の上限（50,000 URL かつ 50MB）に遠く及ばず、サイズ起因の分割は不要（現物サイズも数十KB程度）。

**Low（改善余地としての提案）** — サイズ起因ではなく「Search Console での可観測性」の観点では、皇帝個別365ページと統計10ページを別ファイルに分け `sitemap-index.xml` でまとめる価値がある。理由:
- 現状は単一 `sitemap.xml` のため、GSC の「サイトマップ」レポートで「送信済み365件 vs インデックス済み◯件」のような**セクション別インデックス状況**が見えない。365件の皇帝ページ群だけを切り出せば、「個別ページ群のインデックス登録率」が独立して追跡でき、仮に一部の皇帝ページだけインデックスされにくい（例えば `soft 404`・重複コンテンツ判定）といった問題が起きた際に早期発見しやすくなる。
- 365ページは「都市名だけ差し替えたロケーションページ」のような doorway パターンではなく、正史原典から調査した人物ごとの固有データ（在位・死因・即位経路など12項目、`Person` 構造化データ365件が個別に存在）を持つため、本ルールの「Penalty Risk」区分（ロケーションページの薄い量産コンテンツ）には該当せず、「Product pages（unique specs, reviews）」に近い「Safe at Scale」区分と判断する。したがって50件超過に対する「HARD STOP・ユーザーへの明示的正当化要求」は機械的には適用しない。ただし件数として大きいことに変わりはないため、インデックス状況を分割サイトマップで継続観察する価値は残る。
  - 改修案: `sitemap.ts` を `sitemap-pages.xml`（トップ＋統計8＋about、計10件）と `sitemap-emperors.xml`（皇帝365件）に分割し、`sitemap-index.xml` で束ねる。Next.js の `generateSitemaps()`（`MetadataRoute.Sitemap` の複数出力API）で実装可能。robots.txt の `Sitemap:` 行はインデックスファイル1本を指すだけでよい。
  - 失敗判定: GSC 上で現状すでにセクション別の絞り込み検索（`site:emperorstats.com/emperors/`等）で同等の可観測性が得られていると判明した場合、この提案の追加価値は小さい（本監査ではGSC API未接続のため実測不可、`CONTEXT.md` 記載の既知制約）。
  - 先行指標: 分割実施後、GSC「サイトマップ」レポートで `sitemap-emperors.xml` 単体の「送信済み/インデックス済み」比率を数週間観測する。

## 6. 画像サイトマップ

**Info（導入は必須ではないが低コストで価値あり）** — `data/images/portraits/manifest.json` に150件の肖像画（`data/images/portraits/*.jpg` 実ファイルも150件で一致）。実装を確認したところ、各皇帝ページの `<img>` は通常の `<img src="/portraits/{id}.webp" srcSet="..." alt="{名前}の肖像" loading="lazy" decoding="async" ...>`（例: `site/out/emperors/qin-shi-huang.html`）で、`alt` は必ず人物名入りの説明文（`CONTEXT.md` 記載の「alt欠落0件」と整合）。

- 通常の Google 画像検索クロールは、通常のサイトマップ/HTML内 `<img>` タグからも画像を発見できるため、image サイトマップ拡張（`<image:image>`）が「ないと画像がインデックスされない」わけではない。追加すると次のメリットがある: (1) lazy-loading画像でもクロール優先度を明示的に上げられる、(2) 画像専用の Discovered/Crawled/Indexed の追跡が GSC 上で可能になる。
- 150枚は365人中一部（約41%）のみで、肖像画がない残り約215人のページは画像なしのまま。image サイトマップを追加する場合、150件のみを対象にした専用ファイルにするか、皇帝サイトマップの各 `<url>` に `<image:image>` を条件付きで追加する実装が必要（存在チェックは `getAllEmperorRecords()` 側で肖像画有無を判定できる状態にする必要があり、現状 `sitemap.ts` は肖像画情報を参照していない）。
- 優先度: 費用対効果は限定的（画像検索経由の流入が主要導線でない学術データセットサイトである点、`CONTEXT.md` の性質記述と整合）と判断し、**Info** に留める。導入するなら上記の分割サイトマップ実装（`sitemap-emperors.xml`）と合わせて、肖像画ありの150件のみ `<image:image><image:loc>` を追加するのが実装コストが低い。
  - 失敗判定: 画像検索（Google 画像）からの流入がサイトのトラフィックで無視できない割合を占めると判明した場合（本監査ではGA4未接続のため確認不可）、優先度を上げるべき。
  - 先行指標: GA4 の参照元 `Google Images` セッション比率、または GSC の「画像」検索タイプでの表示回数（いずれも本監査では認証情報未設定のため取得不可、`CONTEXT.md` 記載の既知制約）。

---

## 補足: 突合スクリプトの再現方法

```python
from lxml import etree
import pathlib

ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
tree = etree.parse('sitemap.xml')  # curl -s https://emperorstats.com/sitemap.xml -o sitemap.xml
url_els = tree.findall('.//s:url', ns)
sitemap_urls = {u.find('s:loc', ns).text.strip() for u in url_els}

out_dir = pathlib.Path('site/out')
SITE = 'https://emperorstats.com'
def path_to_url(p):
    rel = p.relative_to(out_dir).as_posix()
    if rel == 'index.html': return SITE
    if rel.endswith('/index.html'): rel = rel[:-len('/index.html')]
    elif rel.endswith('.html'): rel = rel[:-len('.html')]
    return f"{SITE}/{rel}" if rel else SITE

def is_noindex(p):
    t = p.read_text(encoding='utf-8', errors='ignore').lower()
    return 'noindex' in t and 'name="robots"' in t

out_urls = {path_to_url(p): p for p in out_dir.rglob('*.html')}
noindex = {u for u, p in out_urls.items() if is_noindex(p)}
indexable = set(out_urls) - noindex

print("(a) indexable but missing from sitemap:", sorted(indexable - sitemap_urls))
print("(b) in sitemap but noindex:", sorted(sitemap_urls & noindex))
print("(c) in sitemap but not in out/:", sorted(sitemap_urls - set(out_urls)))
```

実行結果: (a) 0件 / (b) 0件 / (c) 0件。
