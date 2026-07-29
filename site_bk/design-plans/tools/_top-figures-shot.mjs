import { chromium } from "playwright";
const browser = await chromium.launch();
for (const [w, h, tag] of [[1440, 900, "desktop"], [375, 812, "mobile"]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const el = page.locator("dl").first();
  await el.screenshot({ path: `seo-phase2-shots/top-figures-${tag}.png` });
  await page.close();
}
await browser.close();
console.log("done");
