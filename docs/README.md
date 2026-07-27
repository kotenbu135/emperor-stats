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

## site-design/ — サイトレイアウト設計・実装記録

Next.js サイト（`../site/`、2026-07-18実装完了）のレイアウト・メニュー構成・グラフ案の検討メモと、実装時の決定事項・教訓の時系列記録です。

| ファイル | 内容 |
|---|---|
| [site-design/LAYOUT.md](site-design/LAYOUT.md) | **方針・規範**（基本レイアウト・メニュー構成・グラフ/表の具体案・デザイン世界観・技術スタック）＋実装記録の索引 |
| [site-design/PERFORMANCE.md](site-design/PERFORMANCE.md) | 性能・計測の記録（Lighthouse・実機 timespan）。`site/src/` のコード内コメントが参照する計測記録はここ |
| [site-design/IMPLEMENTATION_LOG.md](site-design/IMPLEMENTATION_LOG.md) | 実装記録（2026-07-18〜22。雛形〜MVP〜全統計ページ〜SEO〜個別ページ〜/kinship 試作） |
| [site-design/REDESIGN_2026-07.md](site-design/REDESIGN_2026-07.md) | デザイン再構成の記録（2026-07-27。王朝色システム・トップ/一覧/ランキング再構成・共通シェル） |
| [site-design/TIMELINE.md](site-design/TIMELINE.md) | 通史年表（`/timeline`）の設計・実装記録（第2世代「大河ビュー」） |
| [site-design/KINSHIP.md](site-design/KINSHIP.md) | 系譜・家系図（`/kinship`）の拡張ガイド（章スコープ・レイアウト規範・手動配置編集・公開状態） |
| [site-design/KINSHIP_LOG.md](site-design/KINSHIP_LOG.md) | `/kinship` の章ごとの実装・レビュー対応の時系列記録と、完了した追加調査タスク |
| [site-design/METHODOLOGY.md](site-design/METHODOLOGY.md) | サイト掲載用の方法論文言ドラフト（収録基準・数え方の説明） |
| [site-design/PORTRAITS.md](site-design/PORTRAITS.md) | 肖像画収集の調査結果（PD/CC0 のみ・150名分確定）＋肖像マッピングQAの手順・反映先 |

## 関連

- データ本体・詳細スキーマ定義は [data/README.md](../data/README.md) を参照
- リポジトリ全体のルールは [CLAUDE.md](../CLAUDE.md) を参照
