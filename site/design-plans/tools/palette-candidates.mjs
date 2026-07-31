// shadcn の create ビルダーが使っている色データ（base color 9系統 + Tailwind の
// カラーランプ）から、このサイトに合いそうなパレットを5案組み立てる。
//
// shadcn のテーマは「base color（面と文字のグレー系ランプ）」＋「theme（アクセントの
// カラーランプ）」の2軸でできている。CLI からは色テーマを列挙できなかったため、
// 同じ組み立て方をこちらで再現している。色値は shadcn 公式のカラーデータそのまま。
//
//   node design-plans/tools/palette-candidates.mjs        # 一覧を出す
//   node design-plans/tools/palette-candidates.mjs stone-red  # 1案を globals.css へ適用
import fs from "node:fs";
import path from "node:path";

const PALETTE = JSON.parse(
  fs.readFileSync(
    new URL("./tailwind-palette.json", import.meta.url),
    "utf-8",
  ),
);
const c = (name) => {
  const hex = PALETTE[name];
  if (!hex) throw new Error(`色が見つかりません: ${name}`);
  return hex;
};

/**
 * base = 面・文字・罫線のランプ / accent = 主役の色 / chart = 図の8色。
 * shadcn の base color には neutral / stone / zinc / gray / slate に加えて
 * mauve / mist / olive / taupe がある（create ビルダーのデータで確認）。
 */
export const CANDIDATES = [
  {
    id: "stone-red",
    label: "Stone × Red",
    note: "温かみのある石のグレーに、印章の朱に近い赤。中国史の題材と素直に噛み合う。",
    base: "stone",
    accent: "red",
    chart: ["red-600", "amber-600", "teal-600", "indigo-600", "stone-500", "orange-700", "cyan-700", "rose-400"],
  },
  {
    id: "taupe-amber",
    label: "Taupe × Amber",
    note: "土色のグレーに琥珀。皇帝の黄・絹本の色。紙っぽさは残るが水墨ではない。",
    base: "taupe",
    accent: "amber",
    chart: ["amber-600", "teal-700", "rose-600", "indigo-600", "taupe-500", "lime-700", "orange-600", "sky-700"],
  },
  {
    id: "olive-emerald",
    label: "Olive × Emerald",
    note: "くすんだ緑のグレーに翠。青銅器・玉のイメージ。落ち着いて図が読みやすい。",
    base: "olive",
    accent: "emerald",
    chart: ["emerald-600", "amber-600", "violet-600", "rose-600", "olive-500", "cyan-700", "orange-600", "blue-700"],
  },
  {
    id: "mauve-violet",
    label: "Mauve × Violet",
    note: "紫は皇帝の色（紫禁城・紫微垣）。灰紫の面に紫。資料然としつつ主題に寄る。",
    base: "mauve",
    accent: "violet",
    chart: ["violet-600", "amber-600", "emerald-600", "rose-600", "mauve-500", "sky-700", "orange-600", "teal-700"],
  },
  {
    id: "slate-blue",
    label: "Slate × Blue",
    note: "青みのグレーに青。もっとも学術データベース然とした無難な基準。比較用。",
    base: "slate",
    accent: "blue",
    chart: ["blue-600", "emerald-600", "violet-600", "amber-600", "slate-500", "rose-600", "cyan-700", "indigo-700"],
  },
];

function cssFor(v) {
  const b = (n) => c(`${v.base}-${n}`);
  const a = (n) => c(`${v.accent}-${n}`);
  const chart = v.chart.map((k, i) => `  --series-${i + 1}: ${c(k)};`).join("\n");
  return `  /* ${v.label} — ${v.note}
     shadcn の組み立て方（base color = ${v.base} / theme = ${v.accent}）に沿ったもの。
     色値は shadcn 公式のカラーデータそのまま。 */
  --background: ${b(50)};
  --foreground: ${b(950)};
  --card: #ffffff;
  --card-foreground: ${b(950)};
  --popover: #ffffff;
  --popover-foreground: ${b(950)};
  --primary: ${b(900)};
  --primary-foreground: ${b(50)};
  --secondary: ${b(100)};
  --secondary-foreground: ${b(900)};
  --muted: ${b(100)};
  --muted-foreground: ${b(500)};
  --accent: ${b(100)};
  --accent-foreground: ${b(900)};
  --seal: ${a(600)};
  --seal-foreground: #ffffff;
  --destructive: ${c("red-600")};
${chart}
  --kinship-minor: ${b(400)};
  --border: ${b(200)};
  --input: ${b(200)};
  --ring: ${a(600)};
  --radius: 0.5rem;
  --sidebar: #ffffff;
  --sidebar-foreground: ${b(950)};
  --sidebar-primary: ${a(600)};
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: ${b(100)};
  --sidebar-accent-foreground: ${b(900)};
  --sidebar-border: ${b(200)};
  --sidebar-ring: ${a(600)};
`;
}

const CSS_PATH = path.resolve("src/app/globals.css");
const START = "  /* @palette:start */";
const END = "  /* @palette:end */";

export function apply(id) {
  const v = CANDIDATES.find((x) => x.id === id);
  if (!v) throw new Error(`候補にありません: ${id}`);
  const css = fs.readFileSync(CSS_PATH, "utf-8");
  const s = css.indexOf(START);
  const e = css.indexOf(END);
  if (s < 0 || e < 0) throw new Error("globals.css に @palette マーカーがありません");
  const next = css.slice(0, s + START.length) + "\n" + cssFor(v) + css.slice(e);
  fs.writeFileSync(CSS_PATH, next);
  return v;
}

const arg = process.argv[2];
if (arg) {
  const v = apply(arg);
  console.log(`applied: ${v.label}`);
} else {
  for (const v of CANDIDATES) console.log(`${v.id}\t${v.label}\t${v.note}`);
}
