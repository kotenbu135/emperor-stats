# 調査エージェントの出力契約（claims-first・2026-08-02）

調査エージェントは**自由文で報告しない**。原文から作った引用台帳 `claims` と、
その台帳を参照する `findings` を返す。**台帳に無い事実は findings に書けない。**

紹介文（Issue #16）で効いた順序をデータ調査へ広げたもので、規則 ID は
[RULES.yml](RULES.yml) の `R-CLAIMS-FIRST`。ゲートは `python3 scripts/check_claims.py <断片.json>`。

## なぜこの形なのか

- **素材（既存 note）を読むと、note の筋書きに合う原文句を探すことになる。**
  紹介文で見つかった誤りの多くが note 由来だった（Issue #32・#33・#36）。
  当初は順序で防いでいたが、**順序を守っても同じ文脈に note が入れば筋書きは効く**ため、
  2026-08-02 から**1段目には note を渡さない**（突き合わせは検証段）。
  台帳を必須にすることで、その順序を**出力の形で強制する**
- **散文は witness にならない。** 既存の `note` は「現行 X → Y に訂正した」という
  捨てた側の記録（作業ログ）と、欄の値の主張を1つの欄で兼ねているため、
  フィールドと突き合わせると訂正前の値を現在の主張として読む（G2・G3 が測定で否定された理由）。
  この契約は**主張（`findings`）と作業ログ（`noteLog`）を最初から別の欄に分ける**
- **史料対立に置き場がないと、書かなかったのか対立が無いのかを区別できない。**
  `conflicts` を欄として持つことで、**空欄が検出可能になる**
- **出典ラベルの取り違えは、引用を構造で受け取れば発生しない。**
  `file` と `line` を機械が検証するので、桓温伝を読みながら「李勢載記」と書けない

## 形

```json
{
  "id": "tang-taizong",
  "claims": [
    {
      "cid": "c1",
      "book": "旧唐書",
      "file": "daizhigev20/史藏/正史/旧唐书.txt",
      "line": 12345,
      "quote": "太宗文武大聖大廣孝皇帝諱世民，高祖第二子也"
    }
  ],
  "findings": [
    { "field": "name.templeName", "value": "太宗", "basis": ["c1"], "confidence": "high" },
    { "field": "name.posthumousName", "value": null, "verdict": "read-absent",
      "basis": ["c1"], "confidence": "high",
      "note": "本紀は末字＋皇帝型の短縮呼称を使わない。冒頭も崩御条も全長形だけ" }
  ],
  "conflicts": [
    { "field": "ages.deathAge",
      "adopted": { "value": 47, "source": {"page": "晋書 載記第二十一"},
                   "quote": "时年四十七，在位一年" },
      "alternatives": [
        { "value": 38, "source": {"page": "華陽国志 巻九"}, "quote": "年二十六，立为太子",
          "note": "永昌元年（322年）の太子冊立を年二十六とするため崩御時は数え38歳（逆算値）" } ],
      "reason": "晋書載記と十六国春秋がともに「时年四十七」と直接記す。38は逆算で直接記載ではない" }
  ],
  "noteLog": "既存 note は『養子として即位』としていたが載記は『兄李蕩の子』。捨てた側の値を記録する。",
  "discrepancies": "なし",
  "processSuggestion": "載記系の政権は本紀が無いので、先に該当巻の見出しを列挙してから配ると速い"
}
```

| 欄 | 必須 | 中身 |
|---|---|---|
| `id` | ○ | **指定された id を一字一句そのまま。**独自生成は禁止（別ブロックで35名中20件超が不一致になった） |
| `claims[]` | ○ | 原文の引用。`quote` は grep / Read / `quote_helper.py` の**出力からコピー**し、字体変換・要約・語順変更をしない。`file` はリポジトリからの相対パス、`line` はその行番号 |
| `findings[]` | ○ | 欄の**主張**。`basis` は `claims[].cid` の配列で、**空は許さない**。原文が言っていないことは書けない |
| `findings[].verdict` | ○（`value: null` のときだけ） | **空の主張がどちら向きか。** `"read-absent"` = 原文を読んで「この人にこの名乗りは無い」と決めた／`"pending"` = 原文は読み終わったが値の扱いが判断待ち／`"out-of-scope"` = **調査そのものを打ち切った**（2026-08-16 追加・読む原文がコーパスに無いケース。**この1つだけは `claims`／`basis` を持たず、代わりに `reason` が必須** — 読んでいないものに witness を求めない。`coverage.py` はこのセルを**確定率の分母から外す**ので、調査エージェントが自分で付けてよい旗ではなく**ユーザーの決定を写す場所**）。`coverage.py` は最初の1つだけを**不在確定**に数える（2026-08-11・オプトインなので付け忘れは過小報告に落ちる）。値のある主張には要らない。旧 `pending: true` の旗は廃止（`check_claims.py` が落とす）。**`regime-conventions.json` の `verdict`（`form-found`／`absent-by-book`／`no-form` …）とは別の欄で、値も共通ではない** — あちらは政権の書式・所在、こちらは1人ぶんの読解結果 |
| `conflicts[]` | ○（空配列可） | 史料同士の対立。採用値・対立値・**採否理由**を持つ。**`emperors.json` の `conflicts` と同じ形**（2026-08-03・Issue #51 P3）なので、そのままコンテナへ入る。`adopted` は `{value, source, quote}` のオブジェクト——採用側にも出典が要る（片側だけだと「採用した」と「書き忘れた」が区別できない）。`quote` には引用規約の全項が掛かる |
| `noteLog` | — | 作業ログ。捨てた側の値・経緯・換算メモ。**主張はここに書かない** |
| `discrepancies` | ○ | 既存の**構造フィールド**（数値・日付・enum）と原文の食い違い。**無ければ「なし」と明記する** — 無言を「照合した」と読まないため。**note との突き合わせは検証段の担当**（1段目には note を渡さない・2026-08-02〜） |
| `processSuggestion` | — | **手順そのものの改善案**。調査中に気づいたことを書く（規則 `R-PROCESS-FEEDBACK`）。親セッションがユーザーへ上げ、採否を `PROCESS_IMPROVEMENTS.md` に残す |

## 続柄は呼称でなく「誰の子の子か」で返す（Issue #51 P1・2026-08-03）

`findings[]` で続柄を返すとき、**「従叔父」「従兄弟」のような呼称を選んで書かない**。
返すのは原文が言っている親子関係だけ——「A は B の子、B は C の子」——で、
呼称はそこから機械で導ける。

```json
{ "field": "accessionRoute.axes.relationToPredecessor",
  "value": {"path": ["張祚 は 張駿 の子", "張重華 は 張駿 の子", "張耀霊 は 張重華 の子"]},
  "basis": ["c3", "c4"] }
```

Issue #36 の A類型6件は、いずれも**同一レコードの別フィールドが正しいパスを持っていながら**、
散文へ落とす段で呼称を取り違えたものだった（`deathCause.note` は張耀霊を「従兄弟」と書くが、
同じレコードの軸は `uncle-elder`）。呼称を選ぶ工程そのものが誤りの発生源なので、消す。

呼称が要るとき（note を書く・紹介文へ渡す）は、エッジを `kinship.json` へ入れたうえで

```bash
python3 scripts/relation_path.py --for <皇帝id>      # 先代から見た当人
python3 scripts/relation_path.py --between A B        # 任意の2人
```

の出力をそのまま使う。**このスクリプトの出力を根拠にデータを書き換えてはいけない** —
出るのはエッジの読み替えなので、記録値と食い違ったときに誤っているのはエッジの側かもしれない。
食い違いは原典で決める（`--for` は食い違いをその場で言う）。

## ゲートが見るもの

```bash
python3 scripts/check_claims.py <断片.json>          # 1件
python3 scripts/check_claims.py <ディレクトリ>/*.json  # まとめて
```

- **エラー**: `quote` が `file` に存在しない／`basis` が空・未定義の `cid` を指す／
  `discrepancies` が無い／`id` の形が不正／`conflicts` の要素に `reason` が無い
- **報告**（エラーではないが読む）: 記録された `line` と実際に見つかった行のズレ／
  新字体表を当てないと当たらない `quote`（＝そこをコピーせず打ち直した印）／
  `quote` が底本の**連続した1か所**に無く複数箇所の合成になっているもの（Issue #38 の主たる型）

**エラー0は「綺麗」と「空回り」を区別しない**ので、`check_claims.py` は毎回
「何件の claim を照合したか・照合できなかったのは何件か」を出す。

## エージェント側

`.claude/agents/corpus-researcher.md` がこの契約を system prompt に持っている。
Workflow から使うときは `agent(prompt, {agentType: 'corpus-researcher', schema: CLAIMS_SCHEMA})`
と書けば、契約が親のプロンプトを経由しないので**写し漏れが起きない**。
