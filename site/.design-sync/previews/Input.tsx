import { Input } from "site";

/** /emperors 一覧の皇帝名検索（かな・漢字どちらでも引ける）。 */
export function Search() {
  return (
    <div className="flex max-w-sm flex-col gap-1">
      <label htmlFor="q" className="text-xs text-muted-foreground">
        皇帝名で検索
      </label>
      <Input id="q" placeholder="例: 康熙帝 / こうきてい" defaultValue="" />
    </div>
  );
}

export function States() {
  return (
    <div className="flex max-w-sm flex-col gap-3">
      <Input placeholder="未入力" />
      <Input defaultValue="太宗（李世民）" />
      <Input defaultValue="在位年数" disabled />
      <Input defaultValue="1899" aria-invalid />
    </div>
  );
}

/** 数値の範囲入力。tabular-nums で桁を揃える。 */
export function NumericRange() {
  return (
    <div className="flex max-w-md items-end gap-2">
      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="from" className="text-xs text-muted-foreground">
          即位年（西暦）
        </label>
        <Input id="from" className="tabular-nums" defaultValue="-221" />
      </div>
      <span className="pb-2 text-sm text-muted-foreground">〜</span>
      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="to" className="text-xs text-muted-foreground">
          退位年（西暦）
        </label>
        <Input id="to" className="tabular-nums" defaultValue="1912" />
      </div>
    </div>
  );
}
