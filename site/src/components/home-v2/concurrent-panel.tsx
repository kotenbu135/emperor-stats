"use client";

// 同時に帝号を持っていた人数（盤面3段目・左）。
//
// **線は1本**（2026-08-01 ユーザー決定）。`/lab` の検討では年単位と日単位の2本を並べたが、
// 日単位は在位に日付が無い33年で0へ落ち、折れ線では「皇帝がいなかった年」に見えてしまう。
// 集計側（emperors.ts の getConcurrentReigns）で日付の無い側だけ在位年で埋めたので、
// **全374在位が区間になり、残る0人の年は実在の空位だけ**になっている。
//
// **拡大を持つ**（2026-08-01 ユーザー決定）。全体表示は1px＝3.8年で、隋末〜唐初のように
// 毎年段が変わる区間は年を1つずつ指せない（618〜622年が1pxに潰れる）。範囲を絞れば
// 解像度が上がる。入口は2つ:
//  - 図の上をドラッグして範囲選択（**マウス専用**）
//  - 時代プリセット（タッチ・キーボードでも使える。こちらが本線）
//
// 時代の一覧は**畳んでポップオーバーで開く**。横一列のピルは 1440px でも11個しか入らず、
// 縦スクロールの中に横スクロールの帯を作ることになる（一覧ページの時代ジャンプバーが
// 2026-07-31 に同じ理由でこの形へ変わっている）。

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  LineChart,
  LineLegend,
  type LineSeries,
} from "@/components/charts/line-chart";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { HomeConcurrentReigns } from "@/lib/emperors";

const SERIES: LineSeries[] = [
  { key: "count", name: "同時に帝号を持っていた人数", series: 1 },
];

/** 全体表示のときの横軸の目盛り。歴史紀年なので0年は無い（0.0001 で「1年」へ寄せる）。 */
const TICKS = [-200, 0.0001, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800];

function yearLabel(y: number): string {
  const n = Math.round(y);
  return n < 0 ? `前${-n}` : `${n}`;
}

export function ConcurrentPanel({ data }: { data: HomeConcurrentReigns }) {
  // null = 全体表示。
  const [range, setRange] = useState<[number, number] | null>(null);
  const [open, setOpen] = useState(false);

  // 点は顔ぶれの変化年だけなので、ツールチップの見出しは**その段が続く範囲**で出す
  // （点の年だけを出すと、平らな区間の途中を指しているのに段の開始年が見出しに立つ）。
  const spanLabels = new Map(
    data.points.map((p) => [
      p.year,
      p.year === p.endYear
        ? `${yearLabel(p.year)}年`
        : `${yearLabel(p.year)}〜${yearLabel(p.endYear)}年`,
    ]),
  );
  const peopleByYear = new Map(data.points.map((p) => [p.year, p.people]));

  const rangeLabel = range
    ? `${yearLabel(range[0])}〜${yearLabel(range[1])}年`
    : `${data.range.fromLabel}〜${data.range.toLabel}`;
  // ピークの注記は範囲の中にあるときだけ。外れた範囲で出すと図の端に貼り付く。
  const showPeak =
    !range || (data.peak.year >= range[0] && data.peak.year <= range[1]);

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              時代で拡大
              <ChevronDown className="size-3.5" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="grid w-[22rem] grid-cols-2 gap-0.5 p-1">
            {data.eraPresets.map((p) => {
              const active =
                range !== null && range[0] === p.from && range[1] === p.to;
              return (
                <button
                  key={p.label}
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => {
                    setRange([p.from, p.to]);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-baseline justify-between gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm transition-colors",
                    active
                      ? "bg-seal text-seal-foreground"
                      : "text-foreground/85 hover:bg-accent hover:text-seal",
                  )}
                >
                  <span className="truncate">{p.label}</span>
                  <span
                    className={cn(
                      "shrink-0 text-xs tabular-nums",
                      active ? "text-seal-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {yearLabel(p.from)}–{yearLabel(p.to)}
                  </span>
                </button>
              );
            })}
          </PopoverContent>
        </Popover>

        {range ? (
          <Button variant="ghost" size="sm" onClick={() => setRange(null)}>
            ← 全体へ戻す
          </Button>
        ) : null}

        <p className="ml-auto text-xs tabular-nums text-muted-foreground">
          表示中: {rangeLabel}
        </p>
      </div>

      <LineChart
        className="mt-3 h-64"
        data={data.points}
        index="year"
        series={SERIES}
        ticks={TICKS}
        xDomain={range ?? undefined}
        // ドラッグ選択はマウスだけの近道。タッチ・キーボードの経路は上のプリセット。
        onDragZoom={(from, to) => setRange([from, to])}
        // 人数は年ごとの段なので階段で結ぶ（曲線で結ぶとデータに無い山と谷が出る）。
        curveType="stepAfter"
        tickFormatter={yearLabel}
        labelFormatter={(v) =>
          spanLabels.get(Number(v)) ?? `${yearLabel(Number(v))}年`
        }
        // 誰が帝号を持っていたか。**人数と必ず同じ数**が並ぶ（集計側が「その年で
        // いちばん人数が多かった瞬間」の顔ぶれを持たせている）。10人並ぶ年があるので
        // 1行1名にはせず、折り返す1段落にまとめる。
        detailFormatter={(v) => {
          const people = peopleByYear.get(Number(v));
          if (!people || people.length === 0) return null;
          return (
            <p className="max-w-[20rem] pt-0.5 text-xs leading-relaxed text-muted-foreground">
              {people.join("・")}
            </p>
          );
        }}
        // ピークは図の上に焼き付ける。**全体表示ではホバーで指せない** — 横軸2133年を
        // 609pxへ描くので1px＝3.8年で、618〜622年は1pxに潰れて最寄り点になれない。
        markers={
          showPeak
            ? [
                {
                  x: data.peak.year,
                  y: data.peak.count,
                  label: `${data.peak.dateLabel} ${data.peak.count}人`,
                },
              ]
            : undefined
        }
        valueFormatter={(v) => `${v}人`}
        xAxisLabel="年"
        yAxisWidth={36}
        ariaLabel={`${rangeLabel}の、同時に帝号を持っていた人数の推移`}
      />
      <LineLegend series={SERIES} notes={[rangeLabel]} />
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {`全${data.coverage.total}在位を日付で区間にして重なりを数えています（日付が無い${data.coverage.filled}件は在位年で埋めているため上限側の見積りです）。1人だけだった年は${data.soleYears}年で${data.solePercent}%です。${data.excluded
          .map((e) => e.name)
          .join("・")}は${data.range.toLabel}より後にも在位しており、表示範囲の外にあります。`}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        図の上をドラッグすると、その範囲だけを拡大します。
      </p>
    </div>
  );
}
