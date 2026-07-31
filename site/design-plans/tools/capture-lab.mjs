// /lab（パネル比較の作業用ページ）を1枚に撮る。
//   node design-plans/tools/capture-lab.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = process.env.SHOT_DIR ?? "./design-plans/tools/rebuild-shots";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1024 },
  deviceScaleFactor: 2,
});
await page.goto(`${BASE}/lab`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 2000));
await page.screenshot({ path: `${OUT}/lab-full.png`, fullPage: true });
await browser.close();
console.log(`saved to ${OUT}/lab-full.png`);
