# 「王朝の区分」フィルタの説明アイコンを全サーフェスに揃える

Written against: 1540d63

## Evidence chain

- Surface: `/dynasties`（平均在位年数・死因の内訳）と `/emperors`（一覧のフィルタ行）
- Problem: 「王朝の区分」という同じラベルの同じフィルタが、統計チャートのページでは ⓘ の説明を持ち、この2ページでは持たない。「正統／並立／反乱・自称」はこのサイト固有の区分で、説明なしでは何を選んでいるか分からない
- Design evidence: `src/components/charts/chart-filter-controls.tsx:111` `<FilterField label="王朝の区分" hint={<DynastyCategoryHint />}>`。`FilterField`（同ファイル27-45行）は `hint?: ReactNode`（`:33`）を受ける共有プリミティブで、ラベルの右に並べる（`:38-41`）
- Owner: `src/components/charts/chart-filter-controls.tsx` の `FilterField` と `DynastyCategoryHint`
- Scope and affected surfaces: `src/components/charts/group-filter-controls.tsx:60`、`src/components/emperors/emperor-grid.tsx:269`
- Uncertainty: `DynastyCategoryHint` は現在 module-private（`function DynastyCategoryHint()`、export なし）。export を足す必要がある

## Design decision

`DynastyCategoryHint` を export し、`hint` を渡していない2箇所に渡す。同じラベル・同じ選択肢・同じ意味のフィルタなので、説明の有無がページによって変わる理由がない。

説明文を各所に書き直すのではなく既存コンポーネントを共有する。区分の定義が変わったときに1箇所で直せる状態を保つため。

## Reuse

- `DynastyCategoryHint`（`src/components/charts/chart-filter-controls.tsx:47-73`）— `HoverCard` + `Info` アイコン + `aria-label="王朝の区分について"` を含む完成品
- `FilterField` の `hint` prop
- Exemplar: `src/components/charts/chart-filter-controls.tsx:111`

新しいプリミティブは不要。

## Changes

1. `src/components/charts/chart-filter-controls.tsx`
   - Change: `function DynastyCategoryHint()` を `export function DynastyCategoryHint()` にする
   - Preserve: `HoverCard` の `openDelay={100} closeDelay={50}`、`HoverCardContent` の `className="w-72 text-sm"`、`aria-label`、`Info` の `size-3.5`、本文
   - Verify: 既存の `/reign`・`/ages`・`/military`・`/court-events`・`/death-accession` で ⓘ の挙動が変わらない

2. `src/components/charts/group-filter-controls.tsx:60`
   - Change: `<FilterField label="王朝の区分">` を `<FilterField label="王朝の区分" hint={<DynastyCategoryHint />}>` にし、import を追加する
   - Preserve: `SelectTrigger` の `className="w-[170px]"` と `aria-label="王朝の区分で絞り込み"`、選択肢、集計単位トグルと並び順のフィールド
   - Verify: `/dynasties` の両セクションで「王朝の区分 ⓘ」になる

3. `src/components/emperors/emperor-grid.tsx:269`
   - Change: 同上
   - Preserve: 検索入力・王朝 Combobox・件数表示・時代アンカーのリンク行のレイアウト。フィルタ行が折り返す位置
   - Verify: `/emperors` のフィルタ行で「王朝の区分 ⓘ」になる

## Scope

- Inherit: `/dynasties`・`/emperors`
- Verify: `/reign`・`/ages`・`/military`・`/court-events`・`/death-accession`（`DynastyCategoryHint` の export 化で挙動が変わっていないこと）
- Exclude: 「王朝」（Combobox）側・「並び順」・「集計単位」。これらはラベルも選択肢も異なる別のフィルタ

## Validation

- Product: どのページからでも「正統／並立／反乱・自称」の意味を、ページを離れずに確認できる
- Interface: `/dynasties`・`/emperors` を 1440px・375px で開き、ⓘ にホバー／フォーカスして説明が出ること。375px でフィルタ行の折り返しが崩れないこと
- System: 説明文を複製していないこと（`DynastyCategoryHint` の呼び出しになっていること）
- Repository: `npx tsc --noEmit` → エラー0、`npm run lint` → エラー0、`npm run build` → 成功

## Stop conditions

- `emperor-grid.tsx` は既に `:26` で `chart-filter-controls` から `FilterField` を import しているため、モジュール境界は増えない。新たに依存グラフへ入るのは `HoverCard`（`@/components/ui/hover-card`）のみ。`/emperors` の初期ロードに目に見える悪化が出る場合は停止して報告する（`DynastyCategoryHint` を独立ファイルに切り出す判断が要る）

## Design documentation

- 受け入れ・検証後: なし（既存の設計判断の適用であり、新しい決定を含まない）
