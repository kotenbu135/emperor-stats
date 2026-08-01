# Issue #33 調査結果（2026-08-02）

GitHub Issue #33「紹介文の執筆中に見つかった素材 note と原典の食い違い5件（懐帝2・哀帝・成帝・安帝）」の
原典照合と横展開スイープの記録。**2026-08-02、ユーザー承認のうえ 1〜5 と横展開分を `data/emperors.json` に反映済み**
（末尾「適用した訂正」節）。`events[].date` の ISO 年（スイープB）は別 Issue に切り出した。

照合に使った原典: `_corpus_cache/jin-huaidi.txt`・`dongjin-aidi.txt`・`dongjin-chengdi.txt`・`dongjin-andi.txt`、
`daizhigev20/史藏/编年/资治通鉴.txt`、`daizhigev20/史藏/别史/建康实录.txt`、`daizhigev20/史藏/正史/晋书.txt`。

## 1〜5 の判定

### 1. `jin-huaidi.personalCampaignCount.note` — 指摘は正しい（＋もう1点あり）

本紀（永嘉五年）は五月と六月を書き分けている。

- 五月: `大將軍苟晞表遷都倉垣，帝將從之` → `帝步出西掖門。至銅駝街，為盜所掠，不得進而還`
- 六月丁酉: `劉曜、王彌入京師。帝開華林園門，出河陰藕池，欲幸長安，為曜等所追及`

現行 note の「苟晞の遷都仓垣の上表に従い**長安への**避難を試みて西掖門を徒歩で出た」は、五月の行き先（倉垣）に
六月の行き先（長安）を混ぜている。Issue の指摘どおり。

**追加の食い違い**: note は「唯一皇帝本人の移動を伴う記述は…一件のみ」と書くが、本紀には皇帝本人の移動記事が
**2件**ある（五月・西掖門→倉垣、六月・華林園門→長安）。どちらも軍事行動ではないので `count: 0` は動かないが、
note の「一件のみ」という枠づけ自体が原典と合わない。

### 2. `jin-huaidi.capitalRelocationCount.events[0].note` — 指摘は正しい

本紀は `六月癸未，劉曜、王彌、石勒同寇洛川`（洛川での交戦）と `丁酉，劉曜、王彌入京師…曜等遂焚燒宮廟`
（入城・焚焼）を別記事として書き分けており、**入城・焚焼の主体は劉曜と王彌**。石勒は洛川の記事にしか現れない。
現行 note の「劉曜・王弥・石勒が洛陽に侵入し焚掠」は主体が1人多い。

補足: 同じ人物の `rebellionSufferedCount.note` にも「洛陽陥落・懐帝捕縛は劉曜・王弥・石勒ら匈奴漢…による
対外戦争の帰結」とある。こちらは洛川の交戦を含む戦役全体を指す書き方なので、events[0].note ほど明確な誤りではない。

**訂正時の注意**: events[0].note には原文引用（`曜等遂焚燒宮廟…帝蒙塵於平陽`）が埋まっている。ここを触ると
コミット条件として `verify_quotes.py --backfill && --check` が要る（1・3・5 は平文のみなので不要）。

### 3. `dongjin-aidi.deathCause.note` の「太極殿で崩御」 — 出所は見つからなかった

3つの史料がいずれも **西堂** と書く。

| 史料 | 記述 |
|---|---|
| 晋書 巻八 哀帝紀 | `丙申，帝崩于西堂，時年二十五。葬安平陵。` |
| 資治通鑑 | `丙申，帝崩于西堂，事遂寝。` |
| 建康実録 | `二月甲午疾篤丙申帝崩于西堂` |

さらに `晋书.txt` 内で `太极西堂` は **0件**で、`西堂`（14件）と `太极殿`（16件）は別語として使われている。
「太極殿」を支持する出典は見当たらない。なお `晋书.txt` 全体で `崩于西堂` は2件のみで、成帝（`時年二十二`）と哀帝（`時年二十五`）に限られる。

### 4. `dongjin-chengdi.ages.accessionAge` — `5` を入れられる（`wei-caofang` と同型）

- 本紀: `太寧三年…閏月戊子，明帝崩。己丑，太子即皇帝位` / `癸巳，帝崩于西堂，時年二十二`
- さらに本紀の詔に `朕以眇年，獲嗣洪緒，托于王公之上，**於茲十有八年**` があり、22 − 18 + 1 = 5 で
  年号差からの逆算（22 −(342 − 325) = 5）と独立に一致する。

`wei-caofang.ages` は同型の逆算（廃位時「年二十三」と年号差15年）で `accessionAge: 8` を持ち、
note に逆算根拠を明記している。同じ扱いにできる。

### 5. `dongjin-andi` の西暦ラベル — 指摘は正しい（sxtwl で確認）

| 原文 | sxtwl 換算 | 現行 note |
|---|---|---|
| 元興二年十二月壬辰（桓玄篡位・平固王へ降格） | **0404-01-01** | `reigns[0].note`「**403年**に桓玄に禅譲を迫られ平固王に降格」 |
| 元興二年十二月辛亥（帝蒙塵于尋陽） | 0404-01-20 | — |
| 義熙十四年十二月戊寅（崩御） | **0419-01-28**（＝`reigns[0].endDate`・`ages.deathDate`） | `deathCause.note`「義熙14年（**418年**）12月戊寅」 |

2つは性質が違う:

- `reigns[0].note` の「403年」は**元号を伴わない裸の西暦**で、擁護できる表記ではない（実日付は404年1月1日）。
- `deathCause.note` の「義熙14年（418年）12月戊寅」は、元号年ラベルへの西暦併記としては慣用的に正しく、
  そこへ「12月戊寅」が付いて衝突している形。「419年」に直すか「義熙14年12月戊寅（419年1月28日）」の形にするか、
  表記方針の判断が要る。

ついでに確認: 安帝の崩御地は本紀 `戊寅，帝崩于**東堂**，時年三十七`。`duration.source.quote` の記述と一致していて問題なし。

## 公開中の紹介文（Issue #16）への伝播

**4件とも紹介文には伝播していない**（`data/emperor-profiles.json`・58本・`9eb2e72` で配信済み）。

- 懐帝: 「倉垣へ移ろうとした」「六月、劉曜・王弥が都に攻め入り」— 本紀どおり。素材メモにも食い違いが明記されている
- 哀帝: 「二月、**西堂**で崩じた」— 本紀どおり
- 成帝: 「幼くして即位」（年齢を書いていない）
- 安帝: 「桓玄は**404年**の初めに位を奪って」「**419年**、帝は東堂で崩じた」— 実日付どおり。
  紹介文の素材メモに「reigns[0].duration.note は『403年降格・404年復位』のままでデータ側と食い違うが、
  本文は endDate に合わせた西暦基準を採る」と判断が残っている

サイトの「典拠・調査メモ」「即位の経緯」「死因の経緯」には note がそのまま出るので、
表示上の誤りは 1〜3・5 の note 側にだけある。

## 横展開スイープ（Issue の「確認したいこと」3点目）

再現スクリプトと生の出力はこのディレクトリに置いた。

| スクリプト | 出力 | 目的 |
|---|---|---|
| `sweep_note_year_label.py` | `out_note_year_label.txt` | note の西暦ラベルが旧暦十一月・十二月の記事と衝突する候補 |
| `sweep_event_iso_year.py` | `out_event_iso_year.txt` | `events[].date` の ISO 年が紀年ラベル年のまま残っている候補 |
| `sweep_accession_age.py` | `out_accession_age.txt` | `accessionAge` が null なのに note が即位時年齢を書いている矛盾 |

### スイープA: note の西暦ラベル（93件 → 4クラス）

`sweep_note_year_label.py`。**検出できないもの**: 月を書いていない西暦（安帝 `reigns[0].note` の
「403年に桓玄に…降格」がまさにこれ）は当たらない。同レコードに y+1 の1〜2月の ISO 日付が無いものも候補に載らない。
つまり下の件数は**下限**で、Issue の指摘した2件のうち1件（`reigns[0].note`）はこの検出器では見つけられない。

- **A: 裸の西暦＋旧暦月（19件）** — 元号の裏づけなしに西暦を書き、実日付が翌年になるもの。要個別確認。
  `jin-huidi` 2件・`liang-jingdi` 2件・`xiwei-feidi-yuanqin` 2件・`dongjin-feidi`・`liang-yuandi`・
  `beiwei-xiaowendi`・`beiwei-xiaozhuangdi`・`beiwei-xiaowudi`・`beiqi-houzhu`・`beiqi-gaoxie`・
  `xiwei-gongdi`・`tang-zhaozong`・`tangmo-li-yun`・`wudai-houjin-gaozu`・`shiguo-qianshu-wangjian`・
  `xixia-huanzong`。ただし `beiwei-xiaozhuangdi` のように note 内で年またぎを自覚して書いているものも混ざる。
- **B: 元号（西暦）＋月日（58件）** — 安帝 `deathCause.note`「義熙14年（418年）12月戊寅」と同型でここに入る。
  西暦ラベル自体は慣用として正しく、月日と衝突している形。表記方針を決めれば一括で扱える
  （`qing-shengzu`・`nansong-ningzong`・`huan-xuan` など複数件持ちが多い）。
- **C: 旧暦と明示（1件）／D: 太陽暦の実日付表記（15件）** — いずれも誤りではない（`sui-gongdi-you` の
  「617年12月18日」型など、換算結果を書いているもの）。

### スイープB: `events[].date` の ISO 年（**note ではなくデータ側の問題**）

`sweep_event_iso_year.py`。判定は AI_RESEARCH_LESSONS の多数月方式（旧暦月の日数が最も多く属する太陽暦の年月）。

Issue は「データの日付フィールドは正しい」としているが、それが成り立つのは `reigns`・`ages` まで。
month 精度の event 日付 1389件のうち、

- **A: 旧暦十一月・十二月の年またぎで ISO 年が1年古い — 105フィールド（82イベント・53人）**
- B: 十一月・十二月以外での年ずれ — 0件
- C: 年は合っているが月ラベルが実太陽暦と1ヶ月ずれる（多数月方式の未適用） — 1008件

A は `docs/process/AI_RESEARCH_LESSONS.md`「9. 元号日付の暦換算」の
> **旧暦十一月・十二月は年またぎする。** ISO 年は必ず sxtwl の太陽暦出力から取る（年注記は紀年ラベル年）。

に反する。安帝自身もこのクラスに入る:

```
dongjin-andi / rebellionSufferedCount.events[9].startDate  ISO=0418-12-01 → 実太陽暦 0419-01
dongjin-andi / rebellionSufferedCount.events[9].endDate    ISO=0418-12-01 → 実太陽暦 0419-01
    劉裕（実行犯は王韶之）による弑逆＝義熙十四年十二月戊寅（0419-01-28）
```

同じレコード内で `reigns[0].endDate`・`ages.deathDate` は `0419-01-28`、`rebellionSuffered` の event だけ
`0418-12-01` になっている。全105件は `out_event_iso_year.txt` の「A」節。

**検出できないもの**: note/outcome に旧暦月が書かれていない event は照合の足場が無いので対象外。ISO 月が
note の旧暦月と一致しない event は「換算済み」とみなして飛ばしている。105件も**下限**。

C の1008件は A とは別問題として扱うべき（A は年が違うので在位範囲や表示年に効くが、C は月ラベルの粒度の話で、
件数からして「そもそも多数月方式を month 精度の event に適用する方針か」の判断が先）。

### スイープC: `accessionAge` が null なのに note が即位時年齢を書いている（10件）

`sweep_accession_age.py`。Issue 4 と同じ矛盾の横展開。内訳:

**note が断定していて `accessionAge` だけ欠けている（5件・成帝と同型）**

| id | 該当 note | 年齢 |
|---|---|---|
| `dongjin-chengdi` | `accessionRoute.note`・`personalCampaignCount.note` | 5歳 |
| `qianyan-murongwei` | `accessionRoute.note`「11歳で即位、叔父の慕容恪らが後見」 | 11歳 |
| `liu-song-houfeidi` | `personalCampaignCount.note`「即位時10歳・死没時15歳」 | 10歳 |
| `beiwei-xiaomingdi` | `personalCampaignCount.note`「延昌4年(515年)満4歳で即位」 | 4歳（満年齢表記） |
| `beizhou-jingdi` | `personalCampaignCount.note`「即位時8歳前後の幼帝」 | 8歳（「前後」付き） |

**note 側が「原文直接記載でないので未計上」と明記していて矛盾ではない（4件）**:
`hou-han-shaodi-yi`（低信頼度サイトの異説として却下）・`shiguo-nanhan-liuyan`・`liao-daozong`。

`hou-han-shaodi-yi` の `empressInstallationCount.note`「11歳で即位し半年足らずで病没」は、
同じレコードの `ages.note` が即位時年齢を「原文直接記載なし」として却下しているのと衝突する（成帝と同型の矛盾）。

## 提案（2026-08-02、ユーザー承認により全項目を実施済み）

1. **1・2・3・5 は本紀に合わせて note を訂正する**。3 は他史料にも「太極殿」の裏づけが無いので「西堂」でよい。
   2 だけ引用ゲート（`verify_quotes.py`）が必要。
2. **4 は `accessionAge: 5` を入れる**（`wei-caofang` の前例どおり、逆算根拠を `ages.note` に明記）。
   同時に上表の `qianyan-murongwei`・`liu-song-houfeidi`・`beiwei-xiaomingdi`・`beizhou-jingdi` も横展開で判定する。
   `beiwei-xiaomingdi` は満年齢表記、`beizhou-jingdi` は「前後」付きなので、数え年へ揃える個別確認が要る。
3. **スイープBの105フィールド（82イベント・53人）は #33 とは別 Issue に分ける**。note の言い回しではなく
   データの日付フィールドの系統誤差で、規模も影響範囲も違う。C（1008件）はさらに別の方針判断。

## 適用した訂正（2026-08-02）

ユーザー承認のうえ 18 箇所を訂正した。ゲートは `validate_emperors.py` 0 errors /
`verify_calendar.py` 0 errors / `verify_quotes.py --backfill && --check` 0 errors（陳腐化台帳の警告は
本訂正で 34→29 件に減少・本訂正由来の増加なし）。

| id | フィールド | 内容 |
|---|---|---|
| `jin-huaidi` | `personalCampaignCount.note` | 五月（倉垣）と六月（長安）の混同を解消し、皇帝本人の移動記事を2件として書き直し。判定 0 件は不変 |
| `jin-huaidi` | `capitalRelocationCount.events[0].note` | 入城・焚焼の主体を劉曜・王弥に訂正（石勒は洛川の交戦のみ） |
| `dongjin-aidi` | `deathCause.note` | 崩御地を「太極殿」→「西堂」。3史料の一致を明記 |
| `dongjin-andi` | `reigns[0].note` | 「403年に…降格」→「元興2年12月壬辰（西暦404年1月1日）」 |
| `dongjin-andi` | `deathCause.note` | 「義熙14年（418年）12月戊寅」→「義熙14年12月戊寅（西暦419年1月28日）」 |
| `dongjin-chengdi` | `ages.accessionAge` / `ages.note` | `5` を追加。逆算根拠（年号年差17・詔「於茲十有八年」）を明記 |
| `liu-song-houfeidi` | `ages.accessionAge` / `ages.note` | `10` を追加（生年463・即位472） |
| `beiwei-xiaomingdi` | `ages.accessionAge` / `ages.note` / `personalCampaignCount.note` | `6` を追加（数え年統一。note の「満4歳」を「数え6歳（満4歳）」へ） |
| `beizhou-jingdi` | `ages.accessionAge` / `ages.note` / `personalCampaignCount.note` | `7` を追加（note の「8歳前後」を「数え7歳」へ） |
| `qianyan-murongwei` | `accessionRoute.note` / `ages.note` | 値は置かず「11歳で即位」を削除。載記が処刑年を記さず逆算に1年の幅が残ることを ages.note に記録 |
| `hou-han-shaodi-yi` | `empressInstallationCount.note` | `ages.note` が年齢不明と結論済みなので「11歳で即位し」→「幼くして即位し」 |

`qianyan-murongwei` の処刑年は `_corpus_cache/qianyan-murongwei.txt`（晋書 載記）・
`daizhigev20/史藏/载记/别本十六国春秋.txt` のいずれにも記載がなく、ローカルコーパスでは確定できなかった。
385年なら数え10歳、384年なら11歳になる。
