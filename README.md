# emperor-stats

中国皇帝統計 — 始皇帝から溥儀まで、実際に「皇帝」を名乗った365人の在位年数・死因・即位経路など全12項目を正史原典から調査したデータセットと、その可視化サイトです。

- **公開サイト**: [emperorstats.com](https://emperorstats.com)
- **データセット本体**: [data/emperors.json](data/emperors.json)（スキーマは [data/schema/](data/schema/)、収録基準は [data/schema/INCLUSION_CRITERIA.md](data/schema/INCLUSION_CRITERIA.md)）
- **サイトのソース**: [site/](site/)（Next.js 静的書き出し、開発手順は [site/README.md](site/README.md)）
- **調査プロセス・進捗の記録**: [docs/](docs/)

データの誤りのご指摘・お問い合わせは [GitHub の Issue](https://github.com/kotenbu135/emperor-stats/issues) へお願いします。

## データの入手

ビルド済みの配布物をサイトから直接ダウンロードできます（すべて CORS 許可済み・gzip 配信）:

- JSON（完全版）: <https://emperorstats.com/data/emperors.json>
- CSV（1行1皇帝の平坦化版・40列）: <https://emperorstats.com/data/emperors.csv>
- JSON Schema: <https://emperorstats.com/data/emperors.schema.json>

## ライセンス

二重ライセンス構成です（`data/emperors.json` の `meta.license` にも機械可読な形で記載）:

- **データ・調査メモ文章**（`data/` 以下のデータセットと、その中の note 等の自由記述）: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja)（全文: [data/LICENSE](data/LICENSE)）。出典を明記すれば商用を含め自由に利用できます。
- **コード**（`site/`・`scripts/` ほか）: [MIT License](LICENSE)

帰属表示の例:

> 出典: 中国皇帝統計 (emperorstats.com), CC BY 4.0

データ内容の版は `meta.version`（CalVer: `YYYY.MM`）で管理し、変更履歴は [CHANGELOG.md](CHANGELOG.md) に記録します。
