# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

中国皇帝データセット（`data/emperors.json`）構築プロジェクト。始皇帝から溥儀までの在位年数・死因・即位経路などを統計化し、最終的に Next.js + GitHub Pages でグラフ化します。

**現在**: データ収集・検証フェーズ（在位データ・死因・即位経路・改元・大赦・立后・皇太子廃立・遷都は調査完了、親征・反乱鎮圧・被反乱・即位時年齢/没年齢を調査中。進捗詳細は `data/emperors.json` の `meta.status.phases` および [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) 参照）

**このリポジトリにはビルド・lint・テストの類は存在しません**（`package.json` なし）。作業は `data/emperors.json` への手動データ入力・検証と、その周辺ドキュメント（`docs/`・`data/schema/`）の更新が中心です。Next.js サイトのコード自体はまだ存在しません（後述）。

## リポジトリ構成

- **`data/emperors.json`** — メインデータセット本体（`meta` + `emperors` 配列）。トップレベル構造・各フィールドの詳細は下記スキーマドキュメントを参照。**メイン会話でこのファイル全体を Read しない**（2.9MB超）。対象人物の抽出・Workflow結果のマージは `jq`/`python3` を Bash 経由で行う（詳細: [docs/process/RESEARCH_PROCESS.md](docs/process/RESEARCH_PROCESS.md) の「コンテキスト効率」節）。
- **`data/images/portraits/`** — 肖像画アセット（ライセンス確認済み・`manifest.json`で出典管理）。サイトのカードUI用に将来使用。
- **`china-history/`・`daizhigev20/`** — 正史原文のローカルコーパス（`.gitignore`対象・リポジトリには含まれない、事前に `git clone --depth 1` 済み）。判定の一次情報源として最優先で参照する（詳細: [docs/process/CORPUS_NOTES.md](docs/process/CORPUS_NOTES.md)）。
- **`_corpus_cache/`** — 上記コーパスから人物ごとに抽出・整形済みの本紀原文キャッシュ（`.gitignore`対象、`scripts/build_corpus_cache.py` で再生成可能）。あるブロックの人物に着手する際、該当 `id` のキャッシュが無ければ先にこのスクリプトへ書名・巻・行範囲のマッピングを追記して生成してから調査に入る（詳細: [docs/process/RESEARCH_PROCESS.md](docs/process/RESEARCH_PROCESS.md) の「皇帝ごとの原文キャッシュ」節）。
- **`docs/site-design/`** — Next.js サイトのレイアウト・デザイン方針の先行検討メモ（モックアップ含む）。**実装自体はデータ確定後**（`meta.status.overall` が `in-progress` でなくなってから）に着手する。

## 重要な参考文書

作業内容に応じて以下を参照してください：

| 内容 | ファイル |
|------|--------|
| **ディレクトリ全体の案内** | [docs/README.md](docs/README.md) / [data/README.md](data/README.md) |
| **プロジェクト現状・進捗・追加スキーマTODO** | [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) |
| **データ調査の進め方（手順書）** | [docs/process/RESEARCH_PROCESS.md](docs/process/RESEARCH_PROCESS.md) |
| **ローカルコーパス利用メモ（巻数の罠・行番号インデックス）** | [docs/process/CORPUS_NOTES.md](docs/process/CORPUS_NOTES.md) |
| **絶対に守るべき制約** | [docs/process/CONSTRAINTS.md](docs/process/CONSTRAINTS.md) |
| **JSON スキーマ参照** | [docs/schema/SCHEMA_OVERVIEW.md](docs/schema/SCHEMA_OVERVIEW.md) |

## 最重要ルール（抜粋）

- **原典（正史の本紀・列伝）を第一情報源とします** — WebSearch の要約だけでは判定しません
- **スクリプトの自動生成は禁止** — 人物ごと個別調査・判定が必須（日数計算等の機械的な計算補助や、既に確定した調査結果の構造チェックはOK）
- **データ正確性が最優先** — 誤りのないデータが完成するまでサイト実装には着手しません
- **ブロック調査が1件完了するたびに** `data/emperors.json` の該当データ・`meta.completedBlocks`（または該当フェーズの `*CompletedBlocks`）・`docs/PROJECT_STATUS.md` のチェックボックスを**同じタイミングで**更新する

詳細は [docs/process/CONSTRAINTS.md](docs/process/CONSTRAINTS.md) を参照。

## スキーマ・データ定義

- **JSON フィールド詳細**: [data/schema/EMPERORS_SCHEMA.md](data/schema/EMPERORS_SCHEMA.md)
- **死因スキーマ**: [data/schema/DEATH_CAUSE_SCHEMA.md](data/schema/DEATH_CAUSE_SCHEMA.md)
- **その他スキーマ** (即位経路・改元・大赦など): [data/schema/ADDITIONAL_SCHEMA.md](data/schema/ADDITIONAL_SCHEMA.md)
- **収録基準**: [data/schema/INCLUSION_CRITERIA.md](data/schema/INCLUSION_CRITERIA.md)
