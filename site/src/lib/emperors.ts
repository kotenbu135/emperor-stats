import fs from "node:fs";
import path from "node:path";
import { BASE_PATH } from "@/lib/base-path";
import {
  astroYear,
  DATABASE_COLUMN_COUNT,
  eraOrder,
  formatReignDuration,
  formatYear,
  type AccessionAxes,
  type AccessionRouteCategory,
  type DeathCauseCategory,
  type DynastyCategory,
  type DynastyOption,
  type EmperorEventKind,
  type EmperorEventRow,
  type EmperorListRecord,
  type EmperorNarrative,
  type EmperorProfile,
  type EmperorRecord,
  type EmperorStructuredDates,
  type EmperorTableRecord,
  type EmperorVideo,
  type MetricRank,
  type NarrativeSection,
  type RankingMetricKey,
} from "@/lib/emperor-types";

export * from "@/lib/emperor-types";
import { kanaExpansionsOf } from "@/lib/kana-readings";
import { rubyOf } from "@/lib/name-readings";
import { assertValidRubySource } from "@/lib/ruby";
import {
  DISPLAY_NAME_OVERRIDES,
  SUBTITLE_OVERRIDES,
  emperorDisplayName,
  emperorSubtitle,
  disambiguatedEmperorName,
  qualifiedEmperorName,
  resolveQualifiedNameCollisions,
} from "@/lib/display-name";
import { emperorsJson } from "@/lib/data-source";

// emperors.json / kinship.json はスキーマ v3（レコードは ID のみ・ラベルは
// meta.catalogs）なので、読み込みと表示ラベルへの解決は lib/data-source.ts が担う。
// このファイルは従来どおり「ラベルが入った形」のデータを扱う。
const rawData = emperorsJson;

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
      const v = videoById.get(id);
      if (!v) {
        throw new Error(
          `emperor-videos.json の videoId "${id}"（${emperorId}）が youtube-playlist.json に存在しません`,
        );
      }
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

const portraitManifestPath = path.join(
  process.cwd(),
  "..",
  "data",
  "images",
  "portraits",
  "manifest.json",
);
interface PortraitManifestEntry {
  id: string;
  commonName: string;
  dynasty: string;
  /** 肖像の中で顔の中心が縦方向のどこにあるか（0=上端・1=下端）。150枚を1枚ずつ
   *  目視して入れた値で、カードの中で顔をどこに置くかの唯一の入力になる。
   *  値の意味と使い方は `components/emperors/portrait.tsx` の `focusObjectPositionY`。 */
  focusY: number;
  licenseShortName: string;
  commonsPageUrl: string;
}
const portraitManifest = JSON.parse(
  fs.readFileSync(portraitManifestPath, "utf-8"),
) as PortraitManifestEntry[];
const portraitFocusById = new Map(
  portraitManifest.map((m) => [m.id, m.focusY] as const),
);
// 肖像がある全員に焦点値があること。欠けると上寄せに落ちて顔が下半分に沈むが、
// 見た目が少し悪いだけなので実行時には気づけない（だからビルドで落とす）。
for (const id of portraitIds) {
  if (typeof portraitFocusById.get(id) !== "number") {
    throw new Error(
      `肖像 ${id} の focusY が manifest.json にありません（肖像を足したら顔の位置も入れること・docs/site-design/PORTRAITS.md）`,
    );
  }
}

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
  /**
   * 単一トークン、または開始・終了で精度が異なる場合の {start, end} オブジェクト（reigns[] と同形式）。
   *
   * **表示には使わない**（2026-08-03・Issue #69）。`events` の日付は保存値の深さ
   * そのものが主張（年 `"1211"`・月 `"1211-05"`・日 `"1211-05-07"`）で、
   * `datePrecision` は「原典が何を言っているか」を記録する別の欄。両方を見て
   * 浅いほうへ丸めると、原典が年までしか言っていない日付を後から確定できたときに
   * **確定した値を表示側が黙って捨てる**。
   */
  datePrecision?: string | { start?: string | null; end?: string | null } | null;
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
  /** lib/data-source.ts が v3 の regimeId・researchSection から組み立てる
   *  （name＝国号・section＝調査ブロック名・category＝政権の性格）。 */
  dynasty: { name: string; category: DynastyCategory; section: string };
  /** 政権の一意 ID（v3 の catalogs.regimes）。 */
  regimeId: string;
  /** 政権の曖昧性のない表示名（catalogs.regimes[].label。例:「梁（蕭梁）」）。 */
  regimeLabel: string;
  /** その政権の中で正規の皇帝か、対立・僭称の皇帝か（v3 で新設）。ID。 */
  standing: string;
  /** 上の表示ラベル（「正規の皇帝」/「対立・僭称の皇帝」）。 */
  standingLabel: string;
  reignSummary: {
    totalReignDuration: {
      displayYears: number;
      approxDays: number;
      needsPreciseDays: boolean;
      /** 在位日数が日まで確定しているか（false なら approxDays は概算）。
       *  **宣言し忘れると undefined になり、絞り込みが黙って全件0になる。** */
      isExact: boolean;
    };
    reignCount: number;
  };
  deathCause?: { category: DeathCauseCategory } & RawNarrativeField;
  /** 多軸化完了（2026-07-26）により全365人が持つ。category は axes からの導出値。 */
  accessionRoute: {
    category: AccessionRouteCategory;
    axes: AccessionAxes;
  } & RawNarrativeField;
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

/**
 * データが扱う年代範囲（天文年・ISO 8601区間）。Dataset JSON-LD の temporalCoverage 用。
 * データの年は歴史紀年（前221年 = -221）なので、ISO 8601（0年あり）へは
 * astroYear() を通してから整形する（通さないと紀元前側が1年古くずれる）。
 */
export const datasetTemporalCoverage = (() => {
  let min = Infinity;
  let max = -Infinity;
  for (const e of data.emperors) {
    for (const r of e.reigns) {
      if (typeof r.startYear === "number" && r.startYear < min) min = r.startYear;
      if (typeof r.endYear === "number" && r.endYear > max) max = r.endYear;
    }
  }
  const iso = (y: number) => {
    const a = astroYear(y);
    return a < 0 ? `-${String(-a).padStart(4, "0")}` : String(a).padStart(4, "0");
  };
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
 * ここに無いsectionが現れた場合は eraLabelOf が throw してビルド時に検出される
 * （皇帝を追加収録したらこの表への追記が必要）。
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

/**
 * **同じ時代の中に**同じ国号の政権が複数あるもの（2026-07-31・Issue #27）。
 * 隋末の「梁」＝梁師都／蕭銑、「楚」＝林士弘／朱粲がこれにあたる。
 * 時代サフィックスでは区別できないので、この2組だけカタログの曖昧性のない表示名
 * （`catalogs.regimes[].label`）へ落とす。他の85政権の表示は変えない
 * — label を全政権に使うと「魏」→「魏（曹魏）」のように41件の表示名が動く。
 */
const ambiguousNameInEra: Set<string> = (() => {
  const regimesByNameEra = new Map<string, Set<string>>();
  for (const e of data.emperors) {
    const key = `${e.dynasty.name}__${eraLabelOf(e.dynasty)}`;
    const set = regimesByNameEra.get(key) ?? new Set<string>();
    set.add(e.regimeId);
    regimesByNameEra.set(key, set);
  }
  return new Set(
    [...regimesByNameEra.entries()].filter(([, s]) => s.size > 1).map(([k]) => k),
  );
})();

function dynastyLabel(e: RawEmperor): string {
  const era = eraLabelOf(e.dynasty);
  if (ambiguousNameInEra.has(`${e.dynasty.name}__${era}`)) {
    // 「梁（蕭銑）」→「梁・蕭銑」。括弧は toNakaguro がサイトの表記（中黒）へ揃える。
    return toNakaguro(e.regimeLabel);
  }
  const name = toNakaguro(e.dynasty.name);
  if (!duplicatedDynastyNames.has(e.dynasty.name)) return name;
  const suffix = ERA_SUFFIX[era] ?? era;
  // 「後漢・後漢」のような重複を避ける（光武帝の後漢はサフィックスなし、五代の後漢のみ「後漢・五代十国」）。
  return suffix === name ? name : `${name}・${suffix}`;
}

/**
 * 王朝の同一性キー。**政権 ID そのもの**（v3 の `catalogs.regimes[].id`）。
 *
 * 2026-07-31 まで `国号__調査ブロック` の複合キーだったが、Issue #27 で
 * 「同じ調査ブロックの中の同名別政権」（隋末の梁2つ・楚2つ）が実在すると分かり、
 * この組み立て方では別政権が1つのキーに潰れることが判明した。政権 ID なら
 * 一意性がデータ側で保証される。`DYNASTY_COLOR_SLOT` のキーもこれに揃えてある。
 */
function dynastyKey(e: RawEmperor): string {
  return e.regimeId;
}

// 王朝ラベルが政権と1対1であること（＝表示上どの政権か分かること）を保証する。
// 政権を分割・追加したときに、同じ表示名の王朝が2つ並ぶ（キーは違うのに見分けが
// つかない）状態で静かに配信されるのを防ぐ。
(() => {
  const regimesByLabel = new Map<string, Set<string>>();
  for (const e of data.emperors) {
    const label = dynastyLabel(e);
    const set = regimesByLabel.get(label) ?? new Set<string>();
    set.add(e.regimeId);
    regimesByLabel.set(label, set);
  }
  const collisions = [...regimesByLabel.entries()].filter(([, s]) => s.size > 1);
  if (collisions.length > 0) {
    throw new Error(
      `王朝の表示ラベルが複数の政権に重複しています: ` +
        collisions
          .map(([label, ids]) => `"${label}" ← ${[...ids].join(", ")}`)
          .join(" / ") +
        `（emperors.ts の dynastyLabel を見直すか、catalogs.regimes[].label で区別してください）`,
    );
  }
})();

/**
 * 表示名（カード1行目・h1）。決め方は lib/display-name.ts に集約してある。
 *
 * commonNameはスキーマ・validate_emperors.pyで非null必須（かつてnullが2件混在し
 * 2026-07-21にデータ側で解消済み）。フォールバックは防御的に維持する。
 *
 * `toNakaguro` は防御用に残してある。2026-08-02（Issue #35）に `KEEP_RAW_NAME` の
 * 4件をデータ側で解消したので、現在は365人すべてが括弧の落ちた形で通り**素通りする**。
 * `commonName` に新しく括弧つきの表示名が入ったときだけ効く。
 */
function displayName(e: RawEmperor): string {
  const raw =
    e.name.commonName ??
    e.name.personalName ??
    e.name.templeName ??
    e.name.posthumousName ??
    "名不詳";
  return toNakaguro(emperorDisplayName(e.id, raw, e.regimeId));
}

/** 皇帝一覧の検索対象文字列。各種名称・別名・王朝名・時代を連結する。
 *  **表示名も入れる** — 括弧を落とした形（「後廃帝（安定王）元朗」→「後廃帝元朗」）は
 *  データのどのフィールドとも一致しないため、入れないと見えている名前で引けない。 */
function searchTextOf(e: RawEmperor, dynastyLabelText: string, era: string): string {
  return [
    displayName(e),
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
    displayName(e),
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

/** ranks・qualifiedName 計算前のレコード（どちらも全レコード出揃ってからでないと決まらない）。 */
type BaseRecord = Omit<
  EmperorRecord,
  "ranks" | "disambiguatedName" | "qualifiedName"
>;

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
  accessionAge: "desc", // 年長順
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
  // 上書きテーブルの打ち間違い・データ側のid変更に気づけるよう存在チェックする
  // （timeline-river.ts の STREAM_DEFS 被覆assertと同じ方針）。
  const idSet = new Set(data.emperors.map((e) => e.id));
  for (const table of [DISPLAY_NAME_OVERRIDES, SUBTITLE_OVERRIDES]) {
    for (const key of Object.keys(table)) {
      if (!idSet.has(key)) {
        throw new Error(`display-name.ts の上書き表に存在しない皇帝id: ${key}`);
      }
    }
  }
  const baseRecords: BaseRecord[] = data.emperors.map((e) => ({
    id: e.id,
    name: displayName(e),
    subtitle: emperorSubtitle(
      e.id,
      e.name.personalName,
      e.regimeId,
      displayName(e),
    ),
    dynastyName: e.dynasty.name,
    dynastySection: e.dynasty.section,
    dynastyKey: dynastyKey(e),
    dynastyLabel: dynastyLabel(e),
    eraLabel: eraLabelOf(e.dynasty),
    dynastyCategory: e.dynasty.category,
    // 政権の中で正規の皇帝か対立・僭称の皇帝か（v3 の standing）。旧 dynasty.category が
    // 政権の性格と混ぜて持っていた人物単位の情報がこちらへ分かれた。
    isRivalClaimant: e.standing === "rival",
    reignApproxDays: e.reignSummary.totalReignDuration.approxDays,
    reignYears: e.reignSummary.totalReignDuration.approxDays / 365,
    reignDurationLabel: formatReignDuration(
      e.reignSummary.totalReignDuration.approxDays,
    ),
    reignNeedsPreciseDays: e.reignSummary.totalReignDuration.needsPreciseDays,
    reignCount: e.reignSummary.reignCount,
    deathCauseCategory: e.deathCause?.category ?? "不詳",
    // 多軸化完了後は全365人が accessionRoute.category を持つ（validate_emperors.py が必須化）。
    accessionRouteCategory: e.accessionRoute.category,
    // 旧「建国」「復位」がラベルから消えた分の情報を、バッジとして即位経路の脇に出す。
    accessionTitleNew: e.accessionRoute.axes.titleOrigin === "新称",
    hasRestoration: e.reigns.some((r) => r.isRestoration),
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
    commonName: e.name.commonName ?? "",
    personalName: e.name.personalName,
    templeName: e.name.templeName,
    posthumousName: e.name.posthumousName,
    aliases: e.name.aliases ?? [],
    wikidataId: e.sources?.wikidata ?? null,
    searchText: searchTextOf(e, dynastyLabel(e), eraLabelOf(e.dynasty)),
    hasPortrait: portraitIds.has(e.id),
    portraitUrl: portraitIds.has(e.id) ? `${BASE_PATH}/portraits/${e.id}.webp` : null,
    portraitFocusY: portraitFocusById.get(e.id) ?? null,
    videos: videosByEmperorId.get(e.id) ?? [],
  }));
  const ranksById = computeRanks(baseRecords);
  // 冠称形（「漢の武帝」）は全員ぶん出揃わないと一意性が判定できない。
  // 同じ王朝の中でぶつかる組にだけ諱を添える（判定と検査は display-name.ts）。
  const needsSubtitle = resolveQualifiedNameCollisions(
    baseRecords.map((r) => ({
      id: r.id,
      displayName: r.name,
      dynastyLabel: r.dynastyLabel,
      subtitle: r.subtitle,
    })),
  );
  allRecordsCache = baseRecords.map((r) => {
    const disambiguatedName = disambiguatedEmperorName(
      r.name,
      r.subtitle,
      needsSubtitle.has(r.id),
    );
    return {
      ...r,
      ranks: ranksById.get(r.id)!,
      disambiguatedName,
      qualifiedName: qualifiedEmperorName(disambiguatedName, r.dynastyLabel),
    };
  });
  return allRecordsCache;
}

/**
 * 皇帝一覧ページ（/emperors）専用の軽量レコード。カード表示・検索・絞り込みに
 * 必要な最小フィールド＋かな検索用のsearchKanaだけを返す（フルのEmperorRecordを
 * 365件クライアントpropsに埋め込むとRSCペイロードが数百KB太るため。全項目は
 * 個別ページ /emperors/{id} が Server Component で読む）。
 */
export function getEmperorListRecords(): EmperorListRecord[] {
  const kanaById = new Map(
    data.emperors.map((e) => [
      e.id,
      searchKanaOf(e, dynastyLabel(e), eraLabelOf(e.dynasty)),
    ]),
  );
  const records = getAllEmperorRecords().map((r) => ({
    id: r.id,
    name: r.name,
    nameRuby: rubyOf(r.name),
    personalName: r.personalName,
    cardSubtitle: r.subtitle,
    cardSubtitleRuby: r.subtitle ? rubyOf(r.subtitle) : null,
    dynastyLabel: r.dynastyLabel,
    dynastyLabelRuby: rubyOf(r.dynastyLabel),
    eraLabel: r.eraLabel,
    eraLabelRuby: rubyOf(r.eraLabel),
    dynastyKey: r.dynastyKey,
    dynastyCategory: r.dynastyCategory,
    isRivalClaimant: r.isRivalClaimant,
    portraitUrl: r.portraitUrl,
    portraitFocusY: r.portraitFocusY,
    periodsLabel: r.periodsLabel,
    searchText: r.searchText,
    searchKana: kanaById.get(r.id)!,
  }));
  // カードに見えている補助名は検索でも必ずヒットすること（見えた名前を検索窓に
  // 打つのが自然な導線のため）。上書きテーブルに各名称フィールドのどれにも
  // 含まれない呼称を入れると破れるので、ビルド時に不変条件として検査する。
  for (const r of records) {
    if (r.cardSubtitle && !r.searchText.includes(r.cardSubtitle)) {
      throw new Error(
        `cardSubtitle "${r.cardSubtitle}" が searchText に無く検索でヒットしない: ${r.id}`,
      );
    }
    // 表示名も同じ理由で検索できること。display-name.ts の上書き表に、データの
    // どの名称フィールドにも無い呼称を入れると「見えている名前で引けない」状態になる。
    // **中黒で区切った断片ごとに見る** — 表示のときだけ括弧が中黒になる名前
    //（かつての「侯景政権・正平」型）は、連結した全体では searchText に一致しない。
    // 2026-08-02（Issue #35）に該当4件が消えて現在は断片＝全体だが、`commonName` に
    // 括弧つきの表示名が入れば再び効くので検査はこのまま残す。
    for (const part of r.name.split("・")) {
      if (!r.searchText.includes(part)) {
        throw new Error(
          `表示名 "${r.name}" の "${part}" が searchText に無く検索でヒットしない: ${r.id}`,
        );
      }
    }
  }
  return records;
}

/**
 * データベースページ（/database）専用のレコード。表が描く列だけを返す。
 * フィールドの取捨の理由は emperor-types.ts の EmperorTableRecord を参照。
 *
 * **並びは在位開始年の昇順**（2026-07-31 ユーザー決定）。`data/emperors.json` の
 * 収録順は年代順ではなく**調査ブロック順**で、ブロック内は「その時代の主だった王朝を
 * 全部置いてから割拠政権・対立皇帝を後ろにまとめる」並びになっている。そのため収録順のまま出すと
 * 呉周（1678–1681）が清の宣統帝（〜1945）の後ろに来るような、200年超さかのぼる
 * 箇所が20件生じる。表は上から年代順に読まれる面なので、ここで並べ直す。
 *
 * 同年は収録順で安定させる（＝同じ年に立った政権どうしは調査ブロックの並びを保つ）。
 * 復位のある皇帝は**最初の在位の開始年**で位置を決める（宣統帝は1908年の位置）。
 */
export function getEmperorTableRecords(): EmperorTableRecord[] {
  const firstStartYearById = new Map(
    data.emperors.map((e) => [
      e.id,
      e.reigns.reduce(
        (min, r) => (r.startYear < min ? r.startYear : min),
        Number.POSITIVE_INFINITY,
      ),
    ]),
  );
  return getAllEmperorRecords()
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const ya = firstStartYearById.get(a.r.id)!;
      const yb = firstStartYearById.get(b.r.id)!;
      return ya !== yb ? ya - yb : a.i - b.i;
    })
    .map(({ r }) => ({
      id: r.id,
      name: r.name,
      nameRuby: rubyOf(r.name),
      personalName: r.personalName,
      dynastyLabel: r.dynastyLabel,
      dynastyLabelRuby: rubyOf(r.dynastyLabel),
      dynastyKey: r.dynastyKey,
      eraLabel: r.eraLabel,
      periodsLabel: r.periodsLabel,
      firstStartYear: firstStartYearById.get(r.id)!,
      reignApproxDays: r.reignApproxDays,
      reignDurationLabel: r.reignDurationLabel,
      reignCount: r.reignCount,
      accessionRouteCategory: r.accessionRouteCategory,
      deathCauseCategory: r.deathCauseCategory,
      accessionAge: r.accessionAge,
      deathAge: r.deathAge,
    }));
}

/** 王朝(政権 ID をキーにした)選択肢一覧。時代グループ順→データ内初出順で並べる。 */
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
  // eraOrder 未登録の時代はサイレントに末尾へ落とさず、ビルド時に検出する
  // （時代グループ見出し・集計の並びが静かに崩れるのを防ぐ）。
  const eraIndexOf = (era: string): number => {
    const idx = eraIndex.get(era);
    if (idx === undefined) {
      throw new Error(
        `eraOrder 未登録の時代ラベルです: "${era}"（emperor-types.ts の eraOrder に追加してください）`,
      );
    }
    return idx;
  };
  return options
    .map((o, i) => ({ o, i }))
    .sort((a, b) => {
      const ea = eraIndexOf(a.o.era);
      const eb = eraIndexOf(b.o.era);
      return ea !== eb ? ea - eb : a.i - b.i;
    })
    .map(({ o }) => o);
}

/** reigns[].duration.source。quote/conversionはtask.md 3-1フェーズBで整備（一部未付与）。 */
interface RawDurationSource extends RawSource {
  /** 旧い器。構造化引用 `quotes[]` へ移した容器では消える（Issue #69・計画7節の4）。 */
  quote?: string | null;
  conversion?: string | null;
}

/**
 * 構造化引用（Issue #69・計画7節の4）。どの書のどの巻に在るかを機械で読める形。
 * **サイトにはまだ出していない**（型だけ宣言してある）。出すときは
 * `getEmperor*` 側がフィールドを列挙して拾う作りなので、拾う場所も足すこと
 * — 宣言し忘れは型エラーにならず undefined になる。
 */
interface RawQuote {
  bookId: string;
  volume?: number | null;
  text: string;
}

// **この型は JSON の部分ビューで、読み込みは `as unknown as` を通る** — 宣言し忘れた
// フィールドは型エラーにならず undefined になる（「全部ゼロの図」が静かに出来上がる）。
// 触る値は必ずここに書くこと。
interface RawReign {
  startYear: number;
  endYear: number;
  startDate?: string | null;
  /** 在位の終了日（ISO・天文年）。同時在位数の区間の右端。 */
  endDate?: string | null;
  /** 日付の精度（"day"/"month"/"year" ほか自由記述）。**表示には使わない**（読む箇所は無い）。
   *  `reigns[]` だけは集計の根なのでフル ISO ＋ `datePrecision` の規約のまま据え置かれており、
   *  `events`・`ages`（深さ＝主張）とは別の規約であることの目印としてここに残す。 */
  datePrecision?: { start?: string | null; end?: string | null } | null;
  /** 王朝内での即位順(通し番号・復位も別カウント)。未付与の王朝あり。 */
  dynastyOrder?: number | null;
  isRestoration: boolean;
  note: string | null;
  duration?: { source?: RawDurationSource | null; quotes?: RawQuote[] | null } | null;
}

function formatPeriod(reign: RawReign): string {
  return reign.startYear === reign.endYear
    ? `${formatYear(reign.startYear)}年`
    : `${formatYear(reign.startYear)}–${formatYear(reign.endYear)}年`;
}

/** noteの先頭一文（「〜。」まで）を取り出す。出来事の要約として使う。 */
function firstSentence(note: string | null): string | null {
  if (!note) return null;
  const idx = note.indexOf("。");
  return idx === -1 ? note : note.slice(0, idx + 1);
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

/**
 * 皇帝ごとの紹介文（`../data/emperor-profiles.json`・GitHub Issue #16）。
 *
 * emperors.json ではなく別ファイルなのは、紹介文が原典調査の結果ではなく編集
 * コンテンツで、約7MBのデータセットを365回の追記で触ると並行セッションの
 * read-modify-write と衝突するため（EMPEROR_PAGE_PLAN_2026-08-01.md の5節）。
 *
 * **365人分が揃うまでは大半が未執筆**。ページ側は null を受けて節ごと出さない
 * 作りにしてあるので、書けた人物から順に反映される。
 */
const profilesPath = path.join(
  process.cwd(),
  "..",
  "data",
  "emperor-profiles.json",
);
const emperorProfiles = (
  JSON.parse(fs.readFileSync(profilesPath, "utf-8")) as {
    profiles: Record<
      string,
      { lead?: string; body?: string; description?: string }
    >;
  }
).profiles;
// 打ち間違えたidの紹介文が黙って表示されないようにする（kana-readings・
// DYNASTY_COLOR_SLOT と同じ、書き足し漏れ・書き間違いをビルドで止める assert）。
for (const key of Object.keys(emperorProfiles)) {
  if (!rawEmperorById.has(key)) {
    throw new Error(`emperor-profiles.json に存在しない皇帝id: ${key}`);
  }
  const { lead, body, description } = emperorProfiles[key];
  // lead・body は総ルビ（Issue #20 の T2）。壊れた記法をここで止める。
  if (lead) assertValidRubySource(lead, `emperor-profiles.json「${key}」の lead`);
  if (body) assertValidRubySource(body, `emperor-profiles.json「${key}」の body`);
  // description は <meta> と Person JSON-LD にしか出ないので**平文で持つ**
  // （2026-08-01 決定）。ルビ記法が紛れ込むと「｜」がそのまま検索結果に出るため、
  // 描画側で strip するのではなくデータ側を平文に固定してビルドで落とす。
  if (description && /[｜《》]/.test(description)) {
    throw new Error(
      `emperor-profiles.json「${key}」の description にルビ記法があります: ` +
        `description は <meta>・JSON-LD 専用なので平文で書きます（ルビは lead だけ）`,
    );
  }
}

/**
 * 紹介文。ヒーロー内の導入 lead ／「人物紹介」節の本文 body ／
 * metadata・JSON-LD 用の1文 description。未執筆はnull。
 */
export function getEmperorProfile(id: string): EmperorProfile | null {
  const p = emperorProfiles[id];
  if (!p?.lead && !p?.body && !p?.description) return null;
  return {
    lead: p.lead ?? null,
    body: p.body ?? null,
    description: p.description ?? null,
  };
}

/**
 * 個別ページ用に、経緯note全文と出典を返す。idは収録済み前提。
 *
 * 2026-08-02 に「在位日付の典拠」（reigns[].duration.source）と「調査メモ」
 * （回数系8項目・agesのnote）を返すのをやめた。ページ末尾の畳んだ2節を廃止した
 * ためで、根拠そのものは配布データ（data/emperors.json）に入っている。
 */
export function getEmperorNarrative(id: string): EmperorNarrative {
  const e = rawEmperorById.get(id);
  if (!e) throw new Error(`未収録の皇帝idです: ${id}`);
  return {
    accession: narrativeSectionOf(e.accessionRoute),
    accessionAxes: e.accessionRoute.axes,
    death: narrativeSectionOf(e.deathCause),
    restorations: e.reigns
      .filter((r) => r.isRestoration && r.note)
      .map((r) => ({ periodLabel: formatPeriod(r), note: r.note! })),
  };
}

/** parseEventDateが読み取った年月日をISO 8601形式の文字列に整形する（負の年＝紀元前）。 */
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
 * 読み取りはイベント日付と同じparseEventDateを流用する。
 *
 * **保存値の深さをそのまま出す**（`ages` も 2026-08-03 に深さ＝主張へ揃えた）。
 * 年精度の値は "1211"、月精度は "1211-05" のまま返る。schema.org は部分日付を
 * 認めているので、桁を埋めて日まで在るように見せない。
 */
function structuredDateOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parsed = parseEventDate(raw);
  if (!parsed) return null;
  return isoDateOf(parsed);
}

/** 個別ページの構造化データ（Person JSON-LD）用の生年月日・没年月日。idは収録済み前提。 */
export function getEmperorStructuredDates(id: string): EmperorStructuredDates {
  const e = rawEmperorById.get(id);
  if (!e) throw new Error(`未収録の皇帝idです: ${id}`);
  return {
    birthDate: structuredDateOf(e.ages?.birthDate),
    deathDate: structuredDateOf(e.ages?.deathDate),
  };
}

// ---------------------------------------------------------------------------
// 在位中の出来事年表（個別ページ）。7種別のevents[]を日付順にマージする。

/**
 * **日付は保存値の深さをそのまま出す**（2026-08-03・Issue #69）。
 *
 * 以前はここで `datePrecision` を正規化し、それを超える細かさを捨てていた。
 * 埋め草（`-01-01`）が入っていた時代は、深い値が実日付とは限らなかったためで、
 * 2026-08-03 の移行で埋め草を廃止し**深さそのものが主張**になったので役目が終わった。
 * 移行後の実データでは丸めが働く値は**イベント・`ages` とも0件**（保存値の深さは
 * `datePrecision` 以下であることを `validate_emperors.py` の `check_event_date_format`
 * ／`check_ages` が保証する）。**残しておくと害のほうが大きい** — 原典が年までしか
 * 言っていない出来事の日付を別の証人から確定できたとき、表示側が黙って年へ戻す。
 */

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
  const s = parseEventDate(startRaw);
  if (!s) return { label: startRaw, sortKey: null };
  let label = formatEventDate(s);
  const end = ev.endDate ? parseEventDate(ev.endDate) : null;
  if (end) {
    const endLabel = formatEventDate(end);
    if (endLabel !== label) label = `${label}〜${endLabel}`;
  }
  return {
    label,
    // 0年なし対策の連続年（astroYear）ベースで 年*10000 + 月*100 + 日。
    sortKey: astroYear(s.year) * 10000 + (s.month ?? 0) * 100 + (s.day ?? 0),
  };
}

/**
 * 出来事種別と指標の対応（表示上の基本順序を兼ねる）。
 *
 * **`rebellionSuppressionCount` は年表に出さない。** 反乱鎮圧と被反乱は同じ反乱を
 * 両面から数えたもので（数え方は /about の用語説明）、1,494件のうち1,483件は
 * 被反乱側にも同じ反乱が入っている。両方を並べると年表が同じ事件の2行で埋まる。
 * 件数の多い被反乱（1,853件）だけを残す（回数そのものは基本情報の表に両方出る）。
 */
const EVENT_METRICS: {
  kind: EmperorEventKind;
  pick: (e: RawEmperor) => RawCount | undefined;
}[] = [
  { kind: "eraChange", pick: (e) => e.eraChangeCount },
  { kind: "amnesty", pick: (e) => e.amnestyCount },
  { kind: "empressInstallation", pick: (e) => e.empressInstallationCount },
  { kind: "crownPrinceDeposition", pick: (e) => e.crownPrinceDepositionCount },
  { kind: "personalCampaign", pick: (e) => e.personalCampaignCount },
  { kind: "rebellionSuffered", pick: (e) => e.rebellionSufferedCount },
  { kind: "capitalRelocation", pick: (e) => e.capitalRelocationCount },
];

/** 種別ごとの1行要約と構造化フィールドの内訳。 */
function eventSummaryOf(kind: EmperorEventKind, ev: RawEvent): string {
  switch (kind) {
    case "personalCampaign":
      return ev.target ?? "親征";
    case "rebellionSuffered":
      return ev.name ?? (ev.leader ? `${ev.leader}の反乱` : "反乱");
    case "capitalRelocation":
      return `${ev.from ?? "?"} → ${ev.to ?? "?"}`;
    default:
      // 改元・大赦・立后・皇太子廃立はnoteの先頭一文を要約に使う。
      return firstSentence(ev.note ?? null) ?? "（記録なし）";
  }
}

/**
 * 個別ページ用に、7種別のevents[]を日付順にマージして返す。西暦換算されていない
 * 日付（元号表記）・日付不明の出来事はソートできないため、種別順・原文順のまま
 * 末尾にまとめる（sortは安定ソート）。
 *
 * **1行＝種別・日付・要約だけを返す**（2026-08-03 ユーザー決定・Issue #69）。
 * 首謀者・結果・note全文・出典（`source.page`）は返さない。note は調査の作業ログで、
 * その中の引用は配布データが底本に実在すると主張するものではない（線引きは /about）。
 * 出典が消えるのは note と同じ理由で、`source.page` が散文＝巻を機械で照合できないため
 * （書名と巻を欄として持つ `source.bookId`／`volume` へ移す作業は途中）。
 */
export function getEmperorEvents(id: string): EmperorEventRow[] {
  const e = rawEmperorById.get(id);
  if (!e) throw new Error(`未収録の皇帝idです: ${id}`);
  const rows: (EmperorEventRow & { sortKey: number | null })[] = [];
  for (const { kind, pick } of EVENT_METRICS) {
    for (const ev of pick(e)?.events ?? []) {
      const { label, sortKey } = eventDateOf(ev);
      rows.push({
        kind,
        dateLabel: label,
        summary: eventSummaryOf(kind, ev),
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
// トップページ（概要ダッシュボード）の中身。
//
// 旧トップはサイドバーと同じ8項目をカード化して「見る」ボタンを添えたリンク集
// だった。ナビゲーションと1対1で重複するぶん情報量が増えず、365人分の集計を
// 持つサイトの入口として中身を何も見せていなかった。ここではリンクの代わりに、
// 各ページの実データの抜粋（上位ランキング・内訳・時代ごとの厚み）を供給する。
//
// 数値の出どころは各ページのチャートと同じ getAllEmperorRecords で、母集団の
// 絞り込みを挟まない（トップと個別ページで数字がずれないようにするため）。

/** トップページのミニランキング1行分。 */
export interface HomeRankedEmperor {
  id: string;
  name: string;
  personalName: string | null;
  dynastyLabel: string;
  dynastyKey: string;
  portraitUrl: string | null;
  valueLabel: string;
  /** 1位を1とした相対長（ミニ棒の幅に使う）。 */
  ratio: number;
}

/** 内訳（死因・即位経路）1区分。 */
export interface HomeBreakdownSlice {
  category: string;
  count: number;
  /** 表示用の丸めた百分率。合計は必ずしも100にならない。 */
  percent: number;
  /** 一覧に出す百分率の表示。1%未満の区分は「0%」ではなく小数1桁で出す
   *  （1名でも該当者がいることを「0%」と読ませない）。 */
  percentLabel: string;
  /** 帯の幅に使う実数比（0〜1）。丸めずに持つ。 */
  share: number;
}

/** 時代ごとの皇帝数。 */
export interface HomeEraBand {
  label: string;
  count: number;
  share: number;
}

/** 世紀ごとの即位人数（1本＝1世紀）。 */
export interface HomeCenturyBand {
  /** 軸ラベル用の短い表記（"前3"・"20"）。 */
  label: string;
  /** ツールチップ・読み上げ用（"前3世紀"）。 */
  fullLabel: string;
  count: number;
}

/**
 * 「在位年数と死因」の帯の区分。凡例・配色・件数の並びはこの1か所で決まる。
 *
 * 死因8区分をそのまま幅434pxの列の帯に出しても読めないので3つに畳む
 * ここに挙げた死因ラベルはカタログとの一致を data-source.ts の
 * assertLabels("deathCause") が保証するが、**カタログに区分が増えたときの
 * 取りこぼしは reignDeathBands() が実行時に throw して知らせる**
 * （黙って「不詳ほか」に混ぜない）。
 */
const REIGN_DEATH_SEGMENTS: {
  name: string;
  /** 畳んだ中身。凡例の title に出す（名前だけでは何が入るか分からないため）。 */
  detail: string | null;
  causes: string[];
}[] = [
  {
    name: "非業の死",
    detail: "暗殺・処刑・戦死・自尽",
    causes: ["暗殺", "処刑", "戦死", "自尽"],
  },
  { name: "病死", detail: null, causes: ["病死"] },
  {
    name: "不詳ほか",
    detail: "不詳・諸説あり・事故死",
    causes: ["不詳", "諸説あり", "事故死"],
  },
];

/**
 * 在位年数の帯。境界は「以上・未満」で切る（3年ちょうどは「3〜10年」）。
 * 各帯が最低56名になるように取ってあり、区切りを動かすと n が痩せる帯が出る。
 */
const REIGN_BANDS: { label: string; min: number; max: number }[] = [
  { label: "1年未満", min: 0, max: 1 },
  { label: "1〜3年", min: 1, max: 3 },
  { label: "3〜10年", min: 3, max: 10 },
  { label: "10〜20年", min: 10, max: 20 },
  { label: "20年以上", min: 20, max: Infinity },
];

/** 在位年数帯1本分（帯＝100%積み上げ1行）。 */
export interface HomeReignDeathBand {
  label: string;
  count: number;
  /** segments と同じ並びの件数。合計は count に一致する。 */
  values: number[];
  /** 先頭区分（非業の死）の割合。行の右端に数値で直接出す。 */
  violentPercent: number;
}

export interface HomeReignDeath {
  segments: { name: string; detail: string | null }[];
  bands: HomeReignDeathBand[];
}

/** トップのランキングパネル1枚（タブ1枚に対応）。 */
export interface HomeRankingPanel {
  key: string;
  /** タブに出す短い名前。 */
  label: string;
  /** 見出し下の説明（母集団と数え方をここで明示する）。 */
  description: string;
  /** 一覧の右列の見出し。 */
  valueHeader: string;
  /** 全順位を載せた面へのリンク。**無い指標は null** —
   *  2026-07-31 に /ages を廃止し、年齢2指標は行き先が無くなった。 */
  href: string | null;
  linkLabel: string | null;
  rows: HomeRankedEmperor[];
}

export interface HomeHighlights {
  longestReigns: HomeRankedEmperor[];
  /** 在位期間・即位年齢・没年齢のランキング（タブ切り替え用）。 */
  rankings: HomeRankingPanel[];
  deathCauses: HomeBreakdownSlice[];
  accessionRoutes: HomeBreakdownSlice[];
  /** 在位年数帯 × 死因（世紀チャートの隣の1枚）。 */
  reignDeath: HomeReignDeath;
  eras: HomeEraBand[];
  centuries: HomeCenturyBand[];
  dynastyCount: number;
  /** 収録範囲の表示（例: "前221年〜1912年"）。 */
  yearSpanLabel: string;
}

/**
 * reigns[].startYear / endYear を表示用の和年表記へ。
 * この2フィールドは天文年ではなく歴史年（紀元前221年 = -221・0年は存在しない）で
 * 入っているため、負値はそのまま絶対値を「前N年」にする（1を足さない）。
 */
function historicalYearLabel(year: number): string {
  return year < 0 ? `前${-year}年` : `${year}年`;
}

function breakdown(
  records: EmperorRecord[],
  pick: (r: EmperorRecord) => string,
): HomeBreakdownSlice[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    const key = pick(r);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = records.length;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => {
      const share = count / total;
      const percent = Math.round(share * 100);
      return {
        category,
        count,
        percent,
        percentLabel: percent >= 1 ? `${percent}%` : `${(share * 100).toFixed(1)}%`,
        share,
      };
    });
}

/**
 * 在位年数帯ごとの死因構成。母集団は365名全員で、絞り込みを挟まない
 * （在位0日の金末帝も「1年未満」に入る。在位年数は他のページと同じ
 * reignYears = approxDays / 365 を使い、ここで別の割り方をしない）。
 */
function reignDeathBands(records: EmperorRecord[]): HomeReignDeath {
  const segmentIndexOf = new Map<string, number>();
  REIGN_DEATH_SEGMENTS.forEach((s, i) =>
    s.causes.forEach((c) => segmentIndexOf.set(c, i)),
  );
  const bands = REIGN_BANDS.map((b) => ({
    label: b.label,
    count: 0,
    values: REIGN_DEATH_SEGMENTS.map(() => 0),
    violentPercent: 0,
  }));
  for (const r of records) {
    const bandIndex = REIGN_BANDS.findIndex(
      (b) => r.reignYears >= b.min && r.reignYears < b.max,
    );
    if (bandIndex < 0) {
      throw new Error(
        `${r.id}: 在位${r.reignYears}年が REIGN_BANDS のどの帯にも入りません`,
      );
    }
    const segmentIndex = segmentIndexOf.get(r.deathCauseCategory);
    if (segmentIndex === undefined) {
      throw new Error(
        `${r.id}: 死因「${r.deathCauseCategory}」が REIGN_DEATH_SEGMENTS の` +
          "どの区分にも入りません（死因の区分を増やしたら、この表にも足してください）",
      );
    }
    bands[bandIndex].count += 1;
    bands[bandIndex].values[segmentIndex] += 1;
  }
  for (const b of bands) {
    b.violentPercent = b.count === 0 ? 0 : Math.round((100 * b.values[0]) / b.count);
  }
  return {
    segments: REIGN_DEATH_SEGMENTS.map((s) => ({ name: s.name, detail: s.detail })),
    bands,
  };
}


/**
 * 指標の降順で上位 topCount 名ちょうどを取り出す。棒の相対長（ratio）は1位を1とした比。
 *
 * **同値が10位をまたいでも必ず topCount 名で切る**（ユーザー判断・2026-07-31）。
 * 同値で行数が増えるとタブを切り替えるたびにカードの高さが変わるため。
 * 回数系の指標は「日まで下りる」ような副次キーを持たないので、同値は
 * 在位日数→id の順で一意に決める（表示順を安定させるためだけの順序で、
 * 順位の主張ではない）。同率を含む正しい順位は各ランキング面が持つ。
 *
 * この切り捨てで枠外に出る人数は指標ごとに違う（2026-08-01 実測: 親征は10位が6回で
 * 同値4名のうち1名、改元は10位が7回で同値5名のうち4名が枠外）。
 */
function topByValue(
  records: EmperorRecord[],
  valueOf: (r: EmperorRecord) => number | null,
  labelOf: (r: EmperorRecord, value: number) => string,
  topCount: number,
): { rows: HomeRankedEmperor[]; total: number } {
  const eligible = records
    .map((r) => ({ r, value: valueOf(r) }))
    .filter((e): e is { r: EmperorRecord; value: number } => e.value !== null)
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      if (b.r.reignApproxDays !== a.r.reignApproxDays) {
        return b.r.reignApproxDays - a.r.reignApproxDays;
      }
      return a.r.id < b.r.id ? -1 : 1;
    });
  if (eligible.length === 0) return { rows: [], total: 0 };

  const maxValue = eligible[0].value;

  return {
    total: eligible.length,
    rows: eligible.slice(0, topCount).map(({ r, value }) => ({
      id: r.id,
      name: r.name,
      personalName: r.personalName,
      dynastyLabel: r.dynastyLabel,
      dynastyLabelRuby: rubyOf(r.dynastyLabel),
      dynastyKey: r.dynastyKey,
      portraitUrl: r.portraitUrl,
      valueLabel: labelOf(r, value),
      ratio: value / maxValue,
    })),
  };
}

/** 歴史年（0年なし）を世紀番号へ。前3世紀 = -3・20世紀 = 20。 */
function centuryOf(year: number): number {
  const c = Math.ceil(Math.abs(year) / 100);
  return year < 0 ? -c : c;
}

/** トップページ用の抜粋データ。ビルド時に一度だけ計算する。 */
export function getHomeHighlights(topCount = 6): HomeHighlights {
  const records = getAllEmperorRecords();
  const total = records.length;

  const reign = topByValue(
    records,
    (r) => r.reignApproxDays,
    (r) => r.reignDurationLabel,
    topCount,
  );
  const campaign = topByValue(
    records,
    (r) => r.personalCampaignCount,
    (_r, value) => `${value}回`,
    topCount,
  );
  const eraChange = topByValue(
    records,
    (r) => r.eraChangeCount,
    (_r, value) => `${value}回`,
    topCount,
  );
  const longestReigns = reign.rows;

  // 回数系の母集団の内訳は `topByValue` の total から取れない。total は
  // 「値が null でない人数」＝365名で、0回の人物を含むため（`computeRanks` 側の
  // `isRanked` は0回を順位から外しており基準が違う）。説明文に出す「1回以上」は
  // ここで数える（データ訂正で動く数字なので文言に焼き込まない）。
  const campaignActive = records.filter(
    (r) => r.personalCampaignCount > 0,
  ).length;
  const eraChangeActive = records.filter((r) => r.eraChangeCount > 0).length;

  const rankings: HomeRankingPanel[] = [
    {
      key: "reign",
      label: "在位期間",
      description: `即位から退位・崩御するまでの即位期間が長かった人物です`,
      valueHeader: "在位",
      href: "/database?sort=reignApproxDays&order=desc",
      linkLabel: `全${reign.total}名の順位 →`,
      rows: reign.rows,
    },
    // 親征・改元は下層の統計ページを持たない（/database は回数系の列を持たない）ため
    // href は null。年齢2タブと違い**0回が実在するので母集団は365名全員**で、
    // 「判明者のみ」の但し書きは要らない代わりに0回の人数を出す。
    {
      key: "campaign",
      label: "親征回数",
      description: `皇帝自身が軍を率いて出征した回数です。${total}名全員が母集団で、1回以上が${campaignActive}名、${total - campaignActive}名は一度も親征していません`,
      valueHeader: "回数",
      href: null,
      linkLabel: null,
      rows: campaign.rows,
    },
    {
      key: "era-change",
      label: "改元回数",
      description: `即位に伴う建元も1回に数えた改元の回数です。${total}名全員が母集団で、1回以上が${eraChangeActive}名、${total - eraChangeActive}名は一度も改元していません`,
      valueHeader: "回数",
      href: null,
      linkLabel: null,
      rows: eraChange.rows,
    },
  ];

  // 時代の並びは元データの収録順（＝時系列）をそのまま使う。ソートすると
  // 「五胡十六国」より「三国」が後ろに来るような並びになってしまう。
  const eraCounts = new Map<string, number>();
  for (const r of records) {
    eraCounts.set(r.eraLabel, (eraCounts.get(r.eraLabel) ?? 0) + 1);
  }
  const eras: HomeEraBand[] = [...eraCounts.entries()].map(([label, count]) => ({
    label,
    count,
    share: count / total,
  }));

  let minYear = Infinity;
  let maxYear = -Infinity;
  // 世紀ごとの即位人数。復位した皇帝も「最初に即位した年」の1回だけ数える
  // （在位期間ではなく即位という出来事の分布なので、世紀をまたぐ在位は割らない）。
  const centuryCounts = new Map<number, number>();
  for (const e of data.emperors) {
    let firstStart: number | null = null;
    for (const r of e.reigns) {
      if (typeof r.startYear === "number") {
        if (r.startYear < minYear) minYear = r.startYear;
        if (firstStart === null || r.startYear < firstStart)
          firstStart = r.startYear;
      }
      if (typeof r.endYear === "number" && r.endYear > maxYear)
        maxYear = r.endYear;
    }
    if (firstStart !== null) {
      const c = centuryOf(firstStart);
      centuryCounts.set(c, (centuryCounts.get(c) ?? 0) + 1);
    }
  }

  // 空の世紀も0本として残し、横軸を連続した時間にする（詰めると間隔が嘘になる）。
  const centuryKeys = [...centuryCounts.keys()];
  const centuries: HomeCenturyBand[] = [];
  for (let c = Math.min(...centuryKeys); c <= Math.max(...centuryKeys); c += 1) {
    if (c === 0) continue; // 0世紀は存在しない
    centuries.push({
      label: c < 0 ? `前${-c}` : `${c}`,
      fullLabel: c < 0 ? `前${-c}世紀` : `${c}世紀`,
      count: centuryCounts.get(c) ?? 0,
    });
  }

  return {
    longestReigns,
    rankings,
    deathCauses: breakdown(records, (r) => r.deathCauseCategory),
    accessionRoutes: breakdown(records, (r) => r.accessionRouteCategory),
    reignDeath: reignDeathBands(records),
    eras,
    centuries,
    dynastyCount: new Set(records.map((r) => r.dynastyKey)).size,
    yearSpanLabel: `${historicalYearLabel(minYear)}〜${historicalYearLabel(maxYear)}`,
  };
}

// ---------------------------------------------------------------------------
// 概要ダッシュボード3段目の2図（同時在位数・在位継続率）。
//
// 出自は `/lab` の候補7・候補8（検討記録 docs/site-design/CHART_CANDIDATES_2026-07-31.md）で、
// 採用にあたって `lib/lab-stats.ts` からここへ移した。**`/lab` はページごと畳む前提の面**
// なので、公開ページが lab-stats を参照したままにしない。
//
// **数え方を変えると数が動く**（検討記録の実測値と突き合わせられなくなる）。特に:
//  - 日付の埋め方（欠けた月は開始側1月・終了側12月、欠けた日は開始側1日・終了側28日）
//  - 日付そのものが無い在位を startYear/endYear で埋める向き（下の reignRange）
//  - 表示範囲の上限（CONCURRENT_LAST_YEAR）
// 検証は scripts ではなくデータ側から測り直す（site/tools/chart-candidates-stats.py が
// 日単位の最大10人＝618年11月26日を出すので、そこが動いていないことを見る）。

/** 1年の日数。approxDays は年=365換算なので、年へ戻す除数はここで固定する。 */
const DAYS_PER_YEAR = 365.2422;

/**
 * ISO 日付文字列（"-0221-01-01" / "0618-11" / "0618"）→ ユリウス通日。
 * 欠けた月日は区間を**伸ばす向き**に埋める（開始側は1月1日・終了側は12月28日）。
 */
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

/** ユリウス通日 → 歴史紀年（前221年 = -221）。天文年の0年は前1年。 */
function jdnToHistoricalYear(jdn: number): number {
  const y = jdnToYear(jdn);
  return y <= 0 ? y - 1 : y;
}

/** ユリウス通日 → 「618年11月26日」。 */
function jdnToDateLabel(jdn: number): string {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const year = 100 * b + d - 4800 + Math.floor((m + 2) / 12);
  const month = m + 3 - 12 * Math.floor((m + 2) / 12);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  // 天文年 → 歴史紀年（0年は前1年）。ピークは唐初だが、式を年に依存させない。
  return `${historicalYearLabel(year <= 0 ? year - 1 : year)}${month}月${day}日`;
}

/** 歴史紀年 → 年だけの ISO 文字列（"-0220" / "0618"）。日付が無い在位の穴埋めに使う。
 *  `startYear`/`endYear` は歴史紀年、ISO 日付は天文年なので `astroYear` を通す。 */
function isoYearString(year: number): string {
  const a = astroYear(year);
  return a < 0
    ? `-${String(-a).padStart(4, "0")}`
    : String(a).padStart(4, "0");
}

/**
 * 近代（袁世凱の洪憲・溥儀の満洲国）は収録基準の産物で、間の空白年は歴史的空位ではない。
 * 折れ線に出すと「1913〜1933年に皇帝がいなかった」と読めるので表示範囲を切る。
 */
const CONCURRENT_LAST_YEAR = 1912;

/** 同時在位数の折れ線（1本）。 */
export interface HomeConcurrentReigns {
  /**
   * **顔ぶれが変わる年だけ**（先頭と末尾は必ず入れる）。`stepAfter` は次の点まで値を保つので、
   * 同じ人数が続く年を捨てても描画は1年刻みのときと同一になる。
   *
   * **捨てる理由は描画ではなくツールチップ**。2133年ぶんを約609pxへ描くと1px＝3.8年になり、
   * Recharts は最寄りの点しか拾えないので指せない年ができる。
   *
   * **人数ではなく顔ぶれで切る**のは、人数が同じまま代替わりする段があるため
   * （隋の590〜616年は1人のまま文帝→煬帝と替わる）。人数で切ると、段の途中を指したときに
   * ツールチップの「誰が」が嘘になる。
   *
   * `endYear` はその段が続く最後の年（ツールチップに「590〜603年」と出すため）。
   * `people` はその年でいちばん人数が多かった瞬間の在位者で、**必ず `count` 人**。
   */
  points: {
    year: number;
    count: number;
    endYear: number;
    people: string[];
  }[];
  /** 全期間の最大（日単位）。`year` は歴史紀年で、図に焼き付ける注記の位置に使う。 */
  peak: { count: number; year: number; dateLabel: string };
  /** 皇帝が1人だけだった年（表示範囲内）。 */
  soleYears: number;
  solePercent: number;
  /** 帝号を持つ人が1人もいなかった年（表示範囲内）。 */
  zeroYears: number[];
  /** 表示範囲。 */
  range: { fromLabel: string; toLabel: string; yearCount: number };
  /** 表示範囲より後に在位した人（切った側を隠さないため）。 */
  excluded: { name: string; periodLabel: string }[];
  /** 区間の作り方の内訳。**全在位が区間になる**ことがこの図の前提。 */
  coverage: { total: number; dated: number; filled: number };
  /**
   * 拡大の行き先（時代プリセット）。**時代ラベルは `ERA_BY_SECTION` の15区分**で、
   * サイトの他の面（一覧の時代ジャンプ・個別ページ）と同じ語彙にそろえてある
   * （`catalogs.eras` の11区分でも新しい呼び名でもない）。
   * 年の範囲はレコードから測った実測値で、表示範囲の上限で頭を切る。
   */
  eraPresets: { label: string; from: number; to: number }[];
}

/**
 * 各年の最大同時在位数。**日付を持つ在位は日で、持たない側だけ在位年で埋める**
 * （2026-08-01 ユーザー決定: なるべく日単位、無理なら月、それも無理なら年）。
 *
 * 日付が全く無い在位を落とすと、秦（前221〜前207）・新（8〜24）・317年の33年が
 * 0人に見える（＝「皇帝がいなかった年」の嘘になる）。年で埋めれば374在位すべてが
 * 区間になり、残る0人の年は楚漢戦争期（前206〜前203）と居摂（7年）だけになる。
 * **埋めは区間を伸ばす向き**なので、この人数は上限側の見積り。
 */
export function getConcurrentReigns(): HomeConcurrentReigns {
  let dated = 0;
  let filled = 0;
  let total = 0;
  interface Span {
    id: string;
    regimeId: string;
    standing: string;
    from: number;
    to: number;
    /** 開始日・終了日が原データに無く、在位年から埋めた値か。 */
    fromFilled: boolean;
    toFilled: boolean;
  }
  const spans: Span[] = [];
  for (const e of data.emperors) {
    for (const r of e.reigns) {
      total += 1;
      const s =
        toJdn(r.startDate, false) ??
        toJdn(isoYearString(r.startYear), false);
      const t =
        toJdn(r.endDate, true) ?? toJdn(isoYearString(r.endYear), true);
      if (s === null || t === null || t < s) {
        throw new Error(`getConcurrentReigns: ${e.id} の在位区間を作れません`);
      }
      if (r.startDate && r.endDate) dated += 1;
      else filled += 1;
      spans.push({
        id: e.id,
        regimeId: e.regimeId,
        standing: e.standing,
        from: s,
        to: t,
        fromFilled: !r.startDate,
        toFilled: !r.endDate,
      });
    }
  }

  // **埋めた日付が作った重なりを畳む。**
  //
  // 日付の無い在位は在位年で埋めている（開始側1月1日・終了側12月28日）が、これは推測なので、
  // **判明している日付と重なったときは推測のほうを譲る**。始皇帝の崩御は前210年9月10日と
  // 判明しているのに、二世皇帝の即位日が無くて前210年1月1日から埋まり、253日重なって
  // その年が2人になっていた（2026-08-01 ユーザー指摘）。
  //
  // 畳むのは**同じ政権の `regular` どうしだけ**。
  //  - `rival`（同一国号内の対立・僭称）は**並び立つのが定義**なので触らない
  //  - **両方とも日付がある重なりは実在の並立**なので触らない（北周の宣帝と静帝＝内禅後も
  //    天元皇帝を称した449日・隋の煬帝と恭帝侑＝長安で立てられた114日・南斉の東昏侯と
  //    和帝＝江陵で立てられた262日）。ここを潰すと本当の二重帝位が消える
  //  - 別政権どうしの並立（魏と蜀漢など）はそもそも対象外
  const byRegime = new Map<string, Span[]>();
  for (const sp of spans) {
    if (sp.standing !== "regular") continue;
    const list = byRegime.get(sp.regimeId);
    if (list) list.push(sp);
    else byRegime.set(sp.regimeId, [sp]);
  }
  for (const list of byRegime.values()) {
    list.sort((a, b) => a.from - b.from || a.to - b.to);
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        if (b.from > a.to) continue; // 重なっていない
        if (!a.toFilled && !b.fromFilled) continue; // 実在の並立
        // **どの寄せ方も、区間を裏返してはいけない。** 判明している側が推測側を
        // まるごと覆っている場合（前帝の崩御日が、埋めた次帝の年末より後）に
        // 開始が終了を追い越し、掃引で「消えない在位者」ができて全期間の人数が壊れる。
        if (b.fromFilled && !a.toFilled && a.to <= b.to) {
          b.from = a.to; // 次帝の即位日を、判明している前帝の崩御日まで下げる
        } else if (a.toFilled && !b.fromFilled && b.from >= a.from) {
          a.to = b.from; // 前帝の終わりを、判明している次帝の即位日まで上げる
        } else if (a.toFilled && b.fromFilled && b.from - 1 >= a.from) {
          a.to = b.from - 1; // どちらも推測。**移り変わりの年は次帝のもの**
        } else if (a.toFilled && b.fromFilled && a.to + 1 <= b.to) {
          b.from = a.to + 1; // 前帝が消えてしまう場合だけ逆へ寄せる
        }
      }
    }
  }

  for (const sp of spans) {
    if (sp.from > sp.to) {
      throw new Error(`getConcurrentReigns: ${sp.id} の在位区間が裏返りました`);
    }
  }

  // **代替わりの日は次帝のものにする。**
  //
  // データは「前帝の崩御日＝次帝の即位日」で入っている（光武帝 0057-03-29 崩御・
  // 明帝 0057-03-29 即位）。そのまま重ねると**通常の父子継承でその年が2人になり**、
  // 「同時に帝号を持っていた」という図の主張が嘘になる（2026-08-01 ユーザー指摘）。
  // 位が動いたのはその日の中の一点であって、2人が並んだ日ではない。
  //
  // 対象は94在位。**1日在位で末日を譲ると消えてしまう場合だけ残す**（金の末帝＝
  // 完顔承麟の1件。哀宗の自尽と同日に立ち同日に戦死しており、そもそも同日の2人）。
  const startDays = new Set(spans.map((x) => x.from));
  const starts = new Map<number, string[]>();
  const ends = new Map<number, string[]>();
  for (const span of spans) {
    const to =
      startDays.has(span.to) && span.to - 1 >= span.from ? span.to - 1 : span.to;
    (starts.get(span.from) ?? starts.set(span.from, []).get(span.from)!).push(
      span.id,
    );
    (ends.get(to + 1) ?? ends.set(to + 1, []).get(to + 1)!).push(span.id);
  }

  // 境界を順に舐めて在位者集合を保ち、各年へ「その年でいちばん人数が多かった瞬間の
  // 顔ぶれ」を配る。**人数＝顔ぶれの人数**になるので、ツールチップの数と名前が食い違わない
  // （618年に帝号を持った人は14名だが、煬帝は4月に殺され恭帝侑は6月に譲位しているので、
  // 同時に並んだ最大は11月26日の10名）。
  const boundaries = [...new Set([...starts.keys(), ...ends.keys()])].sort(
    (a, b) => a - b,
  );
  const peakByYear = new Map<number, string[]>();
  const live = new Set<string>();
  let peakCount = 0;
  let peakJdn = 0;
  for (let i = 0; i < boundaries.length; i += 1) {
    const at = boundaries[i];
    for (const id of ends.get(at) ?? []) live.delete(id);
    for (const id of starts.get(at) ?? []) {
      // 同一人物の在位区間が重なると、Set では1人のまま先に来た終了で消える
      // （復位者8名は現状どれも重なっていないが、重なった瞬間に静かに壊れる）。
      if (live.has(id)) {
        throw new Error(`getConcurrentReigns: ${id} の在位区間が重なっています`);
      }
      live.add(id);
    }
    if (live.size > peakCount) {
      peakCount = live.size;
      peakJdn = at;
    }
    if (live.size === 0) continue;
    const snapshot = [...live];
    const from = jdnToYear(at);
    const to = i + 1 < boundaries.length ? jdnToYear(boundaries[i + 1] - 1) : from;
    for (let y = from; y <= to; y += 1) {
      const cur = peakByYear.get(y);
      if (cur === undefined || snapshot.length > cur.length) {
        peakByYear.set(y, snapshot);
      }
    }
  }

  let firstYear = Infinity;
  for (const e of data.emperors) {
    for (const r of e.reigns) {
      if (r.startYear < firstYear) firstYear = r.startYear;
    }
  }

  // 1年刻みの全点。**注記の数（0人の年・1人だけの年・表示範囲の長さ）はこちらで数える** —
  // 下で変化点へ間引くので、間引いたあとの配列で数えると全部おかしくなる。
  const yearly: { year: number; ids: string[] }[] = [];
  const zeroYears: number[] = [];
  let sole = 0;
  for (let y = firstYear; y <= CONCURRENT_LAST_YEAR; y += 1) {
    if (y === 0) continue; // 歴史紀年に0年は無い
    const ids = peakByYear.get(astroYear(y)) ?? [];
    if (ids.length === 0) zeroYears.push(y);
    if (ids.length === 1) sole += 1;
    yearly.push({ year: y, ids });
  }

  /** 表示名。**冠称形（「漢の武帝」）を使う** — 王朝ラベルは政権と1対1であることを
   *  ビルド時に検査してあり、同名別政権（隋末の梁2つ・楚2つ）もここで割れる。
   *  名前の組み立ては display-name.ts の一点に寄せてある（2026-08-02）。 */
  const qualifiedById = new Map(
    getAllEmperorRecords().map((r) => [r.id, r.qualifiedName]),
  );
  const labelOf = (id: string): string => {
    const label = qualifiedById.get(id);
    if (!label) throw new Error(`getConcurrentReigns: 未知の皇帝 id: ${id}`);
    return label;
  };

  // **顔ぶれが変わる年**だけ残す（人数が同じでも代替わりがあれば残す）。人数は変わらないので
  // 折れ線の形は1年刻みと同じまま、ツールチップの「誰が」が段の中で嘘にならない。
  // **末尾は必ず入れる** — 落とすと最後の段の横線が途中で切れ、横軸の右端も縮む。
  const sameSet = (a: string[], b: string[]) =>
    a.length === b.length && a.every((x) => b.includes(x));
  const points: HomeConcurrentReigns["points"] = [];
  for (let i = 0; i < yearly.length; i += 1) {
    const isLast = i === yearly.length - 1;
    if (i === 0 || isLast || !sameSet(yearly[i].ids, yearly[i - 1].ids)) {
      points.push({
        year: yearly[i].year,
        count: yearly[i].ids.length,
        endYear: yearly[i].year,
        // 人数の多い政権から並べても意味が無いので、収録順（＝おおむね時系列）のまま。
        people: yearly[i].ids.map(labelOf),
      });
    }
  }
  // 各段が続く最後の年（次の変化点の1年前）。ツールチップの範囲表示に使う。
  for (let i = 0; i < points.length - 1; i += 1) {
    points[i].endYear = points[i + 1].year - 1;
    if (points[i].endYear === 0) points[i].endYear = -1; // 0年は無い
  }

  // 時代プリセット。並びは元データの収録順（＝時系列）をそのまま使う
  // （ソートすると「五胡十六国」より「三国」が後ろに来る）。
  const eraSpans = new Map<string, { from: number; to: number }>();
  for (const e of data.emperors) {
    const label = eraLabelOf(e.dynasty);
    const from = Math.min(...e.reigns.map((r) => r.startYear));
    const to = Math.max(...e.reigns.map((r) => r.endYear));
    const cur = eraSpans.get(label);
    if (!cur) eraSpans.set(label, { from, to });
    else {
      cur.from = Math.min(cur.from, from);
      cur.to = Math.max(cur.to, to);
    }
  }
  const eraPresets = [...eraSpans.entries()]
    // 表示範囲の外へはみ出す時代（清は溥儀の満洲国で1945年まで伸びる）は頭を切る。
    .map(([label, s]) => ({
      label,
      from: s.from,
      to: Math.min(s.to, CONCURRENT_LAST_YEAR),
    }))
    .filter((p) => p.to > p.from);

  const excluded = data.emperors
    .filter((e) => e.reigns.some((r) => r.endYear > CONCURRENT_LAST_YEAR))
    .map((e) => {
      const start = Math.min(...e.reigns.map((r) => r.startYear));
      const end = Math.max(...e.reigns.map((r) => r.endYear));
      return {
        name: e.name.commonName ?? e.id,
        periodLabel: `${historicalYearLabel(start)}〜${historicalYearLabel(end)}`,
      };
    });

  return {
    points,
    peak: {
      count: peakCount,
      year: jdnToHistoricalYear(peakJdn),
      dateLabel: jdnToDateLabel(peakJdn),
    },
    soleYears: sole,
    solePercent: Math.round((100 * sole) / yearly.length),
    zeroYears,
    range: {
      fromLabel: historicalYearLabel(firstYear),
      toLabel: historicalYearLabel(CONCURRENT_LAST_YEAR),
      yearCount: yearly.length,
    },
    excluded,
    coverage: { total, dated, filled },
    eraPresets,
  };
}

/** 在位継続率カーブ（1本）。 */
export interface HomeReignSurvival {
  /** 0〜50年を0.25年刻み。percent は小数1桁。 */
  curve: { years: number; percent: number }[];
  count: number;
  medianYears: number;
  meanYears: number;
  aboveMeanCount: number;
  aboveMeanPercent: number;
  /** 在位が日まで下りていない人数（approxDays が概算のまま）。断り書き用。 */
  approxOnlyCount: number;
  /** 複数回在位した人数（合算値で数えている＝厳密には「N年後もまだ在位」ではない）。 */
  multiReignCount: number;
}

/** カーブの右端。50年以上在位したのは5名（康熙帝61.9年・乾隆帝60.3年・西夏仁宗54.3年・
 *  前漢武帝54.1年・西夏崇宗52.9年）で、ここから先は1%台の平坦な裾になる。 */
const SURVIVAL_MAX_YEARS = 50;

/**
 * 即位からN年後に、まだ在位している皇帝が何%残っているか。
 *
 * **365名全員が母集団**。使う値は `totalReignDuration.approxDays`（年=365換算の概算で、
 * 95名は日まで下りていない）。日まで確定した270名だけで描くと曲線は上へ持ち上がるが、
 * その版は**「どの人物の日付が復元できたか」の分布**が混ざる（2026-08-01 ユーザー決定で1本）。
 *
 * 複数回在位の8名は合算値なので、厳密には「N年後もまだ在位」ではない。
 */
export function getReignSurvival(): HomeReignSurvival {
  const days = data.emperors.map(
    (e) => e.reignSummary.totalReignDuration.approxDays,
  );
  const sorted = [...days].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const medianDays =
    sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const meanDays = days.reduce((a, b) => a + b, 0) / days.length;
  const aboveMean = days.filter((v) => v >= meanDays).length;

  const curve: { years: number; percent: number }[] = [];
  for (let y = 0; y <= SURVIVAL_MAX_YEARS + 0.0001; y += 0.25) {
    const years = Math.round(y * 100) / 100;
    const alive = days.filter((v) => v >= years * DAYS_PER_YEAR).length;
    curve.push({
      years,
      percent: Math.round((1000 * alive) / days.length) / 10,
    });
  }

  return {
    curve,
    count: days.length,
    medianYears: Math.round((medianDays / DAYS_PER_YEAR) * 100) / 100,
    meanYears: Math.round((meanDays / DAYS_PER_YEAR) * 100) / 100,
    aboveMeanCount: aboveMean,
    aboveMeanPercent: Math.round((100 * aboveMean) / days.length),
    approxOnlyCount: data.emperors.filter(
      (e) => !e.reignSummary.totalReignDuration.isExact,
    ).length,
    multiReignCount: data.emperors.filter((e) => e.reigns.length > 1).length,
  };
}

// ---------------------------------------------------------------------------
// OGP画像（SNSの共有カード）に載せる事実。
//
// 監査（2026-07-27）の 2-5 で Content-Type は実害なしと確認できたので、次の論点は
// 「カードがクリックされるか」。従来はページ名と短い説明だけで、そのページを開くと
// 何が分かるのかが画像から読めなかった。タイムライン上で目を引くのは具体的な数値な
// ので、各ページの代表的な事実を2枚のカードで載せる。
//
// 【整合性の要】ここも「読み取れること」と同じで、数値は手書きせずページ本体と同じ
// 集計から導く（getOverviewStats・topRanked・eligibleDynastyRows）。画像はビルド時に
// 焼かれてキャッシュも効くため、本文とずれると訂正が最も届きにくい面になる。

/** OGP画像の下段に置く事実カード。value は 34px で1行に収まる長さ（全角12文字程度）に保つ。 */
export interface OgFact {
  /** カード上段の見出し（例: "最長在位"）。 */
  label: string;
  /** 主役の値（例: "61年332日"）。 */
  value: string;
  /** 値の下に添える補足（誰の記録か・母集団）。 */
  sub?: string;
}

/** OGP画像に事実カードを出すページ。値は各ルートのパスと一致させる。 */
export type OgFactPage = "/" | "/emperors" | "/database" | "/about";

export function getOgFacts(page: OgFactPage): OgFact[] {
  const stats = getOverviewStats();
  switch (page) {
    case "/":
    case "/about": {
      return [
        {
          label: "収録した皇帝",
          value: `${stats.emperorCount}名`,
          sub: `全12項目・正史原典から個別調査`,
        },
        {
          label: "最多の死因",
          value: `${stats.topDeathCause.category} ${stats.topDeathCause.count}名`,
          sub: `${stats.emperorCount}名の${stats.topDeathCause.percent}%`,
        },
      ];
    }
    case "/emperors": {
      const highlights = getHomeHighlights();
      return [
        {
          label: "収録した皇帝",
          value: `${stats.emperorCount}名`,
          sub: `${highlights.dynastyCount}の王朝・政権`,
        },
        {
          label: "在位が判明する範囲",
          value: highlights.yearSpanLabel,
          sub: "始皇帝から溥儀まで",
        },
      ];
    }
    case "/database": {
      // 表の面なので「どれだけの行と列が1枚に載っているか」を伝える2枚にする
      // （最長在位は概要ダッシュボードの盤面が出しているので重複させない）。
      // 列数は手書きせず DATABASE_COLUMN_COUNT から引く（表の実装と突合 assert がある）。
      const highlights = getHomeHighlights();
      return [
        {
          label: "表の行数",
          value: `${stats.emperorCount}行`,
          sub: `${highlights.dynastyCount}の王朝・政権を1つの表に`,
        },
        {
          label: "表の列",
          value: `${DATABASE_COLUMN_COUNT}列`,
          sub: "在位年数・死因・即位経路・年齢ほか",
        },
      ];
    }
  }
}

/** 皇帝個別ページのOGP画像に載せるチップ（順位・分類）。レコードの表示値をそのまま使う。
 *  **3枚まで**にすること — 肖像がある皇帝は左カラムの幅が約724pxしかなく、4枚だと
 *  「即位経路 受禅（易姓）」のような幅広チップで2段になり、フッターと重なる。 */
export function getEmperorOgChips(record: EmperorRecord): string[] {
  const chips: string[] = [];
  const reignRank = record.ranks.reignYears;
  if (reignRank) {
    chips.push(`在位年数 ${reignRank.total}名中${reignRank.rank}位`);
  }
  chips.push(`死因 ${record.deathCauseCategory}`);
  chips.push(`即位経路 ${record.accessionRouteCategory}`);
  return chips;
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
  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf-8"),
  ) as PortraitManifestEntry[];
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
