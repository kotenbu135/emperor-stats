// /lab（グラフ候補の実装検討面）専用の集計。**サーバー専用**（data-source 経由で
// data/emperors.json を読む）。クライアントから import しないこと。
//
// なぜ emperors.ts ではなくここか:
//  - /lab は「作る価値があるか」を実物で判断するための面で、採否が決まるまでは
//    公開ページの集計とライフサイクルが違う（候補ごと丸ごと消える可能性がある）
//  - emperors.ts は1600行あり、個別ページの改修と編集が衝突しやすい
// 採用が決まった候補は emperors.ts へ移し、ここから消す。
//
// **数値の正は `site/tools/chart-candidates-stats.py`**（読み取り専用・365名全件）。
// docs/site-design/CHART_CANDIDATES_2026-07-31.md が引用している値もその出力で、
// このファイルの各関数はスクリプトと同じ手順を写したもの。手順を変えると数が動くので、
// 変えるときはスクリプト側と突き合わせること（特に日付の埋め方・在位内の判定・
// count==0 の切り分けの3つは「同じやり方をしないと数が変わる」と明記されている）。
//
// 集計単位の時代は **`meta.catalogs.eras`（11区分）** を使う。サイト本体の時代ラベルは
// `emperors.ts` の `ERA_BY_SECTION`（15区分）だが、/lab は検討記録の数値と突き合わせる
// ための面なので、突き合わせ先と同じ粒度にしてある（採用時に組み替える。南北朝69名が
// 南朝・北朝へ割れて数字が動く）。
import { emperorsJson, eraCatalog, type CatalogEra } from "@/lib/data-source";

// ---------------------------------------------------------------- 生データの型
//
// **emperors.ts の RawEmperor は JSON の部分ビューで、ここで要るフィールドを
// 持っていない**（eraId・confidence・reignSummary.lastEndYear・reigns[].startDate）。
// 読み込みは `as unknown as` を通るため、宣言し忘れたフィールドは型エラーにならず
// undefined になって「全部ゼロの図」が静かに出来上がる。触る値は必ずここに書く。

interface LabReign {
  startYear: number;
  endYear: number;
  startDate: string | null;
  endDate: string | null;
  datePrecision: { start: string; end: string };
  duration: { approxDays: number };
}

interface LabCount {
  count: number;
  confidence?: string;
  events: { date?: string | null; startDate?: string | null }[];
}

interface LabEmperor {
  id: string;
  name: { commonName: string | null };
  eraId: string;
  regimeId: string;
  regimeLabel: string;
  standing: string;
  standingLabel: string;
  /** data-source が組み立てる（category は regimeCategory の表示ラベル）。 */
  dynasty: { name: string; category: string; section: string };
  reignSummary: {
    reignCount: number;
    firstStartYear: number;
    lastEndYear: number;
    totalReignDuration: { approxDays: number; isExact: boolean };
  };
  deathCause: { category: string; confidence?: string };
  accessionRoute: {
    category: string;
    confidence?: string;
    axes: {
      throneSource: string;
      titleOrigin: string;
      decidedBy: string[];
      relationToPredecessor: string;
      procedure: string;
    };
  };
  verification: { confidence?: string };
  ages: { confidence?: string };
  eraChangeCount: LabCount;
  amnestyCount: LabCount;
  empressInstallationCount: LabCount;
  crownPrinceDepositionCount: LabCount;
  capitalRelocationCount: LabCount;
  personalCampaignCount: LabCount;
  rebellionSuppressionCount: LabCount;
  rebellionSufferedCount: LabCount;
  reigns: LabReign[];
}

const emperors = emperorsJson.emperors as unknown as LabEmperor[];
const eras: CatalogEra[] = [...eraCatalog].sort((a, b) => a.sortOrder - b.sortOrder);

/** 1年の日数（approxDays は年=365換算なので、年へ戻す除数はスクリプトと揃える）。 */
const DAYS_PER_YEAR = 365.2422;

/** 非業の死（暗殺・処刑・戦死・自尽）。死因ラベルは data-source が解決済み。 */
const VIOLENT_DEATHS = new Set(["暗殺", "処刑", "戦死", "自尽"]);

function pct(a: number, b: number): number {
  return b === 0 ? 0 : Math.round((100 * a) / b);
}

function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function medianYears(group: LabEmperor[]): number {
  return (
    Math.round(
      (median(group.map((e) => e.reignSummary.totalReignDuration.approxDays)) /
        DAYS_PER_YEAR) *
        100,
    ) / 100
  );
}

/** 時代ごとに分ける（11区分・sortOrder 順・**近代を落とさない**）。 */
function byEra(): { era: CatalogEra; group: LabEmperor[] }[] {
  return eras.map((era) => ({
    era,
    group: emperors.filter((e) => e.eraId === era.id),
  }));
}

// ---------------------------------------------------------------- 日付ユーティリティ
//
// スクリプトの jdn2()／iso_y2() の写し。**埋め方を変えると同時在位数が変わる**
// （欠けた月は開始側1月・終了側12月、欠けた日は開始側1日・終了側28日）。

/** ISO 日付文字列（"-0221-01-01" / "0618-11" / "0618"）→ ユリウス通日。 */
function toJdn(iso: string | null | undefined, isEnd: boolean): number | null {
  if (!iso) return null;
  const neg = iso.startsWith("-");
  const parts = (neg ? iso.slice(1) : iso).split("-");
  const y0 = Number(parts[0]);
  if (!Number.isFinite(y0)) return null;
  const y = neg ? -y0 : y0;
  const m = parts.length > 1 ? Number(parts[1]) : isEnd ? 12 : 1;
  const d = parts.length > 2 ? Number(parts[2]) : isEnd ? 28 : 1;
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045
  );
}

/** ユリウス通日 → 天文年（0年あり）。 */
function jdnToYear(jdn: number): number {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return 100 * b + d - 4800 + Math.floor((m + 2) / 12);
}

/** ISO 日付文字列の年（天文年）。 */
function isoYear(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const neg = iso.startsWith("-");
  const y = Number((neg ? iso.slice(1) : iso).split("-")[0]);
  if (!Number.isFinite(y)) return null;
  return neg ? -y : y;
}

/** 歴史紀年（前221年 = -221）→ 天文年（0年あり）。 */
function astro(year: number): number {
  return year < 0 ? year + 1 : year;
}

// ================================================================ 共通の型

/** 積み上げ1行（CategoryBar 1本 ＋ 行見出し）。 */
export interface LabStackedRow {
  label: string;
  /** 母集団。行見出しの脇に必ず出す。 */
  count: number;
  /** segments と同じ並びの実数。 */
  values: number[];
  /** 行の右端に出す1つの数値（見出しの主張）。 */
  highlight: string;
}

export interface LabSegment {
  name: string;
  /** 凡例の title に出す補足（区分の含意など）。 */
  detail?: string;
}

// ================================================================ 候補1 親征

export interface LabCampaign {
  /** 在位年範囲内の親征に限った時代別の経験率（**表はこれ1つだけ**）。 */
  bars: { label: string; n: number; withReign: number; percent: number }[];
  /** 365名全体（在位内に限らない）。1枚に絞るならこの数。 */
  overallCount: number;
  overallPercent: number;
  /** 在位年範囲内に限った全体。 */
  withinCount: number;
  withinPercent: number;
  /** 親征イベント291件の内訳（在位年内 / 範囲外＝称帝前など / 日付なし）。 */
  events: { within: number; outside: number; undated: number; total: number };
  /** 回数の上位（形を持つ層＝北族系の政権に集中する）。 */
  top: { name: string; regime: string; count: number }[];
}

/** イベントの ISO 年が、いずれかの在位の ISO 年範囲に入るか（スクリプトの in_reign_year）。
 *  `startYear`/`endYear` は歴史紀年なので、天文年へ直してから比べる。 */
function inReignYear(e: LabEmperor, iso: string | null | undefined): boolean | null {
  const y = isoYear(iso);
  if (y === null) return null;
  return e.reigns.some((r) => astro(r.startYear) <= y && y <= astro(r.endYear));
}

export function getCampaignStats(): LabCampaign {
  const withinOf = (e: LabEmperor) =>
    e.personalCampaignCount.events.some(
      (ev) => inReignYear(e, ev.startDate ?? ev.date) === true,
    );

  const bars = byEra().map(({ era, group }) => {
    const withReign = group.filter(withinOf).length;
    return {
      label: era.label,
      n: group.length,
      withReign,
      percent: pct(withReign, group.length),
    };
  });

  const overallCount = emperors.filter((e) => e.personalCampaignCount.count > 0).length;
  const withinCount = emperors.filter(withinOf).length;

  let within = 0;
  let outside = 0;
  let undated = 0;
  for (const e of emperors) {
    for (const ev of e.personalCampaignCount.events) {
      const hit = inReignYear(e, ev.startDate ?? ev.date);
      if (hit === null) undated += 1;
      else if (hit) within += 1;
      else outside += 1;
    }
  }

  const top = [...emperors]
    .sort((a, b) => b.personalCampaignCount.count - a.personalCampaignCount.count)
    .slice(0, 6)
    .map((e) => ({
      name: e.name.commonName ?? e.id,
      regime: e.regimeLabel,
      count: e.personalCampaignCount.count,
    }));

  return {
    bars,
    overallCount,
    overallPercent: pct(overallCount, emperors.length),
    withinCount,
    withinPercent: pct(withinCount, emperors.length),
    events: { within, outside, undated, total: within + outside + undated },
    top,
  };
}

// ================================================================ 候補2 建前と実態

export interface LabFacade {
  segments: LabSegment[];
  rows: LabStackedRow[];
  /** 見出しに使う1行（禅譲儀礼19件のうち18件が「本人」）。 */
  ceremony: { total: number; self: number };
  /** 「史料から決着不能」17名が全員「通常の践祚」であること。 */
  undeterminedAllNormal: boolean;
}

const DECIDED_BY_ORDER = ["本人", "先帝", "第三者", "史料から決着不能"] as const;

/** decidedBy は配列。導出ルールと同じ優先順位（本人 > 先帝 > 第三者）で1つに畳む。 */
function foldDecidedBy(values: string[]): string {
  for (const key of DECIDED_BY_ORDER) {
    if (values.includes(key)) return key;
  }
  return "史料から決着不能";
}

export function getFacadeStats(): LabFacade {
  const byProcedure = new Map<string, Map<string, number>>();
  for (const e of emperors) {
    const p = e.accessionRoute.axes.procedure;
    const k = foldDecidedBy(e.accessionRoute.axes.decidedBy);
    const row = byProcedure.get(p) ?? new Map<string, number>();
    row.set(k, (row.get(k) ?? 0) + 1);
    byProcedure.set(p, row);
  }

  const rows: LabStackedRow[] = [...byProcedure.entries()]
    .map(([procedure, counts]) => {
      const values = DECIDED_BY_ORDER.map((k) => counts.get(k) ?? 0);
      const total = values.reduce((a, b) => a + b, 0);
      return {
        label: procedure,
        count: total,
        values,
        // 「先帝が決めた」割合を右端に出す — この図の主張は「建前どおりに
        // 前の皇帝の意思で位が動いたのはどれくらいか」なので、その1列を読ませる。
        highlight: `先帝の意思 ${pct(values[1], total)}%`,
      };
    })
    .sort((a, b) => b.count - a.count);

  const ceremonyRow = byProcedure.get("禅譲儀礼");
  const undetermined = emperors.filter(
    (e) => foldDecidedBy(e.accessionRoute.axes.decidedBy) === "史料から決着不能",
  );

  return {
    segments: DECIDED_BY_ORDER.map((name) => ({
      name,
      detail:
        name === "史料から決着不能"
          ? "原典が経緯を書かず、誰の意思で位が動いたか決められないもの"
          : undefined,
    })),
    rows,
    ceremony: {
      total: [...(ceremonyRow?.values() ?? [])].reduce((a, b) => a + b, 0),
      self: ceremonyRow?.get("本人") ?? 0,
    },
    undeterminedAllNormal: undetermined.every(
      (e) => e.accessionRoute.axes.procedure === "通常の践祚",
    ),
  };
}

// ================================================================ 候補3 一世一元

/** 最初の年号「建元」は前140年（漢武帝）。これより前に在位を終えた皇帝は制度の成立前。
 *  切り分けは **note の文言ではなく在位年で機械的に**決める（「年号制度」「元号制度」の
 *  表記ゆれで後少帝が誤って落ちる。原文保持フィールドを集計軸に使わない）。 */
const FIRST_ERA_NAME_YEAR = -140;

export interface LabEraChange {
  segments: LabSegment[];
  rows: LabStackedRow[];
  /** 年号制度の成立前（count==0 かつ lastEndYear < -140）。 */
  preInstitution: { count: number; names: string[] };
  /** count==0 のうち「先帝の元号を継続使用した」側。 */
  continued: number;
  /** 制度成立前に在位を終えたのに count>0 の皇帝（前元/中元/後元の紀年更新）。 */
  preInstitutionWithCount: { name: string; count: number }[];
}

export function getEraChangeStats(): LabEraChange {
  const isPreInstitution = (e: LabEmperor) =>
    e.eraChangeCount.count === 0 && e.reignSummary.lastEndYear < FIRST_ERA_NAME_YEAR;

  const rows: LabStackedRow[] = byEra().map(({ era, group }) => {
    const pre = group.filter(isPreInstitution).length;
    // count >= 2 の意味は「即位に伴う最初の建元のあとに、さらに元号を変えた」。
    // 「2回改元した」ではない（eraChangeCount は最初の建元を1回に数える）。
    const changed = group.filter((e) => e.eraChangeCount.count >= 2).length;
    const kept = group.length - pre - changed;
    return {
      label: era.label,
      count: group.length,
      values: [changed, kept, pre],
      highlight: `${pct(changed, group.length)}%`,
    };
  });

  const zero = emperors.filter((e) => e.eraChangeCount.count === 0);
  const pre = zero.filter((e) => e.reignSummary.lastEndYear < FIRST_ERA_NAME_YEAR);

  return {
    segments: [
      { name: "即位後に元号を変えた", detail: "eraChangeCount >= 2（最初の建元を含む数え方）" },
      { name: "変えなかった", detail: "在位中に使った元号は1つ、または先帝の元号を継続" },
      {
        name: "年号制度の成立前",
        detail: "最初の年号「建元」（前140年・漢武帝）より前に在位を終えた皇帝",
      },
    ],
    rows,
    preInstitution: {
      count: pre.length,
      names: pre.map((e) => e.name.commonName ?? e.id),
    },
    continued: zero.length - pre.length,
    preInstitutionWithCount: emperors
      .filter(
        (e) =>
          e.reignSummary.lastEndYear < FIRST_ERA_NAME_YEAR && e.eraChangeCount.count > 0,
      )
      .map((e) => ({ name: e.name.commonName ?? e.id, count: e.eraChangeCount.count })),
  };
}

/** 時代ごとの「1人の皇帝が使った元号の数」の最大（段差がもう一度出る側）。 */
export function getEraNameMax(): { label: string; max: number }[] {
  return byEra().map(({ era, group }) => ({
    label: era.label,
    max: Math.max(...group.map((e) => e.eraChangeCount.count)),
  }));
}

// ================================================================ 候補4 帝号の新称

export interface LabTitleOrigin {
  slices: { name: string; count: number; percentLabel: string }[];
  /** 新称93名の内訳（throneSource 別）。 */
  newBreakdown: { name: string; count: number }[];
  medianNew: number;
  medianInherited: number;
}

export function getTitleOriginStats(): LabTitleOrigin {
  const isNew = (e: LabEmperor) => e.accessionRoute.axes.titleOrigin === "新称";
  const news = emperors.filter(isNew);
  const inherited = emperors.filter((e) => !isNew(e));

  const counts = new Map<string, number>();
  for (const e of news) {
    const k = e.accessionRoute.axes.throneSource;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  return {
    slices: [
      {
        name: "継承（先代からの帝号を受け継いだ）",
        count: inherited.length,
        percentLabel: `${pct(inherited.length, emperors.length)}%`,
      },
      {
        name: "新称（帝号を新たに称した）",
        count: news.length,
        percentLabel: `${pct(news.length, emperors.length)}%`,
      },
    ],
    newBreakdown: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count })),
    medianNew: medianYears(news),
    medianInherited: medianYears(inherited),
  };
}

// ================================================================ 候補5 政権の性格と末路

export interface LabRegimeFate {
  segments: LabSegment[];
  rows: LabStackedRow[];
  /** standing で切った側（`rival` 20名・在位中央値0.32年）。図でなく数字が主役。 */
  rival: { count: number; violentPercent: number; medianYears: number };
  regular: { count: number; violentPercent: number; medianYears: number };
  medians: { label: string; years: number }[];
}

const REGIME_CATEGORY_ORDER = ["統一王朝", "分裂期の王朝", "反乱・自称政権"] as const;

function violentPercent(group: LabEmperor[]): number {
  return pct(
    group.filter((e) => VIOLENT_DEATHS.has(e.deathCause.category)).length,
    group.length,
  );
}

export function getRegimeFateStats(): LabRegimeFate {
  const rows: LabStackedRow[] = REGIME_CATEGORY_ORDER.map((category) => {
    const group = emperors.filter((e) => e.dynasty.category === category);
    const violent = group.filter((e) => VIOLENT_DEATHS.has(e.deathCause.category)).length;
    return {
      label: category,
      count: group.length,
      values: [violent, group.length - violent],
      highlight: `非業の死 ${pct(violent, group.length)}%`,
    };
  });

  const rival = emperors.filter((e) => e.standing === "rival");
  const regular = emperors.filter((e) => e.standing !== "rival");

  return {
    segments: [
      { name: "非業の死", detail: "暗殺・処刑・戦死・自尽" },
      { name: "それ以外", detail: "病死・事故死・不詳・諸説あり" },
    ],
    rows,
    rival: {
      count: rival.length,
      violentPercent: violentPercent(rival),
      medianYears: medianYears(rival),
    },
    regular: {
      count: regular.length,
      violentPercent: violentPercent(regular),
      medianYears: medianYears(regular),
    },
    medians: REGIME_CATEGORY_ORDER.map((category) => ({
      label: category,
      years: medianYears(emperors.filter((e) => e.dynasty.category === category)),
    })),
  };
}

// ================================================================ 候補6 先帝との血縁

/** 規約が明記している丸め方（直系／傍系／養子／外戚／無血縁／その他／該当なし）。
 *  キーはカタログの表示ラベル。**未知のラベルは throw する** — カタログに続柄が
 *  増えたときに、黙って「その他」へ落ちるのではなくビルドで気づくため。 */
const RELATION_ROLLUP: Record<string, string> = {
  子: "直系",
  孫: "直系",
  曾孫: "直系",
  弟: "傍系",
  兄: "傍系",
  甥: "傍系",
  姪: "傍系",
  叔父: "傍系",
  伯父: "傍系",
  従兄弟: "傍系",
  "同族（遠縁）": "傍系",
  父: "傍系",
  母: "傍系",
  祖父: "傍系",
  外祖父: "傍系",
  養子: "養子",
  女婿: "外戚",
  "舅（妻の父）": "外戚",
  "外戚（その他）": "外戚",
  無血縁: "無血縁",
  不明: "その他",
  その他: "その他",
  該当なし: "該当なし",
};

export interface LabRelation {
  slices: { name: string; count: number; percentLabel: string; detail?: string }[];
}

export function getRelationStats(): LabRelation {
  const counts = new Map<string, number>();
  for (const e of emperors) {
    const label = e.accessionRoute.axes.relationToPredecessor;
    const rolled = RELATION_ROLLUP[label];
    if (!rolled) {
      throw new Error(
        `lab-stats: relationToPredecessor "${label}" の丸め先が RELATION_ROLLUP にありません` +
          "（カタログに続柄が増えたら丸め方も決めること）",
      );
    }
    counts.set(rolled, (counts.get(rolled) ?? 0) + 1);
  }
  return {
    slices: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        percentLabel: `${pct(count, emperors.length)}%`,
        detail:
          name === "該当なし"
            ? "「前任者がいない」ではなく、位を受けた前帝がいないという意味"
            : undefined,
      })),
  };
}

// ================================================================ 候補7 同時在位数

export interface LabConcurrent {
  /** 年ごとの2本（年単位＝その年のうちに帝号を持った人数 / 日単位＝その年の最大同時在位数）。 */
  points: { year: number; yearBased: number; dayBased: number }[];
  yearMax: { value: number; year: number };
  dayMax: { value: number; date: string };
  /** 日単位で区間を作れた在位／全在位。 */
  segments: { usable: number; total: number };
  /** 年単位の並立数の分布（何人の年が何年あるか）。 */
  distribution: { people: number; years: number }[];
  /** 表示範囲（近代は収録基準の産物なので切る）。 */
  range: { from: number; to: number };
  /** 表示範囲から外した在位（近代）。 */
  excluded: { name: string; regime: string; period: string }[];
  /** 皇帝が1人もいない年（表示範囲内）。 */
  zeroYears: number[];
}

/** 近代（袁世凱の洪憲・溥儀の満洲国）は収録基準の産物で、間の空白年は歴史的空位ではない。
 *  折れ線に出すと「1913〜1933年に皇帝がいなかった」と読めてしまうので表示範囲を切る。 */
const CONCURRENT_LAST_YEAR = 1912;

export function getConcurrentStats(): LabConcurrent {
  // --- 年単位（startYear〜endYear・全374在位）
  const yearCount = new Map<number, number>();
  for (const e of emperors) {
    for (const r of e.reigns) {
      for (let y = r.startYear; y <= r.endYear; y += 1) {
        yearCount.set(y, (yearCount.get(y) ?? 0) + 1);
      }
    }
  }

  // --- 日単位（startDate〜endDate・日付で区間を作れる在位のみ）
  //     欠けた月は開始側1月・終了側12月、欠けた日は開始側1日・終了側28日で埋める。
  //     **埋め方は区間を伸ばす向き**なので、この値は上限側の見積り。
  let usable = 0;
  let total = 0;
  const deltas = new Map<number, number>();
  for (const e of emperors) {
    for (const r of e.reigns) {
      total += 1;
      const s = toJdn(r.startDate, false);
      const t = toJdn(r.endDate, true);
      if (s === null || t === null || t < s) continue;
      usable += 1;
      deltas.set(s, (deltas.get(s) ?? 0) + 1);
      deltas.set(t + 1, (deltas.get(t + 1) ?? 0) - 1);
    }
  }
  const boundaries = [...deltas.keys()].sort((a, b) => a - b);
  const dayMaxByYear = new Map<number, number>();
  let current = 0;
  let dayMax = { value: 0, jdn: 0 };
  for (let i = 0; i < boundaries.length; i += 1) {
    current += deltas.get(boundaries[i]) ?? 0;
    if (current > dayMax.value) dayMax = { value: current, jdn: boundaries[i] };
    if (current === 0) continue;
    // この区間 [boundaries[i], boundaries[i+1]) が跨ぐ年すべてに、この人数を配る。
    const from = jdnToYear(boundaries[i]);
    const to = i + 1 < boundaries.length ? jdnToYear(boundaries[i + 1] - 1) : from;
    for (let y = from; y <= to; y += 1) {
      dayMaxByYear.set(y, Math.max(dayMaxByYear.get(y) ?? 0, current));
    }
  }

  const years = [...yearCount.keys()];
  const from = Math.min(...years);
  const points: LabConcurrent["points"] = [];
  const zeroYears: number[] = [];
  for (let y = from; y <= CONCURRENT_LAST_YEAR; y += 1) {
    if (y === 0) continue; // 歴史紀年に0年は無い
    const yearBased = yearCount.get(y) ?? 0;
    if (yearBased === 0) zeroYears.push(y);
    points.push({
      year: y,
      yearBased,
      // 日単位は天文年で数えているので、紀元前は歴史紀年へ戻して引く。
      dayBased: dayMaxByYear.get(astro(y)) ?? 0,
    });
  }

  let yearMaxValue = 0;
  let yearMaxYear = 0;
  for (const [y, v] of yearCount) {
    if (v > yearMaxValue) {
      yearMaxValue = v;
      yearMaxYear = y;
    }
  }

  const dist = new Map<number, number>();
  for (const p of points) dist.set(p.yearBased, (dist.get(p.yearBased) ?? 0) + 1);

  const maxDate = (() => {
    const y = jdnToYear(dayMax.jdn);
    // 月日は月初からの日数で戻す（表示だけの用途なので簡易に求める）。
    let m = 12;
    let d = 1;
    for (let mm = 1; mm <= 12; mm += 1) {
      const first = toJdn(`${String(y).padStart(4, "0")}-${String(mm).padStart(2, "0")}`, false);
      if (first !== null && first <= dayMax.jdn) {
        m = mm;
        d = dayMax.jdn - first + 1;
      }
    }
    return `${y}年${m}月${d}日`;
  })();

  const excluded = emperors
    .filter((e) => e.reignSummary.lastEndYear > CONCURRENT_LAST_YEAR)
    .map((e) => ({
      name: e.name.commonName ?? e.id,
      regime: e.regimeLabel,
      period: `${e.reignSummary.firstStartYear}–${e.reignSummary.lastEndYear}年`,
    }));

  return {
    points,
    yearMax: { value: yearMaxValue, year: yearMaxYear },
    dayMax: { value: dayMax.value, date: maxDate },
    segments: { usable, total },
    distribution: [...dist.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([people, yearsCount]) => ({ people, years: yearsCount })),
    range: { from, to: CONCURRENT_LAST_YEAR },
    excluded,
    zeroYears,
  };
}

// ================================================================ 候補8 在位継続率

export interface LabSurvival {
  /** 折れ線用（0〜50年を0.25年刻み）。 */
  curve: { years: number; all: number; exact: number }[];
  /** 検討記録と突き合わせる目盛り。 */
  marks: { years: number; all: number; exact: number }[];
  counts: { all: number; exact: number };
  medianAll: number;
  medianExact: number;
  medianFirst: number;
  meanAll: number;
  aboveMean: number;
}

const SURVIVAL_MARKS = [0.5, 1, 2, 3, 5, 10, 15, 20, 30, 50];

export function getSurvivalStats(): LabSurvival {
  const all = emperors.map((e) => e.reignSummary.totalReignDuration.approxDays);
  const exact = emperors
    .filter((e) => e.reignSummary.totalReignDuration.isExact)
    .map((e) => e.reignSummary.totalReignDuration.approxDays);
  const first = emperors.map((e) => e.reigns[0].duration.approxDays);

  // 折れ線は小数1桁、目盛りの表は整数。**丸めた値をもう一度丸めない**
  // （81.48% を 81.5 に丸めてから整数へ落とすと 82% になり、検討記録の 81% と1点ずれる）。
  const share = (vals: number[], years: number, digits: number) => {
    const raw = (100 * vals.filter((v) => v >= years * DAYS_PER_YEAR).length) / vals.length;
    const f = 10 ** digits;
    return Math.round(raw * f) / f;
  };

  const curve: LabSurvival["curve"] = [];
  for (let y = 0; y <= 50.0001; y += 0.25) {
    const years = Math.round(y * 100) / 100;
    curve.push({ years, all: share(all, years, 1), exact: share(exact, years, 1) });
  }

  const mean = all.reduce((a, b) => a + b, 0) / all.length;

  return {
    curve,
    marks: SURVIVAL_MARKS.map((years) => ({
      years,
      all: share(all, years, 0),
      exact: share(exact, years, 0),
    })),
    counts: { all: all.length, exact: exact.length },
    medianAll: Math.round((median(all) / DAYS_PER_YEAR) * 100) / 100,
    medianExact: Math.round((median(exact) / DAYS_PER_YEAR) * 100) / 100,
    medianFirst: Math.round((median(first) / DAYS_PER_YEAR) * 100) / 100,
    meanAll: Math.round((mean / DAYS_PER_YEAR) * 100) / 100,
    aboveMean: all.filter((v) => v >= mean).length,
  };
}

// ================================================================ 候補9 項目別の確からしさ

export interface LabConfidence {
  rows: { label: string; high: number; medium: number; low: number; highPercent: number }[];
  total: { high: number; medium: number; low: number; empty: number; cells: number };
  /** 12番目のフィールド（verification）。他の11とは問いが違うので表から外す。 */
  verification: { high: number; medium: number; low: number; highPercent: number };
  /** confidence が空文字のセル（KNOWN_EMPTY_CONFIDENCE の既知バックログ）。 */
  emptyCells: { id: string; field: string }[];
}

/** 表に出す11項目。**「データセットの12調査項目」ではない**（在位データの列が無く、
 *  12番目の verification は「皇帝号を確認できたか」で他の11とは問いが違う）。 */
const CONFIDENCE_FIELDS: { key: keyof LabEmperor; label: string }[] = [
  { key: "capitalRelocationCount", label: "遷都" },
  { key: "crownPrinceDepositionCount", label: "皇太子廃立" },
  { key: "eraChangeCount", label: "改元" },
  { key: "accessionRoute", label: "即位経路" },
  { key: "empressInstallationCount", label: "立后" },
  { key: "personalCampaignCount", label: "親征" },
  { key: "amnestyCount", label: "大赦" },
  { key: "deathCause", label: "死因" },
  { key: "ages", label: "年齢" },
  { key: "rebellionSuppressionCount", label: "反乱鎮圧" },
  { key: "rebellionSufferedCount", label: "被反乱" },
];

function confidenceOf(e: LabEmperor, key: keyof LabEmperor): string {
  const field = e[key] as { confidence?: string } | undefined;
  if (!field || field.confidence === undefined) {
    throw new Error(`lab-stats: ${e.id} の ${String(key)}.confidence がありません`);
  }
  return field.confidence;
}

export function getConfidenceStats(): LabConfidence {
  const rows = CONFIDENCE_FIELDS.map(({ key, label }) => {
    let high = 0;
    let medium = 0;
    let low = 0;
    for (const e of emperors) {
      const c = confidenceOf(e, key);
      if (c === "high") high += 1;
      else if (c === "medium") medium += 1;
      else if (c === "low") low += 1;
      // 空文字は既知バックログ（KNOWN_EMPTY_CONFIDENCE）。
      // **第4のカテゴリにしない** — 帯にも凡例にも出さず、注記で件数だけ言う。
    }
    return { label, high, medium, low, highPercent: pct(high, emperors.length) };
  });

  const allFields: (keyof LabEmperor)[] = [
    ...CONFIDENCE_FIELDS.map((f) => f.key),
    "verification",
  ];
  const total = { high: 0, medium: 0, low: 0, empty: 0, cells: 0 };
  const emptyCells: { id: string; field: string }[] = [];
  for (const e of emperors) {
    for (const key of allFields) {
      const c = confidenceOf(e, key);
      total.cells += 1;
      if (c === "high") total.high += 1;
      else if (c === "medium") total.medium += 1;
      else if (c === "low") total.low += 1;
      else {
        total.empty += 1;
        emptyCells.push({ id: e.id, field: String(key) });
      }
    }
  }

  let vh = 0;
  let vm = 0;
  let vl = 0;
  for (const e of emperors) {
    const c = confidenceOf(e, "verification");
    if (c === "high") vh += 1;
    else if (c === "medium") vm += 1;
    else if (c === "low") vl += 1;
  }

  return {
    rows: rows.sort((a, b) => b.highPercent - a.highPercent),
    total,
    verification: { high: vh, medium: vm, low: vl, highPercent: pct(vh, emperors.length) },
    emptyCells,
  };
}

// ================================================================ 共通

export const labEmperorCount = emperors.length;
