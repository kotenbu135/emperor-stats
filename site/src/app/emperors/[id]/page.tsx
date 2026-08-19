// 皇帝個別ページ（365ページ・静的書き出し）。
//
// 2026-08-01 に「ヒーロー＋盤面＋読み物」へ組み直した（EMPEROR_PAGE_PLAN_2026-08-01.md）。
// それまでは詳細ダイアログと表示本体（emperor-detail-body.tsx）を共用する
// deep-link 先で、先頭は名前1行・肖像は基本情報の脇の144px枠だった。
// ダイアログの廃止で共用相手が消えたため、部品ごと個別ページ専用に割り直してある。
//
// 節の並び: ①ヒーロー ②紹介文 ③基本情報＋回数 ④出典 ⑤在位中の出来事
// ⑥関連動画・前後ナビ。
//
// 2026-08-02 に末尾の「在位日付の典拠」「調査メモ」（畳んだ2節）を、2026-08-03 に
// ④の経緯3節（即位・死因・復位）を廃止した。根拠は配布データ（data/emperors.json）に
// 同じものが入っている。
//
// 2026-08-05（Issue #75）に④の位置へ「出典」を置いた。**戻したのは書名・巻
// （source.page）だけ**で、note と原文引用は配布データ側のまま。/about の運営者の節が
// 「調査メモと原文引用は画面に出していない」と線引きしているので、出す範囲を広げる
// ときはその文と対で動かすこと。

import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EmperorHero } from "@/components/emperors/emperor-hero";
import { EmperorFacts } from "@/components/emperors/emperor-facts";
import { EmperorVideosSection } from "@/components/emperors/emperor-videos";
import { EmperorEventTimeline } from "@/components/emperors/emperor-event-timeline";
import { EmperorSources } from "@/components/emperors/emperor-sources";
import { NextUp } from "@/components/layout/next-up";
import { RubyText } from "@/components/ui/ruby-text";
import { databaseFilterHref } from "@/lib/emperor-types";
import {
  dynastyContextLabel,
  getAllEmperorRecords,
  getEmperorEvents,
  getEmperorProfile,
  getEmperorSources,
  getEmperorStructuredDates,
} from "@/lib/emperors";
import { reportReadingCoverage } from "@/lib/name-readings";
import { kinshipDisplayNames } from "@/app/kinship/chapters";
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
      // 民族名も名前チップとして画面に出る（rubyOf を通る）ので残件に数える。
      r.ethnicName?.value ?? "",
      r.templeName ?? "",
      r.posthumousName ?? "",
      r.dynastyLabel,
      r.eraLabel,
    ]).concat(
      // 系譜図のカードに出る名前（親族名は emperors.json に無い）も同じ帳面に載せる。
      kinshipDisplayNames(),
    ),
  );
  return records.map((r) => ({ id: r.id }));
}

/**
 * 紹介文（Issue #16）があればそれを description に使う。
 * 無い皇帝は従来の機械生成文（365ページとも同型で人物ごとの差がほぼ無い）に落ちる。
 *
 * 機械生成文には**在位年数の順位と死因ラベルを織り込む**（Issue #78）。可変部が
 * 王朝名・名前・在位年だけだと365ページで枠が完全に固定され、スニペットの
 * 多様性で不利になる。**足すのはページに既に出ている値だけ**（順位は回数の表、
 * 死因は基本情報の行。どちらも OGP チップ `getEmperorOgChips` と同じ材料）で、
 * ここで新しい主張を作らない。順位は 0 回を除いた母数で数えるため
 * `total` を直に書き（365 と決め打たない）、順位なしの指標では句ごと落とす。
 */
function descriptionOf(id: string, record: ReturnType<typeof getAllEmperorRecords>[number]): string {
  const reignRank = record.ranks.reignYears;
  const rankPhrase = reignRank
    ? `で在位年数は${reignRank.total}名中${reignRank.rank}位`
    : "";
  return (
    getEmperorProfile(id)?.description ??
    `${dynastyContextLabel(record)}の皇帝 ${record.disambiguatedName} の調査結果。在位${record.periodsLabel}（${record.reignDurationLabel}）${rankPhrase}、死因は${record.deathCauseCategory}。即位経路・改元回数など全12項目を掲載しています。`
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
  const profile = getEmperorProfile(id);
  // 収録順（おおむね時代順）の前後の皇帝。端では表示しない。
  const prev = index > 0 ? records[index - 1] : null;
  const next = index < records.length - 1 ? records[index + 1] : null;
  // 同王朝の皇帝数。2名以上のときだけ王朝で絞った一覧への横リンクを出す
  // （1名の王朝＝自分だけの一覧に飛ばしても回遊にならない）。
  const dynastyPeerCount = records.filter(
    (r) => r.dynastyKey === record.dynastyKey,
  ).length;
  // ⑦「次に見る」3枚（2026-08-17・Issue #94 の案4）の件数。
  // **/database の絞り込みと同じ母集団・同じフィールドで数えること** — 表側の
  // EmperorTableRecord は EmperorRecord の同名フィールドをそのまま写している
  // （emperors.ts の getEmperorTableRecords）ので、ここを別の集計に差し替えると
  // 「162名」と書いたカードが161名の一覧へ着地する。機械で見るゲートは無い。
  const deathPeerCount = records.filter(
    (r) => r.deathCauseCategory === record.deathCauseCategory,
  ).length;
  const accessionPeerCount = records.filter(
    (r) => r.accessionRouteCategory === record.accessionRouteCategory,
  ).length;
  const structuredDates = getEmperorStructuredDates(id);
  const sources = getEmperorSources(id);
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
              {/* 節見出しは行頭 `## `（2026-08-04 の文体変更）。空行で区切った塊の
                  うち、この形のものだけ h3 にする。**判定の形は
                  ../scripts/validate_profiles.py の HEADING と同じ**で、
                  片方だけ変えると n-gram の除外と表示がずれる。
                  見出しは h2「人物紹介」の下なので h3。ルビが乗るので
                  行送りは本文と同じ leading-ruby。 */}
              <div className="space-y-4">
                {profile.body.split("\n\n").map((block, i) =>
                  block.startsWith("## ") ? (
                    <h3
                      key={i}
                      className="pt-2 font-heading text-base font-semibold leading-ruby text-foreground"
                    >
                      <RubyText source={block.slice(3)} />
                    </h3>
                  ) : (
                    <p
                      key={i}
                      className="text-base leading-ruby text-foreground"
                    >
                      <RubyText source={block} />
                    </p>
                  ),
                )}
              </div>
            </section>
          )}
          <EmperorFacts record={record} />
          {/* ④出典（Issue #75）。基本情報の「死因」「即位経路」の直後に置く
              — この2行の判定根拠なので、離すと値と出典が結び付かない。 */}
          <EmperorSources entries={sources} />
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
          {/* ⑦「次に見る」（2026-08-17・Issue #94 の案4）。前後ナビより**上**に置く —
              前後ナビは収録順の隣どうしを結ぶ細かい移動で、フッターに接した位置で
              実測済み（そこは動かさない）。3枚とも 2026-08-17 に入れた /database の
              ファセット（Issue #94 の判断2）に乗っている。 */}
          <NextUp
            items={[
              {
                title: "同じ死因の皇帝",
                description: `「${record.deathCauseCategory}」の${deathPeerCount}名をデータベースで見る`,
                href: databaseFilterHref({ death: record.deathCauseCategory }),
              },
              {
                title: "同じ即位経路の皇帝",
                description: `「${record.accessionRouteCategory}」の${accessionPeerCount}名をデータベースで見る`,
                href: databaseFilterHref({
                  accession: record.accessionRouteCategory,
                }),
              },
              // 王朝で絞った一覧は自分1人になることがあるので、そのときだけ全員の
              // 一覧へ落とす（パンくずの王朝の項を出す条件と同じ 2名以上）。
              dynastyPeerCount >= 2
                ? {
                    title: "同じ王朝の皇帝",
                    description: `「${record.dynastyLabel}」の${dynastyPeerCount}名を皇帝一覧で見る`,
                    href: `/emperors?dynasty=${encodeURIComponent(record.dynastyKey)}`,
                  }
                : {
                    title: "皇帝一覧",
                    description: `${records.length}名を肖像つきのカードで見る`,
                    href: "/emperors",
                  },
            ]}
          />
          <nav
            aria-label="前後の皇帝"
            className="mt-2 flex justify-between gap-4 border-t border-border pt-4 text-sm"
          >
            {prev ? (
              <Link
                href={`/emperors/${prev.id}`}
                className="group inline-flex min-w-0 items-center gap-1.5 hover:text-seal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal"
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
                className="group inline-flex min-w-0 items-center gap-1.5 text-right hover:text-seal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal"
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
            <Link
              href="/about"
              className="underline underline-offset-2 hover:text-seal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal"
            >
              このサイトについて
            </Link>
            を、ほかの皇帝は
            <Link
              href="/emperors"
              className="underline underline-offset-2 hover:text-seal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal"
            >
              皇帝一覧
            </Link>
            をご覧ください。
          </p>
        </div>
      </div>
    </>
  );
}
