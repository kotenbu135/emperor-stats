"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
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
import { DynastyCombobox } from "@/components/charts/dynasty-combobox";
import {
  dynastyCategoryDescriptions,
  dynastyCategoryOptions,
  type DynastyCategory,
  type DynastyOption,
} from "@/lib/emperor-types";

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
