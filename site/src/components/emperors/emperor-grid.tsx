"use client";

// 皇帝一覧の「図鑑」グリッド。
// **カード1枚（肖像＋名前・王朝・在位期間）の全体が3:4**・肖像はcover+topで
// 顔を切らずにフィット、画像なしは姓一文字のモノグラムをプレースホルダー表示する。
// カードを押すと個別ページ（/emperors/{id}）へ遷移する。
//
// 2026-08-01 まではカードのクリックを preventDefault して詳細ダイアログを開いていた
// （履歴同期・フルレコードのlazy fetch付き）。/database・ダッシュボードの行は元から
// 個別ページ直リンクで、グリッドだけが例外だったため素の遷移へ揃えた。ダイアログの
// 利点だった「戻るで一覧ごと離脱しない」は、Next.jsのソフトナビゲーションと下のURL
// 同期でスクロール位置・絞り込みごと復元されることを実測して確認済み。

import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DynastyCategoryHint,
  FilterChips,
  FilterField,
  NoResults,
  ResultCount,
  SearchField,
  type FilterChip,
} from "@/components/charts/chart-filter-controls";
import { DynastyCombobox } from "@/components/charts/dynasty-combobox";
import type {
  DynastyCategory,
  DynastyOption,
  EmperorListRecord,
} from "@/lib/emperor-types";
import {
  dynastyCategoryOptions,
} from "@/lib/emperor-types";
import { RubyText } from "@/components/ui/ruby-text";
import { toHiragana } from "@/lib/kana";
import { dynastyColorHex, dynastyColorSlot } from "@/lib/dynasty-colors";
import { Portrait } from "@/components/emperors/portrait";
import {
  BELOW_SECTION_NAV,
  SectionJumpNav,
} from "@/components/layout/section-jump-nav";

/**
 * カードの文字列の左に立てる王朝の印（2026-07-31）。
 *
 * 王朝の識別色は、それまで肖像なし215枚の下地（淡彩）が担っていた。下地を無彩色へ
 * 落とすにあたり、識別だけをこの印へ移してある（経緯は portrait.tsx の Monogram）。
 * **肖像の有無にかかわらず全365枚に出る**ので、王朝の切れ目は肖像ありの列でも読める。
 *
 * 面積が小さい印なので混色せず `--series-N` の生値を使う（淡彩は面積が大きいから
 * 混ぜていた。3pxの帯を38%まで薄めると地に溶けて印の役をしない）。
 */
function DynastyMark({ dynastyKey }: { dynastyKey: string }) {
  return (
    <span
      aria-hidden
      className="absolute inset-y-2 left-0 w-[3px] rounded-r-sm"
      style={{ backgroundColor: dynastyColorHex(dynastyColorSlot(dynastyKey), 100) }}
    />
  );
}

/** 一覧のカード1枚。フィルタ・検索のたびに364枚を再レンダリングしないようmemo化
 *  （実機Lighthouse timespanで操作ごとの再レンダリングがTBT・遅延レイアウトシフトの
 *  一因だったため）。 */
const EmperorCard = memo(function EmperorCard({
  record,
  priority,
}: {
  record: EmperorListRecord;
  priority: boolean;
}) {
  return (
    // 素の<a href>。クローラが一覧→個別365ページを辿れることと、修飾クリック（新規
    // タブ等）がそのまま効くことを兼ねる。
    <Link
      href={`/emperors/${record.id}`}
      // hoverの移動はcompositorプロパティだけに限る。365枚が全件DOMに載るグリッドなので、
      // top/marginで動かすと再レイアウトがCLSに化ける。
      // Tailwind v4 の -translate-y-* は transform ではなく translate プロパティを書くため、
      // 遷移対象は translate と書く(transform と書くとホバーが瞬間移動になる)。
      // 【カード全体が3:4】2026-07-31 のユーザー決定。それまでは「肖像だけ」が3:4で、
      // 文字ブロック(68px)が丸ごと足された結果カード全体は3:5になり、1440pxの1画面に
      // 2行＋αしか入らなかった（実測12.7人）。比率を肖像からカードへ移すと1画面
      // 15.5人になる。**肖像側を固定比にせず、カードを3:4にして肖像に余りを渡す**のは、
      // 文字ブロックの高さが幅に比例しない（3行で常に68px）ため — 肖像を固定比に
      // すると狭い画面ほどカードが縦に伸びる。この持ち方なら肖像枠は 0.98(1440px)〜
      // 1.11(390px) のほぼ正方形に収まる。
      className="group relative flex aspect-[3/4] flex-col overflow-hidden rounded-md border border-border bg-card text-left transition-[translate,border-color] duration-150 ease-out hover:border-seal/60 focus-visible:outline-2 focus-visible:outline-seal motion-safe:hover:-translate-y-px motion-safe:hover:shadow-sm motion-reduce:transition-none"
    >
      {/* min-h-0 が無いと flex アイテムの既定 min-height:auto で肖像が縮まず、
          カードが3:4を超えて伸びる。 */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Portrait
          record={record}
          // 列数はコンテナ幅で決まり、カード1枚は狭い画面の2列を除けば概ね
          // 180〜230pxに収まる（本文列が max-w-content で止まるため vw では表せない）。
          sizes="(max-width: 640px) 50vw, 230px"
          priority={priority}
        />
      </div>
      {/* 印を絶対配置するため relative。印は padding の外（左端）に立てる。 */}
      <div className="relative shrink-0 px-2.5 py-2 pl-3">
        <DynastyMark dynastyKey={record.dynastyKey} />
        {/* ふりがな（Issue #20）。leading-ruby は ON/OFF で行の高さが動かないよう
            ルビの分の行間を先に確保するもの。カード外形は aspect-[3/4] のままで、
            伸びた文字ブロックのぶん肖像側が縮む。 */}
        <div className="truncate text-sm font-medium leading-ruby text-foreground group-hover:text-seal">
          <RubyText source={record.nameRuby} />
          {/* 通用名だけでは誰か分かりにくい人物向けの補助名（諱）。
              導出規則・人物別上書きは lib/display-name.ts。 */}
          {record.cardSubtitleRuby && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              <RubyText source={record.cardSubtitleRuby} />
            </span>
          )}
        </div>
        {/* 2行目は王朝ラベル。対立・僭称の皇帝（20名）はここに小さな印を添える
            （Issue #45）。**印は RubyText の外側・truncate の外側**に置く —
            ルビ記法の文字列に混ぜないこと、王朝ラベルが長い人物で印のほうが
            先に切れないことの両方が要る。truncate 側に min-w-0 が要るのは、
            flex アイテムの既定 min-width:auto が min-content 未満への収縮を
            止めて省略が効かなくなるため（代わりに印が箱から押し出される）。
            文言は個別ページのバッジ（emperor-hero.tsx）から「の皇帝」を落とした形。 */}
        <div className="flex items-center gap-1 text-xs leading-ruby text-muted-foreground">
          <span className="min-w-0 truncate">
            <RubyText source={record.dynastyLabelRuby} />
          </span>
          {record.isRivalClaimant && (
            // カード全体が aspect-[3/4] 固定で文字ブロックが伸びると肖像側が縮むため、
            // 印には縦の padding を持たせない（rival の20枚だけ肖像が低くなる）。
            <span className="shrink-0 rounded-sm border border-border px-1 text-micro leading-none">
              対立・僭称
            </span>
          )}
        </div>
        {/* 在位期間。同じ時代の中で誰がいつの人かを、カードを開かずに掴めるようにする
            （名前と王朝だけでは統計サイトの一覧として読み取れる情報が乏しい）。
            復位者は期間が複数連なって長くなるため truncate に任せ、全体は詳細で読ませる。 */}
        <div className="truncate text-micro tabular-nums text-muted-foreground/85">
          {record.periodsLabel}
        </div>
      </div>
    </Link>
  );
});

/**
 * 王朝の区分セレクト。**帯の中（ラベル無し）と絞り込みパネルの中（ラベル有り）の
 * 2箇所に出る**ので、選択肢の文言がずれないよう1つにまとめてある。
 * 未選択の表示が「すべて」ではなく「すべての区分」なのは、帯の中には見えるラベルが
 * 無く、値だけで何のセレクトか読めなければならないため。
 */
function CategorySelect({
  value,
  onChange,
  className,
}: {
  value: DynastyCategory | "all";
  onChange: (value: DynastyCategory | "all") => void;
  className: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as DynastyCategory | "all")}
    >
      <SelectTrigger className={className} aria-label="王朝の区分で絞り込み">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">すべての区分</SelectItem>
        {dynastyCategoryOptions.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function EmperorGrid({
  records,
  dynastyOptions,
}: {
  records: EmperorListRecord[];
  dynastyOptions: DynastyOption[];
}) {
  const [query, setQuery] = useState("");
  const [dynastyValue, setDynastyValue] = useState("all");
  const [categoryValue, setCategoryValue] = useState<DynastyCategory | "all">("all");
  /** 帯に入りきらない操作を畳んだ「絞り込み」ポップオーバーの開閉。 */
  const [filterOpen, setFilterOpen] = useState(false);

  // 操作の反応を優先し、グリッドの絞り込み再レンダリングは低優先度で追従させる。
  // **後追いさせる対象を検索語だけでなく3条件まとめに広げた（2026-08-01）** —
  // 王朝・区分のセレクトは即時反映で、選んだ瞬間に365枚の再レンダリングが
  // 走ってポップオーバーの閉じ方が固まっていた。コントロールの表示は生の
  // state（即時）、グリッドは deferred（後追い）と持ち場を分ける。
  const filters = useMemo(
    () => ({ query, dynastyValue, categoryValue }),
    [query, dynastyValue, categoryValue],
  );
  const deferredFilters = useDeferredValue(filters);
  /** 画面のグリッドが1つ前の条件の結果であるあいだ true。 */
  const stale = filters !== deferredFilters;
  const hasFilter =
    query.trim() !== "" || dynastyValue !== "all" || categoryValue !== "all";
  const clearAll = useCallback(() => {
    setQuery("");
    setDynastyValue("all");
    setCategoryValue("all");
  }, []);

  // 絞り込み状態をURLクエリ（?q=&dynasty=&category=）と同期する。共有・リロード・
  // 個別ページからの戻りで状態が消えないようにするため。復元はhydration不一致を
  // 避けてマウント後のeffectで行い、書き込みはマウント直後の1回だけスキップする
  // （復元effectより先にデフォルト値でreplaceStateしてパラメータを消さないため）。
  const skipFirstUrlWriteRef = useRef(true);
  useEffect(() => {
    // URL（外部システム）からの1回きりの復元はeffectでしか書けない正当なsetState。
    // SSR済みHTMLとのhydration不一致を避けるため、レンダー中（useState初期値）では
    // 読まずマウント後に反映する。
    /* eslint-disable react-hooks/set-state-in-effect */
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) setQuery(q);
    const dynasty = params.get("dynasty");
    if (dynasty && dynastyOptions.some((o) => o.value === dynasty)) {
      setDynastyValue(dynasty);
    }
    const category = params.get("category");
    if (category && dynastyCategoryOptions.some((o) => o.value === category)) {
      setCategoryValue(category as DynastyCategory);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [dynastyOptions]);
  useEffect(() => {
    if (skipFirstUrlWriteRef.current) {
      skipFirstUrlWriteRef.current = false;
      return;
    }
    // 一覧のURLでないときは書き込まない。カードを押してソフトナビゲーションが
    // 始まった直後にdeferredQueryの反映が届くと、遷移先の /emperors/{id} に対して
    // ?q= を replaceState してしまうため（ダイアログ時代の履歴同期対策として
    // 入れたガードだが、直接遷移になっても理由が変わって必要）。
    const path = window.location.pathname;
    if (!(path.endsWith("/emperors") || path.endsWith("/emperors/"))) return;
    const params = new URLSearchParams();
    if (deferredFilters.query.trim())
      params.set("q", deferredFilters.query.trim());
    if (deferredFilters.dynastyValue !== "all")
      params.set("dynasty", deferredFilters.dynastyValue);
    if (deferredFilters.categoryValue !== "all")
      params.set("category", deferredFilters.categoryValue);
    const qs = params.toString();
    history.replaceState(
      null,
      "",
      qs ? `?${qs}` : window.location.pathname,
    );
  }, [deferredFilters]);

  // 検索は空白区切りの全語がヒットした皇帝のみ表示（名称・別名・王朝名・時代が対象）。
  // クエリはNFKC正規化（半角カナ→全角・全角英数→半角等）したうえで、かな入力は
  // searchKana（ビルド時生成の読み展開）に照合し、カタカナはひらがなに正規化して
  // 両表記どちらでも引けるようにする。
  const filtered = useMemo(() => {
    const tokens = deferredFilters.query
      .normalize("NFKC")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return records.filter(
      (r) =>
        (deferredFilters.dynastyValue === "all" ||
          r.dynastyKey === deferredFilters.dynastyValue) &&
        (deferredFilters.categoryValue === "all" ||
          r.dynastyCategory === deferredFilters.categoryValue) &&
        tokens.every((t) => {
          const target = `${r.searchText} ${r.searchKana}`;
          return target.includes(t) || target.includes(toHiragana(t));
        }),
    );
  }, [records, deferredFilters]);

  // 効いている条件のチップ。**ラベルはグリッドの見た目（deferred）ではなく
  // 選択の生の値から作る** — 押した直後に消えないと、外したはずのチップが
  // 一瞬残って「効いていない」ように見える。
  const chips: FilterChip[] = [];
  if (query.trim()) {
    chips.push({
      key: "q",
      label: `検索「${query.trim()}」`,
      onRemove: () => setQuery(""),
    });
  }
  if (dynastyValue !== "all") {
    chips.push({
      key: "dynasty",
      label: `王朝: ${dynastyOptions.find((o) => o.value === dynastyValue)?.label ?? dynastyValue}`,
      onRemove: () => setDynastyValue("all"),
    });
  }
  if (categoryValue !== "all") {
    chips.push({
      key: "category",
      label: `区分: ${dynastyCategoryOptions.find((o) => o.value === categoryValue)?.label ?? categoryValue}`,
      onRemove: () => setCategoryValue("all"),
    });
  }

  // 時代（eraLabel）ごとのセクションに分けて表示する。データ順は概ね時代順だが、
  // 「新〜後漢初」（更始帝ら）や袁術のように時代の途中へ挟まる少数例があるため、
  // 初出順の時代へプールする（結果として5名だけデータ順から時系列寄りに移動する）。
  const sections = useMemo(() => {
    const byEra = new Map<string, EmperorListRecord[]>();
    for (const r of filtered) {
      const list = byEra.get(r.eraLabel);
      if (list) list.push(r);
      else byEra.set(r.eraLabel, [r]);
    }
    return [...byEra.entries()];
  }, [filtered]);

  /** 「絞り込み」ボタンに添える効いている条件の数。**生の state から数える**
   *  （deferred から数えると、外した直後に数字だけ残って見える）。 */
  const activeFilterCount = chips.length;

  // 帯（時代へジャンプ）に載せる絞り込み一式（2026-08-04 ユーザー指示）。
  // それまでは本文先頭の1〜2行に置いていて、少しスクロールすると画面から消え、
  // 5万px級の一覧の途中で条件を変えるには先頭まで戻る必要があった。
  //
  // **帯は1行48pxで固定**（SECTION_NAV_H が節見出しの sticky top を兼ねる）なので、
  // 幅が足りない側から順に「絞り込み」ポップオーバーへ畳む。分岐は帯の内幅
  // （@container/bar）で、ビューポート幅ではない — md 以上はサイドバー240pxのぶん
  // 実効幅が狭く、768pxの画面でも帯の内幅は448pxしかないため。
  //   〜@xl(36rem)  : 検索・王朝・区分をすべてポップオーバーへ
  //   @xl〜@4xl     : 検索は帯へ、王朝・区分はポップオーバー
  //   @4xl(56rem)〜 : すべて帯に並ぶ（ポップオーバーのボタンは消える）
  const filterControls = (
    <>
      <div className="hidden min-w-0 flex-1 @min-[26rem]/bar:block @xl/bar:max-w-[12rem]">
        <SearchField
          bare
          value={query}
          onChange={setQuery}
          placeholder="名前・王朝名など"
          ariaLabel="皇帝を検索"
          widthClass="w-full"
        />
      </div>
      <div className="hidden shrink-0 items-center gap-2 @4xl/bar:flex">
        <DynastyCombobox
          options={dynastyOptions}
          value={dynastyValue}
          onChange={setDynastyValue}
          triggerWidthClass="w-[10rem]"
        />
        {/* 区分の説明。帯にはラベルが無いのでヒントだけ単独で並ぶ（@4xl 未満では
            パネル側のラベルに付く）。**セレクトとの間隔を他より詰める** — 等間隔だと
            右隣の件数に付いた印に見える。 */}
        <div className="flex items-center gap-1">
          <CategorySelect
            value={categoryValue}
            onChange={setCategoryValue}
            className="w-[9rem]"
          />
          <DynastyCategoryHint />
        </div>
      </div>
      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            // 検索窓すら出ない幅ではアイコンだけにする。文字を残すと、条件が
            // 効いたときの縮み代がジャンプのトリガーからしか出せない。
            // 読み上げ名は aria-label が持つので、文字が消えても名前は残る。
            aria-label="絞り込み"
            className="shrink-0 @4xl/bar:hidden"
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
            効かない。中身は幅にかかわらず3つとも載せる（@xl〜@4xl では検索が帯と
            ここの2箇所に出るが、同じ state を指しているので食い違わない）。 */}
        <PopoverContent align="end" className="w-[16rem] space-y-3">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="名前・王朝名など"
            ariaLabel="皇帝を検索（絞り込みパネル）"
            widthClass="w-full"
          />
          <FilterField label="王朝">
            <DynastyCombobox
              options={dynastyOptions}
              value={dynastyValue}
              onChange={setDynastyValue}
              triggerWidthClass="w-full"
            />
          </FilterField>
          <FilterField label="王朝の区分" hint={<DynastyCategoryHint />}>
            <CategorySelect
              value={categoryValue}
              onChange={setCategoryValue}
              className="w-full"
            />
          </FilterField>
        </PopoverContent>
      </Popover>
      <ResultCount
        pending={stale}
        className="shrink-0 whitespace-nowrap text-xs @2xl/bar:text-sm"
      >
        {/* ResultCount は flex（スピナーとの間隔）なので、文言は1つの要素に
            まとめる — 分けると数字と単位の間に gap が入って「365 名」になる。
            狭い帯では「を表示中」を落として数字だけにする。 */}
        <span>
          <span className="tabular-nums">
            {hasFilter ? `${filtered.length}/${records.length}` : records.length}
          </span>
          名<span className="hidden @xl/bar:inline">を表示中</span>
        </span>
      </ResultCount>
    </>
  );

  return (
    <div>
      {/* 時代セクションへのページ内ジャンプ＋絞り込み。絞り込みで空になった時代は
          出さない。画面上部に固定して、5万px級のスクロールのどこからでも他の時代へ
          飛べる・条件を変えられるようにする。**0件でも帯は残る**（節が0個になっても
          絞り込みを外す手段が画面から消えないように）。 */}
      <SectionJumpNav
        label="時代へジャンプ"
        ariaLabel="時代へジャンプと絞り込み"
        // 一覧本文は既に px-gutter された箱の中なので、バーだけ全幅に戻す。
        className="-mx-gutter md:-mx-gutter-wide"
        items={sections.map(([era, list]) => ({
          id: `era-${era}`,
          label: era,
          count: list.length,
        }))}
        trailing={filterControls}
      />

      <FilterChips
        chips={chips}
        onClearAll={clearAll}
        className="mx-auto mt-4 w-full max-w-content"
      />

      {filtered.length === 0 ? (
        <NoResults onClearAll={clearAll} />
      ) : (
        <>
          {/* カードの列数はビューポート幅でなく「この箱の幅」で決める（@container）。
              ビューポートで分岐していた頃は、サイドバー240pxが現れる md(768px) 以降で
              実効幅が448pxしかないのに4列（1枚103px）まで詰まっていた。列数の閾値は
              1枚あたり180〜230pxを保つ位置に置いてある。 */}
          <div className="mx-auto w-full max-w-content @container">
            {sections.map(([era, list], sectionIndex) => {
              // ファーストビューの肖像だけ先行読み込みする（先頭セクション以外は
              // 必ず画面外なので対象は先頭セクションのみでよい）。
              // 15 = 1440px・5列でのファーストビュー実測値（15.6人）。カードを3:4に
              // 縮めて1画面が12.7→15.6人になったぶん、旧値12から上げてある。
              // **計測で出した最適値ではない**（旧12は PERFORMANCE.md の Lighthouse
              // timespan 由来）。1920px・6列だと22人入るので足りないが、画面外の肖像を
              // eager にすると LCP 要素の取得と競合するため、狭い側に寄せてある。
              const priorityCount = sectionIndex === 0 ? 15 : 0;
              return (
                // アンカー先と「現在地」の観測対象はどちらもこの section。見出しは
                // sticky でバーの真下に貼り付き続けるため、見出しを観測対象にすると
                // 判定帯（画面の20%〜45%）に一度も入らず現在地が更新されない。
                <section
                  key={era}
                  id={`era-${era}`}
                  className="mb-6 last:mb-0"
                  style={{ scrollMarginTop: BELOW_SECTION_NAV }}
                >
                  <h2
                    // スクロール中の現在地がわかるよう、固定した時代ジャンプバーの
                    // 真下（SECTION_NAV_H）に貼り付ける。
                    className="sticky z-10 -mx-2 mb-3 border-b border-border bg-background/95 px-2 py-2 font-heading text-base font-semibold leading-ruby text-foreground backdrop-blur-sm"
                    style={{ top: BELOW_SECTION_NAV }}
                  >
                    <RubyText source={list[0].eraLabelRuby} />
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {list.length}名
                    </span>
                  </h2>
                  <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5 @6xl:grid-cols-6">
                    {list.map((r, i) => (
                      <EmperorCard
                        key={r.id}
                        record={r}
                        priority={i < priorityCount}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
