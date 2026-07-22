# Changelog

データ内容の変更履歴です。版は `meta.version`（CalVer: `YYYY.MM`）で管理します。構造（スキーマ）の変更は `meta.schemaVersion`（semver）で別軸管理し、ここには構造変更も注記として併記します。

## 2026.07 (2026-07-21)

データ内容の版管理を開始した初版です。以下は開始までの主要な変更の遡及記録を含みます。

### 訂正（2026-07-22）

- **exactDays 系統誤差19件を実経過日数へ訂正**（note 全件検証・包括的データチェックの検出分）: 在位日数がユリウス暦ラベルへのグレゴリオ式算術で計算されており、ユリウス暦の閏世紀日（100の倍数年の2月29日）をまたぐ18件が1日不足（han-gaozu・han-wudi・hou-han-hedi・hou-han-xiandi・jin-huidi・qi-donghunhou・beiwei-xuanwudi・sui-wendi・tang-zhaozong・tang-wuzetian・beisong-zhenzong・beisong-huizong・liao-shengzong・liao-daozong・xixia-chongzong・yuan-chengzong・ming-huizong・ming-xiaozong 各+1日）、ming-shenzong が1582年グレゴリオ改暦の10日スキップ無視で10日過大（17562→17552）。`duration.value`/`approxDays`/`reignSummary.totalReignDuration` を連動再計算。再発防止として `scripts/verify_calendar.py`（ユリウス/グレゴリオ JDN による実経過日数ゲート）を CI に追加済み
- **liao-jingzong（遼景宗）即位日 0969-03-13→03-12**: 遼史本紀八は即位を己巳（穆宗遇弑当日）条内に記述しており、conversion 自身が検出していた1日ズレを原文干支換算どおりに解消（exactDays 4962→4963 連動）
- **引用の転記誤字・圧縮改変・帰属誤り22件を訂正**（note 全件検証 6,504 件の検出分）: 一字誤記12件（駆遣→驰遣・惼→惧・聚義/率眗→聚众/率众・燈王/袲之→燕王/袭之・蕭謐→萧谌・弋樂→弋猎・李賛→李赟・上伐燕京の文融合・曲賜→曲赦・为害→所害・絶興→绍兴/大慶→大德・博楽→博罗）、圧縮・改変引用6件（成漢李勢・公孫述・蜀漢劉禅・唐武宗・陳後主・西夏景宗の人名版本統一）、出典帰属2件（隋楊浩「令发诏画敕书而已」は資治通鑑・陳後主「与其子弟日饮一石」は南史/通鑑で陳書に無し）、実在しない引用1件（東晋元帝 deathCause の「敦既得志…」はコーパスに該当文なしのため引用体裁を廃し、実在する晋書帝紀の崩御記事引用に差し替え）。すべて `quote_helper`/grep のコーパス出力から逐語コピーで再取得し、照合台帳 `data/quote-refs.json` の defect エントリ22件を全件消化（現在 defect 0件）
- **換算記録の同期漏れ3件**: liang-xiaoyuanming conversion の fromLunar 引数誤記（(555,9,22)→(555,9,27)）と「南史・梁書とも3日間一致」の誤記述、tangmo-shisiming ages.note の旧日付残存（0761-04-18→04-22 同期）
- **ages.note「null とした」と値の矛盾9件（7人）を note 側訂正**: beisong-shenzong・beisong-zhezong・nansong-duzong・liao-taizong・jin-taizu・jin-shizong・yuan-wuzong。全件、直接記載の生年（＋没年齢等の独立アンカー）からの年号年ラベル差分逆算（ADDITIONAL_SCHEMA 10節）として立証できることを個別確認し、値を維持して note を逆算根拠の明記に訂正（後続パスで値を埋めた際の note 同期漏れだった）。再発防止として `validate_emperors.py` に `check_note_value_sync()` を追加済み
- **ages precision 不整合2件**: sui-wendi birthDate 0541-06→0541-07-21（大統七年六月癸丑の sxtwl 換算・同月内で干支一意）、jin-shizong deathDate 1189-01→1189-01-20（大定二十九年正月癸巳、reigns.endDate と一致）。いずれも precision=day に対して月までしか入っていなかった値を日精度化
- **chen-feidi（陳廃帝）の没年齢矛盾を原典再確認**（task.md 0-3）: 生年554年（梁承聖三年五月庚寅生）と没年齢19歳（「時年十九」＝数え年17とズレ）の矛盾は『陳書』卷四・『南史』卷十・『建康実録』の3書共通で原典由来と確定。生年552年説は逆算のみで直接記載なし（同母弟・伯茂の「時年十八」〔『陳書』卷二十八〕は年齢記載側を支持する傍証）。直接記載2値をそのまま採録し `ages.note` に矛盾を明示・`confidence` を medium へ変更（値の変更なし）
- **データ構造の不統一を解消**（task.md 0-3、判定を伴わない構造是正）: nanming-zongzong 大赦1件の `date` 欠落補完（隆武二年六月→1646-07）・反乱系 events の `name` キー欠落28件に `name: null` 付与・houzhao-shishi の `ages.confidence` 補完（medium）・qin-shi-huang/qin-er-shi の `displayYears` を標準換算（÷365.25・1桁丸め）へ統一（11→10.7・2→3.0、`KNOWN_DISPLAY_YEARS` 許容リスト空に）・han-xuandi 立后3件の `datePrecision` を `day（干支のみ：…、グレゴリオ暦未換算）` 形式へ是正
- **BCE イベント日付の年規約統一 105件**（task.md 0-2）: 前漢の `events[].date`（改元・大赦・立后・皇太子廃立）に歴史年直記（前n年 → `-n`）が混在していたのを、`reigns` と同じ ISO 8601 天文年（前n年 → `-(n-1)`）に統一。レビュー時の見立て（8件）より実際の対象は大きく、BCE イベント全127件中105件を訂正（han-gaozu・han-chengdi の大半は入力時から天文年で正しかった＝混在の実態）。恵帝2件（惠帝四年＝前191年）・後少帝2件（高后六年＝前182年・八年＝前180年、呂后崩御は干支換算で 180BC-08-18 の日精度に確定）・成帝鴻嘉（鴻嘉元年＝前20年、3年ズレ）は原典キャッシュで個別確認のうえ訂正。漢初（太初改暦前）の冬十月〜十二月イベントは実ユリウス年側を採用（規約は `data/schema/ADDITIONAL_SCHEMA.md` に明文化）。成帝陽朔の改元は note で年が判明済みなのに `date: null` だったため `-0023` を付与
- 再発防止として `scripts/validate_emperors.py` に `check_bce_event_years()` を追加（在位 ISO 年範囲チェック＋note「前n年」明記との突合。訂正前データで16件検出・訂正後0件を回帰確認済み）
- **`flags.usedEmperorTitleFrom` の旧値残存3件を訂正**（task.md 0-2）: qianzhao-liuyuan 309→308（晋書載記「永嘉二年、僭即皇帝位」）・suimo-liangshidu 618→617（大業十三年称帝）・yuanmo-mingyuzhen 1363→1362（明史列伝「二十二年春僣即皇帝位」）。いずれもフェーズB在位訂正時の同期漏れで、原典キャッシュで個別確認のうえ訂正。あわせて同フィールドの規約を「歴史紀年ベース（旧暦年またぎの十二月称帝等では `reigns[0].startYear` より1小さくなる。該当4件は正当）」と確定し `data/schema/EMPERORS_SCHEMA.md` に明文化、`validate_emperors.py` に `check_used_emperor_title_from()` を追加（訂正前データで3件検出を回帰確認済み）
- **`reignSummary.totalReignDuration` の同期漏れ9件を再計算**（task.md 0-1）: フェーズBの日付訂正時に `reigns[].duration` 側のみ更新され summary 側が旧値のまま残っていた han-wudi・han-zhaodi・han-xuandi・han-yuandi・wei-wendi・wei-caomao・shuhan-zhaoliedi・shuhan-liushan・nansong-ningzong の `approxDays`/`displayYears` を `reigns` の合計から再計算（最大 366 日のズレ）。shuhan-liushan は reigns 側の月精度格下げ済みに対し summary が `isExact: true` のままだった内部矛盾も解消（`isExact: false`・`needsPreciseDays: true` へ）
- 再発防止として `scripts/validate_emperors.py` の `check_reign_summary()` に totalReignDuration 検証（approxDays 合計・isExact/needsPreciseDays・displayYears 年換算）を追加

### 追加・変更（2026-07-21）

- **ライセンス確定**: データ・調査メモ文章を CC BY 4.0、コードを MIT の二重ライセンス構成として宣言（`meta.license` 新設・`data/LICENSE` 配置）
- **`meta.version`（CalVer）新設**、`meta.source` を再定義（primary＝正史原典、Wikipedia「中国帝王一覧」は収録候補リストの初期洗い出し用として位置づけを明確化）
- **在位期間出典の正史差し替え完了**: `reigns[].duration.source` 全365人・約350件を Wikipedia 由来から正史原典（書名・巻名・原文引用・暦換算つき）へ差し替え。過程で旧暦→西暦換算誤り等の日付訂正を約90件実施（詳細は `meta.reignDurationSourceBlocks`）
- **CC BY-SA 混入スクリーニング**: 全 note 約126万字を jawiki 記事本文と突合し、近似一致の3名4箇所（西燕慕容永・更始帝・夏赫連昌）を原典準拠の表現に書き換え
- **`ages` 生没日付の ISO 正規化**（62件のゼロ埋め・旧暦月転記の補正）
- 構造変更: `schemaVersion` 2.0.0 — 未使用の `sources.wikitextLines` をフィールドごと削除、`reigns[].duration.source` に `quote`/`conversion` を正式追加
- 配布 CSV に `wikidataId` 列を追加（40→41列。全365行に Wikidata QID を収録）

### 追加（2026-07-20）

- **唐哀帝（`tang-aidi`）を追加収録**: 収録漏れが判明したため原典調査のうえ追加。収録数 364 → **365人**

### 初版（2026-07-18）

- 全12項目 × 364人の調査完了（`meta.status.overall: "completed"`）
