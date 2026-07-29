// 新しい矢印の当たり判定がカプセルを覆っていないかの確認(ローカル専用・使い捨て)。
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
await page.goto(`${BASE}/kinship?edit=nanbeichao`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

const out = await page.evaluate(() => {
  const hits = [...document.querySelectorAll('svg path[stroke="transparent"][stroke-width="7"]')];
  const nodes = [...document.querySelectorAll("g[data-kid]")].map((g) => ({
    id: g.dataset.kid,
    r: g.getBoundingClientRect(),
  }));
  const covered = new Set();
  for (const el of hits) {
    const len = el.getTotalLength();
    for (let i = 0; i <= 200; i++) {
      const p = el.getPointAtLength((len * i) / 200);
      const m = el.getScreenCTM();
      const x = p.x * m.a + m.e;
      const y = p.y * m.d + m.f;
      for (const n of nodes)
        if (x >= n.r.left && x <= n.r.right && y >= n.r.top && y <= n.r.bottom)
          covered.add(n.id);
    }
  }
  return [...covered];
});
console.log("矢印の当たり判定が乗っているノード:", out);
await browser.close();
