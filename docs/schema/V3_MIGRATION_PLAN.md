# データスキーマ v3 移行設計（Issue #22）

新サイト（ゼロベース再構築）で使うための `data/emperors.json` / `data/kinship.json` のスキーマ改訂設計と、その実施記録。

**状態: 実装完了（2026-07-29）**。3 コミットで移行し、`validate_emperors.py`／`validate_kinship.py`／`verify_calendar.py`／`verify_quotes.py --check-coverage` の4本すべてが 0 エラー（既存の警告2件のみ）。`emperors.json` は `schemaVersion 3.0.0`、`kinship.json` は `2.0.0`。

**2026-07-31 追記（Issue #27・regimes の分割）**: 本移行では regimes を旧 `dynasty` の `(section, name)` 複合キーから機械導出したが、この前提は不正確だった — **同じ調査ブロックの中で同じ国号を名乗った別勢力が1つの政権に合併する**。隋末群雄の「梁」（梁師都／蕭銑）と「楚」（林士弘／朱粲）の2組4人が該当し、原典（旧唐書 巻五十六）で別政権と確認のうえ `xiaoxian-liang`・`zhucan-chu` を新設して分割した。**政権は 87 → 89 件**、`sortOrder` は 43 以降を +2 で振り直し、`suimo-chu` の label は「楚（隋末）」→「楚（林士弘）」へ改めた。以下の本文にある「87 政権」「`(section, name)` で一意」は移行時点の記述としてそのまま残してある。

- 起点: GitHub Issue #22「データファイルのスキーマ改善」
- 作業ブランチ: `data-schema-v3`
- 作成: 2026-07-29
- 版: `emperors.json` `schemaVersion 2.0.0 → 3.0.0` / `kinship.json` `1.0.0 → 2.0.0`

## 0. 確定済みの前提（2026-07-29 ユーザー決定）

| # | 決定事項 |
|---|---|
| D1 | **時代 enum は 11 区分**。Issue 提案の 10 区分に「近代」を追加して中華帝国（袁世凱）を収容。明清交替期（南明・順・西）は**前王朝側＝明**、呉周は清、仲家（袁術）は三国・西晋、桓楚は東晋・十六国 |
| D2 | **kinship.json も同時移行する**（凍結ルールの例外。ただし調査内容＝note・出典・エッジの意味は変更しない。変えるのはキー名と語彙の ID 化のみ） |
| D3 | **全 enum を安定 ID 化する**（即位経路・時代・政権だけでなく死因・確度・軸・続柄・kinship 側語彙まで）。日本語ラベルは `meta.catalogs` に集約 |
| D4 | **ID は全体を kebab-case に統一**（`sui-tang`・`three-kingdoms-jin`）。旧 U1 |
| D5 | **`flags.selfProclaimed` は廃止**（`axes.throneSource`＋`procedure`＋`standing` で代替）。旧 U2 |
| D6 | 政権の性格: **武周・南明・北元＝`orthodox`／西遼＝`coexisting`**、他は現行 `dynasty.category` の政権単位の値を継承。旧 U3 |
| D7 | `dynastyOrder` の悉皆調査は**別 Issue**。v3 では `regimes[].dynastyOrderSurveyed`（boolean）を追加し、サイトが「全部 null か」を推論しなくてよいようにする。旧 U4 |
| D8 | 「表示用確定項目」の追加は**新サイトの画面設計が出てから**。v3 は Issue #22 の範囲に限定。旧 U5 |
| D9 | 英語ラベルは `catalogs` に **`labelEn` の枠だけ**用意（値の投入は英語版タスク）。旧 U6 |
| D10 | `kinship.persons[].regimeId` は **v3 では入れない**（415人分の政権帰属は別調査。persons は `researchSection`＋`eraId` のみ） |

サイト互換は考慮しない（この設計を書いた時点では旧サイトを削除済みだった）。

**2026-07-30 追記**: ゼロベース再構築を取り下げ、旧サイト（`site/`）を復元して v3 に対応させた。ラベル解決は `site/src/lib/data-source.ts` の一点に閉じ、レコードの ID を `meta.catalogs` からラベルへ引いてから下流に流す方式（サイト内部は従来どおり表示ラベルで集計・分岐する）。あわせて、D3 で「カタログに集約する」としながら未投入だった kinship 側の語彙4件（`kinshipPersonKind`・`kinshipInclusionReason`・`kinshipRelation`・`kinshipSuccessionCategory`）を `meta.catalogs.enums` へ追加し、`validate_kinship.py` の `check_enum_catalogs` で語彙とカタログの突合を CI ゲートにした。サイト側の対応内容は `site/AGENTS.md` の「スキーマ v3 の ID→ラベル解決」節。`catalogs.eras`（11区分）はサイトが採っていない（通史年表の時代帯・王朝フィルタが `ERA_BY_SECTION` の15区分に合わせて作られているため。寄せるなら年表の再設計が必要）。

---

## 1. 現状の実測（問題の裏付け）

すべて 2026-07-29 時点の実データ計測値。

**(a) `dynasty.section` は調査ブロック名で、時代区分ではない**
- 31 種。`秦（始皇帝以降）`（＝秦＋前漢）、`新`（＝新＋玄漢）、`宋遼西夏金`（52人）のように調査の都合で切られている
- 政権単位で一意になるのは `(section, name)` の複合キーで、**87 政権**（※この前提は不正確。同一 section 内の同名別政権が合併する — 冒頭の 2026-07-31 追記を参照）

**(b) `dynasty.category` は「政権の性格」と「個人の称帝経緯」の混在**
- 3 値（正統王朝 214 / 並立政権 106 / 反乱・自称政権 45）だが、**15 政権では同一政権の中に複数 category が同居**する（例: `南朝/梁` に 正統 5・反乱 4、`北朝/北魏` に 正統 12・反乱 3・並立 3）
- 「反乱・自称政権」45人の中身を見ると、**後唐荘宗・後晋高祖（石敬瑭）・後周太祖（郭威）・明成祖（永楽帝）・清太宗（皇太極）・金海陵王・金世宗・南宋端宗・南宋衛王**など、その政権の正規の皇帝が多数含まれる。タグが指しているのは政権の性格ではなく**その人の即位の経緯**
- この混在は `data/schema/EMPERORS_SCHEMA.md` の `dynasty.category` 行にも既に注記されている（既知の負債）

**(c) `flags.selfProclaimed` も第 3 の汚染軸**
- true 116 件。`dynasty.category == 反乱・自称政権` との不一致 **81 件**
- 多軸化済みの `accessionRoute.axes` とも整合しない（`selfProclaimed: true` かつ `throneSource: 前代君主から継承` が 57 件、逆に `selfProclaimed: false` かつ `自立` が 17 件）
- → v3 で**廃止した**（D5）

**(d) `accessionRoute.category` の enum が壊れている**
- schema の enum は 14 要素だが、`受禅（易姓）`・`自立`・`推戴`・`継承（経緯記載なし）` が**重複記載**、`受禅（擁立）` は**実データ 0 件**
- 実在するのは 8 値のみ: 世襲 120 / 擁立 97 / 自立 48 / 簒奪 28 / 推戴 23 / 受禅（易姓）18 / 継承（経緯記載なし）17 / 内禅 14 ＝ 365

**(e) `reigns[].dynastyOrder`（第 N 代）は 51 政権で全 null**
- 全 365 人中 204 人が全在位 null。うち大半は「政権まるごと未調査」（隋以降のほぼ全政権）。現行仕様では「政権内に 1 つでも値があれば null＝歴代に数えない」「全部 null なら未調査＝在位順から機械導出」という**サイト側ロジック前提**の設計 → Issue の方針（サイトはロジックを持たない）と直接衝突するため、v3 で `regimes[].dynastyOrderSurveyed` を追加して推論を排除した（D7。悉皆調査は別 Issue）

**(f) kinship.json の依存**
- `persons[].section` 415 件が emperors.json の section 語彙に依存。`scripts/validate_kinship.py:468` が **emperors.json から語彙集合を導出**しているため、キー名を変えた瞬間に kinship 側の CI が落ちる（両ファイル＋両バリデータは 1 コミットで移行する必要がある）
- `edges[].category`（succession 309 件）は emperors の 8 値に加えて **`復位` を持つ 9 値**。emperors 側では復位は `reigns[].isRestoration` が担うため、**語彙は同一ではない**（単純コピーはできない）

---

## 2. v3 の全体構造

```jsonc
{
  "meta": {
    "schemaVersion": "3.0.0",
    "catalogs": {
      "eras":    [{ "id": "sui-tang", "label": "隋・唐", "sortOrder": 5, "yearHint": "581〜907" }],
      "regimes": [{ "id": "southern-liang", "name": "梁", "label": "梁（蕭梁）",
                    "eraId": "northern-southern", "category": "orthodox",
                    "startYear": 502, "endYear": 560, "sortOrder": 30 }],
      "enums": {
        "regimeCategory":   [{ "id": "orthodox", "label": "正統王朝" }],
        "emperorStanding":  [{ "id": "regular",  "label": "正規の皇帝" }],
        "accessionCategory":[{ "id": "hereditary", "label": "世襲", "description": "..." }],
        "deathCause":       [{ "id": "illness", "label": "病死" }]
        // ... §7 の全 enum
      }
    }
  },
  "emperors": [{
    "id": "liang-wudi",
    "eraId": "northern-southern",     // 時代ジャンプ・並び順（denormalized）
    "regimeId": "southern-liang",     // 政権の一意 ID
    "standing": "regular",            // 正規の皇帝 / 対立・僭称（§5 新設）
    "researchSection": "南朝",        // 旧 dynasty.section（調査ブロック・SOURCE_MAPPING の鍵）
    "accessionRoute": {
      "categoryId": "hereditary",     // 表示用の確定値（axes から導出・検証済み）
      "axes": { "throneSource": "inherited", "...": "..." }
    }
  }]
}
```

**原則**

1. **レコードは ID のみを持ち、日本語ラベルは `meta.catalogs` にしか置かない**（D3）。多言語対応がデータ側で完結し、ラベル変更が全 365 レコードに波及しない
2. **サイトは優先順位ロジックを持たない**。表示に必要な確定値（`eraId`・`regimeId`・`standing`・`accessionRoute.categoryId`）はデータ側が持ち、サイトは catalogs を引くだけ
3. `eraId` は `regimes[].eraId` の非正規化コピー（Issue の例に準拠）。**両者の一致はバリデータで担保する**
4. 旧 `dynasty` オブジェクトは解体し、`name` は `regimes` カタログへ、`section` は `researchSection` へ、`category` は §5 のとおり 2 つに割る

---

## 3. eraId（11 区分・D1 で確定）

| # | id | label | 目安年代 | 含む政権（例） |
|---|---|---|---|---|
| 1 | `qin-han` | 秦・漢 | 前221〜220 | 秦・前漢・新・玄漢・後漢・赤眉漢・成家・梁（劉永） |
| 2 | `three-kingdoms-jin` | 三国・西晋 | 197〜316 | 仲家（袁術）・魏・蜀漢・呉・西晋 |
| 3 | `eastern-jin-sixteen` | 東晋・十六国 | 306〜439 | 東晋・十六国各政権・桓楚 |
| 4 | `northern-southern` | 南北朝 | 399〜589 | 宋斉梁陳・後梁・侯景漢・北魏・東西魏・北斉・北周 |
| 5 | `sui-tang` | 隋・唐 | 581〜907 | 隋・隋末群雄・唐・武周・安史燕ほか唐代の並立政権 |
| 6 | `five-dynasties` | 五代十国 | 907〜979 | 五代・十国 |
| 7 | `song-liao-jin-xia` | 宋・遼・金・西夏 | 916〜1279 | 北宋・南宋・遼・西遼・金・西夏・楚（張邦昌）・斉（劉豫） |
| 8 | `yuan` | 元 | 1260〜1378 | 元・北元・元末群雄 |
| 9 | `ming` | 明 | 1368〜1662 | 明・南明・順・西 |
| 10 | `qing` | 清 | 1636〜1945 | 清・周（呉三桂） |
| 11 | `modern` | 近代 | 1915〜1916 | 中華帝国（袁世凱） |

**規約（バリデータ実装時の注意）**

- 時代は**慣用区分であり、年代の排他的な区間ではない**。北魏（399〜）は十六国の期間に始まるが南北朝に属し、遼（916〜）は五代の期間に始まるが宋遼金夏に属する。**年幅の重なりをエラーにするチェックは書かない**
- 並び順は `sortOrder`（上表の #）で持つ。開始年ソートでは上記の重なりにより意図した順にならない
- `researchSection` → `eraId` は**一意に決まらない**（`晋` → 三国・西晋／東晋・十六国、`清` → 清／近代）。era は政権単位で割り当てる

---

## 4. regimes カタログ（87 政権 ※現在は89政権 — 冒頭の 2026-07-31 追記を参照）

**命名規約**: 小文字 kebab-case。同名国号は方位・人名・時代で修飾（`southern-liang` / `liangshidu-liang` / `later-liang`）。既存の皇帝 `id` の接頭辞（`wudai-houliang-*` 等）とは意図的に別体系にした（皇帝 id は既存資産のため一切変更しない）。

`name` は国号そのもの（表示上の曖昧さを許容）、`label` は一覧・凡例に出す曖昧性のない表示名。

`startYear`/`endYear` は**表示用のヒントであって権威ある区間ではない**（§3 の era と同様）。唐 618〜907 の内側に武周 690〜705 が入るように、政権の年幅は入れ子・重複しうる。帯グラフ等で重ならないことを前提にしない。

#### 1. `qin-han`（秦・漢）

| regimeId | name | label | 在位年幅 | 人数 | 提案 category | 現 researchSection |
|---|---|---|---|---|---|---|
| `qin` | 秦 | 秦 | 前221〜前207 | 2 | `orthodox` | 秦（始皇帝以降） |
| `western-han` | 前漢 | 前漢 | 前202〜6 | 14 | `orthodox` | 秦（始皇帝以降） |
| `xin` | 新 | 新 | 8〜23 | 1 | `orthodox` | 新 |
| `xuanhan` | 玄漢（更始） | 玄漢（更始帝） | 23〜25 | 1 | `orthodox` | 新 |
| `chengjia` | 成家 | 成家（公孫述） | 25〜36 | 1 | `rebel` | 成家 |
| `chimei-han` | 漢（赤眉軍） | 漢（赤眉軍） | 25〜27 | 1 | `rebel` | 漢（赤眉軍） |
| `eastern-han` | 後漢 | 後漢 | 25〜220 | 14 | `orthodox` | 後漢 |
| `liuyong-liang` | 梁 | 梁（劉永） | 26〜27 | 1 | `rebel` | 梁 |

#### 2. `three-kingdoms-jin`（三国・西晋）

| regimeId | name | label | 在位年幅 | 人数 | 提案 category | 現 researchSection |
|---|---|---|---|---|---|---|
| `zhongjia` | 仲家 | 仲家（袁術） | 197〜199 | 1 | `rebel` | 仲家 |
| `cao-wei` | 魏 | 魏（曹魏） | 220〜266 | 5 | `orthodox` | 三国時代 |
| `shu-han` | 蜀漢 | 蜀漢 | 221〜263 | 2 | `orthodox` | 三国時代 |
| `eastern-wu` | 呉 | 呉（孫呉） | 229〜280 | 4 | `orthodox` | 三国時代 |
| `western-jin` | 西晋 | 西晋 | 266〜316 | 5 | `orthodox` ※混在→§5 | 晋 |

#### 3. `eastern-jin-sixteen`（東晋・十六国）

| regimeId | name | label | 在位年幅 | 人数 | 提案 category | 現 researchSection |
|---|---|---|---|---|---|---|
| `cheng-han` | 成漢 | 成漢 | 306〜347 | 5 | `coexisting` | 成漢 |
| `former-zhao` | 前趙（漢趙） | 前趙（漢趙） | 308〜329 | 5 | `coexisting` | 前趙 |
| `eastern-jin` | 東晋 | 東晋 | 318〜420 | 11 | `orthodox` | 晋 |
| `later-zhao` | 後趙 | 後趙 | 330〜351 | 7 | `coexisting` | 後趙 |
| `former-qin` | 前秦 | 前秦 | 352〜394 | 5 | `coexisting` | 前秦 |
| `former-yan` | 前燕 | 前燕 | 352〜370 | 2 | `coexisting` | 前燕 |
| `former-liang` | 前涼 | 前涼 | 354〜355 | 1 | `coexisting` | 前涼 |
| `western-yan` | 西燕 | 西燕 | 384〜394 | 4 | `coexisting` | 西燕 |
| `later-qin` | 後秦 | 後秦 | 386〜417 | 3 | `coexisting` | 後秦 |
| `later-yan` | 後燕 | 後燕 | 386〜407 | 6 | `coexisting` | 後燕 |
| `southern-yan` | 南燕 | 南燕 | 400〜410 | 2 | `coexisting` | 南燕 |
| `huan-chu` | 楚（桓楚） | 楚（桓楚） | 403〜404 | 1 | `rebel` | 楚 |
| `hexia` | 夏 | 夏（赫連夏） | 419〜431 | 3 | `coexisting` | 夏 |

#### 4. `northern-southern`（南北朝）

| regimeId | name | label | 在位年幅 | 人数 | 提案 category | 現 researchSection |
|---|---|---|---|---|---|---|
| `northern-wei` | 北魏 | 北魏 | 399〜535 | 18 | `orthodox` ※混在→§5 | 北朝 |
| `liu-song` | 宋 | 宋（劉宋） | 420〜479 | 10 | `orthodox` ※混在→§5 | 南朝 |
| `southern-qi` | 斉 | 斉（南斉） | 479〜502 | 7 | `orthodox` | 南朝 |
| `southern-liang` | 梁 | 梁（蕭梁） | 502〜560 | 9 | `orthodox` ※混在→§5 | 南朝 |
| `eastern-wei` | 東魏 | 東魏 | 534〜550 | 1 | `orthodox` | 北朝 |
| `western-wei` | 西魏 | 西魏 | 535〜557 | 3 | `orthodox` | 北朝 |
| `northern-qi` | 北斉 | 北斉 | 550〜580 | 8 | `orthodox` ※混在→§5 | 北朝 |
| `houjing-han` | 漢（侯漢） ※ | 漢（侯漢） ※ | 552〜552 | 1 | `rebel` | 南朝 |
| `western-liang` | 後梁 | 後梁（西梁） | 555〜587 | 3 | `orthodox` | 南朝 |
| `chen` | 陳 | 陳 | 557〜589 | 5 | `orthodox` | 南朝 |
| `northern-zhou` | 北周 | 北周 | 559〜581 | 4 | `orthodox` | 北朝 |

※ `houjing-han` は移行時 `name` が `梁（簒奪・漢）`・`label` が `漢（侯景）` だったが、**2026-08-02 に両方とも `漢（侯漢）` へ改称した**（`name` が国号でなく簒奪の経緯を書いていて、画面には「梁・簒奪・漢」と出ていた）。以下の本文で旧名が出てくるのは移行当時の記録。

#### 5. `sui-tang`（隋・唐）

| regimeId | name | label | 在位年幅 | 人数 | 提案 category | 現 researchSection |
|---|---|---|---|---|---|---|
| `sui` | 隋 | 隋 | 581〜619 | 5 | `orthodox` ※混在→§5 | 隋 |
| `dingyang` | 定楊 | 定楊（劉武周） | 617〜622 | 1 | `coexisting` | 隋末群雄 |
| `liangshidu-liang` | 梁 | 梁（梁師都） | 617〜628 | 2 ※ | `coexisting` | 隋末群雄 |
| `suimo-chu` | 楚 | 楚（隋末） | 617〜622 | 2 ※ | `coexisting` | 隋末群雄 |
| `xiqin` | 秦（西秦） | 秦（西秦・薛挙） | 617〜618 | 2 | `coexisting` | 隋末群雄 |
| `liguigui-liang` | 涼 | 涼（李軌） | 618〜619 | 1 | `coexisting` | 隋末群雄 |
| `tang` | 唐 | 唐 | 618〜907 | 24 | `orthodox` ※混在→§5 | 唐 |
| `xu` | 許 | 許（宇文化及） | 618〜619 | 1 | `coexisting` | 隋末群雄 |
| `suimo-wu` | 呉 | 呉（李子通） | 619〜622 | 1 | `coexisting` | 隋末群雄 |
| `zheng` | 鄭 | 鄭（王世充） | 619〜621 | 1 | `coexisting` | 隋末群雄 |
| `suimo-song` | 宋 | 宋（輔公祏） | 623〜624 | 1 | `coexisting` | 隋末群雄 |
| `wu-zhou` | 周 | 周（武周） | 690〜705 | 1 | `rebel` | 唐 |
| `anshi-yan` | 燕 | 燕（安史） | 756〜763 | 4 | `coexisting` | 唐 |
| `zhuci-qin` | 秦（漢） | 秦→漢（朱泚） | 783〜784 | 1 | `coexisting` | 唐 |
| `lixilie-chu` | 楚 | 楚（李希烈） | 784〜786 | 1 | `coexisting` | 唐 |
| `huangchao-qi` | 斉 | 斉（黄巣） | 881〜884 | 1 | `coexisting` | 唐 |

※ この2政権は同名別政権の合併だった（Issue #27）。2026-07-31 に `xiaoxian-liang`「梁（蕭銑）」618〜621・`zhucan-chu`「楚（朱粲）」618〜621 を分離し、`suimo-chu` は「楚（林士弘）」617〜622（1人）へ改めた。

#### 6. `five-dynasties`（五代十国）

| regimeId | name | label | 在位年幅 | 人数 | 提案 category | 現 researchSection |
|---|---|---|---|---|---|---|
| `former-shu` | 前蜀 | 前蜀 | 907〜925 | 2 | `coexisting` | 五代十国 |
| `later-liang` | 後梁 | 後梁 | 907〜923 | 3 | `orthodox` ※混在→§5 | 五代十国 |
| `jie-yan` | 桀燕 | 桀燕（劉守光） | 911〜914 | 1 | `coexisting` | 五代十国 |
| `southern-han` | 南漢 | 南漢 | 917〜971 | 4 | `coexisting` | 五代十国 |
| `later-tang` | 後唐 | 後唐 | 923〜937 | 4 | `rebel` ※混在→§5 | 五代十国 |
| `yang-wu` | 呉 | 呉（楊呉） | 927〜937 | 1 | `coexisting` | 五代十国 |
| `min` | 閩 | 閩 | 933〜945 | 4 | `coexisting` | 五代十国 |
| `later-shu` | 後蜀 | 後蜀 | 934〜965 | 2 | `coexisting` | 五代十国 |
| `later-jin` | 後晋 | 後晋 | 936〜947 | 2 | `rebel` ※混在→§5 | 五代十国 |
| `southern-tang` | 南唐 | 南唐 | 937〜958 | 2 | `coexisting` | 五代十国 |
| `later-han` | 後漢 | 後漢（五代） | 947〜951 | 2 | `orthodox` | 五代十国 |
| `later-zhou` | 後周 | 後周 | 951〜960 | 3 | `orthodox` ※混在→§5 | 五代十国 |
| `northern-han` | 北漢 | 北漢 | 951〜979 | 4 | `coexisting` | 五代十国 |

#### 7. `song-liao-jin-xia`（宋・遼・金・西夏）

| regimeId | name | label | 在位年幅 | 人数 | 提案 category | 現 researchSection |
|---|---|---|---|---|---|---|
| `liao` | 遼 | 遼 | 916〜1128 | 9 | `orthodox` | 宋遼西夏金 |
| `northern-song` | 北宋 | 北宋 | 960〜1127 | 9 | `orthodox` | 宋遼西夏金 |
| `western-xia` | 西夏 | 西夏 | 1038〜1227 | 10 | `coexisting` | 宋遼西夏金 |
| `jin-jurchen` | 金 | 金 | 1115〜1234 | 10 | `orthodox` ※混在→§5 | 宋遼西夏金 |
| `southern-song` | 南宋 | 南宋 | 1127〜1279 | 9 | `orthodox` ※混在→§5 | 宋遼西夏金 |
| `zhangbangchang-chu` | 楚 | 楚（張邦昌） | 1127〜1127 | 1 | `coexisting` | 宋遼西夏金 |
| `liuyu-qi` | 斉 | 斉（劉豫） | 1130〜1138 | 1 | `coexisting` | 宋遼西夏金 |
| `western-liao` | 西遼 | 西遼 | 1132〜1213 | 3 | `rebel` | 宋遼西夏金 |

#### 8. `yuan`（元）

| regimeId | name | label | 在位年幅 | 人数 | 提案 category | 現 researchSection |
|---|---|---|---|---|---|---|
| `yuan` | 元 | 元 | 1260〜1370 | 11 | `orthodox` | 元 |
| `tianwan` | 天完 | 天完（徐寿輝） | 1351〜1360 | 1 | `coexisting` | 元 |
| `hanlin-song` | 宋 | 宋（韓林児） | 1355〜1367 | 1 | `coexisting` | 元 |
| `chen-han` | 陳漢 | 陳漢（陳友諒） | 1360〜1364 | 2 | `coexisting` | 元 |
| `ming-xia` | 夏 | 夏（明玉珍） | 1362〜1371 | 2 | `coexisting` | 元 |
| `northern-yuan` | 北元 | 北元 | 1370〜1378 | 1 | `rebel` | 元 |

#### 9. `ming`（明）

| regimeId | name | label | 在位年幅 | 人数 | 提案 category | 現 researchSection |
|---|---|---|---|---|---|---|
| `ming` | 明 | 明 | 1368〜1644 | 16 | `orthodox` ※混在→§5 | 明 |
| `shun` | 順 | 順（李自成） | 1644〜1645 | 1 | `rebel` | 明 |
| `southern-ming` | 南明 | 南明 | 1644〜1662 | 4 | `rebel` | 明 |
| `xi` | 西 | 西（張献忠） | 1644〜1647 | 1 | `rebel` | 明 |

#### 10. `qing`（清）

| regimeId | name | label | 在位年幅 | 人数 | 提案 category | 現 researchSection |
|---|---|---|---|---|---|---|
| `qing` | 清 | 清 | 1636〜1945 | 11 | `orthodox` ※混在→§5 | 清 |
| `wu-zhou-sanfan` | 呉周 | 周（呉三桂） | 1678〜1681 | 2 | `coexisting` | 清 |

#### 11. `modern`（近代）

| regimeId | name | label | 在位年幅 | 人数 | 提案 category | 現 researchSection |
|---|---|---|---|---|---|---|
| `empire-of-china` | 中華帝国 | 中華帝国（袁世凱） | 1915〜1916 | 1 | `coexisting` | 清 |

※ `category` 列は「政権の性格」への振り直し案（`orthodox` 正統王朝 / `coexisting` 並立政権 / `rebel` 反乱・自称政権）。「※混在→§5」が付いた 15 政権は、現行データで正統帝と反乱タグが同居しているもの＝§5 の個別判定対象を含む。

---

## 5. `dynasty.category` の解体（最大の判定作業）

現行 1 フィールドを **2 つに割る**。

| 新フィールド | 位置 | 値 | 意味 |
|---|---|---|---|
| `category` | `catalogs.regimes[]` | `orthodox` / `coexisting` / `rebel` | **政権の性格**。1 政権 1 値 |
| `standing` | `emperors[]` | `regular` / `rival` | **その政権の中でその人が正規の皇帝か、対立・僭称の皇帝か** |

**判定規則（案）**

まず**政権の同一性**を先に決め、そのうえで人物の `standing` を決める（この順序を守らないと「対立政権を建てた人」と「同じ政権の中の対立皇帝」が区別できない）。

*規則 A — 別 regime を立てる条件*（どちらかを満たすときのみ新 `regimeId`）
1. **国号を改めた**（例: 侯景は梁を制圧後に国号を「漢」へ改めた → `houjing-han`／桓玄の「楚」／李自成の「順」／武則天の「周」）
2. **国号は同じだが、慣用上べつの政権名で呼び分けられている継続・亡命・再興政権**（西晋/東晋・北宋/南宋・南明・北元・西遼）

*規則 B — `standing`*
- `regular` ＝ その regime の歴代皇帝。**即位の経緯が簒奪・自立・弑逆であっても `regular`**（経緯は `accessionRoute` が担う）
- `rival` ＝ 規則 A を満たさない（＝同じ国号のまま）が、同時期に並立して帝号を称し、その王朝の正史が帝紀を立てない者。**蕭正徳（正平）・蕭紀（天正）・蕭淵明（天成）・蕭荘（天啓）はここに入る**（国号は「梁」のまま＝`southern-liang` の `rival`。データ上の `commonName` が「〜政権」となっているのは呼称の便宜で、別 regime にはしない）

この規則により、現行データの `dynasty.name` の切り方（`梁` と `梁（簒奪・漢）` が別名になっている）はそのまま v3 の regime 分割と一致する。

> **2026-08-02 追記（Issue #35）**: この節は移行時点の記録なのでそのまま残すが、2点が現在の値と違う。
> ①`rival` の定義から「その王朝の正史が帝紀を立てない」を落とした（20人を機械照合すると並立でない `rival` が4人いる。現行の定義は [INCLUSION_CRITERIA.md](../../data/schema/INCLUSION_CRITERIA.md)）。
> ②「`commonName` が『〜政権』となっているのは呼称の便宜」と書いた5件は、`liang-houjing`（`houjing-han`）と名前が衝突していたため**人物名基準へ改名した**（「蕭正徳（臨賀王）」ほか）。`regimeId`・`standing` は当時のまま変えていない。

**判定の実施結果（2026-07-29 に確定）**

判定は次の 2 段でおこなった。

*(1) 調査済み政権（`dynastyOrderSurveyed: true` の 36 政権）* — `reigns[].dynastyOrder` が既に「その王朝の正史が帝紀を立てた君主か」を**人物ごとに個別調査した結果**なので、これをそのまま使う（新たな判定ではなく既存判定の再利用）。非 null＝`regular`、null＝`rival`。該当する `rival` は 14人:

| regime | 人物 |
|---|---|
| `liu-song` | 元凶劭・劉子勛（義嘉政権） |
| `southern-liang` | 蕭正徳（正平）・蕭紀（天正）・蕭淵明（天成）・蕭荘（天啓） |
| `northern-wei` | 拓跋余（南安王）・幼主元釗・元曄（東海王）・元愉（京兆王）・元法僧・元顥（北海王） |
| `northern-qi` | 高延宗（安徳王）・高紹義 |

この段で、現行タグが「反乱・自称政権」でも **司馬倫（西晋 `dynastyOrder=3`）・元朗（北魏 `11`）は `regular`** と確定した（要議論だった 2 件）。

*(2) 未調査政権（51 政権）* — 対象は現行「反乱・自称政権」タグの人物のみ。正史の帝紀の有無をローカルコーパスで確認して個別に判定した。

| 判定 | 人物 | 根拠 |
|---|---|---|
| `rival` 6人 | 楊侗（皇泰主）・楊浩 | 隋書 巻五は恭帝**侑**のみで侗の紀はない（`china-history/隋书/帝纪/第五章-卷五`）。楊浩は列伝（秦王浩）のみ |
| | 李裕（徳王）・李承宏・李熅（襄王） | 新唐書の諸子列伝のみ。宦官・吐蕃・朱玫による一時擁立 |
| | 朱友珪 | 旧五代史 梁書は太祖紀七＋末帝紀上中下で、**郢王友珪の紀を立てていない**（`china-history/旧五代史/后梁/`） |
| `regular`（別 regime の歴代） | 劉盆子・公孫述・劉永・袁術・桓玄・侯景・李自成・張献忠・北元昭宗・西遼3人・袁世凱・南明4人・武則天 | 規則 A で別 regime。政権の性格は `regimes[].category` が担う |
| `regular`（既存政権の歴代＝現タグが経緯フラグ） | 後唐荘宗・後唐末帝（李従珂）・後晋高祖・後周太祖・金海陵王・金世宗・南宋端宗・南宋衛王・明成祖・清太宗 | 旧五代史 庄宗紀/末帝紀/高祖紀/太祖紀、金史 海陵紀/世宗紀、宋史 二王紀、明史 成祖本紀、清史稿 太宗本紀がいずれも帝紀を立てる |

**確定値: `rival` 20人 / `regular` 345人。**

*漏れの確認（完全性スクリーニング）* — タグ由来の 49人以外の **316人**について `verification.notes`・`reigns[].note`・`accessionRoute.note` を「僭號/僭稱/僭即/偽位/対抗政権/自ら立て/傀儡」で機械スクリーニングし 46件ヒットしたが、すべて**自分の政権を持つ並立政権の君主**（十六国・隋末群雄・唐末の燕/秦/楚、張邦昌の楚、劉豫の斉ほか）か**傀儡だが歴代に数えられている皇帝**で、`rival` に該当する新規候補は 0 件だった。慕容詳・慕容麟（後燕内の帝号僭称）も `dynastyOrder` が 3・4 と付与済み＝歴代であり `regular`。したがって **`standing` は 20人を `rival`、残り 345人を `regular`** とする（後者は判定済みの規則の機械適用であり、新たなデータ生成ではない）。

**注意**: `reigns[].dynastyOrder` は判定の裏付けに使えない（§1(e) のとおり 51 政権が未調査の null）。

---

## 6. accessionRoute の v3 化

- `category`（日本語ラベル）→ **`categoryId`**（安定 ID）。実在 8 値のみ採用、重複と 0 件の `受禅（擁立）` は削除

| id | 現ラベル | 件数 |
|---|---|---|
| `hereditary` | 世襲 | 120 |
| `enthroned` | 擁立 | 97 |
| `self-established` | 自立 | 48 |
| `usurpation` | 簒奪 | 28 |
| `acclamation` | 推戴 | 23 |
| `abdication-received` | 受禅（易姓） | 18 |
| `succession-unspecified` | 継承（経緯記載なし） | 17 |
| `inner-abdication` | 内禅 | 14 |

- `axes` の各値も ID 化（§7）。導出ルール（`ADDITIONAL_SCHEMA.md` 1 節）は ID ベースに書き換えるが**判定内容は変えない**
- `note`・`source`・`confidence` は現状のまま（note 本文中の日本語ラベル表現は書き換えない＝引用整合ゲートに触れない）

---

## 7. 全 enum の ID 対応表（D3）

**emperors.json**

| フィールド | ID → 現ラベル |
|---|---|
| `regimes[].category` | `orthodox` 正統王朝 / `coexisting` 並立政権 / `rebel` 反乱・自称政権 |
| `standing` | `regular` 正規の皇帝 / `rival` 対立・僭称の皇帝 |
| `accessionRoute.categoryId` | §6 の 8 値 |
| `axes.throneSource` | `inherited` 前代君主から継承 / `abdication-received` 他政権から受禅 / `self-established` 自立 |
| `axes.titleOrigin` | `inherited` 継承 / `new` 新称 |
| `axes.decidedBy` | `self` 本人 / `predecessor` 先帝 / `third-party` 第三者 / `undetermined` 史料から決着不能 |
| `axes.decidedByAgents` | `officials` 臣下 / `military` 軍 / `eunuchs` 宦官 / `consort-kin` 外戚 / `empress-dowager` 母后 / `imperial-clan` 宗室 |
| `axes.decidedByBasis` | `existing-note` 既存note / `source-reread` 原典再読 |
| `axes.predecessorFate` | `natural-death` 崩御 / `violent-death` 横死 / `abdicated` 生前譲位 / `deposed` 廃位・追放 / `none` 該当なし |
| `axes.relationToPredecessor` | `son` 子 / `younger-brother` 弟 / `elder-brother` 兄 / `father` 父 / `grandson` 孫 / `nephew` 甥 / `uncle-younger` 叔父 / `uncle-elder` 伯父 / `mother` 母 / `cousin` 従兄弟 / `adopted-son` 養子 / `distant-kin` 同族（遠縁） / `affinal-kin` 外戚（その他） / `unrelated` 無血縁 / `other` その他 / `none` 該当なし |
| `axes.procedure` | `abdication-ceremony` 禅譲儀礼 / `inner-abdication` 内禅 / `normal` 通常の践祚 / `no-ceremony` 儀礼なし・自称 / `forged-edict` 偽詔・矯詔 |
| `deathCause.category` | `illness` 病死(161) / `assassination` 暗殺(96) / `execution` 処刑(35) / `unknown` 不詳(35) / `suicide` 自尽(15) / `disputed` 諸説あり(15) / `killed-in-battle` 戦死(7) / `accident` 事故死(1) |
| `confidence` / `datePrecision` | 既に ID（`high`/`medium`/`low`、`day`/`month`/`year`/null）＝変更なし |

※ `abdication-received`（受禅（易姓））と `axes.throneSource` の `abdication-received`（他政権から受禅）のように**フィールドをまたいで同じ ID 文字列を使う**箇所がある。enum 集合はフィールドごとに独立して定義・検証する（§9-4）ため衝突ではない。全体で一意にしたい場合は接頭辞（`accession:`／`axis:`）を付ける案もある（U1 と同時に決める）。

**kinship.json**

| フィールド | ID → 現ラベル |
|---|---|
| `persons[].kind` | `imperial-clan` 宗室(146) / `posthumous-emperor` 追尊皇帝(64) / `consort-princess` 后妃・公主(181) / `consort-kin` 外戚(6) / `other` その他(18) |
| `persons[].inclusionReason` | `first-degree` 一親等 / `posthumous-emperor` 追尊皇帝 / `on-path` 経路上 / `marriage-party` 婚姻当事者 / `coup-party` 政変当事者 / `ruler` 歴代君主 |
| `edges[].relation`（kinship） | `birth-father` 実父(517) / `birth-mother` 実母(182) / `adoptive-father` 養父(15) / `adoptive-mother` 養母(2) / `sibling` 兄弟姉妹(3) / `remote-ancestor` 遠祖(2) |
| `edges[].category`（succession） | §6 の 8 値 ＋ **`restoration` 復位(9)**（emperors 側に対応値なし・維持する） |
| `edges[].veracity` | `verified` / `disputed` / `claimed`（既に ID・変更なし） |
| `edges[].relationToPredecessor` | emperors の `axes.relationToPredecessor` と同一語彙を共有 |

---

## 8. kinship.json の移行（D2）

| 現 | v3 | 変換 |
|---|---|---|
| `persons[].section` | `researchSection` | 機械的リネーム（値そのまま） |
| （新設） | `persons[].eraId` | **29/31 の section は一意に era へ写せる**。`晋`(34人)・`清`(8人) の計 42 人のみ個別判定（西晋/東晋・清/中華帝国の切り分け） |
| （入れない） | ~~`persons[].regimeId`~~ | **v3 では追加しない**（D10）。kinship の persons は複数政権にまたがる section に集中しており（北朝51・南朝51・五代十国41・秦（始皇帝以降）37・晋34）、機械規則では大半が null になる。415人の政権帰属は別調査 |
| `edges[].category` | `categoryId` | §7 の 9 値へ ID 化 |
| `edges[].relation` / `persons[].kind` / `inclusionReason` | 同名のまま値のみ ID 化 | 機械置換 |
| `meta.schemaVersion` | `2.0.0` | — |

調査内容（note・source・エッジの向きと意味）は**一切変更しない**。KINSHIP_SCHEMA.md は「凍結」扱いだが、今回は D2 により語彙 ID 化の範囲でのみ改訂する（再調査を発生させない）。

---

## 9. 検証・CI

`scripts/validate_emperors.py` に追加：

1. `catalogs.eras[].id` / `regimes[].id` の一意性、`sortOrder` の一意性
2. 全レコードの `regimeId` / `eraId` が catalogs に存在する
3. **`emperor.eraId == regimes[emperor.regimeId].eraId`**（非正規化コピーの整合）
4. 全 enum 値が `catalogs.enums` の ID 集合に含まれる（ハードコード enum を廃し catalogs 参照に一本化）
5. `accessionRoute.categoryId` が `axes` からの導出値と一致（既存 `check_accession_axes` の ID 化書き換え）
6. `standing` と `regimes[].category` の相互整合（`rebel` 政権に `rival` は出現しない 等）
7. カタログに 1 人も所属しない政権が無い（孤児カタログ検出）

`scripts/validate_kinship.py`：

- 468 行の `sections = {e["dynasty"]["section"] …}` を `researchSection` ベースへ。`persons[].eraId` は emperors の catalogs と突合
- `check_axes_sync`（emperors の `axes.relationToPredecessor` との突合）と `check_coverage`（`accessionRoute.category` 参照）を ID 語彙へ書き換え
- `edges[].categoryId` の語彙を「emperors の 8 値 ＋ `restoration`」で定義

**引用・日付は触らないため `verify_quotes.py` / `verify_calendar.py` は今回のゲートではない**（note 本文を書き換えないことが前提。書き換えるなら両ゲート必須）。

---

## 10. 影響ファイル一覧

| ファイル | 内容 |
|---|---|
| `data/emperors.json` | `meta.catalogs` 新設・365 レコード改訂・`schemaVersion 3.0.0` |
| `data/kinship.json` | persons 415・edges 1111・meta |
| `data/schema/emperors.schema.json` | `$defs/dynasty` 解体・`$defs/accessionRoute` 改訂・catalogs 定義追加・enum 重複除去 |
| `scripts/validate_emperors.py` | §9 |
| `scripts/validate_kinship.py` | §9（**emperors.json と同一コミットで**） |
| `data/schema/EMPERORS_SCHEMA.md` | dynasty 節の全面書き換え（76 行の「name+section 複合キー」記述は regimeId に置換） |
| `data/schema/ADDITIONAL_SCHEMA.md` | 即位経路 1 節の ID 化 |
| `data/schema/KINSHIP_SCHEMA.md` | §8 |
| `data/schema/INCLUSION_CRITERIA.md` | 42 行の `dynasty.category` 説明（旧値のまま）・41 行 `selfProclaimed` 説明 |
| `docs/schema/SCHEMA_OVERVIEW.md` | 索引更新 |
| `docs/PROJECT_STATUS.md` / `CHANGELOG.md` / `CLAUDE.md` | 版と申し送り |
| `.github/workflows/validate-data.yml` | **変更不要（確認済み）**。paths フィルタとスクリプト実行のみで、フィールド名・schemaVersion への参照なし |
| `docs/process/SOURCE_MAPPING.md` | **改修不要**（`researchSection` として旧 section 語彙をそのまま保持するため） |
| `data/quote-refs.json` / `data/emperor-videos.json` | `section`/`dynasty` キーを持たないため影響なし（確認済み） |

---

## 11. 作業手順と自動化の線引き

**コミット単位（加算 → 移行 → 削除の 3 段）**

**原則**: *既存フィールドの値を書き換える変更は、それを検査するバリデータの改修と同じコミットに入れる*（分けると CI が赤いコミットが残る）。`validate_emperors.py` は「スキーマに `additionalProperties:false` を機械付与した厳格版」で構造ドリフトを検出するため、**フィールド追加は必ず同一コミットで `emperors.schema.json` を更新する**。

1. **カタログ追加（純加算）**: `meta.catalogs`（eras 11・regimes 87・enums）＋ schema 定義＋カタログ構造チェック。既存フィールドは一切触らない
2. **新フィールド追加（純加算）**: 365 レコードに `eraId`/`regimeId`/`researchSection`/`standing`/`accessionRoute.categoryId` を付与。kinship にも `researchSection`/`eraId` を追加。**既存の値は変更しない**ので `check_accession_axes`・`validate_kinship.py` は現行のまま通る
3. **値の ID 化と旧フィールド削除**: `axes`・`deathCause.category`・kinship の `relation`/`kind`/`inclusionReason`/`category` を ID へ変換し、`dynasty`・`accessionRoute.category`・`flags.selfProclaimed` を削除。`check_accession_axes`・`check_axes_sync`・`check_coverage`・`validate_kinship.py:468` を ID 語彙へ書き換え、両ファイルの `schemaVersion` を上げ、ドキュメント一式を更新

各コミットの後に **4 本すべて**を通す（CI は `data/**` の変更でこの 4 本を回すため）:
`validate_emperors.py` / `validate_kinship.py` / `verify_calendar.py` / `verify_quotes.py --check-coverage`

**CONSTRAINTS.md「read-modify-write の徹底」との関係**: v3 は全 365 レコード＋`meta` を書き換えるため、id 単位の read-modify-write では表現できない。**この移行は同ルールの意図的な一度きりの例外**とし、代わりに (1) 着手前に他セッション・他ワークツリーの未コミット変更がないことを確認（2026-07-29 実施済み・作業ツリーはクリーン）、(2) 各コミット前に `git diff --stat` と差分キーの一覧を確認する、で担保する。

**自動化してよい範囲**（CLAUDE.md「スクリプトによる自動生成禁止」の機械的補助の例外）
- 確定済み値のリネーム・ID 置換（日本語ラベル → ID の 1:1 変換）
- `researchSection` への値コピー、カタログの整合チェック

**個別判定が必須（スクリプト禁止）** — §5・D6 で 2026-07-29 に実施済み
- `standing`（調査済み政権は既存 `dynastyOrder` の判定を再利用、未調査政権の 6 人は原典で帝紀の有無を確認）
- 武周・北元・南明・西遼の政権 `category`（D6）
- kinship persons 42 人（`晋`・`清` section）の era 切り分け

---

## 12. 決定事項（旧「未決事項」・2026-07-29 にすべて確定）

U1〜U6 は §0 の D4〜D9 として確定済み（推奨案どおり）。追加で D10（kinship persons に `regimeId` を入れない）を確定した。

v3 のスコープ外として明示的に切り出したもの:

- `dynastyOrder` の悉皆調査（51政権〔2026-07-31 の Issue #27 の分割で53政権〕・別 Issue。v3 は `dynastyOrderSurveyed` フラグまで）
- kinship persons 415人の政権帰属（`regimeId`）。関連して `persons[].posthumous.dynasty`（追尊した王朝名）は自由記述の王朝名のまま残している——政権への参照だが、D10 と同じ理由で v3 では ID 化しない
- 表示用確定項目の追加（新サイトの画面設計後）
- `labelEn` の値投入（英語版タスク）
