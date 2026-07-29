# docs/ 案内

このプロジェクトの調査プロセス・進捗管理・スキーマ解説をまとめたディレクトリです。作業内容に応じて以下を参照してください。

## まず読むもの

| ファイル | 内容 |
|---|---|
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | プロジェクト現状・進行中の作業・データ品質やサイトの申し送り事項。作業開始時に必ず確認 |
| [QA_HISTORY.md](QA_HISTORY.md) | 完了済みのデータ QA・出典整備の作業記録（同種の QA を回すときの手順書） |
| [process/CONSTRAINTS.md](process/CONSTRAINTS.md) | 絶対に守るべき制約（スクリプト自動生成禁止など） |

## process/ — 調査プロセス・実務メモ

データ調査に着手する前に読む、手順・制約・実務的な注意点をまとめています。

| ファイル | 内容 |
|---|---|
| [process/RESEARCH_PROCESS.md](process/RESEARCH_PROCESS.md) | データ調査の進め方（手順書） |
| [process/CORPUS_NOTES.md](process/CORPUS_NOTES.md) | ローカルコーパス利用メモ（書物・王朝を問わず効く罠と原則。**調査着手のたびに読む**） |
| [process/SOURCE_MAPPING.md](process/SOURCE_MAPPING.md) | 史料マッピング・行番号インデックス（王朝ブロックごとの書名・巻・行範囲。担当ブロックの表だけを引く辞書） |
| [process/CONSTRAINTS.md](process/CONSTRAINTS.md) | 絶対に守るべき制約 |
| [process/AI_RESEARCH_LESSONS.md](process/AI_RESEARCH_LESSONS.md) | 史書をAIで調査する方法の知見集（なぜその方法か・失敗事例・一般化可能な設計指針） |

## schema/ — スキーマ解説

| ファイル | 内容 |
|---|---|
| [schema/SCHEMA_OVERVIEW.md](schema/SCHEMA_OVERVIEW.md) | `data/emperors.json` のスキーマ参照ガイド（詳細は [data/schema/](../data/schema/) を参照） |

## site-design/ — 新サイトのデザイン資料

旧 Next.js サイト（`site/`）とその設計ドキュメント一式は 2026-07-29 に削除しました（ゼロベース再構築のため）。現在ここにあるのは、新サイトを外部のデザインツール（Claude Design）に依頼するための資料です。

| ファイル | 内容 |
|---|---|
| [../DESIGN.md](../DESIGN.md) | **デザインシステム（規範）** — 配色（時代11色・カテゴリ8色は contrast/CVD 検証済み）・タイポグラフィ・コンポーネント仕様・アクセシビリティ・性能規範・禁止事項。リポジトリ直下 |
| [site-design/CLAUDE_DESIGN_PROMPT.md](site-design/CLAUDE_DESIGN_PROMPT.md) | Claude Design へ渡す依頼プロンプト（画面仕様＋v3 スキーマのデータ契約＋エッジケース一覧） |
| [site-design/fixtures/emperors.sample.json](site-design/fixtures/emperors.sample.json) | 上のプロンプトに添付する実データ抜粋（14人・全11時代・エッジケース網羅。`meta._fixture` に切り詰め内容を明記） |

## 関連

- データ本体・詳細スキーマ定義は [data/README.md](../data/README.md) を参照
- リポジトリ全体のルールは [CLAUDE.md](../CLAUDE.md) を参照
