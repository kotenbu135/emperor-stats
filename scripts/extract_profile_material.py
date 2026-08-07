#!/usr/bin/env python3
"""紹介文（GitHub Issue #16）を書くための素材を1人ぶんずつ抜き出す。

紹介文は**既存の調査結果の範囲内だけ**で書く決まり（SITE_DESIGN.md の8節）なので、
執筆に必要なのは data/emperors.json の一部フィールドだけ。約7MBの本体を会話へ読み込む
かわりに、ここで人が読める形へ落とす（CLAUDE.md の「コンテキスト効率」）。

**データを書き換えないし、紹介文を生成もしない。** 出すのは既存フィールドの引き写しで、
文章を書くのは人（一人ずつ作成する — Issue #16）。

**note は既定で出さない**（規則 R-CLAIMS-FIRST・PROCESS_IMPROVEMENTS「1段目には素材 note を
渡さない」）。1段目が note を読むと、note の筋書きに合う原文句を探すことになり、note の誤りが
そのまま成果物へ流れます。実際、紹介文で見つかった誤りの多くが note 由来でした（#32・#33・#36）。
note との突き合わせは**2段目（検証）の仕事**なので、そこでだけ `--notes on` を付けます。
既定を off にしてあるのは、付け忘れたときに安全側へ倒れるようにするためです。

使い方:
    python3 scripts/extract_profile_material.py qin-shi-huang qin-er-shi
    python3 scripts/extract_profile_material.py --section '秦（始皇帝以降）'
    python3 scripts/extract_profile_material.py --list-sections
    python3 scripts/extract_profile_material.py <id> --notes on   # 検証段だけ
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import profile_name  # noqa: E402  （本文で使う人物名）

ROOT = Path(__file__).resolve().parent.parent
EMPERORS = ROOT / "data" / "emperors.json"

# 回数系8項目。count と note を並べる（0回の note に「なぜ0か」が書いてあることが多く、
# 紹介文の素材として count そのものより効く）。
COUNT_FIELDS = [
    ("eraChangeCount", "改元"),
    ("amnestyCount", "大赦"),
    ("empressInstallationCount", "立后"),
    ("crownPrinceDepositionCount", "皇太子の廃立"),
    ("personalCampaignCount", "親征"),
    ("rebellionSuppressionCount", "反乱鎮圧"),
    ("rebellionSufferedCount", "被反乱"),
    ("capitalRelocationCount", "遷都"),
]


NOTE_BANNER_OFF = (
    "> **この素材に既存 note は載せていません**（events の note も含む）。"
    "残っているのは構造フィールドと原典引用だけです。\n"
    "> 0回・不明・特異な値の理由や、events が何の出来事かは、note ではなく**原文で**"
    "確かめてください。note との突き合わせは検証段の仕事です（`--notes on`）。\n"
)
NOTE_BANNER_ON = (
    "> **既存 note を載せています（検証用）。**"
    "note は素材であって根拠ではありません。原文と食い違ったら**原文が正**で、"
    "食い違いは `emperors.json` 側の疑いとして報告します。\n"
)


def render(e: dict, catalogs: dict, max_events: int, notes: bool) -> str:
    name = e["name"]
    display = (
        name.get("commonName")
        or name.get("personalName")
        or name.get("templeName")
        or name.get("posthumousName")
    )
    regime = catalogs["regimes"].get(e.get("regimeId"), e.get("regimeId"))
    out: list[str] = []
    add = out.append

    add(f"## {display}（{e['id']}）")
    add("")
    add(f"- 政権: {regime}／区分: {e.get('researchSection')}")
    add(
        "- 名: 姓 {familyName}／諱 {personalName}／通用名 {commonName}／廟号 {templeName}／諡号 {posthumousName}".format(
            familyName=name.get("familyName") or "（無し）",
            personalName=name.get("personalName") or "—",
            commonName=name.get("commonName") or "—",
            templeName=name.get("templeName") or "—",
            posthumousName=name.get("posthumousName") or "—",
        )
    )
    # 本文で使う名前（2026-08-07）。**書き手に選ばせない** — 原文は諱1字で人物を
    # 指すので、そのまま持ってくると「垂は」「勒は」になる。既存148本のうち91本が
    # そうなっていた。姓を繋げれば済む話でもない（耶律阿保機・クビライ）ので、
    # scripts/profile_name.py の1実装から引いてここへ配る（形を探させない）。
    resolved = profile_name.resolve(e, profile_name.load_readings())
    add(
        f"- **本文で使う名前: {resolved['annotated']}**"
        f"（諱「{name.get('personalName')}」だけで指さない・ルビも振る）"
    )
    # 民族名（Issue #37 単位3）。2026-08-03 に personalName の括弧から分けたので、
    # ここで出さないと元・北元の12人は執筆者から「クビライ」が見えなくなる。
    if name.get("ethnicName"):
        add(f"- 民族名: {name['ethnicName']['value']}（{name['ethnicName']['kind']}）")
    # 字（単位4）と幼名＝原文の「小字」（単位5）。**空でも「無い」ではない**（唐以降の
    # 帝紀は冒頭定型に字を書かず、小字を載せる書はさらに少ない）ので、無いことを
    # 紹介文に書かない。
    if name.get("courtesyName"):
        add(f"- 字: {name['courtesyName']}")
    if name.get("childhoodName"):
        add(f"- 幼名（原文は「小字」）: {name['childhoodName']}")
    if name.get("aliases"):
        add(f"- 別名: {'・'.join(name['aliases'])}")
    if e.get("flags", {}).get("isFemale"):
        add("- **女性**")

    summary = e.get("reignSummary", {}).get("totalReignDuration", {})
    add(
        f"- 在位: {e['reignSummary'].get('firstStartYear')}〜"
        f"{e['reignSummary'].get('lastEndYear')}年"
        f"／通算 約{summary.get('approxDays')}日（{summary.get('displayYears')}年）"
        f"／{e['reignSummary'].get('reignCount')}期"
        + ("／**日数は概算**" if summary.get("needsPreciseDays") else "")
    )
    for i, r in enumerate(e.get("reigns", []), 1):
        line = f"  - 第{i}期 {r.get('raw')}（{r.get('durationRaw')}）"
        if r.get("isRestoration"):
            line += "【復位】"
        add(line)
        if notes and r.get("note"):
            add(f"    - note: {r['note']}")
        src = (r.get("duration") or {}).get("source") if isinstance(r.get("duration"), dict) else None
        if isinstance(src, dict):
            # source には原典引用（page・quote）と作業ログ（conversion・note）が同居している。
            # note を伏せる側で dict をそのまま吐くと、作業ログが素通りする。
            keep = src if notes else {k: v for k, v in src.items() if k in ("page", "quote")}
            add("    - 典拠: " + "／".join(f"{k}: {v}" for k, v in keep.items() if v))
        elif src:
            add(f"    - 典拠: {src}")

    ages = e.get("ages") or {}
    add(
        f"- 年齢: 即位 {ages.get('accessionAge')}／没 {ages.get('deathAge')}"
        f"（生 {ages.get('birthDate')}／没 {ages.get('deathDate')}・数え年）"
    )
    if notes and ages.get("note"):
        add(f"  - note: {ages['note']}")

    acc = e.get("accessionRoute") or {}
    axes = acc.get("axes") or {}
    add(f"- 即位経路: {acc.get('categoryId')}")
    add(
        "  - 軸: 皇位の出所 {throneSource}／称号の由来 {titleOrigin}／決定者 {decidedBy}"
        "／前任者の末路 {predecessorFate}／前任者との関係 {relationToPredecessor}"
        "／手続き {procedure}".format(
            throneSource=axes.get("throneSource"),
            titleOrigin=axes.get("titleOrigin"),
            decidedBy="・".join(axes.get("decidedBy") or []),
            predecessorFate=axes.get("predecessorFate"),
            relationToPredecessor=axes.get("relationToPredecessor"),
            procedure=axes.get("procedure"),
        )
    )
    if notes and acc.get("note"):
        add(f"  - note: {acc['note']}")

    death = e.get("deathCause") or {}
    add(f"- 死因: {death.get('category')}")
    if notes and death.get("note"):
        add(f"  - note: {death['note']}")

    add("- 回数8項目:")
    for key, label in COUNT_FIELDS:
        f = e.get(key) or {}
        add(f"  - {label}: {f.get('count')}回")
        if notes and f.get("note"):
            add(f"    - note: {f['note']}")
        events = f.get("events") or []
        if events:
            add(f"    - events {len(events)}件（先頭{min(len(events), max_events)}件）:")
            for ev in events[:max_events]:
                # events はキーが項目ごとに違う（name/leader/outcome、eraName/newEra、
                # target、from/to…）ので、日付以外は素直に全部並べる。
                date = ev.get("startDate") or ev.get("date") or ev.get("dateRaw") or "日付不明"
                # events の note も素材 note。伏せても構造キー（name/leader/outcome/target）が
                # 残るので、何が起きたかの見当は付く（note しか中身が無い events は実測で 6%）。
                skip = {"startDate", "endDate", "date", "datePrecision"}
                if not notes:
                    skip.add("note")
                rest = "／".join(f"{k}: {v}" for k, v in ev.items() if k not in skip and v)
                if not rest and not notes and ev.get("note"):
                    # 伏せた結果その events が日付だけになったことを隠さない。
                    # 「何も無い」と「見せていない」は違う（改元は元号名が note にしか無い）
                    rest = "（内容は note のみ・原文で確かめる）"
                add(f"      - {date} {rest}")
            if len(events) > max_events:
                # 省略した件の**日付だけは全部出す**（2026-08-06）。回数の多い項目では
                # 打ち切られた件が原文との突き合わせから丸ごと落ち、「素材と原文は
                # 一致した」を件数の一部だけで言うことになっていた（孫権の大赦9件中
                # 9件目が見えなかった）。詳細が要るときは --max-events を上げる。
                dropped = [
                    (ev.get("startDate") or ev.get("date") or ev.get("dateRaw") or "日付不明")
                    for ev in events[max_events:]
                ]
                add(
                    f"      - （残り{len(dropped)}件の日付: {'・'.join(dropped)}"
                    f" — 中身は --max-events {len(events)} で出る）"
                )

    v = e.get("verification") or {}
    if notes and v.get("notes"):
        add(f"- 収録メモ: {v['notes']}")

    add("")
    add(reading_map(e["id"]))
    add("")
    add(writing_kit(e["id"]))
    add("")
    return "\n".join(out)


PROFILES = ROOT / "data" / "emperor-profiles.json"
# 見本は1本だけ出す。3本読ませると分量が増えるうえ、実測では執筆エージェントが
# 毎回 python3 -c で emperor-profiles.json の構造を探るところからやり直していた。
# nanyan-murongchao を選ぶのは body が目安（800〜1,500字）の内側に収まっている唯一の
# 中規模の本で、「上限まで書かない」を字数でなく現物で見せられるため。
SAMPLE_ID = "nanyan-murongchao"


def writing_kit(emperor_id: str) -> str:
    """見本1本・断片の作り方・ゲートの走らせ方（2026-08-05）。

    **形の再発見をここで潰す。** Workflow の実測では十数ターンが
    「emperor-profiles.json のキー構造を探る」「name-readings.json を grep する」
    「見本を3本引き直す」に使われていた。読み地図と同じ扱いで、執筆段が必ず通る
    素材の末尾へ出す。
    """
    lines = ["### 見本（1本だけ・これ以上は引かない）"]
    try:
        profiles = json.loads(PROFILES.read_text(encoding="utf-8"))["profiles"]
        s = profiles.get(SAMPLE_ID)
        if s is None:
            lines.append(f"- 見本 {SAMPLE_ID} が emperor-profiles.json に無い")
        else:
            lines.append(
                f"`data/emperor-profiles.json` は `profiles.<皇帝id>."
                "{lead,body,description,basis}`。**構造を探らない。**"
            )
            lines.append(f"以下は {SAMPLE_ID}（南燕 慕容超）の全文。")
            for k in ("lead", "body", "description", "basis"):
                if s.get(k):
                    lines.append("")
                    lines.append(f"**{k}**")
                    lines.append("```")
                    lines.append(s[k])
                    lines.append("```")
    except Exception as exc:
        lines.append(f"- 見本を引けなかった: {exc}")

    lines.append("")
    lines.append("### ルビ")
    lines.append(
        "読みの正本は `data/name-readings.json` と `data/profile-ruby-lexicon.json`。"
        "**先に grep しなくてよい** — テーブルと違う振り方をすれば "
        "`check_profile_fragment.py` が落として正解を出す。"
        "難読語・中国史特有の語だけに振り、`description` には振らない"
        "（記法は `｜親文字《ルビ》`・`｜` を省略しない）。"
    )
    lines.append(
        "**2回目以降の出現にも振る**（初出だけにしない・2026-08-05 ユーザー決定）。"
        "書き終えてから `python3 scripts/reapply_profile_ruby.py <断片.json> --write` を"
        "1回流せば、辞書の語と自分が振った語を全出現へ機械が付ける。"
        "地名・官職・故事・干支（「丙寅」）も対象で、**読みだけでは意味が分からない語"
        "（「奇貨居くべし」「仲父」）は、ルビに加えて地の文で意味が分かるように書く**。"
    )

    lines.append("")
    lines.append("### 断片とゲート（この順に走らせる）")
    lines.append("```bash")
    lines.append(f"python3 scripts/new_profile_fragment.py {emperor_id} --out <workDir>")
    lines.append("#   骨格 <workDir>/%s.json と空の台帳 <workDir>/%s.claims.jsonl を作る"
                 % (emperor_id, emperor_id))
    lines.append(f"python3 scripts/check_profile_fragment.py <workDir>/{emperor_id}.json --strict")
    lines.append(f"python3 scripts/check_profile_ngram.py    <workDir>/{emperor_id}.json")
    lines.append("```")
    lines.append(
        "**Write は骨格を埋める1回だけで、以降は Edit で直す**"
        "（`build.py` の類を書かない — 本文を1文直すたびに台帳ごと再送されて費用が跳ねる）。"
        "引用台帳は読みながら `.claims.jsonl` へ1行1件で足す。"
    )
    return "\n".join(lines)


def reading_map(emperor_id: str) -> str:
    """本紀キャッシュの読み地図と、列伝の在り処。

    **別コマンドにすると忘れる。** 執筆段が必ず通るここへ出す。中身の判定は
    `corpus_reading_map.py`（詔・冊文の区間）と `find_biography.py`（列伝の在り処）の
    1実装で、ここは呼ぶだけ。どちらも 2026-08-05 の試作で人が毎回つまずいた点
    （隋書の列伝が china-history に無い・大物は本紀の大半が詔）を機械側へ移したもの。
    """
    sys.path.insert(0, str(ROOT / "scripts"))
    lines = ["### 本紀の読み地図（1巡の配分）"]
    try:
        from corpus_reading_map import build, render  # noqa: PLC0415

        path, rows = build(emperor_id)
        if path is None:
            lines.append(f"- `_corpus_cache/{emperor_id}.txt` が無い。先にキャッシュを作る")
        else:
            lines.append("```")
            lines.append(render(emperor_id, rows, per_line=False))
            lines.append("```")
            lines.append(
                "詔・冊文の割合は**下限**（「詔曰：“…”」と1行に収まる形は叙事として数える）。"
            )
    except Exception as exc:  # 素材の抽出そのものは止めない
        lines.append(f"- 読み地図を作れなかった: {exc}")

    lines.append("")
    lines.append("### 列伝の在り処（Web差分が当たったときだけ降りる）")
    try:
        from find_biography import books_for, targets_for  # noqa: PLC0415

        books = books_for(emperor_id)
        if not books:
            lines.append("- レコードから書名を引けなかった。`--book` で書名を渡す")
        for b in books:
            _, notes_ = targets_for(b)
            lines.append(f"- **{b}**")
            for n in notes_:
                lines.append(f"  - {n}")
        lines.append(
            "  - 引くのは `python3 scripts/find_biography.py "
            f"{emperor_id} <人名>`（**コーパスに素の grep を掛けない**）"
        )
    except Exception as exc:
        lines.append(f"- 在り処を引けなかった: {exc}")
    return "\n".join(lines)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("ids", nargs="*", help="皇帝id")
    p.add_argument("--section", help="researchSection でまとめて出す")
    p.add_argument("--list-sections", action="store_true")
    p.add_argument("--max-events", type=int, default=8, help="1項目あたりに出す events 件数")
    p.add_argument("--notes", choices=["off", "on"], default="off",
                   help="既存 note を出すか。既定 off（1段目には渡さない）。"
                        "on にしてよいのは検証段だけ")
    args = p.parse_args()

    data = json.loads(EMPERORS.read_text(encoding="utf-8"))
    catalogs = {
        "regimes": {r["id"]: r["label"] for r in data["meta"]["catalogs"]["regimes"]},
    }

    if args.list_sections:
        seen: dict[str, int] = {}
        for e in data["emperors"]:
            seen[e.get("researchSection")] = seen.get(e.get("researchSection"), 0) + 1
        for name, n in seen.items():
            print(f"{n:4d}  {name}")
        return 0

    if args.section:
        targets = [e for e in data["emperors"] if e.get("researchSection") == args.section]
    else:
        by_id = {e["id"]: e for e in data["emperors"]}
        targets = []
        for i in args.ids:
            if i not in by_id:
                print(f"存在しない皇帝id: {i}", file=sys.stderr)
                return 1
            targets.append(by_id[i])

    if not targets:
        print("対象が0件です（--list-sections で区分名を確認）", file=sys.stderr)
        return 1

    notes = args.notes == "on"
    print(NOTE_BANNER_ON if notes else NOTE_BANNER_OFF)
    for e in targets:
        print(render(e, catalogs, args.max_events, notes))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
