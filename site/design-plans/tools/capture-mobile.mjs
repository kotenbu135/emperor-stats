import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:4599";
const OUT = process.env.SHOT_DIR ?? "./shots-mobile";
fs.mkdirSync(OUT, { recursive: true });

const W = 390, H = 844;                 // iPhone 14 相当
const ROUTES = [
  ["top", "/"],
  ["emperors", "/emperors"],
  ["emperor-detail", "/emperors/han-wudi"],
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

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  locale: "ja-JP",
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
const log = [];

for (const [name, route] of ROUTES) {
  await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(name === "kinship" ? 3000 : 800);

  // LazyMount / 行ウィンドウイングを起こしてから撮る
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 200));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 500));
  });

  const total = await page.evaluate(() => document.body.scrollHeight);
  // 上端・中間・下端の3スライス。短いページは重複するのでその分だけ撮る
  const maxY = Math.max(0, total - H);
  const ys = [...new Set([0, Math.round(maxY / 2), maxY])];

  const tiles = [];
  for (const y of ys) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(450);
    tiles.push(await page.screenshot({ type: "png" }));
  }

  const gap = 12;
  const sheet = await sharp({
    create: {
      width: W * tiles.length + gap * (tiles.length - 1),
      height: H,
      channels: 3,
      background: { r: 120, g: 115, b: 108 },
    },
  })
    .composite(tiles.map((buf, i) => ({ input: buf, left: (W + gap) * i, top: 0 })))
    .png()
    .toFile(`${OUT}/${name}.png`);

  log.push(`${name}\ttotalH=${total}\tslices=${tiles.length}\tsheet=${sheet.width}x${sheet.height}`);
}

await browser.close();
console.log(log.join("\n"));
