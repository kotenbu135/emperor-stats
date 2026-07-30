# 構造化データ監査（Schema.org / JSON-LD）— emperorstats.com

対象: `/home/sakis/emperor-stats/site/out/`（378 HTML、本番と同一）。生成元は `/home/sakis/emperor-stats/site/src/lib/seo.tsx`（JSON-LD の単一情報源）。

## 0. 検出結果サマリー（再掲＋実測による裏付け）

既知の内訳（BreadcrumbList 373 / Person 365 / WebPage 6 / Dataset 1 / CollectionPage 1 / WebSite 1）は `site/out/*.html` から実際の JSON-LD ブロックを抽出して再確認し、内訳の内部整合性を検証した。

- 形式: 全ブロック JSON-LD（Microdata / RDFa は検出されず）。`@context` は全ブロック `"https://schema.org"`（https、統一済み）。
- `WebPage` が **6件しかない**理由を特定した: 統計ページは 8 件（`/reign` `/death-accession` `/court-events` `/military` `/ages` `/dynasties` `/timeline` `/emperors`）だが、`/emperors` は `CollectionPage` を独自に使い、**`/timeline` だけ `WebPage` ブロックが無い**（`site/src/app/timeline/page.tsx` は `BreadcrumbJsonLd` のみ import・使用しており、他の6統計ページが使う `StatsPageJsonLd`／`statsPageJsonLd` の呼び出しが無い）。6+1(CollectionPage)+1(timelineの欠落) = 8 で辻褄が合う。→ §2-6 参照。
- `BreadcrumbList` 373 = 皇帝個別ページ365 + 統計ページ8（トップと`/about`にはBreadcrumbListなし。トップは階層の起点なので妥当、`/about`は他ページと非対称）。
- `@id` を使っているのは `Dataset`（`https://emperorstats.com/about#dataset`）のみで、統計ページの `WebPage.isPartOf` がそれを参照している。`WebSite`・`Person`・`BreadcrumbList`・`CollectionPage` には `@id` が無く、相互参照はしていない。→ §4。

## 1. 妥当性検証（ブロック別）

### 1-1. WebSite（`/`, 1件）— 条件付き合格

```json
{"@context":"https://schema.org","@type":"WebSite","name":"中国皇帝統計","url":"https://emperorstats.com","description":"...","inLanguage":"ja"}
```

- 重大度: **Info**
- 判定: 必須プロパティ（`name`・`url`）は充足。妥当。
- 不足: `potentialAction`（SearchAction）・`publisher`・`@id` が無い（機会として §3-2, §3-3 で扱う）。
- 失敗判定: Google が WebSite の `sameAs`/`publisher` を Knowledge Graph 名寄せに使わないと判明すれば、この指摘の優先度はさらに下がる（現状も SERP必須ではなく機会レベル）。
- 先行指標: 実装後 Google Search Console の「サイトリンク検索ボックス」レポート（該当があれば）で採用有無を確認。

### 1-2. Dataset（`/about`, 1件）— 概ね良好・一部に軽微な問題

```json
{"@context":"https://schema.org","@type":"Dataset","@id":"https://emperorstats.com/about#dataset",
 "name":"中国皇帝統計","description":"...","url":"https://emperorstats.com",
 "dateModified":"2026-07-22","version":"2026.07","temporalCoverage":"-0220/1945","inLanguage":"ja",
 "license":"https://creativecommons.org/licenses/by/4.0/","isAccessibleForFree":true,
 "creator":{"@type":"Organization","name":"中国皇帝統計"},
 "distribution":[{"@type":"DataDownload","encodingFormat":"application/json","contentUrl":".../data/emperors.json"},
                 {"@type":"DataDownload","encodingFormat":"text/csv","contentUrl":".../data/emperors.csv"}],
 "variableMeasured":[...13項目...],
 "measurementTechnique":"正史原典（本紀・列伝）を第一情報源とした個別調査",
 "size":"365件"}
```

- 重大度: **Medium**（Google Dataset rich result 必須プロパティは満たすが、推奨プロパティに抜けがあり、1プロパティが非標準）
- Google Dataset 必須（`name`）: ✅。推奨（`description`/`url`/`license`/`creator`/`distribution`/`temporalCoverage`/`variableMeasured`/`measurementTechnique`/`isAccessibleForFree`）: ✅ ほぼ充足。CC BY 4.0 のライセンスURLも正しい。
- **問題1（Low）**: `"size":"365件"` — schema.org の `Dataset` に `size` というプロパティは存在しない（衣類サイズ等は `Product` 系の話で無関係）。Google はスキーマに無いプロパティを無視するだけで実害はないが、意図（収録件数365件を機械可読にしたい）を達成できていない。件数は `variableMeasured` の要素数ではなく対象人物数なので、正しくは後述のとおり `Dataset` の `size` ではなく、`about` に「Thing（対象母集団365件）」の記述を足すか、単純に `description` 文中の365人表記に依存するのが無難。
  - 失敗判定: schema.org 語彙が将来 `size` を Dataset に追加した場合はこの指摘は無効化される（2026-07現在の schema.org 語彙には存在しない）。
  - 先行指標: [Rich Results Test](https://search.google.com/test/rich-results) で `size` が「認識されないプロパティ」として警告に出るかを確認（エラーにはならない想定）。
- **問題2（Medium）**: `creator` が `{"@type":"Organization","name":"中国皇帝統計"}` のみで `url` が無く、サイト全体で唯一の Organization 宣言なのに他ノード（WebSite・Person）と `@id` で結ばれていない。**§3-1 と統合して1つの Organization ノードに集約**すべき。
- **不足（Medium/Low・推奨プロパティ）**: `keywords`（Google のデータセット検索での発見性に寄与する推奨プロパティ、未設定）、`identifier`（DOI 等の永続識別子。Zenodo DOI は2026-07-21にユーザー判断で見送り済みのため、代替として GitHub リポジトリ URL を `identifier`/`sameAs` に使う案を §5 で提示）。
- 失敗判定: Google Search Console の該当ページでインデックス登録時に Dataset の警告が出ていない、または Dataset Search（datasetsearch.research.google.com）で本サイトが既に発見可能と分かれば、この指摘の緊急度は下がる（GSC・外部API未接続のため現時点で確認不可、CONTEXT.md の制約どおり「取得不可」と明記）。
- 先行指標: Rich Results Test の Dataset 検証結果（エラー0件・警告数の増減）、および Google Dataset Search でのサイト名検索結果。

### 1-3. CollectionPage（`/emperors`, 1件）— 合格

```json
{"@context":"https://schema.org","@type":"CollectionPage","name":"皇帝一覧","description":"...",
 "url":"https://emperorstats.com/emperors","inLanguage":"ja",
 "mainEntity":{"@type":"ItemList","numberOfItems":365,"itemListElement":[{"@type":"ListItem","position":1,"name":"始皇帝","url":".../emperors/qin-shi-huang"}, ...]}}
```

- 重大度: **Info**
- `ItemList.numberOfItems`（365）と実際に書き出された `itemListElement` の位置番号を突合し、位置1〜N が連番で欠番なしであることを確認（`emperors.html` 内の `position` 値を抽出しソート済みで確認）。妥当な実装。
- CollectionPage 自体は Google の専用リッチリザルトを持たないが、`ItemList` を内包しており構造は正しい。

### 1-4. Person（365件）— 概ね良好、いくつかの実証済み事実と1件の一貫性上の弱点

サンプル（`/emperors/qin-shi-huang`）:

```json
{"@context":"https://schema.org","@type":"Person","name":"始皇帝",
 "alternateName":["嬴政","秦始皇","趙政"],
 "url":"https://emperorstats.com/emperors/qin-shi-huang",
 "description":"秦の皇帝。在位前221–前210年（10年265日）。",
 "image":"https://emperorstats.com/portraits/qin-shi-huang.webp",
 "birthDate":"-0258-01","deathDate":"-0209-09-10",
 "sameAs":"https://www.wikidata.org/wiki/Q7192"}
```

`site/out/emperors/*.html`（365ファイル）を全件走査した結果:

| 項目 | 結果 |
|---|---|
| `sameAs`（Wikidata QID）付与率 | **365/365（100%）** — 依頼事項の確認完了。`data/emperors.json` の `sources.wikidata` は全365人で非null、`site/src/app/emperors/[id]/page.tsx` の `record.wikidataId ? [...] : undefined` により全件が JSON-LD へ反映されている。 |
| `birthDate` 付与率 | 169/365（46%） |
| `deathDate` 付与率 | 289/365（79%） |
| `alternateName` 付与率 | 309/365（85%）、56件は0件 |

- 重大度: **Info**（`birthDate`/`deathDate`/`alternateName` の欠落は史料上生年月日・別名が特定できない人物が実在するための正当な欠落であり、実装バグではない）。
  - 検証: `beiqi-gaoxie`（北斉の傀儡的な皇帝）・`gongsun-shu`（後漢初期の自称皇帝）は `data/emperors.json` の `name.personalName` と `name.commonName` が同値で `templeName`/`posthumousName`/`aliases` が空のため、`alternateName` が正しく空配列になり出力から除外される（`site/src/lib/seo.tsx` の `personJsonLd` の重複フィルタどおりの正常動作）。
  - 失敗判定: もし史料上判明しているのにフィールドが空の人物が見つかれば、これは実装ではなくデータ側の欠落として別途データ訂正が必要（本監査のスコープ外・`data/emperors.json` の担当）。
  - 先行指標: 今後のデータ更新で `ages.birthDate`/`ages.deathDate` が埋まった人物数の増加を `git log -- data/emperors.json` で追跡。

- **紀元前日付のISO 8601表記（検証・結論＝妥当）**: `birthDate:"-0258-01"` は一見「前258年」に見えるが、`docs/schema/SCHEMA_OVERVIEW.md`（56–57行）に明記の通り、ISO日付文字列の内部生成だけは天文年（前n年 → -(n-1)）を使う設計。実際に始皇帝の `ages.note`（`data/emperors.json`）は「生年前259年正月」と明記しており、天文年変換 -(259-1)=-258 と正しく一致することを検算で確認した。**ISO 8601 の天文年ナンバリングとして技術的に正しい**。
  - 重大度: **Info**（問題ではなく確認事項として記録）
  - 注意点: Google の Rich Results Test / 一般的なJSON-LDバリデータは紀元前（負の年）の `Date` をどこまで厳密にパースするか実績に乏しく、Person型自体がGoogleの固有リッチリザルトを持たないため実害は無いと考えられるが未検証。
  - 失敗判定: Rich Results Test で `birthDate`/`deathDate` の形式エラーが出れば、この「妥当」判定は撤回が必要。
  - 先行指標: 皇帝個別ページのURLを数件 Rich Results Test に通し、Person ブロックが警告なく解析されるか確認。

- **name の一意性（Low・情報提供）**: 365件の `Person.name` のうち **104件（37種類の名前・28%）が他の人物と同一の `name` 値を共有**している（例: `武帝` 9件、`明帝` 8件、`太宗`/`太祖`/`後主` 各3〜4件など。廟号・諡号は王朝を跨いで頻繁に再利用されるため）。各人物の `url` は個別ページで一意、`sameAs` も Wikidata QID で一意なため、検索エンジン側での名寄せ自体は可能と考えられるが、`Person` ノード単体を機械的に読んだ場合の曖昧性は残る。
  - 対応要否: サイトの表示名（H1・タイトル）自体が「武帝」等の廟号単体であり、構造化データは可視コンテンツと一致させる必要があるため、`name` を変更する（例:「漢武帝」に変更）のは可視表示との一致原則に反する可能性がある。**現状維持を推奨**しつつ、`disambiguatingDescription` プロパティ（Person で使用可）に王朝名を明示的に加えることで曖昧性を機械可読に軽減する余地はある（§5-3 でコード例を提示）。
  - 失敗判定: Google が Person の名寄せに `sameAs` を優先し `name` の一意性を問題にしないと確認できれば、この指摘は不要になる（Person は現状 Google の固有リッチリザルト対象ではないため実害は限定的）。
  - 先行指標: 該当ページ（例 `/emperors/han-wudi`）を Rich Results Test / Schema Markup Validator に通し、警告の有無を見る。

### 1-5. BreadcrumbList（373件）— 合格

皇帝個別ページ365件はいずれも「サイト名 › 皇帝一覧 › 人物名」の3階層、統計ページ8件は「サイト名 › ページ名」の2階層で、`position` は1始まりの連番。`item` は全て絶対URL（`https://emperorstats.com/...`）。妥当な実装。`/` と `/about` に BreadcrumbList が無いのは非対称だが、階層の起点である `/` に無いのは妥当、`/about` に無いのはやや一貫性を欠く（Info・§4）。

### 1-6. WebPage（6件、統計ページ）— `/timeline` に欠落あり

`/reign` `/death-accession` `/court-events` `/military` `/ages` `/dynasties` の6ページには次の形式で存在:

```json
{"@context":"https://schema.org","@type":"WebPage","name":"...","description":"...",
 "url":"https://emperorstats.com/reign","inLanguage":"ja",
 "isPartOf":{"@type":"Dataset","@id":"https://emperorstats.com/about#dataset","name":"中国皇帝統計","url":"https://emperorstats.com/about"}}
```

- 重大度: **Low**（構造化データの欠落であり表示・SEO両面で致命ではないが、7つある統計ページのうち `/timeline` だけ `WebPage`／`isPartOf` によるデータセット接続が無いのは明確な非一貫性）
- 証拠: `site/src/app/timeline/page.tsx` の import は `BreadcrumbJsonLd, buildMetadata` のみで、他の6ページが使う `StatsPageJsonLd` の呼び出しが無い。ビルド出力 `site/out/timeline.html` にも `WebPage` ブロックは存在しない（BreadcrumbListのみ）。
- 修正案: 他ページと同じパターンで `StatsPageJsonLd` を追加する（§5-1 のコード例）。
- 失敗判定: `/timeline` が意図的に他ページと異なる情報構造（「大河ビュー」というビジュアライゼーション主体でWebPage的な記述に馴染まない）だとサイト側で判断されていれば、この指摘は「意図的な設計差」として無効になる。ただし他6ページとの対称性を崩す理由は本監査からは見当たらない。
- 先行指標: 修正後、`site/out/timeline.html` に `WebPage` ブロックが出現し、`isPartOf` が `about#dataset` を指すことを再ビルドで確認。

## 2. 欠落している機会

### 2-1. Organization（運営者）ノードの不在（Medium）

サイト全体に「誰が運営しているか」を示す一次的な `Organization`（または個人運営なら `Person`）ノードが存在しない。現状唯一の関連記述は `/about` の `Dataset.creator`（`{"@type":"Organization","name":"中国皇帝統計"}`）のみで、`url`・`sameAs`・`@id` を持たず孤立している。
- 影響: Google のエンティティ理解・Knowledge Graph 名寄せ、E-E-A-T的な発行者情報の明示に寄与する機会を逃している。
- 修正案: `Organization` を1ノード定義し `@id` を振って `WebSite.publisher` と `Dataset.creator`（`publisher`も）から参照する（§5-2）。
- 失敗判定: サイトが完全な匿名運営方針で組織名の対外的な明示を望まない場合、この提案自体を採用しない判断もあり得る（ただし現状既に `Dataset.creator.name` として "中国皇帝統計" を名乗っている以上、矛盾は生じない）。
- 先行指標: 実装後、Google のリッチリザルトテストで Organization ノードが警告なく解析されるか、また `site:emperorstats.com` のブランド検索でナレッジパネルの構成要素に変化が出るか（後者は長期観測）。

### 2-2. WebSite の SearchAction（sitelinks searchbox）未実装（Low〜Medium）

`/emperors` ページには実際に `?q=` クエリパラメータで検索状態がURL同期される実装が既にある（`site/src/components/emperors/emperor-grid.tsx` 165行目以降、`history.replaceState` で `?q=&dynasty=&category=` を書き込み、マウント時に `URLSearchParams` から復元）。この既存機構は `WebSite.potentialAction`（SearchAction）の実装コストを大きく下げる。
- 現状: `WebSite` JSON-LD に `potentialAction` が無く、Google がサイトリンク検索ボックスの対象として認識できない。
- 修正案: `urlTemplate` に `https://emperorstats.com/emperors?q={search_term_string}` を指定する `SearchAction` を追加（§5-2）。
- 注意: サイトリンク検索ボックスは Google 側の裁量で表示可否が決まり、追加しても必ず出るわけではない。またクエリを受けて表示するのはクライアントサイドのフィルタ処理（CSR）である点は、Googlebotのレンダリング前提では問題にならないが、非JS環境では機能しない点は既存実装の制約としてそのまま。
- 失敗判定: 実装後もサイトリンク検索ボックスが一定期間（数ヶ月）出現しなければ、ドメインオーソリティ不足など別要因の可能性が高く、この指摘の優先度が下がる。
- 先行指標: Search Console の「サイトリンク検索ボックス」機能（該当時のみ表示）、または `site:emperorstats.com <query>` のSERP見た目の変化。

### 2-3. ランキング統計ページへの `ItemList` 未実装（Medium）

`/reign` `/ages` `/court-events` `/military` `/death-accession` `/dynasties` の6ページには、`TopRankedTable`（`site/src/components/tables/top-ranked-table.tsx`）によるクロール可能な「上位10名」静的リストが実装済み（サーバーコンポーネントで `<ol>` + `<Link href="/emperors/{id}">` として書き出され、ランキング棒グラフの非JSフォールブラック兼クローラブルリンクを兼ねる設計であることがコード内コメントから確認できる）。しかし、この上位10名リストに対応する `ItemList` の JSON-LD が無く、現状の `WebPage` ブロックにはリスト構造が反映されていない。
- 影響: リッチリザルトとしての直接効果は不確定だが、ページの主要コンテンツ（ランキング）を機械可読な `ItemList` として明示することは、検索エンジンのページ内容理解を補強する一般的なベストプラクティス。
- 修正案: 各統計ページの `WebPage` に `mainEntity` として `ItemList` を追加する。順位（`ranks[metricKey].rank`）と表示値をそのまま使う（§5-1）。
- 失敗判定: Google が独自リッチリザルトとしてこの `ItemList` を採用しない（現状 `ItemList` 自体に専用のSERP機能は無い）ため、効果は「機械可読性の補強」に留まり、トラフィックの直接増加とは切り離して評価する必要がある。過大な効果を期待していたと分かれば、この指摘の優先度は下げてよい。
- 先行指標: Rich Results Test でエラーなく解析されることの確認（直接的なCTR変化はGSC接続後でないと測定不可・現状「取得不可」）。

### 2-4. `/about` と `/` への BreadcrumbList 欠落は一貫性の問題として許容範囲（Info・§4に統合）

## 3. 一貫性（`@id` によるグラフ結合）

現状 `@id` を持つノードは `Dataset`（`/about#dataset`）のみ。統計ページの `WebPage.isPartOf` はこれを正しく参照しているが、それ以外は以下のように孤立したグラフになっている:

- `WebSite`（`/`）: `@id` なし。`Dataset.creator` や `Person.sameAs` と論理的に同じ運営主体を指しているはずだが、機械的な結合が無い。
- `Person`（365件）: `@id` なし。同一ページ内の `BreadcrumbList` の該当 `ListItem.item` と同じURLを指しているが、`@id` での明示的結合はない。
- `CollectionPage`（`/emperors`）: `@id` なし。365件の `Person` ノードへは `ItemList.itemListElement[].url` で緩く繋がっているのみ。

重大度: **Medium**（Google のリッチリザルト獲得に必須ではないが、エンティティ間の関係を機械的に一意に辿れるようにする＝グラフとしての堅牢性を高める一般的なベストプラクティス。特に `Organization` 導入時（§2-1）は `@id` 結合が実質的な前提になる）。

修正方針: 各ページの `@id` を `page-url + #webpage` / `#person` 等のフラグメントで統一的に振り、`WebSite.publisher`・`Dataset.creator`・（将来のOrganization）を単一の `@id` に集約する。具体例は §5-2。

失敗判定: 現状の孤立グラフでも Google が `sameAs`（Wikidata QID）経由で十分に名寄せできていると判明すれば、`@id` 結合の優先度は下がる（ただし損失もないため実装コストが低ければ推奨は維持できる）。
先行指標: Rich Results Test / Schema Markup Validator でグラフ全体を読み込ませ、`@id` 参照の解決に警告が出ないことを確認。

## 4. デプリケート型・FAQ/HowTo の扱い（確認のみ・対応不要）

- サイト全体を走査した既知の内訳に `FAQPage` / `HowTo` / `SpecialAnnouncement` / `CourseInfo` / `EstimatedSalary` / `LearningVideo` は**含まれていない**。新規追加も推奨しない（`/about` に免責事項・Q&A的な記述があっても、`FAQPage` ではなく通常の `WebPage`／`Dataset` の一部として扱うのが妥当。Google が2026-05-07に全サイト対象でFAQリッチリザルトを廃止済みのため、仮に追加してもSERP効果はゼロ）。
- 重大度: **Info**（現状維持を推奨・積極的な指摘ではない）

## 5. 推奨 JSON-LD（実データで埋めた具体例）

### 5-1. `/timeline` への WebPage 追加（既存6ページと同一パターン。§1-6・§2-3のItemList込み）

`site/src/app/timeline/page.tsx` に他の統計ページと同様の呼び出しを追加する想定（このファイルは監査対象のためコードは変更せず、実装時の参考コードとして提示）:

```tsx
import { StatsPageJsonLd } from "@/lib/seo";

<StatsPageJsonLd
  name="通史年表"
  description="始皇帝から溥儀まで、全皇帝の在位を1本の年表で一望"
  path="/timeline"
/>
```

生成される JSON-LD（他6ページと同一形式・実際のサイト名/URLを使用）:

```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "通史年表",
  "description": "始皇帝から溥儀まで、全皇帝の在位を1本の年表で一望",
  "url": "https://emperorstats.com/timeline",
  "inLanguage": "ja",
  "isPartOf": {
    "@type": "Dataset",
    "@id": "https://emperorstats.com/about#dataset",
    "name": "中国皇帝統計",
    "url": "https://emperorstats.com/about"
  }
}
```

### 5-2. ランキングページへの `ItemList`（例: `/reign` の「在位期間の上位10名」。実際に画面に出ている上位表と同じ内容にすること）

`site/src/lib/seo.tsx` の `statsPageJsonLd` を拡張し、`WebPage.mainEntity` に `ItemList` を追加するイメージ（`TopRankedTable` が既に持つ `records`/`ranks`/`metricKey` をそのまま使い回せる）:

```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "在位データ",
  "description": "在位年数ランキングと復位者（複数回即位）の一覧",
  "url": "https://emperorstats.com/reign",
  "inLanguage": "ja",
  "isPartOf": {
    "@type": "Dataset",
    "@id": "https://emperorstats.com/about#dataset",
    "name": "中国皇帝統計",
    "url": "https://emperorstats.com/about"
  },
  "mainEntity": {
    "@type": "ItemList",
    "name": "在位期間の上位10名",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "url": "https://emperorstats.com/emperors/qing-shengzu" },
      { "@type": "ListItem", "position": 2, "url": "https://emperorstats.com/emperors/qing-gaozong" }
    ]
  }
}
```

（注: 実際の1位・2位は `TopRankedTable` が `record.ranks["reignDuration"]` 等の実データから算出するため、ビルド時に実データを流し込む実装にすること。上記は形式の例示であり、順位固定値をハードコードしてはならない。）

### 5-3. Organization ノードの新設 ＋ WebSite/Dataset からの `@id` 参照統合

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://emperorstats.com/#organization",
      "name": "中国皇帝統計",
      "url": "https://emperorstats.com",
      "sameAs": ["https://github.com/kotenbu135/emperor-stats"]
    },
    {
      "@type": "WebSite",
      "@id": "https://emperorstats.com/#website",
      "name": "中国皇帝統計",
      "url": "https://emperorstats.com",
      "description": "始皇帝から溥儀まで、中国史上で実際に「皇帝」を名乗った365人の在位期間・死因・即位経路などを集計・可視化したサイトです。",
      "inLanguage": "ja",
      "publisher": { "@id": "https://emperorstats.com/#organization" },
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://emperorstats.com/emperors?q={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      }
    }
  ]
}
```

`/about` の `Dataset.creator` は同じ `@id` を参照する形に統一する:

```json
"creator": { "@id": "https://emperorstats.com/#organization" },
"publisher": { "@id": "https://emperorstats.com/#organization" },
"keywords": ["中国史", "皇帝", "在位期間", "正史", "オープンデータ", "CC BY 4.0"],
"identifier": "https://github.com/kotenbu135/emperor-stats"
```

（`https://github.com/kotenbu135/emperor-stats` は `/about` ページ内で実際にライセンス・データスキーマへのリンク先として使われている実在URL。DOI取得は2026-07-21にユーザー判断で見送り済みのため、恒久識別子の代替として提示。）

### 5-4. Person の曖昧性緩和（`disambiguatingDescription`。§1-4 の name 重複への軽量対策）

`name` はサイト表示（H1）と一致させたまま変更せず、`disambiguatingDescription` のみ追加する案（`site/src/lib/seo.tsx` の `JsonLdPerson` インターフェースに任意プロパティとして追加するイメージ）:

```json
{
  "@type": "Person",
  "name": "武帝",
  "disambiguatingDescription": "漢の武帝（劉徹）",
  "alternateName": ["劉徹"],
  "sameAs": "https://www.wikidata.org/wiki/Q7562"
}
```

## 重大度別サマリー

- Critical: 0件
- High: 0件
- Medium: 5件（Dataset creator の孤立・keywords/identifier欠落、`ItemList`未実装の機会、Organization不在、`@id`グラフ非結合、name重複の曖昧性は総合してMediumレンジに含めた §1-4/§2-1/§2-3/§3/§1-2）
- Low: 3件（Dataset の非標準プロパティ`size`、`/timeline`のWebPage欠落、SearchAction未実装）
- Info: 6件（WebSite/Dataset/CollectionPage/BreadcrumbListの基本妥当性確認、Person のbirthDate/deathDate欠落は正当、紀元前日付のISO8601表記は妥当、FAQ/HowTo非該当の確認）
