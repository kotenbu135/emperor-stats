# Claude Design 依頼プロンプト — 中国皇帝統計

**使い方**: 「── ここから ──」以下をそのまま Claude Design に貼る。あわせて次の2ファイルを添付（またはリポジトリを参照可能に）する。

- `DESIGN.md` — デザインシステム（色・書体・コンポーネント規範）。**必須**
- `docs/site-design/fixtures/emperors.sample.json`（233KB） — 実データ 14人分の抜粋。全11時代とエッジケースを網羅。添付できない環境では、下の「レコード骨格」だけでも設計は成立する

肖像画は `data/images/portraits/webp/<emperor.id>.webp`（360×480 / 3:4 / **150件のみ**）。

---

── ここから ──

## 依頼

**中国皇帝統計**（emperorstats.com）というデータサイトを、ゼロから作り直します。下記6セクション分の画面デザインを作ってください。

秦の始皇帝から清の宣統帝溥儀まで、実際に「皇帝」を名乗った **365名** について、在位年数・死因・即位経路など全12項目を**正史原典に1件ずつ当たって**調査したデータセットを可視化する、統合データサイエンス・ダッシュボードです。歴史の重厚さと、現代的なデータグラフィックスの明快さを両立させたい。

**視覚・構造の規範はすべて添付の `DESIGN.md` に従ってください。** 色・書体・余白・コンポーネントの仕様はそこにあります。このプロンプトが定義するのは「何を作るか」と「データの形」です。両者が食い違ったら `DESIGN.md` が優先します。

**先に、絶対に外せない5点**（詳細は後述・`DESIGN.md` 12章）:

1. **ページは下記6セクションだけ。** 指標ごと・グラフごとにページを増やさない。グラフは概要ダッシュボードに集約し、セレクタで切り替える
2. **日本語ラベルをハードコードしない。** すべて `meta.catalogs` から引く（`dynasty` / `flags.selfProclaimed` / `accessionRoute.category` は v3 で削除済み・存在しない）
3. **データに無い値を作らない**（肖像の生成、年齢の推定、不明な日付の確定）
4. **欠損が主役。** 肖像は 215/365 が無く、没年齢は 96人・即位年齢は 193人が null。**平均値には必ず母数（n=）を添える**
5. **文章（散文）は枠だけ作り、本文は書かない**（日本語ダミーで行数と折り返しが確認できる状態に）

---

## データ契約（最重要・ここを外すと実データに載りません）

データは `data/emperors.json`（`{ meta, emperors[] }`・365件・6.7MB）1本です。**スキーマ v3（`schemaVersion: "3.0.0"`）**で、2026-07-29 に大きく変わっています。

### 唯一のデータアクセスイディオム

**レコードは安定 ID しか持ちません。日本語ラベルは `meta.catalogs` にしかありません。UI に日本語ラベルをハードコードせず、必ず catalogs を引いてください。**

```js
// 時代名          eras[]: 11件
catalogs.eras.find(e => e.id === emperor.eraId).label            // → "隋・唐"
// 政権名          regimes[]: 87件（label は曖昧性のない表示名。name は同名国号がある）
catalogs.regimes.find(r => r.id === emperor.regimeId).label      // → "梁（蕭梁）"
// enum ラベル     enums.<フィールド名>[]
catalogs.enums.deathCause.find(d => d.id === emperor.deathCause.category).label   // → "病死"
catalogs.enums.accessionCategory.find(a => a.id === emperor.accessionRoute.categoryId).label
```

**フィールド名と `catalogs.enums` のキーは一致しません。** `catalogs.enums[フィールド名]` で機械的に引くと `undefined` になります。対応は下表のとおり:

| レコード上のフィールドパス | 引く enums キー | 値の数 |
|---|---|---|
| `emperor.standing` | `emperorStanding` | 2 |
| `catalogs.regimes[].category` | `regimeCategory` | 3 |
| `emperor.accessionRoute.categoryId` | `accessionCategory` | 8 |
| `emperor.accessionRoute.axes.throneSource` | `throneSource` | 3 |
| `emperor.accessionRoute.axes.titleOrigin` | `titleOrigin` | 2 |
| `emperor.accessionRoute.axes.decidedBy[]` | `decidedBy` | 4 |
| `emperor.accessionRoute.axes.decidedByAgents[]` | **`decidedByAgent`**（★複数形→単数形）| 6 |
| `emperor.accessionRoute.axes.decidedByBasis` | `decidedByBasis` | 2 |
| `emperor.accessionRoute.axes.predecessorFate` | `predecessorFate` | 5 |
| `emperor.accessionRoute.axes.relationToPredecessor` | `relationToPredecessor` | 23 |
| `emperor.accessionRoute.axes.procedure` | `procedure` | 5 |
| `emperor.deathCause.category` | `deathCause` | 8 |
| `emperor.*.confidence`（`verification` / `deathCause` / `accessionRoute` / `ages` / 各カウント項目）| `confidence` | 3 |
| `reigns[].datePrecision.start` / `.end`、`events[].datePrecision` | `datePrecision` | 3 |

（`kinshipRelationDetail` は別ファイル `data/kinship.json` 用。このサイトでは使いません。）

`labelEn` の枠はありますが**値はすべて null**です（英語版は未着手）。英語 UI は作らないでください。

**このデータに無いもの**（あるつもりで UI を作らないでください）: **読み仮名**（かな検索は作れません）／英語ラベル（`labelEn` 全件 null）／肖像の無い215人の画像／`cbdb`（全件 null）。

### 存在しないフィールド（v3 で削除済み・使うと壊れます）

| 使ってはいけない | 代わりに使う |
|---|---|
| `emperor.dynasty`（オブジェクトごと廃止）| `emperor.regimeId` → `catalogs.regimes` / `emperor.eraId` → `catalogs.eras` |
| `emperor.dynasty.name` / `.section` / `.category` | `regimes[].label` / `emperor.researchSection`（**画面表示禁止**）/ `regimes[].category` |
| `flags.selfProclaimed` | `emperor.standing` と `accessionRoute.axes` |
| `accessionRoute.category`（日本語ラベル）| `accessionRoute.categoryId`（ID）|

### レコード骨格（実データ 1件・注釈つき）

実データ `qing-shengzu`（康熙帝）のレコードから、本文が長いフィールド（`note` 類）だけ `"…"` に置き換えたもの。**それ以外の値はすべて原本のまま**です。

```jsonc
{
  "id": "qing-shengzu",                    // kebab-case・肖像ファイル名もこの id
  "name": {
    "personalName": "愛新覚羅玄燁",         // 諱。365人全員に値がある（null なし・最長16字）
    "commonName": "聖祖（康熙帝）",         // 一般呼称。365人全員に値がある（最長14字）
    "aliases": [],                         // 空配列が 355人
    "posthumousName": null,                // null が 267人
    "templeName": null,                    // null が 295人
    "regnalTitle": "皇帝"                  // 常に "皇帝"
  },
  "eraId": "qing",                         // 11時代のいずれか（表示順は eras[].sortOrder）
  "regimeId": "qing",                      // 87政権のいずれか
  "researchSection": "清",                 // 調査ブロック名。★画面に出さない★
  "standing": "regular",                   // "regular" 345人 / "rival" 20人（同一国号内の対立・僭称）
  "reigns": [                              // 復位した人は複数要素（reignCount>1 は 8人・最大3）
    {
      "startYear": 1661, "endYear": 1722,  // 紀元前は -221 のような負値（表示は「前221年」）
      "startDate": "1661-02-05",           // ISO。精度が足りない端は null
      "endDate": "1722-12-20",
      "startDateRaw": "順治十八年正月丁巳（旧暦）",   // 旧暦の原表記
      "endDateRaw": "康熙六十一年十一月甲午（旧暦）",
      "datePrecision": { "start": "day", "end": "day" },  // "day" | "month" | "year"
      "isRestoration": false,              // 復位区間か
      "dynastyOrder": null,                // 第N代。★365人中204人が null★（87政権中 dynastyOrderSurveyed=true は36）
                                           // 推論しないこと・既定では画面に出さない
      "note": "…",
      "duration": {
        "value": 22597, "unit": "day",
        "approxDays": 22597,               // ★グラフの主軸はこれ★
        "exactDays": 22597,                // 両端が day 精度のときだけ。null が 95人
        "needsPreciseDays": false,
        "source": {                        // ★出典。374/374 区間すべてに quote がある★
          "page": "清史稿 本紀六（聖祖本紀一）・本紀八（聖祖本紀三）",
          "lang": "zh-classical",
          // 正史の原文。字体を変えない・要約しない・表示のために切らない
          // ★374件中292件（78%）に日本語フォントが持たない簡体字が入る（为・宫・时・诏…）。
          //   引用要素だけ font-family を SC 優先にし lang="zh-Hans" を付ける（DESIGN.md 4章）★
          "quote": "顺治十八年正月丙辰，世祖崩，帝即位，年八岁，改元康熙。／甲午，上大渐，日加戌，上崩，年六十九。",
          "conversion": "…",               // 旧暦→西暦の換算典拠（数百字になることがある）
          "note": "…"
        }
      }
    }
  ],
  "reignSummary": {
    "totalReignDuration": {
      "approxDays": 22597,
      "displayYears": 61.91,               // 小数1桁と2桁が混在 → 表示側で第1位に丸める
      "isExact": true,                     // false が 95人 →「約」と断る
      "needsPreciseDays": false
    },
    "firstStartYear": 1661, "lastEndYear": 1722, "reignCount": 1
  },
  "flags": { "isFemale": false, "usedEmperorTitleFrom": 1661 },  // isFemale: true は武則天1人
  "sources": { "wikidata": "Q17790", "cbdb": null },             // wikidata は365人全員にある（null 0件）／cbdb は全件 null
  "verification": { "emperorTitleConfirmed": true, "confidence": "high", "notes": "" },

  "deathCause": {
    "category": "illness",                 // 8値の ID（catalogs.enums.deathCause）
    "note": "…",                           // 平均107字・最大433字
    "confidence": "high",                  // high 251 / medium 90 / low 24 → medium・low はUIで明示
    "source": { "page": "清史稿 巻八（聖祖本紀三）", "lang": "zh-classical" }
  },

  "accessionRoute": {
    "categoryId": "hereditary",            // 8値の ID（catalogs.enums.accessionCategory）
    "note": "…", "confidence": "high",
    "source": { "page": "清史稿 巻六（聖祖本紀一）", "lang": "zh-classical" },
    "axes": {                              // 多軸分類。個別ページの「即位の経緯」で使える
      "throneSource": "inherited",         // 前代君主から継承 / 他政権から受禅 / 自立
      "titleOrigin": "inherited",          // 帝号を継承したか新たに称したか
      "decidedBy": ["predecessor"],        // 配列。誰が即位を決めたか
      "decidedByAgents": [],               // 配列。臣下・軍・宦官・外戚・母后・宗室
      "decidedByBasis": "source-reread",
      "predecessorFate": "natural-death",  // 先帝の最期
      "relationToPredecessor": "son",      // 先帝との続柄（23値）
      "procedure": "normal"                // 儀礼の形
    }
  },

  "ages": {
    "birthDate": "1654-05-04", "birthDatePrecision": "day",
    "deathDate": "1722-12-20", "deathDatePrecision": "day",
    "accessionAge": 8,                     // ★数え年★ null が 193人（172人分しか値がない）
    "deathAge": 69,                        // ★数え年★ null が 96人（269人分しか値がない）
    "confidence": "high", "note": "…"      // note は平均255字・最大700字
  },

  // 以下8種は同じ形（count / events[] / confidence / note）。実データでは常に count === events.length
  // ★添付の emperors.sample.json だけは events[] を先頭3件に切り詰めてあるため
  //   サンプル内では count !== events.length になる。件数は必ず count を使うこと★
  "eraChangeCount":            { "count": 1,  "events": [ /* 改元 */ ], "confidence": "high", "note": "…" },
  "amnestyCount":              { "count": 11, "events": [ /* 大赦 */ ], "confidence": "high", "note": "…" },
  "empressInstallationCount":  { "count": 3,  "events": [ /* 立后 */ ], "confidence": "high", "note": "…" },
  "crownPrinceDepositionCount":{ "count": 2,  "events": [ /* 皇太子廃立 */ ], "confidence": "high", "note": "…" },
  "capitalRelocationCount":    { "count": 0,  "events": [], "confidence": "high", "note": "…" },
  "personalCampaignCount":     { "count": 3,  "events": [ /* 親征 */ ], "confidence": "high", "note": "…" },
  "rebellionSuppressionCount": { "count": 14, "events": [ /* 反乱鎮圧 */ ], "confidence": "high", "note": "…" },
  "rebellionSufferedCount":    { "count": 14, "events": [ /* 被反乱 */ ], "confidence": "high", "note": "…" }
}
```

**`events[]` の形は3系統あります**（表を作るときはこの違いを吸収してください）:

| 系統 | 対象 | キー |
|---|---|---|
| 時点型 | 改元・大赦・立后・皇太子廃立 | `date` / `datePrecision` / `note` /（`source` は任意）|
| 期間型 | 親征・反乱鎮圧・被反乱 | `startDate` / `endDate`（欠落あり）/ `datePrecision` / `note` ＋ 親征は `target`・`outcome`、反乱は `name`・`leader`・`outcome` |
| 移動型 | 遷都 | `date` / `datePrecision` / `from` / `to` / `note` |

`events[].datePrecision` は **文字列（`"day"`/`"month"`/`"year"`）・`null`・`{ "start": "...", "end": "..." }` のオブジェクト（24件）** の3形態を取ります。オブジェクトが来ても壊れない表示にしてください。

**`events[].source` は全系統で欠落が普通です。** 6,027件のうち `source` があるのは **1,941件（32%）** だけ。出典欄は「ある行にだけ出す」設計にしてください（無い行に空欄やダミーを置かない）。

### 画面に出る実数（2026-07-29 実測・この値で組んでください）

- 皇帝 **365人** / 政権 **87** / 時代 **11** / 肖像画 **150件（=215人には無い）**
- 平均在位 **9.86年**（`approxDays` 平均 3,597日・n=365）
- 平均没年齢 **40.9歳**（数え年・**n=269/365**）／ 平均即位年齢 **25.5歳**（数え年・**n=172/365**）
- 最長在位 **康熙帝 61.9年（22,597日）**、次いで乾隆帝 60.4年・西夏仁宗 54.3年・漢武帝 54.1年
- 最短在位 **金 末帝 0日**（即位当日に戦死）。30日未満が 8人
- 死因: 病死 161 / 暗殺 96 / 不詳 35 / 処刑 35 / 自尽 15 / 諸説あり 15 / 戦死 7 / 事故死 1
- 即位経路: 世襲 120 / 擁立 97 / 自立 48 / 簒奪 28 / 推戴 23 / 受禅（易姓）18 / 継承（経緯記載なし）17 / 内禅 14
- 時代別人数: 南北朝 69 / 東晋・十六国 55 / 宋遼金夏 52 / 隋・唐 49 / 秦・漢 35 / 五代十国 34 / 明 22 / 元 18 / 三国・西晋 17 / 清 13 / 近代 1
- `standing`: 正規 345 / 対立・僭称 20 ／ 女性 1人（武則天）／ 復位者 8人
- 1人あたりのイベント総数は平均 16.5件、最大 223件（南宋高宗）。ただし**イベント6,027件のうち `source` があるのは 1,941件（32%）**
- `dynastyOrder`（第N代）は **365人中204人が null**（画面に出さない）。`sources.wikidata` は **365人全員にある**（外部リンク・`sameAs` に使える）
- 復位者8人の内訳: **3区間は宣統帝のみ**、他7人は2区間
- 在位区間374のうち、開始が月精度59・年精度19／終了が月精度44・年精度13。さらに **`startDate` が null の区間46・`endDate` が null の区間34**（年しかわからない）

---

## サイト構成（セクションはこの6つで固定）

**指標ごと・グラフごとにページを増やさないでください。** グラフはすべて概要ダッシュボードに集約し、セレクタで切り替えます。ここに無いページを提案・追加しないこと。

サイドバー（デスクトップ 256px 固定 / モバイルは同じ6項目の下部固定ナビ）:

1. **概要ダッシュボード** `/` — サイトのグラフはすべてここ
2. **皇帝一覧** `/emperors`（＋個別ページ `/emperors/[id]`）— カードグリッド
3. **皇帝データ探索** `/data/emperors` — 365行の表
4. **王朝データ探索** `/data/dynasties` — 政権87行 / 時代11行の集計表
5. **通史年表** `/timeline` — **今回は箱だけ**
6. **系譜・家系図** `/kinship` — **今回は箱だけ**

「このサイトについて」`/about` は**サイドバーに置かず、全ページ共通フッターからのみ**。

**フッターは細い1行**（高さ40px前後・12px・上に細罫1本）。`データ CC BY 4.0 / コード MIT　·　このサイトについて　·　GitHub` をこの1行で書ききる。ロゴ・リンク集・多段組みのフッターにしない。モバイルでは**下部固定ナビの裏に敷かない**（`/about` への唯一の導線なので、ナビに隠れると到達不能になります）。

## 文章（散文）の置き場所 — **枠だけ作ってください**

表とグラフだけでは検索エンジンに評価されにくいので、**各画面に地の文の置き場所**を用意します。**本文はこれから書くので、今は想定文字数の日本語ダミーで枠だけ**作ってください（`lorem ipsum` ではなく全角の日本語ダミーで、行数と折り返しが確認できる状態に）。仕様は `DESIGN.md` 7.12。

| 画面 | h1直下のリード（80〜120字）| 最下部の解説（400〜800字・h2 1〜2本）|
|---|---|---|
| 概要ダッシュボード | ✅ | ✅ |
| 皇帝一覧 | ✅ | ✅ |
| 皇帝データ探索 | ✅ | ✅ |
| 王朝データ探索 | ✅ | ✅ |
| 通史年表・系譜（箱だけ）| ✅ | — |

皇帝の個別ページには別枠で **「人物の概要」200〜400字**（`h2` 付き）を、ヘッダーのすぐ下に置きます。

**重要**: この文章は「グラフや表を見ればわかること」を書く場所ではありません（数値の言い換えは書きません）。収録基準・数え方の前提・出典の性質・データの限界・用語の定義を書く欄です。**SSR で出し、折りたたみや「続きを読む」の内側に入れない**でください。文中から他画面への文脈内リンクを2〜3本張れる想定で組んでください。

## 作ってほしい画面

### 画面1: 概要ダッシュボード（`/`）— 最重要

サイトの顔であり、**このサイトのグラフが集まる唯一の場所**。指標ごとにページを分けず、1画面の中でセレクタとフィルタで掘れるようにします。

1. **ヒーロー**: サイト名（Serif）＋ 一文の説明 ＋「正史原典に1件ずつ当たった」ことがわかる短いコピー
2. **KPI 帯**: 皇帝総数 365 / 平均在位年数 9.86年 / 平均没年齢 40.9歳 / 最長在位 康熙帝 61.9年。**各タイルに母数と単位のキャプション必須**（`DESIGN.md` 7.1）。フィルタを掛けると値と母数が追随する
3. **フィルターバー**（`DESIGN.md` 7.9）: 時代 / 政権 / 死因 / 即位経路 / 正規・対立 / 在位年数レンジ / 没年齢レンジ ＋ フリーワード。**選択中の条件はチップで可視化**。「365人中 N人」を常時表示。**KPI・ランキング・内訳のすべてが同じ N に連動する**
4. **ランキングブロック（棒が適する指標をここで切り替える）** — `DESIGN.md` 7.5
   - 集計セレクタ: 皇帝(365) / 政権(87) / 時代(11)
   - 指標セレクタ: 在位年数・即位時年齢・没年齢・即位回数・改元・大赦・立后・皇太子廃立・遷都・親征・反乱鎮圧・被反乱（**12指標**）
   - 並びセレクタ: 多い順 / 少ない順（在位年数なら「最長 / 最短」）
   - **0日・3日の人が「棒が無い」ように見えないこと**。母数が365未満の指標に切り替えたらキャプションを書き換えること
5. **内訳ブロック（円が適する分類をここで切り替える）** — `DESIGN.md` 7.8
   - 分類セレクタ（**12種**）: 死因 / 即位経路 / 帝位の出所 / 帝号の由来 / 即位を決めた主体 / 先帝の最期 / 即位の手続 / 政権の性格 / 正規・対立 / 死因の確度 / **時代（11）** / **先帝との続柄（23）**
   - **9カテゴリ以上の分類（時代11・先帝との続柄23）を選んだら同じブロックが横棒に切り替わる**（政権87は分類セレクタに載せません。政権の比較はランキングの集計セレクタで行います）
6. **リード文と解説の枠**（h1直下・最下部。ダミーテキスト。上の「文章の置き場所」参照）
7. **ドリルダウン** — `DESIGN.md` 7.10
   - 円のセグメント・横棒・ランキング行（政権/時代）をクリックすると、その値がフィルタとして積まれ、**画面全体が再集計される**
   - 「時代: 唐 › 死因: 暗殺 › 12人」のように積んだ条件が読める
   - 出口を常に置く: **「該当する12人を一覧で見る」**（→画面2）と**「表で見る」**（→画面4）

**この画面を、フィルタ無しの初期状態／時代で1段絞った状態／さらに死因で2段絞った状態、の3つで見せてください。**

### 画面2: 皇帝一覧（`/emperors`）

365人のカードグリッド。**眺める**ための画面（比べるのは画面4）。

1. 上部に画面1と共通のフィルターバー（条件は画面をまたいで引き継ぐ）
2. **「365人中 N人を表示」を常に出す**
3. カードは `DESIGN.md` 7.2。**肖像がある人と無い人（モノグラム）が混在したグリッドの見え方を必ず設計してください**（一覧の 59% はモノグラムになります。ここが破綻すると画面が成立しません）
4. 時代の区切り見出しを挿入できること（`sortOrder` 順）。並べ替えは「時代順 / 在位年数 / 没年齢」
5. カードクリックで個別ページへ遷移。0件時の状態も設計する
6. **365件は仮想化せず、全件を実カード（`<a>`）として出す**前提です（描画は `content-visibility` で遅らせる）。SEO 用の隠しリンクリストは作らないでください
7. リード文と解説の枠（ダミーテキスト）

### 画面3: 皇帝の個別ページ（`/emperors/[id]`）

構成は `DESIGN.md` 7.6 のとおり。特に:

- **肖像 or モノグラム**（3:4・360×480）。肖像がある場合は直下に出典（作者・ライセンス・Wikimedia Commons へのリンク）
- **「人物の概要」（200〜400字・`h2` 付き・ヘッダーの直下）**: SEO のための地の文。本文は後で書くのでダミーで枠だけ。データから機械生成する欄ではありません
- **在位帯**: 復位者は区間が複数（**3区間は宣統帝のみ**）。日付精度が `month`/`year` の端、および **`startDate`/`endDate` が null で年しかわからない区間**の見せ方まで設計する
- **死因・即位経路**: カテゴリ ＋ 本文（数百字）＋ 出典。`confidence` が `medium`/`low` のときの表示
- **8指標のイベント表**: 折りたたみ。最大223件のケースで破綻しないこと。**出典は `source` を持つ行にだけ出す**（3分の2の行には出典がありません）
- **出典ブロック**: 正史の巻名 ＋ 原文引用（漢文・Serif・字体そのまま）＋ 暦換算メモ
- 参考として `qing-shengzu`（康熙帝・データが最も充実）と `jin-modi`（金 末帝・在位0日・肖像なし・年齢不明）の**両方**が成立するレイアウトにしてください

### 画面4: 皇帝データ探索（`/data/emperors`）

365行の表。**比べる・並べ替える・探す**ための画面（`DESIGN.md` 7.11）。

- 既定6〜7列（皇帝名＋諱 / 時代・政権 / 在位期間 / 在位年数 / 死因 / 即位経路 / 没年齢）＋ 列選択メニューで 8つの回数指標などを出し入れ
- 全数値列でクリックソート。**null は常に末尾**（0 扱いにしない）。欠損セルは「不明」
- 上部に画面1と共通のフィルターバー。「365件中 N件」
- ヘッダー sticky・行高44px・**スクロールは表のコンテナ内**（ページ本体を横スクロールさせない）
- 行クリックで個別ページへ
- リード文と解説の枠（ダミーテキスト。解説には列の定義・数え方の注意を書く想定）

### 画面5: 王朝データ探索（`/data/dynasties`）

政権87行 / 時代11行のトグルを持つ集計表（`DESIGN.md` 7.11）。

- 列: 政権名 / 時代 / 性格（正統・並立・反乱自称）/ 年幅 / 皇帝数 / 平均在位年数 / 最長 / 最短 / 平均没年齢 / 死因の内訳（積み上げバー1セル）/ 歴代調査済みか
- **人数1〜2人の政権が多数あるので、集計列には必ず母数を併記**する
- 行クリックでその政権に絞り込んだダッシュボードへ
- リード文と解説の枠（ダミーテキスト。解説には「政権と王朝の違い」「集計の前提」を書く想定）

### 画面6: 「箱だけ」の2画面（`/timeline`・`/kinship`）

- ナビには**通常の項目として並べる**（グレーアウトも disabled もしない）
- 開くと、そのセクションが何を見せる場所なのかを1〜2行で説明し、**準備中であることを明示**する。中身のデータは出さない
- **準備中の見せ方も含めてデザインしてください**（余白だらけの白紙にしない）。他セクションへ戻る導線を置く
- レイアウトの枠（ヘッダー・タイトル・本文領域）は他画面と同じものを使い、あとで中身だけ差し替えられる形に

**デスクトップ（≥1024px・サイドバー256px・最大幅1440px）とモバイル（<1024px・下部固定ナビ6項目）の両方を出してください。**

---

## 必ず成立させるエッジケース

添付の `emperors.sample.json` はこれらを網羅するように選んであります。

| 状況 | 実データ | 画面で起きること |
|---|---|---|
| **肖像が無い** | **215人（59%）** | 一覧の過半がモノグラム。個別ページの主役画像が無い |
| 在位0日 | 金 末帝（`jin-modi`）| 棒グラフで消える。「0日」と読めること |
| 年齢が不明 | 即位年齢 193人・没年齢 96人が null | 平均値の母数がずれる。個別ページのタイルが空になる |
| 復位（複数回即位）| 8人（**3区間は宣統帝のみ**・他7人は2区間）| 在位帯が分割。合計と各区間の両方を出す |
| 対立・僭称 | 20人（`standing: "rival"`）| 一覧・ランキングに混ざる。区別できること |
| 女性 | 1人（武則天）| `regimeId` は `tang` ではなく `wu-zhou`（唐とは別政権） |
| 日付が年・月精度 | 各所 | 「620年」「620年3月」と精度どおりに出す。日を捏造しない |
| **日付そのものが無い** | `startDate` null 46区間 / `endDate` null 34区間 | 在位帯を年（`startYear`/`endYear`）だけで引く |
| **イベントに出典が無い** | 6,027件中4,086件 | 出典欄は「ある行にだけ」出す |
| **モノグラムの字が重複する** | 諱の先頭1字は異なり39種しかない（秦漢20枚中18枚が「劉」）| **諱の末尾1字**を使う（異なり192種）。`DESIGN.md` 7.3 |
| 概算の在位日数 | `isExact: false` が 95人 | 「約」と断る |
| イベントが極端に多い | 南宋高宗 223件 | 折りたたみとスクロール |
| 政権に固有色を割り当てられない | 87政権 | 色は11時代のみ。政権は時代色の濃淡＋ラベル |

---

## やらないこと

- **データに無い値を作らない**（肖像の生成・補完、生没年の推定、不明な日付の確定）。このデータセットは「正史に無いことは無いと書く」ことが価値です
- **日本語ラベルのハードコード禁止**（必ず `meta.catalogs` を引く）
- **`dynasty` / `flags.selfProclaimed` / `accessionRoute.category` を使わない**（v3 で削除済み・存在しません）
- `researchSection`（「秦（始皇帝以降）」等の調査ブロック名）を画面に出さない
- **上の6セクション以外のページを作らない**（指標ごと・グラフごとにページを増やさない。グラフは概要ダッシュボードに集約してセレクタで切り替える）
- `/timeline`・`/kinship` に中身のデータを載せない（今回は枠と「準備中」の表示だけ）
- サイドバーに「このサイトについて」を置かない（フッターのみ）
- ダークモードは作らない
- 英語 UI は作らない（`labelEn` は全件 null）
- 母数（n）や単位の無い平均値を出さない
- **かな読み検索を作らない**（`emperors.json` に読み仮名のフィールドがありません）
- **一覧365件を仮想化して DOM から消さない**／SEO 用の隠しリンクリストを作らない
- チャートに `role="img"` ＋要約の `aria-label` を付けない（`figure`＋`figcaption`＋併置テキスト表が正。`DESIGN.md` 7.7・9章）
- モノグラムに諱の**先頭**1字を使わない（末尾1字が規定）

── ここまで ──
