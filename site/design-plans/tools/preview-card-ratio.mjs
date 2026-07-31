// 皇帝一覧のカード比率の候補を、実ページにCSSを注入して撮り比べる（検討用）。
//   BASE_URL=http://localhost:3000 node design-plans/tools/preview-card-ratio.mjs
//
// 肖像は 360×480(3:4) の実体を object-cover + object-top で出しているので、
// 画像枠を低くするとブラウザが上寄せで切る＝**再トリミング後の見えがそのまま出る**。
// つまりこの撮り比べは、jpgを切り直す前に結果を確かめるためのもの。
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.SHOT_DIR ?? "./design-plans/tools/rebuild-shots";
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CARD = 'a[href^="/emperors/"]';

// 1440px・5列時のカード幅（実測）と文字ブロックの高さ（3行・実測）。
const CARD_W = 212.39;
const TEXT_H = 68.5;

const variants = [
  { name: "v0-now", label: "現状（カード3:5・画像3:4）", css: "" },
  { name: "v1-3x2", label: "カード3:2（横長・文字は下）", ratio: 1.5 },
  { name: "v2-1x1", label: "カード1:1（画像はほぼ3:2）", ratio: 1.0 },
  { name: "v3-2x3", label: "カード2:3（画像はほぼ6:7）", ratio: 2 / 3 },
  { name: "v5-3x4", label: "カード3:4（画像はほぼ1:1）", ratio: 0.75 },
  {
    name: "v4-3x2-side",
    label: "カード3:2（画像左・文字右／画像は3:4のまま）",
    css: `
      ${CARD} { display: flex !important; height: ${(CARD_W / 1.5).toFixed(1)}px !important; }
      ${CARD} > div:first-child { aspect-ratio: 3 / 4 !important; height: 100% !important; width: auto !important; flex: none !important; }
      ${CARD} > div:last-child { flex: 1 1 auto !important; min-width: 0 !important; align-self: center !important; }
    `,
  },
];

const browser = await chromium.launch();
for (const v of variants) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1024 },
    deviceScaleFactor: 2,
  });
  await page.goto(`${BASE}/emperors`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const css =
    v.css ??
    `${CARD} > div:first-child {
       aspect-ratio: auto !important;
       height: ${(CARD_W / v.ratio - TEXT_H).toFixed(1)}px !important;
     }`;
  if (css) await page.addStyleTag({ content: css });
  await sleep(900);
  await page.screenshot({ path: `${OUT}/card-ratio-${v.name}.png` });
  const m = await page.evaluate((sel) => {
    const c = document.querySelector(sel);
    const r = c.getBoundingClientRect();
    return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
  }, CARD);
  // 画面（1024）からヘッダー+時代バー(約104px)を引いた可視高で何人見えるか。
  const perScreen = ((920 / (m.h + 12)) * 5).toFixed(1);
  console.log(
    `${v.name.padEnd(12)} ${v.label}  カード ${m.w}×${m.h}  1画面 約${perScreen}人`,
  );
  await page.close();
}
await browser.close();
console.log("shots →", OUT);
