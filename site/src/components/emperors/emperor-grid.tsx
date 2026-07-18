"use client";

// 皇帝一覧の「図鑑」グリッド（docs/site-design/LAYOUT.md「皇帝一覧カードのレイアウト方針」）。
// カード枠は3:4固定・肖像はcover+topで顔を切らずにフィット、画像なしは姓一文字の
// モノグラムをプレースホルダー表示する。カードを押すと詳細ダイアログを開く。

import { memo, useCallback, useDeferredValue, useMemo, useState } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

/** モノグラムに使う一文字。姓（諱の頭文字）を優先し、なければ通称の頭文字を使う。 */
function monogramChar(record: EmperorRecord): string {
  return (record.personalName ?? record.name).charAt(0);
}

/** 肖像がない皇帝のプレースホルダー（姓一文字を大きく淡く表示）。 */
function Monogram({ char, large = false }: { char: string; large?: boolean }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-secondary">
      <span
        className={`select-none font-heading font-semibold text-muted-foreground/50 ${
          large ? "text-6xl" : "text-4xl"
        }`}
      >
        {char}
      </span>
    </div>
  );
}

function Portrait({
  record,
  sizes,
  large = false,
  priority = false,
}: {
  record: EmperorRecord;
  sizes: string;
  large?: boolean;
  /** ファーストビューのカードで指定する。既定のloading="lazy"だと先頭カードの
   *  肖像がLCP要素なのに読み込みが後回しになりLCPが大幅に悪化する
   *  （LAYOUT.mdのLighthouse計測記録）。 */
  priority?: boolean;
}) {
  if (!record.portraitUrl) return <Monogram char={monogramChar(record)} large={large} />;
  return (
    <Image
      src={record.portraitUrl}
      alt={`${record.name}の肖像`}
      fill
      sizes={sizes}
      priority={priority}
      className="object-cover object-top"
    />
  );
}

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
    <button
      type="button"
      onClick={() => onSelect(record)}
      className="group overflow-hidden rounded-md border border-border bg-background text-left transition-colors hover:border-seal/60 focus-visible:outline-2 focus-visible:outline-ring"
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
    </button>
  );
});

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function ageText(age: number | null): string {
  return age === null ? "不詳" : `${age}歳（数え年）`;
}

function EmperorDetailDialog({
  record,
  onClose,
}: {
  record: EmperorRecord | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={record !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {record && (
          <>
            <DialogHeader className="text-left">
              <DialogTitle className="font-heading text-xl">
                {record.name}
              </DialogTitle>
              <DialogDescription>
                {/* 「明（明）」「呉・三国（三国）」のような重複を避け、
                    王朝名から時代が読み取れない場合だけ時代を付す。 */}
                {record.dynastyLabel.includes(record.eraLabel) ||
                record.eraLabel.includes(record.dynastyName)
                  ? record.dynastyLabel
                  : `${record.dynastyLabel}（${record.eraLabel}）`}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-4">
              <div className="relative w-28 shrink-0 self-start overflow-hidden rounded-md border border-border aspect-[3/4]">
                <Portrait record={record} sizes="112px" large />
              </div>
              <dl className="min-w-0 flex-1 text-sm">
                {record.personalName && (
                  <DetailRow label="諱（本名）" value={record.personalName} />
                )}
                {record.templeName && (
                  <DetailRow label="廟号" value={record.templeName} />
                )}
                <DetailRow label="在位" value={record.periodsLabel} />
                <DetailRow label="在位期間" value={record.reignDurationLabel} />
                <DetailRow
                  label="即位経路"
                  value={record.accessionRouteCategory}
                />
                <DetailRow label="死因" value={record.deathCauseCategory} />
                <DetailRow label="即位時年齢" value={ageText(record.accessionAge)} />
                <DetailRow label="没年齢" value={ageText(record.deathAge)} />
              </dl>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 text-sm sm:grid-cols-4">
              {(
                [
                  ["改元", record.eraChangeCount],
                  ["大赦", record.amnestyCount],
                  ["立后", record.empressInstallationCount],
                  ["皇太子廃立", record.crownPrinceDepositionCount],
                  ["親征", record.personalCampaignCount],
                  ["反乱鎮圧", record.rebellionSuppressionCount],
                  ["被反乱", record.rebellionSufferedCount],
                  ["遷都", record.capitalRelocationCount],
                ] as const
              ).map(([label, count]) => (
                <div
                  key={label}
                  className="flex justify-between gap-2 border-b border-border/60 py-1.5"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">{count}回</dd>
                </div>
              ))}
            </dl>
            {record.posthumousName && (
              <p className="text-xs text-muted-foreground">
                諡号：{record.posthumousName}
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

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
