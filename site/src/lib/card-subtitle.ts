// 皇帝一覧カードの補助名（1行目に皇帝号と並べて出す諱・通用名）。
// 皇帝号（commonName）だけでは誰か分かりにくい人物向けに、最も通りの良い名前を
// ビルド時に導出する。デフォルト規則は「諱の（…）以降を省略し、皇帝号に同じ
// 文字列が含まれる場合は非表示」。デフォルトで不適切な人物（遼の契丹名/漢風名の
// 並び順・清の愛新覚羅姓など）だけを CARD_SUBTITLE_OVERRIDES で個別上書きする。
// 「日本での知名度」という編集判断のためデータ本体（data/emperors.json）には
// 置かず、かな検索の kana-readings.ts と同じくサイト側の手書きテーブルで持つ。
// 選定の経緯・全365人分のレビュー記録は ../docs/site-design/LAYOUT.md を参照。

/**
 * 人物別上書き（id → 補助名。null は「補助名を出さない」）。
 * ここに無い人物はデフォルト規則で導出される。
 */
export const CARD_SUBTITLE_OVERRIDES: Record<string, string | null> = {
  // 遼: 諱データは「契丹名（漢風名）」の並びで、機械的に括弧前を取ると馴染みの
  // 薄い契丹名側が残るため、括弧内の漢風名を採用する（太祖の耶律阿保機と西遼は
  // 括弧なし＝デフォルトで正しい。金は逆順「漢風名（女真名）」なので上書き不要）。
  "liao-taizong": "耶律徳光",
  "liao-shizong": "耶律阮",
  "liao-muzong": "耶律璟",
  "liao-jingzong": "耶律賢",
  "liao-shengzong": "耶律隆緒",
  "liao-xingzong": "耶律宗真",
  "liao-daozong": "耶律洪基",
  "liao-tianzuodi": "耶律延禧",
  // 清: 「愛新覚羅」姓を省略して諱のみ。太宗は諱（皇太極）より「ホンタイジ」が通用。
  "qing-taizong": "ホンタイジ",
  "qing-shizu": "福臨",
  "qing-shengzu": "玄燁",
  "qing-shizong": "胤禛",
  "qing-gaozong": "弘暦",
  "qing-renzong": "顒琰",
  "qing-xuanzong": "旻寧",
  "qing-wenzong": "奕詝",
  "qing-muzong": "載淳",
  "qing-dezong": "載湉",
  "qing-xuantong": "溥儀",
  // 個別: 「嬴胡亥」表記は一般的でなく「胡亥」が通用。
  "qin-er-shi": "胡亥",
  // 個別: 皇帝号「則天大聖皇帝（武則天）」に通用名を含むため諱「武曌」は出さない。
  "tang-wuzetian": null,
};

/**
 * 一覧カードの補助名を導出する（無い場合は null）。
 * @param id 皇帝id
 * @param personalName 諱（データ原文）
 * @param cardTitle カード1行目の皇帝号（displayName適用後の EmperorRecord.name）
 */
export function cardSubtitleOf(
  id: string,
  personalName: string | null,
  cardTitle: string,
): string | null {
  if (id in CARD_SUBTITLE_OVERRIDES) return CARD_SUBTITLE_OVERRIDES[id];
  if (!personalName) return null;
  // 元朝の「クビライ（忽必烈）」のような長い併記は括弧前だけをカードに出す。
  const stripped = personalName.split("（")[0];
  // 「太祖（朱全忠）」型（五代十国）や「王莽」「侯景」など、皇帝号に諱が
  // 含まれる人物は重複表示を避けて出さない。
  if (!stripped || cardTitle.includes(stripped)) return null;
  return stripped;
}
