// パレット候補5案を順に globals.css へ当てて、トップの第1画面を撮る。
// 判定用の1枚をパレット数だけ並べるためのもの（差分検出ではない）。
//
//   node design-plans/tools/capture-palettes.mjs
// 事前に dev サーバー（既定 http://localhost:3100）を起動しておくこと。
import { chromium } from "playwright";
import fs from "node:fs";
import { CANDIDATES, apply } from "./palette-candidates.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = process.env.SHOT_DIR ?? "./design-plans/tools/palette-shots";
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1024 },
  deviceScaleFactor: 2,
});

for (const [i, v] of CANDIDATES.entries()) {
  apply(v.id);
  // CSS の hot reload が届くのを待ってから、確実を期して読み直す。
  await sleep(2500);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await sleep(1500);
  const n = String(i + 1).padStart(2, "0");
  await page.screenshot({ path: `${OUT}/${n}-${v.id}.png` });
  await page.screenshot({ path: `${OUT}/${n}-${v.id}-full.png`, fullPage: true });
  console.log(`captured ${v.id}`);
}

await browser.close();
console.log(`saved to ${OUT}`);
