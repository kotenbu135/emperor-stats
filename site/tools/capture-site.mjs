// 公開している全ページの確認用スクリーンショットを撮る。
//
//   cd site && npm run build            # out/ を最新にする
//   node tools/capture-site.mjs         # out/ を静的配信して撮る（既定の出力先 tools/shots/）
//   BASE_URL=http://localhost:3000 node tools/capture-site.mjs   # dev サーバーに当てる
//
// playwright は site の依存に入っておらず、`node_modules/playwright{,-core}` へ npx キャッシュから
// 張った symlink で解決している。`ERR_MODULE_NOT_FOUND: playwright` が出たら張り直す
// （site/AGENTS.md の「ハマりどころ」）。site/ から実行すること。
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("out");
const OUT = process.env.SHOT_DIR ?? "tools/shots";
const PORT = Number(process.env.PORT ?? 4599);

const VIEWPORTS = [
  ["desktop", 1440, 900],
  ["mobile", 390, 844],
];

// 公開している面はこれで全部（皇帝個別365ページは代表2名だけ）。
// ページを増減したらここも直す。
const SHOTS = [
  { name: "01-top", path: "/" },
  { name: "02-emperors", path: "/emperors" },
  // 一覧の中で開く面。fullPage だとオーバーレイの外側まで撮ってしまうので画面内に限る。
  { name: "03-emperors-jump", path: "/emperors", viewportOnly: true, action: openJumpPopover },
  { name: "04-database", path: "/database" },
  { name: "05-about", path: "/about" },
  // 個別ページは肖像あり／なしの両方を撮る（肖像なしが211名・58%で、五胡十六国・
  // 南北朝はほぼ全員がこちら。片方だけ見て決めると多数派の見た目を外す）。
  { name: "06-emperor-detail", path: "/emperors/han-wudi" },
  { name: "07-emperor-detail-noportrait", path: "/emperors/qianqin-fujian" },
  // 復位した皇帝（在位3期）。在位期間の2行化が効いている個別ページの代表。
  { name: "08-emperor-detail-restoration", path: "/emperors/qing-xuantong" },
  { name: "09-notfound", path: "/this-route-does-not-exist", expectStatus: 404 },
  // グラフ候補の検討面（noindex・ナビにもサイトマップにも出さない）。採否が決まったら
  // ページごと畳むので、そのときこの行も落とす。
  { name: "10-lab", path: "/lab" },
  // 系譜図（2026-08-19 公開・全6章）。図は 100vh に収まる作りなので fullPage でも1画面分。
  { name: "11-kinship", path: "/kinship" },
  { name: "12-kinship-three-kingdoms-jin", path: "/kinship/three-kingdoms-jin" },
  { name: "13-kinship-eastern-jin-sixteen", path: "/kinship/eastern-jin-sixteen" },
  { name: "14-kinship-northern-southern", path: "/kinship/northern-southern" },
  { name: "15-kinship-sui-tang", path: "/kinship/sui-tang" },
  { name: "16-kinship-five-dynasties", path: "/kinship/five-dynasties" },
  { name: "17-kinship-song-liao-jin-xia", path: "/kinship/song-liao-jin-xia" },
  { name: "18-kinship-yuan", path: "/kinship/yuan" },
  { name: "19-kinship-ming", path: "/kinship/ming" },
];

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
  ".webmanifest": "application/manifest+json",
};

/** `output: "export"` の out/ を配信する。/about → out/about.html の解決が要るので
 *  素の静的サーバーでは足りない（python3 -m http.server は 404 になる）。 */
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
        return send(res, 200, fs.readFileSync(candidate), MIME[path.extname(candidate)] ?? "application/octet-stream");
      }
    }
    const notFound = path.join(root, "404.html");
    if (fs.existsSync(notFound)) {
      return send(res, 404, fs.readFileSync(notFound), MIME[".html"]);
    }
    send(res, 404, "not found", MIME[".txt"]);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 画像・IntersectionObserver 待ちの要素は視界に入るまで描かれない。
 *  全高までゆっくり送ってから先頭に戻す。 */
async function primeLazyContent(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 200));
    }
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 600));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  });
}

async function openJumpPopover(page) {
  // 帯の aria-label はページによって後ろに続きがある（/emperors は絞り込みも
  // 載せているので「時代へジャンプと絞り込み」）。前方一致で拾う。
  await page.locator('nav[aria-label^="時代へジャンプ"] button').first().click();
  await page.locator('[data-slot="popover-content"], [role="dialog"]').first().waitFor({
    state: "visible",
    timeout: 10000,
  });
  await sleep(400);
}

const useOwnServer = !process.env.BASE_URL;
const BASE = process.env.BASE_URL ?? `http://localhost:${PORT}`;

if (useOwnServer && !fs.existsSync(ROOT)) {
  console.error(`out/ が無い。先に \`npm run build\` を実行するか BASE_URL を渡すこと。`);
  process.exit(1);
}

const server = useOwnServer ? await serveExport(ROOT, PORT) : null;
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const results = [];
let failed = 0;

for (const [vpName, width, height] of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    locale: "ja-JP",
  });
  const page = await ctx.newPage();
  for (const shot of SHOTS) {
    const file = `${OUT}/${shot.name}-${vpName}.png`;
    try {
      const res = await page.goto(BASE + shot.path, { waitUntil: "networkidle", timeout: 60000 });
      const status = res?.status() ?? 0;
      const expected = shot.expectStatus ?? 200;
      // 廃止したページを撮って「撮れた」と記録しないための番人。goto は 404 でも throw しない。
      if (status !== expected) throw new Error(`status ${status}（期待 ${expected}）`);
      await sleep(600);
      if (!shot.viewportOnly) await primeLazyContent(page);
      if (shot.action) await shot.action(page);
      await page.screenshot({ path: file, fullPage: !shot.viewportOnly });
      const h = await page.evaluate(() => document.body.scrollHeight);
      results.push(`${shot.name}-${vpName}\tOK\theight=${h}`);
    } catch (e) {
      failed += 1;
      results.push(`${shot.name}-${vpName}\tFAILED\t${e.message.split("\n")[0]}`);
    }
  }
  await ctx.close();
}

await browser.close();
server?.close();

console.log(results.join("\n"));
console.log(`\n${results.length - failed}/${results.length} 枚を ${OUT}/ へ出力`);
process.exit(failed > 0 ? 1 : 0);
