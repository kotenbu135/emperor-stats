// 皇帝個別ページ（deep-link先）。詳細ダイアログと同じ内容を固定URLで共有できる
// 静的ページとして全収録皇帝分を書き出す。表示本体はemperor-detail-body.tsx（共用）。

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  EmperorDetailBody,
  dynastyContextLabel,
} from "@/components/emperors/emperor-detail-body";
import { EmperorNarrativeSections } from "@/components/emperors/emperor-narrative";
import { EmperorEventTimeline } from "@/components/emperors/emperor-event-timeline";
import {
  getAllEmperorRecords,
  getEmperorEvents,
  getEmperorNarrative,
} from "@/lib/emperors";

// output: "export"では全パスをビルド時に列挙する（365ページ）。列挙外のidは404。
export const dynamicParams = false;

export function generateStaticParams(): { id: string }[] {
  return getAllEmperorRecords().map((r) => ({ id: r.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const record = getAllEmperorRecords().find((r) => r.id === id)!;
  return {
    title: `${record.name}（${dynastyContextLabel(record)}） | 中国皇帝統計`,
    description: `${dynastyContextLabel(record)}の皇帝 ${record.name} の調査結果。在位${record.periodsLabel}（${record.reignDurationLabel}）、死因・即位経路・改元回数など全12項目と全皇帝中の順位を掲載しています。`,
  };
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
  // 収録順（おおむね時代順）の前後の皇帝。端では表示しない。
  const prev = index > 0 ? records[index - 1] : null;
  const next = index < records.length - 1 ? records[index + 1] : null;

  return (
    <>
      <PageHeader
        contained
        containedWidth="max-w-4xl"
        title={record.name}
        description={`${dynastyContextLabel(record)}｜在位 ${record.periodsLabel}`}
      />
      <div className="px-6 py-8 md:px-10">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          {/* ページ送りは本文の長さに左右されない先頭右端の固定サイズボタンに
              置く（ページごとに位置がずれると連続で押せない）。皇帝名付きの
              リンクは本文末尾のnavに残す。 */}
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm">
              <Link
                href="/emperors"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-seal"
              >
                <ArrowLeft aria-hidden className="size-3.5" />
                皇帝一覧へ戻る
              </Link>
            </p>
            <nav aria-label="前後の皇帝（ページ送り）" className="flex items-center gap-1.5">
              {prev ? (
                <Link
                  href={`/emperors/${prev.id}`}
                  title={`前の皇帝: ${prev.name}（${prev.dynastyLabel}）`}
                  aria-label={`前の皇帝: ${prev.name}`}
                  className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-seal/50 hover:text-seal"
                >
                  <ChevronLeft aria-hidden className="size-4" />
                </Link>
              ) : (
                <span
                  aria-hidden
                  className="inline-flex size-8 items-center justify-center rounded-md border border-border/40 text-border"
                >
                  <ChevronLeft className="size-4" />
                </span>
              )}
              {next ? (
                <Link
                  href={`/emperors/${next.id}`}
                  title={`次の皇帝: ${next.name}（${next.dynastyLabel}）`}
                  aria-label={`次の皇帝: ${next.name}`}
                  className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-seal/50 hover:text-seal"
                >
                  <ChevronRight aria-hidden className="size-4" />
                </Link>
              ) : (
                <span
                  aria-hidden
                  className="inline-flex size-8 items-center justify-center rounded-md border border-border/40 text-border"
                >
                  <ChevronRight className="size-4" />
                </span>
              )}
            </nav>
          </div>
          <EmperorDetailBody record={record} wide />
          {/* 経緯・調査メモは個別ページ限定（詳細ダイアログには出さない）。
              静的書き出しなのでnote全文を載せてもクライアント負荷はない。 */}
          <EmperorNarrativeSections narrative={getEmperorNarrative(id)} />
          {events.length > 0 && (
            <section className="mt-2 space-y-2 border-t border-border pt-5">
              <h3 className="font-heading text-sm font-semibold text-foreground">
                在位中の出来事（{events.length}件）
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                改元・大赦・立后・皇太子廃立・親征・反乱鎮圧・被反乱・遷都の8項目で確認した出来事を日付順に並べています。日付は史料の記述の細かさに応じて年・月・日で表示し、西暦に換算できていないもの（元号表記のまま）と日付不詳のものは末尾にまとめています。行を開くと調査時の記録と出典が読めます。
              </p>
              <EmperorEventTimeline rows={events} />
            </section>
          )}
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
          <p className="text-xs text-muted-foreground">
            収録基準・各項目の数え方・出典は
            <Link href="/about" className="underline underline-offset-2 hover:text-seal">
              このサイトについて
            </Link>
            を、時代の中での位置は
            <Link href="/timeline" className="underline underline-offset-2 hover:text-seal">
              通史年表
            </Link>
            をご覧ください。
          </p>
        </div>
      </div>
    </>
  );
}
