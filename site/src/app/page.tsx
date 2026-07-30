import Link from "next/link";
import { PageHeader, Section } from "@/components/layout/page-header";
import {
  BreakdownPanel,
  EraBands,
  MoreLink,
  Panel,
  PanelHeading,
  RankedEmperorList,
  SectionLinks,
} from "@/components/home/home-panels";
import { categoryColorMaps } from "@/components/charts/nivo-theme";
import { getHomeHighlights, getOverviewStats } from "@/lib/emperors";
import { buildMetadata, JsonLd, SITE_SECTIONS, websiteJsonLd } from "@/lib/seo";

export const metadata = buildMetadata({ path: "/" });

/**
 * 抜粋を出していないページへの導線。抜粋を出しているページ（/reign・
 * /death-accession・/timeline・/emperors）は各セクション末尾の導線が担うので、
 * ここでは重複させない。文言は SITE_SECTIONS が単一情報源。
 */
const SECONDARY_HREFS = ["/court-events", "/military", "/ages", "/dynasties"];

const secondaryLinks = SECONDARY_HREFS.map((href) => {
  const section = SITE_SECTIONS.find((s) => s.href === href);
  if (!section) throw new Error(`SITE_SECTIONSに存在しないhrefです: ${href}`);
  return section;
});

export default function Home() {
  const stats = getOverviewStats();
  const highlights = getHomeHighlights();

  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <PageHeader
        title="中国皇帝統計"
        description={`始皇帝から溥儀まで、中国史上で実際に「皇帝」を名乗った${stats.emperorCount}名を、正史（本紀・列伝）から1件ずつ確認して集計したデータセットです。`}
      />

      <Section title="収録の概況">
        <div className="rounded-[0.5rem] border border-border bg-card px-5 py-5">
          {/* 朱はこの画面の代表値1つに限る（DESIGN.md: 印章の朱は「ここぞという箇所」）。 */}
          <OverviewFigures
            emperorCount={stats.emperorCount}
            dynastyCount={highlights.dynastyCount}
            yearSpanLabel={highlights.yearSpanLabel}
            avgReignLabel={stats.avgReignLabel}
          />
        </div>
      </Section>

      <Section
        title="在位が長かった皇帝"
        description={`最長は${stats.longestReign.name}（${stats.longestReign.dynastyLabel}）の${stats.longestReign.durationLabel}、最短は${stats.shortestReign.name}（${stats.shortestReign.dynastyLabel}）の${stats.shortestReign.durationLabel}です。`}
      >
        <RankedEmperorList rows={highlights.longestReigns} />
        <div className="mt-4">
          <MoreLink href="/reign">在位年数ランキング365名すべてを見る</MoreLink>
        </div>
      </Section>

      <Section
        title="死因と即位経路の内訳"
        description="皇帝がどのように位に就き、どのように没したかの分布です。"
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel>
            <PanelHeading
              title="死因"
              href="/death-accession#death-cause"
              linkLabel="円グラフと一覧を見る"
            />
            <BreakdownPanel
              slices={highlights.deathCauses}
              colors={categoryColorMaps.deathCauseCategory}
              unit="名"
            />
          </Panel>
          <Panel>
            <PanelHeading
              title="即位経路"
              href="/death-accession#accession"
              linkLabel="円グラフと一覧を見る"
            />
            <BreakdownPanel
              slices={highlights.accessionRoutes}
              colors={categoryColorMaps.accessionRouteCategory}
              unit="名"
            />
          </Panel>
        </div>
      </Section>

      <Section
        title="時代ごとの皇帝数"
        description="収録した365名を時代区分ごとの皇帝の人数です。"
      >
        <EraBands eras={highlights.eras} />
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
          <MoreLink href="/timeline">全皇帝の在位を1本の年表で見る</MoreLink>
          <MoreLink href="/emperors">
            皇帝一覧（{stats.portraitCount}名は肖像つき）を見る
          </MoreLink>
        </div>
      </Section>

      <Section title="そのほかの統計">
        <SectionLinks links={secondaryLinks} />
        <p className="mt-5 text-xs text-muted-foreground">
          数え方・収録基準・出典は
          <Link
            href="/about"
            className="underline underline-offset-2 hover:text-seal"
          >
            このサイトについて
          </Link>
          をご覧ください。
        </p>
      </Section>
    </>
  );
}

/** 概況の4値。代表値（収録人数）だけを朱で置き、残りは墨で組む。 */
function OverviewFigures({
  emperorCount,
  dynastyCount,
  yearSpanLabel,
  avgReignLabel,
}: {
  emperorCount: number;
  dynastyCount: number;
  yearSpanLabel: string;
  avgReignLabel: string;
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
      <Figure
        label="収録した皇帝"
        value={`${emperorCount}名`}
        note="生前に「皇帝」を名乗った人物のみ"
        lead
      />
      <Figure
        label="王朝・政権"
        value={`${dynastyCount}`}
        note="並立政権・自称政権を含む"
      />
      {/* 下限は始皇帝の即位、上限は宣統帝・溥儀の最後の在位（満洲国）。
          「清の滅亡（1912年）」ではないので注記でそう書かない。 */}
      <Figure
        label="対象年代"
        value={yearSpanLabel}
        note="始皇帝の即位から溥儀の最後の在位まで"
      />
      <Figure
        label="平均在位期間"
        value={avgReignLabel}
        note="全収録皇帝の単純平均"
      />
    </dl>
  );
}

function Figure({
  label,
  value,
  note,
  lead = false,
}: {
  label: string;
  value: string;
  note: string;
  lead?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      {/* 注記は dd の中に入れる。dl 直下の div に置けるのは dt/dd だけで、
          p を並べると HTML として不正（axe の definition-list に当たる）。
          値と注記は span を block にして従来と同じ縦積みにする。 */}
      <dd className="mt-0.5">
        <span
          // h1 と同じフルイドな大サイズ（従来の text-2xl → md:text-3xl と両端は同値）。
          className={`block font-heading text-page-title font-semibold tabular-nums ${
            lead ? "text-seal" : "text-foreground"
          }`}
        >
          {value}
        </span>
        <span className="mt-0.5 block text-pretty text-micro text-muted-foreground">
          {note}
        </span>
      </dd>
    </div>
  );
}
