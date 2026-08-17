// 王朝バンド（＝政権ごとのまとまり）を ELK の compound node で作れるかを試す。
import fs from 'node:fs'
import path from 'node:path'
import ELK from 'elkjs/lib/elk.bundled.js'

const DIR = path.dirname(new URL(import.meta.url).pathname)
const era = process.argv[2]
const g = JSON.parse(fs.readFileSync(path.join(DIR, `graph-${era}.json`), 'utf8'))
const groupOf = JSON.parse(fs.readFileSync(path.join(DIR, `groups-${era}.json`), 'utf8'))

const groups = new Map()
for (const n of g.nodes) {
  const key = groupOf[n.id] ?? '_none'
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(n)
}
console.log('グループ数:', groups.size, [...groups].map(([k, v]) => `${k}:${v.length}`).join(' '))

const elk = new ELK()
const t0 = performance.now()
const res = await elk.layout({
  id: 'root',
  layoutOptions: {
    'elk.algorithm': 'layered', 'elk.direction': 'DOWN',
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    'elk.layered.considerModelOrder.strategy': 'PREFER_EDGES',
    'elk.spacing.nodeNode': '24', 'elk.layered.spacing.nodeNodeBetweenLayers': '44',
    'elk.padding': '[top=32,left=16,bottom=16,right=16]',
  },
  children: [...groups].map(([key, ns]) => ({
    id: `g:${key}`,
    layoutOptions: { 'elk.padding': '[top=34,left=14,bottom=14,right=14]' },
    children: ns.map((n) => ({ id: n.id, width: n.w, height: n.h })),
  })),
  edges: g.edges.map((e, i) => ({ id: `e${i}`, sources: [e.source], targets: [e.target] })),
})
const ms = Math.round(performance.now() - t0)

// 絶対座標へ展開
const abs = []
const walk = (node, ox, oy) => {
  for (const c of node.children ?? []) {
    const x = ox + c.x, y = oy + c.y
    if (c.children?.length) { abs.push({ id: c.id, x, y, w: c.width, h: c.height, kind: 'group' }); walk(c, x, y) }
    else abs.push({ id: c.id, x, y, w: c.width, h: c.height, kind: g.nodes.find((n) => n.id === c.id)?.kind })
  }
}
walk(res, 0, 0)
const persons = abs.filter((a) => a.kind !== 'group')
const at = new Map(persons.map((n) => [n.id, n]))
let cross = 0
const segs = g.edges.map((e) => { const a = at.get(e.source), b = at.get(e.target); return a && b ? [a.x + a.w / 2, a.y + a.h, b.x + b.w / 2, b.y] : null }).filter(Boolean)
const ccw = (ax, ay, bx, by, cx, cy) => (cy - ay) * (bx - ax) - (by - ay) * (cx - ax)
for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
  const [a, b, c, d] = segs[i], [e, f, h, k] = segs[j]
  if (((ccw(a, b, c, d, e, f) > 0) !== (ccw(a, b, c, d, h, k) > 0)) && ((ccw(e, f, h, k, a, b) > 0) !== (ccw(e, f, h, k, c, d) > 0))) cross++
}
console.log(`グループ化: ${Math.round(res.width)}x${Math.round(res.height)}px  交差=${cross}  ${ms}ms`)
fs.writeFileSync(path.join(DIR, `pos-${era}-group.json`), JSON.stringify({
  nodes: [...abs.filter((a) => a.kind === 'group').map((a) => ({ ...a, label: a.id.slice(2) })), ...persons.map((p) => ({ ...p, label: g.nodes.find((n) => n.id === p.id)?.label ?? '' }))],
  edges: g.edges,
}))
