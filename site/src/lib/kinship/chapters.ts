// 系譜・即位経路グラフ(/kinship)の章・バンド定義(キュレーション表)。
//
// 全体構成は「時代チャプター縦積み」: 時代ごとの章を縦に積み、時間は章をまたいで
// 下へ連続する(章内のy写像は章ごとに独立・章間の年重複は許容し章ヘッダーで明示)。
// 章の中は「王朝バンド」を横に並べ、バンド内は家系図(tidy tree+時間非重複の
// スロット再利用)で配置する。設計の経緯は docs/site-design/LAYOUT.md を参照。
//
// - バンドの dynastyKeys は「そのバンドの家系図に含める王朝」。同族の連続政権
//   (前漢→玄漢→梁(劉永)のような劉氏一族)は1バンドにまとめ、王朝の区切りは
//   バンド内の王朝見出し(dynastyHeads)で示す。
// - 被覆assert: 有効化した章のバンドが対象皇帝の全dynastyKeyを重複なく覆うことを
//   ビルド時に検証する(timeline-riverのSTREAM_DEFSと同方式)。
// - ブリッジ人物のバンド帰属は主系統の親子関係から自動解決し(kinship-layoutの
//   membership解決)、自動で決まらない・自動では不自然なものだけ
//   PERSON_BAND_OVERRIDES で明示する。

/** バンド = 章内で横に並ぶ家系図の単位。 */
export interface KinshipBandDef {
  /** バンド見出し(グラフ上部に表示)。 */
  label: string;
  /** このバンドに属する王朝(emperors.tsのdynastyKey = `name__section`)。 */
  dynastyKeys: string[];
}

export interface KinshipChapterDef {
  id: string;
  /** 章題(例: 「秦・漢」)。 */
  title: string;
  /** 章ヘッダーに出す年範囲の説明(重複帯の注記を含む)。 */
  period: string;
  bands: KinshipBandDef[];
}

// 章構成(全9章の枠。バンドのキュレーションは実装済みの章のみ)。
// 未実装の章は bands: [] のままにし、KINSHIP_ENABLED_CHAPTER_IDS にも載せない。
export const KINSHIP_CHAPTER_DEFS: KinshipChapterDef[] = [
  {
    id: "qin-han",
    title: "秦・漢",
    period: "前221年 – 220年",
    // バンド順はエッジの横断を最小化するキュレーション:
    // 漢(劉氏)を最左に置く(章の主役の幹を左端から始め、左上の空白を作らない。
    // 秦は年代が漢と重ならないため漢の幹の右上の空きに列共有で収まる)。
    // 後漢は劉氏の同族連続政権として前漢と同じバンドに入れる(劉欽→光武帝が
    // 家系図の垂下線そのものになり、光武帝は劉欽の真下に置かれる)。その右に新
    // (孺子嬰→王莽の禅譲矢印と王禁→王政君の線が隣接バンド間の短い線で済む)。
    bands: [
      {
        label: "漢（劉氏）",
        dynastyKeys: [
          "前漢__秦（始皇帝以降）",
          "玄漢（更始）__新",
          "梁__梁",
          "後漢__後漢",
        ],
      },
      { label: "秦", dynastyKeys: ["秦__秦（始皇帝以降）"] },
      { label: "新（王氏）", dynastyKeys: ["新__新"] },
      { label: "漢（赤眉軍）", dynastyKeys: ["漢（赤眉軍）__漢（赤眉軍）"] },
      { label: "成家", dynastyKeys: ["成家__成家"] },
      { label: "仲家", dynastyKeys: ["仲家__仲家"] },
    ],
  },
  // --- 以下はフェーズ2で実装する章の枠(バンド未キュレーション) ---
  { id: "sanguo-xijin", title: "三国・西晋", period: "220年 – 316年", bands: [] },
  { id: "dongjin-shiliuguo", title: "東晋・十六国", period: "304年 – 439年", bands: [] },
  { id: "nanbeichao", title: "南北朝", period: "386年 – 589年", bands: [] },
  { id: "sui-tang", title: "隋唐", period: "581年 – 907年", bands: [] },
  { id: "wudai-song", title: "五代十国・宋遼金西夏", period: "907年 – 1279年", bands: [] },
  { id: "yuan", title: "元", period: "1206年 – 1388年", bands: [] },
  { id: "ming", title: "明", period: "1368年 – 1662年", bands: [] },
  { id: "qing", title: "清", period: "1616年 – 1945年", bands: [] },
];

/** 描画を有効化した章(パイロット段階は第1章のみ)。 */
export const KINSHIP_ENABLED_CHAPTER_IDS: string[] = ["qin-han"];

/**
 * ブリッジ人物のバンド帰属の明示指定(自動解決の例外)。値はバンドlabel。
 * 現在は空: p-ruzi-ying(孺子嬰)は追加調査で実父鎖(宣帝→劉囂→劉勛→劉顯→劉嬰)が
 * 収録されたため、主親経由の自動解決で漢バンドに入る(明示指定は不要になった)。
 */
export const PERSON_BAND_OVERRIDES: Record<string, string> = {};

/**
 * 兄弟・森ルートの横並び順の明示指定。値が大きいほど右(無指定=0)。
 * 900以上は「右端固定」: パッキングの空きスペースへの左詰めをせず、既存の
 * 全矩形の右側に置く。
 * 第1章のキュレーション方針: 劉發系(舂陵=後漢祖先・玄漢祖先)は左側の自然位置に
 * 置き、前漢トランクの右脇を空けておく。これで新(王氏)バンドからの
 * 王禁→王政君・王莽→孝平王皇后の線が家系を横切らずに届く。
 * - p-liu-wu-liang(劉武): 梁チェーンは文帝の子の左端へ(王氏の線の経路から外す)。
 * - p-liu-wai(劉外): 舂陵チェーンを玄漢祖先チェーンの右に置き、劉欽→光武帝の
 *   降下レーンが更始帝の上を通らないようにする。
 * (p-ruzi-ying=999の右端固定は、実父鎖の収録で孺子嬰が森ルートでなくなり削除。
 *  現在は宣帝直下の母不明グループとして垂下し、王莽への禅譲矢印は長い水平直線)
 * - han-wendi(文帝): 文帝の系統(景帝→武帝→…→舂陵→更始/光武の長大な幹)を高帝の
 *   子の左側に置く。既定(アンカー年順)だと恵帝グループが左端に来て、短命な恵帝系
 *   (前少帝・後少帝で断絶)の下がずっと空白になる。長い幹を左に、短い恵帝系を右に
 *   することで空白列を作らない(ユーザー指摘)。
 */
export const CHILD_ORDER_OVERRIDES: Record<string, number> = {
  "p-liu-wu-liang": -5,
  "p-liu-wai": 5,
  "han-wendi": -5,
};

/**
 * 人物ピルの表示強化(皇帝ではないが史上の地位が線の意味に効く人物)。
 * - label: ピルの表示名(通称)。無指定は名前の短縮形。
 * - role: ピル2行目の肩書き(指定するとピルが2行分の高さになる)。
 * - tipNote: ツールチップ末尾の補足文(サイト側の要約文。原文引用ではない)。
 * - p-ruzi-ying(孺子嬰): ピルが「劉嬰」だけだと皇太子(孺子)であることが読み
 *   取れず、王莽への「禅譲・外戚」矢印の説得力がない(ユーザー指摘)。
 */
export const PERSON_DISPLAY_OVERRIDES: Record<
  string,
  { label?: string; role?: string; tipNote?: string }
> = {
  "p-ruzi-ying": {
    label: "孺子嬰",
    role: "皇太子",
    tipNote:
      "平帝の崩後、王莽により皇太子(号は孺子)に立てられたが、皇帝に即位しないまま初始元年(8年)の王莽即位で漢の帝位を禅譲する形となった",
  },
};

/**
 * 生母ピルを夫カプセルの下辺側に置く指定(既定は上辺)。「皇帝と母を結ぶ線は
 * 箱の上のほうという決まりはない」(ユーザー)。遠祖主張の点線が出る側の生母を
 * 下げ、点線を上辺から出すことで両者の交差を避ける。
 * - p-lyu-zhi(呂雉): 恵帝/文帝の左右入替で呂雉が高帝の右側にきたため、右へ出る
 *   劉盆子主張の点線と呂雉→恵帝の垂下線が交差する。呂雉を下辺へ下げて解消。
 */
export const CONSORT_BOTTOM_ATTACH = new Set<string>(["p-lyu-zhi"]);

/**
 * バンドを列共有の自然位置からさらに右へずらす量(px)。バンド間の線の通り道を
 * 広げるためのキュレーション。ずらしたバンドより右のバンドも同量右へ押される。
 * - 漢（赤眉軍）: 新バンド(王禁・王曼の右端)と劉萌の間が26pxしかなく、劉盆子の
 *   遠祖主張の点線の降下コリドーが王曼に2pxまで迫る。右へ広げて余裕を作る。
 */
export const BAND_X_EXTRA: Record<string, number> = {
  "漢（赤眉軍）": 40,
};

/**
 * バンド見出しの位置を「最上部ノード群の中央」(既定)でなく特定ノードの近傍に置く
 * 上書き。値は基準ノードidとオフセット。
 * - 新（王氏）: 既定だと祖先の王禁(バンド最上部)の近くに出て、新の実体である王莽
 *   から遠い。王莽の直上に置く(ユーザー指摘)。
 */
export const BAND_LABEL_ANCHOR: Record<
  string,
  { anchorId: string; dx?: number; dy?: number }
> = {
  "新（王氏）": { anchorId: "wang-mang", dy: -12 },
};

/**
 * 遠祖の系譜主張(genealogicalClaims)をグラフに長い点線で描くもの(キュレーション)。
 * 主張の中間世代は人物ノードとして収録されていないため、主張上の遠祖(実在の
 * 描画ノード)から「実父エッジで繋がる最古の祖先ノード」までを1本の点線で結ぶ。
 * ツールチップに主張の全文(claimedAncestry)と出典を出す。
 * - 劉盆子(建世帝): 高祖—劉肥—劉章—〔約7世代略〕—劉憲—劉萌の後漢書記載の系譜。
 *   終点は実父エッジ収録済みの劉萌。高祖の上辺から出し(下の呂雉→恵帝の垂下線と
 *   交差しない)、赤眉バンドの左脇コリドーを降りて劉萌の左辺へ入る。
 */
export const CLAIM_LINE_DEFS: {
  claimant: string;
  fromId: string;
  toId: string;
  /** 起点カプセルの上辺(top)/下辺(bottom)どちらから線を出すか。 */
  fromAnchor: "top" | "bottom";
  /** 垂直コリドーを終点ノードのどちら側に通すか。 */
  side: "L" | "R";
  label: string;
}[] = [
  {
    claimant: "liu-penzi",
    fromId: "han-gaozu",
    toId: "p-liu-meng",
    fromAnchor: "top",
    side: "L",
    label: "高祖の後裔（中間は世代略）",
  },
];

// 配色はtimeline-river.tsのSTREAM_DEFSと同じ意味ベース割当(漢系=4金・新=1青・
// 秦=8朱・群雄=0灰)。globals.cssの--series-N。
export const KINSHIP_COLOR_BY_DYNKEY: Record<string, number> = {
  "秦__秦（始皇帝以降）": 8,
  "前漢__秦（始皇帝以降）": 4,
  新__新: 1,
  "玄漢（更始）__新": 4,
  後漢__後漢: 4,
  // 梁(劉永)は漢バンド内の劉氏同族政権なので漢系の金(灰だと皇帝カプセルが
  // つなぎの人物ノードに見える)。timeline-riverの群雄灰とは意図的に変える。
  梁__梁: 4,
  "漢（赤眉軍）__漢（赤眉軍）": 0,
  成家__成家: 0,
  仲家__仲家: 0,
};

/** 女性皇帝(emperors.jsonに性別フィールドが無いための表示メタ)。 */
export const FEMALE_EMPEROR_IDS = new Set(["tang-wuzetian"]);
