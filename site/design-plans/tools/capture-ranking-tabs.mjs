// ランキングカードのタブ（在位期間・即位年齢・没年齢）を1枚ずつ撮る。
//   BASE_URL=http://localhost:3100 node design-plans/tools/capture-ranking-tabs.mjs
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
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 1500));

const card = page.locator("h2", { hasText: "皇帝ランキング" }).locator("..");
for (const [name, file] of [
  ["在位期間", "rank-tab-reign.png"],
  ["即位年齢", "rank-tab-accession-age.png"],
  ["没年齢", "rank-tab-death-age.png"],
]) {
  await page.getByRole("tab", { name }).click();
  await new Promise((r) => setTimeout(r, 400));
  await card.screenshot({ path: `${OUT}/${file}` });
}
await browser.close();
console.log(`saved to ${OUT}`);
