// docs/site-design/mockups/card-preview の肖像画(webp)を public/portraits/ に同期し、
// 一覧カード・ダイアログの小サイズ表示向けの320pxサムネを public/portraits/thumb/ に
// 生成する（Portraitコンポーネントが srcset "thumb 320w, full 360w" で出し分ける）。
// public配下は静的書き出し(next export)でそのまま配信されるため、ビルド前に毎回実行する。
import {
  readdirSync,
  copyFileSync,
  mkdirSync,
  statSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import sharp from "sharp";

const srcDir = path.join(process.cwd(), "..", "docs", "site-design", "mockups", "card-preview");
const destDir = path.join(process.cwd(), "public", "portraits");
const thumbDir = path.join(destDir, "thumb");

// 元画像(360×480・quality65)と同じ品質基準で幅320pxへ縮小する。
const THUMB_WIDTH = 320;
const THUMB_QUALITY = 65;

mkdirSync(destDir, { recursive: true });
mkdirSync(thumbDir, { recursive: true });

const files = readdirSync(srcDir).filter((f) => f.endsWith(".webp"));

// 同期元から消えた肖像画は public 側からも削除する（コピーだけだと削除が
// 追従されず、取り下げたはずの画像が配信され続ける）。
const wanted = new Set(files);
let removed = 0;
for (const dir of [destDir, thumbDir]) {
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".webp"))) {
    if (!wanted.has(f)) {
      unlinkSync(path.join(dir, f));
      removed += 1;
    }
  }
}

let thumbs = 0;
for (const file of files) {
  const src = path.join(srcDir, file);
  copyFileSync(src, path.join(destDir, file));
  // サムネは元画像より古い（または無い）ときだけ再生成する（predev/prebuildで
  // 毎回150枚エンコードし直さないため）。
  const thumb = path.join(thumbDir, file);
  if (!existsSync(thumb) || statSync(thumb).mtimeMs < statSync(src).mtimeMs) {
    await sharp(src)
      .resize({ width: THUMB_WIDTH })
      .webp({ quality: THUMB_QUALITY })
      .toFile(thumb);
    thumbs += 1;
  }
}

console.log(
  `synced ${files.length} portraits to public/portraits/ (regenerated ${thumbs} thumbs, removed ${removed} stale)`,
);
