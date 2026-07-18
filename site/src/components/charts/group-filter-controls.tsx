"use client";

// 王朝・時代横断ビュー用のフィルタ行。集計単位（王朝別/時代別）・王朝の区分・並び順を提供する。
// 皇帝単位のグラフ用フィルタ（ChartFilterControls）とはコントロール構成が異なるため別コンポーネント。

import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterField } from "@/components/charts/chart-filter-controls";
import {
  dynastyCategoryOptions,
  type DynastyCategory,
} from "@/lib/emperor-types";
import type { GroupUnit } from "@/components/charts/dynasty-aggregate";

/** 並び順。chrono＝時代順（王朝はデータ内初出順、時代はeraOrder順）。 */
export type GroupSort = "desc" | "asc" | "chrono";

export function GroupFilterControls({
  unit,
  onUnitChange,
  categoryValue,
  onCategoryChange,
  sort,
  onSortChange,
  sortLabel,
  children,
}: {
  unit: GroupUnit;
  onUnitChange: (value: GroupUnit) => void;
  categoryValue: DynastyCategory | "all";
  onCategoryChange: (value: DynastyCategory | "all") => void;
  sort: GroupSort;
  onSortChange: (value: GroupSort) => void;
  /** 値ソートの表示名（例: {desc: "長い順", asc: "短い順"}）。 */
  sortLabel: { desc: string; asc: string };
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-4">
      <FilterField label="集計単位">
        <Select value={unit} onValueChange={onUnitChange}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dynasty">王朝別</SelectItem>
            <SelectItem value="era">時代別</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="王朝の区分">
        <Select value={categoryValue} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-[170px]">
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

      <FilterField label="並び順">
        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">{sortLabel.desc}</SelectItem>
            <SelectItem value="asc">{sortLabel.asc}</SelectItem>
            <SelectItem value="chrono">時代順</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      {children}
    </div>
  );
}
