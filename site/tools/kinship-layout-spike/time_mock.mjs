// 縦軸＝実時間に戻した系譜図のスパイク（2026-08-17）。
//
// 3つを同時に確かめるためのもの:
//   1. 縦が実時間で固定されたとき、横位置ソルバがどこまで詰められるか
//      （下限は measure_time_axis_width.py が出している）
//   2. 線を React Flow の経路生成器（getSmoothStepPath・MIT）で引けるか。
//      純関数なので DOM なしで path 文字列が作れる＝ビルド時に静的 SVG へ焼ける
//   3. 承認済みの家系図の文法（夫婦連結線 → 垂下 → 兄弟バー → 各子）が
//      その経路生成器の組み合わせで書けるか
//
// 値は書き写さない。配色は globals.css、政権色は dynasty-colors.ts から読む。
//
// 使い方: node time_mock.mjs <eraId>   （既定は qin-han）

import fs from 'node:fs'
import path from 'node:path'
import { getSmoothStepPath } from '@xyflow/react'

const HERE = path.dirname(new URL(import.meta.url).pathname)
const ROOT = path.resolve(HERE, '../../..')
const ERA = process.argv[2] || 'qin-han'

const kin = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/kinship.json'), 'utf8'))
const em = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/emperors.json'), 'utf8'))
const css = fs.readFileSync(path.join(ROOT, 'site/src/app/globals.css'), 'utf8')
const dynTs = fs.readFileSync(path.join(ROOT, 'site/src/lib/dynasty-colors.ts'), 'utf8')

// ---------------------------------------------------------------- 承認済みの規範
// レビュー⑥〜⑧（2026-07-24・ユーザー承認）から。この4つは選ばずに従う。
const PX_PER_YEAR = 8            // 完全等間隔（局所引き伸ばしは廃止済み）
const MIN_CAPSULE_H = 44         // 短在位でも読める最小高（下辺だけが延びる）
const PERSON_H = 38              // 非皇帝は固定高
const LINK_GAP_Y = 12            // 親子の縦室（在位が隣接しても垂下線が見える）

const COL_GAP = 26               // 箱どうしの横の間隔
const PAD_X = 40
const PAD_TOP = 96
const RADIUS = 8                 // 下で globals.css の --radius に差し替える

// ---------------------------------------------------------------- 配色（ファイルから読む）
const palette = {}
for (const m of css.slice(css.indexOf('@palette:start'), css.indexOf('@palette:end'))
  .matchAll(/(--[\w-]+):\s*([^;]+);/g)) palette[m[1]] = m[2].trim()

const radiusRaw = palette['--radius'] || '0.5rem'
const radiusPx = radiusRaw.endsWith('rem') ? parseFloat(radiusRaw) * 16 : parseFloat(radiusRaw)
const CORNER = Number.isFinite(radiusPx) ? radiusPx : RADIUS

const SLOT = {}
for (const m of dynTs.slice(dynTs.indexOf('DYNASTY_COLOR_SLOT'), dynTs.indexOf('SLOT_HEX'))
  .matchAll(/"([^"]+)":\s*(\d+)/g)) SLOT[m[1]] = Number(m[2])
const SLOT_TOKEN = ['--kinship-minor', '--series-1', '--series-6', '--series-5',
  '--series-4', '--series-3', '--series-2', '--series-7', '--series-8']

// ---------------------------------------------------------------- データ
const P = new Map(kin.persons.map((p) => [p.id, p]))
const EM = new Map(em.emperors.map((e) => [e.id, e]))
const REGIME = new Map(em.meta.catalogs.regimes.map((r) => [r.id, r]))

const eraOf = (id) => (P.has(id) ? P.get(id).eraId : EM.get(id)?.eraId)
const inEra = (id) => eraOf(id) === ERA

const nameOf = (id) => {
  if (EM.has(id)) {
    const n = EM.get(id).name || {}
    return n.commonName || n.personalName || id
  }
  return P.get(id)?.name || id
}

function yearOf(v) {
  if (v == null) return null
  const s = String(v)
  const neg = s.startsWith('-')
  const head = (neg ? s.slice(1) : s).split('-')[0]
  if (!/^\d+$/.test(head)) return null
  return neg ? -Number(head) : Number(head)
}

// --- 箱を作る（皇帝＝在位ごと・非皇帝＝固定高） --------------------------------
/** @type {Map<string, {id, key, label, sub, y0, y1, w, kind, regimeId}>} */
const boxes = new Map()

for (const e of em.emperors) {
  if (e.eraId !== ERA) continue
  const reigns = e.reigns || []
  reigns.forEach((r, i) => {
    const s = yearOf(r.startDate) ?? r.startYear
    if (s == null) return
    let t = yearOf(r.endDate) ?? r.endYear ?? s
    let y1 = t
    if (y1 - s < MIN_CAPSULE_H / PX_PER_YEAR) y1 = s + MIN_CAPSULE_H / PX_PER_YEAR
    const key = reigns.length > 1 ? `${e.id}#${i}` : e.id
    boxes.set(key, {
      id: e.id, key, label: nameOf(e.id),
      sub: reigns.length > 1 ? `第${i + 1}期` : '',
      y0: s, y1, kind: 'emperor', regimeId: e.regimeId,
    })
  })
}

for (const p of kin.persons) {
  if (p.eraId !== ERA) continue
  const b = p.birthYear, d = p.deathYear
  let mid = b != null && d != null ? (b + d) / 2 : (b ?? d)
  boxes.set(p.id, {
    id: p.id, key: p.id, label: p.name, sub: '',
    y0: mid == null ? null : mid - PERSON_H / PX_PER_YEAR / 2,
    y1: mid == null ? null : mid + PERSON_H / PX_PER_YEAR / 2,
    kind: 'person', regimeId: null, gender: p.gender,
  })
}

// 主在位（複数在位の1つ目）を人物 id から引く
const primaryKey = new Map()
for (const b of boxes.values()) if (!primaryKey.has(b.id)) primaryKey.set(b.id, b.key)

// --- 親子（union を作る） -----------------------------------------------------
const PARENT_REL = new Set(['birth-father', 'birth-mother', 'adoptive-father', 'adoptive-mother'])
const parentsOf = new Map()   // child id -> {father, mother, adoptive:boolean}
for (const e of kin.edges) {
  if (e.type !== 'kinship' || !PARENT_REL.has(e.relation)) continue
  if (!inEra(e.to) || !inEra(e.from)) continue
  if (!boxes.has(primaryKey.get(e.to)) || !boxes.has(primaryKey.get(e.from))) continue
  const cur = parentsOf.get(e.to) || { father: null, mother: null, adoptive: false }
  const slot = e.relation.endsWith('father') ? 'father' : 'mother'
  // 実親を異説・養親より優先する（素直に上書きすると実親が図から消える・6-2節）
  const isBirth = e.relation.startsWith('birth')
  if (cur[slot] == null || (isBirth && cur[`${slot}IsBirth`] !== true)) {
    cur[slot] = e.from
    cur[`${slot}IsBirth`] = isBirth
    if (!isBirth) cur.adoptive = true
  }
  parentsOf.set(e.to, cur)
}

const unionKey = (pp) => [pp.father, pp.mother].filter(Boolean).sort().join('+')
const unions = new Map()      // unionKey -> {parents:[ids], kids:[ids]}
for (const [child, pp] of parentsOf) {
  const k = unionKey(pp)
  if (!k) continue
  if (!unions.has(k)) unions.set(k, { key: k, parents: [pp.father, pp.mother].filter(Boolean), kids: [] })
  unions.get(k).kids.push(child)
}

// 子を年代順に並べる（childOrder は 68親セット中14しか順序を決めないので年で並べる）
const birthOf = (id) => {
  const b = boxes.get(primaryKey.get(id))
  return b?.y0 ?? Infinity
}
for (const u of unions.values()) u.kids.sort((a, b) => birthOf(a) - birthOf(b))

// --- 森を作る（親 → その union → 子） ----------------------------------------
const unionsOfParent = new Map()
for (const u of unions.values()) {
  const head = u.parents[0]           // 父がいれば父、いなければ母
  if (!unionsOfParent.has(head)) unionsOfParent.set(head, [])
  unionsOfParent.get(head).push(u)
}
const isChild = new Set([...unions.values()].flatMap((u) => u.kids))
const spouseOf = new Map()            // 連れ添いは親の脇に置く（独立ノードにしない）
for (const u of unions.values()) if (u.parents.length === 2) spouseOf.set(u.parents[1], u.parents[0])

const roots = [...boxes.values()]
  .filter((b) => b.key === primaryKey.get(b.id))
  .filter((b) => !isChild.has(b.id) && !spouseOf.has(b.id))
  .map((b) => b.id)

// ---------------------------------------------------------------- 幅（文字から決める）
const charW = (s) => [...s].reduce((a, c) => a + (/[\x00-\x7F]/.test(c) ? 8 : 15), 0)
for (const b of boxes.values()) {
  b.w = Math.max(96, Math.min(220, charW(b.label) + 28))
}
// 妃は夫の脇に付くので、夫の箱は自分＋妃ぶんの幅を占める
const attachedWidth = (id) => {
  const own = boxes.get(primaryKey.get(id))?.w ?? 0
  const spouses = (unionsOfParent.get(id) || []).flatMap((u) => u.parents.slice(1))
  return own + spouses.reduce((a, s) => a + (boxes.get(primaryKey.get(s))?.w ?? 0) + 14, 0)
}

// ---------------------------------------------------------------- 生没年の無い人物
// 旧実装は圧縮した最上部の帯へ置いていた。スパイクでは「最初の子の少し前」に推定して
// 図を切らずに出す（＝推定であることを図の上に書く）。
const inferred = new Set()
function inferYears() {
  let changed = true
  while (changed) {
    changed = false
    for (const u of unions.values()) {
      for (const p of u.parents) {
        const b = boxes.get(primaryKey.get(p))
        if (!b || b.y0 != null) continue
        const kidYs = u.kids.map((k) => boxes.get(primaryKey.get(k))?.y0).filter((v) => v != null)
        if (!kidYs.length) continue
        const y = Math.min(...kidYs) - 22
        b.y0 = y - PERSON_H / PX_PER_YEAR / 2
        b.y1 = y + PERSON_H / PX_PER_YEAR / 2
        inferred.add(b.key)
        changed = true
      }
    }
  }
}
inferYears()
for (const [k, b] of [...boxes]) if (b.y0 == null) boxes.delete(k)   // 手がかりが無い人は出さない

// ---------------------------------------------------------------- 横位置ソルバ
// Sugiyama の分離のうち「座標割り当て」に当たる部分。貪欲パッカーとの違いは2つ:
//   - 部分木ごとに輪郭（占有矩形の集合）を持ち、兄弟をずらす量は輪郭どうしの衝突から出す
//     （＝時間が重ならない部分木は同じ x を自然に共有し、左の空きポケットへは滑り込まない）
//   - 置いたあとに親を子の中心へ引き寄せる（線を直線化する）
const px = new Map()          // key -> x（箱の左端）
const yTop = (b) => b.y0
const yBot = (b) => b.y1

function rectsOf(id, dx = 0) {
  // id を根とする部分木が占める矩形（年単位の y・px の x）
  const out = []
  const seen = new Set()
  const walk = (nid) => {
    if (seen.has(nid)) return
    seen.add(nid)
    const b = boxes.get(primaryKey.get(nid))
    if (!b) return
    out.push({ x0: px.get(b.key) + dx, x1: px.get(b.key) + dx + attachedWidth(nid), y0: yTop(b), y1: yBot(b) })
    for (const u of unionsOfParent.get(nid) || []) for (const k of u.kids) walk(k)
  }
  walk(id)
  return out
}

const hits = (a, b) =>
  a.x0 < b.x1 + COL_GAP && b.x0 < a.x1 + COL_GAP &&
  a.y0 < b.y1 + LINK_GAP_Y / PX_PER_YEAR && b.y0 < a.y1 + LINK_GAP_Y / PX_PER_YEAR

function shift(id, dx) {
  const seen = new Set()
  const walk = (nid) => {
    if (seen.has(nid)) return
    seen.add(nid)
    const b = boxes.get(primaryKey.get(nid))
    if (b) px.set(b.key, px.get(b.key) + dx)
    for (const u of unionsOfParent.get(nid) || []) for (const k of u.kids) walk(k)
  }
  walk(id)
}

/** 部分木を仮に x=0 起点で組み、占有矩形を返す */
function layoutSubtree(id, seen = new Set()) {
  if (seen.has(id)) return []
  seen.add(id)
  const b = boxes.get(primaryKey.get(id))
  if (!b) return []
  px.set(b.key, 0)
  let placed = [{ x0: 0, x1: attachedWidth(id), y0: yTop(b), y1: yBot(b) }]

  const kids = (unionsOfParent.get(id) || []).flatMap((u) => u.kids)
  for (const kid of kids) {
    const kr = layoutSubtree(kid, seen)
    if (!kr.length) continue
    // 置ける最小の dx を探す（左詰め・ただし既に置いた矩形と時間が重なるものの右へ）
    let dx = 0
    for (let guard = 0; guard < 400; guard++) {
      const moved = kr.map((r) => ({ ...r, x0: r.x0 + dx, x1: r.x1 + dx }))
      const bad = moved.find((m) => placed.some((p) => hits(m, p)))
      if (!bad) break
      const blocker = placed.filter((p) => moved.some((m) => hits(m, p)))
        .reduce((a, p) => Math.max(a, p.x1), -Infinity)
      dx = blocker + COL_GAP - Math.min(...kr.map((r) => r.x0))
    }
    shift(kid, dx)
    placed = placed.concat(kr.map((r) => ({ ...r, x0: r.x0 + dx, x1: r.x1 + dx })))
  }

  // 親を子の中心へ寄せる（線を直線化する。子の側は動かさない）
  if (kids.length) {
    const cs = kids.map((k) => boxes.get(primaryKey.get(k))).filter(Boolean)
    if (cs.length) {
      const mid = cs.reduce((a, c) => a + px.get(c.key) + c.w / 2, 0) / cs.length
      const want = mid - attachedWidth(id) / 2
      const cur = px.get(b.key)
      const self = { x0: want, x1: want + attachedWidth(id), y0: yTop(b), y1: yBot(b) }
      const clash = placed.filter((p) => !(p.x0 === cur && p.y0 === yTop(b))).some((p) => hits(self, p))
      if (!clash && want > cur) px.set(b.key, want)
    }
  }
  return placed
}

// 根を左から順に、時間が重なるものだけ右へ送る
let occupied = []
for (const r of roots.sort((a, b) => birthOf(a) - birthOf(b))) {
  const rects = layoutSubtree(r)
  if (!rects.length) continue
  let dx = 0
  for (let guard = 0; guard < 400; guard++) {
    const moved = rects.map((x) => ({ ...x, x0: x.x0 + dx, x1: x.x1 + dx }))
    const bad = moved.some((m) => occupied.some((p) => hits(m, p)))
    if (!bad) break
    dx = occupied.filter((p) => moved.some((m) => hits(m, p)))
      .reduce((a, p) => Math.max(a, p.x1), 0) + COL_GAP
  }
  shift(r, dx)
  occupied = occupied.concat(rects.map((x) => ({ ...x, x0: x.x0 + dx, x1: x.x1 + dx })))
}

// ---------------------------------------------------------------- px 座標へ
const years = [...boxes.values()].flatMap((b) => [b.y0, b.y1])
const Y0 = Math.floor(Math.min(...years) / 25) * 25
const toY = (y) => PAD_TOP + (y - Y0) * PX_PER_YEAR
for (const b of boxes.values()) {
  b.X = PAD_X + (px.get(b.key) ?? 0)
  b.Y = toY(b.y0)
  b.H = Math.max(b.kind === 'emperor' ? MIN_CAPSULE_H : PERSON_H, (b.y1 - b.y0) * PX_PER_YEAR)
}
// 妃を夫の右脇・上端そろえで置く
for (const u of unions.values()) {
  if (u.parents.length < 2) continue
  const h = boxes.get(primaryKey.get(u.parents[0]))
  const s = boxes.get(primaryKey.get(u.parents[1]))
  if (!h || !s) continue
  s.X = h.X + h.w + 14
  s.Y = h.Y
  s.H = PERSON_H
  s.attached = true
}

const W = Math.ceil(Math.max(...[...boxes.values()].map((b) => b.X + b.w)) + PAD_X)
const H = Math.ceil(Math.max(...[...boxes.values()].map((b) => b.Y + b.H)) + 64)

// ---------------------------------------------------------------- 線（ライブラリ製）
// 承認済みの文法: 夫婦連結線（＝）→ その上の1点から垂下 → 兄弟バー → 各子へ。
// getSmoothStepPath は「1点 → 1点」を（下る・角丸・横へ・角丸・下る）で結ぶので、
// 同じ始点・同じ offset を全ての子に使うと、横に走る区間がそろって兄弟バーになる。
const edgesSvg = []
for (const u of unions.values()) {
  const ps = u.parents.map((p) => boxes.get(primaryKey.get(p))).filter(Boolean)
  if (!ps.length) continue
  const head = ps[0]
  const junctionX = ps.length === 2
    ? (head.X + head.w + (ps[1].X)) / 2               // 夫婦連結線の中点
    : head.X + head.w / 2
  const junctionY = Math.max(...ps.map((p) => p.Y + p.H))

  if (ps.length === 2) {                              // 夫婦連結線（二重線）
    const y = ps[1].Y + PERSON_H / 2
    edgesSvg.push(`<path class="tie" d="M${head.X + head.w} ${y}H${ps[1].X}"/>`)
  }

  for (const kid of u.kids) {
    const kb = boxes.get(primaryKey.get(kid))
    if (!kb) continue
    const adoptive = parentsOf.get(kid)?.adoptive
    const [d] = getSmoothStepPath({
      sourceX: junctionX, sourceY: junctionY,
      targetX: kb.X + kb.w / 2, targetY: kb.Y,
      sourcePosition: 'bottom', targetPosition: 'top',
      borderRadius: CORNER, offset: LINK_GAP_Y,
    })
    edgesSvg.push(`<path class="link${adoptive ? ' adopt' : ''}" d="${d}"/>`)
  }
}

// ---------------------------------------------------------------- 目盛りと出力
const ticks = []
for (let y = Y0; y <= Y0 + (H - PAD_TOP) / PX_PER_YEAR; y += 25) {
  ticks.push(`<line class="tick" x1="0" y1="${toY(y)}" x2="${W}" y2="${toY(y)}"/>`)
  ticks.push(`<text class="ticklab" x="6" y="${toY(y) - 4}">${y < 0 ? `前${-y}` : y}</text>`)
}

const tokenOf = (b) => b.kind === 'emperor'
  ? `var(${SLOT_TOKEN[SLOT[b.regimeId] ?? 0]})`
  : 'var(--muted-foreground)'

const nodesSvg = [...boxes.values()].map((b) => {
  const c = tokenOf(b)
  const isEmp = b.kind === 'emperor'
  const label = b.label.length > 12 ? `${b.label.slice(0, 11)}…` : b.label
  return `<g class="node ${isEmp ? 'emp' : 'per'}${inferred.has(b.key) ? ' guess' : ''}">
    <rect x="${b.X}" y="${b.Y}" width="${b.w}" height="${b.H}" rx="${CORNER}"
          style="--c:${c}"/>
    ${isEmp ? `<rect class="mark" x="${b.X}" y="${b.Y + 6}" width="3" height="${b.H - 12}" rx="1.5" style="--c:${c}"/>` : ''}
    <text x="${b.X + (isEmp ? 14 : b.w / 2)}" y="${b.Y + (isEmp ? 20 : PERSON_H / 2 + 5)}"
          text-anchor="${isEmp ? 'start' : 'middle'}">${label}</text>
    ${isEmp && b.sub ? `<text class="sub" x="${b.X + 14}" y="${b.Y + 36}">${b.sub}</text>` : ''}
  </g>`
}).join('\n')

const paletteCss = Object.entries(palette).map(([k, v]) => `  ${k}: ${v};`).join('\n')
const eraName = em.meta.catalogs.eras?.find((e) => e.id === ERA)?.name || ERA

console.log(`<!doctype html><meta charset="utf-8"><title>${eraName}・縦軸＝実時間のスパイク</title>
<style>
:root{
${paletteCss}
}
body{margin:0;background:var(--background);color:var(--foreground);
  font-family:var(--font-sans),system-ui,sans-serif;-webkit-font-smoothing:antialiased}
header{padding:24px 32px;border-bottom:1px solid var(--border)}
h1{margin:0;font-size:19px;letter-spacing:.02em;display:flex;gap:10px;align-items:center}
h1::before{content:"";width:4px;height:26px;border-radius:999px;background:var(--seal)}
p.note{margin:10px 0 0;font-size:13px;color:var(--muted-foreground);line-height:1.7;max-width:78ch}
.wrap{overflow:auto;padding:20px 0 60px}
svg{display:block}
.tick{stroke:var(--border);stroke-width:1;stroke-dasharray:2 6}
.ticklab{fill:var(--muted-foreground);font-size:11px}
.node rect{fill:color-mix(in oklch, var(--c) 7%, var(--card));
  stroke:color-mix(in oklch, var(--c) 42%, var(--border));stroke-width:1}
.node.per rect{fill:var(--card);stroke:var(--border);stroke-dasharray:4 3}
.node.guess rect{opacity:.72}
.node .mark{fill:var(--c);stroke:none}
.node text{fill:var(--foreground);font-size:13px}
.node.per text{fill:var(--muted-foreground);font-size:12px}
.node text.sub{fill:var(--muted-foreground);font-size:11px}
.link{fill:none;stroke:color-mix(in oklch, var(--foreground) 34%, transparent);stroke-width:1.5;
  stroke-linecap:round;stroke-linejoin:round}
.link.adopt{stroke-dasharray:5 4}
.tie{stroke:color-mix(in oklch, var(--foreground) 30%, transparent);stroke-width:1.5}
</style>
<header>
  <h1>${eraName}｜縦軸＝実時間（1年 = ${PX_PER_YEAR}px）</h1>
  <p class="note">箱 ${boxes.size}・幅 ${W}px・高さ ${H}px。線は React Flow の
  <code>getSmoothStepPath</code>（MIT）をビルド時に呼んで作った角丸直交コネクタで、
  クライアントには何も送っていない。配色・角丸は <code>globals.css</code> のトークンから読んでいる。
  薄い箱は生没年が原典に無く「最初の子の少し前」で推定した人物（スパイク限定の措置）。</p>
</header>
<div class="wrap"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${ticks.join('\n')}
${edgesSvg.join('\n')}
${nodesSvg}
</svg></div>`)

// ---------------------------------------------------------------- 受け入れの物差し
// 旧実装の4種の品質ゲートのうち、機械で測れる2つ（箱の重なり・線が当事者以外を横切る）。
// あわせて幅を下限（同時に存在する箱の数 × 幅）と比べる ＝ ソルバの出来そのもの。
const bs = [...boxes.values()]
let overlap = 0
for (let i = 0; i < bs.length; i++) {
  for (let j = i + 1; j < bs.length; j++) {
    const a = bs[i], b = bs[j]
    if (a.X < b.X + b.w && b.X < a.X + a.w && a.Y < b.Y + b.H && b.Y < a.Y + a.H) overlap++
  }
}

// 線が「当事者でない箱」を横切る数（path を折れ線に読み直して線分×矩形で判定）
const segsOf = (d) => {
  const pts = []
  for (const m of d.matchAll(/([ML])\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)) pts.push([+m[2], +m[3]])
  const out = []
  for (let i = 1; i < pts.length; i++) out.push([pts[i - 1], pts[i]])
  return out
}
const segHitsRect = ([[x1, y1], [x2, y2]], r) => {
  const lo = { x: Math.min(x1, x2), y: Math.min(y1, y2) }
  const hi = { x: Math.max(x1, x2), y: Math.max(y1, y2) }
  return lo.x < r.X + r.w && hi.x > r.X && lo.y < r.Y + r.H && hi.y > r.Y
}
let cross = 0
for (const u of unions.values()) {
  const partyIds = new Set([...u.parents, ...u.kids].map((i) => primaryKey.get(i)))
  const ps = u.parents.map((p) => boxes.get(primaryKey.get(p))).filter(Boolean)
  if (!ps.length) continue
  const head = ps[0]
  const jx = ps.length === 2 ? (head.X + head.w + ps[1].X) / 2 : head.X + head.w / 2
  const jy = Math.max(...ps.map((p) => p.Y + p.H))
  for (const kid of u.kids) {
    const kb = boxes.get(primaryKey.get(kid))
    if (!kb) continue
    const [d] = getSmoothStepPath({
      sourceX: jx, sourceY: jy, targetX: kb.X + kb.w / 2, targetY: kb.Y,
      sourcePosition: 'bottom', targetPosition: 'top',
      borderRadius: CORNER, offset: LINK_GAP_Y,
    })
    for (const seg of segsOf(d)) {
      for (const r of bs) if (!partyIds.has(r.key) && segHitsRect(seg, r)) { cross++; break }
    }
  }
}

// 幅の下限（measure_time_axis_width.py と同じ数え方）
const ev = bs.flatMap((b) => [[b.Y, 1], [b.Y + b.H, -1]]).sort((a, b) => a[0] - b[0] || b[1] - a[1])
let cur = 0, peak = 0
for (const [, d] of ev) { cur += d; peak = Math.max(peak, cur) }
const avgW = bs.reduce((a, b) => a + b.w, 0) / bs.length
const floor = Math.round(peak * (avgW + COL_GAP))

console.error(`[${ERA}] 箱=${bs.length} 推定年=${inferred.size}`)
console.error(`  幅 ${W}px（下限 ${floor}px・超過 ${(W / floor).toFixed(2)}倍）／高さ ${H}px`)
console.error(`  箱の重なり ${overlap}件／線が当事者以外を横切る ${cross}件`)
