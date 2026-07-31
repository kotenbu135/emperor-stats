"use client";

// 皇帝の肖像表示（一覧カード・詳細ダイアログで共用）。肖像がない皇帝は
// 姓一文字のモノグラムをプレースホルダー表示する。
// images.unoptimized の next/image は srcset を出さず常に360pxフルを配信して
// しまうため、sync-portraits.mjs が生成する320pxサムネ（/portraits/thumb/）と
// 併記した srcset 付きの素の<img>で出し分ける（1x表示・ダイアログの小サイズ
// 表示はサムネ側が選ばれ、一覧150枚超の転送量が減る）。

import {
  dynastyColorHex,
  dynastyColorMix,
  dynastyColorSlot,
  readableTextOn,
} from "@/lib/dynasty-colors";
import type { EmperorRecord } from "@/lib/emperor-types";

/** モノグラム下地の濃度。王朝色の濃度は「面積の大きい帯ほど濃く、文字を載せる下地ほど
 *  淡く」の順に 55（ランキングの塗り）> 42（年表・系譜の帯）> この段、と並ぶ。
 *  22% では肖像ありのカードとの明度差が大きすぎて読み込み中の枠に見えたため 38% へ上げた
 *  （下地がカードのほぼ全面を占めるので、文字だけ濃くしてもカードの明度は動かない）。
 *  全9スロットで墨とのコントラスト比が 5.5:1 以上残る範囲の値（最暗の紫 --series-7 が
 *  5.58:1、4.5:1 を割るのは 48% から）。 */
const MONOGRAM_MIX = 38;

/** 肖像表示に必要な最小フィールド（一覧の軽量レコード・フルレコードの両方が満たす）。 */
type PortraitSubject = Pick<
  EmperorRecord,
  "name" | "personalName" | "portraitUrl" | "dynastyKey"
>;

/** モノグラムに使う一文字。姓（諱の頭文字）を優先し、なければ通称の頭文字を使う。 */
function monogramChar(record: PortraitSubject): string {
  return (record.personalName ?? record.name).charAt(0);
}

/** 肖像がない皇帝のプレースホルダー（姓一文字を大きく表示）。
 *  背景はその皇帝の王朝色を地色に混ぜた淡彩で、同じ時代見出しの下のカードが
 *  まとまって見えるようにする。
 *  ⚠️ 混色の相手（dynasty-colors.ts の SURFACE_HEX）と王朝色の実値が現行パレットに
 *  追従していない。皇帝一覧の改修で揃える（design-plans/SITE_PLAN.md §7）。 */
function Monogram({
  char,
  dynastyKey,
  large = false,
}: {
  char: string;
  dynastyKey: string;
  large?: boolean;
}) {
  const slot = dynastyColorSlot(dynastyKey);
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{
        backgroundColor: dynastyColorMix(slot, MONOGRAM_MIX),
        // 文字色は下地の混色後の実値からコントラスト比で選ぶ（塗りの上に文字を載せる
        // 面の共通規則）。dynastyColorHex は color-mix(in srgb, …) と同じ補間なので、
        // 上の背景と同じ値を判定に使える。
        color: readableTextOn(dynastyColorHex(slot, MONOGRAM_MIX)),
      }}
    >
      <span
        className={`select-none font-heading font-semibold ${
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
    return (
      <Monogram
        char={monogramChar(record)}
        dynastyKey={record.dynastyKey}
        large={large}
      />
    );
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
