"use client";

import Link from "next/link";
import { BarChart, type TooltipProps } from "@/components/tremor/BarChart";
import { BarList } from "@/components/tremor/BarList";
import { Card } from "@/components/tremor/Card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/tremor/Tabs";
import { BreakdownBar } from "@/components/home-v2/breakdown-panel";
import { ReignDeathPanel } from "@/components/home-v2/reign-death-panel";
import type {
  HomeBreakdownSlice,
  HomeCenturyBand,
  HomeRankingPanel,
  HomeReignDeath,
} from "@/lib/emperors";

/**
 * トップの「数値の盤面」。Tremor（tremorlabs/tremor-blocks・MIT）の
 * Card / BarList / BarChart / CategoryBar / Tabs をほぼ既定のまま使う。
 * 配色を独自に作り直さないことがこの再構築の方針（2026-07-31）。
 */

interface Figure {
  label: string;
  value: string;
  unit?: string;
  note: string;
  seal?: boolean;
}

function FigureCard({ figure }: { figure: Figure }) {
  return (
    <Card className="p-5">
      <dt className="text-sm font-medium text-muted-foreground">{figure.label}</dt>
      <dd className="mt-2 flex items-baseline gap-1">
        <span
          className={`font-heading text-3xl font-semibold tabular-nums ${
            figure.seal ? "text-seal" : "text-foreground"
          }`}
        >
          {figure.value}
        </span>
        {figure.unit ? (
          <span className="text-base font-medium text-muted-foreground">
            {figure.unit}
          </span>
        ) : null}
      </dd>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{figure.note}</p>
    </Card>
  );
}

function PanelHeading({
  title,
  description,
  href,
  linkLabel,
}: {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div>
        <h2 className="font-heading text-base font-semibold text-foreground">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Link
        href={href}
        className="shrink-0 text-sm font-medium text-seal underline-offset-4 hover:underline"
      >
        {linkLabel}
      </Link>
    </div>
  );
}

/**
 * 指標ごとの棒の色。3指標はタブで排他表示なので同時に並ばず、隣接ペアの
 * 見分けではなく「黒文字が乗る明るさ」と「白地での存在感」を --bar に揃えて選んである
 * （実測値は globals.css の --bar / --bar-accession / --bar-death のコメント）。
 * タブを増やしたらここと globals.css の両方にトークンを足す（既定は --bar に落ちる）。
 */
const BAR_CLASS_BY_METRIC: Record<string, string> = {
  reign: "bg-bar",
  "accession-age": "bg-bar-accession",
  "death-age": "bg-bar-death",
};

/**
 * ランキング1タブ分の中身（説明・リンク・横棒リスト）。
 *
 * タブごとに行数が違う（在位10・即位年齢12・没年齢11。同値を切らないため）。
 * いちばん多いタブに合わせて高さを固定すると、既定タブ（在位期間）の下に
 * 2行分の空白が戻るので、**高さは固定しない** — 切り替えでカードが伸縮する。
 */
function RankingPanel({ panel }: { panel: HomeRankingPanel }) {
  // 棒の長さは ratio（1位を1とした相対長）をそのまま使う。
  // valueLabel（「61年332日」）から数字を抜くと 61332 と 5433 のように桁が揃わず、
  // 実際には近い在位が10倍違う長さで描かれる（実測で確認した不具合）。
  const bars = panel.rows.map((e) => ({
    name: `${e.name}（${e.dynastyLabel}）`,
    value: Math.round(e.ratio * 1_000_000),
    href: `/emperors/${e.id}`,
  }));
  const labelByValue = new Map(
    panel.rows.map((e) => [Math.round(e.ratio * 1_000_000), e.valueLabel]),
  );

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm text-muted-foreground">{panel.description}</p>
        <Link
          href={panel.href}
          className="shrink-0 text-sm font-medium text-seal underline-offset-4 hover:underline"
        >
          {panel.linkLabel}
        </Link>
      </div>
      <div className="mt-5 flex items-center justify-between px-1 text-xs font-medium text-muted-foreground">
        <span>皇帝（政権）</span>
        <span>{panel.valueHeader}</span>
      </div>
      <BarList
        data={bars}
        className="mt-2"
        sortOrder="none"
        barClassName={BAR_CLASS_BY_METRIC[panel.key] ?? "bg-bar"}
        valueFormatter={(v) => labelByValue.get(v) ?? String(v)}
      />
    </>
  );
}

/** 世紀ごとの棒グラフのツールチップ。軸ラベルは「前3」と短いので、ここで世紀を補う。 */
function CenturyTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as HomeCenturyBand;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{row.fullLabel}</p>
      <p className="tabular-nums text-muted-foreground">{row.count}名が即位</p>
    </div>
  );
}

export function OverviewBoard({
  figures,
  rankings,
  deathCauses,
  accessionRoutes,
  reignDeath,
  centuries,
  sections,
}: {
  figures: Figure[];
  rankings: HomeRankingPanel[];
  deathCauses: HomeBreakdownSlice[];
  accessionRoutes: HomeBreakdownSlice[];
  reignDeath: HomeReignDeath;
  centuries: HomeCenturyBand[];
  sections: { href: string; label: string; description: string }[];
}) {
  // 凡例に出す区分と、帯に描くセグメントを必ず一致させる。
  // 上位N件だけを凡例に出して残りを描くと、「凡例に無い区分」が生まれ、色だけが
  // 手掛かりの区分ができる（レビュー §E C-2 と同じ状態）。溢れた分は「その他」に畳む。
  //
  // 畳む位置は区分ごとに違う。**即位経路は8区分すべてを出す**（2026-07-31 ユーザー指示）—
  // 末尾の「継承」17名・「内禅」14名は合わせて8.5%あり、「その他」に消すと
  // 分類そのものが見えなくなる。死因は末尾が自尽15・戦死7・事故死1と細いので畳んだまま。
  // **どちらも上限は8**（--series-1〜8 が8色で、9区分目は色を作らず必ず畳む）。
  const deathData = foldRest(deathCauses, 5);
  const accessionData = foldRest(accessionRoutes, 8);

  const centuryTotal = centuries.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {figures.map((f) => (
          <FigureCard key={f.label} figure={f} />
        ))}
      </dl>

      {/* 左（3/5）にランキング、右（2/5）に内訳2枚。**左右の下端を揃える** —
          右列は justify-between なので、余った高さは2枚のカードの「間」に入る
          （カードの中に空白を作らない）。 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          {/* 3指標とも「上位N名を1本ずつの横棒で並べる」同じ型なので、
              カードを3枚並べずタブで切り替える。説明文は指標ごとに母集団が
              違う（年齢は判明者のみ）ため、見出しではなく各タブの中に置く。 */}
          <Tabs defaultValue={rankings[0]?.key}>
            {/* タブは見出しの真横に置く（2026-07-31 ユーザー指示）— 見出しの主語を
                切り替える操作なので、両端揃えでカード幅ぶん離すと結び付きが切れる。
                TabsTrigger は TabsList の中にしか置けないので、**見出しごと Tabs の中**へ入れる。 */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h2 className="font-heading text-base font-semibold text-foreground">
                皇帝ランキング
              </h2>
              <TabsList variant="solid">
                {rankings.map((p) => (
                  <TabsTrigger key={p.key} value={p.key}>
                    {p.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {rankings.map((p) => (
              <TabsContent key={p.key} value={p.key} className="mt-5">
                <RankingPanel panel={p} />
              </TabsContent>
            ))}
          </Tabs>
        </Card>

        {/* 死因と即位経路は別々のカード。h-full + justify-between で、左のランキングと
            下端を揃えつつ、余った高さを2枚の「間」へ逃がす。 */}
        <div className="flex h-full flex-col justify-between gap-4 lg:col-span-2">
          <Card>
            <PanelHeading
              title="死因"
              description="正史の記述を元に分類"
              href="/death-accession#death-cause"
              linkLabel="詳しく →"
            />
            <div className="mt-5">
              <BreakdownBar slices={deathData} />
            </div>
          </Card>
          <Card>
            <PanelHeading
              title="即位経路"
              description="皇帝位に就いた経緯の区分"
              href="/death-accession#accession"
              linkLabel="詳しく →"
            />
            <div className="mt-5">
              <BreakdownBar slices={accessionData} />
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <PanelHeading
            title="世紀ごとの即位人数"
            description={`即位した年で数えた${centuryTotal}名の分布。`}
            href="/emperors"
            linkLabel="皇帝を一覧で見る →"
          />
          {/* 横軸は時間なので、空の世紀も0本のまま残して間隔を保つ。
              目盛りラベルは「前3」「20」と短く、単位は xAxisLabel に出す。 */}
          <BarChart
            className="mt-5 h-64"
            data={centuries}
            index="label"
            categories={["count"]}
            colors={["series1"]}
            valueFormatter={(v) => `${v}名`}
            xAxisLabel="世紀"
            yAxisWidth={40}
            tickGap={4}
            showLegend={false}
            customTooltip={CenturyTooltip}
          />
        </Card>
        {/* 世紀チャートの隣。時間軸を持たない図を置いて軸の重複を避けている。
            「詳しく」リンクは付けない — この集計（在位年数×死因）を持つ下層ページが
            まだ無く、/death-accession へ送っても同じ図は無い。作ったら張る。 */}
        <Card className="flex flex-col lg:col-span-2">
          <h2 className="font-heading text-base font-semibold text-foreground">
            在位年数と死因
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            在位が短いほど非業の死の割合が高い（365名）
          </p>
          <ReignDeathPanel
            segments={reignDeath.segments}
            bands={reignDeath.bands}
          />
        </Card>
      </div>

      {/* 各セクションへのクロール可能なリンク。トップから辿れる面が
          盤面のパネル導線だけになると、/court-events・/military・/ages・
          /reign・/emperors への入口が消える（旧トップが持っていたSEO資産）。
          LazyMount の外に置くこと（畳むと静的HTMLに出ない）。 */}
      <Card>
        <h2 className="font-heading text-base font-semibold text-foreground">
          収録データの一覧
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="font-medium text-foreground underline-offset-4 hover:text-seal hover:underline"
              >
                {s.label}
              </Link>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {s.description}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/**
 * 上位 limit 件を残し、それ以降を「その他」1件に畳む。
 * 件数・百分率は畳んだ分を合算するので、凡例の合計は必ず全体に一致する。
 */
function foldRest(slices: HomeBreakdownSlice[], limit: number) {
  const head = slices.slice(0, limit).map((s) => ({
    name: s.category,
    count: s.count,
    share: s.share,
    percentLabel: s.percentLabel,
  }));
  const rest = slices.slice(limit);
  if (rest.length === 0) return head;
  const count = rest.reduce((sum, s) => sum + s.count, 0);
  const share = rest.reduce((sum, s) => sum + s.share, 0);
  return [
    ...head,
    {
      name: `その他（${rest.length}区分）`,
      // 凡例では「その他」としか出ないので、畳んだ区分名は title に残す。
      detail: `その他: ${rest.map((s) => s.category).join("・")}`,
      count,
      share,
      percentLabel: `${Math.round(share * 100)}%`,
    },
  ];
}
