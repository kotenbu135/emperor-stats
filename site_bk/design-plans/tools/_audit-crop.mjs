import sharp from "sharp";
import fs from "node:fs";

// 監査用: フルページ PNG を縦に等分して読める大きさのタイルにする。
// 使い方: SRC=./before-desktop TILE=1000 node _audit-crop.mjs top reign ...
const SRC = process.env.SRC ?? "./before-desktop";
const OUT = process.env.OUT ?? "./rebuild-shots/audit";
const TILE = Number(process.env.TILE ?? 1000);
const MAX = Number(process.env.MAX ?? 4);
const names = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });

for (const name of names) {
  const file = `${SRC}/${name}.png`;
  const img = sharp(file);
  const { width, height } = await img.metadata();
  const tiles = Math.min(MAX, Math.ceil(height / TILE));
  for (let i = 0; i < tiles; i++) {
    const top = i * TILE;
    const h = Math.min(TILE, height - top);
    await sharp(file)
      .extract({ left: 0, top, width, height: h })
      .toFile(`${OUT}/${name}-${i}.png`);
  }
  console.log(`${name}\t${width}x${height}\ttiles=${tiles}`);
}
