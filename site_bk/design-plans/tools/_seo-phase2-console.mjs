// asChild 化によるハイドレーション不整合が無いかコンソールを確認する。
import { chromium } from "playwright";
const BASE = "http://localhost:4173";
const browser = await chromium.launch();
for (const path of ["/", "/reign", "/emperors/qin-shihuang"]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const msgs = [];
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) msgs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => msgs.push("pageerror: " + e.message.slice(0, 200)));
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const t = page.locator('button[data-slot="accordion-trigger"]').first();
  if (await t.count()) { await t.click(); await page.waitForTimeout(400); await t.click(); await page.waitForTimeout(400); }
  console.log(path, msgs.length ? JSON.stringify(msgs, null, 1) : "コンソールエラー/警告なし");
  await page.close();
}
await browser.close();
