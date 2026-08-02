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

**転記ツールを通す**（その場の `python3 -c` を書かない）:

```bash
python3 scripts/patch_emperor.py <皇帝id> --set 'deathCause.category="poisoning"' --dry-run
python3 scripts/patch_emperor.py <皇帝id> --set-str 'ages.note=…'        # 引用の多い長文
python3 scripts/patch_emperor.py <皇帝id> --from-json patch.json          # 複数フィールド
```

読み込み時点の sha256 を書き込み直前に照合するので、**別セッションが割り込んでいたら
書かずに落ちます**。前後差分と、触ったパスが要求するゲート・結合も出ます。
`--set` の右辺は JSON、まだ無い欄を新設するときだけ `--allow-new-key`
（既定では綴り間違いとして落ちます）。

- **対象 id のフィールドだけ**を更新する。`meta`・他レコードには触らない
  （同じ作業ツリーで別セッションが編集しています）
- **実行直前に最新のファイルを読み込む。** ファイル全体をメモリに読んで丸ごと書き戻さない
- メイン会話で `data/emperors.json` 全体を Read しない（jq / python3 で抽出。フックが止めます）
- **旧値の文字列でレコード全体を grep** し、同じ日付・同じ数値を持つ隣接フィールドと
  note 内の引用が置き去りになっていないか確認する（`reigns[].endDate` ↔ `ages.deathDate` ↔
  `events[].date` の同期漏れが公開サイトまで出た実例がある）。**ISO 日付だけでなく和暦の
  表記も探す** — 「閏5月16日(1360-07-29)」の形で note に残り、`reigns` を直しても4箇所が
  旧値のままだった実例が Issue #42 にある（`validate_emperors.py` の `check_death_event_date`
  は、そのうち**被反乱 event の没日だけ**を機械で見ます）
- 捨てた側の値は note（作業ログ）へ、現在の主張は構造フィールドへ
- **新しく note を書いたら、同じコンテナに `claim` を1〜2文添える**（任意・遡及なし）。
  note は「現行 X → Y に訂正」と**捨てた側**を書くので突合の向きが反転する。claim は
  いま正しいと判断している内容だけを前向きに書く欄で、**引用は書かず**（照合台帳が
  claim を見ない）、**件数は算用数字**で書く（`count` と機械照合される）。
  新設なので `patch_emperor.py` では `--allow-new-key` が要る。詳細は
  `data/schema/EMPERORS_SCHEMA.md` の「note と claim」節

## 4. ゲートと結合

```bash
python3 scripts/validate_emperors.py
python3 scripts/verify_quotes.py --backfill && python3 scripts/verify_quotes.py --check   # 引用・日付を変えたら必須
python3 scripts/verify_quotes.py --check-books   # note に書名を足した・出典を差し替えたら（約4秒）
python3 scripts/verify_calendar.py
python3 scripts/coverage.py --write   # 値を増減させたら進捗表記を引き直す（忘れると CI が落ちる）
```

**`--check-books` はエラーを出しません**（未トリアージの残件があるため）。**出力を読んで、
自分が今回足した行が出ていないか**を見ます。note に書く書名は照合器が実ファイルと突き合わせ
るので、通称ではなくコーパスの書名に寄せる（「明太祖実録」では当たらず「明実録太祖実録」で
当たった実例が Issue #42 にあります）。

`docs/process/COUPLINGS.md` で、触ったものに紐づく**もう片方**を確認します
（`dynastyOrder` なら `dynastyOrderSurveyed`、表示名なら `kana-readings.ts` など）。
`data/kinship.json` を触ったら `validate_kinship.py`。

## 5. 記録と提案

- 訂正したら `data/emperors.json` の `meta` と `docs/PROJECT_STATUS.md` を**同じタイミングで**更新
- 素材 note 自体が誤っていた場合は、直して終わりにせず**同型の誤りが他にもないか**を機械で数える
  （1件の訂正から横展開で105件・1937件が出た前例がある）
- 手順の改善に気づいたら**その場でユーザーへ提案**する（規則 `R-PROCESS-FEEDBACK`）
