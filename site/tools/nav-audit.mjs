// 図・カードから /database へ飛ばす導線の受け入れ確認（2026-08-17・Issue #94 の案4・案5）。
//
//   npm run dev -- --port 3100     # 別のターミナルで
//   node tools/nav-audit.mjs       # → NG: 0 を保つ
//
// 見るのは3つ。**どれも tsc・lint・build では落ちない**:
//
// 1. **件数の一致** — 凡例／カードが名乗る件数と、その href が着地した先の件数。
//    出どころは同じ EmperorRecord のフィールドなので構造的には一致するはずだが、
//    どちらかの集計を差し替えると「162名」のカードが161名の一覧へ黙って着地する。
// 2. **鍵が区分名の全文であること** — emperor-table.tsx の復元はカタログへの完全一致で
//    検査するので、`?accession=受禅`（短縮形）はエラーにならず全365名が出る。
// 3. **ソフトナビゲーションで復元されること** — `page.goto('?death=…')` はハード
//    ナビゲーションで、Link のクリックとは復元 effect が読む経路が違う。**必ずクリックで測る。**
//
// 対象の皇帝4人は「王朝24人／9人／11人」と「1人だけの政権（王莽＝新）」を含むように選んである
// （1人の政権では王朝カードが全員の一覧へ落ちる分岐に入る）。
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3100";
// emperor-types.ts の deathCauseCategoryOrder / accessionRouteCategoryOrder と同じ並び。
// 区分を増減したらここも直す（ここが古いと「カタログ外の鍵」で落ちる）。
const DEATH = ["病死", "暗殺", "処刑", "戦死", "自尽", "事故死", "不詳", "諸説あり"];
const ACCESSION = [
  "世襲", "擁立", "簒奪", "内禅", "継承（経緯記載なし）",
  "受禅（易姓）", "自立", "推戴",
];
const EMPERORS = [
  "qin-shi-huang", "tang-taizong", "nansong-gaozong", "qing-xuantong",
  "wang-mang", // 新は1人だけの政権 → 王朝カードが「皇帝一覧」へ落ちる
];

let ng = 0;
const fail = (m) => { ng += 1; console.log("NG\t" + m); };
const ok = (m) => console.log("ok\t" + m);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

/** /database の行数。絞り込みは useDeferredValue 越しなので落ち着くまで待つ。 */
async function rowCount() {
  await page
    .waitForFunction(
      () => (document.querySelector("table tbody")?.querySelectorAll("tr").length ?? 0) > 0,
      null,
      { timeout: 15000 },
    )
    .catch(() => {});
  let prev = -1;
  for (let i = 0; i < 30; i += 1) {
    const n = await page.locator("table tbody tr").count();
    if (n === prev) return n;
    prev = n;
    await page.waitForTimeout(120);
  }
  return prev;
}

/** /emperors の件数はカードの数で測る（本文の「全365名の一覧です」を拾わないため）。 */
async function cardCount() {
  await page.waitForTimeout(2000);
  return page.locator('a[href^="/emperors/"]').count();
}

async function landedCount(href) {
  await page.goto(BASE + href, { waitUntil: "networkidle" });
  return href.startsWith("/database") ? rowCount() : cardCount();
}

// ---- 案5: 内訳帯の凡例 --------------------------------------------------
await page.goto(BASE + "/", { waitUntil: "networkidle" });

const legend = await page.evaluate(() => {
  const out = [];
  for (const a of document.querySelectorAll('a[href^="/database?"]')) {
    const ariaLabel = a.getAttribute("aria-label") ?? "";
    if (!/皇帝\d+名をデータベースで見る$/.test(ariaLabel)) continue;
    const url = new URL(a.getAttribute("href"), location.origin);
    out.push({
      ariaLabel,
      param: url.searchParams.has("death") ? "death" : "accession",
      value: url.searchParams.get("death") ?? url.searchParams.get("accession"),
      count: Number(/皇帝(\d+)名/.exec(ariaLabel)[1]),
    });
  }
  return out;
});

// 死因は上位5区分＋その他・即位経路は8区分すべて（overview-board.tsx の foldRest）。
if (legend.length !== 5 + 8) fail(`凡例のリンクが13本でない: ${legend.length}本`);
else ok(`凡例のリンク13本`);

for (const l of legend) {
  const catalog = l.param === "death" ? DEATH : ACCESSION;
  if (!catalog.includes(l.value)) {
    fail(`カタログ外の鍵（短縮形を渡していないか）: ${l.param}=${l.value}`);
  }
}

const otherIsLink = await page.evaluate(() =>
  [...document.querySelectorAll("li")].some(
    (li) => /その他（\d+区分）/.test(li.textContent ?? "") && li.querySelector("a"),
  ),
);
if (otherIsLink) fail("「その他」がリンクになっている（1つの絞り込みに落ちない）");
else ok("「その他」はリンクではない");

for (const l of legend) {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.click(`a[aria-label="${l.ariaLabel}"]`); // goto ではなくクリックで測る
  await page.waitForURL(/\/database/, { timeout: 15000 });
  const n = await rowCount();
  const chipPrefix = l.param === "death" ? "死因: " : "即位経路: ";
  const hasChip = await page.evaluate(
    (p) =>
      [...document.querySelectorAll("button, span")].some((e) =>
        (e.textContent ?? "").trim().startsWith(p),
      ),
    chipPrefix,
  );
  if (n !== l.count) fail(`click ${l.param}=${l.value}: 凡例${l.count}名 → 表${n}行`);
  else if (!hasChip) fail(`click ${l.param}=${l.value}: 効いている条件のチップが出ない`);
  else ok(`click ${l.param}=${l.value}\t${n}行・チップあり`);
}

// ---- 案4: ページ末尾の「次に見る」 --------------------------------------
for (const path of ["/", ...EMPERORS.map((id) => `/emperors/${id}`)]) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  const cards = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-labelledby="next-up-heading"]');
    if (!nav) return null;
    return [...nav.querySelectorAll("a")].map((a) => ({
      href: a.getAttribute("href"),
      title: a.querySelector("span > span")?.textContent?.trim() ?? "",
      text: a.textContent.trim(),
    }));
  });
  if (!cards) { fail(`${path}: 「次に見る」が無い`); continue; }
  if (cards.length !== 3) fail(`${path}: カードが3枚でない（${cards.length}枚）`);
  for (const card of cards) {
    // 件数を名乗っていないカード（/about など）は着地先の件数を検査しない。
    const m = /(\d+)名/.exec(card.text);
    if (!m) { ok(`${path} ${card.title}\t件数なし → ${card.href}`); continue; }
    const claimed = Number(m[1]);
    const landed = await landedCount(card.href);
    if (landed !== claimed) fail(`${path} ${card.href}: カード${claimed}名 → 着地${landed}名`);
    else ok(`${path} ${card.title}\t${claimed}名 一致`);
  }
}

console.log(`\nNG: ${ng}`);
await browser.close();
process.exit(ng === 0 ? 0 : 1);
