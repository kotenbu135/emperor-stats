# `data/emperors.json` スキーマ（現行 v2.0.0）

`data/emperors.json` の現行構造のリファレンス。現行 `schemaVersion` は `"2.0.0"`（2026-07-21、未使用の `sources.wikitextLines` を削除）。死因スキーマなど今後追加予定のフィールドは [DEATH_CAUSE_SCHEMA.md](DEATH_CAUSE_SCHEMA.md) を参照。

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
| `status` | object | 調査フェーズの進捗管理（下記） |
| `completedBlocks` | string[] | 在位データ調査が完了した王朝ブロック名の一覧（24ブロック。単純な文字列配列で、除外判断等の詳細は各人物レコードの `verification.notes` 側に記録） |

### `meta.status`

```json
"status": {
  "overall": "in-progress",
  "phases": {
    "reignData": { "status": "completed", "label": "在位データ（即位日・崩御日・在位期間）" },
    "deathCause": { "status": "not-started", "label": "死因" },
    "accessionRoute": { "status": "not-started", "label": "即位経路（世襲/簒奪/擁立/禅譲など）" },
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

### `dynasty`
| フィールド | 型 | 内容 |
|---|---|---|
| `name` | string | 王朝名（例: `"秦"`, `"劉宋"`） |
| `category` | string | `"正統"` / `"並立政権"` / `"正統（反乱・自称）"` の3値（`並立政権` は旧値 `十六国`。出典 wikitext 由来の内部値だったものを 2026-07-23 に実態語彙へ改名） |
| `section` | string | 出典 wikitext 上の見出し名 |

**将来のフィルタUIにおける同名王朝の区別について**: `梁`（蕭梁と隋末の梁師都政権）、`宋`（劉宋と元末の韓林児「宋」）、`呉`（三国の呉と五代十国の楊呉）、`夏`（十六国の赫連夏と元末の明玉珍「夏」）など、歴史上全く別の政権が同じ国号を名乗った例が365件中に複数存在する（王朝内の正統帝と反乱者・自称帝が同居するだけのケース＝`category`違いは別問題で、これは既に区別済み）。検証の結果、`(dynasty.name, dynasty.section)` の組み合わせであれば全件が政権単位で一意にグルーピングできることを確認済み（例: `("梁","南朝")`＝蕭梁 と `("梁","隋末群雄")`＝梁師都政権は別グループになる）。サイト実装時のフィルタUIは王朝名単体ではなく `name` + `section` の複合キーで選択肢を構成すること。表示ラベルは `section` を欧文修飾語的に添える（例:「梁（南朝）」「梁（隋末群雄）」）などで衝突を避けられる。

### `reigns[]`
在位期間の配列。複数回即位した人物（廃位後の復位など）は同一レコード内でここに複数要素を持つ（レコードは分けない）。各要素:

| フィールド | 型 | 内容 |
|---|---|---|
| `startYear` / `endYear` | number | 人間可読の西暦年。紀元前は `"前n年 → -n"` 変換（天文年ではない） |
| `dynastyOrder` | number | 王朝内での即位順（通し番号。復位も別カウント） |
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
| `selfProclaimed` | boolean | 自称・簒奪政権かどうか |
| `usedEmperorTitleFrom` | number | 皇帝号を使用開始した年。**歴史紀年ベース**（称帝時点の旧暦年に対応する西暦年。2026-07-22 規約確定）。旧暦十二月の称帝などでユリウス暦上の実日付が翌年1月になる場合、`reigns[0].startYear`（実日付の年）より1小さくなる（該当4件: liu-yong-liang・liang-houjing・beiwei-daowudi・beiqi-andewang-gaoyanzong）。それ以外は `startYear` と一致する（`validate_emperors.py` の `check_used_emperor_title_from()` で検証） |

### `sources`
| フィールド | 型 | 内容 |
|---|---|---|
| `wikidata` | string \| null | Wikidata QID（`Q` + 数字）。365人全員に付与済み（2026-07-21・SPARQL/jawiki記事名逆引き＋目視確認の3パス方式、詳細は docs/PROJECT_STATUS.md） |
| `cbdb` | null | 将来の CBDB（中国歴代人物伝記データベース）連携用。現状未使用 |

### `verification`
| フィールド | 型 | 内容 |
|---|---|---|
| `emperorTitleConfirmed` | boolean | 生前に皇帝号を使用した事実を確認済みか |
| `confidence` | `"high"` \| `"medium"` \| `"low"` | 情報源間で不一致が残る場合は `"medium"` とし `notes` に経緯を記す |
| `notes` | string | 判定根拠・情報源間の不一致・ユーザー承認済み事項などを自然文で記録 |

## 具体例

- 複数回即位（復位）: `jin-huidi`（司馬衷、八王の乱で廃位後に復位。`reigns` に2要素、`isRestoration: true` が2件目） — 詳細調査は [DEATH_CAUSE_SCHEMA.md](DEATH_CAUSE_SCHEMA.md) 側でも参照可能。
- 女性皇帝: `tang-wuzetian`（`flags.isFemale: true`）
- confidence medium の例: `liang-xiaozhuang`（即位月に日中情報源間で不一致が残り、ユーザー承認済みで medium 据え置き）

## 関連ドキュメント

- [INCLUSION_CRITERIA.md](INCLUSION_CRITERIA.md) — 収録・除外基準の詳細解説（サイト訪問者向け文章の元）
- [DEATH_CAUSE_SCHEMA.md](DEATH_CAUSE_SCHEMA.md) — 追加予定の死因スキーマ設計
- [ADDITIONAL_SCHEMA.md](ADDITIONAL_SCHEMA.md) — 死因以外の追加スキーマ設計（即位経路・改元・大赦・立后・皇太子廃立・遷都・親征・反乱鎮圧・被反乱・年齢）
