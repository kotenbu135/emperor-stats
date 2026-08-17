// 「箱と線をライブラリ製にする」の可否を、DOM の無い Node で実際に確かめる（2026-08-17）。
//
// 効くかどうかの分かれ目は1つ: 線の経路を作る関数が **純関数として単体で呼べるか**。
// 呼べるなら、ビルド時に SVG の path 文字列を作って静的 HTML へ焼けるので、
// クライアント描画（＝静的 <a> が出ない・site/AGENTS.md の契約違反）を避けられる。
// 呼べないなら、ライブラリを使うにはページをクライアント描画にするしかない。

const probes = []

async function probe(name, fn) {
  try {
    probes.push({ name, ok: true, out: await fn() })
  } catch (e) {
    probes.push({ name, ok: false, out: `${e.constructor.name}: ${e.message.split('\n')[0]}` })
  }
}

// --- React Flow（@xyflow）の経路生成器 ---
await probe('@xyflow/react: getSmoothStepPath', async () => {
  const m = await import('@xyflow/react')
  const [d] = m.getSmoothStepPath({
    sourceX: 100, sourceY: 0, targetX: 300, targetY: 200,
    sourcePosition: 'bottom', targetPosition: 'top', borderRadius: 8,
  })
  return d
})

await probe('@xyflow/react: getBezierPath', async () => {
  const m = await import('@xyflow/react')
  const [d] = m.getBezierPath({
    sourceX: 100, sourceY: 0, targetX: 300, targetY: 200,
    sourcePosition: 'bottom', targetPosition: 'top',
  })
  return d
})

await probe('@xyflow/system: getSmoothStepPath（React 抜き）', async () => {
  const m = await import('@xyflow/system')
  const [d] = m.getSmoothStepPath({
    sourceX: 100, sourceY: 0, targetX: 300, targetY: 200,
    sourcePosition: 'bottom', targetPosition: 'top', borderRadius: 8,
  })
  return d
})

// --- d3-shape のリンク生成器 ---
await probe('d3-shape: linkVertical', async () => {
  const { linkVertical } = await import('d3-shape')
  return linkVertical().x((p) => p[0]).y((p) => p[1])({ source: [100, 0], target: [300, 200] })
})

for (const p of probes) {
  console.log(`${p.ok ? '✅' : '❌'} ${p.name}`)
  console.log(`   ${p.out}`)
}

console.log('\n--- ライセンス ---')
for (const pkg of ['@xyflow/react', '@xyflow/system', 'd3-shape']) {
  const url = await import('node:module').then((m) =>
    m.createRequire(import.meta.url).resolve(`${pkg}/package.json`))
  const json = JSON.parse(await import('node:fs').then((f) => f.readFileSync(url, 'utf8')))
  console.log(`${pkg}@${json.version}  ${json.license}`)
}
