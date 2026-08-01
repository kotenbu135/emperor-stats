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

# 引用・日付を追加・変更した場合はさらに必須
python3 scripts/verify_quotes.py --backfill && python3 scripts/verify_quotes.py --check  # 引用照合台帳（ローカル専用・要コーパス）
python3 scripts/verify_calendar.py     # fromLunar リプレイ・exactDays 実経過日数（CI でも実行）
```

`data/kinship.json` を触った場合は `python3 scripts/validate_kinship.py`。
`data/name-readings.json`（ふりがな）・`data/emperor-profiles.json`（紹介文）を触った場合は `python3 scripts/validate_readings.py`（ルビ記法・親文字一致・総ルビ充足）。

## リポジトリ構成

- **`data/emperors.json`** — データセット本体（`meta` + `emperors` 配列・約7MB）。サイトがビルド時に直接読み込む。**メイン会話でこのファイル全体を Read しない** — 対象人物の抽出・訂正結果のマージは `jq`/`python3` を Bash 経由で行う（[RESEARCH_PROCESS.md](docs/process/RESEARCH_PROCESS.md) の「コンテキスト効率」節）
- **`site/`** — Next.js サイト（静的書き出し・emperorstats.com で公開）。**触る前に [site/AGENTS.md](site/AGENTS.md) と [docs/site-design/SITE_DESIGN.md](docs/site-design/SITE_DESIGN.md) を読む** — `kana-readings`・`DYNASTY_COLOR_SLOT` のように、追記を忘れるとビルドが落ちる assert がある。2026-07-31 に作り替えて一旦完成し、旧サイトの設計記録と計画段階のディレクトリ（`site/design-plans/`）は削除済み。確認用スクリーンショットは `site/tools/capture-site.mjs`
- **`china-history/`・`daizhigev20/`** — 正史原文のローカルコーパス（`.gitignore` 対象・リポジトリには含まれない、事前に `git clone --depth 1` 済み）。データ訂正時の一次情報源として最優先で参照する
- **`_corpus_cache/`** — 上記コーパスから人物ごとに抽出・整形済みの本紀原文キャッシュ（`.gitignore` 対象・`scripts/build_corpus_cache.py` で再生成可能）。キャッシュが無い人物を調査する際は、先にこのスクリプトへ書名・巻・行範囲のマッピングを追記して生成してから調査に入る
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
| **AI調査の知見集（設計指針・失敗事例・エージェント運用とドキュメントの書き方）** | [docs/process/AI_RESEARCH_LESSONS.md](docs/process/AI_RESEARCH_LESSONS.md) |
| **サイトの現状・崩してはいけない契約（触る前に必読）** | [site/AGENTS.md](site/AGENTS.md) |
| **サイトの設計と決定の記録（ページ構成・スタック・配色・各ページの判断・再提案しないこと）** | [docs/site-design/SITE_DESIGN.md](docs/site-design/SITE_DESIGN.md) |

スキーマは [docs/schema/SCHEMA_OVERVIEW.md](docs/schema/SCHEMA_OVERVIEW.md) が参照ガイドで、フィールド詳細は [data/schema/](data/schema/) 以下（[EMPERORS_SCHEMA.md](data/schema/EMPERORS_SCHEMA.md)・[DEATH_CAUSE_SCHEMA.md](data/schema/DEATH_CAUSE_SCHEMA.md)・即位経路/改元/大赦ほかの [ADDITIONAL_SCHEMA.md](data/schema/ADDITIONAL_SCHEMA.md)・[INCLUSION_CRITERIA.md](data/schema/INCLUSION_CRITERIA.md)・系譜〔調査中〕の [KINSHIP_SCHEMA.md](data/schema/KINSHIP_SCHEMA.md)）にあります。スキーマ v3（2026-07-29・Issue #22。時代・政権カタログ、全 enum の ID 化、`dynasty`／`flags.selfProclaimed` の廃止）の設計・移行記録は [docs/schema/V3_MIGRATION_PLAN.md](docs/schema/V3_MIGRATION_PLAN.md)。

## 守るべき運用ルール

以下はいずれも**このリポジトリで実際に失敗を出した結果**として決まった運用方針で、モデルの判断力を補うための一般的な行動指示ではありません（背景と全文: [docs/process/CONSTRAINTS.md](docs/process/CONSTRAINTS.md)）。迷った場合は自分の判断で緩めず、そのまま従ってください。

- **判定の根拠は原典（正史の本紀・列伝）に置く** — WebSearch の要約だけでは判定しない
- **スクリプトによるデータの自動生成は禁止** — 人物ごとの個別調査・判定が必須（日数計算等の機械的な計算補助や、確定済み調査結果の構造チェックはOK）
- **原文引用の手打ち禁止** — 引用は `scripts/quote_helper.py`／grep のツール出力からコピーし、字体変換・要約・語順変更をしない。引用・日付を変更したら上記ゲートの合格がコミット条件
- **原典調査（データ訂正・新規ブロック着手）に入る前に [CORPUS_NOTES.md](docs/process/CORPUS_NOTES.md) と [RESEARCH_PROCESS.md](docs/process/RESEARCH_PROCESS.md) を読む** — 「china-history の相対巻数」「原文ラベルなのに中身が白話訳」のように、読まずに進むと誤った巻・誤った日付を採用する罠が記録されている（担当ブロックの書名・巻・行範囲は [SOURCE_MAPPING.md](docs/process/SOURCE_MAPPING.md) から引く）。読まずに調査エージェントを起動して手戻りした事故が複数回発生している
- **コーパスに `.{0,N}KW.{0,N}` 型のコンテキスト抽出 grep を掛けない** — 素の `grep`／Grep ツールは ugrep で、単一10MBファイルでもメモリ4GB超に暴走し WSL ごと落ちる（回避策: CORPUS_NOTES の「コーパス検索のメモリ事故対策」節）
- **並行セッション前提の read-modify-write** — 同じ作業ツリーで別セッションが `data/emperors.json` を編集していることがある。対象 id のフィールドだけ更新し、それ以外のレコード・`meta` には触らない
- **外部 API への一括リクエストは「小規模検証 → 想定件数を提示して明示的許可 → 本実行」** の順を踏む
- **データを訂正したら** `data/emperors.json` の該当データと関連する `meta` 情報・ドキュメントを**同じタイミングで**更新する
- **データ正確性が最優先** — 誤りは個別調査でデータ側を訂正する。サイト側での場当たり的な補正はしない（表示破綻の回避のみ許容。既知の例は [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) の申し送り事項）
