// 名前のテキスト選択（2026-08-21）の実測: ①ドラッグで名前を選択できる
// ②選択で終わったクリックは遷移しない ③選択なしのクリックは遷移する
// ④カードの肖像部からのドラッグはパンのまま。
// ダブルクリック選択は1回目のクリックで遷移してしまうため対象外（コピーの経路はドラッグ選択）。
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve("out");
const PORT = 4519;
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".woff2": "font/woff2", ".webp": "image/webp", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let f = path.join(ROOT, p);
  if (!path.extname(f)) { if (existsSync(f + ".html")) f += ".html"; else f = path.join(f, "index.html"); }
  try { const b = readFileSync(f); res.setHeader("content-type", MIME[path.extname(f)] ?? "application/octet-stream"); res.end(b); }
  catch { res.statusCode = 404; res.end("nf"); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`http://localhost:${PORT}/kinship`, { waitUntil: "networkidle" });
let ng = 0;
const report = (label, pass, detail) => {
  console.log(`${pass ? "OK" : "NG"} ${label}${detail ? " — " + detail : ""}`);
  if (!pass) ng++;
};

// 画面内に見えている皇帝カードの名前要素を選ぶ（画面外を force で押すと
// 章ナビに落ちて偽 NG になる — kinship-op-test.mjs と同じ罠）。
async function visibleName() {
  const all = page.locator('a[href^="/emperors/"] .select-text');
  const n = await all.count();
  for (let i = 0; i < n; i++) {
    const el = all.nth(i);
    const b = await el.boundingBox();
    if (b && b.y > 170 && b.y + b.height < 880 && b.x > 260 && b.x + b.width < 1420)
      return el;
  }
  const boxes = [];
  for (let i = 0; i < Math.min(n, 5); i++) boxes.push(await all.nth(i).boundingBox());
  throw new Error(
    `画面内にカードの名前が見つからない（候補 ${n} 件・先頭: ${JSON.stringify(boxes)}）`,
  );
}
let name = await visibleName();

// ①② ドラッグで名前を選択でき、選択で終わったクリックでは遷移しない
//（ダブルクリックは1回目のクリックが遷移してしまうため、コピーの経路はドラッグ選択）
const box = await name.boundingBox();
await page.mouse.move(box.x + 4, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 8 });
await page.mouse.up();
const dragSel = await page.evaluate(() => window.getSelection()?.toString() ?? "");
await page.waitForTimeout(400);
const stayed = !page.url().includes("/emperors/");
report("① ドラッグで名前を選択", dragSel.trim().length > 0, `選択="${dragSel.trim()}"`);
report("② 選択で終わったクリックで遷移しない", stayed, `url=${page.url()}`);

// ③ 選択なしの普通のクリックは遷移する
await page.evaluate(() => window.getSelection()?.removeAllRanges());
const href = await name.evaluate((el) => el.closest("a").getAttribute("href"));
await name.click();
await page.waitForTimeout(400);
report("③ クリックで個別ページへ遷移", page.url().includes(href), `→ ${page.url()}`);

// ④ 肖像部からのドラッグはパンのまま
await page.goBack({ waitUntil: "networkidle" });
const before = await page.evaluate(() => {
  const vp = document.querySelector(".react-flow__viewport");
  return vp ? vp.style.transform : "";
});
name = await visibleName();
const card = name.locator("xpath=ancestor::a[1]");
const cbox = await card.boundingBox();
await page.mouse.move(cbox.x + cbox.width / 2, cbox.y + 20); // 上半分=肖像
await page.mouse.down();
await page.mouse.move(cbox.x + cbox.width / 2, cbox.y + 140, { steps: 6 });
await page.mouse.up();
const after = await page.evaluate(() => {
  const vp = document.querySelector(".react-flow__viewport");
  return vp ? vp.style.transform : "";
});
report("④ 肖像部ドラッグでパン", before !== after, `${before} → ${after}`);

await browser.close();
server.close();
console.log(ng === 0 ? "すべて OK" : `NG ${ng} 件`);
process.exit(ng === 0 ? 0 : 1);
