"use client";

// 皇帝一覧の「図鑑」グリッド。
// カード枠は3:4固定・肖像はcover+topで顔を切らずにフィット、画像なしは姓一文字の
// モノグラムをプレースホルダー表示する。カードを押すと詳細ダイアログを開く。

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
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DynastyCategoryHint, FilterField } from "@/components/charts/chart-filter-controls";
import { DynastyCombobox } from "@/components/charts/dynasty-combobox";
import type {
  DynastyCategory,
  DynastyOption,
  EmperorListRecord,
  EmperorRecord,
} from "@/lib/emperor-types";
import {
  dynastyCategoryOptions,
} from "@/lib/emperor-types";
import { toHiragana } from "@/lib/kana";
import { dynastyColorHex, dynastyColorSlot } from "@/lib/dynasty-colors";
import { BASE_PATH } from "@/lib/base-path";
import { Portrait } from "@/components/emperors/portrait";
import { EmperorDetailDialog } from "@/components/emperors/emperor-detail-dialog";
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
  onSelect,
}: {
  record: EmperorListRecord;
  priority: boolean;
  onSelect: (record: EmperorListRecord) => void;
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
      // hoverの移動はcompositorプロパティだけに限る。365枚が全件DOMに載るグリッドなので、
      // top/marginで動かすと再レイアウトがCLSに化ける。
      // Tailwind v4 の -translate-y-* は transform ではなく translate プロパティを書くため、
      // 遷移対象は translate と書く(transform と書くとホバーが瞬間移動になる)。
      className="group block overflow-hidden rounded-md border border-border bg-card text-left transition-[translate,border-color] duration-150 ease-out hover:border-seal/60 focus-visible:outline-2 focus-visible:outline-ring motion-safe:hover:-translate-y-px motion-safe:hover:shadow-sm motion-reduce:transition-none"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        <Portrait
          record={record}
          // 列数はコンテナ幅で決まり、カード1枚は狭い画面の2列を除けば概ね
          // 180〜230pxに収まる（本文列が max-w-content で止まるため vw では表せない）。
          sizes="(max-width: 640px) 50vw, 230px"
          priority={priority}
        />
      </div>
      {/* 印を絶対配置するため relative。印は padding の外（左端）に立てる。 */}
      <div className="relative px-2.5 py-2 pl-3">
        <DynastyMark dynastyKey={record.dynastyKey} />
        <div className="truncate text-sm font-medium text-foreground group-hover:text-seal">
          {record.name}
          {/* 皇帝号だけでは誰か分かりにくい人物向けの補助名（諱・通用名）。
              導出規則・人物別上書きは lib/card-subtitle.ts。 */}
          {record.cardSubtitle && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              {record.cardSubtitle}
            </span>
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {record.dynastyLabel}
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
  // 一覧のpropsは軽量レコードのみ。ダイアログに出すフルEmperorRecordは、開く時に
  // /emperor-records/{id}（Route Handlerの静的書き出し）をfetchして取得する。
  const [selected, setSelected] = useState<EmperorRecord | null>(null);
  const fullRecordsRef = useRef(new Map<string, EmperorRecord>());
  // 最後に開こうとしたid。連打・閉じた直後に古いfetchが解決してダイアログを
  // 開き直さないよう、解決時に一致確認する。
  const wantedIdRef = useRef<string | null>(null);
  const onSelect = useCallback(({ id }: { id: string }) => {
    wantedIdRef.current = id;
    const cached = fullRecordsRef.current.get(id);
    if (cached) {
      setSelected(cached);
      return;
    }
    fetch(`${BASE_PATH}/emperor-records/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`${res.status}`))))
      .then((record: EmperorRecord) => {
        fullRecordsRef.current.set(id, record);
        if (wantedIdRef.current === id) setSelected(record);
      })
      .catch(() => {
        // 取得できない環境ではダイアログを諦めて個別ページ本体へ遷移する
        // （カードの<a href>と同じ遷移先。内容の表示を最優先にする）。
        if (wantedIdRef.current === id) {
          window.location.assign(`${BASE_PATH}/emperors/${id}`);
        }
      });
  }, []);
  const onCloseDialog = useCallback(() => {
    wantedIdRef.current = null;
    setSelected(null);
  }, []);
  // 進む（popstate）での再入はダイアログが覚えているフルレコードで開き直す。
  const onRestoreDialog = useCallback((record: EmperorRecord) => {
    wantedIdRef.current = record.id;
    fullRecordsRef.current.set(record.id, record);
    setSelected(record);
  }, []);
  // ダイアログを開いている間はURLを個別ページに差し替える（共有・リロードで
  // 個別ページ本体が開く）。useDialogHistoryのeffect依存になるため安定参照で渡す。
  const dialogUrlFor = useCallback(
    (record: EmperorRecord) => `${BASE_PATH}/emperors/${record.id}`,
    [],
  );
  // 入力欄の反応を優先し、グリッドの絞り込み再レンダリングは低優先度で追従させる
  // （1文字ごとに364カードの再レンダリングがキー入力をブロックしないように）。
  const deferredQuery = useDeferredValue(query);

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
    // ダイアログ内リンクで個別ページへ遷移→戻るで一覧へ帰ってきた場合、履歴
    // エントリにはダイアログのmarkerが残ったままこのコンポーネントがマウント
    // し直される（popstateはマウント前に発火済みで拾えない）。ここで復元して
    // 「戻る＝ダイアログの開いた一覧」を再現する。
    const dialogId = (
      window.history.state as { emperorDialog?: string } | null
    )?.emperorDialog;
    if (dialogId) {
      const record = records.find((r) => r.id === dialogId);
      if (record) onSelect(record); // フルレコードをfetchして開き直す
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [dynastyOptions, records, onSelect]);
  useEffect(() => {
    if (skipFirstUrlWriteRef.current) {
      skipFirstUrlWriteRef.current = false;
      return;
    }
    // ダイアログが履歴同期でURLを個別ページに差し替えている間は書き込まない
    // （検索入力のdeferred反映がダイアログを開いた直後に届く競合対策）。
    const path = window.location.pathname;
    if (!(path.endsWith("/emperors") || path.endsWith("/emperors/"))) return;
    const params = new URLSearchParams();
    if (deferredQuery.trim()) params.set("q", deferredQuery.trim());
    if (dynastyValue !== "all") params.set("dynasty", dynastyValue);
    if (categoryValue !== "all") params.set("category", categoryValue);
    const qs = params.toString();
    history.replaceState(
      null,
      "",
      qs ? `?${qs}` : window.location.pathname,
    );
  }, [deferredQuery, dynastyValue, categoryValue]);

  // 検索は空白区切りの全語がヒットした皇帝のみ表示（名称・別名・王朝名・時代が対象）。
  // クエリはNFKC正規化（半角カナ→全角・全角英数→半角等）したうえで、かな入力は
  // searchKana（ビルド時生成の読み展開）に照合し、カタカナはひらがなに正規化して
  // 両表記どちらでも引けるようにする。
  const filtered = useMemo(() => {
    const tokens = deferredQuery
      .normalize("NFKC")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return records.filter(
      (r) =>
        (dynastyValue === "all" || r.dynastyKey === dynastyValue) &&
        (categoryValue === "all" || r.dynastyCategory === categoryValue) &&
        tokens.every((t) => {
          const target = `${r.searchText} ${r.searchKana}`;
          return target.includes(t) || target.includes(toHiragana(t));
        }),
    );
  }, [records, deferredQuery, dynastyValue, categoryValue]);

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
  // 表示順（セクション順）で平坦化した一覧。ダイアログの前後送りに使う。
  const flatOrder = useMemo(
    () => sections.flatMap(([, list]) => list),
    [sections],
  );
  const selectedIndex = selected
    ? flatOrder.findIndex((r) => r.id === selected.id)
    : -1;

  return (
    <div>
      {/* 狭い画面ではフィルタ3つが縦に積まれ、ファーストビューをほぼ埋めていた。
          検索を1行、王朝と区分を2列に置いて3行を2行に畳む。幅は列から決まるので
          自動幅ではなく、Webフォント読込による折り返しずれ（CLS）は起きない。 */}
      <div className="mx-auto mb-4 grid w-full max-w-content grid-cols-2 items-end gap-x-3 gap-y-3 sm:flex sm:flex-wrap sm:gap-4">
        <div className="col-span-2 sm:col-auto">
          <FilterField label="検索">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="名前・王朝名など"
                className="w-full pl-8 sm:w-[220px]"
              />
            </div>
          </FilterField>
        </div>
        <FilterField label="王朝">
          <DynastyCombobox
            options={dynastyOptions}
            value={dynastyValue}
            onChange={setDynastyValue}
            triggerWidthClass="w-full sm:w-[200px]"
          />
        </FilterField>
        <FilterField label="王朝の区分" hint={<DynastyCategoryHint />}>
          <Select
            value={categoryValue}
            onValueChange={(v) => setCategoryValue(v as DynastyCategory | "all")}
          >
            <SelectTrigger
              className="w-full sm:w-[170px]"
              aria-label="王朝の区分で絞り込み"
            >
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
        <span className="col-span-2 text-sm text-muted-foreground sm:col-auto sm:pb-2">
          全{filtered.length}名を表示中
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-sm text-muted-foreground">
          条件に一致する皇帝が見つかりませんでした。
        </p>
      ) : (
        <>
          {/* 時代セクションへのページ内ジャンプ。絞り込みで空になった時代は出さない。
              画面上部に固定して、5万px級のスクロールのどこからでも他の時代へ飛べる
              ようにする（従来は本文先頭の素のテキストリンクで、少し送ると消えた）。 */}
          <SectionJumpNav
            label="時代へジャンプ"
            // 一覧本文は既に px-gutter された箱の中なので、バーだけ全幅に戻す。
            className="-mx-gutter md:-mx-gutter-wide"
            items={sections.map(([era, list]) => ({
              id: `era-${era}`,
              label: era,
              count: list.length,
            }))}
          />
          {/* カードの列数はビューポート幅でなく「この箱の幅」で決める（@container）。
              ビューポートで分岐していた頃は、サイドバー240pxが現れる md(768px) 以降で
              実効幅が448pxしかないのに4列（1枚103px）まで詰まっていた。列数の閾値は
              1枚あたり180〜230pxを保つ位置に置いてある。 */}
          <div className="mx-auto w-full max-w-content @container">
            {sections.map(([era, list], sectionIndex) => {
              // ファーストビュー相当（最大6カラム×2行）だけ肖像を先行読み込みする。
              // 先頭セクション以外は必ず画面外なので対象は先頭セクションのみでよい。
              const priorityCount = sectionIndex === 0 ? 12 : 0;
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
                    className="sticky z-10 -mx-2 mb-3 border-b border-border bg-background/95 px-2 py-2 font-heading text-base font-semibold text-foreground backdrop-blur-sm"
                    style={{ top: BELOW_SECTION_NAV }}
                  >
                    {era}
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
                        onSelect={onSelect}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      <EmperorDetailDialog
        record={selected}
        onClose={onCloseDialog}
        onRestore={onRestoreDialog}
        historyUrlFor={dialogUrlFor}
        prev={selectedIndex > 0 ? flatOrder[selectedIndex - 1] : null}
        next={
          selectedIndex >= 0 && selectedIndex < flatOrder.length - 1
            ? flatOrder[selectedIndex + 1]
            : null
        }
        onNavigate={onSelect}
      />
    </div>
  );
}
