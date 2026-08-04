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
  SlidersHorizontal,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FilterChips,
  FilterField,
  NoResults,
  ResultCount,
  SearchField,
  type FilterChip,
} from "@/components/charts/chart-filter-controls";
import { useHorizontalScrollEdges } from "@/components/charts/horizontal-scroll-hint";
import { DynastyCombobox } from "@/components/charts/dynasty-combobox";
import {
  BELOW_STICKY_BAR,
  StickyBar,
} from "@/components/layout/sticky-bar";
import {
  DATABASE_COLUMN_COUNT,
  eraOrder,
  shortCategoryLabel,
  type DynastyOption,
  type EmperorTableRecord,
} from "@/lib/emperor-types";
import { RubyText } from "@/components/ui/ruby-text";
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
        className="font-medium leading-ruby text-foreground underline-offset-4 hover:text-seal hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal"
      >
        {/* ふりがな（Issue #20）。並べ替え・検索は平文の name のままで、
            ルビは描画だけに使う。 */}
        <RubyText source={row.original.nameRuby} />
      </Link>
    ),
  },
  {
    accessorKey: "dynastyLabel",
    header: "王朝",
    // 並べ替えは平文（accessorKey）のまま。描画だけふりがな付きにする（Issue #20）。
    cell: ({ row }) => (
      <span className="leading-ruby">
        <RubyText source={row.original.dynastyLabelRuby} />
      </span>
    ),
  },
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
    // **title だけに置かない** — title はキーボード・タッチ・読み上げのどれでも
    // 出ない。PeriodsCell と同じで、短い表示を aria-hidden にして全文を sr-only へ
    // 併記する（`relative` が要る理由も同じ）。
    cell: ({ row }) =>
      shortCategoryLabel(row.original.accessionRouteCategory) ===
      row.original.accessionRouteCategory ? (
        row.original.accessionRouteCategory
      ) : (
        <span className="relative" title={row.original.accessionRouteCategory}>
          <span aria-hidden>
            {shortCategoryLabel(row.original.accessionRouteCategory)}
          </span>
          <span className="sr-only">{row.original.accessionRouteCategory}</span>
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

/**
 * 見出しを押すと次に何が起きるかの文言。TanStack の並べ替えは
 * 「1回目→2回目→解除」の3周期で、1回目の向きは列ごとに違う
 * （数値列は降順から・`sortDescFirst: false` を付けた在位期間は昇順から）。
 * 押す前にどちらへ回るかは画面から読めないので、その場で出す。
 */
function sortActionLabel(
  firstDesc: boolean,
  sorted: false | "asc" | "desc",
): string {
  if (sorted === false) {
    return firstDesc ? "クリックで降順に並べ替え" : "クリックで昇順に並べ替え";
  }
  const second = firstDesc ? "asc" : "desc";
  if (sorted === second) return "クリックで並べ替えを解除";
  return second === "asc" ? "クリックで昇順に並べ替え" : "クリックで降順に並べ替え";
}

/**
 * 枠に収まらない幅で、既定表示に残す列の優先順位（高い順）。皇帝列は
 * `enableHiding: false` なので常に残り、この並びには入らない。
 *
 * 8列の最小自然幅は 皇帝142・王朝119・在位期間114・在位年数90・即位経路90・死因72・
 * 即位年齢90・没年齢76（合計793px。vw390/768/1024 で同値・2026-08-02 実測）。
 * 枠の内側幅は vw390 で330px・vw768 で436px しかない（md 以上ではサイドバー240pxが
 * 先に引かれるので、狭いのは携帯だけではない）。**1180px 以上では8列が収まる**ので
 * この調整は働かない。
 */
const NARROW_COLUMN_PRIORITY = [
  "dynastyLabel",
  "periodsLabel",
  "reignApproxDays",
  "deathCauseCategory",
  "accessionRouteCategory",
  "deathAge",
  "accessionAge",
];

/** URL の `?sort=` を照合するための列 id 集合。id 未指定の列は accessorKey が id になる。 */
const COLUMN_IDS = new Set(
  COLUMNS.map((c) => c.id ?? ("accessorKey" in c ? String(c.accessorKey) : "")),
);

// OGP画像の事実カードが列数を出している（lib/emperors.ts の getOgFacts("/database")）。
// 焼かれた画像は本文とずれても訂正が届きにくいので、ずれたらビルドを落とす。
if (COLUMNS.length !== DATABASE_COLUMN_COUNT) {
  throw new Error(
    `データベースの列数が DATABASE_COLUMN_COUNT (${DATABASE_COLUMN_COUNT}) と一致しません: ${COLUMNS.length}。` +
      `emperor-types.ts の定数と OGP の文言（getOgFacts）を合わせてください。`,
  );
}

/**
 * 時代の絞り込み。**帯（1行）と絞り込みパネル（縦積み）の2箇所に出る**ので、
 * 見た目の違いは幅だけにして中身をここに1本化する。
 *
 * 帯にはラベルが無いので、「すべて」ではなく**「すべての時代」**と出す
 * （/emperors の区分セレクトと同じ理由）。読み上げ名は aria-label が持つが、
 * 2箇所に同じ名前が同時に出ることになるため、パネル側は語尾を変える。
 */
function EraSelect({
  eras,
  value,
  onChange,
  className,
  inPanel = false,
}: {
  eras: string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inPanel?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={className}
        aria-label={inPanel ? "時代で絞り込み（絞り込みパネル）" : "時代で絞り込み"}
      >
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
  );
}

/**
 * 旧 /reign の「復位者一覧」に当たる絞り込み。在位回数2回以上＝復位した皇帝。
 * 2026-08-01: 2択のセレクト（開いて選ぶ＝2手）から地続きのトグルへ。
 * 選択肢が2つしかない絞り込みは、開く前から両方見えているほうが速い。
 *
 * **帯でもパネルでも文言は変えない**（「復位のみ」等に詰めない）— 同じ操作が
 * 2箇所に出るので、片方だけ短くすると別の絞り込みに見える。
 */
function ReignToggle({
  value,
  onChange,
  className,
  itemClassName,
  inPanel = false,
}: {
  value: "all" | "restoration";
  onChange: (value: "all" | "restoration") => void;
  className?: string;
  itemClassName?: string;
  inPanel?: boolean;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      // 選択中の項目をもう一度押すと空文字が来る。絞り込みが「どれでもない」
      // 状態は無いので、その場合は現在の値を保つ。
      onValueChange={(v) => {
        if (v) onChange(v as "all" | "restoration");
      }}
      variant="outline"
      spacing={0}
      aria-label={
        inPanel ? "在位回数で絞り込み（絞り込みパネル）" : "在位回数で絞り込み"
      }
      className={className}
    >
      <ToggleGroupItem value="all" className={itemClassName}>
        すべて
      </ToggleGroupItem>
      <ToggleGroupItem value="restoration" className={itemClassName}>
        復位した皇帝だけ
      </ToggleGroupItem>
    </ToggleGroup>
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
  /** 帯に入りきらない絞り込みを畳むポップオーバー（狭い帯でだけ出る）。 */
  const [filterOpen, setFilterOpen] = useState(false);

  // 操作の反応を優先し、365行の絞り込み再レンダリングは低優先度で追従させる
  // （皇帝一覧のグリッドと同じ方針・2026-08-01 に検索語だけでなく4条件まとめへ広げた）。
  // コントロールの表示は生の state（即時）、表は deferred（後追い）。
  const filters = useMemo(
    () => ({ query, eraValue, dynastyValue, reignFilter }),
    [query, eraValue, dynastyValue, reignFilter],
  );
  const deferredFilters = useDeferredValue(filters);
  /** 表が1つ前の条件の結果であるあいだ true。 */
  const stale = filters !== deferredFilters;
  const clearAll = useCallback(() => {
    setQuery("");
    setEraValue("all");
    setDynastyValue("all");
    setReignFilter("all");
  }, []);

  // 時代を変えたら、その時代に属さない王朝の選択は落とす（残すと必ず0件になる）。
  // 帯とパネルの2箇所から呼ばれるのでコールバックにまとめる。
  const onEraChange = useCallback(
    (v: string) => {
      setEraValue(v);
      setDynastyValue((current) =>
        v !== "all" &&
        !dynastyOptions.some((o) => o.value === current && o.era === v)
          ? "all"
          : current,
      );
    },
    [dynastyOptions],
  );

  // 時代の選択肢は eraOrder（時代順の定数）から、実際にデータにあるものだけ出す。
  const eras = useMemo(() => {
    const present = new Set(records.map((r) => r.eraLabel));
    return eraOrder.filter((e) => present.has(e));
  }, [records]);

  // 王朝の候補は選択中の時代に絞る。89件から探すコンボボックスなので、
  // 時代を決めた後まで全件出すと選び直しの手数が増える。
  const visibleDynastyOptions = useMemo(
    () =>
      eraValue === "all"
        ? dynastyOptions
        : dynastyOptions.filter((o) => o.era === eraValue),
    [dynastyOptions, eraValue],
  );

  // 検索対象は「表に出ている値」＋**諱と民族名**（2026-07-31 ユーザー指示。「劉徹」で
  // 武帝を引ける）。どちらも列に出ていないが同一人物の別名なので、当たっても
  // なぜその行が残ったのか分からなくならない（民族名は分ける前は諱の括弧の中に
  // あって当たっていた・Issue #37 単位3）。時代・在位回数は入れない —
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
        `${r.name} ${r.personalName ?? ""} ${r.ethnicName ?? ""} ${r.dynastyLabel} ${r.periodsLabel} ${r.reignDurationLabel} ${r.accessionRouteCategory} ${shortCategoryLabel(r.accessionRouteCategory)} ${r.deathCauseCategory}`.normalize(
          "NFKC",
        ),
      ),
    [records],
  );

  const filtered = useMemo(() => {
    const { query, eraValue, dynastyValue, reignFilter } = deferredFilters;
    const tokens = query.normalize("NFKC").trim().split(/\s+/).filter(Boolean);
    return records.filter((r, i) => {
      if (eraValue !== "all" && r.eraLabel !== eraValue) return false;
      if (dynastyValue !== "all" && r.dynastyKey !== dynastyValue) return false;
      if (reignFilter === "restoration" && r.reignCount < 2) return false;
      if (tokens.length === 0) return true;
      return tokens.every((t) => searchTargets[i].includes(t));
    });
  }, [records, searchTargets, deferredFilters]);

  // 効いている条件のチップ。ラベルは表の見た目（deferred）ではなく選択の
  // 生の値から作る（外した瞬間に消えないと効いていないように見えるため）。
  const chips: FilterChip[] = [];
  if (query.trim()) {
    chips.push({
      key: "q",
      label: `検索「${query.trim()}」`,
      onRemove: () => setQuery(""),
    });
  }
  if (eraValue !== "all") {
    chips.push({
      key: "era",
      label: `時代: ${eraValue}`,
      onRemove: () => setEraValue("all"),
    });
  }
  if (dynastyValue !== "all") {
    chips.push({
      key: "dynasty",
      label: `王朝: ${dynastyOptions.find((o) => o.value === dynastyValue)?.label ?? dynastyValue}`,
      onRemove: () => setDynastyValue("all"),
    });
  }
  if (reignFilter === "restoration") {
    chips.push({
      key: "reign",
      label: "復位した皇帝だけ",
      onRemove: () => setReignFilter("all"),
    });
  }

  // 絞り込みと並べ替えを URL クエリ（?q=&era=&dynasty=&reign=&sort=&order=）と同期する。
  // 共有・リロード・戻るで状態が消えないようにするためと、**旧 `/reign` の2本のリンクの
  // 着地点**にするため（在位年数の降順＝在位年数ランキング、`reign=restoration`＝復位者一覧）。
  // 復元は hydration 不一致を避けてマウント後の effect で行い、書き込みはマウント直後の
  // 1回だけスキップする（復元より先に既定値で replaceState してパラメータを消さないため）。
  // 実装の形は /emperors のグリッドと同じ。
  const skipFirstUrlWriteRef = useRef(true);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) setQuery(q);
    const era = params.get("era");
    if (era && eraOrder.includes(era)) setEraValue(era);
    const dynasty = params.get("dynasty");
    if (dynasty && dynastyOptions.some((o) => o.value === dynasty)) {
      setDynastyValue(dynasty);
    }
    if (params.get("reign") === "restoration") setReignFilter("restoration");
    // 実在しない列 id を state に入れると TanStack が無言で並べ替えを落とすので、
    // COLUMNS 側で照合してから入れる（id 未指定の列は accessorKey がそのまま id になる）。
    const sort = params.get("sort");
    if (sort && COLUMN_IDS.has(sort)) {
      setSorting([{ id: sort, desc: params.get("order") !== "asc" }]);
    }
  }, [dynastyOptions]);
  useEffect(() => {
    if (skipFirstUrlWriteRef.current) {
      skipFirstUrlWriteRef.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (deferredFilters.query.trim())
      params.set("q", deferredFilters.query.trim());
    if (deferredFilters.eraValue !== "all")
      params.set("era", deferredFilters.eraValue);
    if (deferredFilters.dynastyValue !== "all")
      params.set("dynasty", deferredFilters.dynastyValue);
    if (deferredFilters.reignFilter !== "all")
      params.set("reign", deferredFilters.reignFilter);
    if (sorting.length > 0) {
      params.set("sort", sorting[0].id);
      params.set("order", sorting[0].desc ? "desc" : "asc");
    }
    const qs = params.toString();
    history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [deferredFilters, sorting]);

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

  // 8列の自然幅は793px、枠の内側は vw1180 で848px（2026-08-02 実測）。**1180px 以上なら
  // 8列が収まる**ので、横に流れるのはそれより狭いときだけ ——そこでは上の自動調整が
  // 列を減らして収める。それでも溢れるのは利用者が列を戻したときで、
  // 枠の中で横に流す設計（SITE_DESIGN.md の「6. データベース」節）なので、
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

  // 8列のままでは携帯・タブレットで必ず溢れ、溢れた枠はスクロールコンテナになって
  // 見出しの固定が効かなくなる（↑ overflows のコメント）。**列見出しが最も要るのは
  // 狭い画面**なので、収まる本数まで既定の可視列を減らして sticky が効く側へ倒す。
  //
  // - 決めるのは**マウント後の1回だけ**。リサイズのたびに決め直すと、幅を変えている
  //   最中に列が勝手に増減して落ち着かない
  // - 初期 state は `{}` のまま（SSR の HTML と一致させる。ここで幅を見た値を初期値に
  //   すると hydration が合わない）
  // - **`?sort=` で来た列は必ず残す** — ダッシュボードの在位年数ランキングは
  //   `/database?sort=reignApproxDays` へ着地する。隠れた列で並べ替わった表は読めない
  // - 減った分は列の表示切替に「n列を非表示中」として出るので、戻せば従来どおり
  //   （横スクロール＋見出しの固定なし）に戻せる
  const autoFittedRef = useRef(false);
  useEffect(() => {
    if (autoFittedRef.current) return;
    const box = scrollRef.current;
    const table = tableRef.current;
    if (!box || !table) return;
    const fit = () => {
      if (autoFittedRef.current) return;
      // 収まっているなら触らない（1180px 以上）。列を隠す理由が無い。
      if (table.scrollWidth - box.clientWidth <= 1) {
        autoFittedRef.current = true;
        return;
      }
      // 溢れている＝どの列も自然幅のままなので、th の実幅がその列の最小幅になる。
      const widths = new Map<string, number>();
      for (const th of table.querySelectorAll<HTMLTableCellElement>(
        "thead th[data-col-id]",
      )) {
        widths.set(th.dataset.colId ?? "", th.getBoundingClientRect().width);
      }
      const keep = new Set<string>();
      let used = 0;
      const lock = (id: string) => {
        if (!widths.has(id) || keep.has(id)) return;
        keep.add(id);
        used += widths.get(id) ?? 0;
      };
      lock("name");
      const sortParam = new URLSearchParams(window.location.search).get("sort");
      if (sortParam && COLUMN_IDS.has(sortParam)) lock(sortParam);
      // 入らない列は飛ばして次を見る（打ち切らない）。`?sort=` で幅の広い列を
      // 先に確保したときに、余った隙間へ細い列（死因72px）が入る。
      for (const id of NARROW_COLUMN_PRIORITY) {
        if (keep.has(id)) continue;
        const w = widths.get(id) ?? 0;
        if (used + w > box.clientWidth) continue;
        keep.add(id);
        used += w;
      }
      autoFittedRef.current = true;
      if (keep.size >= widths.size) return;
      const next: VisibilityState = {};
      for (const id of widths.keys()) if (!keep.has(id)) next[id] = false;
      setColumnVisibility(next);
    };
    // Web フォントが載る前に測ると列幅が実際より狭く出る。
    if (document.fonts && document.fonts.status !== "loaded") {
      document.fonts.ready.then(fit);
    } else {
      fit();
    }
    // scrollRef / tableRef は useRef 由来でレンダー間で同一。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.length]);

  /** 「絞り込み」ボタンに添える効いている条件の数。**生の state から数える**
   *  （deferred から数えると、外した直後に数字だけ残って見える）。 */
  const activeFilterCount = chips.length;

  // 帯に載せる絞り込み一式（2026-08-04 ユーザー指示・/emperors と同じ移動）。
  // それまでは表の上に置いていて、365行を少し送ると条件を変える手段が画面から
  // 消えていた（表見出しだけが貼り付いて残る）。
  //
  // **帯は1行48pxで固定**（STICKY_BAR_H が表見出しの sticky top を兼ねる）ので、
  // 幅が足りない側から順に「絞り込み」ポップオーバーへ畳む。分岐は帯の内幅
  // （@container/bar）で、ビューポート幅ではない — md 以上はサイドバー240pxのぶん
  // 実効幅が狭く、768pxの画面でも帯の内幅は438pxしかないため。
  //   〜@4xl(56rem)  : 時代・王朝・在位回数をすべてポップオーバーへ
  //   @4xl〜@5xl     : 時代・王朝は帯へ、在位回数はポップオーバー
  //   @5xl(64rem)〜  : すべて帯に並ぶ（ポップオーバーのボタンは消える）
  // 検索・列・件数はどの幅でも帯に出す（狭い側では文字を落としてアイコンだけにする）。
  const filterControls = (
    <>
      {/* 縮む側は検索窓ひとつなので、**幅の下限を置く** — 条件が効くと右側が
          太り（件数が「42/365名」になり印が2つ付く）、その増分をここが全部かぶる。
          溢れてはいないので `scrollWidth` の検査では拾えない（/emperors で実際に
          ジャンプのトリガーが68pxまで潰れた）。 */}
      <div className="min-w-[8.5rem] flex-1 @xl/bar:max-w-[13rem]">
        <SearchField
          bare
          value={query}
          onChange={setQuery}
          placeholder="名前・王朝など"
          ariaLabel="表を検索"
          widthClass="w-full"
        />
      </div>
      <div className="hidden shrink-0 items-center gap-2 @4xl/bar:flex">
        <EraSelect
          eras={eras}
          value={eraValue}
          onChange={onEraChange}
          className="w-[9rem]"
        />
        <DynastyCombobox
          options={visibleDynastyOptions}
          value={dynastyValue}
          onChange={setDynastyValue}
          triggerWidthClass="w-[10rem]"
        />
      </div>
      <div className="hidden shrink-0 @5xl/bar:block">
        <ReignToggle value={reignFilter} onChange={setReignFilter} />
      </div>
      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            // 狭い帯では文字を落としてアイコンだけにする。残すと縮み代が
            // 検索窓からしか出せない。読み上げ名は aria-label が持つ。
            aria-label="絞り込み"
            className="shrink-0 @5xl/bar:hidden"
          >
            <SlidersHorizontal data-icon="inline-start" />
            <span className="hidden @xl/bar:inline">絞り込み</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-seal px-1.5 text-micro tabular-nums text-seal-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        {/* **ポップオーバーはポータルで帯の外に出る**ので @container/bar の変種は
            効かない。中身は幅にかかわらず3つとも載せる（@4xl〜@5xl では時代・王朝が
            帯とここの2箇所に出るが、同じ state を指しているので食い違わない）。 */}
        <PopoverContent align="end" className="w-[17rem] space-y-3">
          <FilterField label="時代">
            <EraSelect
              inPanel
              eras={eras}
              value={eraValue}
              onChange={onEraChange}
              className="w-full"
            />
          </FilterField>
          <FilterField label="王朝">
            <DynastyCombobox
              options={visibleDynastyOptions}
              value={dynastyValue}
              onChange={setDynastyValue}
              triggerWidthClass="w-full"
            />
          </FilterField>
          <FilterField label="在位回数">
            <ReignToggle
              inPanel
              value={reignFilter}
              onChange={setReignFilter}
              className="w-full"
              itemClassName="flex-1"
            />
          </FilterField>
        </PopoverContent>
      </Popover>
      {/* 絞り込みと表示設定（列）の境界（2026-08-04・/emperors と同じ言い方）。
          帯の余りは件数の手前へ集め、群の切れ目はここで示す。**狭い帯（内幅
          42rem未満）では出さない** — そこは検索窓が伸びて余りが0pxなので、
          1pxでも足すと縮み代を検索窓が全部かぶる。 */}
      <span
        aria-hidden
        data-bar-rule=""
        className="hidden h-5 w-px shrink-0 bg-border @2xl/bar:block"
      />
      {/* 列の表示切替。絞り込みではないが**同じ帯に残す** — 表の上に1つだけ
          取り残すと、送った先で列を戻せなくなる（自動で減らした列を戻す唯一の導線）。
          2026-08-01: 自前の Popover ＋ aria-pressed のボタン列から DropdownMenu の
          CheckboxItem へ。矢印キーでの移動・チェック状態の読み上げ（aria-checked）が
          部品側に入る。**選んでも閉じない**（onSelect を止める）— 2列・3列と続けて
          隠すのが普通の使い方なので、1つ押すたびに開き直させない。 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="shrink-0"
            aria-label="表示する列を選ぶ"
          >
            <Columns3 data-icon="inline-start" />
            <span className="hidden @3xl/bar:inline">
              {hiddenCount === 0 ? "すべて表示" : `${hiddenCount}列を非表示`}
            </span>
            {/* 文字を落とした幅でも「何列か隠れている」ことは残す。 */}
            {hiddenCount > 0 && (
              <span className="text-micro tabular-nums text-muted-foreground @3xl/bar:hidden">
                {hiddenCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[200px]">
          <DropdownMenuLabel>表示する列</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {hideableColumns.map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(v) => column.toggleVisibility(!!v)}
              onSelect={(e) => e.preventDefault()}
            >
              {columnLabel(column.id)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {/* 件数は帯の右端。**ml-auto はこの箱が持つ**（2026-08-04・/emperors と同じ）。
          持たせる前は余りが最後の要素の後ろに残り、件数が右端から離れていた
          （実測: ビューポート1920で241px・1440で151px・1024で210px。900px以下は
          検索窓が伸びて0）。罫線と件数を1つの箱にまとめてあるのは、罫線が消える
          狭い帯でも件数が右端に残るようにするため。 */}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <span
          aria-hidden
          data-bar-rule=""
          className="hidden h-5 w-px bg-border @2xl/bar:block"
        />
        <ResultCount
          pending={stale}
          className="shrink-0 whitespace-nowrap text-xs @2xl/bar:text-sm"
        >
          {/* ResultCount は flex（スピナーとの間隔）なので、文言は1つの要素に
              まとめる — 分けると数字と単位の間に gap が入って「365 名」になる。
              狭い帯では「を表示中」を落として数字だけにする。 */}
          <span>
            <span className="tabular-nums">{filtered.length}</span>
            {/* いちばん狭い帯（内幅320px未満＝360pxの画面）では母数を落とす。ここは
                縮まない側なので、残すとその30pxぶんを検索窓が全部かぶる
                （実測で入力欄が72pxまで潰れた）。390pxの画面では母数を出す。 */}
            {filtered.length !== records.length && (
              <span className="hidden tabular-nums @min-[20rem]/bar:inline">
                /{records.length}
              </span>
            )}
            名<span className="hidden @xl/bar:inline">を表示中</span>
          </span>
        </ResultCount>
      </div>
    </>
  );

  return (
    <div>
      <StickyBar
        ariaLabel="表の絞り込みと表示"
        // 本文は既に px-gutter された箱の中なので、帯だけ全幅に戻す。
        // **上の余白も打ち消してページヘッダーの罫線に密着させる**（2026-08-04・
        // /emperors と同じ）。py-section の 32px が帯の上に残っていると、初期表示で
        // ヘッダーの下罫と帯の下罫に挟まれた 80px の中でコントロールが下寄り
        // （上40px・下8px）に見える。帯そのものは 48px の中で上下 7.5px の中央。
        className="-mx-gutter -mt-section mb-4 md:-mx-gutter-wide"
      >
        {filterControls}
      </StickyBar>

      <FilterChips
        chips={chips}
        onClearAll={clearAll}
        className="mx-auto w-full max-w-content"
      />

      {filtered.length === 0 ? (
        <div className="mx-auto w-full max-w-content">
          <NoResults onClearAll={clearAll} />
        </div>
      ) : (
        /* この箱が持つスクロールは**横だけ**（2026-07-31 ユーザー指示）。縦は
           ページのスクロールに一本化する — 箱の中に縦スクロールを作ると、
           ページのスクロールバーと二重になって「どちらを動かしているのか」が
           手元で分からなくなる。
           横も、表が収まっている間は clip にしてスクロールコンテナ自体を作らない
           （↑ overflows のコメント）。`visible` にはできない — 片方が visible だと
           もう片方に引きずられて実質 auto になる。
           仮想化はまだ入れない（先に実測する方針）。 */
        // **`isolate`（＝独立した重ね合わせ文脈）が要る** — この中には右端フェード
        // (z-40) と固定した先頭列 (z-30) が居て、素の `relative` のままだと帯 (z-30) と
        // 同じ文脈に並ぶ。表は帯の下を通り抜けるので、表の全高に伸びるフェードが
        // 帯の右側（件数・列）の上に重なって描かれる。
        <div className="relative isolate mx-auto w-full max-w-content">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className={cn(
            "w-full overflow-y-clip rounded-lg border border-border bg-card",
            // 横に溢れている間だけスクロールコンテナになるので、overscroll-x-contain
            // もその側に付ける（clip の側はスクロールコンテナですらない）。
            // これが無いと、表を右端まで送った先の慣性が「戻る」ジェスチャへ抜ける。
            overflows
              ? "overflow-x-auto overscroll-x-contain"
              : "overflow-x-clip",
          )}
        >
          <table ref={tableRef} className="w-full caption-bottom text-sm">
            {/* ツールチップを使うのは見出しの並べ替えボタン8つだけなので、
                Provider は layout ではなくここに置く（全ページに client 境界を
                1枚増やさない）。開くまでの待ちは既定の 0ms ではなく 300ms —
                表の上を横切るたびに出ると読むのを邪魔する。 */}
            <TooltipProvider delayDuration={300}>
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
                        // 幅を測って既定の可視列を決めるとき（NARROW_COLUMN_PRIORITY）に
                        // th と列 id を対応づける。DOM の並び順に頼らない。
                        data-col-id={header.column.id}
                        style={
                          overflows ? undefined : { top: BELOW_STICKY_BAR }
                        }
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
                          // 効く）。止め位置は**固定した絞り込みの帯の真下**
                          // （BELOW_STICKY_BAR）で、直値では書かない — モバイルは
                          // サイトヘッダー（--chrome-top）も画面上端を占めるため。
                          !overflows && "sticky",
                          ALIGN_CLASS[header.column.columnDef.meta?.align ?? "left"],
                          // 先頭列は横スクロール中も残す（狭い画面で行の主語が消えないように）。
                          // 右側にも境界線を敷く — 敷かないと2列目の文字が地色の下へ
                          // 滑り込んで、皇帝名と混ざった1列に見える。
                          index === 0 &&
                            "sticky left-0 z-30 shadow-[inset_0_-2px_0_var(--seal),inset_-1px_0_0_var(--border)]",
                        )}
                      >
                        {canSort ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={header.column.getToggleSortingHandler()}
                                className={cn(
                                  "-mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:text-seal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal",
                                  // 右寄せの列は矢印を見出しの左に置く（右端は数値の
                                  // 揃え位置なので、そこに記号を挟むと桁の縦線が濁る）。
                                  header.column.columnDef.meta?.align ===
                                    "right" && "flex-row-reverse",
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
                            </TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={6}>
                              {sortActionLabel(
                                header.column.getFirstSortDir() === "desc",
                                sorted,
                              )}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          label
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            </TooltipProvider>
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
