// build-font-subset.py の再生成差分に意味があるか（収録字が変わったか）を機械で見る。
//
// **なぜ要るか** — woff2 のバイト列は収録字が1字も変わらなくても再生成のたびに全ファイル
// 変わる（サブセッタの出力が非決定的・2026-08-19 の実測で追加0・削除0でも 84 ファイルが
// 差分に出た）。そのままコミットすると「新出漢字を足した」ように見える無意味な差分になる。
// 再生成のあとにこれを流し、**追加も削除も 0 なら生成物を捨てる**:
//   node tools/compare-font-subset.mjs
//   git checkout -- src/app/fonts.css src/app/fonts/   # 「収録字は同じ」のときだけ
//
// 比べるのは fonts.css の unicode-range が名乗る字の集合（woff2 のバイト列は比べない —
// それが不安定だという話なので）。基準は HEAD の fonts.css。
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cssPath = path.join(siteDir, "src", "app", "fonts.css");

/** unicode-range の宣言から収録コードポイントの集合を作る（U+xxxx と U+xxxx-yyyy の2形）。 */
function charsOf(css) {
  const set = new Set();
  // 宣言はミニファイで `;` ではなく `}` で終わることがある（最後の宣言）ので両方で区切る。
  for (const m of css.matchAll(/unicode-range:\s*([^;}]+)[;}]/g)) {
    for (const token of m[1].split(",")) {
      const t = token.trim();
      const range = /^U\+([0-9A-Fa-f]+)-([0-9A-Fa-f]+)$/.exec(t);
      const single = /^U\+([0-9A-Fa-f]+)$/.exec(t);
      if (range) {
        for (let c = parseInt(range[1], 16); c <= parseInt(range[2], 16); c += 1) set.add(c);
      } else if (single) {
        set.add(parseInt(single[1], 16));
      }
    }
  }
  return set;
}

const now = charsOf(readFileSync(cssPath, "utf8"));
const head = charsOf(
  execFileSync("git", ["show", "HEAD:site/src/app/fonts.css"], { cwd: siteDir, encoding: "utf8" }),
);

const added = [...now].filter((c) => !head.has(c)).sort((a, b) => a - b);
const removed = [...head].filter((c) => !now.has(c)).sort((a, b) => a - b);
const show = (cs) =>
  cs
    .slice(0, 20)
    .map((c) => `${String.fromCodePoint(c)} U+${c.toString(16).toUpperCase().padStart(4, "0")}`)
    .join(" / ") + (cs.length > 20 ? ` …ほか${cs.length - 20}字` : "");

console.log(`HEAD ${head.size} 字 → いま ${now.size} 字`);
if (added.length) console.log(`追加 ${added.length} 字: ${show(added)}`);
if (removed.length) console.log(`削除 ${removed.length} 字: ${show(removed)}`);
if (!added.length && !removed.length) {
  console.log(
    "収録字は同じ — この再生成差分に意味は無い。git checkout -- src/app/fonts.css src/app/fonts/ で捨ててよい",
  );
}
