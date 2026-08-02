export const meta = {
  name: 'name-block',
  description: '廟号・諡号・元号を本紀から悉皆補充する（Issue #37）。1人1エージェントで claims-first、直後に別コンテキストで検証',
  whenToUse: 'Issue #37 の名前データ補充を1ブロック（10〜20人程度）進めるとき。args に {ids, workDir, section} を渡す',
  phases: [
    { title: '調査', detail: '1人1エージェント・本紀冒頭から claims を作る' },
    { title: '検証', detail: '別コンテキストで原文へ当て直す（報告のみ）' },
  ],
}

// 段構成をリポジトリに置く理由: 毎回スクリプトを書き直すと、検証段を省いたり
// 規則を書き写し忘れたりする。規則そのものは .claude/agents/*.md 側が持っているので、
// ここは「誰に何をさせるか」だけを固定する。

const ids = (args && args.ids) || []
const workDir = (args && args.workDir) || '/tmp/name-block'
const section = (args && args.section) || ''

if (!ids.length) {
  log('args.ids が空です。{ids:[...], workDir:"...", section:"..."} を渡してください')
  return { error: 'no ids' }
}

const RESEARCH_SCHEMA = {
  type: 'object',
  required: ['id', 'wroteTo', 'claimCount', 'fields', 'regimeConvention', 'discrepancies'],
  properties: {
    id: { type: 'string' },
    wroteTo: { type: 'string' },
    claimCount: { type: 'integer' },
    fields: { type: 'array', items: { type: 'string' } },   // 埋めた欄（空欄が正しい場合は空配列）
    unknown: { type: 'array', items: { type: 'string' } },  // 「調査済みだが不明」と確定した欄
    // 政権単位の慣行（書式・所在）を実際に使ったことの証拠。未確定なら "blocked: <政権id>" と返す。
    // 自由記述にせず必須にしてあるのは、「先に政権単位で確定する」を文書に書くだけだと
    // 守られないため（規則 R-REGIME-FIRST）
    regimeConvention: { type: 'string' },
    discrepancies: { type: 'string' },                      // 既存データとの食い違い。無ければ「なし」
    processSuggestion: { type: 'string' },                  // 手順そのものの改善案（任意・R-PROCESS-FEEDBACK）
  },
}

const VERIFY_SCHEMA = {
  type: 'object',
  required: ['id', 'issues'],
  properties: {
    id: { type: 'string' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['field', 'problem', 'evidence'],
        properties: {
          field: { type: 'string' },
          problem: { type: 'string' },
          evidence: { type: 'string' },   // 原文の引用と file:line
        },
      },
    },
  },
}

log(`${ids.length}人ぶんの名前データを調査します（${section || '区分未指定'}）`)

const results = await pipeline(
  ids,
  (id) => agent(
    `皇帝 id \`${id}\` の名前データ（廟号 templeName・諡号 posthumousName・別称 aliases・元号）を` +
    `正史の本紀から確定してください。返す JSON の id は \`${id}\` を一字一句そのまま使うこと。\n\n` +
    `- **最初に \`python3 scripts/check_regime_conventions.py --for ${id}\` を走らせる。**\n` +
    `  廟号を立てるか・どの位置にどんな書式で載るかは人物の属性ではなく**政権の慣行**なので、\n` +
    `  政権単位で先に確定してあります。出力の「所在」「書式」に従って読み、\n` +
    `  使った慣行（書名・判定・所在）を regimeConvention にそのまま書いてください。\n` +
    `  **1 で終わったらその政権は慣行が未確定です。人物単位の調査に入らず、\n` +
    `  regimeConvention に \`blocked: <政権id>\` と書いて claims を空のまま返してください**\n` +
    `- 判定が \`skip\` / \`other-source\` の項目は、この書の冒頭では取れません。無理に埋めない\n` +
    `- 既存レコードは自分で取る: \`jq '.emperors[]|select(.id=="${id}")|{id,name,regimeId,reigns:[.reigns[]|{startYear,endYear}]}' data/emperors.json\`\n` +
    `- 本紀冒頭の1行（「太宗孝武惠文皇帝，讳德光」形式）でほぼ取れます。取れない場合は無理に埋めず\n` +
    `  「調査済みだが不明」として unknown に入れてください。**空欄が正しい場合があります**\n` +
    `  （始皇帝に諡号は無い、漢は廟号を持つ皇帝が限られる、など）\n` +
    `- **民族名（西夏のタングート名・北魏の鮮卑名など）を推測で補わない**\n` +
    `- 出力は docs/process/CLAIMS_CONTRACT.md の形で \`${workDir}/claims/${id}.json\` へ Write し、\n` +
    `  \`python3 scripts/check_claims.py ${workDir}/claims/${id}.json\` をエラー0にしてから返すこと`,
    { label: `name:${id}`, phase: '調査', agentType: 'corpus-researcher', schema: RESEARCH_SCHEMA },
  ),
  (res, id) => res && agent(
    `皇帝 id \`${id}\` の名前データを**原文から独立に**確かめてください。\n\n` +
    `先に \`_corpus_cache/${id}.txt\`（無ければ本紀の該当箇所）を読んで、` +
    `その人物の**廟号・諡号・諱・元号を原文が何と書いているか**を自分で書き出してから、` +
    `\`${workDir}/claims/${id}.json\` を開いて突き合わせてください（順序を逆にしないこと）。\n` +
    `- 諡号と廟号の取り違え・追諡と即位時の号の混同・別政権の同名君主との取り違えを特に見る\n` +
    `- **修正はしない。報告だけ**。指摘が無いときは issues を空配列で返す`,
    { label: `verify:${id}`, phase: '検証', agentType: 'adversarial-verifier', schema: VERIFY_SCHEMA },
  // 検証段の戻り値だけにすると調査段の fields・processSuggestion が消えるので畳んで返す
  ).then((v) => ({ ...res, issues: (v && v.issues) || [] })),
)

const ok = results.filter(Boolean)
// 政権単位の慣行が未確定で立てられなかった人物。握りつぶすと「調査したが空欄だった」と
// 見分けが付かなくなるので、別枠で返す（規則 R-REGIME-FIRST）
const blocked = ok.filter((r) => /^blocked:/.test(r.regimeConvention || ''))
const withIssues = ok.filter((r) => r.issues && r.issues.length)
const suggestions = ok.filter((r) => r.processSuggestion).map((r) => `${r.id}: ${r.processSuggestion}`)
log(`検証完了: ${ok.length}/${ids.length}人。指摘ありは ${withIssues.length}人・` +
    `慣行未確定で立てられなかったのが ${blocked.length}人・手順の提案 ${suggestions.length}件`)

// 本体（data/emperors.json）への投入は親セッションが行う。並行セッションがあるため
// エージェントには書かせない。
return {
  workDir,
  verified: ok.length,
  missing: ids.filter((id) => !ok.some((r) => r.id === id)),
  blockedByRegime: blocked.map((r) => `${r.id}: ${r.regimeConvention}`),
  issues: withIssues,
  // 手順の改善提案は握りつぶさずユーザーへ上げる（採否は PROCESS_IMPROVEMENTS.md へ）
  processSuggestions: suggestions,
  next: `断片は ${workDir}/claims/ にあります。親セッションが check_claims.py でまとめて確認し、指摘を潰してから投入してください`,
}
