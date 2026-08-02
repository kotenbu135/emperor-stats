---
name: correct-record
description: データ誤り1〜数件を訂正するときの入口（GitHub Issue 起点の訂正・#36 のような note と原典の食い違い）。原典の読み直し・書き込み・ゲート・結合の確認を1本の手順にする
---

# レコードの訂正

**1〜2人分の訂正に Workflow は要りません**（トークンが高い）。単発の
`corpus-researcher` か手作業のほうが速く安全です。

## 1. 何を直すのかを型で分ける

訂正の要求は5つの型に割れ、**原典の読み直しが要るのは1つだけ**です。
先に型を決めると、無駄な原典調査をしません。

| 型 | 直す場所 |
|---|---|
| 同一レコード内の食い違い（続柄・主語・数値） | **原典ではなく出力**。他のフィールドが正しい値を持っている |
| 事実そのものの誤り | **原典の再読が要る**（ここだけ） |
| 出典ラベルの取り違え | `data/quote-refs.json` の `corpusFile` に正解がある |
| note の陳腐化（別フィールドを直して note が置き去り） | 書き込み時の問題 |
| 史料対立が記録されていない | スキーマの穴（`conflicts` に置く） |

## 2. 原典を読む（型2のときだけ）

```bash
python3 scripts/brief_block.py <書名> --id <皇帝id>     # 罠とキャッシュの有無
python3 scripts/quote_helper.py <皇帝id> <検索語>        # 引用はこの出力からコピーする
python3 scripts/quote_diff.py <皇帝id>                  # 当たらない引用は先にこれで底本との差分を見る
```

**互いに依存しない呼び出しは1メッセージにまとめる**（対象レコードの `jq` 抽出・罠・
キャッシュの有無は同時に出せます。実測の並列化率は 0.2% でした）。
**advisor は着手直後と完了直前の2点だけ** — 会話全文を非キャッシュで再送するので、
会話が長くなってから呼ぶほど高くつきます。

**引用を手で打たない。**（打ち直すと約0.4%の率で誤字が混入することが全件検証で実証済み）
**コーパスに `.{0,N}` 型の抽出 grep を掛けない**（フックが止めます）。

## 3. 書く

- **対象 id のフィールドだけ**を更新する。`meta`・他レコードには触らない
  （同じ作業ツリーで別セッションが編集しています）
- **実行直前に最新のファイルを読み込む。** ファイル全体をメモリに読んで丸ごと書き戻さない
- メイン会話で `data/emperors.json` 全体を Read しない（jq / python3 で抽出。フックが止めます）
- **旧値の文字列でレコード全体を grep** し、同じ日付・同じ数値を持つ隣接フィールドと
  note 内の引用が置き去りになっていないか確認する（`reigns[].endDate` ↔ `ages.deathDate` ↔
  `events[].date` の同期漏れが公開サイトまで出た実例がある）
- 捨てた側の値は note（作業ログ）へ、現在の主張は構造フィールドへ

## 4. ゲートと結合

```bash
python3 scripts/validate_emperors.py
python3 scripts/verify_quotes.py --backfill && python3 scripts/verify_quotes.py --check   # 引用・日付を変えたら必須
python3 scripts/verify_calendar.py
```

`docs/process/COUPLINGS.md` で、触ったものに紐づく**もう片方**を確認します
（`dynastyOrder` なら `dynastyOrderSurveyed`、表示名なら `kana-readings.ts` など）。
`data/kinship.json` を触ったら `validate_kinship.py`。

## 5. 記録と提案

- 訂正したら `data/emperors.json` の `meta` と `docs/PROJECT_STATUS.md` を**同じタイミングで**更新
- 素材 note 自体が誤っていた場合は、直して終わりにせず**同型の誤りが他にもないか**を機械で数える
  （1件の訂正から横展開で105件・1937件が出た前例がある）
- 手順の改善に気づいたら**その場でユーザーへ提案**する（規則 `R-PROCESS-FEEDBACK`）
