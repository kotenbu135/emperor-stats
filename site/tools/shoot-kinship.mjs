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

// 指摘の出た場所を等倍で撮る。React Flow の viewport の transform を直に書き換えて
// 目的の人物を画面中央に置く（撮るためだけの操作なので、この後は再読み込みする）。
const SPOTS = [
  ["han-huidi", "05-huidi"],
  ["han-wudi", "06-wudi"],
  ["han-yuandi", "07-yuandi"],
  ["qin-shi-huang", "08-qin"],
  ["hou-han-zhangdi", "09-zhangdi"],
  // build-kinship-layout.mjs の「カードを横切る線」が名指しした出どころ（測ったら見る）
  ["p-fanshi-liu-qin", "10-cross-fan"],
  ["p-liu-qing", "11-cross-liuqing"],
  ["han-xuandi", "12-cross-xuandi"],
  // **指摘のスクリーンショットと同じ寄り**（2.8倍）。同じ枠で撮らないと比べられない。
  ["p-liu-qing", "13-zhangdi-x28", 1.8],
  ["p-ruzi-ying", "14-shanrang", 2.0],
  ["hou-han-guangwudi", "15-guangwu"],
  // 2026-08-18 の指摘6件の現場（王政君・劉囂・竇氏・廃帝・劉利・劉嬰）
  ["p-wang-zhengjun", "16-wangzhengjun", 2.2],
  ["p-liu-xiao", "17-liuxiao", 2.2],
  ["p-doushi-han-wendi", "18-doushi", 2.2],
  ["han-liuhe", "19-feidi", 2.2],
  ["p-liu-li", "20-liuli", 2.2],
  ["p-ruzi-ying", "21-ruziying", 1.6],
];
for (const [id, name, zoom] of SPOTS) {
  await page.goto(`http://localhost:${PORT}/kinship`, { waitUntil: "networkidle" });
  await sleep(1800);
  const ok = await page.evaluate(({ nodeId, scale }) => {
    const el = document.querySelector(`.react-flow__node[data-id="${nodeId}"]`);
    const vp = document.querySelector(".react-flow__viewport");
    const pane = document.querySelector(".react-flow");
    if (!el || !vp || !pane) return false;
    const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(el.style.transform);
    if (!m) return false;
    const r = pane.getBoundingClientRect();
    vp.style.transform = `translate(${r.width / 2 - (Number(m[1]) + el.offsetWidth / 2) * scale}px, ${r.height / 2 - (Number(m[2]) + el.offsetHeight / 2) * scale}px) scale(${scale})`;
    return true;
  }, { nodeId: id, scale: zoom ?? 1.4 });
  if (!ok) {
    console.log(`  (${id} が見つからず撮れなかった)`);
    continue;
  }
  await sleep(500);
  await page.screenshot({ path: `${OUT}/kinship-${name}.png` });
}

// **図の全面をタイルに割って撮る。** 寄って撮った数枚では見落とす（2026-08-18 に
// 「軽く指摘しただけでこれだけ出てきた」と差し戻された）。上から順に全部見る。
{
  const tile = await ctx.newPage();
  await tile.setViewportSize({ width: 1500, height: 1200 });
  await tile.goto(`http://localhost:${PORT}/kinship`, { waitUntil: "networkidle" });
  await sleep(2200);
  const info = await tile.evaluate(() => {
    const pane = document.querySelector(".react-flow");
    const nodes = [...document.querySelectorAll(".react-flow__node")];
    let w = 0;
    let h = 0;
    for (const n of nodes) {
      const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(n.style.transform);
      if (!m) continue;
      w = Math.max(w, Number(m[1]) + n.offsetWidth);
      h = Math.max(h, Number(m[2]) + n.offsetHeight);
    }
    const r = pane.getBoundingClientRect();
    return { w, h, pw: r.width, ph: r.height };
  });
  const scale = Math.min(1, (info.pw - 40) / info.w);
  const rows = Math.ceil((info.h * scale) / (info.ph - 40));
  for (let i = 0; i < rows; i += 1) {
    await tile.evaluate(
      ({ scale: sc, i: idx, ph }) => {
        const vp = document.querySelector(".react-flow__viewport");
        vp.style.transform = `translate(20px, ${20 - idx * (ph - 40)}px) scale(${sc})`;
      },
      { scale, i, ph: info.ph },
    );
    await sleep(400);
    await tile.screenshot({ path: `${OUT}/kinship-tile-${String(i + 1).padStart(2, "0")}.png` });
  }
  console.log(`タイル: ${rows}枚（倍率 ${scale.toFixed(2)} / 図 ${Math.round(info.w)}×${Math.round(info.h)}）`);
  await tile.close();
}

// **図の全体を1枚に。** 外部レビューへ渡すときはタイルより1枚のほうが見てもらいやすい。
{
  const full = await ctx.newPage();
  await full.goto(`http://localhost:${PORT}/kinship`, { waitUntil: "networkidle" });
  await sleep(1500);
  const size = await full.evaluate(() => {
    let w = 0;
    let h = 0;
    for (const n of document.querySelectorAll(".react-flow__node")) {
      const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(n.style.transform);
      if (!m) continue;
      w = Math.max(w, Number(m[1]) + n.offsetWidth);
      h = Math.max(h, Number(m[2]) + n.offsetHeight);
    }
    return { w: Math.ceil(w), h: Math.ceil(h) };
  });
  const PAD = 24;
  await full.setViewportSize({
    width: Math.min(4000, size.w + 300 + PAD * 2),
    height: Math.min(12000, size.h + 320 + PAD * 2),
  });
  await sleep(1200);
  await full.evaluate((pad) => {
    const vp = document.querySelector(".react-flow__viewport");
    vp.style.transform = `translate(${pad}px, ${pad}px) scale(1)`;
  }, PAD);
  await sleep(600);
  const pane = await full.locator(".react-flow").boundingBox();
  await full.screenshot({
    path: `${OUT}/kinship-full.png`,
    clip: { x: pane.x, y: pane.y, width: Math.min(pane.width, size.w + PAD * 2), height: Math.min(pane.height, size.h + PAD * 2) },
  });
  console.log(`全体1枚: ${size.w + PAD * 2}×${size.h + PAD * 2}px`);
  await full.close();
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
