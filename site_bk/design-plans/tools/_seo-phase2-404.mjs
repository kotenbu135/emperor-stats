// 皇帝個別ページで 404 になっているリソースの特定（コンソールに 404 が出たため）。
import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage();
p.on("response", (r) => { if (r.status() >= 400) console.log(r.status(), r.url()); });
for (const u of ["/emperors/qin-shihuang", "/emperors/tang-taizong", "/"]) {
  await p.goto("http://localhost:4173" + u, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  console.log("--- checked", u);
}
await b.close();
