// 王朝 → 配色スロットの単一情報源。
//
// このサイトの主要な軸である「王朝」を色で表す。割り当ては意味ベース
// （漢系=4金・北族=1青・晋系=7紫・宋=2緑・明=8赤・隋/梁系=5青緑）で、
// 並立政権・反乱/自称政権はスロット0（--kinship-minor・無彩色）に落とす。
//
// スロット0は --kinship-minor（無彩色）。ここに落ちる37王朝は全て政権の性格
// （スキーマ v3 の `catalogs.regimes[].category`）が「並立政権」または
// 「反乱・自称政権」で、正統王朝は1つも含まれない（逆は成り立たない——十六国・西夏・
// 遼系のように政権ごとの識別色を持たせている非正統政権が15キーある）。
//
// 皇帝を追加収録したら必ずこの表に追記すること（未知のキーは throw する）。
export const DYNASTY_COLOR_SLOT: Record<string, number> = {
  // 無彩色 --kinship-minor（群雄・並立政権）
  燕__唐: 0,
  南漢__五代十国: 0,
  閩__五代十国: 0,
  北漢__五代十国: 0,
  "秦（西秦）__隋末群雄": 0,
  楚__隋末群雄: 0,
  梁__隋末群雄: 0,
  前蜀__五代十国: 0,
  後蜀__五代十国: 0,
  南唐__五代十国: 0,
  陳漢__元: 0,
  夏__元: 0,
  呉周__清: 0,
  "漢（赤眉軍）__漢（赤眉軍）": 0,
  成家__成家: 0,
  仲家__仲家: 0,
  前涼__前涼: 0,
  "楚（桓楚）__楚": 0,
  "梁（簒奪・漢）__南朝": 0,
  定楊__隋末群雄: 0,
  許__隋末群雄: 0,
  涼__隋末群雄: 0,
  鄭__隋末群雄: 0,
  呉__隋末群雄: 0,
  宋__隋末群雄: 0,
  "秦（漢）__唐": 0,
  楚__唐: 0,
  斉__唐: 0,
  桀燕__五代十国: 0,
  呉__五代十国: 0,
  楚__宋遼西夏金: 0,
  斉__宋遼西夏金: 0,
  天完__元: 0,
  宋__元: 0,
  順__明: 0,
  西__明: 0,
  中華帝国__清: 0,
  // 青 --series-1（北族系）
  北魏__北朝: 1,
  元__元: 1,
  清__清: 1,
  遼__宋遼西夏金: 1,
  魏__三国時代: 1,
  "前趙（漢趙）__前趙": 1,
  西遼__宋遼西夏金: 1,
  南燕__南燕: 1,
  新__新: 1,
  北元__元: 1,
  // 緑 --series-2（宋系）
  宋__南朝: 2,
  北宋__宋遼西夏金: 2,
  南宋__宋遼西夏金: 2,
  北斉__北朝: 2,
  呉__三国時代: 2,
  前燕__前燕: 2,
  // 桃 --series-3
  西燕__西燕: 3,
  夏__夏: 3,
  後梁__南朝: 3,
  周__唐: 3,
  // 金 --series-4（漢系）
  唐__唐: 4,
  "前漢__秦（始皇帝以降）": 4,
  後漢__後漢: 4,
  梁__南朝: 4,
  前秦__前秦: 4,
  蜀漢__三国時代: 4,
  "玄漢（更始）__新": 4,
  梁__梁: 4,
  // 青緑 --series-5（隋／南朝梁系）
  西夏__宋遼西夏金: 5,
  後燕__後燕: 5,
  成漢__成漢: 5,
  陳__南朝: 5,
  隋__隋: 5,
  北周__北朝: 5,
  // 橙 --series-6
  斉__南朝: 6,
  後唐__五代十国: 6,
  後秦__後秦: 6,
  後梁__五代十国: 6,
  後周__五代十国: 6,
  後晋__五代十国: 6,
  後漢__五代十国: 6,
  // 紫 --series-7（晋系）
  東晋__晋: 7,
  金__宋遼西夏金: 7,
  西晋__晋: 7,
  東魏__北朝: 7,
  // 赤 --series-8
  明__明: 8,
  後趙__後趙: 8,
  南明__明: 8,
  西魏__北朝: 8,
  "秦__秦（始皇帝以降）": 8,
};

/**
 * スロット→実色。CSS 変数を解決できない箇所（Nivo・混色計算）があるためハードコードしている。
 *
 * **スロット番号は `--series-N` の N ではない。** 王朝の性格に色を当てる意味ベースの割り当て
 * （`DYNASTY_COLOR_SLOT` のコメント参照）で、右に書いてあるのが対応する globals.css のトークン。
 * 色を足す・入れ替えるときは、番号ではなく意味の側から決めること。
 */
const SLOT_HEX = [
  "#a1a1a1", // 0: 割拠政権（無彩色・--kinship-minor 相当）
  "#2a78d6", // 1: 青 — 北族系（--series-1）
  "#008300", // 2: 緑 — 宋系（--series-6）
  "#e87ba4", // 3: 桃（--series-5）
  "#eda100", // 4: 金 — 漢系（--series-4）
  "#1baf7a", // 5: 青緑 — 隋／南朝梁系（--series-3）
  "#eb6834", // 6: 橙（--series-2）
  "#4a3aa7", // 7: 紫 — 晋系（--series-7）
  "#e34948", // 8: 赤 — 明（--series-8）
] as const;

/** 地色（globals.css の --background を sRGB へ換算した実値）。混色の相手。 */
export const SURFACE_HEX = "#ffffff";
/** 文字色（--foreground の実値）。 */
const INK_HEX = "#0a0a0a";

/**
 * 塗りの濃度。--series-1〜8 は識別性を優先して検証した値のため彩度が高く、地に
 * 生のまま塗るとクロームから浮く。「地色に混ぜてから塗る」規則を、
 * 面積に応じた比率で適用する。
 */
export const DYNASTY_FILL_MIX = 55;
/** 塗りより一段濃い輪郭で形を締める。 */
export const DYNASTY_EDGE_MIX = 82;
/* 肖像なしカードのモノグラム背景の濃度は、肖像ありのカードとの明度差から決めるため
 * components/emperors/portrait.tsx のローカル定数（MONOGRAM_MIX）が持つ。 */

/** dynastyKey（`name__section`）→ スロット。未知のキーは throw する
 *  （皇帝を追加収録したときに気づけるようにする。eraLabelOf の既存方式に揃える）。 */
export function dynastyColorSlot(dynastyKey: string): number {
  const slot = DYNASTY_COLOR_SLOT[dynastyKey];
  if (slot === undefined) {
    throw new Error(
      `dynasty-colors: 未割当のdynastyKeyがあります: "${dynastyKey}"（新規収録時は DYNASTY_COLOR_SLOT に追記してください）`,
    );
  }
  return slot;
}

/** スロット→CSS変数参照。CSSで色を指定できる面（モノグラム等）で使う。 */
export function dynastyColorVar(slot: number): string {
  return slot === 0 ? "var(--kinship-minor)" : `var(--series-${slot})`;
}

/** スロット→CSSの color-mix 式。style.ts と同じく地色に混ぜた濃度を返す。 */
export function dynastyColorMix(slot: number, percent: number): string {
  return `color-mix(in srgb, ${dynastyColorVar(slot)} ${percent}%, var(--background))`;
}

function parseHex(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

const toHex = (v: number) => Math.round(v).toString(16).padStart(2, "0");

/**
 * `color-mix(in srgb, fg P%, bg)` と同じ結果を返す。CSS Color 4 の `in srgb` は
 * ガンマ補正済みの sRGB 値をそのまま補間するため、0〜255 のチャンネルごとの
 * 線形補間で一致する（線形光空間で混ぜると値がずれ、CSS 側で塗った面と
 * Nivo に渡す面の濃度感が食い違う）。
 */
export function mixHex(hex: string, percent: number, onto = SURFACE_HEX): string {
  const [r1, g1, b1] = parseHex(hex);
  const [r2, g2, b2] = parseHex(onto);
  const t = percent / 100;
  return `#${toHex(r1 * t + r2 * (1 - t))}${toHex(g1 * t + g2 * (1 - t))}${toHex(
    b1 * t + b2 * (1 - t),
  )}`;
}

/** スロット→地色と混ぜた16進値。Nivo に渡す色はすべてこれを通す。
 *  範囲外のスロットは throw する（`DYNASTY_COLOR_SLOT` は `Record<string, number>` で
 *  0〜8 を型で縛れないため、追記時の書き間違いが黙って藤色になるのを防ぐ）。 */
export function dynastyColorHex(slot: number, percent: number): string {
  const hex = SLOT_HEX[slot];
  if (hex === undefined) {
    throw new Error(
      `dynasty-colors: 配色スロットは0〜8です（受け取った値: ${slot}）`,
    );
  }
  return mixHex(hex, percent);
}

/** dynastyKey から直接、塗り／縁の色を得るショートカット。 */
export function dynastyFillHex(dynastyKey: string): string {
  return dynastyColorHex(dynastyColorSlot(dynastyKey), DYNASTY_FILL_MIX);
}
export function dynastyEdgeHex(dynastyKey: string): string {
  return dynastyColorHex(dynastyColorSlot(dynastyKey), DYNASTY_EDGE_MIX);
}

function relativeLuminance(hex: string): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = parseHex(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const [la, lb] = [relativeLuminance(a), relativeLuminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * 塗りの上に載せる文字色（地色 or 文字色）をコントラスト比で選ぶ。生の彩度を前提にした
 * 固定リスト（旧 darkSlices）は淡彩化後には当てはまらないため、混色後の実値で判定する。
 */
export function readableTextOn(fillHex: string): string {
  return contrastRatio(fillHex, SURFACE_HEX) > contrastRatio(fillHex, INK_HEX)
    ? SURFACE_HEX
    : INK_HEX;
}
