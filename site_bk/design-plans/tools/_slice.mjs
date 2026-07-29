import { chromium } from "playwright";
import fs from "node:fs";
const BASE="http://localhost:4599";
const OUT=process.env.SHOT_DIR ?? "./rebuild-shots";
const ROUTE=process.env.ROUTE ?? "/";
const TAG=process.env.TAG ?? "shot";
const YS=(process.env.YS ?? "0").split(",").map(Number);
fs.mkdirSync(OUT,{recursive:true});
const b=await chromium.launch();
for (const [name,w,h] of [["desktop",1440,900],["mobile",390,844]]) {
  const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});
  await p.goto(BASE+ROUTE,{waitUntil:"networkidle"});
  for (const y of YS){ await p.evaluate(yy=>window.scrollTo(0,yy),y); await p.waitForTimeout(800);
    await p.screenshot({path:`${OUT}/${TAG}-${name}-y${y}.png`}); }
  await p.close();
}
await b.close();
