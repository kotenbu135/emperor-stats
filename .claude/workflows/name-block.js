export const meta = {
  name: 'name-block',
  description: '改元 event の元号名 eraName を本紀の改元条から確定する（Issue #161・旧 #126 → #37）。1人1エージェントで claims-first、直後に別コンテキストで検証',
  whenToUse: 'Issue #161（元号名 eraName の転記）を1ブロック（初回は3〜5人・慣れたら10〜20人）進めるとき。args に {ids, workDir, section} を渡す。名前6欄（廟号・諡号・諱・字・幼名・姓）は 2026-08-16 に読み切って #126 を close したので、この段はもう名前6欄を扱わない',
  phases: [
    { title: '調査', detail: '1人1エージェント・本紀の改元条から claims を作る' },
    { title: '検証', detail: '別コンテキストで原文へ当て直す（体数は政権の史料形態で1体か3体・報告のみ）' },
  ],
}

// 段構成をリポジトリに置く理由: 毎回スクリプトを書き直すと、検証段を省いたり
// 規則を書き写し忘れたりする。規則そのものは .claude/agents/*.md 側が持っているので、
// ここは「誰に何をさせるか」だけを固定する。
//
// **2026-08-17 に中身を eraName へ差し替えた。** それまでの本文は廟号・諡号・諱を読ませる
// もので、末尾に「元号（単位2）は完了済みなのでこの段では扱わない」とまで書いてあった。
// Issue #161 が入口としてこのファイルを名指ししているのに、回すと eraName を1件も触らない
// 状態だった（meta と本文の食い違い）。

// args は JSON 文字列で渡ってくることがある（Workflow ツールの入力が文字列化される経路）。
// 素直に args.ids を読むと undefined になり「no ids」で即終了する。write-profile.js は
// 同じ対処を持っており、こちらだけ漏れていた（2026-08-06 に明ブロックで2回踏んだ）。
let a = args
if (typeof a === 'string') {
  try { a = JSON.parse(a) } catch (e) { a = {} }
}

const ids = (a && a.ids) || []
const workDir = (a && a.workDir) || '/tmp/name-block'
const section = (a && a.section) || ''

if (!ids.length) {
  log('args.ids が空です。{ids:[...], workDir:"...", section:"..."} を渡してください')
  return { error: 'no ids' }
}

const RESEARCH_SCHEMA = {
  type: 'object',
  required: ['id', 'wroteTo', 'claimCount', 'events', 'screenBucket', 'discrepancies'],
  properties: {
    id: { type: 'string' },
    wroteTo: { type: 'string' },
    claimCount: { type: 'integer' },
    // **単位は人物ではなく event**。人物単位で「埋めた欄」を返させると、
    // 1人に改元 event が複数あるとき（武則天は11件）どの event を読んだのかが消える
    events: {
      type: 'array',
      items: {
        type: 'object',
        required: ['eventId', 'eraName', 'verdict', 'evidence'],
        properties: {
          eventId: { type: 'string' },          // 例: tang-gaozong.eraChangeCount.e008
          eraName: { type: ['string', 'null'] }, // 建てた元号の名。取れなければ null
          // read-absent = 原文を読んだ上で「この改元に元号名は無い」と確定した
          // pending     = 読んだが決められない（**迷ったら pending**）
          verdict: { type: 'string', enum: ['confirmed', 'read-absent', 'pending'] },
          evidence: { type: 'string' },          // 改元条の引用と file:line（底本の字体のまま）
          builtOrDropped: { type: 'string' },    // 建てた側と判断した理由。捨てた側の名も挙げる
        },
      },
    },
    screenBucket: { type: 'string' },   // check_screenings の出力（規則 R-SCREEN-FIRST）
    verificationTier: { type: 'string' },  // check_verification の tier 行（規則 R-VERIFY-TIER）
    discrepancies: { type: 'string' },  // 既存データとの食い違い。無ければ「なし」
    processSuggestion: { type: 'string' },
  },
}

// 観点（lens）ごとに何を見るか。**3体を同じプロンプトで立てても冗長なだけ**なので、
// 見る場所を分ける（規則 R-VERIFY-TIER）。tier と体数の正は data/verification.json 側。
// **kinship の観点は eraName に掛からない**ので、字体忠実性の観点と入れ替えてある。
const LENSES = {
  facts: '**建てた元号か捨てた元号か**だけを見る。「改元」条は捨てる側の名（旧元号）も' +
         '同じ条に書くので（「改章武為建興」「改乾元為上元」）、**新しく立った側**が' +
         '入っているかを原文で確かめる。同じ紀に載る**他の帝の改元**を取り違えていないかも見る',
  dates: 'その改元条が**この event の改元か**だけを見る。1人が11回改元する例（武則天）が' +
         'あり、条を1つ取り違えると隣の event の名が入る。event の date と条の紀年・月日、' +
         '前後の元号の並びが繋がっているかを当てる',
  glyph: '**字だけ**を見る。(1) 引用が底本の字体のまま残っているか（新字体・繁体へ' +
         '変換していないか＝R-QUOTE-GLYPH）、(2) 保存値が既存レコードの表記（日本語の新字体）に' +
         '揃っているか、(3) **底本の字が HTML 抽出で欠けていないか**（北魏太武帝の「神䴥」は' +
         '原文側に 䴥 が無い。欠けたまま2字目を推測で補っていないか）',
}

// 記録から読み取れなければ厚い側へ倒す（載せ忘れ・書き損じが薄い側へ倒れると誤りを通す）
// **部分一致にしない** — 調査段は自由記述で返すので、`dependent（own-annals の記録なし）`
// のような文字列が薄い側に当たると、その政権の誤りを1体で通してしまう
function lensesFor(tier) {
  const t = String(tier || '').trim()
  return /^own-annals\b/.test(t) && !/dependent/.test(t) ? ['facts'] : ['facts', 'dates', 'glyph']
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

log(`${ids.length}人ぶんの改元 event の元号名を調べます（${section || '区分未指定'}）`)

const results = await pipeline(
  ids,
  (id) => agent(
    `皇帝 id \`${id}\` の**改元 event の元号名 \`eraChangeCount.events[].eraName\`** を、\n` +
    `正史の本紀の**改元条**から確定してください。返す JSON の id は \`${id}\` を一字一句そのまま使うこと。\n` +
    `**この段で触るのはこの1欄だけ**です（廟号・諡号・諱などの名前6欄は 2026-08-16 に読み切って\n` +
    `Issue #126 を close 済み。回数 \`eraChangeCount.count\` も日付 \`events[].date\` も対象外）。\n\n` +
    `## 何が母集団か\n` +
    `- 対象は**まだ \`eraName\` を持たない改元 event だけ**。素材は\n` +
    `  \`python3 scripts/extract_event_material.py ${id} --field eraChangeCount\` で出す\n` +
    `  （**既定で既存 note が落ちる。\`--notes on\` を付けないこと** — フックが止めます。\n` +
    `  note は前の作業ログで、原文より先に読むと note の言い回しをなぞって終わる＝R-CLAIMS-FIRST）\n` +
    `- **\`python3 scripts/check_screenings.py --for ${id} --field 'eraChangeCount.events[].eraName'\`\n` +
    `  を先に走らせ、出力を screenBucket に書く**（\`--field\` を必ず付ける。付けないと別項目の\n` +
    `  絞り込みが出てきて、それを「この作業の母集団」と読み違えます）。バケットの意味は\n` +
    `  \`unique\`＝候補1つが原文の定型句と隣り合う／\`multi\`＝候補が複数／\`note-only\`＝\n` +
    `  候補はあるが原文で定型句と隣り合わない／\`absent\`＝機械が候補を立てられなかった。\n` +
    `  **\`absent\` は「元号名が無い」ではありません**（絞り込みは読む順序を変えるだけ）\n` +
    `- **\`python3 scripts/check_verification.py --for ${id}\` の tier 行を verificationTier に\n` +
    `  そのまま書く**（例: \`own-annals（検証1体・facts）\`）。検証段の体数はこの記録から引きます\n\n` +
    `## 読み方（ここが本体）\n` +
    `- **候補は転記の当たりであって転記ではない。** 改元条は捨てる側の元号名も同じ条に書きます\n` +
    `  （「改乾元為上元」「改天福九年為開運元年」「以建平二年為太初元將元年」）。\n` +
    `  \`eraName\` に入るのは**新しく建った側**です。どちらを採ったかと、その理由を\n` +
    `  builtOrDropped に書いてください（捨てた側の名も挙げる）\n` +
    `- **値は grep／\`scripts/quote_helper.py\` の出力からコピーする**（R-QUOTE-NO-TYPE。手打ち禁止）。\n` +
    `  引用 evidence は**底本の字体のまま**（簡体の底本なら簡体のまま＝R-QUOTE-GLYPH）。\n` +
    `  一方で**保存する値 eraName は既存レコードの表記に揃える**（このデータセットは日本語の新字体。\n` +
    `  例: 底本「开运」→ 値「開運」）。どちらへ倒したかを1行残すこと\n` +
    `- **コーパスに \`.{0,N}KW.{0,N}\` 型のコンテキスト抽出 grep を掛けない**（R-CORPUS-GREP。\n` +
    `  素の grep は ugrep でメモリ4GB超に暴走し WSL ごと落ちます）。\`_corpus_cache/${id}.txt\` を\n` +
    `  Read するか、行単位の grep にすること\n` +
    `- **走査語は書ごとに割れる** — 改元・建元・改年・改號／改号・號年／号年・紀元のほか、\n` +
    `  「詔改明年元」（名を挙げずに翌年の改元だけ布告する形）・「以〈旧〉為〈新〉元年」・\n` +
    `  「其以致和元年為天暦元年」のように**改元の語を使わない条**があります。\n` +
    `  1語で0件なら「無い」ではなく、語を変えて当て直すこと（R-SWEEP-DETECTION）\n` +
    `- **元号名は2字とは限らない** — 太平真君・万歳通天・天祐垂聖・天賜礼盛国慶のような\n` +
    `  3〜6字の元号があります。絞り込みの候補（2字固定）に引きずられないこと\n` +
    `- **本人のキャッシュに無いことがある。** 十国・唐末群雄・西夏は本紀が立たず、\n` +
    `  十国春秋・資治通鑑・西夏書事・列伝から取ることになります。その場合は\n` +
    `  \`docs/process/SOURCE_MAPPING.md\` で巻を引き、**引用が実在する巻を source に書く**\n` +
    `- **底本の字が壊れていることがある**（北魏太武帝の「神䴥」は抽出後の原文に 䴥 が無い）。\n` +
    `  **欠けた字を推測で補わない** — verdict を \`pending\` にし、evidence に欠けている位置を書く\n` +
    `- **元号名がそもそも無い改元がある**（漢文帝の即位建元は原文が「元年」で止まる／\n` +
    `  西魏恭帝は独自の元号を立てない）。読み終えて無いと確定したら \`read-absent\`、\n` +
    `  読んだが決められないなら \`pending\`。**迷ったら pending**（read-absent は不在確定として\n` +
    `  数えられるので、迷いを過大報告に落とさない）。**推測で埋めない**（原典に無いものは空のまま）\n` +
    `- Web は「先に読むか後回しにするか」「どの名で grep するか」を決める道具には使ってよいが、\n` +
    `  **値は必ずコーパスの grep 出力から取る**・**Web の沈黙で \`read-absent\` にしない**\n\n` +
    `## 返し方\n` +
    `- 出力は docs/process/CLAIMS_CONTRACT.md の形で \`${workDir}/claims/${id}.json\` へ Write し、\n` +
    `  \`python3 scripts/check_claims.py ${workDir}/claims/${id}.json\` をエラー0にしてから返すこと\n` +
    `- **data/emperors.json は書き換えない**（投入は親セッションが patch_emperor.py で行う）`,
    { label: `era:${id}`, phase: '調査', agentType: 'corpus-researcher', schema: RESEARCH_SCHEMA },
  ),
  // 検証の体数は政権の史料形態で決まる（1体か3体）。同じ段数で全ブロックを回すと、
  // 載記・類書に依存する政権（実測 1.56件/人）と本紀が立つ王朝（0件）に同じ厚みを掛けてしまう
  (res, id) => {
    if (!res) return null
    const lenses = lensesFor(res.verificationTier)
    return parallel(lenses.map((lens) => () => agent(
      `皇帝 id \`${id}\` の**改元 event の元号名**を**原文から独立に**確かめてください。\n\n` +
      `先に \`_corpus_cache/${id}.txt\`（無ければ本紀・列伝の該当箇所）を読んで、` +
      `その人物の**改元条が原文で何と書いているか**（建った元号・捨てた元号・条の紀年）を` +
      `自分で書き出してから、\`${workDir}/claims/${id}.json\` を開いて突き合わせてください` +
      `（順序を逆にしないこと）。\n` +
      `- **あなたの観点は「${lens}」です。ここだけを見てください**: ${LENSES[lens]}\n` +
      `- 他の観点の指摘は他のエージェントが担当します。手を広げないこと\n` +
      `- **修正はしない。報告だけ**。指摘が無いときは issues を空配列で返す`,
      { label: `verify:${lens}:${id}`, phase: '検証', agentType: 'adversarial-verifier',
        schema: VERIFY_SCHEMA },
    ))).then((vs) => {
      // 3体だと同じ欠陥を複数が挙げる。指摘率を数えるときの分母は畳んだ一意件数
      // filter(Boolean) を挟むと i がずれる（死んだエージェントは null で返るので、
      // facts が落ちると dates の指摘に facts の札が付く）。元の並びのまま添字を取る
      const all = vs.flatMap((v, i) => ((v && v.issues) || []).map((x) => ({ ...x, lens: lenses[i] })))
      const uniq = []
      const seen = new Set()
      for (const x of all) {
        const k = `${x.field}|${x.problem}`
        if (seen.has(k)) continue
        seen.add(k)
        uniq.push(x)
      }
      // 検証段の戻り値だけにすると調査段の events・processSuggestion が消えるので畳んで返す
      return { ...res, verifiers: lenses.length, lenses, issues: uniq, rawIssueCount: all.length }
    })
  },
)

const ok = results.filter(Boolean)
const evs = ok.flatMap((r) => r.events || [])
const confirmed = evs.filter((e) => e.verdict === 'confirmed' && e.eraName)
const readAbsent = evs.filter((e) => e.verdict === 'read-absent')
const pending = evs.filter((e) => e.verdict === 'pending')
const withIssues = ok.filter((r) => r.issues && r.issues.length)
const suggestions = ok.filter((r) => r.processSuggestion).map((r) => `${r.id}: ${r.processSuggestion}`)
// 指摘率（R-VERIFY-TIER の完了条件）の分母。**体ごとに数えると3体で水増しになる**ので
// 畳んだ一意件数を raised とし、重複ぶんは別に出す
const raised = ok.reduce((s, r) => s + (r.issues || []).length, 0)
const rawIssues = ok.reduce((s, r) => s + (r.rawIssueCount || 0), 0)
const verifierTotal = ok.reduce((s, r) => s + (r.verifiers || 0), 0)
const thick = ok.filter((r) => (r.verifiers || 0) > 1).length
log(`検証完了: ${ok.length}/${ids.length}人・event ${evs.length}件` +
    `（確定 ${confirmed.length}・不在確定 ${readAbsent.length}・保留 ${pending.length}）。` +
    `検証 ${verifierTotal}体・うち3体で回したのが ${thick}人。` +
    `指摘 ${raised}件（重複を畳む前 ${rawIssues}件）・手順の提案 ${suggestions.length}件`)

// 本体（data/emperors.json）への投入は親セッションが行う。並行セッションがあるため
// エージェントには書かせない。
return {
  workDir,
  verified: ok.length,
  missing: ids.filter((id) => !ok.some((r) => r.id === id)),
  // 投入する値。**pending と read-absent は投入しない**（空のままが正）
  toWrite: confirmed.map((e) => `${e.eventId} = ${e.eraName}`),
  readAbsent: readAbsent.map((e) => e.eventId),
  pending: pending.map((e) => `${e.eventId}: ${e.evidence}`),
  issues: withIssues,
  // data/verification.json の blocks へ書き写す値（規則 R-VERIFY-TIER の完了条件）。
  // confirmed は親セッションが原文で確かめてから数える — 検証段に自己採点させない
  verification: { people: ok.length, verifiers: verifierTotal, thickTierPeople: thick,
                  raised, rawIssues },
  processSuggestions: suggestions,
  next: `断片は ${workDir}/claims/ にあります。親セッションが check_claims.py でまとめて確認し、` +
        `指摘を潰してから **python3 scripts/patch_emperor.py <皇帝id> --set ...**（まず --dry-run）で投入。` +
        `投入後は **python3 scripts/validate_emperors.py**（末尾の [era-name] 行が転記のラチェット。` +
        `増えた数だけ ERA_NAME_BASELINE を上げる）と ` +
        `**python3 scripts/verify_quotes.py --backfill && --check --check-era-names**` +
        `（ゲートD。**建てた側であることを見るのはここだけ**で、validate の C は捨てた側でも通る）。` +
        `サイトは eraName を検索文字列として食うので、` +
        `**cd site && python3 tools/build-font-subset.py && npm run build** まで確認する` +
        `（新出の漢字が入るとフォントのサブセット不足でビルドが落ちる）。` +
        `**指摘のうち実欠陥だった件数を数えて data/verification.json の blocks へ記録**（raised=${raised}）`,
}
