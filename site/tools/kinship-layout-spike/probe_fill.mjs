// 箱の面の色が本当に政権色を帯びているかを実測する（目視だと薄い色は当てにならない）。
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(`file://${process.argv[2]}`)
const rows = await page.evaluate(() => {
  const out = []
  for (const g of [...document.querySelectorAll('g.node')].slice(0, 400)) {
    const r = g.querySelector('rect')
    const mark = g.querySelector('rect.mark')
    if (!mark) continue
    const label = g.querySelector('text')?.textContent?.trim()
    out.push({
      label,
      fill: getComputedStyle(r).fill,
      stroke: getComputedStyle(r).stroke,
      mark: getComputedStyle(mark).fill,
    })
  }
  return out
})
const seen = new Map()
for (const r of rows) if (!seen.has(r.mark)) seen.set(r.mark, r)
for (const [, r] of seen) console.log(`${r.label}\n  印 ${r.mark}\n  面 ${r.fill}\n  縁 ${r.stroke}`)
await browser.close()
