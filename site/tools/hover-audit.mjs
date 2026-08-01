// 「押せる部品」にマウスを乗せたときの反応（cursor・hover の見た目）を実測する。
//
//   npm run dev -- --port 3100 のあと:  node tools/hover-audit.mjs
//   ビルド済みの out/ に対して:          BASE_URL=http://localhost:4599 node tools/hover-audit.mjs
//
// 2026-08-01 に入れた。Tailwind v4 が button の cursor を default にする件で
// **70種類中46種類が「乗せても何も起きない／矢印のまま」**だったのを見つけた
// 実測がこれ。部品を足したら流し直して NG: 0 を保つこと。
// 各ページの操作要素を種類ごとに1つずつ代表として拾い、hover 前後の計算済み
// スタイルを比べる。差が無ければ「反応なし」。
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const PAGES = ["/", "/emperors", "/database", "/about", "/emperors/tang-taizong"];
const PROPS = [
  "backgroundColor",
  "color",
  "borderColor",
  "boxShadow",
  "textDecorationLine",
  "opacity",
  "outlineColor",
  "translate",
  "transform",
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const rows = [];

for (const path of PAGES) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  // 種類ごとに代表を1つ選んで印を付ける
  const count = await page.evaluate(() => {
    const SEL =
      'a[href], button, summary, [role="button"], [role="switch"], [role="radio"], [role="tab"], [role="checkbox"], [role="combobox"], label[for], input, select, [tabindex="0"]';
    const seen = new Set();
    let i = 0;
    for (const el of document.querySelectorAll(SEL)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue; // 非表示は対象外
      const sig = [
        el.tagName,
        el.getAttribute("data-slot") ?? "",
        el.getAttribute("role") ?? "",
        (el.className.baseVal ?? el.className ?? "").toString().slice(0, 90),
      ].join("|");
      if (seen.has(sig)) continue;
      seen.add(sig);
      el.setAttribute("data-audit", String(i++));
      el.setAttribute("data-audit-sig", sig);
    }
    return i;
  });

  for (let i = 0; i < count; i++) {
    const loc = page.locator(`[data-audit="${i}"]`);
    const info = await loc.evaluate((el) => {
      const cs = getComputedStyle(el);
      const label = (el.getAttribute("aria-label") || el.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 24);
      return {
        tag: el.tagName.toLowerCase(),
        slot: el.getAttribute("data-slot") ?? "",
        role: el.getAttribute("role") ?? "",
        cls: (el.className.baseVal ?? el.className ?? "").toString().slice(0, 60),
        label,
        cursor: cs.cursor,
      };
    });
    let before;
    try {
      // 画面の中央へ寄せてから乗せる（固定ヘッダー・固定バー・dev インジケータの
      // 下に入っていると、force で座標へ動かしても :hover は上の要素が持っていく）。
      await loc.evaluate((el) => el.scrollIntoView({ block: "center" }));
      // **hover 前の値はスクロール後に読む** — 先に読むと、スクロールで要素が
      // 停めていたマウスの下へ来た場合に「hover 済みの値」を基準にしてしまう。
      await page.mouse.move(2, 2);
      await page.waitForTimeout(80);
      if (await loc.evaluate((el) => el.matches(":hover"))) {
        await page.mouse.move(1438, 2);
        await page.waitForTimeout(80);
      }
      before = await loc.evaluate((el, props) => {
        const cs = getComputedStyle(el);
        return props.map((p) => cs[p]);
      }, PROPS);
      await loc.hover({ timeout: 2000, force: true });
    } catch {
      rows.push({ path, ...info, hover: "hover不可" });
      continue;
    }
    await page.waitForTimeout(220);
    // 実際に :hover が乗ったか。乗っていない計測は捨てる（偽陽性になる）。
    const hovered = await loc.evaluate((el) => el.matches(":hover"));
    if (!hovered) {
      rows.push({ path, ...info, hover: "未計測(重なり)" });
      await page.mouse.move(0, 0);
      continue;
    }
    const after = await loc.evaluate((el, props) => {
      const cs = getComputedStyle(el);
      return props.map((p) => cs[p]);
    }, PROPS);
    // 子孫が変わる作り（group-hover）も拾う
    const childChanged = await loc.evaluate((el) => el.dataset.auditChild === "1");
    const changed = PROPS.filter((p, k) => before[k] !== after[k]);
    rows.push({
      path,
      ...info,
      hover: changed.length ? changed.join(",") : childChanged ? "子孫のみ" : "なし",
      raw: changed.length ? "" : `${before.join("|").slice(0, 90)} → ${after.join("|").slice(0, 90)}`,
    });
    await page.mouse.move(0, 0);
  }
}

// 容器（タブ帯・パネル・ラジオグループ）と入力欄そのものは判定から外す。
const CONTAINER_ROLES = new Set(["tablist", "tabpanel", "radiogroup", "group"]);
const bad = rows.filter((r) => {
  if (CONTAINER_ROLES.has(r.role)) return false;
  if (r.tag === "input") return false;
  return r.cursor !== "pointer" || r.hover === "なし";
});
console.log("== 全", rows.length, "種類 ==");
for (const r of rows) {
  const flag = bad.includes(r) ? "NG" : "ok";
  console.log(
    `${flag}\t${r.raw ? "["+r.raw+"] " : ""}${r.path}\t${r.tag}${r.slot ? "/" + r.slot : ""}${r.role ? "[" + r.role + "]" : ""}\tcursor=${r.cursor}\thover=${r.hover}\t${r.label}`,
  );
}
console.log("\nNG:", bad.length, "/", rows.length);
await browser.close();
