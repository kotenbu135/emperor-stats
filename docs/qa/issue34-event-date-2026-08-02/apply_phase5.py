#!/usr/bin/env python3
"""Issue #34 フェーズ5: 残り 192 フィールドを 1 件ずつ判定した結果を適用する。

対象は `list_remaining.py` / `make_worksheet.py` が拾う次の 5 クラス:
  C-複数月・C-単一月（note の記述順ではフェーズ2が決められなかったもの）
  干支不在（フェーズ1・2 で機械換算から外したもの）
  日実値・月不一致（`verify_realday_fields.py` で逆変換が note の月と合わなかったもの）
  A-保留（フェーズ3 で対応月を確定できなかった 2 件）

判定の手順（全件共通）:
  1. その端点が指すべき**旧暦月**を note の原文引用と本紀の記事順から決める
  2. 決まった旧暦月を多数月方式で太陽暦へ写し、現在値と比べる
  3. 一致すれば触らない（CONFIRMED_OK）、違えば訂正（RECORDS）、決められなければ保留（UNRESOLVED）

この向き（「正しい旧暦月 → 換算 → 現在値と比較」）で統一したのは、「現在値が未換算か換算済みか」を
先に当てにいくと、**閏月のある年で 2 か月ずれる**ケース（旧暦35年は閏三月があるため 旧暦六月 →
0035-08）を取り違えるため。逆写像は `make_worksheet.py` が補助として出す。

干支不在クラスの扱い（2026-08-02 に決めた）: note の干支が sxtwl の当該旧暦月に実在しないものは、
原典（本紀）に当たると **note の月ラベル自体は原文どおり**であることが多い（後漢書桓帝紀「三年春正月
己未，大赦天下」等）。史書暦と sxtwl の朔・置閏の差なので、**month 精度の値は月ラベル基準で換算する**。
干支は日精度の情報であり、月精度のフィールドの換算根拠にはしない。原典と note の月が食い違っていた
場合だけ note ごと直す（フェーズ1で見つけた `hou-han-huandi` の叔孫無忌がその型）。

使い方:
    python3 .../apply_phase5.py --dry-run
    python3 .../apply_phase5.py --apply
"""
import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from apply_majority_month import DATA_PATH  # noqa: E402

# (id, 指標, index, キー, 旧値, 新値, 根拠)
RECORDS = [
    # ---- バッチ0: 後漢〜三国 ----
    ('hou-han-guangwudi', 'rebellionSuppressionCount', 2, 'endDate', '0027-04-01', '0027-06-01',
     '建武三年夏四月「大破鄧奉于小長安、斬之」＝終了は旧暦四月。旧暦27年4月の多数月は 0027-06'),
    ('hou-han-guangwudi', 'rebellionSuppressionCount', 4, 'endDate', '0030-02-01', '0030-04-01',
     '建武六年二月「大司馬呉漢拔朐、獲董憲・龐萌、山東悉平」＝終了は旧暦二月。旧暦30年2月の多数月は 0030-04'),
    ('hou-han-zhangdi', 'rebellionSufferedCount', 2, 'endDate', '0078-04-01', '0078-05-01',
     'note「翌年四月には臨洮でも撃破して平定」＝建初三年四月。旧暦78年4月の多数月は 0078-05'),
    ('hou-han-shaodi-yi', 'rebellionSufferedCount', 0, 'startDate', '0120-03-01', '0120-04-01',
     '永寧元年三月「車師後王叛，殺部司馬」＝開始は旧暦三月。旧暦120年3月の多数月は 0120-04。'
     '干支不在で除外していたが、note の「三月乙酉」は延光四年（125年）の即位日で別の年の干支だった'),
    ('hou-han-shaodi-yi', 'rebellionSuppressionCount', 0, 'startDate', '0120-03-01', '0120-04-01',
     '同上（同一事象の rebellionSuffered 側と同じ）'),
    ('hou-han-shaodi-yi', 'rebellionSuppressionCount', 0, 'endDate', '0125-07-01', '0125-08-01',
     '延光四年秋七月「西域長史班勇撃車師後王，斬之」＝終了は旧暦七月。旧暦125年7月の多数月は 0125-08。'
     '同一事象の rebellionSuffered[0].endDate は既に 0125-08-01'),
    ('hou-han-chongdi', 'rebellionSufferedCount', 2, 'startDate', '0144-11-01', '0144-12-01',
     '建康元年十一月、九江の徐鳳・馬勉が「無上将軍」を称して蜂起＝開始は旧暦十一月。多数月は 0144-12'),
    ('hou-han-huandi', 'amnestyCount', 7, 'date', '0157-01-01', '0157-02-01',
     '後漢書桓帝紀「三年春正月己未，大赦天下」（永寿三年正月）。旧暦157年1月の多数月は 0157-02。'
     '己未は sxtwl では二月7日に落ちるが、月ラベル基準で換算する（史書暦との朔差）'),
    ('hou-han-xiandi', 'amnestyCount', 3, 'date', '0192-01-01', '0192-02-01',
     '後漢書献帝紀「三年春正月丁丑，大赦天下」（初平三年正月）。旧暦192年1月の多数月は 0192-02。'
     '丁丑は sxtwl では二月18日（朔差）'),
    ('wei-wendi', 'personalCampaignCount', 2, 'startDate', '0225-03-01', '0225-04-01',
     '黄初六年三月辛未「帝為舟師東征」＝開始は旧暦三月。旧暦225年3月の多数月は 0225-04。'
     '辛未は sxtwl では二月24日・閏三月24日（225年は閏三月がある）'),
    ('wei-caofang', 'rebellionSuppressionCount', 0, 'startDate', '0251-04-01', '0251-05-01',
     'note「開始日は原文の丙午（嘉平三年四月）を月精度で近似」＝旧暦四月。多数月は 0251-05。'
     'endDate 0251-06-15 は五月甲寅の実日付で前後関係も保たれる'),
    ('wei-caomao', 'eraChangeCount', 1, 'date', '0256-06-01', '0256-07-01',
     '「甘露元年…夏六月丙午，改元為甘露」＝改元の詔は旧暦六月。多数月は 0256-07'),
    ('wei-yuandi', 'amnestyCount', 3, 'date', '0265-09-01', '0265-10-01',
     '三国志魏書「九月乙未，大赦」（咸熙二年九月）。旧暦265年9月の多数月は 0265-10。'
     '乙未は sxtwl では八月13日（史書は九月の後に閏月を置く＝置閏の差）'),

    # ---- バッチ1: 蜀漢・呉・西晋・東晋前半 ----
    ('shuhan-liushan', 'amnestyCount', 3, 'date', '0243-11-01', '0243-12-01',
     '「六年冬十月，大司馬蔣琬自漢中還，住涪。十一月，大赦」＝大赦は旧暦十一月。多数月は 0243-12'),
    ('shuhan-liushan', 'amnestyCount', 5, 'date', '0249-04-01', '0249-05-01',
     '「十二年春正月……夏四月，大赦」＝旧暦四月。多数月は 0249-05'),
    ('shuhan-liushan', 'amnestyCount', 11, 'date', '0261-10-01', '0261-11-01',
     '「四年春三月……冬十月，大赦」＝旧暦十月。多数月は 0261-11'),
    ('shuhan-liushan', 'eraChangeCount', 0, 'date', '0223-05-01', '0223-06-01',
     '章武三年五月に後主が成都で即位し「大赦、改元」＝旧暦五月。多数月は 0223-06'),
    ('wu-dadi', 'capitalRelocationCount', 1, 'date', '0229-09-01', '0229-10-01',
     '呉主伝「秋九月、権迁都建業」＝旧暦九月。多数月は 0229-10'),
    ('wu-sunliang', 'eraChangeCount', 2, 'date', '0256-10-01', '0256-11-01',
     '冬十月己酉に大赦と同時に「改年」＝旧暦十月。多数月は 0256-11'),
    ('jin-huidi', 'personalCampaignCount', 0, 'startDate', '0304-07-01', '0304-08-01',
     '永興元年七月の北征出陣＝旧暦七月。多数月は 0304-08。'
     'フェーズ4で「endDate 0304-07-30 は己未の実日付」として 0304-08-01 から巻き戻したが、'
     '0304-07-30 を逆変換すると旧暦六月12日で、七月己未の実日付は 0304-09-09。巻き戻し自体が誤りだった'),
    ('jin-huidi', 'personalCampaignCount', 0, 'endDate', '0304-07-30', '0304-08-31',
     '同上。蕩陰の敗績（七月己未＝0304-09-09）も旧暦七月内なので month 精度では 0304-08 に落ちる'),
    ('jin-huidi', 'rebellionSuppressionCount', 1, 'endDate', '0299-01-01', '0299-03-01',
     '元康九年正月に孟観が斉万年を捕獲して鎮圧完了＝旧暦正月。多数月は 0299-03'),
    ('jin-huidi', 'rebellionSuppressionCount', 5, 'startDate', '0306-01-01', '0306-02-01',
     '光熙元年正月に東海王越が祁弘らを派遣＝旧暦正月。多数月は 0306-02'),
    ('jin-huaidi', 'rebellionSuppressionCount', 1, 'startDate', '0307-02-01', '0307-04-01',
     '晋書懐帝紀「二月辛巳，东莱人王弥起兵反」＝旧暦二月。多数月は 0307-04'),
    ('jin-huaidi', 'rebellionSuppressionCount', 1, 'endDate', '0308-05-01', '0308-06-01',
     'note「翌年五月に洛陽を攻めるも司徒王衍が率いる軍に撃退され退却」＝旧暦五月。多数月は 0308-06'),
    ('jin-huaidi', 'rebellionSuppressionCount', 2, 'startDate', '0307-05-01', '0307-07-01',
     '晋書懐帝紀「夏五月，马牧帅汲桑聚众反」＝旧暦五月。多数月は 0307-07'),
    ('jin-huaidi', 'rebellionSuppressionCount', 2, 'endDate', '0307-12-01', '0308-01-01',
     '晋書懐帝紀「十二月戊寅，并州人田兰、薄盛等斩汲桑于乐陵」＝終結は旧暦十二月。多数月は 0308-01。'
     'フェーズ3で「本紀に対応する月の記事が無い」として保留した A の 1 件はこれで解決'),
    ('jin-huaidi', 'rebellionSuppressionCount', 4, 'startDate', '0310-02-01', '0310-03-01',
     '永嘉四年二月に銭璯が反乱＝旧暦二月。多数月は 0310-03'),
    ('jin-huaidi', 'rebellionSuppressionCount', 4, 'endDate', '0310-03-01', '0310-04-01',
     '同年三月に周が討伐し斬殺＝旧暦三月。多数月は 0310-04'),
    ('dongjin-mingdi', 'rebellionSufferedCount', 0, 'startDate', '0323-05-01', '0323-07-01',
     '晋書明帝紀「五月……梁硕攻陷交州，刺史王谅死之」＝明帝代の実害開始は旧暦五月。多数月は 0323-07。'
     'endDate 0323-08-01 は六月（陶侃の高宝が梁碩を斬る）の多数月で現行のまま正しい'),
    ('dongjin-mingdi', 'rebellionSuppressionCount', 0, 'startDate', '0323-05-01', '0323-07-01',
     '同上（同一事象の鎮圧側）'),
    ('dongjin-mingdi', 'rebellionSufferedCount', 3, 'startDate', '0323-01-01', '0323-03-01',
     '晋書明帝紀「太宁元年春正月癸巳……越巂太守李钊、汉嘉太守王载以郡叛，降于骧」＝旧暦正月。多数月は 0323-03。'
     'フェーズ4で「両端の対応月を決められない」として 0323-03-01 から巻き戻した件を、原典で正月と確定して戻す'),
    ('dongjin-mingdi', 'rebellionSufferedCount', 3, 'endDate', '0323-02-01', '0323-03-31',
     '同上。投降は正月の単一記事で、直後の「二月」は元帝の建平陵埋葬の記事＝この事件とは無関係。'
     '開始と同じ旧暦正月に揃える'),
    ('dongjin-chengdi', 'rebellionSufferedCount', 1, 'endDate', '0329-02-01', '0329-03-01',
     '咸和四年正月の苑城帰順で成帝が解放され、二月に蘇逸捕斬で乱が終息。329年は正月・二月とも多数月が 0329-03'),
    ('dongjin-chengdi', 'rebellionSuppressionCount', 1, 'endDate', '0329-02-01', '0329-03-01',
     '咸和四年二月に蘇逸を捕斬＝旧暦二月。多数月は 0329-03'),
    ('dongjin-mudi', 'rebellionSuppressionCount', 1, 'startDate', '0347-04-01', '0347-05-01',
     '永和三年四月に邓定・隗文が挙兵＝旧暦四月。多数月は 0347-05'),

    # ---- バッチ2: 東晋後半・十六国・劉宋 ----
    ('dongjin-feidi', 'rebellionSuppressionCount', 0, 'endDate', '0366-05-01', '0366-07-01',
     '太和元年五月に硃序が成都で司馬勛を撃破し斬った＝旧暦五月。多数月は 0366-07'),
    ('dongjin-andi', 'rebellionSufferedCount', 6, 'endDate', '0405-03-01', '0405-04-01',
     '義熙元年三月に桓振が討たれ安帝が建康へ帰還＝旧暦三月。多数月は 0405-04'),
    ('dongjin-andi', 'rebellionSuppressionCount', 6, 'endDate', '0405-03-01', '0405-04-01',
     '同上（同一事象の鎮圧側）'),
    ('huan-xuan', 'capitalRelocationCount', 0, 'date', '0404-04-01', '0404-05-01',
     '晋書安帝紀「夏四月己丑朔、庚寅、帝至江陵」で桓玄も江陵に入り百官を置いた＝旧暦四月。多数月は 0404-05'),
    ('qianqin-fudeng', 'personalCampaignCount', 0, 'startDate', '0386-11-01', '0386-12-01',
     '太元十一年十一月の即位直後から姚萇との継続的軍事行動を開始＝旧暦十一月。多数月は 0386-12'),
    ('qianqin-fudeng', 'personalCampaignCount', 0, 'endDate', '0393-10-01', '0393-12-01',
     '太元十八年冬十月に姚萇が病没して対戦相手が交代＝旧暦十月。多数月は 0393-12'),
    ('houqin-yaochang', 'rebellionSuppressionCount', 1, 'startDate', '0390-04-01', '0390-05-01',
     '太元十五年四月に雷悪地が魏掲飛の挙兵に呼応して離反＝旧暦四月。多数月は 0390-05。'
     'endDate 0390-05-31 は同じ旧暦四月の月末表記で、これで両端が揃う'),
    ('liu-song-mingdi', 'rebellionSuppressionCount', 0, 'endDate', '0466-12-01', '0467-01-01',
     '宋書明帝紀「十二月己未……辛未，以新除广州刺史刘勔为益州刺史……刘勔克寿阳，豫州平」＝'
     '豫州平定は泰始二年十二月。多数月は 0467-01。フェーズ3で保留した A の残り 1 件がこれで解決'),

    # ---- バッチ3: 南斉・梁・陳 ----
    ('liang-wudi', 'rebellionSuppressionCount', 0, 'endDate', '0502-06-01', '0502-08-01',
     '天監元年六月に陳伯之が魏へ亡命し江州が平定＝旧暦六月。502年は閏月があるため多数月は 0502-08。'
     'startDate 0502-06-01 は五月戊子の挙兵（旧暦五月）の多数月で現行のまま正しい'),
    ('liang-jianwendi', 'rebellionSufferedCount', 0, 'startDate', '0551-08-01', '0551-09-01',
     '大宝二年八月戊午に侯景が簡文帝を廃して幽閉＝旧暦八月。多数月は 0551-09'),
    ('liang-jianwendi', 'rebellionSufferedCount', 0, 'endDate', '0551-10-01', '0551-11-01',
     '同年十月壬寅に永福省で圧殺＝旧暦十月。多数月は 0551-11'),
    ('liang-jingdi', 'rebellionSufferedCount', 0, 'startDate', '0555-10-01', '0555-11-01',
     '紹泰元年十月の杜龕・韋載の挙兵＝旧暦十月。多数月は 0555-11'),
    ('liang-jingdi', 'rebellionSufferedCount', 0, 'endDate', '0556-01-01', '0556-02-01',
     '太平（紹泰二年）正月癸未に杜龕が降伏し賜死＝旧暦正月。多数月は 0556-02'),
    ('liang-jingdi', 'rebellionSuppressionCount', 0, 'startDate', '0555-10-01', '0555-11-01',
     '同上（同一事象の鎮圧側）'),
    ('liang-jingdi', 'rebellionSuppressionCount', 0, 'endDate', '0556-01-01', '0556-02-01',
     '同上（同一事象の鎮圧側）'),
    ('liang-jingdi', 'rebellionSuppressionCount', 4, 'endDate', '0557-05-01', '0557-06-01',
     'note「五月までに余孝頃が丞相府へ降伏し反乱は完全に終息」＝旧暦五月。多数月は 0557-06'),
    ('liang-jingdi', 'rebellionSuppressionCount', 5, 'startDate', '0557-08-01', '0557-09-01',
     '太平二年八月丙申頃に周文育・侯安都へ討伐を命じた＝旧暦八月。多数月は 0557-09'),
    ('houliang-xuandi', 'capitalRelocationCount', 0, 'date', '0555-02-01', '0555-03-01',
     '梁書敬帝紀「四年二月癸丑，至自尋陽，入居朝堂」＝統治拠点の建康復帰は旧暦二月。多数月は 0555-03'),
    ('liang-xiaoji', 'personalCampaignCount', 0, 'startDate', '0552-08-01', '0552-09-01',
     '梁書元帝紀「八月、蕭紀率巴・蜀大衆連舟東下」＝出陣は旧暦八月。多数月は 0552-09'),

    # ---- バッチ4: 北朝（北魏・東魏・北斉初） ----
    ('liang-xiaozhuang', 'personalCampaignCount', 0, 'startDate', '0558-03-01', '0558-04-01',
     'note 末尾が「558年3月の即位から560年2月の敗走まで」と範囲を明示し、その 3 月は北斉書「三月、即帝位于郢州」の'
     '旧暦三月。多数月は 0558-04'),
    ('liang-xiaozhuang', 'personalCampaignCount', 0, 'endDate', '0560-02-01', '0560-03-01',
     '同 note の「560年2月の敗走」＝旧暦二月。多数月は 0560-03'),
    ('beiwei-xiaowendi', 'amnestyCount', 6, 'date', '0483-05-01', '0483-06-01',
     '魏書高祖紀「夏四月庚子……壬寅，车驾还宫。闰月癸丑，皇子生，大赦天下。五月戊寅朔」＝閏四月癸丑。'
     'sxtwl は同じ期間を五月（朔 0483-05-23・癸丑は5日＝0483-05-27）に置くので多数月は 0483-06'),
    ('beiwei-xiaowendi', 'capitalRelocationCount', 0, 'date', '0494-11-01', '0494-12-01',
     '太和十八年十月に平城を発ち、十一月己丑「车驾至洛阳」で遷都が成立＝旧暦十一月。多数月は 0494-12'),
    ('beiwei-xiaowendi', 'personalCampaignCount', 2, 'startDate', '0497-07-01', '0497-08-01',
     '太和二十一年七月庚辰「車駕南討」＝旧暦七月。多数月は 0497-08'),
    ('beiwei-xiaowendi', 'rebellionSuppressionCount', 13, 'endDate', '0478-02-01', '0478-04-01',
     '太和二年二月辛未「秦益二州刺史、武都公尉洛侯討破元寿」＝旧暦二月。多数月は 0478-04'),
    ('beiwei-xiaowendi', 'rebellionSuppressionCount', 22, 'startDate', '0497-08-01', '0497-09-01',
     '太和二十一年八月壬子「敕勒樹者相率反叛」＝旧暦八月。多数月は 0497-09'),
    ('beiwei-xiaozhuangdi', 'rebellionSufferedCount', 0, 'endDate', '0528-10-01', '0528-11-01',
     'note「九月、尔朱栄が滏口で撃破・捕縛。十月、京師で斬首」＝乱の終息は旧暦十月。多数月は 0528-11'),
    ('beiwei-xiaozhuangdi', 'rebellionSuppressionCount', 0, 'endDate', '0528-10-01', '0528-11-01',
     '同上（十月の斬首と五州平定まで含めて鎮圧完了）'),
    ('beiwei-xiaozhuangdi', 'rebellionSuppressionCount', 6, 'endDate', '0530-04-01', '0530-05-01',
     'note「530年四月、雍州刺史尔朱天光が安定で撃破・捕縛」＝旧暦四月。多数月は 0530-05'),
    ('beiwei-jiemindi', 'rebellionSufferedCount', 4, 'endDate', '0532-04-01', '0532-06-01',
     '普泰二年夏四月辛巳に節閔帝が廃位＝旧暦四月。532年は閏月があるため多数月は 0532-06'),
    ('beiwei-yuanhao', 'personalCampaignCount', 0, 'startDate', '0529-04-01', '0529-05-01',
     '永安二年四月に梁国城南で即位を宣言し北伐を開始＝旧暦四月。多数月は 0529-05'),
    ('beiwei-yuanhao', 'personalCampaignCount', 0, 'endDate', '0529-07-01', '0529-09-01',
     '七月に敗走し臨潁で討たれた＝旧暦七月。529年は閏月があるため多数月は 0529-09'),
    ('beiwei-yuanhao', 'rebellionSufferedCount', 0, 'startDate', '0529-06-01', '0529-07-01',
     '六月に孝荘帝・尔朱栄が反撃を開始＝旧暦六月。多数月は 0529-07'),
    ('beiwei-yuanhao', 'rebellionSufferedCount', 0, 'endDate', '0529-07-01', '0529-09-01',
     '七月に元顥が敗走し斬られた＝旧暦七月。多数月は 0529-09'),
    ('dongwei-xiaojingdi', 'rebellionSuppressionCount', 0, 'endDate', '0535-01-01', '0535-03-01',
     '天平二年正月己丑に大野抜が樊子鵠を斬って投降し兗州平定＝旧暦正月。多数月は 0535-03'),
    ('dongwei-xiaojingdi', 'rebellionSuppressionCount', 6, 'startDate', '0541-03-01', '0541-04-01',
     '興和三年三月己酉に公孫貴賓が反し即座に捕縛＝旧暦三月。多数月は 0541-04'),
    ('dongwei-xiaojingdi', 'rebellionSuppressionCount', 6, 'endDate', '0541-03-01', '0541-04-01',
     '同上（同月内で決着）'),
    ('beiqi-feidi-gaoyin', 'rebellionSufferedCount', 0, 'endDate', '0560-08-01', '0560-09-01',
     '同年八月に太皇太后の命で高殷が済南王へ降格し高演が即位＝旧暦八月。多数月は 0560-09'),

    # ---- バッチ5: 西魏・北周・隋・唐 ----
    ('xiwei-wendi', 'rebellionSuppressionCount', 4, 'startDate', '0541-03-01', '0541-04-01',
     '周書太祖紀「七年春三月，稽胡帅、夏州刺史刘平伏据上郡叛」＝旧暦三月。多数月は 0541-04'),
    ('xiwei-feidi-yuanqin', 'rebellionSufferedCount', 0, 'startDate', '0554-01-01', '0554-03-01',
     '北史「三年春正月、安定公宇文泰廃帝而立齊王廓」＝廃位は旧暦正月。多数月は 0554-03'),
    ('xiwei-feidi-yuanqin', 'rebellionSufferedCount', 0, 'endDate', '0554-04-01', '0554-05-01',
     '資治通鑑「夏四月庚戌」に宇文泰が鴆殺＝旧暦四月。多数月は 0554-05'),
    ('beizhou-wudi', 'personalCampaignCount', 0, 'endDate', '0575-09-01', '0575-11-01',
     '周書武帝紀「九月辛酉夜，班師」＝撤退は旧暦九月。575年は閏月があるため多数月は 0575-11'),
    ('sui-wendi', 'capitalRelocationCount', 0, 'date', '0583-03-01', '0583-04-01',
     '隋書高祖紀 開皇三年三月丙辰「常服入新都」で遷都が完了＝旧暦三月。多数月は 0583-04'),
    ('tang-gaozu', 'rebellionSuppressionCount', 1, 'startDate', '0618-11-01', '0618-12-01',
     '武徳元年十一月「涼王李軌僭称天子於涼州」と離反＝旧暦十一月。多数月は 0618-12'),
    ('tang-gaozu', 'rebellionSuppressionCount', 5, 'startDate', '0622-03-01', '0622-04-01',
     '武徳五年三月「蔚州総管、北平王高開道叛、寇易州」＝旧暦三月。多数月は 0622-04'),
    ('tang-xuanzong', 'amnestyCount', 7, 'date', '0735-01-01', '0735-02-01',
     '開元二十三年正月己亥の親耕籍田に伴う大赦＝旧暦正月。多数月は 0735-02。'
     'note 自身が「当該干支が計算上その月内に見出せず（暦法上のずれの可能性）」と記す型'),
    ('tang-suzong', 'rebellionSuppressionCount', 0, 'startDate', '0755-11-01', '0755-12-01',
     '安史の乱の勃発は天宝十四載十一月＝旧暦十一月。多数月は 0755-12'),
    ('tang-suzong', 'rebellionSuppressionCount', 3, 'startDate', '0759-08-01', '0759-09-01',
     '旧唐書巻十 乾元二年八月乙亥「襄州偏将康楚元逐刺史王政，据城自守」＝旧暦八月。多数月は 0759-09'),
    ('tang-xizong', 'rebellionSuppressionCount', 0, 'endDate', '0878-02-01', '0878-03-01',
     '乾符五年二月に招討使宋威が王仙芝を大破・斬殺＝旧暦二月。多数月は 0878-03'),
    ('tangmo-anqingxu', 'capitalRelocationCount', 0, 'date', '0757-10-01', '0757-11-01',
     '至德二載十月、唐軍の進撃を受けて安慶緒が洛陽を捨て鄴郡へ移った＝旧暦十月。多数月は 0757-11'),

    # ---- バッチ6: 五代十国・宋金・明 ----
    ('tangmo-shisiming', 'capitalRelocationCount', 0, 'date', '0759-04-01', '0759-05-01',
     '乾元二年四月に史思明が皇帝を称し「以范陽爲燕京」＝旧暦四月。多数月は 0759-05'),
    ('wudai-houtang-mingzong', 'rebellionSufferedCount', 12, 'endDate', '0932-06-25', '0932-07-01',
     '明宗紀九 長興三年六月条「东川董璋领兵至汉州……璋大败」で乱が終息＝旧暦六月。多数月は 0932-07。'
     '現在値 0932-06-25 を逆変換すると旧暦五月19日で、note のどの月とも対応しない'),
    ('wudai-houtang-mingzong', 'rebellionSuppressionCount', 12, 'endDate', '0932-06-25', '0932-07-01',
     '同上（同一事象の鎮圧側）'),
    ('wudai-houtang-mingzong', 'rebellionSufferedCount', 13, 'startDate', '0932-01-27', '0932-02-01',
     '明宗紀九 長興三年正月条「遣邠州节度使药彦稠、灵武节度使康福……往方渠讨党项之叛者」＝旧暦正月。多数月は 0932-02。'
     '現在値 0932-01-27 を逆変換すると旧暦931年12月17日'),
    ('wudai-houtang-mingzong', 'rebellionSuppressionCount', 13, 'startDate', '0932-01-27', '0932-02-01',
     '同上（同一事象の鎮圧側）'),
    ('wudai-houtang-mingzong', 'rebellionSufferedCount', 15, 'startDate', '0933-03-17', '0933-04-01',
     '明宗紀十 長興四年三月条「夏州节度使李仁福卒，其子彝超自称留后」＝旧暦三月。多数月は 0933-04。'
     '現在値を逆変換すると旧暦二月19日'),
    ('wudai-houtang-mingzong', 'rebellionSufferedCount', 15, 'endDate', '0933-07-21', '0933-08-01',
     '同七月条「诏安从进班师，时王师攻夏州无功故也」＝旧暦七月。多数月は 0933-08。'
     '現在値を逆変換すると旧暦六月26日'),
    ('wudai-houhan-yindi', 'rebellionSuppressionCount', 0, 'endDate', '0949-07-27', '0949-08-01',
     '乾祐二年七月甲子「郭威奏，收復河中府，逆賊李守貞自燔而死」＝旧暦七月。多数月は 0949-08。'
     '現在値 0949-07-27 は旧暦六月29日（七月朔の前日）で七月に入っていない'),
    ('shiguo-nantang-libian', 'crownPrinceDepositionCount', 0, 'date', '0940-09-01', '0940-10-01',
     '八月丁巳の立太子を李璟が固辞し、資治通鑑では九月乙丑に烈祖が許可して皇太子号が撤回された＝旧暦九月。多数月は 0940-10'),
    ('beisong-zhenzong', 'amnestyCount', 1, 'date', '1001-11-01', '1001-12-01',
     '咸平四年十一月壬寅、圜丘で天地を祀り大赦＝旧暦十一月。多数月は 1001-12'),
    ('jin-hailingwang', 'capitalRelocationCount', 0, 'date', '1153-03-01', '1153-04-01',
     '貞元元年三月乙卯「以迁都诏中外……改燕京为中都」で遷都が確定＝旧暦三月。多数月は 1153-04'),
    ('jin-xuanzong', 'capitalRelocationCount', 0, 'date', '1214-05-01', '1214-06-01',
     '貞祐二年五月乙亥「上决意南迁，诏告国内」・壬午「车驾发中都」＝旧暦五月。多数月は 1214-06'),
    ('beisongmo-liuyu', 'capitalRelocationCount', 0, 'date', '1132-04-01', '1132-05-01',
     '宋史叛臣伝 紹興二年（阜昌二年）四月丙寅「豫遷都汴」＝旧暦四月。多数月は 1132-05'),
    ('ming-taizong', 'capitalRelocationCount', 0, 'date', '1421-01-01', '1421-02-01',
     'note が「効力発生月の永楽十九年正月を採用」と明記＝旧暦正月。多数月は 1421-02'),
    ('ming-taizong', 'rebellionSuppressionCount', 7, 'startDate', '1422-02-01', '1422-03-01',
     '明史本紀七 永楽二十年二月己巳「都指挥使鹿荣讨柳州叛蛮，平之」＝旧暦二月。多数月は 1422-03'),
    ('ming-taizong', 'rebellionSuppressionCount', 7, 'endDate', '1422-02-01', '1422-03-01',
     '同上（同月内で決着）'),
    ('ming-xuanzong', 'personalCampaignCount', 2, 'startDate', '1434-09-01', '1434-10-01',
     '宣徳九年九月癸未「自将巡边」が出陣＝旧暦九月。多数月は 1434-10。'
     '八月己巳は瓦剌からの告捷報告で親征の開始ではない'),

    # ---- バッチ7: 明中期 ----
    ('ming-wuzong', 'rebellionSuppressionCount', 0, 'startDate', '1510-04-01', '1510-05-01',
     '正徳五年四月庚寅に安化王朱寘鐇が反し、同月中に仇鉞が捕縛＝旧暦四月。多数月は 1510-05'),
    ('ming-wuzong', 'rebellionSuppressionCount', 0, 'endDate', '1510-04-01', '1510-05-01',
     '同上（同月内で決着）'),
]

# 現行値のままで正しいと確認したもの（触らない）: (id, 指標, index, キー, 現在値, 根拠)
CONFIRMED_OK = [
    # ---- バッチ0 ----
    ('hou-han-guangwudi', 'personalCampaignCount', 6, 'startDate', '0035-08-01',
     '建武十一年六月「帝自将征公孫述」＝開始は旧暦六月。35年は閏三月があるため旧暦六月の多数月が 0035-08 になる'),
    ('hou-han-guangwudi', 'rebellionSuppressionCount', 1, 'startDate', '0026-03-01',
     '建武二年二月「漁陽太守彭寵反」＝旧暦二月の多数月が 0026-03'),
    ('hou-han-guangwudi', 'rebellionSuppressionCount', 1, 'endDate', '0029-03-01',
     '建武五年二月「彭寵為其蒼頭所殺、漁陽平」＝旧暦二月の多数月が 0029-03'),
    ('hou-han-zhangdi', 'rebellionSuppressionCount', 1, 'endDate', '0077-04-01',
     'note は鎮圧月を「三月甲辰の記事と四月戊子の記事の間」から三月と推定＝旧暦三月の多数月が 0077-04'),
    ('hou-han-zhangdi', 'rebellionSuppressionCount', 3, 'endDate', '0080-05-01',
     'note は鎮圧月を「三月甲寅の記事と五月辛亥の記事の間」から四月と推定＝旧暦四月の多数月が 0080-05'),
    ('hou-han-chongdi', 'rebellionSuppressionCount', 0, 'startDate', '0144-09-01',
     '蜂起は建康元年八月（順帝崩御・沖帝即位と同月）＝旧暦八月の多数月が 0144-09。'
     'endDate 0144-10-31 は旧暦九月の多数月 0144-10 に対応し整合する'),
    ('hou-han-huandi', 'rebellionSuppressionCount', 14, 'startDate', '0160-12-01',
     '延熹三年十一月の蜂起＝旧暦十一月の多数月が 0160-12（フェーズ1で note ごと訂正した件）'),
    ('hou-han-huandi', 'rebellionSuppressionCount', 14, 'endDate', '0161-01-31',
     '延熹三年十二月の討破＝旧暦十二月の多数月が 0161-01（同上）'),
    ('hou-han-lingdi', 'rebellionSuppressionCount', 4, 'startDate', '0172-11-01',
     '熹平元年十月に許生が「越王」を自称＝旧暦十月の多数月が 0172-11'),
    ('hou-han-lingdi', 'rebellionSuppressionCount', 13, 'startDate', '0187-03-01',
     '中平四年二月に滎陽賊が中牟令を殺害＝旧暦二月の多数月が 0187-03'),
    ('hou-han-lingdi', 'rebellionSuppressionCount', 15, 'startDate', '0188-01-01',
     '中平四年十二月「休屠各胡叛」＝旧暦十二月の多数月が 0188-01'),
    ('wei-wendi', 'personalCampaignCount', 1, 'startDate', '0224-08-01',
     '黄初五年秋七月「行東巡，幸許昌宮」＝開始は旧暦七月。多数月が 0224-08'),
    ('wei-mingdi', 'personalCampaignCount', 0, 'startDate', '0234-08-01',
     '青龍二年秋七月壬寅「帝亲御龙舟东征」＝開始は旧暦七月。多数月が 0234-08'),
    ('wei-mingdi', 'rebellionSuppressionCount', 1, 'startDate', '0228-01-01',
     '太和元年十二月に孟達が魏に反した＝旧暦十二月の多数月が 0228-01'),

    # ---- バッチ1 ----
    ('shuhan-zhaoliedi', 'personalCampaignCount', 0, 'startDate', '0221-08-01',
     '章武元年秋七月「遂帥諸軍伐呉」＝開始は旧暦七月。多数月が 0221-08'),
    ('wu-modi', 'amnestyCount', 2, 'date', '0265-12-01',
     'note が「正確な月日は不詳のため十一月として近似」と明記＝旧暦十一月の多数月が 0265-12'),
    ('jin-wudi', 'rebellionSuppressionCount', 5, 'startDate', '0287-12-01',
     '太康八年冬十月「南康平固縣吏李豐反」＝開始は旧暦十月。多数月が 0287-12'),
    ('jin-huidi', 'rebellionSuppressionCount', 3, 'startDate', '0303-06-01',
     '太安二年五月に張昌が挙兵＝旧暦五月の多数月が 0303-06'),
    ('jin-huidi', 'rebellionSuppressionCount', 3, 'endDate', '0304-05-01',
     '永興元年三月に陳敏が石冰を斬り「揚・徐二州平」＝旧暦三月の多数月が 0304-05'),
    ('jin-simalun', 'rebellionSuppressionCount', 0, 'startDate', '0301-04-01',
     '永寧元年三月の起兵＝旧暦三月の多数月が 0301-04。endDate 0301-04-07 は恵帝復位の実日付'),
    ('dongjin-mingdi', 'rebellionSuppressionCount', 1, 'startDate', '0324-06-01',
     'note は太宁二年五月（近臣の殺害）を武力衝突の始まりとする＝旧暦五月の多数月が 0324-06'),
    ('dongjin-mudi', 'rebellionSuppressionCount', 4, 'startDate', '0353-11-01',
     '永和九年冬十月に姚襄が反逆＝旧暦十月の多数月が 0353-11'),

    # ---- バッチ2 ----
    ('dongjin-feidi', 'rebellionSuppressionCount', 2, 'endDate', '0371-02-01',
     '太和六年正月に桓温が寿陽を陥落させ袁瑾を斬った＝旧暦正月の多数月が 0371-02'),
    ('dongjin-feidi', 'rebellionSuppressionCount', 3, 'startDate', '0370-10-01',
     'note は本紀の記事配置（冬十月の記事の前）から太和五年九月頃と推定＝旧暦九月の多数月が 0370-10'),
    ('dongjin-feidi', 'rebellionSuppressionCount', 3, 'endDate', '0370-10-01',
     '同上（蜂起から鎮圧まで同月内として同じ値を置いている）'),
    ('dongjin-jianwendi', 'rebellionSuppressionCount', 0, 'startDate', '0372-07-01',
     '咸安二年六月戊子に庾希が海陵で挙兵＝旧暦六月の多数月が 0372-07'),
    ('nanyan-murongchao', 'rebellionSuppressionCount', 0, 'startDate', '0406-10-01',
     'note は資治通鑑から義熙二年九月末〜十月頃と比定＝開始側の旧暦九月の多数月が 0406-10'),
    ('liu-song-shaodi', 'rebellionSufferedCount', 0, 'startDate', '0424-06-01',
     '景平二年夏五月乙酉に太后令で廃位＝旧暦五月の多数月が 0424-06'),
    ('liu-song-wendi', 'personalCampaignCount', 0, 'startDate', '0426-02-01',
     '元嘉三年正月丙寅「上親率六師西征」＝旧暦正月の多数月が 0426-02'),
    ('liu-song-wendi', 'rebellionSuppressionCount', 6, 'startDate', '0441-12-01',
     '元嘉十八年冬十一月に楊難当が漢川へ侵寇＝旧暦十一月の多数月が 0441-12'),
    ('liu-song-houfeidi', 'rebellionSuppressionCount', 0, 'startDate', '0474-06-01',
     '元徽二年五月壬午に桂陽王劉休範が挙兵＝旧暦五月の多数月が 0474-06'),
    ('liu-song-shundi', 'rebellionSuppressionCount', 0, 'startDate', '0478-01-01',
     '昇明元年十二月丁巳に沈攸之が挙兵＝旧暦十二月の多数月が 0478-01'),

    # ---- バッチ3 ----
    ('qi-mingdi', 'rebellionSufferedCount', 0, 'startDate', '0498-05-01',
     '永泰元年四月丁卯に王敬則が挙兵＝旧暦四月の多数月が 0498-05'),
    ('qi-mingdi', 'rebellionSuppressionCount', 0, 'startDate', '0498-05-01',
     '同上（同一事象の鎮圧側）'),
    ('qi-donghunhou', 'rebellionSuppressionCount', 3, 'startDate', '0500-04-01',
     '永元二年三月に崔慧景が広陵で反転して挙兵＝旧暦三月の多数月が 0500-04。endDate 0500-05-17 は四月癸酉の実日付'),
    ('liang-wudi', 'rebellionSuppressionCount', 0, 'startDate', '0502-06-01',
     '天監元年五月戊子に陳伯之が挙兵＝旧暦五月の多数月が 0502-06'),
    ('liang-wudi', 'rebellionSuppressionCount', 1, 'endDate', '0503-06-01',
     '天監二年五月乙丑に鄧元起が成都を攻略＝旧暦五月の多数月が 0503-06'),
    ('liang-yuandi', 'personalCampaignCount', 0, 'startDate', '0554-12-01',
     '承聖三年十一月辛亥「世祖出枇杷門、親臨陣督戦」＝旧暦十一月の多数月が 0554-12'),
    ('liang-yuandi', 'personalCampaignCount', 0, 'endDate', '0554-12-01',
     '同上（note も死去日から逆算した旧暦十一月と明記）'),
    ('liang-jingdi', 'rebellionSuppressionCount', 3, 'startDate', '0556-02-01',
     'note「太平元年正月末〜二月にかけて発生」の開始側＝旧暦正月の多数月が 0556-02。endDate 0556-03-01 が二月に対応する'),
    ('chen-wendi', 'rebellionSuppressionCount', 5, 'endDate', '0565-01-01',
     '天嘉五年十一月丁亥に章昭達が陳宝応を破り晋安郡を平定＝旧暦十一月の多数月が 0565-01'),
    ('chen-houzhu', 'rebellionSuppressionCount', 1, 'startDate', '0585-04-01',
     '至徳三年三月辛酉に章大宝が挙兵＝旧暦三月の多数月が 0585-04'),
    ('liang-xiaozhengde', 'personalCampaignCount', 0, 'startDate', '0548-11-01',
     '十月に丹陽郡で自ら部隊を率いて侯景軍に合流＝旧暦十月の多数月が 0548-11。endDate 0548-12-01 が十一月の擁立に対応する'),
    ('liang-houjing', 'personalCampaignCount', 0, 'startDate', '0551-04-01',
     '侯景伝「三月、景自率衆二萬、西上援約」＝旧暦三月の多数月が 0551-04'),
    ('liang-houjing', 'rebellionSufferedCount', 1, 'startDate', '0551-01-01',
     '侯景伝「是月(大宝元年十二月)、張彪起義於會稽」＝旧暦十二月の多数月が 0551-01'),
    ('liang-houjing', 'rebellionSuppressionCount', 0, 'startDate', '0551-11-01',
     '侯景伝「是月(天正元年十月)、景司空東道行台劉神茂……據東陽歸順」＝旧暦十月の多数月が 0551-11'),
    ('liang-xiaoji', 'personalCampaignCount', 0, 'endDate', '0553-08-20',
     '0553-08-20 を逆変換すると旧暦七月26日。梁書は蕭紀の敗死を「六月、紀筑連城」以降の記事に置いており、'
     '旧暦七月の実日付として整合する（note に七月の記載が無いのは note 側の不足）'),

    # ---- バッチ4 ----
    ('beiwei-daowudi', 'personalCampaignCount', 0, 'startDate', '0399-03-01',
     '天興二年正月庚午「車駕北巡……車駕親勒六軍」＝旧暦正月の多数月が 0399-03'),
    ('beiwei-daowudi', 'personalCampaignCount', 1, 'startDate', '0402-08-01',
     '天興五年秋七月戊辰朔「車駕西討」＝旧暦七月の多数月が 0402-08'),
    ('beiwei-xiaowendi', 'crownPrinceDepositionCount', 0, 'date', '0497-01-01',
     '太和二十年十二月丙寅に皇太子恂を廃した＝旧暦十二月の多数月が 0497-01'),
    ('beiwei-xiaowendi', 'personalCampaignCount', 3, 'startDate', '0499-04-01',
     '太和二十三年三月庚辰「車駕南伐」＝旧暦三月の多数月が 0499-04'),
    ('beiwei-xiaowendi', 'rebellionSuppressionCount', 13, 'startDate', '0477-02-01',
     '太和元年正月己酉に王元寿が冲天王を自号＝旧暦正月の多数月が 0477-02'),
    ('beiwei-xiaowendi', 'rebellionSuppressionCount', 19, 'endDate', '0497-05-01',
     '太和二十一年三月己酉「次離石.叛胡帰罪,宥之」＝旧暦三月の多数月が 0497-05'),
    ('beiwei-xuanwudi', 'rebellionSuppressionCount', 4, 'startDate', '0502-04-01',
     '景明三年三月に魯陽の蛮族が反乱＝旧暦三月の多数月が 0502-04'),
    ('beiwei-xuanwudi', 'rebellionSuppressionCount', 6, 'endDate', '0506-02-01',
     '正始三年正月に邢峦が武興を克服して鎮圧完了＝旧暦正月の多数月が 0506-02'),
    ('beiwei-xuanwudi', 'rebellionSuppressionCount', 9, 'startDate', '0508-09-01',
     '永平元年八月に元愉が冀州で挙兵＝旧暦八月の多数月が 0508-09'),
    ('beiwei-xiaomingdi', 'rebellionSuppressionCount', 2, 'startDate', '0518-02-01',
     '神亀元年正月「秦州羌反」＝旧暦正月の多数月が 0518-02'),
    ('beiwei-youzhu-yuanzhao', 'rebellionSufferedCount', 0, 'startDate', '0528-04-01',
     '魏書巻九「三月癸未」に葛栄が滄州を攻陥＝旧暦三月の多数月が 0528-04'),
    ('beiwei-jiemindi', 'rebellionSufferedCount', 4, 'startDate', '0531-03-01',
     '普泰元年二月に高乾邕らが冀州を夜襲＝旧暦二月の多数月が 0531-03'),
    ('beiwei-jiemindi', 'rebellionSuppressionCount', 1, 'startDate', '0531-03-01',
     '「（二月）幽州刺史刘灵助起兵于蓟」＝旧暦二月の多数月が 0531-03'),
    ('beiwei-xiaowudi', 'rebellionSuppressionCount', 3, 'startDate', '0534-10-01',
     '永熙三年九月「是月，东清河人傅晶杀太守韩子捷，据郡反。会赦，乃降」＝旧暦九月の多数月が 0534-10'),
    ('beiwei-xiaowudi', 'rebellionSuppressionCount', 3, 'endDate', '0534-10-01',
     '同上（蜂起も降伏も九月。フェーズ4で endDate を 0534-09-01 から揃えた）'),
    ('dongwei-xiaojingdi', 'rebellionSuppressionCount', 9, 'startDate', '0547-02-01',
     '武定五年正月に侯景が頴州等で挙兵＝旧暦正月の多数月が 0547-02'),
    ('beiqi-feidi-gaoyin', 'rebellionSufferedCount', 0, 'startDate', '0560-03-01',
     'note は北齊書廢帝紀「乾明元年二月乙巳」を採用＝旧暦二月の多数月が 0560-03（北史は三月甲戌とする）'),

    # ---- バッチ5 ----
    ('beiqi-houzhu', 'personalCampaignCount', 0, 'startDate', '0576-11-01',
     '武平七年冬十月に周師が晋州を攻め庚午「帝発晋陽」＝旧暦十月の多数月が 0576-11'),
    ('beizhou-wudi', 'rebellionSufferedCount', 6, 'startDate', '0578-01-01',
     '周書巻六 建徳六年十二月「是月，北营州刺史高宝宁据州反」＝旧暦十二月の多数月が 0578-01'),
    ('beizhou-wudi', 'rebellionSuppressionCount', 2, 'startDate', '0574-08-01',
     '建徳三年七月乙酉「卫王直在京师举兵反」＝旧暦七月の多数月が 0574-08'),
    ('beizhou-jingdi', 'rebellionSuppressionCount', 0, 'startDate', '0580-07-01',
     '大象二年六月甲子に相州総管尉遅迥が挙兵＝旧暦六月の多数月が 0580-07'),
    ('beizhou-jingdi', 'rebellionSuppressionCount', 1, 'startDate', '0580-08-01',
     '七月己酉に鄖州総管司馬消難が挙兵＝旧暦七月の多数月が 0580-08'),
    ('tang-gaozu', 'rebellionSuppressionCount', 5, 'endDate', '0624-03-01',
     '武徳七年二月「高開道為部将張金樹所殺、以其地降」＝旧暦二月の多数月が 0624-03'),
    ('tang-suzong', 'rebellionSuppressionCount', 5, 'startDate', '0761-05-01',
     '上元二年四月壬午「梓州刺史段子璋叛」＝旧暦四月の多数月が 0761-05'),
    ('tang-xizong', 'rebellionSuppressionCount', 4, 'startDate', '0886-05-01',
     '光啓二年四月「迫宰相萧遘等于凤翔驿舍」＝旧暦四月の多数月が 0886-05'),
    ('tang-zhaozong', 'rebellionSuppressionCount', 1, 'startDate', '0891-11-01',
     '大順二年十月甲申「天威軍使李順節率禁兵討楊復恭」＝旧暦十月の多数月が 0891-11'),
    ('tang-zhaozong', 'rebellionSuppressionCount', 1, 'endDate', '0894-01-01',
     '景福二年十二月辛未朔「楊守亮、楊復恭並已処斬訖」＝旧暦十二月の多数月が 0894-01'),

    # ---- バッチ6 ----
    ('wudai-houliang-taizu', 'rebellionSuppressionCount', 1, 'startDate', '0909-09-01',
     'note が「八月の官軍到着時点で既に進行中だったため、便宜上開始月を八月とした」＝旧暦八月の多数月が 0909-09'),
    ('wudai-houzhou-taizu', 'personalCampaignCount', 0, 'startDate', '0952-06-01',
     '広順二年五月庚申「車駕発京師」＝旧暦五月の多数月が 0952-06'),
    ('shiguo-nantang-libian', 'empressInstallationCount', 0, 'date', '0937-11-01',
     'note が「いずれも即位と同じ月（升元元年十月）内の出来事」と確定＝旧暦十月の多数月が 0937-11'),
    ('beisong-zhenzong', 'eraChangeCount', 4, 'date', '1022-02-01',
     '乾興元年正月辛未朔に改元＝旧暦正月の多数月が 1022-02'),
    ('ming-taizong', 'rebellionSuppressionCount', 4, 'startDate', '1413-09-01',
     '永楽十一年八月乙丑「镇远侯顾成讨思州、靖州叛苗」＝旧暦八月の多数月が 1413-09'),
    ('ming-taizong', 'rebellionSuppressionCount', 6, 'startDate', '1420-03-01',
     '永楽十八年二月己酉「薄台妖妇唐赛儿作乱」＝旧暦二月の多数月が 1420-03'),
    ('ming-xuanzong', 'personalCampaignCount', 0, 'startDate', '1426-09-01',
     '宣徳元年八月己巳「亲征高煦」・辛未発京師＝旧暦八月の多数月が 1426-09'),
    ('ming-xuanzong', 'personalCampaignCount', 1, 'startDate', '1428-09-01',
     '宣徳三年八月丁未「帝自将巡边」＝旧暦八月の多数月が 1428-09'),
    ('ming-xuanzong', 'rebellionSufferedCount', 14, 'endDate', '1427-11-01',
     '宣徳二年十月戊寅「王通弃交阯，与黎利盟」で事実上の撤退＝旧暦十月の多数月が 1427-11'),

    # ---- バッチ7 ----
    ('ming-daizong', 'rebellionSufferedCount', 3, 'startDate', '1452-10-13',
     'note「原文（景泰三年閏九月）:『开处州银场。是月，福建盗起』」。1452-10-13 は**閏九月の朔**そのもので、'
     '既に換算済み。旧暦月の正規表現が閏月を除外するため未換算候補として拾われただけ'),
    ('ming-wuzong', 'personalCampaignCount', 1, 'startDate', '1519-08-01',
     '正徳十四年七月甲辰「帝自将讨宸濠」の親征布告＝旧暦七月の多数月が 1519-08。endDate 1519-09-01 が八月癸未の京師発に対応する'),
    ('ming-wuzong', 'rebellionSufferedCount', 1, 'startDate', '1511-08-01',
     '正徳六年七月以降に劉六・劉七の乱が拡大＝旧暦七月の多数月が 1511-08'),
    ('ming-wuzong', 'rebellionSuppressionCount', 1, 'startDate', '1511-08-01',
     '正徳六年七月に賊が文安を犯し京師戒厳＝旧暦七月の多数月が 1511-08'),
    ('ming-wuzong', 'rebellionSuppressionCount', 4, 'startDate', '1519-07-01',
     '正徳十四年六月丙子に寧王宸濠が反した＝旧暦六月の多数月が 1519-07'),
]

# 原典で対応月を確定できなかったもの: (id, 指標, index, キー, 現在値, 事情)
UNRESOLVED = [
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    if args.apply == args.dry_run:
        ap.error('--apply か --dry-run のどちらかを指定する')

    data = json.loads(DATA_PATH.read_text(encoding='utf-8'))
    by_id = {e['id']: e for e in data['emperors']}

    # 現行維持と判定したものも、値が動いていないことを毎回検査する（他セッションとの競合検知）
    for eid, ck, i, key, cur, why in CONFIRMED_OK:
        ev = by_id[eid][ck]['events'][i]
        if ev.get(key) != cur:
            raise SystemExit(f'CONFIRMED_OK の現在値が変わっている: {eid}.{ck}[{i}].{key} = {ev.get(key)!r}（期待 {cur!r}）')

    for eid, ck, i, key, old, new, why in RECORDS:
        ev = by_id[eid][ck]['events'][i]
        if ev.get(key) != old:
            raise SystemExit(f'旧値不一致で中断: {eid}.{ck}[{i}].{key} = {ev.get(key)!r}（期待 {old!r}）')
        print(f'  {eid} / {ck}.events[{i}].{key}  {old} → {new}\n      {why}')
        if args.apply:
            ev[key] = new

    if args.apply:
        DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'\n訂正 {len(RECORDS)} / 現行維持 {len(CONFIRMED_OK)} / 保留 {len(UNRESOLVED)}'
          f'{"（適用済み）" if args.apply else "（ドライラン）"}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
