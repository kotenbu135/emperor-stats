import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto("http://localhost:4599/dynasties", { waitUntil: "networkidle" });
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(1800);
const info = await p.evaluate(() => {
  const svgs = [...document.querySelectorAll("svg[role='img']")];
  return svgs.map((s) => {
    const r = s.getBoundingClientRect();
    const texts = [...s.querySelectorAll("g > g > text")].slice(0, 5).map((t) => t.textContent);
    const allText = [...s.querySelectorAll("text")].map((t) => t.textContent);
    return {
      aria: s.getAttribute("aria-label"),
      w: Math.round(r.width), h: Math.round(r.height),
      parentW: Math.round(s.parentElement.getBoundingClientRect().width),
      textCount: allText.length,
      sample: allText.slice(0, 8),
    };
  });
});
console.log(JSON.stringify(info, null, 2));
await b.close();
