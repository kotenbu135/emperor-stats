# docs/ 案内

このプロジェクトの調査プロセス・進捗管理・スキーマ解説をまとめたディレクトリです。作業内容に応じて以下を参照してください。

## まず読むもの

| ファイル | 内容 |
|---|---|
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | プロジェクト現状・進捗・追加スキーマTODO。作業開始時に必ず確認 |
| [process/CONSTRAINTS.md](process/CONSTRAINTS.md) | 絶対に守るべき制約（スクリプト自動生成禁止など） |

## process/ — 調査プロセス・実務メモ

データ調査に着手する前に読む、手順・制約・実務的な注意点をまとめています。

| ファイル | 内容 |
|---|---|
| [process/RESEARCH_PROCESS.md](process/RESEARCH_PROCESS.md) | データ調査の進め方（手順書） |
| [process/CORPUS_NOTES.md](process/CORPUS_NOTES.md) | ローカルコーパス利用メモ（巻数の罠・行番号インデックス） |
| [process/CONSTRAINTS.md](process/CONSTRAINTS.md) | 絶対に守るべき制約 |

## schema/ — スキーマ解説

| ファイル | 内容 |
|---|---|
| [schema/SCHEMA_OVERVIEW.md](schema/SCHEMA_OVERVIEW.md) | `data/emperors.json` のスキーマ参照ガイド（詳細は [data/schema/](../data/schema/) を参照） |

## site-design/ — サイトレイアウト設計（実装はデータ確定後）

データ調査完了後に着手する Next.js サイトのレイアウト・メニュー構成・グラフ案を先行検討したメモです。

| ファイル | 内容 |
|---|---|
| [site-design/LAYOUT.md](site-design/LAYOUT.md) | 左メニュー構成・スマホ対応方針・カテゴリ別のグラフ/表の具体案 |

## 関連

- データ本体・詳細スキーマ定義は [data/README.md](../data/README.md) を参照
- リポジトリ全体のルールは [CLAUDE.md](../CLAUDE.md) を参照
