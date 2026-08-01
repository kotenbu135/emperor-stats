// 王朝 → 配色スロットの単一情報源。
//
// このサイトの主要な軸である「王朝」を色で表す。割り当ては意味ベース
// （漢系=4金・北族=1青・晋系=7紫・宋=2緑・明=8赤・隋/梁系=5青緑）で、
// 群雄・短命の割拠政権はスロット0（--kinship-minor・無彩色）に落とす。
//
// スロット0は --kinship-minor（無彩色）。ここに落ちる39政権に統一王朝
// （スキーマ v3 の `catalogs.regimes[].category` が `unified`）は1つも無い
// （逆は成り立たない——三国・十六国・南北朝・五代十国・遼金西夏のように、
// 統一していないが政権ごとの識別色を持たせている政権が38キーある）。
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
 * スロット→実色。CSS 変数を解決できない箇所（混色の計算）があるためハードコードしている。
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
const SURFACE_HEX = "#ffffff";

/* 2026-07-31 に、この表の消費者は「王朝の印」（emperor-grid.tsx の DynastyMark）だけになった。
 * 淡彩を作るための道具（DYNASTY_FILL_MIX・DYNASTY_EDGE_MIX・dynastyColorVar・dynastyColorMix・
 * dynastyFillHex・dynastyEdgeHex・readableTextOn）は、/reign の削除と肖像なしカードの
 * 無彩色化で呼び出し元が全部消えたので削除した（経緯は SITE_DESIGN.md の「7. 皇帝一覧」節）。
 * 面を淡彩で塗る必要が再び出たら、混色の規則（面積が大きいほど濃く／文字を載せる下地は淡く）
 * ごと作り直すこと。 */

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
 * 計算で作った色の濃度感が食い違う）。
 */
function mixHex(hex: string, percent: number, onto = SURFACE_HEX): string {
  const [r1, g1, b1] = parseHex(hex);
  const [r2, g2, b2] = parseHex(onto);
  const t = percent / 100;
  return `#${toHex(r1 * t + r2 * (1 - t))}${toHex(g1 * t + g2 * (1 - t))}${toHex(
    b1 * t + b2 * (1 - t),
  )}`;
}

/** スロット→地色と混ぜた16進値（`percent` が 100 なら生の識別色そのもの）。
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
