// 図の x 方向の詰まり具合を見る。幅は「いちばん右の箱」で決まるので、
// 外れ値が1つあるだけで幅の指標が壊れる。
import fs from 'node:fs'
const html = fs.readFileSync(process.argv[2], 'utf8')
const boxes = [...html.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)"/g)]
  .map((m) => ({ x: +m[1], y: +m[2], w: +m[3] }))
  .filter((b) => b.w > 20)
const W = Math.max(...boxes.map((b) => b.x + b.w))
const BIN = 200
const bins = new Array(Math.ceil(W / BIN)).fill(0)
for (const b of boxes) bins[Math.floor((b.x + b.w / 2) / BIN)]++
console.log(`箱 ${boxes.length}・右端 ${Math.round(W)}px`)
bins.forEach((n, i) => console.log(`${String(i * BIN).padStart(5)}-${String((i + 1) * BIN).padStart(5)}  ${'█'.repeat(n)}${n ? ` ${n}` : ''}`))
const sorted = [...boxes].sort((a, b) => (b.x + b.w) - (a.x + a.w)).slice(0, 6)
console.log('右端に近い6件:', sorted.map((b) => `${Math.round(b.x)}..${Math.round(b.x + b.w)}`).join('  '))
