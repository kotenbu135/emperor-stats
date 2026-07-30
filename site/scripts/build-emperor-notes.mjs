// data/emperors.json から皇帝ごとの「即位の経緯」「死因の経緯」＋出典だけを抜き出し、
// public/emperor-notes/{id}.json（各2〜3KB）を書き出す。詳細ダイアログが開いた時だけ
// この JSON を fetch して経緯2節を表示する（EmperorRecord には note を載せない方針の
// ため。個別ページは Server Component 側の getEmperorNarrative が別途全文を持つ）。
// public 配下は静的書き出し(next export)でそのまま out/ に配信される。
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const dataPath = path.join(process.cwd(), "..", "data", "emperors.json");
const destDir = path.join(process.cwd(), "public", "emperor-notes");

// 出典ラベルは source.page をそのまま使う（Wikipedia記事名の出典は task.md 3-1 で
// 一掃済み）。lib/emperors.ts の narrativeSectionOf と同じロジックをここでも持つ
// （.mjs から TS を import できないため）。変更時は両方を直す。
function narrativeSectionOf(field) {
  if (!field?.note || !field.source) return null;
  return {
    note: field.note,
    sourceLabel: field.source.page,
    sourceNote: field.source.note || null,
  };
}

const data = JSON.parse(readFileSync(dataPath, "utf8"));

// スキーマ v3（2026-07-29）で axes の値は安定 ID になり、日本語ラベルは
// meta.catalogs.enums にしかない。ダイアログはこの JSON の値をそのまま表示し、
// 「第三者」で内訳の出し方を分岐する（components/emperors/emperor-narrative.tsx）ので、
// ここでラベルへ解決する。src/lib/data-source.ts の resolveAxes と同じ対応表を持つ
// （.mjs から TS を import できないため。軸を増減したら両方を直す）。
const AXIS_ENUMS = {
  throneSource: "throneSource",
  titleOrigin: "titleOrigin",
  decidedBy: "decidedBy",
  decidedByAgents: "decidedByAgent",
  decidedByBasis: "decidedByBasis",
  predecessorFate: "predecessorFate",
  relationToPredecessor: "relationToPredecessor",
  procedure: "procedure",
};

const labelMaps = new Map();
function enumLabel(enumName, id, context) {
  let map = labelMaps.get(enumName);
  if (!map) {
    const items = data.meta?.catalogs?.enums?.[enumName];
    if (!items) {
      throw new Error(`data/emperors.json の meta.catalogs.enums に ${enumName} がありません`);
    }
    map = new Map(items.map((i) => [i.id, i.label]));
    labelMaps.set(enumName, map);
  }
  const label = map.get(id);
  if (label === undefined) {
    throw new Error(`${context}: enums.${enumName} に ID "${id}" がありません`);
  }
  return label;
}

function resolveAxes(axes, id) {
  if (!axes) return null;
  const out = { ...axes };
  for (const [axis, enumName] of Object.entries(AXIS_ENUMS)) {
    const value = axes[axis];
    out[axis] = Array.isArray(value)
      ? value.map((v) => enumLabel(enumName, v, `${id} axes.${axis}`))
      : enumLabel(enumName, value, `${id} axes.${axis}`);
  }
  return out;
}

// 前回の生成物を消してから作り直す（削除された id の JSON を残さない）。
rmSync(destDir, { recursive: true, force: true });
mkdirSync(destDir, { recursive: true });

let written = 0;
for (const e of data.emperors) {
  const notes = {
    accession: narrativeSectionOf(e.accessionRoute),
    // 表示ラベル（世襲・擁立…）を導いた4軸＋補助。ダイアログでも根拠を出すため同梱する
    // （1人あたり数百バイト）。多軸化完了により全365人が持つ。
    accessionAxes: resolveAxes(e.accessionRoute?.axes, e.id),
    death: narrativeSectionOf(e.deathCause),
  };
  // 経緯が両方とも無い皇帝は JSON を出さない（ダイアログ側は 404/空を非表示扱い）。
  if (!notes.accession && !notes.death) continue;
  writeFileSync(
    path.join(destDir, `${e.id}.json`),
    JSON.stringify(notes),
    "utf8",
  );
  written += 1;
}

console.log(`wrote ${written} emperor notes to public/emperor-notes/`);
