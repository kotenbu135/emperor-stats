// 2-1（サイドバー空 h3 の解消）の副作用検証。
// AccordionPrimitive.Header を asChild で div にした変更が、開閉・キーボード・
// 見た目を壊していないかを実機で確認する。読み取り専用（サイトは変更しない）。
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:4173";
const SHOTS = "/home/sakis/emperor-stats/site/design-plans/tools/seo-phase2-shots";
fs.mkdirSync(SHOTS, { recursive: true });

const log = [];
const say = (...a) => { const s = a.join(" "); log.push(s); console.log(s); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);

const nav = page.locator("nav").first();
const triggers = nav.locator('button[data-slot="accordion-trigger"]');
say("trigger count:", await triggers.count());

// 対象は「在位データ」カテゴリ（トップページでは閉じている想定）
const t = nav.locator('button[aria-label="在位データの項目を開閉"]');
const item = page.locator('[data-slot="accordion-item"]').filter({ has: t });
const content = item.locator('[data-slot="accordion-content"]');

const snap = async (label) => {
  const s = {
    label,
    ariaExpanded: await t.getAttribute("aria-expanded"),
    dataState: await t.getAttribute("data-state"),
    ariaControls: await t.getAttribute("aria-controls"),
    id: await t.getAttribute("id"),
    contentCount: await content.count(),
    contentVisible: (await content.count()) ? await content.first().isVisible() : false,
    subLinks: await item.locator('[data-slot="accordion-content"] a').count(),
    // ヘッダーラッパーが div か h3 か
    wrapperTag: await t.evaluate((el) => el.parentElement.tagName),
    wrapperAttrs: await t.evaluate((el) =>
      Object.fromEntries([...el.parentElement.attributes].map((a) => [a.name, a.value]))),
    chevronDownVisible: await t.locator("svg.lucide-chevron-down").isVisible(),
    chevronUpVisible: await t.locator("svg.lucide-chevron-up").isVisible(),
    box: await t.boundingBox(),
  };
  say(label, JSON.stringify(s));
  return s;
};

const initial = await snap("[1] 初期");
await page.screenshot({ path: `${SHOTS}/nav-01-initial.png`, clip: { x: 0, y: 0, width: 340, height: 620 } });

// --- クリックで開く ---
await t.click();
await page.waitForTimeout(500);
const opened = await snap("[2] クリック後（開く想定）");
await page.screenshot({ path: `${SHOTS}/nav-02-open.png`, clip: { x: 0, y: 0, width: 340, height: 700 } });

// --- もう一度クリックで閉じる ---
await t.click();
await page.waitForTimeout(500);
const closed = await snap("[3] 再クリック後（閉じる想定）");
await page.screenshot({ path: `${SHOTS}/nav-03-closed.png`, clip: { x: 0, y: 0, width: 340, height: 620 } });

// --- キーボード: Tab でトリガーに到達できるか ---
await page.evaluate(() => document.activeElement?.blur());
await page.locator("body").click({ position: { x: 700, y: 400 } });
await page.evaluate(() => window.scrollTo(0, 0));
// ドキュメント先頭から Tab を送り、フォーカス到達順を記録
await page.evaluate(() => document.body.setAttribute("tabindex", "-1"));
await page.evaluate(() => document.body.focus());
const seq = [];
let reached = -1;
for (let i = 0; i < 40; i++) {
  await page.keyboard.press("Tab");
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el?.tagName, label: el?.getAttribute("aria-label") || (el?.textContent || "").trim().slice(0, 16), slot: el?.getAttribute("data-slot") };
  });
  seq.push(`${i}:${info.tag}/${info.slot ?? "-"}/${info.label}`);
  if (info.label === "在位データの項目を開閉") { reached = i; break; }
}
say("[4] Tab 到達 index:", reached, "| 順路:", seq.join(" > "));

// --- Enter で開閉 ---
let kb = {};
if (reached >= 0) {
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  kb.afterEnter = await snap("[5] Enter 後");
  await page.screenshot({ path: `${SHOTS}/nav-04-keyboard-enter-open.png`, clip: { x: 0, y: 0, width: 340, height: 700 } });
  // フォーカスがトリガーに残っているか（asChild 化でアンマウントされないことの確認）
  kb.focusStaysAfterEnter = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  say("[5b] Enter 後のフォーカス:", kb.focusStaysAfterEnter);

  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  kb.afterEnter2 = await snap("[6] Enter 再押下後");

  // Space
  await page.keyboard.press(" ");
  await page.waitForTimeout(400);
  kb.afterSpace = await snap("[7] Space 後");
  await page.keyboard.press(" ");
  await page.waitForTimeout(400);
  kb.afterSpace2 = await snap("[8] Space 再押下後");

  // ArrowDown（Radix Accordion のトリガー間移動）
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(200);
  kb.afterArrowDown = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  say("[9] ArrowDown 後のフォーカス:", kb.afterArrowDown);
}

// --- focus-visible リング（見た目回帰） ---
await page.screenshot({ path: `${SHOTS}/nav-05-focus-ring.png`, clip: { x: 0, y: 0, width: 340, height: 620 } });

// --- 全カテゴリの開閉が効くか一括確認 ---
const results = [];
const n = await triggers.count();
for (let i = 0; i < n; i++) {
  const b = triggers.nth(i);
  const label = await b.getAttribute("aria-label");
  const before = await b.getAttribute("aria-expanded");
  await b.click();
  await page.waitForTimeout(320);
  const after = await b.getAttribute("aria-expanded");
  await b.click();
  await page.waitForTimeout(320);
  const back = await b.getAttribute("aria-expanded");
  results.push({ label, before, after, back, ok: before !== after && back === before });
}
say("[10] 全トリガー開閉:", JSON.stringify(results));

// --- 見出し構造（空 h3 が消えているか / 他の h3 が壊れていないか） ---
const headings = await page.evaluate(() =>
  [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => `${h.tagName}:${(h.textContent || "").trim().slice(0, 24) || "(空)"}`));
say("[11] 見出し一覧:", JSON.stringify(headings));

// --- モバイル（Sheet 内ナビ）でも同じか ---
const mob = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
await mob.goto(`${BASE}/`, { waitUntil: "networkidle" });
await mob.waitForTimeout(400);
let mobileResult = "未検証";
try {
  const menuBtn = mob.locator("button").filter({ hasText: /メニュー|Menu/ }).first();
  if (await menuBtn.count()) await menuBtn.click();
  else await mob.locator("header button").first().click();
  await mob.waitForTimeout(600);
  const mt = mob.locator('button[aria-label="在位データの項目を開閉"]').last();
  const b1 = await mt.getAttribute("aria-expanded");
  await mt.click();
  await mob.waitForTimeout(400);
  const b2 = await mt.getAttribute("aria-expanded");
  await mob.screenshot({ path: `${SHOTS}/nav-mobile-open.png` });
  await mt.click();
  await mob.waitForTimeout(400);
  const b3 = await mt.getAttribute("aria-expanded");
  mobileResult = JSON.stringify({ b1, b2, b3, ok: b1 !== b2 && b3 === b1 });
} catch (e) {
  mobileResult = "失敗: " + e.message;
}
say("[12] モバイル Sheet 内:", mobileResult);

fs.writeFileSync(`${SHOTS}/accordion-check.log`, log.join("\n") + "\n");
await browser.close();
console.log("\n=== done ===");
