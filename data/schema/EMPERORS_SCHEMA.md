# `data/emperors.json` スキーマ（現行 v3.0.0）

`data/emperors.json` の現行構造のリファレンス。現行 `schemaVersion` は `"3.0.0"`（2026-07-29、Issue #22 のスキーマ改善＝時代・政権カタログの新設、全 enum の ID 化、`dynasty`・`flags.selfProclaimed` の廃止）。移行の設計と経緯は [docs/schema/V3_MIGRATION_PLAN.md](../../docs/schema/V3_MIGRATION_PLAN.md)。死因スキーマは [DEATH_CAUSE_SCHEMA.md](DEATH_CAUSE_SCHEMA.md) を参照。

**v3 の原則**: レコードは**安定 ID のみ**を持ち、日本語の表示ラベルは `meta.catalogs` にしか置かない。サイトはカタログを引くだけで表示でき、優先順位ロジックを持たない。

トップレベルは `meta`（データセット全体のメタ情報）と `emperors`（人物レコードの配列）の2キー。

## `meta`

| フィールド | 型 | 内容 |
|---|---|---|
| `title` | string | データセット名（例: `"中国皇帝統計データ"`） |
| `description` | string | 収録基準の要約文（人間が読む説明文） |
| `source.primary` | object | 主要典拠（`type`/`note`）。`type: "official-histories"`＝二十四史等の正史原典。個々の判定根拠は各レコードの `source` フィールド（書名・巻名・原文引用）に個別記載 |
| `source.inclusionListSeed` | object | 収録候補リストの初期洗い出しに使った参照（`type`/`page`/`url`/`retrieved`/`note`）。Wikipedia「中国帝王一覧」。データ値・調査メモ文章の典拠ではない |
| `source.supplementary` | string[] | 初期構築時に補助参照したページの記録（現在は全出典を正史原典へ差し替え済み） |
| `license` | object | 二重ライセンス構成。`license.data`＝データセットと調査メモ文章（CC BY 4.0、全文は `data/LICENSE`）、`license.code`＝リポジトリのコード（MIT、全文はルートの `LICENSE`）。各エントリは `name`/`spdx`/`url`/`scope`/`attribution`/`fullText` |
| `version` | string | データ内容の版（CalVer: `YYYY.MM`）。データの訂正・追加で上がる。構造の版 `schemaVersion` とは別軸。変更履歴はルートの `CHANGELOG.md` |
| `inclusionCriteria` | string[] | 収録基準の箇条書き（詳細な解説は [INCLUSION_CRITERIA.md](INCLUSION_CRITERIA.md)） |
| `reignDaysPolicy` | string | 在位日数の算出方針（`approxDays`/`exactDays`の定義、暦系の扱いなど）を自然文で説明 |
| `schemaVersion` | string | semver。スキーマに破壊的変更があれば上げる |
| `generatedAt` | string (`YYYY-MM-DD`) | データ最終更新日 |
| `count` | number | `emperors` 配列の件数（365件、手動同期） |
| `catalogs` | object | **v3 で新設**。`eras`（時代11区分）・`regimes`（政権89件）・`enums`（フィールドごとの ID→ラベル19種）。下記参照 |
| `status` | object | 調査フェーズの進捗管理（下記） |
| `completedBlocks` | string[] | 在位データ調査が完了した王朝ブロック名の一覧（24ブロック。単純な文字列配列で、除外判断等の詳細は各人物レコードの `verification.notes` 側に記録） |

### `meta.catalogs`（v3 で新設）

表示ラベルの唯一の置き場。レコード側は ID だけを持つ。

| フィールド | 内容 |
|---|---|
| `eras[]` | 時代区分11件。`id`（例 `sui-tang`）・`label`（隋・唐）・`labelEn`（未投入・null）・`sortOrder`。**調査ブロック（`researchSection`）とは独立**した、時代ジャンプ・並び順のための固定カタログ。時代は慣用区分で年代は排他区間ではない（北魏 399〜 は南北朝、遼 916〜 は宋遼金夏） |
| `regimes[]` | 政権89件。`id`・`name`（国号）・`label`（曖昧性のない表示名）・`labelEn`・`eraId`・`category`（`unified`／`divided`／`rebel`）・`startYear`/`endYear`・`sortOrder`・`dynastyOrderSurveyed` |
| `enums` | フィールド名 → `[{id,label,labelEn,description?}]` の19種（`regimeCategory`・`emperorStanding`・`accessionCategory`・軸6種・`relationToPredecessor`・`deathCause`・`confidence`・`datePrecision`、および kinship.json 用の5種 `kinshipPersonKind`・`kinshipInclusionReason`・`kinshipRelation`・`kinshipRelationDetail`・`kinshipSuccessionCategory`）。**ID はフィールド内で一意**（フィールドをまたぐ同名 ID は別物） |

`regimes[].startYear`/`endYear` は**表示用のヒントであって権威ある区間ではない**（唐 618〜907 の内側に武周 690〜705 が入るなど入れ子・重複しうる）。

`dynastyOrderSurveyed: false` の政権（51件）は `reigns[].dynastyOrder` が全て null ＝第N代が未確定。**サイト側で在位順から推論しないこと**（悉皆調査は別 Issue）。

### `meta.status`

```json
"status": {
  "overall": "in-progress",
  "phases": {
    "reignData": { "status": "completed", "label": "在位データ（即位日・崩御日・在位期間）" },
    "deathCause": { "status": "not-started", "label": "死因" },
    "accessionRoute": { "status": "not-started", "label": "即位経路（4軸＋2補助の多軸構造。表示ラベルは世襲/擁立/受禅（易姓）など）" },
    "eraChangeCount": { "status": "not-started", "label": "改元回数" },
    "amnestyCount": { "status": "not-started", "label": "大赦回数" },
    "empressInstallationCount": { "status": "not-started", "label": "立后（皇后冊立）回数" },
    "crownPrinceDepositionCount": { "status": "not-started", "label": "皇太子廃立回数" },
    "capitalRelocationCount": { "status": "not-started", "label": "遷都回数" },
    "personalCampaignCount": { "status": "not-started", "label": "親征回数" },
    "rebellionSuppressionCount": { "status": "not-started", "label": "反乱鎮圧回数" },
    "rebellionSufferedCount": { "status": "not-started", "label": "被反乱回数" },
    "ages": { "status": "deferred", "label": "即位時年齢・没年齢", "note": "見送り理由の注記" }
  }
}
```

- `overall`: `"in-progress"` の間はデータ未確定。サイト実装には着手しない（CLAUDE.md 参照）。2026-07-18に全12フェーズが364人全員完了し `"completed"` に更新済み。
- 各 `phases.<key>.status`: `"not-started"` / `"in-progress"` / `"completed"` / `"deferred"`（見送り）。
- `deferred` の場合のみ `note` で見送り理由を記録する（例: `ages` は生年不明な人物が多く悉皆調査に向かないため見送り）。

## `emperors[]`（人物レコード）

各要素は以下の構造を持つ。

### `id`
kebab-case の一意識別子。例: `"qin-shi-huang"`, `"liu-song-wudi"`。

### `name`
| フィールド | 型 | 内容 |
|---|---|---|
| `personalName` | string \| null | 諱（本名） |
| `commonName` | string | 一般に知られる呼称（表示名として使用・非null必須）。廟号・諡号を持たない皇帝は諱をそのまま用いる（例: 曹芳・赫連昌） |
| `aliases` | string[] | 別名・異表記 |
| `posthumousName` | string \| null | 諡号 |
| `templeName` | string \| null | 廟号 |
| `regnalTitle` | string | 常に `"皇帝"`（収録基準そのもの） |

### 所属（`eraId` / `regimeId` / `researchSection` / `standing`）— v3

旧 `dynasty`（`name`/`category`/`section`）は v3 で解体した。

| フィールド | 型 | 内容 |
|---|---|---|
| `eraId` | string | 所属時代。`meta.catalogs.eras` の ID。`regimes[regimeId].eraId` の非正規化コピーで、一致はバリデータが担保する |
| `regimeId` | string | 所属政権。`meta.catalogs.regimes` の ID。同名国号（梁・宋・呉・夏など）を含めて**一意**。国号・表示名・政権の性格はカタログ側にある |
| `researchSection` | string | 調査ブロック名（旧 `dynasty.section`）。[SOURCE_MAPPING.md](../../docs/process/SOURCE_MAPPING.md) の索引キーで、**表示用の時代区分ではない** |
| `standing` | string | `"regular"`（その政権の歴代皇帝）／`"rival"`（同じ政権の正統な帝統の外側で帝号を称した対立・僭称。多くは歴代皇帝と在位が並立するが、帝統が絶えた後に亡命先・残存勢力で称した例も含む）。365人中 rival は20人。**帝紀の有無は傍証であって判定基準ではない**（2026-08-02・Issue #35。定義の全文と根拠は [INCLUSION_CRITERIA.md](INCLUSION_CRITERIA.md)） |

**旧 `dynasty.category` を2つに割った理由**: 旧値は「政権の性格」と「その人の称帝経緯」が混在しており、「反乱・自称政権」45人の中に明成祖（永楽帝）・清太宗・後唐荘宗・金世宗・南宋端宗など**その政権の正規の皇帝**が多数含まれていた。v3 では政権の位置づけを `regimes[].category` に、人物の位置づけを `standing` に分離し、即位の経緯は `accessionRoute` が担う（`category` の3値は 2026-08-01 に「中華を統一していたか」の軸へ入れ替えた。判定基準は [INCLUSION_CRITERIA.md](INCLUSION_CRITERIA.md) の「政権区分の判定基準」節）。判定の詳細は [V3_MIGRATION_PLAN.md](../../docs/schema/V3_MIGRATION_PLAN.md) §5。

**同名国号の区別**: `梁`（蕭梁・隋末の梁師都政権・隋末の蕭銑政権の三者）・`楚`（隋末の林士弘政権と朱粲政権・唐の李希烈「楚」）・`宋`（劉宋と元末の韓林児「宋」）・`呉`（三国の呉と五代十国の楊呉）・`夏`（十六国の赫連夏と元末の明玉珍「夏」）など、全く別の政権が同じ国号を名乗る例が複数ある。v3 では `regimeId` が一意なのでフィルタUIはこの ID で構成し、表示は `regimes[].label`（例:「梁（蕭梁）」「梁（梁師都）」「梁（蕭銑）」）を使う。

**同じ調査ブロック内の同名国号も別政権として立てる**（2026-07-31・Issue #27）: v3 移行時、regimes は旧 `dynasty` の `(name, section)` 複合キーから機械的に導出したため、**同じ `researchSection` 内で同じ国号を名乗った別勢力が1つの `regimeId` に合併していた**。隋末群雄の「梁」（梁師都＝夏州朔方・建元永隆／蕭銑＝後梁蕭氏の後裔・江陵）と「楚」（林士弘＝虔州・建元太平／朱粲＝冠軍・建元昌達）の2組4人が該当し、旧唐書 巻五十六で出自・拠点・元号がいずれも別と確認のうえ `xiaoxian-liang`・`zhucan-chu` を新設して分割した。**国号が同じでも継承関係のない勢力は `regimeId` を分ける**（`regimes[].startYear`/`endYear` が両勢力の合併区間になる・王朝別集計が混ざる）。

### `reigns[]`
在位期間の配列。複数回即位した人物（廃位後の復位など）は同一レコード内でここに複数要素を持つ（レコードは分けない）。各要素:

| フィールド | 型 | 内容 |
|---|---|---|
| `startYear` / `endYear` | number | 人間可読の西暦年。紀元前は `"前n年 → -n"` 変換（天文年ではない）。**実日付（太陽暦）の年を採る**（2026-07-22 規約確定・`validate_emperors.py` の `check_reigns()` が `startDate`/`endDate` の年と一致を要求）。旧暦十二月の即位のように実日付が翌年1月へ食い込む場合も太陽暦年に合わせ、**旧暦年（通説の「403年即位」など歴史紀年）は `flags.usedEmperorTitleFrom` と `raw`・`startDateRaw` が保持する**（該当6件は `usedEmperorTitleFrom` の欄を参照）。この向きは Issue #44 で再確認済みで、再提案しない |
| `dynastyOrder` | number \| null | 王朝自身が数える歴代の通し番号（復位も別カウント）。**その王朝の正史が帝紀を立てた君主**を歴代とし、皇帝を称さなかった君主（前涼の涼王・北周の孝閔帝＝天王など）も番号に含めるため、365人の収録者だけを数えた値とは一致しないのが普通。歴代に数えない在位（宋の元凶劭・梁の蕭正徳・北魏の南安王余など、帝紀を立てられていない僭称・並立の在位）は `null`。**同じ王朝に1つでも調査済みの値があれば、その王朝の `null` は「歴代に数えない」の意**（サイト側は第N代を表示しない）。王朝の全在位が `null`（＝未調査）の場合のみ在位開始順から機械導出した値を表示する |
| `isRestoration` | boolean | 復位（廃位後の再即位）かどうか |
| `note` | string | 即位・退位の経緯を自然文で記述（死因の手がかりが記されている場合もある） |
| `raw` | string | 元wikitext上の期間表記そのまま |
| `durationRaw` | string \| null | 元表記の在位年数（例: `"11年"`） |
| `startDate` / `endDate` | string (ISO8601) \| null | 特定できた範囲でのISO日付。不明部分は `null` |
| `startDateRaw` / `endDateRaw` | string | 日付根拠になった原文表記（和暦・干支月日など） |
| `datePrecision.start` / `.end` | `"year"` \| `"month"` \| `"day"` | 実際に確認できた精度 |
| `duration.value` / `.unit` | number / string | 判明した精度での在位量（例: `11`年、`3890`日） |
| `duration.approxDays` | number | 年=365/月=30/週=7/日=1 換算の概算共通尺度（グラフ用主軸、常に算出） |
| `duration.exactDays` | number \| null | 両端が `day` 精度のときのみ算出。それ以外は `null` |
| `duration.needsPreciseDays` | boolean | `exactDays` が未確定なら `true` |
| `duration.source.page` / `.lang` / `.note` | string | 参照ページ（正史の巻名）・言語・注記 |
| `duration.source.quote` | string | 即位・退位の日付根拠になった正史原文の直接引用（即位／退位を `／` で区切る）。task.md 3-1 フェーズBで新設 |
| `duration.source.conversion` | string | 旧暦（干支日）→西暦の換算典拠と、既存日付との照合結果。正史に日次記述がない場合はその旨を書く。task.md 3-1 フェーズBで新設 |

### `reignSummary`
全 `reigns` の合算値。

| フィールド | 型 | 内容 |
|---|---|---|
| `totalReignDuration.approxDays` | number | 全 `reigns` の `approxDays` 合計 |
| `totalReignDuration.displayYears` | number | 表示用の年数換算（小数可） |
| `totalReignDuration.needsPreciseDays` | boolean | いずれかの `reigns` で未確定なら `true` |
| `totalReignDuration.isExact` | boolean | 全 `reigns` の `exactDays` が確定していれば `true` |
| `firstStartYear` | number | 最初の即位年 |
| `lastEndYear` | number | 最後の退位/崩御年 |
| `reignCount` | number | `reigns` 配列の要素数（複数回即位なら2以上） |

### `flags`
| フィールド | 型 | 内容 |
|---|---|---|
| `isFemale` | boolean | 皇帝を称した女性（例: 武則天）を示す |
| `usedEmperorTitleFrom` | number | 皇帝号を使用開始した年。**歴史紀年ベース**（称帝時点の旧暦年に対応する西暦年。2026-07-22 規約確定）。旧暦十二月の称帝などでユリウス暦上の実日付が翌年1月になる場合、`reigns[0].startYear`（実日付の年）より1小さくなる（該当6件: wang-mang・liu-yong-liang・huan-xuan・liang-houjing・beiwei-daowudi・beiqi-andewang-gaoyanzong）。それ以外は `startYear` と一致する（`validate_emperors.py` の `check_used_emperor_title_from()` で検証） |

### `sources`
| フィールド | 型 | 内容 |
|---|---|---|
| `wikidata` | string \| null | Wikidata QID（`Q` + 数字）。365人全員に付与済み（2026-07-21・SPARQL/jawiki記事名逆引き＋目視確認の3パス方式、詳細は docs/QA_HISTORY.md） |
| `cbdb` | null | 将来の CBDB（中国歴代人物伝記データベース）連携用。現状未使用 |

### `verification`
| フィールド | 型 | 内容 |
|---|---|---|
| `emperorTitleConfirmed` | boolean | 生前に皇帝号を使用した事実を確認済みか |
| `confidence` | `"high"` \| `"medium"` \| `"low"` | 情報源間で不一致が残る場合は `"medium"` とし `notes` に経緯を記す |
| `notes` | string | 判定根拠・情報源間の不一致・ユーザー承認済み事項などを自然文で記録 |

**v3 で `selfProclaimed` を廃止した**: 旧 `dynasty.category` とも `accessionRoute.axes` とも整合しておらず（前者と81件不一致、`true` かつ `throneSource=前代君主から継承` が57件）、同じ情報は `axes.throneSource`＋`axes.procedure`＋`standing` で表現できる。

## `note` と `claim`（2026-08-03・Issue #43）

`note` は**作業ログ**です。訂正の経緯として「現行 X → Y に訂正」のように**捨てた側の値**が
本文に残るため、**フィールドとの突合は向きが反転します**。散文は witness になりません
（Issue #40 の G2/G3 の当初案が測定で否定されたのがこの経路で、#33・#36 の食い違いも全部この形）。

そこで、同じコンテナに置ける**任意**の欄として `claim` を足しました。

| | `note`（従来どおり） | `claim`（任意・新規） |
|---|---|---|
| 何を書くか | 作業ログ。判定の根拠・**捨てた側の値**・訂正の経緯・保留の理由・**原文引用** | **いま正しいと判断している内容だけ**を前向きに書いた1〜2文 |
| 向き | 反転する（過去の値が本文に残る） | 反転しない |
| 原文引用 | ここに書く | **書かない**（`verify_quotes.py` の抽出対象は `note` と `quote` だけなので、`claim` の引用は照合台帳を素通りする） |
| 件数の書き方 | 自由 | **算用数字**（`count` と機械照合する） |
| サイト表示 | 出る（note をサイトに出さない案は Issue #39 で「対応しない」と決定） | 出さない |

置ける場所は**判定の単位**にあたる8つの `$defs` だけです —
`reign`・`deathCause`・`accessionRoute`・`ages`・`datedEventCount`・
`capitalRelocationCountObject`・`campaignCountObject`・`rebellionCountObject`。
`events[]` の各要素には置きません（`date`／`outcome`／`target`／`leader` という構造フィールド自身が
その event の witness なので、主張欄は重複になる）。`source` にも置きません
（出典帰属の経緯であってフィールド値の主張ではない）。

### 遡及しない

既存の note は 10,912 件あり、**書き足すのは新しく書く note にだけ**です。したがって:

- **`claim` が無いことは「根拠が無い」を意味しません。** 無いのが既定です
- **`coverage.py` は `claim` を確定の根拠にしません**（`absent` の根拠にもしない）。
  進捗は構造フィールドで測ります
- 突合ゲート（`validate_emperors.py` の `check_claim_fields`）は **`claim` を持つコンテナだけ**を
  評価し、**評価件数を `INFO` で必ず出します**。0 エラーが「守れている」なのか
  「そもそも何も見ていない」なのかを区別するためです。検出力そのものは
  `python3 scripts/test_claim_field.py` が合成レコードで測ります

### 機械が見ること

- `claim` に作業ログの印（`訂正`・`現行`・`旧値`・`→`・`->`）が出たらエラー。**印は史実の日本語と衝突しない語だけ**にしてある — 「に改め」「差し替え」「から変更」は改元・遷都・皇太子廃立の主張そのものに出る自然な語なので入れない（最初に claim を書いた人が誤検出に当たると「このゲートは壊れている」と結論する）
- `claim` に原文引用らしいスパン（かな無し・漢字6字以上の `「…」`）が出たらエラー
- 同じコンテナに `count` があるとき、その数が算用数字で `claim` に出なければエラー
  — **これがフィールドとの突合そのもの**です（存在検査なので弱い witness ですが、向きは反転しません）

`deathCause.category` のような enum は日本語の `claim` に ID が現れないので、機械照合はありません。
そこは人が読む前提の前向きな記述です。

## `conflicts` — 史料対立の置き場（2026-08-03・Issue #51 P3）

原典同士が食い違うとき、いままでは**気づいた調査者が note の散文に書く**しかありませんでした。
書かなければ「気づかなかった」のか「対立が無い」のかを区別できず、**空欄が検出できない**。
一方、調査エージェントの出力契約（[CLAIMS_CONTRACT.md](../../docs/process/CLAIMS_CONTRACT.md)）には
`conflicts[]` が最初からあります。**受け皿がデータ側に無かっただけ**なので、`note`・`claim` と
同じ位置に任意の `conflicts` 配列を置きます。

```json
"ages": {
  "deathAge": 47,
  "confidence": "medium",
  "conflicts": [
    {
      "field": "deathAge",
      "adopted": {"value": 47, "source": {"page": "晋書 載記第二十一"},
                  "quote": "时年四十七，在位一年"},
      "alternatives": [
        {"value": 38, "source": {"page": "華陽国志 巻九"}, "quote": "年二十六，立为太子",
         "note": "永昌元年（322年）の太子冊立を年二十六とするため崩御時は数え38歳になる（逆算値）"}
      ],
      "reason": "晋書載記と十六国春秋がともに「时年四十七」と直接記す。華陽国志の38は逆算で直接記載ではない"
    }
  ]
}
```

| 欄 | 必須 | 中身 |
|---|---|---|
| `field` | ○ | **同じコンテナ内**のフィールド名。どの値が割れているか |
| `adopted` | ○ | 採用値。`value` と `source` は必須で、`quote` は原文があるなら書く。**採用側にも出典を持たせる** — 片側だけだと「採用した」と「書き忘れた」が区別できない |
| `alternatives[]` | ○（非空） | 採らなかった値。各要素に `value` と `source`。`quote`・`note` は任意 |
| `reason` | ○ | **なぜその値を採ったか**。これが無いと対立を書いた意味がない |

置ける場所は `claim` より広く、**`events[]` の各要素にも置けます**。個々の事件の日付が史料で
割れる形が実在し（Issue #50）、`events[].date` は `reigns` と違って `raw`・`conversion` を
持たないので、対立を書く場所が他にありません。

**`accessionRoute.axes` の中にも置けます**（2026-08-03・Issue #53）。`field` は同じコンテナに
実在するフィールド名でなければならないので、続柄（`relationToPredecessor`）のように
**軸の中にしか実フィールドが無い**対立は、`accessionRoute` の直下に置くと落ちます。
実例は曹髦（`wei-caomao`）— 正史本文が曹芳の実父を伝えず、実父を任城王曹楷とするのは
裴注引『魏氏春秋』の「或云」にとどまるため、法的系統（明帝の養子）で数えて `cousin` を採り、
血縁系統で数えた `distant-kin` を `alternatives` に置いています。

### 「対立なし」と「未確認」を区別する

| 状態 | 書き方 |
|---|---|
| 確認して対立が無い | `"conflicts": []` |
| 対立がある | `"conflicts": [ … ]` |
| **未確認**（既存データはすべてこれ） | **キー自体を置かない** |

Issue #43 の「**測れない**」と「**書き忘れた**」を区別する形で null を置く、と同じ考え方です。
`claim` と同じく**遡及しません** — `conflicts` が無いことは対立の不在を意味せず、
`coverage.py` は `conflicts: []` を確定の根拠にしません。

### 機械が見ること（`validate_emperors.py` の `check_conflicts`）

- 構造だけを見ます。**「対立を書け」というゲートは作りません** — 書かれていないことが
  「気づかなかった」なのか「無い」なのかは機械では決まらないからです
- `field` が同じコンテナに実在しない／`reason` が空／`adopted` に `value`・`source` が無い／
  `alternatives` が空／対立値が採用値と同じ、はエラー
- **`adopted.value` が実フィールドの値と食い違ったらエラー** — 採用値を訂正したときに
  `conflicts` が置き去りになる形を止めます
- `conflicts` を持つコンテナの件数を `INFO` で出します（0 エラーが「守れている」なのか
  「そもそも何も見ていない」なのかを区別するため）。検出力そのものは
  `python3 scripts/test_conflicts_field.py` が合成レコードで測ります（`claim` と同じ扱い）
- **`quote` には引用の取り扱い規約の全項が掛かります**。`verify_quotes.py` が
  `conflicts[].adopted.quote`・`alternatives[].quote` を抽出対象に含めるので、
  底本の字体のまま書き、手打ちしない（`claim` に引用を書かないのとは逆で、ここは書く場所です）

## `events` の原表記と換算（2026-08-03・Issue #56）

回数系8フィールドの `events[]` に、`reigns` が前から持っていた2つを足しました。**どちらも
任意で、既存の約2,000件には遡及しません**（R-NO-AUTOGEN のため機械では埋められない）。

| 欄 | 中身 |
|---|---|
| `dateRaw`（単一日付型）<br>`startDateRaw`／`endDateRaw`（期間型） | 原典の紀年表記そのまま（「建武二年秋八月」「建徳五年十月己酉」） |
| `source`（`$defs/source`） | `page`・`quote`・`conversion` を置ける。`conversion` に換算の経路を書く |

### なぜ足したか

`events` には原表記が無かったため、**保存された太陽暦の値が「旧暦の月番号を直書きしたもの」か
「換算済み」かを機械で区別できませんでした。** Issue #56 で親征イベントの終期42件を原典へ
当て直したところ24件が誤りで、最多の型がこれでした（西夏襄宗の `1211-05` は旧暦五月の直書きで、
旧暦五月＝1211-06-13〜07-11 は西暦5月と1日も重ならない）。Issue #34 で1,937件を換算したときも、
この型は原表記が無いせいで母集団に入りませんでした。

### 書き方（`conversion`）

**記法は `reigns` と同じ `fromLunar(y, m, d[, leap])` 1つだけです。** 月精度のときは
**朔日アンカー `fromLunar(y, m, 1)`** を書きます。

```
"conversion": "明史 英宗前紀 正統十四年七月甲午 発京師 fromLunar(1449,7,16) → 1449-08-04、
               八月壬戌 師潰 fromLunar(1449,8,15) → 1449-09-01"
"conversion": "西夏書事 嘉定四年夏五月 fromLunar(1211,5,1) → 1211-06（多数月）"
```

### 機械が見ること（`verify_calendar.py` の B-5）

- `fromLunar(y,m,d)` を**再演**し、結果が `conversion` 本文の `→YYYY-MM-DD` 主張か
  保存日付に一致するかを見ます
- **`d` が 1（朔日アンカー）のときは月精度の主張として扱い**、その旧暦月の**多数月**を計算して
  `→YYYY-MM` か保存された月精度の値と照合します。**旧暦の月番号を直書きした値はここで落ちます**
- 検査件数を `B5=…` で必ず出します（**当面 0 件なので、0 エラーを「守れている」と読まないため**）。
  発火そのものは `python3 scripts/test_event_conversion_gate.py` が合成レコードで測ります
- **`quote` を書くなら引用の取り扱い規約の全項が掛かります**（底本の字体のまま・手打ち禁止）

## 具体例

- 複数回即位（復位）: `jin-huidi`（司馬衷、八王の乱で廃位後に復位。`reigns` に2要素、`isRestoration: true` が2件目） — 詳細調査は [DEATH_CAUSE_SCHEMA.md](DEATH_CAUSE_SCHEMA.md) 側でも参照可能。
- 女性皇帝: `tang-wuzetian`（`flags.isFemale: true`）
- confidence medium の例: `liang-xiaozhuang`（即位月に日中情報源間で不一致が残り、ユーザー承認済みで medium 据え置き）

## 関連ドキュメント

- [INCLUSION_CRITERIA.md](INCLUSION_CRITERIA.md) — 収録・除外基準の詳細解説（サイト訪問者向け文章の元）
- [DEATH_CAUSE_SCHEMA.md](DEATH_CAUSE_SCHEMA.md) — 追加予定の死因スキーマ設計
- [ADDITIONAL_SCHEMA.md](ADDITIONAL_SCHEMA.md) — 死因以外の追加スキーマ設計（即位経路・改元・大赦・立后・皇太子廃立・遷都・親征・反乱鎮圧・被反乱・年齢）
