---
name: write-profile
description: 皇帝の紹介文（GitHub Issue #16）を書く入口。原文1巡＋Web差分の2段・ルビは難読語だけ・basis はポインタ。規範は docs/process/profile-writing/README.md
---

# 紹介文を書く

**規範の全文は [docs/process/profile-writing/README.md](../../../docs/process/profile-writing/README.md)。
着手前に読むこと。** ここに置くのは実行の順序と、外すと費用が跳ねる点だけ。

見本は `data/emperor-profiles.json` の5本 — `sui-wendi`（原文72,150B）・
`nanyan-murongchao`（18,631B）・`han-yuandi`（14,639B）・`beiwei-tuobayu`（686B）・
`xiliao-renzong`（234B）。**原文が300倍違っても本文は7倍しか違わない。**

## まとめて進めるとき（Workflow）

```
Workflow({ name: 'write-profile', args: { ids: [...], workDir: '/tmp/write-profile-<日付>' } })
```

段構成は `.claude/workflows/write-profile.js`（執筆 → Web差分 → 反映）。
**エージェントに `data/emperor-profiles.json` を書かせない** — 断片は `workDir` へ1人1ファイルで
置かせ、本体への転記は戻ってきてから `scripts/add_profile.py` で1本ずつ流す（`R-RMW`）。
`isolation: 'worktree'` を付けない（コーパスの symlink が無い worktree ではコーパス依存の
検査が**黙ってスキップ**される・`R-WORKTREE-SETUP`）。

## 手順は2段

### 1段目 — 執筆

```bash
python3 scripts/extract_profile_material.py <皇帝id>    # 既定で note を伏せる。--notes on を付けない
```

末尾に**読み地図**（本紀のどこが詔・冊文でどこが叙事か）と**列伝の在り処**が出る。
1巡の時間配分はここから決める — 大物ほど詔・冊文の割合が高く、そこから取れる材料は薄い
（隋の文帝は23%が詔・冊文）。**飛ばすのではなく速度を変える**（詔にも大赦・改元・遷都は載る）。

**本紀の原文キャッシュ `_corpus_cache/<id>.txt` を1巡だけ読んで書く。**
読み直さない。**簡体字**なので検索も簡体字で（`scripts/hanzi_norm.py`）。

書くのは `lead`・`body`・`description`・`basis` の4つと、断片の中だけに置く
**引用台帳 `claims`**（`[{"text": 書く事実, "quote": 根拠の原文句, "src": "ファイル:行"}]`）。
全員に同じ5つの問い（誰の何にあたる人か／どう即位したか／在位中に何が起きたか／
どう終わったか／**記録が伝えないことは何か**）に答え、**字数は揃えない**。

`claims` は前回を潰した `basis` の覚え書きとは別物で、**配布物には入らない**
（`add_profile.py` が転記するのは4つのフィールドだけ）。原文を開かずに書いた文章は
字数も年も全部のゲートを通ってしまうので、**唯一の歯止め**になる。

### 2段目 — Web差分

**全員にかける。** 中堅の漢の元帝で4件、原文3行の拓跋余で3件出た。有名人だけに絞らない。
Web は**差分検出器であって根拠ではない**（`R-PRIMARY-SOURCE` は紹介文には掛からない）。

食い違いが出たら:

- **数値・年号・序数が割れたらデータ（＝原典）を採る。** Wikipedia にも誤りが多い
- **通説にしかない逸話は、そのときだけ列伝を1箇所読む。** 裏が取れれば書く、取れなければ書かない
  ```bash
  python3 scripts/find_biography.py <皇帝id> <人名>    # 降り先の違いを吸収する
  ```
  **書ごとに降り先が違う**（隋書は `china-history/` に列伝が無く daizhigev20 側にある）ので、
  自分で探さない。**コーパスに素の grep を掛けない**（`R-CORPUS-GREP`・WSL ごと落ちる）
- **割れていることを本文に書かない。** 序数のように避けられるものは避ける
- **判断はコミットメッセージに残す**

## 外すと費用が跳ねる4点

1. **原文は1巡。** 前回の4段（執筆→敵対的検証→Web差分→修正）は同じ原文を繰り返し読んでいた
2. **列伝は最初から読みに行かない。** Web差分が指した1箇所だけ降りる
3. **`basis` はポインタ**（ファイル＋行番号＋何があるか）。散文で書かない。
   前回は `basis` の総量が `body` の総量を上回っていた
4. **節見出し（`## `）を立てない。** 立てると本紀の通読要約に引きずられ、読む量が青天井になる

## ルビは難読語だけ

**総ルビはやめた（2026-08-05）。** 日本人が普通に読める漢字には振らない
（元帝・長安・儒学・皇太子には振らない）。実測は1本あたり8〜21語。
`description` には振らない。記法は `｜親文字《ルビ》` で `｜` を省略しない。

## ゲート

断片のうちに（本体へ入れる前に）:

```bash
python3 scripts/check_profile_fragment.py <断片.json> --strict   # claims 必須・引用の実在照合
python3 scripts/check_profile_ngram.py    <断片.json>            # 既存本との12-gram重複
```

**`--strict` を外さない。** 外すと claims が無くても通り、原文を開かずに書いた文章と
区別が付かなくなる（字数・年・ルビは全部通る）。`basis` のポインタも実在照合される。

本体へ入れたあと:

```bash
python3 scripts/add_profile.py <断片.json>   # 断片 → data/emperor-profiles.json（claims は入らない）
python3 scripts/validate_profiles.py
python3 scripts/validate_readings.py
cd site && npm run build
python3 scripts/coverage.py --write     # 本数が増えたら。忘れると CI が落ちる
```

## 素材の誤りは起票する

note と原文の食い違いは紹介文を直して終わりにせず、**`emperors.json` 側の疑いとして
GitHub Issue に起票**する。「食い違い: なし」も明示させること — 無言を「照合した」と読まない。

手順の改善に気づいたら、その場でユーザーへ提案する（`R-PROCESS-FEEDBACK`）。
