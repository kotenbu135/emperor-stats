// 見た目回帰の確認: 2-1 変更前に撮った seo-phase1-shots（17:28・accordion.tsx 変更は 17:52）の
// サイドバー領域と、現在の出力の同領域を突き合わせる。
import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";

const BASE = "http://localhost:4173";
const OLD = "/home/sakis/emperor-stats/site/design-plans/tools/seo-phase1-shots";
const OUT = "/home/sakis/emperor-stats/site/design-plans/tools/seo-phase2-shots";
fs.mkdirSync(OUT, { recursive: true });
const CROP = { left: 0, top: 0, width: 340, height: 760 };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

for (const [name, path] of [["reign", "/reign"], ["ages", "/ages"]]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 200));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
  const now = `${OUT}/${name}-desktop-after.png`;
  await page.screenshot({ path: now, fullPage: true });

  const a = await sharp(`${OLD}/${name}-desktop.png`).extract(CROP).raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(now).extract(CROP).raw().toBuffer({ resolveWithObject: true });
  await sharp(`${OLD}/${name}-desktop.png`).extract(CROP).toFile(`${OUT}/${name}-nav-before.png`);
  await sharp(now).extract(CROP).toFile(`${OUT}/${name}-nav-after.png`);

  let diff = 0, maxd = 0;
  const ch = a.info.channels;
  const dmap = Buffer.alloc(CROP.width * CROP.height * 3, 255);
  for (let i = 0, p = 0; i < a.data.length; i += ch, p++) {
    const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
    if (d > 8) { diff++; dmap[p * 3] = 255; dmap[p * 3 + 1] = 0; dmap[p * 3 + 2] = 0; }
    if (d > maxd) maxd = d;
  }
  await sharp(dmap, { raw: { width: CROP.width, height: CROP.height, channels: 3 } }).toFile(`${OUT}/${name}-nav-diff.png`);
  const total = CROP.width * CROP.height;
  console.log(`${name}: 差分ピクセル ${diff}/${total} (${(diff / total * 100).toFixed(3)}%) maxdelta=${maxd}`);
}
await browser.close();
