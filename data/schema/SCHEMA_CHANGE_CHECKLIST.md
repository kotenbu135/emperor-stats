# 配布物に主張を足すときのチェックリスト（`R-CLAIM-GATED`）

> **配布物に新しい主張の欄を作るときは、その欄を検査するゲートを同じ変更で足す。
> ゲートが書けない主張は配布物に置かず、内部側（`data/internal/`）に置く。**

対象は `data/emperors.json`・`data/kinship.json` に**新しい欄・新しい意味**を足すとき。
既存の欄には遡及しない。規則の全文と根拠は [RULES.yml](../../docs/process/RULES.yml) の
`R-CLAIM-GATED`、決定の経緯は [CLAIM_SCOPE_PLAN_2026-08-03.md](../../docs/schema/CLAIM_SCOPE_PLAN_2026-08-03.md)。

## なぜこの紙があるか

Issue #69 で洗ったところ、再調査が終わらなくなった系統は**すべて同じ形**だった —
検査できない主張を配布物に置くと、後から検出器を作るたびに母集団が現れ、その母集団は
「主張している以上ゼロにするしかない」ので終わらない。**発散していたのは欠陥ではなく主張の面積**で、
`*Raw`（器を作って中身が0件）・`source.page`（巻を照合しない）・`confidence`（欄ごとに意味が違う）は
どれも「**ゲートが無い／浅いまま欄だけ増えた**」だった。

**強制層は L3 が上限**。「新しい欄にゲートがあるか」は機械では判定しきれないので、
この表に**行を足せない欄は配布物に足さない**という運用で持たせる。表そのものの空欄と、
名前だけあって実装が無いゲートは `python3 scripts/check_rules.py` が落とす。

## 足すときの手順

1. **その欄は何を主張するのかを1文で書く。** 書けないなら、それは主張ではなく作業メモなので
   `data/internal/` へ置く（例: 丸めた月日は `data/internal/event-date-archive.json`）
2. **主張を否定できる機械の条件を書く。** 「値が入っている」は検査ではない。
   `check_ages` は深さ ≤ precision、`check_event_date_archive` は接頭辞、というように
   **嘘なら落ちる条件**を書く
3. **その条件を実装し、下の表に行を足す。** 実装先は `scripts/validate_emperors.py`（CI で回る・
   コーパス不要）か `scripts/verify_quotes.py`／`verify_calendar.py`（ローカル専用・要コーパス）
4. **検出力テストを足す。** 実データに違反が無い欄では**本番の「0 errors」は証拠にならない**ので、
   合成レコードでゲートが発火することを測る
5. 転記がその場で終わらない欄は、**条件を強制せずラチェット**（充足数が減ったら落ちる）にして、
   不足を [RESIDUAL.md](../../docs/process/RESIDUAL.md) の行にする。
   その場合は「まだ強制していない」と commit に書く（項目名だけ見て完了と読まれる）

## 主張と検査の対応表

**空欄で足さない。** 検査の列が書けない欄は、この表ではなく `data/internal/` の行になる。

| 欄 | 何を主張するか | 検査（スクリプト::関数） | 検出力テスト |
|---|---|---|---|
| `reigns[].startDate`／`endDate` | 在位の開始日・終了日（フル ISO ＋ `datePrecision`。**集計の根なので主張を絞らない**） | `validate_emperors.py::check_reigns` | （実データに違反が出る母集団があるため無し） |
| `reignSummary` | 各在位の合計と一致する（導出値であって独立の主張ではない） | `validate_emperors.py::check_reign_summary` | （同上） |
| `reigns[].duration.source.conversion` | 旧暦→西暦の換算が再演できる | `verify_calendar.py::main`（B-1） | （実データ 166件が母集団） |
| `events[].date`／`startDate`／`endDate` | 年精度 ＋ **在位境界年の月日**。保存値の深さそのものが主張 | `validate_emperors.py::check_event_date_format` | `test_date_claim_scope.py` |
| （同上・退避した月日） | 配布物の値が `data/internal/event-date-archive.json` の退避値の接頭辞である | `validate_emperors.py::check_event_date_archive` | `test_date_claim_scope.py` |
| `events[].*Raw`／`source.conversion` | 原典の紀年表記からの換算が再演できる（**任意・遡及しない**） | `verify_calendar.py::main`（B-5） | `test_event_conversion_gate.py` |
| `events[].id` | 添字が動いても同じ event を指す（外部参照の宛先） | `validate_emperors.py::check_event_ids` | `test_event_ids.py` |
| `ages.birthDate`／`deathDate` | 生没日。深さそのものが主張（深さ ≤ precision） | `validate_emperors.py::check_ages` | `test_date_claim_scope.py` |
| `reigns[].dynastyOrder` | 第N代である／**調べた上で歴代に数えない**（`null`）。欄が無い＝政権ごと未調査 | `validate_emperors.py::check_dynasty_order` | `test_date_claim_scope.py` |
| `eraChangeCount[].events[].eraName` | **この改元 event が建てた元号の名**（日本語の新字体。**任意** — 前漢初期のように元号制以前で名前が無い改元があり、空は「まだ読んでいない」も含む） | `validate_emperors.py::check_era_names` | `test_era_name.py` |
| （同上・底本照合） | その元号名が**本人の原文に改元の定型句と隣り合って**在る（＝捨てた側の元号ではない） | `verify_quotes.py::cmd_check_era_names` | `test_era_name.py` |
| `eraChangeCount[].events[].eraNameRaw` | 底本の字体（**任意** — `hanzi_norm` の変換で出てこないときだけ書く。opencc で機械的に出る形は導出値であって主張ではない） | `validate_emperors.py::check_era_names` | `test_era_name.py` |
| `name.ethnicName` | この人物の `value` は `kind` の言語・民族の名である（**任意・遡及しない** — 欄が無いのは「民族名が無い」ではなく「まだ分けていない」を含む） | `validate_emperors.py::check_ethnic_names` | `test_ethnic_name.py` |
| （同上・移行の同一性） | 移行前の `personalName`（`data/internal/personal-name-originals.json` に凍結）へ `kind` の並びで組み直すと戻る＝**括弧ごと消す欠落を落とす** | `validate_emperors.py::check_ethnic_names` | `test_ethnic_name.py` |
| （同上・底本照合） | **漢字側**（契丹名・女真名は `value`／モンゴル語名・満洲語名は相手側 `personalName`）が本人の原文に在る。**カナは原典に無いので照合の外** | `verify_quotes.py::cmd_check_ethnic_names` | `test_ethnic_name.py` |
| `name.courtesyName` | この人物の字は値のとおりである（**任意・遡及しない** — 欄が無いのは「字が無い」ではなく、唐以降の帝紀が冒頭定型に字を書かないことと未読を含む。機械が何も見つけなかった248人の取りこぼし率は 17%と実測） | `validate_emperors.py::check_courtesy_names` | `test_courtesy_name.py` |
| （同上・底本照合） | その字が**本人の原文に「字〈値〉」の形で**在る。**隣接まで見る**ので、小字（幼名）を字の欄へ入れた形はここで落ちる | `verify_quotes.py::cmd_check_courtesy_names` | `test_courtesy_name.py` |
| `source.bookId`／`volume` | 出典はこの書のこの巻（カタログに実在し、巻の索引を持つ書だけ） | `validate_emperors.py::check_quote_containers` | `test_quote_containers.py` |
| （同上・実体照合） | 名乗る巻がコーパスに実在し、引用が**その巻の中**に在る | `verify_quotes.py::cmd_check_volumes` | `test_quote_containers.py` |
| `quotes[]` | この断片が底本に実在する（`bookId` ＋ 任意の `volume` を持つ） | `verify_quotes.py::cmd_check` | `test_quote_containers.py` |
| `claim` | いま正しいと判断している内容（前向き・**任意**） | `validate_emperors.py::check_claim_fields` | `test_claim_field.py` |
| `conflicts[]` | 採用値が実フィールドと一致し、対立が記録されている | `validate_emperors.py::check_conflicts` | `test_conflicts_field.py` |
| `deathCause.category`／`accessionRoute.categoryId` ほか ID 参照 | `meta.catalogs` に実在する ID である | `validate_emperors.py::check_record_catalog_refs` | （カタログ側の実在で担保） |
| `confidence` | **欄ごとの定義がまだ書けていない**（語彙の検査だけが在る。かつて #48 と一緒に片づける想定だったが #48 は 2026-08-03 に現状維持で close） | `validate_emperors.py::check_confidence` | （無し） |

**`confidence` の行は、この表の使い方の例でもある** — 語彙（high/medium/low）は検査できているが
「何に対する確信か」が欄で違うので、**主張の列がまだ書けていない**。書けるまでは新しい欄を
この形で増やさない。

## 配布物に置かないと決めたもの

| もの | 置き場所 | 理由 |
|---|---|---|
| 丸める前の月日 6,258値 | `data/internal/event-date-archive.json` | 原表記と換算を全件では残せておらず、機械で真偽を区別できない |
| 引用照合の判定 | `data/quote-refs.json`（内部 QA 用の台帳） | 配布物の主張ではなく「どのファイルで確認したか」の作業記録 |
| 散文 `note` の中の引用 | `note` に残す（ゲートの対象外） | 書名は名乗るが巻を名乗らないので、巻まで機械で照合できない |
