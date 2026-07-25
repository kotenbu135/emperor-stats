// 系譜図エディタ(/kinship?edit=1)の保存サーバ。開発時だけ手で起動する:
//
//   node scripts/kinship-editor-server.mjs      (site/ から npm run kinship-editor)
//
// ブラウザの編集モードから POST /save で手動レイアウトJSONを受け取り、
// site/src/lib/kinship/manual-layout.json へ書き出す(Nextのdevサーバが
// HMRで拾い、そのままページに反映される)。
//
// Next 側のルートにしないのは、output:"export" の静的書き出しに POST ルートを
// 混ぜないため(本番ビルドを壊さない)。このファイルは配信物には一切含まれない。

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = path.join(ROOT, "site", "src", "lib", "kinship", "manual-layout.json");
const PORT = Number(process.env.KINSHIP_EDITOR_PORT ?? 4123);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

http
  .createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS).end();
      return;
    }
    if (req.method !== "POST" || !req.url?.startsWith("/save")) {
      res.writeHead(404, CORS).end("not found");
      return;
    }
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 8_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body);
        // 壊れた入力で既存の凍結座標を失わないよう、最低限の形だけ検証する。
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
          throw new Error("トップレベルはオブジェクトである必要があります");
        for (const [id, ch] of Object.entries(parsed)) {
          if (ch.mode !== "auto" && ch.mode !== "manual")
            throw new Error(`章 ${id}: mode は auto|manual`);
          if (typeof ch.nodes !== "object" || ch.nodes === null)
            throw new Error(`章 ${id}: nodes がありません`);
        }
        fs.writeFileSync(TARGET, JSON.stringify(parsed, null, 2) + "\n", "utf-8");
        const n = Object.entries(parsed)
          .map(([id, c]) => `${id}:${c.mode}(${Object.keys(c.nodes).length})`)
          .join(" ");
        console.log(`saved ${new Date().toISOString()} ${n}`);
        res.writeHead(200, { ...CORS, "Content-Type": "application/json" }).end(
          JSON.stringify({ ok: true }),
        );
      } catch (e) {
        console.error("save failed:", e.message);
        res.writeHead(400, { ...CORS, "Content-Type": "application/json" }).end(
          JSON.stringify({ ok: false, error: e.message }),
        );
      }
    });
  })
  .listen(PORT, () => {
    console.log(`kinship editor save server: http://localhost:${PORT}/save → ${TARGET}`);
  });
