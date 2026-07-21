"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChartFilterControls,
  type SortDirection,
} from "@/components/charts/chart-filter-controls";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  DynastyCategory,
  DynastyOption,
  RestorationRow,
} from "@/lib/emperor-types";

export function RestorationTable({
  rows,
  dynastyOptions,
}: {
  rows: RestorationRow[];
  dynastyOptions: DynastyOption[];
}) {
  const [dynastyValue, setDynastyValue] = useState("all");
  const [categoryValue, setCategoryValue] = useState<DynastyCategory | "all">("all");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const filtered = rows.filter(
    (r) =>
      (dynastyValue === "all" || r.dynastyKey === dynastyValue) &&
      (categoryValue === "all" || r.dynastyCategory === categoryValue),
  );
  const sorted = [...filtered].sort((a, b) =>
    sortDirection === "desc"
      ? b.reignCount - a.reignCount
      : a.reignCount - b.reignCount,
  );

  return (
    <div>
      <ChartFilterControls
        dynastyOptions={dynastyOptions}
        dynastyValue={dynastyValue}
        onDynastyChange={setDynastyValue}
        categoryValue={categoryValue}
        onCategoryChange={setCategoryValue}
        sortDirection={sortDirection}
        onSortDirectionChange={setSortDirection}
        resultCount={sorted.length}
      />
      <div className="max-h-[560px] overflow-y-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>皇帝</TableHead>
              <TableHead>王朝</TableHead>
              <TableHead>在位期間</TableHead>
              <TableHead className="text-right">即位回数</TableHead>
              <TableHead className="min-w-[240px]">復位の経緯</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="align-top">
                  <Link
                    href={`/emperors/${r.id}`}
                    className="underline-offset-2 hover:text-seal hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {r.name}
                  </Link>
                </TableCell>
                <TableCell className="align-top text-muted-foreground">
                  {r.dynastyLabel}
                </TableCell>
                <TableCell className="align-top tabular-nums text-muted-foreground">
                  {r.periodsLabel}
                </TableCell>
                <TableCell className="align-top text-right tabular-nums">
                  {r.reignCount}
                </TableCell>
                <TableCell className="whitespace-normal align-top text-muted-foreground">
                  {r.restorationReasons.map((reason, i) => (
                    <p key={i} className={i > 0 ? "mt-1" : undefined}>
                      {reason}
                    </p>
                  ))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
