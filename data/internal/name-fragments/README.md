# 名前欄の調査断片と引用台帳（GitHub Issue #37 単位1）

調査エージェントが返した claims-first 断片 `<皇帝id>.json`（`claims`・`findings`・
`conflicts`・`noteLog`・`discrepancies`）をそのまま置く。契約は
[CLAIMS_CONTRACT.md](../../../docs/process/CLAIMS_CONTRACT.md)。

**なぜここに置くか。** `emperors.json` の `name` 容器は値だけを持ち、note も
`quotes[]` も無い。断片はセッションのスクラッチパッド（`/tmp`）に置く運用だったので、
セッションが終わると**転記した値がどの原文句に拠るのかを引く手立てが消えていた**。
`R-CLAIMS-FIRST` は L1 の規則なのに、その唯一の証人が消える形になっていた
（`profile-fragments/` と同じ理由・同じ日に採用した）。

とくに**諡号は台帳にしか残らない情報を持つ**。明史は諡を三段で書き
（崩御条の初諡・加諡・増諡）、`posthumousName` へ採るのはその一部だけなので、
全長諡と加諡の経緯は断片の `claims` にしか無い。たとえば `ming-taizu.json` の `c3` は
初諡「高皇帝」・永楽元年の加諡・嘉靖十七年の増諡（全23字）を1本の引用で持っている。
**この形が残っている限り、全長諡を後から収録するとき明の16人は再読が要らない。**

**内部側（`data/internal/`）に置く理由**は `R-CLAIM-GATED`。台帳は配布物の主張では
なく作業の記録で、`quote` の実在はゲートが断片のうちに見ている。配布物へ持ち込むと、
そこに新しい主張の欄を作ることになる。

**2026-08-06 の明ブロック（16人）から先だけがここに揃う。** それ以前に埋めた名前欄
（単位2〜6・既存の廟号72件／諡号100件）の断片は残っていない。断片が無いことは
根拠の不在を意味しない。

## 使うとき

```bash
# ブロックの最後に保存する（workDir は .claude/workflows/name-block.js に渡した値）
cp <workDir>/claims/*.json data/internal/name-fragments/

# 後から出所を引く・保存済みの断片をまとめて照合し直す
python3 scripts/check_claims.py data/internal/name-fragments/
```

`check_claims.py` は `quote` が `file` の指す底本に実在するか・`line` がずれていないか・
`findings` が台帳の `cid` を指しているかを見るので、**保存された断片はいつでも
引き直せる**（コーパスが同じ版である限り）。明16人は 2026-08-06 に
`0 errors／引用93件・主張76件` で通っている。
