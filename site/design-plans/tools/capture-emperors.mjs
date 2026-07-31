// 皇帝一覧（/emperors）を確認用に撮る。
//   BASE_URL=http://localhost:3000 node design-plans/tools/capture-emperors.mjs
// 既定は dev サーバー（3000）。
//
// playwright は site の依存に入れていない。入っていない環境では npx キャッシュの
// ものを node_modules へ symlink して使う（capture-database.mjs の冒頭を参照）。
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.SHOT_DIR ?? "./design-plans/tools/rebuild-shots";
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();

// デスクトップ: 初見の1枚と、肖像の少ない時代（南北朝＝9%）まで送った1枚。
const page = await browser.newPage({
  viewport: { width: 1440, height: 1024 },
  deviceScaleFactor: 2,
});
await page.goto(`${BASE}/emperors`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await sleep(1200);
await page.screenshot({ path: `${OUT}/emperors-now-firstframe.png` });

await page.evaluate(() => window.scrollTo(0, 1400));
await sleep(600);
await page.screenshot({ path: `${OUT}/emperors-now-scrolled.png` });

// バーは現在地を出すので、押す前に先頭へ戻す（送った位置のままだと別の時代が出る）。
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(600);

// 時代ジャンプバーは畳み込み（2026-07-31）。横に溢れていないこと＝
// scrollWidth と clientWidth が一致することを確かめる。
const jump = await page.evaluate(() => {
  const nav = document.querySelector('nav[aria-label="時代へジャンプ"]');
  if (!nav) return null;
  return {
    text: nav.innerText.replace(/\n/g, " "),
    overflows: nav.scrollWidth > nav.clientWidth,
  };
});
console.log("時代ジャンプバー(1440px):", JSON.stringify(jump));
if (jump?.overflows) throw new Error("ジャンプバーが横に溢れている（畳み込みが効いていない）");

// 押すと全15時代がポップオーバーに出る（縦にも横にもスクロールしない）。
// トリガーの文字は「現在地の時代」で、送った位置によって変わる。名前で掴まないこと。
await page.locator('nav[aria-label="時代へジャンプ"] button').click();
await sleep(500);
await page.screenshot({ path: `${OUT}/emperors-jump-popover.png` });
const eras = await page.evaluate(
  () => document.querySelectorAll('[data-slot="popover-content"] a').length,
);
console.log("ポップオーバーの時代数:", eras, "(期待 15)");
await page.keyboard.press("Escape");
await sleep(300);

// 肖像が9%しかない北朝まで送る（モノグラムの面積が最大になる帯）。
await page.evaluate(() => {
  document.querySelector("#era-南北朝")?.scrollIntoView();
});
await sleep(900);
await page.screenshot({ path: `${OUT}/emperors-now-monogram-heavy.png` });

// 詳細ダイアログ（一覧の一部として評価される面）。
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(400);
await page.getByRole("link", { name: /始皇帝/ }).first().click();
await sleep(1200);
await page.screenshot({ path: `${OUT}/emperors-now-dialog.png` });

// モバイル。
const m = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
await m.goto(`${BASE}/emperors`, { waitUntil: "networkidle" });
await m.evaluate(() => document.fonts.ready);
await sleep(1000);
await m.screenshot({ path: `${OUT}/emperors-now-mobile.png` });

console.log("shots →", OUT);
await browser.close();
