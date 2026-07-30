// design-plans/05 の Stop condition 検証:
// 補助文を 10px→11px にしてツールチップが画面端で切れないか（狭い画面が最悪ケース）。
import { chromium } from "playwright";
const BASE = process.env.BASE_URL ?? "http://localhost:4599";
const browser = await chromium.launch();

const readTip = () => {
  const outer = document.querySelector("div.pointer-events-none.fixed.left-0.top-0.z-50");
  const inner = outer?.firstElementChild;
  if (!inner) return null;
  const r = inner.getBoundingClientRect();
  if (r.width < 20) return null;
  const micro = [...inner.querySelectorAll("*")]
    .filter((e) => getComputedStyle(e).fontSize === "11px" && !e.children.length)
    .map((e) => e.textContent.trim());
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height, micro };
};

for (const [route, w, h] of [["/reign", 375, 812], ["/reign", 1440, 900], ["/timeline", 375, 812], ["/timeline", 1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: "ja-JP" });
  const page = await ctx.newPage();
  await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight * 0.8) {
      window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 200));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1500);

  // ランキング行のオーバーレイ（a/button.cursor-pointer.absolute）と年表の帯を狙う
  const loc = route === "/reign"
    ? page.locator("a.cursor-pointer.absolute, button.cursor-pointer.absolute")
    : page.locator("svg g[role='button'], svg path.cursor-pointer, svg rect.cursor-pointer, svg g.cursor-pointer");
  const n = await loc.count();
  let worst = null, seen = 0;
  for (const i of [0, Math.floor(n / 2), n - 1].filter((v) => v >= 0 && v < n)) {
    const el = loc.nth(i);
    try {
      await el.scrollIntoViewIfNeeded({ timeout: 3000 });
      await page.waitForTimeout(400);          // スクロール直後150msのホバー抑制を越える
      await el.hover({ timeout: 3000, force: true });
      await page.waitForTimeout(350);
    } catch { continue; }
    const tip = await page.evaluate(readTip);
    if (!tip) continue;
    seen++;
    const oL = Math.max(0, -tip.left), oR = Math.max(0, tip.right - w);
    const oT = Math.max(0, -tip.top), oB = Math.max(0, tip.bottom - h);
    const bad = oL + oR + oT + oB;
    if (!worst || bad > worst.bad) worst = { bad, tip, oL, oR, oT, oB };
  }
  console.log(route, `${w}x${h}`, `候補=${n} 検出=${seen}`,
    worst
      ? `tip=${Math.round(worst.tip.w)}x${Math.round(worst.tip.h)} はみ出し L${Math.round(worst.oL)} R${Math.round(worst.oR)} T${Math.round(worst.oT)} B${Math.round(worst.oB)} => ${worst.bad === 0 ? "OK(切れなし)" : "CLIPPED"} micro=${JSON.stringify(worst.tip.micro)}`
      : "ツールチップ未検出");
  await ctx.close();
}
await browser.close();
