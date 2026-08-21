// 図の指定座標を1画面ぶん撮るだけの道具（shoot-kinship.mjs の縮小版・検証用）
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("out");
const PORT = 4611;
const PAGE_PATH = process.env.KINSHIP_PATH ?? "/kinship";
const X = Number(process.env.PEEK_X ?? 0);
const Y = Number(process.env.PEEK_Y ?? 0);
const ZOOM = Number(process.env.PEEK_ZOOM ?? 1);
const OUT = process.env.PEEK_OUT ?? "/tmp/peek.png";

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
};
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const rel = path.normalize(url).replace(/^(\.\.[/\\])+/, "");
  for (const c of [path.join(ROOT, rel), path.join(ROOT, `${rel}.html`), path.join(ROOT, rel, "index.html")]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      res.writeHead(200, { "content-type": MIME[path.extname(c)] ?? "application/octet-stream" });
      return res.end(fs.readFileSync(c));
    }
  }
  res.writeHead(404); res.end("nf");
});
await new Promise((r) => server.listen(PORT, r));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`http://localhost:${PORT}${PAGE_PATH}`, { waitUntil: "networkidle" });
await page.waitForFunction(() => typeof window.__kinshipSetViewport === "function");
await page.evaluate(([x, y, z]) => window.__kinshipSetViewport({ x: -x * z, y: -y * z, zoom: z }), [X, Y, ZOOM]);
await page.waitForTimeout(600);
await page.screenshot({ path: OUT });
await browser.close();
server.close();
console.log(OUT);
