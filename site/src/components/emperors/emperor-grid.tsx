"use client";

// 皇帝一覧の「図鑑」グリッド（docs/site-design/LAYOUT.md「皇帝一覧カードのレイアウト方針」）。
// カード枠は3:4固定・肖像はcover+topで顔を切らずにフィット、画像なしは姓一文字の
// モノグラムをプレースホルダー表示する。カードを押すと詳細ダイアログを開く。

import { memo, useCallback, useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FilterField,
  groupByEra,
} from "@/components/charts/chart-filter-controls";
import type {
  DynastyCategory,
  DynastyOption,
  EmperorRecord,
} from "@/lib/emperor-types";
import {
  dynastyCategoryOptions,
} from "@/lib/emperor-types";
import { Portrait } from "@/components/emperors/portrait";
import { EmperorDetailDialog } from "@/components/emperors/emperor-detail-dialog";

/** 一覧のカード1枚。フィルタ・検索のたびに364枚を再レンダリングしないようmemo化
 *  （実機Lighthouse timespanで操作ごとの再レンダリングがTBT・遅延レイアウトシフトの
 *  一因だったため）。 */
const EmperorCard = memo(function EmperorCard({
  record,
  priority,
  onSelect,
}: {
  record: EmperorRecord;
  priority: boolean;
  onSelect: (record: EmperorRecord) => void;
}) {
  return (
    // クローラが一覧→個別365ページを辿れるよう実DOMに<a href>を出す。素の左クリックは
    // preventDefaultして従来どおり詳細ダイアログを開き、修飾クリック（新規タブ等）は
    // ブラウザに委ねて個別ページへ遷移させる（progressive enhancement）。
    <Link
      href={`/emperors/${record.id}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onSelect(record);
      }}
      className="group block overflow-hidden rounded-md border border-border bg-background text-left transition-colors hover:border-seal/60 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        <Portrait
          record={record}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
          priority={priority}
        />
      </div>
      <div className="px-2.5 py-2">
        <div className="truncate text-sm font-medium text-foreground group-hover:text-seal">
          {record.name}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {record.dynastyLabel}
        </div>
      </div>
    </Link>
  );
});

export function EmperorGrid({
  records,
  dynastyOptions,
}: {
  records: EmperorRecord[];
  dynastyOptions: DynastyOption[];
}) {
  const [query, setQuery] = useState("");
  const [dynastyValue, setDynastyValue] = useState("all");
  const [categoryValue, setCategoryValue] = useState<DynastyCategory | "all">("all");
  const [selected, setSelected] = useState<EmperorRecord | null>(null);
  const onSelect = useCallback((record: EmperorRecord) => setSelected(record), []);
  // 入力欄の反応を優先し、グリッドの絞り込み再レンダリングは低優先度で追従させる
  // （1文字ごとに364カードの再レンダリングがキー入力をブロックしないように）。
  const deferredQuery = useDeferredValue(query);

  // 検索は空白区切りの全語がヒットした皇帝のみ表示（名称・別名・王朝名・時代が対象）。
  const filtered = useMemo(() => {
    const tokens = deferredQuery.trim().split(/\s+/).filter(Boolean);
    return records.filter(
      (r) =>
        (dynastyValue === "all" || r.dynastyKey === dynastyValue) &&
        (categoryValue === "all" || r.dynastyCategory === categoryValue) &&
        tokens.every((t) => r.searchText.includes(t)),
    );
  }, [records, deferredQuery, dynastyValue, categoryValue]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <FilterField label="検索">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="名前・王朝名など"
              className="w-[220px] pl-8"
            />
          </div>
        </FilterField>
        <FilterField label="王朝">
          <Select value={dynastyValue} onValueChange={setDynastyValue}>
            {/* aria-label: role=comboboxのボタンは中身のテキストがアクセシブルネームに
                ならない（chart-filter-controls.tsxと同じ対応）。 */}
            <SelectTrigger className="w-[200px]" aria-label="王朝で絞り込み">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての王朝</SelectItem>
              {groupByEra(dynastyOptions).map(([era, options]) => (
                <SelectGroup key={era}>
                  <SelectLabel>{era}</SelectLabel>
                  {options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="王朝の区分">
          <Select
            value={categoryValue}
            onValueChange={(v) => setCategoryValue(v as DynastyCategory | "all")}
          >
            <SelectTrigger className="w-[170px]" aria-label="王朝の区分で絞り込み">
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
        <span className="pb-2 text-sm text-muted-foreground">
          全{filtered.length}名を表示中
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-sm text-muted-foreground">
          条件に一致する皇帝が見つかりませんでした。
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((r, i) => (
            <EmperorCard
              key={r.id}
              record={r}
              // ファーストビュー相当（最大6カラム×2行）だけ先行読み込みする。
              priority={i < 12}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      <EmperorDetailDialog record={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
