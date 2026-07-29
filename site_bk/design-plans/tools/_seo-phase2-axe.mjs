// axe-core（site/node_modules 同梱）でトップと個別ページの a11y を確認する。
// 主眼は 2-1（サイドバーの Header を div 化）と 2-2（見出しレベル）の副作用。
import { chromium } from "playwright";
const AXE = "/home/sakis/emperor-stats/site/node_modules/axe-core/axe.min.js";
const BASE = "http://localhost:4173";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const path of ["/", "/reign", "/emperors/qin-shi-huang", "/emperors/tang-taizong", "/about"]) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  // サイドバーのアコーディオンを1つ開いた状態でも見る
  const t = page.locator('button[data-slot="accordion-trigger"]').first();
  if (await t.count()) { await t.click(); await page.waitForTimeout(400); }
  await page.addScriptTag({ path: AXE });
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { resultTypes: ["violations"] });
    return res.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, target: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
  });
  console.log(path, JSON.stringify(r, null, 1));
}
await browser.close();
