# emperorstats.com デファクトスタンダード化ロードマップ

戦略の骨子: 個別ページの質は既に標準を名乗れる水準にある。当面の課題はそれを「発見可能」「引用可能」「検証可能」にすること。項目 1〜4 が基盤、5 が市場拡大、6 が差別化の再加速。

2026-07-21 更新。外部 AI（emperorstats.com のみを閲覧）からの改善提案を、リポジトリの実装現状と突き合わせて再構成した。

## 実装済み前提（着手前に把握しておくこと）

新ロードマップの一部は既に実装済み。二重着手しないよう整理する。

- **JSON-LD は部分実装済み**（`src/lib/seo.tsx`）: `BreadcrumbJsonLd`（全セクションページ）・`personJsonLd`（`JsonLdPerson`）・`Dataset`（`@type: Dataset`）の生成関数がある。→ 項目 4-2 は「個別ページで `personJsonLd` を実際に出しているか」「`sameAs` に Wikidata を入れているか」の確認と穴埋めが主。
- **sitemap / robots 実装済み**: `app/sitemap.ts`・`app/robots.ts`。→ 項目 1 の「sitemap の検出URL数確認」は既存生成物の検証。
- **`deathCause.source`・`accessionRoute.source`・`events[].source` のWikipedia出典は2026-07-21のフェーズAで一掃済み**（詳細下記3-1）。残るのは `reigns[].duration.source`（350件、Wikipedia infobox由来の即位/崩御日付）で、こちらはフェーズBとして進行中（2026-07-21にブロック1＝秦漢34件・ブロック2＝三国11件・ブロック3＝両晋十六国61件完了・残244件）。
- **note・出典のサイト表示（旧 task.md 第1〜3弾）は 2026-07-20 完了済み**: 個別ページの「即位/死因/復位の経緯」節・「調査メモ」折りたたみ・「在位中の出来事」年表・詳細ダイアログの lazy fetch（`public/emperor-notes/{id}.json`）。設計判断は `docs/site-design/LAYOUT.md` 参照。
- **配布物は 2026-07-21 に実装済み**（2-1）: `/data/emperors.json`・`/data/emperors.csv`・`/data/emperors.schema.json` を `site/scripts/build-data-distribution.mjs` が prebuild で生成。JSON Schema は `data/schema/emperors.schema.json` に手書きで置く（実データ365件の検証エラー0）。サイト内リンクはライセンス確定（2-2）待ちで未設置。
- **`sources.wikidata`（QID）は 2026-07-21 に365人全員付与済み**（2-5 完了）。→ 4-2 の `sameAs`・項目5の `nameEn` 取得が着手可能に。
- **未実装**: `nameEn` フィールド（全365件で0）、`CITATION.cff`/`CHANGELOG.md`/Zenodo DOI、i18n（`[locale]`）。

---

## 1. カード・ランキングの `<a>` 化＋Search Console 調査

**目的**: クローラが一覧→個別を辿れるようにし、内部リンク経由で PageRank を365ページに流す。

**現状（確認済み・2026-07-21）**: 一覧カードは `emperor-grid.tsx` で `<button onClick={() => onSelect(record)}>`、ランキング行は `ranking-bar-chart.tsx` で `onClick={() => openDetail(r)}`。**どちらも DOM 上に `<a href="/emperors/[id]">` を生成していない** = クローラからは個別365ページへの内部リンクが存在しないのと同じ。これが最優先の栓抜き。

**実装済み（2026-07-21）**: progressive-enhancement 型 `<a>`（素の左クリックは `preventDefault`＋モーダル、修飾クリックは個別ページ遷移）で一覧カード・ランキング行・各表をリンク化。ビルド成果物の受け入れテスト（`grep -o 'href="/emperors/[^"]*"' out/emperors.html | sort -u | wc -l`）で **365リンクを実証**。
**重要な発見**: 静的HTML（クローラが受け取る `out/**.html`）で個別365リンクが実際に出るのは **`/emperors` 一覧のみ**。ランキング系は `LazyMount`（画面外は空div）＋行ウィンドウイングで0件、各「表で見る」は `TableDetails` が `{open && children()}`＝閉状態でDOM非生成のため0件（Googlebot は `<details>` を開かない）。→ PageRank の栓抜き本体は一覧カードの `<a>` 化1点で達成。ランキング/表のリンク化は UX・「新規タブで開く」・JS実行時クロールのための補強。

- [x] 一覧カード（`emperor-grid.tsx`）を `next/link` の `<Link href="/emperors/[slug]">` に置換（SEO本体・静的HTMLに365リンク）
- [x] ランキング行（`ranking-bar-chart.tsx` の `RowOverlay` に `hrefOf`＋「表で見る」表）を個別ページへリンク化。/reign, /ages, /court-events, /military は共通 `RankingBarChart` で一括適用
- [x] 年表（`timeline-table.tsx`）の「表で見る」内の皇帝名もリンク化
- [ ] ~~Intercepting Routes（`(.)emperors/[slug]`）＋ Parallel Routes~~ **却下**: 追加で得られるのは「モーダル時のURL変化」だけで SEO目的（クロール可能リンク）には不要。モーダルは progressive-enhancement で既に維持済み。0.5〜1日をSEO利得ゼロに投じる形になるため見送り
- [ ] Search Console:「インデックス作成 > ページ」で個別365ページの内訳（検出-未登録／クロール済-未登録／登録済）を確認 → `<a>` 化前後で比較（**ユーザー主導・デプロイ後2〜6週**）
- [ ] Search Console: URL 検査で代表ページ（qin-shi-huang 等）のライブテスト、レンダリング後 HTML に本文（調査メモまで）が含まれるか確認（**ユーザー主導**。個別ページは `EmperorDetailBody`＋`EmperorNarrativeSections` を完全SSR済み・`personJsonLd`/`breadcrumbJsonLd` 出力済みなので本文は含まれるはず）
- [ ] Search Console: sitemap の「検出された URL」数が 365＋固定ページ数と一致するか確認（**ユーザー主導**）

**工数目安**: `<a>` 化のみ数時間、Intercepting Routes 併用で1〜2日。効果観測はインデックス反映込みで2〜6週間。

---

## 2. データ公開（引用される基盤づくり）

**目的**:「emperorstats のデータに依拠した」と書かれる状態を作る。標準はビューではなくデータセットに宿る。

**検討済み（2026-07-21・リポジトリ現状と実配信の突き合わせ）**:
- **CORS は既に達成済み・作業ゼロ**: emperorstats.com 実測で GitHub Pages が全ファイルに `access-control-allow-origin: *`＋gzip を自動付与（`/emper​or-notes/*.json` で確認）。そもそも GitHub Pages はカスタムヘッダ設定不可＝「配置すれば自動的に満たされる」
- **CC BY 4.0 宣言（2-2）は 3-1（Wikipedia出典一掃）完了後に行う**: `meta.source.primary` が Wikipedia「中国帝王一覧」・`deathCause.source` 約28件が Wikipedia 記事名の現状で、調査メモ文章に Wikipedia 派生があれば CC BY-SA 継承義務と矛盾する。「CC BY 公開後に BY-SA 由来と判明」が最悪パターンのため順序を固定。JSON/CSV 静的配置（2-1）自体はライセンス表記「準備中」で先行可
- **QID 紐付け（2-5）は SPARQL 一発では網羅できない**: Q268218（Emperor of China）は実在確認済みだが存在期間 前221〜1912 の歴史的職位で、Wikidata には王朝別「Emperor of the Han dynasty」等の個別項目が多数。十六国・五代十国・太平天国・明清交替期群雄などは P39=Q268218 を持たない可能性が高い → 3パス方式（下記）に変更
- `data/emperors.json` は現在 **6.4MB**（CLAUDE.md 記載の2.9MBから倍増。gzip 配信で実転送は約1MB前後）
- 現 `LICENSE` は MIT 単独（(c) 2026 kotenbu）。コード用としてはそのまま維持で良い
- `datasetJsonLd()`（`site/src/lib/seo.tsx:156`）に `license`・`distribution`・`temporalCoverage`・`version` はいずれも未設定（4-2 と連動、2-1〜2-3 完了後に機械的に追記可能）

### 2-1. 配布物 — **完了（2026-07-21）**

`/data/emperors.json`・`/data/emperors.csv`・`/data/emperors.schema.json` の3点を配信。生成は `site/scripts/build-data-distribution.mjs`（`predev`/`prebuild` 組み込み・出力先 `site/public/data/` は portraits/emperor-notes と同じく gitignore、ソースのみ git 管理）。

- [x] `emperors.json` を**バイト単位でそのままコピー**（`copyFileSync`。再シリアライズすると整形差分が出るため。乖離ゼロ・`meta.*CompletedBlocks` 等の内部フィールドも含む「完全版」）
- [x] `emperors.csv`: 40列・1行1皇帝（365行＋ヘッダ）。UTF-8 BOM 付き・CRLF・RFC 4180 エスケープ。列は id・url・名称4種・王朝3種・代数・在位（開始/終了年・回数・近似日数・正確日数・精度フラグ2種）・死因3種・即位経路3種・回数系8項目・生没日と精度・即位時/没年齢・flags3種
- [x] **CSV はサイトの表示ロジックを複製せず raw フィールドの純射影**（`displayName`/`dynastyLabel`/`ERA_BY_SECTION` を `.mjs` に3つ目のコピーとして持ち込まない。値の推論・補完・再計算もしない）。`commonName` は全角括弧も含め原値のまま、null の2件は空欄にし `personalName` 列で補える形にした
- [x] **精度フラグを必ず同梱**: `reignApproxDays` の隣に `reignExactDays`・`reignIsExact`・`reignNeedsPreciseDays` を置き、近似値が正確値と誤認されないようにした
- [x] JSON Schema（`data/schema/emperors.schema.json`・**手書きの著作物として git 管理**しビルドでコピー）。死因8分類・即位経路8分類の enum は `jq unique`（＝観測値）でなく `DEATH_CAUSE_SCHEMA.md`/`ADDITIONAL_SCHEMA.md` から取得 — 実データに未出現の正当値 `不詳`（即位経路）を自スキーマで弾かないため
- [x] 受け入れテスト: `out/data/` の3ファイル生成・JSON がソースとバイト一致・CSV 366行/40列/id一意/BOM有・**実データ365件を JSON Schema で検証しエラー0**
- [x] ~~`/data/` に CORS 許可ヘッダ~~ **作業不要**: GitHub Pages が自動付与（実測確認済み・2026-07-21）
- [x] 公開前スキャン: メールアドレス・ローカルパス・TODO・APIキー等の混入なし（「後で」7件は「背後で」「後で位を返す」等の史文で誤検出）

**スキーマ作成で判明したデータ実態（訂正ではなくスキーマ側を現実に合わせた）**:
- `reigns[].datePrecision` は `day`/`month`/`year` の3値に統一済みだが、**`ages` と `events[]` の精度フィールドは自由記述**（`unknown`・`none`・`lunar-day`・`conflicting`、および `day（干支紀日、西暦換算は概算）` のような括弧注記つき）。旧暦・干支の換算状況を失わずに記録する運用の結果。スキーマでは `datePrecisionAnnotated` として別定義し「機械処理は先頭の基本値トークンを取る」と明記
- **`confidence` が空文字列 `""` のレコードが4件**（`yuan-shizu` の親征、`yuanmo-xushouhui` の親征・鎮圧・被反乱）。`high`/`medium`/`low` でも null でもない欠損。スキーマは `anyOf` で既知の欠損として許容したが、**3-3 の CI チェック項目候補**（値の確定は調査判断が要るため未着手）

**⚠ コミット時の注意（未コミット・2026-07-21 時点）**: 以下4ファイルは**必ず同一コミットに入れる**。`package.json`（prebuild が新スクリプトを呼ぶ）と `.gitignore` だけ先に入り、スクリプト本体とスキーマが取り残されると、clean checkout / CI のビルドが `copyFileSync` の ENOENT で落ちる（ローカルはディスク上にあるため気づけない）。他セッションと作業ツリーを共有しているため部分コミットで割れるリスクが現にある。
- `data/schema/emperors.schema.json`（新規・`build-data-distribution.mjs` が読む）
- `site/scripts/build-data-distribution.mjs`（新規・prebuild が呼ぶ）
- `site/package.json`（predev/prebuild に追加）
- `site/.gitignore`（`/public/data/` 追加）

**未了（2-2 完了後に実施）**: サイト上に配布物へのリンク（`/about` のデータセット節等）。ライセンス未確定のまま導線を作ると「条件不明のダウンロード」になるため、2-2 とセットにする。現状ファイルは配信済みだがサイト内リンクは無い状態。同時に、配布 JSON からスキーマへのポインタ（about のデータセット節での言及等）も張る（取得者がスキーマを自力で探す状態のため）。

### 2-2. ライセンス（**3-1 完了が前提**）
- [ ] データ・調査メモ文章: CC BY 4.0（出典明記で商用含め自由＝引用実績を最速で稼ぐ。CC0 だと帰属義務がなく「emperorstats 発」認知が広がりにくい）。`data/LICENSE` に CC BY 4.0 全文を配置
- [ ] サイトコード: 現 `LICENSE`（MIT）を維持し、README と `meta` に二重ライセンス構成（コード=MIT／データ=CC BY 4.0）を明記

### 2-3. バージョニングと変更履歴
- [ ] `meta` に `version: "2026.07"`（CalVer）を追加。既存 `schemaVersion`（構造の版）と分離し「データ内容の版」として運用
- [ ] `CHANGELOG.md` をルートに新設。遡及初項として唐哀帝追加（2026-07-20、364→365人）を記録
- [ ] 正誤表（errata）は `/about` 内の一節として開始（独立ページは訂正が溜まってから）。「◯月◯日、△△帝の死因を暗殺→諸説ありに変更（理由・根拠）」を積む
- [ ] GitHub Releases でタグを切る

### 2-4. Zenodo DOI（一部ユーザー主導）
- [ ] `CITATION.cff` を配置（GitHub 上に「Cite this repository」ボタン）
- [ ] GitHub リポジトリを Zenodo 連携（**ユーザー主導**: Zenodo アカウント連携とリポジトリのスイッチONは Web UI 操作が必要）。リリースごとに自動 DOI 発行・全版束ねる concept DOI
- [ ] 注意: 初回 DOI はスイッチON**後**の最初の Release で発行（ON前のリリースには付かない）。DOI 発行後に `CITATION.cff` と Dataset JSON-LD の `identifier` へ concept DOI を反映する二段階
- [ ] 前提判断: ユーザーに Zenodo 連携の意思確認（アカウント作成が必要）

### 2-5. Wikidata QID 紐付け — **完了（2026-07-21）**
- [x] 365人全員の `sources.wikidata`（既存フィールド・従来全件 null）に QID を付与。**3パス方式**で実施:
  1. SPARQL `P39/P279* → Q268218` でプール357人回収 → 名前×王朝×生没年のローカル照合で298件自動確定（名前完全一致＋年整合＋次点との明確差の3条件）
  2. jawiki 記事名 → `wbgetentities` 逆引きで67件を候補化し全件目視確定
  3. 残り7件（避諱字ゆれ「孫皓」・jawiki 記事なし等）を `wbsearchentities`/zhwiki で個別解決
- [x] レート制限順守: 計約12リクエスト・直列・maxlag=5・専用 User-Agent・429ゼロ（[[bulk-external-api-caution]]）
- [x] 検証: 365件一意・スキーマ検証エラー0・著名皇帝サンプル検算。方式詳細と留意点は `docs/PROJECT_STATUS.md`「Wikidata QID 紐付け」節
- [ ] 後続（別項目で実施）: (a) ~~JSON-LD `sameAs`（4-2）~~ **完了（2026-07-21）** (b) `nameEn` 初期値の enwiki サイトリンク取得（項目5）(c) CSV 配布物への `wikidataId` 列追加は 2-1 の列仕様改定として要判断 (d) ~~3-3 CI に QID 形式・一意性チェック追加~~ **完了（2026-07-21・3-3 実装に同梱）**

**推奨実行順序**: ① 2-1 技術部分（約1日）→ ② 2-5 QID 紐付け（1〜2日）→ ③ 3-1 → 2-2 → 2-3 → 2-4（直列・計2〜3日＋ユーザー操作）。①②は独立で並行可。

**工数目安**: 2-1〜2-4 で2〜3日、QID 紐付けはスクリプト込み1〜2日。

---

## 3. 出典 QA（信頼性の穴埋め）

**目的**:「正史を1件ずつ原典確認」の看板に例外がない状態にする。※訂正は `docs/process/RESEARCH_PROCESS.md` の手順（原典調査・スクリプト自動生成禁止）に従い、`meta.status` とドキュメントを同時更新。

### 3-1. Wikipedia 出典の一掃（旧第4弾・優先度高）

**フェーズA（deathCause 28件＋events 1件）: 完了（2026-07-21）**

- [x] `deathCause.source.page` が Wikipedia 記事名のもの（28件、秦2・前漢14・玄漢1・後漢11）を正史本紀の巻名出典へ差し替え。該当人物の本紀を個別確認（`_corpus_cache/`・ローカルコーパス原文で崩御記事を直接確認、引用原文を記録）
- [x] 死因・即位経緯のような**解釈を含む項目**を優先実施。回数系（改元・大赦等）はもともと正史直読み確定済みで対象外だった
- [x] `eraChangeCount.events[]` の残存Wikipedia出典1件（`zhonghuadiguo-yuanshikai`）を「正史範囲外」明示表記に差し替え
- [x] 検出スクリプト `scripts/detect_wikipedia_sources.py` を作成・保存（3-3 CI禁止語チェックの種）。deathCause/accessionRoute/events系の残件0件を確認
- [x] 法的注意への対応: 上記28件はnote本文がWikipedia記述の直訳ではなく自前の分析文であることを確認済み（書き直し不要）。詳細・引用原文・判定内容の変更点は `docs/PROJECT_STATUS.md`「出典 QA」節および `meta.deathCauseCompletedBlocks` 参照

**フェーズB（reigns[].duration 350件）: 進行中（2026-07-21着手）— 106/350件完了・残244件**

- [x] スキーマ拡張の設計確定: `source` に `quote`（日付根拠の正史原文）と `conversion`（旧暦→西暦の換算典拠・既存日付との照合結果）を追加。旧 Wikipedia 出典は `secondary` に降格せず削除する。`startDateRaw`/`endDateRaw` は原典で確定できた分すべて埋める。`data/schema/EMPERORS_SCHEMA.md`・`docs/schema/SCHEMA_OVERVIEW.md` に反映済み
- [x] 検出スクリプトの判定ロジックを修正: `lang` による推定をやめ `page` のみで判定（複合 lang `ja/zh` や `baike` を取りこぼし、完了判定が実態より甘くなっていた）。真の残件数 288→350 に是正。「正史範囲外」明示表記と、個別確認済みの非正史学術典拠4件は許容リストで除外
- [x] **ブロック1（秦・前漢・新・玄漢・後漢／34件）完了**。正史の干支日を採取し `sxtwl` で換算・突合。この過程で西暦日付の誤り8件を訂正し `exactDays` 4件を再計算（内訳は `meta.reignDurationSourceBlocks` と `docs/PROJECT_STATUS.md`「出典 QA」節）
- [x] **ブロック1フォローアップ（2026-07-21）**: `endDate` 訂正時に `ages.deathDate` の同期漏れ4件（始皇帝・二世皇帝・武帝・宣帝、personJsonLd の `deathDate` に旧値が出ていた）＋始皇帝のみ `ages.birthDate` が歴史年表記だった件を訂正（詳細 `meta.reignDurationSourceBlocks[0].agesSyncCorrections`）。**以後のブロックで日付を訂正する際は `ages.*`・note 内の日付引用の同時更新をチェックリストに含める**
- [x] **B-2: `_corpus_cache` 未生成150人分（149人＋正史範囲外1人）を生成完了（2026-07-21）**。三国・両晋帝紀・十六国追加・南朝・北朝・隋・隋末群雄・唐（本紀＋反乱政権）の8ブロック。書名・巻の同定は既存`accessionRoute`/`deathCause.source`から、マーカーは全件メイン会話で実地content-grep確認。旧唐書列傳の相対番号（絶対巻数－50）・晋書帝紀第十章の白話訳・魏書列傳の相対番号疑い・慕容暐名のPUA文字欠落など新出の罠は`docs/process/CORPUS_NOTES.md`に記録。364人全員分（`zhonghuadiguo-yuanshikai`除く）のキャッシュが揃い、ブロック2以降に着手可能
- [x] **ブロック2（三国／11件）完了（2026-07-21）**。西暦日付の訂正3件（wei-wendi・wei-caomao startDate、shuhan-zhaoliedi endDate）、日次記述なしによる月精度への格下げ1件（shuhan-liushan）、出典のみ差し替え7件。Wikipedia脚注が典拠として明記していた諸葛恪傳（呉書十九）から孫権崩御・孫亮即位の日を発見的中（wu-dadi・wu-sunliang）。資治通鑑・華陽国志も突合に使用。詳細は `meta.reignDurationSourceBlocks[1]` と `docs/PROJECT_STATUS.md`「出典 QA」節参照
- [x] **ブロック3（両晋十六国／61件）完了（2026-07-21）**。西暦日付の訂正9件（jin-wudi・jin-huidi・jin-simalun・jin-huaidi・dongjin-yuandi・dongjin-mudi・qianzhao-liuyuan・qianzhao-liuhe・houzhao-shile の各startDate/endDate、houqin-yaochangのendYear）。西晋・前趙で「旧暦の日番号を西暦の日番号としてそのまま転記した」という同型の変換バグを複数件発見（jin-huidi/jin-simalun、qianzhao-liuyuan/liuhe）。dongjin-mudiのendDateが次代dongjin-aidiのstartDateと同値になっていたコピー誤りも発見・訂正。houzhao-shishi/houzhao-shijianは原文明記の在位日数（33日/103日）をexactDaysとして採用する新パターンを適用。chenghan-libanは月精度へ格下げ、chenghan-liqiはages.deathDateを晋書成帝紀・華陽国志に基づき同期。付随してjin-simalunのages.deathDate（旧endDate依存の低確度値）が訂正後の時系列と矛盾したためyear精度へ格下げ、reignSummaryの再計算漏れ（houqin-yaochang等）・KNOWN_REIGN_SUMMARYの陳腐化エントリも解消。詳細は `meta.reignDurationSourceBlocks[2]` と `docs/PROJECT_STATUS.md`「出典 QA」節参照
- [ ] ブロック4以降（南朝34・北朝28・隋唐34・五代十国33・宋遼西夏金50・元18・明21・清15・明清交替期ほか）の原典突合。既存の`startDate`/`endDate`は原則変更せず、正史の干支と食い違う場合は個別に提示して承認を得る
- [ ] B-4: `site/src/lib/emperors.ts` の `sourceLabelOf` の暫定コメント削除・`quote`/`conversion` の表示検討、`/about` の方法論記述に暦変換の説明を追加（フェーズB完了後）

### 3-2. 肖像マッピング QA — **完了（2026-07-21）**

153件を全数目視確認し、1件差し替え・3件除外で **153→150件**。経緯・残存リスク・反映手順は [docs/site-design/PORTRAITS.md](docs/site-design/PORTRAITS.md)「肖像マッピングQA（2026-07-21）」節。

- [x] 後燕・成武帝（慕容垂）: 題字「蜀主李雄」の図＝成漢武帝の絵だった → 同シリーズの題字「慕容垂」の図（PD）に差し替え
- [x] 劉宋・明帝（劉彧）: 展脚幞頭＋白袍の宋代様式で北宋太宗の肖像と確認 → PD/CC0 の代替が Commons に無いため肖像なしへ
- [x] 前漢・哀帝: Dong_Xian.jpg は『博古葉子』断袖故事図で哀帝も画中にいるが、札の主題は董賢で本人を特定できない → 場面図のため除外
- [x] 唐・敬宗（全数確認で新たに判明）: 『帝鑑図説』撃鞠場面の切り抜き → 同じく場面図のため除外
- [x] 機械検出: sourceFilename/commonsPageUrl 重複・画像 MD5 重複・ファイル名の他皇帝諱・matchedWikiTitle の他皇帝一致・王朝接頭辞不一致 の5種を実施。**修正後は重複0件**
- [x] about の153件テーブルは既に manifest からの自動生成済み（`emperors.ts` の `getPortraitCredits()`）
- [ ] **残存リスク**: 単独人物・正しい時代の服飾・題字なしで「同時代の別人」というケースは目視では原理的に拾えない。潰すには外部の正解データ（Wikidata P18 / Wikipedia リード画像）との突き合わせが必要 → 項目 2-5 に合流させる

### 3-3. QA の恒久化（CI）— **完了（2026-07-21）**

`scripts/validate_emperors.py`＋`.github/workflows/validate-data.yml` を新設（`data/**`・QA スクリプトの push/PR で発火）。現データで 0 エラー・警告4種の緑スタート。詳細・運用ルール（KNOWN_ISSUES 許容リスト＝個別調査待ちの明示・訂正時に削除・陳腐化は警告検出）は `docs/PROJECT_STATUS.md`「データ QA の CI 恒久化」節とスクリプト docstring 参照。

- [x] `data/emperors.json` へのバリデーションを GitHub Actions CI に: スキーマ適合・日付整合（reign start≦end・複数在位の順序・birth≦death・歴史年/天文年の対応）・精度フラグと日付形式の一致・画像 MD5/manifest キー重複・出典フィールドの禁止語・slug 一意性・QID 形式/一意性・count==events長・reignSummary 整合・duration フラグ排他。前後ナビはビルド時に配列順から導出されるため slug 一意性チェックで担保
- [x] **`ages.deathDate` と最終 `reigns[].endDate` の整合チェック**を2段階で実装: 精度を揃えた比較で `deathDate < endDate` はエラー（既存9件は KNOWN_DEATH_BEFORE_END に登録しフェーズBで解消）、`deathDate > endDate`（退位後死去等）は件数警告。「最終 reign が退位か」の機械判定はデータに終了事由フィールドが無く不可のため、全不一致を警告表示する方式に緩めた
- [x] **構造ドリフト検出**: 配布スキーマに `additionalProperties: false` を機械付与した厳格版で二重検証（別ファイル保守でなく実行時生成）。この過程で配布スキーマ側の穴2件（フェーズB新設 `source.quote`/`conversion` 未反映・`meta` の patternProperties 取りこぼし）を修正
- [x] **`confidence: ""` 4件**: CI は「空文字・high/medium/low 以外はエラー」を実装、既知4件は許容リスト登録（値の確定＝調査判断は未着手のまま別途）
- [x] **`datePrecision` 表記ゆれ**: reigns は year/month/day の3値をエラーで強制。ages/events は先頭トークン照合の警告のみ（実測120件80種で正規化方針が未確定のため。方針確定は別途）
- [x] 以後の訂正 PR が自動チェックを通る体制（PR トリガーで発火・許容リスト方式によりフェーズB進行中も緑を維持）
- [ ] フェーズB完了後: `reigns[].duration.source` の Wikipedia 出典チェックを警告→エラーに格上げ（`check_forbidden_sources` 内コメント参照）
- [ ] 別途（調査判断が必要な残件）: `confidence: ""` 4件の値確定、CI 構築時に新発見の `beiwei-yuanfasheng` 在位日付逆転・`qianzhao-liuyuan` reignSummary 不整合（詳細は PROJECT_STATUS）

**工数目安**: Wikipedia 出典棚卸しは件数次第（列挙1時間・書き直し1件10〜30分）。肖像 QA と CI で1〜2日。

### 3-4. events[].source の穴埋め（旧第4弾・規模大／要方針判断）
確認済み欠落数（source フィールドを持つ / 全件）:
- 改元 576/681・大赦 1110/1338・立后 227/278・廃立 28/35（**source フィールドあり・欠落補完**）
- 親征 0/291・鎮圧 0/1494・被反乱 0/1853・遷都 0/58（**source フィールド自体が無い**。出典は note 本文・指標レベル `count.note` に埋め込み）

**検討済み（2026-07-21・実データ集計に基づく方針判断）**:
- **欠落391件の正体は「記録様式の世代差」**: 欠落は46人（秦・前漢・新〜後漢・明＝グループ2の初期ブロック）に完全集中し、全員が「配列内全件欠落」（source あり/なし混在の皇帝はゼロ）。per-event source を記録し始める前に調査されたブロックで、データ信頼性の問題ではなく記録粒度の問題。回数系はもともと正史直読み確定済みなので、正しい source はほぼ全件「当該皇帝の本紀巻名」（漢書・後漢書・明史）に帰着する見込み
- **46人全員の `_corpus_cache` が生成済み**: イベントごとに元号名・大赦記事・立后記事をキャッシュ原文で照合→確認できたものだけ source を付す「個別確認つき補完」が低コストで可能（自動一括付与はしない・CONSTRAINTS 準拠）。明の立后など本紀に無く后妃伝由来の可能性があるものは、照合不成立分だけ列伝確認または要調査として報告させる
- **G2側（約3,700件）は note 書名言及率が指標で大きく違う**: 遷都 57/58・親征 113/291・鎮圧 374/1494・被反乱 226/1853。鎮圧・被反乱は出典が本紀でなく列伝・載記（反乱者側の伝）に分散し1件あたりの個別確認コストが大きい一方、サイトは count.note の書名表示で既に出典を見せておりユーザー可視の増分が小さい
- **推奨**: ①優先度中の391件は46皇帝単位の Workflow（jq 自己取得・キャッシュ照合・マージ機械検証）で半日〜1日、着手可 ②遷都58件のみ G2 から格上げ候補（note 書名ほぼ完備・件数最小・+2〜3時間） ③親征・鎮圧・被反乱の約3,640件は**見送り継続**（現行 count.note 表示で足りる、費用対効果が合わない） ④完了時に 3-3 CI へ「改元/大赦/立后/廃立イベントの source 必須」チェックを追加可能になる

- [ ] 優先度中: 改元105件・大赦228件・立后51件・廃立7件の欠落分補完（46皇帝・キャッシュ照合方式・上記推奨①）
- [ ] オプション: 遷都58件への source フィールド追加（推奨②・note 書名の転記は個別確認つき）
- [ ] ~~親征・鎮圧・被反乱の events[] への source 追加~~ **見送り**（推奨③・指標レベル `count.note` の書名表示で代替済み。将来外部から出典照会が来た指標だけ個別に格上げ）
- [ ] スキーマ文書（`data/schema/`）へ events[].source 正式化の追記（補完完了と同時）

---

## 4. グラフページの SSR テキスト＋JSON-LD 補完

**目的**: クローラと未訪問ユーザーに「このページに何が書いてあるか」を言語化。

**節タイトルの範囲注意（2026-07-21 検討で判明）**: 4-2 の作業対象は**グラフページではない** — `personJsonLd` は個別ページ、`Dataset`/`WebSite` はトップ／about に載る。グラフページの JSON-LD はパンくずのみで既に完備。グラフページの話は 4-1（SSR テキスト）だけ。

**現状確認（2026-07-21・ビルド出力 `out/**.html` を grep して実証）**:
- `personJsonLd` は個別ページで**出力済み**（`out/emperors/qin-shi-huang.html` で確認）。現状フィールドは `name`/`url`/`description`/`image`/`birthDate`/`deathDate`。**紀元前 ISO 8601 は `birthDate:"-0259-01"`・`deathDate:"-0210-09-10"` の4桁ゼロ埋めで正しく出ており、`-0258` 形式要件はクリア済み**。
- `breadcrumbJsonLd`（個別ページ・ホーム›皇帝一覧›皇帝名）出力済み。グラフ各ページの `BreadcrumbList`（2階層）も `out/dynasties.html` で出力実証。about の `Dataset`・トップの `WebSite` も出力済み。
- → 4-2 の穴埋めは `alternateName`（2026-07-21）・`sameAs`（同日・2-5 完了を受けて）まで完了。**残るは `Dataset` 拡張のみ**（項目 2-1/2-2 依存で後回し）。

### 4-1. SSR テキスト — **完了（2026-07-21）**

`ChartTakeaway`（`src/components/charts/chart-takeaway.tsx`・server 部品）＋ `getChartTakeaway(page)`（`src/lib/emperors.ts`）を実装し、6グラフページの代表 Section 直下（`LazyMount` の外＝常時 DOM）に総括文を1本ずつ配置。ビルド出力 `out/*.html` で **6ページとも総括文が静的 HTML に存在し、同 HTML のチャート領域は空（`min-height:680px` プレースホルダのみ・バー行0）** を実証＝クローラへの純増を確認。

- [x] /dynasties, /reign, /death-accession, /court-events, /military, /ages の各グラフ直上に、**そのグラフから読み取れる結論を1〜2文**、ビルド時にデータから自動生成してサーバーレンダリング。**LazyMount の外＝常時 DOM**（`Section` children の先頭・LazyMount の兄弟）。`Section` の description（＝「何のグラフか」）とは別の「読み取れること」ブロックとして分離（朱アクセントバー付きの淡いカラム）
- [x] 自動生成（手書き固定文の drift を回避）。`getChartTakeaway` が数値をデータ注入・文型テンプレ。表示用の機械集計で CONSTRAINTS の自動生成禁止には非抵触
- [x] **チャートとの整合**: 手書き .filter を一切挟まず、チャート行と同一の単一情報源から導出 —（a）/reign・/death-accession は `getOverviewStats`（円グラフ/棒グラフと同じ集計）、（b）回数系・年齢は `record.ranks[key]`（チャート行と同じ `computeRanks` 由来）。1位＝`ranks[key].rank===1`（＝チャート最上段）・母集団＝`ranks[key].total`（＝0回除外・年齢判明者のみの対象人数）。`isRanked`/`RANK_DIRECTIONS` を将来変えても本文が構造的にずれない
- [x] **同順位ガード**: `ranks[key].tied`（rank1が複数）を `leaderLabel` で処理し「○○と△△の2名」「○○ら3名」と表記。区切りは「と」を使う（名前自体が「聖祖・康熙帝」のように「・」を含むため「・」で繋ぐと人数が判別不能になる）。実出力例: /ages「殤帝と毅宗の2名（1歳）」、/court-events「高宗と則天大聖皇帝・武則天の2名（14回）」
- [x] **最上級主張の人数しきい値ガード**: /dynasties は `DYNASTY_MIN_EMPERORS=5` 未満の王朝を最長平均の比較から除外し、**除外している旨を本文に明記**（1人王朝アーティファクト回避）。実出力「皇帝が5名以上いる王朝では…最も長いのは清で約26.1年（11名）」
- [x] 粒度は**各ページ1本の総括文（代表 Section 直下）**に絞った（複数 Section には付けない）。代表 Section = /reign:在位年数・/ages:即位時年齢・/court-events:改元・/military:親征・/dynasties:平均在位年数。/death-accession のみ対等な2円グラフのためグリッド上に1本置き死因＋即位経路の両方に言及

### 4-2. JSON-LD 補完（確認は完了・残りは穴埋め）
- [x] 個別ページの `personJsonLd` 出力を確認（ビルド出力で実証済み・上記「現状確認」参照）
- [x] 個別ページの `BreadcrumbList` 出力を確認（実証済み）
- [x] **`alternateName`（諱/廟号/諡号＋別名）を `personJsonLd` に追加**（2026-07-21 完了）。`JsonLdPerson.alternateName?: string[]`＋`personJsonLd` で `name` と重複・空値を除外し、1件なら文字列・複数なら配列で出力。`EmperorRecord` に `aliases: string[]` を追加（emperor-types.ts＋emperors.ts構築）、個別ページで諱/廟号/諡号/別名を Set で畳んで渡す。ビルド出力で実証（始皇帝＝`["嬴政","秦始皇","趙政"]`／太宗＝`"李世民"`／別名なしは省略）。**365中309ページで出力・新データ調査ゼロ**
- [x] **`sameAs` を `personJsonLd` に追加**（2026-07-21 完了）。`EmperorRecord.wikidataId`（`sources.wikidata` をビルド時読み込み）から `https://www.wikidata.org/wiki/{QID}` を生成し個別ページで出力。ビルド出力で **365ページ全てに `sameAs` 出力・URL も365通り一意**を実証（例: 始皇帝=Q7192・宣統帝=Q185152）。URL 形式は concept URI（`www.wikidata.org/entity/`）でなく人間可読の `wiki/` ページを採用（Google のガイド例が参照ページ URL 主体・リダイレクトで同一エンティティに解決）。jawiki/enwiki URL の併記は保留 — サイトリンク取得は項目5の `nameEn` 取得と同一 API 作業なのでそちらに同乗させる。※`ja.wikipedia.org/wiki/{commonName}` の機械生成案は却下済み（曖昧回避サフィックスで不安定・誤 `sameAs` は無いより悪い）
- [ ] `Dataset`（about の既存 `@type:Dataset`）拡張は**項目2とセットで実施**: `temporalCoverage`（-0221/1945）は単独追加も安いが飾りに留まる。**Google Dataset Search 掲載の本体は `distribution`（項目 2-1 の JSON/CSV URL）＋`license`（項目 2-2 のライセンス決定）**で、これが揃って初めて発火する

**工数目安（2026-07-21 再見積り）**: 4-2 の独立着手分（`alternateName`）・4-1（SSR テキスト）・`sameAs`（2-5 完了を受け同日実装）はいずれも完了。`record.ranks` 再利用でチャート整合を構造的に担保したため、当初見積り1〜2日より短縮。**項目4で残るのは `Dataset` 拡張（`distribution`/`license`＝項目 2-1/2-2 待ち）のみ**で、項目2に統合済み。

---

## 5. 英語版

**目的**: 中華皇帝への関心人口は英語圏＋中華圏が圧倒的多数。日本語限定は市場を自ら狭めている。

**検討済み（2026-07-21・site 実装の全数調査＋Next.js 16 同梱ドキュメント確認。着手は項目1〜4完了後）**:

- **ルーティングは「日本語＝ルート直下のまま・英語＝`/en/` 配下を追加」の Route Group 方式を採用**。`output:"export"` では proxy（旧 middleware）・redirects・headers がすべて使えず（`static-exports.md` の Unsupported Features で確認）、Accept-Language による locale 自動判定は原理的に不可能。公式 i18n ガイドの `app/[lang]` 全面移行方式は既存 URL を全部 `/ja/...` に変えることになり、静的 export ではリダイレクトも張れないため既存インデックス・被リンクを毀損する → **却下**。代わりに multiple root layouts を使い、`app/(ja)/` に既存全ページを移動（URL 不変・`<html lang="ja">`）、`app/(en)/layout.tsx`（`<html lang="en">`）＋ `app/(en)/en/` 配下に新設する。URL は原案どおり `/en/emperors/qin-shi-huang`。ページ種は12個なので en 側は「共通実装を import する薄いラッパ」で複製コスト小。sitemap/robots/manifest 等の metadata routes は root layout 不要のため `app/` 直下に維持
- **i18n ライブラリ（next-intl 等）は導入しない**。現状未インストール。翻訳対象の大半が既に定数マップ（`emperor-types.ts` の `deathCauseDescriptions`・`accessionRouteCategoryOrder`・`emperorEventKindLabels` 等）に集約済みで、最難関の文章生成は TypeScript 関数のため、ICU MessageFormat より「locale 別フォーマッタ関数」の方が既存構造に合う。公式ガイドの dictionary パターン（TS 定数＋`Record<Category, string>` 型で網羅性を担保）＋ locale 引数の貫通で足りる
- **hreflang・多言語 sitemap は Next 標準 API で対応可能**（追加ライブラリ不要）: `metadata.alternates.languages`（`<link rel="alternate" hreflang>` 出力）と sitemap エントリの `alternates.languages` が存在。`buildMetadata()`（`seo.tsx`）に locale 引数を追加して全ページ ja/en/x-default(=ja) 相互参照にする。現状は `openGraph.locale: "ja_JP"`・`<html lang="ja">`・JSON-LD `inLanguage: "ja"` がすべて固定値なので、ここの引数化が構造改修の本体
- **翻訳対象の規模（実測）**: 日本語を含むのは `src/` 下58ファイル。難易度3層 — （易）分類ラベル・ナビ（`nav-data.ts`）・SEO 定数＝集約済みマップへの英訳テーブル追加のみ。（中）各 page.tsx の本文・metadata（`about/page.tsx` の62行が最大）・コンポーネント固定ラベル・OGP 画像9本。（難）`emperors.ts` の文章テンプレート群（`getChartTakeaway`・`countTakeaway`・`leaderLabel`「○○ら3名」・`formatYear`「前221」・`formatReignDuration`「1年30日」・数え年表記等）— 助詞・単位・複数形が日本語に密結合しており、英語版は言語別関数実装が必要
- **enum 値・データ結合キーが日本語である問題への方針**: `deathCause`「病死」等の enum 値や `ERA_BY_SECTION` の日本語キーは**データ結合子なので `emperors.json` 側は一切変えない**。表示直前に翻訳マップ（既存 `deathCauseDescriptions` と同型の `xxxLabelsEn`）を通す。データ側に足すのは `nameEn` のみ
- **調査メモ（note）・出典は Phase 1 では翻訳しない**: 正史原文引用を含む自由記述365名分で、機械翻訳の誤訳リスクが最も高い領域。英語 UI では「Research notes (Japanese only)」と明示して日本語のまま表示（出典として機能はする）。翻訳するなら Phase 2 で `public/emperor-notes/` の lazy-fetch JSON に en 版を並置する形が既存構造と整合
- **言語自動判定・自動リダイレクトはしない**: GitHub Pages ではサーバー判定不可。ヘッダ（`site-shell`）に言語切替リンクを置くのみ。SEO 的にもクローキング誤認リスクがなく安全

### 実装（Phase 1 のタスク分解）
- [ ] Route Group 再構成: 既存ページを `app/(ja)/` へ `git mv`（root layout 含む）。**受け入れテスト: 再構成前後で `out/` のファイル一覧 diff が空**（URL 不変の実証）を先に単独コミットしてから en 側に着手
- [ ] locale 貫通: `seo.tsx`（`buildMetadata`/JSON-LD 群/`SITE_SECTIONS`）・`emperors.ts` のフォーマッタ群に locale 引数（既定 `"ja"`・既存呼び出し無改修）。辞書は `src/lib/i18n/` に TS 定数
- [ ] 分類ラベル・ナビ・UI 固定文言の英訳テーブル（`emperor-types.ts` の各マップ・`nav-data.ts`・チャート/フィルタ/詳細ダイアログのラベル）
- [ ] 文章テンプレートの英語実装: `getChartTakeaway`・`leaderLabel`・`formatYear`（前221→221 BC）・`formatReignDuration`・`formatPeriod`・`eventSummaryOf`・`rankText`・`ageText`（数え年→ "age 8 (East Asian age reckoning)" 注記）
- [ ] データに `nameEn` 追加。初期値は項目 2-5 の QID から **enwiki サイトリンク（英語版 Wikipedia 記事名）**を取得（英語ラベルより記事名が検索最適。ピンイン単独「Qin Shi Huang」と「Emperor Wu of Han」型の混在はそのまま記事名慣行に従う）。王朝名・時代区分の英語名は有限個なので site 側マップで対応
- [ ] hreflang 相互参照（`alternates.languages`）＋ sitemap 言語別 alternates ＋ ヘッダ言語切替リンク
- [ ] OGP 画像の英語対応: `og-image.tsx`・`opengraph-image.tsx` 9本に locale。ラテン文字はサブセット済み Noto Sans JP に含まれるか要確認（含まれなければ英語用サブセット追加）
- [ ] `/en/about` は翻訳でなく**英語版書き下ろし**（収録基準・数え方・出典方針＝ methodology 中心の要約版で開始可。正統/僭称・満洲国等のセンシティブな判定の盾になる文書なので Phase 1 に含める）
- [ ] ビルド検証: 静的ページ・OGP 画像が約2倍（365×2＋固定ページ）になるためビルド時間と `out/` サイズを計測。`npx tsc --noEmit`・lint・`out/en/**.html` の hreflang/lang 属性 grep

### 段階戦略（調査メモ365名分の翻訳が最重量）
- [ ] Phase 1: UI＋基本データ（名前・在位・死因・即位経路・各回数・順位）のみ英語化して公開。調査メモは「日本語のみ（原文）」と明示して日本語のまま（出典として機能はする）
- [ ] Phase 2: 調査メモを LLM 翻訳＋「機械翻訳です」表記で追加、指摘が来たら直す
- [ ] Phase 3: 反応を見て繁体字。正統/僭称・満洲国の扱い等センシティブな判定は方法論ページ（要英訳・中訳）が盾になる

**工数目安（2026-07-21 再見積り）**: Phase 1 で **4〜6日**（Route Group 再構成＋locale 貫通 1〜2日・英訳テーブル＋固定文言 1〜2日・テンプレート英語実装 1日・nameEn 整備 0.5〜1日・OGP/about/検証 1日）。当初 3〜5日からの増分は、実測で判明した文章テンプレート群の言語別実装と about 書き下ろしを織り込んだもの。**前提依存は項目 2-5（QID→nameEn）のみ**で、項目 3・4 の残件とは技術的に独立。

---

## 6. 差別化の第二波（基盤 1〜4 の後・各独立に出せる）

### 6-1. クロス分析（データは既に揃い・ビューを足すだけ）
- [ ] **即位経路×死因**のクロス表／ヒートマップ（「簒奪で即位した皇帝は何%が暗殺されるか」＝このサイトにしか出せない数字・SNS 拡散性最大）
- [ ] 即位時年齢×在位年数の散布図（幼帝の短命傾向の定量化）
- [ ] 世紀別の死因構成推移（stacked area・「皇帝が最も死にやすかった時代」）
- [ ] 王朝内の代数×在位年数（「王朝は何代目から衰えるか」）
- [ ] 各グラフに 4-1 と同要領で結論文。1本ずつ「新着分析」として出せば更新性の演出にも

### 6-2. 比較機能
- [ ] `/compare?ids=kangxi,qianlong` のように URL で状態保持（共有可能が肝）。2〜4名の全項目並べる表＋レーダー可視化
- [ ] 「康熙 vs 乾隆」等の定番カードを一覧ページから提案

### 6-3. 系図（最重量だが最大の差別化・既存サイトに存在しない）
- [ ] 「先代との血縁関係」フィールド（子/弟/甥/従兄弟/血縁なし…）を先に付け、系図本体の前に「世襲137名の内訳」統計を1本出す
- [ ] データモデル: `father`/`mother`/`adoptiveFather`（＋非皇帝の中継人物テーブル）。傍系継承・非血縁継承（禅譲・簒奪）をエッジ種別で区別
- [ ] 可視化は王朝単位ツリーから（全365名の単一グラフは読めない）。工数はデータ整備が主で数週間規模・分割して進める

### 6-4. 元号データベース
- [ ] 改元回数を数えた副産物の元号リストを `/eras` として独立ページ化: 元号→皇帝の逆引き・期間・改元契機
- [ ] 「元号名」は単独の検索需要あり（永楽・康熙・貞観…）。個別ページ化でロングテール1山追加
- [ ] サイト内検索インデックスに元号・諱・ピンインを統合する改修と同時にやると効率的

---

## 実行順序まとめ

| 順 | 項目 | 工数目安 | 効果の性質 |
|---|---|---|---|
| 1 | `<a>` 化＋Search Console | 数時間〜2日 | 流入の栓を抜く |
| 2 | データ公開＋DOI＋QID | 3〜5日 | 引用される基盤 |
| 3 | 出典 QA＋肖像 QA＋CI | 2〜4日 | 信頼性の穴埋め |
| 4 | SSR テキスト＋JSON-LD 補完 | 2〜4日 | 検索評価の底上げ |
| 5 | 英語版 Phase 1 | 4〜6日 | 市場拡大 |
| 6 | クロス分析→比較→元号→系図 | 各数日〜数週 | 差別化・拡散 |

- 1 と 3 は並行可。2 の QID 紐付けは 5 の前提なので先行させる。**2-2（CC BY 宣言）は 3-1（Wikipedia出典一掃）完了が前提**（CC BY-SA 継承リスク回避・詳細は項目2の検討済み欄）。2-1・2-5 は独立で先行可。
- 6-1（クロス分析）は軽いので基盤作業の合間に1本ずつ出すのが現実的。
- JSON-LD（4-2）は確認完了（2026-07-21）。独立着手できる残りは `alternateName` 追加のみ。`sameAs`・`Dataset` 拡張（`distribution`/`license`）は項目2に統合して実施する。sitemap/robots は生成関数が実装済み。
