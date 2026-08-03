# CLAUDE.md

このリポジトリで作業する Claude Code 向けの入口。**要点と、知らずに進むと事故る点だけ**を置き、詳細は必要になった時点でリンク先を開く。

## プロジェクト概要

中国皇帝統計プロジェクト。始皇帝から溥儀まで、実際に「皇帝」を名乗った365人の在位年数・死因・即位経路など全12項目を正史原典から調査したデータセット（`data/emperors.json`）と、それを可視化する Next.js 静的サイト（`site/`・emperorstats.com）で構成される。

データ調査は完了済み（全12項目×365人・`meta.status.overall: "completed"`）。現在の作業は**データ誤りの訂正（GitHub Issue 起点）**と**紹介文の執筆（Issue #16）**。サイトは 2026-07-31 に作り替えて一旦完成した（4ページ＋皇帝個別365ページ・詳細ダイアログと外枠のシェルは旧実装のまま）。**配色と書体は `site/src/app/globals.css` が唯一の正**で、独自に作り直さない。

現状・進行中の作業・申し送り事項は [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)。

## 作業の入口

| したいこと | 入口 |
|---|---|
| データ誤りの訂正 | `/correct-record` |
| 新しい調査ブロックの着手 | `/research-block`（着手前の罠は `python3 scripts/brief_block.py <書名>`） |
| 紹介文（Issue #16） | `/profile-block` ＋ [docs/process/profile-writing/README.md](docs/process/profile-writing/README.md) |
| 名前データの補充（Issue #37） | `/name-block` |
| サイトを触る | [site/AGENTS.md](site/AGENTS.md)（崩すとビルドが落ちる契約）と [docs/site-design/SITE_DESIGN.md](docs/site-design/SITE_DESIGN.md)（決着済み・再提案しない）を先に読む |

原典調査（データ訂正・新規ブロック着手）に入る前に [CORPUS_NOTES.md](docs/process/CORPUS_NOTES.md) と [RESEARCH_PROCESS.md](docs/process/RESEARCH_PROCESS.md) を読む — 「china-history の相対巻数」「原文ラベルなのに中身が白話訳」のような、読まずに進むと誤った巻・誤った日付を採用する罠が記録されている（読まずに調査エージェントを起動して手戻りした事故が複数回ある）。担当ブロックの書名・巻・行範囲は [SOURCE_MAPPING.md](docs/process/SOURCE_MAPPING.md) から引く。

## コマンド

ビルド・lint があるのは `site/` だけ（ルートに `package.json` は無く、テストも無い。Node は nvm の v26.4.0 を有効にしてから使う）。手順とサイト固有の注意点は [site/AGENTS.md](site/AGENTS.md)。

**データの転記は `python3 scripts/patch_emperor.py <皇帝id> --set 'パス=JSON値'` を通す**（まず `--dry-run`）。読み込み時の sha256 を書き込み直前に照合して落ち、**触ったパスが要求するゲートと結合をその場で出す** — どのパスがどのゲートを呼ぶかをここで暗記しない。

常用の3本（CI でも走る）:

```bash
python3 scripts/validate_emperors.py   # 構造・日付整合性・reignSummary 整合性・禁止出典
python3 scripts/coverage.py --write    # 進捗表記をデータ本体から引き直す（CI は --check）
python3 scripts/verify_calendar.py     # fromLunar リプレイ・exactDays 実経過日数
```

引用・日付を追加・変更したらローカル専用の照合も必須（要コーパス）:

```bash
python3 scripts/verify_quotes.py --backfill && python3 scripts/verify_quotes.py --check
```

初回だけ重い（`_norm_cache/` を作る `--check` が約6分・`--backfill` が数分）。2回目以降はどちらも1秒未満なので訂正ループの中で回してよい。コーパスを入れ替えた・書を足したときだけ `--backfill --retry-unresolved`（付けないと前回の走査結果を据え置く）。構造化引用 `quotes[]`・`source.bookId`/`volume` を触ったときは `--check-volumes`（**巻がコーパスに実在するか・引用がその巻の中に在るか**。書名しか見ない `--check-books` では巻番号の誤りが素通りする）。カタログに無い書を名乗るときは先に `python3 scripts/build_books_catalog.py --write`。note に**書名を書き足した・出典を差し替えた**ときはさらに `--check-books`（名乗る書に引用が1断片も無いユニットが残ればエラー。規約の全文と `bookAllow` の足し方は [RESEARCH_PROCESS.md](docs/process/RESEARCH_PROCESS.md) の「引用の取り扱い規約」）。

着手前に引く問い合わせ（**`--field` を必ず付ける** — 付けないと別項目の絞り込みが出てきて、それを「この作業の母集団は絞ってある」と読み違える）:

```bash
python3 scripts/check_regime_conventions.py --for <皇帝id> --field <フィールド>   # 政権の慣行。名前系だけに掛かり、日付・回数は「適用外」で 0
python3 scripts/check_screenings.py        --for <皇帝id> --field <フィールドパス> # 「母集団 N → 要読解 M」
python3 scripts/check_verification.py      --for <皇帝id>                        # 検証段の体数と観点（内訳は --scope・指摘率は --rate）
python3 scripts/relation_path.py           --for <皇帝id>                        # 続柄は呼称を選ばずここから引く
```

調査エージェントへ渡す素材も抽出コマンドで出す（`python3 scripts/extract_event_material.py <皇帝id> --field <フィールド>`／`python3 scripts/extract_profile_material.py --section '<時代区分>'`）。**どちらも既定で既存 note を落とす**ので、`--notes on` を付けてよいのは検証段だけ（フックが止める）。

## リポジトリ構成

- **`data/emperors.json`** — データセット本体（`meta` + `emperors` 配列・約7MB）。サイトがビルド時に直接読む。**メイン会話でこのファイル全体を Read しない**（抽出は `jq`／`python3`）
- **`site/`** — Next.js 静的サイト。`kana-readings`・`DYNASTY_COLOR_SLOT` のように追記を忘れるとビルドが落ちる assert がある。確認用スクリーンショットは `site/tools/capture-site.mjs`
- **`china-history/`・`daizhigev20/`** — 正史原文のローカルコーパス（`.gitignore` 対象・`git clone --depth 1` 済み）。データ訂正時の一次情報源として最優先
- **`_corpus_cache/`** — 人物ごとに抽出・整形済みの本紀原文キャッシュ（`scripts/build_corpus_cache.py` で再生成）。キャッシュが無い人物は先に書名・巻・行範囲のマッピングを追記して生成する
- **`_norm_cache/`** — 引用照合用の正規化キャッシュ（約800MB・`verify_quotes.py` が自動生成）。**人が触るものではない**。消しても次の `--check` が作り直す（そのぶん遅くなるだけ）
- **`data/images/portraits/`** — 肖像画アセット（PD/CC0 のみ・`manifest.json` で出典管理）
- **`docs/`** — 調査プロセス・スキーマの記録（索引: [docs/README.md](docs/README.md)／データ側は [data/README.md](data/README.md)）

## 重要な参考文書

| 内容 | ファイル |
|------|--------|
| **プロジェクト現状・データ品質の申し送り** | [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) |
| **データ調査の進め方（訂正時もこの手順）** | [docs/process/RESEARCH_PROCESS.md](docs/process/RESEARCH_PROCESS.md) |
| **ローカルコーパス利用メモ（着手前必読）** | [docs/process/CORPUS_NOTES.md](docs/process/CORPUS_NOTES.md) |
| **史料マッピング・行番号インデックス** | [docs/process/SOURCE_MAPPING.md](docs/process/SOURCE_MAPPING.md) |
| **規則の台帳（適用範囲・強制層・根拠になった失敗）** | [docs/process/RULES.yml](docs/process/RULES.yml) |
| **絶対に守るべき制約（削ってよい指示との区別）** | [docs/process/CONSTRAINTS.md](docs/process/CONSTRAINTS.md) |
| **結合レジストリ（Xを触ったらYも触る）** | [docs/process/COUPLINGS.md](docs/process/COUPLINGS.md) |
| **残量表（走査・横展開の「残り何件」の置き場）** | [docs/process/RESIDUAL.md](docs/process/RESIDUAL.md) |
| **調査エージェントの出力契約（claims-first）** | [docs/process/CLAIMS_CONTRACT.md](docs/process/CLAIMS_CONTRACT.md) |
| **手順改善の提案と採否** | [docs/process/PROCESS_IMPROVEMENTS.md](docs/process/PROCESS_IMPROVEMENTS.md) |
| **AI調査の知見集（設計指針・失敗事例）** | [docs/process/AI_RESEARCH_LESSONS.md](docs/process/AI_RESEARCH_LESSONS.md) |
| **サイトの契約（触る前に必読）／設計と決定の記録** | [site/AGENTS.md](site/AGENTS.md)／[docs/site-design/SITE_DESIGN.md](docs/site-design/SITE_DESIGN.md) |

スキーマは [docs/schema/SCHEMA_OVERVIEW.md](docs/schema/SCHEMA_OVERVIEW.md) が参照ガイドで、フィールド詳細は [data/schema/](data/schema/) 以下（[EMPERORS_SCHEMA.md](data/schema/EMPERORS_SCHEMA.md)・[DEATH_CAUSE_SCHEMA.md](data/schema/DEATH_CAUSE_SCHEMA.md)・[ADDITIONAL_SCHEMA.md](data/schema/ADDITIONAL_SCHEMA.md)・[INCLUSION_CRITERIA.md](data/schema/INCLUSION_CRITERIA.md)・[KINSHIP_SCHEMA.md](data/schema/KINSHIP_SCHEMA.md)）。スキーマ v3 の移行記録は [docs/schema/V3_MIGRATION_PLAN.md](docs/schema/V3_MIGRATION_PLAN.md)。

## 守るべき運用ルール

以下はいずれも**このリポジトリで実際に失敗を出した結果**として決まった運用方針で、モデルの判断力を補うための一般的な行動指示ではない。迷った場合は自分の判断で緩めず、そのまま従う。

各行の `R-*` は [docs/process/RULES.yml](docs/process/RULES.yml) の規則 ID で、**適用範囲・強制層・その規則を書かせた実際の失敗**は台帳側にある。ここに置くのは要点と、範囲を取り違えると事故る境界だけ。**★は強制層 L1**（`.claude/hooks/guard.py` が実行の直前に止める。サブエージェントと Workflow エージェントにも掛かる）で、逃げ道は `EMPSTATS_ALLOW=<規則ID>:<理由>` の1本だけ（理由は必須・`.claude/hook-log.jsonl` に残る）。

### 判定と証拠

- **`R-PRIMARY-SOURCE`** 判定の根拠は正史の本紀・列伝の原文に置く。WebSearch の要約だけで判定しない — 掛かるのは **`emperors.json`・`kinship.json` のフィールド判定だけ**。紹介文（Issue #16）では Web を**差分検出器**として使ってよい（通説との食い違いを原典の読み直しの引き金にする。根拠にはせず、Web の文章は本文へ取り込まない）
- **`R-SCOPE-ASK`** 規則の適用範囲が書かれていないときは、自分で狭めたり広げたりせずユーザーに聞く — 上の1行はもともと範囲を書いておらず、紹介文にも掛かると解釈して Web 照合をしないまま76人ぶんを公開した（2026-08-02）
- **`R-NO-AUTOGEN`** スクリプトによるデータの自動生成は禁止。人物ごとの個別調査・判定が必須 — 日数計算などの計算補助・確定済み結果の転記・構造チェックは対象外
- **★`R-CLAIMS-FIRST`** 原文を先に読み、引用台帳 `claims` を作り、note は照合として読む。台帳に無い事実は書かない
- **`R-CLAIM-GATED`** 配布物に新しい主張の欄を作るときは、その欄を検査するゲートを同じ変更で足す。**ゲートが書けない主張は配布物に置かず内部側（`data/internal/`）へ置く** — 掛かるのは `emperors.json`・`kinship.json` に**新しい欄・新しい意味を足すとき**だけで、既存の欄には遡及しない。入口は [SCHEMA_CHANGE_CHECKLIST.md](data/schema/SCHEMA_CHANGE_CHECKLIST.md) の対応表で、**行を足せない欄は足さない**（`check_rules.py` が見るのは表の空欄と、名前を挙げたゲートの実在まで。新しい欄が表を素通りしたことは機械では見られない）
- **`R-COVERAGE-MEASURED`** 完了は宣言せず `python3 scripts/coverage.py` で実測する（グループ2の「364人完了」は自己申告で実測355人だった）。数えるのは**フィールドが在るか**ではなく**確定したか**で、`判別不能` は誤りではなく「完了の主張が機械では確かめられない」の意。**note の散文からは確定を読み取らない**

### 引用・note

- **`R-QUOTE-NO-TYPE`** 原文引用の手打ち禁止。`scripts/quote_helper.py`／grep のツール出力からコピーし、要約・語順変更をしない
- **★`R-QUOTE-GLYPH`** 引用は底本の字体のまま保存する（新字体・繁体への変換をモデルが行わない） — 掛かるのは**引用の断片だけ**で、同じ note の中でも日本語の地の文・換算メモは新字体で書く
- **★`R-QUOTE-BOOK`** 引用はその note・`source.page` が名乗る書に実在すること
- **`R-NOTE-CLAIM`** note は作業ログなので、新しく書くときは同じコンテナに `claim` を添える — note には「現行 X → Y に訂正」のように**捨てた側の値**が残り、フィールドとの突合は向きが反転する（散文は witness にならない）。`claim` はいま正しいと判断している内容だけを前向きに1〜2文で、**引用は書かない**・**件数は算用数字**。**既存 note には遡及しない**ので、`claim` が無いことは根拠の不在を意味しない
- **`R-DATE-CLAIM-SCOPE`** `events` の日付が主張するのは**年精度 ＋ 在位境界年の月日**だけで、**保存値の深さそのものが主張**（年 `"1211"`・月 `"1211-05"`・日 `"1211-05-07"`）。埋め草は置かない。境界年でない月日は `data/internal/event-date-archive.json` へ退避済みで、**内部側はこれ以上精度を追求しない** — **`ages` の生没日も同じ「深さ＝主張」**（ただし境界年の規則は掛からない・アーカイブも無い）で、**`reigns[]` だけは集計の根なのでフル ISO のまま据え置く**。判定は `scripts/event_date_scope.py` の1実装（BCE は歴史年と天文年が1年ずれるので自分で書き直さない）
- **`R-ERA-DATE-DECLARED`** 改元 `events[].date` は**本紀がその改元という行為に日付を付けている条の日**（宣言が載っている条）で、元号が施行される日（多くは翌年正月朔）は採らない — 掛かるのは **`eraChangeCount` だけ**で他の7容器には広げない。**「詔の日」という語で判定しない**（正月朔の条に改元記事そのものが立つ形・前年の詔を挟まない即時改元があり、語で当てると逸脱に見える）。清の `date` が即位日と同じなのは**一致であって別規約ではない**（「上即位…以明年為○○元年」が同一条）
- **`R-EVENT-DATE-RAW`** `events` の日付を新しく確定・訂正したら、同じ要素に原表記 `*Raw` と `source.conversion` を残す — `conversion` に `fromLunar(y,m,d[,leap])` を書くと `verify_calendar.py` の **B-5** が再演し、月精度は朔日アンカー `fromLunar(y,m,1)` から多数月を計算して照合する。これが無いと「旧暦の月番号を太陽暦の欄へ直書き」した誤りを機械で区別できない

### 悉皆調査の進め方

- **`R-REGIME-FIRST`** 政権単位で決まること（廟号を立てるか・どの位置にどんな書式で載るか）を人物単位で365回やらない。`data/regime-conventions.json` に**書式・所在だけ**を先に確定する（**値は書かない** — 「唐は全員に廟号がある」は24人読まないと言えない人物単位の主張）
- **`R-SCREEN-FIRST`** 原典を読む前に機械で前提を検証して母集団を絞る。絞り込みは `scripts/screens/<名前>.py` にコミットし、結果を `data/screenings.json` へ「母集団 N → 要読解 M」で記録してから読み始める — **絞り込みは読む順序と量を変えるだけ**で判定を機械にさせるわけではない。**機械が何も見つけなかった側（`absent`）を「値が無い」と読まない**（種つき無作為標本を原典で読んで取りこぼし率を測る。諡号の absent 側は6件中3件が取りこぼしだった）
- **`R-SWEEP-DETECTION`** 見つかった側を「これで全部」と読まないのも同じ規則 — 走査結果を悉皆性の根拠に使う前に、その語彙に掛からない該当記事を1件探しに行く（元世祖の親征を6語で走査したところ、同じ本紀に語彙へ掛からない出征記事が2件あった）
- **`R-VERIFY-TIER`** 検証の厚みは政権の史料形態から引き、ブロックごとに決めない — 本紀・帝紀が独立して立つ王朝は1体（`facts`）、載記・類書・別史・地方志に依存する政権は3体（`facts`・`kinship`・`dates`）。**`data/verification.json` に無い政権は厚い側**で、1体へ減らす側にだけ根拠が要る。終えたら指摘 `raised` と実欠陥 `confirmed` を記録する
- **`R-RELATION-PATH`** 続柄の呼称（「従叔父」「甥」…）は選ばずに `scripts/relation_path.py` で引く

### エージェントと記録

- 調査エージェントは `.claude/agents/` の定義を使う（`corpus-researcher`・`adversarial-verifier`・`profile-*`）。素の Agent を立てると引用規約・出力契約がプロンプトに写し漏れる。Workflow からは `agent(prompt, {agentType: '...'})` で、段構成も `.claude/workflows/` に置いて毎回書き直さない
- 調査エージェントへ渡す素材は抽出コマンドで渡す（プロンプトの中に `jq`／`python3 -c` の抽出式を書き起こさない）。その場のワンライナーだと既定もフックも掛からず、2026-08-03 に実際に破れた
- **`R-PROCESS-FEEDBACK`** より良い手順に気づいたら、自分で手順を変えずその場でユーザーへ提案する。採否は [PROCESS_IMPROVEMENTS.md](docs/process/PROCESS_IMPROVEMENTS.md) に残す（エージェント出力には `processSuggestion` の欄がある）
- **★`R-RESIDUAL-TABLE`** 横展開・走査で出た「残り何件」は Issue を立てず [RESIDUAL.md](docs/process/RESIDUAL.md) に行を足す。**Issue は直し方・定義・設計の判断が要るときだけ**の器で、量を持つには向かない（訂正1件から Issue が28本に増え、うち6本は同じ穴が別の場所から顔を出しただけだった）
- **`R-COUPLING`** 片方を変えたらもう片方も変える対は、気づいた時点で [COUPLINGS.md](docs/process/COUPLINGS.md) へ登録する。データを訂正したら関連する `meta`・ドキュメントも**同じタイミングで**更新する

### git・実行環境

- **★`R-JSON-READ-MAIN`** メイン会話で `data/emperors.json` 全体を Read しない（サブエージェントは対象外）
- **★`R-CORPUS-GREP`** コーパスに `.{0,N}KW.{0,N}` 型のコンテキスト抽出 grep を掛けない — 素の `grep`／Grep ツールは ugrep で、メモリ4GB超に暴走し WSL ごと落ちる（回避策は CORPUS_NOTES の「コーパス検索のメモリ事故対策」節）
- **★`R-GIT-ADDALL`・★`R-GIT-STASH`** `git add -A` を使わずパスを明示する。裸の `git stash` を使わず `push -u -m` でタグを付け `apply <sha>` で戻す（stash スタックは primary と全 worktree で共有される）
- **★`R-API-BATCH`** 外部 API への一括リクエストは「小規模検証 → 想定件数を提示して明示的許可 → 本実行」。フックが止めるのは**件数ではなく形**（ループ・`xargs`・curl の URL グロブに curl／wget を差した形）で、`gh` は形では止めない
- **★`R-CI-BACKGROUND`** push 後の CI 待ちは `run_in_background` で流す（完了時に呼び戻される）。**見届けるのをやめる規則ではなく待ち方の規則**で、止まるのは `gh run watch`・ループ・`sleep` を挟んだ前景ポーリングだけ
- **`R-RMW`** 並行セッション前提の read-modify-write。同じ作業ツリーで別セッションが `data/emperors.json` を編集していることがあるので、対象 id のフィールドだけ更新し `meta`・他レコードには触らない
- **`R-PRIMARY-ON-MAIN`** primary（`/home/sakis/emperor-stats`）は main に置いたままにし、新しい作業は `EnterWorktree` で自分専用の worktree を作る。primary が main 以外に載っていたら**別セッションが作業中**なので、そのブランチにコミット・push しない（起動時の状態は SessionStart フックが報告する）
- **`R-WORKTREE-SETUP`** worktree は primary と揃える。コーパスの symlink は `EnterWorktree` 直後にフックが自動で流す（**漏れるとコーパス依存のゲートが黙ってスキップされる**）。`git worktree add` で自分で作った場合は手で `bash scripts/setup_worktree.sh <パス>`
- **★`R-GATES-BEFORE-COMMIT`** データを変更したら該当ゲートの合格をコミット条件にする。`data/*.json` に未コミット差分があるまま turn を終えると `.claude/hooks/stop_gate.py` が軽いゲート（約1秒・引用や日付を触っていれば `verify_quotes.py --check` も）をその場で流し、落ちていれば止まる。「台帳に未登録の引用」で落ちたら `--backfill` を先に流す。**止めるのは1回だけ**なので、意図的に途中の状態で終えたいときはその旨を述べてもう一度終える

**データ正確性が最優先** — 誤りは個別調査でデータ側を訂正し、サイト側での場当たり的な補正はしない（表示破綻の回避のみ許容。既知の例は [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) の申し送り事項）。
