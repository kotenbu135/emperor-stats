#!/usr/bin/env python3
"""調査エージェントの出力（claims-first 断片）のゲート。

契約は docs/process/CLAIMS_CONTRACT.md、規則 ID は RULES.yml の R-CLAIMS-FIRST。
判定はしない。「原文がそこにあるか」「主張が台帳を指しているか」だけを見る。

    python3 scripts/check_claims.py <断片.json> [...]
    python3 scripts/check_claims.py <ディレクトリ>

エラー0は「綺麗」と「空回り」を区別しないので、照合した件数を必ず出す。
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import verify_quotes as vq  # noqa: E402
from hanzi_norm import norm_for_match  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def segments(quote):
    """中略で割った連続断片。各断片は単体で底本に存在しなければならない。"""
    parts = [p.strip() for p in re.split(r"[…‥]{1,}|\.{3,}", quote)]
    return [p for p in parts if len(vq.fragments(p, size=4, min_len=2)) or len(p) >= 2]


def check_one(path, errors, reports, counters):
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception as e:
        errors.append(f"{path}: JSON として読めません: {e}")
        return

    tag = data.get("id") or Path(path).stem

    eid = data.get("id")
    if not eid or not ID_RE.match(str(eid)):
        errors.append(f"{tag}: id が不正です（指定された id をそのまま返す）: {eid!r}")

    if "discrepancies" not in data or not str(data.get("discrepancies") or "").strip():
        errors.append(f"{tag}: discrepancies が空です。"
                      "食い違いが無いなら「なし」と明記する（無言を照合済みと読まないため）")

    claims = data.get("claims")
    if not isinstance(claims, list) or not claims:
        errors.append(f"{tag}: claims が空です。原文の引用台帳を先に作る")
        claims = []

    seen = {}
    for i, c in enumerate(claims):
        cid = c.get("cid")
        if not cid:
            errors.append(f"{tag}: claims[{i}] に cid がありません")
            continue
        if cid in seen:
            errors.append(f"{tag}: cid が重複しています: {cid}")
        seen[cid] = c

        quote = (c.get("quote") or "").strip()
        rel = (c.get("file") or "").strip()
        if not quote or not rel:
            errors.append(f"{tag}/{cid}: quote と file は必須です")
            continue
        if not vq.CORPUS_ROOT or not (vq.CORPUS_ROOT / rel).exists():
            errors.append(f"{tag}/{cid}: file が存在しません: {rel}")
            continue

        counters["checked"] += 1
        strict = vq.strict_file(rel)
        loose = vq.normalized_file(rel)
        segs = segments(quote)

        for s in segs:
            if vq.frag_in_strict(s, strict):
                continue
            # 細切れにすると全部当たる＝底本の複数箇所を1つの引用へ合成している
            # （Issue #38 の主たる型。中略で割れば連続断片になるはず）
            frs = vq.fragments(s) or [s]
            if len(frs) > 1 and all(vq.frag_in_strict(f, strict) for f in frs):
                counters["spliced"] += 1
                errors.append(f"{tag}/{cid}: 断片は当たるが底本の連続した1か所に無く、"
                              f"複数箇所の合成に見えます: {s[:34]}")
            elif norm_for_match(s) in loose:
                # 新字体表の助けで当たる＝そこをコピーせず打ち直した印
                counters["glyph"] += 1
                reports.append(f"{tag}/{cid}: 底本の字体と違います"
                               f"（コピーせず打ち直した疑い）: {s[:28]}")
            else:
                counters["unresolved"] += 1
                errors.append(f"{tag}/{cid}: 引用が {rel} に見つかりません: {s[:28]}")

        got = vq.line_of(rel, segs[0])
        want = c.get("line")
        if got and want and abs(int(want) - got) > 2:
            counters["line_off"] += 1
            reports.append(f"{tag}/{cid}: line の記録が実際と違います（記録 {want} / 実際 {got}）")

    sug = str(data.get("processSuggestion") or "").strip()
    if sug:
        counters["suggestions"] += 1
        reports.append(f"{tag}: 手順の改善提案 → {sug}")

    findings = data.get("findings")
    if not isinstance(findings, list) or not findings:
        errors.append(f"{tag}: findings が空です")
        findings = []
    for i, f in enumerate(findings):
        if not f.get("field"):
            errors.append(f"{tag}: findings[{i}] に field がありません")
        # 空の主張（value: null）は「読んで無いと決めた」と「値の扱いが判断待ち」の
        # 2種類があり、coverage.py は前者だけを不在確定に数える。**オプトイン**にして
        # あるので、キーの付け忘れは過小報告に落ちる（旗のオプトアウトだと過大報告に
        # 落ちる。2026-08-11 に pending: true から入れ替えた）
        if "value" in f and f["value"] is None:
            v = f.get("verdict")
            if v not in ("read-absent", "pending"):
                errors.append(
                    f"{tag}: findings[{i}]（{f.get('field')}）は value: null なので "
                    f'verdict が要ります（"read-absent" = 原文を読んで無いと決めた／'
                    f'"pending" = 値の扱いが判断待ち）: {v!r}')
        if "pending" in f:
            errors.append(f"{tag}: findings[{i}]（{f.get('field')}）の pending は廃止しました。"
                          'verdict: "pending" を使ってください')
        basis = f.get("basis")
        if not isinstance(basis, list) or not basis:
            errors.append(f"{tag}: findings[{i}]（{f.get('field')}）の basis が空です。"
                          "台帳に無い事実は書けない")
            continue
        for b in basis:
            if b not in seen:
                errors.append(f"{tag}: findings[{i}]（{f.get('field')}）の basis が"
                              f"未定義の cid を指しています: {b}")
        counters["findings"] += 1
        # `read-absent` は「どの語彙で閉じたか」を欄に持つ（PROCESS_IMPROVEMENTS 2026-08-13 の
        # 採用済み提案）。**エラーにしない** — 2026-08-14 より前に書いた証人には遡及しないので、
        # 落とすと過去の作業が全部赤くなる。代わりに**語彙を持つ側と持たない側を数えて出す**：
        # 語彙が足りないと後から分かったとき、当て直す母集団を機械で引けるかがこの数で分かる。
        if f.get("verdict") == "read-absent":
            if isinstance(f.get("sweptWords"), list) and f["sweptWords"]:
                counters["swept_words"] += 1
            else:
                counters["swept_words_missing"] += 1

    for i, cf in enumerate(data.get("conflicts") or []):
        if not str(cf.get("reason") or "").strip():
            errors.append(f"{tag}: conflicts[{i}]（{cf.get('field')}）に採否理由がありません")
        if not cf.get("alternatives"):
            errors.append(f"{tag}: conflicts[{i}]（{cf.get('field')}）に対立値がありません")
        counters["conflicts"] += 1


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 2
    if not vq.CORPUS_ROOT:
        print("ERROR  正史コーパスが見つかりません（china-history/・daizhigev20/・_corpus_cache/）。"
              "このゲートはローカル専用です。引用の中身は検証していません")
        return 2
    paths = []
    for a in args:
        p = Path(a)
        paths.extend(sorted(p.glob("*.json")) if p.is_dir() else [p])

    errors, reports = [], []
    counters = {"checked": 0, "unresolved": 0, "glyph": 0, "spliced": 0,
                "line_off": 0, "findings": 0, "conflicts": 0, "suggestions": 0,
                "swept_words": 0, "swept_words_missing": 0}
    for p in paths:
        check_one(p, errors, reports, counters)

    for r in reports:
        print(f"REPORT {r}")
    for e in errors:
        print(f"ERROR  {e}")
    print(f"\n{len(errors)} errors, {len(reports)} reports / "
          f"断片 {len(paths)}件・引用 {counters['checked']}件を照合"
          f"（主張 {counters['findings']}・対立 {counters['conflicts']}／"
          f"未解決 {counters['unresolved']}・字体 {counters['glyph']}・"
          f"合成疑い {counters['spliced']}・行ズレ {counters['line_off']}／"
          f"read-absent の証人 {counters['swept_words'] + counters['swept_words_missing']}件"
          f"のうち走査語彙 sweptWords を持つのは {counters['swept_words']}件）")
    if counters["suggestions"]:
        print(f"手順の改善提案が {counters['suggestions']}件あります。"
              f"ユーザーへ上げ、採否を docs/process/PROCESS_IMPROVEMENTS.md に残してください")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
