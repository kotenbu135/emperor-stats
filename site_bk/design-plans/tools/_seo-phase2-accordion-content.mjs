// 補足検証: 開いたときにサブ項目（リンク）が実際に現れるかを DOM で直接数える。
import { chromium } from "playwright";
const BASE = "http://localhost:4173";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);

const probe = () => page.evaluate(() => {
  const t = document.querySelector('button[aria-label="在位データの項目を開閉"]');
  const item = t.closest('[data-slot="accordion-item"]');
  const c = item.querySelector('[data-slot="accordion-content"]');
  return {
    expanded: t.getAttribute("aria-expanded"),
    contentExists: !!c,
    contentHidden: c ? c.hasAttribute("hidden") : null,
    contentState: c ? c.getAttribute("data-state") : null,
    contentH: c ? Math.round(c.getBoundingClientRect().height) : null,
    links: c ? [...c.querySelectorAll("a")].map((a) => a.textContent.trim()) : [],
    linkVisible: c && c.querySelector("a") ? c.querySelector("a").getBoundingClientRect().height > 0 : null,
    navH3empty: [...document.querySelectorAll("nav h3")].length,
  };
});

console.log("closed:", JSON.stringify(await probe()));
await page.click('button[aria-label="在位データの項目を開閉"]');
await page.waitForTimeout(600);
console.log("open  :", JSON.stringify(await probe()));
await page.click('button[aria-label="在位データの項目を開閉"]');
await page.waitForTimeout(700);
console.log("closed2:", JSON.stringify(await probe()));

// サブ項目リンクが実際に押せるか（遷移確認）
await page.click('button[aria-label="在位データの項目を開閉"]');
await page.waitForTimeout(500);
const first = page.locator('[data-slot="accordion-content"] a').first();
console.log("first sublink:", await first.textContent(), await first.getAttribute("href"));
await first.click();
await page.waitForTimeout(1200);
console.log("navigated to:", page.url());
await browser.close();
