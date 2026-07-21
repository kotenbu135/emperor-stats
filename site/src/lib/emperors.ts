import fs from "node:fs";
import path from "node:path";
import { BASE_PATH } from "@/lib/base-path";
import { aggregateByGroup } from "@/components/charts/dynasty-aggregate";
import {
  astroYear,
  eraOrder,
  formatReignDuration,
  formatYear,
  type AccessionRouteCategory,
  type DeathCauseCategory,
  type DynastyCategory,
  type DynastyOption,
  type EmperorEventKind,
  type EmperorEventRow,
  type EmperorListRecord,
  type EmperorNarrative,
  type EmperorRecord,
  type EmperorStructuredDates,
  type EmperorVideo,
  type MetricRank,
  type NarrativeSection,
  type ResearchMemo,
  type RankingMetricKey,
  type RestorationRow,
  type TimelineData,
  type TimelineDynastyBand,
  type TimelineEraBand,
  type TimelineSegment,
  type TimelineVacancy,
} from "@/lib/emperor-types";

export * from "@/lib/emperor-types";
import { buildRiverTimeline, type RiverTimelineData } from "@/lib/timeline-river";
import { kanaExpansionsOf } from "@/lib/kana-readings";

const dataPath = path.join(process.cwd(), "..", "data", "emperors.json");
const rawData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

const videoMatchesPath = path.join(
  process.cwd(),
  "..",
  "data",
  "emperor-videos.json",
);
const playlistPath = path.join(process.cwd(), "..", "data", "youtube-playlist.json");
const videoMatches = JSON.parse(fs.readFileSync(videoMatchesPath, "utf-8")) as {
  emperorVideos: Record<string, string[]>;
};
const playlist = JSON.parse(fs.readFileSync(playlistPath, "utf-8")) as {
  videos: { videoId: string; title: string; thumbnailUrl: string }[];
};
const videoById = new Map(playlist.videos.map((v) => [v.videoId, v]));
/** 表示用タイトル: 全動画に共通の定型プレフィックス「【ゆっくり解説】」は
 *  リスト表示では冗長なため削る（チャンネル名は別途表記する）。 */
function videoDisplayTitle(title: string): string {
  return title.replace(/^【ゆっくり解説】\s*/, "");
}
const videosByEmperorId = new Map<string, EmperorVideo[]>(
  Object.entries(videoMatches.emperorVideos).map(([emperorId, videoIds]) => [
    emperorId,
    videoIds.map((id) => {
      const v = videoById.get(id)!;
      return {
        videoId: v.videoId,
        title: videoDisplayTitle(v.title),
        thumbnailUrl: v.thumbnailUrl,
      };
    }),
  ]),
);

const portraitsDir = path.join(process.cwd(), "public", "portraits");
const portraitIds = new Set(
  fs
    .readdirSync(portraitsDir)
    .filter((f) => f.endsWith(".webp"))
    .map((f) => f.replace(/\.webp$/, "")),
);

interface RawSource {
  page: string;
  lang: string;
  note?: string | null;
}

/** 経緯note＋出典を持つフィールド（deathCause・accessionRoute）。 */
interface RawNarrativeField {
  note?: string | null;
  source?: RawSource | null;
}

/** 8指標のevents[]の1要素。指標により持つフィールドが異なる（すべてoptional扱い）。 */
interface RawEvent {
  date?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  datePrecision?: string | null;
  note?: string | null;
  source?: RawSource | null;
  /** 親征のみ。 */
  target?: string | null;
  /** 親征・反乱鎮圧・被反乱。 */
  outcome?: string | null;
  /** 反乱鎮圧・被反乱のみ。 */
  name?: string | null;
  leader?: string | null;
  /** 遷都のみ。 */
  from?: string | null;
  to?: string | null;
}

interface RawCount {
  count: number;
  note?: string | null;
  events?: RawEvent[];
}

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
  deathCause?: { category: DeathCauseCategory } & RawNarrativeField;
  accessionRoute?: { category: AccessionRouteCategory } & RawNarrativeField;
  eraChangeCount?: RawCount;
  amnestyCount?: RawCount;
  empressInstallationCount?: RawCount;
  crownPrinceDepositionCount?: RawCount;
  personalCampaignCount?: RawCount;
  rebellionSuppressionCount?: RawCount;
  rebellionSufferedCount?: RawCount;
  capitalRelocationCount?: RawCount;
  ages?: {
    birthDate?: string | null;
    birthDatePrecision?: string | null;
    deathDate?: string | null;
    deathDatePrecision?: string | null;
    accessionAge: number | null;
    deathAge: number | null;
    note?: string | null;
  };
  sources?: { wikidata?: string | null };
  reigns: RawReign[];
}

interface EmperorsData {
  meta: { count: number; generatedAt: string; version: string };
  emperors: RawEmperor[];
}

const data = rawData as unknown as EmperorsData;

export const emperorCount = data.meta.count;
export const datasetGeneratedAt = data.meta.generatedAt;
export const datasetVersion = data.meta.version;

/** データが扱う年代範囲（天文年・ISO 8601区間）。Dataset JSON-LD の temporalCoverage 用。 */
export const datasetTemporalCoverage = (() => {
  let min = Infinity;
  let max = -Infinity;
  for (const e of data.emperors) {
    for (const r of e.reigns) {
      if (typeof r.startYear === "number" && r.startYear < min) min = r.startYear;
      if (typeof r.endYear === "number" && r.endYear > max) max = r.endYear;
    }
  }
  const iso = (y: number) =>
    y < 0 ? `-${String(-y).padStart(4, "0")}` : String(y).padStart(4, "0");
  return `${iso(min)}/${iso(max)}`;
})();

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
 * commonNameはスキーマ・validate_emperors.pyで非null必須（かつてnullが2件混在し
 * 2026-07-21にデータ側で解消済み）。フォールバックは防御的に維持する。
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

/** かな検索用の読み文字列。名称群は読み揺れ込みで展開し、王朝名・時代は慣用読みのみ。 */
function searchKanaOf(e: RawEmperor, dynastyLabelText: string, era: string): string {
  const kana = new Set<string>();
  const names = [
    e.name.commonName,
    e.name.personalName,
    e.name.templeName,
    e.name.posthumousName,
    ...(e.name.aliases ?? []),
  ].filter((s): s is string => !!s);
  for (const name of names) {
    for (const k of kanaExpansionsOf(name)) kana.add(k);
  }
  for (const label of [e.dynasty.name, dynastyLabelText, era]) {
    for (const k of kanaExpansionsOf(label, { primaryOnly: true })) kana.add(k);
  }
  return [...kana].join(" ");
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
    aliases: e.name.aliases ?? [],
    wikidataId: e.sources?.wikidata ?? null,
    searchText: searchTextOf(e, dynastyLabel(e.dynasty), eraLabelOf(e.dynasty)),
    hasPortrait: portraitIds.has(e.id),
    portraitUrl: portraitIds.has(e.id) ? `${BASE_PATH}/portraits/${e.id}.webp` : null,
    videos: videosByEmperorId.get(e.id) ?? [],
  }));
  const ranksById = computeRanks(baseRecords);
  allRecordsCache = baseRecords.map((r) => ({
    ...r,
    ranks: ranksById.get(r.id)!,
  }));
  return allRecordsCache;
}

/**
 * 皇帝一覧ページ（/emperors）専用の軽量レコード。カード表示・検索・絞り込みに
 * 必要な最小フィールド＋かな検索用のsearchKanaだけを返す（フルのEmperorRecordを
 * 365件クライアントpropsに埋め込むとRSCペイロードが数百KB太るため。全項目は
 * ダイアログ開時に /emperor-records/{id} をfetchする）。
 */
export function getEmperorListRecords(): EmperorListRecord[] {
  const kanaById = new Map(
    data.emperors.map((e) => [
      e.id,
      searchKanaOf(e, dynastyLabel(e.dynasty), eraLabelOf(e.dynasty)),
    ]),
  );
  return getAllEmperorRecords().map((r) => ({
    id: r.id,
    name: r.name,
    personalName: r.personalName,
    dynastyLabel: r.dynastyLabel,
    eraLabel: r.eraLabel,
    dynastyKey: r.dynastyKey,
    dynastyCategory: r.dynastyCategory,
    portraitUrl: r.portraitUrl,
    searchText: r.searchText,
    searchKana: kanaById.get(r.id)!,
  }));
}

/** 王朝(name+section複合キー)の選択肢一覧。時代グループ順→データ内初出順で並べる。 */
export function getDynastyOptions(): DynastyOption[] {
  const seen = new Set<string>();
  const options: DynastyOption[] = [];
  for (const record of getAllEmperorRecords()) {
    if (seen.has(record.dynastyKey)) continue;
    seen.add(record.dynastyKey);
    // かな検索用の読み展開。王朝ラベルは読み揺れ込み（斉=せい/さい等）、
    // 時代は慣用読みのみ（searchKanaOfのラベル扱いと同じ）。
    const kana = new Set<string>([
      ...kanaExpansionsOf(record.dynastyLabel),
      ...kanaExpansionsOf(record.eraLabel, { primaryOnly: true }),
    ]);
    options.push({
      value: record.dynastyKey,
      label: record.dynastyLabel,
      era: record.eraLabel,
      kana: [...kana],
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

/** reigns[].duration.source。quote/conversionはtask.md 3-1フェーズBで整備（一部未付与）。 */
interface RawDurationSource extends RawSource {
  quote?: string | null;
  conversion?: string | null;
}

interface RawReign {
  startYear: number;
  endYear: number;
  isRestoration: boolean;
  note: string | null;
  duration?: { source?: RawDurationSource | null } | null;
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

// ---------------------------------------------------------------------------
// 皇帝個別ページ専用の経緯・調査メモ（getEmperorNarrative）。
// note全文は総量が大きいため、EmperorRecord（全統計ページのクライアントpropsに
// 埋め込まれる）には含めない。ダイアログへの反映はtask.md第3弾（lazy fetch）。

// 出典ラベルはsource.pageをそのまま使う（Wikipedia記事名の残存はtask.md 3-1で
// 一掃済み・CIの禁止出典チェックで担保。旧Wikipedia判別ヒューリスティックは
// 簡体字巻名やJACAR等の非正史学術典拠を誤ってWikipedia表示していたため撤去）。

/** 空文字列の出典noteをnullに正規化する（一部レコードに `note: ""` が実在する）。 */
function nonEmptyOrNull(s: string | null | undefined): string | null {
  return s ? s : null;
}

function narrativeSectionOf(
  field: RawNarrativeField | undefined,
): NarrativeSection | null {
  if (!field?.note || !field.source) return null;
  return {
    note: field.note,
    sourceLabel: field.source.page,
    sourceNote: nonEmptyOrNull(field.source.note),
  };
}

const rawEmperorById = new Map(data.emperors.map((e) => [e.id, e]));

/** 個別ページ用に、経緯note全文・出典・調査メモを返す。idは収録済み前提。 */
export function getEmperorNarrative(id: string): EmperorNarrative {
  const e = rawEmperorById.get(id);
  if (!e) throw new Error(`未収録の皇帝idです: ${id}`);
  const memoEntries: [string, string | null | undefined][] = [
    ["改元回数", e.eraChangeCount?.note],
    ["大赦回数", e.amnestyCount?.note],
    ["立后回数", e.empressInstallationCount?.note],
    ["皇太子廃立回数", e.crownPrinceDepositionCount?.note],
    ["親征回数", e.personalCampaignCount?.note],
    ["反乱鎮圧回数", e.rebellionSuppressionCount?.note],
    ["被反乱回数", e.rebellionSufferedCount?.note],
    ["遷都回数", e.capitalRelocationCount?.note],
    ["即位時年齢・没年齢", e.ages?.note],
  ];
  return {
    accession: narrativeSectionOf(e.accessionRoute),
    death: narrativeSectionOf(e.deathCause),
    restorations: e.reigns
      .filter((r) => r.isRestoration && r.note)
      .map((r) => ({ periodLabel: formatPeriod(r), note: r.note! })),
    reignSources: e.reigns.flatMap((r) => {
      const source = r.duration?.source;
      if (!source) return [];
      return [
        {
          periodLabel: formatPeriod(r),
          sourceLabel: source.page,
          quote: nonEmptyOrNull(source.quote),
          conversion: nonEmptyOrNull(source.conversion),
          note: nonEmptyOrNull(source.note),
        },
      ];
    }),
    memos: memoEntries
      .filter((entry): entry is [string, string] => !!entry[1])
      .map(([label, note]): ResearchMemo => ({ label, note })),
  };
}

/** clampToPrecision後の年月日をISO 8601形式の文字列に整形する（負の年＝紀元前）。 */
function isoDateOf(parts: {
  year: number;
  month: number | null;
  day: number | null;
}): string {
  const yStr = String(Math.abs(parts.year)).padStart(4, "0");
  let out = `${parts.year < 0 ? "-" : ""}${yStr}`;
  if (parts.month !== null) out += `-${String(parts.month).padStart(2, "0")}`;
  if (parts.month !== null && parts.day !== null) {
    out += `-${String(parts.day).padStart(2, "0")}`;
  }
  return out;
}

/**
 * Person構造化データ用の日付整形。ages.birthDate/deathDateがISO風の解析可能な
 * 値の場合のみ返す（"unknown"等の自由記述・null・not_foundはnullを返し捏造しない）。
 * 丸めはイベント日付と同じparseEventDate/normalizeDatePrecision/clampToPrecisionを流用する。
 */
function structuredDateOf(
  raw: string | null | undefined,
  precisionRaw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const parsed = parseEventDate(raw);
  if (!parsed) return null;
  return isoDateOf(clampToPrecision(parsed, normalizeDatePrecision(precisionRaw)));
}

/** 個別ページの構造化データ（Person JSON-LD）用の生年月日・没年月日。idは収録済み前提。 */
export function getEmperorStructuredDates(id: string): EmperorStructuredDates {
  const e = rawEmperorById.get(id);
  if (!e) throw new Error(`未収録の皇帝idです: ${id}`);
  return {
    birthDate: structuredDateOf(e.ages?.birthDate, e.ages?.birthDatePrecision),
    deathDate: structuredDateOf(e.ages?.deathDate, e.ages?.deathDatePrecision),
  };
}

// ---------------------------------------------------------------------------
// 在位中の出来事年表（個別ページ）。8指標のevents[]を日付順にマージする。

type DatePrecision = "year" | "month" | "day";

/**
 * datePrecisionの正規化。実データは "day"/"month"/"year" のほかに
 * "day（干支のみ：…、グレゴリオ暦未換算）"・"lunar-month（…）"・"月まで特定" 等の
 * 自由記述が混在するため、接頭辞で判別する。判別できないもの（unknown・和文注記）は
 * 年精度に落とす（date値の月日が01埋めのことがあり、実日付と誤表示しないため）。
 */
function normalizeDatePrecision(p: string | null | undefined): DatePrecision {
  if (!p) return "year";
  if (/^(day|lunar-day|sexagenary-day|year-month-day)/.test(p)) return "day";
  if (/^(year-month|month|lunar-month)/.test(p)) return "month";
  return "year";
}

/** "-0202-07-01"・"-0143"・"0627-01" 形式のみ受け付ける（元号表記等はnull）。 */
const ISO_LIKE_DATE = /^(-?\d{1,4})(?:-(\d{2}))?(?:-(\d{2}))?$/;

interface EventDateParts {
  year: number;
  month: number | null;
  day: number | null;
}

function parseEventDate(s: string): EventDateParts | null {
  const m = ISO_LIKE_DATE.exec(s);
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: m[2] ? Number(m[2]) : null,
    day: m[3] ? Number(m[3]) : null,
  };
}

/** datePrecisionを超える細かさを捨てる（月精度なら日を表示しない）。 */
function clampToPrecision(
  parts: EventDateParts,
  precision: DatePrecision,
): EventDateParts {
  return {
    year: parts.year,
    month: precision === "year" ? null : parts.month,
    day: precision !== "day" ? null : parts.day,
  };
}

function formatEventDate(parts: EventDateParts): string {
  let label = `${formatYear(parts.year)}年`;
  if (parts.month !== null) label += `${parts.month}月`;
  if (parts.month !== null && parts.day !== null) label += `${parts.day}日`;
  return label;
}

/** 表示用日付とソートキー。西暦換算されていない日付（元号表記）は原文ママ・ソート不能。 */
function eventDateOf(ev: RawEvent): {
  label: string | null;
  sortKey: number | null;
} {
  const startRaw = ev.date ?? ev.startDate ?? null;
  if (!startRaw) return { label: null, sortKey: null };
  const start = parseEventDate(startRaw);
  if (!start) return { label: startRaw, sortKey: null };
  const precision = normalizeDatePrecision(ev.datePrecision);
  const s = clampToPrecision(start, precision);
  let label = formatEventDate(s);
  const end = ev.endDate ? parseEventDate(ev.endDate) : null;
  if (end) {
    const endLabel = formatEventDate(clampToPrecision(end, precision));
    if (endLabel !== label) label = `${label}〜${endLabel}`;
  }
  return {
    label,
    // 0年なし対策の連続年（astroYear）ベースで 年*10000 + 月*100 + 日。
    sortKey: astroYear(s.year) * 10000 + (s.month ?? 0) * 100 + (s.day ?? 0),
  };
}

/** 8指標→出来事種別の対応（表示上の基本順序を兼ねる）。 */
const EVENT_METRICS: {
  kind: EmperorEventKind;
  pick: (e: RawEmperor) => RawCount | undefined;
}[] = [
  { kind: "eraChange", pick: (e) => e.eraChangeCount },
  { kind: "amnesty", pick: (e) => e.amnestyCount },
  { kind: "empressInstallation", pick: (e) => e.empressInstallationCount },
  { kind: "crownPrinceDeposition", pick: (e) => e.crownPrinceDepositionCount },
  { kind: "personalCampaign", pick: (e) => e.personalCampaignCount },
  { kind: "rebellionSuppression", pick: (e) => e.rebellionSuppressionCount },
  { kind: "rebellionSuffered", pick: (e) => e.rebellionSufferedCount },
  { kind: "capitalRelocation", pick: (e) => e.capitalRelocationCount },
];

/** 種別ごとの1行要約と構造化フィールドの内訳。 */
function eventSummaryOf(
  kind: EmperorEventKind,
  ev: RawEvent,
): { summary: string; facts: { label: string; text: string }[] } {
  const facts: { label: string; text: string }[] = [];
  switch (kind) {
    case "personalCampaign":
      if (ev.target) facts.push({ label: "対象", text: ev.target });
      if (ev.outcome) facts.push({ label: "結果", text: ev.outcome });
      return { summary: ev.target ?? "親征", facts };
    case "rebellionSuppression":
    case "rebellionSuffered":
      if (ev.leader) facts.push({ label: "首謀者", text: ev.leader });
      if (ev.outcome) facts.push({ label: "結果", text: ev.outcome });
      return {
        summary: ev.name ?? (ev.leader ? `${ev.leader}の反乱` : "反乱"),
        facts,
      };
    case "capitalRelocation":
      return { summary: `${ev.from ?? "?"} → ${ev.to ?? "?"}`, facts };
    default:
      // 改元・大赦・立后・皇太子廃立はnoteの先頭一文を要約に使う。
      return { summary: firstSentence(ev.note ?? null) ?? "（記録なし）", facts };
  }
}

/**
 * 個別ページ用に、8指標のevents[]を日付順にマージして返す。西暦換算されていない
 * 日付（元号表記）・日付不明の出来事はソートできないため、種別順・原文順のまま
 * 末尾にまとめる（sortは安定ソート）。
 */
export function getEmperorEvents(id: string): EmperorEventRow[] {
  const e = rawEmperorById.get(id);
  if (!e) throw new Error(`未収録の皇帝idです: ${id}`);
  const rows: (EmperorEventRow & { sortKey: number | null })[] = [];
  for (const { kind, pick } of EVENT_METRICS) {
    for (const ev of pick(e)?.events ?? []) {
      const { label, sortKey } = eventDateOf(ev);
      const { summary, facts } = eventSummaryOf(kind, ev);
      rows.push({
        kind,
        dateLabel: label,
        summary,
        facts,
        note: ev.note && ev.note !== summary ? ev.note : null,
        sourceLabel: ev.source?.page ?? null,
        sortKey,
      });
    }
  }
  rows.sort((a, b) => {
    if (a.sortKey === null || b.sortKey === null) {
      return (a.sortKey === null ? 1 : 0) - (b.sortKey === null ? 1 : 0);
    }
    return a.sortKey - b.sortKey;
  });
  // クライアントpropsに不要なsortKeyを落として返す。
  return rows.map((row) => {
    const { sortKey, ...rest } = row;
    void sortKey;
    return rest;
  });
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

// ---------------------------------------------------------------------------
// グラフページの「読み取れること」（SSR テキスト）。クローラと未訪問ユーザーに
// 各グラフの結論を1〜2文で言語化する（グラフ本体は LazyMount で画面外未マウント＝
// 数値が一切 DOM に出ないため、この結論文は実質ゼロからの純増になる）。
//
// 【整合性の要】数値・母集団・1位はすべてチャートと同じ単一情報源から導く：
//   - /reign・/death-accession は getOverviewStats（チャートと同じ集計）
//   - 回数系・年齢は record.ranks[key]（チャート行と同じ computeRanks 由来のマップ）
//     を使い、1位＝ranks[key].rank===1（＝チャート最上段）、母集団＝ranks[key].total
//     （＝0回除外・年齢判明者のみの対象人数）。手書きの .filter を挟まないので、
//     isRanked/RANK_DIRECTIONS を将来変えても本文が勝手にずれない。

export type TakeawayPage =
  | "reign"
  | "ages"
  | "death-accession"
  | "court-events"
  | "military"
  | "dynasties";

/** 指標の生値（回数・年齢）。ranks と同じ RankingMetricKey を受け、reignYears は扱わない。 */
function metricValueOf(r: EmperorRecord, key: RankingMetricKey): number | null {
  return r[key] as number | null;
}

/** ある指標の1位（＝チャート最上段）の皇帝群と対象人数。0回除外・年齢判明者のみは
 *  ranks[key] 側で確定済みなので、ここでは rank===1 を拾うだけ。 */
function topRanked(
  records: EmperorRecord[],
  key: RankingMetricKey,
): { leaders: EmperorRecord[]; total: number; value: number } | null {
  const leaders = records.filter((r) => r.ranks[key]?.rank === 1);
  if (leaders.length === 0) return null;
  const total = leaders[0].ranks[key]!.total;
  const value = metricValueOf(leaders[0], key)!;
  return { leaders, total, value };
}

/** 1位が単独か同順位かで表記を分ける（「○○（王朝）」か「○○ら2名」）。 */
function leaderLabel(leaders: EmperorRecord[]): string {
  if (leaders.length === 1) {
    return `${leaders[0].name}（${leaders[0].dynastyLabel}）`;
  }
  if (leaders.length === 2) {
    // 区切りは「と」を使う（名前自体が「聖祖・康熙帝」のように「・」を含むため、
    // 「・」で繋ぐと1人か2人か判別できなくなる）。
    return `${leaders[0].name}と${leaders[1].name}の2名`;
  }
  return `${leaders[0].name}ら${leaders.length}名`;
}

/** 回数系ランキング（改元・親征など）の総括文。動詞・単位は呼び出し側から与える。 */
function countTakeaway(
  records: EmperorRecord[],
  key: RankingMetricKey,
  opts: { verb: string; unit: string; populationClause: string },
): string[] {
  const top = topRanked(records, key);
  if (!top) return [];
  return [
    `${opts.verb}が最も多いのは${leaderLabel(top.leaders)}で、${top.value}${opts.unit}です。`,
    `${opts.populationClause}は${top.total}名です。`,
  ];
}

/** 王朝別平均在位の小標本しきい値。これ未満は1人の在位が平均を大きく動かすため、
 *  最長平均の主張から除外する（除外することを本文にも明記する）。 */
const DYNASTY_MIN_EMPERORS = 5;

/**
 * グラフページ1本ぶんの「読み取れること」総括文（各ページ代表 Section 直下に置く）。
 * すべてビルド時にデータから導出する表示用の機械集計（自動生成禁止には非抵触）。
 */
export function getChartTakeaway(page: TakeawayPage): string[] {
  const records = getAllEmperorRecords();
  switch (page) {
    case "reign": {
      const s = getOverviewStats();
      return [
        `収録した${s.emperorCount}名の在位期間は、最長が${s.longestReign.name}（${s.longestReign.dynastyLabel}）の${s.longestReign.durationLabel}、最短が${s.shortestReign.name}（${s.shortestReign.dynastyLabel}）の${s.shortestReign.durationLabel}です。`,
        `1人あたりの平均は${s.avgReignLabel}です。`,
      ];
    }
    case "death-accession": {
      const s = getOverviewStats();
      return [
        `${s.emperorCount}名の死因で最も多いのは「${s.topDeathCause.category}」で、${s.topDeathCause.count}名（${s.topDeathCause.percent}%）です。`,
        `即位経路で最も多いのは「${s.topAccessionRoute.category}」で、${s.topAccessionRoute.count}名（${s.topAccessionRoute.percent}%）です。`,
      ];
    }
    case "ages": {
      const top = topRanked(records, "accessionAge"); // asc=若い順が1位
      if (!top) return [];
      return [
        `即位時の年齢（数え年）が判明する${top.total}名のうち、最も若くして即位したのは${leaderLabel(top.leaders)}で、${top.value}歳です。`,
        `生年が判明しない皇帝が多く、即位時年齢を算出できたのはこの${top.total}名にとどまります。`,
      ];
    }
    case "court-events": {
      return countTakeaway(records, "eraChangeCount", {
        verb: "改元回数",
        unit: "回",
        populationClause: "即位時の建元を含め在位中に一度でも改元した皇帝",
      });
    }
    case "military": {
      return countTakeaway(records, "personalCampaignCount", {
        verb: "親征（皇帝自身が軍を率いた出征）の回数",
        unit: "回",
        populationClause: "親征の記録がある皇帝",
      });
    }
    case "dynasties": {
      const rows = aggregateByGroup(records, "dynasty", "all");
      const eligible = rows.filter(
        (r) => r.emperorCount >= DYNASTY_MIN_EMPERORS,
      );
      if (eligible.length === 0) return [];
      const top = eligible.reduce((a, b) =>
        b.avgReignDays > a.avgReignDays ? b : a,
      );
      const years = (top.avgReignDays / 365).toFixed(1);
      return [
        `皇帝が${DYNASTY_MIN_EMPERORS}名以上いる王朝では、1人あたりの平均在位年数が最も長いのは${top.label}で、約${years}年（${top.emperorCount}名）です。`,
        `皇帝が少ない王朝は1人の在位が平均を大きく動かすため、${DYNASTY_MIN_EMPERORS}名未満はこの比較から除いています。`,
      ];
    }
  }
}

// ---------------------------------------------------------------------------
// 通史年表（/timeline）用のデータ。設計は docs/site-design/TIMELINE.md。
// 帯・空位・並立数はすべて収録皇帝のreigns[]の純粋な写像としてビルド時に計算する
// （王朝の建国〜滅亡年を別途調査して持ち込まない）。

/** ミニマップ・狭い時代帯用の短縮ラベル。 */
const ERA_SHORT_LABELS: Record<string, string> = {
  "新〜後漢初": "新",
  五胡十六国: "五胡",
  五代十国: "五代",
  "宋・遼・西夏・金": "宋・遼・金",
};

/**
 * 皇帝不在期間の説明文言。期間はデータから機械的に検出し、ここは表示文言だけを
 * 与える（キーが一致しない=データが変わった場合は汎用文言にフォールバック）。
 * 文言は収録基準（INCLUSION_CRITERIA.md）の範囲内の説明に留める。
 */
const VACANCY_LABELS: Record<string, string> = {
  "-206:-203": "楚漢戦争期（項羽は皇帝を称さず）",
  "7:7": "王莽の居摂期",
  "1913:1914": "中華民国（清帝退位後）",
  "1918:1933": "中華民国（張勲復辟の失敗後）",
};

/** 在位区間を年単位で合併する。隣接年（endの翌年がstart）は連続とみなす。 */
function mergeYearSpans(
  intervals: { startYear: number; endYear: number }[],
): { startYear: number; endYear: number }[] {
  const sorted = [...intervals].sort(
    (a, b) => a.startYear - b.startYear || a.endYear - b.endYear,
  );
  const merged: { startYear: number; endYear: number }[] = [];
  for (const iv of sorted) {
    const last = merged[merged.length - 1];
    if (last && astroYear(iv.startYear) <= astroYear(last.endYear) + 1) {
      last.endYear = Math.max(last.endYear, iv.endYear);
    } else {
      merged.push({ ...iv });
    }
  }
  return merged;
}

/** 帯の見た目を代表する区分。複数区分が混在する王朝（唐・北魏など）は正統を優先する。 */
function bandCategory(categories: Set<DynastyCategory>): DynastyCategory {
  if (categories.has("正統")) return "正統";
  if (categories.has("十六国")) return "十六国";
  return "正統（反乱・自称）";
}

let timelineCache: TimelineData | null = null;

export function getTimelineData(): TimelineData {
  if (timelineCache) return timelineCache;

  // --- 王朝帯: name+section複合キーごとに在位区間とセグメントを収集 ---
  const byKey = new Map<
    string,
    {
      key: string;
      label: string;
      era: string;
      categories: Set<DynastyCategory>;
      intervals: { startYear: number; endYear: number }[];
      segments: TimelineSegment[];
      emperorIds: Set<string>;
    }
  >();
  for (const e of data.emperors) {
    const key = dynastyKey(e.dynasty);
    let entry = byKey.get(key);
    if (!entry) {
      entry = {
        key,
        label: dynastyLabel(e.dynasty),
        era: eraLabelOf(e.dynasty),
        categories: new Set(),
        intervals: [],
        segments: [],
        emperorIds: new Set(),
      };
      byKey.set(key, entry);
    }
    entry.categories.add(e.dynasty.category);
    entry.emperorIds.add(e.id);
    for (const r of e.reigns) {
      entry.intervals.push({ startYear: r.startYear, endYear: r.endYear });
      entry.segments.push({
        emperorId: e.id,
        startYear: r.startYear,
        endYear: r.endYear,
        isRestoration: r.isRestoration,
      });
    }
  }

  const categoryPriority: Record<DynastyCategory, number> = {
    正統: 0,
    "正統（反乱・自称）": 1,
    十六国: 1,
  };
  const bands: TimelineDynastyBand[] = [...byKey.values()]
    .map((w) => {
      const spans = mergeYearSpans(w.intervals);
      return {
        key: w.key,
        label: w.label,
        era: w.era,
        category: bandCategory(w.categories),
        lane: 0,
        colorSlot: 1,
        startYear: spans[0].startYear,
        endYear: spans[spans.length - 1].endYear,
        spans,
        segments: [...w.segments].sort(
          (a, b) => a.startYear - b.startYear || a.endYear - b.endYear,
        ),
        emperorCount: w.emperorIds.size,
      };
    })
    .sort(
      (a, b) =>
        a.startYear - b.startYear ||
        categoryPriority[a.category] - categoryPriority[b.category] ||
        b.endYear - b.startYear - (a.endYear - a.startYear),
    );

  // レーン割当（interval partitioning・開始年順の貪欲法）。正統王朝と
  // 並立・反乱政権を別ブロックに分けて詰めることで、上ブロックのlane 0に
  // 「秦→前漢→…→明」の本流がほぼ一列に連なる（初学者が本流を追える）。
  // 同年の禅譲交代（後漢→魏の220年など）は同一レーンを許容する。
  // 帯内ギャップ中もレーンは他王朝に貸さない（外接期間で占有。点線コネクタが
  // 他王朝の帯に横切られないようにするため）。
  const packBands = (group: TimelineDynastyBand[], laneOffset: number): number => {
    const laneEnds: number[] = [];
    for (const band of group) {
      const lane = laneEnds.findIndex(
        (end) => astroYear(band.startYear) >= astroYear(end),
      );
      if (lane === -1) {
        band.lane = laneOffset + laneEnds.length;
        laneEnds.push(band.endYear);
      } else {
        band.lane = laneOffset + lane;
        laneEnds[lane] = band.endYear;
      }
    }
    return laneEnds.length;
  };
  const mainLaneCount = packBands(
    bands.filter((b) => b.category === "正統"),
    0,
  );
  const otherLaneCount = packBands(
    bands.filter((b) => b.category !== "正統"),
    mainLaneCount,
  );

  // 配色スロット割当: 同時期に重なる帯・同一レーンで直前に隣接する帯と同じ
  // スロットを避けて先着順に選ぶ（本流が延々と同色にならないように）。
  // 同時並立が8色を超える期間（最大9）は同色が生じうるが、帯の太さ・濃淡
  // （正統/並立）の差で区別できる。
  const lastSlotInLane = new Map<number, number>();
  for (let i = 0; i < bands.length; i++) {
    const used = new Set<number>();
    for (let j = 0; j < i; j++) {
      if (
        bands[j].endYear >= bands[i].startYear &&
        bands[j].startYear <= bands[i].endYear
      ) {
        used.add(bands[j].colorSlot);
      }
    }
    const prevInLane = lastSlotInLane.get(bands[i].lane);
    if (prevInLane !== undefined) used.add(prevInLane);
    let slot = (bands[i].lane % 8) + 1;
    for (let s = 1; s <= 8; s++) {
      if (!used.has(s)) {
        slot = s;
        break;
      }
    }
    bands[i].colorSlot = slot;
    lastSlotInLane.set(bands[i].lane, slot);
  }

  // --- 時代帯: 時代区分ラベルごとの外接期間。重なる時代はレーンを分ける ---
  const eraSpanByLabel = new Map<string, { startYear: number; endYear: number }>();
  for (const e of data.emperors) {
    const era = eraLabelOf(e.dynasty);
    for (const r of e.reigns) {
      const span = eraSpanByLabel.get(era);
      if (!span) {
        eraSpanByLabel.set(era, { startYear: r.startYear, endYear: r.endYear });
      } else {
        span.startYear = Math.min(span.startYear, r.startYear);
        span.endYear = Math.max(span.endYear, r.endYear);
      }
    }
  }
  const eras: TimelineEraBand[] = [...eraSpanByLabel.entries()]
    .map(([label, span]) => ({
      label,
      shortLabel: ERA_SHORT_LABELS[label] ?? label,
      startYear: span.startYear,
      endYear: span.endYear,
      lane: 0,
    }))
    .sort((a, b) => a.startYear - b.startYear || a.endYear - b.endYear);
  // 時代帯のレーンは通史の本流（eraOrderのうち移行期・並立期でないもの）を
  // 優先して上の段から詰める。開始年順の貪欲法だと隋末と隋に挟まれた唐などの
  // 主要時代が3段目に落ちてしまうため、優先順に区間の空きへ差し込む方式にする。
  const parallelEras = new Set(["新〜後漢初", "五胡十六国", "隋末"]);
  const eraPriority = [
    ...eras.filter((e) => !parallelEras.has(e.label)),
    ...eras.filter((e) => parallelEras.has(e.label)),
  ];
  const eraLanes: { start: number; end: number }[][] = [];
  for (const era of eraPriority) {
    const s = astroYear(era.startYear);
    const e = astroYear(era.endYear);
    let lane = eraLanes.findIndex((intervals) =>
      intervals.every((iv) => e <= iv.start || s >= iv.end),
    );
    if (lane === -1) {
      lane = eraLanes.length;
      eraLanes.push([]);
    }
    eraLanes[lane].push({ start: s, end: e });
    era.lane = lane;
  }

  // --- 並立数カーブと空位期間: astro年ごとの同時在位皇帝数 ---
  const startYear = Math.min(...bands.map((b) => b.startYear));
  const endYear = Math.max(...bands.map((b) => b.endYear));
  const t0 = astroYear(startYear);
  const concurrency = new Array<number>(astroYear(endYear) - t0 + 1).fill(0);
  for (const e of data.emperors) {
    for (const r of e.reigns) {
      for (let t = astroYear(r.startYear); t <= astroYear(r.endYear); t++) {
        concurrency[t - t0] += 1;
      }
    }
  }
  const fromAstro = (t: number) => (t <= 0 ? t - 1 : t);
  const vacancies: TimelineVacancy[] = [];
  for (let i = 0; i < concurrency.length; i++) {
    if (concurrency[i] > 0) continue;
    let j = i;
    while (j + 1 < concurrency.length && concurrency[j + 1] === 0) j++;
    const s = fromAstro(t0 + i);
    const e = fromAstro(t0 + j);
    vacancies.push({
      startYear: s,
      endYear: e,
      label: VACANCY_LABELS[`${s}:${e}`] ?? "皇帝不在",
    });
    i = j;
  }

  timelineCache = {
    startYear,
    endYear,
    eras,
    eraLaneCount: eraLanes.length,
    bands,
    laneCount: mainLaneCount + otherLaneCount,
    mainLaneCount,
    vacancies,
    concurrency,
    maxConcurrency: Math.max(...concurrency),
  };
  return timelineCache;
}

// --- 通史年表v2「大河」ビュー（構築ロジックはtimeline-river.ts） ---
let riverCache: RiverTimelineData | null = null;
export function getRiverTimelineData(): RiverTimelineData {
  riverCache ??= buildRiverTimeline(data.emperors);
  return riverCache;
}

export interface PortraitCredit {
  id: string;
  commonName: string;
  dynasty: string;
  licenseShortName: string;
  commonsPageUrl: string;
}

/** このサイトについてページ用：肖像画の出典クレジット一覧（サイトで実際に使う150件）。 */
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
