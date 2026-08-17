# 結合レジストリ — 「片方を変えたらもう片方も変える」対の一覧

このリポジトリで起きた事故のうち、**規則違反ではなく「規則が書かれていなかった」**型がある。
肖像を manifest から外したのに実体ファイルを消していない、表示名を変えたのに
かな検索テーブルを直していない、といった**結合**は、誰も規則として登録していなかった。

規則台帳（[RULES.yml](RULES.yml) の `R-COUPLING`）に対する実体がこの表である。
**検査の欄が空でも登録する価値がある** — 「知らなかった」が消えるのは登録した時点で、
検査はその後に足せばよい。逆に、検査だけあって登録が無いと、落ちてから理由を探すことになる。

書き足すのは**踏んだ時**でよいが、その場で足す。後から思い出せない。

## データ側

| 触るもの | 一緒に触るもの | 検査 |
|---|---|---|
| `data/emperors.json` の引用・日付 | `data/quote-refs.json`（照合台帳） | `verify_quotes.py --backfill && --check`・`verify_calendar.py`。**引用を変えるとハッシュが合わず落ちる＝迂回できない** |
| `data/emperors.json` の `name.*` に**欄を足す** | `site/scripts/build-data-distribution.mjs` の `COLUMNS`（配布 CSV の列） | **無い。ビルドは通ってしまう。** 2026-08-03 に `ethnicName`（単位3）と `courtesyName`（単位4）で**2回続けて手で思い出した**ので行にした。CSV は `emperors.json` の純射影なので、足さないと**配布物からその名乗りが丸ごと落ちる**（単位3では「クビライ（忽必烈）」を分けた結果、足すまで民族名がどの列にも無かった）。`emperors.json` 自体は無加工コピーなので影響しない |
| `name.*` の欄を**サイトの画面に出す** | `data/name-readings.json`（ふりがな） | **有る（ビルドが落ちる）。** `rubyOf` が漢字を含む未登録の表示名で throw する。2026-08-03 に字92人ぶん・幼名30人ぶんを出したとき116文字列の追記が要った。**対象の一覧は自分で数えず `site/.ruby-displayed.json`（ビルドが書き出す）から引く** — 時代ラベル・王朝名のサフィックス・補助名は `emperors.json` に無い形で作られる。**欄を足すときだけでなく、既に出ている欄へ新しい値を入れたときも同じ**（2026-08-10・西遼徳宗の字「重徳」でビルドが落ちた）。`validate_readings.py::displayed_strings` はそれまで諱・廟号・短縮諡の3欄しか見ておらず**ローカルのゲートが緑のまま CI が落ちた**ので、同日に姓・字・幼名・民族名・別名まで広げた。**欄の一覧の正は `site/src/lib/display-name.ts` の `emperorNameEntries`** で、ここが遅れると同じ落ち方をする。**`commonName` から派生させた文字列は広げた後もゲートの外**（`別称`＝括弧を外した残り・`元号`＝括弧の中を `/` で割ったもの）— `emperors.json` に無い形なので `validate_readings.py` からは見えず、`commonName` を触った日に同じ落ち方をする |
| `name.*` の**空セルを埋める**（転記） | `data/screenings.json` の該当記録の件数（`name-fields-issue37`・`courtesy-name-issue37`・`childhood-name-issue37`） | **半分だけ有る。** これらの絞り込みは**空セルを母集団に取る**ので、転記が進むたびに `n` とバケットの件数が動き、引き直さないと `check_screenings.py` が「母集団が記録と違います」で落ちる。**落ちるのはコーパスを使わない記録だけ** — `name-fields-issue37` は CI でも落ちるが、`courtesy-name-issue37`・`childhood-name-issue37` は CI にコーパスが無く件数の突合そのものを飛ばすので、**ローカルで引き直さないとずれたまま残る**。引き直しは `python3 scripts/screens/<名前>.py` を流して出た数を書き写すだけ（2026-08-10 の遼・金・西遼22人で踏んだ） |
| `name.posthumousName`（短縮呼称）を訂正する | `name.posthumousNameFull`（全長形）。逆向きも同じ | **有る（落ちる）。** `validate_emperors.py::check_posthumous_name_full` が「部分列 ＋ 諡の実字（末尾1字）の一致」を見るので、片方だけ動かすと噛み合わなくなって止まる。**片方が空なのは正しい**（原典が短縮形を与えない政権では全長形だけが入る）ので、落ちるのは両方在るときだけ |
| ある日付フィールドの訂正 | 同じ日付を持つ**隣接フィールド**（`reigns[].endDate` ↔ `ages.deathDate` ↔ `events[].date` ↔ note 内の日付引用） | 一部（`validate_emperors.py` の整合検査）。**旧値の文字列でレコード全体を grep して残存参照を列挙するのが訂正手順の定型**（2026-07-21 に JSON-LD へ旧値が出たまま公開された） |
| `dynastyOrder` の調査完了（`dynastyOrderSurveyed` を false → true にする） | その政権に属する**全在位の `reigns[].dynastyOrder` の欄**（値、または「歴代に数えない」の `null`） | `validate_emperors.py` の `check_dynasty_order`（surveyed false ⇒ 欄なし／true ⇒ 欄あり）。**双方向で落ちる** — フラグだけ立てても、欄だけ埋めても通らない（2026-08-03・Issue #69） |
| データの訂正 | `meta.status` と `docs/PROJECT_STATUS.md` | 無い（同時更新の運用ルール） |
| `events[]` の要素を**削除する**（`count` を減らす） | `data/internal/event-date-archive.json` の同じ id の退避エントリ | **有る（落ちる）。** `validate_emperors.py` の `[event-archive]` が「退避した月日の鍵が実在の event を指していません」で止める。2026-08-09 に `houliang-xuandi.capitalRelocationCount.e001`（別人の遷都）を落として実際に踏んだ。**`patch_emperor.py` はこの結合を出さない** — 出るのは `reignSummary` の対だけなので、削除のときは自分で archive を見る |
| 紹介文 `body` の**節見出しの書式**（行頭 `## `） | `site/src/app/emperors/[id]/page.tsx` の分岐・`scripts/validate_profiles.py` の `HEADING`・`scripts/check_profile_ngram.py` の `HEADING` の**3箇所** | **無い。3つとも黙って通る。** 表示側だけ変えると見出しが本文段落として出て、ゲート側だけ変えると見出しが定型文検出に混ざる（365本で同じ見出しを使うので、外さないと本物の定型文が埋もれる。2026-08-04 の文体改訂で発生） |
| 紹介文の**字数の上下限** | `scripts/validate_profiles.py` の `LEAD_MIN`/`LEAD_MAX`/`BODY_MIN`/`BODY_MAX`・`scripts/check_profile_fragment.py` の `LIMITS`（**2026-08-04 現在この2箇所だけ**。規約側の `meta.policy.length` と `profile-writing/STYLE.md`・`WRITER.md` は削除済み） | **無い。** 断片チェッカ（執筆段が走らせる）と本体ゲート（投入後）で値がずれると、**エージェントは通ったのに親セッションで落ちる**。2026-08-04 に上限を 700→2000→2200→2400 と3回動かし、そのたびに5箇所を手で揃えた |
| 紹介文の**執筆規約を変える** | **2026-08-04 に規約そのものを両方とも削除した**（`data/emperor-profiles.json` の `meta.policy` と `docs/process/profile-writing/STYLE.md`）。**規範を立て直すときも同じ対で作るか、置き場所を1つに決める** | **無い。** 2026-08-04 に引用符の規約を STYLE.md だけで緩め、`meta.policy.quotes` に正反対の旧規約が残った（`site/AGENTS.md` 経由で読んだエージェントは旧規約に従うことになる）。**同じ内容を2箇所に置いたのが原因**なので、立て直すときは1箇所にする |
| 新しく `note` を書く（訂正・新規調査） | 同じコンテナの `claim`（**任意**。note は作業ログで捨てた側の値が残るため、突合の向きが反転する） | `validate_emperors.py` の `check_claim_fields`（claim を持つコンテナだけ・評価件数を INFO で出す）。**書かなくても落ちない** — 遡及しない欄なので検出できるのは「書いたのに後ろ向き」だけ |
| `events[]` の日付を**新しく確定・訂正する** | 同じ要素の `*Raw`（原典の紀年表記）と `source.conversion`（`fromLunar(y,m,d[,leap])`・月精度は朔日アンカー `fromLunar(y,m,1)`）（**任意**・遡及しない） | `verify_calendar.py` の **B-5** が再演し、月精度は多数月を計算して照合する。**書かなくても落ちない** — 検出できるのは「書いたのに合わない」だけ。`patch_emperor.py` が該当パスでこの結合を出す |
| `events[]` に**要素を足す・消す** | 足した要素の `id`（`<皇帝id>.<容器>.eNNN`。`python3 scripts/migrations/bake_event_ids.py --fill`）。**消したときは外部参照を先に確認する** — `data/screenings.json` の `audit.findings[].id`・`validate_emperors.py` の `KNOWN_PREACCESSION_EVENTS`／`KNOWN_DEATH_EVENT_DATE`・`docs/process/RESIDUAL.md` の #62 の9件 | `validate_emperors.py` の `check_event_ids`（形・一意・**外部参照が1つの event に解決すること**）。`patch_emperor.py --append` は id を作れないので、足したあと `--fill` を回さないとここで落ちる |
| `events[]` の日付を**丸める・戻す**（主張範囲を動かす） | `data/internal/event-date-archive.json` （退避した月日）。**アーカイブに在る event の日付を訂正したら、アーカイブ側の値も同じタイミングで直すか消す** — 配布物の値は退避値の接頭辞でなければならない。精度を戻すときは `patch_emperor.py` で昇格させ、アーカイブから消す | `validate_emperors.py` の `check_event_date_archive`（鍵が実在の event を指すか・接頭辞になっているか）。数え直しは `python3 scripts/screens/date_claim_scope.py` |
| `rebellionSuppressionCount` と `rebellionSufferedCount` の**同一事象の日付・`leader`・`name`・`outcome`** | もう一方の容器の同じ事象（`ADDITIONAL_SCHEMA` 9節が「同一の反乱群を両面から集計したもの」と定めており、**食い違ってよい理由は4つに限定されている**。日付はその4つに入らない） | **無い。両方とも黙って通る。** 2026-08-07（Issue #89）に `shuhan-zhaoliedi` の黄元の乱で、鎮圧側が換算済み（`0223-02`／`0223-05`）・被反乱側が旧暦の月番号の直書き（`0222-12`／`0223-03`）という割れ方をしていた。**検出器は既にある** — `scripts/screens/rebellion_pair_dates.py` が `name` の一致するペアを突き合わせ、1,396ペア中 **differ 111件**を出す。ただし `data/screenings.json` に記録が無く、**出力が読まれていない**（黄元の乱もこの111件の中に在った） |
| `data/kinship.json` のエッジ | `accessionRoute.axes.relationToPredecessor` | `validate_kinship.py`（G3 `check_relation_edges`・継承エッジ216件） |
| `data/kinship.json` の note に**引用（「」）を書く** | 底本（`_corpus_cache/` と `china-history`・`daizhigev20`）。**新しい書を引くときは `scripts/check_kinship_quotes.py` の `FALLBACKS` に足す** | `python3 scripts/check_kinship_quotes.py`（notfound 0 が条件・約2分）。**`verify_quotes.py` は `emperors.json` 固定でこのファイルを見ない**ので、こちらを回さないと kinship の引用は**どのゲートにも掛からない**（2026-08-17 に `scripts/` へ恒久化するまでセッションの scratchpad にしか無かった。恒久化直後の初回走査で `p-murong-yi` の Web 由来の引用1件が出た） |
| `data/kinship.json` に**語彙 ID を新しく足す**（`relation`・`kind`・`inclusionReason`・`categoryId`…） | `site/src/lib/data-source.ts` の `assertLabels`（v3 の ID → 表示ラベルの対応表） | `cd site && npm run build`（**未登録の ID はビルドが落ちる**。2026-07-24 に marriage エッジをデータだけ先に入れて実際に落ちた） |
| `data/kinship.json` のエッジ／`relationToPredecessor` | note・紹介文に書いた**続柄の呼称**（「従叔父」「甥」…） | `relation_path.py --check`（**報告専用・CI に載せない**。不一致は「エッジと記録値のどちらかが誤り」までしか言えないため） |
| 史料対立のあるフィールドの**採用値**を訂正する | 同じコンテナの `conflicts[].adopted.value`（採用値を動かすと置き去りになる） | `validate_emperors.py` の `check_conflicts`（`adopted.value` と実フィールド値を突合・**CI でも実行**） |
| `conflicts[]` に引用を書く | `data/quote-refs.json`（`adopted.quote`・`alternatives[].quote` は照合台帳の対象） | `verify_quotes.py --backfill && --check`。**引用規約の全項が掛かる**（`claim` に引用を書けないのとは逆で、ここは書く場所） |
| `quotes[]`（構造化引用）を書く・`source.bookId`/`volume` を足す | `meta.catalogs.books`（`bookId` の指す先。無い書は `python3 scripts/build_books_catalog.py --write` で入る）と `data/quote-refs.json`（`quotes[].text` は照合台帳の対象） | `validate_emperors.py` の `check_quote_containers`（形・カタログ参照・**巻の索引を持たない書に `volume` を書けない**）＋ `verify_quotes.py --check-volumes`（**要コーパス**・巻が引けるか／引用が**その巻の中**に在るか）＋ `--backfill && --check`（台帳） |
| `source.quote` の引用を `quotes[]` へ移す | 同じ容器の `source.quote` を**消す**（同居禁止）・`validate_emperors.py` の `LEGACY_SOURCE_QUOTE_MAX` を下げる・`QUOTE_FLOOR_BASELINE` を上げる・照合台帳の陳腐化キー（`verify_quotes.py --prune-stale`） | `check_quote_containers`（同居はエラー・ラチェットは**減る方向で落ちる**）。移し忘れたまま `source.quote` を消すと**引用が台帳から静かに抜ける**ので、`--check` の units 数を見る |
| 政権を増やす／`regimeId` を変える | `data/regime-conventions.json` の `regimeIds`（未確定の政権では人物単位の調査が立てられない） | `check_regime_conventions.py`（存在しない政権 id をエラー） |
| 回数系8指標の `events` を**消す** | (1) `data/internal/event-date-archive.json` の同じ鍵（消した event を指したまま残ると `check_event_date_archive` が落ちる）、(2) `data/screenings.json` の件数（`check_screenings.py --update`）、(3) `validate_emperors.py` の `ERA_NAME_BASELINE`（`eraName` を持つ event を消すとラチェットが落ちる）、(4) 同ファイルの `KNOWN_PREACCESSION_EVENTS`（陳腐化エントリが WARN で出る）、(5) **同じ容器の他の event が引用の書名を支えていなかったか**（容器で唯一の引用ユニットになった note が `--check-books` で初めて落ちる。2026-08-07 に `qianyan-murongjun` で実際に出た） | `validate_emperors.py`＋`check_screenings.py`＋`verify_quotes.py --backfill && --check-books` |
| `events[].id` を消す | **id は振り直さない**（`e001` を消して `e002` を残すのが正しい形）。参照先は `data/screenings.json` の `audit.findings[].id` | `validate_emperors.py` の `check_event_ids`（形・一意・外部参照が解決するか） |

## サイト側（欠けるとビルドか deploy gate が落ちる）

| 触るもの | 一緒に触るもの | 検査 |
|---|---|---|
| `emperors.json` のコンテナに**新しいキー**を足す（`claim`・`conflicts` など） | `site/src/lib/emperor-types.ts`（**表示に出すなら**型と描画。出さないなら何も要らない） | **無い**。サイトは `data-source.ts` で `as unknown as` してから読み、実行時のスキーマ検証（zod 等）が無いので、**未知キーは黙って無視される＝ビルドは落ちない**。裏を返すと、追加したキーがサイトに出ていないことも検出されない |
| 皇帝を追加する**か、画面に出る名前欄へ新しい値を入れる**（`posthumousName`・`templeName`・`courtesyName`・`childhoodName`・`aliases`・`personalName`） | `site/src/lib/kana-readings.ts` の `TABLE_SOURCE`（1漢字ずつの読み）と `data/name-readings.json`（表示ルビ）の**両方** | `kana-readings.ts:629`「かな検索テーブルに未登録の漢字です」／`rubyOf` の throw。**どちらも `npm run build` でしか落ちない**（`validate_readings.py` は name-readings 側の記法しか見ず、TABLE_SOURCE の欠字は数に出るだけで 0 エラーのまま通る）。2026-08-13 に北齊 廃帝の「閔悼王」で「悼」を落とし、ルビだけ足して push して CI のプリレンダが落ちた |
| `name.familyName` / `name.personalName` の**切れ目**を変える | `data/internal/family-name-split-originals.json`（移行前の姓＋諱）・`data/name-readings.json`（姓と諱それぞれの読み）・`site/src/lib/display-name.ts` の名前チップ | **有る。** 連結が凍結標本に戻らなければ `validate_emperors.py::check_family_names` が落ち、読みが無ければ `rubyOf` がビルドを落とす。**凍結標本は移行前の値なので更新しない** — 切れ目を直すときは `familyName` と `personalName` を同じ起動で set する（片方だけ動かすと必ず落ちる） |
| `name.commonName` ・表示名の上書きを変える | 同上（新しい漢字が入る） | 同上。**2026-08-02 に金太祖・遼太祖の表示名を変えてビルドが落ちた** |
| ルビ（`data/name-readings.json`）を直す | かな検索テーブル（1漢字1音節・前から切り捨て・上限16） | `validate_readings.py` |
| **紹介文・note・表示文字列を足す**（サイトに出る日本語の文字種が増える） | 自前フォントサブセット（`cd site && python3 tools/build-font-subset.py` → `npm run build`。生成物 `src/app/fonts/*.woff2` 90本・`fonts.css`・`tools/font-coverage.json` はコミット対象） | **有る。** `npm run build` の postbuild `check-font-coverage.mjs` が「サブセットに無い字」を並べてビルドを落とす。**2026-08-05 に紹介文10本と自前サブセット化が別ブランチで進み、マージ後に100字超で落ちた** |
| 皇帝を追加する | `emperor-types.ts` の `eraOrder` | `emperors.ts:771`「eraOrder 未登録の時代ラベルです」 |
| 新しい調査ブロック名が出る | `ERA_BY_SECTION` | `emperors.ts:317`「未対応の調査ブロック名です」 |
| 在位年数の帯を変える | `REIGN_BANDS` | `emperors.ts:1419`「REIGN_BANDS のどの帯にも入りません」 |
| 表示名・カード副題を変える | `searchText`（検索に載らなくなる） | `emperors.ts:675`・`:685` |
| 政権の表示ラベルを変える | 他政権とのラベル重複 | `emperors.ts:402` |
| 肖像を増やす／減らす | 実体ファイル・`manifest.json` の `focusY`・件数の記載 | `emperors.ts:125`（focusY 欠落）。**manifest から外して実体ファイルを消し忘れると site 側は全部緑のまま deploy gate が落ちる**（2026-08-01） |
| 紹介文を入れる | `description` は平文（ルビ記法は `lead`・`body` だけ） | `emperors.ts:889`・`validate_profiles.py` |
| `reigns[].startYear`／`reignSummary.firstStartYear` を訂正する | その皇帝の紹介文の `lead`・`description` に書いた在位年（サイトは同じページで `formatPeriod`＝`startYear` を表示するので、直さないと**本文と表が並んで食い違う**）。逆向きも同じで、紹介文が原文の旧暦年ラベルを採ると表とずれる | **無い**（`validate_profiles.py` の年の照合は通ってしまう）。2026-08-06 に王莽（`raw`「8年 - 23年」／`startYear` 9）と劉永（`raw`「25年 - 27年」／`startYear` 26）の2人で踏み、紹介文側をデータへ揃えた。劉永は `note`・原文が25年を支持しておりレコード内で割れているので [#87](https://github.com/kotenbu135/emperor-stats/issues/87) |
| **配布した紹介文の本文を直す**（ルビの読み・文言） | `data/internal/profile-fragments/<id>.json` の同じ欄（保存してある断片は「この文はどの原文句に拠るのか」の唯一の証人なので、本文とずれると証人にならない） | **無い。** 2026-08-06 に作った直後に踏んだ — 断片を再 add したら本体側で直した読みが巻き戻り、逆に本体を `fix_profile_ruby.py` で直すと保存断片が取り残される。**どちらを直したかを覚えていられる形になっていない** |
| **1字の親文字にルビを振る規則を変える** | `scripts/reapply_profile_ruby.py` の `KANJI_CLASS`（写す側）と `scripts/profile_prose.py` の `KANJI`＋`missing_ruby`（要求する側）の**2箇所** | **無い。** 片方だけ変えると**道具では直せない指摘**になる（要求はするが reapply は付けない＝何度流しても消えない）。2026-08-06 に「熟語の中だけ」で両方を揃えた |
| 紹介文で**新しい難読語にルビを振る** | `data/profile-ruby-lexicon.json` に足す（**本をまたいで必須にする語の台帳**。足すのは**2冊以上に出る語だけ**） | **有る**（片側だけ）。辞書に載せた語の振り漏れは `check_profile_fragment.py`・`validate_readings.py` が落とすが、**辞書に足し忘れたことは機械では出ない**（次の本で同じ語が素通りする）。ただし2冊目で違う読みを振れば `validate_readings.py` の検査7が落とす |
| **辞書の読みを直す**（`profile-ruby-lexicon.json` の値） | 既に配布した47本の本文に振ってあるその語の**全出現**（辞書を直しただけでは本文は変わらない） | **有る**（2026-08-06 に足した）。`validate_readings.py` の**検査8**が辞書と本文の食い違いを、**検査7**が本ごとの割れを落とす。`reapply_profile_ruby.py` は**断片しか受け取らない**ので、本体を直すときは **`python3 scripts/fix_profile_ruby.py --from … --to … --expect <件数> --write`**（2026-08-06 新設。件数の宣言が合わなければ書かずに落ちる — 使い捨ての置換スクリプトを書いていた頃、`git checkout` を打った拍子に訂正が丸ごと消えてゲートは緑のまま、という一歩手前まで行った） |
| **`emperor-profiles.json` の本文を直接直す**（`fix_profile_ruby.py` や使い捨ての置換で） | 同じ id の断片 `data/internal/profile-fragments/<id>.json`。**断片が古いまま残ると、次に誰かが `add_profile.py <断片>` を流した時点で本体の訂正が黙って巻き戻る** | **無い。** 2026-08-09 に実際に起きた（`丹鳳楼` の読みを本体だけ「たんぽうろう」へ直してあり、別件で断片から add し直したら「たんほうろう」へ戻った）。**戻ったこと自体は `validate_readings.py` の検査7・8 が落とした**ので、紹介文を本体へ入れ直したら必ず流す |
| 紹介文で**人物名の例外を足す**（`scripts/profile_name.py` の `OVERRIDES`／`COURTESY_NAMES`／`ETHNIC_KINDS`） | `data/name-readings.json` にその名前の読み（漢字を含む名前のとき） | **有る。** 読みが無ければ `profile_name.py` が直し方つきで落ちる（`extract_profile_material.py`・`check_profile_fragment.py`・`validate_profiles.py` の3本がここを呼ぶので、CI でも出る） |
| 紹介文の**ルビ・文体・人物名の規則を変える** | `scripts/profile_prose.py`・`scripts/profile_name.py`（実装は各1本）・`docs/process/profile-writing/README.md` の7〜8節・`.claude/agents/profile-writer.md`・`profile-reviser.md`・`.claude/workflows/write-profile.js`・`.claude/skills/write-profile/SKILL.md` | **無い。** 実装は1本にまとめてあるが、**エージェントへ届くのは定義とプロンプトの文言だけ**なので、規範だけ直しても執筆は変わらない。**しかも `.claude/` は primary からしか読まれない**（worktree で直しても効かない・2026-08-05 実測） |
| 動画を紐づける | `youtube-playlist.json` | `emperors.ts:75` |
| ページを増減する | `SITE_SECTIONS` | `seo.tsx:65`「SITE_SECTIONSに存在しないhrefです」 |
| **モバイルヘッダーの中身を触る**（`site-shell.tsx` の `md:hidden` の帯・`nav-data.ts` の `shortLabel`・`RubyToggle` の compact） | `site/tools/header-audit.mjs`（320/360/390px の実測）。高さ 56px は `globals.css` の `--chrome-top` と対で、下の帯の `BELOW_STICKY_BAR` が /emperors の節見出しと /database の表見出しの止め位置に使う | **有る**（`node tools/header-audit.mjs` → NG: 0・**手で流す**）。tsc・lint・build はどれも通る。2026-08-06 に3項目を置いた時点で 320px の余りは **7px** しかなく、リンクの左右余白を1段戻すだけでふりがなトグルと重なった |
| **配布物が主張する範囲を狭める**（引用・日付・欄の取り下げ） | `/about` の該当節（`site/src/app/about/page.tsx`）。**取り下げを無言でやらない**のは 2026-08-03 ユーザー決定で、push した瞬間にサイトが再配信されるため**同じコミットに入れる** | **無い**（文章なので機械では判定できない）。件数は直書きせず台帳・データから引く（`site/src/lib/quote-verification.ts` が `data/quote-refs.json` を読む）ことで、少なくとも**数のずれ**は起きない形にしてある |
| `data/quote-refs.json` を消す・鍵の構造を変える | `site/src/lib/quote-verification.ts`（`/about` のビルド入力） | ビルドが落ちる（`refs` が読めない）。**台帳は内部 QA 用だがサイトのビルド入力でもある** |
| 年表に note・出典を戻す | `/about` の引用の主張範囲の節（散文の引用を「読んだ形跡」と書いてある） | **無い**。`getEmperorEvents` が返さない形にしてあるので、戻すには型と描画を両方触ることになる |

## 運用側

| 触るもの | 一緒に触るもの | 検査 |
|---|---|---|
| worktree を作る | コーパス4本（`china-history`・`daizhigev20`・`_corpus_cache`・`_norm_cache`）の symlink と、site を動かすなら `site/node_modules` のハードリンク複製 | `scripts/setup_worktree.sh` が自動で流れる（PostToolUse フック＝コーパス／`npm run dev`・`build` の `predev`/`prebuild`＝node_modules）。**コーパス漏れはエラーにならずゲートが黙ってスキップされる** |
| `scripts/patch_emperor.py` の `HINTS`（触ったパス→要求するゲート・結合の案内） | この表そのもの（案内が古いと「ゲートを出したのに漏れる」＝**表より悪い**） | `python3 scripts/test_patch_emperor.py`（ローカル専用） |
| `.claude/hooks/guard.py` の規則 | `docs/process/RULES.yml` の `enforcement` 欄 | `python3 scripts/check_rules.py`（実装と台帳の突合・**CI でも実行**）＋ `python3 .claude/hooks/test_guard.py`（規則を足したらケースも足す・ローカル専用） |
| `extract_profile_material.py` の note 抑止を変える | `VERIFIER.md`（`--notes on` を付ける側）・`guard.py` の `NOTES_ON_ALLOWED` | `python3 .claude/hooks/test_guard.py`（ローカル専用） |
| 新しいゲートスクリプトを足す | `.claude/hooks/stop_gate.py` の `LIGHT_GATES`（対応表に無いゲートは turn の終わりに流れない） | `python3 .claude/hooks/test_stop_gate.py`（ローカル専用） |
| `data/regime-conventions.json` の verdict を変える | `.claude/workflows/name-block.js` の調査プロンプト（`skip`／`other-source` の項目は埋めさせない） | `check_regime_conventions.py`（verdict と personScope の1対1を検査） |
| `scripts/screens/*.py` の絞り込み方を変える | `data/screenings.json` の件数・`absent` バケットの標本監査（**種が同じでも母集団が変われば引かれる id が変わる**） | `check_screenings.py`（スクリプトを実行して記録と突き合わせる・標本 id を引き直す） |
| `data/emperors.json` の対象フィールドを埋める | 同上（母集団が減るので記録の数字が古くなる） | 同上 |
| `data/emperors.json`・`kinship.json`・`emperor-profiles.json` の値を増やす | `docs/PROJECT_STATUS.md` の実測カバレッジ（生成領域）を `python3 scripts/coverage.py --write` で引き直す | `coverage.py --check`（**CI でも実行**・Stop フックでも流れる） |
| `coverage.py` の測り方（`FIELDS`・`absent` の条件）を変える | 同上。**`absent` を足すのは構造的な根拠があるときだけ** — 散文を根拠にすると「確定した」が水増しされる | 同上＋`scripts/screens/*.py` との突き合わせ（同じ母集団を測る道具が2つあるので合わなければどちらかが誤り） |
| `data/regime-conventions.json` に所在の違う人物（`exceptions`）を足す | `data/verification.json` の同じ tier 行の `exceptions`（**政権の判定を被せると1体で回してしまう**） | `check_verification.py`（例外の皇帝 id の実在・重複・薄い側へ移す例外の理由） |
| `data/verification.json` の tier を動かす | `.claude/workflows/*.js` が立てる検証の体数（tier から引くので記録が正）。**own-annals へ移すときは書名・所在・体裁の根拠が要る**（1体へ減らす側だけ非対称に厚く） | `check_verification.py`（**CI でも実行**・Stop フックでも流れる。所在の実在確認はコーパスのあるローカルだけ） |
| 検証段を回してブロックを終える | `data/verification.json` の `blocks` に `raised`／`confirmed` を記録（**記録しないと体数を動かした効果が読めない**＝規則の完了条件が消える） | 同上＋`check_verification.py --rate` |
| 判定基準を変える | **その基準で調査済みのブロックの遡及監査** | 無い。基準変更時に対象人数を先に出す（被反乱回数の基準訂正時は35名を監査した） |
