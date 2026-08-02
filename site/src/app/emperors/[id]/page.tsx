// 皇帝個別ページ（365ページ・静的書き出し）。
//
// 2026-08-01 に「ヒーロー＋盤面＋読み物」へ組み直した（EMPEROR_PAGE_PLAN_2026-08-01.md）。
// それまでは詳細ダイアログと表示本体（emperor-detail-body.tsx）を共用する
// deep-link 先で、先頭は名前1行・肖像は基本情報の脇の144px枠だった。
// ダイアログの廃止で共用相手が消えたため、部品ごと個別ページ専用に割り直してある。
//
// 節の並び: ①ヒーロー ②紹介文 ③基本情報＋回数 ④経緯 ⑤在位中の出来事
// ⑥関連動画・前後ナビ。
//
// 2026-08-02 に末尾の「在位日付の典拠」「調査メモ」（畳んだ2節）を廃止した。
// 根拠は配布データ（data/emperors.json）に同じものが入っている。

import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EmperorHero } from "@/components/emperors/emperor-hero";
import { EmperorFacts } from "@/components/emperors/emperor-facts";
import { EmperorVideosSection } from "@/components/emperors/emperor-videos";
import { EmperorNarrativeSections } from "@/components/emperors/emperor-narrative";
import { EmperorEventTimeline } from "@/components/emperors/emperor-event-timeline";
import { RubyText } from "@/components/ui/ruby-text";
import {
  dynastyContextLabel,
  getAllEmperorRecords,
  getEmperorEvents,
  getEmperorNarrative,
  getEmperorProfile,
  getEmperorStructuredDates,
} from "@/lib/emperors";
import { reportReadingCoverage } from "@/lib/name-readings";
import { emperorNameEntries } from "@/lib/display-name";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  buildMetadata,
  JsonLd,
  personJsonLd,
  SITE_NAME,
} from "@/lib/seo";

// output: "export"では全パスをビルド時に列挙する（365ページ）。列挙外のidは404。
export const dynamicParams = false;

export function generateStaticParams(): { id: string }[] {
  const records = getAllEmperorRecords();
  // ふりがな（Issue #20）の進捗をビルドログへ出す。**未完成のまま配信しないための警報**
  // なので消さないこと（全件そろったら name-readings.ts の rubyOf を例外へ切り替える）。
  reportReadingCoverage(
    records.flatMap((r) => [
      r.name,
      r.subtitle ?? "",
      r.personalName ?? "",
      r.templeName ?? "",
      r.posthumousName ?? "",
      r.dynastyLabel,
      r.eraLabel,
    ]),
  );
  return records.map((r) => ({ id: r.id }));
}

/**
 * 紹介文（Issue #16）があればそれを description に使う。
 * 無い皇帝は従来の機械生成文（365ページとも同型で人物ごとの差がほぼ無い）に落ちる。
 */
function descriptionOf(id: string, record: ReturnType<typeof getAllEmperorRecords>[number]): string {
  return (
    getEmperorProfile(id)?.description ??
    `${dynastyContextLabel(record)}の皇帝 ${record.disambiguatedName} の調査結果。在位${record.periodsLabel}（${record.reignDurationLabel}）、死因・即位経路・改元回数など全12項目と全皇帝中の順位を掲載しています。`
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const record = getAllEmperorRecords().find((r) => r.id === id)!;
  return buildMetadata({
    path: `/emperors/${id}`,
    // **`disambiguatedName` を使う** — 通用名は37種104人が重複していて、
    // 南斉の廃帝3人・後漢の少帝2人は王朝を添えても同じ title になる（諱まで添わる）。
    title: `${record.disambiguatedName}（${dynastyContextLabel(record)}）`,
    description: descriptionOf(id, record),
  });
}

export default async function EmperorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const events = getEmperorEvents(id);
  const records = getAllEmperorRecords();
  const index = records.findIndex((r) => r.id === id);
  const record = records[index];
  const narrative = getEmperorNarrative(id);
  const profile = getEmperorProfile(id);
  // 収録順（おおむね時代順）の前後の皇帝。端では表示しない。
  const prev = index > 0 ? records[index - 1] : null;
  const next = index < records.length - 1 ? records[index + 1] : null;
  // 同王朝の皇帝数。2名以上のときだけ王朝で絞った一覧への横リンクを出す
  // （1名の王朝＝自分だけの一覧に飛ばしても回遊にならない）。
  const dynastyPeerCount = records.filter(
    (r) => r.dynastyKey === record.dynastyKey,
  ).length;
  const structuredDates = getEmperorStructuredDates(id);
  // 別名（alternateName）。**名前ブロックと同じ行から作る** — 表示名は括弧を
  // 落としているので、昌邑王（爵位）・孝元帝（別諡号）・明清の廟号はここにしか残らない。
  // 合成前の原文（「太祖（洪武帝）」）は誰も名前として使わないので入れない。
  // record.name との重複と空値は personJsonLd 側で除く。
  const alternateName = [
    ...new Set([
      ...emperorNameEntries(record).map((e) => e.value),
      ...record.aliases,
    ]),
  ];

  return (
    <>
      <JsonLd
        data={personJsonLd({
          name: record.disambiguatedName,
          alternateName,
          url: absoluteUrl(`/emperors/${id}`),
          description:
            profile?.description ??
            `${dynastyContextLabel(record)}の皇帝。在位${record.periodsLabel}（${record.reignDurationLabel}）。`,
          image: record.portraitUrl ? absoluteUrl(record.portraitUrl) : undefined,
          birthDate: structuredDates.birthDate ?? undefined,
          deathDate: structuredDates.deathDate ?? undefined,
          // sameAsは目視確認済みQID由来のWikidata URLのみ。記事名からの
          // 機械生成URL（jawiki等）は誤リンクの恐れがあるため渡さない。
          sameAs: record.wikidataId
            ? [`https://www.wikidata.org/wiki/${record.wikidataId}`]
            : undefined,
        })}
      />
      <JsonLd
        // **可視のパンくず（emperor-hero.tsx の Breadcrumb）と同じ段数にすること。**
        // 画面に出ている階層と構造化データが食い違うのは Google の推奨から外れる。
        // 王朝の項はクエリ付きの一覧URL（絞り込み状態を復元する先）を指す。
        data={breadcrumbJsonLd([
          { name: SITE_NAME, url: absoluteUrl("/") },
          { name: "皇帝一覧", url: absoluteUrl("/emperors") },
          ...(dynastyPeerCount >= 2
            ? [
                {
                  name: `${record.dynastyLabel}（${dynastyPeerCount}名）`,
                  url: absoluteUrl(
                    `/emperors?dynasty=${encodeURIComponent(record.dynastyKey)}`,
                  ),
                },
              ]
            : []),
          // 最終項だけ `disambiguatedName`（可視のパンくずは h1 と同じ `record.name`）。
          // 機械可読側は他ページの JSON-LD・`<title>` と同じく人物を一意に指す必要があり、
          // 通用名は37種104人で重複するため。**段数と王朝の項の出し方は可視と必ず同じに保つ。**
          { name: record.disambiguatedName, url: absoluteUrl(`/emperors/${id}`) },
        ])}
      />
      <EmperorHero
        record={record}
        lead={profile?.lead}
        dynastyPeerCount={dynastyPeerCount}
        prev={prev}
        next={next}
      />
      <div className="px-gutter py-section md:px-gutter-wide">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
          {/* ②紹介文（Issue #16）。**365人中まだ大半が未執筆**なので、無い皇帝では
              節ごと出ない。ページで唯一の16pxの文＝ここが「読ませる」文であることを
              級数で示す（他の本文は14px）。 */}
          {/* 「人物紹介」節（Issue #16 の body）。ヒーローには導入（lead）だけを置き、
              逸話を含む本文はここ — **ページを開いた時点で文章だけで埋まるのを避ける**
              ため（2026-08-01 ユーザー指示）。段落の区切りは空行、行送りは leading-ruby。 */}
          {profile?.body && (
            <section className="space-y-2">
              <h2 className="font-heading text-base font-semibold text-foreground">
                人物紹介
              </h2>
              <div className="space-y-4">
                {profile.body.split("\n\n").map((paragraph, i) => (
                  <p
                    key={i}
                    className="text-base leading-ruby text-foreground"
                  >
                    <RubyText source={paragraph} />
                  </p>
                ))}
              </div>
            </section>
          )}
          <EmperorFacts record={record} />
          <EmperorNarrativeSections narrative={narrative} />
          {events.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-heading text-base font-semibold text-foreground">
                在位中の出来事（{events.length}件）
              </h2>
              <p className="text-xs leading-relaxed text-muted-foreground">
                改元・大赦・立后・皇太子廃立・親征・被反乱・遷都の7項目で確認した出来事を日付順に並べています。日付は史料の記述の細かさに応じて年・月・日で表示し、西暦に換算できていないもの（元号表記のまま）と日付不詳のものは末尾にまとめています。
              </p>
              <EmperorEventTimeline rows={events} />
            </section>
          )}
          {/* 関連動画は外部チャンネルの制作物なので、本文（経緯・出来事）より後ろ。 */}
          <EmperorVideosSection record={record} />
          <nav
            aria-label="前後の皇帝"
            className="mt-2 flex justify-between gap-4 border-t border-border pt-4 text-sm"
          >
            {prev ? (
              <Link
                href={`/emperors/${prev.id}`}
                className="group inline-flex min-w-0 items-center gap-1.5 hover:text-seal"
              >
                <ChevronLeft
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground group-hover:text-seal"
                />
                <span className="min-w-0">
                  <span className="block truncate">{prev.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {prev.dynastyLabel}
                  </span>
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/emperors/${next.id}`}
                className="group inline-flex min-w-0 items-center gap-1.5 text-right hover:text-seal"
              >
                <span className="min-w-0">
                  <span className="block truncate">{next.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {next.dynastyLabel}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground group-hover:text-seal"
                />
              </Link>
            ) : (
              <span />
            )}
          </nav>
          {/* 下層の統計ページへの導線は 2026-07-31 の廃止で行き先が無くなったため外した。
              残っているのは /about（収録基準）と /emperors（一覧）の2つ。 */}
          <p className="text-xs text-muted-foreground">
            収録基準・各項目の数え方・出典は
            <Link href="/about" className="underline underline-offset-2 hover:text-seal">
              このサイトについて
            </Link>
            を、ほかの皇帝は
            <Link href="/emperors" className="underline underline-offset-2 hover:text-seal">
              皇帝一覧
            </Link>
            をご覧ください。
          </p>
        </div>
      </div>
    </>
  );
}
