#!/usr/bin/env python3
"""kinship.json の note 内引用スパン（「…」）の遡及実在チェック（機械照合のみ・判定なし）。

_corpus_cache/*.txt 全部＋必要な china-history フォールバックを正規化して突合する。
中略（……）は断片に分割し、各断片が単体でヒットすることを要求する（引用規約3項）。
"""
import json, re, sys, glob, os
sys.path.insert(0, os.path.join(os.getcwd(), "scripts"))
from hanzi_norm import norm_for_match

FALLBACKS = [
    # フェーズ2ブロック22: 明史巻120諸王五（神宗諸子=福王常洵・桂王常瀛。daizhi 側は外字分解で
    # 字面が合わない箇所あり）・小腆纪传（陳奇瑜伝の器墭毒殺異説）
    "china-history/明史/列传/第八章-卷八-原文.html",
    "daizhigev20/史藏/传记/小腆纪传.txt",
    # フェーズ2ブロック21: 明史（追尊皇帝合伝=巻115列传第三の興宗・睿宗記事、礼志の仁祖追尊記事。
    # キャッシュは本紀抜粋のみのため）
    "daizhigev20/史藏/正史/明史.txt",
    "china-history/明史/列传/第三章-卷三-原文.html",
    # フェーズ2ブロック20: 元史（順帝紀の立太子記事・追尊皇帝合伝=巻115等。china-history 元史は
    # 列传ディレクトリが無く daizhi 必須）・新元史（泰定帝諸子記事・昭宗本紀等）
    "daizhigev20/史藏/正史/元史.txt",
    "daizhigev20/史藏/正史/新元史.txt",
    # フェーズ2ブロック1: 漢書列伝（宣元六王伝・外戚伝）・史記（呂不韋列伝・高祖本紀）・
    # 武帝紀の断句なし字面（前汉书.txt）引用
    "daizhigev20/史藏/正史/汉书.txt",
    "daizhigev20/史藏/正史/前汉书.txt",
    "daizhigev20/史藏/正史/史记.txt",
    # フェーズ2ブロック1: 二世皇帝エッジ note の索隠注引用（三家注は本文コーパスに含まれない）
    "daizhigev20/史藏/正史/史记集解三家注索隐正义.txt",
    # フェーズ2ブロック2: 後漢書列伝（章帝八王伝・宗室四王三侯伝・皇后紀・袁術伝等）の
    # ブリッジ人物引用（キャッシュは本紀抜粋のみのため。章帝八王伝は daizhi 側に
    # 当該字面が無く china-history 個別ファイルが必要）
    "daizhigev20/史藏/正史/后汉书.txt",
    "china-history/后汉书/列传/第四十八章-章帝八王列传-原文.html",
    # ブロック1・2の既存引用で必要になった china-history ファイル（前回シロ確認済み）
    "china-history/汉书/传/第四十章-霍光金日磾传-原文.html",
    "china-history/汉书/传/第三十四章-武五子传-原文.html",
    "china-history/史记/十二本纪/第九章-吕太后本纪-原文.html",
    "china-history/后汉书/本纪/第十一章-皇后纪上-原文.html",
    "china-history/后汉书/本纪/第十二章-皇后纪下-原文.html",
    "china-history/汉书/传/第二十三章-景十三王传-原文.html",
    # フェーズ2b（maternalLineage）ブロック1: 漢書外戚傳上・下（前漢の生母の裏取り本命。
    # daizhi 汉书.txt/前汉书.txt は四庫本系統で「皃」等の字体・「防」置換破損があり
    # 当該字面がヒットしない）
    "china-history/汉书/传/第七十二章-外戚传上-原文.html",
    "china-history/汉书/传/第七十三章-外戚传下-原文.html",
    # 追加調査（申し送り2件）: 孺子嬰の宣帝→楚孝王囂→広戚炀侯勋→広戚侯顕→嬰の実父鎖
    #   （宣元六王伝＝広戚侯の封建・世襲記事）／劉盆子の漢宗室系譜主張（高五王伝＝斉悼恵王肥・
    #   城陽景王章の出自）。王子侯表は china-history では「表略」の欠落スタブで使えない。
    "china-history/汉书/传/第五十二章-宣元六王传-原文.html",
    "china-history/汉书/传/第八章-高五王传-原文.html",
    # フェーズ2b ブロック2: 後漢の生母裏取りで使う列伝・四庫本
    # （樊宏阴识列传=光武帝生母樊氏／梁统列传=和帝生母梁貴人の父竦追封／
    #  后汉书四库.txt=更始帝の李賢注引『帝王紀』。china-history 側に注は無い）
    "china-history/后汉书/列传/第二十四章-樊宏阴识列传-原文.html",
    "china-history/后汉书/列传/第二十六章-梁统列传-原文.html",
    "daizhigev20/史藏/正史/后汉书四库.txt",
    # ブロック3: 曹丕エッジの三国志后妃伝引用（キャッシュは文帝紀のみのため）
    "daizhigev20/史藏/正史/三国志.txt",
    # フェーズ2ブロック3: 魏武文世王公伝（曹霖・曹宇）・呉妃嬪伝/呉主五子伝（孫和）の
    # ブリッジ人物引用（daizhi 三国志.txt は「会→防」等の系統的破損で当該字面がヒットしない）
    "china-history/三国志/魏书/第二十章-武文世王公传-原文.html",
    "china-history/三国志/吴书/第五章-妃嫔传-原文.html",
    "china-history/三国志/吴书/第十四章-吴主五子传-原文.html",
    # フェーズ2b ブロック3: 三国の生母裏取り本命（魏書后妃傳・蜀書二主妃子傳）と
    # 蜀書趙雲傳（甘夫人＝後主生母を「即后主母也」と明記する裏取り）。
    # daizhi 三国志.txt は「防」置換破損が広範で当該字面がヒットしない
    "china-history/三国志/魏书/第五章-后妃传-原文.html",
    "china-history/三国志/蜀书/第四章-二主妃子传-原文.html",
    "china-history/三国志/蜀书/第六章-关张马黄赵传-原文.html",
    # フェーズ2b ブロック4: 晉書 后妃傳上下（晋の生母裏取り本命。列傳ディレクトリは
    # ファイル名が相対番号＝絶対巻数−30で、第一章＝巻31 后妃傳上・第二章＝巻32 后妃傳下）
    "china-history/晋书/列传/第一章--原文.html",
    "china-history/晋书/列传/第二章--原文.html",
    # フェーズ2ブロック5: 宋書列伝（桂陽王休範伝等）・南齊書列伝（文恵太子伝・宗室伝・
    # 皇后伝・礼志）のブリッジ人物引用（キャッシュは本紀抜粋のみのため）
    "daizhigev20/史藏/正史/宋书.txt",
    "daizhigev20/史藏/正史/南齐书.txt",
    "daizhigev20/史藏/正史/北齐书.txt",
    "daizhigev20/史藏/正史/北史.txt",
    # ブロック4: 司馬倫エッジの晋書列伝二十九（趙王倫伝）引用（キャッシュは恵帝紀抜粋のみのため）
    "daizhigev20/史藏/正史/晋书.txt",
    # ブロック6: 梁系エッジの南史（宗室伝・梁武帝諸子）・周書巻48・梁書・陳書列伝引用
    "daizhigev20/史藏/正史/南史.txt",
    "daizhigev20/史藏/正史/周书.txt",
    "daizhigev20/史藏/正史/梁书.txt",
    "daizhigev20/史藏/正史/陈书.txt",
    "daizhigev20/史藏/正史/隋书.txt",
    "daizhigev20/史藏/正史/旧唐书.txt",
    "daizhigev20/史藏/正史/新唐书.txt",
    "daizhigev20/史藏/编年/续资治通鉴.txt",
    "china-history/辽史/列传/第二章-卷二-原文.html",
    # ブロック13: 唐エッジの新唐書引用（旧唐書キャッシュに含まれない紀・伝）
    "daizhigev20/史藏/正史/新唐书.txt",
    # ブロック15: 五代エッジの新五代史（本紀・家人伝）・旧五代史（武皇紀=李克用）引用
    "daizhigev20/史藏/正史/新五代史.txt",
    "daizhigev20/史藏/正史/旧五代史.txt",
    # ブロック16: 十国のブリッジ人物（楊隆演・劉隠・王延翰）・南漢/閩エッジの十国春秋引用
    "daizhigev20/史藏/载记/十国春秋.txt",
    # ブロック17: 宋エッジの宋史列伝（后妃・趙普・宗室=趙旉）・続資治通鑑長編引用
    "daizhigev20/史藏/正史/宋史.txt",
    "daizhigev20/史藏/编年/续资治通鉴长编.txt",
    # ブロック18: 遼史（西遼付録の正字面）・金史（世紀=烏雅束・列伝）引用
    "daizhigev20/史藏/正史/辽史.txt",
    "daizhigev20/史藏/正史/金史.txt",
    # ブロック20: モンケ（憲宗紀=元史巻三・祭祀志）引用（キャッシュは世祖以降のみ）
    "daizhigev20/史藏/正史/元史.txt",
    # ブロック23: ヌルハチ（清史稿太祖本紀=行3〜101、キャッシュは太宗以降のみ）引用
    "daizhigev20/史藏/正史/清史稿.txt",
    # ブロック7: 十六国の系譜補足引用（華陽国志・十六国春秋・資治通鑑本文/胡三省注）
    "daizhigev20/史藏/载记/华阳国志.txt",
    "daizhigev20/史藏/载记/十六国春秋.txt",
    "daizhigev20/史藏/编年/资治通鉴.txt",
    "daizhigev20/史藏/编年/资治通鉴四库.txt",
    # ブロック8: 燕系の魏書・資治通鑑注（胡三省注）引用
    "daizhigev20/史藏/正史/魏书.txt",
    "daizhigev20/史藏/编年/资治通鉴注.txt",
    # ブロック10: 北魏の北史引用（元愉伝の襲爵等）
    "daizhigev20/史藏/正史/北史.txt",
    # フェーズ3ブロック1: 南康公主の晋中興書佚文（太平御覧巻152所引）・世説新語劉孝標注引
    # 続晋陽秋の引用（cl-jin-huanchu。正史に父帝の直接明記がないケースの準一次典拠）
    "daizhigev20/子藏/类书/太平御览.txt",
    "daizhigev20/子藏/笔记/世说新语.txt",
    "daizhigev20/子藏/笔记/世说新语笺疏.txt",
    # フェーズ3ブロック3: 旧五代史后妃伝（晋后妃伝=永寧公主・周后妃伝=聖穆皇后柴氏。
    # daizhi 旧五代史.txt は全1606行の不完全テキストで后妃列伝を欠くため china-history 必須。
    # 四庫輯本は東都事略注引「庄宗之嫔御」・龍川別志異説注の突合用）
    "china-history/旧五代史/后晋/第十二章-列传一-原文.html",
    "china-history/旧五代史/后周/第十二章-列传一-原文.html",
    # フェーズ2b ブロック15（五代生母）: 後梁/後唐/後漢の后妃列伝（文惠王太后・貞簡曹太后・
    # 宣憲魏太后・昭懿夏氏・昭聖李皇后=李三娘 等）。daizhi 旧五代史.txt は后妃列伝を欠くため必須。
    "china-history/旧五代史/后梁/第十一章-列传一-原文.html",
    "china-history/旧五代史/后唐/第二十五章-列传一-原文.html",
    "china-history/旧五代史/后汉/第六章-列传一-原文.html",
    "daizhigev20/史藏/正史/旧五代史四库.txt",
    # フェーズ3ブロック4（建国根スイープ claims）: wei-wendi の学術的疑義（高堂隆の魏＝舜後論と
    # 蒋済の反駁）は文献通考（宋代政書・二次史料）が典拠。jin-taizu の始祖名異伝
    # 「金九代祖名堪布，号始祖」は洪皓『松漠紀聞』を引く廿二史札記（清・趙翼）が典拠。
    # いずれもローカル daizhigev20 に逐語存在（norm_for_match 完全一致確認済み）。
    "daizhigev20/史藏/政书/文献通考.txt",
    "daizhigev20/史藏/史评/廿二史札记.txt",
]

# 原文引用ではない「」スパン（日本語の語句参照・スキーマenum参照）。照合対象外。
SKIP_SPANS = {
    "同族（遠縁）",
    # 原文引用でない「」スパン（日本語説明・語彙/ラベル参照）
    "秦（始皇帝以降）",          # p-gongsun-ren note の section 語彙言及
    "劉淑 (解瀆亭侯)",           # p-liu-shu note の Wikidata ラベル言及
    # 維基文庫で実在確認済みの正当引用（ローカルコーパスが李賢注を未収録のため照合不能。
    # 後漢書巻一一 李賢注引『帝王紀』・フェーズ2ブロック2 gengshi-di 調査。
    # 2026-07-23 メイン会話の WebFetch で zh.wikisource.org 後漢書/卷11 の逐語実在を再検証済み）
    "利生子張，納平林何氏女，生更始",
    "舂陵戴侯熊渠生蒼梧太守利，利生子張，納平林何氏女，生更始",
    # 維基文庫で実在確認済みの正当引用（南明史稿はローカルコーパス非収録。
    # p-zhu-changxun の廟号恭宗の典拠・フェーズ2ブロック22 nanming-anzong 調査。
    # 2026-07-23 メイン会話の WebFetch で zh.wikisource.org/zh-hans/南明史稿/卷026 の逐語実在を検証済み）
    "昭宗即位，加上尊谥曰恭宗慕天敷道贞纯肃哲修文显武圣敬仁毅孝皇帝",
    # 維基文庫で実在確認済みの正当引用（daizhi 清史稿は言偏字の系統破損で「奕譞」が全箇所「奕枻」。
    # qing-xuanzong→p-yixuan エッジの正字引用・フェーズ2ブロック23 qing-dezong 調査。
    # 2026-07-23 メイン会話の WebFetch で zh.wikisource.org 清史稿/卷23 の逐語実在を検証済み）
    "本生父醇賢親王奕譞，宣宗第七子",
    # 維基文庫で実在確認済みの正当引用（建康実録はローカルコーパス非収録。
    # p-nankang-gongzhu=南康公主の明帝女典拠の傍証・フェーズ3ブロック1 cl-jin-huanchu 調査。
    # 2026-07-24 メイン会話の WebFetch で zh.wikisource.org 建康實錄/卷09 の
    # 「尚明帝南康長公主，拜駙馬都尉」（繁体）逐語実在を検証済み）
    "尚明帝南康长公主",
    # 維基文庫で実在確認済みの正当引用（清史稿公主表=巻166は daizhi 側が「表略」で本文非収録。
    # p-kechun-gongzhu=恪純長公主（建寧公主・呉応熊室）関連・フェーズ3ブロック3 cl-qing-wuzhou 調査。
    # 2026-07-24 メイン会話の WebFetch で zh.wikisource.org 清史稿/卷166 の逐語実在を7スパン検証済み
    # （うち「德六年十二月生…」はエージェント取得時の「崇」欠落と判明し、実物どおり
    # 「崇德六年十二月生…」へ note 側を訂正のうえ登録）
    "太宗第十四女",
    "庶妃察哈爾奇壘氏生",
    "初封和碩公主。順治十四年，進和碩長公主。十六年，封建寧長公主。復改恪純長公主",
    "順治十年八月，下嫁吳應熊",
    "崇德六年十二月生，康熙四十三年十二月薨，歲六十三",
    "主以夫被誅，聖祖常慰藉之。嘗有疾，手詔宣諭，謂主為叛寇所累。久之乃薨",
    "十四年，併其子世霖皆誅死",
}

corpus = []
for path in sorted(glob.glob("_corpus_cache/*.txt")) + FALLBACKS:
    try:
        with open(path, encoding="utf-8") as f:
            corpus.append((path, norm_for_match(f.read())))
    except FileNotFoundError:
        print(f"WARN: corpus missing {path}")

with open("data/kinship.json", encoding="utf-8") as f:
    kin = json.load(f)

spans = []  # (owner, span)
for e in kin["edges"]:
    for m in re.findall(r"「([^」]+)」", e.get("note", "")):
        spans.append((f"edge {e['from']}→{e['to']}", m))
for p in kin["persons"]:
    for m in re.findall(r"「([^」]+)」", p.get("note", "")):
        spans.append((f"person {p['id']}", m))
for c in kin.get("genealogicalClaims", []):
    for field in (c.get("note", ""), c.get("claimedAncestry", "")):
        for m in re.findall(r"「([^」]+)」", field):
            spans.append((f"claim {c['claimant']}", m))

KANA_RE = re.compile(r"[ぁ-んァ-ン]")
ok = nf = skip = 0
for owner, span in spans:
    if span in SKIP_SPANS or KANA_RE.search(span):
        skip += 1  # 日本語の説明文・enum参照は原文引用ではない
        continue
    frags = [x for x in re.split(r"…+|\.{3,}", span) if x]
    for frag in frags:
        n = norm_for_match(frag)
        if len(n) < 4:  # 短すぎる断片（語単位）は偽陰性が多いので参考扱い
            skip += 1
            continue
        if any(n in text for _, text in corpus):
            ok += 1
        else:
            nf += 1
            print(f"NOT FOUND [{owner}]: {frag}")
print(f"---\nspans={len(spans)} fragments ok={ok} notfound={nf} short-skip={skip}")
sys.exit(1 if nf else 0)
