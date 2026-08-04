"use client";

// 絞り込み UI の共有部品。ファイル名は旧統計ページ（グラフ面）の名残だが、
// 現在の消費者は皇帝一覧（/emperors）とデータベース（/database）の2面で、
// **両面で同じ形にしておきたい操作の置き場**になっている。

import type { ReactNode } from "react";
import { Info, Search, SearchX, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { DynastyCombobox } from "@/components/charts/dynasty-combobox";
import {
  dynastyCategoryDescriptions,
  dynastyCategoryOptions,
  type DynastyCategory,
  type DynastyOption,
} from "@/lib/emperor-types";
import { cn } from "@/lib/utils";

export type SortDirection = "desc" | "asc";

export function FilterField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    // 狭い画面ではフィールドを全幅にして、ラベル・入力・件数の左端をそろえる
    // （中の入力の w-full が効くよう、包む側にも幅を与える）。
    <div className="flex w-full flex-col gap-1 sm:w-auto">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {hint}
      </span>
      {children}
    </div>
  );
}

/**
 * 検索窓。**`InputGroup`（導入済み）で組む** — 2面が同じ形の
 * 「虫眼鏡 ＋ 入力 ＋ クリア」を各自 `relative` + 絶対配置の
 * アイコン + `pl-8` で手書きしていたのを1箇所に寄せた。
 *
 * クリア（×）を足したのは、それまで検索語を消す手段がキーボードだけ
 * だったため（入力があるときだけ出す。常設すると空欄でも押せる×が残る）。
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  label = "検索",
  ariaLabel,
  widthClass = "w-full sm:w-[220px]",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: string;
  ariaLabel: string;
  widthClass?: string;
}) {
  return (
    <FilterField label={label}>
      <InputGroup className={cn("transition-colors hover:bg-accent/50", widthClass)}>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          // 検索窓に入れたまま Enter を押しても何も起きない（絞り込みは入力に
          // 追従する）ので、囲いのフォームは持たない。
          type="search"
          // ブラウザ標準の×（Safari/Chrome の search キャンセル）は高さが
          // 合わないので殺し、下の InputGroupButton に一本化する。
          className="[&::-webkit-search-cancel-button]:appearance-none"
        />
        {value !== "" && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label="検索語を消す"
              onClick={() => onChange("")}
            >
              <X />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
    </FilterField>
  );
}

/**
 * 件数表示。**絞り込みの結果が古いあいだ（`pending`）はスピナーを出す。**
 *
 * 一覧・データベースはどちらも入力を即座に反映せず、365件の再レンダリングを
 * `useDeferredValue` で後追いさせている（キー入力をブロックしないため）。
 * 表示中の件数が「1つ前の条件の結果」であることを画面が何も示していなかったので、
 * ここに出す。**グリッド／表そのものは薄くしない** — 5万px級の箱に opacity を
 * 掛けると合成レイヤーが跳ね、この面が過去に踏んだ TBT/CLS の失敗に近づくため。
 *
 * `motion-reduce:hidden` は「視差効果を減らす」設定への対応。globals.css が
 * `animation-iteration-count: 1` を一括で当てるので、回さないスピナーが
 * 中途半端な角度で固まる。その環境では出さず、`aria-live` の文言だけで伝える。
 */
export function ResultCount({
  pending,
  className,
  children,
}: {
  pending: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      aria-live="polite"
      className={cn(
        "flex items-center gap-1.5 text-sm text-muted-foreground",
        className,
      )}
    >
      {pending && (
        <>
          <Spinner className="size-3.5 motion-reduce:hidden" aria-hidden />
          <span className="sr-only">絞り込み中</span>
        </>
      )}
      {children}
    </span>
  );
}

export type FilterChip = {
  /** React の key と、解除ボタンの読み上げに使う識別子。 */
  key: string;
  /** 「王朝: 唐」のように、どの条件がどの値で効いているかが分かる表記。 */
  label: string;
  onRemove: () => void;
};

/**
 * 効いている絞り込みのチップ列（2026-08-01）。
 *
 * 条件はフィルタ行の各コントロールが持っているが、**選んだ結果が一望できず**、
 * 0件になったときに何が効いているのか読み取れなかった。チップは条件の要約と
 * 個別解除を兼ねる。条件が無いときは何も描かない（空の行を残すと本文が下がる）。
 */
export function FilterChips({
  chips,
  onClearAll,
  className,
}: {
  chips: FilterChip[];
  onClearAll: () => void;
  className?: string;
}) {
  if (chips.length === 0) return null;
  return (
    <div className={cn("mb-4 flex flex-wrap items-center gap-2", className)}>
      <span className="text-xs text-muted-foreground">絞り込み</span>
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="gap-1 py-0.5 pr-1 pl-2 font-normal"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`${chip.label}を解除`}
            className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      {chips.length >= 2 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="text-muted-foreground"
        >
          すべて解除
        </Button>
      )}
    </div>
  );
}

/**
 * 0件のときの行き止まりを無くす（2026-08-01）。
 * それまでは素の1行で、**解除する導線がどこにも無かった**。
 */
export function NoResults({ onClearAll }: { onClearAll: () => void }) {
  return (
    <Empty className="my-6 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>条件に一致する皇帝がいません</EmptyTitle>
        <EmptyDescription>
          検索語を短くするか、絞り込みを外すと候補が広がります。
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={onClearAll}>
          絞り込みをすべて解除
        </Button>
      </EmptyContent>
    </Empty>
  );
}

export function DynastyCategoryHint() {
  return (
    <HoverCard openDelay={100} closeDelay={50}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label="王朝の区分について"
          className="text-muted-foreground/70 hover:text-foreground"
        >
          <Info className="size-3.5" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 text-sm">
        <ul className="space-y-2">
          {dynastyCategoryOptions.map((o) => (
            <li key={o.value}>
              <div className="font-medium">{o.label}</div>
              <p className="text-muted-foreground">
                {dynastyCategoryDescriptions[o.value]}
              </p>
            </li>
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}

export function ChartFilterControls({
  dynastyOptions,
  dynastyValue,
  onDynastyChange,
  categoryValue,
  onCategoryChange,
  sortDirection,
  onSortDirectionChange,
  sortLabel = { desc: "多い順", asc: "少ない順" },
  resultCount,
  resultUnit = "件",
  children,
}: {
  dynastyOptions: DynastyOption[];
  dynastyValue: string;
  onDynastyChange: (value: string) => void;
  categoryValue: DynastyCategory | "all";
  onCategoryChange: (value: DynastyCategory | "all") => void;
  sortDirection?: SortDirection;
  onSortDirectionChange?: (value: SortDirection) => void;
  sortLabel?: { desc: string; asc: string };
  resultCount?: number;
  resultUnit?: string;
  /** フィルタと同じ行の末尾に置く追加コントロール（表示件数切替ボタン・件数表示など）。 */
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-4">
      <FilterField label="王朝">
        <DynastyCombobox
          options={dynastyOptions}
          value={dynastyValue}
          onChange={onDynastyChange}
        />
      </FilterField>

      <FilterField label="王朝の区分" hint={<DynastyCategoryHint />}>
        <Select value={categoryValue} onValueChange={onCategoryChange}>
          <SelectTrigger
            className="w-full sm:w-[170px]"
            aria-label="王朝の区分で絞り込み"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            {dynastyCategoryOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      {sortDirection && onSortDirectionChange && (
        <FilterField label="並び順">
          <Select value={sortDirection} onValueChange={onSortDirectionChange}>
            {/* 狭い画面は全幅、sm以上は固定幅にする。どちらも幅が列か固定値から決まるので、
                自動幅と違いWebフォント読み込みで幅が変わらない（フィルタ行の折り返し位置が
                ずれてレイアウトシフトになる。PERFORMANCE.mdのCLS計測記録）。 */}
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="並び順">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">{sortLabel.desc}</SelectItem>
              <SelectItem value="asc">{sortLabel.asc}</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      )}

      {resultCount !== undefined && (
        <span className="text-sm text-muted-foreground sm:pb-2">
          {resultCount}
          {resultUnit}表示中
        </span>
      )}
      {children}
    </div>
  );
}
