# data/ 案内

中国皇帝データセットの実データとスキーマ定義をまとめたディレクトリです。

## 実データ

| ファイル | 内容 |
|---|---|
| [emperors.json](emperors.json) | 始皇帝から溥儀までの皇帝データ本体（`meta` + `emperors` 配列） |
| [kinship.json](kinship.json) | 系譜・即位経路グラフ（ブリッジ人物 `persons` + エッジ3種 + 系譜主張。皇帝ノードは emperors.json を id 参照。調査中） |

データ・調査メモ文章のライセンスは **CC BY 4.0**（[LICENSE](LICENSE)、コードはルートの MIT と二重ライセンス構成・`meta.license` にも機械可読で記載）。変更履歴はルートの [CHANGELOG.md](../CHANGELOG.md) を参照してください。

### quote-refs.json — 引用照合台帳（内部 QA 用）

`emperors.json` 内の正史原文引用（6,500件超）それぞれについて「ローカルコーパスのどのファイルで実在確認したか」を
記録する台帳。`scripts/verify_quotes.py` が生成・検証する（引用を変更するとハッシュ不一致で検証が落ちるため、
引用の無断改変・手打ちを機械的に防ぐ）。コーパス（`china-history/`・`daizhigev20/`）はリポジトリ外のため、
この台帳の照合はローカル環境専用。status の意味と運用は `scripts/verify_quotes.py` の docstring を参照。

## schema/ — スキーマ・収録基準ドキュメント

`emperors.json` の各フィールドの意味・型・値域や、人物の収録基準を定義したドキュメント群です。スキーマに触れる作業（新フィールド追加・既存フィールドの解釈確認）の前に必ず読んでください。

| ファイル | 内容 |
|---|---|
| [schema/EMPERORS_SCHEMA.md](schema/EMPERORS_SCHEMA.md) | 現行スキーマ全体のリファレンス |
| [schema/DEATH_CAUSE_SCHEMA.md](schema/DEATH_CAUSE_SCHEMA.md) | 死因（`deathCause`）スキーマ設計 |
| [schema/ADDITIONAL_SCHEMA.md](schema/ADDITIONAL_SCHEMA.md) | 死因以外の追加スキーマ設計（即位経路・改元・大赦・立后・皇太子廃立・遷都・親征・反乱鎮圧・被反乱・年齢） |
| [schema/INCLUSION_CRITERIA.md](schema/INCLUSION_CRITERIA.md) | 収録基準（どの人物を収録・除外したか） |
| [schema/KINSHIP_SCHEMA.md](schema/KINSHIP_SCHEMA.md) | 系譜・即位経路グラフ（`kinship.json`）のスキーマ・ブリッジ人物収録基準・調査計画 |

## 関連

- 調査プロセス・進捗管理は [docs/README.md](../docs/README.md) を参照
- リポジトリ全体のルールは [CLAUDE.md](../CLAUDE.md) を参照
