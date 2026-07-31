// 王朝 → 配色スロットの単一情報源。
//
// このサイトの主要な軸である「王朝」を色で表す。割り当ては意味ベース
// （漢系=4金・北族=1青・晋系=7紫・宋=2緑・明=8赤・隋/梁系=5青緑）で、
// 並立政権・反乱/自称政権はスロット0（--kinship-minor・無彩色）に落とす。
//
// スロット0は --kinship-minor（無彩色）。ここに落ちる39政権は全て政権の性格
// （スキーマ v3 の `catalogs.regimes[].category`）が「並立政権」または
// 「反乱・自称政権」で、正統王朝は1つも含まれない（逆は成り立たない——十六国・西夏・
// 遼系のように政権ごとの識別色を持たせている非正統政権が15キーある）。
//
// **キーは政権 ID**（`catalogs.regimes[].id`・89件）。2026-07-31 の Issue #27 まで
// `国号__調査ブロック` の複合キーだったが、同じ調査ブロックの中に同名の別政権
// （隋末の梁2つ・楚2つ）が実在し、別政権が1つのキーに潰れていた。
//
// **政権を追加したら必ずこの表に追記すること**（未知のキーは throw する）。
// 皇帝を追加しただけなら、その人の政権が既にあれば追記は要らない。
export const DYNASTY_COLOR_SLOT: Record<string, number> = {
  // 無彩色 --kinship-minor（群雄・並立政権）
  "anshi-yan": 0,
  "southern-han": 0,
  "min": 0,
  "northern-han": 0,
  "xiqin": 0,
  "suimo-chu": 0,
  "zhucan-chu": 0,
  "liangshidu-liang": 0,
  "xiaoxian-liang": 0,
  "former-shu": 0,
  "later-shu": 0,
  "southern-tang": 0,
  "chen-han": 0,
  "ming-xia": 0,
  "wu-zhou-sanfan": 0,
  "chimei-han": 0,
  "chengjia": 0,
  "zhongjia": 0,
  "former-liang": 0,
  "huan-chu": 0,
  "houjing-han": 0,
  "dingyang": 0,
  "xu": 0,
  "liguigui-liang": 0,
  "zheng": 0,
  "suimo-wu": 0,
  "suimo-song": 0,
  "zhuci-qin": 0,
  "lixilie-chu": 0,
  "huangchao-qi": 0,
  "jie-yan": 0,
  "yang-wu": 0,
  "zhangbangchang-chu": 0,
  "liuyu-qi": 0,
  "tianwan": 0,
  "hanlin-song": 0,
  "shun": 0,
  "xi": 0,
  "empire-of-china": 0,
  // 青 --series-1（北族系）
  "northern-wei": 1,
  "yuan": 1,
  "qing": 1,
  "liao": 1,
  "cao-wei": 1,
  "former-zhao": 1,
  "western-liao": 1,
  "southern-yan": 1,
  "xin": 1,
  "northern-yuan": 1,
  // 緑 --series-2（宋系）
  "liu-song": 2,
  "northern-song": 2,
  "southern-song": 2,
  "northern-qi": 2,
  "eastern-wu": 2,
  "former-yan": 2,
  // 桃 --series-3
  "western-yan": 3,
  "hexia": 3,
  "western-liang": 3,
  "wu-zhou": 3,
  // 金 --series-4（漢系）
  "tang": 4,
  "western-han": 4,
  "eastern-han": 4,
  "southern-liang": 4,
  "former-qin": 4,
  "shu-han": 4,
  "xuanhan": 4,
  "liuyong-liang": 4,
  // 青緑 --series-5（隋／南朝梁系）
  "western-xia": 5,
  "later-yan": 5,
  "cheng-han": 5,
  "chen": 5,
  "sui": 5,
  "northern-zhou": 5,
  // 橙 --series-6
  "southern-qi": 6,
  "later-tang": 6,
  "later-qin": 6,
  "later-liang": 6,
  "later-zhou": 6,
  "later-jin": 6,
  "later-han": 6,
  // 紫 --series-7（晋系）
  "eastern-jin": 7,
  "jin-jurchen": 7,
  "western-jin": 7,
  "eastern-wei": 7,
  // 赤 --series-8
  "ming": 8,
  "later-zhao": 8,
  "southern-ming": 8,
  "western-wei": 8,
  "qin": 8,
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

/** dynastyKey（＝政権 ID）→ スロット。未知のキーは throw する
 *  （政権を追加したときに気づけるようにする。eraLabelOf の既存方式に揃える）。 */
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
