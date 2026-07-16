# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

中国皇帝データセット（`data/emperors.json`）構築プロジェクト。始皇帝から溥儀までの在位年数・死因・即位経路などを統計化し、最終的に Next.js + GitHub Pages でグラフ化します。

**現在**: データ収集・検証フェーズ（在位データ・死因・即位経路は調査完了、改元・大赦・立后・皇太子廃立ほかの追加スキーマ調査中）

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

- ✅ **原典（正史の本紀・列伝）を第一情報源とします** — WebSearch の要約だけでは判定しません
- ✅ **スクリプトの自動生成は禁止** — 人物ごと個別調査・判定が必須
- ✅ **データ正確性が最優先** — 誤りのないデータが完成するまでサイト実装には着手しません

詳細は [docs/process/CONSTRAINTS.md](docs/process/CONSTRAINTS.md) を参照。

## スキーマ・データ定義

- **JSON フィールド詳細**: [data/schema/EMPERORS_SCHEMA.md](data/schema/EMPERORS_SCHEMA.md)
- **死因スキーマ**: [data/schema/DEATH_CAUSE_SCHEMA.md](data/schema/DEATH_CAUSE_SCHEMA.md)
- **その他スキーマ** (即位経路・改元・大赦など): [data/schema/ADDITIONAL_SCHEMA.md](data/schema/ADDITIONAL_SCHEMA.md)
- **収録基準**: [data/schema/INCLUSION_CRITERIA.md](data/schema/INCLUSION_CRITERIA.md)
