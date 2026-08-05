---
name: write-profile
description: 皇帝の紹介文（GitHub Issue #16）を書く入口。原文1巡＋Web差分の2段・ルビは難読語だけ・basis はポインタ。規範は docs/process/profile-writing/README.md
---

# 紹介文を書く

**規範の全文は [docs/process/profile-writing/README.md](../../../docs/process/profile-writing/README.md)。
着手前に読むこと。** ここに置くのは実行の順序と、外すと費用が跳ねる点だけ。

> **エージェントには README も SKILL.md も読ませない**（2026-08-05）。執筆に要る規則は
> `.claude/agents/profile-*.md` が持っていて、そちらはシステムプロンプト側で1回だけ
> キャッシュされる。実測では9体すべてがこの2枚（23.5KB）を全文 Read して以降20ターンぶん
> 運んでおり、キャッシュ読みの17%がそれだった。**この2枚は人向け。**

見本は `data/emperor-profiles.json` の8本。**原文が300倍違っても本文は7倍しか違わない。**
執筆エージェントには `extract_profile_material.py` の末尾に**1本だけ**出る
（3本引き直させない）。

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
python3 scripts/new_profile_fragment.py     <皇帝id> --out <workDir>
```

素材の末尾に**読み地図**（本紀のどこが詔・冊文でどこが叙事か）・**列伝の在り処**・
**見本1本の全文**・**ゲートの走らせ方**が出る。1巡の時間配分は読み地図から決める —
大物ほど詔・冊文の割合が高く、そこから取れる材料は薄い（隋の文帝は23%が詔・冊文）。
**飛ばすのではなく速度を変える**（詔にも大赦・改元・遷都は載る）。

**本紀の原文キャッシュ `_corpus_cache/<id>.txt` を1巡だけ読んで書く。**
読み直さない。**簡体字**なので検索も簡体字で（`scripts/hanzi_norm.py`）。

`new_profile_fragment.py` が骨格 `<id>.json` と空の引用台帳 `<id>.claims.jsonl` を作る。
書くのは `lead`・`body`・`description`・`basis` の4つと、**台帳へ1行1件**
（`{"text": 書く事実, "quote": 根拠の原文句, "src": "ファイル:行"}`）。
全員に同じ5つの問い（誰の何にあたる人か／どう即位したか／在位中に何が起きたか／
どう終わったか／**記録が伝えないことは何か**）に答え、**字数は揃えない**。

**`build.py` の類を書かせない。** `Write` は骨格を埋める1回だけで、以降の直しは `Edit`。
台帳を断片の中に持たせると、本文を1文直すたびに40〜50件ごと再送されて出力が跳ねる
（実測で出力は重み付き費用の37.5%＝最大項目だった）。

**`body` の目安は800〜1,500字**（ゲートの上限は2,400字のまま・機械は目安を見ない）。
超えてよいが、**上限に合わせて書かない** — Workflow の3本が原文の量と無関係に
2,000字級へ揃った実測がある。書くことが尽きたら止める。

`claims` は前回を潰した `basis` の覚え書きとは別物で、**配布物には入らない**
（`add_profile.py` が転記するのは4つのフィールドだけ）。原文を開かずに書いた文章は
字数も年も全部のゲートを通ってしまうので、**唯一の歯止め**になる。

### 2段目 — Web差分

**全員にかける。** 中堅の漢の元帝で4件、原文3行の拓跋余で3件出た。有名人だけに絞らない。
Web は**差分検出器であって根拠ではない**（`R-PRIMARY-SOURCE` は紹介文には掛からない）。

食い違いが出たら:

- **数値・年号・序数が割れたらデータ（＝原典）を採る。** Wikipedia にも誤りが多い
- **通説にしかない逸話は、そのときだけ本紀の外を1箇所読む**（列伝とは限らない — 唐の敬宗は
  **五行志**だった）。裏が取れれば書く、取れなければ書かない
  ```bash
  python3 scripts/find_biography.py <皇帝id> <人名> --dump    # 当たった巻を丸ごと出す
  ```
  **書ごとに降り先が違う**（隋書は `china-history/` に列伝が無く daizhigev20 側にある）ので、
  自分で探さない。**`--dump` を付ける** — 窓だけ渡すと書き手が結局その巻を自分で切り出しに行く
  （劉鋹の反映段が `scan.py`・`dump.py` を書いて宋史列伝の章番号を総当たりした）。
  **コーパスに素の grep を掛けない**（`R-CORPUS-GREP`・WSL ごと落ちる）
- **割れていることを本文に書かない。** 序数のように避けられるものは避ける
- **判断はコミットメッセージに残す**

## 外すと費用が跳ねる点

1. **原文は1巡。** 前回の4段（執筆→敵対的検証→Web差分→修正）は同じ原文を繰り返し読んでいた
2. **列伝は最初から読みに行かない。** Web差分が指した1箇所だけ降りる
3. **`basis` はポインタ**（ファイル＋行番号＋何があるか）。散文で書かない。
   前回は `basis` の総量が `body` の総量を上回っていた
4. **節見出し（`## `）を立てない。** 立てると本紀の通読要約に引きずられ、読む量が青天井になる

以下は 2026-08-05 の実測（3人9体・重み付き入力等価 4,843,072トークン＝1人161万）で
追加した4点。**エージェント定義に書いてあるので、人が毎回言い直す必要はない。**

5. **エージェントに advisor を呼ばせない。** 9体で16回呼ばれ、**非キャッシュ入力
   1,147,322トークン（重み付き費用の24%）がその16回だけで発生**していた
   （`input_tokens > 1000` の応答がちょうど16件で、他はゼロ）。判定者は `--strict`
6. **`build.py` の類を書かせない。** 台帳は `<id>.claims.jsonl` に分けて追記させる。
   出力は重み付き費用の37.5%＝最大項目で、その多くが builder の書き直しだった
7. **規範の文書（README・SKILL.md 計23.5KB）をエージェントに読ませない。**
   キャッシュ読みの17%
8. **形を探させない。** `emperor-profiles.json` の構造・見本・`name-readings.json` は
   素材コマンドの末尾で配る。ゲートは**エラー行に直し方を書く**（落ちたエージェントが
   `check_profile_fragment.py` を全文 Read していた）

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
台帳は断片の中の `claims` でも、隣の `<断片名>.claims.jsonl`（1行1件）でもよい
（**新しく書くなら jsonl 側**）。

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
