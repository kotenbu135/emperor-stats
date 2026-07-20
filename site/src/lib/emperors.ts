import fs from "node:fs";
import path from "node:path";
import { BASE_PATH } from "@/lib/base-path";
import {
  eraOrder,
  formatReignDuration,
  type AccessionRouteCategory,
  type DeathCauseCategory,
  type DynastyCategory,
  type DynastyOption,
  type EmperorRecord,
  type MetricRank,
  type RankingMetricKey,
  type RestorationRow,
} from "@/lib/emperor-types";

export * from "@/lib/emperor-types";

const dataPath = path.join(process.cwd(), "..", "data", "emperors.json");
const rawData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

const portraitsDir = path.join(process.cwd(), "public", "portraits");
const portraitIds = new Set(
  fs
    .readdirSync(portraitsDir)
    .filter((f) => f.endsWith(".webp"))
    .map((f) => f.replace(/\.webp$/, "")),
);

interface RawEmperor {
  id: string;
  name: {
    commonName: string | null;
    personalName: string | null;
    posthumousName: string | null;
    templeName: string | null;
    aliases: string[];
  };
  dynasty: { name: string; category: DynastyCategory; section: string };
  reignSummary: {
    totalReignDuration: {
      displayYears: number;
      approxDays: number;
      needsPreciseDays: boolean;
    };
    reignCount: number;
  };
  deathCause?: { category: DeathCauseCategory };
  accessionRoute?: { category: AccessionRouteCategory };
  eraChangeCount?: { count: number };
  amnestyCount?: { count: number };
  empressInstallationCount?: { count: number };
  crownPrinceDepositionCount?: { count: number };
  personalCampaignCount?: { count: number };
  rebellionSuppressionCount?: { count: number };
  rebellionSufferedCount?: { count: number };
  capitalRelocationCount?: { count: number };
  ages?: { accessionAge: number | null; deathAge: number | null };
  reigns: RawReign[];
}

interface EmperorsData {
  meta: { count: number; generatedAt: string };
  emperors: RawEmperor[];
}

const data = rawData as unknown as EmperorsData;

export const emperorCount = data.meta.count;

/**
 * 王朝名・皇帝名は元データの時点で全角括弧を含むことがある
 * （例: dynasty.section="秦（始皇帝以降）"、name.commonName="聖祖（康熙帝）"）。
 * これをそのまま「名前（王朝（区分（…）））」のように結合すると多重括弧になり読みにくいため、
 * 表示用ラベルではまず内部の括弧をナカグロ「・」に統一してから、外側の括弧1段だけで結合する。
 */
function toNakaguro(text: string): string {
  return text
    .replace(/[（(]/g, "・")
    .replace(/[）)]/g, "")
    .replace(/・+/g, "・")
    .replace(/^・|・$/g, "");
}

/**
 * dynasty.section は調査時のブロック名（内部管理用語。例: "宋遼西夏金"・"秦（始皇帝以降）"）で、
 * そのまま画面に出すと訪問者には意味が通らない。ここで訪問者向けの時代区分ラベルへ変換する。
 * ここに無いsection（五胡十六国の各国・反乱政権など、section＝王朝名のブロック）は
 * ERA_BY_SELF_SECTION で個別に割り当てる。
 */
const ERA_BY_SECTION: Record<string, string> = {
  "秦（始皇帝以降）": "秦・前漢",
  新: "新〜後漢初",
  "漢（赤眉軍）": "新〜後漢初",
  成家: "新〜後漢初",
  梁: "新〜後漢初", // 劉永の梁（更始政権崩壊後の自立勢力）
  後漢: "後漢",
  仲家: "後漢", // 袁術（後漢末）
  三国時代: "三国",
  晋: "晋",
  楚: "晋", // 桓楚（東晋末）
  前趙: "五胡十六国",
  後趙: "五胡十六国",
  成漢: "五胡十六国",
  前涼: "五胡十六国",
  前燕: "五胡十六国",
  前秦: "五胡十六国",
  後燕: "五胡十六国",
  後秦: "五胡十六国",
  西燕: "五胡十六国",
  南燕: "五胡十六国",
  夏: "五胡十六国",
  南朝: "南北朝",
  北朝: "南北朝",
  隋: "隋",
  隋末群雄: "隋末",
  唐: "唐",
  五代十国: "五代十国",
  宋遼西夏金: "宋・遼・西夏・金",
  元: "元",
  明: "明",
  清: "清",
};

function eraLabelOf(dynasty: RawEmperor["dynasty"]): string {
  const era = ERA_BY_SECTION[dynasty.section];
  if (!era) {
    throw new Error(
      `未対応の調査ブロック名です: "${dynasty.section}"（ERA_BY_SECTIONに時代ラベルを追加してください）`,
    );
  }
  return era;
}

/** 同じ王朝名が複数の時代に存在するもの（呉・宋・楚・斉など）。表示時に時代を付して区別する。 */
const duplicatedDynastyNames: Set<string> = (() => {
  const sectionsByName = new Map<string, Set<string>>();
  for (const e of data.emperors) {
    const set = sectionsByName.get(e.dynasty.name) ?? new Set<string>();
    set.add(e.dynasty.section);
    sectionsByName.set(e.dynasty.name, set);
  }
  return new Set(
    [...sectionsByName.entries()].filter(([, s]) => s.size > 1).map(([n]) => n),
  );
})();

/** 同名王朝の区別に付す時代サフィックス。長い時代名は短縮する。 */
const ERA_SUFFIX: Record<string, string> = {
  "宋・遼・西夏・金": "宋金代",
  五胡十六国: "五胡",
  "新〜後漢初": "後漢初",
};

function dynastyLabel(dynasty: RawEmperor["dynasty"]): string {
  const name = toNakaguro(dynasty.name);
  if (!duplicatedDynastyNames.has(dynasty.name)) return name;
  const era = eraLabelOf(dynasty);
  const suffix = ERA_SUFFIX[era] ?? era;
  // 「後漢・後漢」のような重複を避ける（光武帝の後漢はサフィックスなし、五代の後漢のみ「後漢・五代十国」）。
  return suffix === name ? name : `${name}・${suffix}`;
}

function dynastyKey(dynasty: RawEmperor["dynasty"]): string {
  return `${dynasty.name}__${dynasty.section}`;
}

/**
 * name.commonNameがnull（未設定）のレコードが2件存在する（赫連夏の赫連昌・赫連定）。
 * データ側は本来string型のはずだが実データにnullが混在しているため、表示名としては
 * personalName等にフォールバックする（[[handover]]参照、data/emperors.json自体は変更しない）。
 */
function displayName(name: RawEmperor["name"]): string {
  const raw =
    name.commonName ?? name.personalName ?? name.templeName ?? name.posthumousName ?? "名不詳";
  return toNakaguro(raw);
}

/** 皇帝一覧の検索対象文字列。各種名称・別名・王朝名・時代を連結する。 */
function searchTextOf(e: RawEmperor, dynastyLabelText: string, era: string): string {
  return [
    e.name.commonName,
    e.name.personalName,
    e.name.templeName,
    e.name.posthumousName,
    ...(e.name.aliases ?? []),
    e.dynasty.name,
    dynastyLabelText,
    era,
  ]
    .filter((s): s is string => !!s)
    .join(" ");
}

let allRecordsCache: EmperorRecord[] | null = null;

/** ranks計算前のレコード（ranksは全レコード出揃ってからでないと計算できない）。 */
type BaseRecord = Omit<EmperorRecord, "ranks">;

/** 各指標の順位方向。ランキングチャート（各ページのrankDirection指定）と揃える。 */
const RANK_DIRECTIONS: Record<RankingMetricKey, "asc" | "desc"> = {
  reignYears: "desc",
  eraChangeCount: "desc",
  amnestyCount: "desc",
  empressInstallationCount: "desc",
  crownPrinceDepositionCount: "desc",
  personalCampaignCount: "desc",
  rebellionSuppressionCount: "desc",
  rebellionSufferedCount: "desc",
  capitalRelocationCount: "desc",
  accessionAge: "asc", // 若い順が1位（幼帝ランキング）
  deathAge: "desc", // 長寿順
};

function rankValueOf(r: BaseRecord, key: RankingMetricKey): number | null {
  // 在位期間はreignYears（浮動小数）でなくapproxDaysで順位付けする
  // （同値判定を整数で行うため。単調変換なので順位は同じ）。
  if (key === "reignYears") return r.reignApproxDays;
  return r[key];
}

/** 順位対象か。回数系の0回はランキングチャートの0回省略と同じ基準で対象外にする。 */
function isRanked(key: RankingMetricKey, value: number | null): value is number {
  if (value === null) return false;
  if (key === "reignYears" || key === "accessionAge" || key === "deathAge") {
    return true;
  }
  return value > 0;
}

/** 全皇帝を対象に各指標の順位を計算する。同値は同順位（competition ranking）。 */
function computeRanks(records: BaseRecord[]): Map<string, EmperorRecord["ranks"]> {
  const ranksById = new Map(
    records.map((r) => [
      r.id,
      {} as Partial<Record<RankingMetricKey, MetricRank | null>>,
    ]),
  );
  for (const key of Object.keys(RANK_DIRECTIONS) as RankingMetricKey[]) {
    const direction = RANK_DIRECTIONS[key];
    const eligible = records
      .map((r) => ({ id: r.id, value: rankValueOf(r, key) }))
      .filter((e): e is { id: string; value: number } => isRanked(key, e.value))
      .sort((a, b) =>
        direction === "desc" ? b.value - a.value : a.value - b.value,
      );
    const rankByValue = new Map<number, number>();
    const countByValue = new Map<number, number>();
    eligible.forEach(({ value }, i) => {
      if (!rankByValue.has(value)) rankByValue.set(value, i + 1);
      countByValue.set(value, (countByValue.get(value) ?? 0) + 1);
    });
    for (const r of records) {
      const value = rankValueOf(r, key);
      ranksById.get(r.id)![key] = isRanked(key, value)
        ? {
            rank: rankByValue.get(value)!,
            total: eligible.length,
            tied: countByValue.get(value)! > 1,
          }
        : null;
    }
  }
  return ranksById as Map<string, EmperorRecord["ranks"]>;
}

export function getAllEmperorRecords(): EmperorRecord[] {
  if (allRecordsCache) return allRecordsCache;
  const baseRecords: BaseRecord[] = data.emperors.map((e) => ({
    id: e.id,
    name: displayName(e.name),
    dynastyName: e.dynasty.name,
    dynastySection: e.dynasty.section,
    dynastyKey: dynastyKey(e.dynasty),
    dynastyLabel: dynastyLabel(e.dynasty),
    eraLabel: eraLabelOf(e.dynasty),
    dynastyCategory: e.dynasty.category,
    reignApproxDays: e.reignSummary.totalReignDuration.approxDays,
    reignYears: e.reignSummary.totalReignDuration.approxDays / 365,
    reignDurationLabel: formatReignDuration(
      e.reignSummary.totalReignDuration.approxDays,
    ),
    reignNeedsPreciseDays: e.reignSummary.totalReignDuration.needsPreciseDays,
    reignCount: e.reignSummary.reignCount,
    deathCauseCategory: e.deathCause?.category ?? "不詳",
    accessionRouteCategory: e.accessionRoute?.category ?? "不詳",
    eraChangeCount: e.eraChangeCount?.count ?? 0,
    amnestyCount: e.amnestyCount?.count ?? 0,
    empressInstallationCount: e.empressInstallationCount?.count ?? 0,
    crownPrinceDepositionCount: e.crownPrinceDepositionCount?.count ?? 0,
    personalCampaignCount: e.personalCampaignCount?.count ?? 0,
    rebellionSuppressionCount: e.rebellionSuppressionCount?.count ?? 0,
    rebellionSufferedCount: e.rebellionSufferedCount?.count ?? 0,
    capitalRelocationCount: e.capitalRelocationCount?.count ?? 0,
    accessionAge: e.ages?.accessionAge ?? null,
    deathAge: e.ages?.deathAge ?? null,
    periodsLabel: e.reigns.map(formatPeriod).join(" / "),
    personalName: e.name.personalName,
    templeName: e.name.templeName,
    posthumousName: e.name.posthumousName,
    searchText: searchTextOf(e, dynastyLabel(e.dynasty), eraLabelOf(e.dynasty)),
    hasPortrait: portraitIds.has(e.id),
    portraitUrl: portraitIds.has(e.id) ? `${BASE_PATH}/portraits/${e.id}.webp` : null,
  }));
  const ranksById = computeRanks(baseRecords);
  allRecordsCache = baseRecords.map((r) => ({
    ...r,
    ranks: ranksById.get(r.id)!,
  }));
  return allRecordsCache;
}

/** 王朝(name+section複合キー)の選択肢一覧。時代グループ順→データ内初出順で並べる。 */
export function getDynastyOptions(): DynastyOption[] {
  const seen = new Set<string>();
  const options: DynastyOption[] = [];
  for (const record of getAllEmperorRecords()) {
    if (seen.has(record.dynastyKey)) continue;
    seen.add(record.dynastyKey);
    options.push({
      value: record.dynastyKey,
      label: record.dynastyLabel,
      era: record.eraLabel,
    });
  }
  const eraIndex = new Map(eraOrder.map((e, i) => [e, i]));
  return options
    .map((o, i) => ({ o, i }))
    .sort((a, b) => {
      const ea = eraIndex.get(a.o.era) ?? 99;
      const eb = eraIndex.get(b.o.era) ?? 99;
      return ea !== eb ? ea - eb : a.i - b.i;
    })
    .map(({ o }) => o);
}

interface RawReign {
  startYear: number;
  endYear: number;
  isRestoration: boolean;
  note: string | null;
}

function formatYear(year: number): string {
  return year < 0 ? `前${-year}` : `${year}`;
}

function formatPeriod(reign: RawReign): string {
  return reign.startYear === reign.endYear
    ? `${formatYear(reign.startYear)}年`
    : `${formatYear(reign.startYear)}–${formatYear(reign.endYear)}年`;
}

/** noteの先頭一文（「〜。」まで）を取り出す。復位の経緯の要約として使う。 */
function firstSentence(note: string | null): string | null {
  if (!note) return null;
  const idx = note.indexOf("。");
  return idx === -1 ? note : note.slice(0, idx + 1);
}

/** 復位者（複数回即位）の一覧を、在位期間・復位の経緯つきで返す。 */
export function getRestorationRows(): RestorationRow[] {
  const records = new Map(getAllEmperorRecords().map((r) => [r.id, r]));
  const rows: RestorationRow[] = [];
  for (const e of data.emperors) {
    if (e.reignSummary.reignCount < 2) continue;
    const record = records.get(e.id);
    if (!record) continue;
    const reigns = e.reigns ?? [];
    rows.push({
      id: e.id,
      name: record.name,
      dynastyLabel: record.dynastyLabel,
      dynastyKey: record.dynastyKey,
      dynastyCategory: record.dynastyCategory,
      reignCount: e.reignSummary.reignCount,
      periodsLabel: reigns.map(formatPeriod).join(" / "),
      restorationReasons: reigns
        .filter((r) => r.isRestoration)
        .map((r) => firstSentence(r.note))
        .filter((s): s is string => s !== null),
    });
  }
  return rows;
}

export interface OverviewStats {
  emperorCount: number;
  avgReignLabel: string;
  longestReign: { name: string; dynastyLabel: string; durationLabel: string };
  shortestReign: { name: string; dynastyLabel: string; durationLabel: string };
  topDeathCause: { category: string; count: number; percent: number };
  topAccessionRoute: { category: string; count: number; percent: number };
  restorationCount: number;
  portraitCount: number;
}

/** トップページ（概要ダッシュボード）用のサマリー統計。 */
export function getOverviewStats(): OverviewStats {
  const records = getAllEmperorRecords();
  const total = records.length;
  const avgDays = records.reduce((s, r) => s + r.reignApproxDays, 0) / total;
  const longest = records.reduce((a, b) =>
    b.reignApproxDays > a.reignApproxDays ? b : a,
  );
  const shortest = records.reduce((a, b) =>
    b.reignApproxDays < a.reignApproxDays ? b : a,
  );
  const countBy = (pick: (r: EmperorRecord) => string) => {
    const m = new Map<string, number>();
    for (const r of records) m.set(pick(r), (m.get(pick(r)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  };
  const [deathCategory, deathCount] = countBy((r) => r.deathCauseCategory);
  const [accessionCategory, accessionCount] = countBy(
    (r) => r.accessionRouteCategory,
  );
  return {
    emperorCount: total,
    avgReignLabel: `約${(avgDays / 365).toFixed(1)}年`,
    longestReign: {
      name: longest.name,
      dynastyLabel: longest.dynastyLabel,
      durationLabel: longest.reignDurationLabel,
    },
    shortestReign: {
      name: shortest.name,
      dynastyLabel: shortest.dynastyLabel,
      durationLabel: shortest.reignDurationLabel,
    },
    topDeathCause: {
      category: deathCategory,
      count: deathCount,
      percent: Math.round((deathCount / total) * 100),
    },
    topAccessionRoute: {
      category: accessionCategory,
      count: accessionCount,
      percent: Math.round((accessionCount / total) * 100),
    },
    restorationCount: records.filter((r) => r.reignCount >= 2).length,
    portraitCount: records.filter((r) => r.hasPortrait).length,
  };
}

export interface PortraitCredit {
  id: string;
  commonName: string;
  dynasty: string;
  licenseShortName: string;
  commonsPageUrl: string;
}

/** このサイトについてページ用：肖像画の出典クレジット一覧（サイトで実際に使う153件）。 */
export function getPortraitCredits(): PortraitCredit[] {
  const manifestPath = path.join(
    process.cwd(),
    "..",
    "data",
    "images",
    "portraits",
    "manifest.json",
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
    id: string;
    commonName: string;
    dynasty: string;
    licenseShortName: string;
    commonsPageUrl: string;
  }[];
  return manifest
    .filter((m) => portraitIds.has(m.id))
    .map((m) => ({
      id: m.id,
      commonName: m.commonName,
      dynasty: m.dynasty,
      licenseShortName: m.licenseShortName,
      commonsPageUrl: m.commonsPageUrl,
    }));
}
