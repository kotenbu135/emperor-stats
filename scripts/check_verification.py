#!/usr/bin/env python3
"""検証段の体数（data/verification.json）のゲート。

規則 ID は RULES.yml の R-VERIFY-TIER。**判定はしない。**
見るのは「体数が政権の史料形態から引けているか」と「指摘率を読める形で残っているか」だけ。

  1. 体数は tier から一意に決まる（own-annals=1・dependent=3）。行ごとに書き換えられない
  2. **1体へ減らす側にだけ根拠を要求する** — own-annals には書名・所在・体裁が要る。
     dependent は既定なので無根拠で置ける（厚い側へ倒れる誤りは損がトークンだけ）
  3. 載せ忘れた政権は既定（dependent）へ落ちる。--scope が名指しで出すので黙って薄くならない
  4. ブロックの記録は confirmed <= raised を満たす。raised=0 のとき率は未定義（null）

    python3 scripts/check_verification.py            # ゲート
    python3 scripts/check_verification.py --scope    # tier 分布と体数の総計
    python3 scripts/check_verification.py --for <皇帝id>   # 着手時。体数と観点を出す
    python3 scripts/check_verification.py --rate     # ブロック別の指摘率
"""
import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "data" / "verification.json"
EMPERORS = ROOT / "data" / "emperors.json"

# tier ごとの体数と観点。**ここが唯一の正**で、記録側の verifiers はこれと一致しているかだけ見る
# （行ごとに体数を書き換えられると「このブロックだけ1体で」が通ってしまう）
TIERS = {
    "own-annals": (1, ["facts"]),
    "dependent": (3, ["facts", "kinship", "dates"]),
}
DEFAULT_TIER = "dependent"

ERRORS = []
WARNINGS = []


def err(msg):
    ERRORS.append(msg)


def warn(msg):
    WARNINGS.append(msg)


def load():
    led = json.loads(LEDGER.read_text(encoding="utf-8"))
    emp = json.loads(EMPERORS.read_text(encoding="utf-8"))
    return led, emp


def regime_tier_map(led, valid_regimes):
    """政権 id → (tier, 記録エントリ)。載っていない政権は既定へ落とす。"""
    out = {}
    seen = {}
    for i, t in enumerate(led.get("tiers", [])):
        tier = t.get("tier")
        if tier not in TIERS:
            err(f"[tier] tiers[{i}]: 未知の tier {tier!r}（{'/'.join(TIERS)} のみ）")
            continue
        want, _ = TIERS[tier]
        if t.get("verifiers") != want:
            err(f"[tier] tiers[{i}] ({tier}): verifiers={t.get('verifiers')} だが "
                f"{tier} の体数は {want}。行ごとに体数を変えない")
        # 1体へ減らす側にだけ根拠を要求する（非対称）
        if tier == "own-annals":
            for k in ("book", "locator", "form"):
                if not t.get(k):
                    err(f"[tier] tiers[{i}] ({t.get('book') or '?'}): own-annals には {k} が要る"
                        f"（1体へ減らす側の根拠）")
        ids = t.get("regimeIds") or []
        if not ids:
            err(f"[tier] tiers[{i}]: regimeIds が空")
        for rid in ids:
            if rid not in valid_regimes:
                err(f"[tier] tiers[{i}]: 政権 id {rid!r} が emperors.json のカタログに無い")
                continue
            if rid in seen:
                err(f"[tier] 政権 {rid!r} が tiers[{seen[rid]}] と tiers[{i}] に重複")
            seen[rid] = i
            out[rid] = (tier, t)
    return out


def person_exceptions(led, valid_persons):
    """人物 id → (tier, 理由)。**政権の判定を所在の違う人物に被せない**（R-REGIME-FIRST と同じ形）。

    薄い側（own-annals）へ移す例外にだけ理由を要求する。厚い側へ移すのは損がトークンだけ。
    """
    out = {}
    for i, t in enumerate(led.get("tiers", [])):
        for j, ex in enumerate(t.get("exceptions") or []):
            tier = ex.get("tier")
            if tier not in TIERS:
                err(f"[例外] tiers[{i}].exceptions[{j}]: 未知の tier {tier!r}")
                continue
            if tier == "own-annals" and not ex.get("reason"):
                err(f"[例外] tiers[{i}].exceptions[{j}]: own-annals へ移す例外には reason が要る"
                    f"（1体へ減らす側の根拠）")
            for pid in ex.get("personIds") or []:
                if pid not in valid_persons:
                    err(f"[例外] tiers[{i}].exceptions[{j}]: 皇帝 id {pid!r} が emperors.json に無い")
                    continue
                if pid in out:
                    err(f"[例外] 皇帝 {pid!r} が複数の例外に載っている")
                out[pid] = (tier, ex.get("reason", ""))
    return out


def check_locators(tmap):
    """own-annals が名指しした所在が実在するか。**コーパスはリポジトリに無い**ので
    手元にあるときだけ見る（CI では飛ばす。verify_quotes.py --check-books と同じ扱い）。"""
    if not (ROOT / "china-history").exists():
        return None
    checked = 0
    for rid, (tier, t) in sorted(tmap.items()):
        if tier != "own-annals":
            continue
        loc = t.get("locator", "")
        # locator は「path（説明）」形式。先頭の空白までを路として見る
        head = loc.split("（")[0].strip()
        if not head.startswith(("china-history/", "daizhigev20/")):
            continue
        checked += 1
        # {后梁,后唐,...} 展開
        if "{" in head:
            base, rest = head.split("{", 1)
            names, tail = rest.split("}", 1)
            paths = [ROOT / (base + n + tail) for n in names.split(",")]
        else:
            paths = [ROOT / head]
        for p in paths:
            if not p.exists():
                err(f"[locator] {rid}: 所在 {p.relative_to(ROOT)} が実在しない")
    return checked


def check_blocks(led, tmap):
    seen = set()
    for i, b in enumerate(led.get("blocks", [])):
        for k in ("id", "task", "people", "tier", "verifiersPerPerson", "measuredAt"):
            if k not in b:
                err(f"[block] blocks[{i}]: {k} が無い")
        bid = b.get("id")
        if bid in seen:
            err(f"[block] id {bid!r} が重複")
        seen.add(bid)
        if b.get("tier") not in TIERS:
            err(f"[block] {bid}: 未知の tier {b.get('tier')!r}")
        if not isinstance(b.get("people"), int) or b.get("people", 0) < 1:
            err(f"[block] {bid}: people が正の整数でない")
        raised, confirmed = b.get("raised"), b.get("confirmed")
        if (raised is None) != (confirmed is None):
            err(f"[block] {bid}: raised と confirmed は両方書くか両方 null にする"
                f"（片方だけだと率が出せない）")
        if isinstance(raised, int) and isinstance(confirmed, int) and confirmed > raised:
            err(f"[block] {bid}: confirmed={confirmed} が raised={raised} を超えている")
        if b.get("escapes") is None:
            warn(f"[block] {bid}: escapes が null（後から見つかった実欠陥を数えていない）")
        check_webdiff(b, bid)
    return len(led.get("blocks", []))


def check_webdiff(b, bid):
    """Web 差分検出（profile-webdiff）の歩留まり。

    own-annals の3段目を落として総コストを中立に寄せるかは Issue #43 の判断待ちで、
    **落とさず歩留まりを記録し始める**のがユーザー決定（2026-08-03）。
    「own-annals は Web の拾いも少ないはず」という期待が未検証のまま削れないので、
    その期待を測るための欄。**tier の体数には数えない**（webdiff は全員1体のまま）。
    """
    w = b.get("webdiff")
    if w is None:
        if b.get("task") == "profiles":
            warn(f"[block] {bid}: webdiff が null（Web 差分の歩留まりを数えていない）。"
                 "own-annals の3段目を落とせるかの判断はこの数字待ち")
        return
    if not isinstance(w, dict) or set(w) - {"raised", "confirmed", "note"}:
        err(f"[block] {bid}: webdiff は raised / confirmed / note を持つオブジェクトです: {w!r}")
        return
    r, c = w.get("raised"), w.get("confirmed")
    if (r is None) != (c is None):
        err(f"[block] {bid}: webdiff の raised と confirmed は両方書くか両方 null にする")
    if isinstance(r, int) and isinstance(c, int) and c > r:
        err(f"[block] {bid}: webdiff.confirmed={c} が raised={r} を超えている")


def cmd_gate(led, emp):
    regimes = {r["id"]: r for r in emp["meta"]["catalogs"]["regimes"]}
    tmap = regime_tier_map(led, regimes)
    pex = person_exceptions(led, {e["id"] for e in emp["emperors"]})
    checked_loc = check_locators(tmap)
    nblocks = check_blocks(led, tmap)

    for w in WARNINGS:
        print(f"警告: {w}")
    for e in ERRORS:
        print(f"エラー: {e}")
    used = Counter(e["regimeId"] for e in emp["emperors"])
    defaulted = [r for r in regimes if r not in tmap and used.get(r)]
    print(f"\n評価件数: 記録 {len(led.get('tiers', []))}行 / 政権 {len(tmap)}件を明示・"
          f"{len(defaulted)}件が既定（{DEFAULT_TIER}）へ / 人物単位の例外 {len(pex)}件 / "
          f"ブロック {nblocks}件")
    if checked_loc is None:
        print("所在の実在確認: コーパスが無いので飛ばしました（ローカルでのみ検査）")
    else:
        print(f"所在の実在確認: own-annals {checked_loc}行")
    print(f"エラー {len(ERRORS)}件 / 警告 {len(WARNINGS)}件")
    return 1 if ERRORS else 0


def cmd_scope(led, emp):
    regimes = {r["id"]: r for r in emp["meta"]["catalogs"]["regimes"]}
    tmap = regime_tier_map(led, regimes)
    used = Counter(e["regimeId"] for e in emp["emperors"])

    pex = person_exceptions(led, {e["id"] for e in emp["emperors"]})
    people = Counter()
    for e in emp["emperors"]:
        tier = tmap.get(e["regimeId"], (DEFAULT_TIER, None))[0]
        if e["id"] in pex:
            tier = pex[e["id"]][0]
        people[tier] += 1
    rows = defaultdict(list)
    for rid, n in used.items():
        tier = tmap.get(rid, (DEFAULT_TIER, None))[0]
        rows[tier].append((n, rid, regimes[rid]["name"], rid in tmap))

    total = sum(people.values())
    print(f"母集団 {total}人 / {len(used)}政権（うち人物単位の例外 {len(pex)}人）\n")
    verifiers = 0
    for tier, (n_ver, lenses) in TIERS.items():
        n = people.get(tier, 0)
        verifiers += n * n_ver
        print(f"{tier:12s} {n:3d}人 × {n_ver}体 = {n * n_ver:4d}体  観点: {'・'.join(lenses)}")
    print(f"\n原文突き合わせの総数 {verifiers}体（一律1体なら {total}体）")
    print("\n**これは総コスト中立ではない。** Issue #41 は「総コストをほぼ変えずに密度の高い側へ寄せる」")
    print("と書いているが、薄い側はすでに1〜2段まで削れていて、そこから引ける余地が無かった。")
    print(f"  名前データ: 1人1体 {total}体 → {verifiers}体（+{verifiers / total - 1:.0%}）")
    print(f"  紹介文: 1人2段（原文突き合わせ＋Web差分）{total * 2}体 → "
          f"{verifiers + total}体（+{(verifiers + total) / (total * 2) - 1:.0%}）")
    print(f"  中立にするなら own-annals の Web 差分を落とす（{verifiers + people['dependent']}体・"
          f"{(verifiers + people['dependent']) / (total * 2) - 1:+.0%}）が、"
          "Web 差分は2026-08-02のユーザー決定なので勝手には外していない")

    dflt = sorted(rows[DEFAULT_TIER], reverse=True)
    named = [r for r in dflt if r[3]]
    fell = [r for r in dflt if not r[3]]
    print(f"\n既定（{DEFAULT_TIER}）へ落ちた政権 {len(fell)}件・{sum(r[0] for r in fell)}人"
          "（記録に無いだけで、厚い側なので安全側）:")
    print("  " + "・".join(f"{name}{n}" for n, rid, name, _ in fell[:20])
          + ("…" if len(fell) > 20 else ""))
    if named:
        print(f"明示的に {DEFAULT_TIER} と書いた政権 {len(named)}件")


def cmd_for(led, emp, eid):
    e = next((x for x in emp["emperors"] if x["id"] == eid), None)
    if e is None:
        print(f"皇帝 id {eid!r} が見つかりません")
        return 1
    regimes = {r["id"]: r for r in emp["meta"]["catalogs"]["regimes"]}
    tmap = regime_tier_map(led, regimes)
    pex = person_exceptions(led, {x["id"] for x in emp["emperors"]})
    rid = e["regimeId"]
    tier, entry = tmap.get(rid, (DEFAULT_TIER, None))
    exc = pex.get(eid)
    if exc:
        # 政権の判定を所在の違う人物に被せない
        tier, entry = exc[0], None
    n_ver, lenses = TIERS[tier]
    nm = e.get("name")
    label = nm.get("commonName") or nm.get("personalName") if isinstance(nm, dict) else nm
    print(f"{eid}（{label}）政権 {rid}（{regimes[rid]['name']}）")
    print(f"tier: {tier}    検証体数: {n_ver}    観点: {'・'.join(lenses)}")
    if exc:
        print(f"根拠: **この政権の判定は被らない（人物単位の例外）** — {exc[1]}")
    elif entry:
        print(f"根拠: {entry['book']} {entry['form']} — {entry['locator']}")
        if entry.get("note"):
            print(f"注: {entry['note']}")
    else:
        print(f"根拠: なし（記録に無いので既定の {DEFAULT_TIER}）。"
              "**この政権の記述は載記・類書・地方志に散る前提で読む**")
    print("\n観点の中身:")
    for k in lenses:
        print(f"  {k}: {led['meta']['lenses'][k]}")
    return 0


def cmd_rate(led, emp):
    print("ブロック別の指摘率（規則 R-VERIFY-TIER の完了条件）\n")
    print("escapes = 検証を通過したあと別作業で見つかった実欠陥（遡及して数えられるのはこれだけ）")
    print("raised/confirmed = 検証段が挙げた指摘と、そのうち実欠陥だった件数\n")
    print("webdiff = Web 差分検出が挙げた食い違い／そのうち原文で確かめて実欠陥だった件数"
          "（tier の体数には数えない・Issue #43）\n")
    hdr = (f"{'ブロック':34s} {'tier':11s} {'人':>3s} {'体/人':>4s} {'指摘':>4s} {'実欠陥':>5s} "
           f"{'実欠陥率':>7s} {'escapes':>8s} {'webdiff':>9s}")
    print(hdr)
    print("-" * len(hdr))
    for tier in TIERS:
        for b in led.get("blocks", []):
            if b.get("tier") != tier:
                continue
            r, c = b.get("raised"), b.get("confirmed")
            rate = "—" if not isinstance(r, int) or r == 0 else f"{c / r:.0%}"
            esc = b.get("escapes")
            esc_s = "—" if esc is None else f"{esc}（{esc / b['people']:.2f}/人）"
            w = b.get("webdiff") or {}
            wd = "—" if w.get("raised") is None else f"{w['confirmed']}/{w['raised']}"
            print(f"{b['id']:34s} {tier:11s} {b['people']:3d} {b['verifiersPerPerson']:4d} "
                  f"{'—' if r is None else r:>4} {'—' if c is None else c:>5} {rate:>7s} "
                  f"{esc_s:>8s} {wd:>9s}")
    print("\n" + led["meta"]["confound"])
    print("\n" + led["meta"]["whichNumber"])
    print("\n" + led["meta"]["webdiff"])


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--scope", action="store_true", help="tier 分布と体数の総計")
    ap.add_argument("--for", dest="for_id", metavar="皇帝id", help="着手時。体数と観点を出す")
    ap.add_argument("--rate", action="store_true", help="ブロック別の指摘率")
    ap.add_argument("--check", action="store_true", help="ゲート（既定と同じ）")
    args = ap.parse_args()

    led, emp = load()
    if args.for_id:
        return cmd_for(led, emp, args.for_id)
    if args.scope:
        regimes = {r["id"]: r for r in emp["meta"]["catalogs"]["regimes"]}
        regime_tier_map(led, regimes)  # 構造の誤りは scope でも出す
        if ERRORS:
            for e in ERRORS:
                print(f"エラー: {e}")
            return 1
        cmd_scope(led, emp)
        return 0
    if args.rate:
        cmd_rate(led, emp)
        return 0
    return cmd_gate(led, emp)


if __name__ == "__main__":
    sys.exit(main())
