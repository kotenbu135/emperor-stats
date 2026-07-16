# 追加スキーマ設計（死因を除く9項目 + 遷都）

`data/emperors.json` の各人物レコードに追加する、死因（[DEATH_CAUSE_SCHEMA.md](DEATH_CAUSE_SCHEMA.md)）以外の追加調査項目のスキーマ設計ドキュメント。CLAUDE.md の「追加スキーマTODO」優先度2〜11位に対応する。

対応する `meta.status.phases` のキー：`accessionRoute` / `eraChangeCount` / `amnestyCount` / `empressInstallationCount` / `crownPrinceDepositionCount` / `capitalRelocationCount` / `personalCampaignCount` / `rebellionSuppressionCount` / `rebellionSufferedCount` / `ages`。

**調査はまだ未着手（全フィールド `not-started`、`ages` のみ `deferred`）。ここではフィールド構造・カテゴリ・数え方の基準のみを確定する。**

## 情報源・調査方針（共通）

[DEATH_CAUSE_SCHEMA.md](DEATH_CAUSE_SCHEMA.md) と同じ方針に従う。原典（正史の本紀・列伝）を第一次情報源とし、WebSearchの要約のみを根拠に確定しない。CLAUDE.md「データ調査の進め方」を参照。

- グループ1（即位経路）は在位データ調査で読んだ即位記事・崩御記事の再確認で済むことが多い。
- グループ2（改元・大赦・立后・皇太子廃立）は本紀の通読で4項目同時に埋める。
- グループ3（親征・反乱鎮圧・被反乱）は本紀の軍事記事を数える。**このドキュメントで定めた数え方の基準に従う**（下記参照）。
- グループ4（遷都）は王朝単位の集計になりがちだが、本スキーマでは個人レコード単位（「自分の在位中に何回遷都したか」）で持たせる。
- グループ5（即位時年齢・没年齢）は生年データ確保がネックのため `deferred` のまま。フィールド定義のみ確定。

## 1. 即位経路（`accessionRoute`）

個人ページ・本紀の即位記事を読めば判明する。死因調査（グループ1）とセットで調査すると効率的。

```json
"accessionRoute": {
  "category": "世襲",
  "note": "自然文での説明（先帝との関係、擁立者の有無など）",
  "confidence": "high",
  "source": { "page": "...", "lang": "ja" }
}
```

- `category`: 下記カテゴリ一覧から単一値（enum）。
- `note`: 経緯を自然文で記述（例：「先帝の嫡長子として遺詔により即位」「宦官○○に擁立され即位」）。
- `confidence` / `source`: `deathCause` と同じ運用。

### カテゴリ一覧

| 値 | 定義 |
|---|---|
| `世襲` | 先帝の子・兄弟など血縁者が、皇位継承の通常の手続き（遺詔・冊立太子からの継承等）で即位 |
| `簒奪` | 臣下・軍閥・外戚などが実力・クーデターにより先帝（または先王朝）から皇位を奪って即位 |
| `禅譲` | 先帝（または先王朝の皇帝）から形式上・儀礼上の「譲位」を受けて即位（実態が簒奪に近い禅譲劇も含み、その場合は `note` に経緯を明記） |
| `擁立` | 臣下・軍閥・宦官・外戚等の主導により、本人の主体的な簒奪行為なしに即位させられた（傀儡的即位を含む） |
| `復位` | 一度廃位・退位した後、再び即位した（`reigns[].isRestoration: true` の在位に対応。初回即位の経路は別途 `category` で判定し、`note` に復位の経緯を記す） |
| `建国` | 王朝・政権を新規に樹立して自ら皇帝を称した（先行政権からの継承がない場合。五胡十六国や反乱政権の初代に多い） |
| `不詳` | 即位の経緯が原典に見当たらない |
| `諸説あり` | 複数の原典/通説が対立し一つに絞れない |

### 設計判断

- **`selfProclaimed: true` の人物でも `世襲`/`復位` になり得る**（例：ある政権内での2代目以降は父からの世襲）。`accessionRoute` は「その人物個人の即位経路」であり、`flags.selfProclaimed`（政権全体の正統性）とは独立した軸。
- **禅譲と簒奪の境界**：形式上の譲位儀礼を経ていれば `禅譲`、実力行使のみで即位すれば `簒奪`。両者が併存するケース（禅譲の形式を取った事実上の簒奪、例：曹丕・司馬炎）は `禅譲` を採用し、`note` に「実質的には簒奪」である旨を明記する（史書の記述上の建前と実態を区別して残す）。
- **複数回即位した人物**：`reigns` 配列に対応させず、`accessionRoute` はレコード直下に単一値で持たせる（初回即位の経路を主とし、復位がある場合は `category: "復位"` を採用、初回の経路は `note` に記す）。理由：即位経路は「その人物の皇帝としてのキャリアの始まり方」を表す代表値としての性格が強く、`deathCause` 同様レコード単位の集約情報として扱うほうが `reignSummary` の設計思想と一貫する。

## 2〜5. 本紀通読カウント系（改元・大赦・立后・皇太子廃立）

いずれも「回数（`count`）＋明細配列（`events`）」の同じ構造を持つ。本紀を1回通読すれば4項目同時に埋められる。

```json
"eraChangeCount": {
  "count": 3,
  "events": [
    { "date": "-0140-10-01", "datePrecision": "month", "note": "建元→元光に改元", "source": { "page": "...", "lang": "ja" } }
  ],
  "confidence": "high",
  "note": "総括コメント（不確実な件数がある場合など）"
}
```

- `count`: `events` 配列の要素数と一致させる（一致しない場合は不確実な件数が別途あることを意味し、`note` で説明する）。
- `events[].date` / `.datePrecision`: `reigns[].startDate`/`datePrecision` と同形式。日付が特定できない場合は `date: null`, `datePrecision` は省略可。
- `events[].note`: 自然文で事由を記す。
- `confidence`: レコード全体（`count` の確からしさ）に対して `high`/`medium`/`low`。
- 該当なし（0回）の場合も `count: 0`, `events: []` で明示する（フィールド自体を省略しない。調査未実施と0回を区別するため、未調査の人物は `phases` の `status` で管理し、フィールド自体を付与しない）。

### 2. 改元回数（`eraChangeCount`）

- 「1回」＝新しい年号（元号）への切り替え1回。即位に伴う最初の建元は含めるか要判断が分かれるため、**即位に伴う最初の元号制定も1回としてカウントする**（皇帝在位中に何種類の年号を使ったか、という実質を反映するため）。`events[0]` に即位時の建元を含める。
- 年号を持たない王朝・時代（改元制度が未整備な秦など）は `count: 0` とし `note` に「年号制度なし」等と明記する。

### 3. 大赦回数（`amnestyCount`）

- 「1回」＝本紀に大赦（「大赦天下」等）の記事として明記された1件。部分的な恩赦（特定地域・特定罪状のみの減刑）は含めず、全国規模の「大赦」と明記されたものに限定する。
- 判定基準の詳細な線引きが必要な曖昧ケースが出た場合は `verification.notes` 相当として `note` に残し、実調査開始時にユーザーに確認する。

### 4. 立后（皇后冊立）回数（`empressInstallationCount`）

- 「1回」＝皇后として正式に冊立された1件。同一人物の再冊立（廃后後の復位）も別カウントとする。皇后不在のまま在位した場合は `count: 0`。
- `events[].note` に冊立された皇后の名（分かれば）を記す。

### 5. 皇太子廃立回数（`crownPrinceDepositionCount`）

- 「1回」＝立てられていた皇太子（または皇太弟等の法定推定継承者）を廃した1件。立太子そのものの回数ではなく**廃立（廃止）のみ**をカウントする（フィールド名どおり）。
- `events[].note` に廃された皇太子の名・理由を記す。

## 6. 遷都回数（`capitalRelocationCount`）

個人レコード単位で「自分の在位中に何回遷都したか」を持たせる（王朝単位の集計は将来サイト側で `dynasty.name` によりグループ集計する）。

```json
"capitalRelocationCount": {
  "count": 1,
  "events": [
    { "date": "-0210-01-01", "datePrecision": "year", "from": "咸陽", "to": "洛陽", "note": "..." }
  ],
  "confidence": "high",
  "note": ""
}
```

- 構造はグループ2の4項目と共通（`count` + `events`）。`events[].from`/`.to` に遷都前後の都名を追加する点のみ異なる。
- 同一王朝内の先代皇帝が定めた都をそのまま使い続けた場合は `count: 0`。

## 7〜9. 軍事系カウント（親征・反乱鎮圧・被反乱）

判定基準を先に確定してから調査に着手する（CLAUDE.md グループ3の指示）。基準は以下の通り確定：

### 7. 親征回数（`personalCampaignCount`）

- **「1回」＝同一の目的地・同一の相手に対する一連の軍事行動（出征〜帰還または現地での終結まで）を1回とする。** 同一遠征中に複数の敵を破っても1回、年をまたいでも同一目的の継続なら1回。年を空けて同じ相手に再度出征した場合は別カウント。
- 親征＝皇帝自身が軍を率いて戦場に赴いた場合のみ。将軍への派遣・勅命のみ（皇帝本人が出陣しない）は含めない。

```json
"personalCampaignCount": {
  "count": 2,
  "events": [
    { "startDate": "-0200-01-01", "endDate": "-0200-12-31", "datePrecision": "year", "target": "匈奴", "outcome": "敗北（白登山の戦い）", "note": "..." }
  ],
  "confidence": "high",
  "note": ""
}
```

- `events[].target`: 遠征相手（民族名・政権名・人物名など）。
- `events[].outcome`: 自然文または短句で結果を記す（勝敗が不明瞭な場合は「不詳」）。

### 8. 反乱鎮圧回数（`rebellionSuppressionCount`）

- **「1回」＝独立した首謀者・独立した蜂起地点を1件とする。** 同じ反乱が複数地域に飛び火しても首謀者が同一なら1件、鎮圧に複数年かかっても1件。
- 皇帝側（政権側）が鎮圧の主体だった件数。実際に鎮圧に成功したか否かは問わない（鎮圧を試みて失敗し王朝崩壊に至った場合もカウントし、`note` に結末を記す）。

```json
"rebellionSuppressionCount": {
  "count": 1,
  "events": [
    { "startDate": "0184-01-01", "endDate": "0184-12-31", "datePrecision": "year", "leader": "張角", "name": "黄巾の乱", "outcome": "鎮圧成功", "note": "..." }
  ],
  "confidence": "high",
  "note": ""
}
```

### 9. 被反乱回数（`rebellionSufferedCount`）

- 数え方の単位は反乱鎮圧回数と同じ（首謀者/蜂起単位＝1件）。
- 皇帝に対して起こされた反乱の件数。鎮圧の成否は問わない。自身が反乱により廃位・殺害された場合もその反乱をカウントし、`deathCause`（`category: "暗殺"`/`"戦死"` 等）や退位経緯（`reigns[].note`）と内容が重複してよい（別軸の集計のため重複を許容する）。

```json
"rebellionSufferedCount": {
  "count": 1,
  "events": [
    { "startDate": "0755-01-01", "endDate": null, "datePrecision": "year", "leader": "安禄山", "name": "安史の乱", "outcome": "退位に追い込まれた", "note": "..." }
  ],
  "confidence": "high",
  "note": ""
}
```

- `rebellionSuppressionCount` と `rebellionSufferedCount` は独立フィールド。同一の反乱イベントが（鎮圧に関わった別の皇帝の）`rebellionSuppressionCount` と（対象にされた皇帝の）`rebellionSufferedCount` の両方に登場することは想定内であり、突き合わせの整合性チェックは行わない。

## 10. 即位時年齢・没年齢（`ages`、`deferred`）

フィールド定義のみ確定し、能動的な調査自体は見送る（`meta.status.phases.ages.status: "deferred"`）。生年が判明した人物のみ埋める方針（CLAUDE.md 参照）。

**運用ルール**: グループ1〜4（即位経路・改元・大赦・立后・皇太子廃立・遷都・親征・反乱関連）の調査中に、読んでいる原典・列伝の中で生年月日・没年月日・即位時年齢・没年齢が判明した場合は、その都度このフィールドを埋める（`ages` 単体のためにわざわざ追加調査はしないが、他項目調査のついでに分かった情報は取りこぼさない）。

```json
"ages": {
  "birthDate": "-0259-01-01",
  "birthDatePrecision": "year",
  "deathDate": "-0210-09-10",
  "deathDatePrecision": "day",
  "accessionAge": 13,
  "deathAge": 49,
  "confidence": "medium",
  "note": "生年は諸説あり。享年は数え年か満年齢か原典で明示されない場合の扱いに注意。"
}
```

- `birthDate`/`deathDate`: ISO8601、不明部分は `null`。`deathDate` は原則 `reigns` の最終 `endDate` と一致するはずだが、退位後に別途没した場合はそちらを優先する。
- `accessionAge`/`deathAge`: 数え年（中国伝統の年齢計算）で統一するか満年齢にするかは、実調査着手時に確定する（未確定事項として `note` に明記しておく）。
- 生年不明な人物はこのフィールド自体を付与しない（0歳等のダミー値でごまかさない）。

## 全項目共通の設計判断

- **回数系フィールド（2〜9）はすべて `count` + `events[]` の同型構造**。将来のサイト実装でグラフ化する際に統一的に扱える。
- **`count` は `events.length` と一致させる**。不一致（「少なくともN回」等、正確な件数が確定できない場合）は `count` に判明している最小件数を置き、`note` に不確実性を明記する。
- **0回は明示的に `count: 0, events: []` で記録し、未調査とは区別する**。人物レコードにフィールド自体が存在しない＝その項目が未調査であることを意味する（`meta.status.phases.<key>.status` が `completed` になるまでの間、一部人物のみフィールドを持つ状態が生じる。これは `deathCause` と同じ運用）。
- **各フィールドの `confidence`** は `verification.confidence` と同じ3段階（`high`/`medium`/`low`）。

## 関連ドキュメント

- [DEATH_CAUSE_SCHEMA.md](DEATH_CAUSE_SCHEMA.md) — 死因スキーマ（優先度1位、設計済み・調査進行中）
- [EMPERORS_SCHEMA.md](EMPERORS_SCHEMA.md) — 現行スキーマ全体のリファレンス
