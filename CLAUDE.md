# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

中国皇帝統計プロジェクト。始皇帝から溥儀まで、実際に「皇帝」を名乗った365人の在位年数・死因・即位経路など全12項目を正史原典から調査したデータセット（`data/emperors.json`）と、それを可視化する Next.js 静的サイト（`site/`、カスタムドメイン emperorstats.com で公開）で構成されます。

**現在**: データ収集・検証フェーズ（全12項目×364人、`meta.status.overall: "completed"`）とサイト実装（概要ダッシュボード〜全統計ページ・このサイトについて・免責事項）の両方が 2026-07-18 に完了。2026-07-20、収録漏れが判明した唐哀帝（`tang-aidi`）を追加調査・収録し365人に更新。以後の作業は、データ誤りの訂正（GitHub Issue 起点を想定）とサイトの改善・保守が中心です。

## コマンド

ビルド・lint が存在するのは `site/` のみ（リポジトリルートに `package.json` はありません。テストはありません）。Node は nvm の v26.4.0 を使います：

```bash
source ~/.nvm/nvm.sh && nvm use 26.4.0
cd site
npm run dev        # 開発サーバー http://localhost:3000/
npm run build      # 静的書き出し → out/（predev/prebuild で肖像画同期 sync-portraits が走る）
npm run lint       # ESLint
npx tsc --noEmit   # 型チェック
```

サイト側の詳細（アーキテクチャ・ハマりどころ）は [site/AGENTS.md](site/AGENTS.md) を参照。

`data/emperors.json` を訂正した際は、コミット前に必ず構造検証を実行する（`.github/workflows/validate-data.yml` で push 時にも自動実行される）：

```bash
python3 scripts/validate_emperors.py   # スキーマ・日付整合性・reignSummary整合性・禁止出典などをチェック
```

## リポジトリ構成

- **`data/emperors.json`** — メインデータセット本体（`meta` + `emperors` 配列）。サイトがビルド時に直接読み込む。**メイン会話でこのファイル全体を Read しない**（約7MB）。対象人物の抽出・訂正結果のマージは `jq`/`python3` を Bash 経由で行う（詳細: [docs/process/RESEARCH_PROCESS.md](docs/process/RESEARCH_PROCESS.md) の「コンテキスト効率」節）。
- **`site/`** — Next.js サイト（静的書き出し・emperorstats.com で公開）。詳細は [site/AGENTS.md](site/AGENTS.md)。
- **`data/images/portraits/`** — 肖像画アセット（PD/CC0 のみ・`manifest.json` で出典管理）。サイトの皇帝一覧カード・出典一覧で使用中。
- **`china-history/`・`daizhigev20/`** — 正史原文のローカルコーパス（`.gitignore` 対象・リポジトリには含まれない、事前に `git clone --depth 1` 済み）。データ訂正時の一次情報源として最優先で参照する（詳細: [docs/process/CORPUS_NOTES.md](docs/process/CORPUS_NOTES.md)）。
- **`_corpus_cache/`** — 上記コーパスから人物ごとに抽出・整形済みの本紀原文キャッシュ（`.gitignore` 対象、`scripts/build_corpus_cache.py` で再生成可能）。キャッシュが無い人物を調査する際は、先にこのスクリプトへ書名・巻・行範囲のマッピングを追記して生成してから調査に入る（詳細: [docs/process/RESEARCH_PROCESS.md](docs/process/RESEARCH_PROCESS.md) の「皇帝ごとの原文キャッシュ」節）。
- **`docs/site-design/`** — サイトのレイアウト設計メモ兼実装記録（[LAYOUT.md](docs/site-design/LAYOUT.md)）。実装済みの決定事項・教訓が時系列で追記されている。

## 重要な参考文書

作業内容に応じて以下を参照してください：

| 内容 | ファイル |
|------|--------|
| **ディレクトリ全体の案内** | [docs/README.md](docs/README.md) / [data/README.md](data/README.md) |
| **プロジェクト現状・データ品質の申し送り** | [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) |
| **データ調査の進め方（訂正時もこの手順）** | [docs/process/RESEARCH_PROCESS.md](docs/process/RESEARCH_PROCESS.md) |
| **ローカルコーパス利用メモ（巻数の罠・行番号インデックス、着手前必読）** | [docs/process/CORPUS_NOTES.md](docs/process/CORPUS_NOTES.md) |
| **絶対に守るべき制約** | [docs/process/CONSTRAINTS.md](docs/process/CONSTRAINTS.md) |
| **AI調査の知見集（設計指針・失敗事例）** | [docs/process/AI_RESEARCH_LESSONS.md](docs/process/AI_RESEARCH_LESSONS.md) |
| **JSON スキーマ参照** | [docs/schema/SCHEMA_OVERVIEW.md](docs/schema/SCHEMA_OVERVIEW.md) |
| **サイトの設計判断・実装記録** | [docs/site-design/LAYOUT.md](docs/site-design/LAYOUT.md) |

## 最重要ルール（抜粋）

- **原典（正史の本紀・列伝）を第一情報源とします** — WebSearch の要約だけでは判定しません
- **正史原典調査（データ訂正・新規ブロック着手）に入る前に、必ず [docs/process/CORPUS_NOTES.md](docs/process/CORPUS_NOTES.md) と [docs/process/RESEARCH_PROCESS.md](docs/process/RESEARCH_PROCESS.md) を読むこと**。「存在は知っている」「前回読んだ」では不十分で、対象王朝・書物ごとに調査着手のたびに読み直す。両ファイルには「china-history の相対巻数（絶対巻数－50）」「帝紀に独立記述のない人物は列伝で代替」など、読まずに進めると誤った巻・誤った日付を採用してしまう罠が書物・王朝別に記録されている。読まずに調査エージェント（Workflow等）を起動し、後から欠落に気づいて手戻りする事故が複数回発生している
- **スクリプトによるデータの自動生成は禁止** — 人物ごと個別調査・判定が必須（日数計算等の機械的な計算補助や、確定済み調査結果の構造チェックはOK）
- **データ正確性が最優先** — データに誤りが見つかった場合は個別調査で訂正するのが原則で、サイト側での場当たり的な補正はしません（表示破綻の回避のみ許容。既知の例は [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) の申し送り事項を参照）
- **データを訂正したら** `data/emperors.json` の該当データと関連する `meta` 情報・ドキュメントを**同じタイミングで**更新する

詳細は [docs/process/CONSTRAINTS.md](docs/process/CONSTRAINTS.md) を参照。

## スキーマ・データ定義

- **JSON フィールド詳細**: [data/schema/EMPERORS_SCHEMA.md](data/schema/EMPERORS_SCHEMA.md)
- **死因スキーマ**: [data/schema/DEATH_CAUSE_SCHEMA.md](data/schema/DEATH_CAUSE_SCHEMA.md)
- **その他スキーマ** (即位経路・改元・大赦など): [data/schema/ADDITIONAL_SCHEMA.md](data/schema/ADDITIONAL_SCHEMA.md)
- **収録基準**: [data/schema/INCLUSION_CRITERIA.md](data/schema/INCLUSION_CRITERIA.md)
- **系譜・即位経路グラフ** (`data/kinship.json`・調査中): [data/schema/KINSHIP_SCHEMA.md](data/schema/KINSHIP_SCHEMA.md)。検証は `python3 scripts/validate_kinship.py`
