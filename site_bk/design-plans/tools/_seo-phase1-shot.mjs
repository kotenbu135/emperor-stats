import { chromium } from "playwright";
import fs from "node:fs";
const OUT = "/home/sakis/emperor-stats/site/design-plans/tools/seo-phase1-shots";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const [w, h, tag] of [[1440, 900, "desktop"], [375, 812, "mobile"]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  for (const [name, path] of [["death-accession", "/death-accession"], ["dynasties", "/dynasties"], ["reign", "/reign"], ["ages", "/ages"]]) {
    await page.goto(`http://localhost:4599${path}`, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.8;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 200));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${name}-${tag}.png`, fullPage: true });
  }
  await page.close();
}
await browser.close();
console.log("done");
