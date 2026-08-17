// スパイクの HTML を PNG にする（自分で見るため）。
// 使い方: node shoot.mjs <入力html> <出力png> [幅] [高さ]
import { chromium } from 'playwright'

const [, , src, out, w, h] = process.argv
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 })
await page.goto(`file://${src}`)
await page.waitForTimeout(300)
// .wrap が overflow:auto なので、ビューポートより右は**描かれない**（要素スクショでも白のまま）。
// 図の実寸までビューポートを広げてから撮る。
const box = await page.locator('svg').evaluate((s) => [s.width.baseVal.value, s.height.baseVal.value])
await page.setViewportSize({ width: Math.ceil(box[0]) + 80, height: Math.min(4000, Math.ceil(box[1]) + 200) })
await page.waitForTimeout(200)
if (w && h) {
  // 図の一部を切り出す（SVG の座標で指定する）
  const [x, y] = [Number(process.env.CX ?? 0), Number(process.env.CY ?? 0)]
  await page.evaluate(([x, y, w, h]) => {
    const svg = document.querySelector('svg')
    svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`)
    svg.setAttribute('width', String(w))
    svg.setAttribute('height', String(h))
  }, [x, y, Number(w), Number(h)])
  await page.waitForTimeout(200)
}
await page.locator('svg').screenshot({ path: out })
await browser.close()
