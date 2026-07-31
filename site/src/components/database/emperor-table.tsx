"use client";

// データベースページ（/database）の本体。全365名を1つの表で見せる。
//
// 分担: **絞り込みは素の useMemo、並べ替えと列の表示切替は TanStack Table**。
// 検索は「空白区切りの全語がヒットした行だけ残す」AND 条件で、TanStack の
// globalFilter は列ごとに評価して OR で畳むためこの意味にならない（列を跨いだ
// 語の組み合わせ——「唐 病死」——が落ちる）。絞り込み後の配列を渡せば
// 並べ替え・列の表示切替はそのまま効くので、素直な側に寄せてある。
//
// 表の部品は shadcn の ui/table.tsx を使う。ただし `Table` ラッパーだけは使わない —
// あれは overflow-x-auto の div を内側に固定で持っており、縦スクロール（＝見出しの
// sticky）を足す余地が無い。中身の TableHeader/TableBody/TableRow/TableHead/TableCell は
// そのまま使っている。
//
// lint の warning「Compilation Skipped: Use of incompatible library」は既知で消せない —
// `useReactTable()` が毎回新しい関数を返すため React Compiler がこのコンポーネントの
// 自動メモ化を諦める。自前の useMemo / useDeferredValue はそのまま効くので、
// 絞り込みの再計算とキー入力の応答性はそちらで担保してある。

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Columns3,
  Check,
  Search,
} from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FilterField } from "@/components/charts/chart-filter-controls";
import { useHorizontalScrollEdges } from "@/components/charts/horizontal-scroll-hint";
import { DynastyCombobox } from "@/components/charts/dynasty-combobox";
import {
  DATABASE_COLUMN_COUNT,
  eraOrder,
  shortCategoryLabel,
  type DynastyOption,
  type EmperorTableRecord,
} from "@/lib/emperor-types";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /**
     * 列の揃え。見出しとセルの両方に同じ値から当てる（片方だけ動かすと
     * 見出しが列の上に乗っていないように見える）。
     * - `left`（既定）＝名前・王朝。読み始めの位置をそろえる
     * - `right` ＝年・年数・年齢。桁と単位が縦にそろい、大小が形で分かる
     * - `center` ＝即位経路・死因。2〜4文字の区分名で、左右どちらに寄せても
     *   短い語が壁から浮くため中央に置く
     */
    align?: "left" | "center" | "right";
    /** 数字を tabular-nums（等幅数字）で描く。桁が縦にそろう。 */
    numeric?: boolean;
  }
}

/** 欠測（調査済みだが算出できない年齢）の表示。空欄にすると「まだ調べていない」に見える。 */
const MISSING = "—";

/** 年齢の表示。数値だけだと在位年数の「年」と紛れるので単位を付ける（数え年）。 */
function ageLabel(age: number | null): string {
  return age === null ? MISSING : `${age}歳`;
}

/**
 * 在位期間のセル。**復位者は最初の期間だけを1行目に出し、残りは「ほか2期」**として
 * 小さく2行目へ送る（2026-07-31 ユーザー指示）。
 *
 * 全期間を1行に並べると宣統帝の「1908–1912年 / 1917年 / 1934–1945年」が列幅を決めてしまい、
 * 365行中357行の「1850–1861年」型の表示に対して2.5倍の幅を専有する。8名のために
 * 全行の列幅を広げるより、8名の2行目に送るほうが表として読みやすい。
 * 全期間は title と読み上げ用のテキストに残し、詳細は個別ページが持つ。
 */
function PeriodsCell({ record }: { record: EmperorTableRecord }) {
  const [first, ...rest] = record.periodsLabel.split(" / ");
  if (rest.length === 0) return record.periodsLabel;
  return (
    // `relative` が要る — sr-only は絶対配置なので、位置の基準になる祖先が
    // 枠の外（表を囲む relative な div）になると、**横スクロール枠の clip を
    // すり抜けてページ全体を横に広げる**（モバイルで実測: 文書幅 390→457px）。
    <span className="relative" title={record.periodsLabel}>
      <span aria-hidden>
        {first}
        <span className="block text-micro font-normal text-muted-foreground">
          ほか{rest.length}期
        </span>
      </span>
      <span className="sr-only">{record.periodsLabel}</span>
    </span>
  );
}

/** セル・見出しの揃え。`align` から Tailwind の text-* を引く。 */
const ALIGN_CLASS = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

const COLUMNS: ColumnDef<EmperorTableRecord>[] = [
  {
    accessorKey: "name",
    header: "皇帝",
    // 名前の列は消せない（消すとどの行が誰か分からなくなる）。
    enableHiding: false,
    cell: ({ row }) => (
      <Link
        href={`/emperors/${row.original.id}`}
        className="font-medium text-foreground underline-offset-4 hover:text-seal hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  { accessorKey: "dynastyLabel", header: "王朝" },
  // 時代・在位回数は列に出さない（2026-07-31 ユーザー指示）。どちらも絞り込みには
  // 残してある — 時代は王朝の上位区分で王朝列から概ね読めるため、在位回数は
  // 2以上が8名しかおらず1列を専有するに見合わないため、選ぶ側だけ残す形にした。
  {
    id: "periodsLabel",
    // 並べ替えは最初の在位の開始年（数値）。表示文字列は「前221–前210年」のように
    // 前後の年が混ざるため、文字列として並べても年代順にならない。
    accessorFn: (r) => r.firstStartYear,
    header: "在位期間",
    meta: { align: "right", numeric: true },
    // 年代順が自然な向きなので、1回目のクリックは昇順（数値列の既定は降順）。
    sortDescFirst: false,
    cell: ({ row }) => <PeriodsCell record={row.original} />,
  },
  {
    id: "reignApproxDays",
    accessorKey: "reignApproxDays",
    header: "在位年数",
    meta: { align: "right", numeric: true },
    // 並べ替えは日数（数値）で、表示は "61年332日"。表示文字列で並べると
    // "9年" > "61年" のように壊れる。
    cell: ({ row }) => row.original.reignDurationLabel,
  },
  {
    accessorKey: "accessionRouteCategory",
    header: "即位経路",
    meta: { align: "center" },
    // 「受禅（易姓）」「継承（経緯記載なし）」は括弧を落として出す
    // （2026-07-31 ユーザー指示）。この2つだけが突出して長く、列幅を押し広げる。
    // 括弧の中身は分類の根拠なので title に全文を残す（概要ダッシュボードの
    // 内訳凡例と同じ扱い）。並べ替え・検索は全文のままで効く。
    cell: ({ row }) => (
      <span title={row.original.accessionRouteCategory}>
        {shortCategoryLabel(row.original.accessionRouteCategory)}
      </span>
    ),
  },
  {
    accessorKey: "deathCauseCategory",
    header: "死因",
    meta: { align: "center" },
  },
  {
    id: "accessionAge",
    accessorFn: (r) => r.accessionAge ?? undefined,
    header: "即位年齢",
    meta: { align: "right", numeric: true },
    // 年齢不明を 0 扱いで先頭に集めない。null は accessorFn で undefined にして
    // TanStack の sortUndefined に委ねる（null は素の値として並べられてしまう）。
    sortUndefined: "last",
    cell: ({ row }) => ageLabel(row.original.accessionAge),
  },
  {
    id: "deathAge",
    accessorFn: (r) => r.deathAge ?? undefined,
    header: "没年齢",
    meta: { align: "right", numeric: true },
    sortUndefined: "last",
    cell: ({ row }) => ageLabel(row.original.deathAge),
  },
];

// OGP画像の事実カードが列数を出している（lib/emperors.ts の getOgFacts("/database")）。
// 焼かれた画像は本文とずれても訂正が届きにくいので、ずれたらビルドを落とす。
if (COLUMNS.length !== DATABASE_COLUMN_COUNT) {
  throw new Error(
    `データベースの列数が DATABASE_COLUMN_COUNT (${DATABASE_COLUMN_COUNT}) と一致しません: ${COLUMNS.length}。` +
      `emperor-types.ts の定数と OGP の文言（getOgFacts）を合わせてください。`,
  );
}

export function EmperorTable({
  records,
  dynastyOptions,
}: {
  records: EmperorTableRecord[];
  dynastyOptions: DynastyOption[];
}) {
  const [query, setQuery] = useState("");
  const [eraValue, setEraValue] = useState("all");
  const [dynastyValue, setDynastyValue] = useState("all");
  const [reignFilter, setReignFilter] = useState<"all" | "restoration">("all");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // 入力欄の反応を優先し、365行の絞り込み再レンダリングは低優先度で追従させる
  // （皇帝一覧のグリッドと同じ方針）。
  const deferredQuery = useDeferredValue(query);

  // 時代の選択肢は eraOrder（時代順の定数）から、実際にデータにあるものだけ出す。
  const eras = useMemo(() => {
    const present = new Set(records.map((r) => r.eraLabel));
    return eraOrder.filter((e) => present.has(e));
  }, [records]);

  // 王朝の候補は選択中の時代に絞る。87件から探すコンボボックスなので、
  // 時代を決めた後まで全件出すと選び直しの手数が増える。
  const visibleDynastyOptions = useMemo(
    () =>
      eraValue === "all"
        ? dynastyOptions
        : dynastyOptions.filter((o) => o.era === eraValue),
    [dynastyOptions, eraValue],
  );

  // 検索対象は「表に出ている値」＋**諱**（2026-07-31 ユーザー指示。「劉徹」で
  // 武帝を引ける）。諱は列に出ていないが同一人物の別名なので、当たっても
  // なぜその行が残ったのか分からなくならない。時代・在位回数は入れない —
  // そちらは行の属性で、見えないまま当たると絞り込みの理由が読めなくなる
  //（時代で絞るのは上のセレクトの担当）。
  //
  // **問い合わせ側と同じく対象側も NFKC 正規化する。** 片方だけ正規化すると
  // 「継承（経緯記載なし）」のような全角括弧を含む語がどうやっても当たらない
  // （NFKC は全角括弧を半角に畳むため、正規化した問い合わせが生のラベルに一致しない）。
  // 365件ぶんの連結は records が変わったときだけ作り、キー入力では作り直さない。
  const searchTargets = useMemo(
    () =>
      records.map((r) =>
        // 即位経路は短縮形（「受禅」）でも全文（「受禅（易姓）」）でも当たるよう両方入れる。
        `${r.name} ${r.personalName ?? ""} ${r.dynastyLabel} ${r.periodsLabel} ${r.reignDurationLabel} ${r.accessionRouteCategory} ${shortCategoryLabel(r.accessionRouteCategory)} ${r.deathCauseCategory}`.normalize(
          "NFKC",
        ),
      ),
    [records],
  );

  const filtered = useMemo(() => {
    const tokens = deferredQuery
      .normalize("NFKC")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return records.filter((r, i) => {
      if (eraValue !== "all" && r.eraLabel !== eraValue) return false;
      if (dynastyValue !== "all" && r.dynastyKey !== dynastyValue) return false;
      if (reignFilter === "restoration" && r.reignCount < 2) return false;
      if (tokens.length === 0) return true;
      return tokens.every((t) => searchTargets[i].includes(t));
    });
  }, [records, searchTargets, deferredQuery, eraValue, dynastyValue, reignFilter]);

  const table = useReactTable({
    data: filtered,
    columns: COLUMNS,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const hideableColumns = table.getAllLeafColumns().filter((c) => c.getCanHide());
  const hiddenCount = hideableColumns.filter((c) => !c.getIsVisible()).length;

  // 8列の自然幅は約858px（本文列の幅＝画面幅−332px なので、1200px 以上なら収まる）。
  // 1180px 以下でははみ出す。枠の中で横に流す設計（SITE_PLAN の「6. データベース」節）なので、
  // 「続きがある」ことだけは見せる。左端のフェードは出さない — 固定した先頭列の上に
  // かぶって皇帝名を薄くしてしまうため、右端だけにしてある。
  const { scrollRef, atEnd, onScroll, syncEdges } =
    useHorizontalScrollEdges<HTMLDivElement>();

  // 表が枠に収まっているか。**収まっている間は枠を横スクロールさせない**
  // （`overflow-x: clip`）。auto にした瞬間この箱はスクロールコンテナになり、
  // 見出しの `sticky top` が「箱の中の縦スクロール」基準に切り替わって効かなくなる
  // ——箱に縦スクロールは無いので、見出しはただ流れ去る（実測で確認）。
  // 収まらない幅でだけ auto にして横スクロールを許し、そのときは見出しの固定を諦める。
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [overflows, setOverflows] = useState(false);
  const measure = useCallback(() => {
    const box = scrollRef.current;
    const table = tableRef.current;
    if (!box || !table) return;
    // 枠側の scrollWidth は clip のとき clientWidth と同じ値を返すので、
    // **表そのものの幅**と比べる（clip でも表は自然幅のまま溢れている）。
    setOverflows(table.scrollWidth - box.clientWidth > 1);
    // scrollRef は useRef 由来でレンダー間で同一。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // フックの ResizeObserver が見ているのは**枠の箱**なので、列を隠して表そのものが
  // 縮んでも発火しない（隠しきって収まったのにフェードが出たままになる）。
  // 絞り込みで0件→再表示すると枠ごと作り直しになるのも同じで拾えないため、
  // 列の表示状態と行数が変わったら実測し直す。
  useEffect(() => {
    syncEdges();
    measure();
  }, [syncEdges, measure, columnVisibility, filtered.length]);
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(box);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, filtered.length]);

  return (
    <div>
      {/* 絞り込み一式。狭い画面では検索を1行、残りを2列に畳む（皇帝一覧と同じ組み方）。
          幅は列か固定値から決まるので、Webフォント読込による折り返しずれ（CLS）は起きない。 */}
      <div className="mb-4 grid grid-cols-2 items-end gap-x-3 gap-y-3 sm:flex sm:flex-wrap sm:gap-4">
        <div className="col-span-2 sm:col-auto">
          <FilterField label="検索">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="名前・王朝など"
                className="w-full pl-8 sm:w-[220px]"
              />
            </div>
          </FilterField>
        </div>
        <FilterField label="時代">
          <Select
            value={eraValue}
            onValueChange={(v) => {
              setEraValue(v);
              // 選んだ時代に属さない王朝が選ばれたままだと0件になる。
              if (
                v !== "all" &&
                !dynastyOptions.some(
                  (o) => o.value === dynastyValue && o.era === v,
                )
              ) {
                setDynastyValue("all");
              }
            }}
          >
            <SelectTrigger className="w-full sm:w-[160px]" aria-label="時代で絞り込み">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての時代</SelectItem>
              {eras.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="王朝">
          <DynastyCombobox
            options={visibleDynastyOptions}
            value={dynastyValue}
            onChange={setDynastyValue}
            triggerWidthClass="w-full sm:w-[200px]"
          />
        </FilterField>
        {/* 旧 /reign の「復位者一覧」に当たる絞り込み。在位回数2回以上＝復位した皇帝。 */}
        <FilterField label="在位回数">
          <Select
            value={reignFilter}
            onValueChange={(v) => setReignFilter(v as "all" | "restoration")}
          >
            <SelectTrigger className="w-full sm:w-[170px]" aria-label="在位回数で絞り込み">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="restoration">復位した皇帝だけ</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="列">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between sm:w-[150px]"
                aria-label="表示する列を選ぶ"
              >
                <Columns3 data-icon="inline-start" />
                {hiddenCount === 0 ? "すべて表示" : `${hiddenCount}列を非表示`}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[200px] p-1">
              {hideableColumns.map((column) => (
                <button
                  key={column.id}
                  type="button"
                  onClick={() => column.toggleVisibility()}
                  aria-pressed={column.getIsVisible()}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      column.getIsVisible() ? "text-seal" : "invisible",
                    )}
                  />
                  {columnLabel(column.id)}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </FilterField>
        <span className="col-span-2 text-sm text-muted-foreground sm:col-auto sm:pb-2">
          {filtered.length === records.length
            ? `全${records.length}名を表示中`
            : `${filtered.length}名を表示中（全${records.length}名）`}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-sm text-muted-foreground">
          条件に一致する皇帝が見つかりませんでした。
        </p>
      ) : (
        /* この箱が持つスクロールは**横だけ**（2026-07-31 ユーザー指示）。縦は
           ページのスクロールに一本化する — 箱の中に縦スクロールを作ると、
           ページのスクロールバーと二重になって「どちらを動かしているのか」が
           手元で分からなくなる。
           横も、表が収まっている間は clip にしてスクロールコンテナ自体を作らない
           （↑ overflows のコメント）。`visible` にはできない — 片方が visible だと
           もう片方に引きずられて実質 auto になる。
           仮想化はまだ入れない（先に実測する方針）。 */
        <div className="relative">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className={cn(
            "w-full overflow-y-clip rounded-lg border border-border bg-card",
            overflows ? "overflow-x-auto" : "overflow-x-clip",
          )}
        >
          <table ref={tableRef} className="w-full caption-bottom text-sm">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header, index) => {
                    const sorted = header.column.getIsSorted();
                    const canSort = header.column.getCanSort();
                    const label = flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    );
                    return (
                      <TableHead
                        key={header.id}
                        aria-sort={
                          sorted === "asc"
                            ? "ascending"
                            : sorted === "desc"
                              ? "descending"
                              : undefined
                        }
                        className={cn(
                          // 見出し帯だけ朱を薄く敷く（2026-07-31 ユーザー指示・
                          // 画面に色味を入れる）。**半透明にしないこと** — 行が
                          // 見出しの裏を通り抜けるので、地色は不透明でなければならない。
                          // 下線は2pxの朱にして帯の下端を締める。border-collapse の表では
                          // sticky にした th の border がスクロール時に消えるため、
                          // 線はすべて inset shadow で描く。
                          "z-20 bg-[color-mix(in_oklch,var(--seal)_7%,var(--card))] shadow-[inset_0_-2px_0_var(--seal)]",
                          // 表が収まっている幅では、見出しを**ページのスクロール**に
                          // 対して貼り付ける（枠がスクロールコンテナでないときだけ
                          // 効く）。モバイルはサイトヘッダーが画面上端を占めるので、
                          // 直値でなく --chrome-top から止め位置を取る。
                          !overflows && "sticky top-[var(--chrome-top)]",
                          ALIGN_CLASS[header.column.columnDef.meta?.align ?? "left"],
                          // 先頭列は横スクロール中も残す（狭い画面で行の主語が消えないように）。
                          // 右側にも境界線を敷く — 敷かないと2列目の文字が地色の下へ
                          // 滑り込んで、皇帝名と混ざった1列に見える。
                          index === 0 &&
                            "sticky left-0 z-30 shadow-[inset_0_-2px_0_var(--seal),inset_-1px_0_0_var(--border)]",
                        )}
                      >
                        {canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className={cn(
                              "-mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:text-seal focus-visible:outline-2 focus-visible:outline-ring",
                              // 右寄せの列は矢印を見出しの左に置く（右端は数値の
                              // 揃え位置なので、そこに記号を挟むと桁の縦線が濁る）。
                              header.column.columnDef.meta?.align === "right" &&
                                "flex-row-reverse",
                            )}
                          >
                            {label}
                            {sorted === "asc" ? (
                              <ArrowUp className="size-3.5 text-seal" />
                            ) : sorted === "desc" ? (
                              <ArrowDown className="size-3.5 text-seal" />
                            ) : (
                              <ChevronsUpDown className="size-3.5 text-muted-foreground/60" />
                            )}
                          </button>
                        ) : (
                          label
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="group">
                  {row.getVisibleCells().map((cell, index) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        ALIGN_CLASS[cell.column.columnDef.meta?.align ?? "left"],
                        cell.column.columnDef.meta?.numeric && "tabular-nums",
                        // 固定した先頭列は自前で地色を敷くので、行の hover が
                        // 透けない。行と同じ合成色を作って明示的に当てる。
                        // 右端の境界線は見出し側と同じく inset shadow で描く
                        // （border だと 2列目の文字が地色の下へ滑り込んで混ざる）。
                        index === 0 &&
                          "sticky left-0 z-10 bg-card shadow-[inset_-1px_0_0_var(--border)] group-hover:bg-[color-mix(in_oklch,var(--muted)_50%,var(--card))]",
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
        {overflows && !atEnd && (
          <>
            {/* 固定した見出し行（z-30）より上に敷く。縦は inset-y-0＝表の全高に
                かかるので、下まで読み進めても「まだ右に続く」ことは見えている。 */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 z-40 w-10 rounded-r-lg bg-gradient-to-l from-card to-transparent"
            />
            <span className="pointer-events-none absolute right-3 -top-6 text-micro text-muted-foreground">
              横スクロールで続き →
            </span>
          </>
        )}
        </div>
      )}
    </div>
  );
}

/** 列の表示切替に出すラベル。COLUMNS の header は文字列で持たせてあるのでそこから引く。 */
function columnLabel(id: string): string {
  const def = COLUMNS.find((c) => (c.id ?? ("accessorKey" in c ? String(c.accessorKey) : "")) === id);
  return typeof def?.header === "string" ? def.header : id;
}
