#!/usr/bin/env python3
"""政権単位の慣行記録（data/regime-conventions.json）のゲート。

規則 ID は RULES.yml の R-REGIME-FIRST。**判定はしない。**
「政権単位の主張に原典の裏が付いているか」「その裏が本当にその行にあるか」だけを見る。

この記録の役目は人物単位の調査対象を絞ることなので、**間違った絞り込みが一番高くつく**。
特に打ち切り側（absent-by-institution・absent-by-book・biography-only）は、その政権の空欄を
全件まとめて「正しい」と結論させるため、対象政権それぞれに原典の裏を要求する。

`absent-by-institution`（制度そのものが無い）と `absent-by-book`（制度はあるが**その書が
その形を本文で使わない**）は別物。前者を誤ると史実を消し、後者を誤ると「別の書なら取れる値」を
取りこぼす。どちらも personScope は `skip` で、coverage.py はこの2つだけを「不在確定」に数える。

    python3 scripts/check_regime_conventions.py            # ゲート
    python3 scripts/check_regime_conventions.py --scope    # 母集団 N → 要調査 M の内訳
    python3 scripts/check_regime_conventions.py --for <皇帝id> [--field <フィールド>]

`--field` は「その項目が政権単位の慣行で決まるのか」を先に判定する。R-REGIME-FIRST が
掛かるのは名前系（FIELDS）だけで、日付・回数のような人物単位の事実には掛からない。
これを付けずに `--for` だけを呼ぶと、無関係な作業でも「政権の慣行が未確定」で 1 を返して
足止めになる（2026-08-03・Issue #56 の日付訂正で調査エージェント3体が同じ指摘を出した）。

エラー0は「綺麗」と「空回り」を区別しないので、照合した件数を必ず出す。
コーパス（_corpus_cache/）が無い環境では引用の実在検査だけ飛ばし、飛ばした件数を出す。
"""
import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hanzi_norm import norm_for_match  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CONVENTIONS = ROOT / "data" / "regime-conventions.json"
EMPERORS = ROOT / "data" / "emperors.json"

FIELDS = {"templeName", "posthumousName", "posthumousNameFull", "familyName", "personalName",
          "commonName", "aliases", "eraName", "dynastyOrder"}
# verdict → 人物単位の作業。対応が1対1なので、片方だけ書き換えた記録を落とせる
SCOPE_OF = {
    "form-found": "transcribe",
    "absent-by-institution": "skip",
    "absent-by-book": "skip",
    "biography-only": "other-source",
    "no-form": "per-person",
}
# 打ち切り・別所在へ振る判定。誤ると空欄を全件まとめて「正しい」と結論するので裏を厚く取る
NARROWING = {"absent-by-institution", "absent-by-book", "biography-only"}
# 打ち切りのうち「制度／書式が無い」と言い切る側。1件の引用では言い切らせない
NEEDS_TWO = {"absent-by-institution", "absent-by-book"}
REQUIRED = ("book", "regimeIds", "fields", "locator", "verdict", "personScope",
            "form", "evidence", "surveyedAt")


def load_emperors():
    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    regimes = {r["id"]: r["label"] for r in data["meta"]["catalogs"]["regimes"]}
    persons = {e["id"]: e.get("regimeId") for e in data["emperors"]}
    counts = defaultdict(int)
    for rid in persons.values():
        counts[rid] += 1
    return regimes, persons, counts


def check_quote(ev, tag, errors, counters):
    """引用がその file の その line に本当にあるか。手打ち・行ズレはここで落ちる。"""
    path = ROOT / str(ev.get("file", ""))
    if not path.exists():
        counters["quote_skipped"] += 1
        return
    lines = path.read_text(encoding="utf-8").split("\n")
    n = ev.get("line")
    if not isinstance(n, int) or not (1 <= n <= len(lines)):
        errors.append(f"{tag}: line が範囲外です（{n}／全{len(lines)}行）: {ev.get('file')}")
        return
    counters["quote_checked"] += 1
    if norm_for_match(str(ev.get("quote", ""))) not in norm_for_match(lines[n - 1]):
        errors.append(f"{tag}: 引用が {ev['file']}:{n} に見つかりません（行ズレか打ち直し）: "
                      f"{str(ev.get('quote'))[:24]}…")


def field_matches(declared, query):
    """宣言側のフィールド名と、問い合わせのフィールドパスを突き合わせる。

    宣言は素の名前（"templeName"）、問い合わせはパス（"name.templeName" や
    "personalCampaignCount.events[].endDate"）で来ることがあるので、区切りで割って
    セグメントの一致を見る。片側だけの書き方に縛らないための緩い一致。
    """
    segs = [s for s in query.replace("[]", "").replace("[", ".").replace("]", "")
            .split(".") if s]
    return declared == query or declared in segs


def brief_for(eid, field=None):
    """人物単位の調査に入る直前に呼ぶ。政権の慣行が未確定なら 1 で終わる。

    「先に政権単位で確定する」を文書に書くだけだと守られない。調査プロンプトが
    この出力（書名・locator・書式）を要求する形にしておくと、未確定の政権では
    そもそも人物単位の調査を立てられない。

    ただし**掛かるのは名前系（FIELDS）だけ**なので、`--field` でそれ以外を問われたら
    適用外として 0 で返す（日付・回数は政権の慣行から転記できない人物単位の事実）。
    """
    if field is not None and not any(field_matches(f, field) for f in FIELDS):
        print(f"{field} は政権単位の慣行では決まりません（R-REGIME-FIRST の適用外）。"
              f"この規則が掛かるのは {'・'.join(sorted(FIELDS))} です。"
              f"人物単位の事実（日付・回数・結末）は政権の書式から転記できないので、"
              f"そのまま人物単位の調査に入って構いません")
        return 0
    _, persons, _ = load_emperors()
    if eid not in persons:
        print(f"存在しない皇帝id: {eid}", file=sys.stderr)
        return 1
    rid = persons[eid]
    data = json.loads(CONVENTIONS.read_text(encoding="utf-8"))
    hits = [r for r in data.get("conventions") or [] if rid in (r.get("regimeIds") or [])]
    if field is not None:
        hits = [r for r in hits
                if any(field_matches(f, field) for f in r.get("fields") or [])]
    if not hits:
        of_field = f"の {field} " if field else ""
        print(f"{eid}（政権 {rid}）は政権単位{of_field}の慣行が未確定です。"
              f"人物単位の調査に入る前に、その政権の本紀・列伝の書式を原典で確かめて "
              f"data/regime-conventions.json に足してください"
              f"（規則 R-REGIME-FIRST・docs/process/RULES.yml）", file=sys.stderr)
        return 1
    print(f"# {eid}（政権 {rid}）に効く政権単位の慣行")
    for r in hits:
        ex = next((x for x in r.get("exceptions") or [] if x.get("id") == eid), None)
        print(f"\n- 書: {r['book']}／項目: {'・'.join(r['fields'])}")
        if ex:
            print(f"- 判定: {r['verdict']} だが**この人物は例外**"
                  f" → 人物単位の作業は {ex.get('personScope')}"
                  f"（政権の {r['personScope']} を被せない）")
        else:
            print(f"- 判定: {r['verdict']} → 人物単位の作業は {r['personScope']}")
        print(f"- 所在: {ex['locator'] + '（この人物は例外）' if ex else r['locator']}")
        print(f"- 書式: {r['form']}")
        if r.get("variants"):
            print(f"- 異形: {r['variants']}")
        # 「原文がどう書いてあるか」（form）と「欄へ何を入れるか」（storageForm）は別物で、
        # 同じ書式から2つの欄へ割れる場合がある（諡号の短縮呼称と全長形・2026-08-10）。
        # 出さないと、この出力を唯一の入口にしている調査エージェントには届かない
        if r.get("storageForm"):
            print(f"- 保存形: {r['storageForm']}")
        if ex and ex.get("note"):
            print(f"- 例外の注: {ex['note']}")
        if r.get("note"):
            print(f"- 注: {r['note']}")
        for ev in r.get("evidence") or []:
            print(f"- 例: {ev['file']}:{ev['line']} 「{ev['quote'][:40]}」")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scope", action="store_true", help="母集団 N → 要調査 M の内訳を出す")
    ap.add_argument("--for", dest="for_id", metavar="皇帝id",
                    help="その人物に効く慣行を出す。未確定なら 1 で終了する（人物調査に入らせない）")
    ap.add_argument("--field", metavar="フィールド",
                    help="対象フィールドで絞る。この規則の適用外なら 0 で返す"
                         "（日付・回数のような人物単位の事実で足止めしないため）")
    args = ap.parse_args()

    if args.for_id:
        return brief_for(args.for_id, args.field)
    if args.field:
        ap.error("--field は --for と一緒に使ってください")

    errors = []
    counters = defaultdict(int)
    regimes, persons, person_count = load_emperors()

    try:
        data = json.loads(CONVENTIONS.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"ERROR  {CONVENTIONS.name} を読めません: {e}")
        return 1

    records = data.get("conventions") or []
    seen = {}          # (regimeId, field) → (verdict, tag)
    covered = {}       # (regimeId, field) → verdict
    ex_scope = {}      # (emperorId, field) → personScope（例外は政権の判定を被らない）

    for i, rec in enumerate(records):
        tag = f"{rec.get('book', '?')}／{'・'.join(rec.get('regimeIds') or []) or '?'}"
        counters["records"] += 1

        for f in REQUIRED:
            if not rec.get(f):
                errors.append(f"{tag}: {f} が空です")
        verdict = rec.get("verdict")
        if verdict not in SCOPE_OF:
            errors.append(f"{tag}: 未知の verdict です: {verdict!r}")
            continue
        if rec.get("personScope") != SCOPE_OF[verdict]:
            errors.append(f"{tag}: verdict={verdict} なら personScope は "
                          f"{SCOPE_OF[verdict]!r} のはずです（{rec.get('personScope')!r}）")

        for f in rec.get("fields") or []:
            if f not in FIELDS:
                errors.append(f"{tag}: 未知の項目です: {f!r}")
        for rid in rec.get("regimeIds") or []:
            if rid not in regimes:
                errors.append(f"{tag}: emperors.json に無い政権 id です: {rid!r}")
                continue
            for f in rec.get("fields") or []:
                key = (rid, f)
                if key in seen and seen[key][0] != verdict:
                    errors.append(f"{tag}: ({rid}, {f}) が {seen[key][1]} と食い違っています "
                                  f"（{seen[key][0]} ↔ {verdict}）")
                seen[key] = (verdict, tag)
                covered[key] = verdict

        # 引用の実在
        evidence = rec.get("evidence") or []
        for ev in evidence:
            check_quote(ev, tag, errors, counters)

        # 打ち切り側は対象政権それぞれに裏を要求する
        if verdict in NARROWING:
            if len(evidence) < 2 and verdict in NEEDS_TWO:
                errors.append(f"{tag}: {verdict} は明文と書式の2件以上が要ります"
                              f"（現在 {len(evidence)}件）")
            backed = {persons.get(Path(str(ev.get('file', ''))).stem) for ev in evidence}
            for rid in rec.get("regimeIds") or []:
                if rid not in backed:
                    errors.append(f"{tag}: {rid} を打ち切る根拠がありません。"
                                  f"evidence にその政権の人物の原文を1件以上入れてください")
        else:
            backed = {persons.get(Path(str(ev.get('file', ''))).stem) for ev in evidence}
            stray = backed - set(rec.get("regimeIds") or []) - {None}
            if stray:
                errors.append(f"{tag}: 別政権の人物を根拠にしています: {'・'.join(sorted(stray))}")

        for ex in rec.get("exceptions") or []:
            counters["exceptions"] += 1
            if ex.get("id") not in persons:
                errors.append(f"{tag}: exceptions に emperors.json に無い id があります: {ex.get('id')!r}")
                continue
            if not ex.get("locator"):
                errors.append(f"{tag}: exceptions[{ex['id']}] に locator がありません")
            # 例外は「所在が違う人物」なので、政権の personScope をそのまま被せると
            # 書き写すだけで済むかのように読める。自分の personScope を必ず持たせる
            if ex.get("personScope") not in SCOPE_OF.values():
                errors.append(f"{tag}: exceptions[{ex['id']}] に personScope がありません"
                              f"（所在が違うので政権の {rec.get('personScope')} を被せない）: "
                              f"{'／'.join(sorted(set(SCOPE_OF.values())))}")
            else:
                for f in rec.get("fields") or []:
                    ex_scope[(ex["id"], f)] = ex["personScope"]

    for e in errors:
        print(f"ERROR  {e}")

    surveyed_persons = sum(person_count[rid] for rid in
                           {rid for rid, _ in covered} if rid in person_count)
    total = sum(person_count.values())
    print(f"\n{len(errors)} errors / 記録 {counters['records']}件・"
          f"引用 {counters['quote_checked']}件を原文と照合"
          + (f"（コーパスが無く {counters['quote_skipped']}件は未照合）"
             if counters["quote_skipped"] else "")
          + f"・例外 {counters['exceptions']}人")
    print(f"確定済みの政権: {len({rid for rid, _ in covered})} / {len(person_count)}政権"
          f"（{surveyed_persons} / {total}人）")

    if args.scope:
        untouched = sorted(f for f in FIELDS if not any(k[1] == f for k in covered))
        print("\n--- 項目別の母集団 → 要調査 ---")
        # 記録の無い項目を黙って落とすと、表に出た数項目が対象の全部だと読める
        print(f"未着手（記録が1件も無い項目）: {'・'.join(untouched) or 'なし'}")
        for field in sorted(FIELDS):
            rows = {rid: v for (rid, f), v in covered.items() if f == field}
            if not rows:
                continue
            by = defaultdict(int)
            for eid, rid in persons.items():
                if rid not in rows:
                    continue
                # 例外は所在が違うので、政権の判定ではなく自分の personScope で数える
                by[ex_scope.get((eid, field)) or SCOPE_OF[rows[rid]]] += 1
            done = sum(person_count[rid] for rid in rows)
            rest = total - done
            detail = "・".join(f"{k} {n}人" for k, n in sorted(by.items()))
            print(f"{field}: 母集団 {total}人 → 確定済み {done}人（{detail}）"
                  f" / 未確定 {rest}人")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
