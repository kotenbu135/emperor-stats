// aria-controls が指す要素が実在するか（開いたとき）／閉じたときは Radix 仕様どおり
// 属性ごと落ちるかを確認する。
import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://localhost:4173/", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
const check = () => p.evaluate(() =>
  [...document.querySelectorAll('button[data-slot="accordion-trigger"]')].map((t) => ({
    label: t.getAttribute("aria-label"),
    expanded: t.getAttribute("aria-expanded"),
    state: t.getAttribute("data-state"),
    controls: t.getAttribute("aria-controls"),
    targetExists: t.getAttribute("aria-controls") ? !!document.getElementById(t.getAttribute("aria-controls")) : null,
    wrapper: t.parentElement.tagName,
  })));
console.log("closed:", JSON.stringify(await check(), null, 1));
for (const t of await p.locator('button[data-slot="accordion-trigger"]').all()) { await t.click(); await p.waitForTimeout(150); }
await p.waitForTimeout(500);
console.log("all open:", JSON.stringify(await check(), null, 1));
await b.close();
