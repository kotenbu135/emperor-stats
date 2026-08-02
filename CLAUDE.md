# CLAUDE.md

このリポジトリで作業する Claude Code 向けの入口です。ここには**要点と、知らずに進むと事故る点だけ**を置き、詳細は必要になった時点で開くリンク先にあります。

## プロジェクト概要

中国皇帝統計プロジェクト。始皇帝から溥儀まで、実際に「皇帝」を名乗った365人の在位年数・死因・即位経路など全12項目を正史原典から調査したデータセット（`data/emperors.json`）と、それを可視化する Next.js 静的サイト（`site/`、カスタムドメイン emperorstats.com で公開）で構成されます。

データ調査は完了済み（全12項目×365人・`meta.status.overall: "completed"`）で、現在の作業は**データ誤りの訂正（GitHub Issue 起点）**と、**サイトの再構築**です。

**サイトは 2026-07-31 に作り替えて一旦完成しました**（ブランチ `site-rebuild-tremor`）。構成は**4ページ**（概要ダッシュボード・皇帝一覧・データベース〔新規〕・このサイトについて）＋皇帝個別365ページで、詳細ダイアログ・外枠のシェル・皇帝個別ページは旧実装のまま残っています。旧サイトの設計ドキュメントは同日すべて削除し、**配色と書体は `site/src/app/globals.css` が唯一の正**です（独自に作り直さない）。サイトを触る前に [site/AGENTS.md](site/AGENTS.md)（崩すとビルドが落ちる契約）と [docs/site-design/SITE_DESIGN.md](docs/site-design/SITE_DESIGN.md)（設計と決定の記録・再提案しないこと）を読んでください。現状・進行中の作業・申し送り事項は [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)。

## コマンド

リポジトリルートに `package.json` はなく、ビルド・lint があるのは `site/` だけです（テストはありません。Node は nvm の v26.4.0 を有効にしてから使う）。開発サーバー・ビルド・型チェックの手順とサイト固有の注意点は [site/AGENTS.md](site/AGENTS.md)。

`data/emperors.json` を訂正したら、コミット前に次のゲートを通します（規約の全文は [RESEARCH_PROCESS.md](docs/process/RESEARCH_PROCESS.md) の「引用の取り扱い規約」）：

```bash
python3 scripts/validate_emperors.py   # 構造・日付整合性・reignSummary整合性・禁止出典（CI でも実行）
python3 scripts/coverage.py --write    # 進捗表記をデータ本体から引き直す（CI でも --check を実行）

# 引用・日付を追加・変更した場合はさらに必須
python3 scripts/verify_quotes.py --backfill && python3 scripts/verify_quotes.py --check  # 引用照合台帳（ローカル専用・要コーパス）
# ↑ 初回のみ重い（`_norm_cache/` を作る --check が約6分、--backfill が未解決分をコーパスへ当て直して数分）。
#   2回目以降はどちらも1秒未満なので訂正ループの中で回してよい。コーパスを入れ替えた・書を足したときだけ
#   `--backfill --retry-unresolved`（未解決ユニットをコーパスへ当て直す。付けないと前回の走査結果を据え置く）
python3 scripts/verify_calendar.py     # fromLunar リプレイ・exactDays 実経過日数（CI でも実行）
```

note に**書名を書き足した・引用の出典を差し替えた**ときは `python3 scripts/verify_quotes.py --check-books`（ローカル専用・初回のみ数分〔名乗られた書ぶんの `_norm_cache/` を作る〕・2回目以降は数秒）。note・`source.page`・`conversion` が名乗る書名と、その書の実ファイルを突き合わせる。**名乗るどの書にも引用が1断片も無いユニットが残っていればエラー**で、コーパス側の欠陥（一書の中で1箇所だけ字が壊れている等）・内篇名（三国志魏書・旧五代史梁書）・引用の作り方が原因のものだけ、`data/quote-refs.json` の `bookAllow` に `"id|path": "理由"` を足して許可する（理由は必須）。「断片が日付表現だけ」「一部の書だけに在る」は別枠で一覧に出るだけでエラーにしない。

`data/regime-conventions.json`（政権単位の慣行）を触った場合は `python3 scripts/check_regime_conventions.py`（構造・政権 id の実在・引用が実ファイルの該当行にあるか。CI でも実行）。悉皆調査に入る前に `--scope` で確定済みの範囲を、人物単位の調査を立てる前に `--for <皇帝id> --field <フィールド>` を見る（**`--field` を付ける** — この規則が掛かるのは名前系だけで、日付・回数のような人物単位の事実では「適用外」として 0 が返る）。
`data/screenings.json`（原典を読む前の機械の絞り込み）を触った場合は `python3 scripts/check_screenings.py`（`scripts/screens/*.py` を実行して記録の件数と突き合わせる・標本監査の有無。CI でも実行）。着手前に `--scope` で「母集団 N → 要読解 M」を、調査が進んで母集団が減ったら `--update` で件数だけ引き直す。人物単位の着手判断は `--for <皇帝id> --field <フィールドパス>`（**`--field` を付けないと別の項目の絞り込みが出てきて、それを「この作業の母集団は絞ってある」と読んでしまう**）。
`data/verification.json`（検証段の体数）を触った場合は `python3 scripts/check_verification.py`（体数が tier から一意か・1体へ減らす側の根拠・指摘率の記録。CI でも実行）。エージェントを立てる前に `--for <皇帝id>` で体数と観点を、ブロック全体の内訳は `--scope`、指摘率の表は `--rate`。
`data/kinship.json` を触った場合は `python3 scripts/validate_kinship.py`（続柄と血縁エッジの実体整合・世代パリティ・親子の生没年もここで見る）。**続柄の呼称（「従叔父」「甥」…）は選ばずに `python3 scripts/relation_path.py --for <皇帝id>` で引く**（`--check` で記録値との突合。報告専用でゲートではない）。
`data/name-readings.json`（ふりがな）・`data/emperor-profiles.json`（紹介文）を触った場合は `python3 scripts/validate_readings.py`（ルビ記法・親文字一致・総ルビ充足）。紹介文（GitHub Issue #16）はさらに `python3 scripts/validate_profiles.py`（文字数・`description` が平文であること・件数・定型文の n-gram）。素材は `python3 scripts/extract_profile_material.py --section '<時代区分>'` で出す（`emperors.json` 全体を読まない）。**既存 note は既定で出さない** — 1段目に渡すと note の誤りが本文へ流れるため、`--notes on` を付けてよいのは検証段だけ（フックが止める）。**紹介文を書く前に [docs/process/profile-writing/README.md](docs/process/profile-writing/README.md) を読む**（原文先読み→引用台帳→執筆の4段手順とプロンプト雛形。1人ぶんのゲートは `scripts/check_profile_fragment.py`）。

## リポジトリ構成

- **`data/emperors.json`** — データセット本体（`meta` + `emperors` 配列・約7MB）。サイトがビルド時に直接読み込む。**メイン会話でこのファイル全体を Read しない** — 対象人物の抽出・訂正結果のマージは `jq`/`python3` を Bash 経由で行う（[RESEARCH_PROCESS.md](docs/process/RESEARCH_PROCESS.md) の「コンテキスト効率」節）
- **`site/`** — Next.js サイト（静的書き出し・emperorstats.com で公開）。**触る前に [site/AGENTS.md](site/AGENTS.md) と [docs/site-design/SITE_DESIGN.md](docs/site-design/SITE_DESIGN.md) を読む** — `kana-readings`・`DYNASTY_COLOR_SLOT` のように、追記を忘れるとビルドが落ちる assert がある。2026-07-31 に作り替えて一旦完成し、旧サイトの設計記録と計画段階のディレクトリ（`site/design-plans/`）は削除済み。確認用スクリーンショットは `site/tools/capture-site.mjs`
- **`china-history/`・`daizhigev20/`** — 正史原文のローカルコーパス（`.gitignore` 対象・リポジトリには含まれない、事前に `git clone --depth 1` 済み）。データ訂正時の一次情報源として最優先で参照する
- **`_corpus_cache/`** — 上記コーパスから人物ごとに抽出・整形済みの本紀原文キャッシュ（`.gitignore` 対象・`scripts/build_corpus_cache.py` で再生成可能）。キャッシュが無い人物を調査する際は、先にこのスクリプトへ書名・巻・行範囲のマッピングを追記して生成してから調査に入る
- **`_norm_cache/`** — 上記コーパスを引用照合用に正規化した結果のキャッシュ（`.gitignore` 対象・約800MB・`verify_quotes.py` が必要になった時点で自動生成する）。**人が触るものではない**。底本の mtime/size が変われば作り直されるので、消しても次の `--check` が作り直すだけ（そのぶん遅くなる）
- **`data/images/portraits/`** — 肖像画アセット（PD/CC0 のみ・`manifest.json` で出典管理）
- **`docs/`** — 調査プロセス・スキーマの記録（索引: [docs/README.md](docs/README.md)／データ側は [data/README.md](data/README.md)）。`docs/site-design/` に残っているのは肖像画アセットの管理だけ

## 重要な参考文書

作業内容に応じて以下を参照してください：

| 内容 | ファイル |
|------|--------|
| **プロジェクト現状・データ品質の申し送り** | [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) |
| **データ調査の進め方（訂正時もこの手順）** | [docs/process/RESEARCH_PROCESS.md](docs/process/RESEARCH_PROCESS.md) |
| **ローカルコーパス利用メモ（書物・王朝を問わず効く罠、着手前必読）** | [docs/process/CORPUS_NOTES.md](docs/process/CORPUS_NOTES.md) |
| **史料マッピング・行番号インデックス（担当ブロックの書名・巻・行範囲）** | [docs/process/SOURCE_MAPPING.md](docs/process/SOURCE_MAPPING.md) |
| **絶対に守るべき制約** | [docs/process/CONSTRAINTS.md](docs/process/CONSTRAINTS.md) |
| **規則の台帳（適用範囲・強制層・根拠になった失敗）** | [docs/process/RULES.yml](docs/process/RULES.yml) |
| **結合レジストリ（Xを触ったらYも触る）** | [docs/process/COUPLINGS.md](docs/process/COUPLINGS.md) |
| **調査エージェントの出力契約（claims-first）** | [docs/process/CLAIMS_CONTRACT.md](docs/process/CLAIMS_CONTRACT.md) |
| **AI調査の知見集（設計指針・失敗事例・エージェント運用とドキュメントの書き方）** | [docs/process/AI_RESEARCH_LESSONS.md](docs/process/AI_RESEARCH_LESSONS.md) |
| **サイトの現状・崩してはいけない契約（触る前に必読）** | [site/AGENTS.md](site/AGENTS.md) |
| **サイトの設計と決定の記録（ページ構成・スタック・配色・各ページの判断・再提案しないこと）** | [docs/site-design/SITE_DESIGN.md](docs/site-design/SITE_DESIGN.md) |

スキーマは [docs/schema/SCHEMA_OVERVIEW.md](docs/schema/SCHEMA_OVERVIEW.md) が参照ガイドで、フィールド詳細は [data/schema/](data/schema/) 以下（[EMPERORS_SCHEMA.md](data/schema/EMPERORS_SCHEMA.md)・[DEATH_CAUSE_SCHEMA.md](data/schema/DEATH_CAUSE_SCHEMA.md)・即位経路/改元/大赦ほかの [ADDITIONAL_SCHEMA.md](data/schema/ADDITIONAL_SCHEMA.md)・[INCLUSION_CRITERIA.md](data/schema/INCLUSION_CRITERIA.md)・系譜〔調査中〕の [KINSHIP_SCHEMA.md](data/schema/KINSHIP_SCHEMA.md)）にあります。スキーマ v3（2026-07-29・Issue #22。時代・政権カタログ、全 enum の ID 化、`dynasty`／`flags.selfProclaimed` の廃止）の設計・移行記録は [docs/schema/V3_MIGRATION_PLAN.md](docs/schema/V3_MIGRATION_PLAN.md)。

## 守るべき運用ルール

以下はいずれも**このリポジトリで実際に失敗を出した結果**として決まった運用方針で、モデルの判断力を補うための一般的な行動指示ではありません（背景と全文: [docs/process/CONSTRAINTS.md](docs/process/CONSTRAINTS.md)）。迷った場合は自分の判断で緩めず、そのまま従ってください。

- **判定の根拠は原典（正史の本紀・列伝）に置く** — WebSearch の要約だけでは判定しない。**この規則が掛かるのは `data/emperors.json` のデータ判定**で、紹介文（Issue #16）の執筆では Web を**差分検出器**として使ってよい（通説との食い違いを見つけて原典を読み直す引き金にする。根拠にはしないし、Web の文章は本文に取り込まない）
- **規則の適用範囲が書かれていないときは、自分で狭めたり広げたりせずユーザーに聞く** — 上の1行はもともと範囲を書いておらず、紹介文の執筆にも掛かると判断して Web 照合を行わないまま76人ぶんを公開した（2026-08-02・ユーザーの想定はデータ判定のみ）
- **作業の入口はスキル**（`/research-block` ブロック着手・`/correct-record` データ訂正・`/profile-block` 紹介文）。着手前の罠は `python3 scripts/brief_block.py <書名>` が該当箇所だけを出す
- **調査中により良い手順に気づいたら、その場でユーザーへ提案する**（自分で手順を変えない）。採否は [docs/process/PROCESS_IMPROVEMENTS.md](docs/process/PROCESS_IMPROVEMENTS.md) に残す。エージェントの出力には `processSuggestion` の欄がある
- **調査エージェントは `.claude/agents/` の定義を使う**（`corpus-researcher`・`adversarial-verifier`・`profile-*`）。素の Agent を立てると引用規約・出力契約がプロンプトに写し漏れる。Workflow からは `agent(prompt, {agentType: '...'})`。段構成も `.claude/workflows/` に置いて毎回書き直さない
- **一部の規則は `.claude/hooks/guard.py` が実行の直前に止める**（コーパスへの `.{0,N}` grep・`git add -A`・裸の `git stash`・メイン会話での `emperors.json` 全体 Read・外部ホストへの一括 HTTP 取得）。**サブエージェントと Workflow エージェントにも掛かる**。逃げ道は `EMPSTATS_ALLOW=<規則ID>:<理由>` の1本だけで、理由は必須。規則の一覧と適用範囲は [docs/process/RULES.yml](docs/process/RULES.yml)
- **`data/*.json` に未コミット差分があるまま turn を終えると `.claude/hooks/stop_gate.py` が軽いゲートをその場で流す**（1秒未満）。落ちていれば止まる。**引用・日付を触っていれば `verify_quotes.py --check` もここで流す**（2026-08-02 に344秒→1秒未満へ短縮したため。フック全体で約1秒）。`--backfill` は台帳を書き換えるので流さない — 台帳が古ければ `--check` が「台帳に未登録の引用」で落ちるので、そう言われたら `--backfill` を先に流す。初回のキャッシュ構築中は40秒で打ち切って**止めずに**通知だけ出す。**止めるのは1回だけ**なので、意図的に途中の状態で終えたいときはその旨を述べてもう一度終える
- **完了は宣言せず実測する** — 「このブロックは完了」と書く前に `python3 scripts/coverage.py` を通し、進捗表記は `--write` が生成する [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) の領域そのものにする（グループ2の「364人完了」は自己申告で実測355人だった）。数えるのは**フィールドが在るか**ではなく**確定したか**で、`判別不能` は誤りではなく「完了の主張が機械では確かめられない」の意。**note の散文からは確定を読み取らない**
- **検証の厚みは政権の史料形態から引く。ブロックごとに決めない** — 本紀・帝紀が独立して立つ王朝は検証1体（`facts`）、載記・類書・別史・地方志に依存する政権は3体（`facts`・`kinship`・`dates`）。紹介文76人の実測で欠陥密度は 0件/人（前漢・後漢・三国）と 1.56件/人（小政権＋五胡十六国）の段になっていた。**記録（`data/verification.json`）に無い政権は厚い側**で、1体へ減らす側にだけ書名・所在の根拠が要る。ブロックを終えたら指摘 `raised` と実欠陥 `confirmed` を記録する（体数を動かした効果は**同じ tier の中でしか読めない**）
- **悉皆調査では、政権単位で決まることを人物単位で365回やらない** — 「この政権は廟号を立てるか」「どの位置にどんな書式で載るか」は政権の慣行なので、`data/regime-conventions.json` に**書式・所在だけ**を原典から先に確定する（**値は書かない**。「唐は全員に廟号がある」は24人読まないと言えない人物単位の主張）。絞り込みの誤りは非対称で、「書式がある」の誤りはトークンを損するだけだが、「無い」の誤りはその政権の空欄を全件まとめて「正しい」と結論する
- **原典を読む前に、機械で前提を検証して母集団を絞る** — 絞り込みは `scripts/screens/<名前>.py` にコミットして残し、結果を `data/screenings.json` に「母集団 N → 要読解 M」の形で記録してから読み始める。**絞り込みは読む順序と量を変えるだけ**で判定を機械にさせるわけではない。**機械が何も見つけなかった側（`absent`）を「値が無い」と読まない** — 種つき無作為標本を原典で読んで取りこぼし率を測る（Issue #37 の名前データでは諡号の absent 側で6件中3件が取りこぼしだった）。**見つかった側を「これで全部」と読まないのも同じ規則**（`R-SWEEP-DETECTION`）— 走査結果を悉皆性の根拠に使う前に、その語彙に掛からない該当記事を1件探しに行く（Issue #42 で元世祖の親征を6語で走査したところ、同じ本紀の中に語彙へ掛からない出征記事が2件あった）
- **スクリプトによるデータの自動生成は禁止** — 人物ごとの個別調査・判定が必須（日数計算等の機械的な計算補助や、確定済み調査結果の構造チェックはOK）
- **原文引用の手打ち禁止** — 引用は `scripts/quote_helper.py`／grep のツール出力からコピーし、字体変換・要約・語順変更をしない。引用・日付を変更したら上記ゲートの合格がコミット条件
- **調査エージェントへ渡す素材は抽出コマンドで渡す**（プロンプトの中に `jq`／`python3 -c` の抽出式を書き起こさない） — 回数系 events は `python3 scripts/extract_event_material.py <皇帝id> --field <フィールド>`、紹介文は `scripts/extract_profile_material.py`。**どちらも既定で note を落とす**（`--notes on` は検証段だけ・フックが止める）。その場のワンライナーだと既定もフックも掛からず、2026-08-03 の Issue #56 で実際に破れた
- **`events` の日付を新しく確定・訂正したら、同じ要素に原表記 `*Raw` と `source.conversion` を残す**（規則 `R-EVENT-DATE-RAW`・任意欄で遡及しない）。`conversion` に `fromLunar(y,m,d[,leap])` を書くと `verify_calendar.py` の **B-5** が再演し、**月精度は朔日アンカー `fromLunar(y,m,1)` から多数月を計算して照合する**。これが無いと「旧暦の月番号を太陽暦の欄へ直書き」した誤りを機械で区別できない（Issue #56 で訂正24件中の最多の型）
- **原典調査（データ訂正・新規ブロック着手）に入る前に [CORPUS_NOTES.md](docs/process/CORPUS_NOTES.md) と [RESEARCH_PROCESS.md](docs/process/RESEARCH_PROCESS.md) を読む** — 「china-history の相対巻数」「原文ラベルなのに中身が白話訳」のように、読まずに進むと誤った巻・誤った日付を採用する罠が記録されている（担当ブロックの書名・巻・行範囲は [SOURCE_MAPPING.md](docs/process/SOURCE_MAPPING.md) から引く）。読まずに調査エージェントを起動して手戻りした事故が複数回発生している
- **コーパスに `.{0,N}KW.{0,N}` 型のコンテキスト抽出 grep を掛けない** — 素の `grep`／Grep ツールは ugrep で、単一10MBファイルでもメモリ4GB超に暴走し WSL ごと落ちる（回避策: CORPUS_NOTES の「コーパス検索のメモリ事故対策」節）
- **並行セッション前提の read-modify-write** — 同じ作業ツリーで別セッションが `data/emperors.json` を編集していることがある。対象 id のフィールドだけ更新し、それ以外のレコード・`meta` には触らない。**転記は `python3 scripts/patch_emperor.py <皇帝id> --set 'パス=JSON値'` を通す**（読み込み時の sha256 を書き込み直前に照合して落ちる・触ったパスが要求するゲートを出す・値は作らない＝R-NO-AUTOGEN の境界を設計で持つ）。まず `--dry-run`
- **primary（`/home/sakis/emperor-stats`）は main に置いたままにする** — 新しい作業は `EnterWorktree` で自分専用の worktree を作って行う。セッション開始時に primary が main 以外のブランチに載っていたら、それは**別セッションが作業中**という意味なので、そのブランチにコミット・push しない（巻き込む）。primary のそのブランチで作業する必要がある場合は先にユーザーへ確認する。起動時の状態は SessionStart フック（`.claude/session-start-branch.sh`）が毎回報告する。**worktree を primary と揃えるのは `scripts/setup_worktree.sh`**（コーパス4本の symlink は `EnterWorktree` の直後にフックが自動で流し、`site/node_modules` は `npm run dev`／`build` が必要になった時点で primary からハードリンク複製する）。`git worktree add` で自分で作った場合は手で `bash scripts/setup_worktree.sh <パス>` を流す
- **外部 API への一括リクエストは「小規模検証 → 想定件数を提示して明示的許可 → 本実行」** の順を踏む（`guard.py` が止めるのは**件数ではなく形** — ループ・`xargs`・curl の URL グロブに curl／wget を差した形。許可を得た本実行は `EMPSTATS_ALLOW=R-API-BATCH:<件数と経緯>` で流す）
- **note は作業ログなので、新しく書くときは `claim` を添える** — note には「現行 X → Y に訂正」のように**捨てた側の値**が残るため、フィールドとの突合は向きが反転する（散文は witness にならない）。`claim` は同じコンテナに置く任意の欄で、いま正しいと判断している内容だけを前向きに1〜2文。**引用は書かない**（照合台帳が claim を見ない）・**件数は算用数字**（`count` と機械照合）。**既存 note には遡及しない**ので、`claim` が無いことは根拠の不在を意味せず `coverage.py` も確定の根拠にしない。詳細は [data/schema/EMPERORS_SCHEMA.md](data/schema/EMPERORS_SCHEMA.md) の「note と claim」節
- **データを訂正したら** `data/emperors.json` の該当データと関連する `meta` 情報・ドキュメントを**同じタイミングで**更新する
- **データ正確性が最優先** — 誤りは個別調査でデータ側を訂正する。サイト側での場当たり的な補正はしない（表示破綻の回避のみ許容。既知の例は [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) の申し送り事項）
