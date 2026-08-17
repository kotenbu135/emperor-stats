// スパイクの結果を目視できる SVG に落とす（構造の確認用・配色は当てていない）
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.dirname(new URL(import.meta.url).pathname)
const [era, engine, outPath] = process.argv.slice(2)
const { nodes, edges } = JSON.parse(fs.readFileSync(path.join(DIR, `pos-${era}-${engine}.json`), 'utf8'))

const at = new Map(nodes.map((n) => [n.id, n]))
const PAD = 24
const x0 = Math.min(...nodes.map((n) => n.x)) - PAD
const y0 = Math.min(...nodes.map((n) => n.y)) - PAD
const W = Math.max(...nodes.map((n) => n.x + n.w)) - x0 + PAD
const H = Math.max(...nodes.map((n) => n.y + n.h)) - y0 + PAD
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

const lines = edges.map((e) => {
  const a = at.get(e.source), b = at.get(e.target)
  if (!a || !b) return ''
  const ax = a.x - x0 + a.w / 2, ay = a.y - y0 + a.h
  const bx = b.x - x0 + b.w / 2, by = b.y - y0
  const my = (ay + by) / 2
  const stroke = e.kind === 'to-union' ? '#9aa3ae' : '#5b6470'
  return `<path d="M${ax} ${ay} V${my} H${bx} V${by}" fill="none" stroke="${stroke}" stroke-width="1.2"/>`
}).join('\n')

const boxes = nodes.map((n) => {
  const x = n.x - x0, y = n.y - y0
  if (n.kind === 'group') return `<g><rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="10" fill="#f7f8fa" stroke="#c9d0d9"/><text x="${x + 14}" y="${y + 24}" font-family="Noto Sans CJK JP, sans-serif" font-size="17" fill="#48525f">${esc(n.label)}</text></g>`
  if (n.kind === 'union') return `<circle cx="${x + 4}" cy="${y + 4}" r="3.5" fill="#5b6470"/>`
  const emp = n.kind === 'emperor'
  const label = n.label.length > 6 ? n.label.slice(0, 6) + '…' : n.label
  return `<g><rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="6" fill="${emp ? '#ffffff' : '#f4f5f7'}" stroke="${emp ? '#26303c' : '#a8b0ba'}" stroke-width="${emp ? 1.4 : 1}" ${emp ? '' : 'stroke-dasharray="3 3"'}/><text x="${x + n.w / 2}" y="${y + n.h / 2 + 5}" text-anchor="middle" font-family="Noto Sans CJK JP, sans-serif" font-size="14" fill="#1c2530">${esc(label)}</text></g>`
}).join('\n')

fs.writeFileSync(outPath, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><text x="12" y="20" font-family="sans-serif" font-size="13" fill="#66707c">${esc(era)} / ${esc(engine)} / ${nodes.length} nodes / ${W}×${H}px</text>${lines}${boxes}</svg>`)
console.log(outPath, `${W}x${H}`)
