#!/usr/bin/env python3
"""紹介文の「読みやすさ」を機械で見る部分（GitHub Issue #16）。

check_profile_fragment.py（断片・執筆中）と validate_readings.py（本体・CI）の**両方**が
ここを呼ぶ。片方だけ直さないこと。見るのは次の3つで、いずれも 2026-08-05 に
ユーザーの指摘（始皇帝・恵帝の本文）から足した。

1. **辞書のルビ漏れ** — data/profile-ruby-lexicon.json に載る語が本文にルビ無しで
   現れたら落とす。「邯鄲」「仲父」「長信侯」「鴆」「丙寅」のような中国史特有の語に
   ルビが無い状態が実際に配信されていた。
2. **2回目以降のルビ漏れ** — 同じ本の中で1度でもルビを振った語は、**その本の中の
   全出現に振る**。実測では18本で143語・延べ305回が初出だけの状態だった
   （「挟書律」は lead に振って body で素通り、「邯鄲」は始皇帝の本文に4回出て1回も無い）。
   辞書に無い語でもこちらで捕まる。**辞書はこの検査の「本をまたぐ版」**。
3. **漢文訓読調** — 「没した」「崩じた」「尊んだ」「併せた」「監させた」のような、
   原文の言い回しを訓読しただけの語を落とす。規範7節は 2026-08-04 から「没する」を
   名指しで禁じていたが、**文言だけでは止まらず**18本に54箇所残っていた。

**カギ括弧の中は3の対象外**（『漢書』が「薨」とだけ書く、のように史書の語そのものを
話題にしている箇所を落とさないため）。1・2はカギ括弧の中も対象（読めない字は
引用の中でも読めない）。

どの語が難読かは機械では決まらない、というのは今も変わらない。**決まるのは
「辞書に載せた語」と「同じ本の中で振り方が揃っているか」だけ**で、辞書に無い語の
振り漏れは人が見る。辞書は書くたびに育てる（meta.growth）。
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEXICON = ROOT / "data" / "profile-ruby-lexicon.json"

# site/src/lib/ruby.ts の RUBY_PATTERN と同じもの。片方だけ変えないこと。
RUBY = re.compile(r"｜([^｜《》]+)《([^｜《》]+)》")
# 史書の語そのものを話題にしている箇所（「薨」とだけ書く）。訓読調の検査から外す。
QUOTED = re.compile(r"[「『][^」』]*[」』]")

# 漢文訓読調 → 言い換え。**明白なものだけ**を落とす（「即位」「封じる」「詔」は
# 歴史用語として要るので入れない）。増やすときは、既存の紹介文に当ててから足す。
#
# **「没した」は入れない**（2026-08-05 ユーザー指摘）。現代の日本語でも広く通用する。
# 訓読調かどうかは「原文の語を訓読でそのまま持ってきたか」で見て、**見慣れない語かどうかで
# 決めない**。
ARCHAIC: list[tuple[str, str]] = [
    ("崩じ", "「死んだ」"),
    ("薨じ", "「死んだ」"),
    ("身罷", "「死んだ」"),
    ("尊ん", "「皇太后とした」「皇太后の位に就けた」"),
    ("尊び", "「皇太后とした」"),
    ("尊ぶ", "「皇太后とする」"),
    ("併せ", "「併合した」「滅ぼして統一した」"),
    ("監さ", "「監督させた」「目付として付けた」"),
    ("せしむ", "現代語の使役（「〜させた」）"),
    ("せしめ", "現代語の使役（「〜させた」）"),
    ("可とし", "「認めた」「許可した」"),
    ("可とす", "「認める」"),
    ("徙し", "「移した」"),
    ("徙す", "「移す」"),
    ("誅し", "「処刑した」"),
    ("誅す", "「処刑する」"),
    ("賜り", "「与えられた」（主語を立てて「〜を与えた」に直す）"),
    ("賜っ", "「与えた」"),
    ("賜わ", "「与えた」"),
    ("賜う", "「与える」"),
    ("奉じ", "「差し出した」「ささげた」"),
    ("請う", "「願い出た」"),
    ("請い", "「願い出て」"),
    ("嗣い", "「継いだ」"),
    ("嗣ぐ", "「継ぐ」"),
    ("践祚", "「即位」"),
]

# 上の語を含んでしまう普通の日本語。数えるときに差し引く（「見せしめ」で実際に誤爆した）。
NOT_ARCHAIC: dict[str, tuple[str, ...]] = {
    "せしめ": ("見せしめ",),
}

# 辞書の語を**含んでしまう普通の日本語**。ルビの検査より先に伏せる。
#
# 1字の人名断片（「楊広」の「広」・「陳叔宝」の「陳」）を辞書に載せた副作用で、
# 「広い」「陳列」のような一般語まで当たる。**人名として使われているかは機械では
# 決まらない**ので、当たってしまう一般語をここへ足していく（見つけ次第・運用で育てる）。
# 固有名詞のほうは辞書へ長い語として載せれば勝つ（長い語から当てる）ので、ここには要らない。
NOT_TERMS: tuple[str, ...] = (
    "広い", "広く", "広が", "広げ", "広ま", "広め", "広大", "広範", "広場", "幅広",
    "陳列", "陳述", "陳謝", "陳情", "陳腐",
    "憲法", "官憲", "立憲",
    "湛え",
    "戯れ", "悪戯",
    "沛然",
    "妍を",
)


def load_lexicon() -> dict[str, list[str]]:
    """{平文: [ルビ記法の候補, ...]}。値が文字列なら1件の配列に均す。"""
    raw = json.loads(LEXICON.read_text(encoding="utf-8"))["terms"]
    out: dict[str, list[str]] = {}
    for plain, annotated in raw.items():
        out[plain] = [annotated] if isinstance(annotated, str) else list(annotated)
    return out


def strip_ruby(text: str) -> str:
    return RUBY.sub(r"\1", text)


def outside_ruby(text: str) -> str:
    """ルビ注釈を**まるごと**取り除いた残り。

    親文字ごと落とすのが要点で、strip_ruby（親文字を残す）とは別物。
    「｜鴆《ちん》」を残すと辞書の「鴆」が自分自身に当たってしまう。
    """
    return RUBY.sub("", text)


def mask_not_terms(text: str) -> str:
    """一般語（NOT_TERMS）を伏せる。**辞書の語を当てる前に必ず通す。**"""
    for word in NOT_TERMS:
        if word in text:
            text = text.replace(word, "\x02" * len(word))
    return text


def missing_ruby(text: str, lexicon: dict[str, list[str]]) -> list[tuple[str, int, str]]:
    """ルビを振るべき語がルビ無しで出ている箇所。→ [(語, 回数, 直し方)]

    対象は2種類を合わせたもの:
    - 辞書に載る語（本をまたぐ）
    - **この本文の中で1度でもルビを振った語**（初出だけにしない）
    """
    rest = mask_not_terms(outside_ruby(text))
    required: dict[str, str] = {}
    for parent, _reading in RUBY.findall(text):
        # 本文で実際に振った形をそのまま正解として使う（読みの正しさは
        # name-readings.json との照合が別に見ている）。
        required[parent] = next(
            m.group(0) for m in RUBY.finditer(text) if m.group(1) == parent
        )
    for plain, candidates in lexicon.items():
        required.setdefault(plain, "／".join(candidates))

    # 長い語から数え、数えた箇所は伏せる（「長信侯」を数えたあとに「長信侯」の中の
    # 「侯」を二重に数えない。辞書に短い語が入っていても部分一致で暴発しない）。
    hits: list[tuple[str, int, str]] = []
    for plain in sorted(required, key=len, reverse=True):
        n = rest.count(plain)
        if n:
            hits.append((plain, n, required[plain]))
            rest = rest.replace(plain, "\x00" * len(plain))
    return sorted(hits, key=lambda h: -h[1])


def archaic_hits(text: str) -> list[tuple[str, int, str]]:
    """漢文訓読調の語。→ [(語, 回数, 言い換え)]。カギ括弧の中は数えない。"""
    plain = QUOTED.sub("", strip_ruby(text))
    hits = []
    for word, how in ARCHAIC:
        n = plain.count(word) - sum(plain.count(x) for x in NOT_ARCHAIC.get(word, ()))
        if n > 0:
            hits.append((word, n, how))
    return hits
