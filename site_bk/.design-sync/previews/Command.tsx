import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "site";

/**
 * 王朝コンボボックスの中身（実装では PopoverContent の中に置く）。
 * 時代ごとに CommandGroup で見出しを付ける。
 */
export function DynastyPicker() {
  return (
    <div className="w-[240px] overflow-hidden rounded-md border border-border">
      <Command>
        <CommandInput placeholder="王朝名で検索" />
        <CommandList>
          <CommandEmpty>該当する王朝がありません。</CommandEmpty>
          <CommandGroup>
            <CommandItem value="all">すべての王朝</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="秦漢">
            <CommandItem value="qin">秦</CommandItem>
            <CommandItem value="qianhan">前漢</CommandItem>
            <CommandItem value="houhan">後漢</CommandItem>
          </CommandGroup>
          <CommandGroup heading="隋唐">
            <CommandItem value="sui">隋</CommandItem>
            <CommandItem value="tang">唐</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}

/** ショートカット付きのコマンド一覧。 */
export function WithShortcuts() {
  return (
    <div className="w-[280px] overflow-hidden rounded-md border border-border">
      <Command>
        <CommandInput placeholder="ページを探す" />
        <CommandList>
          <CommandEmpty>見つかりませんでした。</CommandEmpty>
          <CommandGroup heading="移動">
            <CommandItem value="timeline">
              通史年表
              <CommandShortcut>⌘T</CommandShortcut>
            </CommandItem>
            <CommandItem value="emperors">
              皇帝一覧
              <CommandShortcut>⌘E</CommandShortcut>
            </CommandItem>
            <CommandItem value="kinship">
              系譜・家系図
              <CommandShortcut>⌘K</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}

/** 検索語に一致がないときの空状態。 */
export function EmptyState() {
  return (
    <div className="w-[240px] overflow-hidden rounded-md border border-border">
      <Command>
        <CommandInput placeholder="王朝名で検索" defaultValue="ぬ" />
        <CommandList>
          <CommandEmpty>該当する王朝がありません。</CommandEmpty>
        </CommandList>
      </Command>
    </div>
  );
}
