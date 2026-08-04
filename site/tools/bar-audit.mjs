// /emperors の固定バー（時代へジャンプ＋絞り込み）が契約を守っているか実測する。
//
//   cd site && npm run build && node tools/bar-audit.mjs
//   BASE_URL=http://localhost:3100 node tools/bar-audit.mjs   # dev サーバーに当てる
//
// 見ているのは3つ。**どれも tsc・lint・build では落ちない。**
//
//  1. 帯の高さが常に 48px（SECTION_NAV_H）であること。この値は節見出しの sticky top と
//     節の scrollMarginTop を兼ねているので、中身が折り返して2行になると15個の見出しと
//     全ジャンプ先が黙ってずれる
//  2. 帯の中身が横に溢れていないこと（1行に収まる形で畳めているか）
//  3. 0件のときも帯が残り、絞り込みを外せること（節が0個になっても消えない）
//
// 幅の分岐は帯の内幅（container query）で決まるので、ビューポート幅は md 以上で
// サイドバー240pxが挟まる点に注意（768px の画面でも内幅は438pxしかない）。
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
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

/** capture-site.mjs と同じ理由の静的配信（out/ は /emperors → emperors.html）。 */
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
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NAV = 'nav[aria-label^="時代へジャンプ"]';
const BAR_H = 48;
const WIDTHS = [360, 390, 640, 768, 900, 1024, 1280, 1440, 1920];

const useOwnServer = !process.env.BASE_URL;
const BASE = process.env.BASE_URL ?? `http://localhost:${PORT}`;
if (useOwnServer && !fs.existsSync(ROOT)) {
  console.error("out/ が無い。先に `npm run build` を実行するか BASE_URL を渡すこと。");
  process.exit(1);
}
const server = useOwnServer ? await serveExport(ROOT, PORT) : null;
const browser = await chromium.launch();
let ng = 0;

// 絞り込みが効いている状態は帯の右側がいちばん太る（件数が「42/365名」になり、
// 「絞り込み」ボタンに件数の印が付く）。太った分は縮む側＝ジャンプのトリガーが
// 全部かぶるので、**溢れないことだけでは足りない**（時代名が1〜2文字に潰れる）。
// 素の状態と絞り込み後の両方を、同じ幅で測る。
const CASES = [
  ["素", ""],
  ["絞込", `?q=${encodeURIComponent("武")}&dynasty=tang`],
];
/** ジャンプのトリガーがこれを下回ったら時代名が読めない（chevron と padding で36px使う）。 */
const MIN_TRIGGER_W = 90;

for (const [caseName, qs] of CASES)
for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: "ja-JP" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/emperors${qs}`, { waitUntil: "networkidle" });
  await sleep(400);
  const m = await page.evaluate((sel) => {
    const nav = document.querySelector(sel);
    if (!nav) return null;
    const inner = nav.querySelector(":scope > div");
    const row = inner.querySelector(":scope > div");
    const shown = (q) => {
      const el = nav.querySelector(q);
      return !!el && el.getBoundingClientRect().width > 0;
    };
    const trigger = nav.querySelector('[data-slot="popover-trigger"]');
    return {
      height: nav.getBoundingClientRect().height,
      innerWidth: Math.round(inner.getBoundingClientRect().width),
      scrollWidth: row.scrollWidth,
      clientWidth: row.clientWidth,
      triggerWidth: Math.round(trigger?.getBoundingClientRect().width ?? 0),
      search: shown('input[aria-label="皇帝を検索"]'),
      dynasty: shown('[aria-label="王朝で絞り込み"]'),
      category: shown('[aria-label="王朝の区分で絞り込み"]'),
    };
  }, NAV);
  await ctx.close();
  if (!m) {
    console.log(`${caseName}\t${String(width).padStart(4)}px  帯が無い  ← NG`);
    ng++;
    continue;
  }
  const overflow = m.scrollWidth > m.clientWidth + 1;
  const narrowTrigger = m.triggerWidth < MIN_TRIGGER_W;
  const bad = m.height !== BAR_H || overflow || narrowTrigger;
  if (bad) ng++;
  console.log(
    `${caseName}\t${String(width).padStart(4)}px  内幅${String(m.innerWidth).padStart(4)}  高さ${m.height}` +
      `  溢れ${overflow ? `YES(${m.scrollWidth}>${m.clientWidth})` : "no"}` +
      `  ジャンプ幅${String(m.triggerWidth).padStart(3)}${narrowTrigger ? "!" : " "}` +
      `  [検索${m.search ? "○" : "-"} 王朝${m.dynasty ? "○" : "-"} 区分${m.category ? "○" : "-"}]` +
      `${bad ? "  ← NG" : ""}`,
  );
}

// 0件でも帯と絞り込みが残ること。
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ja-JP" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/emperors?q=${encodeURIComponent("存在しない名前")}`, {
    waitUntil: "networkidle",
  });
  await sleep(600);
  const r = await page.evaluate((sel) => {
    const nav = document.querySelector(sel);
    return {
      nav: !!nav,
      height: nav?.getBoundingClientRect().height,
      query: nav?.querySelector('input[aria-label="皇帝を検索"]')?.value,
      noResults: document.body.textContent.includes("条件に一致する皇帝がいません"),
    };
  }, NAV);
  await ctx.close();
  const bad = !r.nav || r.height !== BAR_H || !r.noResults || errors.length > 0;
  if (bad) ng++;
  console.log(
    `0件      帯${r.nav ? "有" : "無"} 高さ${r.height} 検索欄「${r.query}」` +
      ` 0件表示${r.noResults ? "有" : "無"} JSエラー${errors.length}${bad ? "  ← NG" : ""}`,
  );
}

console.log(`\nNG: ${ng}`);
await browser.close();
server?.close();
process.exitCode = ng === 0 ? 0 : 1;
