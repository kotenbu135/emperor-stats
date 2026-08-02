export const meta = {
  name: 'name-block',
  description: '廟号・諡号・元号を本紀から悉皆補充する（Issue #37）。1人1エージェントで claims-first、直後に別コンテキストで検証',
  whenToUse: 'Issue #37 の名前データ補充を1ブロック（10〜20人程度）進めるとき。args に {ids, workDir, section} を渡す',
  phases: [
    { title: '調査', detail: '1人1エージェント・本紀冒頭から claims を作る' },
    { title: '検証', detail: '別コンテキストで原文へ当て直す（体数は政権の史料形態で1体か3体・報告のみ）' },
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
  required: ['id', 'wroteTo', 'claimCount', 'fields', 'regimeConvention', 'screenBucket',
             'discrepancies'],
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
    // 機械の絞り込みでこの人物がどのバケットに入っていたか（規則 R-SCREEN-FIRST）。
    // 必須にしてあるのは、絞り込みの結果を見ずに読み始めるのを止めるためと、
    // **absent バケットを「値が無い」と読む**のを止めるため（実測で17〜50%が取りこぼし）
    screenBucket: { type: 'string' },
    // 検証段に何体立てるか（規則 R-VERIFY-TIER）。政権の史料形態で決まるので人が決めない。
    // ワークフローはここに書かれた tier を見て体数を変える。**読み取れなければ厚い側（3体）**
    verificationTier: { type: 'string' },
    discrepancies: { type: 'string' },                      // 既存データとの食い違い。無ければ「なし」
    processSuggestion: { type: 'string' },                  // 手順そのものの改善案（任意・R-PROCESS-FEEDBACK）
  },
}

// 観点（lens）ごとに何を見るか。**3体を同じプロンプトで立てても冗長なだけ**なので、
// 見る場所を分ける（規則 R-VERIFY-TIER）。tier と体数の正は data/verification.json 側。
const LENSES = {
  facts: '主張を1つずつ原文へ当て直す。人物の取り違え・出来事の主体・数値を見る。' +
         '諡号と廟号の取り違え・追諡と即位時の号の混同・別政権の同名君主との取り違えを特に見る',
  kinship: '続柄と世代だけを見る。**原文が直接述べていない関係を推していないか。**' +
           '同名・避諱・追尊による取り違え、兄弟と従兄弟、実父と養父の混同',
  dates: '年号年と西暦の対応・旧暦の月・干支日だけを見る。' +
         '**複数箇所の記事を1つへ合成していないか**（引用の日付が原文と違う型の誤りが実測で246件あった）',
}

// 記録から読み取れなければ厚い側へ倒す（載せ忘れ・書き損じが薄い側へ倒れると誤りを通す）
// **部分一致にしない** — 調査段は自由記述で返すので、`dependent（own-annals の記録なし）`
// のような文字列が薄い側に当たると、その政権の誤りを1体で通してしまう
function lensesFor(tier) {
  const t = String(tier || '').trim()
  return /^own-annals\b/.test(t) && !/dependent/.test(t) ? ['facts'] : ['facts', 'kinship', 'dates']
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
    `- **次に \`python3 scripts/check_screenings.py --for ${id}\` を走らせ、出力を screenBucket に書く。**\n` +
    `  \`transcribe\` は取りこぼしと分かっている側なので、所在の1行を読んで転記します。\n` +
    `  **\`unknown\` は「機械が何も見つけなかった」だけで「値が無い」ではありません**\n` +
    `  （標本監査の実測で廟号17%・諡号50%が取りこぼしでした）。unknown を理由に空欄で閉じないこと\n` +
    `- **\`python3 scripts/check_verification.py --for ${id}\` を走らせ、出力の tier 行を\n` +
    `  verificationTier にそのまま書く**（例: \`own-annals（検証1体・facts）\`）。\n` +
    `  検証段の体数はこの記録から引きます。自分で決めないこと\n` +
    `- 既存レコードは自分で取る: \`jq '.emperors[]|select(.id=="${id}")|{id,name,regimeId,reigns:[.reigns[]|{startYear,endYear}]}' data/emperors.json\`\n` +
    `- 本紀冒頭の1行（「太宗孝武惠文皇帝，讳德光」形式）でほぼ取れます。取れない場合は無理に埋めず\n` +
    `  「調査済みだが不明」として unknown に入れてください。**空欄が正しい場合があります**\n` +
    `  （始皇帝に諡号は無い、漢は廟号を持つ皇帝が限られる、など）\n` +
    `- **民族名（西夏のタングート名・北魏の鮮卑名など）を推測で補わない**\n` +
    `- 出力は docs/process/CLAIMS_CONTRACT.md の形で \`${workDir}/claims/${id}.json\` へ Write し、\n` +
    `  \`python3 scripts/check_claims.py ${workDir}/claims/${id}.json\` をエラー0にしてから返すこと`,
    { label: `name:${id}`, phase: '調査', agentType: 'corpus-researcher', schema: RESEARCH_SCHEMA },
  ),
  // 検証の体数は政権の史料形態で決まる（1体か3体）。同じ段数で全ブロックを回すと、
  // 載記・類書に依存する政権（実測 1.56件/人）と本紀が立つ王朝（0件）に同じ厚みを掛けてしまう
  (res, id) => {
    if (!res) return null
    const lenses = lensesFor(res.verificationTier)
    return parallel(lenses.map((lens) => () => agent(
      `皇帝 id \`${id}\` の名前データを**原文から独立に**確かめてください。\n\n` +
      `先に \`_corpus_cache/${id}.txt\`（無ければ本紀の該当箇所）を読んで、` +
      `その人物の**廟号・諡号・諱・元号を原文が何と書いているか**を自分で書き出してから、` +
      `\`${workDir}/claims/${id}.json\` を開いて突き合わせてください（順序を逆にしないこと）。\n` +
      `- **あなたの観点は「${lens}」です。ここだけを見てください**: ${LENSES[lens]}\n` +
      `- 他の観点の指摘は他のエージェントが担当します。手を広げないこと\n` +
      `- **修正はしない。報告だけ**。指摘が無いときは issues を空配列で返す`,
      { label: `verify:${lens}:${id}`, phase: '検証', agentType: 'adversarial-verifier',
        schema: VERIFY_SCHEMA },
    ))).then((vs) => {
      // 3体だと同じ欠陥を複数が挙げる。指摘率を数えるときの分母は畳んだ一意件数
      // filter(Boolean) を挟むと i がずれる（死んだエージェントは null で返るので、
      // facts が落ちると kinship の指摘に facts の札が付く）。元の並びのまま添字を取る
      const all = vs.flatMap((v, i) => ((v && v.issues) || []).map((x) => ({ ...x, lens: lenses[i] })))
      const uniq = []
      const seen = new Set()
      for (const x of all) {
        const k = `${x.field}|${x.problem}`
        if (seen.has(k)) continue
        seen.add(k)
        uniq.push(x)
      }
      // 検証段の戻り値だけにすると調査段の fields・processSuggestion が消えるので畳んで返す
      return { ...res, verifiers: lenses.length, lenses, issues: uniq, rawIssueCount: all.length }
    })
  },
)

const ok = results.filter(Boolean)
// 政権単位の慣行が未確定で立てられなかった人物。握りつぶすと「調査したが空欄だった」と
// 見分けが付かなくなるので、別枠で返す（規則 R-REGIME-FIRST）
const blocked = ok.filter((r) => /^blocked:/.test(r.regimeConvention || ''))
const withIssues = ok.filter((r) => r.issues && r.issues.length)
const suggestions = ok.filter((r) => r.processSuggestion).map((r) => `${r.id}: ${r.processSuggestion}`)
// 指摘率（R-VERIFY-TIER の完了条件）の分母。**体ごとに数えると3体で水増しになる**ので
// 畳んだ一意件数を raised とし、重複ぶんは別に出す
const raised = ok.reduce((s, r) => s + (r.issues || []).length, 0)
const rawIssues = ok.reduce((s, r) => s + (r.rawIssueCount || 0), 0)
const verifierTotal = ok.reduce((s, r) => s + (r.verifiers || 0), 0)
const thick = ok.filter((r) => (r.verifiers || 0) > 1).length
log(`検証完了: ${ok.length}/${ids.length}人（検証 ${verifierTotal}体・うち3体で回したのが ${thick}人）。` +
    `指摘 ${raised}件（重複を畳む前 ${rawIssues}件）・` +
    `慣行未確定で立てられなかったのが ${blocked.length}人・手順の提案 ${suggestions.length}件`)

// 本体（data/emperors.json）への投入は親セッションが行う。並行セッションがあるため
// エージェントには書かせない。
return {
  workDir,
  verified: ok.length,
  missing: ids.filter((id) => !ok.some((r) => r.id === id)),
  blockedByRegime: blocked.map((r) => `${r.id}: ${r.regimeConvention}`),
  issues: withIssues,
  // data/verification.json の blocks へ書き写す値（規則 R-VERIFY-TIER の完了条件）。
  // confirmed は親セッションが原文で確かめてから数える — 検証段に自己採点させない
  verification: { people: ok.length, verifiers: verifierTotal, thickTierPeople: thick,
                  raised, rawIssues },
  // 手順の改善提案は握りつぶさずユーザーへ上げる（採否は PROCESS_IMPROVEMENTS.md へ）
  processSuggestions: suggestions,
  next: `断片は ${workDir}/claims/ にあります。親セッションが check_claims.py でまとめて確認し、` +
        `指摘を潰してから投入してください。**指摘のうち実欠陥だった件数を数えて ` +
        `data/verification.json の blocks へ記録**（raised=${raised}）`,
}
