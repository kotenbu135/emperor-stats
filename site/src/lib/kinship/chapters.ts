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
 * - p-ruzi-ying(孺子嬰): 親エッジ未収録のため自動解決だと succession の隣接
 *   (王莽=新バンド)に寄ってしまう。前漢の宗室なので前漢バンドに置く。
 */
export const PERSON_BAND_OVERRIDES: Record<string, string> = {
  "p-ruzi-ying": "漢（劉氏）",
};

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
 * - p-ruzi-ying(孺子嬰): 前漢バンドの右端に固定し、王莽への禅譲矢印が家系の上を
 *   横断しないようにする。
 */
export const CHILD_ORDER_OVERRIDES: Record<string, number> = {
  "p-liu-wu-liang": -5,
  "p-liu-wai": 5,
  "p-ruzi-ying": 999,
};

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
