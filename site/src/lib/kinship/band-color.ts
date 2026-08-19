// 系譜図のカード下帯の政権色。**サーバー（凡例）とクライアント（カード）の両方から
// 引くので、"use client" のファイルには置かない**（client の関数は Server Component から
// 呼べず、ビルドが prerender で落ちる）。
import { DYNASTY_COLOR_SLOT } from "@/lib/dynasty-colors";

/**
 * 政権 → カード下帯の塗り。スロット0（群雄・並立政権）は無彩色。
 *
 * **`--kinship-minor` は返さない。** あれは白文字が乗る明度ではない（2.58:1）。
 * スロット0にも同じ 5.2:1 で作った `--kinship-band-0` を割り当ててある。
 *
 * **`--series-N` ではなく `--kinship-band-N`** を返す。前者は白文字が乗る明度ではない
 * （`--series-4` は白文字とのコントラストが 2.17）。値の作り方は globals.css の
 * 該当節と `tools/calc-kinship-bands.mjs`。
 */
export function regimeBandColor(regimeId: string | null): string {
  if (!regimeId) return "var(--kinship-band-0)";
  const slot = DYNASTY_COLOR_SLOT[regimeId];
  if (slot === undefined) return "var(--kinship-band-0)";
  return `var(--kinship-band-${slot})`;
}
