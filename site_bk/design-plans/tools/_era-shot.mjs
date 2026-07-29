import { chromium } from "playwright";
const out = "/tmp/claude-1000/-home-sakis-emperor-stats/0dfd3f17-3bff-44d4-bf22-fcbef2d8cfbe/scratchpad";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1400 } });
await p.goto("http://localhost:4599/dynasties", { waitUntil: "networkidle" });
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(1200);
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(600);
// 集計単位セレクト（最初のもの）を「時代別」に
const trig = p.locator('button[role="combobox"]').first();
await trig.click();
await p.waitForTimeout(400);
await p.getByRole("option", { name: /時代/ }).click();
await p.waitForTimeout(1200);
await p.screenshot({ path: out + "/dynasties-era.png", clip: { x: 220, y: 250, width: 1220, height: 900 } });
await b.close();
console.log("ok");
