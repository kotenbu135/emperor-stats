# Issue #36 — 素材 note と原典の食い違い（後漢初の小政権・五胡十六国）

紹介文（Issue #16）の執筆・敵対的検証で上がった30件（本文の A〜F 表28行＋コメント2行）を、
`_corpus_cache` と `china-history`／`daizhigev20` の原文へ当て直して処理した記録。

**件数の内訳**: Issue のタイトルは28件、本文冒頭は24件と書いているが、A〜F の表を数えると
**28行**あり、コメントの2行を足して **30行**が対象。完了はこの30行を分母に測る。

## 結果

| disposition | 件数 |
|---|---:|
| 訂正した（note のみ） | 24 |
| 訂正した（構造フィールド） | 4 |
| 指摘は正しいが値は変えず注記だけ足した | 1（F4） |
| 指摘の一部を採らなかった | 1（F3・下記） |

構造を動かしたのは4件:

- **B2** `chenghan-lishi.crownPrinceDepositionCount` 1 → **0**
- **F1** `qianzhao-liucan` 被反乱 `events[0]` の日付 null/`year` → **`0318-09`/`month`**
- **F5** `chenghan-lishou.name.templeName` null → **中宗**／`chenghan-lixiong.name.templeName` null → **太宗**
- **コメント2** `liu-yong-liang.reigns[0].startDate` `0026-01-07`/`day` → **null/`year`**

## 30行の台帳

`○` = 訂正、`△` = 注記のみ、`×` = 指摘を採らなかった。

| # | id | フィールド | 判定 | 根拠 |
|---|---|---|:--:|---|
| A1 | qianliang-zhangzuo | `deathCause.note` 続柄 | ○ | 従兄弟 → **甥**。『晋書』巻八十六の系譜標目「华子耀灵　灵伯父祚」・耀霊条「伯父长宁侯祚性倾巧」。`accessionRoute.axes.relationToPredecessor=uncle-elder`・kinship.json と一致させた |
| A2 | chenghan-liban | `reigns[0].note` 即位の資格 | ○ | 養子 → **兄・李蕩の子（甥）**。『晋書』成帝紀「六月，李雄死，其兄子班嗣伪位」・載記「以班非雄所生」。任氏の養育は華陽国志にあるが即位根拠として挙がらず、kinship.json も養父エッジを立てていない |
| A3 | chenghan-liqi | 被反乱 `events[0].note`／`deathCause.note` の続柄 | ○ | 従兄弟・従父 → **従叔父**。李驤は李特の弟＝李雄の叔父なので、その子の李寿は李期の父と同世代。kinship.json「先代李期の従叔父（父の従兄弟）」と一致させた |
| A4 | chenghan-liqi | 反乱鎮圧 note の李載の続柄 | ○ | 「従兄」の典拠が無い。載記は「尚書僕射、武陵公李載」と血縁を書かず、『華陽国志』は逆に「忌从子载多才艺，他事诛之」と従子。**血縁の記載を落とした** |
| A5 | huan-xuan | `accessionRoute.note` 手詔 | ○ | 原文「初，玄恐帝不肯为手诏，又虑玺不可得，逼临川王宝请帝自为手诏，因夺取玺」。(1) 否定が落ちて逆の意味、(2) 手詔を書いたのは安帝で臨川王宝ではない |
| A6 | chenghan-lishou | 親征 `events[0].outcome` の主体 | ○ | 李寿は罪を挙げて上奏し、**殺させたのは李期**（「期从之，于是杀越、骞等」） |
| B1 | chenghan-lishou | 改元 `events[0].note` | ○ | 「李期を弑して」→ **廃位・幽閉ののち自縊**（「寿矫任氏令，废期为邛都县公，幽之别宫」→「咸康三年，自缢而死」）。弑逆とする成帝紀・華陽国志も併記した |
| B2 | chenghan-lishi | 皇太子廃立 `count` | ○ | **1 → 0**。李広が太弟に立てられた記述が4史料いずれにも無い（載記「势弗许」／通鑑・華陽国志・十六国春秋「势不许」）。「贬广为临邛侯」は汉王からの降格で太弟の廃立ではない |
| B3 | chenghan-lishi | 改元 `events[1].note` | ○ | 李広は誅殺されておらず「贬广为临邛侯，广自杀」。斬られたのは馬当・解思明 |
| B4 | qianliang-zhangzuo | 親征 note の派遣将 | ○ | 「易揣・張瓘」→ **易揣・張玲**。「遣其将易揣、张玲率步骑万三千以袭之」。張瓘は討伐の対象 |
| B5 | qianliang-zhangzuo | `deathCause.note` 宋混の官 | ○ | 驃騎将軍 → **驍騎将軍**。通鑑「骁骑将军敦煌宋混兄修」・十六国春秋「先是骁骑将军炖煌宋混兄修素与祚有隙」。驃騎大将軍は張祚の死後の官 |
| B6 | qianzhao-liuyao | `deathCause.note` の年 | ○ | 「太和2年（329年）」→ **咸和3年（328年）の戦役・翌329年に処刑**。載記はこの戦役を「咸和三年」の記事の下に置き、同レコードの親征 events も 0328 |
| C1 | chenghan-lishi | 親征 note の出典ラベル | ○ | 「笮橋」「彭模」の記述は『晋書』**巻九十八 桓温伝**のもの（daizhigev20 の晋书全体で「笮桥」の出現は桓温伝の1箇所のみ）。李勢載記を典拠に掲げていたのを訂正 |
| D1 | qianzhao-liuyuan | `ages.note` の日付 | ○ | note だけが訂正前の 310-08-19 を指していた。実値は `0310-08-29`（河瑞2年7月18日・己卯） |
| D2 | qianzhao-liuhe | `ages.note` の日付 | ○ | 同上。実値は `0310-09-04`（河瑞2年7月24日・乙酉） |
| D3 | chenghan-lixiong | `ages.note` の元号換算 | ○ | 「咸和八年=334年」→ **咸和八年は333年**。採用値 334 は資治通鑑の咸和九年に依拠するもので変更なし |
| E1 | chenghan-liban | `ages.deathAge=47` | ○ | 華陽国志「年二十六，立为太子」＋「永昌元年冬，立班为太子」（322年）から逆算すると334年は数え38歳で、載記の47歳と**9歳差**。値は載記のまま、`confidence` を high → **medium** |
| E2 | chenghan-lixiong | `reigns[0].note` の元号 | ○ | 晏平（華陽国志・資治通鑑）／太武（載記）の割れと、晏平を採る理由を明記。値は変更なし |
| E3 | chenghan-lixiong | `deathCause.note` の月 | ○ | 「夏五月」の典拠が無い（通鑑は六月の記事群、華陽国志は「夏六月癸亥」で発病月を書かず、載記は「六日死」のみ）。**月の記載を落とした** |
| E4 | chenghan-liqi | `deathCause.note` の死に方 | ○ | 載記は自縊、『晋書』成帝紀「夏四月，李寿弑李期」・華陽国志「五月，乃杀期」は弑逆。category は載記のまま suicide、異説を追記 |
| E5 | chenghan-liqi | 改元・大赦・立后 `date=0334` | ○ | 載記依拠であることを明示。華陽国志「咸康元年春正月，立妻阎氏为后，下赦，改元玉恒」・通鑑は3件そろって335年正月。値は変更なし |
| E6 | qianliang-zhangzuo | `accessionRoute.note` の順序 | ○ | **2対2の割れ**。晋書（張軌伝・穆帝紀「是月，张祚弑耀灵而自称凉州牧」）＝僭称前／通鑑・十六国春秋＝355年八月の挙兵中＝僭称の後。叙述順は晋書系のまま、割れを明記 |
| E7 | qianzhao-liucong | `deathCause.note` | ○ | 載記に「吾寝疾惙顿，怪异特甚」があり病臥は原文に明記。category は unknown のまま、一句の存在を記録 |
| F1 | qianzhao-liucan | 被反乱の日付精度 | ○ | 元帝紀 太興元年「八月，冀、徐、青三州蝗。靳准弑刘粲，自号汉王」の月見出しにより **year → month**。旧暦太興元年八月＝318-09-12〜318-10-10 で多数月をとり `0318-09` |
| F2 | qianzhao-liuhe | `reigns[0].note` | ○ | 「同月に即位」→ **同日**。`startDate` が劉淵の `endDate` と同値、`startDateRaw` も「劉淵崩御と同日」 |
| F3 | huan-xuan | 改元・大赦の日精度と出所 | × | **壬辰の出所は『晋書』巻十 安帝紀「十二月壬辰，玄篡位，以帝为平固王」**で、桓玄伝の唯一の壬辰（「自以水德，壬辰，腊于祖」＝臘祭）ではない。指摘どおり note へ出所を明示し、`reigns` の conversion にも帝紀に日次がある旨を追記した。**ただし `reigns[0].startDate` の日精度化は採らなかった** — 採ると `startYear=403`（元興2年）と `startDate=0404-01-01` の年が食い違い、`validate_emperors.py` の年対応検査に落ちる。年またぎの扱いは Issue #34 と同型の別案件なので保留した |
| F4 | chenghan-lixiong／liban | 同一日 `0334-08-11` | △ | 通鑑「丁卯，雄卒，太子班即位」は**同日**で内部整合している。華陽国志は「夏六月癸亥」（334-08-07）と翌日「甲子，袭位」（334-08-08）。**値は変えず李班側の note に異説を追記**（李雄側の duration.source.note には既にあった） |
| F5 | chenghan-lishou／lixiong | `name.templeName` | ○ | 中宗・太宗を投入。下記「政権単位で先に確定した」を参照 |
| コメント1 | gengshi-di | `reigns[0].note`／`deathCause.note` | ○ | 淮陽王 → **長沙王**。淮陽王は張卬の封国（「卫尉大将军张卬为淮阳王」）。`deathCause.note` の「後に淮陽王を追贈」は劉玄伝に該当記事が無いため**削除** |
| コメント2 | liu-yong-liang | `reigns[0].startDate` | ○ | 『後漢書』光武帝紀上は「十一月甲午，幸怀。」と「刘永自称天子。」を**別段落**に置き、甲午は光武帝の行幸に付く。`day` → **`year`**（`startDate` を null）。記事の位置（十一月甲午＝26-01-07 と十二月丙戌の間）から `startYear=26` は維持。`duration.approxDays` 359 → 365・`reignSummary` も引き直した |

## F5 を「2人だけ」で入れなかった理由

規則 R-REGIME-FIRST は「人物単位の名前調査に入る前に、その政権の**書式・所在**を
`data/regime-conventions.json` に確定する」を要求し、成漢は未確定だった。
廟号の悉皆補充は Issue #37 の担当範囲でもある。
そこで**成漢の書式・所在を先に原典から確定し**（`data/regime-conventions.json` へ7件目として追加）、
そのうえで成漢5人を通して読んだ。

- **書式・所在**: 晉書 載記第二十一の各君主の記事**末尾**に「（伪）谥〈諡号〉，庙曰〈廟号〉，墓号〈陵名〉」が並ぶ。
  本紀型の冒頭定型ではないので、冒頭で探すと当たらない
- **例外2人**: 李班（末尾が「遂立雄之子期嗣位焉」で定型が付かない → 追諡の所在は華陽国志側・`other-source`）、
  李勢（末尾が「升平五年，死于建康。在位五年而败」で定型が付かない → `per-person`）
- 5人を読んだ結果、定型が付いていたのは李雄・李寿の2人で、李期は諡号のみ（「谥曰幽公」）。
  **「成漢は全員に廟号がある」のような値の主張は記録に書いていない**

`check_regime_conventions.py` は 0 errors（引用15件を原文と照合）。
`check_screenings.py` の母集団は 562 → 560、`templeName:unknown` は 182 → 180 へ `--update` で引き直した。

## 通したゲート

| ゲート | 結果 |
|---|---|
| `validate_emperors.py` | 0 errors（warnings 2件は既知・訂正待ち） |
| `verify_quotes.py --backfill --retry-unresolved && --check` | 0 errors（未解決 234 件は着手前と同数＝新規の未解決なし） |
| `verify_calendar.py` | 0 errors |
| `verify_quotes.py --check-books` | 既知の未トリアージ一覧のみ（エラー化しない設計） |
| `validate_kinship.py` | 0 errors |
| `validate_readings.py` | エラーなし |
| `check_regime_conventions.py` | 0 errors |
| `check_screenings.py` | 0 errors（`--update` 後） |
| `check_verification.py` | 0 errors |
| `coverage.py --write` | 廟号 70 → 72（19.2% → 19.7%）／即位日 328 → 327（年精度へ落とした劉永の分） |

## 途中で踏んだこと（手順の申し送り）

1. **note の作業ログに鉤括弧を使うと引用照合ゲートが原文引用として拾う。**
   「現行 X → Y に訂正」の X を `「…」` で囲むと `verify_quotes.py --backfill` が未解決として上げてくる
   （劉淵・劉和の ages.note で2件）。**捨てた側の値は鉤括弧なしで書く**。
   同様に、conversion に `sxtwl.fromLunar(25,11,30)` の**形のまま**「この方法は採らなかった」と書くと
   `verify_calendar.py` の B1 が生きた主張として読んで落ちる（劉永で1件）。
   これは既知の「散文は witness にならない」の裏返しで、**捨てた側の書き方にも書式の制約がある**。
2. **`quote_helper.py` はキャッシュに当たらないとコーパス全体へ落ちる**（数十秒＋大量の無関係ヒット）。
   人物の載記に無い語（例: 李班に「兄子」、劉曜に「太和」）を投げると起きる。
   **無いことを確かめたいときは `--book` で書を絞るか `/usr/bin/grep -c` を使う**ほうが速い。
3. **worktree からはコーパス依存のゲートが動かない**（`_corpus_cache` 等が `.gitignore` 対象で primary にしか無い）。
   `verify_quotes.py` は primary へフォールバックする実装だが、`check_regime_conventions.py` は
   スクリプト位置から解決するため引用照合が丸ごとスキップされ、**「0 errors」だけ見ると気付けない**
   （出力の「コーパスが無く15件は未照合」で判明）。worktree に4ディレクトリを symlink して解消した。
4. **`reignSummary` は `reigns` の合計と機械照合される。**
   `reigns[].duration` を触ったら `reignSummary.totalReignDuration`（`approxDays`・`displayYears`・
   `isExact`・`needsPreciseDays`）も同時に直す。`displayYears` は `totalReignDuration` の**中**にある。
   COUPLINGS.md の「日付フィールドの隣接フィールド」行に含まれるが、明示されていない。
