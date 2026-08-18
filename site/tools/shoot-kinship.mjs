// 系譜図の試作面だけを撮る（Issue #174）。まだ公開面ではないので capture-site.mjs の
// SHOTS には足していない。**自分の目で見るための道具** — ゲートではない。
//
//   cd site && npm run build && node tools/shoot-kinship.mjs
//
// 「面積のどれだけが地のままか」も同時に測る。前回の版の取り下げ理由の筆頭が
// 「面積の約8割が白」で、そこは目視ではなく数で見ないと判断がぶれる。
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("out");
const OUT = process.env.SHOT_DIR ?? "tools/shots";
const PORT = Number(process.env.PORT ?? 4601);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

function serveExport(root, port) {
  const send = (res, status, body, type) => {
    res.writeHead(status, { "content-type": type });
    res.end(body);
  };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    const rel = path.normalize(url).replace(/^(\.\.[/\\])+/, "");
    for (const candidate of [
      path.join(root, rel),
      path.join(root, `${rel}.html`),
      path.join(root, rel, "index.html"),
    ]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return send(
          res,
          200,
          fs.readFileSync(candidate),
          MIME[path.extname(candidate)] ?? "application/octet-stream",
        );
      }
    }
    send(res, 404, "not found", MIME[".txt"]);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = await serveExport(ROOT, PORT);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  locale: "ja-JP",
});
const page = await ctx.newPage();
await page.goto(`http://localhost:${PORT}/kinship`, { waitUntil: "networkidle" });
await sleep(2500);

await page.screenshot({ path: `${OUT}/kinship-01-fit.png` });

// 拡大して字が読める状態（React Flow はホイールでズームする）
await page.mouse.move(900, 500);
for (let i = 0; i < 14; i += 1) {
  await page.mouse.wheel(0, -240);
  await sleep(80);
}
await sleep(900);
await page.screenshot({ path: `${OUT}/kinship-02-zoom.png` });

// 政権ジャンプ（A の上端ナビに当たる操作）が効いているか
await page.goto(`http://localhost:${PORT}/kinship`, { waitUntil: "networkidle" });
await sleep(2000);
const jump = page.locator('nav[aria-label="政権へジャンプ"] button', { hasText: "後漢" }).first();
if (await jump.count()) {
  await jump.click();
  await sleep(1400);
  await page.screenshot({ path: `${OUT}/kinship-04-jump.png` });
}

// 地のままの面積を測る（キャンバスの地の色に一致するピクセルの割合）
const stat = await page.evaluate(async () => {
  const el = document.querySelector(".react-flow");
  if (!el) return null;
  return { w: el.clientWidth, h: el.clientHeight };
});

await browser.close();
server.close();

// PNG を読んで地の割合を出す（sharp は devDependencies に入っている）
const sharp = (await import("sharp")).default;
for (const f of ["kinship-01-fit.png", "kinship-02-zoom.png"]) {
  const { data, info } = await sharp(`${OUT}/${f}`)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const counts = new Map();
  const px = info.width * info.height;
  for (let i = 0; i < data.length; i += info.channels) {
    const key = `${data[i] >> 3},${data[i + 1] >> 3},${data[i + 2] >> 3}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  console.log(
    `${f}: ${info.width}×${info.height} 最頻色 ` +
      top.map(([k, n]) => `${k} ${((100 * n) / px).toFixed(1)}%`).join(" / "),
  );
}
console.log("canvas:", stat);
