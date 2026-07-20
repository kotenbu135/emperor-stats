# note・出典のサイト活用 実装計画

`data/emperors.json` に記録済みの `note`（総量約100万字）と出典情報を、皇帝個別ページ（`/emperors/[id]`）と詳細ダイアログで表示する。2026-07-20 検討開始。

## 現状分析（2026-07-20 調査）

### note は性格の異なる3層

| 層 | フィールド | 規模 | 表示適性 |
|---|---|---|---|
| 経緯系 | `deathCause.note`・`accessionRoute.note` | 各365件・中央値98/69字 | ◎ そのまま読める歴史叙述。手直し不要 |
| イベント系 | 8指標の `events[].note` ほか構造化フィールド | 約5,600件 | ○ date/target/outcome/leader は年表化できる。note 本文は判定根拠（「カウント対象外とした」等）が混在 |
| 調査根拠系 | 各指標の `count.note`・`ages.note` | 中央値150〜220字 | △ 調査ログ。折りたたみでの透明性担保向き |

`reigns[].note` の先頭一文のみ既に復位経緯表示に使用中（`emperors.ts`）。それ以外は未活用。

### 出典の所在と穴

- `deathCause.source`: 365件。ただし**28件は Wikipedia 記事名風**（「始皇帝」「恵帝 (漢)」等、前漢初期など初期調査分）で、337件が正史巻名（「後漢書 孝和孝殤帝紀」等）
- `accessionRoute.source`: 365件、概ね正史巻名
- `reigns[].duration.source`: 374件（page/lang/note）
- events の構造化 source: **改元 576/681・大赦 1110/1338・立后 227/278・廃立 28/35 のみ**
- **親征・鎮圧・被反乱・遷都の events には source フィールドが無い**（出典は note 本文か指標レベル `count.note` の中に書名として埋め込み。note 内に史書名言及があるのは親征 143/291・鎮圧 619/1494・被反乱 362/1853・遷都 58/58）
- 指標レベル（`eraChangeCount` 等）にも source フィールドは無い（`note` 内に「旧唐書巻二・巻三を通読」等の形で記載）

### 技術的制約と設計判断

- 統計ページは全365人分の `EmperorRecord` をクライアント props に埋め込むため、**note を `EmperorRecord` に追加しない**（全ページのペイロードが数百KB膨らむ）。個別ページは Server Component の静的書き出しなので何を載せてもクライアント負荷ゼロ
- note は**原文ママ表示**が原則（サイト側での要約・書き換えはしない）。判定根拠系は「調査メモ」と明示的にラベリングして表示位置を分ける
- `EmperorDetailBody` は共用部品なので、個別ページ専用の追加情報は optional な `extras` prop（または別コンポーネント）で渡し、ダイアログ側の描画・ペイロードに影響させない

---

## 第1弾: 個別ページに「死因の経緯」「即位の経緯」+ 出典表示

最小の手数で一番読み応えのある部分を活かす。

2026-07-20 実装完了。

- [x] `emperors.ts` に個別ページ専用の取得関数 `getEmperorNarrative(id)` を追加。`deathCause.note/source`・`accessionRoute.note/source`・`reigns[].note`（復位経緯の全文）・調査メモを返す。`EmperorRecord` には含めない
- [x] `/emperors/[id]/page.tsx` で取得し、新規部品 `emperor-narrative.tsx`（`EmperorNarrativeSections`）で `EmperorDetailBody` の直後に表示（共用部品には手を入れない）
  - 「即位の経緯」「死因の経緯」の2節（lg以上2カラム）。全文プローズ表示＋「出典: 旧唐書 巻一（…）」形式、`source.note` は「補記:」で併記。復位者8名は「復位の経緯」節を追加
  - Wikipedia 記事名風の出典28件は「Wikipedia日本語版記事「恵帝 (漢)」」と正直に表示（`HISTORY_SOURCE_PATTERN` で判別。第4弾の差し替え対象）
- [x] 「調査メモ（回数・年齢の数え方と判定根拠）」節（`details` 折りたたみ・既定閉): 回数系8指標の `count.note`＋`ages.note` を原文ママ一覧表示
- [x] lint / tsc / build 確認、`docs/site-design/LAYOUT.md` に設計判断を追記

## 第2弾: 個別ページに「在位中の出来事」年表

2026-07-20 実装完了。

- [x] 8指標の `events[]` を日付順にマージするビルド時関数 `getEmperorEvents(id)`（`EmperorEventRow` に正規化。ソートキーは astroYear ベース）
- [x] 表示: 種別ドット（--series-1〜8）＋種別名＋日付＋要約1行の行リスト（新規 `emperor-event-timeline.tsx`）
  - 要約は構造化フィールド優先（親征: target、鎮圧/被反乱: name または「{leader}の反乱」、遷都: 旧都→新都、改元/大赦等: note 先頭一文）
  - note 全文＋対象/首謀者/結果＋出典はネイティブ `details` の行ごと折りたたみに格納
- [x] 件数対策: 種別フィルタチップ（単一選択トグル・件数付き）。イベント最多の南宋高宗（223件）で表示・フィルタ動作確認済み
- [x] `datePrecision` に応じた日付丸め（自由記述precisionは接頭辞で正規化・判別不能は年精度へ安全側）。紀元前は `formatYear`/`astroYear` 流用
  - 補足: 西暦未換算（元号+旧暦表記）の日付が250件・18人分あり（北宋仁宗は全69件）。原文ママ表示で種別順のまま末尾グループ化で対応。第4弾で西暦換算するかは任意
- [x] lint / tsc / build 確認、LAYOUT.md 追記
- [x] （追加対応）経緯noteの原文ママ表示で内部用語混入が判明 → データ側で16件言い換え+整合訂正2件（PROJECT_STATUS.md「対応済みの訂正（2026-07-20）」）

## 第3弾: 詳細ダイアログへの反映（lazy fetch）

2026-07-20 実装完了。

- [x] prebuild スクリプト（`sync-portraits.mjs` と同方式）で `public/emperor-notes/{id}.json` を365件生成（死因・即位経緯＋出典のみ、実測 平均約760バイト・合計約280KB）。`build-emperor-notes.mjs`、`predev`/`prebuild` に追加、生成物は `.gitignore`
- [x] ダイアログを開いた時だけ `${BASE_PATH}/emperor-notes/${id}.json` を fetch して経緯2節を表示（`emperor-narrative-dialog.tsx`、`NarrativeBlock` を再利用）。取得失敗・経緯なし（404）は非表示のまま
- [x] 年表はダイアログには載せず、個別ページへの既存導線に任せる
- [x] 静的書き出し（`out/emperor-notes/` に365件）を確認。ダイアログ使い回し（`id`のみ変化）で経緯が確実に差し替わるよう取得結果を `{id, notes}` で持ちid一致時のみ派生表示（effect内同期setState回避）。`useDetailOutlet` の再レンダリング分離は不変
- [x] tsc / lint / build 通過、Chrome 実操作で始皇帝→高帝の開き直し・差し替え・コンソールエラー0件を確認、LAYOUT.md 追記

## 第4弾（後日・データ側追加調査）: 出典の穴埋め

サイト表示で出典欠落が目立つ箇所を、`docs/process/RESEARCH_PROCESS.md` の手順（原典調査・スクリプト自動生成禁止）で埋める。着手時は `meta.status` とドキュメントの同時更新を忘れないこと。

- [ ] **優先度高**: `deathCause.source` の Wikipedia 記事名風28件（前漢初期等）を正史巻名出典へ差し替え（該当人物の本紀を個別確認）
- [ ] **優先度中**: 改元105件・大赦228件・立后51件・廃立7件の events[].source 欠落分の補完
- [ ] **優先度低（規模大・要方針判断)**: 親征・鎮圧・被反乱・遷都の events[]（計約3,700件）への source フィールド追加。note 内に史書名言及があるものも転記は個別確認が必須。まずは第2弾の表示で指標レベル `count.note` 内の書名を出典代わりに見せて様子を見る
- [ ] スキーマ文書（`data/schema/`）への events[].source 全指標正式化の追記

---

## 進め方

第1弾を実装して見た目を確認 → 良ければ第2弾以降へ。第4弾はサイト表示で出典の穴が実際に目立つか確認してから着手判断。
