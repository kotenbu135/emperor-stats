"use client";

// 皇帝の肖像表示（一覧カード・詳細ダイアログで共用）。肖像がない皇帝は
// 姓一文字のモノグラムをプレースホルダー表示する。
// images.unoptimized の next/image は srcset を出さず常に360pxフルを配信して
// しまうため、sync-portraits.mjs が生成する320pxサムネ（/portraits/thumb/）と
// 併記した srcset 付きの素の<img>で出し分ける（1x表示・ダイアログの小サイズ
// 表示はサムネ側が選ばれ、一覧150枚超の転送量が減る）。

import type { EmperorRecord } from "@/lib/emperor-types";

/** 肖像表示に必要な最小フィールド（一覧の軽量レコード・フルレコードの両方が満たす）。 */
type PortraitSubject = Pick<
  EmperorRecord,
  "name" | "personalName" | "portraitUrl"
>;

/** モノグラムに使う一文字。姓（諱の頭文字）を優先し、なければ通称の頭文字を使う。 */
function monogramChar(record: PortraitSubject): string {
  return (record.personalName ?? record.name).charAt(0);
}

/**
 * 肖像がない皇帝のプレースホルダー（姓一文字を大きく表示）。
 *
 * **下地は無彩色**（2026-07-31 ユーザー決定・SITE_PLAN の「7. 皇帝一覧」節）。
 * 2026-07-31 まではその皇帝の王朝色（`--series-1〜8`）を地に38%混ぜた淡彩だったが、
 * 一覧365枚のうち**215枚（59%）が肖像なし**で、時代によっては面の8割がこの淡彩になる
 * （五胡十六国84%・南北朝78%）。さらにこの下地が担っていた2つの符号は、
 * どちらも同じカードの文字と重複していた — 色＝王朝は2行目の `dynastyLabel` が、
 * 字＝姓は1行目の諱が既に出している。`--series-1〜8` は図で系列を見分けるための
 * カテゴリ識別色で、面の59%に敷く下地の役ではない。
 *
 * 王朝の識別は**カードの文字列の左に立てる細い印**（`emperor-grid.tsx` の
 * `DynastyMark`）へ移した。そちらは肖像の有無にかかわらず全365枚に出る。
 *
 * 文字は `--muted-foreground`（`--muted` の上でコントラスト 4.35:1）。淡彩をやめた分
 * 「読み込み中の枠」に見えないかは実物で確認すること（38%という値自体、22%では
 * 読み込み中に見えるという指摘を受けて上げた経緯がある）。
 */
function Monogram({ char, large = false }: { char: string; large?: boolean }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <span
        className={`select-none font-heading font-semibold text-muted-foreground ${
          large ? "text-6xl" : "text-4xl"
        }`}
      >
        {char}
      </span>
    </div>
  );
}

/** sync-portraits.mjs の出力配置（/portraits/{id}.webp と /portraits/thumb/{id}.webp）
 *  に依存してフルURLから320pxサムネのURLを導出する。 */
export function portraitThumbUrl(portraitUrl: string): string {
  return portraitUrl.replace("/portraits/", "/portraits/thumb/");
}

export function Portrait({
  record,
  sizes,
  large = false,
  priority = false,
}: {
  record: PortraitSubject;
  sizes: string;
  large?: boolean;
  /** ファーストビューのカードで指定する。既定のloading="lazy"だと先頭カードの
   *  肖像がLCP要素なのに読み込みが後回しになりLCPが大幅に悪化する
   *  （PERFORMANCE.mdのLighthouse計測記録）。 */
  priority?: boolean;
}) {
  if (!record.portraitUrl)
    return <Monogram char={monogramChar(record)} large={large} />;
  return (
    // unoptimized の next/image は srcset を出せない（カスタム srcSet 指定も不可）
    // ため、静的2サイズを自前 srcset で出す。
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={record.portraitUrl}
      srcSet={`${portraitThumbUrl(record.portraitUrl)} 320w, ${record.portraitUrl} 360w`}
      alt={`${record.name}の肖像`}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover object-top"
    />
  );
}
