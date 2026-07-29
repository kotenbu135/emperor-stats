// 第4章の赤矢印の一覧(ラベル・両端)を編集モードのパネルから読み出す(ローカル専用)。
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const chapter = process.env.CHAPTER ?? "nanbeichao";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
await page.goto(`${BASE}/kinship?edit=${chapter}`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

const n = await page.evaluate(
  () => document.querySelectorAll('svg path[stroke="transparent"][stroke-width="7"]').length,
);
for (let i = 0; i < n; i++) {
  await page.evaluate((idx) => {
    const hit = [...document.querySelectorAll('svg path[stroke="transparent"][stroke-width="7"]')];
    hit[idx].dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
  }, i);
  await page.waitForTimeout(200);
  const t = await page.locator("text=選択中の矢印").first().textContent().catch(() => null);
  console.log(i, t);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(120);
}
await browser.close();
