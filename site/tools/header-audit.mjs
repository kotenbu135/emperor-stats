// モバイルヘッダー（`src/components/layout/site-shell.tsx`・56px の1行）の実測。
//
//   cd site && npm run build && node tools/header-audit.mjs
//   BASE_URL=http://localhost:3000 node tools/header-audit.mjs   # dev サーバーに当てる
//
// 2026-08-06（Issue #92）にハンバーガー＋Sheet をやめ、行き先を文字で直接置いた。
// この帯が守る契約は4つで、**どれが破れても tsc・lint・build は通る**:
//
//   1. 高さは 56px ちょうど（globals.css の --chrome-top: 3.5rem と対。ここが伸びると
//      /emperors の節見出しと /database の表見出しの止め位置＝BELOW_STICKY_BAR がずれる）
//   2. 横に溢れない・折り返さない（最狭は 320px 想定）
//   3. 文字リンクは3本とも見えていて、押せる高さが 44px 以上ある
//   4. 現在地の1本だけが朱（皇帝個別ページは「皇帝一覧」に付く）
//
// playwright は site の依存に入っておらず `node_modules/playwright{,-core}` の symlink で
// 解決している（site/AGENTS.md の「ハマりどころ」）。site/ から実行すること。
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("out");
const PORT = Number(process.env.PORT ?? 4601);

const HEADER_H = 56; // = globals.css の --chrome-top: 3.5rem
const MIN_TAP_H = 44;
const NAV_LINKS = 3; // nav-data.ts の shortLabel を持つ項目数

// 最狭の 320px を必ず入れる（iPhone SE 相当。ここが通れば 360・390 は通る）。
const WIDTHS = [320, 360, 390];

// 帯は全ページ共通なので、種類の違う面だけ見る。最後の1本は皇帝個別365ページの代表で、
// 「一覧ではないが皇帝一覧に属する」現在地判定が効いているかを見るために要る。
const PAGES = [
  { path: "/", active: "/" },
  { path: "/emperors", active: "/emperors" },
  { path: "/database", active: "/database" },
  { path: "/about", active: null }, // ヘッダーに項目が無い面（出口はフッター）
  { path: "/emperors/han-wudi", active: "/emperors" },
];

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

/** capture-site.mjs と同じ理由（/about → out/about.html の解決）で自前で配る。 */
function serveExport(root, port) {
  const send = (res, status, body, type) => {
    res.writeHead(status, { "content-type": type });
    res.end(body);
  };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    const rel = path.normalize(url).replace(/^(\.\.[/\\])+/, "");
    for (const candidate of [
      path.join(root, rel),
      path.join(root, `${rel}.html`),
      path.join(root, rel, "index.html"),
    ]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return send(
          res,
          200,
          fs.readFileSync(candidate),
          MIME[path.extname(candidate)] ?? "application/octet-stream",
        );
      }
    }
    send(res, 404, "not found", MIME[".txt"]);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

const useOwnServer = !process.env.BASE_URL;
const BASE = process.env.BASE_URL ?? `http://localhost:${PORT}`;

if (useOwnServer && !fs.existsSync(ROOT)) {
  console.error("out/ が無い。先に `npm run build` を実行するか BASE_URL を渡すこと。");
  process.exit(1);
}

const server = useOwnServer ? await serveExport(ROOT, PORT) : null;
const browser = await chromium.launch();
let ng = 0;

const fail = (label, message) => {
  ng += 1;
  console.log(`  NG  ${label}  ${message}`);
};

for (const width of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: 1,
    locale: "ja-JP",
  });
  const page = await ctx.newPage();

  for (const target of PAGES) {
    const label = `${width}px ${target.path}`;
    await page.goto(`${BASE}${target.path}`, { waitUntil: "networkidle" });

    const m = await page.evaluate(() => {
      const header = document.querySelector("header");
      if (!header) return null;
      const nav = header.querySelector("nav");
      const links = [...(nav?.querySelectorAll("a") ?? [])];
      const toggle = header.querySelector('[role="switch"]');
      const box = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right };
      };
      const style = window.getComputedStyle(header);
      return {
        rect: box(header),
        scrollWidth: header.scrollWidth,
        clientWidth: header.clientWidth,
        padLeft: parseFloat(style.paddingLeft),
        padRight: parseFloat(style.paddingRight),
        links: links.map((a) => ({
          href: new URL(a.href).pathname,
          text: a.textContent,
          color: window.getComputedStyle(a).color,
          cursor: window.getComputedStyle(a).cursor,
          current: a.getAttribute("aria-current"),
          ...box(a),
        })),
        toggle: toggle
          ? {
              checked: toggle.getAttribute("aria-checked"),
              label: toggle.getAttribute("aria-label"),
              cursor: window.getComputedStyle(toggle).cursor,
              ...box(toggle),
            }
          : null,
        // 帯の外（本文の先頭）が帯の下から始まっているか
        bodyOverflowX: document.documentElement.scrollWidth > window.innerWidth,
      };
    });

    if (!m) {
      fail(label, "header が無い");
      continue;
    }

    // 1. 高さ
    if (Math.round(m.rect.h) !== HEADER_H) {
      fail(label, `高さ ${m.rect.h}px（契約は ${HEADER_H}px・globals.css の --chrome-top と対）`);
    }

    // 2. 溢れ・折り返し
    if (m.scrollWidth > m.clientWidth) {
      fail(label, `横に溢れている scrollWidth=${m.scrollWidth} > clientWidth=${m.clientWidth}`);
    }
    // ページ全体の横溢れは NG にしない（この帯の契約ではない）。ただし黙って捨てず
    // 出す — 320px の個別ページは動画カードのタイトル行が 9px 溢れており、これは
    // 2026-08-06 の時点で既にそうなっていた本文側の問題。
    if (m.bodyOverflowX) {
      console.log(`  --  ${label}  本文が横に溢れている（帯の外・別件）`);
    }

    // 3. リンク3本・押せる高さ・1行に並んでいる
    if (m.links.length !== NAV_LINKS) {
      fail(label, `リンクが ${m.links.length} 本（契約は ${NAV_LINKS} 本）`);
    }
    const tops = new Set(m.links.map((l) => Math.round(l.y)));
    if (tops.size > 1) {
      fail(label, `リンクが折り返している top=${[...tops].join(",")}`);
    }
    for (const link of m.links) {
      if (link.h < MIN_TAP_H) {
        fail(label, `${link.text} の押せる高さが ${link.h}px（${MIN_TAP_H}px 以上）`);
      }
      if (link.w <= 0) fail(label, `${link.text} が潰れている`);
      // hover-audit.mjs はデスクトップ幅で走る（この帯は md:hidden で出ない）ので、
      // 押せる見た目の担保はここで持つ。
      if (link.cursor !== "pointer") {
        fail(label, `${link.text} の cursor が ${link.cursor}`);
      }
    }
    const last = m.toggle ?? m.links.at(-1);
    if (last && last.right > m.rect.w - m.padRight + 0.5) {
      fail(label, `右端が内側に収まっていない right=${last.right} / 内寸 ${m.rect.w - m.padRight}`);
    }

    // 4. ふりがなトグル（Sheet を畳んだ先。押せる面が 24px 未満だと届かない）
    if (!m.toggle) {
      fail(label, "ふりがなトグルが無い");
    } else if (m.toggle.h < 24 || m.toggle.w < 24) {
      fail(label, `ふりがなトグルが ${m.toggle.w}×${m.toggle.h}px（24px 以上）`);
    } else if (m.toggle.label !== "ふりがな") {
      fail(label, `ふりがなトグルの aria-label が "${m.toggle.label}"`);
    } else if (m.toggle.cursor !== "pointer") {
      fail(label, `ふりがなトグルの cursor が ${m.toggle.cursor}`);
    }

    // 5. 現在地は朱1本だけ・aria-current はそのページ自身にだけ
    const colors = new Set(m.links.map((l) => l.color));
    const activeLink = m.links.find((l) => l.href === target.active);
    if (target.active === null) {
      if (colors.size !== 1) fail(label, `現在地でない面で色が割れている ${[...colors].join(" / ")}`);
    } else if (!activeLink) {
      fail(label, `現在地 ${target.active} のリンクが無い`);
    } else {
      const others = m.links.filter((l) => l !== activeLink).map((l) => l.color);
      if (others.includes(activeLink.color)) {
        fail(label, `現在地 ${target.active} が他のリンクと同じ色（朱になっていない）`);
      }
      if (new Set(others).size !== 1) {
        fail(label, `現在地以外の色が割れている ${others.join(" / ")}`);
      }
    }
    const currents = m.links.filter((l) => l.current === "page").map((l) => l.href);
    const expectedCurrent = PAGES.some((p) => p.path === target.path && p.path === target.active)
      ? [target.active]
      : [];
    if (currents.join() !== expectedCurrent.join()) {
      fail(
        label,
        `aria-current="page" が [${currents.join()}]（期待 [${expectedCurrent.join()}]）`,
      );
    }

    // 余りは「最後のリンクの右端とふりがなトグルの左端の間」で見る（nav が flex-1 で
    // 伸びるため、トグルの右端は幅にかかわらず常に内寸の右端に来る＝指標にならない）。
    const slack = m.toggle ? m.toggle.x - m.links.at(-1).right : 0;
    if (slack < 4) {
      fail(label, `リンクとふりがなトグルが詰まっている（間 ${Math.round(slack)}px）`);
    }
    console.log(
      `  ${label}  高さ${Math.round(m.rect.h)}px  リンク右端 ${Math.round(
        m.links.at(-1).right,
      )}px  トグル ${Math.round(m.toggle?.w ?? 0)}px  余り ${Math.round(slack)}px`,
    );
  }

  await ctx.close();
}

// md 以上ではこの帯そのものが出ない（サイドバーが担う）。出てしまうと二重になる。
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 900 }, locale: "ja-JP" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const visible = await page.evaluate(() => {
    const header = document.querySelector("header");
    return header ? window.getComputedStyle(header).display !== "none" : false;
  });
  if (visible) fail("1024px /", "md 以上でモバイルヘッダーが出ている（md:hidden が外れた）");
  else console.log("  1024px /  モバイルヘッダーは非表示（サイドバーが担う）");
  await ctx.close();
}

await browser.close();
server?.close();

console.log(`\nNG: ${ng}`);
process.exit(ng === 0 ? 0 : 1);
