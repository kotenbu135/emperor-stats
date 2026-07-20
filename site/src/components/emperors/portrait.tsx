"use client";

// 皇帝の肖像表示（一覧カード・詳細ダイアログで共用）。肖像がない皇帝は
// 姓一文字のモノグラムをプレースホルダー表示する。

import Image from "next/image";
import type { EmperorRecord } from "@/lib/emperor-types";

/** モノグラムに使う一文字。姓（諱の頭文字）を優先し、なければ通称の頭文字を使う。 */
function monogramChar(record: EmperorRecord): string {
  return (record.personalName ?? record.name).charAt(0);
}

/** 肖像がない皇帝のプレースホルダー（姓一文字を大きく淡く表示）。 */
function Monogram({ char, large = false }: { char: string; large?: boolean }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-secondary">
      <span
        className={`select-none font-heading font-semibold text-muted-foreground/50 ${
          large ? "text-6xl" : "text-4xl"
        }`}
      >
        {char}
      </span>
    </div>
  );
}

export function Portrait({
  record,
  sizes,
  large = false,
  priority = false,
}: {
  record: EmperorRecord;
  sizes: string;
  large?: boolean;
  /** ファーストビューのカードで指定する。既定のloading="lazy"だと先頭カードの
   *  肖像がLCP要素なのに読み込みが後回しになりLCPが大幅に悪化する
   *  （LAYOUT.mdのLighthouse計測記録）。 */
  priority?: boolean;
}) {
  if (!record.portraitUrl) return <Monogram char={monogramChar(record)} large={large} />;
  return (
    <Image
      src={record.portraitUrl}
      alt={`${record.name}の肖像`}
      fill
      sizes={sizes}
      priority={priority}
      className="object-cover object-top"
    />
  );
}
