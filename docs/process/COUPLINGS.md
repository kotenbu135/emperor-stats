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
| ある日付フィールドの訂正 | 同じ日付を持つ**隣接フィールド**（`reigns[].endDate` ↔ `ages.deathDate` ↔ `events[].date` ↔ note 内の日付引用） | 一部（`validate_emperors.py` の整合検査）。**旧値の文字列でレコード全体を grep して残存参照を列挙するのが訂正手順の定型**（2026-07-21 に JSON-LD へ旧値が出たまま公開された） |
| `dynastyOrder` の調査完了 | `meta.catalogs.regimes[].dynastyOrderSurveyed` | **無い**（Issue #24 に「調査完了時に追加すると再発防止になる」と記載） |
| データの訂正 | `meta.status` と `docs/PROJECT_STATUS.md` | 無い（同時更新の運用ルール） |
| `data/kinship.json` のエッジ | `accessionRoute.axes.relationToPredecessor` | `validate_kinship.py`（G3 `check_relation_edges`・継承エッジ216件） |
| 政権を増やす／`regimeId` を変える | `data/regime-conventions.json` の `regimeIds`（未確定の政権では人物単位の調査が立てられない） | `check_regime_conventions.py`（存在しない政権 id をエラー） |

## サイト側（欠けるとビルドか deploy gate が落ちる）

| 触るもの | 一緒に触るもの | 検査 |
|---|---|---|
| 皇帝を追加する | `site/src/lib/kana-readings.ts` の `TABLE_SOURCE`（1漢字ずつの読み） | `kana-readings.ts:629`「かな検索テーブルに未登録の漢字です」 |
| `name.commonName` ・表示名の上書きを変える | 同上（新しい漢字が入る） | 同上。**2026-08-02 に金太祖・遼太祖の表示名を変えてビルドが落ちた** |
| ルビ（`data/name-readings.json`）を直す | かな検索テーブル（1漢字1音節・前から切り捨て・上限16） | `validate_readings.py` |
| 皇帝を追加する | `emperor-types.ts` の `eraOrder` | `emperors.ts:771`「eraOrder 未登録の時代ラベルです」 |
| 新しい調査ブロック名が出る | `ERA_BY_SECTION` | `emperors.ts:317`「未対応の調査ブロック名です」 |
| 在位年数の帯を変える | `REIGN_BANDS` | `emperors.ts:1419`「REIGN_BANDS のどの帯にも入りません」 |
| 表示名・カード副題を変える | `searchText`（検索に載らなくなる） | `emperors.ts:675`・`:685` |
| 政権の表示ラベルを変える | 他政権とのラベル重複 | `emperors.ts:402` |
| 肖像を増やす／減らす | 実体ファイル・`manifest.json` の `focusY`・件数の記載 | `emperors.ts:125`（focusY 欠落）。**manifest から外して実体ファイルを消し忘れると site 側は全部緑のまま deploy gate が落ちる**（2026-08-01） |
| 紹介文を入れる | `description` は平文（ルビ記法は `lead` だけ） | `emperors.ts:889`・`validate_profiles.py` |
| 動画を紐づける | `youtube-playlist.json` | `emperors.ts:75` |
| ページを増減する | `SITE_SECTIONS` | `seo.tsx:65`「SITE_SECTIONSに存在しないhrefです」 |

## 運用側

| 触るもの | 一緒に触るもの | 検査 |
|---|---|---|
| `.claude/hooks/guard.py` の規則 | `docs/process/RULES.yml` の `enforcement` 欄 | `python3 scripts/check_rules.py`（実装と台帳の突合・**CI でも実行**）＋ `python3 .claude/hooks/test_guard.py`（規則を足したらケースも足す・ローカル専用） |
| `extract_profile_material.py` の note 抑止を変える | `VERIFIER.md`（`--notes on` を付ける側）・`guard.py` の `NOTES_ON_ALLOWED` | `python3 .claude/hooks/test_guard.py`（ローカル専用） |
| 新しいゲートスクリプトを足す | `.claude/hooks/stop_gate.py` の `LIGHT_GATES`（対応表に無いゲートは turn の終わりに流れない） | `python3 .claude/hooks/test_stop_gate.py`（ローカル専用） |
| `data/regime-conventions.json` の verdict を変える | `.claude/workflows/name-block.js` の調査プロンプト（`skip`／`other-source` の項目は埋めさせない） | `check_regime_conventions.py`（verdict と personScope の1対1を検査） |
| `scripts/screens/*.py` の絞り込み方を変える | `data/screenings.json` の件数・`absent` バケットの標本監査（**種が同じでも母集団が変われば引かれる id が変わる**） | `check_screenings.py`（スクリプトを実行して記録と突き合わせる・標本 id を引き直す） |
| `data/emperors.json` の対象フィールドを埋める | 同上（母集団が減るので記録の数字が古くなる） | 同上 |
| `data/emperors.json`・`kinship.json`・`emperor-profiles.json` の値を増やす | `docs/PROJECT_STATUS.md` の実測カバレッジ（生成領域）を `python3 scripts/coverage.py --write` で引き直す | `coverage.py --check`（**CI でも実行**・Stop フックでも流れる） |
| `coverage.py` の測り方（`FIELDS`・`absent` の条件）を変える | 同上。**`absent` を足すのは構造的な根拠があるときだけ** — 散文を根拠にすると「確定した」が水増しされる | 同上＋`scripts/screens/*.py` との突き合わせ（同じ母集団を測る道具が2つあるので合わなければどちらかが誤り） |
| `data/verification.json` の tier を動かす | `.claude/workflows/*.js` が立てる検証の体数（tier から引くので記録が正）。**own-annals へ移すときは書名・所在・体裁の根拠が要る**（1体へ減らす側だけ非対称に厚く） | `check_verification.py`（**CI でも実行**・Stop フックでも流れる。所在の実在確認はコーパスのあるローカルだけ） |
| 検証段を回してブロックを終える | `data/verification.json` の `blocks` に `raised`／`confirmed` を記録（**記録しないと体数を動かした効果が読めない**＝規則の完了条件が消える） | 同上＋`check_verification.py --rate` |
| 判定基準を変える | **その基準で調査済みのブロックの遡及監査** | 無い。基準変更時に対象人数を先に出す（被反乱回数の基準訂正時は35名を監査した） |
