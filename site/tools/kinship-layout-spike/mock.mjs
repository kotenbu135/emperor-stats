// 系譜図のデザイン検討用モック。
//
//   node mock.mjs              前漢の幹だけを切り出した拡大図（第一印象を見る用）
//   node mock.mjs <eraId>      章まるごと（実寸で成立するかを見る用）
//
// - 配色・書体・角丸は site/src/app/globals.css の @palette ブロックと
//   site/src/lib/dynasty-colors.ts の DYNASTY_COLOR_SLOT をその場で読んで使う
//   （値をこのファイルに書き写さない）。
// - 家系図の文法は旧 /kinship で承認済みのものを移植する:
//   夫＋妃を1つの家族箱にまとめて横に並べ、妃ごとの連結線の中点から子を垂下、
//   兄弟は横バーで束ねる。皇帝＝実線カプセル（王朝色）／非皇帝＝破線ピル（灰）／
//   配偶者＝丸ピル。矢印は王朝間の交代だけ。
// - 座標は ELK（elk.layered）が決める。手置きの座標は持たない。
import fs from 'node:fs'
import path from 'node:path'
import ELK from 'elkjs/lib/elk.bundled.js'

const HERE = path.dirname(new URL(import.meta.url).pathname)
const ROOT = path.resolve(HERE, '../../..')
const kin = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/kinship.json'), 'utf8'))
const em = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/emperors.json'), 'utf8'))
const css = fs.readFileSync(path.join(ROOT, 'site/src/app/globals.css'), 'utf8')
const dynTs = fs.readFileSync(path.join(ROOT, 'site/src/lib/dynasty-colors.ts'), 'utf8')

const palette = css.slice(css.indexOf('/* @palette:start */'), css.indexOf('/* @palette:end */'))
  .split('\n').filter((l) => /^\s*--/.test(l)).map((l) => l.trim()).join('\n  ')

// DYNASTY_COLOR_SLOT（政権ID → スロット）と、スロット → globals.css のトークン。
// スロット番号は --series-N の N ではない（dynasty-colors.ts の SLOT_HEX の並び）。
const SLOT = {}
for (const m of dynTs.slice(dynTs.indexOf('DYNASTY_COLOR_SLOT'), dynTs.indexOf('SLOT_HEX'))
  .matchAll(/"([\w-]+)":\s*(\d)/g)) SLOT[m[1]] = Number(m[2])
const SLOT_TOKEN = ['--kinship-minor', '--series-1', '--series-6', '--series-5',
  '--series-4', '--series-3', '--series-2', '--series-7', '--series-8']

const P = Object.fromEntries(kin.persons.map((p) => [p.id, p]))
const EM = Object.fromEntries(em.emperors.map((e) => [e.id, e]))
const REGIME = Object.fromEntries(em.meta.catalogs.regimes.map((r) => [r.id, r.name]))
const ERA = Object.fromEntries((em.meta.catalogs.eras ?? []).map((r) => [r.id, r.label]))
const accLabel = Object.fromEntries(em.meta.catalogs.enums.accessionCategory.map((v) => [v.id, v.label]))
const sucLabel = Object.fromEntries((em.meta.catalogs.enums.kinshipSuccessionCategory ?? []).map((v) => [v.id, v.label]))

const isEmperor = (id) => id in EM
const isConsort = (id) => (P[id]?.kind ?? '').startsWith('consort')
const regimeOf = (id) => EM[id]?.regimeId ?? null
const slotOf = (id) => SLOT[regimeOf(id)] ?? 0

// ── 出す人 ──────────────────────────────────────────────────────────────
const CROP = [
  'p-liu-taigong', 'p-liu-ao', 'han-gaozu', 'p-lyu-zhi', 'p-bo-ji',
  'han-huidi', 'han-wendi', 'p-doushi-han-wendi', 'han-qianshaodi', 'han-houshaodi',
  'han-jingdi', 'p-wang-zhi', 'han-wudi', 'p-zhao-jieyu',
  'p-liu-ju', 'p-liu-bo', 'han-zhaodi',
]
const era = process.argv[2] ?? null
function eraOf(id) {
  if (id in P) return P[id].eraId
  const e = EM[id]
  if (!e) return null
  const v = e.eraId ?? e.era
  return typeof v === 'object' && v ? v.id : v
}
const universe = new Set([...Object.keys(P), ...kin.edges.flatMap((e) => [e.from, e.to]).filter(Boolean)])
let SUBSET = era ? [...universe].filter((id) => eraOf(id) === era).sort() : CROP
// 血縁でも婚姻でも章内の誰ともつながらない人は図に出さない（つないだ線が1本も無い箱が
// 最上段に並ぶだけになる）。旧実装で chapters.ts のキュレーションが担っていた仕事。
{
  const set = new Set(SUBSET)
  const linked = new Set()
  for (const e of kin.edges) {
    if (!e.from || !set.has(e.from) || !set.has(e.to)) continue
    if (e.type === 'succession') continue
    linked.add(e.from); linked.add(e.to)
  }
  const dropped = SUBSET.filter((id) => !linked.has(id))
  if (dropped.length) process.stderr.write(`孤立ノードを除外: ${dropped.length}人\n`)
  SUBSET = SUBSET.filter((id) => linked.has(id))
}
const inSet = new Set(SUBSET)

const PARENT_RELS = new Set(['birth-father', 'birth-mother', 'adoptive-father', 'adoptive-mother'])
const father = {}, mother = {}, adopted = new Set()
// 同じ子に親エッジが複数ある（実父と異説の父／実母と養母）。実親・確定を優先する
// ——素直に上書きすると、始皇帝の父が荘襄王から呂不韋（異説）に、章帝の母が
// 賈貴人（実母）から明徳馬皇后（養母）に置き換わって、実親が図から消える。
const rank = (e) => (e.relation.startsWith('birth') ? 0 : 1) + (e.veracity === 'verified' ? 0 : 2)
const adoptiveMother = {}
for (const e of kin.edges) {
  if (e.type !== 'kinship' || !PARENT_RELS.has(e.relation)) continue
  if (!inSet.has(e.from) || !inSet.has(e.to)) continue
  if (e.relation === 'adoptive-mother') adoptiveMother[e.to] = e.from
  const slot = e.relation.endsWith('father') ? father : mother
  const cur = slot[e.to]
  if (cur && rank(cur.e) <= rank(e)) continue
  slot[e.to] = { id: e.from, e }
}
for (const [k, v] of Object.entries(father)) { father[k] = v.id; if (v.e.relation.startsWith('adoptive')) adopted.add(k) }
for (const [k, v] of Object.entries(mother)) { mother[k] = v.id; if (v.e.relation.startsWith('adoptive')) adopted.add(k) }
const empress = new Set()
const marriedTo = {}
for (const e of kin.edges) {
  if (e.type !== 'marriage' || !inSet.has(e.from) || !inSet.has(e.to)) continue
  empress.add(e.from); empress.add(e.to)
  const [w, h] = isConsort(e.from) ? [e.from, e.to] : [e.to, e.from]
  marriedTo[w] = h
}

function label1(id) {
  if (isEmperor(id)) {
    const n = EM[id].name
    const common = n.commonName ?? n.personalName
    const personal = n.personalName
    return personal && !common.includes(personal) ? `${common}・${personal}` : common
  }
  const raw = P[id]?.name ?? id
  // 〔〕の中は諡号などの但し書きなので普段は落とすが、落とすと同名になる人がいる章では
  // 残す（章に「何氏」が2人いるのに両方「何氏」と出る）。
  return SAME_NAME.has(raw.replace(/〔.*?〕/g, '')) ? raw : raw.replace(/〔.*?〕/g, '')
}
const SAME_NAME = new Set()
function label2(id) {
  if (!isEmperor(id)) return null
  const e = EM[id]
  const order = e.reigns.map((r) => r.dynastyOrder).find((v) => v != null)
  const route = (accLabel[e.accessionRoute?.categoryId] ?? '').replace(/（.*?）/g, '')
  return [order ? `第${order}代` : null, route].filter(Boolean).join('・')
}

// ── 家族箱（夫＋その妃たち）─────────────────────────────────────────────
const EMP_H = 50, PIL_H = 30, CON_H = 30, SPOUSE_GAP = 24
const textW = (s, px) => [...s].reduce((w, ch) => w + (/[\x00-\x7F]/.test(ch) ? px * 0.55 : px), 0)
const nodeW = (id) => (isEmperor(id)
  ? Math.max(128, Math.ceil(Math.max(textW(label1(id), 14), textW(label2(id) ?? '', 11)) + 28))
  : Math.max(88, Math.ceil(textW(label1(id), 12.5) + 24)))

// 同名になる人を先に洗い出す（label1 が〔〕を残すかの判定に使う）
{
  const count = {}
  for (const id of SUBSET) {
    if (isEmperor(id)) continue
    const k = (P[id]?.name ?? id).replace(/〔.*?〕/g, '')
    count[k] = (count[k] ?? 0) + 1
  }
  for (const [k, n] of Object.entries(count)) if (n > 1) SAME_NAME.add(k)
}

// 母は夫の脇へ付ける。**`kind` で判定しない** — kind が consort-* でない母
// （宗室の女性など）を弾くと、線が1本もつながらない箱として最上段に取り残される。
const isSpouseNode = (id) => !isEmperor(id)
const consortsOf = {}
for (const c of SUBSET) {
  const f = father[c], m = mother[c]
  if (f && m && isSpouseNode(m)) (consortsOf[f] ??= []).push(m)
  // 養母は実母と別に夫の脇へ付ける（養子縁組は破線で示すので実母と混ざらない）
  const am = adoptiveMother[c]
  if (f && am && isSpouseNode(am)) (consortsOf[f] ??= []).push(am)
}
for (const [w, h] of Object.entries(marriedTo)) if (inSet.has(h)) (consortsOf[h] ??= []).push(w)
for (const k of Object.keys(consortsOf)) consortsOf[k] = [...new Set(consortsOf[k])]

// 実際に線がつながる人だけを図に出す（親子・婚姻の解決結果で判定する。
// 生データのエッジで判定すると、異説の父・養母のように「採らなかったエッジ」しか
// 持たない人が、線が1本もない箱として最上段に並ぶ）。
{
  const attachedNow = new Set(Object.values(consortsOf).flat())
  const dropped = []
  for (let pass = 0; pass < 4; pass++) {
    const alive = new Set(SUBSET)
    const keep = SUBSET.filter((id) => {
      if (attachedNow.has(id)) return true                              // 誰かの脇に付いている
      if (alive.has(father[id]) || alive.has(mother[id])) return true   // 親が図にいる
      return SUBSET.some((c) => (father[c] === id || mother[c] === id)) // 子が図にいる
    })
    if (keep.length === SUBSET.length) break
    dropped.push(...SUBSET.filter((id) => !keep.includes(id)))
    SUBSET = keep
  }
  if (dropped.length) process.stderr.write(`線がつながらない人を除外: ${dropped.length}人 ${dropped.map(label1).join('・')}\n`)
  for (const id of dropped) inSet.delete(id)
}

const attached = new Set(Object.values(consortsOf).flat())
const boxOf = {}, boxes = []
for (const id of SUBSET) {
  if (attached.has(id)) continue
  const wives = consortsOf[id] ?? []
  const selfW = nodeW(id), selfH = isEmperor(id) ? EMP_H : PIL_H
  const box = {
    id: `box:${id}`, head: id, wives, selfW, selfH,
    w: selfW + wives.reduce((a, wf) => a + SPOUSE_GAP + nodeW(wf), 0),
    h: Math.max(selfH, CON_H),
  }
  boxes.push(box); boxOf[id] = box.id
  for (const wf of wives) boxOf[wf] = box.id
}
const boxById = Object.fromEntries(boxes.map((b) => [b.id, b]))

const elkEdges = []
for (const c of SUBSET) {
  const f = father[c] ?? mother[c]
  if (!f || !boxOf[c] || !boxOf[f] || boxOf[c] === boxOf[f]) continue
  elkEdges.push({ id: `e${elkEdges.length}`, sources: [boxOf[f]], targets: [boxOf[c]] })
}

const res = await new ELK().layout({
  id: 'root',
  layoutOptions: {
    'elk.algorithm': 'layered',
    'elk.direction': 'DOWN',
    'elk.layered.considerModelOrder.strategy': 'PREFER_EDGES',
    'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    'elk.spacing.nodeNode': '30',
    'elk.spacing.componentComponent': '56',
    // 連結成分の詰め込みは既定だと横へ広がる。縦長の面（縦スクロールで読む）に寄せる。
    'elk.aspectRatio': process.env.ELK_ASPECT ?? '0.7',
    'elk.layered.spacing.nodeNodeBetweenLayers': '72',
    'elk.layered.thoroughness': '20',
  },
  children: boxes.map((b) => ({ id: b.id, width: b.w, height: b.h })),
  edges: elkEdges,
})
for (const c of res.children) Object.assign(boxById[c.id], { x: c.x, y: c.y })

// ── 描画 ────────────────────────────────────────────────────────────────
const PAD = 28
const minX = Math.min(...boxes.map((b) => b.x)), minY = Math.min(...boxes.map((b) => b.y))
for (const b of boxes) { b.x -= minX; b.y -= minY }
const W = Math.max(...boxes.map((b) => b.x + b.w)) + PAD * 2
const H = Math.max(...boxes.map((b) => b.y + b.h)) + PAD * 2
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

const rect = {}
for (const b of boxes) {
  let cx = b.x + PAD
  rect[b.head] = { x: cx, y: b.y + PAD + (b.h - b.selfH) / 2, w: b.selfW, h: b.selfH }
  cx += b.selfW
  for (const wf of b.wives) {
    cx += SPOUSE_GAP
    const w = nodeW(wf)
    rect[wf] = { x: cx, y: b.y + PAD + (b.h - CON_H) / 2, w, h: CON_H }
    cx += w
  }
}

const tok = (id) => `var(${SLOT_TOKEN[slotOf(id)]})`
const fill = (id) => (isEmperor(id)
  ? `color-mix(in srgb, ${tok(id)} 22%, var(--background))`
  : isConsort(id)
    ? 'color-mix(in srgb, var(--foreground) 4%, var(--background))'
    : 'color-mix(in srgb, var(--foreground) 7%, var(--background))')
const stroke = (id) => (isEmperor(id)
  ? `color-mix(in srgb, ${tok(id)} 70%, var(--background))`
  : isConsort(id)
    ? 'color-mix(in srgb, var(--foreground) 26%, var(--background))'
    : 'color-mix(in srgb, var(--foreground) 32%, var(--background))')

const STRUCT = 'color-mix(in srgb, var(--foreground) 45%, var(--background))'
const lines = []

for (const b of boxes) {
  const hr = rect[b.head]
  let left = hr.x + hr.w
  for (const wf of b.wives) {
    const wr = rect[wf], y = hr.y + hr.h / 2
    if (empress.has(wf)) {
      lines.push(`<path d="M${left} ${y - 2.5} H${wr.x}" stroke="${STRUCT}" stroke-width="1.3" fill="none"/>`)
      lines.push(`<path d="M${left} ${y + 2.5} H${wr.x}" stroke="${STRUCT}" stroke-width="1.3" fill="none"/>`)
    } else {
      lines.push(`<path d="M${left} ${y} H${wr.x}" stroke="${STRUCT}" stroke-width="1.3" fill="none"/>`)
    }
    b[`j:${wf}`] = { x: (left + wr.x) / 2, y }
    left = wr.x + wr.w
  }
}

const groups = new Map()
for (const c of SUBSET) {
  const f = father[c] ?? mother[c], m = mother[c]
  if (!f || !boxOf[f] || boxOf[c] === boxOf[f]) continue
  const key = `${f}|${m && isSpouseNode(m) ? m : ''}`
  if (!groups.has(key)) groups.set(key, { head: f, mother: m && isSpouseNode(m) ? m : null, kids: [] })
  groups.get(key).kids.push(c)
}
for (const g of groups.values()) {
  const b = boxById[boxOf[g.head]]
  const hr = rect[g.head]
  const start = (g.mother && b[`j:${g.mother}`]) ?? { x: hr.x + hr.w / 2, y: hr.y + hr.h }
  const kidRects = g.kids.map((k) => rect[k]).filter(Boolean)
  if (!kidRects.length) continue
  const barY = Math.min(...kidRects.map((r) => r.y)) - 26
  const xs = kidRects.map((r) => r.x + r.w / 2)
  const x0 = Math.min(...xs, start.x), x1 = Math.max(...xs, start.x)
  const dash = g.kids.every((k) => adopted.has(k)) ? ' stroke-dasharray="5 3"' : ''
  lines.push(`<path d="M${start.x} ${start.y} V${barY}" stroke="${STRUCT}" stroke-width="1.3" fill="none"${dash}/>`)
  if (x1 - x0 > 0.5) lines.push(`<path d="M${x0} ${barY} H${x1}" stroke="${STRUCT}" stroke-width="1.3" fill="none"${dash}/>`)
  for (const r of kidRects) lines.push(`<path d="M${r.x + r.w / 2} ${barY} V${r.y}" stroke="${STRUCT}" stroke-width="1.3" fill="none"${dash}/>`)
}

// 王朝間の交代だけを矢印にする（同じ政権の中の継承はカプセル2行目で足りる）
const ARROW = 'var(--seal)'
const childrenOf = {}
for (const [c, f] of Object.entries(father)) (childrenOf[f] ??= []).push(c)
function ctxRegime(id, depth = 0) {
  if (isEmperor(id)) return regimeOf(id)
  if (depth > 4) return null
  for (const c of childrenOf[id] ?? []) {
    const r = ctxRegime(c, depth + 1)
    if (r) return r
  }
  return father[id] ? ctxRegime(father[id], depth + 1) : null
}
const arrows = []
for (const e of kin.edges) {
  if (e.type !== 'succession' || !e.from || !inSet.has(e.from) || !inSet.has(e.to)) continue
  // 交代の矢印は「政権と政権のあいだ」にだけ引く。同じ政権の中の継承は
  // カプセル2行目の「第N代」で足りる。非皇帝のつなぎ人物は自分の政権を持たないので、
  // 子（次いで親）の皇帝の政権を借りて判定する——これをやらないと、荘襄王→始皇帝の
  // ような同じ秦の中の継承にまで矢印が出る。
  if (ctxRegime(e.from) === ctxRegime(e.to)) continue
  const a = rect[e.from], b = rect[e.to]
  if (!a || !b) continue
  // 近い2政権は矢印で結ぶ。遠い2政権は線にしない——図を斜めに横断する長い線は、
  // 途中のカプセルを突き抜けて何と何を結んでいるのか読めなくなる。代わりに
  // 受けた側のカプセルに「◀ 前の政権名」の朱タグを出す。
  const dx = (a.x + a.w / 2) - (b.x + b.w / 2), dy = (a.y + a.h / 2) - (b.y + b.h / 2)
  const near = Math.hypot(dx, dy) < 420
  if (near) {
    const horiz = Math.abs(dy) < Math.max(a.h, b.h)
    const [p, q] = horiz
      ? [{ x: a.x < b.x ? a.x + a.w : a.x, y: a.y + a.h / 2 }, { x: a.x < b.x ? b.x : b.x + b.w, y: b.y + b.h / 2 }]
      : [{ x: a.x + a.w / 2, y: a.y < b.y ? a.y + a.h : a.y }, { x: b.x + b.w / 2, y: a.y < b.y ? b.y : b.y + b.h }]
    const mid = horiz ? `H${(p.x + q.x) / 2} V${q.y} ` : `V${(p.y + q.y) / 2} H${q.x} `
    arrows.push(`<path d="M${p.x} ${p.y} ${mid}${horiz ? `H${q.x}` : `V${q.y}`}" stroke="${ARROW}"
      stroke-width="1.4" fill="none" marker-end="url(#arw)" opacity=".9"/>`)
  } else {
    const from = REGIME[ctxRegime(e.from)] ?? ''
    const t = `${from}から`
    const w = textW(t, 10.5) + 16
    arrows.push(`<g><rect x="${b.x + b.w / 2 - w / 2}" y="${b.y - 20}" width="${w}" height="17" rx="8.5"
        fill="color-mix(in srgb, var(--seal) 12%, var(--background))" stroke="color-mix(in srgb, var(--seal) 45%, var(--background))"/>
      <text x="${b.x + b.w / 2}" y="${b.y - 7.5}" class="tag">${esc(t)}</text></g>`)
  }
}

const nodes = SUBSET.filter((id) => rect[id]).map((id) => {
  const r = rect[id], emp = isEmperor(id)
  const rx = isConsort(id) ? r.h / 2 : 7
  const dash = !emp && !isConsort(id) ? ' stroke-dasharray="4 3"' : ''
  const l1 = label1(id), l2 = label2(id), cx = r.x + r.w / 2
  const text = emp && l2
    ? `<text x="${cx}" y="${r.y + 21}" class="n1">${esc(l1)}</text><text x="${cx}" y="${r.y + 38}" class="n2">${esc(l2)}</text>`
    : `<text x="${cx}" y="${r.y + r.h / 2 + 4.5}" class="n3">${esc(l1)}</text>`
  return `<g><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${rx}" fill="${fill(id)}" stroke="${stroke(id)}" stroke-width="${emp ? 1.3 : 1}"${dash}/>${text}</g>`
}).join('\n')

// 章に出てくる政権のチップ（左から出現順）
const seen = new Map()
for (const b of boxes.slice().sort((p, q) => p.x - q.x)) {
  const r = regimeOf(b.head)
  if (r && !seen.has(r)) seen.set(r, slotOf(b.head))
}
const chips = [...seen].map(([r, s]) => `<span class="chip"><i style="background:var(${SLOT_TOKEN[s]})"></i>${esc(REGIME[r] ?? r)}</span>`).join('')

const legend = [
  ['皇帝（政権ごとの色）', `<rect x="0" y="4" width="34" height="18" rx="6" fill="${fill('han-wudi')}" stroke="${stroke('han-wudi')}" stroke-width="1.3"/>`],
  ['皇帝でないつなぎの人物', `<rect x="0" y="6" width="34" height="15" rx="6" fill="${fill('p-liu-taigong')}" stroke="${stroke('p-liu-taigong')}" stroke-width="1" stroke-dasharray="4 3"/>`],
  ['后妃', `<rect x="0" y="6" width="34" height="15" rx="7.5" fill="${fill('p-lyu-zhi')}" stroke="${stroke('p-lyu-zhi')}" stroke-width="1"/>`],
  ['皇后（二重線）', `<path d="M2 11 H32" stroke="${STRUCT}" stroke-width="1.3"/><path d="M2 16 H32" stroke="${STRUCT}" stroke-width="1.3"/>`],
  ['王朝の交代', `<path d="M2 14 H28" stroke="${ARROW}" stroke-width="1.4" marker-end="url(#arw)"/>`],
].map(([t, g]) => `<div class="lg"><svg width="36" height="26" aria-hidden="true"><defs><marker id="arw" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 1 L9 5 L0 9 z" fill="${ARROW}"/></marker></defs>${g}</svg><span>${t}</span></div>`).join('')

const title = era ? (ERA[era] ?? era) : '秦・漢'
const sub = era
  ? `${SUBSET.length}人　${seen.size}政権`
  : '前221年〜220年　劉氏の幹（前漢・高帝〜昭帝）'

process.stdout.write(`<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>系譜図モック</title>
<style>
:root {
  ${palette}
  --font-sans: "Noto Sans JP", "Noto Sans CJK JP", sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--background); color: var(--foreground);
       font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }
.header { border-bottom: 1px solid var(--border); padding: 28px 32px; }
.header .row { display: flex; align-items: center; gap: 12px; }
.header .bar { width: 4px; height: 28px; border-radius: 999px; background: var(--seal); }
.header h1 { margin: 0; font-size: 30px; font-weight: 600; letter-spacing: .01em; }
.header p { margin: 8px 0 0; font-size: 14px; color: var(--muted-foreground); max-width: 42em; }
.wrap { padding: 32px; max-width: ${process.env.FIT ? 'none' : '1200px'}; }
${process.env.FIT ? '.wrap { width: max-content; } .card { width: max-content; min-width: 100%; }' : ''}
.card { border: 1px solid var(--border); border-radius: calc(var(--radius) + 4px);
        background: var(--card); box-shadow: 0 1px 2px oklch(0 0 0 / .05); overflow: hidden; }
.card > .head { padding: 18px 20px 14px; border-bottom: 1px solid var(--border); }
.card h2 { margin: 0; font-size: 17px; font-weight: 600; }
.card .sub { margin: 4px 0 0; font-size: 13px; color: var(--muted-foreground); }
.chips { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
.chip { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px;
        border: 1px solid var(--border); border-radius: 999px; padding: 4px 11px 4px 8px;
        background: var(--background); }
.chip i { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
.figure { padding: 22px 20px 8px; overflow-x: auto; display: flex; justify-content: center; }
.figure > svg { flex: 0 0 auto; }   /* 縮めない。入りきらない章は横スクロールで見る */
.legend { display: flex; gap: 22px; flex-wrap: wrap; padding: 14px 20px 18px;
          border-top: 1px solid var(--border); margin-top: 6px; }
.lg { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--muted-foreground); }
text { font-family: var(--font-sans); text-anchor: middle; }
.n1 { font-size: 14px; font-weight: 600; fill: var(--foreground); }
.n2 { font-size: 11px; fill: color-mix(in srgb, var(--foreground) 58%, var(--background)); }
.n3 { font-size: 12.5px; fill: color-mix(in srgb, var(--foreground) 78%, var(--background)); }
.tag { font-size: 10.5px; font-weight: 600; fill: var(--seal); }
</style></head><body>
<div class="header"><div class="row"><span class="bar"></span><h1>系譜・家系図</h1></div>
<p>誰の子が次の皇帝になったのかを、王朝ごとに家系図で追えるようにした面です。正史の本紀・列伝で確認できた血縁だけを線にしています。</p></div>
<div class="wrap"><div class="card">
  <div class="head"><h2>${esc(title)}</h2><p class="sub">${esc(sub)}</p><div class="chips">${chips}</div></div>
  <div class="figure"><svg width="${Math.round(W)}" height="${Math.round(H)}" viewBox="0 0 ${W} ${H}">
  <defs><marker id="arw" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 1 L9 5 L0 9 z" fill="${ARROW}"/></marker></defs>
${lines.join('\n')}
${arrows.join('\n')}
${nodes}
</svg></div>
  <div class="legend">${legend}</div>
</div></div>
</body></html>
`)
