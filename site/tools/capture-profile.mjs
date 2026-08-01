// 紹介文（GitHub Issue #16）を書いた皇帝の個別ページを撮る。
//
// capture-site.mjs は全ページの定点観測で、対象が固定（SHOTS）。こちらは
// **書いた人物を引数で指す**ためのもので、365本を書く間くり返し使う。
// ふりがな ON/OFF の2枚を撮るのは、総ルビの本文で行位置が動かないこと
// （globals.css の --leading-ruby）が紹介文の受け入れ条件のため。
//
//   node tools/capture-profile.mjs qin-shi-huang [qin-er-shi ...]
//
// 出力は tools/shots/profile-<id>-{desktop,mobile}{,-rubyoff}.png（.gitignore 対象）。
// out/ が必要なので npm run build のあとに実行する。
// 並行セッションと同時に動かすときは PORT を変える。

import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "out");
const PORT = Number(process.env.PORT ?? 4611);
const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error("使い方: node tools/capture-profile.mjs <皇帝id> [...]");
  process.exit(1);
}

// output: "export" なので /emperors/x → emperors/x.html を自前で解決する
// （素の静的サーバーでは 404 になる。capture-site.mjs と同じ理由）。
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  for (const candidate of [p, `${p}.html`, path.join(p, "index.html")]) {
    try {
      const buf = await readFile(path.join(ROOT, candidate));
      const ext = path.extname(candidate) || ".html";
      res.writeHead(200, { "content-type": TYPES[ext] ?? "application/octet-stream" });
      return res.end(buf);
    } catch {
      // 次の候補へ
    }
  }
  res.writeHead(404).end("not found");
});
await new Promise((resolve) => server.listen(PORT, resolve));

const browser = await chromium.launch();
for (const id of ids) {
  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["mobile", 390, 844],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 2,
    });
    const response = await page.goto(`http://localhost:${PORT}/emperors/${id}`, {
      waitUntil: "networkidle",
    });
    // page.goto は 404 でも throw しない（capture-site.mjs と同じ罠）。
    if (response.status() !== 200) {
      throw new Error(`/emperors/${id} が ${response.status()} を返しました`);
    }
    await page.screenshot({ path: `tools/shots/profile-${id}-${name}.png` });
    await page.evaluate(() =>
      document.documentElement.setAttribute("data-ruby", "off"),
    );
    await page.screenshot({
      path: `tools/shots/profile-${id}-${name}-rubyoff.png`,
    });
    await page.close();
    console.log(`profile-${id}-${name}.png`);
  }
}
await browser.close();
server.close();
