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
import { ConcurrentPanel } from "@/components/home-v2/concurrent-panel";
import { ReignDeathPanel } from "@/components/home-v2/reign-death-panel";
import { SurvivalPanel } from "@/components/home-v2/survival-panel";
import type {
  HomeBreakdownSlice,
  HomeCenturyBand,
  HomeConcurrentReigns,
  HomeRankingPanel,
  HomeReignDeath,
  HomeReignSurvival,
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
      {/* 注記も `<dd>` で出す（`<p>` にしない）— この Card は `<dl>` 直下の div として
          並ぶので、中に置けるのは dt / dd だけ。p を混ぜると Lighthouse のユーザー補助が
          「dl に許されない子要素」で落ちる（PSI 実測・2026-08-05）。見た目は同じ。 */}
      <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{figure.note}</dd>
    </Card>
  );
}

/**
 * カードの見出し。**リンクは持たない** — 2026-07-31 に下層の統計ページを廃止し、
 * 「詳しく →」の行き先が無くなった（404 へ着地する導線は画面に残さない）。
 * 下層ページを作ったら、この部品にリンクを戻すのではなく置いた側で足す。
 */
function PanelHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="font-heading text-base font-semibold text-foreground">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/**
 * 指標ごとの棒の色。3指標はタブで排他表示なので同時に並ばず、隣接ペアの
 * 見分けではなく「黒文字が乗る明るさ」と「白地での存在感」を --bar に揃えて選んである
 * （実測値は globals.css の --bar / --bar-campaign / --bar-era-change のコメント）。
 * タブを増やしたらここと globals.css の**両方**にトークンを足す
 * （未定義キーは既定の --bar に無言で落ちる。globals.css 側は :root と @theme が対）。
 */
const BAR_CLASS_BY_METRIC: Record<string, string> = {
  reign: "bg-bar",
  campaign: "bg-bar-campaign",
  "era-change": "bg-bar-era-change",
};

/**
 * ランキング1タブ分の中身（説明・リンク・横棒リスト）。
 *
 * **3タブとも10行ちょうど**（`topByValue` が同値をまたいでも切る）。行数では高さが
 * 揃うが、説明文の折り返し行数はタブで変わるので**高さは固定しない**
 * — 高い方に合わせると短い説明のタブで下に空白が戻る。
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
      {/* 行き先がある指標だけリンクを出す。在位期間は /database の在位年数降順へ、
          親征・改元は行き先が無い（/database は回数系の列を持たない）ので null。 */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm text-muted-foreground">{panel.description}</p>
        {panel.href && panel.linkLabel ? (
          <Link
            href={panel.href}
            className="shrink-0 text-sm font-medium text-seal underline-offset-4 hover:underline"
          >
            {panel.linkLabel}
          </Link>
        ) : null}
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
  concurrent,
  survival,
}: {
  figures: Figure[];
  rankings: HomeRankingPanel[];
  deathCauses: HomeBreakdownSlice[];
  accessionRoutes: HomeBreakdownSlice[];
  reignDeath: HomeReignDeath;
  centuries: HomeCenturyBand[];
  concurrent: HomeConcurrentReigns;
  survival: HomeReignSurvival;
}) {
  // 凡例に出す区分と、帯に描くセグメントを必ず一致させる。
  // 上位N件だけを凡例に出して残りを描くと、「凡例に無い区分」が生まれ、色だけが
  // 手掛かりの区分ができる（レビュー E節 C-2 と同じ状態）。溢れた分は「その他」に畳む。
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
      {/* 4枚を横に並べるのは xl から（2026-08-04）— lg で4列にすると1枚が実測145px
          （文字が入るのは padding を引いた105px）まで痩せ、「前221年〜1945年」が
          「前 / 221年〜 / 1945年」の3行に割れる。数値は text-3xl のまま動かさない
          （盤面の見出し数値なので、幅に合わせて縮めると段ごとに大きさが変わる）。 */}
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {figures.map((f) => (
          <FigureCard key={f.label} figure={f} />
        ))}
      </dl>

      {/* 左（3/5）にランキング、右（2/5）に内訳2枚。**3:2 に割るのは xl から**
          （2026-08-04）— lg（1024〜1279px）では右列の幅が 268〜364px しかなく、
          凡例が1列へ落ちて右列だけが 848px まで伸びる（左は568px・差280px）。
          2026-08-02 はこれを `lg:self-start` で受けたが、**空白がカードの中から
          外へ移るだけ**で、左の下に280pxの穴が空いたままだった（ユーザー指摘・
          2026-08-04）。lg では段を割らず、ランキングを全幅・内訳2枚を横並びにする。
          右列が2列凡例に届くのは幅368px＝ビューポート約1276pxからなので、
          切り替えの境目は xl（1280px）に合わせてある。
          **`self-start` は付けない**（2026-08-04）— xl 以上で左は544px・右は568pxと
          差が24pxしかなく、伸ばして下端を揃えるほうを採った。3タブとも実測で差0px。 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-5 xl:col-span-3">
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

        {/* 死因と即位経路は別々のカード。lg では横に2枚（上のランキングが全幅なので
            段の下端は自然に揃う）、xl から縦2枚に戻す。xl の h-full + content-between は
            ランキングと下端を揃えつつ余った高さを2枚の「間」へ逃がすためで、
            カードの中には空白を作らない。 */}
        <div className="grid gap-4 lg:col-span-5 lg:grid-cols-2 xl:col-span-2 xl:h-full xl:grid-cols-1 xl:content-between">
          <Card>
            <PanelHeading title="死因" description="正史の記述を元に分類しています" />
            <div className="mt-5">
              <BreakdownBar slices={deathData} />
            </div>
          </Card>
          <Card>
            <PanelHeading
              title="即位経路"
              description="皇帝位に就いた経緯の区分です"
            />
            <div className="mt-5">
              <BreakdownBar slices={accessionData} />
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          {/* このカードだけ行き先が残っている（/emperors）。見出し行の右端に置く。 */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <PanelHeading
              title="世紀ごとの即位人数"
              description={`即位した年で数えた${centuryTotal}名の分布です。`}
            />
            <Link
              href="/emperors"
              className="shrink-0 text-sm font-medium text-seal underline-offset-4 hover:underline"
            >
              皇帝を一覧で見る →
            </Link>
          </div>
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
        {/* 世紀チャートの隣。時間軸を持たない図を置いて軸の重複を避けている。 */}
        <Card className="flex flex-col lg:col-span-2">
          <h2 className="font-heading text-base font-semibold text-foreground">
            在位年数と死因
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            在位が短いほど非業の死の割合が高くなります
          </p>
          <ReignDeathPanel
            segments={reignDeath.segments}
            bands={reignDeath.bands}
          />
        </Card>
      </div>

      {/* 3段目（2026-08-01 追加）。どちらも折れ線で、1段目・2段目と同じ 3:2。
          同時在位数を左（3/5）に置くのは横軸が2000年超あるためで、入れ替えると
          「前200」「1800」の目盛りが潰れる。継続率は横軸0〜50年なので2/5で足りる。 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <PanelHeading
            title="同時に帝号を持っていた人数"
            description={`分裂期には帝号が並び立ちます。最大は${concurrent.peak.dateLabel}の${concurrent.peak.count}人です。内禅・復位・並立擁立では、同じ王朝で2人が並ぶ期間もあります。`}
          />
          <ConcurrentPanel data={concurrent} />
        </Card>
        <Card className="lg:col-span-2">
          {/* KPI「平均在位期間」の歪みを直す図。中央値・平均・平均以上の人数は
              集計から出す（文言へ焼き込まない）。 */}
          <PanelHeading
            title="在位継続率"
            description={`即位からN年後にまだ在位している割合です。中央値${survival.medianYears}年に対し平均は${survival.meanYears}年で、平均以上に在位したのは${survival.aboveMeanCount}名（${survival.aboveMeanPercent}%）です。`}
          />
          <SurvivalPanel data={survival} />
        </Card>
      </div>
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
