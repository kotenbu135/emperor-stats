#!/usr/bin/env python3
"""皇帝ごとの本紀原文をローカルコーパスから抽出し _corpus_cache/ に書き出す。

判定・調査は一切行わない。docs/process/CORPUS_NOTES.md に記録済みの
書名・巻・行範囲インデックスに基づく機械的なテキスト抽出のみ。
出典・巻の同定自体は既存の調査結果（各グループの source フィールド等）
に基づいており、このスクリプトは「同じ原文を何度も読み直す」手間を
省くためのキャッシュ生成にとどまる。

使い方: python3 scripts/build_corpus_cache.py
"""
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHINA_HISTORY = ROOT / "china-history"
DAIZHI = ROOT / "daizhigev20" / "史藏" / "正史"
DAIZHI_BIESHI = ROOT / "daizhigev20" / "史藏" / "别史"
CACHE_DIR = ROOT / "_corpus_cache"

MING_DIR = CHINA_HISTORY / "明史" / "本纪"
QING_FILE = DAIZHI / "清史稿.txt"
DAIZHI_MINGSHI_FILE = DAIZHI / "明史.txt"
DAIZHI_ZHUANJI = ROOT / "daizhigev20" / "史藏" / "传记"
XIAODIAN_ZHUANZHUAN_FILE = DAIZHI_ZHUANJI / "小腆纪传.txt"
HAN_DIR = CHINA_HISTORY / "汉书" / "纪"
HOUHAN_DIR = CHINA_HISTORY / "后汉书" / "本纪"
WUDAI_HOULIANG_DIR = CHINA_HISTORY / "旧五代史" / "后梁"
WUDAI_HOUTANG_DIR = CHINA_HISTORY / "旧五代史" / "后唐"
WUDAI_HOUJIN_DIR = CHINA_HISTORY / "旧五代史" / "后晋"
WUDAI_HOUHAN_DIR = CHINA_HISTORY / "旧五代史" / "后汉"
WUDAI_HOUZHOU_DIR = CHINA_HISTORY / "旧五代史" / "后周"
XIN_WUDAI_SHIJIA_DIR = CHINA_HISTORY / "新五代史" / "世家"
XIN_WUDAI_LIEZHUAN_DIR = CHINA_HISTORY / "新五代史" / "列传"
SONG_DIR = CHINA_HISTORY / "宋史" / "本纪"
SONG_LIEZHUAN_DIR = CHINA_HISTORY / "宋史" / "列传"
LIAO_DIR = CHINA_HISTORY / "辽史" / "本纪"
JIN_DIR = CHINA_HISTORY / "金史" / "本纪"
JIN_LIEZHUAN_DIR = CHINA_HISTORY / "金史" / "列传"
XIXIA_FILE = DAIZHI_BIESHI / "西夏书事.txt"
YUAN_DIR = CHINA_HISTORY / "元史" / "本纪"
MING_LIEZHUAN_DIR = CHINA_HISTORY / "明史" / "列传"
XINYUANSHI_FILE = DAIZHI / "新元史.txt"

# 秦・新末群雄・玄漢・西晋（グループ5単独ブロック用）
SHIJI_BENJI_DIR = CHINA_HISTORY / "史记" / "十二本纪"
HANSHU_ZHUAN_DIR = CHINA_HISTORY / "汉书" / "传"
HOUHAN_LIEZHUAN_DIR = CHINA_HISTORY / "后汉书" / "列传"
JIN_BENJI_DIR = CHINA_HISTORY / "晋书" / "帝纪"

# 五胡十六国（daizhigev20の晋書載記・十六国春秋・資治通鑑を使用）
DAIZHI_JINSHU_FILE = DAIZHI / "晋书.txt"
SHILIUGUO_CHUNQIU_FILE = ROOT / "daizhigev20" / "史藏" / "载记" / "十六国春秋.txt"
ZIZHI_TONGJIAN_FILE = ROOT / "daizhigev20" / "史藏" / "编年" / "资治通鉴.txt"

# 南北朝
SONGSHU_BENJI_DIR = CHINA_HISTORY / "宋书" / "本纪"
NANQISHU_BENJI_DIR = CHINA_HISTORY / "南齐书" / "本纪"
LIANGSHU_DIR = CHINA_HISTORY / "梁书" / "原文版梁书"
CHENSHU_DIR = CHINA_HISTORY / "陈书" / "原文版陈书"
WEISHU_BENJI_DIR = CHINA_HISTORY / "魏书" / "帝纪"
WEISHU_LIEZHUAN_DIR = CHINA_HISTORY / "魏书" / "列传"
BEIQISHU_DIR = CHINA_HISTORY / "北齐书" / "原文版北齐书"
ZHOUSHU_DIR = CHINA_HISTORY / "周书" / "原文版周书"
BEISHI_DIR = CHINA_HISTORY / "北史" / "原文版北史"
NANSHI_DIR = CHINA_HISTORY / "南史" / "原文版南史"
DAIZHI_SONGSHU_FILE = DAIZHI / "宋书.txt"
DAIZHI_LIANGSHU_FILE = DAIZHI / "梁书.txt"
DAIZHI_BEIQISHU_FILE = DAIZHI / "北齐书.txt"
DAIZHI_BEISHI_FILE = DAIZHI / "北史.txt"
DAIZHI_SUISHU_FILE = DAIZHI / "隋书.txt"

_JUAN_NUMERALS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
                   "十一", "十二"]


def read_kanji_juan_file(dir_path: Path, juan: int) -> str:
    """「卷○-原文.html」（第○章プレフィックスなし）形式のファイルを読む。
    梁书・陈书・北齐书・周书・北史・南史の「原文版」ディレクトリ用。"""
    path = dir_path / f"卷{_JUAN_NUMERALS[juan]}-原文.html"
    return read_html(path)


NAV_LINE_PATTERNS = [
    re.compile(r"^首页$"),
    re.compile(r"^原文$"),
    re.compile(r"^段译$"),
    re.compile(r"^译文$"),
    re.compile(r"：目录$"),
    re.compile(r"^第[〇一二三四五六七八九十百]+章[-－].*$"),
]


def strip_html(raw: str) -> str:
    # ナビゲーション（首页・目次リンク・前後節リンク）のブロックを除去
    raw = re.sub(r"<title>.*?</title>", "", raw, flags=re.S)
    raw = re.sub(r"<style>.*?</style>", "", raw, flags=re.S)
    raw = re.sub(r"<h1>.*?</h1>", "", raw, flags=re.S)
    raw = re.sub(r"<p><a id='home'.*?</a></p>\s*<p id='list'>.*?</p>", "", raw, flags=re.S)
    raw = re.sub(r"<div class='pn'>.*?</div>", "", raw, flags=re.S)
    text = re.sub(r"<[^>]+>", "\n", raw)
    text = html.unescape(text)
    lines = [l.strip() for l in text.splitlines()]
    lines = [l for l in lines if l and not any(p.search(l) for p in NAV_LINE_PATTERNS)]
    return "\n".join(lines).strip()


def read_ming_juan(juan: int) -> str:
    # 卷十 -> 第十章, 卷二十一 -> 第二十一章 (china-history のファイル名は卷数と一致)
    numerals = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
                "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八",
                "十九", "二十", "二十一", "二十二", "二十三", "二十四"]
    name = numerals[juan]
    path = MING_DIR / f"第{name}章-卷{name}-原文.html"
    return strip_html(path.read_text(encoding="utf-8"))


def split_juan21():
    """卷二十一は神宗二＋光宗が同一ファイルに同居しているため分割する。"""
    full = read_ming_juan(21)
    marker = "◎光宗"
    idx = full.index(marker)
    return full[:idx].strip(), full[idx:].strip()


MING_MAP = {
    "ming-taizu": [1, 2, 3],
    "ming-huizong": [4],
    "ming-taizong": [5, 6, 7],
    "ming-renzong": [8],
    "ming-xuanzong": [9],
    "ming-yingzong": [10, 12],  # 前紀(正統)+後紀(天順)を合算
    "ming-daizong": [11],
    "ming-xianzong": [13, 14],
    "ming-xiaozong": [15],
    "ming-wuzong": [16],
    "ming-shizong": [17, 18],
    "ming-muzong": [19],
    # ming-shenzong / ming-guangzong は卷21を分割するため個別処理
    "ming-xizong": [22],
    "ming-yizong": [23, 24],
}

QING_RANGES = {
    # (開始行, 終了行) 1-indexed, inclusive。docs/process/CORPUS_NOTES.md の表に基づく
    "qing-taizong": (102, 316),
    "qing-shizu": (317, 556),
    "qing-shengzu": (557, 1369),
    "qing-shizong": (1370, 1544),
    "qing-gaozong": (1545, 2283),
    "qing-renzong": (2284, 2611),
    "qing-xuanzong": (2612, 2998),
    "qing-wenzong": (2999, 3157),
    "qing-muzong": (3158, 3352),
    "qing-dezong": (3353, 3833),
    # 清朝期(1908-1912)のみ。張勲復辟・満洲国期はこの corpus の範囲外(別途二次資料)
    "qing-xuantong": (3834, 3881),
}


def read_html(path: Path) -> str:
    return strip_html(path.read_text(encoding="utf-8"))


def split_at(text: str, marker: str):
    """marker の直前までを前半、marker 以降(marker含む)を後半として返す。"""
    idx = text.index(marker)
    return text[:idx].strip(), text[idx:].strip()


def slice_between(text: str, start_marker: str, end_marker: str) -> str:
    start = text.index(start_marker)
    end = text.index(end_marker, start) + len(end_marker)
    return text[start:end].strip()


_KANJI_DIGIT = {"〇": 0, "一": 1, "二": 2, "三": 3, "四": 4,
                "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}


def kanji_to_int(s: str) -> int:
    """漢数字(章番号、〜五十程度まで)をintに変換する。"""
    if s == "十":
        return 10
    if "十" in s:
        left, _, right = s.partition("十")
        tens = _KANJI_DIGIT[left] if left else 1
        return tens * 10 + (_KANJI_DIGIT[right] if right else 0)
    return _KANJI_DIGIT[s]


def index_juan_dir(dir_path: Path) -> dict:
    """ディレクトリ内のHTMLファイルを「第○章」の章番号(int)でインデックス化する。"""
    out = {}
    for p in dir_path.glob("*.html"):
        m = re.match(r"第([〇一二三四五六七八九十]+)章-", p.name)
        if m:
            out[kanji_to_int(m.group(1))] = p
    return out


def read_juan_range(dir_path: Path, start: int, end: int) -> str:
    index = index_juan_dir(dir_path)
    return "\n\n".join(read_html(index[i]) for i in range(start, end + 1))


def slice_from(text: str, start_marker: str) -> str:
    return text[text.index(start_marker):].strip()


HAN_FILES = {
    "han-gaozu": ["第一章-高帝纪上-原文.html", "第二章-高帝纪下-原文.html"],
    "han-huidi": ["第三章-惠帝纪-原文.html"],
    # han-qianshaodi/han-houshaodi は高后纪(第四章)を分割
    "han-wendi": ["第五章-文帝纪-原文.html"],
    "han-jingdi": ["第六章-景帝纪-原文.html"],
    "han-wudi": ["第七章-武帝纪-原文.html"],
    "han-zhaodi": ["第八章-昭帝纪-原文.html"],
    # han-liuhe は宣帝纪(第九章)冒頭の埋め込み記述を抽出
    "han-xuandi": ["第九章-宣帝纪-原文.html"],
    "han-yuandi": ["第十章-元帝纪-原文.html"],
    "han-chengdi": ["第十一章-成帝纪-原文.html"],
    "han-aidi": ["第十二章-哀帝纪-原文.html"],
    "han-pingdi": ["第十三章-平帝纪-原文.html"],
}

HOUHAN_FILES = {
    "hou-han-guangwudi": ["第一章-光武帝纪上-原文.html", "第二章-光武帝纪下-原文.html"],
    "hou-han-mingdi": ["第三章-显宗孝明帝纪-原文.html"],
    "hou-han-zhangdi": ["第四章-肃宗孝章帝纪-原文.html"],
    # hou-han-hedi/hou-han-shangdi は第五章を分割
    # hou-han-andi/hou-han-shaodi-yi は第六章から抽出
    "hou-han-huandi": ["第八章-孝桓帝纪-原文.html"],
    # hou-han-lingdi/hou-han-shaodi-bian は第九章から抽出
    "hou-han-xiandi": ["第十章-孝献帝纪-原文.html"],
}


def build_han():
    out = {}
    for emperor_id, files in HAN_FILES.items():
        out[emperor_id] = "\n\n".join(read_html(HAN_DIR / f) for f in files)

    # 高后纪(第四章): 呂后摂政下の前少帝(嗣位せず幽閉)・後少帝(弘)を分割
    gaohou = read_html(HAN_DIR / "第四章-高后纪-原文.html")
    qianshaodi, houshaodi = split_at(gaohou, "五月丙辰，立恒山王弘为皇帝")
    out["han-qianshaodi"] = qianshaodi
    out["han-houshaodi"] = houshaodi

    # 宣帝纪(第九章)冒頭に埋め込まれた昌邑王(廃帝)の記述を抽出
    xuandi_full = out["han-xuandi"]
    out["han-liuhe"] = slice_between(
        xuandi_full, "元平元年四月，昭帝崩，毋嗣", "请废")
    return out


def build_houhan():
    out = {}
    for emperor_id, files in HOUHAN_FILES.items():
        out[emperor_id] = "\n\n".join(read_html(HOUHAN_DIR / f) for f in files)

    # 第五章-孝和孝殇帝纪: 和帝と殇帝を分割
    hedi_shangdi = read_html(HOUHAN_DIR / "第五章-孝和孝殇帝纪-原文.html")
    hedi, shangdi = split_at(hedi_shangdi, "孝殇皇帝讳隆")
    out["hou-han-hedi"] = hedi
    out["hou-han-shangdi"] = shangdi

    # 第六章-孝安帝纪: 本文全体を安帝に割り当て、末尾の少帝(北乡侯懿)記述を別途抽出
    andi_full = read_html(HOUHAN_DIR / "第六章-孝安帝纪-原文.html")
    out["hou-han-andi"] = andi_full
    out["hou-han-shaodi-yi"] = slice_between(
        andi_full, "太后临朝，以后兄大鸿胪阎显为车骑将军", "少帝薨。")

    # 第七章-孝顺孝冲孝质帝纪: 順帝・沖帝・質帝の3分割
    shun_chong_zhi = read_html(HOUHAN_DIR / "第七章-孝顺孝冲孝质帝纪-原文.html")
    shundi_part, rest = split_at(shun_chong_zhi, "孝冲皇帝讳")
    chongdi_part, zhidi_part = split_at(rest, "孝质皇帝讳")
    out["hou-han-shundi"] = shundi_part
    out["hou-han-chongdi"] = chongdi_part
    out["hou-han-zhidi"] = zhidi_part

    # 第九章-孝灵帝纪: 本文全体を霊帝に割り当て、末尾の少帝(弁)記述を別途抽出
    lingdi_full = read_html(HOUHAN_DIR / "第九章-孝灵帝纪-原文.html")
    out["hou-han-lingdi"] = lingdi_full
    out["hou-han-shaodi-bian"] = slice_between(
        lingdi_full, "戊午，皇子辩即皇帝位", "董卓废帝为弘农王。")
    return out


def build_ming():
    out = {}
    for emperor_id, juans in MING_MAP.items():
        out[emperor_id] = "\n\n".join(read_ming_juan(j) for j in juans)
    shenzong_part, guangzong_part = split_juan21()
    out["ming-shenzong"] = read_ming_juan(20) + "\n\n" + shenzong_part
    out["ming-guangzong"] = guangzong_part
    return out


def build_qing():
    lines = QING_FILE.read_text(encoding="utf-8").splitlines()
    out = {}
    for emperor_id, (start, end) in QING_RANGES.items():
        chunk = lines[start - 1:end]
        out[emperor_id] = "\n".join(chunk).strip()
    return out


# 旧五代史（五代本朝14名）: 各王朝サブディレクトリの「第○章」= 紀の通し番号
WUDAI_JUAN_MAP = {
    "wudai-houliang-taizu": (WUDAI_HOULIANG_DIR, 1, 7),      # 太祖纪一〜七（末尾に友珪弑逆の記述含む、重複許容）
    "wudai-houliang-modi": (WUDAI_HOULIANG_DIR, 8, 10),       # 末帝纪上〜下（冒頭に友珪関連の記述含む、重複許容）
    "wudai-houtang-zhuangzong": (WUDAI_HOUTANG_DIR, 3, 10),   # 庄宗纪一〜八（第一・二章「皇纪」は父・李克用の紀のため除外）
    "wudai-houtang-mingzong": (WUDAI_HOUTANG_DIR, 11, 20),    # 明宗纪一〜十
    "wudai-houtang-mindi": (WUDAI_HOUTANG_DIR, 21, 21),       # 闵帝纪
    "wudai-houtang-modi2": (WUDAI_HOUTANG_DIR, 22, 24),       # 末帝纪上中下
    "wudai-houjin-gaozu": (WUDAI_HOUJIN_DIR, 1, 6),           # 高祖纪一〜六
    "wudai-houjin-shaodi": (WUDAI_HOUJIN_DIR, 7, 11),         # 少帝纪一〜五
    "wudai-houhan-gaozu": (WUDAI_HOUHAN_DIR, 1, 2),           # 高祖纪上下
    "wudai-houhan-yindi": (WUDAI_HOUHAN_DIR, 3, 5),           # 隐帝纪上中下
    "wudai-houzhou-taizu": (WUDAI_HOUZHOU_DIR, 1, 4),         # 太祖纪一〜四
    "wudai-houzhou-shizong": (WUDAI_HOUZHOU_DIR, 5, 10),      # 世宗纪一〜六
    "wudai-houzhou-gongdi": (WUDAI_HOUZHOU_DIR, 11, 11),      # 恭帝纪
}


def build_wudai():
    out = {}
    for emperor_id, (dir_path, start, end) in WUDAI_JUAN_MAP.items():
        out[emperor_id] = read_juan_range(dir_path, start, end)

    # 朱友珪: 単独の紀を持たず、太祖纪七末尾(弑逆・簒奪即位)と末帝纪上冒頭(誅殺)の2箇所に分散
    taizu_qi = read_html(index_juan_dir(WUDAI_HOULIANG_DIR)[7])
    modi_shang = read_html(index_juan_dir(WUDAI_HOULIANG_DIR)[8])
    part1 = slice_between(taizu_qi, "次郢王友珪，其母亳州营倡也，为左右控鹤都指挥使。", "友珪即皇帝位。")
    part2 = slice_between(modi_shang, "庶人友珪弑逆，矫太祖诏", "十七日，象先引禁军千人突入宫城，遂诛友珪。")
    out["wudai-houliang-zhuyougui"] = part1 + "\n\n" + part2
    return out


def build_shiguo():
    out = {}

    # 呉世家第一: 楊溥のみ対象（楊行密・楊渥・楊隆演・徐温伝は非対象、開始マーカーから末尾まで）
    wu = read_html(XIN_WUDAI_SHIJIA_DIR / "第一章-吴世家第一-原文.html")
    out["shiguo-wu-yangpu"] = slice_from(wu, "溥，行密第四子也，隆演建国，封丹阳郡公。")

    # 前蜀世家第三: 王建/王衍の2分割
    qianshu = read_html(XIN_WUDAI_SHIJIA_DIR / "第三章-前蜀世家第三-原文.html")
    wangjian, wangyan = split_at(qianshu, "衍字化源。")
    out["shiguo-qianshu-wangjian"] = wangjian
    out["shiguo-qianshu-wangyan"] = wangyan

    # 后蜀世家第四: 孟知祥/孟昶の2分割
    houshu = read_html(XIN_WUDAI_SHIJIA_DIR / "第四章-后蜀世家第四-原文.html")
    mengzhixiang, mengchang = split_at(houshu, "昶，知祥第三子也。知祥为两川节度使，昶为行军司马。")
    out["shiguo-houshu-mengzhixiang"] = mengzhixiang
    out["shiguo-houshu-mengchang"] = mengchang

    # 南汉世家第五: 劉龑/劉玢/劉晟/劉鋹の4分割（冒頭は劉隠伝のため劉龑は開始マーカーから抽出）
    nanhan = read_html(XIN_WUDAI_SHIJIA_DIR / "第五章-南汉世家第五-原文.html")
    liuyan_onward, rest = split_at(nanhan, "玢，初名洪度，封秦王。")
    liuyan = slice_from(liuyan_onward, "初名岩，谦庶子也。")
    liusheng_onward, liuchang = split_at(rest, "鋹，初名继兴，封卫王。")
    liubin, liusheng = split_at(liusheng_onward, "晟，初名洪熙，封晋王。")
    out["shiguo-nanhan-liuyan"] = liuyan
    out["shiguo-nanhan-liubin"] = liubin
    out["shiguo-nanhan-liusheng"] = liusheng
    out["shiguo-nanhan-liuchang"] = liuchang

    # 南唐世家第二: 李昪/李璟の2分割（本文中は「李璟」ではなく「景」表記で通す）
    nantang = read_html(XIN_WUDAI_SHIJIA_DIR / "第二章-南唐世家第二-原文.html")
    libian, lijing = split_at(nantang, "景，初名景通，昪长子也。既立，又改名璟。")
    out["shiguo-nantang-libian"] = libian
    out["shiguo-nantang-lijing"] = lijing

    # 闽世家第八: 王延鈞(鏻)/王継鵬(昶)/王延羲(曦)/王延政の4分割（いずれも即位後の改名で本文表記）
    min_text = read_html(XIN_WUDAI_SHIJIA_DIR / "第八章-闽世家第八-原文.html")
    wangyanjun = slice_from(min_text, "鏻，审知次子也。")
    wangjipeng_onward = slice_from(min_text, "继鹏，鏻长子也。")
    wangyanjun = wangyanjun[:wangyanjun.index("继鹏，鏻长子也。")].strip()
    wangyanxi_onward = slice_from(min_text, "延义，审知少子也。")
    wangjipeng = wangjipeng_onward[:wangjipeng_onward.index("延义，审知少子也。")].strip()
    wangyanzheng_onward = slice_from(min_text, "延政，审知子也。曦立，为淫虐，延政数贻书谏之。")
    wangyanxi = wangyanxi_onward[:wangyanxi_onward.index("延政，审知子也。曦立，为淫虐，延政数贻书谏之。")].strip()
    out["shiguo-min-wangyanjun"] = wangyanjun
    out["shiguo-min-wangjipeng"] = wangjipeng
    out["shiguo-min-wangyanxi"] = wangyanxi
    out["shiguo-min-wangyanzheng"] = wangyanzheng_onward

    # 东汉世家第十(北漢): 劉崇(旻)/劉鈞(承钧)/劉継恩/劉継元の4分割
    beihan = read_html(XIN_WUDAI_SHIJIA_DIR / "第十章-东汉世家第十-原文.html")
    liuchong = slice_from(beihan, "刘旻，汉高祖母弟也。初名崇")
    liujun_onward = slice_from(beihan, "承钧，旻次子也。")
    liuchong = liuchong[:liuchong.index("承钧，旻次子也。")].strip()
    liujien_onward = slice_from(beihan, "继恩本姓薛氏，父钊为卒")
    liujun = liujun_onward[:liujun_onward.index("继恩本姓薛氏，父钊为卒")].strip()
    liujiyuan_onward = slice_from(beihan, "继元为人忍。旻子十余人")
    liujien = liujien_onward[:liujien_onward.index("继元为人忍。旻子十余人")].strip()
    out["shiguo-beihan-liuchong"] = liuchong
    out["shiguo-beihan-liujun"] = liujun
    out["shiguo-beihan-liujien"] = liujien
    out["shiguo-beihan-liujiyuan"] = liujiyuan_onward

    # 桀燕（劉守光）: 新五代史 列传第二十七（雑伝）の独立伝
    liezhuan = read_html(XIN_WUDAI_LIEZHUAN_DIR / "第二十七章-杂传第二十七-原文.html")
    out["shiguo-jieyan-liushouguang"] = slice_from(liezhuan, "刘守光，深州乐寿人也。")

    return out


# 宋史本紀（北宋9名・南宋6名。瀛国公・端宗・衛王は卷四十七を3分割）
SONG_JUAN_MAP = {
    "beisong-taizu": (1, 3),
    "beisong-taizong": (4, 5),
    "beisong-zhenzong": (6, 8),
    "beisong-renzong": (9, 12),
    "beisong-yingzong": (13, 13),
    "beisong-shenzong": (14, 16),
    "beisong-zhezong": (17, 18),
    "beisong-huizong": (19, 22),
    "beisong-qinzong": (23, 23),
    "nansong-gaozong": (24, 32),
    "nansong-xiaozong": (33, 35),
    "nansong-guangzong": (36, 36),
    "nansong-ningzong": (37, 40),
    "nansong-lizong": (41, 45),
    "nansong-duzong": (46, 46),
    # nansong-gongdi/duanzong/weiwang は卷四十七を分割（下記参照）
}


def build_song():
    out = {}
    for emperor_id, (start, end) in SONG_JUAN_MAP.items():
        out[emperor_id] = read_juan_range(SONG_DIR, start, end)

    # 卷四十七: 瀛国公(恭帝)の記述に続き、逃亡した二王(昰・昺)の記述が埋め込まれる。
    # 「賈似道等入宮議所立」以降が二王の事跡(端宗即位の経緯)、
    # 「庚午，衆又立衞王昺為主」以降が衛王(帝昺)の事跡。
    juan47 = read_juan_range(SONG_DIR, 47, 47)
    gongdi_part, rest = split_at(juan47, "賈似道等入宮議所立")
    duanzong_part, weiwang_part = split_at(rest, "庚午，衆又立衞王昺為主")
    out["nansong-gongdi"] = gongdi_part
    out["nansong-duanzong"] = duanzong_part
    out["nansong-weiwang"] = weiwang_part
    return out


def build_beisongmo():
    """北宋末の傀儡政権2名（張邦昌=楚、劉豫=齊）。本紀を持たず列伝のみ。
    宋史列伝の絶対巻475は本紀47+志162+表32=241を差し引いた相対巻234
    （china-history のファイル名は相対巻数で統一されている）。
    """
    out = {}
    liezhuan = read_html(SONG_LIEZHUAN_DIR / "第二百三十四章-卷二百三十四-原文.html")
    zhangbangchang_part, rest = split_at(liezhuan, "劉豫字彥游，景州阜城人也。")
    liuyu_part, _ = split_at(rest, "苗傅，上黨人。")
    out["beisongmo-zhangbangchang"] = zhangbangchang_part

    # 劉豫は金史列伝にも独立した記述がある（金史の絶対巻77は本紀19+志39+表4=62を
    # 差し引いた相対巻15）。宋史の記述を補う参考として末尾に追記する。
    jin_liezhuan = read_html(JIN_LIEZHUAN_DIR / "第十五章-卷十五-原文.html")
    _, from_liuyu = split_at(jin_liezhuan, "刘豫，字彦游，景州阜城人。")
    liuyu_jin_part, _ = split_at(from_liuyu, "昌，本名挞懒，穆宗子。")
    out["beisongmo-liuyu"] = liuyu_part + "\n\n" + liuyu_jin_part
    return out


# 遼史本紀（遼9名。天祚皇帝紀四(卷三十)の末尾に西遼3名が付録として埋め込まれる）
LIAO_JUAN_MAP = {
    "liao-taizu": (1, 2),
    "liao-taizong": (3, 4),
    "liao-shizong": (5, 5),
    "liao-muzong": (6, 7),
    "liao-jingzong": (8, 9),
    "liao-shengzong": (10, 17),
    "liao-xingzong": (18, 20),
    "liao-daozong": (21, 26),
    "liao-tianzuodi": (27, 30),
}


def build_liao():
    out = {}
    for emperor_id, (start, end) in LIAO_JUAN_MAP.items():
        out[emperor_id] = read_juan_range(LIAO_DIR, start, end)

    # 卷三十末尾: 耶律大石(徳宗)→塔不烟(感天皇后、摂政)→夷列(仁宗)→
    # 普速完(承天太后、摂政)→直魯古(末主)の順で記述される。摂政2名は対象外だが
    # 前後の摂政記述は文脈として各皇帝側に残す（重複許容）。
    juan30 = read_juan_range(LIAO_DIR, 30, 30)
    start = juan30.index("耶律大石者，世号为西辽。")
    idx_renzong = juan30.index("子夷列年幼，遣命皇后权国。")
    idx_tianxi = juan30.index("子幼，遗诏以妹普速完权国")
    end = juan30.index("直鲁古死，辽绝。") + len("直鲁古死，辽绝。")
    out["xiliao-dezong"] = juan30[start:idx_renzong].strip()
    out["xiliao-renzong"] = juan30[idx_renzong:idx_tianxi].strip()
    out["xiliao-tianxi"] = juan30[idx_tianxi:end].strip()
    return out


# 金史本紀（金10名。卷一世紀・卷十九世紀補は追尊祖先のため対象外）
JIN_JUAN_MAP = {
    "jin-taizu": (2, 2),
    "jin-taizong": (3, 3),
    "jin-xizong": (4, 4),
    "jin-hailingwang": (5, 5),
    "jin-shizong": (6, 8),
    "jin-zhangzong": (9, 12),
    "jin-weishaowang": (13, 13),
    "jin-xuanzong": (14, 16),
    "jin-aizong": (17, 18),
    # jin-modi(完顔承麟)は独立した紀を持たず卷十八(哀宗紀下)末尾に埋め込み
}


def build_jin():
    out = {}
    for emperor_id, (start, end) in JIN_JUAN_MAP.items():
        out[emperor_id] = read_juan_range(JIN_DIR, start, end)

    juan18 = read_juan_range(JIN_DIR, 18, 18)
    start = juan18.index("戊申，夜，上集百官，传位于东面元帅承麟")
    end = juan18.index("末帝为乱兵所害，金亡。") + len("末帝为乱兵所害，金亡。")
    out["jin-modi"] = juan18[start:end].strip()
    return out


# 西夏書事（daizhigev20、china-history非収録のため唯一の一次コーパス）。
# 編年体のため皇帝ごとの独立巻を持たず、行番号で範囲を切り出す（1-indexed, inclusive）。
# 前後の皇帝と重複する区間を意図的に含む（摂政・譲位等の記述が隣接するため）。
XIXIA_RANGES = {
    "xixia-jingzong": (1890, 2791),    # 元昊(景宗)。徳明卒〜嗣立・称帝〜元昊死(巻十八)
    "xixia-yizong": (2752, 3292),      # 諒祚(毅宗)。没蔵訛龐による擁立〜死(巻二十一)
    "xixia-huizong": (3286, 4230),     # 秉常(恵宗)。嗣立〜死(巻二十七手前)
    "xixia-chongzong": (4201, 5789),   # 乾順(崇宗)。嗣立(3歳)〜死(巻三十五)
    "xixia-renzong": (5617, 6735),     # 仁孝(仁宗)。嗣立〜死(巻三十八)
    "xixia-huanzong": (6701, 7016),    # 純祐(桓宗)。嗣立〜安全による廃位(巻三十九)
    "xixia-xiangzong": (6949, 7247),   # 安全(襄宗)。簒奪〜死(明記なし、遵頊即位直前まで)
    "xixia-shenzong": (7067, 7573),    # 遵頊(神宗)。嗣立〜徳旺への譲位〜太上皇として死
    "xixia-xianzong": (7465, 7573),    # 徳旺(献宗)。父帝からの譲位〜死(遵頊と区間重複)
    "xixia-mozhu": (7569, 7647),       # 睍(末主)。嗣立〜モンゴルに降伏・殺害・夏滅亡(巻末まで)
}


def build_xixia():
    lines = XIXIA_FILE.read_text(encoding="utf-8").splitlines()
    out = {}
    for emperor_id, (start, end) in XIXIA_RANGES.items():
        chunk = lines[start - 1:end]
        out[emperor_id] = "\n".join(chunk).strip()
    return out


# 元史本紀（元本朝9名分をここで一括処理。英宗・泰定帝・寧宗・恵宗はそれぞれ
# 単独の巻範囲で足りる。明宗・天順帝・北元昭宗は複雑な交代劇のため build_yuan() 内で個別処理）
# 元史の本紀ディレクトリはファイル名の巻数が絶対巻数と一致する（元史は本紀のみ47巻で完結する例外）。
YUAN_JUAN_MAP = {
    "yuan-shizu": (4, 17),       # 世祖一〜十四
    "yuan-chengzong": (18, 21),  # 成宗一〜四
    "yuan-wuzong": (22, 23),     # 武宗一〜二
    "yuan-renzong": (24, 26),    # 仁宗一〜三
    "yuan-yingzong": (27, 28),   # 英宗一〜二
    "yuan-taidingdi": (29, 30),  # 泰定帝一〜二（末尾に天順帝擁立の1文が付随、下記で天順帝側にも複製）
    "yuan-wenzong": (32, 36),    # 文宗一〜五（天暦の即位→明宗への譲位→明宗急死後の復位まで全て文宗紀）
    "yuan-ningzong": (37, 37),   # 寧宗
    "yuan-huizong": (38, 47),    # 順帝一〜十
}

# 新元史（daizhigev20）。元史に本紀を持たない天順帝の顛末・北元昭宗を補うために使用。
# 行番号は実地確認済み（2026-07-17、grep -nで卷十九・卷二十六の実際の内容開始行を特定）。
# 新元史のTOC（行3〜261）と実内容（行262〜）は別物であることに注意（罠、下記メモ参照）。
XINYUANSHI_TIANSHUNDI_RANGE = (2955, 2993)  # 卷十九(泰定帝紀)末尾: 泰定帝崩御〜天順帝擁立〜上都陥落「少帝不知所終」〜史臣曰
XINYUANSHI_ZHAOZONG_RANGE = (4070, 4101)    # 卷二十六(惠宗四・昭宗): 惠宗崩御の接続部〜昭宗本紀〜史臣曰


def read_xinyuanshi_range(start: int, end: int) -> str:
    lines = XINYUANSHI_FILE.read_text(encoding="utf-8").splitlines()
    return "\n".join(lines[start - 1:end]).strip()


def build_yuan():
    out = {}
    for emperor_id, (start, end) in YUAN_JUAN_MAP.items():
        out[emperor_id] = read_juan_range(YUAN_DIR, start, end)

    # 明宗(コシラ): 独立紀は卷三十一のみだが記述が薄いため、文宗紀二(卷三十三)冒頭に
    # 埋め込まれた明宗の上都到着・宴席・急死の記述と、順帝紀三(卷四十)の後至元六年の
    # 詔（文宗による毒殺を示唆する内容、順帝自身の言葉で明宗の死の経緯を語る）を補足する。
    mingzong_main = read_juan_range(YUAN_DIR, 31, 31)
    wenzong_er = read_html(index_juan_dir(YUAN_DIR)[33])
    mingzong_death_excerpt = slice_between(
        wenzong_er, "八月乙酉朔，明宗次于王忽察都。",
        "燕铁木儿以明宗后之命，奉皇帝宝授于帝，遂还。")
    shundi_san = read_html(index_juan_dir(YUAN_DIR)[40])
    mingzong_edict_excerpt = slice_between(
        shundi_san, "昔我皇祖武宗皇帝升遐之后",
        "其以明里董阿等明正典刑。")
    out["yuan-mingzong"] = "\n\n".join(
        [mingzong_main, mingzong_death_excerpt, mingzong_edict_excerpt])

    # 天順帝(アリギバ/阿速吉八): 元史に独立紀を持たず、泰定帝紀二(卷三十)末尾の
    # 「九月，倒剌沙立皇太子为皇帝，改元天顺，诏天下。」の1文のみ（yuan-taidingdiと重複許容）。
    # 新元史 卷十九(泰定帝紀)末尾には泰定帝崩御〜天順帝擁立〜上都陥落〜
    # 「少帝不知所终」までのやや詳しい記述があるため併記する。
    tianshundi_yuanshi = read_juan_range(YUAN_DIR, 30, 30)
    tianshundi_xinyuanshi = read_xinyuanshi_range(*XINYUANSHI_TIANSHUNDI_RANGE)
    out["yuan-tianshundi"] = tianshundi_yuanshi + "\n\n" + tianshundi_xinyuanshi

    # 北元 昭宗(アユルシリダラ): 元史(明が編纂)は恵宗(順帝)の崩御までしか記さないため
    # 対象外。新元史 卷二十六(惠宗四・昭宗)が唯一の一次史料。
    out["beiyuan-zhaozong"] = read_xinyuanshi_range(*XINYUANSHI_ZHAOZONG_RANGE)
    return out


def build_yuanmo():
    """元末群雄6名。明史列伝のみに記述があり本紀を持たない（明史は元末群雄を
    「僭偽」として列伝に格下げしているため）。第十章(絶対巻122)・第十一章(絶対巻123)の
    2ファイルでほぼ全員をカバーする。"""
    out = {}

    # 韓林児(宋・小明王): 第十章、郭子興との合伝の後半部分
    juan10 = read_html(MING_LIEZHUAN_DIR / "第十章-卷十-原文.html")
    hanlin_er = slice_from(juan10, "韩林儿，栾城人")
    # 死去(廖永忠による溺死事件)の詳細は第十七章(絶対巻129、廖永忠伝)を補足
    juan17 = read_html(MING_LIEZHUAN_DIR / "第十七章-卷十七-原文.html")
    liaoyongzhong_excerpt = slice_between(
        juan17, "初，韩林儿在滁州，太祖遣永忠迎归应天，至瓜步覆其舟死",
        "赐死，年五十三。")
    out["yuanmo-hanlin-er"] = hanlin_er + "\n\n" + liaoyongzhong_excerpt

    # 徐寿輝(天完)・陳友諒(陳漢)・陳理: 第十一章冒頭、陳友諒伝に徐寿輝の記述が
    # 埋め込まれているため徐寿輝・陳友諒は同一区間を共有（重複許容）。
    juan11 = read_html(MING_LIEZHUAN_DIR / "第十一章-卷十一-原文.html")
    chen_part, chenli_rest = split_at(juan11, "子理既还武昌")
    out["yuanmo-xushouhui"] = chen_part
    out["yuanmo-chenyouliang"] = chen_part
    chenli_part, _ = split_at(chenli_rest, "熊天瑞者")
    out["yuanmo-chenli"] = chenli_part

    # 明玉珍(夏)・明昇: 同じく第十一章内、陳友諒伝の後に続く
    mingyuzhen_onward = slice_from(juan11, "明玉珍，随州人。")
    mingyuzhen_part = mingyuzhen_onward[:mingyuzhen_onward.index("子升嗣")].strip()
    out["yuanmo-mingyuzhen"] = mingyuzhen_part
    out["yuanmo-mingsheng"] = slice_from(juan11, "子升嗣")
    return out


def build_qin_xinmo_gengshi_jin():
    """秦2名・新末群雄5名・玄漢(更始)1名・西晋(趙王倫)1名の計9名。
    史記・漢書・後漢書列伝・晋書帝紀から抽出する。"""
    out = {}

    # 秦始皇・二世: 史記 秦始皇本紀(第六章)を「二世皇帝元年，年二十一」で分割
    qinshihuang_full = read_html(SHIJI_BENJI_DIR / "第六章-秦始皇本纪-原文.html")
    shihuang_part, ershi_part = split_at(qinshihuang_full, "二世皇帝元年，年二十一")
    out["qin-shi-huang"] = shihuang_part
    out["qin-er-shi"] = ershi_part

    # 更始帝(劉玄)・劉盆子: 後漢書 列伝第一章「劉玄劉盆子列傳」を分割
    gengshi_full = read_html(HOUHAN_LIEZHUAN_DIR / "第一章-刘玄刘盆子列传-原文.html")
    gengshi_part, penzi_part = split_at(gengshi_full, "刘盆子者，太山式人")
    out["gengshi-di"] = gengshi_part
    out["liu-penzi"] = penzi_part

    # 公孫述: 後漢書 列伝第三章「隗囂公孫述列傳」の後半
    gongsunshu_full = read_html(HOUHAN_LIEZHUAN_DIR / "第三章-隗嚣公孙述列传-原文.html")
    out["gongsun-shu"] = slice_from(gongsunshu_full, "公孙述字子阳")

    # 王莽: 漢書 傳第七十五〜七十七章(王莽傳上中下)
    wangmang_files = [
        "第七十五章-王莽传上-原文.html",
        "第七十六章-王莽传中-原文.html",
        "第七十七章-王莽传下-原文.html",
    ]
    out["wang-mang"] = "\n\n".join(read_html(HANSHU_ZHUAN_DIR / f) for f in wangmang_files)

    # 劉永(梁王): 後漢書 列伝第二章「王劉張李彭盧列傳」の一部
    liuyong_file = read_html(HOUHAN_LIEZHUAN_DIR / "第二章-王刘张李彭卢列传-原文.html")
    start = liuyong_file.index("刘永者，梁郡睢阳人")
    end = liuyong_file.index("张步字文公")
    out["liu-yong-liang"] = liuyong_file[start:end].strip()

    # 袁術: 後漢書 列伝第七十章「劉焉袁術呂布列傳」の一部
    yuanshu_file = read_html(HOUHAN_LIEZHUAN_DIR / "第七十章-刘焉袁术吕布列传-原文.html")
    start = yuanshu_file.index("袁术字公路")
    end = yuanshu_file.index("吕布字奉先")
    out["yuan-shu"] = yuanshu_file[start:end].strip()

    # 司馬倫(趙王倫): 晋書 帝紀第四章(惠帝紀)に埋め込まれた簒奪の記述
    huidi_full = read_html(JIN_BENJI_DIR / "第四章--原文.html")
    out["jin-simalun"] = slice_between(
        huidi_full, "永宁元年春正月乙丑，赵王伦篡帝位",
        "诛赵王伦、义阳王威、九门侯质等及伦之党与。")

    return out


def build_wuhu_shiliuguo():
    """五胡十六国21名。daizhigev20の晋書載記(晋书.txt)を主典拠とし、
    載記に記述が薄い人物は十六国春秋・資治通鑑(いずれもdaizhigev20)で補う。"""
    out = {}
    jinshu = DAIZHI_JINSHU_FILE.read_text(encoding="utf-8")

    # 前涼 張祚
    start = jinshu.index("祚字太伯")
    end = jinshu.index("玄靓字元安")
    out["qianliang-zhangzuo"] = jinshu[start:end].strip()

    # 前趙 劉淵(元海)
    out["qianzhao-liuyuan"] = slice_between(
        jinshu, "刘元海，新兴匈奴人",
        "在位六年，伪谥光文皇帝，庙号高祖，墓号永光陵。子和立。")

    # 前趙 劉和
    out["qianzhao-liuhe"] = slice_between(jinshu, "和字玄泰", "锐、攸枭首通衢。")

    # 前趙 劉聡
    out["qianzhao-liucong"] = slice_between(
        jinshu, "刘聪，字玄明",
        "太兴元年，聪死，在位九年，伪谥曰昭武皇帝，庙号烈宗。")

    # 前趙 劉粲
    out["qianzhao-liucan"] = slice_between(
        jinshu, "粲字士光", "升其光极前殿，下使甲士执粲，数而杀之。")

    # 前趙 劉曜
    out["qianzhao-liuyao"] = slice_between(jinshu, "刘曜，字永明", "曜在位十年而败。")

    # 成漢 李勢
    out["chenghan-lishi"] = slice_between(
        jinshu, "势字子仁，寿之长子也", "升平五年，死于建康。在位五年而败。")

    # 後趙 石虎(石季龍)
    out["houzhao-shihu"] = slice_between(
        jinshu, "石季龙，勒之从子也",
        "季龙始以咸康元年僭立，至此太和六年，凡在位十五岁。")

    # 後趙 石遵
    out["houzhao-shizun"] = slice_between(jinshu, "石遵闻季龙之死", "世凡立三十三日。")

    # 後趙 石鑑
    out["houzhao-shijian"] = slice_between(jinshu, "鉴乃僭位", "鉴在位一百三日。")

    # 後趙 石祗
    out["houzhao-shizhi"] = slice_between(jinshu, "石祗闻鉴死", "闵命焚祗首于通衢。")

    # 前秦 苻丕
    out["qianqin-fupi"] = slice_between(jinshu, "苻丕，字永叔", "丕在位二年而败。")

    # 夏 赫連勃勃
    out["xia-helianbobo"] = slice_between(
        jinshu, "赫连勃勃，字屈孑", "在位十三年而宋受禅，以宋元嘉二年死。")

    # 後燕 慕容詳・慕容麟: 晋書載記二十四(慕容宝・盛・熙・雲合巻)に同居するため
    # 「复僭称尊号」を境に分割。麟の死去(南燕・慕容徳のもとで賜死)は載記二十七に別途記述。
    idx_xiang = jinshu.index("详僭称尊号")
    idx_lin = jinshu.index("复僭称尊号")
    out["houyan-murongxiang"] = jinshu[idx_xiang:idx_lin].strip()
    idx_lin_end = jinshu.index("麟乃奔鄴。") + len("麟乃奔鄴。")
    lin_part = jinshu[idx_lin:idx_lin_end].strip()
    lin_death = slice_between(jinshu, "慕容麟以为已瑞", "事觉，赐死。")
    out["houyan-muronglin"] = lin_part + "\n\n" + lin_death

    # 西燕 慕容沖: 晋書載記十四(苻堅下)に埋め込み+資治通鑑で死去を補足
    idx_chong = jinshu.index("平阳太守慕容冲起兵河东")
    idx_chong_end = jinshu.index("泓于是进向长安，改年曰燕兴。") + len("泓于是进向长安，改年曰燕兴。")
    chong_part = jinshu[idx_chong:idx_chong_end].strip()
    zztj = ZIZHI_TONGJIAN_FILE.read_text(encoding="utf-8")
    chong_death = slice_between(zztj, "西燕主冲乐在长安", "改元昌平。")
    out["xiyan-murongchong"] = chong_part + "\n\n[資治通鑑]\n" + chong_death

    # 西燕 慕容瑤・慕容忠: 晋書・十六国春秋に独立記述なし。資治通鑑の同一段落を共有。
    zztj_lines = zztj.splitlines()
    shared_yao_zhong = zztj_lines[9413].strip()  # 1-indexed 行9414
    out["xiyan-murongyao"] = shared_yao_zhong
    zhong_context = slice_between(jinshu, "刁云杀慕容忠", "称籓于垂。")
    out["xiyan-murongzhong"] = shared_yao_zhong + "\n\n[晋書載記十五 苻丕苻登]\n" + zhong_context

    # 西燕 慕容永: 晋書載記十五(苻丕苻登)に記述
    out["xiyan-murongyong"] = slice_between(jinshu, "刁云杀慕容忠", "丕在位二年而败。")

    # 前秦 苻崇・夏 赫連昌・赫連定: 晋書に記述なし(または一文のみ)のため十六国春秋で補う
    slgcq_lines = SHILIUGUO_CHUNQIU_FILE.read_text(encoding="utf-8").splitlines()
    out["qianqin-fuchong"] = slgcq_lines[598].strip()  # 巻四十 前秦録九、行599(1-indexed)
    out["xia-helianchang"] = "\n".join(slgcq_lines[1186:1190]).strip()  # 巻六十七 夏録二、行1187-1190
    out["xia-heliading"] = "\n".join(slgcq_lines[1193:1197]).strip()  # 巻六十八 夏録三、行1194-1197

    return out


def build_nanbeichao():
    """南北朝17名。china-historyの本紀(宋書・南斉書・魏書・北史)を優先し、
    列伝が主典拠の人物・china-historyに列伝が収録されていない書は
    daizhigev20の該当書.txtを使う。"""
    out = {}

    # 梁 豫章王(蕭棟): 簡文帝紀(卷四、擁立の記述)+元帝紀(卷五冒頭、殺害の記述)
    juan4 = read_kanji_juan_file(LIANGSHU_DIR, 4)
    juan5 = read_kanji_juan_file(LIANGSHU_DIR, 5)
    end_marker = "硃买臣密害豫章嗣王栋，及其二弟桥、樛，世祖志也。"
    end_idx = juan5.index(end_marker) + len(end_marker)
    out["liang-yuzhangwang"] = juan4 + "\n\n" + juan5[:end_idx].strip()

    # 後梁(西梁) 蕭琮: china-historyに隋書列伝なし。daizhi 隋書.txt 卷七十九(外戚)。
    suishu = DAIZHI_SUISHU_FILE.read_text(encoding="utf-8")
    out["houliang-houzhu"] = slice_between(suishu, "琮字温文", "未几而卒。赠左光禄大夫。")

    # 陳 文帝: 陳書 卷三(独立した一巻)
    out["chen-wendi"] = read_kanji_juan_file(CHENSHU_DIR, 3)

    # 劉宋 劉劭(元凶): china-historyに宋書列伝なし。daizhi 宋書.txt 卷九十九「二凶」。
    songshu = DAIZHI_SONGSHU_FILE.read_text(encoding="utf-8")
    out["liu-song-liushao"] = slice_between(
        songshu, "元凶劭，字休远，文帝长子也。", "乃斩劭于牙下。临刑叹曰：“不图宗室一至于此。”")

    # 梁 蕭正德(臨賀王): daizhi 梁書.txt 卷五十五
    liangshu = DAIZHI_LIANGSHU_FILE.read_text(encoding="utf-8")
    out["liang-xiaozhengde"] = slice_between(
        liangshu, "临贺王正德，字公和", "正德有怨言，景闻之，虑其为变，矫诏杀之。")

    # 梁 侯景: daizhi 梁書.txt 卷五十六(侯景単独伝、梁書最終巻)
    out["liang-houjing"] = slice_between(liangshu, "侯景，字万景", "果以盐封其尸。")

    # 梁 蕭淵明(貞陽侯): 南史は避諱により「蕭明」と表記。南史 卷八(敬帝紀)に埋め込み。
    nanshi_juan8 = read_kanji_juan_file(NANSHI_DIR, 8)
    out["liang-xiaoyuanming"] = slice_between(
        nanshi_juan8, "七月辛丑，僧辩纳贞阳侯萧明，自采石济江。", "五月癸未，太傅建安公萧明薨。")

    # 梁 蕭荘(永嘉王): china-historyに北斉書列伝なし。daizhi 北斉書.txt 卷三十三(欠巻のため北史から補完された短文)。
    beiqishu = DAIZHI_BEIQISHU_FILE.read_text(encoding="utf-8")
    out["liang-xiaozhuang"] = slice_between(
        beiqishu, "梁将王琳在江上与霸先相抗", "庄在邺饮气而死。")

    # 北魏 拓跋余(南安王): 魏書 帝紀第四章(世祖紀下)末尾
    shizu_xia = read_html(WEISHU_BENJI_DIR / "第四章-卷四-原文.html")
    out["beiwei-tuobayu"] = slice_between(
        shizu_xia, "中常侍宗爱矫皇后令，杀东平王翰，迎南安王余入而立之",
        "冬十月丙午朔，余为宗爱所贼。殿中尚书长孙渴侯与尚书陆丽迎立皇孙，是为高宗焉。")

    # 北魏 幼主(元釗): 魏書 帝紀第九章(粛宗紀)末尾。河陰の変で死去。
    suzong = read_html(WEISHU_BENJI_DIR / "第九章-卷九-原文.html")
    out["beiwei-youzhu-yuanzhao"] = slice_between(
        suzong, "甲寅，皇子即位，大赦天下。", "庚子，皇太后、幼主崩。")

    # 北魏 元曄(長広王): 孝荘紀(卷十)末尾の擁立記述+前廢帝紀(卷十一)冒頭の廃位・死去記述
    xiaozhuang = read_html(WEISHU_BENJI_DIR / "第十章-卷十-原文.html")
    yuanye_part1 = slice_between(
        xiaozhuang, "壬申，尔朱世隆停建兴之高都", "戊申，元晔大赦天下。")
    qianfeidi = read_html(WEISHU_BENJI_DIR / "第十一章-卷十一-原文.html")
    yuanye_part2 = slice_between(
        qianfeidi, "及庄帝崩，尔朱世隆等以元晔疏远", "甲辰，安定王朗及东海王晔坐事死。")
    out["beiwei-yuanye"] = yuanye_part1 + "\n\n" + yuanye_part2

    # 北魏 元顥(北海王詳の子、南朝に擁立された簒奪皇帝): 魏書 列伝第九章(献文六王上)
    xianwen_liuwang = read_html(WEISHU_LIEZHUAN_DIR / "第九章-卷九-原文.html")
    out["beiwei-yuanhao"] = slice_between(
        xianwen_liuwang, "子颢，字子明，袭。", "武定中，子娑罗袭。齐受禅，爵例降。")

    # 北斉 後主(高緯): 即位〜滅亡は北斉書卷八(後主紀)全体、死去は北斉書に記述なしのため周書卷六(武帝紀下)で補う
    houzhu = read_kanji_juan_file(BEIQISHU_DIR, 8)
    zhoushu_juan6 = read_kanji_juan_file(ZHOUSHU_DIR, 6)
    houzhu_death = zhoushu_juan6[
        zhoushu_juan6.index("是月，诛温国公高纬。"):
        zhoushu_juan6.index("是月，诛温国公高纬。") + len("是月，诛温国公高纬。")]
    out["beiqi-houzhu"] = houzhu + "\n\n[周書 武帝紀下]\n" + houzhu_death

    # 北斉 安徳王高延宗: china-historyに北斉書列伝なし。daizhi 北斉書.txt 卷十一(文襄六王)。
    out["beiqi-andewang-gaoyanzong"] = slice_between(
        beiqishu, "安德王延宗，文襄第五子也。", "明年，李妃收殡之。")

    # 北斉 范陽王高紹義(JSON上のid名は beiqi-gaoxie だが実体は高紹義): china-historyに
    # 北史列伝なし。daizhi 北史.txt 卷五十二。
    beishi = DAIZHI_BEISHI_FILE.read_text(encoding="utf-8")
    out["beiqi-gaoxie"] = slice_between(beishi, "范阳王绍义，文宣第三子也。", "竟死蜀中。")

    # 西魏 廃帝(元欽)・恭帝(拓跋廓/元廓): 北史 卷五(西魏文帝紀の続き)。
    # 魏書は西魏の本紀を立てないため北史を使う(既存の運用ルール)。
    beishi_juan5 = read_kanji_juan_file(BEISHI_DIR, 5)
    out["xiwei-feidi-yuanqin"] = slice_between(
        beishi_juan5, "废帝讳钦，文皇帝之长子也。", "不听，故及于辱。")
    out["xiwei-gongdi"] = slice_between(
        beishi_juan5, "恭皇帝讳廓，文皇之第四子也。", "十二月庚子，帝逊位于周。周闵帝元年正月，封帝为宋公，寻殂。")

    return out


def build_mingqing_zhuanti():
    """明清交替期の残存政権・群雄9名（南明4・順・西・呉周2）。中華帝国（袁世凱）は
    正史範囲外のため対象外（二次資料のみで調査、キャッシュ生成不要）。"""
    out = {}

    # 南明4名: 小腆纪传（daizhigev20/史藏/传记）の紀第一〜第六が各紀に対応。
    # 弘光(紀一・二)=安宗、隆武(紀三前半)=紹宗、紹武(紀三後半、隆武紀に「附」として
    # 同居)=紹武帝、永历(紀四〜六)=昭宗。行番号はdocs/process/CORPUS_NOTES.mdに記録。
    xiaodian_lines = XIAODIAN_ZHUANZHUAN_FILE.read_text(encoding="utf-8").splitlines()
    out["nanming-anzong"] = "\n".join(xiaodian_lines[371:835]).strip()  # 紀一・二 弘光（行372-835）
    juan3 = "\n".join(xiaodian_lines[835:1007]).strip()  # 紀三 隆武（附紹武）（行836-1007）
    zongzong_part, shaowudi_part = split_at(juan3, "绍武讳聿")
    out["nanming-zongzong"] = zongzong_part
    out["nanming-shaowudi"] = shaowudi_part
    out["nanming-zhaozong"] = "\n".join(xiaodian_lines[1007:1639]).strip()  # 紀四〜六 永历（行1008-1639）

    # 順（李自成）・西（張献忠）: 明史（daizhigev20/史藏/正史、china-historyには列伝が
    # 収録されていないため daizhi 版を使用）列传第一百九十七「流贼」（行22982-23049）を共有。
    mingshi_lines = DAIZHI_MINGSHI_FILE.read_text(encoding="utf-8").splitlines()
    liuzei = "\n".join(mingshi_lines[22981:23049]).strip()
    out["shun-lichengzheng"] = liuzei
    out["xi-zhangxianzhong"] = liuzei

    # 呉周2名（呉三桂・呉世璠）: 清史稿 列传二百六十一（呉三桂・耿精忠・尚之信・
    # 孙延龄合伝、行23380-23441）を共有。呉世璠は三桂没後の後継として同伝内に記述。
    qing_lines = QING_FILE.read_text(encoding="utf-8").splitlines()
    wuzhou = "\n".join(qing_lines[23379:23441]).strip()
    out["wuzhou-wusangui"] = wuzhou
    out["wuzhou-wushifan"] = wuzhou
    return out


def main():
    CACHE_DIR.mkdir(exist_ok=True)
    results = {}
    results.update(build_ming())
    results.update(build_qing())
    results.update(build_han())
    results.update(build_houhan())
    results.update(build_wudai())
    results.update(build_shiguo())
    results.update(build_song())
    results.update(build_beisongmo())
    results.update(build_liao())
    results.update(build_jin())
    results.update(build_xixia())
    results.update(build_yuan())
    results.update(build_yuanmo())
    results.update(build_mingqing_zhuanti())
    results.update(build_qin_xinmo_gengshi_jin())
    results.update(build_wuhu_shiliuguo())
    results.update(build_nanbeichao())
    for emperor_id, text in results.items():
        (CACHE_DIR / f"{emperor_id}.txt").write_text(text, encoding="utf-8")
        print(f"{emperor_id}: {len(text)} chars")


if __name__ == "__main__":
    main()
