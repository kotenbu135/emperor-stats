#!/usr/bin/env node
/**
 * 書き出した `out/` に、自前サブセットが持っていない文字が出ていないか調べる。
 * `npm run build` の postbuild で自動的に走り、落ちたらデプロイを止める。
 *
 * 書体は `next/font/google` をやめて自前で配っている（2026-08-05・理由と作り方は
 * tools/build-font-subset.py の docstring）。フォントに無い文字は**豆腐にはならず**
 * 次の書体へ落ちるので、画面では「その1文字だけ別の書体」という静かな崩れ方をする。
 * 人間の目視では気づけないので機械で見る。
 *
 * 紹介文（Issue #16）が入るたびに新しい漢字が出るはずで、そのときはここが落ちる。
 * 直し方はエラーに出しているとおり `python3 tools/build-font-subset.py` → 再ビルド。
 *
 * `out/data/` は配布データのダウンロード置き場で画面には出ないので見ない
 * （note や引用の異体字まで数えると、描かない 2,119 字ぶんフォントが太る）。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(SITE, "out");
const COVERAGE = join(SITE, "tools", "font-coverage.json");

const SCAN_SUFFIXES = new Set([".html", ".js", ".txt", ".xml", ".css"]);
const EXCLUDE_TOP = new Set(["data"]);

function walk(dir, top = null) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const here = top ?? entry;
    if (statSync(full).isDirectory()) {
      if (top === null && EXCLUDE_TOP.has(entry)) continue;
      files.push(...walk(full, here));
    } else if (SCAN_SUFFIXES.has(extname(entry).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

const manifest = JSON.parse(readFileSync(COVERAGE, "utf8"));
const coverage = new Set(manifest.codepoints);
/** 底本 Noto Sans JP が持っている字の全体。「取り直せば入る字」の判定に使う。 */
const source = manifest.sourceRanges;

function inSource(cp) {
  let lo = 0;
  let hi = source.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cp < source[mid][0]) hi = mid - 1;
    else if (cp > source[mid][1]) lo = mid + 1;
    else return true;
  }
  return false;
}

/** サブセットを取り直せば入る字 → それが出ていたファイル（1つだけ覚える）。 */
const stale = new Map();
/** 底本がそもそも持っていない字（原文引用の簡体字など・どうにもならない）。 */
const unavailable = new Set();

for (const file of walk(OUT)) {
  for (const ch of readFileSync(file, "utf8")) {
    const cp = ch.codePointAt(0);
    // 制御文字・サロゲート・BOM はフォントの守備範囲ではない。
    if (cp < 0x20 || (cp >= 0x7f && cp <= 0xa0) || (cp >= 0xd800 && cp <= 0xdfff)) continue;
    if (coverage.has(cp)) continue;
    if (inSource(cp)) {
      if (!stale.has(ch)) stale.set(ch, file.slice(OUT.length + 1));
    } else {
      unavailable.add(ch);
    }
  }
}

// 別書体へ落ちる字は差し替え前からある既知の状態なので、件数だけ出して止めない。
const note =
  unavailable.size > 0
    ? `（ほかに、底本 Noto Sans JP が持っていない字が ${unavailable.size} 字。原文引用の簡体字などで、差し替え前から同じ）`
    : "";

if (stale.size === 0) {
  console.log(`font coverage OK — ${coverage.size} 字${note}`);
  process.exit(0);
}

console.error(
  `\nサブセットに入っていない字が ${stale.size} 字ある（底本には在るので取り直せば入る。いまは画面でその字だけ別書体になる）:`,
);
for (const [ch, file] of [...stale].slice(0, 40)) {
  console.error(`  ${ch}  U+${ch.codePointAt(0).toString(16).toUpperCase()}  ${file}`);
}
if (stale.size > 40) console.error(`  … ほか ${stale.size - 40} 字`);
console.error("\n直し方: python3 tools/build-font-subset.py && npm run build\n");
process.exit(1);
