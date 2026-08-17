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
//
// 1本目は「部分木ごと左詰め・衝突したら右へ送る」で組み、南北朝が6,029px（下限の3.13倍）
// になった。原因は2つあって、どちらもこの版で直してある。
//
//   (1) 衝突判定に縦の余白（LINK_GAP_Y）を入れていたので、**父の退位年＝子の即位年**が
//       「重なっている」と判定され、直系の親子が横に並んでいた。王朝が縦の柱ではなく
//       横の鎖になるので、幅がそのまま代数に比例して伸びる。縦の余白は 0 にする
//       （垂下線の room は描画側の話で、置き方の制約ではない）
//   (2) 部分木を丸ごと動かしていたので、200年に伸びた部分木がどこか1箇所で衝突すると
//       全体が右端の外へ送られていた。**人（unit）ごとに、望む x のいちばん近くの空きへ
//       置く**形に変える。時間が重ならない箱は自然に同じ x を共有する
//
// unit ＝ 1人ぶんのまとまり（複数在位のカプセル ＋ 脇に付く妃）。x はこの単位で決める。
const yTop = (b) => b.y0
const yBot = (b) => b.y1

const headOf = (id) => spouseOf.get(id) ?? id
const SPOUSE_GAP = 14
const CORRIDOR_GAP = 8        // 線の通り道と箱の間に空ける最小の隙間
// 通り道を避けるために遠回りしてよい上限（px）。幅と横切りの交換レートそのものなので
// 値を決め打ちせず、YIELD=... で振って測れるようにしてある。
const CORRIDOR_YIELD = Number(process.env.YIELD ?? 420)
const spouseAnchor = new Map() // 妃の箱 key -> 上端の年（夫カプセルの上部に整列する）

/** unit を組む: 局所座標（左端=0）での占有矩形と、妃の相対位置 */
const units = new Map()
for (const b of boxes.values()) {
  const head = headOf(b.id)
  if (spouseOf.has(b.id)) continue           // 妃は夫の unit の中で扱う
  if (!units.has(head)) units.set(head, { id: head, own: [], spouses: [], rects: [] })
  if (b.id === head) units.get(head).own.push(b)
}
for (const u of unions.values()) {
  if (u.parents.length < 2) continue
  const unit = units.get(headOf(u.parents[0]))
  if (!unit) continue
  const s = boxes.get(primaryKey.get(u.parents[1]))
  if (s && !unit.spouses.includes(s)) unit.spouses.push(s)
}
for (const u of units.values()) {
  const headW = Math.max(...u.own.map((b) => b.w))
  const anchor = u.own.reduce((a, b) => (a && a.y0 <= b.y0 ? a : b), null)
  u.rects = u.own.map((b) => ({ dx0: 0, dx1: b.w, y0: yTop(b), y1: yBot(b), box: b }))
  let off = headW
  for (const s of u.spouses) {
    // 妃が複数いる夫では、外側の妃への連結線は**内側の妃の外縁**が始点になる
    // （夫の右端から引くと、線が内側の妃のピルを突き抜ける。2026-07-26 の承認済み規則）
    s.tieDx = off
    off += SPOUSE_GAP
    // 妃は夫カプセルの上部に整列する（承認済み・子は必ず夫の下端より後に来る）
    s.spouseDx = off
    spouseAnchor.set(s.key, anchor.y0)
    u.rects.push({ dx0: off, dx1: off + s.w, y0: anchor.y0, y1: anchor.y0 + PERSON_H / PX_PER_YEAR, box: s })
    off += s.w
  }
  u.w = off
  u.headW = headW      // 線が着くのは本人の箱の中心で、妃を含めた unit の中心ではない
}

// 衝突判定。縦の余白は 0（父の退位年＝子の即位年で同じ列に置けるようにする）
const hits = (a, b, gap = COL_GAP) =>
  a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 && b.y0 < a.y1

const placedRects = []                       // 置き終わった箱（絶対座標）
let corridorRects = []                       // 線の通り道（＝箱を置いてはいけない場所）
const ux = new Map()                          // unit id -> x

const absRects = (u, X) => u.rects.map((r) => ({ x0: X + r.dx0, x1: X + r.dx1, y0: r.y0, y1: r.y1, u: u.id }))

const boxClear = (u, X) => {
  const rs = absRects(u, X)
  return !rs.some((r) => placedRects.some((p) => p.u !== u.id && hits(r, p)))
}
// 線の通り道は「当事者以外」だけを弾く（自分の親子線は自分を通ってよい）
const corridorClear = (u, X) => {
  const rs = absRects(u, X)
  return !rs.some((r) => corridorRects.some((c) => !c.own.has(u.id) && hits(r, c, CORRIDOR_GAP)))
}
const feasible = (u, X) => boxClear(u, X) && corridorClear(u, X)

/** 望む x のいちばん近くにある空きへ置く */
function bestX(u, desired) {
  const cands = new Set([Math.max(0, desired)])
  for (const p of [...placedRects, ...corridorRects]) {
    const gap = p.own ? CORRIDOR_GAP : COL_GAP
    for (const r of u.rects) {
      cands.add(p.x1 + gap - r.dx0)          // その矩形のすぐ右
      cands.add(p.x0 - gap - r.dx1)          // すぐ左
    }
  }
  // 通り道は**避けたい制約**であって、絶対の制約ではない。
  // 硬い制約にすると、避け場所が無い人が図の右端の外まで飛んで幅が破裂する
  // （南北朝で 2,630px → 17,775px になった）。近くに空きが無ければ通り道は譲る。
  let strict = null, loose = null
  for (const c of cands) {
    const X = Math.max(0, Math.round(c))
    if (!boxClear(u, X)) continue
    const d = Math.abs(X - desired)
    if (loose === null || d < loose.d) loose = { X, d }
    if (corridorClear(u, X) && (strict === null || d < strict.d)) strict = { X, d }
  }
  if (strict && (!loose || strict.d <= loose.d + CORRIDOR_YIELD)) return strict.X
  if (loose) return loose.X
  return Math.max(0, ...placedRects.map((p) => p.x1 + COL_GAP))
}

// --- 置く順序: 親が先（トポロジカル）・同順位は年代順 --------------------------
const parentUnionOf = new Map()               // child id -> union
for (const u of unions.values()) for (const k of u.kids) parentUnionOf.set(k, u)

const order = []
{
  const seen = new Set()
  const visit = (id) => {
    const h = headOf(id)
    if (seen.has(h) || !units.has(h)) return
    const pu = parentUnionOf.get(h)
    if (pu) for (const p of pu.parents) if (!seen.has(headOf(p))) visit(p)
    if (seen.has(h)) return
    seen.add(h)
    order.push(units.get(h))
  }
  for (const id of [...units.keys()].sort((a, b) => birthOf(a) - birthOf(b))) visit(id)
}

/** その union の垂下点（＝子が下りてくる x） */
function junctionOf(u) {
  const bs = u.parents.map((p) => boxes.get(primaryKey.get(p))).filter((b) => b && b.X0 != null)
  if (!bs.length) return null
  if (bs.length === 2 && bs[1].tieX != null) return (bs[1].tieX + bs[1].X0) / 2
  if (bs.length === 2) return (bs[0].X0 + bs[0].w + bs[1].X0) / 2
  return bs[0].X0 + bs[0].w / 2
}

// 妃は「生没の中点」ではなく夫カプセルの上部に整列して描かれるので、
// 線と通り道の計算では**描かれる位置**を使う（生の y を使うと線と箱がずれる）。
const topYear = (b) => spouseAnchor.get(b.key) ?? b.y0
const botYear = (b) => (spouseAnchor.has(b.key)
  ? spouseAnchor.get(b.key) + PERSON_H / PX_PER_YEAR
  : b.y1)

/** 兄弟バーの高さ（年）。全ての子で共有するので getSmoothStepPath には centerY で渡す */
function barYearOf(u) {
  const bs = u.parents.map((p) => boxes.get(primaryKey.get(p))).filter(Boolean)
  if (!bs.length) return null
  return Math.max(...bs.map(botYear)) + LINK_GAP_Y / PX_PER_YEAR
}

/**
 * その union の線が通る場所を矩形にする。
 * 旧実装のレビュー③で確立した「子ごとの垂下コリドーをパッキングに予約」に当たる段で、
 * これが無いと箱を詰めた分だけ線が箱を横切る（1本目は幅を詰めたら横切りが63件に増えた）。
 */
function corridorsOf(un) {
  const ps = un.parents.map((p) => boxes.get(primaryKey.get(p))).filter((b) => b && b.X0 != null)
  const kids = un.kids.map((k) => boxes.get(primaryKey.get(k))).filter((b) => b && b.X0 != null)
  if (!ps.length || !kids.length) return []
  const jx = junctionOf(un)
  const jy = Math.max(...ps.map(botYear))
  const barY = barYearOf(un)
  const own = new Set([...un.parents, ...un.kids].map(headOf))
  const xs = [jx, ...kids.map((k) => k.X0 + k.w / 2)]
  const out = [
    { x0: Math.min(...xs) - 2, x1: Math.max(...xs) + 2, y0: barY - 0.5, y1: barY + 0.5, own },
    { x0: jx - 2, x1: jx + 2, y0: jy, y1: barY, own },
  ]
  for (const k of kids) {
    if (topYear(k) <= barY) continue          // 親より上に置かれた子は垂下できない（別扱い）
    out.push({ x0: k.X0 + k.w / 2 - 2, x1: k.X0 + k.w / 2 + 2, y0: barY, y1: topYear(k), own })
  }
  return out.filter((r) => r.y1 > r.y0)
}

const rebuildCorridors = () => {
  corridorRects = [...unions.values()].flatMap(corridorsOf)
}

/** いまの位置が（自分の矩形を除いて）成立しているか */
function feasibleIgnoringSelf(u, X) {
  const rs = absRects(u, X)
  if (rs.some((r) => placedRects.some((p) => p.u !== u.id && hits(r, p)))) return false
  return !rs.some((r) => corridorRects.some((c) => !c.own.has(u.id) && hits(r, c, CORRIDOR_GAP)))
}
const setX = (u, X) => {
  ux.set(u.id, X)
  for (const r of u.rects) r.box.X0 = X + r.dx0
  for (const s of u.spouses) s.tieX = X + s.tieDx      // 連結線の始点（内側の隣の外縁）
}

// ---------------------------------------------------------------- 並び順（交差最小化）
//
// 診断（DIAG=1）で南北朝の横切り79件の内訳を出すと **76件が垂下線**で、
// 中身は「文帝 → 劉休範 が『元凶劭』を縦に横切る」型だった。
// 元凶劭も劉休範も文帝の子だが、**母が違うので別の union になり、互いに当事者ではない**。
// union ごとに独立して垂下点の下へ寄せていたので、母の違う子の帯が入れ子になっていた。
//
// 承認済みの規則「兄弟は母別グループで連続配置」がこれに当たる。
// 父ひとりぶんの子を**1本の並び**として扱い、母グループへ連続した x の帯を割り当てる。
// グループの左右の順は**妃が夫の脇に付く順**と同じにする（母グループの垂下点は妃の位置で
// 決まるので、順序をそろえないと帯と垂下点の左右が食い違って必ず交差する）。
const sibPlan = new Map()          // 父の head id -> Map(子の head id -> 望む x)

function planSiblings(h) {
  const plan = new Map()
  const us = [...(unionsOfParent.get(h) || [])]
  // 父ひとりの union（母が図に無い子）がいちばん左。あとは妃の並び順
  const rank = (un) => (un.parents.length < 2 ? -1 : (boxes.get(primaryKey.get(un.parents[1]))?.spouseDx ?? 0))
  us.sort((a, b) => rank(a) - rank(b))

  const items = []
  for (const un of us) {
    const j = junctionOf(un)
    if (j == null) continue
    const kus = un.kids.map((k) => units.get(headOf(k))).filter(Boolean)
    if (!kus.length) continue
    if (kus.length === 1) {
      // 子が1人なら垂下線をまっすぐ下ろす（本人の箱の中心を垂下点にそろえる）
      items.push({ u: kus[0], x: j - kus[0].headW / 2 })
      continue
    }
    const total = kus.reduce((a, k) => a + k.w, 0) + (kus.length - 1) * COL_GAP
    let cur = j - total / 2
    for (const k of kus) { items.push({ u: k, x: cur }); cur += k.w + COL_GAP }
  }
  // グループどうしが食い込んだら左から押し出す（帯の連続性を壊さない）
  items.sort((a, b) => a.x - b.x || a.u.id.localeCompare(b.u.id))
  let right = -Infinity
  for (const it of items) {
    it.x = Math.max(it.x, right)
    right = it.x + it.u.w + COL_GAP
    plan.set(it.u.id, Math.round(it.x))
  }
  sibPlan.set(h, plan)
  return plan
}

// 兄弟の並び（母グループの帯）は **既定では使わない**。組んで測った結果が下で、
// 6章を通した横切りの合計は 163（無し）→ 155（並びのみ）→ 152（塞ぎ検出のみ）→ 168（両方）。
// 三国西晋は 20 → 3 件と大きく効いたが、東晋十六国と南北朝では逆に増え、
// **どの変種も他を支配しない**（幅と横切りはほぼ常に逆に動く）。
// 効く章と効かない章の切り分けが付くまでは旗のままにして、既定は塞ぎ検出だけにする。
// ---------------------------------------------------------------- 政権の帯
//
// 章ごとの横切りの多寡は解き方ではなく**同時に走る政権の数**で説明が付いた
// （隋唐 92箱で3件・南北朝 167箱で73件。うち半分が「宋の線が北魏の箱を突き抜ける」型）。
// 同時代の政権が x 方向に噛み合っていると、線は必ず他家の箱を通る。
// そこで**政権ごとに帯を取る** — ただし帯の幅を決め打ちすると、時代の重ならない政権にも
// 場所を取ってしまう。帯の起点は「その政権の在位年に重なる、すでに置いた箱の右端」から
// その場で引く（＝重ならない政権は同じ x を共有し、同時代の政権だけが横に並ぶ）。
const regimeIdOf = (id) => {
  const b = boxes.get(primaryKey.get(id))
  if (b?.regimeId) return b.regimeId
  const h = headOf(id)
  if (h !== id) return boxes.get(primaryKey.get(h))?.regimeId ?? null
  for (const un of unionsOfParent.get(id) || []) {
    for (const k of un.kids) { const r = boxes.get(primaryKey.get(k))?.regimeId; if (r) return r }
  }
  return null
}
const regimeSpan = new Map()
for (const b of boxes.values()) {
  if (!b.regimeId) continue
  const s = regimeSpan.get(b.regimeId) || { y0: Infinity, y1: -Infinity }
  s.y0 = Math.min(s.y0, b.y0); s.y1 = Math.max(s.y1, b.y1)
  regimeSpan.set(b.regimeId, s)
}
const bandBase = new Map()
function bandBaseOf(rid) {
  if (rid == null) return 0
  if (bandBase.has(rid)) return bandBase.get(rid)
  const s = regimeSpan.get(rid)
  let x = 0
  if (s) for (const p of placedRects) if (p.y0 < s.y1 && s.y0 < p.y1) x = Math.max(x, p.x1 + COL_GAP)
  bandBase.set(rid, x)
  return x
}

const NO_BAND = !!process.env.NOBAND      // 政権の帯を取らない（噛み合わせを許す）
const NO_PLAN = !process.env.PLAN       // 兄弟の並びを使わず union ごとに垂下点の下へ振る
const NO_BLOCK = !!process.env.NOBLOCK    // 仕上げ段で通り道の塞ぎを見ない

/** 望む x: 父ひとりぶんの兄弟の並びから引く（母グループは連続した帯になる） */
function desiredOf(u) {
  const pu = parentUnionOf.get(u.id)
  if (!pu) return NO_BAND ? 0 : bandBaseOf(regimeIdOf(u.id))
  if (NO_PLAN) {
    const j0 = junctionOf(pu)
    if (j0 == null) return 0
    const i = pu.kids.indexOf(u.id)
    return j0 + (i - (pu.kids.length - 1) / 2) * (u.w + COL_GAP) - u.headW / 2
  }
  const h = headOf(pu.parents[0])
  const plan = sibPlan.get(h) ?? planSiblings(h)
  const x = plan.get(u.id)
  if (x != null) return x
  const j = junctionOf(pu)
  return j == null ? 0 : j - u.headW / 2
}

for (const u of order) {
  const X = bestX(u, Math.round(desiredOf(u)))
  setX(u, X)
  placedRects.push(...absRects(u, X))
  rebuildCorridors()            // 置いた瞬間に、その人へ下りる線の通り道を予約する
}

// --- 仕上げ: 線が短くなる向きへ動かせるだけ動かす -----------------------------
// Sugiyama の「座標割り当て」に当たる段。親は子の中央へ、子は親の垂下点へ寄る。
// 動かすのは空きがあるときだけなので、重なりは増えない。
// 仕上げ段では**兄弟の並び（sibPlan）を引き直さない**。
// 引き直す版を1度組んで測ったが、6章のうち幅は5章・横切りは4章で悪くなった。
// pass の途中で親が動くと、その pass の後半の unit だけが新しい親位置で組んだ枠を見る一方、
// 親の側は子の重心に引かれる ＝ 双方向の引きが pass をまたいで振動する。
// 並び順は初回配置で決めて、ここでは動かさない。
function idealOf(u) {
  const targets = []
  const pu = parentUnionOf.get(u.id)
  if (pu) { const j = junctionOf(pu); if (j != null) targets.push(j) }
  for (const cu of unionsOfParent.get(u.id) || []) {
    const cs = cu.kids.map((k) => boxes.get(primaryKey.get(k))).filter((b) => b && b.X0 != null)
    if (cs.length) targets.push(cs.reduce((a, c) => a + c.X0 + c.w / 2, 0) / cs.length)
  }
  if (!targets.length) return null
  const mid = targets.reduce((a, b) => a + b, 0) / targets.length
  return Math.round(mid - u.headW / 2)
}

for (let pass = 0; pass < 6; pass++) {
  const seq = pass % 2 ? [...order].reverse() : order
  for (const u of seq) {
    const cur = ux.get(u.id)
    // 通り道は「後から置いた線」の側にしか効かない（先に置かれた箱はそのまま線の下に残る）。
    // ここで自分の現在地が通り道を塞いでいないかを見て、塞いでいたら必ず動かす。
    // **箱だけを見ていると通り道を塞いだままの人が一度も動かない**（1本目の取りこぼし）。
    const blocking = !boxClear(u, cur) || (!NO_BLOCK && !corridorClear(u, cur))
    const want = idealOf(u)
    if (want == null && !blocking) continue
    if (want === cur && !blocking) continue
    // いったん自分の矩形を外してから、望む x のいちばん近くの空きを探す
    for (let i = placedRects.length - 1; i >= 0; i--) if (placedRects[i].u === u.id) placedRects.splice(i, 1)
    const X = bestX(u, Math.max(0, want ?? cur))
    setX(u, X)
    placedRects.push(...absRects(u, X))
    rebuildCorridors()
  }
}

// 左端を 0 へ寄せ直す
const minX = Math.min(...[...boxes.values()].map((b) => b.X0 ?? 0))
for (const b of boxes.values()) if (b.X0 != null) b.X0 -= minX

// ---------------------------------------------------------------- px 座標へ
const years = [...boxes.values()].flatMap((b) => [b.y0, b.y1])
const Y0 = Math.floor(Math.min(...years) / 25) * 25
const toY = (y) => PAD_TOP + (y - Y0) * PX_PER_YEAR
// 妃の x・y はソルバが unit の中で決めている（あとから脇へずらすと重なりが生まれる）
const spouseAnchorY = new Map()
for (const u of units.values()) {
  const anchor = u.own.reduce((a, b) => (a && a.y0 <= b.y0 ? a : b), null)
  for (const s of u.spouses) spouseAnchorY.set(s.key, anchor.y0)
}
for (const b of boxes.values()) {
  b.X = PAD_X + (b.X0 ?? 0)
  const isSpouse = spouseAnchorY.has(b.key)
  b.Y = toY(isSpouse ? spouseAnchorY.get(b.key) : b.y0)
  b.H = isSpouse ? PERSON_H
    : Math.max(b.kind === 'emperor' ? MIN_CAPSULE_H : PERSON_H, (b.y1 - b.y0) * PX_PER_YEAR)
  b.attached = isSpouse
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
  // 垂下点は連結線の実区間の中点（外側の妃では内側の妃の外縁が始点になる）
  const junctionX = ps.length === 2
    ? ((ps[1].tieX != null ? PAD_X + ps[1].tieX : head.X + head.w) + ps[1].X) / 2
    : head.X + head.w / 2
  const junctionY = Math.max(...ps.map((p) => p.Y + p.H))
  // 兄弟バーは全ての子で共有する（centerY を渡さないと、子ごとに source と target の
  // 中点へ横区間が来て、バーが階段状にばらける）
  const barY = toY(barYearOf(u))

  if (ps.length === 2) {                              // 夫婦連結線
    const y = ps[1].Y + PERSON_H / 2
    const from = ps[1].tieX != null ? PAD_X + ps[1].tieX : head.X + head.w
    edgesSvg.push(`<path class="tie" d="M${from} ${y}H${ps[1].X}"/>`)
  }

  for (const kid of u.kids) {
    const kb = boxes.get(primaryKey.get(kid))
    if (!kb) continue
    const adoptive = parentsOf.get(kid)?.adoptive
    const [d] = getSmoothStepPath({
      sourceX: junctionX, sourceY: junctionY,
      targetX: kb.X + kb.w / 2, targetY: kb.Y,
      sourcePosition: 'bottom', targetPosition: 'top',
      borderRadius: CORNER, offset: LINK_GAP_Y, centerY: barY,
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
/* 混色は **in srgb**。oklch で混ぜると --card（oklch(1 0 0)）の色相 0 に引かれて、
   93%の白が青も緑も色相 0（＝桃色）へ寄せてしまう（powerless hue は none のときだけの
   規則で、明示された 0 には効かない）。実測で緑の政権の面が色相 9.97、青が 352 だった
   ＝ **どの王朝の箱も同じ桃色**になっていて、図がのっぺり見えていた主因がこれ。
   サイト側は dynasty-colors.ts の mixHex が最初から in srgb で、そこから外れていた。 */
.node rect{fill:color-mix(in srgb, var(--c) 8%, var(--card));
  stroke:color-mix(in srgb, var(--c) 45%, var(--border));stroke-width:1}
.node.per rect{fill:var(--card);stroke:var(--border);stroke-dasharray:4 3}
.node.guess rect{opacity:.72}
.node .mark{fill:var(--c);stroke:none}
.node text{fill:var(--foreground);font-size:13px}
.node.per text{fill:var(--muted-foreground);font-size:12px}
.node text.sub{fill:var(--muted-foreground);font-size:11px}
/* 線も同じ理由で in srgb。34%は全体を引いたときにほとんど消えていたので上げた。 */
.link{fill:none;stroke:color-mix(in srgb, var(--foreground) 55%, var(--background));stroke-width:1.5;
  stroke-linecap:round;stroke-linejoin:round}
.link.adopt{stroke-dasharray:5 4}
.tie{stroke:color-mix(in srgb, var(--foreground) 45%, var(--background));stroke-width:1.5}
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
// 数え方に3つ穴があったので直した（どれも件数を水増しする向き）:
//   - 1本の線が1つの箱を突き抜けると、折れ線の区間ごとに 3 件まで数えていた（見た目の欠陥は1件）
//   - 当事者を**箱の key** で持っていたので、複数在位の皇帝の 2 期目のカプセルが
//     自分の子の線に対して「当事者でない箱」になっていた（南北朝は廃位・復位が多い）
//   - 区間が別々の箱を跨いだとき、break で1件しか数えていなかった（過小の向き）
let cross = 0
let crossOther = 0        // うち「別の政権の箱」を横切ったもの
const crossSeen = new Set()
// 妃・非皇帝は政権を持たないので、夫か子から借りて数える
const regimeOfId = (id) => {
  const b = boxes.get(primaryKey.get(id))
  if (b?.regimeId) return b.regimeId
  const h = headOf(id)
  if (h !== id) return boxes.get(primaryKey.get(h))?.regimeId ?? null
  for (const un of unionsOfParent.get(id) || []) {
    for (const k of un.kids) { const r = boxes.get(primaryKey.get(k))?.regimeId; if (r) return r }
  }
  return null
}
for (const u of unions.values()) {
  const partyIds = new Set([...u.parents, ...u.kids])     // 人物 id で見る
  const ps = u.parents.map((p) => boxes.get(primaryKey.get(p))).filter(Boolean)
  if (!ps.length) continue
  const head = ps[0]
  const jx = ps.length === 2
    ? ((ps[1].tieX != null ? PAD_X + ps[1].tieX : head.X + head.w) + ps[1].X) / 2
    : head.X + head.w / 2
  const jy = Math.max(...ps.map((p) => p.Y + p.H))
  for (const kid of u.kids) {
    const kb = boxes.get(primaryKey.get(kid))
    if (!kb) continue
    const [d] = getSmoothStepPath({
      sourceX: jx, sourceY: jy, targetX: kb.X + kb.w / 2, targetY: kb.Y,
      sourcePosition: 'bottom', targetPosition: 'top',
      borderRadius: CORNER, offset: LINK_GAP_Y, centerY: toY(barYearOf(u)),
    })
    for (const seg of segsOf(d)) {
      for (const r of bs) {
        if (partyIds.has(r.id) || !segHitsRect(seg, r)) continue
        const k = `${u.key}|${kid}|${r.key}`
        if (crossSeen.has(k)) continue
        crossSeen.add(k)
        cross++
        const ra = regimeOfId(kid), rb = regimeOfId(r.id)
        if (ra && rb && ra !== rb) crossOther++
        if (process.env.DIAG) {
          const horiz = Math.abs(seg[0][1] - seg[1][1]) < 1
          console.error(`  横切り: ${u.parents.map(nameOf).join('＝')} → ${nameOf(kid)}`
            + ` が「${r.label}」(${r.key}) を${horiz ? '横' : '縦'}に横切る`)
        }
      }
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
console.error(`  箱の重なり ${overlap}件／線が当事者以外を横切る ${cross}件（うち別の政権の箱 ${crossOther}件）`)
