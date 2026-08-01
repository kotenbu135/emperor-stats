// データ読み込みの単一境界（サーバー専用・node:fs に依存する）。
//
// `data/emperors.json` は 2026-07-29 にスキーマ v3 へ移行し、レコードは安定 ID だけを
// 持ち、日本語ラベルは `meta.catalogs` にしか置かない設計になった
// （docs/schema/V3_MIGRATION_PLAN.md の D3）。サイトは表示ラベルで集計・分岐・配色を
// 引くコードが広く、ID をそのまま流すと「型は通るのに色や分岐が silently 外れる」
// （王朝の配色は政権 ID をキーに引く）。そこで**読み込みの一点で
// カタログを引いてラベルへ解決**し、下流には従来どおりラベルを流す。
//
// v3 で意味が変わった点（サイトの表示もこれに従う）:
//  - 旧 `dynasty.category`（政権の性格と個人の即位経緯が混在。15政権で同一政権内に
//    複数値が同居していた）は、政権単位の `catalogs.regimes[].category` と
//    人物単位の `standing`（正規／対立・僭称）へ分割された。したがって
//    `dynastyCategory` は**政権に対して一意**になり、区分の人数も変わる
//    （移行の判定根拠は V3_MIGRATION_PLAN.md の5節）
//  - 2026-08-01、区分の**軸そのもの**を「中華を統一していたか」へ入れ替えた。
//    旧値（正統王朝／並立政権／反乱・自称政権）は「正統」がどの政権を正統とみなすかの
//    論争を呼び込むうえ、判定基準が一度も文書化されていなかった。現在は
//    **統一王朝 113・分裂期の王朝 240・反乱・自称政権 12**
//    （基準は data/schema/INCLUSION_CRITERIA.md の「政権区分の判定基準」節）
//  - 旧 `flags.selfProclaimed` は廃止（`axes` と `standing` で代替）
//
// v3 が持つが**サイトが意図的に使っていない**もの:
//  - `catalogs.eras`（11区分）: サイトの時代ラベルは `ERA_BY_SECTION`（15区分）で、
//    皇帝一覧の時代見出し・王朝フィルタがこの粒度に合わせて作られている。
//    11区分へ寄せるかどうかは新サイトの各面を作るときに判断する
//  - `catalogs.regimes[].label`（「梁（蕭梁）」等の曖昧性のない表示名）: サイトは
//    同名王朝だけに時代サフィックスを付ける `dynastyLabel()` を使う。
//    **ただし時代サフィックスで区別できない組（同じ時代の中の同名別政権。隋末の
//    梁2つ・楚2つ）だけは label へ落とす**（2026-07-31・Issue #27）
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "..", "data");

interface CatalogEnumItem {
  id: string;
  label: string;
  labelEn?: string | null;
  description?: string;
}

export interface CatalogEra {
  id: string;
  label: string;
  sortOrder: number;
}

export interface CatalogRegime {
  id: string;
  /** 国号（例:「梁」）。単体では一意でない。 */
  name: string;
  /** 曖昧性のない表示名（例:「梁（蕭梁）」）。 */
  label: string;
  eraId: string;
  /** 政権の性格。enums.regimeCategory の ID。 */
  category: string;
  startYear?: number;
  endYear?: number;
  sortOrder: number;
  /** reigns[].dynastyOrder（第N代）を個別調査済みか。false の政権は全て null。 */
  dynastyOrderSurveyed?: boolean;
}

interface Catalogs {
  eras: CatalogEra[];
  regimes: CatalogRegime[];
  enums: Record<string, CatalogEnumItem[]>;
}

const rawEmperors = JSON.parse(
  fs.readFileSync(path.join(dataDir, "emperors.json"), "utf-8"),
) as {
  meta: { catalogs?: Catalogs; schemaVersion?: string } & Record<string, unknown>;
  emperors: RawV3Emperor[];
};

if (!rawEmperors.meta.catalogs) {
  throw new Error(
    "data/emperors.json に meta.catalogs がありません（スキーマ v3 必須）。" +
      `schemaVersion=${rawEmperors.meta.schemaVersion ?? "(なし)"}`,
  );
}
const catalogs: Catalogs = rawEmperors.meta.catalogs;

export const dataSchemaVersion = rawEmperors.meta.schemaVersion ?? null;
export const eraCatalog: CatalogEra[] = catalogs.eras;
export const regimeCatalog: CatalogRegime[] = catalogs.regimes;

const regimeById = new Map(catalogs.regimes.map((r) => [r.id, r]));

/** enum カタログ 1 つ分の ID→ラベル表。カタログに無い enum 名はビルド時に落とす。 */
function labelMapOf(enumName: string): Map<string, string> {
  const items = catalogs.enums[enumName];
  if (!items) {
    throw new Error(
      `data/emperors.json の meta.catalogs.enums に "${enumName}" がありません` +
        `（存在するキー: ${Object.keys(catalogs.enums).join(", ")}）`,
    );
  }
  return new Map(items.map((i) => [i.id, i.label]));
}

const labelMaps = new Map<string, Map<string, string>>();
function labelOf(enumName: string, id: string, context: string): string {
  let map = labelMaps.get(enumName);
  if (!map) {
    map = labelMapOf(enumName);
    labelMaps.set(enumName, map);
  }
  const label = map.get(id);
  if (label === undefined) {
    throw new Error(
      `${context}: enums.${enumName} に ID "${id}" がありません（カタログにラベルを追加してください）`,
    );
  }
  return label;
}

/**
 * サイトのコードが**値そのもので分岐している**表示ラベルが、カタログに今も
 * 存在することを確かめる。ラベルはカタログ側で自由に変えられる建前なので、
 * 変えられたときに配色や分岐が黙って外れるのではなくビルドを落とすためのゲート。
 * （分岐箇所: kinship/layout.ts の矢印ラベル導出・emperor-narrative.tsx の軸2内訳・
 *   emperors.ts の accessionTitleNew・lib/dynasty-colors.ts の配色スロット）
 */
function assertLabels(enumName: string, expected: string[]): void {
  const labels = new Set(labelMapOf(enumName).values());
  const missing = expected.filter((l) => !labels.has(l));
  if (missing.length > 0) {
    throw new Error(
      `enums.${enumName} に、サイトが値で分岐しているラベルがありません: ${missing.join("・")}` +
        "（カタログのラベルを変えたなら、それを参照している site 側のコードも直してください）",
    );
  }
}

assertLabels("regimeCategory", ["統一王朝", "分裂期の王朝", "反乱・自称政権"]);
assertLabels("emperorStanding", ["正規の皇帝", "対立・僭称の皇帝"]);
assertLabels("titleOrigin", ["新称"]);
assertLabels("decidedBy", ["本人", "第三者"]);
assertLabels("procedure", ["禅譲儀礼", "偽詔・矯詔", "儀礼なし・自称"]);
assertLabels("deathCause", [
  "病死",
  "暗殺",
  "処刑",
  "戦死",
  "自尽",
  "事故死",
  "不詳",
  "諸説あり",
]);
assertLabels("kinshipRelation", ["実父", "実母", "養父", "養母", "遠祖"]);
assertLabels("kinshipInclusionReason", ["歴代君主"]);
assertLabels("relationToPredecessor", ["子", "無血縁", "その他", "該当なし"]);

// --- emperors.json（v3 → 表示ラベル） ---

interface RawV3AccessionAxes {
  throneSource: string;
  titleOrigin: string;
  decidedBy: string[];
  decidedByAgents: string[];
  decidedByBasis: string;
  predecessorFate: string;
  relationToPredecessor: string;
  procedure: string;
}

interface RawV3Emperor {
  id: string;
  regimeId: string;
  eraId: string;
  researchSection: string;
  standing: string;
  deathCause?: { category: string } & Record<string, unknown>;
  accessionRoute: { categoryId: string; axes: RawV3AccessionAxes } & Record<string, unknown>;
  [key: string]: unknown;
}

const AXIS_ENUMS: Record<keyof RawV3AccessionAxes, string> = {
  throneSource: "throneSource",
  titleOrigin: "titleOrigin",
  decidedBy: "decidedBy",
  decidedByAgents: "decidedByAgent",
  decidedByBasis: "decidedByBasis",
  predecessorFate: "predecessorFate",
  relationToPredecessor: "relationToPredecessor",
  procedure: "procedure",
};

function resolveAxes(axes: RawV3AccessionAxes, context: string): RawV3AccessionAxes {
  const out = { ...axes } as Record<string, unknown>;
  for (const [axis, enumName] of Object.entries(AXIS_ENUMS)) {
    const value = axes[axis as keyof RawV3AccessionAxes];
    out[axis] = Array.isArray(value)
      ? value.map((v) => labelOf(enumName, v, `${context} axes.${axis}`))
      : labelOf(enumName, value, `${context} axes.${axis}`);
  }
  return out as unknown as RawV3AccessionAxes;
}

/**
 * v3 レコードを表示ラベル解決済みの形へ変換する。旧スキーマ互換のために
 * `dynasty`（name＝国号・section＝researchSection・category＝政権の性格）を組み立て、
 * `standingLabel` を足す。ID フィールド（regimeId・eraId・standing）はそのまま残す。
 */
function resolveEmperor(e: RawV3Emperor) {
  const regime = regimeById.get(e.regimeId);
  if (!regime) {
    throw new Error(
      `${e.id}: regimeId "${e.regimeId}" が meta.catalogs.regimes にありません`,
    );
  }
  if (regime.eraId !== e.eraId) {
    // 非正規化コピーの不整合。データ側のバリデータでも検査しているが、
    // サイトが regime 経由で時代を引く場合に黙って食い違わないよう二重で見る。
    throw new Error(
      `${e.id}: eraId "${e.eraId}" が regime "${regime.id}" の eraId "${regime.eraId}" と一致しません`,
    );
  }
  return {
    ...e,
    dynasty: {
      name: regime.name,
      section: e.researchSection,
      category: labelOf("regimeCategory", regime.category, `${e.id} regimeCategory`),
    },
    regimeLabel: regime.label,
    standingLabel: labelOf("emperorStanding", e.standing, `${e.id} standing`),
    deathCause: e.deathCause
      ? {
          ...e.deathCause,
          category: labelOf("deathCause", e.deathCause.category, `${e.id} deathCause`),
        }
      : e.deathCause,
    accessionRoute: {
      ...e.accessionRoute,
      category: labelOf(
        "accessionCategory",
        e.accessionRoute.categoryId,
        `${e.id} accessionRoute`,
      ),
      axes: resolveAxes(e.accessionRoute.axes, e.id),
    },
  };
}

/** emperors.json 全体（meta はそのまま・emperors は表示ラベル解決済み）。 */
export const emperorsJson = {
  meta: rawEmperors.meta,
  emperors: rawEmperors.emperors.map(resolveEmperor),
};

// --- kinship.json（v3 → 表示ラベル） ---

interface RawV3KinshipPerson {
  id: string;
  researchSection: string;
  kind: string;
  inclusionReason?: string[];
  [key: string]: unknown;
}

interface RawV3KinshipEdge {
  type: string;
  from: string;
  to: string;
  /** succession のみ（accessionCategory の8値＋復位）。 */
  categoryId?: string;
  relationToPredecessor?: string;
  /** kinship のみ。 */
  relation?: string;
  relationDetail?: string;
  [key: string]: unknown;
}

/**
 * kinship.json を読み、語彙 ID を表示ラベルへ解決したうえで旧キー名
 * （`section`・`edges[].category`）に戻す。系譜データの利用側は続柄・経路の
 * ラベルで分岐と表示を組み立てているため、境界をここに閉じ込める。
 */
export function loadKinshipJson() {
  const kin = JSON.parse(
    fs.readFileSync(path.join(dataDir, "kinship.json"), "utf-8"),
  ) as {
    persons: RawV3KinshipPerson[];
    edges: RawV3KinshipEdge[];
    genealogicalClaims: unknown[];
    meta: Record<string, unknown>;
  };

  return {
    meta: kin.meta,
    genealogicalClaims: kin.genealogicalClaims,
    persons: kin.persons.map((p) => ({
      ...p,
      section: p.researchSection,
      kind: labelOf("kinshipPersonKind", p.kind, `${p.id} kind`),
      inclusionReason: p.inclusionReason?.map((r) =>
        labelOf("kinshipInclusionReason", r, `${p.id} inclusionReason`),
      ),
    })),
    edges: kin.edges.map((e) => {
      const context = `${e.from}→${e.to}`;
      return {
        ...e,
        category:
          e.categoryId === undefined
            ? undefined
            : labelOf("kinshipSuccessionCategory", e.categoryId, `${context} categoryId`),
        relation:
          e.relation === undefined
            ? undefined
            : labelOf("kinshipRelation", e.relation, `${context} relation`),
        relationDetail:
          e.relationDetail === undefined || e.relationDetail === null
            ? e.relationDetail
            : labelOf("kinshipRelationDetail", e.relationDetail, `${context} relationDetail`),
        relationToPredecessor:
          e.relationToPredecessor === undefined || e.relationToPredecessor === null
            ? e.relationToPredecessor
            : labelOf(
                "relationToPredecessor",
                e.relationToPredecessor,
                `${context} relationToPredecessor`,
              ),
      };
    }),
  };
}
