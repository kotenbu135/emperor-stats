// 候補エンジンで同じグラフを組み、幅・高さ・交差数・所要時間を比べる。
import fs from 'node:fs'
import path from 'node:path'
import ELK from 'elkjs/lib/elk.bundled.js'
import dagre from '@dagrejs/dagre'

const DIR = path.dirname(new URL(import.meta.url).pathname)
const ERAS = process.argv.slice(2)

const NODE_SEP = 24
const RANK_SEP = 44

function crossings(nodes, edges) {
  const at = new Map(nodes.map((n) => [n.id, n]))
  const segs = edges
    .map((e) => {
      const a = at.get(e.source), b = at.get(e.target)
      if (!a || !b) return null
      return [a.x + a.w / 2, a.y + a.h, b.x + b.w / 2, b.y]
    })
    .filter(Boolean)
  const ccw = (ax, ay, bx, by, cx, cy) => (cy - ay) * (bx - ax) - (by - ay) * (cx - ax)
  let n = 0
  for (let i = 0; i < segs.length; i++)
    for (let j = i + 1; j < segs.length; j++) {
      const [a, b, c, d] = segs[i], [e, f, g, h] = segs[j]
      const d1 = ccw(a, b, c, d, e, f), d2 = ccw(a, b, c, d, g, h)
      const d3 = ccw(e, f, g, h, a, b), d4 = ccw(e, f, g, h, c, d)
      if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) n++
    }
  return n
}

// 同じ親から下りた兄弟が childOrder の順に左から並んでいるか（違反ペア数 / 判定できたペア数）
function siblingOrder(nodes, edges) {
  const at = new Map(nodes.map((n) => [n.id, n]))
  const byParent = new Map()
  for (const e of edges) {
    if (e.kind !== 'to-child' || e.childOrder == null) continue
    if (!byParent.has(e.source)) byParent.set(e.source, [])
    byParent.get(e.source).push(e)
  }
  let bad = 0, total = 0
  for (const sibs of byParent.values()) {
    for (let i = 0; i < sibs.length; i++)
      for (let j = i + 1; j < sibs.length; j++) {
        const a = sibs[i], b = sibs[j]
        if (a.childOrder === b.childOrder) continue
        const ax = at.get(a.target)?.x, bx = at.get(b.target)?.x
        if (ax == null || bx == null || ax === bx) continue
        total++
        if ((a.childOrder < b.childOrder) !== (ax < bx)) bad++
      }
  }
  return total ? `${bad}/${total}` : '—'
}

function bbox(nodes) {
  const x0 = Math.min(...nodes.map((n) => n.x)), x1 = Math.max(...nodes.map((n) => n.x + n.w))
  const y0 = Math.min(...nodes.map((n) => n.y)), y1 = Math.max(...nodes.map((n) => n.y + n.h))
  return { w: Math.round(x1 - x0), h: Math.round(y1 - y0) }
}

function runDagre(g) {
  const gr = new dagre.graphlib.Graph({ compound: false })
  gr.setGraph({ rankdir: 'TB', nodesep: NODE_SEP, ranksep: RANK_SEP, marginx: 16, marginy: 16 })
  gr.setDefaultEdgeLabel(() => ({}))
  for (const n of g.nodes) gr.setNode(n.id, { width: n.w, height: n.h })
  for (const e of g.edges) gr.setEdge(e.source, e.target)
  dagre.layout(gr)
  const nodes = g.nodes.map((n) => {
    const p = gr.node(n.id)
    return { ...n, x: p.x - n.w / 2, y: p.y - n.h / 2 }
  })
  return nodes
}

async function runElk(g, opts, label) {
  const elk = new ELK()
  const res = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': String(NODE_SEP),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(RANK_SEP),
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.thoroughness': '20',
      ...opts,
    },
    children: g.nodes.map((n) => ({ id: n.id, width: n.w, height: n.h })),
    edges: g.edges.map((e, i) => ({ id: `e${i}`, sources: [e.source], targets: [e.target] })),
  })
  const at = new Map(res.children.map((c) => [c.id, c]))
  return g.nodes.map((n) => ({ ...n, x: at.get(n.id).x, y: at.get(n.id).y }))
}

const rows = []
for (const era of ERAS) {
  const g = JSON.parse(fs.readFileSync(path.join(DIR, `graph-${era}.json`), 'utf8'))
  const runs = [
    ['dagre', async () => runDagre(g)],
    ['elk(自由)', () => runElk(g, {})],
    ['elk(順序尊重)', () => runElk(g, {
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
    })],
    ['elk(順序ヒント)', () => runElk(g, {
      'elk.layered.considerModelOrder.strategy': 'PREFER_EDGES',
    })],
  ]
  for (const [name, fn] of runs) {
    const t0 = performance.now()
    const nodes = await fn()
    const ms = performance.now() - t0
    const b = bbox(nodes)
    rows.push({ era, engine: name, n: g.nodes.length, w: b.w, h: b.h, aspect: +(b.w / b.h).toFixed(1), cross: crossings(nodes, g.edges), 兄弟順違反: siblingOrder(nodes, g.edges), ms: Math.round(ms) })
    fs.writeFileSync(path.join(DIR, `pos-${era}-${name}.json`), JSON.stringify({ nodes, edges: g.edges }))
  }
}
console.table(rows)
const tot = {}
for (const r of rows) {
  tot[r.engine] ??= { cross: 0, ms: 0, maxW: 0 }
  tot[r.engine].cross += r.cross; tot[r.engine].ms += r.ms
  tot[r.engine].maxW = Math.max(tot[r.engine].maxW, r.w)
}
console.log('\n合計（全章）:'); console.table(tot)
