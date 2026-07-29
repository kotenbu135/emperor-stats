// 詳細ダイアログの回帰確認（項目2の完了条件「ダイアログの描画が変わっていないこと」）。
// 使い方: SHOT_DIR=./rebuild-shots node _dialog-shot.mjs
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:4599";
const DIR = process.env.SHOT_DIR ?? "./rebuild-shots";
const TAG = process.env.TAG ?? "after";
const TARGETS = [
  { name: "buti-videos", href: "/emperors/han-wudi" }, // 肖像あり・動画40名のうちの1人
  { name: "huidi-monogram", href: "/emperors/han-huidi" }, // 肖像なし＝モノグラム
];

const browser = await chromium.launch();
for (const w of [1440, 375]) {
  for (const t of TARGETS) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/emperors`, { waitUntil: "networkidle" });
    const card = page.locator(`a[href="${t.href}"]`).first();
    await card.scrollIntoViewIfNeeded();
    await card.click();
    const dialog = page.locator('[role="dialog"]').first();
    await dialog.waitFor({ state: "visible" });
    await page.waitForTimeout(600);
    const out = `${DIR}/dialog-${TAG}-${t.name}-${w}.png`;
    await dialog.screenshot({ path: out });
    const videosOpen = await page
      .locator('[role="dialog"] details[open]')
      .count();
    console.log(`${out}  details[open]=${videosOpen}`);
    await ctx.close();
  }
}
await browser.close();
