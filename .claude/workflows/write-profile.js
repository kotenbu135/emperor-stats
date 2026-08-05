export const meta = {
  name: 'write-profile',
  description: '紹介文（Issue #16）を書く。1人1エージェントで原文1巡→Web差分→当たったときだけ列伝1箇所',
  whenToUse: '紹介文をまとめて進めるとき。args に {ids, workDir} を渡す。規範は docs/process/profile-writing/README.md',
  phases: [
    { title: '執筆', detail: '本紀を1巡して断片を書く。claims（引用台帳）を必ず付ける' },
    { title: 'Web差分', detail: '通説と突き合わせる。Web は差分検出器であって根拠ではない' },
    { title: '反映', detail: '当たったときだけ列伝を1箇所読んで直す。当たらなければエージェントを立てない' },
  ],
}

// 段構成をリポジトリに置く理由は name-block.js と同じ（毎回書き直すと段を省く）。
// 規則そのものは .claude/agents/profile-*.md と docs/process/profile-writing/README.md が持つ。
//
// **並行して data/emperor-profiles.json を書かせない。** 断片は workDir へ1人1ファイルで置き、
// 本体への転記は呼び出し側が `scripts/add_profile.py` で1本ずつ流す（R-RMW）。

const ids = (args && args.ids) || []
const workDir = (args && args.workDir) || '/tmp/write-profile'

if (!ids.length) {
  log('args.ids が空です。{ids:[...], workDir:"..."} を渡してください')
  return { error: 'no ids' }
}

const WRITE_SCHEMA = {
  type: 'object',
  required: ['id', 'wroteTo', 'gate', 'claimCount', 'lengths', 'discrepancies'],
  properties: {
    id: { type: 'string' },
    wroteTo: { type: 'string' },                       // 断片のパス
    // check_profile_fragment.py --strict の結果。**pass 以外は必ず理由を書く**
    gate: { type: 'string' },
    claimCount: { type: 'integer' },
    lengths: { type: 'string' },                       // 「lead 180／body 900／description 110」
    rubyCount: { type: 'integer' },
    // 読み地図で詔冊が何%だったか。1巡の配分を実際に見たことの証拠
    readingMap: { type: 'string' },
    // 素材（構造フィールド）と原文の食い違い。無ければ「なし」と書く（無言を照合済みと読まない）
    discrepancies: { type: 'string' },
    processSuggestion: { type: 'string' },
  },
}

const DIFF_SCHEMA = {
  type: 'object',
  required: ['id', 'divergences', 'needsBiography'],
  properties: {
    id: { type: 'string' },
    // 通説との食い違い。**数値・年号・序数はデータ（＝原典）を採る**ので、
    // ここに挙がっても本文は直さない（直すのは逸話が欠けている場合だけ）
    divergences: {
      type: 'array',
      items: {
        type: 'object',
        required: ['topic', 'web', 'ours', 'action'],
        properties: {
          topic: { type: 'string' },
          web: { type: 'string' },
          ours: { type: 'string' },
          // 'data-wins'（数値等・直さない）/ 'read-biography'（列伝を1箇所読む）/ 'ignore'
          action: { type: 'string' },
        },
      },
    },
    // 列伝へ降りる必要があるか。true のときだけ3段目のエージェントを立てる
    needsBiography: { type: 'boolean' },
    biographyTarget: { type: 'string' },   // 誰の伝を探すか（人名）
  },
}

const REVISE_SCHEMA = {
  type: 'object',
  required: ['id', 'changed', 'gate', 'readFrom'],
  properties: {
    id: { type: 'string' },
    changed: { type: 'string' },     // 何を足した・直したか。直さなかったなら「変更なし」と理由
    gate: { type: 'string' },
    readFrom: { type: 'string' },    // 実際に読んだ列伝の場所（ファイル:行）。読まなければ「読まず」
  },
}

const NORM = [
  '規範は docs/process/profile-writing/README.md（この1枚が正）。実行の順序は',
  '.claude/skills/write-profile/SKILL.md。見本は data/emperor-profiles.json の5本',
  '（sui-wendi・nanyan-murongchao・han-yuandi・beiwei-tuobayu・xiliao-renzong）。',
  '**削除済みの76本（git f1311ff）は見本にしない。**',
].join('')

function writePrompt(id) {
  return [
    `皇帝 ${id} の紹介文を書く。${NORM}`,
    '',
    '手順:',
    `1. python3 scripts/extract_profile_material.py ${id}`,
    '   （**--notes on を付けない**。末尾に「本紀の読み地図」と「列伝の在り処」が出る）',
    `2. 読み地図の配分どおりに _corpus_cache/${id}.txt を**1巡**読む。詔・冊文の区間は速度を上げ、`,
    '   叙事の区間に時間を配る。**読み直さない**',
    '3. 読みながら引用台帳 claims を作る（[{"text": 本文で書く事実, "quote": 根拠の原文句,',
    '   "src": "ファイル:行"}]）。**台帳に無いことは本文に書かない**（R-CLAIMS-FIRST）',
    `4. 断片を ${workDir}/${id}.json へ書く`,
    `   （{"${id}": {"lead":…, "body":…, "description":…, "basis":…, "claims":[…]}}）`,
    '   basis は**ポインタ**（ファイル＋行番号＋そこに何があるか）。散文の覚え書きにしない',
    `5. python3 scripts/check_profile_fragment.py ${workDir}/${id}.json --strict`,
    '   を通す。落ちたら直して通るまで繰り返す（**通らないまま返さない**）',
    '',
    '守ること:',
    '- 全員に同じ5つの問いに答える（誰の何にあたる人か／どう即位したか／在位中に何が起きたか／',
    '  どう終わったか／**記録が伝えないことは何か**）。**字数は揃えない**。材料が尽きたら止める',
    '- 節見出し（`## `）を立てない。段落は空行で分ける',
    '- 集計値（改元4回・大赦10回）を書かない。個々の事件は書く',
    '- ルビは難読語・中国史特有の語だけ（総ルビはやめた）。description には振らない',
    '- **列伝を読みに行かない**（この段では本紀だけ）',
    '- コーパスに素の grep を掛けない（R-CORPUS-GREP。WSL ごと落ちる）',
  ].join('\n')
}

function diffPrompt(id, frag) {
  return [
    `皇帝 ${id} の紹介文（${frag}）と現代の通説を突き合わせる。報告だけで、断片は直さない。`,
    'Web は**差分検出器であって根拠ではない**（R-PRIMARY-SOURCE は紹介文には掛からないが、',
    'Web の文章を本文へ取り込むことはしない）。',
    '',
    '- 数値・年号・序数が割れたら **action: "data-wins"**（データ＝原典を採る。本文は直さない）',
    '- 通説にしかない逸話・場面があり、本文に無いなら **action: "read-biography"** とし、',
    '  biographyTarget に誰の伝を見ればよいかを書く',
    '- 呼び名・表記ゆれのような実害の無い差は **action: "ignore"**',
    '- 食い違いが1件も無ければ divergences を空配列にし、needsBiography を false にする',
  ].join('\n')
}

function revisePrompt(id, frag, target, diffs) {
  return [
    `皇帝 ${id} の紹介文（${frag}）へ、Web差分の当たりを反映する。${NORM}`,
    '',
    `Web差分の指摘: ${diffs}`,
    '',
    '手順:',
    `1. python3 scripts/find_biography.py ${id} ${target}`,
    '   （**書ごとに降り先が違うのを吸収する道具。素の grep を掛けない**）',
    '2. **列伝は1箇所だけ**読む。裏が取れれば本文へ入れ、取れなければ入れない',
    '3. claims に足す（quote と src＝ファイル:行）。basis にも「Web差分の何に当たって降りたか」を1句添える',
    `4. python3 scripts/check_profile_fragment.py ${frag} --strict を通す`,
    '',
    '- **割れていること自体を本文に書かない**（読み物にならない）',
    '- 序数のように書かずに避けられるものは避ける',
    '- 字数の上限（body 2400字）に注意。足すぶん、弱い段落を削ってよい',
  ].join('\n')
}

log(`${ids.length}人ぶん: ${ids.join('・')}`)

const results = await pipeline(
  ids,
  (id) => agent(writePrompt(id), {
    label: `執筆:${id}`, phase: '執筆', agentType: 'profile-writer', schema: WRITE_SCHEMA,
  }),
  (wrote, id) => {
    if (!wrote) return null
    return agent(diffPrompt(id, `${workDir}/${id}.json`), {
      label: `Web差分:${id}`, phase: 'Web差分', agentType: 'profile-webdiff', schema: DIFF_SCHEMA,
    }).then((diff) => ({ wrote, diff }))
  },
  (prev, id) => {
    if (!prev) return null
    const { wrote, diff } = prev
    // **当たらなければエージェントを立てない。** 5本の実測で2本は列伝が要らなかった。
    // 空振りに1体ぶんの費用を払わない
    if (!diff || !diff.needsBiography) {
      return { id, wrote, diff, revise: { id, changed: '変更なし（Web差分の当たりなし）', gate: wrote.gate, readFrom: '読まず' } }
    }
    const target = diff.biographyTarget || ''
    const summary = (diff.divergences || [])
      .filter((d) => d.action === 'read-biography')
      .map((d) => `${d.topic}: 通説「${d.web}」／本文「${d.ours}」`)
      .join('／')
    return agent(revisePrompt(id, `${workDir}/${id}.json`, target, summary), {
      label: `反映:${id}`, phase: '反映', agentType: 'profile-reviser', schema: REVISE_SCHEMA,
    }).then((revise) => ({ id, wrote, diff, revise }))
  },
)

const done = results.filter(Boolean)
log(`完了 ${done.length}/${ids.length}`)

// 呼び出し側が読むのは要約だけ（断片そのものは workDir にある）。
return {
  workDir,
  spentTokens: budget.spent(),
  perEmperor: done.map((r) => ({
    id: r.id,
    gate: (r.revise && r.revise.gate) || r.wrote.gate,
    lengths: r.wrote.lengths,
    claims: r.wrote.claimCount,
    ruby: r.wrote.rubyCount,
    readingMap: r.wrote.readingMap,
    biography: (r.revise && r.revise.readFrom) || '読まず',
    divergences: (r.diff && r.diff.divergences || []).map((d) => `${d.action}:${d.topic}`).join('／') || 'なし',
    changed: r.revise && r.revise.changed,
    discrepancies: r.wrote.discrepancies,
    processSuggestion: r.wrote.processSuggestion || '',
  })),
}
