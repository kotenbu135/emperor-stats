// docs/site-design/mockups/card-preview の肖像画(webp)を public/portraits/ に同期する。
// public配下は静的書き出し(next export)でそのまま配信されるため、ビルド前に毎回実行する。
import { readdirSync, copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const srcDir = path.join(process.cwd(), "..", "docs", "site-design", "mockups", "card-preview");
const destDir = path.join(process.cwd(), "public", "portraits");

mkdirSync(destDir, { recursive: true });

const files = readdirSync(srcDir).filter((f) => f.endsWith(".webp"));
for (const file of files) {
  copyFileSync(path.join(srcDir, file), path.join(destDir, file));
}

console.log(`synced ${files.length} portraits to public/portraits/`);
