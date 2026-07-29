import { chromium } from "playwright";
const out = "/tmp/claude-1000/-home-sakis-emperor-stats/0dfd3f17-3bff-44d4-bf22-fcbef2d8cfbe/scratchpad";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.goto("http://localhost:4599/dynasties", { waitUntil: "networkidle" });
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(1800);
await p.evaluate(() => {
  const h = [...document.querySelectorAll("h2")].find((e) => e.textContent.includes("死因の内訳"));
  h.scrollIntoView();
  window.scrollBy(0, 520);
});
await p.waitForTimeout(1200);
await p.screenshot({ path: out + "/m-dyn-death2.png" });
await b.close();
console.log("ok");
