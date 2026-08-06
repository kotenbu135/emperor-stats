# 紹介文の断片と引用台帳（GitHub Issue #16）

執筆エージェントが書いた断片 `<皇帝id>.json` と、その引用台帳
`<皇帝id>.claims.jsonl`（1行1件・`{"text","quote","src"}`）を置く。

**なぜここに置くか。** 配布物（`data/emperor-profiles.json`）へ入るのは
`lead`・`body`・`description`・`basis` の4つだけで、**claims は入らない**。
断片はセッションのスクラッチパッドに置く運用だったので、セッションが終わると
「この文はどの原文句に拠るのか」を後から引く手立てが無くなっていた。
`R-CLAIMS-FIRST` は L1 の規則なのに、その唯一の証人が消える形になっていた
（2026-08-06 に採用。提案は `PROCESS_IMPROVEMENTS.md` の `auto:a757fcfb4862`）。

**内部側（`data/internal/`）に置く理由**は `R-CLAIM-GATED`。台帳は配布物の主張では
なく作業の記録で、`quote` の実在はゲート（`check_profile_fragment.py --strict`）が
断片のうちに見ている。配布物へ持ち込むと、そこに新しい主張の欄を作ることになる。

**2026-08-06 より前の本（1〜47本目）の断片は残っていない。** この日から先の
バッチだけがここに揃う。断片が無いことは根拠の不在を意味しない
（`check_profile_fragment.py --strict` は当時も通っている）。

## 使うとき

```bash
# 書き上げた断片を保存する（バッチの最後に）
cp <workDir>/<id>.json <workDir>/<id>.claims.jsonl data/internal/profile-fragments/

# 後から出所を引く
python3 scripts/check_profile_fragment.py data/internal/profile-fragments/<id>.json --strict
```

`--strict` は台帳の `quote` が `src` の指すファイルに実在するかを照合するので、
**保存された断片はいつでも引き直せる**（コーパスが同じ版である限り）。
