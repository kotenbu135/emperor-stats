"use client";

// 王朝フィルタ用の検索可能コンボボックス。選択肢が87件と多く素のSelectでは
// スクロールが長すぎるため、cmdk+Popoverでテキスト入力による絞り込みを付けた
// （docs/site-design/LAYOUT.md「王朝フィルタの検索可能Combobox化」）。
// トリガーは固定幅（自動幅だとWebフォント読込で折り返しがずれCLSになる）・
// aria-label必須（role=comboboxのボタンは中身がアクセシブルネームにならない）。

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { DynastyOption } from "@/lib/emperor-types";
import { toHiragana } from "@/lib/kana";

/** 王朝の選択肢を時代グループごとにまとめる（受け取った並び順を保持）。 */
export function groupByEra(
  options: DynastyOption[],
): [string, DynastyOption[]][] {
  const groups: [string, DynastyOption[]][] = [];
  for (const o of options) {
    const last = groups[groups.length - 1];
    if (last && last[0] === o.era) {
      last[1].push(o);
    } else {
      groups.push([o.era, [o]]);
    }
  }
  return groups;
}

export function DynastyCombobox({
  options,
  value,
  onChange,
}: {
  options: DynastyOption[];
  /** 選択中の dynastyKey。未選択は "all"。 */
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel =
    value === "all"
      ? "すべての王朝"
      : (options.find((o) => o.value === value)?.label ?? "すべての王朝");
  const select = (v: string) => {
    onChange(v);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* 見た目はSelectTriggerに揃える（select.tsxのクラスの抜粋）。 */}
      <PopoverTrigger
        role="combobox"
        aria-expanded={open}
        aria-label="王朝で絞り込み"
        className="flex h-8 w-[200px] items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[200px] p-0">
        <Command
          // cmdk既定のあいまい一致は漢字1字でも飛び石マッチして候補が絞れないため、
          // ラベル・時代名・読み（keywords経由）の部分一致のみ採用する。クエリは
          // NFKC正規化（半角カナ→全角等）+ひらがな化して、かな・カナどちらでも引ける。
          filter={(itemValue, search, keywords) => {
            const target = `${itemValue} ${(keywords ?? []).join(" ")}`;
            const q = search.normalize("NFKC").trim();
            return target.includes(q) || target.includes(toHiragana(q)) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="王朝名で検索" />
          <CommandList>
            <CommandEmpty>該当する王朝がありません。</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all"
                keywords={["すべての王朝"]}
                data-checked={value === "all" || undefined}
                onSelect={() => select("all")}
              >
                すべての王朝
              </CommandItem>
            </CommandGroup>
            {groupByEra(options).map(([era, group]) => (
              <CommandGroup key={era} heading={era}>
                {group.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.value}
                    keywords={[o.label, o.era, ...o.kana]}
                    data-checked={value === o.value || undefined}
                    onSelect={() => select(o.value)}
                  >
                    {o.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
