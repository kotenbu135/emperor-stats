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
import { getAllEmperorRecords } from "@/lib/emperors";

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
        title={record.name}
        description={`${dynastyContextLabel(record)}｜在位 ${record.periodsLabel}`}
      />
      <div className="px-6 py-8 md:px-10">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <p className="text-sm">
            <Link
              href="/emperors"
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-seal"
            >
              <ArrowLeft aria-hidden className="size-3.5" />
              皇帝一覧へ戻る
            </Link>
          </p>
          <EmperorDetailBody record={record} />
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
