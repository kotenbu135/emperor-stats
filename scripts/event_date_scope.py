#!/usr/bin/env python3
"""events の日付について「配布物が何を主張しているか」を決める1つの実装（Issue #69）。

2026-08-03 のユーザー決定:

  **`data/emperors.json` が主張する events の日付は「年精度 ＋ 在位境界年の月日」だけ。**
  それ以外の月日は年へ丸め、丸める前の値を `data/internal/event-date-archive.json` へ
  退避する（値は消さない・内部側はこれ以上精度を追求しない）。あわせて**埋め草を廃止**し、
  **保存値の深さそのものを主張**にする（年 `"1211"`・月 `"1211-05"`・日 `"1211-05-07"`）。

**この判定を2箇所に書かない。** 境界年の判定は移行スクリプト・バリデータ・`verify_calendar`・
絞り込みの4箇所から呼ばれる。BCE では `reigns[].startYear`（歴史年）と `startDate` の年
（天文年）が1年ずれるので、片方だけ実装がずれると「移行では丸めたのにゲートが違反と言う」が
起きる。#69 のコメントで公開した定義（**両方を union し、片端でも境界年なら event 全体が
境界年**）をここに1つだけ置き、全員が import する。
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE_PATH = ROOT / "data" / "internal" / "event-date-archive.json"

# events を持つ回数系フィールド（8指標）。データ側の実在キーと突き合わせるのは
# assert_count_groups()（絞り込みスクリプトが存在しない容器名を持ったまま黙って
# 母集団から落としていた事故が 2026-08-03 にあった＝ crownPrinceChangeCount）。
COUNT_GROUPS = [
    "eraChangeCount", "amnestyCount", "empressInstallationCount",
    "crownPrinceDepositionCount", "personalCampaignCount", "rebellionSuppressionCount",
    "rebellionSufferedCount", "capitalRelocationCount",
]

DATE_KEYS = ("date", "startDate", "endDate")
PRECISION_DEPTH = {"year": 1, "month": 2, "day": 3}
YEAR_HEAD = re.compile(r"^(-?\d{4})")


def assert_count_groups(data) -> None:
    """データに実在する events 容器と COUNT_GROUPS が一致することを確かめる。"""
    live = set()
    for e in data["emperors"]:
        for k, v in e.items():
            if k.endswith("Count") and isinstance(v, dict) and "events" in v:
                live.add(k)
    if live != set(COUNT_GROUPS):
        raise SystemExit(
            f"COUNT_GROUPS がデータと食い違います: "
            f"データにのみ {sorted(live - set(COUNT_GROUPS))} / "
            f"定数にのみ {sorted(set(COUNT_GROUPS) - live)}")


def year_of(value) -> int | None:
    """ISO 日付の年（天文年）。深さが1でも読める。"""
    if not isinstance(value, str):
        return None
    m = YEAR_HEAD.match(value)
    return int(m.group(1)) if m else None


def depth_of(value) -> int:
    """保存値の深さ（1=年・2=月・3=日）。**これが配布物の主張する粒度**。"""
    return len(str(value).lstrip("-").split("-"))


def precision_of(ev, key: str):
    """`datePrecision` は文字列と {start,end} の2形式がある。"""
    p = ev.get("datePrecision")
    if isinstance(p, dict):
        return p.get("end" if key == "endDate" else "start")
    return p


def boundary_years(emperor) -> set[int]:
    """在位の境界年。**歴史年（startYear/endYear）と天文年（startDate/endDate）の union。**

    BCE では両者が1年ずれる。どちらかに寄せると「即位の年の月日」が定義しだいで
    主張の内外に動くので、広い側（union）を採る — 主張を絞る移行で、絞りすぎて
    確かな月日まで落とすほうが取り返しがつかない。
    """
    years = set()
    for r in emperor.get("reigns") or []:
        for k in ("startYear", "endYear"):
            v = r.get(k)
            if isinstance(v, int):
                years.add(v)
        for k in ("startDate", "endDate"):
            y = year_of(r.get(k))
            if y is not None:
                years.add(y)
    return years


def event_years(ev) -> set[int]:
    return {y for y in (year_of(ev.get(k)) for k in DATE_KEYS) if y is not None}


def is_boundary_event(years: set[int], ev) -> bool:
    """**片端でも境界年なら event 全体が境界年**（年をまたぐ event を割らない）。"""
    return bool(event_years(ev) & years)


def iter_events(data):
    """(emperor, group, index, event) を順に返す。走査順は全スクリプトで共通。"""
    for e in data["emperors"]:
        for g in COUNT_GROUPS:
            o = e.get(g)
            if not isinstance(o, dict):
                continue
            for i, ev in enumerate(o.get("events") or []):
                if isinstance(ev, dict):
                    yield e, g, i, ev


def claimed_depth(ev, key: str, years: set[int]) -> int:
    """移行後にその値が持つべき深さ。

    1. `datePrecision` を超える深さは持たない（埋め草の廃止）
    2. 境界年でない event は年だけを主張する
    """
    if not is_boundary_event(years, ev):
        return 1
    return PRECISION_DEPTH.get(precision_of(ev, key), 1)


def legacy_index(event_id: str) -> int:
    """凍結した標本を引くための「移行前の添字」を **id の連番から**復元する。

    連番は 2026-08-03 の移行で添字順に1始まりで焼いたので、移行時に在った event は
    `連番 - 1` が移行前の添字にそのまま一致する。**絞り込みスクリプトが live な
    `enumerate` の添字を鍵に使ってはいけない** — 既存 event の前に1件挿入した瞬間に
    後続の鍵が全部ずれ、`audit.sampleKey: "legacy-index"` の凍結が破れて抽選が
    引き直しになり、積み上げた原典監査が標本の外へ落ちる（2026-08-03・Issue #59 で
    `hou-han-shundi.amnestyCount` に2件挿入して実際に起きた。CI が「e002 が未監査／
    e003 は標本に無い」で落ちた）。移行後に足した event は連番が最大値より大きく、
    移行前には無かった位置を指す＝新しい鍵になるのが正しい。
    """
    return int(event_id.rsplit(".e", 1)[1]) - 1


def truncate(value: str, depth: int) -> str:
    """ISO 日付を深さ分だけ残して切り詰める（負年の先頭 `-` は年の一部）。"""
    neg = value.startswith("-")
    parts = value.lstrip("-").split("-")
    return ("-" if neg else "") + "-".join(parts[:depth])


def load_archive(path: Path = ARCHIVE_PATH) -> dict:
    """退避した月日。**読むだけ**（追記する経路は作らない＝ #69 の 2-2）。"""
    if not path.exists():
        return {}
    doc = json.loads(path.read_text(encoding="utf-8"))
    return doc.get("events") or {}


def recorded_dates(ev, archive: dict) -> dict:
    """**記録された**日付（丸める前）。絞り込みスクリプトはこちらを見る。

    配布物が主張するのは丸めた後の値だが、干支照合や親征の期間のような
    「読んだ形跡に対する検出器」は、退避した値を含む記録全体を母集団にする。
    そうしないと 2026-08-03 の移行を挟んだだけで母集団が半減し、原典を読んで
    積み上げた標本監査が「標本の外」へ落ちる。
    """
    saved = archive.get(ev.get("id") or "") or {}
    return {k: (saved.get(k) or ev.get(k)) for k in DATE_KEYS}
