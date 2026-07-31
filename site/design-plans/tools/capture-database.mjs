// データベースページ（/database）を確認用に撮る。
//   npx serve out -l 4599 && BASE_URL=http://localhost:4599 node design-plans/tools/capture-database.mjs
// 既定は dev サーバー（3100）。
//
// playwright は site の依存に入れていない（ビルドに要らないため）。入っていない環境では
// npx キャッシュのものを node_modules へ symlink して使う:
//   ln -sfn ~/.npm/_npx/<hash>/node_modules/playwright{,-core} node_modules/
// ブラウザ本体（~/.cache/ms-playwright）と版が合っていないと launch で落ちるので、
// `~/.cache/ms-playwright` にある chromium-<rev> と対応する版を選ぶこと。
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = process.env.SHOT_DIR ?? "./design-plans/tools/rebuild-shots";
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();

// デスクトップ: 初見の1枚・並べ替え・列の表示切替。
const page = await browser.newPage({
  viewport: { width: 1440, height: 1024 },
  deviceScaleFactor: 2,
});
await page.goto(`${BASE}/database`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await sleep(800);
await page.screenshot({ path: `${OUT}/database-firstframe.png` });

// 在位年数で降順（＝旧 /reign の在位年数ランキングに当たる並び）。
// 数値列は1回目のクリックが降順（TanStack の sortDescFirst 既定）。
await page.getByRole("button", { name: "在位年数" }).click();
await sleep(400);
await page.screenshot({ path: `${OUT}/database-sorted-reign.png` });

// 復位した皇帝だけ（＝旧 /reign の復位者一覧）。
await page.getByLabel("在位回数で絞り込み").click();
await page.getByRole("option", { name: "復位した皇帝だけ" }).click();
await sleep(400);
await page.screenshot({ path: `${OUT}/database-restoration.png` });

// 絞り込みを戻す。
await page.getByLabel("在位回数で絞り込み").click();
await page.getByRole("option", { name: "すべて" }).click();
await sleep(300);

// 年齢列の並べ替え。null を undefined へ落として sortUndefined:"last" に委ねているので、
// **昇順でも降順でも「—」は末尾**でなければならない（ここが崩れると 0 歳扱いで先頭に来る）。
const tailOf = () =>
  page.evaluate(() => {
    const rows = [...document.querySelectorAll("tbody tr")];
    const cellAt = (tr, i) => tr.children[i]?.textContent?.trim();
    return {
      // 即位年齢は7列目（0起点で6）。列を増減したらここを直す。
      head: rows.slice(0, 3).map((tr) => cellAt(tr, 6)),
      tail: rows.slice(-3).map((tr) => cellAt(tr, 6)),
    };
  });
await page.getByRole("button", { name: "即位年齢" }).click();
await sleep(300);
console.log("即位年齢 1回目:", JSON.stringify(await tailOf()));
await page.getByRole("button", { name: "即位年齢" }).click();
await sleep(300);
console.log("即位年齢 2回目:", JSON.stringify(await tailOf()));

// 見出しの固定。**表が枠に収まっている幅（1440px）でだけ**ページのスクロールに
// 対して貼り付く。枠を横スクロールさせる幅では枠がスクロールコンテナになり、
// sticky の基準が枠の中の縦スクロール（存在しない）へ移って効かなくなるため、
// そちらは固定しない設計にしてある。ここが崩れると 365 行を見出し無しで読むことになる。
await page.evaluate(() => window.scrollTo(0, 3000));
await sleep(400);
const stuck = await page.evaluate(() => {
  const th = document.querySelector("thead th");
  const chrome = getComputedStyle(document.documentElement)
    .getPropertyValue("--chrome-top")
    .trim();
  return { thTop: Math.round(th.getBoundingClientRect().top), chrome };
});
console.log("見出しの固定(1440px・収まる幅):", JSON.stringify(stuck)); // thTop は 0
await page.screenshot({ path: `${OUT}/database-sticky-header.png` });
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(300);

// 横スクロールした状態。このページが持ち込む状態なので必ず1枚残す。
// 8列の自然幅は約858pxで 1200px 以上なら収まってしまうため、窓を狭めてから撮る。
await page.setViewportSize({ width: 1100, height: 1024 });
await sleep(400);
await page.evaluate(() => {
  const el = document.querySelector("table").parentElement;
  el.scrollLeft = el.scrollWidth;
});
await sleep(300);
await page.screenshot({ path: `${OUT}/database-scrolled-right.png` });

// 列の表示切替（Popover + ボタンの自作トグル）。
await page.getByLabel("表示する列を選ぶ").click();
await sleep(300);
await page.screenshot({ path: `${OUT}/database-columns-popover.png` });
await page.keyboard.press("Escape");
await sleep(200);

// 列を隠して表が枠に収まったとき、フェードと「続き →」が消えること
// （ResizeObserver は枠の箱しか見ないので、明示的に実測し直している箇所の確認）。
// ここは窓が1100pxのまま（＝横スクロールが出ている状態）で隠す。
// 列名は見出しの並べ替えボタンとも一致するので、ポップオーバーの中に限定する。
await page.getByLabel("表示する列を選ぶ").click();
await sleep(300);
const popover = page.locator('[data-slot="popover-content"]');
for (const name of ["在位期間", "即位経路", "死因"]) {
  await popover.getByRole("button", { name, exact: true }).click();
  await sleep(150);
}
await page.keyboard.press("Escape");
await sleep(400);
const fits = await page.evaluate(() => {
  const el = document.querySelector("table").parentElement;
  return {
    scrollW: el.scrollWidth,
    clientW: el.clientWidth,
    hintShown: !!document.body.textContent.includes("横スクロールで続き"),
  };
});
console.log("列を3つ隠した後:", JSON.stringify(fits));
// 収まったら枠は overflow-x:clip に戻り、見出しの固定が復活する（1100px でも）。
await page.evaluate(() => window.scrollTo(0, 3000));
await sleep(400);
console.log(
  "列を隠して収まったあとの見出しの固定:",
  JSON.stringify(
    await page.evaluate(() => ({
      overflowX: getComputedStyle(document.querySelector("table").parentElement)
        .overflowX,
      thTop: Math.round(
        document.querySelector("thead th").getBoundingClientRect().top,
      ),
    })),
  ),
);
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(300);
await page.screenshot({ path: `${OUT}/database-columns-hidden.png` });

// ページ本体が横スクロールしていないこと（表の中だけで収める契約）。
const overflow = await page.evaluate(() => ({
  doc: document.documentElement.scrollWidth,
  win: window.innerWidth,
}));
console.log("desktop(1100px) horizontal overflow:", overflow);

await page.close();

// モバイル: 横スクロールが表の中だけに閉じているか。
const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
await mobile.goto(`${BASE}/database`, { waitUntil: "networkidle" });
await mobile.evaluate(() => document.fonts.ready);
await sleep(800);
await mobile.screenshot({ path: `${OUT}/database-mobile.png` });
const mobileOverflow = await mobile.evaluate(() => ({
  doc: document.documentElement.scrollWidth,
  win: window.innerWidth,
}));
console.log("mobile horizontal overflow:", mobileOverflow);

await browser.close();
console.log(`saved to ${OUT}`);
