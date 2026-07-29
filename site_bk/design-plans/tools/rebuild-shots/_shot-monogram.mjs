import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 2 });
await p.goto("file:///home/sakis/emperor-stats/site/design-plans/tools/rebuild-shots/monogram-density.html");
await p.waitForTimeout(600);
await p.screenshot({ path: "/home/sakis/emperor-stats/site/design-plans/tools/rebuild-shots/monogram-density.png", fullPage: true });
await b.close();
console.log("shot ok");
