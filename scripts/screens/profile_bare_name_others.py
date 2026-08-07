#!/usr/bin/env python3
"""紹介文が**本人以外**を諱1字で指している箇所を数える（GitHub Issue #16）。

2026-08-07 に本人の呼び方を通用名へそろえた（`scripts/fix_profile_bare_name.py`）が、
ゲート（`check_profile_fragment.py`・`validate_profiles.py`）が見るのは**その本の
主人公だけ**で、本文に出る第三者は見ていない。ユーザーの指示は「紹介文の人物名は」で
あって主人公に限っていないので、ここが残る。

数えられるのは**皇帝365人のうち、その本に姓＋諱形も出ている人物**だけ。皇帝でない
人物（尹緯・卞荘・王衍…）は姓と諱の対を持つ台帳が無いので数えられない。

**機械では直せない。** 1字の諱が一般語と衝突する率が本人のときより高く（劉和の「和」が
「和を通じ」に当たる形）、しかも本人と違って「その1字が本当にその人物を指すか」を
名乗りの形から決められない。ここは原文と本文を並べて人が読む。

    python3 scripts/screens/profile_bare_name_others.py
    python3 scripts/screens/profile_bare_name_others.py --for houyan-murongbao
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import profile_name  # noqa: E402
import profile_prose  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent.parent
PROFILES = ROOT / "data" / "emperor-profiles.json"


def main() -> int:
    ap = argparse.ArgumentParser(description="本人以外を諱1字で指している箇所")
    ap.add_argument("--for", dest="only", help="皇帝id 1人だけ")
    ap.add_argument("--context", action="store_true", help="前後の文脈も出す")
    args = ap.parse_args()

    emperors = profile_name.load_emperors()
    readings = profile_name.load_readings()
    profiles = json.loads(PROFILES.read_text(encoding="utf-8"))["profiles"]

    books = 0
    total = 0
    rows = []
    for emperor_id, profile in profiles.items():
        if args.only and emperor_id != args.only:
            continue
        text = profile_prose.strip_ruby(
            f"{profile.get('lead') or ''}\n{profile.get('body') or ''}"
        )
        found = []
        for other_id, other in emperors.items():
            if other_id == emperor_id:
                continue
            resolved = profile_name.resolve(other, readings)
            # その本に姓＋諱形が出ている人物だけ数える。出ていなければ、その1字は
            # 別人か一般語のことが多い（母集団を絞るだけで、取りこぼし率は未測定）。
            if len(resolved["plain"]) < 2 or resolved["plain"] not in text:
                continue
            hits = profile_name.bare_hits(text, other, resolved)
            if hits:
                found.append((resolved["annotated"], other["name"]["personalName"], hits))
        if found:
            books += 1
            n = sum(len(h) for _, _, h in found)
            total += n
            rows.append((emperor_id, n, found))

    for emperor_id, n, found in sorted(rows, key=lambda r: -r[1]):
        print(f"{emperor_id:28s} {n:3d}件  "
              + "／".join(f"{p}→{v} {len(h)}" for p, v, h in found))
        if args.context:
            for _, _, hits in found:
                for h in hits:
                    print(f"      …{h}…")
    print(f"\n{books}本 / 延べ{total}件（皇帝365人のうち、その本に姓＋諱形も出ている人物だけ。"
          "皇帝でない人物は数えられない）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
