"use client";

import { BarChart } from "@/components/tremor/BarChart";
import { BarList } from "@/components/tremor/BarList";
import { Card } from "@/components/tremor/Card";
import { CategoryBar } from "@/components/tremor/CategoryBar";
import { DonutChart } from "@/components/tremor/DonutChart";
import { ProgressCircle } from "@/components/tremor/ProgressCircle";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/tremor/Table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/tremor/Tabs";
import type {
  HomeBreakdownSlice,
  HomeEraBand,
  HomeRankedEmperor,
} from "@/lib/emperors";

/**
 * 概要ダッシュボードの各パネルを、Tremor のブロックに沿った複数の型で並べて
 * 見比べるための場。実データを流してあるので、そのまま採否を決められる。
 * 公開ページではない（/lab は noindex・sitemap にも載せない）。
 */

const SERIES = [
  "series1",
  "series2",
  "series3",
  "series4",
  "series5",
  "series6",
  "series7",
  "series8",
] as const;

const SERIES_BG = [
  "bg-series-1",
  "bg-series-2",
  "bg-series-3",
  "bg-series-4",
  "bg-series-5",
  "bg-series-6",
  "bg-series-7",
  "bg-series-8",
];

function Variant({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
          {id}
        </span>
        <span className="text-sm font-medium text-foreground">{title}</span>
      </div>
      <p className="text-sm text-muted-foreground">{note}</p>
      {children}
    </div>
  );
}

function Group({
  heading,
  lead,
  children,
}: {
  heading: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="border-b border-border pb-3">
        <h2 className="text-xl font-semibold text-foreground">{heading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{lead}</p>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">{children}</div>
    </section>
  );
}

export function LabVariants({
  longestReigns,
  deathCauses,
  accessionRoutes,
  eras,
  emperorCount,
  dynastyCount,
  portraitCount,
  restorationCount,
}: {
  longestReigns: HomeRankedEmperor[];
  deathCauses: HomeBreakdownSlice[];
  accessionRoutes: HomeBreakdownSlice[];
  eras: HomeEraBand[];
  emperorCount: number;
  dynastyCount: number;
  portraitCount: number;
  restorationCount: number;
}) {
  const reignBars = longestReigns.map((e) => ({
    name: `${e.name}（${e.dynastyLabel}）`,
    value: Math.round(e.ratio * 1_000_000),
    href: `/emperors/${e.id}`,
  }));
  const reignLabel = new Map(
    longestReigns.map((e) => [Math.round(e.ratio * 1_000_000), e.valueLabel]),
  );

  const death = deathCauses.slice(0, 6);
  const accession = accessionRoutes.slice(0, 6);
  const eraData = eras.map((b) => ({ 時代: b.label, 人数: b.count }));

  const catBar = (slices: HomeBreakdownSlice[]) =>
    slices.map((s) => Math.round(s.share * 100));

  return (
    <div className="flex flex-col gap-12">
      <Group
        heading="A. 内訳（死因・即位経路）"
        lead="採用は A-3（積み上げ1本帯）。トップでは上位N件で切らず「その他（N区分）」まで畳んだ全区分を渡している（ここの A-3 は上位6件だけなので帯の幅が水増しされている）。"
      >
        <Card>
          <Variant
            id="A-1"
            title="ドーナツ + 凡例リスト（現行）"
            note="弧と凡例が1対1。区分名と実数を必ず併記するので色だけに頼らない。"
          >
            <DonutChart
              className="mx-auto mt-2 h-40"
              data={death}
              category="category"
              value="count"
              colors={[...SERIES]}
              valueFormatter={(v) => `${v}名`}
              showTooltip
            />
            <ul className="mt-5 flex flex-col gap-2">
              {death.map((d, i) => (
                <li
                  key={d.category}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={`size-2.5 shrink-0 rounded-xs ${SERIES_BG[i]}`}
                      aria-hidden
                    />
                    <span className="truncate text-foreground">
                      {d.category}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {d.count}名・{d.percentLabel}
                  </span>
                </li>
              ))}
            </ul>
          </Variant>
        </Card>

        <Card>
          <Variant
            id="A-2"
            title="タブ切り替え + ドーナツ（donut-chart-03 型）"
            note="死因と即位経路を1枚に畳む。カード枚数が減り、比べる操作が増える。"
          >
            <Tabs defaultValue="death" className="mt-2">
              <TabsList variant="solid">
                <TabsTrigger value="death">死因</TabsTrigger>
                <TabsTrigger value="accession">即位経路</TabsTrigger>
              </TabsList>
              {(
                [
                  ["death", death],
                  ["accession", accession],
                ] as const
              ).map(([key, slices]) => (
                <TabsContent key={key} value={key} className="mt-4">
                  <DonutChart
                    className="mx-auto h-36"
                    data={slices}
                    category="category"
                    value="count"
                    colors={[...SERIES]}
                    valueFormatter={(v) => `${v}名`}
                    showTooltip
                  />
                  <ul className="mt-4 flex flex-col gap-2">
                    {slices.map((d, i) => (
                      <li
                        key={d.category}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className={`size-2.5 shrink-0 rounded-xs ${SERIES_BG[i]}`}
                            aria-hidden
                          />
                          <span className="truncate text-foreground">
                            {d.category}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {d.count}名・{d.percentLabel}
                        </span>
                      </li>
                    ))}
                  </ul>
                </TabsContent>
              ))}
            </Tabs>
          </Variant>
        </Card>

        <Card>
          <Variant
            id="A-3"
            title="積み上げ1本帯（CategoryBar）"
            note="円より割合の比較がしやすく、縦を食わない。区分が細いほど潰れる。"
          >
            <div className="mt-3 flex flex-col gap-6">
              <div>
                <p className="text-sm font-medium text-foreground">死因</p>
                <CategoryBar
                  className="mt-3"
                  values={catBar(death)}
                  colors={[...SERIES]}
                  showLabels={false}
                />
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                  {death.map((d, i) => (
                    <li
                      key={d.category}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <span
                        className={`size-2 rounded-xs ${SERIES_BG[i]}`}
                        aria-hidden
                      />
                      <span className="text-foreground">{d.category}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {d.percentLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">即位経路</p>
                <CategoryBar
                  className="mt-3"
                  values={catBar(accession)}
                  colors={[...SERIES]}
                  showLabels={false}
                />
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                  {accession.map((d, i) => (
                    <li
                      key={d.category}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <span
                        className={`size-2 rounded-xs ${SERIES_BG[i]}`}
                        aria-hidden
                      />
                      <span className="text-foreground">{d.category}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {d.percentLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Variant>
        </Card>

        <Card>
          <Variant
            id="A-4"
            title="横棒リスト（bar-list 型）"
            note="順位と量が一番読みやすい。円の「全体に対する割合」の直感は失う。"
          >
            <div className="mt-3 flex items-center justify-between px-1 text-xs font-medium text-muted-foreground">
              <span>死因</span>
              <span>人数</span>
            </div>
            <BarList
              className="mt-2"
              sortOrder="none"
              data={death.map((d) => ({ name: d.category, value: d.count }))}
              valueFormatter={(v) => `${v}名`}
            />
          </Variant>
        </Card>
      </Group>

      <Group
        heading="B. 概況の数値（KPI カード）"
        lead="採用は B-1。Tremor には KPI カードだけで29種ある。"
      >
        <Card>
          <Variant
            id="B-1"
            title="数値 + 注記（現行）"
            note="いちばん素直。1枚に1つの数と、その数え方の但し書き。"
          >
            <dl className="mt-3 grid grid-cols-2 gap-4">
              {[
                ["収録した皇帝", `${emperorCount}`, "名"],
                ["王朝・政権", `${dynastyCount}`, ""],
              ].map(([label, value, unit]) => (
                <div key={label}>
                  <dt className="text-sm font-medium text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tabular-nums text-foreground">
                      {value}
                    </span>
                    <span className="text-base font-medium text-muted-foreground">
                      {unit}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </Variant>
        </Card>

        <Card>
          <Variant
            id="B-2"
            title="数値 + 進捗バー（kpi-card 型）"
            note="「全体のうちどれだけか」が数と一緒に見える。母数がある指標だけに使える。"
          >
            <div className="mt-3 flex flex-col gap-5">
              {[
                ["肖像画のある皇帝", portraitCount, emperorCount],
                ["複数回即位した皇帝", restorationCount, emperorCount],
              ].map(([label, n, total]) => (
                <div key={label as string}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">
                      {label}
                    </span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {n as number}/{total as number}名・
                      {Math.round(((n as number) / (total as number)) * 100)}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-seal"
                      style={{
                        width: `${((n as number) / (total as number)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Variant>
        </Card>

        <Card>
          <Variant
            id="B-3"
            title="数値 + リング（ProgressCircle）"
            note="率が主役の指標向け。並べると賑やかになりすぎるので1〜2枚まで。"
          >
            <div className="mt-4 flex items-center gap-6">
              <ProgressCircle
                value={Math.round((portraitCount / emperorCount) * 100)}
                radius={38}
                strokeWidth={7}
              >
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {Math.round((portraitCount / emperorCount) * 100)}%
                </span>
              </ProgressCircle>
              <div>
                <p className="text-sm font-medium text-foreground">
                  肖像画のある皇帝
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {portraitCount}
                  <span className="ml-1 text-base font-medium text-muted-foreground">
                    /{emperorCount}名
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  パブリックドメイン／CC0 のみ収録。
                </p>
              </div>
            </div>
          </Variant>
        </Card>
      </Group>

      <Group
        heading="C. ランキング（在位が長かった皇帝）"
        lead="採用は C-1。トップでは在位期間・即位年齢・没年齢をタブで切り替える。"
      >
        <Card>
          <Variant
            id="C-1"
            title="BarList（現行）"
            note="名前が棒の中に入るので横幅を食わない。長い名前は棒からはみ出す。"
          >
            <BarList
              className="mt-3"
              sortOrder="none"
              data={reignBars}
              valueFormatter={(v) => reignLabel.get(v) ?? String(v)}
            />
          </Variant>
        </Card>

        <Card>
          <Variant
            id="C-2"
            title="表（Table 型）"
            note="順位・名前・政権・値を別々の列で正確に読める。量の直感は消える。"
          >
            <TableRoot className="mt-3">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>#</TableHeaderCell>
                    <TableHeaderCell>皇帝</TableHeaderCell>
                    <TableHeaderCell>政権</TableHeaderCell>
                    <TableHeaderCell className="text-right">
                      在位
                    </TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {longestReigns.map((e, i) => (
                    <TableRow key={e.id}>
                      <TableCell className="tabular-nums">{i + 1}</TableCell>
                      <TableCell className="font-medium text-foreground">
                        {e.name}
                      </TableCell>
                      <TableCell>{e.dynastyLabel}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {e.valueLabel}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableRoot>
          </Variant>
        </Card>
      </Group>

      <Group
        heading="D. 時代ごとの分布"
        lead="この区画（時代ごとの収録人数）は廃止し、世紀ごとの即位人数の縦棒グラフに置き換えた。以下は廃止前の比較案。"
      >
        <Card>
          <Variant
            id="D-1"
            title="横棒（現行）"
            note="15区分すべてにラベルが出る。縦を大きく食う。"
          >
            <BarChart
              className="mt-3 h-96"
              layout="vertical"
              data={eraData}
              index="時代"
              categories={["人数"]}
              colors={["seal"]}
              valueFormatter={(v) => `${v}名`}
              showLegend={false}
              yAxisWidth={118}
            />
          </Variant>
        </Card>

        <Card>
          <Variant
            id="D-2"
            title="縦棒"
            note="時系列として読めるが、15区分だと目盛りラベルが間引かれる（実測で8本）。"
          >
            <BarChart
              className="mt-3 h-72"
              data={eraData}
              index="時代"
              categories={["人数"]}
              colors={["seal"]}
              valueFormatter={(v) => `${v}名`}
              showLegend={false}
              yAxisWidth={40}
            />
          </Variant>
        </Card>
      </Group>
    </div>
  );
}
