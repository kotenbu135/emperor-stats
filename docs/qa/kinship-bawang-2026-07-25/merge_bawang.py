#!/usr/bin/env python3
"""西晋八王（趙王倫を除く7王）＋接続ブリッジ6人を data/kinship.json へマージする。

調査結果は本ファイルに手で書き下ろした確定値（原典＝晋書 巻一 宣帝紀・巻五 孝懐帝紀・
巻四 恵帝紀・巻三十七 列伝第七 宗室伝・巻三十八 列伝第八 宣五王／文六王・
巻五十九 列伝第二十九 八王伝）。スクリプトは id キーの read-modify-write に徹する。
"""
import json
import sys
from pathlib import Path

PATH = Path(sys.argv[1] if len(sys.argv) > 1 else "data/kinship.json")

SRC59 = lambda who: {"page": f"晋書 巻五十九 列伝第二十九 {who}", "lang": "zh-classical"}
SRC37 = lambda who: {"page": f"晋書 巻三十七 列伝第七 宗室伝（{who}）", "lang": "zh-classical"}
SRC38W = {"page": "晋書 巻三十八 列伝第八 文六王（斉献王攸）", "lang": "zh-classical"}
SRC38X = {"page": "晋書 巻三十八 列伝第八 宣五王", "lang": "zh-classical"}
SRC01 = {"page": "晋書 巻一 宣帝紀", "lang": "zh-classical"}

PERSONS = [
    {
        "id": "p-sima-fang", "name": "司馬防", "kana": "しばぼう",
        "aliases": ["舞陽成侯"], "kind": "宗室", "gender": "male", "section": "晋",
        "birthYear": None, "deathYear": None, "yearsApproximate": False,
        "inclusionReason": ["経路上"],
        "note": "後漢の京兆尹。司馬懿（宣帝）・司馬孚（安平献王）・司馬馗（東武城侯）らの父で、晋書宣帝紀に「俊生京兆尹防，字建公。帝即防之第二子也。」とある。魏の時代に「三年春，天子追封，谥皇考京兆尹为舞阳成侯。」と追封された。八王のうち河間王顒（孚の孫）・東海王越（馗の孫）は司馬懿の子孫ではなく傍系のため、両者を司馬氏本宗へ接続する結節点としてノード化した（収録基準5の接続経路）。生没年は晋書に記載がない。",
        "wikidata": "Q912095", "source": SRC01,
    },
    {
        "id": "p-sima-fu", "name": "司馬孚", "kana": "しばふ",
        "aliases": ["安平献王"], "kind": "宗室", "gender": "male", "section": "晋",
        "birthYear": 180, "deathYear": 272, "yearsApproximate": False,
        "inclusionReason": ["経路上"],
        "note": "「安平献王孚，字叔达，宣帝次弟也。」（司馬懿の弟）。兄弟8人が「八达」と称された（「初，孚长兄朗字伯达，宣帝字仲达，孚弟馗字季达，恂字显达，进字惠达，通字雅达，敏字幼达，俱知名，故时号为“八达”焉。」）。魏晋革命期に一貫して魏室への礼を保った長老で、「泰始八年薨，时年九十三。」より没272年・生年は数え93からの逆算で180年。九子（「九子：邕、望、辅、翼、晃、瑰、珪、衡、景。」）のうち第六子の太原烈王瑰の子が八王の一人・河間王顒。",
        "wikidata": "Q1156935", "source": SRC37("安平献王孚"),
    },
    {
        "id": "p-sima-kui", "name": "司馬馗", "kana": "しばき",
        "aliases": ["東武城侯"], "kind": "宗室", "gender": "male", "section": "晋",
        "birthYear": None, "deathYear": None, "yearsApproximate": False,
        "inclusionReason": ["経路上"],
        "note": "司馬懿の弟（字は季達、八達の一人）。晋書宗室伝の彭城穆王権の条に「彭城穆王权，字子舆，宣帝弟魏鲁相东武城侯馗之子也。」とあり、魏の魯相・東武城侯。子の高密文献王泰の次子が八王の一人・東海王越。生没年は晋書に記載がない。",
        "wikidata": "Q10916678", "source": SRC37("彭城穆王権"),
    },
    {
        "id": "p-sima-gui", "name": "司馬瓌", "kana": "しばかい",
        "aliases": ["太原烈王", "司馬瑰"], "kind": "宗室", "gender": "male", "section": "晋",
        "birthYear": None, "deathYear": 274, "yearsApproximate": False,
        "inclusionReason": ["経路上"],
        "note": "「太原烈王瑰，字子泉，魏长乐亭侯，改封贵寿乡侯。」。司馬孚の第六子（宗室伝の「九子：邕、望、辅、翼、晃、瑰、珪、衡、景。」の列挙順による）。武帝の受禅で太原王に封ぜられ、泰始「十年薨」（274年）。「子颙立，徙封河间王，别有传。」とあり、子が八王の一人・河間王顒。生年は晋書に記載がない。",
        "wikidata": "Q10916646", "source": SRC37("太原烈王瑰"),
    },
    {
        "id": "p-sima-tai", "name": "司馬泰", "kana": "しばたい",
        "aliases": ["高密文献王", "隴西王"], "kind": "宗室", "gender": "male", "section": "晋",
        "birthYear": None, "deathYear": 299, "yearsApproximate": False,
        "inclusionReason": ["経路上"],
        "note": "「高密文献王泰，字子舒，彭城穆王权之弟，魏阳亭侯，补阳翟令，迁扶风太守。」。司馬馗の子で、武帝の受禅により隴西王、のち楚王瑋の誅殺後に録尚書事となり高密王へ改封。「元康九年薨，追赠太傅。」（299年）。次子が八王の一人・東海王越。生年は晋書に記載がない。",
        "wikidata": "Q10916637", "source": SRC37("高密文献王泰"),
    },
    {
        "id": "p-sima-you", "name": "司馬攸", "kana": "しばゆう",
        "aliases": ["斉献王", "桃符"], "kind": "宗室", "gender": "male", "section": "晋",
        "birthYear": 248, "deathYear": 283, "yearsApproximate": True,
        "inclusionReason": ["経路上"],
        "note": "「齐献王攸，字大猷，少而岐嶷。」。司馬昭の子で武帝（司馬炎）の同母弟（「文帝九男，文明王皇后生武帝、齐献王攸、城阳哀王兆、辽东悼惠王定国、广汉殇王广德」）。「景帝无子，命攸为嗣。」とあり伯父・司馬師の嗣子となった（生前の縁組であり養父エッジを併記、実父エッジは司馬昭）。武帝の後継候補と目されたが荀勖・馮紞の讒言で就国を強いられ、「欧血而薨，时年三十六。」（太康四年＝283年）。生年は数え36からの逆算で248年（Wikidata は246年とし1〜2年の差があるため yearsApproximate=true）。「子冏立，别有传。」とあり子が八王の一人・斉王冏。",
        "wikidata": "Q1143870", "source": SRC38W,
    },
    {
        "id": "p-sima-liang", "name": "司馬亮", "kana": "しばりょう",
        "aliases": ["汝南文成王", "扶風王"], "kind": "宗室", "gender": "male", "section": "晋",
        "birthYear": None, "deathYear": 291, "yearsApproximate": False,
        "inclusionReason": ["政変当事者"],
        "note": "八王の乱の八王の一人。「汝南文成王亮，字子翼，宣帝第四子也。」（司馬懿の第四子、生母は伏夫人＝「伏夫人生汝南文成王亮、琅邪武王伷、清惠亭侯京、扶风武王骏」）。武帝の受禅で扶風郡王、のち汝南王。武帝の死後に楊駿が誅されると太宰・録尚書事として衛瓘とともに輔政したが、元康元年（291年）に賈后の意を承けた楚王瑋の兵に襲われ「遂为乱兵所害，投于北门之壁，鬓发耳鼻皆悉毁焉。」。瑋の誅殺後に「及玮诛，追复亮爵位」と爵位を復された。生年は晋書に記載がない。",
        "wikidata": "Q3273268", "source": SRC59("汝南王亮伝"),
    },
    {
        "id": "p-sima-wei", "name": "司馬瑋", "kana": "しばい",
        "aliases": ["楚隠王", "始平王"], "kind": "宗室", "gender": "male", "section": "晋",
        "birthYear": 271, "deathYear": 291, "yearsApproximate": False,
        "inclusionReason": ["政変当事者"],
        "note": "八王の乱の八王の一人。「楚隐王玮，字彦度，武帝第五子也。」。賈后の意を承けた矯詔で汝南王亮・衛瓘を殺害したが、直後に張華の計により「楚王矯詔」と宣告されて捕らえられ、「遂斩之，时年二十一。」（元康元年＝291年）。没年齢21から生年271年。臨刑に際して懐中の青紙詔を示し冤を訴えた逸話を伝える。",
        "wikidata": "Q3275357", "source": SRC59("楚王瑋伝"),
    },
    {
        "id": "p-sima-jiong", "name": "司馬冏", "kana": "しばけい",
        "aliases": ["斉武閔王"], "kind": "宗室", "gender": "male", "section": "晋",
        "birthYear": None, "deathYear": 303, "yearsApproximate": False,
        "inclusionReason": ["政変当事者"],
        "note": "八王の乱の八王の一人。「齐武闵王冏，字景治，献王攸之子也。」（斉献王攸の子・嗣子）。趙王倫の簒奪に対し永寧元年に挙兵して倫を討ち恵帝を復位させ、大司馬として輔政したが専恣を極め、河間王顒の表と長沙王乂の兵により攻め殺された（「乂擒冏至殿前」「遂斩于阊阖门外，徇首六军。」）。恵帝紀は「十二月丁卯，河间王颙表齐王冏窥伺神器，有无君之心，与成都王颍、新野王歆、范阳王虓同会洛阳，请废冏还第。长沙王乂奉乘舆屯南止车门，攻冏，杀之」と太安元年十二月に置く。太安元年十二月の朔は西暦303年1月5日にあたるため deathYear は303年（中国暦の年次では302年）。生年は晋書に記載がない。",
        "wikidata": "Q3269781", "source": SRC59("斉王冏伝"),
    },
    {
        "id": "p-sima-yi-changsha", "name": "司馬乂", "kana": "しばがい",
        "aliases": ["長沙厲王", "常山王"], "kind": "宗室", "gender": "male", "section": "晋",
        "birthYear": 277, "deathYear": 304, "yearsApproximate": True,
        "inclusionReason": ["政変当事者"],
        "note": "八王の乱の八王の一人。「长沙厉王乂，字士度，武帝第六子也。」。楚王瑋の同母弟として連座し常山王に貶されたが復封され、斉王冏を討って実権を握った。成都王穎・河間王顒の連合軍と洛陽で戦い優勢だったが、東海王越に捕らえられて金墉城に幽閉され、張方の部将郅輔により「就金墉收乂，至营，炙而杀之。」と焼き殺された（「时年二十八。」）。「乂以正月二十五日废，二十七日死」（永興元年正月＝304年）。没年齢28からの逆算で生年277年だが、同伝は武帝崩御（290年）時に「及武帝崩，乂时年十五」とも記し1年のずれがあるため yearsApproximate=true。恵帝紀は太安二年十一月癸亥の条に「东海王越执长沙王乂，幽于金墉城，寻为张方所害。」と記す。",
        "wikidata": "Q3276223", "source": SRC59("長沙王乂伝"),
    },
    {
        "id": "p-sima-ying", "name": "司馬穎", "kana": "しばえい",
        "aliases": ["成都王"], "kind": "宗室", "gender": "male", "section": "晋",
        "birthYear": 279, "deathYear": 306, "yearsApproximate": False,
        "inclusionReason": ["政変当事者"],
        "note": "八王の乱の八王の一人。「成都王颖，字章度，武帝第十六子也。」。趙王倫討伐で戦功を挙げ、鄴にあって朝政を遙かに統べ、河間王顒の推挙で皇太弟に立てられた（皇位継承の指名を受けた唯一の八王）。のち廃されて藩に帰り、范陽王虓の長史劉輿の偽詔により縊死を命ぜられた（「乃散发东首卧，命徽缢之，时年二十八。」＝光熙元年10月・306年、恵帝紀「虓长史刘舆害成都王颖」）。没年齢28からの逆算で生年279年。",
        "wikidata": "Q985721", "source": SRC59("成都王穎伝"),
    },
    {
        "id": "p-sima-yong", "name": "司馬顒", "kana": "しばぐう",
        "aliases": ["河間王", "太原王"], "kind": "宗室", "gender": "male", "section": "晋",
        "birthYear": None, "deathYear": 307, "yearsApproximate": False,
        "inclusionReason": ["政変当事者"],
        "note": "八王の乱の八王の一人。「河间王颙，字文载，安平献王孚孙，太原烈王瑰之子也。」＝司馬懿の直系ではなく弟・司馬孚の孫にあたる傍系（「石函之制，非亲亲不得都督关中，颙于诸王为疏，特以贤举。」と本人も疎属と意識されていた）。関中に拠り張方を用いて長沙王乂を除き、恵帝を長安へ遷して太宰となったが、東海王越の東軍に敗れて失脚。懐帝紀に「南阳王模杀河间王颙于雍谷。」とあり、光熙元年十二月（西暦307年1月）に南陽王模の将梁臣により新安の雍谷で車上にて絞殺された（八王伝「南阳王模遣将梁臣于新安雍谷车上扼杀之，并其三子。」）。生年は晋書に記載がない。",
        "wikidata": "Q985744", "source": SRC59("河間王顒伝"),
    },
    {
        "id": "p-sima-yue", "name": "司馬越", "kana": "しばえつ",
        "aliases": ["東海孝献王"], "kind": "宗室", "gender": "male", "section": "晋",
        "birthYear": None, "deathYear": 311, "yearsApproximate": False,
        "inclusionReason": ["政変当事者"],
        "note": "八王の乱の八王の一人にして最後の勝者。「东海孝献王越，字元超，高密王泰之次子也。」＝司馬懿の弟・司馬馗の孫にあたる傍系。長沙王乂を捕らえて金墉城に幽閉し、のち恵帝を洛陽へ迎えて太傅・録尚書となり、懐帝即位後は「及怀帝即位，委政于越。」と朝政を専断した。石勒の討伐に出た陣中で「永嘉五年，薨于项。」（311年）と病没し、その柩は石勒に焼かれた（「勒命焚越柩曰：“此人乱天下，吾为天下报之，故烧其骨以告天地。”」）。死後「帝发诏贬越为县王。」。生年は晋書に記載がない。",
        "wikidata": "Q985736", "source": SRC59("東海王越伝"),
    },
]


def kin(relation, frm, to, note, source, child_order=None, extra=None):
    e = {
        "type": "kinship",
        "relation": relation,
        "from": frm,
        "to": to,
        "veracity": "verified",
        "confidence": "high",
        "note": note,
        "source": source,
    }
    if child_order is not None:
        e["childOrder"] = child_order
    if extra:
        e.update(extra)
    return e


EDGES = [
    kin("実父", "p-sima-fang", "p-sima-yi",
        "晋書宣帝紀に「俊生京兆尹防，字建公。帝即防之第二子也。」とあり、司馬懿は司馬防の第二子。childOrder=2 はこの明記による。",
        SRC01, 2),
    kin("実父", "p-sima-fang", "p-sima-fu",
        "「安平献王孚，字叔达，宣帝次弟也。」および八達の列挙（朗＝伯達・懿＝仲達・孚＝叔達・馗＝季達…）により司馬防の子で司馬懿の弟。原典に「第n子」の明示がないため childOrder は付さない（字の伯仲叔季の順では三男にあたる）。",
        SRC37("安平献王孚")),
    kin("実父", "p-sima-fang", "p-sima-kui",
        "「彭城穆王权，字子舆，宣帝弟魏鲁相东武城侯馗之子也。」により司馬馗は司馬懿の弟＝司馬防の子。八達では字を季達とし、序列では四男にあたるが「第n子」の明示がないため childOrder は付さない。",
        SRC37("彭城穆王権")),
    kin("実父", "p-sima-yi", "p-sima-liang",
        "「汝南文成王亮，字子翼，宣帝第四子也。」により司馬懿の第四子。childOrder=4 はこの明記による。生母は伏夫人（宣五王伝「伏夫人生汝南文成王亮、琅邪武王伷、清惠亭侯京、扶风武王骏」）。",
        SRC59("汝南王亮伝"), 4),
    kin("実父", "p-sima-fu", "p-sima-gui",
        "宗室伝の司馬孚の条に「九子：邕、望、辅、翼、晃、瑰、珪、衡、景。」とあり、瑰（瓌）は列挙順で第六。太原烈王瑰の条にも「子颙立，徙封河间王」と続く。childOrder=6 はこの九子の列挙順による（「第六子」の直接表記ではない）。",
        SRC37("安平献王孚・太原烈王瑰"), 6),
    kin("実父", "p-sima-gui", "p-sima-yong",
        "「河间王颙，字文载，安平献王孚孙，太原烈王瑰之子也。」により司馬瓌の子。原典に排行の記載がないため childOrder は付さない。",
        SRC59("河間王顒伝")),
    kin("実父", "p-sima-kui", "p-sima-tai",
        "「高密文献王泰，字子舒，彭城穆王权之弟」とあり、彭城穆王権が「宣帝弟魏鲁相东武城侯馗之子也」であることから、泰も司馬馗の子。原典に排行の記載がないため childOrder は付さない。",
        SRC37("彭城穆王権・高密文献王泰")),
    kin("実父", "p-sima-tai", "p-sima-yue",
        "「东海孝献王越，字元超，高密王泰之次子也。」により司馬泰の次子。childOrder=2 はこの明記による。",
        SRC59("東海王越伝"), 2),
    kin("実父", "jin-wudi", "p-sima-wei",
        "「楚隐王玮，字彦度，武帝第五子也。」により武帝（司馬炎）の第五子。childOrder=5 はこの明記による。長沙王乂とは同母兄弟（長沙王乂伝「玮既诛，乂以同母，贬为常山王」）。",
        SRC59("楚王瑋伝"), 5),
    kin("実父", "jin-wudi", "p-sima-yi-changsha",
        "「长沙厉王乂，字士度，武帝第六子也。」により武帝（司馬炎）の第六子。childOrder=6 はこの明記による。",
        SRC59("長沙王乂伝"), 6),
    kin("実父", "jin-wudi", "p-sima-ying",
        "「成都王颖，字章度，武帝第十六子也。」により武帝（司馬炎）の第十六子。childOrder=16 はこの明記による。",
        SRC59("成都王穎伝"), 16),
    kin("実父", "p-sima-zhao", "p-sima-you",
        "「文帝九男，文明王皇后生武帝、齐献王攸、城阳哀王兆、辽东悼惠王定国、广汉殇王广德」により司馬昭と王元姫の子で、武帝（司馬炎）の同母弟。",
        SRC38W),
    kin("養父", "p-sima-shi", "p-sima-you",
        "「景帝无子，命攸为嗣。」により、司馬師（景帝）の生前に嗣子として縁組された。舞陽侯の爵を襲い（「袭封舞阳侯」）、景献羊皇后を別第に奉じた。実父は司馬昭で実父エッジを併記する。primaryLineage は既定規則（養父＞実父）に従い明示しない。",
        SRC38W),
    kin("実父", "p-sima-you", "p-sima-jiong",
        "「齐武闵王冏，字景治，献王攸之子也。」および文六王伝の「子冏立，别有传。」により斉献王攸の子で嗣子。原典に排行の記載がないため childOrder は付さない。",
        SRC59("斉王冏伝")),
]

BLOCK = {
    "phase": "parentage",
    "block": "追加調査: 西晋八王（汝南王亮・楚王瑋・斉王冏・長沙王乂・成都王穎・河間王顒・東海王越＋既収録の趙王倫）と接続ブリッジ6人（司馬防・孚・馗・瓌・泰・攸）",
    "emperors": 0,
    "edges": len(EDGES),
    "persons": len(PERSONS),
}


def main() -> int:
    data = json.loads(PATH.read_text(encoding="utf-8"))
    person_ids = {p["id"] for p in data["persons"]}
    emperor_ids_ok = True

    added_p, added_e = 0, 0
    for p in PERSONS:
        if p["id"] in person_ids:
            # read-modify-write: 既存 id は置き換え（並行セッションとの衝突検出のため報告）
            idx = next(i for i, x in enumerate(data["persons"]) if x["id"] == p["id"])
            data["persons"][idx] = p
            print(f"  [update] {p['id']}")
        else:
            data["persons"].append(p)
            added_p += 1

    existing = {(e["type"], e.get("relation"), e.get("from"), e.get("to")) for e in data["edges"]}
    for e in EDGES:
        key = (e["type"], e.get("relation"), e.get("from"), e.get("to"))
        if key in existing:
            print(f"  [skip-dup] {key}")
            continue
        data["edges"].append(e)
        added_e += 1

    blocks = data["meta"].setdefault("completedBlocks", [])
    if not any(b.get("block") == BLOCK["block"] for b in blocks):
        blocks.append(BLOCK)

    data["meta"]["generatedAt"] = "2026-07-25"
    PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"persons +{added_p} (total {len(data['persons'])}), edges +{added_e} (total {len(data['edges'])})")
    return 0 if emperor_ids_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
