import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:4599";
const OUT = process.env.SHOT_DIR ?? "./shots-desktop";
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ["top", "/"],
  ["emperors", "/emperors"],
  ["emperor-detail", "/emperors/han-wudi"],
  ["reign", "/reign"],
  ["death-accession", "/death-accession"],
  ["court-events", "/court-events"],
  ["military", "/military"],
  ["ages", "/ages"],
  ["dynasties", "/dynasties"],
  ["timeline", "/timeline"],
  ["kinship", "/kinship"],
  ["about", "/about"],
  ["notfound", "/this-route-does-not-exist"],
];

const VIEWPORTS = [
  ["desktop", 1440, 900],
  ["mobile", 375, 812],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// LazyMount(IntersectionObserver)と行ウィンドウイングは、視界に入らないと描画されない。
// 全高までゆっくりスクロールして全セクションをマウントさせてから、先頭に戻して撮る。
async function primeLazySections(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    let y = 0;
    while (y < document.body.scrollHeight) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 250));
      y += step;
    }
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 800));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 600));
  });
}

const browser = await chromium.launch();
const results = [];

for (const [vpName, width, height] of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    locale: "ja-JP",
  });
  const page = await ctx.newPage();
  for (const [name, route] of ROUTES) {
    const file = `${OUT}/${name}-${vpName}.png`;
    try {
      await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 60000 });
      await sleep(name === "kinship" ? 3000 : 800);
      await primeLazySections(page);
      await sleep(name === "kinship" ? 2000 : 400);
      await page.screenshot({ path: file, fullPage: true });
      const h = await page.evaluate(() => document.body.scrollHeight);
      results.push(`${name}-${vpName}\theight=${h}\tOK`);
    } catch (e) {
      results.push(`${name}-${vpName}\tFAILED\t${e.message.split("\n")[0]}`);
    }
  }
  await ctx.close();
}

await browser.close();
console.log(results.join("\n"));
