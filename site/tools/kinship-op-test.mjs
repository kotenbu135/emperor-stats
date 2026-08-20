// 系譜図の「操作の規則」（KINSHIP_RULES.md 5節）を全章で実測する。
// 目視レビューの補助道具で、ビルドゲートではない（tsc・lint・build はどれも
// pointer-events-auto や clampViewport の欠落で落ちない — 2026-08-19 に実測でだけ
// 見つかった系の退行を、章の追加・訂正のたびに機械で見直すためのもの）。
//
//   cd site && npm run build && node tools/kinship-op-test.mjs
//
// 見るもの（章ごと）:
//   ①カードクリック → /emperors/<id> へ遷移（<a> の pointer-events-auto が生きているか）
//   ②ホイール = 縦パン（zoom が変わらないこと・panOnScroll）
//   ③Ctrl+ホイール = 拡大（zoomOnScroll=false でも Ctrl 側は効くこと）
//   ④政権ジャンプ直後のドラッグで画面が飛ばないこと（clampViewport を通っているか。
//     setCenter 直呼びだと d3-zoom の補正で数百px 飛ぶ — 2026-08-19 ユーザー指摘の形）
//   ⑤ホイールを送り続けても図の外で止まること（translateExtent）
// クリックは「viewport に全体が見えているカード」を選ぶ。画面外のカードを force で
// 押すと、その座標に重なる章ナビへ落ちて偽 NG になる（レビューで実測した罠）。
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("out");
const PORT = Number(process.env.PORT ?? 4611);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function serveExport(root, port) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    const rel = path.normalize(url).replace(/^(\.\.[/\\])+/, "");
    for (const candidate of [
      path.join(root, rel),
      path.join(root, `${rel}.html`),
      path.join(root, rel, "index.html"),
    ]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        res.writeHead(200, {
          "content-type": MIME[path.extname(candidate)] ?? "application/octet-stream",
        });
        return res.end(fs.readFileSync(candidate));
      }
    }
    res.writeHead(404);
    res.end("not found");
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

// 章は out/ から引く（chapters.ts と二重管理しない）
const chapterPaths = [
  "/kinship",
  ...fs
    .readdirSync(path.join(ROOT, "kinship"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => `/kinship/${f.replace(/\.html$/, "")}`)
    .sort(),
];

const server = await serveExport(ROOT, PORT);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const zoomOf = (t) => parseFloat(t.match(/scale\(([\d.]+)\)/)?.[1] ?? "1");
const yOf = (t) => parseFloat(t.match(/translate\([^,]+,\s*(-?[\d.]+)px\)/)?.[1] ?? "0");
const viewportTransform = () =>
  page.evaluate(() => document.querySelector(".react-flow__viewport").style.transform);

let ng = 0;
const report = (name, cond, detail) => {
  if (!cond) ng++;
  console.log(`${cond ? "OK" : "NG"} ${name}${detail ? ` — ${detail}` : ""}`);
};

for (const chPath of chapterPaths) {
  await page.goto(`http://localhost:${PORT}${chPath}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800); // fitView と初期 clamp の完了待ち
  const pane = await page.locator(".react-flow__pane").first().boundingBox();
  const cx = pane.x + pane.width / 2;
  const cy = pane.y + pane.height / 2;

  // ① 見えているカードをクリック → 個別ページ
  const links = page.locator('.react-flow a[href^="/emperors/"]');
  let clicked = null;
  for (let i = 0; i < (await links.count()); i++) {
    const box = await links.nth(i).boundingBox();
    if (
      box &&
      box.x >= pane.x &&
      box.y >= pane.y &&
      box.x + box.width <= pane.x + pane.width &&
      box.y + box.height <= pane.y + pane.height
    ) {
      clicked = await links.nth(i).getAttribute("href");
      await links.nth(i).click();
      break;
    }
  }
  await page.waitForTimeout(500);
  report(
    `${chPath} ① クリック遷移`,
    clicked !== null && page.url().includes("/emperors/"),
    `${clicked ?? "可視カードなし"} → ${new URL(page.url()).pathname}`,
  );
  await page.goBack({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // ② ホイール = 縦パン（zoom 不変）
  const t0 = await viewportTransform();
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(400);
  const t1 = await viewportTransform();
  report(
    `${chPath} ② ホイール縦パン`,
    zoomOf(t0) === zoomOf(t1) && yOf(t0) !== yOf(t1),
    `zoom ${zoomOf(t0)}→${zoomOf(t1)} / y ${yOf(t0).toFixed(0)}→${yOf(t1).toFixed(0)}`,
  );

  // ③ Ctrl+ホイール = 拡大
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Control");
  await page.waitForTimeout(400);
  const t2 = await viewportTransform();
  report(`${chPath} ③ Ctrl+ホイール拡大`, zoomOf(t2) > zoomOf(t1), `zoom ${zoomOf(t1)}→${zoomOf(t2)}`);

  // ④ 政権ジャンプ → ドラッグ開始で画面が飛ばない
  const jumpBtns = page.locator("button", { hasText: "人" });
  const n = await jumpBtns.count();
  if (n > 0) {
    await jumpBtns.nth(n - 1).click();
    await page.waitForTimeout(900); // ジャンプのアニメ完了待ち
    const before = await viewportTransform();
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 8, cy + 8, { steps: 2 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await viewportTransform();
    const dy = Math.abs(yOf(before) - yOf(after));
    report(`${chPath} ④ ジャンプ後ドラッグの飛び`, dy < 60, `y差 ${dy.toFixed(0)}px`);
  }

  // ⑤ 図の外で止まる（translateExtent）: 送り続けて y が動かなくなること
  let prev = yOf(await viewportTransform());
  let stopped = false;
  for (let i = 0; i < 30; i++) {
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(120);
    const cur = yOf(await viewportTransform());
    if (cur === prev) {
      stopped = true;
      break;
    }
    prev = cur;
  }
  report(`${chPath} ⑤ translateExtent で停止`, stopped, `最終 y ${prev.toFixed(0)}`);
}

console.log(ng === 0 ? "\nすべて OK" : `\nNG: ${ng}件`);
await browser.close();
server.close();
process.exit(ng === 0 ? 0 : 1);
