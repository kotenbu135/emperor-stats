# プロジェクト現状と進捗管理

## プロジェクト概要

このリポジトリは、始皇帝から溥儀までの中国皇帝を対象とした統計データセット（`data/emperors.json`）と、それを可視化する Next.js 静的サイト（`site/`）を構築するプロジェクトです。

**2026-07-18、全12項目・364人全員分のデータ収集・検証が完了し、`meta.status.overall` は `"completed"` になりました。** 同日中にサイト実装も完了しています（下記「[サイト実装の状況](#サイト実装の状況2026-07-18完了)」参照）。以後の作業は、データ誤りの訂正とサイトの改善・保守が中心です。

**2026-07-20追記**: 通史年表の設計検討中に収録漏れが判明し、唐哀帝（李柷、`tang-aidi`、904-907年在位）を追加調査・収録しました。全12項目を原典（旧唐書・資治通鑑）で個別調査済みです。**現在の収録人数は365人**（以下のチェックリスト内の「364人」表記は2026-07-18時点の記録であり、この訂正前の値です）。

> **運用ルール**: このファイルは調査作業のたびに更新が滞りがちだったため、チェックリスト形式に統一した。
> ブロック調査・スキーマフェーズを1つ完了するたびに、**このファイルのチェックボックスと `data/emperors.json` の `meta.status.phases` の両方を同じタイミングで更新すること**（片方だけ更新して終わらせない）。
> 作業終了時に確認すべき項目は末尾の「[作業終了時チェックリスト](#作業終了時チェックリスト)」を参照。

## フェーズ進捗（`meta.status.phases` 対応）

チェック済み＝`"completed"`。`meta.status.phases.<key>.status` の実値と必ず一致させること（ズレを見つけたらこのファイルではなくJSON側を正として先に直す）。

- [x] **在位データ**（即位日・崩御日・在位期間） — `reignData` — 364人全員完了
- [x] **死因** — `deathCause` — 364人全員完了
- [x] **即位経路**（世襲/簒奪/擁立/禅譲など） — `accessionRoute` — 364人全員完了
- [x] **改元回数** — `eraChangeCount` — グループ2・364人全員完了
- [x] **大赦回数** — `amnestyCount` — グループ2・364人全員完了
- [x] **立后（皇后冊立）回数** — `empressInstallationCount` — グループ2・364人全員完了
- [x] **皇太子廃立回数** — `crownPrinceDepositionCount` — グループ2・364人全員完了
- [x] **親征回数** — `personalCampaignCount` — グループ3・364人全員完了
- [x] **反乱鎮圧回数** — `rebellionSuppressionCount` — グループ3・364人全員完了
- [x] **被反乱回数** — `rebellionSufferedCount` — グループ3・364人全員完了（算入基準を2026-07-16に訂正・秦〜新末群雄35名監査済み、三国時代晋以降のブロックは訂正済み基準を最初から適用）
- [x] **遷都回数** — `capitalRelocationCount` — グループ4・364人全員完了
- [x] **即位時年齢・没年齢** — `ages` — グループ5・悉皆調査に格上げ（2026-07-17）・364人全員完了（2026-07-18）。グループ3〔親征・反乱鎮圧・被反乱〕との合算パス（隋唐48・五代十国34・宋遼西夏金52・元北元元末群雄18・明16・清11・明清交替期群雄9＝計188名）に続き、グループ3完了後は残り76名（前漢14・後漢14・秦新末群雄玄漢西晋9・五胡十六国22・南北朝17）をグループ5単独Workflowで調査し完了。実測364/364人（100%）`ages`フィールド保有 ※過去の累計値はブロックサイズの単純加算による見積りで実際の重複分（既に判明済みだった人物）を控除していなかったため、2026-07-17にjqでの実測値に置き換えて訂正

**全12項目が364/364人で完了（2026-07-18）。構造検証（id重複0件・必須フィールド欠落0件・全カウント系フィールドのcount==events.length不一致0件・`meta.count`と実件数の一致）も完了し、`meta.status.overall` を `"completed"` に更新済み。**

## 調査グループの内訳・進め方

### グループ1（死因・即位経路）— ✅ 完了

- 同じ史料箇所（個人ページ・本紀の即位記事/崩御記事）から両方判明
- 在位データ調査で既に読んだ史料の再確認で済むことも多い
- 364人全員分完了済み

### グループ2（改元・大赦・立后・皇太子廃立）— ✅ 完了

いずれも本紀を通読して出来事を数える作業。1回の通読で4項目を同時に埋められる。

- [x] 秦（2名）
- [x] 前漢（14名）
- [x] 玄漢・後漢（15名）
- [x] 新末群雄（4名）
- [x] 三国時代・晋（29名）
- [x] 南北朝（69名）
- [x] 五胡十六国（43名）
- [x] 隋・唐（48名）
- [x] 五代十国・宋遼西夏金（86名）
- [x] 元・北元・元末群雄（18名）
- [x] 明（16名）
- [x] 清（11名。宣統帝は清朝期・張勲復辟期・満洲国期の3期間分を合算）
- [x] 南明・順・西・呉周・中華帝国（9名、2026-07-18追加調査完了。グループ3・グループ5の合算パスで追加された明清交替期群雄ブロックが2026-07-16時点のグループ2ブロック一覧から漏れていたため、後日jq実測で発覚し個別に調査・追記した。詳細はメモリ `group2-block-mingqing-zhuanti` 参照）

364/364名全員完了（2026-07-16に355名、2026-07-18に残り9名〔明清交替期群雄〕を追加調査し364/364名で真に完了）。詳細な進捗・特筆事項はメモリ `group2-count-progress` および各 `group2-block-*` を参照。

### グループ3（親征・反乱鎮圧・被反乱）— ✅ 完了

- [x] 数え方の基準策定（`data/schema/ADDITIONAL_SCHEMA.md` 7〜9節で確定済み）
- [x] 秦（2名）
- [x] 前漢（14名）
- [x] 玄漢・後漢（15名）
- [x] 新末群雄（4名）
- [x] 三国時代・晋（29名）
- [x] 南北朝（69名）
- [x] 五胡十六国（43名）
- [x] 隋・唐（48名。グループ5〔ages〕との合算パスを試験導入して調査、詳細は下記）
- [x] 五代十国（34名。グループ5〔ages〕との合算パスを継続して調査、詳細は下記）
- [x] 宋遼西夏金（52名。グループ5との合算パスを継続。史料キャッシュ新規構築〔宋史・遼史・金史・西夏書事・宋史列伝（張邦昌・劉豫）〕。詳細は下記）
- [x] 元・北元・元末群雄（18名。グループ5との合算パスを継続。史料キャッシュ新規構築〔元史・新元史・明史列伝（韓林児・陳友諒等）〕。詳細は下記）
- [x] 明（16名。グループ5との合算パスを継続。史料キャッシュは明清ブロック先行構築分〔`_corpus_cache/ming-*.txt`〕を再利用。靖難の役・奪門の変を対立政権パターンとして非対称処理〔簒奪側はaccessionRoute領域として除外、被簒奪側はrebellionSufferedCountに計上〕。詳細は下記）
- [x] 清（11名。グループ5との合算パスを継続。史料キャッシュは明清ブロック先行構築分〔`_corpus_cache/qing-*.txt`〕を再利用。宣統帝は清朝宣統期(1908-1912)・張勲復辟(1917)・満洲国康徳期(1934-1945)の3期間に分けて個別調査し合算〔`group2-block-qing`と同じ方式〕。三藩の乱・太平天国等の服属民反乱は通常通り両面計上、準噶爾・アヘン戦争・日清戦争等は対等勢力・外国として除外。詳細は下記）
- [x] 南明・順・西・呉周・中華帝国（9名、明清交替期の残存政権・群雄。南明4・李自成〔順〕・張献忠〔西〕・呉三桂/呉世璠〔呉周〕2・袁世凱〔中華帝国〕。史料キャッシュを新規構築〔小腆紀傳・明史「流賊」列伝・清史稿「呉三桂伝」、中華帝国のみ正史範囲外のため近現代の学術的信頼情報源を使用〕。南明・順・西・呉周と清朝との戦争は対等な独立勢力間の戦争として鎮圧・被反乱から除外、南明内の紹武・永暦の並立は武力打倒の事実がないため対等勢力として除外、中華帝国の護国戦争は服属民の反乱として計上。詳細は下記）

**これでグループ3（親征・反乱鎮圧・被反乱）が364/364人全員完了（2026-07-18）。** グループ2と同じ王朝ブロック順・史料マッピングを踏襲。隋・唐ブロックからは、子Agentのトークン削減のためグループ3とグループ5（ages）を1エージェント1回に合算する方式を試験導入し、五代十国・宋遼西夏金・元北元元末群雄・明・清・明清交替期群雄ブロックでも継続した（宋遼西夏金は52名中エラー2件〔nansong-gaozongのcount/events不一致、范汝為の乱の計上漏れ〕を検出し単発Workflowで修正、元北元元末群雄は18名中0エラー、明は16名中1件〔ming-yingzongのcount/events不一致〕を検出し既存データからの転記で単発修正、清は11名中1件〔qing-xuantongのrebellionSuppressionCount.count(14)がevents.length(13)と不一致〕を検出しcountをevents.lengthに合わせる単発修正、明清交替期群雄は9名中0エラー、最終的にすべてid自己申告のズレも0件・suppression>suffered逆転異常も0件）。詳細な進捗・特筆事項はメモリ `group3-count-progress`・`group5-ages-method`・`group3-group5-merged-pass-decision`・`group3-block-songliaoxixiajin`・`group3-block-yuan-beiyuan-yuanmo`・`group3-block-ming`・`group3-block-qing`・`group3-block-mingqing-zhuanti` を参照。

### グループ4（遷都回数）— ✅ 完了

- [x] 判定基準・調査方法の確定（`data/schema/ADDITIONAL_SCHEMA.md` 6節、2026-07-17）
- [x] 王朝ブロック単位（30グループ）で遷都イベントを並列調査 → 既存reignDataへ逆引きマージ

364/364名全員完了（2026-07-17）。グループ2/3の「人物ごと個別調査」とは異なり、王朝単位でイベント年表を先に確定してから在位期間に機械的に割り当てる2段階方式で実施（詳細はメモリ `group4-capital-relocation-method` および `data/emperors.json` の `meta.capitalRelocationCompletedBlocks` を参照）。合計58件の遷都イベントを45人に計上、2件（南唐961年）は皇帝号返上後・後継者未収録のため人物への割当を見送った。

### グループ5（即位時年齢・没年齢）— ✅ 完了（2026-07-17悉皆調査に格上げ、2026-07-18に364人全員完了）

- 2026-07-17時点で364人中213人分はグループ1〜3調査の副産物としてすでに部分的に判明済み（うち210人は実データあり、3人は「調査済みだが不明」と確定済み）。残り151人（明16・前漢14・後漢14・清11など大ブロックが丸ごと未着手）を専用ブロックで調査する。
- 数え年（中国伝統の年齢計算）に統一（既存213人分の実績と整合、2026-07-17確定）。
- 調査は「既存の`deathCause.note`/`accessionRoute.note`等の再確認 → 不足分のみ同一の既知史料箇所を再訪 → 見つからなければ調査済み・不明として確定」の順で行う（新規の広範な原典探索はしない）。詳細な判定基準・優先順位は [data/schema/ADDITIONAL_SCHEMA.md](../data/schema/ADDITIONAL_SCHEMA.md) 10節を参照。
- ブロック着手順：明・前漢・後漢・清の4大ブロック（計55人）を優先し、その後グループ2/3と同じ12ブロック区分で残り（約96人）を処理する。ただし2026-07-17、グループ3のトークン効率化検証のため隋・唐ブロック（48名）を先行着手（グループ3との合算パス、下記参照）。
- 他グループ（1〜4）を調査中に生年月日・没年月日・即位時年齢・没年齢が判明した場合は、引き続きその都度 `ages` フィールドを埋める。
- [x] 隋・唐（48名、2026-07-17完了。グループ3〔親征・反乱鎮圧・被反乱〕との合算パスを試験導入。21名は新規処理（実データまたは「調査済みだが不明」を確定）、27名は既存データを再確認・転記。234/364人処理済み）
- [x] 五代十国（34名、2026-07-17完了。グループ3との合算パスを継続。7名は新規処理（うち6名は実データ確定、1名は「調査済みだが不明」）、27名は既存データを再確認・転記。241/364人処理済み、残り123人）
- [x] 宋遼西夏金（52名、2026-07-17完了。グループ3との合算パスを継続。52名全員が実データまたは「調査済みだが不明」で確定（フィールド省略0件））
- [x] 元・北元・元末群雄（18名、2026-07-17完了。グループ3との合算パスを継続。18名全員が実データまたは「調査済みだが不明」で確定（フィールド省略0件）。うち既存ages保有14名は再確認・転記、4名〔beiyuan-zhaozong・yuanmo-hanlin-er・yuanmo-xushouhui・yuanmo-chenli〕は新規に「調査済みだが不明」で確定。実測252/364人`ages`フィールド保有、残り112人）
- [x] 明（16名、2026-07-18完了。グループ3との合算パスを継続。16名全員が実データで確定（フィールド省略0件、全員が新規調査＝既存ages保有者0名）。実測268/364人`ages`フィールド保有、残り96人）
- [x] 清（11名、2026-07-18完了。グループ3との合算パスを継続。11名全員が実データで確定（フィールド省略0件、全員が新規調査＝既存ages保有者0名）。宣統帝は初回即位〔1908年〕のaccessionAgeと実没年〔1967年〕のdeathAgeを数え年で算出し3期間分を合算。実測279/364人`ages`フィールド保有、残り85人〔南明・順・西・呉周・中華帝国等の明清交替期群雄9・前漢14・後漢14等〕）
- [x] 南明・順・西・呉周・中華帝国（9名、2026-07-18完了。グループ3との合算パスを継続。9名全員が実データで確定（フィールド省略0件、全員が新規調査＝既存ages保有者0名）。実測288/364人`ages`フィールド保有、残り76人〔前漢14・後漢14・五胡十六国等の断片的な小勢力が中心〕）
- [x] 前漢14・後漢14・秦/新末群雄/玄漢/西晋9・五胡十六国22・南北朝17（計76名、2026-07-18完了。**グループ3が364人全員完了したため合算パスを終了し、グループ5単独のWorkflowに切り替えて実施**〔前漢→後漢→秦新末群雄玄漢西晋→五胡十六国→南北朝の5フェーズを順次実行〕。76名全員が実データまたは「調査済みだが不明」で確定（フィールド省略0件、id自己申告のズレ・スキーマ外キー混入いずれも0件）。うち32名は実データ確定、44名は原典に生年月日・享年の直接記載がなく「調査済みだが不明」で確定（前少帝・後少帝等の傀儡皇帝、五胡十六国・南北朝の極短命の簒奪者に多い）。秦・新末群雄・玄漢・西晋9名は史記・漢書・後漢書列伝・晋書帝紀、五胡十六国22名はdaizhigev20の晋書載記（一部十六国春秋・資治通鑑で補完）、南北朝17名は宋書・南斉書・梁書・陳書・魏書・北斉書・周書・北史（列伝が主典拠の人物はdaizhigev20版）を新規に原文キャッシュ化して使用（詳細は[docs/process/CORPUS_NOTES.md](process/CORPUS_NOTES.md)「グループ5単独ブロック」節参照）。**これでグループ5（即位時年齢・没年齢）が364/364人（100%）全員完了。**）

## 史料解釈の方針

### 原典優先・でっち上げ禁止

- **原典（正史の本紀・列伝）を一次情報とします**
- ただし史書自体が恣意的に史実を書き換えている可能性がある（易姓革命後の正典編纂では前王朝最後の皇帝が実際以上に悪く描かれるなど）ため、鵜呑みにしません
- 必要に応じて現代の学術的な通説・研究も調査します

### 原典と学術的通説が対立する場合

- 原典の記述をベースにしつつ、有力な異説を `note`/`verification.notes` に併記
- または `諸説あり` と記録します
- 単なる俗説・二次創作は採用しません
- 迷う場合はユーザーに確認します

### 科学的検証がある場合

- 法医学調査・考古学的出土品調査など客観的物証がある場合は例外的に重視
- 都度ユーザーに確認してから採用します

### カテゴリ値の完全性

- 死因・即位経路のカテゴリ値には「不詳／諸説あり」の区分を用意
- 無理に二択で決めつけません

## スキーマ参照

死因スキーマ（`deathCause`）の詳細は **[data/schema/DEATH_CAUSE_SCHEMA.md](../data/schema/DEATH_CAUSE_SCHEMA.md)** を参照してください。

その他の追加スキーマ9項目（即位経路・改元・大赦・立后・皇太子廃立・遷都・親征・反乱鎮圧・被反乱・年齢）のフィールド構造・カテゴリ・「1回」の数え方の基準は **[data/schema/ADDITIONAL_SCHEMA.md](../data/schema/ADDITIONAL_SCHEMA.md)** に記載されています（2026-07-15 承認済み）。

回数系項目は共通して「`count`（回数）＋`events[]`（明細配列）」の構造を持ちます。

## 進捗記録の場所

- `meta.completedBlocks` — 在位データ調査の完了済みブロック一覧と要約
- `meta.deathCauseCompletedBlocks` — 死因調査の完了済みブロック一覧と要約
- `meta.accessionRouteCompletedBlocks` — 即位経路調査の完了済みブロック一覧と要約
- `meta.capitalRelocationCompletedBlocks` — 遷都回数調査の完了済みブロック一覧と要約
- `meta.status.phases` — フェーズごとの進行状況（このファイルの「フェーズ進捗」チェックリストと一致させる）

## 作業終了時チェックリスト

ブロック単位の調査・レビューが1件完了するたびに、以下を**その場で**更新する（後回しにすると次回セッションで状態が分からなくなる）：

- [ ] `data/emperors.json` に完了ブロック分のデータを反映した
- [ ] 完了ブロックを `meta.completedBlocks`（または該当フェーズの `*CompletedBlocks`）に追記した
- [ ] 全ブロック完了なら `meta.status.phases.<key>.status` を `"completed"` に更新した
- [ ] このファイルの該当チェックボックスにチェックを入れた（グループ内訳・フェーズ進捗の両方）
- [ ] 除外理由・保留事項・原典で修正した誤りがあれば記録した（メモリまたはこのファイルの該当箇所）

## サイト実装の状況（2026-07-18完了）

データ確定と同日にサイト実装（`site/`）が完了した。技術構成・開発コマンドは [site/AGENTS.md](../site/AGENTS.md)、設計判断・実装の経緯は [site-design/LAYOUT.md](site-design/LAYOUT.md) を参照。

- **公開形態**: `output: "export"` の静的書き出しを GitHub Pages + カスタムドメイン emperorstats.com（ルート直下、basePath なし）で配信
- **実装済みページ**: 概要ダッシュボード（`/`）・皇帝一覧（`/emperors`）・在位データ（`/reign`）・死因・即位（`/death-accession`）・宮廷イベント＝改元/大赦/立后/皇太子廃立/遷都（`/court-events`）・軍事（`/military`）・年齢（`/ages`）・王朝横断（`/dynasties`）・このサイトについて＋免責事項（`/about`）
- **品質確認済み**: 全ページのコンソールエラー0件、`tsc`・ESLint・本番ビルド通過、Lighthouse 全9ページ計測・改善実装済み（LAYOUT.md「Lighthouse改善の実装」節）

### サイト側の既知バックログ

2026-07-18 の Lighthouse 改善（チャートの遅延マウント+行ウィンドウイング・`/emperors` 先頭肖像画の priority 化・Select 幅固定と scrollbar-gutter による CLS 解消・アクセシブルネーム付与）により、初回計測時のバックログ（TBT・LCP・a11y 2件・CLS）はすべて解消済み。Lighthouse は accessibility 全9ページ 100、performance 66〜100（低スコア側は WSL2 計測環境の TBT 増幅を含み、実ブラウザの Long Task 実測では全ページ合計約100ms）。現時点で未対応バックログなし。

## サイト実装で見つかったデータ品質の申し送り事項

サイト実装（`site/`）を進める中で発見した、`data/emperors.json` 側の是正が望ましい点。現時点で未対応の申し送りはなし（以下は解消記録）。

- **【解消済み 2026-07-21】`name.commonName` が `null` のレコードが2件存在する**: `xia-helianchang`（赫連昌）・`xia-heliading`（赫連定）、いずれも五胡十六国「夏（赫連夏）」。[EMPERORS_SCHEMA.md](../data/schema/EMPERORS_SCHEMA.md) 上は `commonName` は `string`（非null）のはずだが、実データではこの2件が未設定だった（2026-07-18発見）。→ 2026-07-21、データセット内で確立済みの慣行（廟号・諡号を持たない皇帝は諱を通称に用いる。曹芳・孫亮・石世など約30件で既に採用）に合わせ、両件とも `commonName` に諱（赫連昌・赫連定）を設定して解消。同時に配布スキーマ（`data/schema/emperors.schema.json`）の `commonName` を非null必須（`type: "string"`・`minLength: 1`）へ厳格化し、`scripts/validate_emperors.py` にも非空文字列チェックを追加して再発を CI で検出できるようにした。サイト側の `displayName()` フォールバックは防御的に維持している。

### 対応済みの訂正（2026-07-20、note のサイト表示化に伴う）

皇帝個別ページで `deathCause.note`・`accessionRoute.note` を原文ママ表示するようになったのを機に全365人分を走査し、以下を訂正した（判定カテゴリ・調査結論はすべて不変）:

- **経緯系 note の内部用語除去（16件）**: 訪問者向けに表示される経緯 note に `reigns[].note`・`accessionRoute`・`reignData`・`CLAUDE.md`・「ユーザー承認済み」等の内部フィールド名・作業用語が残っていたものを、意味を変えずに平文へ言い換え（対象: qin-er-shi・wang-mang・liu-yong-liang・liang-wudi・chen-wendi・chen-feidi・beiqi-andewang-gaoyanzong・beiqi-youzhu-gaoheng・xiwei-gongdi・sui-yangdi・wudai-houliang-modi・nansong-gaozong・xiliao-tianxi・yuan-wenzong・yuanmo-mingyuzhen・qing-dezong・qing-xuantong〔2件〕）
- **訂正漏れの整合修正（2件)**: `beiqi-youzhu-gaoheng` の `reigns[0].endYear` 578→577（処刑年を577年10月に訂正済みなのに endYear のみ旧値。`endDate: 0577-11-01`・`reignSummary.lastEndYear: 577` と矛盾していた）／ `yuanmo-mingyuzhen` の `reigns[0].note` 享年38→36（ages 調査で明史・新元史一致の「年三十六」を採用済み。`ages.deathAge: 36` と矛盾していた）

## 出典 QA（2026-07-21〜、task.md 3-1「Wikipedia 出典の一掃」）

`data/emperors.json` の出典フィールド（`deathCause.source`／`accessionRoute.source`／`reigns[].duration.source`／`events[].source`）を棚卸ししたところ、判定内容自体は原典で検証済みなのに `source.page` が Wikipedia 記事名のまま残っている箇所が見つかった。検出は `scripts/detect_wikipedia_sources.py` で行う（史書名・本紀/列伝等のキーワードを含まない `source.page` を抽出。task.md 3-3 の CI 禁止語チェックの種として保持）。

- **フェーズA（完了・2026-07-21）**: `deathCause.source` 28件（秦2・前漢14・玄漢1・後漢11）＋ `eraChangeCount.events[]` 1件（`zhonghuadiguo-yuanshikai`）を正史巻名（または「正史範囲外」の明示表記）へ差し替え。全件 `_corpus_cache/` またはローカルコーパス原文で崩御記事を直接再確認した。判定内容の変更は2件のみ：`hou-han-shaodi-yi`（引用元を本紀→『後漢書』皇后紀下・閻皇后傳に訂正）、`hou-han-lingdi`（本紀に死因記述が存在しないことを確認しnoteの表現を更新）。他26名は `category`/`confidence`/note本文とも変更なし。詳細は `meta.deathCauseCompletedBlocks` 末尾の追記を参照。
- **フェーズB（完了・2026-07-21）**: `reigns[].duration.source` 350件。スキーマは `source` に `quote`（日付根拠の正史原文）と `conversion`（旧暦→西暦の換算典拠・既存日付との照合結果）を追加する形で確定（旧 Wikipedia 出典は残さず削除。`startDateRaw`/`endDateRaw` は原典で確定できた分すべて埋める）。**ブロック1（秦・前漢・新・玄漢・後漢／34件）・ブロック2（三国／11件）・ブロック3（両晋十六国／61件）・ブロック4（南朝／34件）・ブロック5（隋唐／36人・reign単位39件）・ブロック6（北朝／28件）・ブロック7（五代十国／34件）・ブロック8（宋遼西夏金／49名50 reign区間）・ブロック9（元/北元/元末群雄／18名19 reign区間）・ブロック10（明本朝16名＋南明4名／21 reign区間）・ブロック11（清朝9名＋宣統帝3reign＋明清交替期4名／17 reign区間）・ブロック12（劉永・袁術2名＋隋末群雄12名／14 reign区間）完了。`scripts/detect_wikipedia_sources.py`の残存検出数は0件で、365人全員のduration.sourceが正史原典で裏付けられた状態を達成**。
  - 手順: 正史本紀・列伝の即位／崩御記事から旧暦の干支日を採取 → `sxtwl`（寿星天文暦）で西暦に換算 → 既存 `startDate`/`endDate` と突合。検証用に唐哀帝の既知値を再現できることを確認済み。
  - **想定外だった点**: 単なる出典差し替えでは終わらず、ブロック1だけで**西暦日付の誤り8件（人物ベースで7名）**が出た。内訳は「天文年表記との1年ずれ」（秦2件）、「旧暦十二月が翌ユリウス年に入ることの見落とし」（宣帝・元帝）、「約2ヶ月ずれ」（武帝2件・昭帝・更始帝）。訂正に伴い `exactDays` を4件再計算している。**以後のブロックでも同種の誤りが出る前提で進めること**（詳細は `meta.reignDurationSourceBlocks`）。
  - **限界**: `sxtwl` は前漢初期の「後九月」（歳終置閏）に非対応で、平帝・更始帝など一部の年は朔が推算と合わない。該当分は学術的情報源で裏取りするか、`conversion` に「機械換算では再現できない」と明記して既存日付を維持している。
  - **フォローアップ（2026-07-21・同日）**: 上記 `endDate` 訂正の際に、同じ崩御日を持つ `ages.deathDate` の同期を4件（始皇帝・二世皇帝・武帝・宣帝）取りこぼしていたことがライブサイト検証（personJsonLd の `deathDate` が旧値のまま出力）で判明し訂正。あわせて `ages.birthDate` が始皇帝のみ歴史年表記（-0259-01。紀元前 birthDate を持つ他8レコードは天文年表記）だったため -0258-01 に統一、`ages.note` 内の旧日付参照2件も更新した。没年齢・即位時年齢は暦年ベースの数え年計算のため全件変更なし（詳細は `meta.reignDurationSourceBlocks[0].agesSyncCorrections`）。**教訓: 在位日付を訂正するときは同一事象を参照する `ages.*`・note 内の日付引用も同時に洗うこと**。
  - **ブロック7（五代十国／34件）完了（2026-07-21）**: 五代本朝14（旧五代史）＋十国19＋桀燕1（新五代史）。旧五代史・新五代史（china-history収録）を主典拠に、`_corpus_cache/` だけで日次まで確定できない分は資治通鑑・十国春秋・陸游『南唐書』・続資治通鑑（長編）・宋史・遼史を追加参照した。34名をWorkflowで並列調査し、メイン会話が該当8件の干支換算を`sxtwl`で独立に再検算して一致を確認。**日付または精度の補正8件**: wudai-houliang-zhuyougui（startDate、丁丑朔起点の干支勘定で6日ズレを訂正）、shiguo-wu-yangpu（startDate、旧暦の日番号3日目をそのまま西暦11月の日番号に転記していた誤りを訂正）、shiguo-houshu-mengzhixiang（start/endDateとも、応順元年の閏正月を見落として旧暦月番号をそのまま西暦転記していた誤りを訂正、ages.deathDateと完全一致）、shiguo-nantang-libian（start/endDateとも、旧暦月番号の転記誤り・崩御記事の日数の誤変換を訂正、endDateはages.deathDateと完全一致し内部不整合を解消）、shiguo-beihan-liujien（endDate、十国春秋の弑逆記事の干支から確定、原文の「六十余日」と日数が一致）、shiguo-nantang-lijing（start/endDateとも、即位記事の日精度確定・帝号廃止記事の年精度を月精度へ格上げ）、shiguo-beihan-liujiyuan（startDate、旧暦9月が西暦では大半10月に相当することを見落とした誤りを訂正）。精度格上げ1件（shiguo-min-wangyanjun、datePrecision.start year→month、値は不変）。task.md記載の33件（`is_wiki_like`判定対象）に加え、判定対象外だったshiguo-beihan-liujien（宋史巻482主体でzh版Wikipediaを併記）も同時に是正し34件全件処理した。**残存する史料間の対立は日付を変更せず既存値を維持し警告として記録**: wudai-houliang-taizuの即位日（旧五代史「戊辰」vs資治通鑑・新五代史「甲子」の4日差、多数説を維持）、shiguo-jieyan-liushouguangの処刑日（資治通鑑「丙辰」vs旧五代史荘宗紀「壬子」の4日差）、shiguo-beihan-liuchongの崩御年（954年説vs955年説の対立）。`reigns[].startYear/endYear`は全件不変（訂正はいずれも同一年内の月日補正）、`reignSummary`は訂正対象8レコード分を再計算し`scripts/validate_emperors.py`でエラー0を確認。詳細は `meta.reignDurationSourceBlocks[6]` 参照。
  - **B-2完了（2026-07-21）**: `_corpus_cache` 未生成だった150人分（149人＋正史範囲外1人）を生成。三国・両晋帝紀・十六国追加・南朝・北朝・隋・隋末群雄・唐（本紀＋反乱政権）の8ブロック。書名・巻の同定は既存`accessionRoute`/`deathCause.source`から機械的に特定し、抽出マーカーは全件メイン会話で実地content-grep確認（サブエージェント委任なし）。旧唐書列傳ディレクトリのファイル名が相対番号（絶対巻数－50）である・晋書帝紀第十章(安帝恭帝)が白話訳・魏書列傳ディレクトリも相対番号の疑いなど、新出の史料の罠は `docs/process/CORPUS_NOTES.md` に記録済み。364人全員分（`zhonghuadiguo-yuanshikai`除く）のキャッシュが揃い、ブロック2（三国）以降に着手可能。
  - **ブロック2（三国／11件）完了（2026-07-21）**: 魏5・蜀漢2・呉4。西暦日付の訂正3件——wei-wendi startDate（献帝の遜位詔の日=乙卯を採っていたが、三国志文帝紀が明記する曹丕本人の即位日=庚午に訂正）、wei-caomao startDate（洛陽近郊到着日=己丑を採っていたが、原文が「其の日に即皇帝位」と明記する洛陽入城当日=庚寅に訂正）、shuhan-zhaoliedi endDate（原文の干支「癸巳」がsxtwl換算の四月に存在せず、資治通鑑でも同じ癸巳を確認、夏の時節から直近の癸巳に訂正。`ages.deathDate` も同期）。日次記述なしによる月精度への格下げ1件——shuhan-liushan（後主傳・諸葛亮傳・譙周傳・魏書鄧艾傳・資治通鑑・華陽国志の6資料いずれにも日の干支記載がなく、既存値が劉備崩御日の誤流用＋出典不明の月日だったと判明。降伏の月も11月→10月に訂正）。**特筆**: wu-dadi（孫権）崩御・wu-sunliang（孫亮）即位は本紀相当（呉主傳・三嗣主傳）に日次記載がないが、日本語版Wikipediaの脚注が典拠として明記していた諸葛恪傳（呉書十九）の書簡を確認したところ「今月十六日乙未」「丁酉践尊号」の記載を発見、sxtwl換算（乙未=26日・丁酉=28日、「十六日」は「廿六日」の誤写の可能性が高い）が既存値と完全一致したため出典のみ差し替え・日付は変更なし。wei-yuandi→wu-modiの禅譲・降伏では三国志の干支とsxtwlのproleptic換算の月境界が1ヶ月ずれるケースが複数あり、学術的に広く引用される既存値との整合を優先し日付は変更せず`source.note`に曖昧さを明記した。wei-caomao崩御deathCause.note内の誤記（乙丑→己丑）も原文照合中に発見し訂正。詳細は `meta.reignDurationSourceBlocks[1]` 参照。
  - **ブロック3（両晋十六国／61件）完了（2026-07-21）**: 西晋5・東晋11・桓楚1・前趙5・前燕2・前涼1・成漢5・後趙7・前秦5・夏（赫連氏）3・後燕6・西燕4・南燕2・後秦3、および jin-huidi の復位期(reigns[1])。5つの王朝グループ単位で並列調査し、メイン会話が全訂正候補を`sxtwl`で独立に再検算した上で反映。**西暦日付の訂正9件**: jin-wudi startDate（魏帝禅位詔の日=壬戌ではなく司馬炎本人の即位・改元日=丙寅、wei-wendiと同型）、jin-huidi endDate・jin-simalun start/endDate（「旧暦の日番号を西暦の日番号としてそのまま転記した」変換バグ、乙丑=301-02-03・辛酉=301-05-30に訂正）、jin-huaidi startDate（先帝崩御日ではなく本人の即位日=癸酉、ブロック内の他東晋皇帝との整合性）、dongjin-yuandi startDate（出所不明の既存値を即位記事の干支=丙辰で訂正）、dongjin-mudi start/endDate（endDateが次代dongjin-aidiのstartDateと同値になっていた明確なコピー誤りを丁巳で訂正、ages.deathDateも同期）、qianzhao-liuyuan/liuhe（劉淵崩御・劉和即位/崩御の日が「十の位脱落」型の転記ミス、資治通鑑・十六国春秋輯補の己卯/乙酉で訂正、ages.deathDateも同期）、houzhao-shile endDate（晋書載記の紀年「咸和七年」自体が1年ズレた誤記、資治通鑑の戊辰で1ヶ月訂正）、houqin-yaochang endYear（394→393、ages.deathDateは既に393年で記録済みだった既存の1年ズレを解消）。**新パターン**: houzhao-shishi/houzhao-shijianは原文に「在位三十三日」「在位一百三日」と具体的な在位日数の直接記載があり、暦日は特定できないため`duration.exactDays`のみ原文の日数（33日・103日）で更新（`datePrecision`はmonth/monthのまま、両端day精度でないため`needsPreciseDays`はtrue維持）。**月精度への格下げ1件**: chenghan-liban endDate（資治通鑑「癸亥朔」と華陽国志「癸亥」で日次特定が対立し、sxtwl換算とも整合しないため月精度へ）。**ages同期**: chenghan-liqiのages.deathDateを晋書成帝紀・華陽国志の一致する咸康4年5月説に基づき337→338-05へ訂正。jin-simalunのages.deathDate（旧endDateに依存した二次資料由来の低確度値）が訂正後の時系列（301-05-30以降）と矛盾したためyear精度（0301のみ）へ格下げ。**副次的な発見・修正**: reignSummaryの再計算漏れ（houqin-yaochang等、本ブロックで日付/年を変更した12レコード分を再計算）、`scripts/validate_emperors.py`のKNOWN_REIGN_SUMMARY陳腐化エントリ（qianzhao-liuyuan/firstStartYear）を解消、wei-caomaoに続きqianyan-murongwei（1日差、確度中〜低のため既存値維持）・wu-modi型の暦境界ズレ事例を追加確認、`build_corpus_cache.py`の抽出範囲がxia-helianchang/xia-heliading/houzhao-shizunで実際の終了記事の直前で切れている軽微な不足を発見（原文を直接参照して対応、次回キャッシュ再生成時の課題）。詳細は `meta.reignDurationSourceBlocks[2]` 参照。
  - **ブロック4（南朝／34件）完了（2026-07-21）**: 宋9（うち簒奪政権2＝元凶劭・義嘉政権）・斉7・梁4（うち非正史承認政権3＝豫章王・侯景（漢）・益州政権、北斉擁立政権2＝天成・天啓）・後梁3・陳5。宋書・南斉書・梁書・陳書（china-history）を主典拠に、後梁（西梁）のみ周書巻四十八蕭詧伝と隋書帝紀（daizhi）を使用。corpus_cache単独で確定できない在位終了日は資治通鑑・南史・北史を追加参照して確定した。**日付または精度の補正13件**——共通する誤りパターンは「旧暦の月番号をそのまま西暦の月に転記した」誤変換（liang-yuzhangwang・liang-houjing・liang-xiaozhuang）と、「即位／崩御／廃位のうちどの記事の干支かを取り違えた」誤り（liang-jingdi・liang-xiaoyuanming・chen-houzhu、いずれもブロック1のwei-wendi型と同型）。qi-yulinwangは南斉書の日数表記「二十二日」ではなく干支「壬辰」を採用（資治通鑑と整合）。liang-xiaojiは梁書列傳（底本）と本紀・資治通鑑の日付不一致を紀伝体間の突合で解消（列傳側を誤記と判定）。**ages.deathDate同期1件**（qi-yulinwang、死亡日=reigns[].endDateのため）。ブロック1の教訓通り`reigns[].startYear/endYear`と`reignSummary`の再計算漏れ（年またぎの補正で発生、13件）も同時に解消し`scripts/validate_emperors.py`でエラー0を確認。**作業ツリー共有の実例**: 本ブロックの調査完了後、並行実施中だったブロック3（両晋十六国）のセッションが`git add`で作業ツリー全体をコミットしたため、本ブロックの変更（`meta.reignDurationSourceBlocks`への追記込み）はブロック3のコミット（`f2103a3`）に同梱される形で先に確定した。データの欠落・破損はないがコミットメッセージには「南朝」の言及がない。詳細は `meta.reignDurationSourceBlocks[3]` 参照。
  - **ブロック5（隋唐／36人・reign単位39件）完了（2026-07-21）**: 隋5（帝紀3＋越王侗・秦王楊浩）＋唐本紀24（うち中宗・睿宗・昭宗は在位が2回に分かれるためreign単位で個別調査、計27reign）＋唐末反乱政権7（安禄山・安慶緒・史思明・史朝義・朱泚・李希烈・黄巣）。隋書帝紀・旧唐書本紀/列傳・新唐書・資治通鑑を主典拠に39件全件の即位・在位終了記事の干支を照合、corpus_cacheのみで確定できない分（特に帝紀に独立記述のない4人、下記）は列傳・資治通鑑を追加参照した。**日付または精度の補正19件(reign単位)**: tang-gaozu/tang-taizong（高祖の伝位詔「八月癸亥」と翌日の太宗即位「八月甲子」を取り違えていた1日ずれを連動訂正、wei-wendi型と同型）、tang-jingzong・tang-wuzong・tang-xuanzong-2・tang-zhaozong（在位2期とも）・tang-lige・tang-wuzetian・tangmo-li-chenghong・tangmo-li-yun・tangmo-anlushan・tangmo-anqingxu・tangmo-shisiming・tangmo-shichaoyi・tangmo-zhuci・tangmo-lixilieで日付または精度の補正。**南朝ブロックと同型の「旧暦月番号をそのまま西暦月に転記した誤り」をtangmo-shisiming（startDate）でも発見**——corpus_cache/資治通鑑とも「乾元二年四月」としか記さず日次干支がないため、担当エージェントは既存値 `0759-04-01`（旧暦の月番号4をそのまま西暦4月として転記した値）をそのまま踏襲したが、メイン会話側で `sxtwl.fromLunar(759,4,1,False)` を検算すると西暦は5月2日（ソーラー月=5）であり、`0759-05-01` へ追加補正した。**帝紀に独立記述のない4人**（殤帝tang-shangdi・徳王裕tang-lige・李承宏tangmo-li-chenghong・李熅tangmo-li-yun、`docs/process/CORPUS_NOTES.md`記載の既知の罠）は列傳・新旧両唐書・資治通鑑の使い分けとフォールバック調査が必要だったため、出典典拠の妥当性をメイン会話側で個別レビューし確認済み。李熅のみ新唐書にも独立列伝が見当たらず僖宗紀の当該期間記述で代替（限界として既存メモ通りフォローアップ課題）。**史実による意図的な間隔**: 武則天の傳位（神龍元年正月甲辰＝705-02-21）と中宗の正式復位（丙午＝705-02-23、2日後）は原文上別の記事であり、tang-wuzetianのendDateとtang-zhongzong（2期目）のstartDateの間に2日の間隔が残るが、両エージェントが独立に原文で確認済みのためエラーではない。**ages.deathDate同期2件**（tangmo-anlushan・tangmo-shisiming、いずれも死亡日=reigns[].endDateのため）。`reigns[].startYear/endYear`と`reignSummary`（在位2期の3人は全reign合算で再計算）は対象36人全員分再計算し`scripts/validate_emperors.py`でエラー0を確認。**表示用displayYearsの丸め桁数が南朝ブロックと異なる点に注意**: 南朝セクションの既存値は`round(approxDays/365, 1)`（小数1桁）だが、隋唐セクションの既存値は`round(approxDays/365, 2)`（小数2桁）で統一されており、本ブロックの再計算もセクション内の既存慣行に合わせ2桁で行った（データセット全体でこの丸め桁数自体が統一されていない既知の不整合、要フォローアップ）。詳細は `meta.reignDurationSourceBlocks[4]` 参照。
  - **ブロック6（北朝／28件）完了（2026-07-21）**: 北魏17（前期6・中期3・末期混乱期8）＋東魏1＋北斉6＋西魏3＋北周1。魏書帝紀・北齊書・周書（西魏のみ魏書に本紀を持たないため北史巻五で補完）を主典拠に、5つの並列調査グループ（北魏前期・北魏中期・北魏末期混乱期・東魏北斉・西魏北周）で実施し、メイン会話が主要な干支換算をsxtwlで独立に再検算、加えてWeb検索でも複数件（西魏廃帝の即位が父・文帝崩御と同日であること、恭帝の禅譲が旧暦年をまたぎ557年に相当すること、高紹義の人物比定等）を交差確認した上で反映。**日付または精度の補正10件**——beiwei-daowudi（startDate、既存値が中国暦年ラベル+旧暦日のハイブリッド表記になっており真の太陽暦と53日ズレていた）、beiwei-houfeidi-yuanlang（startDateの1日ズレを訂正、endDateを死去日から廃位日へ）、beiwei-yuanyu（startDateの2日ズレを訂正、endDateが史実〈信都陥落〉より前になっていた時系列矛盾を解消）、beiwei-yuanfasheng（`docs/PROJECT_STATUS.md`/CIで既知だったstartDate>endDateの逆転バグを解消。startDateは孝昌元年正月庚申の換算で訂正、endDateは原典に南奔の具体的日付がないためnull・月精度化）、xiwei-feidi-yuanqin（startDate、父・文帝と同日即位であることを資治通鑑の記述で確認し訂正）、xiwei-gongdi（endDate、西暦年を旧暦年と同一視した誤りを訂正しmonth→day精度へ格上げ）、xiwei-wendi（startDate、先帝〈孝武帝〉毒殺の日ではなく本人の即位記事『即位於城西』の日、wei-wendi/jin-wudi/jin-huaidi型と同型の既知パターン）、beiqi-gaoxie（endDate、突厥による北周への引渡し記事に基づきmonth→day精度へ格上げ）、beiwei-yuanye・beiwei-jiemindi（endDateを死去日〈または出典不明の値〉から廃位/禅譲日へ）。**本ブロックで確立した慣行**: 廃位・禅譲された皇帝のendDateは「帝号を失った日」とし、後年の死去日（幽閉後の処刑等）は含めない。これはdongwei-xiaojingdi（東魏孝静帝）・beiqi-houzhu（北斉後主）・beiwei-xiandi（北魏献文帝、太上皇期間を除く既存方針）の3件が既にこの慣行に従っていたことから逆引きで確立し、これに反していた元曄・元恭・元朗の3件（既存noteが「禅譲以降は皇帝在位に含めない」と明記していたのにendDateが死去日になっていた内部矛盾）を統一した。**人物比定の誤りを発見・訂正**: `beiqi-gaoxie`はIDが「高恒」を想定した命名だが実体は文宣帝の第三子・高紹義（范陽王、突厥の庇護下で自立）であり、幼主高恒は別id `beiqi-youzhu-gaoheng` で既に確認済みだった。reigns[0].noteの元号表記「武平九年」も、同レコード内`eraChangeCount.note`で既に検証済みの理解（北史原文は「称武平元年」）に合わせて訂正した。`reigns[].startYear/endYear`（daowudi・yuanye・xiwei-gongdiは年またぎの補正で変化）と`reignSummary`は訂正対象10レコード分を再計算し、`scripts/validate_emperors.py`のKNOWN_REIGN_ORDER陳腐化エントリ（beiwei-yuanfasheng）も解消してエラー0を確認。詳細は `meta.reignDurationSourceBlocks[5]` 参照。
  - **ブロック8（宋遼西夏金／北宋8＋北宋末2＋南宋9(高宗2期間)＋遼9＋西遼3＋金8＋西夏10・49名50 reign区間）完了（2026-07-21）**: 北宋・南宋は宋史本紀、遼・西遼は遼史本紀（西遼3名は天祚皇帝紀四付録に埋め込み）、金は金史本紀、北宋末の張邦昌・劉豫2名は宋史列傳「叛臣上」（劉豫は金史列傳も補足参照）、西夏10名は西夏書事（daizhigev20、準正史・編年体、正史に西夏の本紀なし）を主典拠に、並行セッションがWorkflowで並列調査・sxtwlで独立再検算した上でユーザー提示・承認を得て反映。**日付・精度の補正2件**: nansong-ningzong（startDate、寧宗紀「翌日」の記述からの2日ズレを訂正）、xixia-jingzong/xixia-yizong（崩御/即位日、望日〈15日〉遇刺・翌日〈16日〉死去という西夏書事の記述から14日ズレを訂正、連動して即位記事の年号ラベル誤記も訂正）。**既存値維持で出典注記のみ更新した5件**: beisong-taizong・liao-jingzong・liao-tianzuodi・xiliao-dezong・xiliao-tianxi（いずれも原文の限界・複数解釈・別史料依拠を理由に既存値を維持し根拠を出典注記に明記）。詳細は `meta.reignDurationSourceBlocks[7]` 参照。
  - **ブロック9（元/北元/元末群雄／元本朝11＋北元1＋元末群雄6・18名19 reign区間）完了（2026-07-21）**: 元本朝11名（世祖〜順帝、明宗・天順帝含む）は元史本紀（巻4-47）、天順帝の顛末補足のみ新元史巻十九、北元1名（昭宗）は元史に本紀がないため新元史巻二十六、元末群雄6名（韓林児・徐寿輝・陳友諒・陳理・明玉珍・明昇）は本紀を持たず明史列伝（第十・十一・十七章）を主典拠に19 reign区間をWorkflowで並列調査し、メイン会話がsxtwl（一部は中央研究院「兩千年中西暦転換」公式ツールでも交差検証）で独立に再検算した上でユーザーに提示・承認を得て反映。**日付・精度の補正3件**: yuanmo-hanlin-er（start/endDateとも「旧暦の月番号をそのまま西暦月に転記した」誤りを訂正、終了年が1366→1367に変わる点に注意。既存source.noteに既にこの可能性への留保が記されていた）、yuanmo-xushouhui（startDate、明史列伝原文「九月」に対し既存値が「十月」相当だった1か月ズレを訂正）、yuanmo-mingyuzhen（startDate、明史「至正二十二年(1362年)春」即位＋本文の在位年数表記「凡立五年」という内部証拠により1363→1362年へ訂正、正確な月日不明のためday→year精度へ格下げ。既存の1363-01-16は「天統元年正月1日」＝踰年改元による改元日と判断）。
  - **Web再調査による追加訂正（2026-07-21・同日）**: ユーザー指示で上記5件のうち未解決だった箇所をWeb（維基百科・百度百科等の二次資料、可能な範囲で原文引用付き）で再検証。大明太祖高皇帝実録 巻八（明代公式実録、明史より粒度が細かい一次史料）に「闰五月丙辰朔……戊午，陈友谅弑其主徐寿辉于采石……僣位其中，国号汉」の記述を発見し、yuanmo-xushouhuiのendDateを1360-07-29→1360-06-16へ追加訂正（陳友諒の即位日=yuanmo-chenyouliang startDateと同日、殺害と即位が同一記事内で連続して記されている。sxtwlで独立検算し一致確認、ages.deathDateも同期）。この実録はyuanmo-chenyouliangのstartDate(1360-06-16)が正しかったことも副次的に裏付けた。**既存値を維持し出典注記のみ更新した3件**: yuanmo-chenyouliang（上記実録による裏付けを追記）、beiyuan-zhaozong（新元史は月までしか特定できないが、複数の独立した二次資料が既存の日精度値〈1370-05-27／1378-05-10〉と一致することを確認、確度を中程度に引き上げ）、yuanmo-mingyuzhen（明史稿を引く二次資料が候補日「至正22年3月3日=1362-03-29」を示しsxtwl換算とも一致したが、明史稿原文の直接確認ができないためprecisionのyear格上げは見送り、フォローアップ課題として出典注記に記録）。天順帝(yuan-tianshundi)のdeathCause.source.page巻数不一致（既知・CORPUS_NOTES記載）はduration調査の対象外として今回は訂正していない。詳細は `meta.reignDurationSourceBlocks[8]` 参照。
  - **ブロック10（明本朝16名17reign＋南明4名4reign／21 reign区間）完了（2026-07-21）**: 明本朝16名（太祖〜毅宗、英宗は正統期・天順期の2reign）は明史本紀（china-history、光宗のみ独立巻を持たず本紀二十一末尾に「◎光宗」として同居）、南明4名（弘光帝・隆武帝・紹武帝・永暦帝）は明清交替期に清の徐鼒が編んだ準正史『小腆紀傳』（daizhigev20）を主典拠に、既存の`_corpus_cache/`（20名分、2026-07-16/17生成済み）を使い7エージェントで並列調査、メイン会話が結果をマージ前に確認した。**日付訂正: 0件**——21 reign全件で既存`startDate`/`endDate`が正史/準正史原文の干支と`sxtwl`独立検算で完全一致し、過去ブロックで頻発した「旧暦月日の転記誤り」パターンは今回検出されなかった。出典を`duration.source.page`（正史/準正史の書名・巻）・`quote`（原文引用）・`conversion`（sxtwl換算根拠）へ差し替え。**副次的に見つかったnote文言の論点2件をユーザー承認の上で訂正**: (1) `ming-huizong`（建文帝）既存noteが「南京占領」と「永楽帝即位」を同日の出来事として記述していたが、明史本紀では別日（南京陥落・建文帝失踪＝建文4年6月13日、永楽帝正式即位＝同月17日）と判明、採用値（6月13日）自体は正しい上で記述を分離。(2) `nanming-zongzong`（隆武帝）既存noteの崩御地「福州」を、小腆紀傳原文が明記する「汀州府大堂」に訂正（日付・在位日数には影響なし）。あわせて`ming-yizong`（崇禎帝）は明史本紀が崩御を「帝崩于万岁山」とのみ記し「自縊」の語を本紀本文に含まないため、note文言を通説による旨に調整（日付は不変）。`nanming-anzong`（弘光帝）の処刑日は小腆紀傳corpus_cacheに日次記載がなく、既存source.noteが引用していた銭海岳『南明史』の記述で補完した。**検出スクリプトの既知の盲点を発見**: `nanming-anzong`の旧page値「朱由崧(zh)/南明史」は`is_wiki_like`判定が書名の部分一致（「南明史」に「明史」が部分文字列として含まれる）で誤って正史扱いしており、task.mdの350件カウント・52件残件にも計上されていなかった（実害はないが`scripts/detect_wikipedia_sources.py`のHISTORY_KEYWORDS部分一致方式の既知の限界としてフォローアップ課題）。詳細は `meta.reignDurationSourceBlocks[9]` 参照。
  - **ブロック11（清朝本紀9名9reign＋宣統帝3reign＋明清交替期4名4reign／17 reign区間）完了（2026-07-21）**: 清朝9名（太宗〜徳宗）と宣統帝清朝期(1908-1912)は清史稿本紀二〜二十五（daizhigev20、china-historyは清史稿を収録しないため必須）、宣統帝の張勲復辟期(1917)・満洲国期(1934-1945)は清史稿の記述範囲外（`docs/process/CORPUS_NOTES.md`記載）のため学術文献（川島真『近代国家への模索1894-1925』岩波新書）・JACAR（アジア歴史資料センター）一次資料・満洲国政府公報をWeb調査、明清交替期4名（順・李自成、西・張献忠、呉周・呉三桂/呉世璠）は明史「流賊」列伝（李自成・張献忠合伝）・清史稿「呉三桂伝」（呉三桂・呉世璠合伝、いずれもdaizhigev20）を主典拠に、中華帝国・袁世凱（正史範囲外）は近現代の学術的に信頼できる複数情報源をWeb調査。既存の`_corpus_cache/`（14名分）を使い4エージェントで並列調査、メイン会話がsxtwlで独立に再検算した上でユーザーに提示・承認を得て反映。**日付訂正2件**: `shun-lichengzheng`（李自成、startDate 1644-05-24→1644-06-03——明史「四月二十九日丙戌」僭帝号の記事と原文干支が10日ズレていた誤りを訂正。endDate 1645-10-01→1645-10-19——明史「秋九月」の旧暦9月range〈新暦1645-10-19〜1645-11-16〉の外にあった既存値を月初日の正しい換算値へ訂正、month精度は維持）、`wuzhou-wusangui`（呉三桂、startDate 1678-03-01〈month精度〉→1678-03-23〈day精度〉——清史稿「三月朔」＝旧暦3月1日を西暦3月1日にそのまま転記した典型バグ〈過去ブロックで頻発したパターンと同型〉を訂正。endDate 1678-10-10→1678-10-02——干支「乙酉」＝8月17日との8日ズレを訂正）。いずれも複数の独立したWeb情報源（新湖南／湖湘访古・瀟湘晨報等）でも同じ日付を確認済み。**史学的な論争を発見・原典優先で処理**: `shun-lichengzheng`の崩御月は明史「秋九月」説・清世祖実録「閏六月」説（阿済格の奏報自体の信頼性に疑義あり）・現代学術〈顧誠〉の「五月」説（原典未確認）が対立しており、`docs/process/RESEARCH_PROCESS.md`の原典優先方針に基づき明史の記述を採用、対立の詳細は`duration.source.note`に記録した。**既存値を維持し出典注記のみ更新した9名**: 清朝9名（太宗〜徳宗）・宣統帝清朝期(reigns[0])・張献忠・呉世璠はいずれも既存`startDate`/`endDate`が原文の干支・複数の独立情報源と完全一致し訂正不要だった。このうち`qing-renzong`（仁宗即位日の干支「戊辰」vs高宗本紀側「戊申」）・`qing-dezong`（穆宗崩御日の干支「癸酉」vs穆宗本紀自身「甲戌」）は清史稿本文自体に本紀間の干支表記の異同があることを発見したが、sxtwl換算と整合する側の既存値が正しいと確認しデータは変更していない（`duration.source.note`に記録）。**副次的な訂正1件**: `zhonghuadiguo-yuanshikai`（袁世凱）のnote「在位83日間」が実際の`exactDays=101`日と不整合だったため「在位101日間（中国語圏の通説では両端日を含む数え方で「102日」とも）」へ訂正。**検出スクリプトのバグ2件を修正**（`scripts/detect_wikipedia_sources.py`）: (1) `HISTORY_KEYWORDS`に「晋書」（JP漢字表記、既存の「晉書」「晋书」では網羅できなかった）・「十六国春秋」「十六國春秋」を追加し、既に正史調査済みだった4件（`dongjin-feidi`・`qianqin-fuchong`・`xia-helianchang`・`xia-heliading`）の誤検出（false positive）を解消（データ自体は変更なし）。(2) `shun-lichengzheng`の旧page値「明史/李自成(ja/zh)」もブロック10で発覚した`nanming-anzong`と同型の部分一致による見落としだったことを確認。検出スクリプトのWikipedia出典残は32件→12件に減少。詳細は `meta.reignDurationSourceBlocks[10]` 参照。
  - **ブロック12（劉永・袁術2名＋隋末群雄12名／14 reign区間）完了（2026-07-21）**: 劉永・袁術は後漢書列傳（王劉張李彭盧列傳・劉焉袁術呂布列傳、china-history）、隋末群雄12名は旧唐書列傳巻五十四〜五十六（china-history／daizhigev20）・新唐書巻八十七・資治通鑑（daizhigev20）を主典拠に5エージェント並列調査、メイン会話がsxtwlで全項目独立再検算し一致を確認した上でAskUserQuestionにより2グループ（史料間対立のない明確な訂正15件／史料間対立・精度判断が必要な6件）に分けてユーザー承認を得て反映。**日付・精度の訂正14件**: `liu-yong-liang`（startDate null→0026-01-07、光武帝紀上「十一月甲午」の旧暦→新暦換算で西暦年が更始3年/25年から26年に繰り上がるためstartYearも訂正、endDateは死去月日が原文に記載なく年精度のnullを維持）、`yuan-shu`（startDate null→0197-01-01、資治通鑑の記事配置からの推定で確信度中／endDateの日部分を月精度プレースホルダ規約へ統一）、`suimo-yuwenhuaji`（endDateが旧唐書高祖本紀「丁酉」の換算値と3日ズレていたため訂正）、`suimo-wangshichong`（endDateを降伏日「丙寅」の換算値でmonth→day精度へ格上げ）、`suimo-liangshidu`（startYear 618→617の年ズレを訂正——起兵・称帝とも617年内と判明——、endDateの旧暦月日そのまま転記の誤りを訂正、ages.deathDate同期）、`suimo-xiaoxian`（start/endDateとも精度格上げ・endDateの旧暦月日転記誤りを訂正）、`suimo-lizitong`（start/endDateとも精度格上げ・endDateの旧暦月→西暦月の転記誤りを訂正）、`suimo-linshihong`（startDateをyear→day精度へ格上げ、endDateは資治通鑑の記述が月境をまたぎ確定困難なため年精度を維持）、`suimo-fugongshi`（startDateの旧暦月→西暦月の転記誤りを訂正、endDateは判明した「戊戌」が都城陥落日で本人処刑日と確言できないため日精度から月精度へ保守的に格下げ）、`suimo-zhucan`（startDateの旧暦月→西暦月の転記誤りを訂正、endDateは資治通鑑と完全一致のため変更なし）、`suimo-xuerengao`（start/endDateともday精度へ格上げ、startDateは父・薛挙の死と同日）、`suimo-xueju`（endDateをday精度へ格上げ、旧唐書「壬午」vs資治通鑑「辛巳」の1日対立を原典優先方針で旧唐書採用により解決、ages.deathDate同期）、`suimo-liuwuzhou`（endDateをday精度へ格上げ、既存の622年説〈新唐書〉を維持しつつ旧唐書本紀に同一記事が武徳3年/620年条にも誤配置されている内部矛盾を新たに発見、列傳の「凡六載」が622年説を支持）、`suimo-liqui`（start/endDateとも精度格上げ、endDateの旧唐書「辛亥」vs資治通鑑「庚辰」の1ヶ月対立を原典優先方針で解決）。**task.md記載の10名（suimo-*）に加え、検出スクリプトの部分一致による見落とし（block10/11で確立した既知パターン）に該当していた`suimo-liuwuzhou`・`suimo-xueju`の2名も同時に処理**し隋末群雄12名全員を完了させた。**本ブロック完了によりフェーズB（`reigns[].duration.source`のWikipedia出典一掃）が365人全員で完了、`scripts/detect_wikipedia_sources.py`の残存検出数0件を達成**。詳細は `meta.reignDurationSourceBlocks[11]` 参照。
  - **B-5（検出スクリプト部分一致の見落とし12名／2026-07-21 完了）**: フェーズB完了後のサイト出典表示整備（task.md B-4）中に、`duration.source.page` にWikipedia記事名が正史書名と混在したまま残る9件（`liang-xiaozhengde`・`beiwei-xiaozhuangdi`・`beiqi-andewang-gaoyanzong`・`beiqi-youzhu-gaoheng`・`beizhou-mingdi`・`beizhou-wudi`・`beisong-qinzong`・`jin-hailingwang`・`jin-aizong`）＋`quote`/`conversion` 未付与の正史出典3件（`tang-aidi`・`qing-shengzu`・`beizhou-jingdi`）を発見（ブロック10〜12で既知だった `HISTORY_KEYWORDS` 部分一致の盲点——「梁書」「金史」等を含むpageが正史扱いされ検出から漏れる——の残件）。梁書・魏書・北齊書・周書・隋書・宋史・金史・旧唐書・清史稿の `_corpus_cache/` と資治通鑑（daizhigev20）を主典拠に4エージェント並列調査、メイン会話がsxtwlで全干支換算を独立再検算し、AskUserQuestionで承認を得て反映。**日付訂正5名**: `jin-aizong`（endDate 1234-02-08→02-09、伝位の詔の夜=戊申は「承麟固让」で未成立、翌己酉の承麟即位で伝位完成・同日自縊。ages.deathDate同期、jin-modi startDateと同日接続）、`liang-xiaozhengde`（startDate 旧暦十一月の月直記誤りを0548-12-01へ、endDateを死去月直記の0549-06-15から帝号喪失日=大司馬降格・資治通鑑三月庚午=0549-04-27〈day〉へ。ages.deathDate null→0549-08-08〈資治通鑑癸丑〉充当、旧noteの「zh版8月8日は無出典」判断を撤回。同一事象を参照する親征・被反乱eventsの月直記も是正）、`beiqi-andewang-gaoyanzong`（start/end 0576-12-01→0577-01-18/01-21〈day〉、旧暦十二月の月直記は月精度としても不成立。startYear/endYear 576→577、在位365→3日。改元・大赦events[].dateも同期）、`beiqi-youzhu-gaoheng`（endDate 処刑月0577-11-01→任城王への禅位日0577-02-24〈day〉。北齊書の退位干支「乙亥」は朔日と同じで自己矛盾のため通鑑「乙未」で補正）、`beizhou-jingdi`（endDate 処刑日0581-07-09→隋への禅譲日0581-03-04。既存noteは既に禅譲を記述しておりendDateのみ不整合だった）。幼主・静帝・蕭正徳はいずれも「endDate=帝号喪失日」慣行（ブロック6確立）への統一。**訂正不要だった7名**は既存値が原文干支と完全一致（`qing-shengzu` はpageの巻数誤り「巻8/巻9」→「本紀六・本紀八」のみ訂正。清史稿の聖祖本紀「丙辰」vs世祖本紀「丁巳」の即位日干支不整合を発見し丁巳採用の根拠をnoteに記録）。11名の `startDateRaw`/`endDateRaw` も充填。詳細は `meta.reignDurationSourceBlocks[12]` 参照。

`accessionRoute.source` は棚卸しの結果 Wikipedia 出典が0件でクリーンだったため対象外。

## Wikidata QID 紐付け（2026-07-21 完了、task.md 2-5）

365人全員の `sources.wikidata` に Wikidata QID を付与した（従来は全件 null）。JSON-LD `sameAs`（task.md 4-2）・英語名 `nameEn` の初期値取得（項目5）・肖像画の外部照合（3-2 残存リスク）の前提となる基盤データ。

**方式（3パス・API リクエスト計約12回・全て HTTP 200、User-Agent 明示・直列・maxlag=5 で実行）**:

1. **SPARQL**（`P39/wdt:P279* → Q268218`）で「中国皇帝」職位保持者357人のプールを取得し、名前（諱・通称・廟号・諡号・別名・元号呼称）×王朝×生没年整合でローカル照合 → **298件を自動確定**。自動確定の条件は「名前完全一致＋生没年が在位期間と整合＋次点候補との明確なスコア差」の3点全て。
2. **jawiki 記事名逆引き**（`wbgetentities`・50件/バッチ）で残り67件の候補を取得し、**全件を説明文・sitelink・生没年で個別目視確認**して確定（曖昧さ回避ページを除外し、「劉晟 (南漢)」「仁宗 (西夏)」のような限定子つき記事名・zhwiki 記事名で同定）。
3. **個別照会**: jawiki 記事が無い/曖昧さ回避に阻まれた7件（孫皓＝避諱字ゆれ・李承宏・李熅・劉永など）を `wbsearchentities`／zhwiki sitelink で個別に解決。

**検証**: 365件全て一意（重複割当なし）・`^Q[0-9]+$` 形式で JSON Schema 検証エラー0。著名皇帝のサンプル検算（始皇帝=Q7192・武則天=Q9738・クビライ=Q7523 等）を sitelink レベルで確認済み。

**留意点**:
- 僭称・短期在位の人物は Wikidata 側の説明文が「皇帝」でないことがある（慕容詳=duke、慕容麟=general and prince、劉守光=warlord、王延政=politician、韓林児=rebel など）。**人物の同一性**（名前・王朝・年代・記事内容）で確認しており、Wikidata 側の職位記述の粗さは紐付けの正否に影響しない。
- `beiwei-yuanyu`（元愉）= Q11104386 は CBDB 由来のスタブで説明文が「Western Wei person」と不正確だが、zhwiki 記事（京兆王元愉・508年称帝）で同定確認済み。
- 照合過程の中間成果物（SPARQL 結果・候補レポート）はセッション作業領域のみで、リポジトリには残していない。QID 自体が検証可能な外部参照になっている。

## データ QA の CI 恒久化（2026-07-21、task.md 3-3）

`scripts/validate_emperors.py` と GitHub Actions ワークフロー `.github/workflows/validate-data.yml` を新設し、`data/` または QA スクリプトを触る push / PR で自動検証が走る体制にした。チェック内容・エラー/警告の区分はスクリプト冒頭の docstring が正（スキーマ適合＝寛容版＋additionalProperties:false 機械付与の厳格版・日付整合・精度と形式の整合・count==events長・QID 形式/一意性・出典禁止語・肖像 manifest 整合/MD5 重複など）。新設時は現データで 0 エラー・警告4種（フェーズB進行中の既知事項）の緑スタート。フェーズB完了（2026-07-21）後の格上げ、ages 日付 ISO 正規化（同日、下記の節）による非 ISO 警告の解消を経て、現在は 0 エラー・警告2種（deathDate > endDate の退位後死去件数表示・datePrecision 非標準トークン）。

**運用ルール**:
- **`KNOWN_ISSUES`（スクリプト内の許容リスト）は「容認」ではなく「個別調査待ち」の明示**。データ側を訂正したら該当エントリを削除する。削除し忘れは「陳腐化エントリ」警告で検出される（訂正済みならエントリが残っていても CI は落ちない＝フェーズB進行中の別セッションのコミットを妨げない設計）。
- `reigns[].duration.source` の Wikipedia 出典チェックは、2026-07-21ブロック12完了（残存数0件到達）を受けて**警告からエラーに格上げ済み**（同日実施）。さらに同日、出典禁止語チェック全体をパス列挙方式から **emperor レコード全体の再帰走査方式**に変更した — キー名 `source` を持つ出典はどのフィールド（将来の新設含む）でも自動的に検査対象になり、Wikipedia/百度等の混入・source が object でない構造異常は CI が落ちる（JSON パス付きの個別エラー）。
- 新フィールドを正式追加する際は `data/schema/emperors.schema.json`（配布用）と `EMPERORS_SCHEMA.md` を先に更新する。厳格版チェックが未記載キーを構造ドリフトとして検出する。

**デプロイ CI（`.github/workflows/deploy-site.yml`）との関係**:
- サイトのビルド・GitHub Pages への公開は `deploy-site.yml` が担う。トリガーの `paths` は `site/**` に加えて `data/**` と肖像画同期元を含む（データのみのコミットでデプロイが走らない構造問題があり 2026-07-20 に恒久対策済み。サイトはビルド時に `data/emperors.json` を直接読むため、データ訂正はデプロイを伴って初めて公開に反映される）。
- 2026-07-22（task.md 0-2）、`validate-data.yml` が並列に走るだけでデプロイを止められない問題への対策として、`deploy-site.yml` の build ジョブ冒頭に `validate_emperors.py` の実行（デプロイゲート）と `npm run lint`・`npx tsc --noEmit` を追加した。検証エラー時はビルド前に失敗し公開されない。

**CI 構築時に見つかった未解決のデータ問題（許容リスト登録済み・フェーズB等で個別調査を要する。2026-07-22 現況更新）**:
- ~~`beiwei-yuanfasheng` reigns[0]: startDate > endDate の逆転~~ **解消済み**（2026-07-21 フェーズB北朝ブロックで訂正。`KNOWN_REIGN_ORDER` は空）
- ~~`qianzhao-liuyuan`: reignSummary.firstStartYear=309 vs reigns[0].startYear=308~~ **解消済み**（2026-07-21 フェーズB ブロック3の reignSummary 再計算で 308 に統一。なお flags.usedEmperorTitleFrom の同種の旧値残存は 2026-07-22 の 0-2 で訂正済み）
- `ages.deathDate` が最終 `endDate` より前（精度を揃えた比較で9件）: chen-wendi・beiwei-tuobayu・shiguo-qianshu-wangjian・shiguo-nanhan-liusheng・liao-jingzong・liao-daozong・xixia-huizong・xixia-chongzong・shun-lichengzheng。旧暦月表記と西暦換算日の混在が主因とみられ、個別調査での解消待ち（`KNOWN_DEATH_BEFORE_END` に登録済み）
- `confidence: ""` 4件（既知・task.md 3-3 に記載のとおり値の確定は調査判断待ち）

**同時に直した既存 QA 資産の不備**:
- `scripts/detect_wikipedia_sources.py` のグループ名誤り（`empressEstablishCount`/`crownPrinceDeposalCount` → 実データは `empressInstallationCount`/`crownPrinceDepositionCount`。立后・廃立の events が全件スキップされていた。修正後も検出0件でフェーズAの結論は不変）と、`zhonghuadiguo-yuanshikai` の accessionRoute 意図的表記「近現代の学術的に信頼できる複数情報源」の許容リスト追加
- `data/schema/emperors.schema.json` にフェーズB新設の `source.quote`/`source.conversion` が未反映だった点と、`meta` の patternProperties が `completedBlocks`/`reignDurationSourceBlocks` を取りこぼしていた点（`Blocks$` に修正）

## reignSummary.totalReignDuration の同期漏れ訂正＋CI 検証追加（2026-07-22、task.md 0-1）

2026-07-22 の多角的レビューで、`reignSummary.totalReignDuration.approxDays` が `sum(reigns[].duration.approxDays)` と不一致の9件を検出・訂正した（han-wudi・han-zhaodi・han-xuandi・han-yuandi・wei-wendi・wei-caomao・shuhan-zhaoliedi・shuhan-liushan・nansong-ningzong。最大 366 日のズレ）。フェーズB ブロック1・2（秦・前漢・三国）＋南宋寧宗の日付訂正時に summary 側の再計算が漏れたもの。`displayYears` は各レコード既存の小数桁数を維持して年=365 換算で再計算し、shuhan-liushan は summary の `isExact: true` / `needsPreciseDays: false` が reigns 側の月精度格下げと矛盾していた点も是正した。

再発防止として `scripts/validate_emperors.py` の `check_reign_summary()` に totalReignDuration 検証を追加した（approxDays=合計の一致・isExact/needsPreciseDays と reigns の exactDays 確定状況の一致・displayYears が年換算〔÷365 または ÷365.25・小数0〜2桁丸め〕に一致、をすべてエラー扱い）。訂正前データに対して9件全員を検出することを確認済み。既知の例外だった qin-er-shi の displayYears=2（切り捨て値）は 2026-07-22 の task.md 0-3 で qin-shi-huang とともに標準換算（÷365.25・1桁丸め）へ統一し、`KNOWN_DISPLAY_YEARS` 許容リストは空になった。

## BCE イベント日付の年規約統一（2026-07-22、task.md 0-2）

前漢13人の `events[].date`（改元・大赦・立后・皇太子廃立、BCE イベント全127件）のうち105件が歴史年直記（前n年 → `-n`）で入力されており、`reigns` 側の ISO 8601 天文年（前n年 → `-(n-1)`）と規約が食い違っていたのを統一した。レビュー時の見立ては「8件」だったが、note に「前n年」の明記がないイベント（紀年のみ記載）が検出から漏れていたもので、実際は han-gaozu・han-chengdi の大半（入力時から天文年で正しい）を除くほぼ全件が対象だった。恵帝2件・後少帝2件・成帝鴻嘉1件（3〜4年ズレの不規則系）は `_corpus_cache` の原典で紀年を個別確認のうえ訂正。規約の定義（year precision は紀年の対応年・month/day precision は実ユリウス年、漢初の冬十月〜十二月の年またぎ扱い）は `data/schema/ADDITIONAL_SCHEMA.md` に明文化した。

再発防止として `scripts/validate_emperors.py` に `check_bce_event_years()` を追加（BCE イベントの在位 ISO 年範囲チェック＋note「前n年」明記との突合をエラー扱い。訂正前データで16件検出・訂正後0件を回帰確認済み）。note に西暦の明記がない1年ズレは機械検出できないため、新規 BCE イベント追加時は note に「前n年」を併記することを推奨する。

なお han-xuandi の立后3件にあった `datePrecision: "day"` なのに `date` が年のみという不整合は、2026-07-22 の task.md 0-3 で既存慣例トークン `day（干支のみ：〔紀年月干支〕、グレゴリオ暦未換算）` へ是正した（漢代太初暦の月境界を sxtwl が再現する保証がなく、西暦日付の確定自体は引き続き個別調査待ち）。

## 0-3 Low 残件の解消（2026-07-22、task.md 0-3）

2026-07-22 レビューの Low 項目（chen-feidi 原典確認・コード/データ/サイト小修正）を一括対応した。

**chen-feidi（陳廃帝）の没年齢矛盾は「原典由来の矛盾」と確定**: 生年（梁承聖三年〔554年〕五月庚寅）と没年齢（太建二年〔570年〕四月薨「時年十九」＝554年生なら数え年17）の矛盾を原典で再確認した結果、『陳書』卷四・『南史』卷十・『建康実録』の3書ともまったく同じ両記載を併記しており、転記ミスではなく原典内部の矛盾。生年552年説は「時年十九」からの逆算にすぎず、552年を直接記す原典は確認できなかった。傍証として同母弟・始興王伯茂の「時年十八」（568年没、『陳書』卷二十八＝逆算551年頃生）は兄の554年生と両立せず年齢記載側を支持する。暦計算では554年・552年とも五月に庚寅の日が実在し判別不能（sxtwl 検算）。対応は「直接記載2値〔生年554・没年齢19〕をそのまま採録し、`ages.note` に矛盾の全容を明示・`confidence` を high→medium に変更」とした。

**データ構造の不統一の解消**（判定を伴わない構造是正のみ、`scripts/validate_emperors.py` エラー0を確認）:
- nanming-zongzong の大赦 events[1] に `date: "1646-07"` を補完（note 記載の隆武二年六月を sxtwl 換算。同ブロックの既存慣例〔旧暦月の開始日が属する西暦月・month 精度〕に一致）
- 反乱系 events の `name` キー欠落28件（yuan-yingzong 23・wudai-houtang-modi2 4・shiguo-qianshu-wangjian 1）に `name: null` を付与（キー順も既存慣例に統一）
- houzhao-shishi の `ages.confidence` 欠落に `medium` を補完（note の「即位とほぼ同時期の年齢情報として近似的に採用」に対応する値）
- qin-shi-huang / qin-er-shi の `displayYears`（11・2＝歴史年数え）を全体慣例の approxDays÷365.25・1桁丸め（10.7・3.0）に統一し、`KNOWN_DISPLAY_YEARS` 許容リストを空にした
- han-xuandi 立后3件の `datePrecision` を上記のとおり既存慣例トークンへ是正

**site 側の小修正**: `emperors.ts` の `videoById.get(id)!` を fail-fast 化・`eraOrder` 未登録時のサイレント末尾落ち（`?? 99`）を throw 化・存在しない `ERA_BY_SELF_SECTION` 参照コメントを削除、`sync-portraits.mjs` に同期元から消えた画像の削除追従を追加、ランキング系チャート3ファイルの定型（軸ドメイン・左マージン・行ウィンドウイング計算＋スクロール枠 JSX）を `scroll-bar-chart.tsx` の `useRankingChartLayout` / `WindowedChartFrame` に共通化、sitemap の個別365ページから一律 `datasetGeneratedAt` の lastmod を撤去（人物単位の更新日時を持たないため。統計ページ側は維持）、`timeline/page.tsx` の素の `<a href="/about">` を `Link` 化。

## 機械スクリーニング起点の追加訂正＋CI カバレッジ拡張（2026-07-22）

既存 CI（`validate_emperors.py`）が 0 エラーの状態で、CI がカバーしていない観点を追加の機械スクリーニング（イベント日付の在位範囲整合・数え年の逆算整合・note 内年齢/年言及との突合・王朝内在位重複/空白・在位日数再計算）＋ Wikidata 生没年クロスチェック（SPARQL・365 人全員・API リクエスト2回のみ）で走らせ、サブエージェント3系統でトリアージした。**Wikidata 生没年照合は実質クリーン**（年レベル乖離5件はすべて note に根拠明記済み／推定 medium 明示済み／こちらの原典典拠の方が強い〔少帝弁・欽宗〕）。検出した実問題4件を原典で確認のうえ訂正（`validate_emperors.py` エラー0を確認、Wikidata API は CI には組み込まない方針）:

- **nansong-ningzong（寧宗）即位日 1194-07-22→07-24**: 光宗 endDate（07-24＝甲子）と寧宗 startDate（07-22＝壬戌）が同一イベント（内禅）で2日食い違う内部矛盾だった。2026-07-21 フェーズBが寧宗本紀の「翌日禫祭」のみで 07-24→07-22 と暫定変更し（conversion に「光宗本紀・續資治通鑑での傍証確認が望ましい」と課題を明記）不整合が生じたもの。その傍証を確認し、**光宗本紀「甲子…命皇子嘉王即皇帝位」・續資治通鑑巻153「甲子，太皇太后詔嘉王擴成服即位」がともに甲子（07-24）を明記**、續の「兩日不獲命」が壬戌の禫祭→2日後甲子即位を裏づけたため甲子＝07-24 を採用。duration.exactDays 11015→11013・reignSummary.totalReignDuration.approxDays 11013・displayYears 30.17 を同期、quote に續資治通鑑を追記、conversion を調停記録へ改稿。
- **xixia-yizong（西夏毅宗諒祚）ages 日付**: deathDate 1068-12→1068-01-27。西夏書事「治平四年、夏拱化五年……十二月，国主諒祚卒」より拱化五年＝治平四年＝1067年（拱化元年1063起算）の旧暦十二月崩御で、旧暦十二月一日＝太陽暦1068-01-08。旧値は年ラベル誤認（拱化五年を1068とする）＋旧暦月番号「十二月」の無変換の二重誤り。reigns[].endDate 1068-01-27（在位中死去）と一致させ day 精度化。birthDate 1047-02-06→1047-03-05（旧暦二月六日の sxtwl 換算、無変換を是正）。deathAge=21 は不変。**accessionAge は 1→2 に訂正**：即位は旧暦1048年正月（startDate 1048-01-19＝sxtwl で旧暦1048年正月2日）で生年1047年二月とは別の年ラベルのため数え2。旧値1は「生後約1年」の満年齢混入だった。なお漢殤帝の accessionAge=1 は誕生・即位とも元興元年（105年）で数え1が正しく、当初ペアと見立てたが対象外と確認（在位 startYear=106 は改元後の延平元年ラベルで、即位自体は元興元年十二月）。
- **beisongmo-liuyu（齊・劉豫）note 内年ラベル矛盾**: amnestyCount[0].note「建炎四年（1134年）四月、遷都汴京」は二重誤り（建炎四年＝1130、かつ遷都汴は 1132）。宋史列伝「（紹興）二年…四月丙寅，豫遷都汴」・金史「阜昌二年，豫迁都于汴」、劉豫自身の eraChangeCount note が阜昌元年＝1131 と確定していることから **紹興二年＝阜昌二年＝1132** で一致。amnesty note を「紹興二年（阜昌二年、1132年）」へ、capitalRelocationCount[0].note の「阜昌三年」も「阜昌二年」へ訂正（遷都 date 1132-04 は不変）。
- **zhonghuadiguo-yuanshikai（袁世凱）年齢の満年齢混入是正**: 365人で唯一 ages が満年齢（accessionAge/deathAge とも56）だったのをデータセットの数え年統一方針へ揃え accessionAge=57・deathAge=58（生1859・称帝1915・没1916、年ラベルまたぎなし）。一般に流布する「享年56」は満年齢である旨を ages.note・deathCause.note の双方に明示。

**CI カバレッジ拡張（`validate_emperors.py` に3チェック追加、いずれも現データでクリーン＝将来のリグレッション検出用ガード）**:
- `check_event_reign_range()`（エラー）: CE イベント日付が在位 ISO 年範囲外なら検出。称帝前（王号・天王・僭号期）に本人が行った既知イベントは `KNOWN_PREACCESSION_EVENTS` で許容（下記「称帝前イベントの計上」参照）。events[].date の旧暦無変換等の誤変換を将来捕捉する（reigns 側はフェーズBで是正済みだが events 側は未実施）。
- `check_reign_overlap()`（エラー）: 同一王朝内の在位重複のうち、レコードに並立・対立政権系キーワード（`COEXIST_KEYWORDS`）を一切含まないものを検出（内禅・禅譲の前帝 endDate≠次帝 startDate 同期漏れ＝光宗/寧宗型）。並立政権31件は全件キーワードで説明済みのため 0 件でクリーン。
- `check_counting_age()`（警告）: CE 生年に限り、数え年逆算（accessionAge は startYear、deathAge は ages.deathDate 基準＝太上皇の退位後死去で誤検知しない）と2以上乖離する ages を一覧化（満年齢混入・入力ミスを可視化。±1 の旧暦年またぎは許容）。chen-feidi の原典由来 ±2 矛盾は `KNOWN_COUNTING_AGE` で許容。

**称帝前イベントの計上（方針確定＝本人の実権掌握期・2026-07-22）**: 上記スクリーニングで、王号・天王・僭号期のイベント（改元・大赦・立后・遷都等）を在位カウントに計上した21件（9人：石虎7・李元昊4・劉淵2・慕容儁2・楊溥2・王延羲1・孫権1・黄巣1・遼太祖1）を確認。当初「遷都のみ在位中に限定・他は包括」の折衷案を検討したが、改元も遷都も定義文言が同一（ともに「在位中」）で折衷に原理的根拠がないため撤回。**8つの回数系指標すべてを一律「本人が君主権を行使した実権掌握期の行為を計上（王号・天王・僭号期を含む）・他者の行為は除外」と確定**し `ADDITIONAL_SCHEMA.md`「回数系指標の計上期間」節に明文化した。これに伴う訂正は1件——**qianyan-murongjun（前燕）の遷都から、本人でなく父・慕容皝が燕王期に行った0341年龍城遷都を削除**（原文『晋書』載記第九「皝遷都龍城」、count 3→2。残る0350年薊城遷都は慕容儁本人の燕王期の事績のため計上維持）。残る20件の称帝前イベントは全件が本人自身の行為であることを2026-07-22に確認済みで計上維持（`KNOWN_PREACCESSION_EVENTS` に登録、CI は在位範囲外の既知正当例として通す）。石虎の遷都カウントは天王期の1件（襄国→鄴）を含み1のまま、皇帝在位カウントを過小評価しない。

## flags.usedEmperorTitleFrom の規約確定＋旧値3件訂正（2026-07-22、task.md 0-2）

`reigns[0].startYear` と乖離する7件のうち、qianzhao-liuyuan（309→308）・suimo-liangshidu（618→617）・yuanmo-mingyuzhen（1363→1362）の3件はフェーズB在位訂正時の旧値残存で、原典キャッシュで確認のうえ訂正した。残る4件（liu-yong-liang・liang-houjing・beiwei-daowudi・beiqi-andewang-gaoyanzong）は旧暦十二月称帝がユリウス暦で翌年1月に落ちる年またぎで、規約を「歴史紀年ベース」と確定したことで正当な -1 乖離として確定（`data/schema/EMPERORS_SCHEMA.md` に明文化・`validate_emperors.py` の `check_used_emperor_title_from()` で検証）。なおこのフィールドは現時点でサイト未使用。

## ages 生没年日付の ISO 正規化（2026-07-21、CI 非 ISO 警告62件の解消）

`ages.birthDate/deathDate` に残っていた非 ISO 表記 62 フィールド（42 人）を、1 件ずつ個別判定のうえ ISO 形式（太陽暦）へ正規化した。内訳: ゼロ埋め不足のみ 8 件・元号の年のみ表記 2 件・旧暦月番号の転記 9 件（太陽暦多数月へ補正）・旧暦日/干支の転記 41 件（sxtwl 換算で日精度確定）・判断を要した 2 件（下記）。検証は (1) 日番号と干支が両方ある日付は sxtwl 換算で両者一致を確認 (2) 在位中崩御 17 件はフェーズB検証済み `reigns[].endDate` と完全一致を機械 assert (3) 適用スクリプトに旧値一致ガードを内蔵、で行った。従来値の原文表記はすべて `ages.note` 末尾の正規化追記に保全し、触れたフィールドの `datePrecision` は標準トークン（year/month/day）へ揃えた。

**特筆事項**:
- **南漢劉龑の崩御月**: 十国春秋の按語は三月説（「今从通鉴死于三月非四月也」）だが、資治通鑑原文は四月条に「丁丑，高祖殂」を置き（`reigns[0].duration.conversion` で検証済み）、endDate 0942-06-10 と一致するため四月説を採用（942-03 → 0942-06-10、月→日精度）。
- **姚興・石遵（4世紀）**: 原文の干支（義熙十二年二月丁未・永和五年十一月丙辰）が sxtwl 暦表の当該旧暦月内に存在しない（東晋官暦〔平朔〕と sxtwl〔定朔〕の朔差または史料の誤記）。日精度をでっち上げず月精度とし太陽暦多数月を採用（姚興は day→month へ格下げ）。
- **後唐荘宗**: 生日の原文干支「癸亥」は sxtwl では 22 日=癸酉と不一致（癸亥なら 10 月 12 日相当）。日番号を優先し 0885-12-02（通説と一致）。崩御の従来転記「四月一日丁丑」の丁丑も誤記とみられ（四月朔は丁亥）、endDate 一致で 0926-05-15 に確定。
- **太陽暦年が繰り上がった 3 件**: 宋哲宗の生年（熙寧九年十二月七日 → 1077-01-04）・劉継元の没年（淳化二年十二月癸未 → 0992-01-25）は旧暦 12 月の年またぎによるもの。数え年（年号年ラベル基準）の `accessionAge`/`deathAge` には影響しない。
- 正規化により `deathDate > endDate` 警告が 40→47 件に増えたのは、新たに機械比較可能になった退位後死去（唐睿宗・後周恭帝・劉鋹・劉継元・孟昶・夏襄宗ら）が正しく可視化されたもので想定どおり。

**申し送り（今回のスコープ外と決めた残警告）**:
- **datePrecision 非標準トークン（警告、115 件 77 種）**: ages/events の precision 自由記述の正規化は語彙標準の方針確定が先のため未実施（ユーザー判断 2026-07-21）。今回触れた ages フィールド分のみ標準トークン化済み。着手時は `normalizeDatePrecision`（site 側の接頭辞判別）が吸収している実態を壊さないよう、site 表示と検証の両方を確認すること。
- **deathDate > endDate（警告、47 件→2026-07-22 実測 49 件）**: 在位終了事由フィールドが無く退位後死去と真の誤りを機械判別できないため見送り（ユーザー判断 2026-07-21）。解消するなら終了事由の新フィールド設計が前提。

## ライセンス確定・データ公開基盤（2026-07-21、task.md 2-2/2-3/2-1残/4-2）

二重ライセンス構成を宣言し、データ公開の基盤一式を完了した。

- **ライセンス（2-2）**: データ・調査メモ文章＝CC BY 4.0（全文 `data/LICENSE`）／コード＝MIT（ルート `LICENSE`）。`meta.license` に機械可読で記載し、README に帰属表示例つきで明記。宣言前に全 note 約126万字の CC BY-SA 混入スクリーニングを実施（機械マーカー68件の全数分類＋jawiki 記事本文との n-gram 全数突合。近似一致3名4箇所を原典準拠表現に書き換え=7f962d4。判定の詳細はセッションメモリ ccbysa-screening-2026-07-21）
- **`meta.source` 再定義（2-2 同時）**: primary を `official-histories`（正史原典）へ変更し、Wikipedia「中国帝王一覧」は `inclusionListSeed`（収録候補リストの初期洗い出し用・データ値の典拠ではない）に降格。配布スキーマ（`$defs.meta`）・EMPERORS_SCHEMA.md を同時更新
- **バージョニング（2-3）**: `meta.version: "2026.07"`（CalVer・データ内容の版。構造の版 `schemaVersion` とは別軸）を新設し、ルートに `CHANGELOG.md` を新設（唐哀帝追加等を遡及記録）。**GitHub Releases のタグ（`v2026.07` 推奨）のみ未実施**（push 後にユーザー主導。Zenodo は 2026-07-21 に中止が確定したため順序制約はなく、いつ切ってもよい）
- **サイト側（2-1残・4-2）**: `/about` に「データセットのダウンロードとライセンス」節（JSON/CSV/スキーマの3リンク＋利用条件）と「正誤表」節を新設。Dataset JSON-LD に `license`/`distribution`/`temporalCoverage`/`version`/`isAccessibleForFree` を追加し、Google Dataset Search の掲載条件（distribution+license）が揃った。`temporalCoverage` はデータから導出（`datasetTemporalCoverage`）

**残タスク（データ公開系）**: GitHub Releases タグ（ユーザー主導）のみ。2-4 Zenodo DOI は **2026-07-21 にユーザー決定で中止**（再提案しない。引用基盤は CC BY 4.0＋CalVer＋CHANGELOG＋Dataset JSON-LD で成立済み。DOI 不要の `CITATION.cff` 配置だけは将来の独立提案の余地あり）。CSV への `wikidataId` 列追加は 2026-07-21 に完了（40→41列・1593d33）。

## 系譜・即位経路グラフ（2026-07-22 フェーズ0完了＋スキーマ凍結、task.md 6-3）

全皇帝365人を親子・養子・婚姻・即位経路のエッジで結ぶ系譜グラフの新規調査プロジェクト。フェーズ0（スキーマ設計）を完了し、**可視化方式の決定とモック検証を経てスキーマを凍結した**（凍結後の変更は原則しない。ユーザー指示「最終的なアウトプットまで固まってから作業を開始する」に基づき、調査開始前に表示要件から必須フィールドを逆算して確定する手順を踏んだ）。

- **確定した方針（ユーザー決定）**: データは別ファイル `data/kinship.json`（emperors.json は変更しない）／婚姻エッジを含める／ブリッジ人物（非皇帝ノード）の収録基準は「経路上・一親等〔父系。**実母は接続に寄与する場合のみ**〕・**実在追尊皇帝**・婚姻当事者」の4基準（伝説的・儀礼的遠祖はノード化せず `genealogicalClaims` に記録）。王朝は実質的建国者から表示できるようにする（例：西晋は司馬懿から）
- **可視化（2026-07-22 決定）**: 方式③「全体1画面のインタラクティブグラフ」＋縦軸=時間（上→下に時代が下る）。エンコーディング・本番実装バックログは `KINSHIP_SCHEMA.md` の可視化節を参照
- **凍結時の追加フィールド**: succession の `relationToPredecessor`・kinship の `childOrder`/`primaryLineage`・persons の `kana`/`section`/`yearsApproximate`（いずれも「調査時に同時取得しないと全員再訪問になる」表示要件由来の項目）
- **スキーマ**: `data/schema/KINSHIP_SCHEMA.md`（エッジ3種 succession/kinship/marriage・veracity 区分 verified/claimed/disputed・復位/建国の規約・調査フェーズ計画を含む）
- **CI**: `scripts/validate_kinship.py` を新設し `validate-data.yml` に組込済み。succession エッジの category は emperors.json の `accessionRoute.category` との整合を機械検証する
- **進捗管理**: kinship.json 側の `meta.status.phases`（succession/parentage/interdynastic/crosscheck の4フェーズ・現在すべて planned）と `meta.completedBlocks` で行う。このドキュメント冒頭のフェーズ進捗表（emperors.json 対応）とは別管理
- **コーパス下見（2026-07-22）**: 系譜「表」は china-history に無く daizhigev20 側にのみ存在（遼史皇族表・金史宗室表・明史諸王世表・元史/宋史の宗室世系表を確認済み）。新唐書宗室世系表は完全収録が未確認のため、着手時に書ごとに実在・可読性を確認すること

## 重要なファイル

- `data/emperors.json` — メインデータセット
- `data/kinship.json` — 系譜・即位経路グラフ（調査中・皇帝は emperors.json を id 参照）
- `data/schema/EMPERORS_SCHEMA.md` — JSON スキーマ参照
- `data/schema/INCLUSION_CRITERIA.md` — 収録基準（訪問者向け解説）
- `data/schema/DEATH_CAUSE_SCHEMA.md` — 死因スキーマ
- `data/schema/ADDITIONAL_SCHEMA.md` — その他のスキーマ
- `data/schema/KINSHIP_SCHEMA.md` — 系譜・即位経路グラフのスキーマ・収録基準・調査計画
