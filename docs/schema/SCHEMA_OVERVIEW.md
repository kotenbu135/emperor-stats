# スキーマ参照ガイド

## emperors.json のスキーマ

詳細な型・値域・具体例は **[data/schema/EMPERORS_SCHEMA.md](../../data/schema/EMPERORS_SCHEMA.md)** を参照してください。

**スキーマに触れる作業の前に必ず読むこと**（新フィールド追加・既存フィールドの解釈確認）

スキーマを変更した場合は `CLAUDE.md` と合わせて更新します。

## トップレベル構造

```json
{
  "meta": { ... },
  "emperors": [ ... ]
}
```

### `meta` — データセット全体のメタ情報

収録基準・進行状況・完了ブロック一覧を含みます。

### `emperors` — 人物レコードの配列

## 人物レコード（概要）

詳細は [data/schema/EMPERORS_SCHEMA.md](../../data/schema/EMPERORS_SCHEMA.md) を参照してください。

### 基本フィールド

- **`id`**: kebab-case の一意識別子
  - 例: `qin-shi-huang`, `liu-song-wudi`
- **`name`**: 複数の名前形式
  - `personalName`: 諱
  - `commonName`: 一般に知られる呼称
  - `aliases`: 別名
  - `posthumousName`: 諡号
  - `templeName`: 廟号
  - `regnalTitle`: 常に `"皇帝"`
- **`dynasty`**: 王朝情報
  - `name`: 王朝名
  - `category`: `正統` / `十六国` / `正統（反乱・自称）` など
  - `section`: wikitext 上の見出し

### 在位期間: `reigns` 配列

複数回即位した場合は複数要素。各要素：

- **`startYear`/`endYear`**: 人間可読の西暦年
  - 例: 前221年 → `-221`
  - **紀元前の変換**: "前n年 → -n"（天文年ではない）
  - ISO 日付文字列を組み立てる内部処理でのみ天文年（前n年 → -(n-1)）を使用

- **`startDate`/`endDate`**: ISO 8601 形式
  - 例: `"-0210-09-10"`
  - 日付が特定できない部分は `null`

- **`datePrecision.start`/`.end`**: 実際に確認できた精度
  - `"year"` / `"month"` / `"day"` のいずれか
  - 正直に記録します（推測で精度を上げません）

- **`duration`**: 在位期間の長さ
  - `approxDays`: 年=365/月=30/週=7/日=1 換算の概算共通尺度（グラフ用の主軸）
  - `exactDays`: 両端が `day` 精度のときのみ算出、それ以外は `null`
  - `needsPreciseDays`: `exactDays` が未確定なら `true`
  - `source`: 参照ページ・言語・注記

- **`isRestoration`**: boolean
  - 復位（廃位後の再即位）かどうか

### 在位期間の集計: `reignSummary`

全 `reigns` の合算：
- `totalReignDuration`
- `firstStartYear`
- `lastEndYear`
- `reignCount`

### フラグ: `flags`

- `isFemale`: 女性かどうか
- `selfProclaimed`: 自称・簒奪政権かどうか
- `usedEmperorTitleFrom`: 皇帝号の使用開始時期

### 出典: `sources`

- `wikitextLines`: 一覧 wikitext 内の行番号
- `wikidata`: Wikidata へのリンク
- `cbdb`: 将来の外部データベース連携用（現状は未使用で `null`）

### 検証: `verification`

- `emperorTitleConfirmed`: 皇帝号の確認結果
- `confidence`: `high` / `medium` / `low`
  - 情報源間で不一致が残る場合は `medium` にし、`notes` に経緯を記載
- `notes`: 検証メモ

## 死因スキーマ

**[data/schema/DEATH_CAUSE_SCHEMA.md](../../data/schema/DEATH_CAUSE_SCHEMA.md)** を参照してください。

カテゴリ定義・確定済み設計判断・`reigns[].note` に既存の手がかりがある人物数などが記載されています。

**死因調査に着手する前に必ず読むこと**

## その他の追加スキーマ

即位経路・改元・大赦・立后・皇太子廃立・遷都・親征・反乱鎮圧・被反乱・年齢の9項目

**[data/schema/ADDITIONAL_SCHEMA.md](../../data/schema/ADDITIONAL_SCHEMA.md)** で確定済み（2026-07-15 ユーザー承認済み）

各項目の調査に着手する前に必ず読むこと。

### 回数系項目の共通構造

改元・大赦・立后・皇太子廃立・遷都・親征・反乱鎮圧・被反乱は共通して以下の構造を持ちます：

```json
{
  "count": 3,
  "events": [
    { "date": "0001-01-01", "description": "..." },
    ...
  ]
}
```

## 収録基準

**[data/schema/INCLUSION_CRITERIA.md](../../data/schema/INCLUSION_CRITERIA.md)** を参照してください。

訪問者向けに収録基準を解説する文書です。収録・除外の具体例や判定が難しいケースの扱い方を記載しています。

**収録基準を変更・追記した際は、`meta.inclusionCriteria` と合わせてこのファイルも更新してください**
