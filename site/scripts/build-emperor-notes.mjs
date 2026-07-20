// data/emperors.json から皇帝ごとの「即位の経緯」「死因の経緯」＋出典だけを抜き出し、
// public/emperor-notes/{id}.json（各2〜3KB）を書き出す。詳細ダイアログが開いた時だけ
// この JSON を fetch して経緯2節を表示する（EmperorRecord には note を載せない方針の
// ため。個別ページは Server Component 側の getEmperorNarrative が別途全文を持つ）。
// public 配下は静的書き出し(next export)でそのまま out/ に配信される。
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const dataPath = path.join(process.cwd(), "..", "data", "emperors.json");
const destDir = path.join(process.cwd(), "public", "emperor-notes");

// 出典ラベルの整形。lib/emperors.ts の HISTORY_SOURCE_PATTERN / sourceLabelOf と
// 同じロジックをここでも持つ（.mjs から TS を import できないため）。変更時は両方を直す。
const HISTORY_SOURCE_PATTERN = /[巻卷紀伝傳志史書]/;

function sourceLabelOf(source) {
  if (HISTORY_SOURCE_PATTERN.test(source.page)) return source.page;
  const edition = source.lang === "ja" ? "日本語版" : "中国語版";
  return `Wikipedia${edition}記事「${source.page}」`;
}

function narrativeSectionOf(field) {
  if (!field?.note || !field.source) return null;
  return {
    note: field.note,
    sourceLabel: sourceLabelOf(field.source),
    sourceNote: field.source.note ?? null,
  };
}

const data = JSON.parse(readFileSync(dataPath, "utf8"));

// 前回の生成物を消してから作り直す（削除された id の JSON を残さない）。
rmSync(destDir, { recursive: true, force: true });
mkdirSync(destDir, { recursive: true });

let written = 0;
for (const e of data.emperors) {
  const notes = {
    accession: narrativeSectionOf(e.accessionRoute),
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
