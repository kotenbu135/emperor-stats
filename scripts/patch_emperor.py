#!/usr/bin/env python3
"""確定済みの調査結果を data/emperors.json の1レコードへ**書き写す**ための転記ツール。

これまで訂正のマージは毎回その場の `python3 -c` で、read-modify-write の作法
（対象 id のフィールドだけ・`meta` と他レコードに触らない）が書き手の記憶に
依存していた。並行セッション前提なので、事故ると他セッションの編集を潰す。

## R-NO-AUTOGEN（スクリプトによるデータの自動生成は禁止）との境界

境界は禁止規則を増やして守るのではなく、**このツールが値を作れない**ように設計で持たせる。
不変条件は1つだけ:

    **出力に現れる値は、入力に literally 書かれていた値だけである。**

そのために意図的に持っていない機能:

- 計算をしない（日数・年齢・合計・年の加減算。`datetime` も `math` も import しない）
- 原典・コーパス・他の JSON を読まない（入力は引数と `--from-json` のファイルだけ）
- 既定値を入れない・空欄を埋めない・兄弟フィールドから写さない（`--from-field` は無い）
- **1回の起動で触れるのは皇帝1人だけ**（id のリスト・グロブ・`--all` は無い）。
  「同じ規則を複数の対象へ当てる」は判定であって転記ではない
- `meta` へは届かない（対象レコードの中しか降りない）
- 中間コンテナを勝手に作らない（`a.b.c` の `b` が無ければ**作らずに落ちる**）。
  構造を作るのは判定なので、既存の入れ物の中の葉だけを置く

やるのは「置く・消す・末尾に足す」の3つだけで、値の中身は見ない。

## 使い方

    python3 scripts/patch_emperor.py <皇帝id> --set 'deathCause.type="illness"'
    python3 scripts/patch_emperor.py jin-huidi --set-str 'ages.note=数え年48' --dry-run
    python3 scripts/patch_emperor.py jin-huidi --from-json patch.json
    python3 scripts/patch_emperor.py jin-huidi --unset 'deathCause.source.note'

`--set` の値は JSON（文字列は `"…"` で囲む）。引用や鉤括弧の多い長い note は
シェルの引用符で壊れやすいので `--set-str`（右辺をそのまま文字列にする）か
`--from-json` を使う。`--from-json` のファイルは次の形:

    {"set": {"deathCause.type": "illness"}, "unset": ["ages.note"],
     "append": {"amnestyCount.events": {"date": "0290-05-16", "note": "…"}}}

パス記法はドット＋添字（`reigns[0].endDate`・`amnestyCount.events[3].note`）。
`--append` は既存の配列の末尾に1件足す（配列そのものをパスで指す）。

## 並行セッション

読み込み時点の sha256 を覚えておき、**書き出す直前にもう一度読んで一致しなければ
書かずに落ちる**。その場の `python3 -c` にはできない防護がこれ。
書き出しは同じディレクトリの一時ファイル＋ `os.replace`（途中で壊れたファイルを残さない）。

## 出力

触ったパスの前後差分と、**そのパスが要求するゲート・一緒に触るもの**を出す。
「引用を変えたら verify_quotes」を書き手の記憶に頼らないため。
"""
import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "emperors.json"

TOKEN = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)((?:\[\d+\])*)$")

# 差分表示で「まだ無かった」を値と見分けるための番兵（JSON には入らない）
NEW_KEY = "（このキーは無かった）"

# 触ったパスが要求するゲートと結合（docs/process/COUPLINGS.md の実体）。
# 「Xを触ったらYも触る」を毎回思い出さずに済むよう、パスの見た目から引く。
HINTS = [
    (re.compile(r"(?:^|\.)(?:note|quote)(?:$|\.|\[)"),
     "python3 scripts/verify_quotes.py --backfill && python3 scripts/verify_quotes.py --check",
     "原文引用を足した・変えたなら照合台帳 data/quote-refs.json も動く（R-QUOTE-NO-TYPE / R-QUOTE-GLYPH）"),
    (re.compile(r"(?:^|\.)conflicts(?:$|\.|\[)"),
     "python3 scripts/verify_quotes.py --backfill && python3 scripts/verify_quotes.py --check",
     "conflicts の adopted / alternatives が持つ quote は照合台帳の対象（引用規約の全項が掛かる）。"
     "採用値を訂正したら conflicts[].adopted.value も動く（validate_emperors.py が突合する）"),
    (re.compile(r"[Dd]ate|Year|raw|fromLunar|exactDays|duration"),
     "python3 scripts/verify_calendar.py",
     "日付は隣接フィールドに散る（reigns[].endDate ↔ ages.deathDate ↔ events[].date ↔ note 内の日付引用）。"
     "旧値の文字列でレコード全体を grep して残存参照を列挙する"),
    (re.compile(r"^\w+Count\.events\[\d+\]\.(?:date|startDate|endDate|datePrecision)$"),
     "python3 scripts/verify_calendar.py",
     "**events の日付を新しく確定・訂正したら原表記と換算も同じ要素に残す**（R-EVENT-DATE-RAW）: "
     "`<field>.events[n].startDateRaw`（原典の紀年表記そのまま）と "
     "`<field>.events[n].source.conversion`（`fromLunar(y,m,d[,leap])`。月精度なら朔日アンカー "
     "`fromLunar(y,m,1)`）。これが無いと、保存値が旧暦の月番号の直書きか換算済みかを機械で"
     "区別できない（Issue #56 で24件が誤りだった型）。verify_calendar の B-5 が再演する。"
     "**遡及しない任意欄なので、既存 events に無いことは欠陥ではない**"),
    (re.compile(r"^\w+Count\.events\[\d+\]\.(?:date|startDate|endDate)$"),
     "python3 scripts/screens/date_claim_scope.py",
     "**深さそのものが主張**（年 \"1211\"・月 \"1211-05\"・日 \"1211-05-07\"・R-DATE-CLAIM-SCOPE）で、"
     "月日を書けるのは**在位の境界年**に在る event だけ。境界年の外に月日を書くと "
     "validate_emperors.py が落ちる。その event が data/internal/event-date-archive.json に"
     "在るなら、**アーカイブ側の値も同じタイミングで直すか消す**（配布物の値は退避値の接頭辞）"),
    (re.compile(r"^eraChangeCount\.events\[\d+\]\.eraName"),
     "python3 scripts/verify_quotes.py --check-era-names",
     "元号名は**建てた側**を書く欄（R-CLAIM-GATED・Issue #37 単位2）。"
     "validate_emperors.py の C（同じ event の note に在る）は捨てた側の元号でも通るので、"
     "**建てたことの証人はこのゲートだけ**（本人の原文キャッシュで改元の定型句と隣り合うかを見る）。"
     "底本の字体が hanzi_norm の変換で出てこないときだけ `eraNameRaw` も併記する"),
    (re.compile(r"^name\.(?:ethnicName|personalName)"),
     "python3 scripts/verify_quotes.py --check-ethnic-names",
     "民族名は `name.ethnicName {kind, value}` へ分ける（R-CLAIM-GATED・Issue #37 単位3）。"
     "**括弧つき personalName から分けるときは同じ起動で両方を set する** — 移行前の32件は "
     "data/internal/personal-name-originals.json に凍結してあり、kind が決める並びで"
     "組み直して原文字列に戻ることを validate_emperors.py が見る（**括弧ごと消す形の欠落は"
     "これだけが落とす**）。表示名が変わる政権（遼・元）では name-readings.json・"
     "kana-readings.ts の追記が要る"),
    (re.compile(r"^name\.(?:familyName|personalName)"),
     "python3 scripts/verify_quotes.py --check-family-names",
     "姓は `name.familyName`・諱は `name.personalName` で、**片方だけを直すと連結が"
     "移行前の値に戻らなくなる**（R-CLAIM-GATED・Issue #37 単位6）。365件は "
     "data/internal/family-name-split-originals.json に凍結してあり、"
     "validate_emperors.py::check_family_names が連結して戻ることと政権内で姓が"
     "割れないことを見る。**姓を持たない形（元・北元の12人）は null** で、未記入ではない。"
     "表示名が変わるので site/src/lib/kana-readings.ts・data/name-readings.json も"
     "同じタイミングで（COUPLINGS.md）"),
    (re.compile(r"^name\.courtesyName"),
     "python3 scripts/verify_quotes.py --check-courtesy-names",
     "字は本人の原文で「字〈値〉」と隣り合うことまで見るゲートが要る（R-CLAIM-GATED・"
     "Issue #37 単位4）。**値だけを本文に探す形では実在検査にならず、小字を字の欄へ"
     "入れた取り違えが素通りする**（遼太祖は「字阿保機，小字啜里只」で両方を持つ）。"
     "サイトの名前チップに出るので data/name-readings.json への追記も要る"),
    (re.compile(r"^name\.posthumousNameFull"),
     "python3 scripts/verify_quotes.py --check-posthumous-name-full",
     "諡号の全長形は**名乗る原典の冒頭が掲げる形**（R-CLAIM-GATED・Issue #37 単位1）。"
     "**廟号を頭に付けたまま写す事故**は底本照合では落ちない（本紀冒頭がまさに"
     "「〈廟号〉〈全長諡〉」の並びなので連続で当たってしまう）ので、"
     "validate_emperors.py::check_posthumous_name_full の側が落とす。"
     "短縮呼称 `posthumousName` とは**別の主張**で、両方が入るときは部分列かつ"
     "諡の実字（末尾1字）が一致する。**字体は新字体だが hanzi_norm の差分表に無い字"
     "（`寛`↔`寬`）は底本の字体のまま置く** — 新字体で書くと底本照合が当たらなくなる"),
    (re.compile(r"^name\.childhoodName"),
     "python3 scripts/verify_quotes.py --check-childhood-names",
     "幼名（小字）は本人の原文で「小字〈値〉」と隣り合うことまで見る（R-CLAIM-GATED・"
     "Issue #37 単位5）。**民族名と同じ値でも誤りではない**（金章宗の麻達葛は女真名かつ"
     "小字）ので、validate_emperors.py の分離検査は字の欄と非対称になっている。"
     "サイトの名前チップに出るので data/name-readings.json への追記も要る"),
    # events 要素そのものを足す・置き換えるときだけ（葉の note・date の編集では鳴らさない）
    (re.compile(r"^\w+Count\.events\[\d+\]$"),
     "python3 scripts/migrations/bake_event_ids.py --fill",
     "**events に要素を足したら安定 id を振る**（`<皇帝id>.<容器>.eNNN`）。このツールは値を"
     "作れないので id は空のまま出る。`validate_emperors.py` の `check_event_ids` が落ちる。"
     "要素を**消した**ときは先に外部参照を見る（data/screenings.json の audit.findings[].id・"
     "validate_emperors.py の許可リスト・docs/process/RESIDUAL.md）"),
    (re.compile(r"^reigns|reignSummary"), "python3 scripts/validate_emperors.py",
     "reignSummary は reigns の合計と機械照合される"),
    (re.compile(r"relationToPredecessor|kinship"), "python3 scripts/validate_kinship.py",
     "続柄を変えたら data/kinship.json のエッジも動く"),
    (re.compile(r"^name(?:$|\.)"), "python3 scripts/validate_readings.py",
     "表示名を変えたら site/src/lib/kana-readings.ts の TABLE_SOURCE と data/name-readings.json も直す"
     "（漏れるとサイトのビルドが落ちる）"),
    (re.compile(r"^profile|description|lead"), "python3 scripts/validate_profiles.py",
     "紹介文は add_profile.py 経由が正（このツールの担当外）"),
]
ALWAYS = [
    "python3 scripts/validate_emperors.py",
    "python3 scripts/coverage.py --write",
]


def parse_path(path):
    """'amnestyCount.events[3].note' → ['amnestyCount', 'events', 3, 'note']"""
    steps = []
    for part in path.split("."):
        m = TOKEN.match(part)
        if not m:
            sys.exit(f"パスが読めません: {path}（部分「{part}」）")
        steps.append(m.group(1))
        steps.extend(int(i) for i in re.findall(r"\[(\d+)\]", m.group(2)))
    if not steps:
        sys.exit(f"パスが空です: {path}")
    return steps


def descend(record, steps, path):
    """末尾の1歩手前まで降りる。**中間は作らない**（無ければ落ちる）。"""
    cur = record
    for i, step in enumerate(steps[:-1]):
        walked = "".join(f"[{s}]" if isinstance(s, int) else f".{s}" for s in steps[:i + 1])
        here = f"{path}（{walked.lstrip('.')} まで）"
        if isinstance(step, int):
            if not isinstance(cur, list):
                sys.exit(f"{here}: 添字を付けましたが配列ではありません")
            if step >= len(cur):
                sys.exit(f"{here}: 要素がありません（長さ {len(cur)}）。"
                         "配列を伸ばすのは転記ではないので、このツールは足しません")
            cur = cur[step]
        else:
            if not isinstance(cur, dict):
                sys.exit(f"{here}: オブジェクトではありません")
            if step not in cur:
                sys.exit(f"{here}: 入れ物がありません。**中間コンテナは作りません** — "
                         "構造を決めるのは判定なので、先にスキーマ側で形を決めてください")
            cur = cur[step]
    return cur


def show(value):
    s = json.dumps(value, ensure_ascii=False)
    return s if len(s) <= 300 else s[:297] + "…"


def apply_ops(record, sets, unsets, appends, allow_new_key=False):
    """変更を当てて [(パス, 前, 後)] を返す。値は入力のものをそのまま置くだけ。"""
    changes = []
    for path, value in sets:
        steps = parse_path(path)
        parent, leaf = descend(record, steps, path), steps[-1]
        if isinstance(leaf, int):
            if not isinstance(parent, list):
                sys.exit(f"{path}: 添字を付けましたが配列ではありません")
            if leaf >= len(parent):
                sys.exit(f"{path}: 要素がありません（長さ {len(parent)}）")
            before = parent[leaf]
        else:
            if not isinstance(parent, dict):
                sys.exit(f"{path}: 親がオブジェクトではありません")
            if leaf not in parent and not allow_new_key:
                sys.exit(f"{path}: そのキーはまだありません。**綴りの間違い**なら、値は誰も読まない"
                         f"場所へ入ります（隣: {'・'.join(list(parent)[:8]) or '（空）'}）。"
                         "本当に新しい欄を足すなら --allow-new-key を付けてください")
            before = parent.get(leaf, NEW_KEY)
        parent[leaf] = value
        changes.append((path, before, value))

    for path in unsets:
        steps = parse_path(path)
        parent, leaf = descend(record, steps, path), steps[-1]
        if isinstance(leaf, int):
            sys.exit(f"{path}: 配列要素の削除はしません（他の添字が全部ずれるため）")
        if not isinstance(parent, dict) or leaf not in parent:
            sys.exit(f"{path}: 消す対象がありません")
        changes.append((path, parent.pop(leaf), "(削除)"))

    for path, value in appends:
        steps = parse_path(path)
        parent, leaf = descend(record, steps, path), steps[-1]
        if isinstance(leaf, int):
            if not isinstance(parent, list) or leaf >= len(parent):
                sys.exit(f"{path}: 要素がありません")
        elif not isinstance(parent, dict) or leaf not in parent:
            sys.exit(f"{path}: 配列がありません（--append は既存配列の末尾に1件足すだけ）")
        target = parent[leaf]
        if not isinstance(target, list):
            sys.exit(f"{path}: 配列ではありません（--append は既存配列の末尾に1件足すだけ）")
        target.append(value)
        changes.append((f"{path}[{len(target) - 1}]", "(新規)", value))
    return changes


def gates_for(paths):
    need, couplings = list(ALWAYS), []
    for pattern, gate, coupling in HINTS:
        if any(pattern.search(p) for p in paths):
            if gate not in need:
                need.append(gate)
            couplings.append(coupling)
    return need, couplings


def main():
    ap = argparse.ArgumentParser(
        description="確定済みの値を data/emperors.json の1レコードへ書き写す（値は作らない）")
    ap.add_argument("emperor_id", help="対象の皇帝 id。**1回の起動で1人だけ**")
    ap.add_argument("--set", action="append", default=[], metavar="パス=JSON値",
                    help="値を置く。右辺は JSON（文字列は \" で囲む）")
    ap.add_argument("--set-str", action="append", default=[], metavar="パス=文字列",
                    help="値を置く。右辺をそのまま文字列として扱う（引用の多い note 向け）")
    ap.add_argument("--unset", action="append", default=[], metavar="パス", help="キーを消す")
    ap.add_argument("--append", action="append", default=[], metavar="配列パス=JSON値",
                    help="既存配列の末尾に1件足す")
    ap.add_argument("--from-json", metavar="ファイル|-",
                    help='{"set": {...}, "unset": [...], "append": {...}} の形')
    ap.add_argument("--allow-new-key", action="store_true",
                    help="まだ無いキーを新設することを明示する（既定では綴り間違いとして落ちる）")
    ap.add_argument("--dry-run", action="store_true", help="差分だけ出して書かない")
    args = ap.parse_args()

    def split(spec, raw_string):
        if "=" not in spec:
            sys.exit(f"`パス=値` の形で書いてください: {spec}")
        path, _, value = spec.partition("=")
        if raw_string:
            return path.strip(), value
        try:
            return path.strip(), json.loads(value)
        except json.JSONDecodeError as exc:
            sys.exit(f"{path.strip()}: 右辺が JSON として読めません（{exc}）。"
                     "文字列をそのまま置きたいなら --set-str を使ってください")

    sets = [split(s, False) for s in args.set] + [split(s, True) for s in args.set_str]
    unsets = list(args.unset)
    appends = [split(s, False) for s in args.append]
    if args.from_json:
        src = sys.stdin.read() if args.from_json == "-" else Path(args.from_json).read_text("utf-8")
        spec = json.loads(src)
        if not isinstance(spec, dict) or set(spec) - {"set", "unset", "append"}:
            sys.exit("--from-json は set / unset / append の3キーだけを持つオブジェクトです")
        sets += list((spec.get("set") or {}).items())
        unsets += list(spec.get("unset") or [])
        appends += list((spec.get("append") or {}).items())
    if not (sets or unsets or appends):
        sys.exit("変更が1件もありません")

    raw = DATA.read_text(encoding="utf-8")
    before_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    data = json.loads(raw)

    # 書き出しはファイル全体の再直列化になる。整形が既定（indent=1）と違うと、
    # 触っていない 364人ぶんが差分に出て他セッションのレビューを潰す。先に気づく。
    if json.dumps(data, ensure_ascii=False, indent=1) + "\n" != raw:
        print("警告: data/emperors.json の整形が既定（ensure_ascii=False, indent=1）と違います。"
              "このまま書くと触っていない箇所まで差分に出ます。整形を戻してから実行してください",
              file=sys.stderr)

    matches = [e for e in data["emperors"] if e.get("id") == args.emperor_id]
    if len(matches) != 1:
        sys.exit(f"id「{args.emperor_id}」のレコードが {len(matches)} 件です（1件でないと触りません）")
    record = matches[0]

    changes = apply_ops(record, sets, unsets, appends, args.allow_new_key)

    print(f"■ {args.emperor_id} — {len(changes)} 件")
    for path, before, after in changes:
        print(f"  {path}\n    - {show(before)}\n    + {show(after)}")

    need, couplings = gates_for([p for p, _, _ in changes])
    print("\n■ このパスが要求するゲート（コミット条件）")
    for g in need:
        print(f"  {g}")
    if couplings:
        print("\n■ 一緒に触るもの（docs/process/COUPLINGS.md）")
        for c in couplings:
            print(f"  - {c}")

    if args.dry_run:
        print("\n--dry-run のため書き込んでいません")
        return 0

    # 並行セッションが同じファイルを編集していないか、書く直前にもう一度見る。
    if hashlib.sha256(DATA.read_bytes()).hexdigest() != before_hash:
        sys.exit("\n読み込みから書き込みまでの間に data/emperors.json が変わりました"
                 "（別セッションの編集）。書かずに終わります。もう一度実行してください")
    out = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
    tmp = DATA.with_suffix(".json.tmp")
    tmp.write_text(out, encoding="utf-8")
    os.replace(tmp, DATA)
    print(f"\n書き込みました: {DATA.relative_to(ROOT)}")
    print("上のゲートを通してからコミットしてください（R-GATES-BEFORE-COMMIT）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
