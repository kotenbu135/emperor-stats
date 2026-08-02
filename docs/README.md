# docs/ 案内

調査プロセス・進捗管理・スキーマ解説の置き場。**必要な1本だけを開くための索引**なので、ここから先は目的に合う行のリンクだけを開く。

リポジトリ全体の入口は [../CLAUDE.md](../CLAUDE.md)、データ本体側は [../data/README.md](../data/README.md)。

## 現状を知る

| ファイル | 中身 |
|---|---|
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | **作業開始時に読む**。現状・フェーズ進捗・実測カバレッジ・データ品質の申し送り・kinship の状況 |
| [process/RESIDUAL.md](process/RESIDUAL.md) | **残量表**。走査・横展開で出た「残り何件」の置き場（新しい Issue を立てずここへ行を足す・規則 `R-RESIDUAL-TABLE`） |

## 作業中に引く（process/）

| ファイル | いつ開くか |
|---|---|
| [process/RESEARCH_PROCESS.md](process/RESEARCH_PROCESS.md) | 原典調査・訂正の手順。**引用の取り扱い規約の全文はここ** |
| [process/CORPUS_NOTES.md](process/CORPUS_NOTES.md) | **原典調査に入る前に必読**。書物・王朝を問わず効く罠（相対巻数・白話訳・検索のメモリ事故） |
| [process/SOURCE_MAPPING.md](process/SOURCE_MAPPING.md) | 担当ブロックの書名・巻・行範囲を引く辞書（表だけを引く） |
| [process/RULES.yml](process/RULES.yml) | **規則の台帳**。適用範囲・強制層・その規則を書かせた実際の失敗。自己検査は `scripts/check_rules.py` |
| [process/CONSTRAINTS.md](process/CONSTRAINTS.md) | 絶対に守るべき制約（冒頭に「削ってよい指示との区別」） |
| [process/COUPLINGS.md](process/COUPLINGS.md) | 結合レジストリ（Xを触ったらYも触る）。実体は `scripts/patch_emperor.py` が触ったパスから出す |
| [process/CLAIMS_CONTRACT.md](process/CLAIMS_CONTRACT.md) | 調査エージェントの出力契約（claims-first） |
| [process/profile-writing/](process/profile-writing/) | 紹介文（Issue #16）の4段手順とプロンプト雛形（README・WRITER・VERIFIER・WEBDIFF・REVISER） |
| [process/PROCESS_IMPROVEMENTS.md](process/PROCESS_IMPROVEMENTS.md) | 手順改善の提案と採否。**通読しない** — 新しい提案を末尾へ足すための台帳 |
| [process/AI_RESEARCH_LESSONS.md](process/AI_RESEARCH_LESSONS.md) | 史書をAIで調査する方法の知見集（なぜその方法か・失敗事例・一般化できる設計指針）。10節はエージェント運用とドキュメントの書き方 |

## スキーマ（schema/ と data/schema/）

| ファイル | 中身 |
|---|---|
| [schema/SCHEMA_OVERVIEW.md](schema/SCHEMA_OVERVIEW.md) | `data/emperors.json` のスキーマ参照ガイド（フィールド詳細は [../data/schema/](../data/schema/)） |
| [schema/V3_MIGRATION_PLAN.md](schema/V3_MIGRATION_PLAN.md) | **完了記録**（2026-07-29・Issue #22）。v3 の設計判断を確かめたいときだけ開く |

## サイト（site-design/）

**サイトを触る前に読むのは [../site/AGENTS.md](../site/AGENTS.md)（崩すとビルドが落ちる契約）と [site-design/SITE_DESIGN.md](site-design/SITE_DESIGN.md)（設計と決定の記録）の2本だけ。** 旧サイト（2026-07-31 以前）の設計記録は同日すべて削除した（旧サイトの記述が残っていると新しい実装の判断がそれに引きずられるため）。

| ファイル | 中身 |
|---|---|
| [site-design/SITE_DESIGN.md](site-design/SITE_DESIGN.md) | **サイトの設計と決定の記録**。ページ構成・スタック・配色・各ページの設計判断・再提案しないこと |
| [site-design/PORTRAITS.md](site-design/PORTRAITS.md) | 肖像画の収集結果（PD/CC0 のみ・154名分）と増減手順 |
| `site-design/mockups/card-preview/` | 肖像画 webp 154点。**`site/scripts/sync-portraits.mjs` のビルド入力なので消さないこと** |
| `site-design/portraits-candidates.json` | 肖像画の候補調査の生データ |
| [site-design/CHART_CANDIDATES_2026-07-31.md](site-design/CHART_CANDIDATES_2026-07-31.md) | グラフにする価値のあるデータの検討（実測済み・未実装の候補一覧） |
| [site-design/EMPEROR_PAGE_PLAN_2026-08-01.md](site-design/EMPEROR_PAGE_PLAN_2026-08-01.md)・[RUBY_PLAN_2026-08-01.md](site-design/RUBY_PLAN_2026-08-01.md)・[NAME_DISPLAY_PLAN_2026-08-02.md](site-design/NAME_DISPLAY_PLAN_2026-08-02.md) | **実装済みの設計記録**。コードから参照されているので消さない。現状は SITE_DESIGN.md と AGENTS.md が正 |

## 完了記録（通読しない・同型の作業を回すときだけ開く）

| ファイル | 中身 |
|---|---|
| [QA_HISTORY.md](QA_HISTORY.md) | 完了済みのデータ QA・出典整備（出典の一掃・QID 紐付け・ISO 正規化ほか）。「何を疑い・どう検出し・何件どう直したか」の手順書 |
| [process/RESEARCH_QA_PLAN_2026-08-02.md](process/RESEARCH_QA_PLAN_2026-08-02.md) | 引用照合の作り直しとデータ整合ゲート G1〜G4（Issue #40）の検討と実測 |
| [process/RESEARCH_RULE_ENFORCEMENT_2026-08-02.md](process/RESEARCH_RULE_ENFORCEMENT_2026-08-02.md) | 規則の強制層（L0〜L4）を決めた検討。結論は `process/RULES.yml` が持っている |
| [process/RESEARCH_ITEM_CANDIDATES_2026-07-31.md](process/RESEARCH_ITEM_CANDIDATES_2026-07-31.md) | 追加調査項目の候補出し |
| [qa/](qa/) | Issue ごとの調査記録（`issue33-sweep`・`issue34-event-date`・`issue35-rival-naming`・`issue36-note-corpus-mismatch`・`note-verification`・`kinship-bawang`） |
