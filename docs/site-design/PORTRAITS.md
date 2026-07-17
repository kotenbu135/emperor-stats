# 肖像画収集の実現可能性調査（2026-07-17）

サイトに皇帝の肖像画を掲載する構想について、**実際に画像が取得できるか**をdata/emperors.json収録の364名全員で確認した記録。**画像の実装自体はデータ確定後（[CLAUDE.md](../../CLAUDE.md)参照）**に着手する。

## 経緯

1. 参考にできる先行事例として「鳥人間 中国史三昧」（YouTubeチャンネル）の画像の出典を調査したが、動画説明欄・チャンネルAbout・Xいずれにも出典表記はなく（BGMクレジットのみ）、モデルにはできないと判断
2. 出典・ライセンスが明示されている一次ソース（Wikimedia Commons／台北故宮オープンデータ）を使う方針に決定
3. 実際に364名分取得できるか確認する過程で、Wikimedia API（`action=opensearch`・REST `page/summary`）への逐次リクエストが429（レート制限）を頻発させる事態が発生。過剰なリクエスト量だったことを踏まえ、**ライブAPI呼び出しをすべて中止**し、Wikimedia公式のデータダンプ（一括ダウンロード＋完全ローカル処理）に方式を切り替えた

## 採用した方式：データダンプによるオフライン照合

zh.wikipedia のダンプ（`dumps.wikimedia.org/zhwiki/latest/`、2026-07-06時点スナップショット）3ファイル（合計約340MB）をダウンロードし、以降は**追加のネットワークアクセスなし**でローカル処理のみで照合した。

| ファイル | 内容 | サイズ |
|---|---|---|
| `page.sql.gz` | ページID⇔タイトル対応表 | 約269MB |
| `page_props.sql.gz` | ページの`page_image_free`（自由ライセンスのリード画像の有無） | 約51MB |
| `redirect.sql.gz` | リダイレクト解決 | 約18.6MB |

### 処理の流れ

1. `data/emperors.json`の`name`（personalName/commonName/aliases/templeName/posthumousName）と`dynasty.name`から候補タイトルを機械的に生成（王朝名プレフィックス付与、括弧内別名の抽出など）
2. **日本語新字体→中国語繁体字/簡体字の変換**を候補に適用（例: 「呉三桂」→「吳三桂」/「吴三桂」）。データ内の人名表記が日本語入力由来の新字体であるため、zh.wikipediaのタイトル（繁体字/簡体字）と直接一致しないケースが多数あり、この変換により取りこぼしが18件→0件に減少
3. 候補タイトルを`page.sql`と照合し、リダイレクトなら`redirect.sql`で解決先タイトルを取得、最終的なページIDを特定
4. ページIDが`page_props.sql`の`page_image_free`を持つか判定

候補生成・王朝バリアント表などの機械的な変換ロジックのみで、**人物ごとの歴史的判定は一切行っていない**（[CONSTRAINTS.md](../process/CONSTRAINTS.md)の「計算補助スクリプトはOK」の範囲内）。

## 結果

| 区分 | 人数 |
|---|---|
| **自由ライセンス画像あり（`page_image_free`）（機械照合時点）** | 168人 / 364人（約46%） |
| **うち目視確認の結果、実際に肖像画だったもの** | 155人 |
| **うち肖像画ではなかったもの（目視確認で除外）** | 13人 |
| **うちCC BY-SA 4.0ライセンスのため方針により除外（下記参照）** | **2人** |
| **最終的な確定数** | **153人** |
| 記事はあるが自由ライセンス画像なし（除外分含む） | 211人 |
| 記事自体が見つからない | 0人 |

- 全364名がzh.wikipediaの何らかの記事にマッチ（取りこぼしなし）
- 153名分の詳細（照合したタイトル・画像ファイル名）は [`portraits-candidates.json`](./portraits-candidates.json) に記録
- 残り211名は本調査では**「画像なし」として一旦保留**。実装時に個別確認する

### 目視確認で除外した13名（2026-07-17）

機械的な照合（`page_image_free`の有無）だけでは、**画像が実際に肖像画かどうかまでは判定できない**。ダウンロード後にサンプルを実際に表示したところ、`beiwei-xiandi`（北魏献文帝）の画像が肖像画ではなく雲岡石窟の風景写真だったことが発覚。ユーザーが13名分を目視確認し、以下がいずれも肖像画ではない（風景・石窟・仏像・建造物等の写真）と判定、`confirmed`から除外し画像ファイルも削除・`noImageIds`に移動した。

`beiwei-houfeidi-yuanlang` `beiwei-mingyuandi` `beiwei-wenchengdi` `beiwei-xiandi` `beiwei-xiaowendi` `han-liuhe` `houzhao-shihu` `jin-taizong` `liang-xiaoji` `liang-xiaozhuang` `liao-taizu` `shun-lichengzheng` `xiliao-dezong`

**このため、`page_image_free`による機械的な一次スクリーニングは有効だが、最終的な採否は必ず人間の目視確認を経ること**（[CONSTRAINTS.md](../process/CONSTRAINTS.md)の「判定そのものをスクリプトに代行させない」の精神と整合）。

### CC BY-SA 4.0ライセンスを方針により除外（2026-07-17）

目視確認を経て残った155件のうち、CC BY-SA 4.0（要クレジット表記）ライセンスだった2件（`beiwei-daowudi`、`shiguo-qianshu-wangjian`）は、**「CC BY-SA系ライセンスは使用しない」という方針決定**により追加で除外した。画像ファイル・`manifest.json`のエントリを削除し、`portraits-candidates.json`では`noImageIds`へ移動、除外理由は`excludedLicense`フィールドに記録。**最終的な確定数は153件**、全件Public domain/CC0のみとなり、要クレジット表記の対応は不要になった。

## 画像ダウンロード（2026-07-17）

機械照合の168名分の画像本体を取得し、`data/images/portraits/` に配置（目視確認で13名分、CC BY-SA方針除外で2名分を除外、現在**153ファイル**）。

- **保存形式**: `{id}.jpg` / `{id}.png`（`data/emperors.json`の`id`フィールドと1対1対応、サイト側でのファイル名からの逆引きが容易）
- **取得方法**: オリジナル画像ではなく**幅500pxのサムネイル**を取得（[Wikitech Robot policy](https://wikitech.wikimedia.org/wiki/Robot_policy)・[API:Etiquette](https://www.mediawiki.org/wiki/API:Etiquette)に基づき、原寸よりサムネイルを優先・リクエスト間隔1秒以上・同時接続数1を遵守）。オリジナルのまま取得すると数十MB級のファイルが混在することが判明したため（例: 宋徽宗43MB）、サムネイル方式に変更した
- **合計サイズ**: 約19MB（153ファイル、平均約130KB）
- **URL特定方法**: Wikimedia Commonsのアップロード先URLはファイル名のMD5ハッシュから機械的に算出できる（`upload.wikimedia.org/wikipedia/commons/thumb/{md5[0]}/{md5[0:2]}/{filename}/{width}px-{filename}`）ため、API（`api.php`/`rest_v1`、レート制限で問題が起きた経路）を一切経由せず、静的配信CDNへの直接アクセスのみで完結した
- **出典マニフェスト**: [`data/images/portraits/manifest.json`](../../data/images/portraits/manifest.json) に、各ファイルの元Commonsファイル名・CommonsページURL・ライセンス情報を記録（非肖像画と判定された13件・CC BY-SA方針除外の2件は削除済み）

## ライセンス確認（2026-07-17）

ダウンロード直後の168件全件について、Commons Action API（`prop=imageinfo&iiprop=extmetadata`、1リクエストで最大50件までタイトルをまとめて問い合わせ可能なため、168件でも約4リクエストのみで完了。以前レート制限で問題を起こした逐次アクセスとは異なる使い方）でライセンス種別・作者・クレジット情報を取得。その後、目視確認で非肖像画と判定した13件、およびCC BY-SA方針により2件を除外し、**現在の153件は全件`licenseVerified: true`かつPublic domain/CC0のみ**。

| ライセンス | 件数（153件中） |
|---|---|
| Public domain | 150 |
| CC0 | 3 |

- **要クレジット表記が必要な画像は0件**。CC BY-SA 4.0だった2件（`beiwei-daowudi`、`shiguo-qianshu-wangjian`）は「CC BY-SA系は使用しない」という方針決定により除外したため（掲載時のクレジット表記対応が不要になった）
- Public domain / CC0（153件）は法的な表記義務はないが、出典明示は望ましい
- 目視確認で除外前に要クレジット表記だった10件（`beiwei-houfeidi-yuanlang`等）は、非肖像画だったため既に除外済み — **CC BY-SA系（現代のCommons投稿者が撮影した写真）は、PD/CC0系（歴史的絵画のデジタル化）と比べて肖像画ではない誤マッチ率が明らかに高かった**。今後同様の照合を行う際は、CC BY-SA系ヒットは特に目視確認を優先するとよい

## 未確認・今後の注意点

- **`page_image_free`はあくまで「自由ライセンスの画像がある」ことを示すフラグであり、画像が肖像画かどうか・具体的なライセンス種別（PD/CC-BY/CC-BY-SA等）は含まれない**。今回13件で実際に非肖像画（風景・石窟等）が混入したことからも、**機械照合だけで完結させず必ず目視確認を挟む**必要がある
- 211名の「画像なし」は、zh.wikipediaの`page_image_free`が未設定・またはCC BY-SA方針除外なだけで、Commons側や他ソースには画像が存在する可能性がある（Commonsダンプでの追加調査は、圧縮時点で数十GB規模になり今回の目的に対して不釣り合いと判断し見送った）。実装時に台北故宮オープンデータや個別のCommons検索で追い足す余地あり（その際もCC BY-SA系は対象外とする）
- 153名の画像も、故宮系肖像画・晩笑堂竹莊畫傳系の複製画像など出典が混在しているため、掲載前に出典・ライセンス種別を人物ごとに改めて確認する
