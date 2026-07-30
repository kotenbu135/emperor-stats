// 本文列の上限（max-w-content = 1200px）とカードのコンテナクエリ化の確認用。
// 幅ごとの見え方を比べたいので、routes × viewports で全面スクリーンショットを撮る。
//   node capture-size-cap.mjs   （事前に out/ を http://localhost:4599 で配信しておく）
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:4599";
const OUT = process.env.SHOT_DIR ?? "./size-cap-shots";
fs.mkdirSync(OUT, { recursive: true });

// out/ は emperors.html のような単一ファイル書き出し（trailingSlash なし）なので、
// 素の http.server で見るときは .html を明示する（/emperors/ はディレクトリ一覧になる）。
const ROUTES = [
  ["top", "/index.html"],
  ["emperors", "/emperors.html"],
  ["reign", "/reign.html"],
  ["death-accession", "/death-accession.html"],
  ["timeline", "/timeline.html"],
];

// 1536 = 1920を125%表示（最頻）・768 = サイドバーが現れる境界（従来カードが103pxまで
// 詰まっていた幅）・375 = モバイル基準。
const VIEWPORTS = [
  ["w1920", 1920, 1080],
  ["w1536", 1536, 864],
  ["w1366", 1366, 768],
  ["w768", 768, 1024],
  ["w375", 375, 812],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// LazyMount(IntersectionObserver)は視界に入らないと描画されないため、一度下まで
// 送ってから先頭に戻す（capture-desktop.mjs と同じ手順）。
async function primeLazySections(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    let y = 0;
    while (y < document.body.scrollHeight && y < 40000) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
      y += step;
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  });
}

const browser = await chromium.launch();
for (const [vpName, width, height] of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width, height } });
  for (const [name, path] of ROUTES) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await primeLazySections(page);
    await sleep(300);
    await page.screenshot({ path: `${OUT}/${vpName}-${name}.png` });
    // カード1枚の実寸と列数（コンテナクエリの効き方）をログに残す。
    if (name === "emperors") {
      const info = await page.evaluate(() => {
        const grids = [...document.querySelectorAll('[class*="grid-cols-2"]')];
        const grid = grids.find((g) => g.className.includes("@xl:grid-cols-3"));
        if (!grid) return null;
        const card = grid.firstElementChild;
        const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
        return {
          container: Math.round(grid.getBoundingClientRect().width),
          cols,
          card: card ? Math.round(card.getBoundingClientRect().width) : null,
        };
      });
      console.log(vpName, JSON.stringify(info));
    }
  }
  await page.close();
}
await browser.close();
console.log(`saved → ${OUT}`);
