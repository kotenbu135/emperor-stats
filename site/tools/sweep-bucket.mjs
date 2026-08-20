// bucket 走査（KINSHIP_RULES 2節）。KINSHIP_ONLY で章を固定し、欠陥数を並べる。
import { execFileSync } from "node:child_process";

const era = process.argv[2];
const buckets = (process.argv[3] ?? "10,12,15,18,20,22,25,30,40").split(",").map(Number);
for (const b of buckets) {
  const out = execFileSync("node", ["scripts/build-kinship-layout.mjs"], {
    env: { ...process.env, KINSHIP_ONLY: era, KINSHIP_BUCKET: String(b) },
    encoding: "utf8",
  });
  const m = out.match(/線の欠陥: (\d+)件/);
  const size = out.match(/段 \d+ \/ (\d+)×(\d+)px/);
  console.log(`bucket ${b}: 欠陥 ${m?.[1] ?? "?"} 件 / ${size?.[1]}×${size?.[2]}px`);
}
