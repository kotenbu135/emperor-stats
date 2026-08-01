# 修正エージェント用プロンプト雛形（{{ID}}）

皇帝紹介文（GitHub Issue #16）の断片1本を、**敵対的検証の指摘に従って直す**作業です。新規執筆ではありません。
作業ディレクトリは `/home/sakis/emperor-stats/.claude/worktrees/profiles`。

## 対象

- 断片（**ここを上書きする**）: `{{WORK}}/{{FRAG}}/{{ID}}.json`
- 検証結果: `{{WORK}}/{{VERIFY}}/{{ID}}.json`
- Web 差分（あれば）: `{{WORK}}/{{WEBDIFF}}/{{ID}}.json`
- 原文: `_corpus_cache/{{ID}}.txt`（**簡体字**。大きい場合は全文を読まず `/usr/bin/grep -n` → `Read` の offset/limit）

## やること

1. 各ファイルを Read する
2. `findings` を**severity によらず全部**反映する。**`low` も事実に触れるものは直す**（high/medium だけ直して事実に触れる low を残した失敗が過去にある）
   - ただし**指摘が正しいか原文で確かめてから直す**。検証側が誤っていることもある。直さないと判断した場合は理由を最終メッセージに1行で書く
   - **本文が検証時から更新されている場合がある**。指摘の `quote` が本文に見つからなければ反映済みとみなしてよいが、**同趣旨の誤りが別の表現で残っていないか**は確かめる
3. `dataDoubts`（`emperors.json` 側の疑い）は**紹介文の修正対象ではない**。本文がその疑わしい note に引きずられていないかだけ確認する。**`data/emperors.json` は絶対に触らない**
4. Web 差分 `diffs` を `verdict` ごとに扱う
   - `紹介文の誤り` → 直す（ただし**原文で確かめてから**。Web の記述を根拠にしない）
   - `原文に根拠なし` → **その記述を本文から落とす**。Web と原文の両方に無い事実が残っている状態が一番まずい
   - `原典どおり` → **直さない**。`action` の1句を `basis` に足して、次回同じ差分が挙がらないようにする
   - `未決` → 直さず、最終メッセージに1行で残す
   - **Web の文章・言い回しを本文に取り込まない**（CC BY-SA 混入の risk）
5. `basis`・`claims` を直した箇所に合わせて更新する。**本文に足した事実は必ず `claims` にも足す**

## 規約（変えてはいけない前提）

- 字数（**ルビを剥がした長さ**）: `lead` 70〜110字・`body` 100〜700字・`description` 100〜140字（先頭70字に名前・政権・在位年）
- **総ルビ**（`lead`・`body` は漢字すべてに `｜親文字《ルビ》`。`description` は平文・ルビ禁止）
- **かなの前に裸の `｜` を書かない**
- **固有名詞は `data/name-readings.json` の切り方に合わせる**（`python3 -c "import json;print(json.load(open('data/name-readings.json'))['names'].get('<語>'))"`）
- **原文の和訳を `「」` で括って引かない**。敬称・賛辞・主観評価を書かない。回数の集計値は書かない
- **`body` は上限に張り付いている**。字を足したら同じ段落から削る。削る先は固有名詞の列挙・本筋に効かない年月日
- **`data/emperor-profiles.json` は絶対に触らない**（本体への投入は親セッションがやる）

## 完了条件

断片を上書き Write したうえで、次の2本がどちらも通ること:

```bash
python3 scripts/check_profile_fragment.py <断片> --basis-corpus
python3 scripts/check_profile_ngram.py <断片> --frag-dir {{WORK}}/{{FRAG}}
```

最終メッセージは**1〜3行**（反映した件数・直さなかった指摘があればその理由・字数）。本文は会話へ貼らないこと。
