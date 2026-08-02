---
name: profile-block
description: 皇帝の紹介文（GitHub Issue #16）を1ブロック書くときの入口。4段のエージェント構成・ゲート・投入手順を揃える
---

# 紹介文を1ブロック書く

**手順の本文は `docs/process/profile-writing/README.md` が正**です（4段の雛形もそこ）。
このスキルは「毎回同じ形で回す」ための入口で、規則を写し直すためのものではありません。

## 段ごとに別エージェント

| 段 | エージェント | 雛形 | 体数 |
|---|---|---|---|
| 1. 執筆 | `profile-writer` | `WRITER.md` | 1 |
| 2. 敵対的検証 | `adversarial-verifier` | `VERIFIER.md` | **1 か 3**（下記） |
| 3. Web 差分検出 | `profile-webdiff` | `WEBDIFF.md` | 1 |
| 4. 修正 | `profile-reviser` | `REVISER.md` | 1 |

**同じエージェントに続けてやらせない**（自分の書いたものを自分で検証することになる）。
段構成を書くときは `.claude/workflows/` の既存スクリプトに倣い、**検証段を省かない**
（省いた回に世代の取り違え・素材由来の誤りが通った）。

## 2段目の体数は政権の史料形態で決まる

```bash
python3 scripts/check_verification.py --for <皇帝id>    # 着手時。tier・体数・観点が出る
```

本紀・帝紀が独立して立つ王朝（`own-annals`）は1体（`facts`）、載記・類書・別史・地方志に依存する
政権（`dependent`）は**3体**（`facts`・`kinship`・`dates`）。実測の欠陥密度が 0件/人 と 1.56件/人 で
段になっているためです（規則 `R-VERIFY-TIER`）。**記録に無い政権は厚い側**。体数を自分で決めない。

ブロックを終えたら `data/verification.json` の `blocks` へ **`raised`（指摘を `(field, problem)` で
畳んだ件数）と `confirmed`（そのうち実欠陥）** を記録します。`--rate` で率の表が出ます。

## 1段目に note を渡さない

**原文 → 引用台帳 `claims` → 素材の構造フィールド。**
`extract_profile_material.py` は**既定で note を伏せます**。執筆段に `--notes on` を付けないこと
（付けてよいのは検証段だけ）。順序ではなく**誰が見るかで分ける**設計です（2026-08-02〜）。
台帳に無い事実は書けません。**原文が続柄を直接述べていない関係は書かない。**

## ゲート

```bash
python3 scripts/check_profile_fragment.py <断片.json> --basis-corpus
python3 scripts/check_profile_ngram.py <断片.json> --frag-dir <断片ディレクトリ>
python3 scripts/add_profile.py <断片.json>        # 投入は親セッションだけ
python3 scripts/validate_profiles.py && python3 scripts/validate_readings.py
python3 scripts/coverage.py --write   # 本数が増えたら進捗表記を引き直す（忘れると CI が落ちる）
python3 scripts/check_verification.py # blocks に指摘率を記録したら
```

`check_profile_fragment.py` の**報告欄はエラーと同じくらい重要**です（台帳の裏取り・台帳に無い数値・
前任者との続柄の食い違い）。エラー0でも報告を読まずに通さないこと。

## 素材の誤りは起票する

note と原文の食い違いは紹介文を直して終わりにせず、**`emperors.json` 側の疑いとして
GitHub Issue に起票**します（#32・#33 は訂正済み、#36 が未訂正）。
「食い違い: なし」も明示させること — 無言を「照合した」と読まない。

手順の改善に気づいたら、その場でユーザーへ提案してください（規則 `R-PROCESS-FEEDBACK`）。
