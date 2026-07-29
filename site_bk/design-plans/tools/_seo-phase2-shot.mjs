// SEO Phase 2 の変更ページの確認用スクリーンショット。
// 事前に site/out を静的配信しておくこと（例: npx serve out -l 4601）。
import { chromium } from "playwright";
import fs from "node:fs";

const OUT = "/home/sakis/emperor-stats/site/design-plans/tools/seo-phase2-shots";
const BASE = "http://localhost:4601";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const [w, h, tag] of [
  [1440, 900, "desktop"],
  [375, 812, "mobile"],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  for (const [name, path] of [
    ["about-operator", "/about"],
    ["emperor-kangxi", "/emperors/qing-shengzu"],
    ["emperor-yingzong", "/emperors/ming-yingzong"],
  ]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    if (name === "about-operator") {
      await page.evaluate(() => document.getElementById("operator")?.scrollIntoView());
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/${name}-${tag}.png` });
      continue;
    }
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${name}-${tag}.png`, fullPage: true });
  }
  // サイドバー（アコーディオン）を開いた状態も撮る
  if (tag === "desktop") {
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/sidebar-${tag}.png`, clip: { x: 0, y: 0, width: 320, height: 900 } });
  }
  await page.close();
}
await browser.close();
console.log("done");
