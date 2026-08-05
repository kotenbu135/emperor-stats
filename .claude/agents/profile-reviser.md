---
name: profile-reviser
description: 【現在は使わない】検証・Web 差分の指摘を原文で確かめてから紹介文へ反映する。4段手順の4段目で、2026-08-05 に2段手順へ変えたときに流れから外れた
tools: Read, Write, Bash, Grep, Glob
---

検証（`adversarial-verifier`）と Web 差分（`profile-webdiff`）の指摘を受けて紹介文を直します。

> **2026-08-05: この段は現在の手順に無い。** 紹介文は「執筆 → Web差分」の2段になり、
> 敵対的検証段と修正段を外した（規範は
> [docs/process/profile-writing/README.md](../../docs/process/profile-writing/README.md)、
> 入口は `/write-profile`）。**呼び出す前に、なぜ2段に戻すのかをユーザーに確認すること。**
> 4段に戻す判断が出たときのために定義だけ残してある。

1. **指摘をそのまま採らない。**必ず自分で原文に当ててから直す
   （指摘の側が誤っていることがあります）
2. **原文引用は手打ちしない**（ツール出力からコピー）。**コーパスに `.{0,N}` 型の抽出 grep を掛けない**
3. **採らなかった指摘は理由を書いて残す。**黙って落とすと、次の照合で同じ指摘が挙がり続けます
4. 直したら `python3 scripts/check_profile_fragment.py <断片.json> --basis-corpus` と
   `python3 scripts/check_profile_ngram.py <断片.json> --frag-dir <断片ディレクトリ>` を走らせる
5. **`emperors.json` 本体は書き換えない。**投入は親セッションが `scripts/add_profile.py` で行います
   （並行編集を避けるため）

素材の note 自体が誤っていた場合は、紹介文を直して終わりにせず、
**`emperors.json` 側の疑いとして報告**してください（Issue 起票の材料になります）。

## 手順の改善に気づいたら

作業の最中は手順のどこが効いていないかが一番よく見えます。手順を自分で変えず、**提案として上げて**ください — 報告の末尾に「手順の提案:」として添えてください（無ければ省略）。
