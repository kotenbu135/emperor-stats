# Changelog

データ内容の変更履歴です。版は `meta.version`（CalVer: `YYYY.MM`）で管理します。構造（スキーマ）の変更は `meta.schemaVersion`（semver）で別軸管理し、ここには構造変更も注記として併記します。

## 2026.07 (2026-07-21)

データ内容の版管理を開始した初版です。以下は開始までの主要な変更の遡及記録を含みます。

### 追加・変更（2026-07-21）

- **ライセンス確定**: データ・調査メモ文章を CC BY 4.0、コードを MIT の二重ライセンス構成として宣言（`meta.license` 新設・`data/LICENSE` 配置）
- **`meta.version`（CalVer）新設**、`meta.source` を再定義（primary＝正史原典、Wikipedia「中国帝王一覧」は収録候補リストの初期洗い出し用として位置づけを明確化）
- **在位期間出典の正史差し替え完了**: `reigns[].duration.source` 全365人・約350件を Wikipedia 由来から正史原典（書名・巻名・原文引用・暦換算つき）へ差し替え。過程で旧暦→西暦換算誤り等の日付訂正を約90件実施（詳細は `meta.reignDurationSourceBlocks`）
- **CC BY-SA 混入スクリーニング**: 全 note 約126万字を jawiki 記事本文と突合し、近似一致の3名4箇所（西燕慕容永・更始帝・夏赫連昌）を原典準拠の表現に書き換え
- **`ages` 生没日付の ISO 正規化**（62件のゼロ埋め・旧暦月転記の補正）
- 構造変更: `schemaVersion` 2.0.0 — 未使用の `sources.wikitextLines` をフィールドごと削除、`reigns[].duration.source` に `quote`/`conversion` を正式追加

### 追加（2026-07-20）

- **唐哀帝（`tang-aidi`）を追加収録**: 収録漏れが判明したため原典調査のうえ追加。収録数 364 → **365人**

### 初版（2026-07-18）

- 全12項目 × 364人の調査完了（`meta.status.overall: "completed"`）
