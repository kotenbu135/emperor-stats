# docs/ 案内

このプロジェクトの調査プロセス・進捗管理・スキーマ解説をまとめたディレクトリです。作業内容に応じて以下を参照してください。

## まず読むもの

| ファイル | 内容 |
|---|---|
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | プロジェクト現状・進行中の作業・データ品質やサイトの申し送り事項。作業開始時に必ず確認 |
| [QA_HISTORY.md](QA_HISTORY.md) | 完了済みのデータ QA・出典整備の作業記録（同種の QA を回すときの手順書） |
| [process/CONSTRAINTS.md](process/CONSTRAINTS.md) | 絶対に守るべき制約（スクリプト自動生成禁止など）。冒頭に「削ってよい指示との区別」を明記 |

## process/ — 調査プロセス・実務メモ

データ調査に着手する前に読む、手順・制約・実務的な注意点をまとめています。

| ファイル | 内容 |
|---|---|
| [process/RESEARCH_PROCESS.md](process/RESEARCH_PROCESS.md) | データ調査の進め方（手順書） |
| [process/CORPUS_NOTES.md](process/CORPUS_NOTES.md) | ローカルコーパス利用メモ（書物・王朝を問わず効く罠と原則。**調査着手のたびに読む**） |
| [process/SOURCE_MAPPING.md](process/SOURCE_MAPPING.md) | 史料マッピング・行番号インデックス（王朝ブロックごとの書名・巻・行範囲。担当ブロックの表だけを引く辞書） |
| [process/CONSTRAINTS.md](process/CONSTRAINTS.md) | 絶対に守るべき制約 |
| [process/AI_RESEARCH_LESSONS.md](process/AI_RESEARCH_LESSONS.md) | 史書をAIで調査する方法の知見集（なぜその方法か・失敗事例・一般化可能な設計指針）。10節はエージェント運用とドキュメントの書き方（progressive disclosure・Workflow のパターン選択） |

## schema/ — スキーマ解説

| ファイル | 内容 |
|---|---|
| [schema/SCHEMA_OVERVIEW.md](schema/SCHEMA_OVERVIEW.md) | `data/emperors.json` のスキーマ参照ガイド（詳細は [data/schema/](../data/schema/) を参照） |

## site-design/ — サイトの設計記録と肖像画アセット

**旧サイト（2026-07-31 以前）の設計記録は同日すべて削除しました**（作り替えにあたり、旧サイトの記述が
残っていると新しい実装の判断がそれに引きずられる、という判断）。ここにあるのは新サイトの設計記録と、
サイトの見た目とは独立して有効な肖像画アセットの管理です。

崩すとビルドが落ちる契約は `../site/AGENTS.md`（サイトを触る前に必読）。

| ファイル | 内容 |
|---|---|
| [site-design/SITE_DESIGN.md](site-design/SITE_DESIGN.md) | **サイトの設計と決定の記録**。ページ構成・スタック・配色の考え方・各ページの設計判断・決着済みで再提案しないこと |
| [site-design/CHART_CANDIDATES_2026-07-31.md](site-design/CHART_CANDIDATES_2026-07-31.md) | グラフにする価値のあるデータの検討（実測済み・実装は未着手の候補一覧） |
| [site-design/PORTRAITS.md](site-design/PORTRAITS.md) | 肖像画収集の調査結果（PD/CC0 のみ・145名分確定）＋肖像マッピングQAの手順・反映先 |
| `site-design/mockups/card-preview/` | 肖像画 webp 145点。**`site/scripts/sync-portraits.mjs` のビルド入力なので消さないこと** |
| `site-design/portraits-candidates.json` | 肖像画の候補調査の生データ |

## 関連

- データ本体・詳細スキーマ定義は [data/README.md](../data/README.md) を参照
- リポジトリ全体のルールは [CLAUDE.md](../CLAUDE.md) を参照
