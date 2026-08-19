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
// **撮ったものは毎回まっさらな1フォルダに入れ直す。** 前の版の画像が混ざったまま外へ
// 渡してしまった事故があるため（2026-08-18）。中は用途ごとの小分けにして、順番に見れば
// いいだけの名前にする。
const OUT = process.env.SHOT_DIR ?? "tools/shots/kinship";
const DIR = {
  full: `${OUT}/1-全体`,
  tiles: `${OUT}/2-通し（上から順）`,
  close: `${OUT}/3-寄り`,
  screen: `${OUT}/4-ブラウザ画面`,
};
const PORT = Number(process.env.PORT ?? 4601);
// 撮る章。KINSHIP_PATH=/kinship/three-kingdoms-jin のように章の URL を渡す。
const PAGE_PATH = process.env.KINSHIP_PATH ?? "/kinship";

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
fs.rmSync(OUT, { recursive: true, force: true });
for (const d of Object.values(DIR)) fs.mkdirSync(d, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  locale: "ja-JP",
});
const page = await ctx.newPage();
await page.goto(`http://localhost:${PORT}${PAGE_PATH}`, { waitUntil: "networkidle" });
await sleep(2500);

await page.screenshot({ path: `${DIR.screen}/1-初期表示（開いた直後）.png` });

// 拡大して字が読める状態（React Flow はホイールでズームする）
await page.mouse.move(900, 500);
for (let i = 0; i < 14; i += 1) {
  await page.mouse.wheel(0, -240);
  await sleep(80);
}
await sleep(900);
await page.screenshot({ path: `${DIR.screen}/2-拡大したところ.png` });

// 政権ジャンプ（A の上端ナビに当たる操作）が効いているか
await page.goto(`http://localhost:${PORT}${PAGE_PATH}`, { waitUntil: "networkidle" });
await sleep(2000);
const jump = page.locator('nav[aria-label="政権へジャンプ"] button', { hasText: "後漢" }).first();
if (await jump.count()) {
  await jump.click();
  await sleep(1400);
  await page.screenshot({ path: `${DIR.screen}/3-「後漢」へ移動したところ.png` });
}

// 人物検索（2026-08-18 の外部レビュー「6,000px の図に探す手段が無い」への答え）が
// 効いているか。**候補が出ているところと、選んで着地したところの2枚**を撮る。
{
  await page.goto(`http://localhost:${PORT}${PAGE_PATH}`, { waitUntil: "networkidle" });
  await sleep(2000);
  const box = page.getByLabel("人物を名前で探す");
  await box.fill("光武");
  await sleep(600);
  await page.screenshot({ path: `${DIR.screen}/4-名前で探しているところ.png` });
  const hit = page.locator("li button", { hasText: "光武帝" }).first();
  if (await hit.count()) {
    await hit.click();
    await sleep(1400);
    await page.screenshot({ path: `${DIR.screen}/5-探して着地したところ.png` });
  } else {
    console.log("  (検索の候補に光武帝が出なかった)");
  }
}

// 指摘の出た場所を等倍で撮る。
//
// **図を動かすときは `window.__kinshipSetViewport`（chapter-flow.tsx が出している口）を
// 通す。** `.react-flow__viewport` の CSS transform を直に書き換えると React Flow の
// store が更新されず、store を読んでいる部品（時代の帯・左端の年）だけが動かない写真に
// なる。2026-08-18 に実際にそれを撮って「帯の年がでたらめ」と読み違えた。
const SPOTS = [
  ["qin-shi-huang", "01-秦（異説の結び目）"],
  ["han-gaozu", "02-高帝と2人の后"],
  ["han-huidi", "03-恵帝と2人の子"],
  ["han-wudi", "04-武帝"],
  ["han-xuandi", "05-宣帝"],
  ["han-yuandi", "06-元帝"],
  ["p-ruzi-ying", "07-禅譲（劉嬰→王莽）", 1.6],
  ["hou-han-guangwudi", "08-光武帝"],
  ["hou-han-zhangdi", "09-章帝"],
  ["p-liu-qing", "10-章帝の子4人（櫛）", 1.8],
  // 過去に指摘の出た現場（王政君・劉囂・竇氏・廃帝・劉利）
  ["p-wang-zhengjun", "11-王政君", 2.2],
  ["p-liu-xiao", "12-劉囂", 2.2],
  ["p-doushi-han-wendi", "13-竇氏", 2.2],
  ["han-liuhe", "14-廃帝（昌邑王）", 2.2],
  ["p-liu-li", "15-劉利", 2.2],
];
for (const [id, name, zoom] of SPOTS) {
  await page.goto(`http://localhost:${PORT}${PAGE_PATH}`, { waitUntil: "networkidle" });
  await sleep(1800);
  const ok = await page.evaluate(({ nodeId, scale }) => {
    const el = document.querySelector(`.react-flow__node[data-id="${nodeId}"]`);
    const pane = document.querySelector(".react-flow");
    const set = window.__kinshipSetViewport;
    if (!el || !pane || !set) return false;
    const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(el.style.transform);
    if (!m) return false;
    const r = pane.getBoundingClientRect();
    set({
      x: r.width / 2 - (Number(m[1]) + el.offsetWidth / 2) * scale,
      y: r.height / 2 - (Number(m[2]) + el.offsetHeight / 2) * scale,
      zoom: scale,
    });
    return true;
  }, { nodeId: id, scale: zoom ?? 1.4 });
  if (!ok) {
    console.log(`  (${id} が見つからず撮れなかった)`);
    continue;
  }
  await sleep(500);
  await page.screenshot({ path: `${DIR.close}/${name}.png` });
}

// **カードの中で字が切り詰められていないか数える。** 「名前が途中で切れている」は
// 2026-08-18 の外部レビューで出た指摘で、既存の6項目（カード貫通・交差…）では
// 1件も拾えない。目で全カードを見るのは無理なので機械で見る。
{
  const probe = await ctx.newPage();
  await probe.goto(`http://localhost:${PORT}${PAGE_PATH}`, { waitUntil: "networkidle" });
  await sleep(1800);
  const over = await probe.evaluate(() => {
    const bad = [];
    for (const n of document.querySelectorAll(".react-flow__node-person")) {
      for (const d of n.querySelectorAll("div.truncate")) {
        if (d.scrollWidth > d.clientWidth + 1) bad.push(`${d.textContent}(${d.scrollWidth}>${d.clientWidth})`);
      }
    }
    return bad;
  });
  console.log(
    `  カードで切り詰められている字: ${over.length}件` +
      (over.length ? ` — ${over.slice(0, 8).join(" / ")}` : "（ゼロ）"),
  );
  await probe.close();
}

// **図の全面をタイルに割って撮る。** 寄って撮った数枚では見落とす（2026-08-18 に
// 「軽く指摘しただけでこれだけ出てきた」と差し戻された）。上から順に全部見る。
{
  const tile = await ctx.newPage();
  await tile.setViewportSize({ width: 1500, height: 1200 });
  await tile.goto(`http://localhost:${PORT}${PAGE_PATH}`, { waitUntil: "networkidle" });
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
        window.__kinshipSetViewport({ x: 20, y: 20 - idx * (ph - 40), zoom: sc });
      },
      { scale, i, ph: info.ph },
    );
    await sleep(400);
    await tile.screenshot({ path: `${DIR.tiles}/${String(i + 1).padStart(2, "0")}（全${rows}枚）.png` });
  }
  console.log(`タイル: ${rows}枚（倍率 ${scale.toFixed(2)} / 図 ${Math.round(info.w)}×${Math.round(info.h)}）`);
  await tile.close();
}

// **図の全体を1枚に。** 外部レビューへ渡すときはタイルより1枚のほうが見てもらいやすい。
{
  const full = await ctx.newPage();
  await full.goto(`http://localhost:${PORT}${PAGE_PATH}`, { waitUntil: "networkidle" });
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
    window.__kinshipSetViewport({ x: pad, y: pad, zoom: 1 });
  }, PAD);
  await sleep(600);
  const pane = await full.locator(".react-flow").boundingBox();
  await full.screenshot({
    path: `${DIR.full}/図の全体.png`,
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
for (const f of ["1-初期表示（開いた直後）.png", "2-拡大したところ.png"]) {
  const { data, info } = await sharp(`${DIR.screen}/${f}`)
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
fs.writeFileSync(
  `${OUT}/00-この中身.txt`,
  [
    `系譜図（${PAGE_PATH}）のスクリーンショット`,
    `撮り直すたびにこのフォルダごと作り直す（前の版が混ざらないように）。`,
    ``,
    `1-全体/          図の全体を等倍で1枚に。通しの構造を見る用`,
    `2-通し（上から順）/ 図を上から順に等倍で割ったもの。文字と線の細部が読める`,
    `3-寄り/           個別の場所。ファイル名が場所`,
    `4-ブラウザ画面/    実際にブラウザで開いたときの見え方（移動・検索の操作も含む）`,
    ``,
    `凡例・読み方は画面上部に出ている。`,
  ].join("\n"),
  "utf8",
);
console.log("canvas:", stat);
console.log(`保存先: ${OUT}`);
