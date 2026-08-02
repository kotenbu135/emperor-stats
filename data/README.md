# data/ 案内

中国皇帝データセットの実データとスキーマ定義をまとめたディレクトリです。

## 実データ

| ファイル | 内容 |
|---|---|
| [emperors.json](emperors.json) | 始皇帝から溥儀までの皇帝データ本体（`meta` + `emperors` 配列） |
| [kinship.json](kinship.json) | 系譜・即位経路グラフ（ブリッジ人物 `persons` + エッジ3種 + 系譜主張。皇帝ノードは emperors.json を id 参照。調査中） |
| [regime-conventions.json](regime-conventions.json) | **調査の簿記であってデータセットではない**。「この正史はこの政権のこの項目をどこに・どんな書式で載せるか」を原典から政権単位に確定した記録で、人物単位の調査対象を絞るために使う（規則 `R-REGIME-FIRST`）。**値は書かない** — 書けるのは書式・所在と、原典が制度そのものを明言している場合のその明文だけ。サイトのビルドもバリデータも読まない |
| [screenings.json](screenings.json) | **調査の簿記であってデータセットではない**。原典を読む前に機械で母集団を絞った記録（「母集団 N → 要読解 M」）で、絞り込み自体は `scripts/screens/*.py`（規則 `R-SCREEN-FIRST`）。**記録の数字はゲートがスクリプトを実行して突き合わせる**ので、データが動けば落ちる（`check_screenings.py --update` で件数だけ引き直す）。**機械が何も見つけなかった側は「値が無い」ではない**ので種つき標本の監査を持つ。サイトのビルドもバリデータも読まない |
| [verification.json](verification.json) | **調査の簿記であってデータセットではない**。検証段に何体立てるかを政権の史料形態から引くための記録（規則 `R-VERIFY-TIER`）。正史が一代通しの独立記述を立てる政権は1体、載記・類書・別史・地方志に依存する政権は3体。**記録に無い政権は厚い側（3体）**で、1体へ減らす側にだけ書名・所在の根拠が要る。ブロック別の指摘率（`raised`／`confirmed`）もここに残す。サイトのビルドもバリデータも読まない |
| [emperor-profiles.json](emperor-profiles.json) | 皇帝個別ページの紹介文（[Issue #16](https://github.com/kotenbu135/emperor-stats/issues/16)・執筆中）。**原典調査の結果ではなく編集コンテンツ**で、既存の調査結果を読者向けに言い直したもの。`emperors.json` と別ファイルなのは、性格が違うことに加えて約7MBのデータセットを365回の追記で触ると並行セッションと衝突するため |

### internal/ — 配布物が主張しない値の置き場（2026-08-03・Issue #69）

| ファイル | 内容 |
|---|---|
| [internal/event-date-archive.json](internal/event-date-archive.json) | `events[]` の日付を「年精度 ＋ 在位境界年の月日」へ絞ったときに**丸めた月日**（6,258値・4,170 events）。鍵は `events[].id` |

**「内部」は隠す場所ではありません**（リポジトリは public でコミットもしています）。意味は
**引用され得る配布物の主張に含めない**ことです。3つの性質で成り立っています:

- **追記しない。** 分割時に1回書いたきりで、読むのは精度を戻すときだけ。2ファイル目が編集され続けると
  そこだけ `patch_emperor.py`（sha256 照合とゲート案内を持つ唯一の正規経路）の外になる
- **中身をゲートで検査しない。** 見るのは配布物との対応だけ（鍵が実在の event を指すか・
  配布物の値が退避値の接頭辞か＝`validate_emperors.py` の `check_event_date_archive`）
- **これ以上精度を追求しない**（ユーザー決定）。誤りと分かっている値も入ったまま固定されている
  （`docs/process/RESIDUAL.md` の #62 の9件）。戻すときはその節を先に読む

**`emperor-profiles.json` は配布物に含めていない**（`site/scripts/build-data-distribution.mjs` が `public/data/` へ出すのは emperors.json・emperors.csv・emperors.schema.json の3本のみ）。含めるかは別途の判断で、既定は「含めない」。

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
