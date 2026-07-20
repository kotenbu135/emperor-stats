// クライアントコンポーネントから安全にimportできる型・定数のみを置く（node:fsに依存しない）。
// data/emperors.jsonの実読み込みはlib/emperors.ts（サーバー専用）で行う。

export type DeathCauseCategory =
  | "病死"
  | "暗殺"
  | "処刑"
  | "戦死"
  | "自尽"
  | "事故死"
  | "不詳"
  | "諸説あり";

export type AccessionRouteCategory =
  | "世襲"
  | "簒奪"
  | "禅譲"
  | "擁立"
  | "復位"
  | "建国"
  | "不詳"
  | "諸説あり";

export type CourtEventKey =
  | "eraChangeCount"
  | "amnestyCount"
  | "empressInstallationCount"
  | "crownPrinceDepositionCount";

export type MilitaryEventKey =
  | "personalCampaignCount"
  | "rebellionSuppressionCount"
  | "rebellionSufferedCount";

export type AgeKey = "accessionAge" | "deathAge";

export type DynastyCategory = "正統" | "十六国" | "正統（反乱・自称）";

/** ある指標での全皇帝中の順位（lib/emperors.tsがビルド時に計算する）。 */
export interface MetricRank {
  /** 同値は同順位とするcompetition ranking（1, 2, 2, 4, …）。 */
  rank: number;
  /** 順位対象の人数。回数系は1回以上、年齢は判明している皇帝のみが対象。 */
  total: number;
  /** 同順位の皇帝が他にもいるか（表示で「タイ」を付す）。 */
  tied: boolean;
}

export interface EmperorRecord {
  id: string;
  name: string;
  dynastyName: string;
  dynastySection: string;
  dynastyKey: string;
  /** 表示用王朝名。王朝名のみ（同名王朝が複数時代にある場合のみ「呉・三国」のように時代を付す）。 */
  dynastyLabel: string;
  /** 訪問者向けの時代区分ラベル（例: 五胡十六国・南北朝）。王朝フィルタのグループ見出しに使う。 */
  eraLabel: string;
  dynastyCategory: DynastyCategory;
  reignApproxDays: number;
  reignYears: number;
  reignDurationLabel: string;
  reignNeedsPreciseDays: boolean;
  reignCount: number;
  deathCauseCategory: DeathCauseCategory;
  accessionRouteCategory: AccessionRouteCategory;
  eraChangeCount: number;
  amnestyCount: number;
  empressInstallationCount: number;
  crownPrinceDepositionCount: number;
  personalCampaignCount: number;
  rebellionSuppressionCount: number;
  rebellionSufferedCount: number;
  capitalRelocationCount: number;
  /** 即位時年齢（数え年）。調査済みだが生年不詳などで算出できない場合はnull。 */
  accessionAge: number | null;
  /** 没年齢（数え年）。同上。 */
  deathAge: number | null;
  /** 在位期間の表示文字列（例: "1908–1912年 / 1917年"）。復位者は期間ごとに区切る。 */
  periodsLabel: string;
  /** 諱（本名）・廟号・諡号。皇帝一覧の詳細表示用。 */
  personalName: string | null;
  templeName: string | null;
  posthumousName: string | null;
  /** 皇帝一覧の検索対象文字列（各種名称・別名・王朝名・時代を連結したもの）。 */
  searchText: string;
  hasPortrait: boolean;
  portraitUrl: string | null;
  /** 各指標の全皇帝中の順位（詳細ダイアログ用）。回数系の0回・年齢不明は対象外でnull。 */
  ranks: Record<RankingMetricKey, MetricRank | null>;
}

export interface DynastyOption {
  value: string;
  label: string;
  /** 所属する時代グループ（セレクトのグループ見出し）。 */
  era: string;
}

/** 復位者一覧の1行分。在位期間・復位の経緯はサーバー側で表示用文字列に整形して渡す。 */
export interface RestorationRow {
  id: string;
  name: string;
  dynastyLabel: string;
  dynastyKey: string;
  dynastyCategory: DynastyCategory;
  reignCount: number;
  /** 在位期間の表示文字列（例: "1908–1912 / 1917 / 1934–1945"）。 */
  periodsLabel: string;
  /** 各復位の経緯（原文noteの先頭一文）。復位ごとに1要素。 */
  restorationReasons: string[];
}

/** ランキング棒グラフで選択できる数値指標。サーバー→クライアント境界を関数でなく
 *  文字列キーで渡すための識別子（Client Componentに関数は渡せないため）。 */
export type RankingMetricKey =
  | "reignYears"
  | CourtEventKey
  | MilitaryEventKey
  | "capitalRelocationCount"
  | AgeKey;

export type CategoryMetricKey = "deathCauseCategory" | "accessionRouteCategory";

/** 「前221」「618」のような年表示。 */
export function formatYear(year: number): string {
  return year < 0 ? `前${-year}` : `${year}`;
}

/**
 * 年を連続座標（天文学的紀年）へ変換する。データの年は「前221年 = -221」で
 * 0年が暦に存在しないため、-1年と1年をそのまま引き算すると2年分になってしまう。
 * 負の年に+1して連続化し、位置・幅の計算はすべてこの座標系で行う。
 */
export function astroYear(year: number): number {
  return year < 0 ? year + 1 : year;
}

/** 通史年表の時代帯（訪問者向け時代区分ラベルの期間）。 */
export interface TimelineEraBand {
  label: string;
  /** ミニマップ・狭い帯で使う短縮ラベル。 */
  shortLabel: string;
  startYear: number;
  endYear: number;
  /** 時代帯どうしが重なる期間（東晋と五胡十六国など）はレーンを分けて描く。 */
  lane: number;
}

/** 通史年表の1在位セグメント（皇帝×在位期間。復位者は複数持つ）。 */
export interface TimelineSegment {
  emperorId: string;
  startYear: number;
  endYear: number;
  isRestoration: boolean;
}

/** 通史年表の王朝帯。帯は収録皇帝の在位年カバレッジの合併（建国〜滅亡年ではない）。 */
export interface TimelineDynastyBand {
  key: string;
  label: string;
  era: string;
  category: DynastyCategory;
  /** 縦のレーン番号（0が最上段）。並立王朝はレーンを分ける。 */
  lane: number;
  /** 配色スロット（--series-1〜8）。同時期に重なる帯とは別スロットを割り当てる。 */
  colorSlot: number;
  /** 帯全体の外接期間（レーン占有・ヒット判定に使う）。 */
  startYear: number;
  endYear: number;
  /** 皇帝が実在位した連続期間。2区間以上ある王朝は帯の内部にギャップがある
   *  （唐の武周中断・前秦の苻堅天王期など）。 */
  spans: { startYear: number; endYear: number }[];
  segments: TimelineSegment[];
  emperorCount: number;
}

/** 全王朝共通の皇帝不在期間（楚漢戦争期・王莽居摂期・民国期）。 */
export interface TimelineVacancy {
  startYear: number;
  endYear: number;
  label: string;
}

export interface TimelineData {
  startYear: number;
  endYear: number;
  eras: TimelineEraBand[];
  eraLaneCount: number;
  bands: TimelineDynastyBand[];
  laneCount: number;
  /** 正統王朝ブロックのレーン数。このレーン以降は並立・反乱政権ブロック
   *  （描画時に間隔を空けて上下2ブロックに分ける）。 */
  mainLaneCount: number;
  vacancies: TimelineVacancy[];
  /** astroYear(startYear)起点の各年の同時在位皇帝数（ミニマップの並立数カーブ用）。 */
  concurrency: number[];
  maxConcurrency: number;
}

/** 概算日数(365/30/7/1換算の共通尺度)を「○年○日」表記に変換する。 */
export function formatReignDuration(approxDays: number): string {
  // 金の末帝（完顔承麟）など即日退位・戦死のケース。「0日」では欠測に見えるため明示する。
  if (approxDays === 0) return "1日未満";
  const years = Math.floor(approxDays / 365);
  const days = approxDays - years * 365;
  if (years === 0) return `${days}日`;
  if (days === 0) return `${years}年`;
  return `${years}年${days}日`;
}

// value はデータ側のenum値（"十六国"は五代十国等も含む歴史的経緯のある内部値）。
// 訪問者に見せる label は実態に合わせた名称にする。
export const dynastyCategoryOptions: { value: DynastyCategory; label: string }[] = [
  { value: "正統", label: "正統王朝" },
  { value: "十六国", label: "並立政権" },
  { value: "正統（反乱・自称）", label: "反乱・自称政権" },
];

export const dynastyCategoryDescriptions: Record<DynastyCategory, string> = {
  正統: "歴代王朝の本流として続いた系譜の皇帝（例：前漢・唐・宋・明・清など）",
  十六国: "五胡十六国・五代十国など、複数の政権が同時に並び立った時代の各政権の皇帝",
  "正統（反乱・自称）": "正統王朝の統治下で、反乱・簒奪・自称により皇帝を名乗った勢力の皇帝",
};

export const courtEventLabels: Record<CourtEventKey, string> = {
  eraChangeCount: "改元回数",
  amnestyCount: "大赦回数",
  empressInstallationCount: "立后回数",
  crownPrinceDepositionCount: "皇太子廃立回数",
};

export const militaryEventLabels: Record<MilitaryEventKey, string> = {
  personalCampaignCount: "親征回数",
  rebellionSuppressionCount: "反乱鎮圧回数",
  rebellionSufferedCount: "被反乱回数",
};

export const ageLabels: Record<AgeKey, string> = {
  accessionAge: "即位時年齢",
  deathAge: "没年齢",
};

/** 時代グループの時代順（王朝フィルタのグループ見出し・時代別集計の並び）。 */
export const eraOrder: string[] = [
  "秦・前漢",
  "新〜後漢初",
  "後漢",
  "三国",
  "晋",
  "五胡十六国",
  "南北朝",
  "隋",
  "隋末",
  "唐",
  "五代十国",
  "宋・遼・西夏・金",
  "元",
  "明",
  "清",
];

export const deathCauseCategoryOrder: DeathCauseCategory[] = [
  "病死",
  "暗殺",
  "処刑",
  "戦死",
  "自尽",
  "事故死",
  "不詳",
  "諸説あり",
];

export const deathCauseDescriptions: Record<DeathCauseCategory, string> = {
  病死: "自然死・疾病による死（老衰を含む）",
  暗殺: "同一政権内部の臣下・近親・宦官等による謀殺（毒殺を含む）",
  処刑: "敵対勢力・後継政権・征服者による裁判・見せしめ的な公的処断",
  戦死: "親征・防衛戦・鎮圧戦などの戦闘中の死",
  自尽: "自殺・自害（廃位や敗戦に追い詰められての自裁を含む）",
  事故死: "落馬・溺死・火災等の事故による死",
  不詳: "死因の記録・手がかりが原典に見当たらない",
  諸説あり: "複数の原典・通説が対立し一つに絞れない",
};

export const accessionRouteCategoryOrder: AccessionRouteCategory[] = [
  "世襲",
  "簒奪",
  "禅譲",
  "擁立",
  "復位",
  "建国",
  "不詳",
  "諸説あり",
];

export const accessionRouteDescriptions: Record<AccessionRouteCategory, string> = {
  世襲: "先帝の子・兄弟など血縁者が、通常の手続き（遺詔・立太子からの継承等）で即位",
  簒奪: "臣下・軍閥・外戚などが実力・クーデターにより先帝から皇位を奪って即位",
  禅譲: "先帝から形式上・儀礼上の「譲位」を受けて即位",
  擁立: "臣下・軍閥・宦官・外戚等の主導により、本人の主体的な簒奪行為なしに即位",
  復位: "一度廃位・退位した後、再び即位した",
  建国: "王朝・政権を新規に樹立して自ら皇帝を称した",
  不詳: "即位の経緯が原典に見当たらない",
  諸説あり: "複数の原典・通説が対立し一つに絞れない",
};
