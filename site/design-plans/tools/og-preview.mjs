// OGP画像の意匠を試すためのプレビュー生成スクリプト（本番のレンダラとは別物）。
// next/og の ImageResponse を素の node から呼び、案ごとの PNG を og-shots/ に書く。
// 本番の src/lib/og-image.tsx を直すたびに npm run build する往復を避けるための道具で、
// 採用が決まった案だけを og-image.tsx へ手で移す。データは実データの実測値を
// ハードコードしてあるが（意匠の確認用）、本番は emperors.ts から導出すること。
//
// 使い方: cd site/design-plans/tools && node og-preview.mjs

import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createElement as h } from "react";
import { ImageResponse } from "next/og.js";

const SITE = path.resolve(import.meta.dirname, "../..");
const OUT = path.join(import.meta.dirname, "og-shots");
mkdirSync(OUT, { recursive: true });

const fontsDir = path.join(SITE, "assets", "fonts");
const FONTS = [
  { name: "Noto Sans JP", data: readFileSync(path.join(fontsDir, "NotoSansJP-Subset-Regular.ttf")), style: "normal", weight: 400 },
  { name: "Noto Sans JP", data: readFileSync(path.join(fontsDir, "NotoSansJP-Subset-Bold.ttf")), style: "normal", weight: 700 },
];

const SIZE = { width: 1200, height: 630 };
const P = {
  background: "#f5f1e8",
  foreground: "#3a3530",
  muted: "#6b6258",
  seal: "#a6321c",
  sealForeground: "#f5f1e8",
  line: "#d9d1c2",
};

const SITE_NAME = "中国皇帝統計";

function Frame(children, opts = {}) {
  return h(
    "div",
    {
      style: {
        display: "flex", flexDirection: "column", width: "100%", height: "100%",
        backgroundColor: P.background, padding: 56, fontFamily: "Noto Sans JP",
      },
    },
    h(
      "div",
      {
        style: {
          display: "flex", flexDirection: "column", width: "100%", height: "100%",
          border: `3px solid ${P.seal}`, borderRadius: 12, padding: opts.padding ?? 48,
        },
      },
      ...children,
    ),
  );
}

function Footer(extra) {
  return h(
    "div",
    { style: { display: "flex", alignItems: "center", gap: 12, marginTop: "auto" } },
    h("div", {
      style: {
        display: "flex", width: 40, height: 40, borderRadius: 8, backgroundColor: P.seal,
        color: P.sealForeground, alignItems: "center", justifyContent: "center",
        fontSize: 22, fontWeight: 700,
      },
    }, "帝"),
    h("div", { style: { display: "flex", flexDirection: "column" } },
      h("span", { style: { fontSize: 22, fontWeight: 700, color: P.foreground } }, SITE_NAME),
      h("span", { style: { fontSize: 16, color: P.muted } }, "emperorstats.com"),
    ),
    extra
      ? h("span", {
          style: {
            marginLeft: "auto", fontSize: 18, color: P.muted,
            border: `1px solid ${P.line}`, borderRadius: 999, padding: "6px 16px",
          },
        }, extra)
      : null,
  );
}

// ── 案A: 事実カード2枚を下段に置く（見出しは短いまま） ──────────────
function variantA({ title, description, facts }) {
  return Frame([
    h("span", { style: { fontSize: 24, fontWeight: 700, color: P.seal } }, SITE_NAME),
    h("span", { style: { fontSize: 64, fontWeight: 700, color: P.foreground, marginTop: 6, lineHeight: 1.15 } }, title),
    h("span", { style: { display: "flex", fontSize: 26, color: P.muted, marginTop: 14, lineHeight: 1.45, maxWidth: 940 } }, description),
    h("div", { style: { display: "flex", gap: 20, marginTop: 26 } },
      ...facts.map((f) =>
        h("div", {
          style: {
            display: "flex", flexDirection: "column", flex: 1,
            border: `1px solid ${P.line}`, borderLeft: `6px solid ${P.seal}`,
            borderRadius: 10, padding: "14px 18px", backgroundColor: "#fbf8f2",
          },
        },
          h("span", { style: { fontSize: 18, color: P.muted } }, f.label),
          h("span", { style: { fontSize: 34, fontWeight: 700, color: P.foreground, marginTop: 4 } }, f.value),
          f.sub ? h("span", { style: { fontSize: 18, color: P.muted, marginTop: 2 } }, f.sub) : null,
        ),
      ),
    ),
    Footer(),
  ]);
}

// ── 案B: 主役の数字を大きく1つ（見出しは小さく上に退く） ──────────────
function variantB({ title, description, facts }) {
  const lead = facts[0];
  const rest = facts.slice(1);
  return Frame([
    h("div", { style: { display: "flex", alignItems: "baseline", gap: 14 } },
      h("span", { style: { fontSize: 24, fontWeight: 700, color: P.seal } }, SITE_NAME),
      h("span", { style: { fontSize: 24, color: P.muted } }, title),
    ),
    h("span", { style: { fontSize: 26, color: P.muted, marginTop: 18 } }, lead.label),
    h("span", { style: { fontSize: 86, fontWeight: 700, color: P.foreground, lineHeight: 1.1, marginTop: 2 } }, lead.value),
    lead.sub ? h("span", { style: { fontSize: 30, color: P.foreground, marginTop: 6 } }, lead.sub) : null,
    h("div", { style: { display: "flex", gap: 12, marginTop: 22 } },
      ...rest.map((f) =>
        h("span", {
          style: {
            display: "flex", fontSize: 20, color: P.muted,
            border: `1px solid ${P.line}`, borderRadius: 999, padding: "8px 18px",
          },
        }, `${f.label} ${f.value}${f.sub ? ` ${f.sub}` : ""}`),
      ),
      h("span", {
        style: {
          display: "flex", fontSize: 20, color: P.muted,
          border: `1px solid ${P.line}`, borderRadius: 999, padding: "8px 18px",
        },
      }, description),
    ),
    Footer(),
  ]);
}

// ── 皇帝ページ案: 現行（名前＋在位＋肖像）に順位・死因のチップを足す ──────
function emperorVariant({ dynasty, name, periods, duration, chips, portrait }) {
  return Frame([
    h("div", { style: { display: "flex", flex: 1, alignItems: "center", gap: 48 } },
      h("div", { style: { display: "flex", flexDirection: "column", flex: 1 } },
        h("span", { style: { fontSize: 24, fontWeight: 700, color: P.seal } }, dynasty),
        h("span", { style: { fontSize: 88, fontWeight: 700, color: P.foreground, marginTop: 8, lineHeight: 1.15 } }, name),
        h("span", { style: { fontSize: 30, color: P.muted, marginTop: 18 } }, `在位 ${periods}（${duration}）`),
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 20 } },
          ...chips.map((c) =>
            h("span", {
              style: {
                display: "flex", fontSize: 20, color: P.foreground,
                border: `1px solid ${P.line}`, borderRadius: 999, padding: "8px 18px",
                backgroundColor: "#fbf8f2",
              },
            }, c),
          ),
        ),
      ),
      portrait
        ? h("img", { src: portrait, width: 220, height: 293, style: { borderRadius: 16, border: `4px solid ${P.seal}`, objectFit: "cover" } })
        : null,
    ),
    Footer(),
  ]);
}

const REIGN = {
  title: "在位データ",
  description: "在位年数ランキングと復位者（複数回即位）の一覧",
  facts: [
    { label: "最長在位", value: "61年332日", sub: "聖祖・康熙帝（清）" },
    { label: "復位した皇帝", value: "8名", sub: "365名中" },
  ],
};
const DEATH = {
  title: "死因・即位",
  description: "死因別・即位経路別の内訳",
  facts: [
    { label: "最多の死因", value: "病死 161名", sub: "365名の44%" },
    { label: "最多の即位経路", value: "世襲 120名", sub: "365名の33%" },
  ],
};

async function write(name, el) {
  const res = new ImageResponse(el, { ...SIZE, fonts: FONTS });
  const buf = Buffer.from(await res.arrayBuffer());
  const { writeFileSync } = await import("node:fs");
  writeFileSync(path.join(OUT, `${name}.png`), buf);
  console.log("wrote", name, buf.length);
}

await write("a-reign", variantA(REIGN));
await write("a-death", variantA(DEATH));
await write("b-reign", variantB(REIGN));
await write("b-death", variantB(DEATH));
await write("emperor-chips", emperorVariant({
  dynasty: "清",
  name: "聖祖・康熙帝",
  periods: "1661–1722",
  duration: "61年332日",
  chips: ["在位年数 365名中1位", "死因 病死", "即位経路 世襲", "没年齢 69歳"],
  portrait: null,
}));
