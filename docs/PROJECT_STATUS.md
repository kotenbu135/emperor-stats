# プロジェクト現状と進捗管理

始皇帝から溥儀までの中国皇帝365人の統計データセット（`data/emperors.json`）と、それを可視化する Next.js 静的サイト（`site/`）。

**データ調査は 2026-07-18 に全12項目・全員分が完了**（`meta.status.overall: "completed"`）。**サイトは 2026-07-31 に作り替えて一旦完成**（4ページ＋皇帝個別365ページ）。以後の作業は**データ誤りの訂正**と**紹介文の執筆（Issue #16）**が中心。

サイトの決定と経緯の正は [docs/site-design/SITE_DESIGN.md](site-design/SITE_DESIGN.md)、崩してはいけない契約は [site/AGENTS.md](../site/AGENTS.md)。**このファイルにサイトの設計判断を書き足さない。**

## これまでの節目

| 日付 | 内容 |
|---|---|
| 2026-07-18 | 全12項目・364人の調査完了 |
| 2026-07-20 | 唐哀帝（`tang-aidi`）の収録漏れを発見・追加調査（**364→365人**。以下のチェックリスト内の「364人」表記はこの訂正前の記録） |
| 2026-07-24 | 系譜グラフ（`data/kinship.json`）の4フェーズ完了。生母（maternalLineage）は継続中 |
| 2026-07-26 | 即位経路を単一 enum 9値から「4軸＋2補助」の多軸構造へ全面移行（旧判定22件を訂正） |
| 2026-07-29 | スキーマ v3 へ移行（Issue #22）。時代・政権カタログ新設、全 enum の ID 化、`dynasty`／`flags.selfProclaimed` の廃止。**判定内容は変更なし**。記録は [V3_MIGRATION_PLAN.md](schema/V3_MIGRATION_PLAN.md) |
| 2026-07-31 | サイト再構築（Next 16 + Tailwind v4 + shadcn/ui + vendored Tremor）。7ページ削除・旧サイトの設計記録を全削除・`/database` を新規実装 |
| 2026-08-03 | 姓と諱を別の欄へ分けた（`name.familyName` 新設・`personalName` は諱だけ・365件／Issue #37 単位6）。同じ日の「分けない」決定を見直したもので、経緯と検査は [FAMILY_NAME_SPLIT_2026-08-03.md](schema/FAMILY_NAME_SPLIT_2026-08-03.md) |
| 2026-08-04 | **紹介文（Issue #16）を白紙に戻した** — 既存76本・手順書 `docs/process/profile-writing/` 一式・執筆規約 `emperor-profiles.json` の `meta.policy` をすべて削除（ユーザー指示）。**サイトに掲載する方針は変えていない**ので、道具立て（`profile-*` エージェント・`/profile-block`・`validate_profiles.py`・サイト側の表示）は残してある。削除前の状態は git の `f1311ff`。**この行の「着手できない」は 2026-08-05 に解除済み**（下の行） |
| 2026-08-05 | **紹介文の規範を立て直した** — 置き場所は [profile-writing/README.md](process/profile-writing/README.md) の1枚、入口は `/write-profile`（旧 `/profile-block` は削除）。**原文1巡＋Web差分の2段**・総ルビ廃止・`basis` はポインタ。まとめて進める段構成は `.claude/workflows/write-profile.js`。**執筆は再開している**（見本8本） |
| 2026-08-01 | 政権区分の軸を「中華を統一していたか」へ入れ替え（`統一王朝`／`分裂期の王朝`／`反乱・自称政権` ＝ 113／240／12人）。判定基準は [INCLUSION_CRITERIA.md](../data/schema/INCLUSION_CRITERIA.md) の「政権区分の判定基準」節 |

v3 で持ち越した宿題は「`dynastyOrder`（第N代）が53政権で未調査」と「kinship persons の政権帰属（`regimeId`）」の2件。前者は 2026-08-03（Issue #69）に**未調査の欄を落として** [残量表](process/RESIDUAL.md) の行（198在位／190人／53政権）にした（旧 Issue #24 は close）。後者は別 Issue 扱いのまま。

> **運用ルール**: ブロック調査・スキーマフェーズを1つ完了するたびに、**このファイルのチェックボックスと `data/emperors.json` の `meta.status.phases` の両方を同じタイミングで更新する**（片方だけ更新して終わらせない）。終了時の確認項目は末尾の「[作業終了時チェックリスト](#作業終了時チェックリスト)」。

## フェーズ進捗（`meta.status.phases` 対応）

チェック済み＝`"completed"`。`meta.status.phases.<key>.status` の実値と必ず一致させる（ズレを見つけたら JSON 側を正として先に直す）。**下は 2026-07-18 時点の自己申告で凍結してあり、進捗表記として正なのは次節の実測カバレッジ。**

- [x] **在位データ**（即位日・崩御日・在位期間） — `reignData`
- [x] **死因** — `deathCause`
- [x] **即位経路** — `accessionRoute` — 2026-07-26 に多軸構造へ全面移行済み。表示ラベル `category` は軸から `derive_category` で機械導出（定義は [ADDITIONAL_SCHEMA.md](../data/schema/ADDITIONAL_SCHEMA.md) 1節、ブロック別の記録は `meta.accessionRouteCompletedBlocks`、移行の経緯と訂正22件はメモリ `accession-route-axes-migration-2026-07-26`）。最終分布は世襲120・擁立97・自立48・簒奪28・推戴23・受禅（易姓）18・継承（経緯記載なし）17・内禅14
- [x] **改元回数** — `eraChangeCount`（グループ2）
- [x] **大赦回数** — `amnestyCount`（グループ2）
- [x] **立后（皇后冊立）回数** — `empressInstallationCount`（グループ2）
- [x] **皇太子廃立回数** — `crownPrinceDepositionCount`（グループ2）
- [x] **親征回数** — `personalCampaignCount`（グループ3）
- [x] **反乱鎮圧回数** — `rebellionSuppressionCount`（グループ3）
- [x] **被反乱回数** — `rebellionSufferedCount`（グループ3。算入基準を 2026-07-16 に訂正し、秦〜新末群雄35名を監査済み）
- [x] **遷都回数** — `capitalRelocationCount`（グループ4）
- [x] **即位時年齢・没年齢** — `ages`（グループ5・2026-07-17 に悉皆調査へ格上げ）

構造検証（id 重複0件・必須フィールド欠落0件・全カウント系フィールドの `count == events.length` 不一致0件・`meta.count` と実件数の一致）も完了済み。

### 実測カバレッジ（`scripts/coverage.py` の出力・自動生成）

上のチェックリストは**ブロック完了時の自己申告**（グループ2で「364人完了」が実際は355人だった前例がこの形式で通ってしまった）。以下は同じ項目を `data/emperors.json` 本体から測り直したもので、**進捗表記として正なのはこちら**。

<!-- coverage:begin -->
**完了と称している 16 項目 5858 セルのうち、構造だけでは確定と読めないのが 637 セル（10.9%）。**

この表は `python3 scripts/coverage.py --write` が生成します。手で書き換えないでください
（`--check` が実測とのずれで落ちます）。**「フィールドが在るか」ではなく「確定したか」**を数えており、
`判別不能` は構造だけでは確定と読めないセルです — 誤りではなく、**その項目の完了主張が機械では確かめられない**ことを表します。

| 項目 | 単位 | 総数 | 値あり | 不在確定 | 判別不能 | 確定率 |
|------|------|-----:|------:|--------:|--------:|------:|
| 在位データ: 即位日 | 在位 | 374 | 329 | 0 | 45 | 88.0% |
| 在位データ: 退位・崩御日 | 在位 | 374 | 340 | 0 | 34 | 90.9% |
| 死因 | 人 | 365 | 330 | 35 | 0 | 100.0% |
| 即位経路 | 人 | 365 | 365 | 0 | 0 | 100.0% |
| 改元回数 | 人 | 365 | 365 | 0 | 0 | 100.0% |
| 大赦回数 | 人 | 365 | 365 | 0 | 0 | 100.0% |
| 立后回数 | 人 | 365 | 365 | 0 | 0 | 100.0% |
| 皇太子廃立回数 | 人 | 365 | 365 | 0 | 0 | 100.0% |
| 親征回数 | 人 | 365 | 365 | 0 | 0 | 100.0% |
| 反乱鎮圧回数 | 人 | 365 | 365 | 0 | 0 | 100.0% |
| 被反乱回数 | 人 | 365 | 365 | 0 | 0 | 100.0% |
| 遷都回数 | 人 | 365 | 365 | 0 | 0 | 100.0% |
| 生年月日 | 人 | 365 | 169 | 0 | 196 | 46.3% |
| 没年月日 | 人 | 365 | 289 | 0 | 76 | 79.2% |
| 即位時年齢 | 人 | 365 | 175 | 0 | 190 | 47.9% |
| 没年齢 | 人 | 365 | 269 | 0 | 96 | 73.7% |
| 廟号（Issue #37） | 人 | 365 | 72 | 0 | 293 | 19.7% |
| 諡号（Issue #37） | 人 | 365 | 100 | 2 | 263 | 27.9% |
| 第N代（Issue #24） | 在位 | 374 | 162 | 14 | 198 | 47.1% |
| 紹介文（Issue #16） | 人 | 365 | 12 | 0 | 353 | 3.3% |
| 生母（kinship） | 人 | 365 | 178 | 0 | 187 | 48.8% |

**`meta.status.phases` が `completed` なのに判別不能セルが残っている項目**（完了が誤りとは限らず、**構造からは確かめられない**という意味）:

- 在位データ: 即位日（`reigns.startDate`） — 判別不能 45 / 374
- 在位データ: 退位・崩御日（`reigns.endDate`） — 判別不能 34 / 374
- 生年月日（`ages.birthDate`） — 判別不能 196 / 365
- 没年月日（`ages.deathDate`） — 判別不能 76 / 365
- 即位時年齢（`ages.accessionAge`） — 判別不能 190 / 365
- 没年齢（`ages.deathAge`） — 判別不能 96 / 365
<!-- coverage:end -->

## 調査グループの内訳

いずれも364〜365人全員完了済み。**ブロック単位の完了記録は `meta.*CompletedBlocks` が正**で、判定の境界事例・特筆事項はメモリ（`group2-count-progress`・`group3-count-progress`・`group4-capital-relocation-method`・`group5-ages-method` と各 `group{2,3}-block-*`）にある。

| グループ | 項目 | 進め方 |
|---|---|---|
| 1 | 死因・即位経路 | 同じ史料箇所（本紀の即位記事／崩御記事）から両方判明する |
| 2 | 改元・大赦・立后・皇太子廃立 | 本紀を通読して数える。1回の通読で4項目を同時に埋める |
| 3 | 親征・反乱鎮圧・被反乱 | グループ2と同じ王朝ブロック順・史料マッピング。数え方の基準は [ADDITIONAL_SCHEMA.md](../data/schema/ADDITIONAL_SCHEMA.md) 7〜9節 |
| 4 | 遷都回数 | 王朝単位でイベント年表を先に確定し、在位期間へ機械的に割り当てる2段階方式（58件を45人に計上） |
| 5 | 即位時年齢・没年齢 | 数え年に統一。隋唐ブロック以降はグループ3との合算パス（1エージェント1回で両方）で実施 |

ブロック区分は秦2／前漢14／玄漢・後漢15／新末群雄4／三国・晋29／南北朝69／五胡十六国43／隋唐48／五代十国34／宋遼西夏金52／元・北元・元末群雄18／明16／清11／明清交替期群雄9。**明清交替期群雄ブロックは 2026-07-16 時点のグループ2一覧から漏れており、後日 jq 実測で発覚して個別に追調査した** — 後から追加されたブロックは他グループにも遡及追加が要る。

## 史料解釈の方針

- **原典（正史の本紀・列伝）を一次情報とする**。ただし史書自体が恣意的に書き換えている可能性がある（易姓革命後の正典編纂で前王朝最後の皇帝が実際以上に悪く描かれるなど）ため鵜呑みにしない
- **原典と学術的通説が対立する場合**は原典をベースに有力な異説を `note`／`verification.notes` へ併記するか `諸説あり` と記録する。単なる俗説・二次創作は採用しない。迷う場合はユーザーに確認する
- **法医学調査・考古学的出土品調査など客観的物証がある場合**は例外的に重視する（都度ユーザーに確認してから採用）
- **カテゴリ値には「不詳／諸説あり」の区分がある**。無理に二択で決めつけない

## 進捗記録の場所

`meta.completedBlocks`（在位データ）・`meta.deathCauseCompletedBlocks`・`meta.accessionRouteCompletedBlocks`・`meta.capitalRelocationCompletedBlocks` と、`meta.status.phases`（このファイルの「フェーズ進捗」と一致させる）。

## 作業終了時チェックリスト

ブロック単位の調査・レビューが1件完了するたびに、以下を**その場で**更新する（後回しにすると次回セッションで状態が分からなくなる）:

- [ ] `data/emperors.json` に完了ブロック分のデータを反映した
- [ ] 完了ブロックを該当フェーズの `*CompletedBlocks` に追記した
- [ ] 全ブロック完了なら `meta.status.phases.<key>.status` を `"completed"` に更新した
- [ ] このファイルの該当チェックボックスにチェックを入れた
- [ ] **`python3 scripts/coverage.py --write` で実測カバレッジを引き直した**（規則 `R-COVERAGE-MEASURED`）。チェックボックスは自己申告なので、**完了の根拠はこちら**。忘れたコミットは CI が落とす
- [ ] 除外理由・保留事項・原典で修正した誤りがあれば記録した

## サイト実装の状況

**2026-07-31 の再構築で一旦完成。** 現状・崩してはいけない契約・皇帝追加時のチェックリストは [site/AGENTS.md](../site/AGENTS.md)、ページ構成・スタック・配色・各ページの設計判断・再提案しないことは [docs/site-design/SITE_DESIGN.md](site-design/SITE_DESIGN.md) が正。

- **公開形態**: `output: "export"` の静的書き出しを GitHub Pages ＋ カスタムドメイン emperorstats.com（ルート直下・basePath なし）で配信。**前段に Cloudflare（Free）が立っており、末尾スラッシュの301・セキュリティヘッダ・`/_next/static/` の1年キャッシュ・HSTS はそこで設定している**（2026-08-05・Issue #74）。**この設定はダッシュボードにしか無くリポジトリからは追えない** — 応答ヘッダやリダイレクトの挙動を調べるときは `curl -sI` の実測を根拠にする
- **現存するページ**: `/`・`/emperors`・`/database`・`/about` の4面と `/emperors/[id]`（365ページ）。**廃止した7ページの URL は無言で 404 に着地させる**（リダイレクト・410 は設けない）
- **旧実装のまま残っている面**: 皇帝一覧の詳細ダイアログ・外枠のシェル（サイドバー・ヘッダー・フッター）・皇帝個別ページ
- **未計測**: 新実装の性能（TBT/CLS）とアクセシビリティ。2026-07-18 の Lighthouse 記録は削除済み
- **確認用スクリーンショット**: `site/tools/capture-site.mjs`（全ページ×desktop/mobile・出力は `site/tools/shots/`・git 管理外）
- **技術債**: `recharts` を 2.15.4 に固定している（3.x では vendoring したチャートが動かない）

## データ品質の申し送り事項

**未解決:**

- **【Issue #34 の残タスク】month 精度 `events[].date` の旧暦月直書き** — 2026-08-02 に 1937 フィールド＋864 フィールド（`YYYY-MM` 表記）を訂正済み。残っているのは **156 件**（`check_month_conversion.py` が一覧を出す）、note に旧暦月が無い 2063 件、day 精度の個別誤り3件、`startDate` > `endDate` 34 件。恒久チェックの CI 組み込みは 156 件を片付けてから。経緯と教訓は [qa/issue34-event-date-2026-08-02/FINDINGS.md](qa/issue34-event-date-2026-08-02/FINDINGS.md)
- **【Issue #56 ほか】events 日付系の残量** — 親征の終期・干支・被反乱没日などの同型の残件は [process/RESIDUAL.md](process/RESIDUAL.md) の残量表で管理する（規則 `R-RESIDUAL-TABLE`）。Issue を増やさない
- **【Issue #38】底本で確認できない引用241件** — 記事は実在するが付いている日付が原文と違う（複数箇所の合成）。`--triage` 済みで残存

**解消済み（同型を疑うときの参照用）:**

| 解消日 | 内容 |
|---|---|
| 2026-08-02 | 素材 note と本紀の食い違い5件＋横展開（Issue #33）。記録は [qa/issue33-sweep-2026-08-02/FINDINGS.md](qa/issue33-sweep-2026-08-02/FINDINGS.md) |
| 2026-08-02 | 日本語新字体の混入684字（431フィールド・181人）。ゲート `verify_quotes.py --check` は0エラー |
| 2026-07-31 | 隋末群雄の同名別政権が1つの `regimeId` に合併していた（Issue #27）。`xiaoxian-liang`・`zhucan-chu` を新設して分割（政権87→89件）。サイト側は `dynastyKey` を政権 ID そのものへ変更 |
| 2026-07-20 | 経緯系 note に内部フィールド名・作業用語が残っていた16件、訂正漏れの整合2件（`beiqi-youzhu-gaoheng` の `endYear`・`yuanmo-mingyuzhen` の享年） |
| 2026-07-21 | `name.commonName` が `null` の2件（`xia-helianchang`・`xia-heliading`）。配布スキーマを非null必須へ厳格化し CI で検出できるようにした |

**当たらない引用を調べるときは、原文を探し直す前に `python3 scripts/quote_diff.py --id <id>`**（底本の最も近い箇所・行番号・1字単位の差分が出る）。

2026-07-21〜23 の出典 QA（Wikipedia 出典の一掃）・Wikidata QID 紐付け・CI 恒久化・events 日付の ISO 正規化・note 全件検証・ライセンス確定などの**完了済み作業の詳細**は [QA_HISTORY.md](QA_HISTORY.md)。2026-08-02 の引用照合の作り直しとデータ整合ゲート G1〜G4（Issue #40）は [process/RESEARCH_QA_PLAN_2026-08-02.md](process/RESEARCH_QA_PLAN_2026-08-02.md)。

## 系譜・即位経路グラフ（`data/kinship.json`）

全皇帝365人を親子・養子・婚姻・即位経路のエッジで結ぶグラフ。**4調査フェーズ（succession／parentage／interdynastic／crosscheck）は 2026-07-24 に完了**（succession 365本・parentage 222人・genealogicalClaims 62件・Wikidata 外部照合は訂正ゼロ）。**生母（maternalLineage）の全域追加調査が進行中**。

**可視化ページ `/kinship` は 2026-07-31 に廃止決定（ユーザー判断）。データ調査はそのまま継続する** — 可視化が無くても `data/kinship.json` はデータセットとして完成させる。「全章そろったら公開する」という段階的公開の計画は失効している。

- **確定した方針**: データは別ファイル（`emperors.json` は変更しない）／婚姻エッジを含める／ブリッジ人物（非皇帝ノード）の収録基準は「経路上・一親等〔父系。実母は 2026-07-24 に全域収録へ転換〕・実在追尊皇帝・婚姻当事者」の4基準（伝説的・儀礼的遠祖は `genealogicalClaims` に記録）。王朝は実質的建国者から表示できるようにする
- **収録基準5「政変当事者」**（2026-07-25 ユーザー決定・**適用は西晋の八王に限る**）: 八王のうち未収録だった7王とブリッジ6人を収録。河間王顒・東海王越は司馬懿の子孫ではないため、三兄弟の父・**司馬防**を結節点としてノード化した
- **スキーマ**: [KINSHIP_SCHEMA.md](../data/schema/KINSHIP_SCHEMA.md)（エッジ3種・veracity 区分・復位/建国の規約）。**凍結済みで原則変更しない**
- **CI**: `scripts/validate_kinship.py`。succession エッジの category は `accessionRoute` との整合を機械検証する
- **進捗管理**: kinship.json 側の `meta.status.phases`／`meta.completedBlocks`（emperors.json 側とは別管理）
- **コーパス下見**: 系譜「表」は china-history に無く daizhigev20 側にのみ在る（遼史皇族表・金史宗室表・明史諸王世表・元史/宋史の宗室世系表）。新唐書宗室世系表は完全収録が未確認なので着手時に確認する

## 重要なファイル

`data/emperors.json`（本体）・`data/kinship.json`（系譜）と、スキーマ4本＋収録基準（[EMPERORS_SCHEMA.md](../data/schema/EMPERORS_SCHEMA.md)・[DEATH_CAUSE_SCHEMA.md](../data/schema/DEATH_CAUSE_SCHEMA.md)・[ADDITIONAL_SCHEMA.md](../data/schema/ADDITIONAL_SCHEMA.md)・[KINSHIP_SCHEMA.md](../data/schema/KINSHIP_SCHEMA.md)・[INCLUSION_CRITERIA.md](../data/schema/INCLUSION_CRITERIA.md)）。
