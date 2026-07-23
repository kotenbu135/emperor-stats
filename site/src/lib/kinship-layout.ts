// 系譜・即位経路グラフ(/kinship)のビルド時レイアウト計算。
// 設計: data/schema/KINSHIP_SCHEMA.md「可視化の決定事項」(方式③: 縦=時間・横=王朝レーン)。
//
// - 全域版: 皇帝365人(複数在位はカプセル複数+同一人物コネクタ)+ブリッジ人物222人・
//   エッジ843本(succession/kinship/marriage)+系譜主張62件を7カラムで描く。
// - カラムは「時代で再利用する」: 87王朝(dynastyKey)を KINSHIP_COLUMN_DEFS で7本の
//   カラムに割り当てる(同一カラム内は時代順に重ならないことを机上設計済み。カプセル
//   レベルの押し出しが MAX_PUSH_YEARS を超えたらキュレーション事故としてビルドを落とす)。
//   配色は timeline-river の STREAM_DEFS 由来(RIVER_COLOR_BY_DYNKEY)で意味ベースを共有。
// - ブリッジ人物のカラムは section から決める(単一カラムに解決しない section は
//   エッジBFSで最寄りの同 section 皇帝のカラムに追従)。
// - KINSHIP_SCHEMA.mdの決定どおりレイアウトはビルド時計算(クライアント側での再計算なし・
//   固定幅SVG+横スクロール)。本モジュール内の年はすべて天文年(astro済み。emperors.tsの
//   getKinshipGraphData()が変換して渡す)。fsに依存しない純関数群。

import { formatYear } from "@/lib/emperor-types";
import { fromAstroYear, RIVER_COLOR_BY_DYNKEY } from "@/lib/timeline-river";

// --- 入力(emperors.tsが整形して渡す。年はすべて天文年) ---

export interface KinshipSourceEmperor {
  id: string;
  name: string;
  dynastyLabel: string;
  /** `name__section`(emperors.tsのdynastyKeyと同一)。カラム/配色キュレーションのキー。 */
  dynastyKey: string;
  section: string;
  accessionRouteCategory: string;
  reigns: { a: number; b: number; isRestoration: boolean }[];
}

export interface KinshipSourcePerson {
  id: string;
  name: string;
  kind: string;
  gender: "male" | "female";
  section: string;
  /** 天文年。不明はnull(配置は系譜エッジの隣接ノードから推定する)。 */
  birthYear: number | null;
  deathYear: number | null;
  yearsApproximate: boolean;
}

export interface KinshipSourceEdge {
  type: "succession" | "kinship" | "marriage";
  from: string;
  to: string;
  /** succession のみ。 */
  category?: string;
  relationToPredecessor?: string;
  /** kinship のみ(実父/実母/養父/養母/兄弟姉妹)。 */
  relation?: string;
  veracity: string;
  confidence: string;
  /** 呼び出し側で切り詰め済み(RSCペイロード対策)。 */
  noteExcerpt: string;
  sourcePage: string;
}

export interface KinshipSourceClaim {
  /** 主張者のノードid(皇帝またはブリッジ人物)。 */
  claimant: string;
  /** 呼び出し側で切り詰め済み。 */
  ancestry: string;
  noteExcerpt: string;
  sourcePage: string;
}

export interface KinshipSource {
  emperors: KinshipSourceEmperor[];
  persons: KinshipSourcePerson[];
  edges: KinshipSourceEdge[];
  claims: KinshipSourceClaim[];
}

// --- 出力(そのままクライアントのpropsになる) ---

export interface KinshipNodeOut {
  /** カプセル単位の一意キー(複数在位は `${id}@${i}`)。React key用。 */
  key: string;
  /** 人物単位のid(近傍強調は人物単位で行う)。 */
  id: string;
  kind: "emperor" | "person";
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** globals.cssの--series-N。0は灰(並立群雄)。 */
  colorSlot: number;
  /** 入エッジを持たない皇帝の「◆建国」「◆擁立」バッジ(先頭カプセルのみ)。 */
  rootBadge: string | null;
  /** 系譜主張(genealogicalClaims)を持つノードの「◇遠祖」バッジ(先頭カプセルのみ)。 */
  claimBadge: boolean;
  /** テキスト版のグループ化に使う王朝表示名(ブリッジ人物は最寄りの皇帝の王朝)。 */
  groupLabel: string;
  tip: { title: string; subtitle: string; period: string; claim?: string };
}

export interface KinshipEdgeOut {
  edgeType: "succession" | "kinship" | "marriage";
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
  path: string;
  labelX: number;
  labelY: number;
  labelAnchor: "start" | "middle" | "end";
  /** テキスト版の表示ラベル(succession=カテゴリ(続柄)・kinship=続柄。disputedは「?」付き)。 */
  label: string;
  /**
   * グラフ内に描くラベル(空文字は描かない)。successionはカテゴリ(続柄)、kinshipは
   * 続柄の短縮形(父・母など)。同じ2人を結ぶ継承エッジがある血縁エッジは線が完全に
   * 重なり続柄も継承側に含まれるため空にする。marriageは常に空(二重線が凡例)。
   */
  graphLabel: string;
  disputed: boolean;
  tip: {
    title: string;
    detail: string;
    noteExcerpt: string;
    source: string;
  };
}

/** 複数在位の同一人物カプセルをつなぐコネクタ(カラム左側面を通る点線)。 */
export interface KinshipConnectorOut {
  personId: string;
  path: string;
  tipTitle: string;
}

/** 王朝見出し(カラム再利用のためレーン固定見出しではなく王朝の初出位置に置く)。 */
export interface KinshipDynastyHead {
  label: string;
  x: number;
  y: number;
}

export interface KinshipLayout {
  width: number;
  height: number;
  ticks: { y: number; label: string }[];
  axisX: number;
  nodes: KinshipNodeOut[];
  edges: KinshipEdgeOut[];
  connectors: KinshipConnectorOut[];
  dynastyHeads: KinshipDynastyHead[];
  /** テキスト版・SEO用の系譜主張一覧(時代順)。 */
  claimsList: {
    claimantId: string;
    claimantLabel: string;
    dynastyLabel: string;
    ancestry: string;
    source: string;
  }[];
}

// --- キュレーション: 87王朝(dynastyKey)→7カラム ---
// カラムは時代で再利用する。同一カラム内の王朝は時代順に並び、在位期間が実質的に
// 重ならないことを机上設計済み(2026-07-24)。数年以下の軽微な重なり(梁末の蕭荘と陳、
// 隋恭帝と唐高祖、唐と武周のインターリーブ等)はカプセル単位のカーソル押し出し+
// 局所引き伸ばしが吸収する。MAX_PUSH_YEARS 超の押し出しはキュレーション事故として
// ビルドを落とす。
interface KinshipColumnDef {
  /** コード可読性用の説明(表示には使わない)。 */
  note: string;
  keys: string[];
}

const KINSHIP_COLUMN_DEFS: KinshipColumnDef[] = [
  {
    note: "北辺・征服王朝(遼→西遼→元→北元→清)+定楊・桀燕",
    keys: [
      "定楊__隋末群雄",
      "桀燕__五代十国",
      "遼__宋遼西夏金",
      "西遼__宋遼西夏金",
      "元__元",
      "北元__元",
      "清__清",
    ],
  },
  {
    note: "中原後半の正統チェーン(北魏→西魏→北周→隋→唐→五代→宋→明)",
    keys: [
      "北魏__北朝",
      "西魏__北朝",
      "北周__北朝",
      "隋__隋",
      "唐__唐",
      "周__唐",
      "後梁__五代十国",
      "後唐__五代十国",
      "後晋__五代十国",
      "後漢__五代十国",
      "後周__五代十国",
      "北宋__宋遼西夏金",
      "南宋__宋遼西夏金",
      "明__明",
    ],
  },
  {
    note: "並立1(蜀漢・北族側の並立: 前趙〜後燕・東魏北斉・十国呉南唐・南明など)",
    keys: [
      "漢（赤眉軍）__漢（赤眉軍）",
      "仲家__仲家",
      "蜀漢__三国時代",
      "前趙（漢趙）__前趙",
      "後趙__後趙",
      "前燕__前燕",
      "後燕__後燕",
      "夏__夏",
      "東魏__北朝",
      "北斉__北朝",
      "鄭__隋末群雄",
      "燕__唐",
      "斉__唐",
      "呉__五代十国",
      "南唐__五代十国",
      "楚__宋遼西夏金",
      "斉__宋遼西夏金",
      "天完__元",
      "陳漢__元",
      "南明__明",
    ],
  },
  {
    note: "中原前半の正統チェーン(秦→前漢→新→後漢→魏→晋→南朝宋斉梁陳)",
    keys: [
      "秦__秦（始皇帝以降）",
      "前漢__秦（始皇帝以降）",
      "新__新",
      "玄漢（更始）__新",
      "後漢__後漢",
      "魏__三国時代",
      "西晋__晋",
      "東晋__晋",
      "宋__南朝",
      "斉__南朝",
      "梁__南朝",
      "陳__南朝",
      "梁__隋末群雄",
    ],
  },
  {
    note: "並立2(呉・成漢前秦・桓楚・西梁・前蜀後蜀・西夏・順呉周など)",
    keys: [
      "成家__成家",
      "呉__三国時代",
      "成漢__成漢",
      "前秦__前秦",
      "楚（桓楚）__楚",
      "後梁__南朝",
      "楚__隋末群雄",
      "秦（漢）__唐",
      "楚__唐",
      "前蜀__五代十国",
      "後蜀__五代十国",
      "西夏__宋遼西夏金",
      "順__明",
      "呉周__清",
      "中華帝国__清",
    ],
  },
  {
    note: "並立3(劉永・西燕南燕・侯景・南漢・金・韓宋・大西など)",
    keys: [
      "梁__梁",
      "前涼__前涼",
      "西燕__西燕",
      "南燕__南燕",
      "梁（簒奪・漢）__南朝",
      "秦（西秦）__隋末群雄",
      "許__隋末群雄",
      "宋__隋末群雄",
      "南漢__五代十国",
      "金__宋遼西夏金",
      "宋__元",
      "西__明",
    ],
  },
  {
    note: "並立4(後秦・閩北漢・明玉珍夏など)",
    keys: [
      "後秦__後秦",
      "涼__隋末群雄",
      "呉__隋末群雄",
      "閩__五代十国",
      "北漢__五代十国",
      "夏__元",
    ],
  },
  {
    note: "並立5(隋末のピーク用: 同時10政権のあふれ分。id上書きでのみ使う)",
    keys: [],
  },
];

// dynastyKey単位では解決できない同名別政権のid上書き。
// 隋末群雄の「梁」は梁師都(朔方)と蕭銑(江陵)、「楚」は林士弘と朱粲がそれぞれ
// 別政権で並立するため、dynastyKeyのカラムから個別に退避させる。
const KINSHIP_COLUMN_ID_OVERRIDES: Record<string, number> = {
  "suimo-xiaoxian": 7, // 蕭銑(梁): 並立5カラムへ
  "suimo-zhucan": 5, // 朱粲(楚): 並立3カラムの西秦→許の後に挟む(1.5年程度の押し出しは許容)
  // 唐本流(唐__唐)の中で在位が本流皇帝と真に並立する傀儡2人は並立1カラムへ退避
  // (李承宏=763年吐蕃擁立で代宗と並立・李熅=886年朱玫擁立で僖宗と並立)。
  "tangmo-li-chenghong": 2,
  "tangmo-li-yun": 2,
};

/** カプセルが真の開始年からこれ以上押し出されたらカラム割当の事故として落とす。 */
const MAX_PUSH_YEARS = 8;

// 女性ノードはラベルに「♀」を付けて区別する(男女の見分けがつかないという
// レビュー指摘への対応)。ブリッジ人物はkinship.jsonのgenderで判定できるが、
// emperors.jsonに性別フィールドは無く、365人中女性は武則天ただ1人のため
// 皇帝側はここで固定する(表示メタデータでありデータセットの値ではない)。
const FEMALE_EMPEROR_IDS = new Set(["tang-wuzetian"]);

// --- レイアウト定数 ---
const AXIS_X = 64;
const LANE_W = 160;
const LANE_GAP = 30;
const M_TOP = 72;
const M_BOTTOM = 40;
const PX_PER_YEAR = 3;
const MIN_H = 26; // カプセル最小高(短在位もホバー・ラベルが成立する高さ)
const NODE_GAP = 8; // 連続するノード間の間隔(矢印の視認用。年境界から上下4pxずつ内側に描いて作る)
const EMPEROR_W = 104;
const PERSON_W = 130;
const PERSON_H = 30;
// 皇帝の在位期間と重なるブリッジ人物を置くカラム内左サブカラム(該当カラムのみ幅を拡張)
const SIDE_W = 118;
const SIDE_PERSON_W = 102;

interface PlacedNode extends KinshipNodeOut {
  lane: number;
  cx: number;
}

export function buildKinshipLayout(src: KinshipSource): KinshipLayout {
  // --- キュレーション表の被覆assert(timeline-riverのSTREAM_DEFSと同方式) ---
  const colByDynKey = new Map<string, number>();
  KINSHIP_COLUMN_DEFS.forEach((def, i) => {
    for (const k of def.keys) {
      if (colByDynKey.has(k))
        throw new Error(`kinship-layout: dynastyKeyがカラム間で重複しています: "${k}"`);
      colByDynKey.set(k, i);
    }
  });
  const usedDynKeys = new Set(src.emperors.map((e) => e.dynastyKey));
  for (const e of src.emperors) {
    if (!colByDynKey.has(e.dynastyKey))
      throw new Error(
        `kinship-layout: KINSHIP_COLUMN_DEFSに未割当のdynastyKeyです: "${e.dynastyKey}"(${e.id})`,
      );
    if (!(e.dynastyKey in RIVER_COLOR_BY_DYNKEY))
      throw new Error(
        `kinship-layout: RIVER_COLOR_BY_DYNKEYに配色がないdynastyKeyです: "${e.dynastyKey}"`,
      );
  }
  for (const k of colByDynKey.keys()) {
    if (!usedDynKeys.has(k))
      throw new Error(`kinship-layout: KINSHIP_COLUMN_DEFSに実データにないdynastyKeyがあります: "${k}"`);
  }
  const srcEmperorIds = new Set(src.emperors.map((e) => e.id));
  for (const [id, col] of Object.entries(KINSHIP_COLUMN_ID_OVERRIDES)) {
    if (!srcEmperorIds.has(id))
      throw new Error(`kinship-layout: KINSHIP_COLUMN_ID_OVERRIDESのidが実データにありません: "${id}"`);
    if (col < 0 || col >= KINSHIP_COLUMN_DEFS.length)
      throw new Error(`kinship-layout: KINSHIP_COLUMN_ID_OVERRIDESのカラム番号が範囲外です: "${id}" → ${col}`);
  }
  /** 皇帝のカラム(id上書き優先)。 */
  const emperorColumn = (e: KinshipSourceEmperor): number =>
    KINSHIP_COLUMN_ID_OVERRIDES[e.id] ?? colByDynKey.get(e.dynastyKey)!;

  // --- ブリッジ人物のカラム解決 ---
  // sectionが単一カラムに解決するならそのカラム。複数カラムにまたがるsection
  // (三国時代・北朝・唐・五代十国など)は、エッジBFSで最初に到達した同sectionの
  // 皇帝のカラムに追従する(それも無ければ最初に到達した任意の皇帝)。
  const colsBySection = new Map<string, Set<number>>();
  for (const e of src.emperors) {
    const set = colsBySection.get(e.section) ?? new Set<number>();
    set.add(emperorColumn(e));
    colsBySection.set(e.section, set);
  }
  const emperorById = new Map(src.emperors.map((e) => [e.id, e]));
  const adj = new Map<string, string[]>();
  for (const e of src.edges) {
    adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
    adj.set(e.to, [...(adj.get(e.to) ?? []), e.from]);
  }
  const personContext = (
    p: KinshipSourcePerson,
  ): { col: number; dynLabel: string } => {
    const cols = colsBySection.get(p.section);
    if (!cols || cols.size === 0)
      throw new Error(
        `kinship-layout: ブリッジ人物のsectionに対応する皇帝カラムがありません: "${p.section}"(${p.id})`,
      );
    // BFS(決定的になるよう隣接リストはid順に辿る)で最寄りの同sectionの皇帝を探す。
    // カラムはsectionが単一カラムに解決するならそのカラム、そうでなければBFSの結果に
    // 追従する。王朝ラベル(テキスト版のグループ化用)は常にBFSの結果を使う。
    const fixedCol = cols.size === 1 ? [...cols][0] : null;
    const visited = new Set<string>([p.id]);
    let frontier = [p.id];
    let fallback: { col: number; dynLabel: string } | null = null;
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const n of [...(adj.get(id) ?? [])].sort()) {
          if (visited.has(n)) continue;
          visited.add(n);
          const emp = emperorById.get(n);
          if (emp) {
            const found = { col: emperorColumn(emp), dynLabel: emp.dynastyLabel };
            if (emp.section === p.section)
              return { col: fixedCol ?? found.col, dynLabel: found.dynLabel };
            fallback ??= found;
          }
          next.push(n);
        }
      }
      frontier = next;
    }
    if (fallback !== null)
      return { col: fixedCol ?? fallback.col, dynLabel: fallback.dynLabel };
    throw new Error(
      `kinship-layout: ブリッジ人物のカラムを解決できません(皇帝にエッジで到達しない): ${p.id}`,
    );
  };

  // 皇帝104px/人物130pxのカプセルに収まるように長い名前を短縮する(全体はツールチップ)。
  const shortLabel = (name: string, max: number): string => {
    if (name.length <= max) return name;
    const cut = name.split("・")[0];
    if (cut.length <= max) return cut;
    return `${cut.slice(0, max - 1)}…`;
  };

  // 根バッジは「継承エッジの入次数」で判定する(血縁エッジは継承の根に影響しない)。
  const incoming = new Set(
    src.edges.filter((e) => e.type === "succession").map((e) => e.to),
  );
  const claimByNode = new Map(src.claims.map((c) => [c.claimant, c]));

  const fmtPeriod = (a: number, b: number) => {
    const fa = formatYear(fromAstroYear(a));
    const fb = formatYear(fromAstroYear(b));
    return fa === fb ? `${fa}年` : `${fa}–${fb}年`;
  };
  const personPeriod = (p: KinshipSourcePerson): string => {
    if (p.birthYear === null && p.deathYear === null)
      return "生没年不詳（配置は系譜から推定）";
    if (p.birthYear !== null && p.deathYear !== null)
      return `${p.yearsApproximate ? "生没年推定 " : ""}${fmtPeriod(p.birthYear, p.deathYear)}`;
    const known = (p.birthYear ?? p.deathYear)!;
    const label = `${formatYear(fromAstroYear(known))}年${p.yearsApproximate ? "頃" : ""}`;
    return p.birthYear !== null ? `生 ${label}（没年不詳）` : `没 ${label}（生年不詳）`;
  };
  const emperorPeriod = (e: KinshipSourceEmperor): string =>
    e.reigns
      .map((r, i) => `${i > 0 ? "復位 " : "在位 "}${fmtPeriod(r.a, r.b)}`)
      .join("／");

  // --- ステップ0: 配置アンカー年 ---
  // 皇帝=在位全期間の中央、ブリッジ人物=生没中点(片方のみ判明ならその年)。両方不明の
  // 人物は「エッジで隣接するノードのアンカー平均」への緩和反復で推定する(データ側に
  // 推定値は入れない方針のため表示側で行う)。
  const est = new Map<string, number>();
  for (const e of src.emperors)
    est.set(e.id, (e.reigns[0].a + e.reigns[e.reigns.length - 1].b) / 2);
  const unknown: string[] = [];
  for (const p of src.persons) {
    if (p.birthYear !== null && p.deathYear !== null)
      est.set(p.id, (p.birthYear + p.deathYear) / 2);
    else if (p.birthYear !== null) est.set(p.id, p.birthYear);
    else if (p.deathYear !== null) est.set(p.id, p.deathYear);
    else unknown.push(p.id);
  }
  if (unknown.length > 0) {
    for (let i = 0; i < 200; i++) {
      for (const id of unknown) {
        const vals = (adj.get(id) ?? [])
          .map((n) => est.get(n))
          .filter((v): v is number => v !== undefined);
        if (vals.length > 0)
          est.set(id, vals.reduce((s, v) => s + v, 0) / vals.length);
      }
    }
    for (const id of unknown) {
      if (!est.has(id))
        throw new Error(
          `kinship-layout: ${id} の配置年を推定できません(年の判明したノードにエッジで到達しない)`,
        );
    }
  }

  // --- ステップ1: カラムごとに時系列順へ並べ、各ノードに「実効年区間」を割り当てる ---
  // 「年→pxの単調な区分線形写像を、最小高が守れない密集期間だけ局所的に引き伸ばす」
  // 方式(試作で検証済み)。ノードと目盛りが同じ写像を共有するので位置と年は常に一致する。
  // 同一年内の連続即位(在位が年単位で0年)だけは0.5年の小数年オフセットで順序を保証する。
  interface Block {
    /** カプセルキー(複数在位は `${id}@${i}`)。 */
    key: string;
    id: string;
    kind: "emperor" | "person";
    lane: number;
    /** main=継承カラム(皇帝と系列内ブリッジ)、side=カラム内左サブカラム。 */
    col: "main" | "side";
    /** 真の開始年(押し出し量の検査用)。 */
    trueStart: number;
    effStart: number;
    effEnd: number;
    /** この区間が確保すべき最小px(ノード高+間隔)。 */
    minPx: number;
    node: Omit<KinshipNodeOut, "x" | "y" | "h"> & { cx: number; w: number };
    /**
     * 王朝見出し用の幻ブロック(ノードとしては描かない)。王朝の最初のカプセルの直前に
     * HEAD_PX分の区間を予約し、見出しテキストが直前のカプセルに重ならないようにする
     * (写像の局所引き伸ばしで空間を作るため、カプセルと年目盛りの対応は崩れない)。
     */
    phantomHead?: { label: string; anchorKey: string };
  }

  // ブリッジ人物が実効区間として占有する年幅(片側)。基準スケールで
  // PERSON_H+NODE_GAP をほぼ満たす幅にし、通常は引き伸ばしを発生させない。
  const PERSON_HALF_SPAN = (PERSON_H + NODE_GAP) / 2 / PX_PER_YEAR;

  const seeds: Block[] = [];
  for (const e of src.emperors) {
    const claim = claimByNode.get(e.id);
    e.reigns.forEach((r, i) => {
      seeds.push({
        key: e.reigns.length > 1 ? `${e.id}@${i}` : e.id,
        id: e.id,
        kind: "emperor",
        lane: emperorColumn(e),
        col: "main",
        trueStart: r.a,
        effStart: r.a,
        effEnd: r.b,
        minPx: MIN_H + NODE_GAP,
        node: {
          key: e.reigns.length > 1 ? `${e.id}@${i}` : e.id,
          id: e.id,
          kind: "emperor",
          cx: 0, // カラム幅確定後に割り当て
          w: EMPEROR_W,
          label: `${FEMALE_EMPEROR_IDS.has(e.id) ? "♀" : ""}${shortLabel(e.name, FEMALE_EMPEROR_IDS.has(e.id) ? 7 : 8)}`,
          colorSlot: RIVER_COLOR_BY_DYNKEY[e.dynastyKey],
          rootBadge:
            i === 0 && !incoming.has(e.id) ? `◆${e.accessionRouteCategory}` : null,
          claimBadge: i === 0 && claimByNode.has(e.id),
          groupLabel: e.dynastyLabel,
          tip: {
            title: e.name,
            subtitle: e.dynastyLabel,
            period: emperorPeriod(e),
            ...(claim ? { claim: `遠祖主張: ${claim.ancestry}` } : {}),
          },
        },
      });
    });
  }
  // 皇帝の名目在位区間(カラム別)。ブリッジ人物のカラム判定に使う。
  const emperorIvsByLane = new Map<number, [number, number][]>();
  for (const s of seeds) {
    const arr = emperorIvsByLane.get(s.lane) ?? [];
    arr.push([s.effStart, s.effEnd]);
    emperorIvsByLane.set(s.lane, arr);
  }
  // ブリッジ人物のmain/side判定:
  // (1) 皇帝の在位期間と時間的に重なる人物(光武帝の前漢側祖先チェーン等)は、継承カラム
  //     の縦系列に割り込めないためカラム内の左サブカラムに置く。
  // (2) 重ならない人物(荘襄王・孺子嬰型)は継承カラムの系列に挟むが、皇帝間の同じ
  //     「隙間」に基準スケールで収まる人数を超えて詰め込むと後続の皇帝を年軸から
  //     押し出してしまう(蕭銑が10年ずれた実データ事故)ため、隙間ごとに容量を検査し、
  //     あふれた人物はサブカラムへ送る。
  for (const arr of emperorIvsByLane.values()) arr.sort((p, q) => p[0] - q[0]);
  const personPlacement = new Map<string, { lane: number; col: "main" | "side" }>();
  const gapGroups = new Map<string, { p: KinshipSourcePerson; mid: number }[]>();
  const personCtx = new Map(src.persons.map((p) => [p.id, personContext(p)]));
  for (const p of src.persons) {
    const lane = personCtx.get(p.id)!.col;
    const mid = est.get(p.id)!;
    const start = mid - PERSON_HALF_SPAN;
    const end = mid + PERSON_HALF_SPAN;
    const ivs = emperorIvsByLane.get(lane) ?? [];
    if (ivs.some(([a, b]) => start < b && end > a)) {
      personPlacement.set(p.id, { lane, col: "side" });
      continue;
    }
    // midが入る皇帝間の隙間(直前の在位終了〜直後の在位開始)を特定する。
    let gapIdx = 0;
    while (gapIdx < ivs.length && ivs[gapIdx][0] < mid) gapIdx++;
    const key = `${lane}:${gapIdx}`;
    gapGroups.set(key, [...(gapGroups.get(key) ?? []), { p, mid }]);
    personPlacement.set(p.id, { lane, col: "main" });
  }
  for (const [key, group] of gapGroups) {
    const [laneStr, gapStr] = key.split(":");
    const lane = Number(laneStr);
    const gapIdx = Number(gapStr);
    const ivs = emperorIvsByLane.get(lane) ?? [];
    const gapStartY = gapIdx > 0 ? ivs[gapIdx - 1][1] : -Infinity;
    const gapEndY = gapIdx < ivs.length ? ivs[gapIdx][0] : Infinity;
    const capacityPx =
      gapStartY === -Infinity || gapEndY === Infinity
        ? Infinity
        : (gapEndY - gapStartY) * PX_PER_YEAR;
    group.sort((a, b) => a.mid - b.mid);
    let usedPx = 0;
    for (const { p } of group) {
      usedPx += PERSON_H + NODE_GAP;
      if (usedPx > capacityPx) personPlacement.set(p.id, { lane, col: "side" });
    }
  }
  for (const p of src.persons) {
    const { lane, col } = personPlacement.get(p.id)!;
    const mid = est.get(p.id)!;
    const start = mid - PERSON_HALF_SPAN;
    const end = mid + PERSON_HALF_SPAN;
    const overlaps = col === "side";
    const claim = claimByNode.get(p.id);
    seeds.push({
      key: p.id,
      id: p.id,
      kind: "person",
      lane,
      col: overlaps ? "side" : "main",
      trueStart: start,
      effStart: start,
      effEnd: end,
      minPx: PERSON_H + NODE_GAP,
      node: {
        key: p.id,
        id: p.id,
        kind: "person",
        cx: 0,
        w: overlaps ? SIDE_PERSON_W : PERSON_W,
        // ♀プレフィックスの分だけ短縮幅を1字詰める(ラベルの箱はみ出し防止)
        label: `${p.gender === "female" ? "♀" : ""}${shortLabel(p.name, (overlaps ? 8 : 10) - (p.gender === "female" ? 1 : 0))}`,
        colorSlot: 0,
        rootBadge: null,
        claimBadge: claimByNode.has(p.id),
        groupLabel: personCtx.get(p.id)!.dynLabel,
        tip: {
          title: p.name,
          subtitle: `非皇帝（${p.kind}）`,
          period: personPeriod(p),
          ...(claim ? { claim: `遠祖主張: ${claim.ancestry}` } : {}),
        },
      },
    });
  }

  // --- 王朝見出しの幻ブロック ---
  // 見出しテキストを各王朝の最初のカプセルの真上に置くため、直前にHEAD_PX分の区間を
  // 予約する(見出しが直前のカプセルに重なっていたレビュー指摘への対応。写像の局所
  // 引き伸ばしで空間を作るのでカプセルと年目盛りの対応は崩れない)。id上書きで別カラムへ
  // 退避した同名別政権(蕭銑の梁など)にも見出しが付くよう(dynastyKey, カラム)の組ごとに置く。
  const HEAD_PX = 18;
  {
    const firstByDynLane = new Map<string, Block>();
    for (const s of seeds) {
      if (s.kind !== "emperor") continue;
      const emp = emperorById.get(s.id)!;
      const key = `${emp.dynastyKey}:${s.lane}`;
      const cur = firstByDynLane.get(key);
      if (!cur || s.trueStart < cur.trueStart) firstByDynLane.set(key, s);
    }
    for (const [key, first] of firstByDynLane) {
      const emp = emperorById.get(first.id)!;
      seeds.push({
        key: `head:${key}`,
        id: first.id,
        kind: "person", // MAX_PUSH検査(emperor限定)の対象外にする
        lane: first.lane,
        col: "main",
        trueStart: first.trueStart - 0.4,
        effStart: first.trueStart - 0.4,
        effEnd: first.trueStart,
        minPx: HEAD_PX,
        node: first.node, // ダミー参照(ノードとしては描かない)
        phantomHead: { label: emp.dynastyLabel, anchorKey: first.key },
      });
    }
  }

  // --- カラム幅とx割り当て(サブカラムを持つカラムだけ幅を広げる) ---
  const laneHasSide = KINSHIP_COLUMN_DEFS.map((_, i) =>
    seeds.some((s) => s.lane === i && s.col === "side"),
  );
  const laneXs: number[] = [];
  {
    let x = AXIS_X + 16;
    for (let i = 0; i < KINSHIP_COLUMN_DEFS.length; i++) {
      laneXs.push(x);
      x += (laneHasSide[i] ? SIDE_W : 0) + LANE_W + LANE_GAP;
    }
  }
  const laneWidth = (i: number) => (laneHasSide[i] ? SIDE_W : 0) + LANE_W;
  for (const s of seeds) {
    s.node.cx =
      s.col === "side"
        ? laneXs[s.lane] + SIDE_W / 2
        : laneXs[s.lane] + (laneHasSide[s.lane] ? SIDE_W : 0) + LANE_W / 2;
  }

  // --- カラムごとに時系列順へ並べ、実効年区間を確定する ---
  const byColumn = new Map<string, Block[]>();
  for (const s of seeds) {
    const key = `${s.lane}:${s.col}`;
    byColumn.set(key, [...(byColumn.get(key) ?? []), s]);
  }
  const blocks: Block[] = [];
  for (const arr of byColumn.values()) {
    arr.sort((p, q) => p.effStart - q.effStart || p.effEnd - q.effEnd);
    let cursor = -Infinity;
    for (const b of arr) {
      b.effStart = Math.max(b.effStart, cursor);
      if (b.kind === "emperor" && b.effStart - b.trueStart > MAX_PUSH_YEARS)
        throw new Error(
          `kinship-layout: ${b.key} が真の開始年から${(b.effStart - b.trueStart).toFixed(1)}年押し出されました。KINSHIP_COLUMN_DEFSのカラム割当(同一カラム内の時代重複)を見直してください`,
        );
      // 同一年内の連続即位(0年区間)は0.5年ずらして順序を保証する。
      if (b.effEnd <= b.effStart) b.effEnd = b.effStart + 0.5;
      cursor = b.effEnd;
      blocks.push(b);
    }
  }

  // --- ステップ2: 年→pxの単調な区分線形写像を構築する ---
  // 実効区間の端点をブレークポイントとし、基準スケール(PX_PER_YEAR)で初期化した
  // 区間長へ、最小pxを満たさないブロックの不足分を右端の区間に加算していく
  // (右端点の昇順に処理するため、加算が処理済みブロックを壊すことはない)。
  const bps = [...new Set(blocks.flatMap((b) => [b.effStart, b.effEnd]))].sort(
    (p, q) => p - q,
  );
  const bpIndex = new Map(bps.map((y, i) => [y, i]));
  const segLen = bps.slice(1).map((y, i) => (y - bps[i]) * PX_PER_YEAR);
  const posOf = () => {
    const pos = [0];
    for (const len of segLen) pos.push(pos[pos.length - 1] + len);
    return pos;
  };
  for (const b of [...blocks].sort((p, q) => p.effEnd - q.effEnd)) {
    const pos = posOf();
    const deficit =
      b.minPx - (pos[bpIndex.get(b.effEnd)!] - pos[bpIndex.get(b.effStart)!]);
    if (deficit > 0) segLen[bpIndex.get(b.effEnd)! - 1] += deficit;
  }
  const pos = posOf();
  // 写像本体: ブレークポイント間は線形補間。範囲外は基準スケールで外挿。
  const yOf = (astro: number): number => {
    if (astro <= bps[0]) return M_TOP + (astro - bps[0]) * PX_PER_YEAR;
    if (astro >= bps[bps.length - 1])
      return M_TOP + pos[pos.length - 1] + (astro - bps[bps.length - 1]) * PX_PER_YEAR;
    let lo = 0;
    let hi = bps.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (bps[mid] <= astro) lo = mid;
      else hi = mid;
    }
    const t = (astro - bps[lo]) / (bps[hi] - bps[lo]);
    return M_TOP + pos[lo] + t * (pos[hi] - pos[lo]);
  };
  const minYear = bps[0];
  const maxYear = bps[bps.length - 1];

  // --- ステップ3: ノード配置(実効区間の写像そのまま。上下NODE_GAP/2ずつ内側に
  //     描くことで、年境界を接して連続する即位でも矢印の描画余地を確保する) ---
  const placed: PlacedNode[] = blocks
    .filter((b) => !b.phantomHead)
    .map((b) => {
    const top = yOf(b.effStart) + NODE_GAP / 2;
    const bottom = yOf(b.effEnd) - NODE_GAP / 2;
    if (b.kind === "person") {
      // ブリッジ人物は固定サイズの決定(KINSHIP_SCHEMA.md)。密集帯で軸が引き伸ばされて
      // いても実効区間の中央にPERSON_H高で描く(実効区間は衝突回避のための予約幅)。
      const cy = (top + bottom) / 2;
      return {
        ...b.node,
        lane: b.lane,
        x: b.node.cx - b.node.w / 2,
        y: cy - PERSON_H / 2,
        h: PERSON_H,
      };
    }
    return {
      ...b.node,
      lane: b.lane,
      x: b.node.cx - b.node.w / 2,
      y: top,
      h: bottom - top,
    };
  });

  // 人物id→カプセル列(時系列順)。エッジの端点解決・コネクタに使う。
  const capsulesById = new Map<string, PlacedNode[]>();
  for (const n of placed) {
    capsulesById.set(n.id, [...(capsulesById.get(n.id) ?? []), n]);
  }
  for (const arr of capsulesById.values()) arr.sort((p, q) => p.y - q.y);

  // エッジの端点カプセル選択: from→toの時間順(fromの終わり→toの始まり)が最も自然に
  // つながる組を選ぶ(復位皇帝の継承エッジが正しい期のカプセルに刺さるようにする)。
  const pickCapsulePair = (
    fromId: string,
    toId: string,
  ): [PlacedNode, PlacedNode] => {
    const fromCaps = capsulesById.get(fromId);
    const toCaps = capsulesById.get(toId);
    if (!fromCaps || !toCaps)
      throw new Error(`kinship-layout: エッジの端点が解決できません: ${fromId} → ${toId}`);
    let best: [PlacedNode, PlacedNode] | null = null;
    let bestScore = Infinity;
    for (const a of fromCaps) {
      for (const b of toCaps) {
        const gap = b.y - (a.y + a.h);
        // 時間順(a→b)ならその近さ、逆順は大きなペナルティを足して最終手段にする。
        const score = gap >= 0 ? gap : 1e6 - gap;
        if (score < bestScore) {
          bestScore = score;
          best = [a, b];
        }
      }
    }
    return best!;
  };

  // --- エッジ ---
  // 経路は5種類。「矢印が短すぎて見えない」「無関係なカプセルを貫通する」という
  // レビュー指摘に対応するため、同一カラムは側面の弓形、長距離のカラム間は
  // カラム間の空き通路を通す。
  //  vert     同一カラムで隣接(間に他カプセル無し・隙間が十分) → 縦ベジェ
  //  arc      同一カラムで隙間が狭い/間に他カプセルを挟む → カラム側面の弓形
  //  corridor カラム間で縦距離が長い → カラム間の通路を縦に降り、到達先の直上で水平に渡る
  //  scurve   カラム間で縦距離が短い → S字ベジェ
  //  side     婚姻と時間逆順のカラム間エッジ → 側面どうしの水平ベジェ
  // 同じカプセルに複数のエッジが刺さる場合は接続点を横に散らして矢印の重なりを避ける。
  interface RoutedEdge {
    e: KinshipSourceEdge;
    a: PlacedNode;
    b: PlacedNode;
    route: "vert" | "arc" | "corridor" | "scurve" | "side";
    pairKey: string;
  }
  const isSideCol = (n: PlacedNode) =>
    laneHasSide[n.lane] && n.cx < laneXs[n.lane] + SIDE_W;
  const CORRIDOR_MIN_SPAN = 56;
  const routed: RoutedEdge[] = src.edges.map((e) => {
    const [a, b] = pickCapsulePair(e.from, e.to);
    const sameCol = a.cx === b.cx;
    let route: RoutedEdge["route"];
    if (e.type === "marriage" || (!sameCol && a.y + a.h >= b.y)) {
      route = "side";
    } else if (sameCol) {
      const gap = b.y - (a.y + a.h);
      const blocked = placed.some(
        (c) =>
          c.cx === a.cx &&
          c.key !== a.key &&
          c.key !== b.key &&
          c.y + c.h > a.y + a.h + 1 &&
          c.y < b.y - 1,
      );
      route = blocked || gap < 22 ? "arc" : "vert";
    } else {
      route = b.y - (a.y + a.h) >= CORRIDOR_MIN_SPAN ? "corridor" : "scurve";
    }
    return { e, a, b, route, pairKey: `${e.from}→${e.to}` };
  });

  // 接続点の散らし。同じ2人を結ぶ継承+血縁の重複エッジはpairKey単位で同じ接続点を
  // 共有させ、線を完全に重ねて1本に見せる(血縁側はラベルも抑制する)。
  const entryOff = new Map<string, number>();
  const exitOff = new Map<string, number>();
  {
    const entryGroups = new Map<string, RoutedEdge[]>();
    const exitGroups = new Map<string, RoutedEdge[]>();
    for (const r of routed) {
      if (r.route === "side" || r.route === "arc") continue;
      entryGroups.set(r.b.key, [...(entryGroups.get(r.b.key) ?? []), r]);
      if (r.route !== "corridor")
        exitGroups.set(r.a.key, [...(exitGroups.get(r.a.key) ?? []), r]);
    }
    const assign = (
      groups: Map<string, RoutedEdge[]>,
      out: Map<string, number>,
      node: (r: RoutedEdge) => PlacedNode,
      other: (r: RoutedEdge) => PlacedNode,
    ) => {
      for (const rs of groups.values()) {
        const pairs = [...new Map(rs.map((r) => [r.pairKey, r])).values()].sort(
          (p, q) => other(p).cx - other(q).cx || (p.pairKey < q.pairKey ? -1 : 1),
        );
        const w = node(pairs[0]).w;
        const step = Math.min(18, (w * 0.6) / Math.max(pairs.length - 1, 1));
        pairs.forEach((r, i) => {
          out.set(
            `${node(r).key}:${r.pairKey}`,
            (i - (pairs.length - 1) / 2) * step,
          );
        });
      }
    };
    assign(
      entryGroups,
      entryOff,
      (r) => r.b,
      (r) => r.a,
    );
    assign(
      exitGroups,
      exitOff,
      (r) => r.a,
      (r) => r.b,
    );
  }

  // 続柄の併記(「続柄を表示したい」への対応)。グラフ内は短縮形で描く。
  const REL_SHORT: Record<string, string> = {
    "同族（遠縁）": "遠縁",
    "外戚（その他）": "外戚",
  };
  const KIN_SHORT: Record<string, string> = {
    実父: "父",
    実母: "母",
    養父: "養父",
    養母: "養母",
    兄弟姉妹: "兄弟",
  };
  const successionPairs = new Set(
    src.edges
      .filter((e) => e.type === "succession")
      .map((e) => `${e.from}→${e.to}`),
  );

  const edges: KinshipEdgeOut[] = routed.map(({ e, a, b, route, pairKey }) => {
    const disputed = e.veracity === "disputed" || e.veracity === "claimed";
    const exit = a.cx + (exitOff.get(`${a.key}:${pairKey}`) ?? 0);
    const entry = b.cx + (entryOff.get(`${b.key}:${pairKey}`) ?? 0);
    let path: string;
    let labelX: number;
    let labelY: number;
    let labelAnchor: "start" | "middle" | "end";
    if (route === "side") {
      // 婚姻(同時代の2ノード)と時間逆順のカラム間エッジ(孺子嬰→王莽型)は側面どうし。
      const leftToRight = a.cx < b.cx;
      const x1 = leftToRight ? a.x + a.w : a.x;
      const x2 = leftToRight ? b.x : b.x + b.w;
      const y1 = a.y + a.h / 2;
      const y2 = b.y + b.h / 2;
      const mx = (x1 + x2) / 2;
      path = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
      labelX = mx;
      labelY = Math.min(y1, y2) - 6;
      labelAnchor = "middle";
    } else if (route === "arc") {
      // 同一カラムの側面を通る弓形。mainカラムは右側面、サブカラムは左側面に膨らむ。
      const left = isSideCol(a);
      const x1 = left ? a.x : a.x + a.w;
      const x2 = left ? b.x : b.x + b.w;
      const bx = left ? x1 - 22 : x1 + 22;
      const sy = a.y + a.h - 8;
      const ey = b.y + 8;
      path = `M ${x1} ${sy} C ${bx} ${sy}, ${bx} ${ey}, ${x2} ${ey}`;
      labelX = left ? x1 - 20 : x1 + 20;
      labelY = (sy + ey) / 2 + 3;
      labelAnchor = left ? "end" : "start";
    } else if (route === "corridor") {
      const sgn = b.cx > a.cx ? 1 : -1;
      // 同一レーン内のmain⇄サブカラム間はその境界を、レーン間はレーンの外の通路を通す。
      const gx =
        a.lane === b.lane
          ? laneXs[a.lane] + SIDE_W
          : sgn > 0
            ? laneXs[a.lane] + laneWidth(a.lane) + LANE_GAP / 2
            : laneXs[a.lane] - LANE_GAP / 2;
      const x0 = sgn > 0 ? a.x + a.w : a.x;
      const y0 = a.y + a.h - 8;
      // 到達先の直上で水平に渡る。渡る高さは他カプセルとの交差が最少の候補を選ぶ。
      const spanLo = Math.min(gx, entry);
      const spanHi = Math.max(gx, entry);
      const crossings = (y: number) =>
        placed.filter(
          (c) =>
            c.key !== a.key &&
            c.key !== b.key &&
            c.y < y &&
            c.y + c.h > y &&
            c.x < spanHi &&
            c.x + c.w > spanLo,
        ).length;
      let yc = b.y - 12;
      let bestC = crossings(yc);
      for (const cand of [b.y - 22, b.y - 34, b.y - 46]) {
        if (bestC === 0 || cand <= y0 + 16) break;
        const c = crossings(cand);
        if (c < bestC) {
          bestC = c;
          yc = cand;
        }
      }
      const r = 12;
      if (Math.abs(entry - gx) < 2 * r + 6 || yc - r <= y0 + r) {
        // 通路を作る余地が無いときはS字にフォールバック。
        const y1 = a.y + a.h;
        const y2 = b.y;
        const my = (y1 + y2) / 2;
        path = `M ${exit} ${y1} C ${exit} ${my}, ${entry} ${my}, ${entry} ${y2}`;
        labelX = (exit + entry) / 2;
        labelY = my - 5;
        labelAnchor = "middle";
      } else {
        path = [
          `M ${x0} ${y0}`,
          `Q ${gx} ${y0} ${gx} ${y0 + r}`,
          `L ${gx} ${yc - r}`,
          `Q ${gx} ${yc} ${gx + sgn * r} ${yc}`,
          `L ${entry - sgn * r} ${yc}`,
          `Q ${entry} ${yc} ${entry} ${b.y}`,
        ].join(" ");
        labelX = (gx + entry) / 2;
        labelY = yc - 4;
        labelAnchor = "middle";
      }
    } else {
      // vert / scurve: fromの下辺→toの上辺(時間順)。
      const y1 = a.y + a.h;
      const y2 = b.y;
      const my = (y1 + y2) / 2;
      path = `M ${exit} ${y1} C ${exit} ${my}, ${entry} ${my}, ${entry} ${y2}`;
      if (route === "vert") {
        // 同一カラムの縦エッジはラベルをカラム右外へ(カプセル内テキストとの衝突回避)。
        labelX = laneXs[a.lane] + laneWidth(a.lane) + 6;
        labelY = my + 3;
        labelAnchor = "start";
      } else {
        labelX = (exit + entry) / 2;
        labelY = my - 5;
        labelAnchor = "middle";
      }
    }
    const relRaw = e.relationToPredecessor;
    const rel =
      relRaw && relRaw !== "その他" ? (REL_SHORT[relRaw] ?? relRaw) : null;
    const kinShort = e.relation ? (KIN_SHORT[e.relation] ?? e.relation) : "血縁";
    const label =
      e.type === "marriage"
        ? "婚姻"
        : e.type === "kinship"
          ? `${e.relation ?? "血縁"}${disputed ? "?" : ""}`
          : `${e.category}${disputed ? "?" : ""}${rel ? `(${rel})` : ""}`;
    const graphLabel =
      e.type === "marriage"
        ? ""
        : e.type === "kinship"
          ? successionPairs.has(pairKey)
            ? ""
            : `${kinShort}${disputed ? "?" : ""}`
          : label;
    const tip =
      e.type === "succession"
        ? {
            title: `継承〔${e.category}〕${disputed ? "（諸説あり）" : ""}`,
            detail: `${a.label} → ${b.label}／新帝は先代の${e.relationToPredecessor}／確度: ${e.confidence}`,
            noteExcerpt: e.noteExcerpt,
            source: e.sourcePage,
          }
        : e.type === "kinship"
          ? {
              title: `血縁〔${e.relation}〕${disputed ? "（諸説あり）" : ""}`,
              detail: `${a.label} → ${b.label}／確度: ${e.confidence}`,
              noteExcerpt: e.noteExcerpt,
              source: e.sourcePage,
            }
          : {
              title: "婚姻",
              detail: `${a.label} ⚭ ${b.label}／確度: ${e.confidence}`,
              noteExcerpt: e.noteExcerpt,
              source: e.sourcePage,
            };
    return {
      edgeType: e.type,
      from: e.from,
      to: e.to,
      fromLabel: a.label,
      toLabel: b.label,
      path,
      labelX,
      labelY,
      labelAnchor,
      label,
      graphLabel,
      disputed,
      tip,
    };
  });
  // 継承+血縁が完全に重なる場合に朱の継承線が上に来るよう、描画順を血縁→婚姻→継承にする。
  const EDGE_ORDER = { kinship: 0, marriage: 1, succession: 2 } as const;
  edges.sort((p, q) => EDGE_ORDER[p.edgeType] - EDGE_ORDER[q.edgeType]);

  // --- 複数在位コネクタ(同一人物のカプセルをカラム左側面経由の点線でつなぐ) ---
  const connectors: KinshipConnectorOut[] = [];
  for (const [id, caps] of capsulesById) {
    if (caps.length < 2) continue;
    for (let i = 0; i < caps.length - 1; i++) {
      const a = caps[i];
      const b = caps[i + 1];
      const x = a.x; // 左端(両カプセルとも同カラム=同x)
      const y1 = a.y + a.h - 4;
      const y2 = b.y + 4;
      const bulge = x - 18;
      connectors.push({
        personId: id,
        path: `M ${x} ${y1} C ${bulge} ${y1}, ${bulge} ${y2}, ${x} ${y2}`,
        tipTitle: `${a.label}（同一人物・復位）`,
      });
    }
  }

  // --- 王朝見出し(幻ブロックが予約した空間に置く。アンカーは各王朝の最初のカプセル) ---
  const placedByKey = new Map(placed.map((n) => [n.key, n]));
  const dynastyHeads: KinshipDynastyHead[] = blocks
    .filter((b) => b.phantomHead)
    .map((b) => {
      const anchor = placedByKey.get(b.phantomHead!.anchorKey);
      if (!anchor)
        throw new Error(
          `kinship-layout: 王朝見出しのアンカーが見つかりません: ${b.phantomHead!.anchorKey}`,
        );
      return { label: b.phantomHead!.label, x: anchor.cx, y: anchor.y - 7 };
    })
    .sort((p, q) => p.y - q.y);

  // --- テキスト版・SEO用の系譜主張一覧(時代順) ---
  const nodeAnchorY = (id: string) => capsulesById.get(id)?.[0]?.y ?? 0;
  const claimsList = src.claims
    .map((c) => {
      const emp = emperorById.get(c.claimant);
      const caps = capsulesById.get(c.claimant);
      if (!caps)
        throw new Error(`kinship-layout: 系譜主張のclaimantが解決できません: ${c.claimant}`);
      return {
        claimantId: c.claimant,
        claimantLabel: caps[0].label,
        dynastyLabel: emp ? emp.dynastyLabel : caps[0].groupLabel,
        ancestry: c.ancestry,
        source: c.sourcePage,
      };
    })
    .sort((p, q) => nodeAnchorY(p.claimantId) - nodeAnchorY(q.claimantId));

  // --- 目盛り(歴史年の50年刻み。0年は暦に存在しないため1年に置き換える) ---
  const ticks: { y: number; label: string }[] = [];
  for (let h = Math.ceil(fromAstroYear(minYear) / 50) * 50; ; h += 50) {
    const hist = h === 0 ? 1 : h;
    const astro = hist < 0 ? hist + 1 : hist;
    if (astro > maxYear) break;
    if (astro < minYear) continue;
    ticks.push({ y: yOf(astro), label: formatYear(hist) });
  }

  const height =
    Math.max(...placed.map((n) => n.y + n.h), yOf(maxYear)) + M_BOTTOM;
  const width =
    laneXs[KINSHIP_COLUMN_DEFS.length - 1] +
    laneWidth(KINSHIP_COLUMN_DEFS.length - 1) +
    60;

  return {
    width,
    height,
    ticks,
    axisX: AXIS_X,
    nodes: placed.map((n) => ({
      key: n.key,
      id: n.id,
      kind: n.kind,
      x: n.x,
      y: n.y,
      w: n.w,
      h: n.h,
      label: n.label,
      colorSlot: n.colorSlot,
      rootBadge: n.rootBadge,
      claimBadge: n.claimBadge,
      groupLabel: n.groupLabel,
      tip: n.tip,
    })),
    edges,
    connectors,
    dynastyHeads,
    claimsList,
  };
}
