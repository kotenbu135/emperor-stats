// このサイトについて（/about）を確認用に撮る。
//   node design-plans/tools/capture-about.mjs
// 既定は dev サーバー（3000）。SHOT_TAG で出力名の接尾辞を変えられる（before/after 比較用）。
//
// playwright は site の依存に入れていない。入っていない環境では npx キャッシュのものを
// node_modules へ symlink して使う（AGENTS.md の「ハマりどころ」）。
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.SHOT_DIR ?? "./design-plans/tools/rebuild-shots";
const TAG = process.env.SHOT_TAG ?? "now";
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();

const page = await browser.newPage({
  viewport: { width: 1440, height: 1024 },
  deviceScaleFactor: 2,
});
await page.goto(`${BASE}/about`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await sleep(600);

// ファーストビュー1枚と、全体を縦に4分割した通し。
await page.screenshot({ path: `${OUT}/about-${TAG}-firstview.png` });

const total = await page.evaluate(() => document.documentElement.scrollHeight);
console.log(`page height: ${total}px（1440px幅）`);
for (let i = 1; i <= 4; i++) {
  const y = Math.round(((total - 1024) * i) / 5);
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await sleep(400);
  await page.screenshot({ path: `${OUT}/about-${TAG}-scroll${i}.png` });
}

const overflow = await page.evaluate(() => ({
  doc: document.documentElement.scrollWidth,
  win: window.innerWidth,
}));
console.log("desktop horizontal overflow:", overflow);

// 節へジャンプ。着地したとき見出しが固定バーの**下**に出ていること
// （Section の scrollMt に BELOW_SECTION_NAV を渡していないと見出しがバーに隠れる）。
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(300);
await page.getByRole("navigation", { name: "節へジャンプ" }).getByRole("button").click();
await sleep(300);
await page.screenshot({ path: `${OUT}/about-${TAG}-jump-popover.png` });
await page.getByRole("link", { name: "運営者" }).click();
await sleep(600);
console.log(
  "運営者へジャンプ:",
  JSON.stringify(
    await page.evaluate(() => {
      const sec = document.getElementById("operator");
      const bar = document.querySelector('nav[aria-label="節へジャンプ"]');
      return {
        // 節の上端がバーの下端より下（＝隠れていない）。0〜数十pxが正常。
        headingTop: Math.round(sec.getBoundingClientRect().top),
        barBottom: Math.round(bar.getBoundingClientRect().bottom),
        // 着地後はバーの現在地もその節になる。
        current: bar.querySelector("button span")?.textContent?.trim(),
      };
    }),
  ),
);
await page.screenshot({ path: `${OUT}/about-${TAG}-jump-landed.png` });
await page.close();

const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
await mobile.goto(`${BASE}/about`, { waitUntil: "networkidle" });
await mobile.evaluate(() => document.fonts.ready);
await sleep(600);
await mobile.screenshot({ path: `${OUT}/about-${TAG}-mobile.png` });
console.log(
  "mobile height:",
  await mobile.evaluate(() => document.documentElement.scrollHeight),
  "overflow:",
  JSON.stringify(
    await mobile.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      win: window.innerWidth,
    })),
  ),
);

await browser.close();
console.log(`saved to ${OUT}`);
