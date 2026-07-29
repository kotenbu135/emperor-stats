import { chromium } from "playwright";
const out = "/tmp/claude-1000/-home-sakis-emperor-stats/0dfd3f17-3bff-44d4-bf22-fcbef2d8cfbe/scratchpad";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

// 1) /dynasties 死因の内訳（モバイル）
await p.goto("http://localhost:4599/dynasties", { waitUntil: "networkidle" });
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(1500);
const h2 = p.getByRole("heading", { name: "死因の内訳" });
await h2.scrollIntoViewIfNeeded();
await p.waitForTimeout(1200);
await p.screenshot({ path: out + "/m-dynasties-death.png" });

// 2) /reign 復位者一覧の表
await p.goto("http://localhost:4599/reign", { waitUntil: "networkidle" });
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(1500);
const h = p.getByRole("heading", { name: /復位者一覧/ });
await h.scrollIntoViewIfNeeded();
await p.waitForTimeout(1000);
await p.evaluate(() => window.scrollBy(0, 320));
await p.waitForTimeout(600);
await p.screenshot({ path: out + "/m-reign-table.png" });

// 3) /emperors 先頭の時代ジャンプ
await p.goto("http://localhost:4599/emperors", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
await p.screenshot({ path: out + "/m-emperors-top.png" });
await b.close();
console.log("ok");
