// フォントの転送量を実測する（Issue #79 の「効いたか分かる指標」）。
//
//   cd site && npm run build
//   node tools/font-audit.mjs                 # out/ を測る
//   node tools/font-audit.mjs ../../別の/out  # 別のビルドと突き合わせる
//
// out/ を静的配信し、モバイル相当（390x844）で主要4面を読み込んで
// フォントのリクエスト本数・転送量・総転送量に占める比率を出す。
// **ページごとに新しいコンテキストで開く**（フォントは4面で共通なので、
// 使い回すと2ページ目以降がキャッシュに当たって0本に見える）。
//
// playwright は site の依存に入っておらず `node_modules/playwright{,-core}` の
// symlink で解決している（site/AGENTS.md の「ハマりどころ」）。site/ から実行すること。
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.argv[2] ?? "out");
const PORT = Number(process.env.PORT ?? 4611);
const PAGES = ["/", "/emperors", "/database", "/emperors/qin-shi-huang"];

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
  ".xml": "application/xml; charset=utf-8",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

/** `output: "export"` の out/ を配信する（/about → out/about.html の解決が要る）。 */
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
        res.writeHead(200, { "content-type": MIME[path.extname(candidate)] ?? "application/octet-stream" });
        return res.end(fs.readFileSync(candidate));
      }
    }
    res.writeHead(404, { "content-type": MIME[".txt"] });
    res.end("not found");
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (!fs.existsSync(ROOT)) {
  console.error(`${ROOT} が無い。先に \`npm run build\` を実行すること。`);
  process.exit(1);
}

const server = await serveExport(ROOT, PORT);
const browser = await chromium.launch();
const rows = [];

for (const p of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ja-JP" });
  const page = await ctx.newPage();
  const seen = new Map();
  page.on("response", async (res) => {
    const url = res.url();
    if (seen.has(url)) return;
    let size = 0;
    try {
      size = (await res.body()).length;
    } catch {
      /* リダイレクト等は本文が取れない */
    }
    seen.set(url, size);
  });
  await page.goto(`http://localhost:${PORT}${p}`, { waitUntil: "networkidle", timeout: 60000 });
  // 遅れて到着するサブセットを拾う
  await page.waitForTimeout(1500);

  let fontN = 0;
  let fontB = 0;
  let totalB = 0;
  for (const [url, size] of seen) {
    totalB += size;
    if (/\.(woff2?|ttf|otf)$/.test(url)) {
      fontN += 1;
      fontB += size;
    }
  }
  rows.push({
    page: p,
    req: seen.size,
    totalKB: Math.round(totalB / 1024),
    fontN,
    fontKB: Math.round(fontB / 1024),
    pct: totalB ? Math.round((fontB / totalB) * 1000) / 10 : 0,
  });
  await ctx.close();
}

console.log(`\n=== ${ROOT}`);
console.log("page                         req   total(KB)  fonts  font(KB)   font%");
for (const r of rows) {
  console.log(
    `${r.page.padEnd(26)} ${String(r.req).padStart(5)} ${String(r.totalKB).padStart(10)} ${String(r.fontN).padStart(6)} ${String(r.fontKB).padStart(9)} ${String(r.pct).padStart(7)}`,
  );
}

await browser.close();
server.close();
