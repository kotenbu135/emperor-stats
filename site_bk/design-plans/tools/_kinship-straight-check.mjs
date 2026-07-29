// 編集モードで赤矢印を選択 →「直線にする」が効くかの確認(ローカル専用・使い捨て)。
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await page.goto(`${BASE}/kinship?edit=nanbeichao`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

const before = await page.evaluate(() => {
  const paths = [...document.querySelectorAll("svg path")].map((p) => p.getAttribute("d"));
  return paths.find((d) => d && /^M \d+(\.\d+)? \d+(\.\d+)? C/.test(d) && d.length > 30);
});

// 矢印の当たり判定(overlay の transparent stroke)をクリックして選択する。
const picked = await page.evaluate(() => {
  const hit = [...document.querySelectorAll('svg path[stroke="transparent"][stroke-width="7"]')];
  if (hit.length === 0) return { count: 0 };
  const el = hit[hit.length - 1];
  const box = el.getBoundingClientRect();
  return { count: hit.length, x: box.left + box.width / 2, y: box.top + box.height / 2 };
});
console.log("hit targets:", picked.count);
if (picked.count) {
  // パス上の実点をクリックする(bboxの中心は線から外れることがある)
  const pt = await page.evaluate(() => {
    const hit = [...document.querySelectorAll('svg path[stroke="transparent"][stroke-width="7"]')];
    const el = hit[hit.length - 1];
    const p = el.getPointAtLength(el.getTotalLength() / 2);
    const svg = el.ownerSVGElement;
    const m = el.getScreenCTM();
    return { x: p.x * m.a + m.e, y: p.y * m.d + m.f, vb: svg.getAttribute("viewBox") };
  });
  await page.evaluate(() => {
    const hit = [...document.querySelectorAll('svg path[stroke="transparent"][stroke-width="7"]')];
    const el = hit[hit.length - 1];
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
  });
  await page.waitForTimeout(400);
  const panel = await page.locator("text=選択中の矢印").first().textContent().catch(() => null);
  console.log("panel:", panel);
  const btn = page.locator("button", { hasText: "直線にする" }).first();
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(800);
    const straightPaths = await page.evaluate(() =>
      [...document.querySelectorAll("svg path[marker-end]")].map((p) => p.getAttribute("d")),
    );
    console.log("arrow paths:", straightPaths);
    console.log("panel now:", await page.locator("text=現在:").first().textContent());
  } else {
    console.log("「直線にする」ボタンが出ていません");
  }
}
console.log("before sample:", before?.slice(0, 60));
await page.screenshot({ path: "./rebuild-shots/kinship-editor-straight.png" });
await browser.close();

