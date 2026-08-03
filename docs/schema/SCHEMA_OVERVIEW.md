# スキーマ参照ガイド

## kinship.json（系譜・即位経路グラフ・調査中）

全皇帝を親子・養子・婚姻・即位経路のエッジで結ぶグラフデータ（別ファイル `data/kinship.json`）。スキーマ・ブリッジ人物の収録基準・調査計画は **[data/schema/KINSHIP_SCHEMA.md](../../data/schema/KINSHIP_SCHEMA.md)** を参照。

## v3（2026-07-29・Issue #22）

`emperors.json` は `schemaVersion 3.0.0`、`kinship.json` は `2.0.0`。**レコードは安定 ID のみを持ち、日本語ラベルは `meta.catalogs` に集約**する。設計・移行手順・判定の根拠は **[V3_MIGRATION_PLAN.md](V3_MIGRATION_PLAN.md)**。

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

収録基準・進行状況・完了ブロック一覧のほか、`license`（二重ライセンス構成: データ=CC BY 4.0／コード=MIT）と `version`（データ内容の版・CalVer、履歴はルートの `CHANGELOG.md`）を含みます。

### `emperors` — 人物レコードの配列

## 人物レコード（概要）

詳細は [data/schema/EMPERORS_SCHEMA.md](../../data/schema/EMPERORS_SCHEMA.md) を参照してください。

### 基本フィールド

- **`id`**: kebab-case の一意識別子
  - 例: `qin-shi-huang`, `liu-song-wudi`
- **`name`**: 複数の名前形式
  - `familyName`: 姓（複姓を含む。**null は「姓を持たない形で伝わる」**＝モンゴル語名の漢字音写12人）
  - `personalName`: 諱（姓を含まない。2026-08-03 に姓を分けた＝Issue #37 単位6）
  - `commonName`: 一般に知られる呼称
  - `aliases`: 別名
  - `posthumousName`: 諡号
  - `templeName`: 廟号
  - `regnalTitle`: 常に `"皇帝"`
- **所属（v3 で `dynasty` を解体）**
  - `eraId`: 時代 ID（`meta.catalogs.eras` の11区分。時代ジャンプ・並び順用）
  - `regimeId`: 政権 ID（`meta.catalogs.regimes` の89件。同名国号も含めて一意）
  - `researchSection`: 調査ブロック名（旧 `dynasty.section`。表示用の区分ではない）
  - `standing`: `regular`（歴代の皇帝）/ `rival`（同じ政権の正統な帝統の外側で帝号を称した対立・僭称。20人。帝紀の有無は傍証で判定基準ではない）
  - 政権の位置づけ（`unified` 統一王朝 / `divided` 分裂期の王朝 / `rebel` 反乱・自称政権）と国号・表示ラベルは `meta.catalogs.regimes` 側にある

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
  - `source`: 参照ページ（正史の巻名）・言語・注記に加え、`quote`（日付根拠の正史原文）と
    `conversion`（旧暦→西暦の換算典拠・既存日付との照合結果）を持つ（task.md 3-1 フェーズBで新設し、
    2026-07-21 に全365人への付与が完了）

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
- `usedEmperorTitleFrom`: 皇帝号の使用開始時期
- （`selfProclaimed` は v3 で廃止。`accessionRoute.axes` と `standing` で表現する）

### 出典: `sources`

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

即位経路・改元・大赦・立后・皇太子廃立・遷都・親征・反乱鎮圧・被反乱・年齢の10項目

**[data/schema/ADDITIONAL_SCHEMA.md](../../data/schema/ADDITIONAL_SCHEMA.md)** で確定済み（2026-07-15 ユーザー承認済み）

各項目の調査に着手する前に必ず読むこと。

### 回数系項目の共通構造

改元・大赦・立后・皇太子廃立・遷都・親征・反乱鎮圧・被反乱は共通して以下の構造を持ちます：

```json
{
  "count": 3,
  "events": [
    { "date": "0001-01-01", "note": "..." },
    ...
  ]
}
```

## `note`（作業ログ）と `claim`（主張）

**[data/schema/EMPERORS_SCHEMA.md](../../data/schema/EMPERORS_SCHEMA.md) の「`note` と `claim`」節が正。**

`note` は作業ログで、訂正の経緯として**捨てた側の値**が本文に残るため、フィールドとの
突合は**向きが反転します**（散文は witness にならない）。2026-08-03 から、判定の単位にあたる
8つのコンテナに**任意**の `claim` 欄を置けます — いま正しいと判断している内容だけを
前向きに書いた1〜2文で、引用は書かず、件数は算用数字で書きます。

**既存 note には遡及しません。** したがって `claim` が無いことは根拠の不在を意味せず、
`coverage.py` は `claim` を確定の根拠にしません。

## `conflicts`（史料対立）

**[data/schema/EMPERORS_SCHEMA.md](../../data/schema/EMPERORS_SCHEMA.md) の「`conflicts`」節が正。**

原典同士が食い違うとき、いままでは note の散文に書くしかなく、**書かなければ
「気づかなかった」のか「対立が無い」のかを区別できません**でした。2026-08-03（Issue #51 P3）
から、`note`・`claim` と同じ位置に任意の `conflicts` 配列を置けます（`events[]` にも置ける）。
採用値・対立値・**採否理由**を持ち、`quote` には引用規約の全項が掛かります。

「対立なし」は `conflicts: []`、**未確認はキー自体を置かない**——この区別ができることが
この欄の値打ちです。`claim` と同じく**遡及しません**。

## 収録基準

**[data/schema/INCLUSION_CRITERIA.md](../../data/schema/INCLUSION_CRITERIA.md)** を参照してください。

訪問者向けに収録基準を解説する文書です。収録・除外の具体例や判定が難しいケースの扱い方を記載しています。

**収録基準を変更・追記した際は、`meta.inclusionCriteria` と合わせてこのファイルも更新してください**
