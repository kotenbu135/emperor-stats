// 画面上端に固定される帯（/emperors の時代ジャンプ＋絞り込み、/database の絞り込み）が
// 契約を守っているか実測する。
//
//   cd site && npm run build && node tools/bar-audit.mjs
//   BASE_URL=http://localhost:3100 node tools/bar-audit.mjs   # dev サーバーに当てる
//
// 見ているのは5つ。**どれも tsc・lint・build では落ちない。**
//
//  1. 帯の高さが常に 48px（STICKY_BAR_H）であること。この値は /emperors の節見出しの
//     sticky top と節の scrollMarginTop、/database の表見出しの sticky top を兼ねている
//     ので、中身が折り返して2行になると見出しと着地位置が黙ってずれる
//  2. 帯の中身が横に溢れていないこと（1行に収まる形で畳めているか）
//  3. **縮み代を全部かぶる要素**が潰れていないこと。条件が効くと帯の右側が太り
//     （件数が「42/365名」になり印が付く）、その増分を1つの要素が全部かぶる。
//     **溢れてはいないので scrollWidth の検査では拾えない**（/emperors で実際に
//     時代名が2文字まで潰れた）
//  4. 0件のときも帯が残り、絞り込みを外せること。**/emperors は逆に、ジャンプ側
//     （トリガー・見出し・群の罫線）が丸ごと消えていること**
//  5. /database は送った先で表見出しが帯の下に貼り付くこと（帯の裏へ潜らない）
//
// 幅の分岐は帯の内幅（container query）で決まるので、ビューポート幅は md 以上で
// サイドバー240pxが挟まる点に注意（768px の画面でも内幅は438pxしかない）。
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("out");
const PORT = Number(process.env.PORT ?? 4611);
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

/** capture-site.mjs と同じ理由の静的配信（out/ は /emperors → emperors.html）。 */
function serveExport(root, port) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    const rel = path.normalize(url).replace(/^(\.\.[/\\])+/, "");
    for (const candidate of [
      path.join(root, rel),
      path.join(root, `${rel}.html`),
      path.join(root, rel, "index.html"),
    ]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        res.writeHead(200, {
          "content-type": MIME[path.extname(candidate)] ?? "application/octet-stream",
        });
        return res.end(fs.readFileSync(candidate));
      }
    }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BAR_H = 48;
// 1000/1008 は**/emperors の内幅 42rem(672px) の境目を挟むため**（内幅 ≈ ビューポート
// − 330px なので境目はビューポート1002px）。ここで「時代へジャンプ」の見出しと群を
// 仕切る罫線が現れる。900→1024 だけを測っていると、**中身が増える瞬間の幅がどの
// ケースにも当たらない**。
const WIDTHS = [360, 390, 640, 768, 900, 1000, 1008, 1024, 1280, 1440, 1920];

const PAGES = [
  {
    label: "一覧",
    path: "/emperors",
    bar: 'nav[aria-label^="時代へジャンプ"]',
    // 絞り込みが効いている状態は帯の右側がいちばん太る。素の状態と両方を同じ幅で測る。
    cases: [["素", ""], ["絞込", `?q=${encodeURIComponent("武")}&dynasty=tang`]],
    // 縮み代を全部かぶる要素と、そこを下回ったら読めなくなる幅
    // （時代名＋chevron＋padding で36px使う）。
    // **ジャンプのトリガーは data-jump-trigger で引く。** 帯には王朝コンボボックスと
    // 「絞り込み」パネルも同じ data-slot="popover-trigger" で載っているので、slot で
    // 引くと節が0個の場面で別のトリガーを拾う（下の gone 検査が素通りした）。
    floor: { name: "ジャンプ", sel: "[data-jump-trigger]", min: 90 },
    probes: [
      ["検索", 'input[aria-label="皇帝を検索"]'],
      ["王朝", '[aria-label="王朝で絞り込み"]'],
      ["区分", '[aria-label="王朝の区分で絞り込み"]'],
    ],
    empty: {
      qs: `?q=${encodeURIComponent("存在しない名前")}`,
      value: 'input[aria-label="皇帝を検索"]',
      text: "条件に一致する皇帝がいません",
      // **節が0個になったらジャンプ側は丸ごと消えていること。** トリガーが消えても
      // 見出しと群を仕切る罫線は別の要素なので、ガードを書き忘れると「指す相手の
      // いない見出し」と「片側が空の群を仕切る罫線」が帯の左端に残る（高さも溢れも
      // 変わらないので他の検査では拾えない）。
      gone: [
        ["ジャンプ", "[data-jump-trigger]"],
        ["見出し", "[data-jump-label]"],
      ],
      // 残ってよい罫線は件数の手前の1本だけ（操作と結果の仕切りは節が無くても要る）。
      rules: 1,
    },
    stickyHead: null,
  },
  {
    label: "DB  ",
    path: "/database",
    bar: 'section[aria-label^="表の絞り込み"]',
    cases: [["素", ""], ["絞込", `?q=${encodeURIComponent("武")}&dynasty=tang`]],
    // /database で縮むのは検索窓ひとつ。ここが潰れると入力中の語が読めない。
    // 下限は CSS 側の min-w-[8.5rem]（＝入力欄で約96px）と対にしてある。
    // ここを割る前に帯が溢れるので、上の溢れ検査と二重に掛かる。
    floor: { name: "検索  ", sel: 'input[aria-label="表を検索"]', min: 95 },
    probes: [
      ["時代", '[aria-label="時代で絞り込み"]'],
      ["王朝", '[aria-label="王朝で絞り込み"]'],
      ["回数", '[aria-label="在位回数で絞り込み"]'],
      ["列", '[aria-label="表示する列を選ぶ"]'],
    ],
    empty: {
      qs: `?q=${encodeURIComponent("存在しない名前")}`,
      value: 'input[aria-label="表を検索"]',
      text: "条件に一致する皇帝がいません",
    },
    // 表見出しは帯の真下（--chrome-top + 48px）に貼り付く。横に溢れている幅では
    // 枠がスクロールコンテナになって sticky 自体を諦めているので、その回は測らない。
    stickyHead: "thead th",
  },
  {
    // /about も同じ帯を使う（節ジャンプだけ・本文列は記事幅）。中身は薄いが、
    // 外枠を共有している以上ここも1行48pxで、`innerWidth` を取り違えると
    // トリガーだけ本文より左へ出る。高さと溢れだけ見る。
    label: "About",
    path: "/about",
    bar: 'nav[aria-label^="節へジャンプ"]',
    cases: [["素", ""]],
    floor: { name: "ジャンプ", sel: '[data-slot="popover-trigger"]', min: 90 },
    probes: [],
    empty: null,
    stickyHead: null,
  },
];

const useOwnServer = !process.env.BASE_URL;
const BASE = process.env.BASE_URL ?? `http://localhost:${PORT}`;
if (useOwnServer && !fs.existsSync(ROOT)) {
  console.error("out/ が無い。先に `npm run build` を実行するか BASE_URL を渡すこと。");
  process.exit(1);
}
const server = useOwnServer ? await serveExport(ROOT, PORT) : null;
const browser = await chromium.launch();
let ng = 0;

for (const p of PAGES) {
  for (const [caseName, qs] of p.cases)
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width, height: 900 },
        locale: "ja-JP",
      });
      const page = await ctx.newPage();
      await page.goto(`${BASE}${p.path}${qs}`, { waitUntil: "networkidle" });
      await sleep(400);
      const m = await page.evaluate(
        ({ sel, floorSel, probes, stickyHead }) => {
          const bar = document.querySelector(sel);
          if (!bar) return null;
          const inner = bar.querySelector(":scope > div");
          const row = inner.querySelector(":scope > div");
          const shown = (q) => {
            const el = bar.querySelector(q);
            return !!el && el.getBoundingClientRect().width > 0;
          };
          const out = {
            height: bar.getBoundingClientRect().height,
            innerWidth: Math.round(inner.getBoundingClientRect().width),
            scrollWidth: row.scrollWidth,
            clientWidth: row.clientWidth,
            floorWidth: Math.round(
              bar.querySelector(floorSel)?.getBoundingClientRect().width ?? 0,
            ),
            probes: probes.map(([, q]) => shown(q)),
            headGap: null,
          };
          if (stickyHead) {
            // 送った先で見出しが帯の裏へ潜らないこと。溢れている幅では見出しの
            // 固定を諦めている（枠がスクロールコンテナになる）ので測らない。
            // **`position: sticky` だけで判定しない** — 先頭列は横スクロール中も
            // 残すため常に sticky で、`top` は当てていない。縦に貼っているかは
            // `top` が入っているかで見る。
            window.scrollTo(0, 2000);
            const th = document.querySelector(stickyHead);
            const cs = th && getComputedStyle(th);
            if (cs && cs.position === "sticky" && cs.top !== "auto") {
              out.headGap = Math.round(
                th.getBoundingClientRect().top - bar.getBoundingClientRect().bottom,
              );
            }
          }
          return out;
        },
        {
          sel: p.bar,
          floorSel: p.floor.sel,
          probes: p.probes,
          stickyHead: p.stickyHead,
        },
      );
      await ctx.close();
      if (!m) {
        console.log(`${p.label}\t${caseName}\t${String(width).padStart(4)}px  帯が無い  ← NG`);
        ng++;
        continue;
      }
      const overflow = m.scrollWidth > m.clientWidth + 1;
      const crushed = m.floorWidth < p.floor.min;
      // 見出しが帯の裏へ潜っていたら NG（測れた回だけ見る）。
      const headUnder = m.headGap !== null && m.headGap < -1;
      const bad = m.height !== BAR_H || overflow || crushed || headUnder;
      if (bad) ng++;
      console.log(
        `${p.label}\t${caseName}\t${String(width).padStart(4)}px  内幅${String(m.innerWidth).padStart(4)}  高さ${m.height}` +
          `  溢れ${overflow ? `YES(${m.scrollWidth}>${m.clientWidth})` : "no"}` +
          `  ${p.floor.name}幅${String(m.floorWidth).padStart(3)}${crushed ? "!" : " "}` +
          (m.headGap === null ? "" : `  見出し差${String(m.headGap).padStart(3)}${headUnder ? "!" : " "}`) +
          `  [${p.probes.map(([n], i) => `${n}${m.probes[i] ? "○" : "-"}`).join(" ")}]` +
          `${bad ? "  ← NG" : ""}`,
      );
    }

  // 0件でも帯と絞り込みが残ること。
  if (p.empty) {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: "ja-JP",
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${BASE}${p.path}${p.empty.qs}`, { waitUntil: "networkidle" });
    await sleep(600);
    const r = await page.evaluate(
      ({ sel, valueSel, text, gone }) => {
        const bar = document.querySelector(sel);
        const visible = (el) => !!el && el.getBoundingClientRect().width > 0;
        return {
          bar: !!bar,
          height: bar?.getBoundingClientRect().height,
          query: bar?.querySelector(valueSel)?.value,
          noResults: document.body.textContent.includes(text),
          left: gone.map(([, q]) => visible(bar?.querySelector(q))),
          rules: bar
            ? [...bar.querySelectorAll("[data-bar-rule]")].filter(visible).length
            : 0,
        };
      },
      { sel: p.bar, valueSel: p.empty.value, text: p.empty.text, gone: p.empty.gone ?? [] },
    );
    await ctx.close();
    const leftovers = r.left.some(Boolean);
    const wrongRules = p.empty.rules !== undefined && r.rules !== p.empty.rules;
    const bad =
      !r.bar || r.height !== BAR_H || !r.noResults || leftovers || wrongRules || errors.length > 0;
    if (bad) ng++;
    console.log(
      `${p.label}\t0件      帯${r.bar ? "有" : "無"} 高さ${r.height} 検索欄「${r.query}」` +
        ` 0件表示${r.noResults ? "有" : "無"}` +
        (p.empty.gone
          ? ` ${p.empty.gone.map(([n], i) => `${n}${r.left[i] ? "残" : "無"}`).join(" ")}`
          : "") +
        (p.empty.rules === undefined ? "" : ` 罫線${r.rules}本${wrongRules ? "!" : ""}`) +
        ` JSエラー${errors.length}${bad ? "  ← NG" : ""}`,
    );
  }
}

console.log(`\nNG: ${ng}`);
await browser.close();
server?.close();
process.exitCode = ng === 0 ? 0 : 1;
