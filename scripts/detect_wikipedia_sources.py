"""data/emperors.json 内の source.page がWikipedia/百度など二次情報源のまま
残っていないかを検出する。task.md 3-1（Wikipedia出典の一掃）フェーズAで作成、
3-3（CI出典QA）の禁止語チェックの種として利用する想定。

判定方法: source.page に正史書名・巻/紀/伝等のキーワードが含まれず、かつ
維基/百度/Wikipedia等の明示的マーカーを含む、または lang が ja/zh のまま
書名キーワードを一切含まない場合を「要差し替え」とみなす。

「近現代の学術的に信頼できる複数情報源（正史範囲外）」のような、正史範囲外で
あることを明示した代替表記は誤検知として除外しない設計だが、意図的な表記
（中華帝国など正史に記述がない近現代人物）は目視で個別判断すること。

対象フィールド: deathCause.source / accessionRoute.source /
reigns[].duration.source / events[].source（改元・大赦・立后・皇太子廃立）
"""
import json
import re
import sys
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "emperors.json"

HISTORY_KEYWORDS = [
    "史記", "史记", "漢書", "汉书", "後漢書", "后汉书", "三國志", "三国志",
    "晉書", "晋书", "晋書", "宋書", "宋书", "南齊書", "南齐书", "梁書", "梁书",
    "陳書", "陈书", "魏書", "魏书", "北齊書", "北齐书", "北斉書", "周書", "周书",
    "隋書", "隋书", "南史", "北史", "旧唐書", "舊唐書", "旧唐书", "新唐書", "新唐书",
    "旧五代史", "舊五代史", "新五代史", "宋史", "遼史", "辽史", "金史",
    "元史", "新元史", "明史", "清史稿", "資治通鑑", "资治通鉴",
    "十国春秋", "十國春秋", "十六国春秋", "十六國春秋", "西夏書事", "西夏书事", "小腆紀傳", "小腆纪传",
    "華陽國志", "華陽国志", "华阳国志",
    "本紀", "本纪", "帝紀", "帝纪", "列伝", "列傳", "列传", "世家",
    "載記", "载记", "實錄", "实録", "実録", "墓志",
]

WIKI_MARKERS = ["維基", "百度", "Wikipedia", "wikipedia"]

# 正史に記述が存在しないことを明示した代替表記。これらは差し替え不要（＝合格）
OUT_OF_SCOPE_MARKERS = [
    "正史範囲外",
    "一次史料に日付記述なし",
]


# 正史ではないが一次〜準一次の学術的典拠として個別確認済みの page（完全一致で許容）
ALLOWLIST_PAGES = {
    # 元代の仏教史書。宋恭帝の死を伝える現存最古級の記録（宋史・元史に記述なし）
    "佛祖歴代通載（元代仏教史書、至治三年条）",
    # 元末群雄。正史に改元記事がなく、明代の考証書・史料集で補う
    "历代建元考（天完）条；国初群雄事略 巻三「天完徐寿辉」（『平胡録』引用部）",
    # 満洲国期（正史範囲外）。一次史料である政府公報・詔書に拠る
    "満洲国皇帝即位詔書（1934年3月1日発布、石印本）／『満洲国政府公報日訳』康徳元年三月分（JACAR Ref.A06031010800）",
    "『満洲国政府公報日訳』康徳元年三月分（第1号～第22号）JACAR Ref.A06031010800",
    # 中華帝国・袁世凱（正史範囲外の近現代人物）。accessionRoute の意図的表記
    "近現代の学術的に信頼できる複数情報源",
}


def is_history_page(page: str) -> bool:
    return any(k in page for k in HISTORY_KEYWORDS)


def is_out_of_scope(page: str) -> bool:
    return any(k in page for k in OUT_OF_SCOPE_MARKERS)


def is_wiki_like(source: dict) -> bool:
    """正史書名でも「正史範囲外」明示でもない page を要差し替えとみなす。

    lang による判定は行わない（`ja/zh` のような複合値や `baike` を取りこぼし、
    B-5 / task.md 3-3 の完了判定が実態より甘くなるため）。判定対象は `page` のみで、
    将来 `secondary`（補助典拠）キーを追加しても検出が緑のままにならないようにする。
    """
    page = source.get("page", "")
    if is_history_page(page):
        return False
    if is_out_of_scope(page):
        return False
    if page in ALLOWLIST_PAGES:
        return False
    return True


def collect_hits(data: dict):
    hits = []
    for e in data["emperors"]:
        eid = e["id"]
        dc = e.get("deathCause", {}).get("source")
        if dc and is_wiki_like(dc):
            hits.append(("deathCause", eid, dc))
        ar = e.get("accessionRoute", {}).get("source")
        if ar and is_wiki_like(ar):
            hits.append(("accessionRoute", eid, ar))
        for i, r in enumerate(e.get("reigns", [])):
            src = r.get("duration", {}).get("source")
            if src and is_wiki_like(src):
                hits.append((f"reigns[{i}].duration", eid, src))
        # 注意: 実データのキー名は empressInstallationCount / crownPrinceDepositionCount
        # （旧名 empressEstablishCount / crownPrinceDeposalCount は存在せず全件スキップされていた）
        for group_key in ("eraChangeCount", "amnestyCount", "empressInstallationCount", "crownPrinceDepositionCount"):
            group = e.get(group_key)
            if not group:
                continue
            for i, ev in enumerate(group.get("events", [])):
                src = ev.get("source")
                if src and is_wiki_like(src):
                    hits.append((f"{group_key}.events[{i}]", eid, src))
    return hits


def main():
    with open(DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)

    hits = collect_hits(data)
    by_field = {}
    for field, eid, src in hits:
        by_field.setdefault(field.split("[")[0], []).append((eid, src["page"]))

    if not hits:
        print("Wikipedia/百度等の出典は見つかりませんでした。")
        return 0

    print(f"{len(hits)} 件の要確認出典:")
    for field, eid, src in hits:
        print(f"  [{field}] {eid}: {src['page']!r} (lang={src.get('lang')})")
    return 1


if __name__ == "__main__":
    sys.exit(main())
