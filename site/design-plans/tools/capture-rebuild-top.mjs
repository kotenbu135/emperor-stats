// 再構築（Tremor 採用）のトップ画面を、第一印象の判定用に1440x1024で撮る。
// 差分検出ではなく「これは良いか」を人が見て判定するための1枚。
//   node design-plans/tools/capture-rebuild-top.mjs
// 既定は dev サーバー（3100）。ビルド結果を見たいときは
// `npx serve out -l 4599` を立てて BASE_URL=http://localhost:4599 で撮る。
// 既定を静的配信にしていたせいで、直したはずの画面が古いまま撮れた事故がある。
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = process.env.SHOT_DIR ?? "./design-plans/tools/rebuild-shots";
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1024 },
  deviceScaleFactor: 2,
});

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
// フォント・チャートの初期描画を待つ。
await page.evaluate(() => document.fonts.ready);
await sleep(1200);

// 第1画面（スクロールなし）。ここが「初見の1枚」。
await page.screenshot({ path: `${OUT}/top-firstframe.png` });

// ページ全体。盤面がどこまで続くかを見る。
await page.screenshot({ path: `${OUT}/top-full.png`, fullPage: true });

await browser.close();
console.log(`saved to ${OUT}`);
