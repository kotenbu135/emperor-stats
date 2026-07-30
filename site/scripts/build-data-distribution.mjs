// 配布用データセットを public/data/ に書き出す（第三者が引用・再利用するための静的配布物）。
// - emperors.json: data/emperors.json をそのままコピー（加工しない＝サイト表示との乖離が起きない）
// - emperors.csv:  主要項目のみの平坦版。1行＝1皇帝
// - emperors.schema.json: data/schema/emperors.schema.json をコピー
// GitHub Pages は全ファイルに Access-Control-Allow-Origin: * と gzip を自動付与するため、
// ここに置くだけで第三者Webアプリから直接 fetch できる（CORS設定作業は不要）。
//
// 重要: CSV は raw フィールドの純射影に徹する。lib/emperors.ts の表示用ロジック
// （displayName / dynastyLabel / ERA_BY_SECTION 等）をここに複製しないこと。
// 配布データにサイトの表示判断を焼き込むと、TSロジックの多重化と drift を招く。
// 値の推論・補完・再計算もしない（JSON にある値をそのまま carry するだけ）。
//
// スキーマ v3（2026-07-29）でレコードは安定 ID だけを持ち、日本語ラベルは
// `meta.catalogs` に移った。CSV は表計算ソフトで直接読む用途なので、ID 列と
// **同じファイルの meta.catalogs から引いたラベル列**の両方を出す。カタログ参照は
// 配布物の中で完結する単純な引き当てで、サイト側の表示判断ではない。
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import path from "node:path";

const dataPath = path.join(process.cwd(), "..", "data", "emperors.json");
const schemaPath = path.join(process.cwd(), "..", "data", "schema", "emperors.schema.json");
const destDir = path.join(process.cwd(), "public", "data");

const SITE_URL = "https://emperorstats.com";

const data = JSON.parse(readFileSync(dataPath, "utf8"));

const catalogs = data.meta?.catalogs;
if (!catalogs) {
  throw new Error("data/emperors.json に meta.catalogs がありません（スキーマ v3 必須）");
}
const regimeById = new Map(catalogs.regimes.map((r) => [r.id, r]));
const eraById = new Map(catalogs.eras.map((e) => [e.id, e]));

/** meta.catalogs.enums からラベルを引く。未知の ID はビルドを落とす（黙って空欄にしない）。 */
function enumLabel(enumName, id) {
  if (id === null || id === undefined) return id;
  const items = catalogs.enums?.[enumName];
  if (!items) throw new Error(`meta.catalogs.enums に ${enumName} がありません`);
  const hit = items.find((i) => i.id === id);
  if (!hit) throw new Error(`enums.${enumName} に ID "${id}" がありません`);
  return hit.label;
}

function regimeOf(e) {
  const r = regimeById.get(e.regimeId);
  if (!r) throw new Error(`${e.id}: regimeId "${e.regimeId}" が catalogs.regimes にありません`);
  return r;
}

/**
 * CSV の列定義。ヘッダ名 → レコードからの値の取り出し方。
 * 精度フラグ（reignIsExact / reignNeedsPreciseDays / *Precision）は必ず添える —
 * 近似値の approxDays を裸で出すと第三者が正確値と誤認するため。
 */
const COLUMNS = [
  ["id", (e) => e.id],
  ["url", (e) => `${SITE_URL}/emperors/${e.id}`],
  ["wikidataId", (e) => e.sources?.wikidata],
  ["commonName", (e) => e.name?.commonName],
  ["personalName", (e) => e.name?.personalName],
  ["templeName", (e) => e.name?.templeName],
  ["posthumousName", (e) => e.name?.posthumousName],
  ["regimeId", (e) => e.regimeId],
  ["dynastyName", (e) => regimeOf(e).name],
  ["regimeLabel", (e) => regimeOf(e).label],
  ["dynastyCategory", (e) => enumLabel("regimeCategory", regimeOf(e).category)],
  ["eraId", (e) => e.eraId],
  ["eraLabel", (e) => eraById.get(e.eraId)?.label],
  ["researchSection", (e) => e.researchSection],
  ["standing", (e) => enumLabel("emperorStanding", e.standing)],
  ["dynastyOrder", (e) => e.reigns?.[0]?.dynastyOrder],
  ["dynastyOrderSurveyed", (e) => regimeOf(e).dynastyOrderSurveyed],
  ["reignStartYear", (e) => e.reignSummary?.firstStartYear],
  ["reignEndYear", (e) => e.reignSummary?.lastEndYear],
  ["reignCount", (e) => e.reignSummary?.reignCount],
  ["reignApproxDays", (e) => e.reignSummary?.totalReignDuration?.approxDays],
  ["reignExactDays", (e) => e.reignSummary?.totalReignDuration?.exactDays],
  ["reignIsExact", (e) => e.reignSummary?.totalReignDuration?.isExact],
  ["reignNeedsPreciseDays", (e) => e.reignSummary?.totalReignDuration?.needsPreciseDays],
  ["deathCauseCategory", (e) => enumLabel("deathCause", e.deathCause?.category)],
  ["deathCauseConfidence", (e) => e.deathCause?.confidence],
  ["deathCauseSource", (e) => e.deathCause?.source?.page],
  ["accessionRouteCategory", (e) => enumLabel("accessionCategory", e.accessionRoute?.categoryId)],
  ["accessionRouteConfidence", (e) => e.accessionRoute?.confidence],
  ["accessionRouteSource", (e) => e.accessionRoute?.source?.page],
  ["eraChangeCount", (e) => e.eraChangeCount?.count],
  ["amnestyCount", (e) => e.amnestyCount?.count],
  ["empressInstallationCount", (e) => e.empressInstallationCount?.count],
  ["crownPrinceDepositionCount", (e) => e.crownPrinceDepositionCount?.count],
  ["capitalRelocationCount", (e) => e.capitalRelocationCount?.count],
  ["personalCampaignCount", (e) => e.personalCampaignCount?.count],
  ["rebellionSuppressionCount", (e) => e.rebellionSuppressionCount?.count],
  ["rebellionSufferedCount", (e) => e.rebellionSufferedCount?.count],
  ["birthDate", (e) => e.ages?.birthDate],
  ["birthDatePrecision", (e) => e.ages?.birthDatePrecision],
  ["deathDate", (e) => e.ages?.deathDate],
  ["deathDatePrecision", (e) => e.ages?.deathDatePrecision],
  ["accessionAge", (e) => e.ages?.accessionAge],
  ["deathAge", (e) => e.ages?.deathAge],
  ["isFemale", (e) => e.flags?.isFemale],
  ["usedEmperorTitleFrom", (e) => e.flags?.usedEmperorTitleFrom],
];

/** RFC 4180 準拠のエスケープ。null/undefined は空欄にする（0 や false は値として出す）。 */
function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

rmSync(destDir, { recursive: true, force: true });
mkdirSync(destDir, { recursive: true });

// 1. JSON はバイト単位でそのままコピー（再シリアライズすると整形差分が出る）。
copyFileSync(dataPath, path.join(destDir, "emperors.json"));

// 2. CSV。Excel が UTF-8 と判定できるよう BOM を付ける（日本語列の文字化け対策）。
const rows = [
  COLUMNS.map(([header]) => header).join(","),
  ...data.emperors.map((e) => COLUMNS.map(([, get]) => csvCell(get(e))).join(",")),
];
writeFileSync(path.join(destDir, "emperors.csv"), `﻿${rows.join("\r\n")}\r\n`, "utf8");

// 3. JSON Schema（data/schema/ に置いた著作物をコピー）。
copyFileSync(schemaPath, path.join(destDir, "emperors.schema.json"));

console.log(
  `wrote data distribution to public/data/ (emperors.json, emperors.csv: ${data.emperors.length} rows, emperors.schema.json)`,
);
