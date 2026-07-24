# 系譜・家系図（/kinship）拡張ガイド

`/kinship` を秦・漢の第1章から全王朝へ段階拡張するときの確定方針・規範・手順。
実装は `worktree-kinship-v2`。コードは `site/src/lib/kinship/`（`chapters.ts`＝キュレーション表、
`layout.ts`＝ビルド時レイアウト、`tree.ts`＝バンド内パッキング）と
`site/src/components/kinship/kinship-chart.tsx`（SVG描画）、`site/src/app/kinship/page.tsx`。

## 確定方針（2026-07-25）

- **構成**: 章スタック（1枚SVGにはしない）。時代ごとの章を縦に積み、時間は章をまたいで
  下へ連続。章ごとに独立SVG＋独立`<Section>`。交差問題は章内に閉じ込める。
- **当面のスコープ**: 五代十国まで。有効化する章は6つ:
  `qin-han`（済）→ `sanguo-xijin` → `dongjin-shiliuguo` → `nanbeichao` → `sui-tang` →
  **五代十国だけの章**（後述の分割）。宋遼金西夏以降は生母データ未完のため保留。
- **作業単位**: 1章ずつ・時代順。次は `sanguo-xijin`（三国・西晋）。
- **公開**: 五代十国まで揃うまで noindex 維持（`nav-data.ts`/`SITE_SECTIONS` 未登録）。
- **五代十国の章境界**: 章枠 `wudai-song` は「五代十国＋宋遼金西夏」を束ねている。
  データ完了線に合わせ **五代十国だけの章に分割**し、宋遼金西夏は後日の別章にする。
- **並立が多い章（十六国・南北朝・十国）**: まず横スクロール許容で素直に並べ、
  破綻したらその章だけ群雄をクラスタ化する。
- **各章の完成基準（DoD）**: `npm run build` 緑（4ゲート通過）＋
  `python3 scripts/validate_kinship.py` 緑＋目視で下記「規範」遵守。

## 配色

- 主要王朝は `--series-1〜8`（globals.css）を **章内で使い回す**（章は視覚的に分離するので
  スロットの意味が章ごとに変わってよい）。`KINSHIP_COLOR_BY_DYNKEY`（chapters.ts）で割当。
  **未登録は灰へ silent fallback（throwしない）** ので、章追加時は全dynastyKeyへ意図的に割当てる。
- **群雄・並立政権は専用の1色に統一**（灰は非皇帝の破線ピルと紛らわしいため廃止）。
  `--series-1〜8` と被らない **専用トークン `--kinship-minor`** を新設し、全時代の群雄に共通適用する。
  具体色の第一候補は「くすんだ藍鼠（スレート青灰）」。三国章の実描画で1〜2色試して確定する。
  ※非皇帝のつなぎ人物ノードは従来どおり灰＋破線（皇帝カプセルは実線なので群雄と区別可）。

## レイアウト規範（全章で一貫適用）

- カプセル高さ＝在位期間／破線枠＝非皇帝つなぎ人物／丸枠＝配偶者（相手の在位に整列）。
- **生母の連結線**: 夫にattachする母が1人なら夫カプセルの上下中央から、2人以上なら上下対称に
  振り分ける（`consortCountByHusband` 判定。`CONSORT_BOTTOM_ATTACH` で個別に下辺指定）。
- 王朝内の継承＝カプセル内「第N代・即位経路」表記。**矢印は王朝間の交代（禅譲・簒奪など）だけ**。
- 二重線＝皇后との夫婦／細線＝妃嬪等の生母／点線＋?＝諸説あり。
- **遠祖の系譜主張＝皇帝カプセルのツールチップに全文**（`wrap`。グラフ内バッジ・末尾一覧はしない）。
- バンド見出し・王朝見出しは補助線・矢印より後に描画し、**ハローで交差線を隠す**。
- 縦1年＝8px の等間隔（`PX_PER_YEAR`）。章頭以前の祖先は圧縮領域（`PRE_RATE`）に置く。
- **品質ゲート（線が当事者以外を横断／ノード重なり／垂下点の段差／年線整合）は絶対に緩めない**。
  違反はキュレーション表で解消する: バンド順・`CHILD_ORDER_OVERRIDES`・`CONSORT_BOTTOM_ATTACH`・
  `BAND_X_EXTRA`・`PERSON_BAND_OVERRIDES`・`DYNASTY_HEAD_OFFSET`・`BAND_LABEL_ANCHOR`・
  `CLAIM_LINE_DEFS`（すべて chapters.ts）。← 章追加時の作業量の主因はここ。

## 章を1つ有効化する手順

1. `KINSHIP_CHAPTER_DEFS`（chapters.ts）で当該章の `bands` をキュレーション
   （対象皇帝の全dynastyKeyを重複なく被覆。未割当はビルドがthrowして気づける）。
2. `KINSHIP_ENABLED_CHAPTER_IDS` に章idを追加（emperors.ts のスコープはここから自動導出）。
3. `KINSHIP_COLOR_BY_DYNKEY` に新dynastyKeyの配色を割当（主要王朝＝series枠、群雄＝`--kinship-minor`）。
4. `npm run build` を回し、品質ゲート違反をキュレーション表の調整で潰す（違反メッセージに
   横断・重なりの当事者と座標が出る）。1章分の違反が0になるまで反復。
5. `validate_kinship.py` 緑＋目視で規範遵守を確認。次の章へ。

## 既存ルール（変更なし）

- 婚姻エッジ＝皇后のみ（二重線）。妃嬪は生母attachのみで婚姻線は引かない。
- 女性皇帝は `FEMALE_EMPEROR_IDS`（chapters.ts）手書き（emperors.json に性別欄がない）。
- 追尊帝・僭称帝の収録は `data/schema/KINSHIP_SCHEMA.md` のスコープ基準に従う。

## 経緯

- 2026-07-25: 第1章（秦・漢）のレイアウト5件修正（生母中央化・前漢見出しずらし・テキスト版廃止・
  遠祖主張ツールチップ全文化・新（王氏）見出しのz順修正）を規範として確定。以降はこの規範で全章展開。
