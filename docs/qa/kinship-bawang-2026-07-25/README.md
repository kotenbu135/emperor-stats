# 西晋八王の追加収録（2026-07-25）— マージ手順の記録

`merge_bawang.py` は本ブランチ（`worktree-kinship-bawang`）で `data/kinship.json` に
西晋八王7人＋接続ブリッジ6人（persons 13・エッジ14）を投入したスクリプトそのもの。
調査結果（原典引用・生没年・childOrder）はスクリプト内に確定値として書き下ろしてあり、
実行部は **id キーの read-modify-write** に徹している（既存 id は置換、重複エッジはスキップ）。

## 他ブランチへ持っていくとき

`data/kinship.json` は約2.4万行の単一 JSON で、**テキストとしての `git merge` はしない**
（同一リポジトリで並行セッションが編集する運用のため。CONSTRAINTS.md 参照）。
対象ブランチの `kinship.json` に対してスクリプトを再実行する：

```bash
python3 docs/qa/kinship-bawang-2026-07-25/merge_bawang.py <対象worktree>/data/kinship.json
python3 scripts/validate_kinship.py            # 0 エラーを確認
```

同時に必要な非データ変更（本ブランチのコミットに含まれる）:

- `scripts/validate_kinship.py` の `INCLUSION_ENUM` に `政変当事者` を追加
- `data/schema/KINSHIP_SCHEMA.md` のスコープルール5・`inclusionReason` の記述
- `docs/PROJECT_STATUS.md`・`task.md` の該当節

## `worktree-kinship-v2` 側で追加で必要な更新（本ブランチには当該ファイルが無い）

`docs/site-design/KINSHIP.md` の「追加調査タスク（データ側・未着手）」節（八王の項）を
完了扱いに書き換え、経緯へ 2026-07-25 の行を足す。あわせて第2章（三国・西晋）の
西晋バンドは**レイアウト再調整が必要**（ノードが13増えるため品質ゲートが落ちる想定。
`chapters.ts` のキュレーション表で解消する）。
