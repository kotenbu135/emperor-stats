# data/ 案内

中国皇帝データセットの実データとスキーマ定義をまとめたディレクトリです。

## 実データ

| ファイル | 内容 |
|---|---|
| [emperors.json](emperors.json) | 始皇帝から溥儀までの皇帝データ本体（`meta` + `emperors` 配列） |

## schema/ — スキーマ・収録基準ドキュメント

`emperors.json` の各フィールドの意味・型・値域や、人物の収録基準を定義したドキュメント群です。スキーマに触れる作業（新フィールド追加・既存フィールドの解釈確認）の前に必ず読んでください。

| ファイル | 内容 |
|---|---|
| [schema/EMPERORS_SCHEMA.md](schema/EMPERORS_SCHEMA.md) | 現行スキーマ全体のリファレンス |
| [schema/DEATH_CAUSE_SCHEMA.md](schema/DEATH_CAUSE_SCHEMA.md) | 死因（`deathCause`）スキーマ設計 |
| [schema/ADDITIONAL_SCHEMA.md](schema/ADDITIONAL_SCHEMA.md) | 死因以外の追加スキーマ設計（即位経路・改元・大赦・立后・皇太子廃立・遷都・親征・反乱鎮圧・被反乱・年齢） |
| [schema/INCLUSION_CRITERIA.md](schema/INCLUSION_CRITERIA.md) | 収録基準（どの人物を収録・除外したか） |

## 関連

- 調査プロセス・進捗管理は [docs/README.md](../docs/README.md) を参照
- リポジトリ全体のルールは [CLAUDE.md](../CLAUDE.md) を参照
