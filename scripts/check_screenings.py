#!/usr/bin/env python3
"""絞り込み記録（data/screenings.json）のゲート。

規則 ID は RULES.yml の R-SCREEN-FIRST。**判定はしない。**
見るのは「その絞り込みが今も成り立つか」と「絞り込みがどこまで言えるか」だけ。

  1. 記録の数字を screen スクリプトを実行して突き合わせる
     — データが動けば母集団も動く。記録した数字だけが残ると「絞ったつもり」になる
  2. absent（機械が何も見つけなかった側）には種つき標本の監査を要求する
     — 不在は値ではない。前漢14人が冒頭3行に「讳」を持たないのは廟号が無いからではない
  3. 標本 id はスクリプトに同じ種で引き直させて突き合わせる
     — 人が選んだ標本では誤り率の区間は言えない
  4. 誤り率の区間を必ず出す
     — 「監査した」だけでは何も言っていない。反例0件でも k=5 なら上限60%

    python3 scripts/check_screenings.py             # ゲート
    python3 scripts/check_screenings.py --scope     # 母集団 N → 要読解 M
    python3 scripts/check_screenings.py --for <皇帝id>
    python3 scripts/check_screenings.py --update    # 母集団が減ったとき（件数だけ）
"""
import argparse
import json
import math
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hanzi_norm import norm_for_match  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SCREENINGS = ROOT / "data" / "screenings.json"

KINDS = {"read", "corroborated", "absent"}
REQUIRED = ("id", "unit", "script", "population", "n", "buckets",
            "establishes", "notEstablished", "screenedAt")


def binom_tail(k, n, p, upper):
    """P(X>=k) / P(X<=k)。n が小さいので素直に足す。"""
    rng = range(k, n + 1) if upper else range(0, k + 1)
    return sum(math.comb(n, i) * p ** i * (1 - p) ** (n - i) for i in rng)


def clopper_pearson(x, n):
    """95% 信頼区間（二分探索）。scipy を足さずに済ませる。"""
    lo, hi = 0.0, 0.0
    if x > 0:
        a, b = 0.0, 1.0
        for _ in range(60):
            m = (a + b) / 2
            if binom_tail(x, n, m, True) < 0.025:
                a = m
            else:
                b = m
        lo = a
    if x < n:
        a, b = 0.0, 1.0
        for _ in range(60):
            m = (a + b) / 2
            if binom_tail(x, n, m, False) > 0.025:
                a = m
            else:
                b = m
        hi = a
    else:
        hi = 1.0
    return lo, hi


def bound_line(x, k):
    """監査結果を「何が言えるか」に翻訳する。件数だけでは何も言っていない。"""
    if k == 0:
        return "監査なし → **この絞り込みは何も裏付けられていません**"
    lo, hi = clopper_pearson(x, k)
    if x == 0:
        need = "・".join(f"{int(math.ceil(3 / t))}件で{int(t * 100)}%以下" for t in (0.10, 0.05))
        return (f"監査 {k}件・反例 0件 → 取りこぼし率の95%上限 {hi * 100:.0f}%"
                f"（3/k の目安: {need}）")
    return (f"監査 {k}件・反例 {x}件 → 取りこぼし率 {x / k * 100:.0f}%"
            f"（95%区間 {lo * 100:.0f}〜{hi * 100:.0f}%）")


def run_screen(rec, errors):
    """記録ではなくスクリプトの実行結果を正とする。"""
    path = ROOT / str(rec.get("script", ""))
    if not path.exists():
        errors.append(f"{rec.get('id')}: script がありません: {rec.get('script')}")
        return None
    # 監査そのものが無い場合はバケット側で報告する（ここで seed 不揃いとして出すと原因が読めない）
    seeds = {(b.get("audit") or {}).get("seed") for b in rec.get("buckets") or []
             if b.get("kind") == "absent"} - {None}
    sizes = {(b.get("audit") or {}).get("size") for b in rec.get("buckets") or []
             if b.get("kind") == "absent"} - {None}
    cmd = ["python3", str(path), "--json"]
    if len(seeds) == 1 and len(sizes) == 1:
        cmd += ["--seed", str(seeds.pop()), "--sample", str(sizes.pop())]
    elif len(seeds) > 1 or len(sizes) > 1:
        errors.append(f"{rec.get('id')}: absent バケットで seed/size が揃っていません"
                      f"（同じ実行から引く必要があります）")
        return None
    p = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
    if p.returncode != 0:
        errors.append(f"{rec.get('id')}: script が落ちました: {p.stderr.strip()[:200]}")
        return None
    try:
        return json.loads(p.stdout)
    except json.JSONDecodeError:
        errors.append(f"{rec.get('id')}: script の --json 出力が JSON ではありません")
        return None


def check_quote(f, tag, errors, counters):
    path = ROOT / str(f.get("file", ""))
    if not path.exists():
        counters["quote_skipped"] += 1
        return
    lines = path.read_text(encoding="utf-8").split("\n")
    n = f.get("line")
    if not isinstance(n, int) or not (1 <= n <= len(lines)):
        errors.append(f"{tag}: line が範囲外です（{n}／全{len(lines)}行）: {f.get('file')}")
        return
    counters["quote_checked"] += 1
    if norm_for_match(str(f.get("quote", ""))) not in norm_for_match(lines[n - 1]):
        errors.append(f"{tag}: 引用が {f['file']}:{n} に見つかりません（行ズレか打ち直し）: "
                      f"{str(f.get('quote'))[:24]}…")


def check_record(rec, errors, counters, notes):
    tag = rec.get("id") or "(id なし)"
    for f in REQUIRED:
        if not rec.get(f):
            errors.append(f"{tag}: {f} が空です")
    out = run_screen(rec, errors)
    if out is None:
        return
    if out.get("n") != rec.get("n"):
        errors.append(f"{tag}: 母集団が記録と違います（記録 {rec.get('n')} / 実行 {out.get('n')}）。"
                      f"データが動いたので絞り込みを引き直してください")
    live = out.get("buckets") or {}
    recorded = {b.get("name"): b for b in rec.get("buckets") or []}
    for name in sorted(set(live) | set(recorded)):
        if name not in recorded:
            errors.append(f"{tag}: バケット {name!r} が記録にありません（実行 {live[name]}件）")
        elif name not in live:
            errors.append(f"{tag}: バケット {name!r} が実行結果にありません")
        elif live[name] != recorded[name].get("count"):
            errors.append(f"{tag}: {name} の件数が違います"
                          f"（記録 {recorded[name].get('count')} / 実行 {live[name]}）")

    for b in rec.get("buckets") or []:
        btag = f"{tag}／{b.get('name')}"
        counters["buckets"] += 1
        if b.get("kind") not in KINDS:
            errors.append(f"{btag}: 未知の kind です: {b.get('kind')!r}"
                          f"（{'・'.join(sorted(KINDS))}）")
            continue
        if not b.get("means"):
            errors.append(f"{btag}: means が空です")
        if b["kind"] == "corroborated" and not b.get("establishes"):
            errors.append(f"{btag}: corroborated は「何を積極的に裏付けたか」が要ります"
                          f"（establishes）")
        if b["kind"] != "absent":
            continue

        # ここから下が絞り込みの効く側。誤ると空欄を全件まとめて「正しい」と結論する
        if not b.get("notEstablished"):
            errors.append(f"{btag}: absent は「何を裏付けていないか」が要ります（notEstablished）")
        audit = b.get("audit") or {}
        findings = audit.get("findings") or []
        if not findings:
            errors.append(f"{btag}: absent には種つき標本の監査が要ります（audit.findings）。"
                          f"機械が何も見つけなかったことは値が無いことの証拠になりません")
            continue
        # outOfSample＝標本の外で見つけた反例。率には入れないが、原文の裏は同じように要る
        in_sample = [f for f in findings if not f.get("outOfSample")]
        drawn = (out.get("samples") or {}).get(b["name"])
        if drawn is None:
            errors.append(f"{btag}: script が seed={audit.get('seed')} の標本を返しませんでした")
        else:
            got = [f.get("id") for f in in_sample]
            missing = sorted(set(drawn) - set(got))
            extra = sorted(set(got) - set(drawn))
            if missing:
                errors.append(f"{btag}: 種から引いた標本のうち {'・'.join(missing)} が未監査です"
                              f"（母集団が動くと標本に入ってくることがあります）")
            if extra:
                errors.append(f"{btag}: 標本に無い {'・'.join(extra)} を監査しています。"
                              f"選んだ標本では取りこぼし率を言えません"
                              f"（標本の外で見つけたものは outOfSample: true を付ける）")
        bad = 0
        for f in findings:
            if not f.get("outOfSample"):
                counters["audited"] += 1
            v = f.get("verdict")
            if v == "反例":
                bad += 0 if f.get("outOfSample") else 1
                counters["counterexamples"] += 1
                counters["outOfSample"] += 1 if f.get("outOfSample") else 0
                if not f.get("file") or not f.get("quote"):
                    errors.append(f"{btag}: 反例 {f.get('id')} に原文（file・line・quote）が要ります")
                else:
                    check_quote(f, btag, errors, counters)
            elif v == "一致":
                if not f.get("checked"):
                    errors.append(f"{btag}: 一致 {f.get('id')} に checked"
                                  f"（何を見て無いと言ったか）が要ります")
            else:
                errors.append(f"{btag}: 未知の verdict です: {v!r}（一致／反例）")
        extra_found = [f["id"] for f in findings
                       if f.get("outOfSample") and f.get("verdict") == "反例"]
        notes.append(f"  {b['name']}（{b.get('count')}件）: {bound_line(bad, len(in_sample))}"
                     + (f" ＋標本外の反例 {'・'.join(extra_found)}" if extra_found else ""))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scope", action="store_true", help="母集団 N → 要読解 M を出す")
    ap.add_argument("--for", dest="for_id", metavar="皇帝id",
                    help="その人物がどのバケットに入っているか。覆う記録が無ければ 1 で終了する")
    ap.add_argument("--update", action="store_true",
                    help="件数だけを実行結果に合わせて書き直す（調査が進んで母集団が減ったとき）")
    args = ap.parse_args()

    data = json.loads(SCREENINGS.read_text(encoding="utf-8"))
    records = data.get("screenings") or []

    if args.for_id:
        return brief_for(args.for_id, records)
    if args.update:
        return update(data, records)

    errors, notes = [], []
    counters = defaultdict(int)
    for rec in records:
        counters["records"] += 1
        check_record(rec, errors, counters, notes)

    for e in errors:
        print(f"ERROR  {e}")
    print(f"\n{len(errors)} errors / 記録 {counters['records']}件・"
          f"バケット {counters['buckets']}件・標本監査 {counters['audited']}件"
          f"（反例 {counters['counterexamples']}件・うち標本外 {counters['outOfSample']}件）・"
          f"引用 {counters['quote_checked']}件を原文と照合"
          + (f"（コーパスが無く {counters['quote_skipped']}件は未照合）"
             if counters["quote_skipped"] else ""))
    if notes:
        print("\n--- 絞り込みがどこまで言えるか ---")
        for n in notes:
            print(n)

    if args.scope:
        print("\n--- 母集団 → 要読解 ---")
        for rec in records:
            read = sum(b.get("count") or 0 for b in rec.get("buckets") or []
                       if b.get("kind") == "read")
            absent = sum(b.get("count") or 0 for b in rec.get("buckets") or []
                         if b.get("kind") == "absent")
            print(f"{rec.get('id')}（Issue #{rec.get('issue')}・単位 {rec.get('unit')}）: "
                  f"母集団 {rec.get('n')} → 要読解 {read}")
            # 要読解の数だけ出すと作業量の総量に見える。absent は「読まなくてよい」ではない
            print(f"  絞り込めていない（absent）: {absent} — {rec.get('notEstablished')}")
    return 1 if errors else 0


def update(data, records):
    """件数だけを実行結果へ合わせる。**書き直すのは n と count だけ。**

    調査が進めば空セルは減る。そのたび記録が落ちて手が止まるのは邪魔だが、
    数字が古いまま緑になるのはもっと悪い。だから件数の更新だけを機械にやらせ、
    kind・means・監査には触らせない（バケットの増減は絞り込み方の変更なので人が書く）。
    """
    errors = []
    changed = []
    for rec in records:
        out = run_screen(rec, errors)
        if out is None:
            continue
        live = out.get("buckets") or {}
        recorded = {b.get("name"): b for b in rec.get("buckets") or []}
        if set(live) != set(recorded):
            errors.append(f"{rec.get('id')}: バケットの顔ぶれが変わっています"
                          f"（{'・'.join(sorted(set(live) ^ set(recorded)))}）。"
                          f"kind と means が要るので手で書いてください")
            continue
        if out.get("n") != rec.get("n"):
            changed.append(f"{rec['id']}: 母集団 {rec.get('n')} → {out.get('n')}")
            rec["n"] = out["n"]
        for name, b in recorded.items():
            if b.get("count") != live[name]:
                changed.append(f"{rec['id']}／{name}: {b.get('count')} → {live[name]}")
                b["count"] = live[name]
    for e in errors:
        print(f"ERROR  {e}")
    if errors:
        return 1
    if changed:
        SCREENINGS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                              encoding="utf-8")
    print("\n".join(changed) or "変更なし")
    print("\n件数だけを更新しました。**標本に新しく入った id があれば監査が要ります**"
          "（そのまま `python3 scripts/check_screenings.py` を走らせてください）")
    return 0


def brief_for(eid, records):
    """人物単位の調査に入る直前に呼ぶ。絞り込みの結果をその人物の言葉で返す。"""
    hits = []
    for rec in records:
        if rec.get("unit") != "person-field":
            continue
        errs = []
        out = run_screen(rec, errs)
        if out is None:
            continue
        for bucket in (out.get("coverage") or {}).get(eid) or []:
            hits.append((rec, bucket))
    if not hits:
        print(f"{eid} を覆うセルが絞り込みの記録に1つもありません。"
              f"（対象フィールドがすでに埋まっているか、この作業の絞り込みが未実施です）"
              f"原典を読む前に機械で母集団を絞り、data/screenings.json に残してください"
              f"（規則 R-SCREEN-FIRST・docs/process/RULES.yml）", file=sys.stderr)
        return 1
    print(f"# {eid} に効く絞り込み")
    for rec, bucket in hits:
        b = next((x for x in rec.get("buckets") or [] if x.get("name") == bucket), {})
        print(f"\n- 記録: {rec['id']}（Issue #{rec.get('issue')}）")
        print(f"- バケット: {bucket}（kind={b.get('kind')}）")
        print(f"- 意味: {b.get('means')}")
        if b.get("kind") == "absent":
            print(f"- **裏付けていないこと: {b.get('notEstablished')}**")
            audit = b.get("audit") or {}
            bad = sum(1 for f in audit.get("findings") or [] if f.get("verdict") == "反例")
            print(f"- {bound_line(bad, len(audit.get('findings') or []))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
