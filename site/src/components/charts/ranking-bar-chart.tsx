"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveBar,
  type BarDatum,
} from "@nivo/bar";
import {
  integerTickValues,
  nivoTheme,
  rankingSeriesColor,
} from "@/components/charts/nivo-theme";
import {
  AxisHeader,
  FixedTooltip,
  MARGIN_RIGHT,
  OutsideValueLabels,
  ROW_HEIGHT,
  SCROLL_MAX_HEIGHT,
  useChartWidth,
  useWindowedRows,
} from "@/components/charts/scroll-bar-chart";
import { EmperorTooltip } from "@/components/charts/emperor-tooltip";
import {
  ChartFilterControls,
  type SortDirection,
} from "@/components/charts/chart-filter-controls";
import type {
  DynastyCategory,
  DynastyOption,
  EmperorRecord,
  RankingMetricKey,
} from "@/lib/emperor-types";

/** 指標の値。年齢は生年不詳などで算出できない皇帝がいるためnullを返しうる。 */
function rawValueOf(r: EmperorRecord, metricKey: RankingMetricKey): number | null {
  if (metricKey === "reignYears") return r.reignYears;
  return r[metricKey];
}

function formatOf(r: EmperorRecord, metricKey: RankingMetricKey): string {
  if (metricKey === "reignYears") return r.reignDurationLabel;
  const value = r[metricKey];
  if (metricKey === "accessionAge" || metricKey === "deathAge") return `${value}歳`;
  return `${value}回`;
}

/** 0回の皇帝をグラフから省略する指標（回数系のみ）。在位期間の0日（1日未満）や
 *  年齢は歴史的事実としてそのままランキングに含める。 */
function collapsesZeros(metricKey: RankingMetricKey): boolean {
  return (
    metricKey !== "reignYears" &&
    metricKey !== "accessionAge" &&
    metricKey !== "deathAge"
  );
}

interface RankedDatum {
  id: string;
  label: string;
  value: number;
  formatted: string;
  record: EmperorRecord;
}

export function RankingBarChart({
  records,
  dynastyOptions,
  metricKey,
  axisLabel,
  valueLabel,
  defaultSort = "desc",
  rankDirection = "desc",
  sortLabel,
  missingNoteLabel,
}: {
  records: EmperorRecord[];
  dynastyOptions: DynastyOption[];
  metricKey: RankingMetricKey;
  axisLabel: string;
  /** ツールチップ・表ビューで使う指標名（例: "在位期間"・"改元回数"）。 */
  valueLabel: string;
  defaultSort?: SortDirection;
  /** 順位1位をどちら側に固定するか（並び順を切り替えても順位は変わらない）。
   *  既定は多い順の1位。即位時年齢のように「少ない方が1位」の指標では"asc"を指定する。 */
  rankDirection?: SortDirection;
  sortLabel?: { desc: string; asc: string };
  /** 値が算出できない皇帝を除外したときの件数注記のラベル（例: "生年不詳などで年齢不明"）。 */
  missingNoteLabel?: string;
}) {
  const [dynastyValue, setDynastyValue] = useState("all");
  const [categoryValue, setCategoryValue] = useState<DynastyCategory | "all">("all");
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSort);
  const [tableOpen, setTableOpen] = useState(false);
  const [hoverTip, setHoverTip] = useState<{
    record: EmperorRecord;
    x: number;
    y: number;
  } | null>(null);

  const { chartAreaRef, chartWidth } = useChartWidth();

  const filtered = records.filter(
    (r) =>
      (dynastyValue === "all" || r.dynastyKey === dynastyValue) &&
      (categoryValue === "all" || r.dynastyCategory === categoryValue),
  );
  // 年齢など値が算出できない皇帝は除外し、件数だけ注記する。
  const withValue = filtered.filter((r) => rawValueOf(r, metricKey) !== null);
  const missingCount = filtered.length - withValue.length;
  // 回数系の指標では0回の皇帝をグラフから省略し件数だけ示す（「調査済みで0回」はデータとして確定している）。
  const nonZero = collapsesZeros(metricKey)
    ? withValue.filter((r) => (rawValueOf(r, metricKey) as number) > 0)
    : withValue;
  const zeroCount = withValue.length - nonZero.length;
  const sorted = [...nonZero].sort((a, b) =>
    sortDirection === "desc"
      ? (rawValueOf(b, metricKey) as number) - (rawValueOf(a, metricKey) as number)
      : (rawValueOf(a, metricKey) as number) - (rawValueOf(b, metricKey) as number),
  );

  // 順位は並び順を切り替えても変わらない「rankDirection側から数えた順位」で表示する。
  const rankOf = (i: number) =>
    sortDirection === rankDirection ? i + 1 : sorted.length - i;

  // 単一王朝で絞り込んでいる間は王朝名の繰り返しを省く。
  const withDynasty = dynastyValue === "all";
  const chartData: RankedDatum[] = sorted.map((r, i) => ({
    id: r.id,
    label: withDynasty
      ? `${rankOf(i)}. ${r.name}（${r.dynastyLabel}）`
      : `${rankOf(i)}. ${r.name}`,
    value: rawValueOf(r, metricKey) as number,
    formatted: formatOf(r, metricKey),
    record: r,
  }));

  const maxValue = Math.max(1, ...chartData.map((d) => d.value));
  // niceを切ってドメイン上限を固定し、軸ヘッダー（独自SVG）と目盛り位置を一致させる。
  const domainMax = Math.ceil(maxValue);
  const ticks = integerTickValues(maxValue);

  // 左マージンはラベル長とコンテナ幅の両方で制限する（狭い画面で描画領域が消えないように）。
  const maxLabelLength = Math.max(0, ...chartData.map((d) => d.label.length));
  const marginLeft = Math.min(
    260,
    Math.max(100, maxLabelLength * 11 + 24),
    Math.max(90, Math.floor(chartWidth * 0.42)),
  );
  // マージンに収まらないラベルは末尾を省略する。
  const charBudget = Math.max(4, Math.floor((marginLeft - 16) / 11));
  const truncate = (label: string) =>
    label.length <= charBudget ? label : `${label.slice(0, charBudget - 1)}…`;

  // Nivoの水平バーはデータ配列の先頭要素を下端に描画するため、表示直前に反転して
  // 「多い順/少ない順」の並びどおり上から表示されるようにする。
  const displayData = [...chartData].reverse();
  // indexByは一意なidを使う（label＝氏名+王朝名は、同名同王朝が重複しうるため衝突対策）。
  const idToLabel = new Map(displayData.map((d) => [d.id, d.label]));
  const chartHeight = Math.max(chartData.length * ROW_HEIGHT + 12, 96);

  // 行ウィンドウイング。displayDataは反転済み（先頭＝最下行）なので、
  // 上からstart..end行は配列末尾側のスライスに対応する。
  const rowCount = chartData.length;
  const { scrollRef, start, end, handleScroll, hoverAllowed } =
    useWindowedRows(rowCount);
  const windowData = displayData.slice(rowCount - end, rowCount - start);
  // 全行が範囲内のときは従来と同じ全高レンダリング（少件数時の見た目を変えない）。
  const isFullRange = start === 0 && end === rowCount;

  // フィルタ・並び順を変えたらスクロール位置を先頭（1位側）に戻す。
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [scrollRef, dynastyValue, categoryValue, sortDirection]);

  const countNotes = [
    zeroCount > 0 ? `調査済み・0${axisLabel}が${zeroCount}名` : null,
    missingCount > 0 ? `${missingNoteLabel ?? "値不明"}が${missingCount}名` : null,
  ].filter((s): s is string => s !== null);

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
        sortLabel={sortLabel}
      >
        <span className="pb-2 text-sm text-muted-foreground">
          {countNotes.length > 0
            ? `全${sorted.length}件を表示中（このほか${countNotes.join("、")}）`
            : `全${sorted.length}件を表示中`}
        </span>
      </ChartFilterControls>
      <div className="rounded-md border border-border">
        <div className="border-b border-border">
          <AxisHeader
            width={chartWidth}
            marginLeft={marginLeft}
            domainMax={domainMax}
            ticks={ticks}
            label={axisLabel}
          />
        </div>
        <div
          ref={scrollRef}
          className="overflow-y-auto overscroll-contain"
          style={{ maxHeight: SCROLL_MAX_HEIGHT }}
          onScroll={() => {
            setHoverTip(null);
            handleScroll();
          }}
        >
          <div ref={chartAreaRef} className="relative" style={{ height: chartHeight }}>
            <div
              className="absolute inset-x-0 top-0"
              // スライスの縦位置はtopでなくtransformで動かす。topの書き換えは
              // レイアウトシフトとして計上され、グラフ内スクロールだけでCLSが
              // 秒単位に悪化する（transformはlayout-shiftの対象外）。
              style={{
                transform: isFullRange
                  ? undefined
                  : `translateY(${start * ROW_HEIGHT}px)`,
                height: isFullRange
                  ? chartHeight
                  : (end - start) * ROW_HEIGHT + 12,
              }}
            >
            <ResponsiveBar
              data={windowData as unknown as BarDatum[]}
              keys={["value"]}
              indexBy="id"
              layout="horizontal"
              theme={nivoTheme}
              // role="img"のSVGに必要なアクセシブルネーム（Lighthouse svg-img-alt対応）。
              ariaLabel={`皇帝別${valueLabel}の横棒グラフ`}
              colors={[rankingSeriesColor]}
              margin={{ top: 6, right: MARGIN_RIGHT, bottom: 6, left: marginLeft }}
              padding={0.35}
              borderRadius={3}
              // niceを切ってドメイン上限を固定する（既定のnice:trueだと62→70等に丸められ、
              // スクロール領域外の軸ヘッダーと目盛り位置がずれるため）。
              valueScale={{
                type: "linear",
                min: 0,
                max: domainMax,
                nice: false,
              }}
              enableGridY={false}
              enableGridX
              gridXValues={ticks}
              axisLeft={{
                tickSize: 0,
                tickPadding: 8,
                format: (id: string) => truncate(idToLabel.get(id) ?? id),
              }}
              axisBottom={null}
              enableLabel={false}
              layers={["grid", "axes", "bars", OutsideValueLabels]}
              tooltip={() => null}
              onMouseEnter={(datum, event) => {
                if (!hoverAllowed()) return;
                const record = (datum.data as unknown as { record: EmperorRecord })
                  .record;
                setHoverTip({ record, x: event.clientX, y: event.clientY });
              }}
              onMouseLeave={() => setHoverTip(null)}
              // バーだけがスプリングで伸び、独自レイヤーの数値ラベルが先に最終位置へ
              // 描かれて浮いて見えるため、アニメーションは使わない。
              animate={false}
            />
            </div>
          </div>
        </div>
      </div>
      {hoverTip && (
        <FixedTooltip x={hoverTip.x} y={hoverTip.y}>
          <EmperorTooltip
            record={hoverTip.record}
            valueLabel={valueLabel}
            formattedValue={formatOf(hoverTip.record, metricKey)}
          />
        </FixedTooltip>
      )}
      <details
        className="mt-3"
        open={tableOpen}
        onToggle={(e) => setTableOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
          表で見る（全{sorted.length}件）
        </summary>
        {tableOpen && (
          <div className="mt-2 max-h-[480px] overflow-y-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-secondary text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">順位</th>
                  <th className="px-3 py-2 font-medium">皇帝</th>
                  <th className="px-3 py-2 font-medium">王朝</th>
                  <th className="px-3 py-2 text-right font-medium">{valueLabel}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                      {rankOf(i)}
                    </td>
                    <td className="px-3 py-1.5">{r.name}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {r.dynastyLabel}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {formatOf(r, metricKey)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </div>
  );
}
