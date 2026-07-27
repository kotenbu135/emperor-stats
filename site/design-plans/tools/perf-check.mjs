// CLS と Long Task の実測（TODO 5・10 の完了条件）。
// 使い方: node _perf-check.mjs   （BASE_URL で配信先を変更できる）
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:4599";
const ROUTES = ["/emperors", "/ages", "/reign", "/death-accession", "/military"];
const WIDTHS = [
  { name: "375", width: 375, height: 812 },
  { name: "1440", width: 1440, height: 900 },
];

const browser = await chromium.launch();
for (const w of WIDTHS) {
  for (const route of ROUTES) {
    const ctx = await browser.newContext({
      viewport: { width: w.width, height: w.height },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__cls = 0;
      window.__long = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (!e.hadRecentInput) window.__cls += e.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__long.push(Math.round(e.duration));
      }).observe({ type: "longtask", buffered: true });
    });
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    // LazyMount を起こしてから先頭へ戻す（撮り比べスクリプトと同じ手順）。
    await page.evaluate(async () => {
      const step = window.innerHeight;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    // グラフ枠の中を上下にスクロールして、端フェードの再描画がシフトを起こさないか見る。
    await page.evaluate(async () => {
      const box = document.querySelector("[data-scroll-frame], .overflow-y-auto");
      if (!box) return;
      for (const top of [200, 800, 1600, 0]) {
        box.scrollTop = top;
        await new Promise((r) => setTimeout(r, 80));
      }
    });
    await page.waitForTimeout(400);
    const { cls, long } = await page.evaluate(() => ({
      cls: window.__cls,
      long: window.__long,
    }));
    const over50 = long.filter((d) => d >= 50);
    console.log(
      `${w.name.padStart(4)}px ${route.padEnd(18)} CLS=${cls.toFixed(4)}  LongTask=${over50.length}件` +
        (over50.length ? ` [${over50.join(",")}ms]` : ""),
    );
    await ctx.close();
  }
}
await browser.close();
