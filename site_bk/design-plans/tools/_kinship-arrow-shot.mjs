// 西魏恭帝→宇文覚の矢印の確認用スクリーンショット(ローカル専用・使い捨て)。
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "./rebuild-shots";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
await page.goto(`${BASE}/kinship`, { waitUntil: "networkidle" });
await page.evaluate(async () => {
  const step = window.innerHeight * 0.8;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 200));
  }
});
await page.waitForTimeout(800);

// 第4章(南北朝)を35%に縮小してから、両ノードが入る位置までスクロールする。
const info = await page.evaluate(async () => {
  const node = document.querySelector('g[data-kid="p-yuwen-jue"]');
  if (!node) return { error: "宇文覚のノードがない" };
  const svg = node.closest("svg");
  const scroller = svg.closest("div[class*='overflow']") ?? svg.parentElement;
  // 章のヘッダ内にある倍率セレクトを35%にする
  const section = svg.closest("section") ?? document.body;
  const sel = section.querySelector("select");
  if (sel) {
    sel.value = "0.35";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }
  await new Promise((r) => setTimeout(r, 600));
  const a = document.querySelector('g[data-kid="xiwei-gongdi"]').getBoundingClientRect();
  const b = document.querySelector('g[data-kid="p-yuwen-jue"]').getBoundingClientRect();
  const sr = scroller.getBoundingClientRect();
  scroller.scrollLeft += Math.min(a.left, b.left) - sr.left - 60;
  window.scrollBy(0, Math.min(a.top, b.top) - 200);
  await new Promise((r) => setTimeout(r, 600));
  return { hasSelect: Boolean(sel) };
});
console.log(info);
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/kinship-xiwei-yuwenjue.png` });
console.log("saved");
await browser.close();
