# 被リンクプロファイル分析（emperorstats.com）

## 0. 前提・利用可能ソース

`claude-seo run backlinks_auth.py --check --json` の結果:

| ソース | 利用可否 | 備考 |
|---|---|---|
| Common Crawl Web Graph | 利用可 | 認証不要（公開データ） |
| 検証クローラ（verify_backlinks.py） | 利用可 | ローカルクローラ |
| Moz Link Explorer API | **不可** | `MOZ_API_KEY` 未設定 |
| Bing Webmaster Tools API | **不可** | `BING_WEBMASTER_API_KEY` 未設定 |
| DataForSEO | **不可** | 未導入 |

**判定: Tier 0**（Common Crawl + 検証クローラのみ）。DA/PA・参照ドメイン数・アンカーテキスト分布・トキシックリンク比率・リンクベロシティなど、スコアリング7要素のうち定量データが取得できるのは実質0〜1要素のみ。したがって本レポートでは**被リンク健全性スコア（0〜100点）を算出しない**。数値化すると根拠のない印象を与えるため、事実の列挙にとどめる。

---

## 1. Common Crawl ドメインレベル指標

```
claude-seo run commoncrawl_graph.py emperorstats.com --json
```

| 項目 | 値 |
|---|---|
| in_crawl | false |
| in_rankings | false |
| PageRank / 順位 | null / null |
| Harmonic Centrality / 順位 | null / null |
| 判定 | **未収載**（"Domain not found in Common Crawl data. It may be too new, too small, or not yet crawled."） |

**（source: Common Crawl, confidence: 0.50, データ鮮度: 四半期更新・今回参照した release は `cc-main-2026-jan-feb-mar`）**

**解釈**: `claude-seo run domain_history.py emperorstats.com --json` によると、ドメインの作成日は **2026-07-18**（レジストラ: GMO Internet Group, Inc. d/b/a Onamae.com、監査日 2026-07-27 時点で運用9日）。参照した Common Crawl リリース（2026年1〜3月クロール分）は本サイト開設より前の時点のクロールであるため、未収載は**異常ではなく当然の結果**。「Common Crawl 由来の外部権威シグナルは現時点で存在しない（そもそも計測対象期間外）」という事実であり、「低権威」の根拠にしてはならない。

- **重大度**: Info（欠陥ではない）
- **失敗判定**: 本サイト開設後（2026-07-18以降）にクロールされたはずの Common Crawl リリースでも同様に `in_crawl: false` のままなら、この「時期尚早だから」という説明は成立しなくなる。
- **先行指標**: 次回以降の Common Crawl リリース（本サイト開設後のクロール分）で `in_crawl: true` に変わるかどうかを `commoncrawl_graph.py` で再確認する。

---

## 2. 検証済み被リンク（実地確認）

WebSearch による網羅的な言及調査は本セッションでは実行できなかった（3節参照）。代わりに、本プロジェクトの GitHub リポジトリ（`https://github.com/kotenbu135/emperor-stats`、公開リポジトリ）を実地確認し、`verify_backlinks.py` で被リンクの実在を検証した。

```
claude-seo run verify_backlinks.py --target https://emperorstats.com \
  --links links.json --json
```
（`links.json`: `https://github.com/kotenbu135/emperor-stats` と同リポジトリの `README.md` の2 URL）

| リンク元 | HTTPステータス | リンク検出 | アンカーテキスト | rel属性 |
|---|---|---|---|---|
| https://github.com/kotenbu135/emperor-stats（リポジトリトップ） | 200 | あり | `emperorstats.com` | **nofollow** |
| https://github.com/kotenbu135/emperor-stats/blob/main/README.md | 200 | あり | `emperorstats.com` | **nofollow** |

**（source: 検証クローラ, confidence: 0.95 — 直接クロールして確認済み）**

README.md 本文（`raw.githubusercontent.com` から直接取得・確認）:
> `- **公開サイト**: [emperorstats.com](https://emperorstats.com)`

現時点で実地確認できた被リンクは **1参照ドメイン（github.com）・2 URL**（リポジトリトップと README、いずれも同一の1本のリンクをレンダリングしたもの）。両方とも `rel="nofollow"`。

追加検証として、GitHub がリポジトリ設定の「Website」欄（後述の `homepage` フィールド）由来のサイドバーリンクにも同様に `nofollow` を付与するかを、既に大量の外部被リンクを持つ既存の公開リポジトリ（`vercel/next.js` の `homepage=nextjs.org`）で実地確認した:

```
curl -s https://github.com/vercel/next.js | grep -oE '<a[^>]+href="https://nextjs\.org[^"]*"[^>]*>'
→ <a href="https://nextjs.org" rel="nofollow"> （他の nextjs.org 配下リンクも同様に rel="nofollow"）
```

**（source: 実地観測, confidence: 0.90 — 別リポジトリでの検証だが同一レンダラーのため類推の妥当性は高い）**

→ GitHub は README 内リンクだけでなく、リポジトリ設定「Website」欄由来のサイドバーリンクにも一貫して `rel="nofollow"` を付与する。したがって GitHub 経由のリンクは**検索エンジンのリンクグラフ上の権威シグナル（リンクジュース）としてはほぼ寄与しない**が、**実際の読者・クローラーの発見導線としては機能する**（クリックすれば正しく到達し、URL としてインデックスされうる）。以降の提案では、この区別（権威シグナル vs. 発見導線・引用起点）を明示する。

追加で GitHub API から取得したリポジトリメタデータ:

| 項目 | 値 |
|---|---|
| homepage（リポジトリ設定の「Website」欄） | **未設定（null）** |
| description | 未設定（null） |
| topics | 0件 |
| stargazers / forks / watchers | 0 / 0 / 0 |
| created_at | 2026-07-16T05:36:24Z |

**（source: GitHub REST API `repos/{owner}/{repo}`, confidence: 0.95）**

- **重大度**: Low（`homepage` フィールド未設定は被リンクの多寡ではなく発見導線の設定漏れ）
- **失敗判定**: GitHub の「Website」欄が実は既に設定済みだった、または設定してもリポジトリページ・API レスポンスに変化が出ない場合。
- **先行指標**: 設定後に `curl -s https://api.github.com/repos/kotenbu135/emperor-stats` の `homepage` フィールドが `https://emperorstats.com` になっていることを再確認する。

---

## 3. 取得不可／限定的に取得できた項目（正直な報告）

- **検索エンジン経由の外部言及の網羅調査**: 本セッションのツールセットには WebSearch 相当のツールが含まれておらず、また Bing/Moz/DataForSEO API キーも未設定のため、検索エンジンのインデックス上で `emperorstats.com` や「中国皇帝統計」を言及している外部ページを機械的に列挙する手段がなかった。フォールバックとして DuckDuckGo の非JS版（HTML lite）への直接リクエストを試みたが、bot対策のアノマリーチャレンジ（画像認証）が返され、これ以上のSERPスクレイピングは断念した。**この項目は「取得不可」のまま**。
- **GitHub コード検索（`api.github.com/search/code`）による全GitHub横断の言及調査**: 認証なしでは `401 Requires authentication` となり実行不可。**「取得不可」のまま**。
- **Wikipedia（日本語版・英語版）・Wikidata 上の言及**: SERP とは異なりボット対策のない公式 MediaWiki API で直接確認できたため、以下は「取得不可」ではなく**実測結果**として報告する。

  ```
  curl 'https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch=insource%3A%22emperorstats.com%22&format=json'
  → totalhits: 0
  curl 'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=insource%3A%22emperorstats.com%22&format=json'
  → totalhits: 0
  curl 'https://www.wikidata.org/w/api.php?action=query&list=search&srsearch=emperorstats.com&format=json'
  → totalhits: 0
  ```

  **（source: MediaWiki Search API, confidence: 0.90 — 全文検索インデックスの反映ラグはあるが直接クエリした実測値）**。日本語版・英語版 Wikipedia の本文、および Wikidata のいずれにも `emperorstats.com` への言及・リンクは現時点で0件。
- **参照ドメイン数・トキシックリンク比率・アンカーテキスト自然性・リンクベロシティ・follow/nofollow比率・地理的関連性**: Moz/Bing/DataForSEO 未導入のため、いずれも「取得不可」。2節の1参照ドメインのみが実地確認できたサンプルであり、母集団として統計的な比率を語れる件数ではない。

---

## 4. 総合評価

**被リンク健全性スコア: 算出不可（INSUFFICIENT DATA）**

理由: Tier 0 環境かつドメイン開設からわずか9日という状況で、定量評価に足る要素（参照ドメイン数・品質分布・トキシック比率・ベロシティ等）のデータソースが実質存在しない。無理に数値化すると「被リンクが弱い/強い」という誤った印象を生むため、本レポートでは数値スコアを提示しない。事実として言えるのは:
- Common Crawl 上の外部権威シグナルは、そもそも計測期間外のため現時点で「なし」
- 実地確認できた被リンクは GitHub（README・サイドバー両方 nofollow）からの1参照ドメインのみ
- Wikipedia（日本語・英語）・Wikidata の全文検索では言及0件（実測）
- 上記以外の言及の存在・非存在は SERP を確認できていないため「未確認」であり「ゼロ確定」ではない

- **失敗判定**: 今後 Moz や DataForSEO を導入した際に、参照ドメイン数が2桁以上・トキシック比率が測定可能な水準で見つかった場合、この「INSUFFICIENT DATA」判定は覆る（覆ってよい＝データが増えたら再評価するのが正しい運用）。
- **先行指標**: 月次で `commoncrawl_graph.py` と Wikipedia/Wikidata の `insource:` 検索を再実行し、`in_crawl` が `true` に変わる時点・全文検索の totalhits が0から増える時点を記録する。

---

## 5. リンク獲得経路の提案

一般論の「良質なコンテンツを作る」ではなく、本サイトの性質（**CC BY 4.0 のオープンデータセット**・**正史原典に基づく一次調査**・**GitHub で無料公開**）に即して実行可能な経路を優先度順に挙げる。いずれも自作自演のリンク構築やスパム投稿ではなく、実在するディレクトリ・コミュニティへの正規の登録・提案。**GitHub 経由のリンクは2節で確認した通り一貫して `nofollow` のため、以下は「リンク権威（PageRank相当）の獲得」ではなく「発見導線・引用起点・参照トラフィックの獲得」として位置づける。**

### 優先度High（即時・低コストで実行可能）

1. **GitHub リポジトリ設定の是正**（`kotenbu135/emperor-stats`）
   - `homepage` フィールドが未設定であることを2節で確認済み。リポジトリ設定の「Website」欄に `https://emperorstats.com` を設定すると、リポジトリページ上部・`github.com/kotenbu135?tab=repositories` 一覧にリンクが常設される（2節の実地確認どおり `rel="nofollow"` だが、GitHub を経由してサイトへたどり着く読者・データ利用者を増やす導線にはなる）。設定変更のみで新規コンテンツ作成不要。
   - あわせて `description`（例:「中国皇帝365人の在位・死因・即位経路データセット（CC BY 4.0）」）と `topics`（例: `chinese-history`, `open-data`, `dataset`, `csv`, `json-schema`）を設定すると、`github.com/topics/chinese-history` のようなトピック集約ページからの発見導線が増える。
   - 失敗判定: 設定後も GitHub リポジトリページ・API レスポンスの `homepage` が反映されない場合。先行指標: `curl -s https://api.github.com/repos/kotenbu135/emperor-stats` で `homepage` フィールドを確認。

2. **GitHub の Awesome リスト・データセット集への PR 提出**
   - `awesome-public-datasets`、`awesome-json-datasets` など、GitHub 上で実在し継続的にメンテナンスされている「awesome list」系リポジトリは、新規データセットの追記 PR を受け付けている（各リストの CONTRIBUTING 規約に従うこと）。採用されれば、スター数の多いリポジトリの README に掲載される（2節の検証どおり GitHub の README リンクは nofollow のため権威シグナルではないが、そのリポジトリを閲覧する開発者層への露出・引用起点になる）。
   - 失敗判定: PR が却下される、または掲載されても閲覧・クリックにつながらない場合。先行指標: 掲載後の Referer 由来トラフィック（Cloudflare Web Analytics 等、導入されていれば）またはリポジトリの star/fork 数の変化。

3. **Kaggle または Hugging Face Datasets への公開**
   - `data/emperors.csv`（41列・1行1皇帝の平坦化版、既に配布物として存在）を Kaggle の Datasets、または Hugging Face の Datasets Hub に登録し、出典欄・データカードに `https://emperorstats.com` と GitHub リポジトリへのリンクを明記する。どちらも CC BY 4.0 かつ安定した配布 URL（`emperorstats.com/data/emperors.csv`）を持つデータセットとの親和性が高く、プラットフォーム自体が独立したインデックス対象ページになるほか、二次利用者（Notebook・モデルカード作成者）が出典リンクを付ける慣行がある。
   - 失敗判定: 登録後30日以上ダウンロード・閲覧が0のまま、または出典リンクなしで転載される場合。先行指標: Kaggle/Hugging Face 側のダウンロード数・閲覧数。

### 優先度Medium（データ引用としての正規手続きが必要）

4. **Wikidata への出典追加**
   - 3節の実測で Wikidata 全文検索の言及は現状0件と確認済み。個々の皇帝の Wikidata アイテムには「参照URL」（P854）や「〜で説明されている」（P973 described at URL）のようなプロパティで外部出典を追加できる。本データセットが原典（正史）に基づき在位日数・死因・即位経路を個別調査済みであることを踏まえ、対応する皇帝アイテムの該当ステートメントに出典として追加提案する（Wikidata のガイドラインに従い、一括投稿ではなく個別の妥当性を確認しながら行う）。Wikidata のアイテムページはそれ自体が高被参照ドメインであり、かつ Wikipedia 側のインフォボックスにも波及しうる。
   - なお、Zenodo への DOI 登録は本プロジェクトで既に検討・**中止済み**（`zenodo-doi-postponed.md`）のため、本提案では再度提示しない。
   - 失敗判定: 追加提案がコミュニティにより差し戻される、または追加後もリファラー経由の流入が観測できない場合。先行指標: Wikidata アイテムの編集履歴に自分の追加が定着しているか、および3節と同じ `insource:` 検索の再実行結果。

5. **日本語版 Wikipedia の該当記事（例: 各王朝の皇帝一覧記事、「中国の皇帝一覧」等）の参考文献・外部リンク節への追加提案**
   - Wikipedia の COI（利害関係者）編集ガイドラインに従い、**自分で本文に直接追記するのではなく、該当記事のノートページで「一次史料に基づく在位日数・死因データセットが公開されている」旨を提案し、第三者の編集者の判断を仰ぐ**形にする。直接編集は自己言及・宣伝とみなされるリスクがあるため避ける。
   - 失敗判定: ノートページでの提案が一定期間反応なし、または追加不採用となった場合。先行指標: 3節と同じ `insource:"emperorstats.com"` 検索の再実行結果が0から増えるか。

6. **OpenRefine 向けの再照合（reconciliation）サービスとしての公開**
   - 本データセットは皇帝365人の一意な識別子（Wikidata QID を含む）を持つ構造化データであるため、OpenRefine の reconciliation service（W3C reconciliation API 仕様）として公開できる可能性がある。GLAM・デジタル人文学系のデータキュレーターが自分のデータセットを本データセットと突合する際の実利用導線になり、公開すればそのサービス自体が引用・言及の対象になりうる。ただし実装コスト（reconciliation API サーバーの構築）が他項目より高いため、優先度は Medium とする。
   - 失敗判定: 実装後も外部からの reconciliation リクエストが確認できない場合。先行指標: サービスのアクセスログでの外部リクエスト有無。

### 優先度Low（コミュニティ告知・話題化。1回限りの機会）

7. **Hacker News の "Show HN" 投稿**
   - `Show HN: 365 Chinese emperors' reign length, cause of death, and succession route (CC BY 4.0)` のような投稿は、Hacker News のコミュニティ規約に沿う自己公開データセットの紹介として一般的に許容されている（過度な誘導・複数回投稿は避ける）。リンクの rel 属性は未検証のため権威シグナルとしての効果は主張しないが、反応があれば技術ブログ等からの二次言及につながりうる。
   - 失敗判定: 投稿がフロントページに載らず反応が実質0の場合。先行指標: 投稿への upvote/コメント数、および後日の3節と同様の外部言及検索。

8. **Reddit の該当コミュニティへの投稿**
   - `r/dataisbeautiful`（可視化重視のルールに適合するグラフ・チャートのスクリーンショット＋出典リンクとして）、`r/China` または `r/AsianHistory` 等、データセットの内容に直接関連するサブレディットへの1回の紹介投稿。`r/AskHistorians` は自己プロモーションを明確に禁止しているため対象外とする。
   - 失敗判定: 投稿が削除される、または反応が実質0の場合。先行指標: 投稿への upvote/コメント数。

以上、優先度Highの3件（GitHub設定是正・Awesomeリスト提案・Kaggle/Hugging Face公開）は今週中に着手可能な作業量であり、他は継続的な提案・告知として扱う。
