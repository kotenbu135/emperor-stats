# 王朝ごとの色を決め、皇帝はその王朝の色を使う（塗りは地色に混ぜる）

Written against: 1540d63

> この計画はユーザーの決定「王朝ごとに色を決めて皇帝はその色を利用する」に基づく。
> `--chart-1〜5` は「王朝別カテゴリカルパレット（未確定）」として `globals.css:67` で予約されていた
> トークンであり、この決定はその用途を確定させるものになる（実体は既存の `--series-1〜8` を使うため、
> `--chart-*` 自体は Changes 8 で削除する）。
>
> **チャートの塗りを地色と混ぜる変更（淡彩化）も、この計画に統合している。**
> 王朝色の適用とチャートの塗りは同じ層をいじるため、別々の計画にすると半端に適用された状態
> （王朝色が生の彩度で入る）が生まれる。

## Evidence chain

- Surface: `/reign`・`/court-events`・`/military`・`/ages` の**11本のランキング棒グラフ**、`/dynasties` の平均在位年数、`/emperors` の肖像なしカード
- Problem: ランキング棒グラフが全て `#a6321c`（`--seal` 朱）の単色で塗られており、サイトの色の印象を朱一色が支配している。`/dynasties` は同一画面の上半分が朱一色・下半分が8色パレットで、色の言語が割れている。一方で「王朝」という、このサイトの主要な軸が色で表現されていない
- Design evidence:
  - `docs/site-design/LAYOUT.md:115`「朱色は印章的なワンポイント（ランキング1位バッジ等）**のみに限定使用**」
  - `docs/site-design/LAYOUT.md:124`「**王朝別カテゴリカルパレット**は…実装着手時に確定する」
  - `docs/site-design/LAYOUT.md:141`「画像なし211名分は…**王朝色**または朱印風の姓一文字モノグラムをプレースホルダー表示」← 王朝色の分岐は未実装
  - `src/lib/timeline-river.ts:98-100`「colorSlot は**意味ベース**: 漢系=4(金)・晋系=7(紫)・北族=1(青)・宋=2(緑)・明=8(朱)・隋/南朝梁系=5(青緑)など」
  - `src/lib/kinship/chapters.ts:671-672`「配色は timeline-river.ts の STREAM_DEFS と同じ意味ベース割当(漢系=4金・新=1青・秦=8朱・群雄=0灰)」
- Owner: 現在は**所有者が2つに割れている**。`src/lib/timeline-river.ts` の `STREAM_DEFS[].colorSlot`（87の dynastyKey を網羅）と `src/lib/kinship/chapters.ts` の `KINSHIP_COLOR_BY_DYNKEY`（37キー・第1〜4章分）
- Scope and affected surfaces: 新規 `src/lib/dynasty-colors.ts`、`src/components/charts/ranking-bar-chart.tsx`、`src/components/charts/dynasty-avg-reign-chart.tsx`、`src/components/charts/nivo-theme.ts`、`src/components/emperors/portrait.tsx`、`src/app/globals.css`
- Uncertainty: `--kinship-minor`（藤 `#8d7c94`）を系譜図の外でも使うことになるが、トークン名が `kinship-` 接頭辞のままになる。改名は別途判断（下記 Stop conditions）

## Design decision

**王朝 → 配色スロットの対応表を1つの共有モジュールに置き、ランキング棒グラフ・王朝集計グラフ・肖像なしカードがそれを参照する。**

新しいパレットは作らない。`--series-1〜8` は dataviz skill の手順で surface `#f5f1e8` に対して検証済み（CVD 安全性・コントラスト全項目 PASS）であり、そこへ87王朝を割り当てるだけにする。割り当ては新規に考えるのではなく、**すでにコード内に存在する2つの意味ベース対応表を統合**して導出する（漢系=金・北族=青・晋系=紫・宋=緑・明=朱赤・隋/梁系=青緑）。

### 統合ルール

87の dynastyKey 全てを網羅する対応表を、次の優先順で決める。導出結果は `design-plans/01-dynasty-color-map.reference.txt` に全87件を書き出してある。

1. `KINSHIP_COLOR_BY_DYNKEY` に定義があればそれを採る（37キー）
2. なければ `STREAM_DEFS[].colorSlot` を採る（残り50キー）

両者は18キーで食い違うが、その全てが「系譜図では政権ごとに色を分ける必要があるが、年表では群雄バンドに束ねるため灰にしている」か「同じバンドに同居する政権を別色にする」という**描画都合の差**である。王朝そのものの識別色としては、政権ごとに色を持つ系譜図側が正しい。したがって1が優先する。

### スロット0（`--kinship-minor` 藤）の扱い

統合後、37王朝（58人）がスロット0に落ちる。内訳は隋末群雄・十国の小国・元末群雄・明末群雄・唐代の反乱政権・赤眉・成家・仲家・中華帝国・呉周で、**いずれも1〜4人規模の割拠政権であり、`dynasty.category` は全て「並立政権」か「反乱・自称政権」**（正統王朝は1つも含まれない）。これは既存の `--kinship-minor` の定義「群雄・並立政権カプセル専用色」（`globals.css:96-98`）とそのまま一致する。

### ランキング棒グラフに使ってよいかの検証結果

棒グラフは値で降順ソートされるため、隣り合う棒が同じ色になると帯が繋がって読めなくなる懸念がある。実データで測った：

| 対象 | 隣接同色率 | 使用スロット数 |
|---|---|---|
| 在位期間 上位20 | 16% | 5 |
| 在位期間 上位40 | 23% | 7 |
| 在位期間 上位100 | 21% | 8 |
| 在位期間 全365 | 17% | 9 |

**17〜23%であり、実用に耐える。** 各棒には既に王朝名がラベルされているため、色は「どの王朝か」を解読する鍵ではなく「同じ王朝の皇帝がどこに固まっているか」を見せるグルーピングの手掛かりとして働く（上位20では清・遼・西夏が色で塊として見える）。凡例は付けない——87王朝の凡例は成立しないため。

### 塗りの濃度 — 生の彩度で塗らない

`--series-1〜8` は識別性を優先して検証した値のため、`#2a78d6`（純度の高い青）・`#e34948`（赤）・`#008300`（純緑）と彩度が高い。これを宣紙色の地にそのまま塗ると、低彩度でまとめたクロームから浮き、グラフだけが別のサイトのように見える（`nivo-theme.ts` の `categoryColorMaps` の値が `category-pie-chart.tsx:137` の `colors` へそのまま渡っている）。

サイト内にはすでに解法が2つある。`/timeline` は `color-mix` で宣紙色に混ぜた淡彩（`src/components/timeline/river-timeline.tsx:106-117` の `streamColors()`、塗り42%/縁82%。群雄は `--foreground` の10%/38%）、`/kinship` も同じ手法（`src/lib/kinship/style.ts:19-24`、正統は塗り42%/縁82%、並立政権は塗り40%/縁80%）を使っており、**この2ページだけが地に馴染んでいる**。

> 注意: `TIMELINE.md:176` に出てくる「正統40%/並立22%」は**第1世代の年表の記録**で、`TIMELINE.md:186` の第2世代（大河ビュー・2026-07-21 全面再設計）に置き換わっている。現行の実装値は上記のとおり。

したがって王朝色を新しく適用する面（ランキング棒・王朝集計棒・カードのモノグラム）も、生の値ではなく `color-mix` で地色に混ぜた濃度で塗る。混合比は用途ごとに決める:

| 用途 | 濃度 | 根拠 |
|---|---|---|
| ランキング棒・王朝集計棒の塗り | `--background` に対して 55% | 帯として面積が大きいため `/timeline` の正統(42%)より濃く、生(100%)よりは抑える |
| 同・境界線 | 82% | `style.ts` の正統と同じ。塗りより一段濃い輪郭で形を締める |
| カードのモノグラム背景 | 22% | 既存のどれよりも淡くする（`style.ts` の並立政権は40%）。姓一文字の上に肖像枠として敷くため、文字が読める淡さに落とす |

この「地色に混ぜてから塗る」規則は円グラフにも同じく適用する。円グラフは王朝ではなく死因・即位経路を符号化しているが、彩度が浮いている問題は同じで、混合比だけの変更で揃う。

### 適用しないサーフェス

- **`/timeline`**: すでに同じスロットで王朝別に塗られている。`color-mix` で宣紙色に混ぜた淡彩（`river-timeline.tsx:106-117` の塗り42%/縁82%）は第2世代の設計判断であり維持する。この計画では**対応表の供給元**として扱い、描画は変更しない
- **`/kinship`**: レイアウト凍結中。すでに同じスロットで塗られている。**一切変更しない**
- **`/death-accession` の円グラフ、`/dynasties` の死因の内訳**: 死因・即位経路というカテゴリを符号化しており、王朝軸ではない。変更しない

## Reuse

- `--series-1` 〜 `--series-8`（`src/app/globals.css:88-95`）— dataviz 検証済み
- `--kinship-minor`（`src/app/globals.css:98`）— 群雄・並立政権の専用色
- `KINSHIP_COLOR_BY_DYNKEY`（`src/lib/kinship/chapters.ts`）と `STREAM_DEFS[].colorSlot`（`src/lib/timeline-river.ts`）— 統合元
- `dynastyKey()`（`src/lib/emperors.ts:305`）— `name__section` のキー生成。**現在 export されていないため、新モジュールから参照するには export を足す必要がある**
- Exemplar: `src/lib/kinship/style.ts:21,25`（`color-mix(in srgb, var(--series-N) 42%, var(--background))` によるスロット→実色の解決）

**新しいプリミティブが必要な理由**: 王朝の識別色は現在2箇所に重複して存在し、18キーで食い違っている。3箇所目を作らずに済ませるには、共有モジュールを新設して既存2箇所をそこへ寄せるしかない。置き場所は `src/lib/dynasty-colors.ts`（`lib/kinship/` の下ではない。系譜図専用ではなくなるため）。共有すべき利用者は、ランキング棒グラフ・王朝集計グラフ・肖像カード・系譜図・年表。

## Changes

1. `src/lib/dynasty-colors.ts`（新規）
   - Change: `DYNASTY_COLOR_SLOT: Record<string, number>` を定義する。中身は `design-plans/01-dynasty-color-map.reference.txt` の87件をそのまま使う。あわせて `dynastyColorVar(slot: number): string`（スロット→CSS変数名。0は `--kinship-minor`、1〜8は `--series-N`）と `dynastyColorHex(slot: number): string`（Nivo は CSS 変数を解決できないため `nivo-theme.ts` と同じ方式でハードコード値を返す）を export する。未知のキーが来たらスロット0にフォールバックせず **throw する**（皇帝を追加収録したときに気づけるようにする。`eraLabelOf` の既存方式に揃える）
   - Preserve: `--series-N` の実値、`--kinship-minor` の実値
   - Verify: 87キー全てが定義されている。`data/emperors.json` の全 dynastyKey が解決できる

2. `src/lib/kinship/chapters.ts`
   - Change: `KINSHIP_COLOR_BY_DYNKEY` の定義を削除し、`DYNASTY_COLOR_SLOT` からの再エクスポート（または直接参照）に置き換える。**値は1つも変わらない**（統合ルール1で kinship 側が優先されるため）
   - Preserve: 第1〜4章の描画結果がピクセル単位で変わらないこと。ノード座標・章スタック・`style.ts` の `color-mix` 比率
   - Verify: 変更前後で `/kinship` のスクリーンショットが一致する

3. `src/lib/timeline-river.ts`
   - Change: `STREAM_DEFS[].colorSlot` は**そのまま残す**。ただしコメントを追記し、「これは*ストリーム*の表示スロットであり、群雄バンドに束ねた流れは意図的に灰(0)にしている。王朝そのものの識別色は `src/lib/dynasty-colors.ts` が持つ」と明記する
   - Preserve: 年表の描画結果が変わらないこと。`STREAM_DEFS` への追記チェックリスト（`site/AGENTS.md`）
   - Verify: `/timeline` のスクリーンショットが変更前と一致する

4. `src/components/charts/nivo-theme.ts:73`
   - Change: `rankingSeriesColor` を削除する（`#a6321c` の単色指定）
   - Preserve: `nivoTheme` 本体、`categoryColorMaps`（死因・即位経路の8色割当）
   - Verify: 参照元が2箇所とも差し替わっていること

5. `src/components/charts/ranking-bar-chart.tsx:226`
   - Change: `colors={[rankingSeriesColor]}` を、行ごとに `dynastyColorHex(DYNASTY_COLOR_SLOT[dynastyKey], 55)` を返す関数に差し替える（第2引数は地色との混合率）。あわせて `borderWidth: 1` と 82% 濃度の `borderColor` を入れて形を締める。棒データに dynastyKey を持たせる必要があれば行の組み立て側に追加する
   - Preserve: 行ウィンドウイング、`LazyMount`、量子化ウィンドウとスクロール中ホバー抑制、`FixedTooltip`、ソート・フィルタ、皇帝名リンクの `hover:text-seal`、`nice: false`
   - Verify: `/reign`・`/court-events`（5本）・`/military`（3本）・`/ages`（2本）の全ランキングが王朝色になる。同一王朝の棒が同色になる
6. `src/components/charts/dynasty-avg-reign-chart.tsx:133`
   - Change: 同様に、各棒（＝1王朝）を自身の王朝色で塗る。**集計単位が「時代別」のときは王朝色が定義できない**ため、その場合のみ単色にフォールバックする（`--series-1` 青。朱には戻さない）
   - Preserve: 皇帝数のラベル併記、`ChartTakeaway`、集計単位トグル、5名未満を比較から除く扱い
   - Verify: `/dynasties` の上下2チャートが同じ色の言語になる

6b. `src/components/charts/category-pie-chart.tsx:137` と `src/components/charts/dynasty-death-cause-chart.tsx`
   - Change: `colorMap` の生の16進値をそのまま渡すのをやめ、地色と混ぜた濃度（塗り 55%・境界 82%）で渡す。`darkSlices` によるラベル色の反転判定は、混合後の色で再計算する
   - Preserve: 死因8カテゴリ・即位経路9カテゴリの**色の割り当てそのもの**（`categoryColorMaps`）、`arcLinkLabel` の内容、凡例の HoverCard、`CenteredTotal` レイヤー、`design-plans/06` で調整する margin
   - Verify: `/death-accession` の円グラフ2枚と `/dynasties` の死因の内訳が、`/timeline` の帯と同じ濃度感になる。8色の識別が保たれている（淡くしすぎない）

7. `src/components/emperors/portrait.tsx:21-28`
   - Change: `Monogram` の `bg-secondary` を、その皇帝の王朝色を宣紙色に混ぜた淡彩（`color-mix(in srgb, var(--dynasty-color) 22%, var(--background))`）に置き換える。文字色 `text-muted-foreground/50` は据え置くか、コントラストが不足する場合のみ同色系の濃色にする。`PortraitSubject` に王朝情報を渡す必要がある
   - Preserve: 3:4 の固定枠、`object-fit: cover` + `object-position: top`（肖像あり側）、`srcset` によるサムネ出し分け、`select-none font-heading font-semibold`、`large` バリアント
   - Verify: `/emperors` で肖像なしカード215枚（365人 − 肖像150件）が王朝ごとに色づく。同じ時代見出しの下のカードがまとまって見える

8. `src/app/globals.css:31-35,67,102-106`
   - Change: `--chart-1〜5` の定義と `@theme inline` のマッピングを削除する（この計画で王朝色の実体は `--series-N` に決まったため、予約トークンは役目を終える）。67行目のコメントを「王朝別の識別色は `src/lib/dynasty-colors.ts` が `--series-1〜8` と `--kinship-minor` へ割り当てる」に書き換える
   - Preserve: `--series-1〜8`、`--kinship-minor`、`--seal`、`scrollbar-gutter: stable`、`body[data-scroll-locked][data-scroll-locked]` の二重補正打ち消し、カスタムスクロールバー
   - Verify: `rg -- '--chart-' src/` が空

## Scope

- Inherit: `/reign`・`/court-events`・`/military`・`/ages`・`/dynasties`・`/emperors`
- Verify: `/timeline`・`/kinship`（**描画が1ピクセルも変わらないこと**）
- Exclude: `/death-accession` の円グラフ、`/dynasties` の死因の内訳、`/emperors/[id]` のイベント種別の色ドット、`--seal` の用途（ランキング1位バッジ・見出しアクセント・現在地ナビ）

## Validation

- Product: ランキングを眺めたときに「上位は清と遼と西夏に偏っている」といった王朝の塊が色で見える。肖像のない皇帝カードも王朝ごとにまとまって見える
- Interface: 上記6ルート＋`/death-accession` を 1440px・375px で開く。とくに (a) `/dynasties` の上下2チャートが同じ色の言語になっていること (b) `/reign` 全365件をスクロールして、隣接同色の帯が読みづらい塊を作っていないこと (c) `/emperors` の淡彩モノグラムで姓一文字が読めること (d) スロット8（赤 `#e34948`）の王朝（秦・明・南明・後趙・西魏）が `--seal` の朱と混同されないこと (e) **チャートの塗りが `/timeline` の帯と同じ濃度感に見えること**（`/timeline` と `/reign` を並べて比較する） (f) 淡彩化しても死因8カテゴリの識別が保たれていること
- System: 王朝→色の対応が `src/lib/dynasty-colors.ts` の1箇所だけに存在すること（`rg 'colorSlot|COLOR_BY_DYNKEY' src/` の結果が、年表のストリーム表示スロットと新モジュールのみ）。`--series-N` の実値を変更していないこと
- Repository: `npx tsc --noEmit` → エラー0、`npm run lint` → エラー0、`npm run build` → 成功。`/timeline`・`/kinship` の変更前後スクリーンショットが一致

## Stop conditions

- `/kinship` の描画が変更前と1ピクセルでも変わった場合は停止する。第1〜4章は凍結済みで、配置も配色もユーザーが確定させたもの
- `/reign` 全365件で隣接同色の帯が読みづらいと判断した場合は停止して報告する。その場合の代替は「王朝色は `/dynasties`（1棒＝1王朝）と `/emperors` カードにのみ適用し、皇帝単位のランキング棒は `--series-1` の単色にする」——この計画の主目的（ランキング棒の朱一色をやめる）は満たしたまま後退できる
- `--kinship-minor` を系譜図の外で使うことに違和感がある場合、`--dynasty-minor` への改名を提案して停止する。改名は `globals.css`・`style.ts`・`chapters.ts` に波及するため、この計画には含めない
- スロット8（赤）と `--seal`（朱）の識別が実物で付かない場合は停止して報告する。秦・明という主要王朝が該当するため、スロットの入れ替えが要る
- 淡彩化して死因8カテゴリの識別が落ちた場合は停止して報告する。`--series-1〜8` は CVD 安全性を検証済みだが、**それは生の値に対しての検証**であり、地色と混ぜた後の組み合わせは再検証していない。混合率を下げる（濃くする）か、円グラフだけ生の値に戻す判断が要る

## Design documentation

- 受け入れ・検証後、以下を同時に更新する:
  - `docs/site-design/LAYOUT.md:115` — 「朱は印章のワンポイントのみ」に、ランキング棒が朱でなくなったことを反映
  - `docs/site-design/LAYOUT.md:124` — 「王朝別カテゴリカルパレットは未確定」を「`--series-1〜8` + `--kinship-minor` への意味ベース割当として確定（`src/lib/dynasty-colors.ts`）」に更新
  - `docs/site-design/LAYOUT.md:141` — 肖像なしカードの「王朝色」分岐が実装済みになったことを反映
  - `docs/site-design/LAYOUT.md:165,175,206` — `--chart-1〜5` の申し送りを削除し、ランキング棒の配色記述を実装に合わせる
  - `docs/site-design/TIMELINE.md:123,164,176` — `--chart-1〜5` の申し送りを削除
  - `site/DESIGN.md` の Colors 節 — 「王朝の識別色は `--series-1〜8` と `--kinship-minor` の意味ベース割当で与える。この8色を単一エンティティの棒グラフへ流用しない」という趣旨に改める（現在の記述は朱の限定使用を前提にしており、この決定と整合しない）。あわせて「これらの色は生の値で塗らず、必ず地色と混ぜた濃度で使う」を追記する
  - `site/AGENTS.md` — 皇帝追加収録時のチェックリストに「`src/lib/dynasty-colors.ts` への追記（未知キーは throw する）」を追加
