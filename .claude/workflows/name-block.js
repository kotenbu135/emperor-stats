export const meta = {
  name: 'name-block',
  description: '元号名（と必要なら名前欄）を本紀から悉皆補充する（Issue #161・旧 #126 → #37）。1人1エージェントで claims-first、直後に別コンテキストで検証',
  whenToUse: 'Issue #161（元号名 eraName の転記）を1ブロック（10〜20人程度）進めるとき。args に {ids, workDir, section} を渡す。名前6欄は 2026-08-16 に読み切って #126 を close したので、この段が名前欄で動くのは訂正のときだけ',
  phases: [
    { title: '調査', detail: '1人1エージェント・本紀冒頭から claims を作る' },
    { title: '検証', detail: '別コンテキストで原文へ当て直す（体数は政権の史料形態で1体か3体・報告のみ）' },
  ],
}

// 段構成をリポジトリに置く理由: 毎回スクリプトを書き直すと、検証段を省いたり
// 規則を書き写し忘れたりする。規則そのものは .claude/agents/*.md 側が持っているので、
// ここは「誰に何をさせるか」だけを固定する。

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
    `皇帝 id \`${id}\` の名前データ（廟号 templeName・諡号の短縮呼称 posthumousName・\n` +
    `諡号の全長形 posthumousNameFull・諱 personalName）を` +
    `正史の本紀から確定してください。返す JSON の id は \`${id}\` を一字一句そのまま使うこと。\n\n` +
    `- **最初に \`python3 scripts/check_regime_conventions.py --for ${id}\` を走らせる。**\n` +
    `  廟号を立てるか・どの位置にどんな書式で載るかは人物の属性ではなく**政権の慣行**なので、\n` +
    `  政権単位で先に確定してあります。出力の「所在」「書式」に従って読み、\n` +
    `  使った慣行（書名・判定・所在）を regimeConvention にそのまま書いてください。\n` +
    `  **出力に「保存形」の行があれば、それが「読めた形をどちらの欄へ入れるか」の正です。**\n` +
    `  諡号の欄は2つに割れており（2026-08-10・Issue #37 → 後継 #126）、原文に見えた1つの形を\n` +
    `  そのまま両方へ入れてよい政権と、片方が空になる政権があります。自分で決めないこと\n` +
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
    `- **本紀は2箇所を読むこと。冒頭1行だけで閉じない**（2026-08-10 追記）:\n` +
    `  (1) 冒頭1行（「太宗孝武惠文皇帝，讳德光」形式）＝廟号・諱・**加諡形**\n` +
    `  (2) その帝の**崩御条**（「群臣上谥曰〈諡〉，庙号〈廟号〉」形式）＝**初諡**\n` +
    `  冒頭が掲げるのは加諡形、崩御条に在るのが初諡で、**別の主張**です。\n` +
    `  短縮呼称 posthumousName に何を入れるかを決める前に、この2つを必ず区別すること\n` +
    `  （唐では初諡を短縮呼称と見なさない判断を採り、posthumousName は空にしています）\n` +
    `- **諡の段は posthumousNames へ全部入れる**（2026-08-10 追加）。崩御条は初諡に続けて\n` +
    `  後代の加諡を書き継ぐので（「谥曰文皇帝，庙号太宗。…上元元年八月，改上尊号曰文武圣皇帝。\n` +
    `  天宝十三载二月，改上尊号为文武大圣大广孝皇帝」）、**授けられた順に [{form, year?}] で並べる**。\n` +
    `  year は**原文がその段に紀年を与えている場合だけ**（初諡はふつう空）で、値は元号年に\n` +
    `  対応する西暦年（月日は主張しない。大中三年十二月＝849）。出典はこの欄に入れず、\n` +
    `  引用は claims に残すこと。生前の尊号・徽号は諡ではないので**段に入れない**\n` +
    `- **段を数え落とす場所が4つある**（2026-08-10 の唐・明の実測）:\n` +
    `  (1) **加諡の条が本人の巻に無い** — 唐の憲宗は卷十八下（宣宗紀）、宣宗は卷十九上\n` +
    `      （懿宗紀）、昭宗は卷二十下（哀帝紀）に条が在る。崩御条だけで閉じないこと\n` +
    `  (2) **「尊号」で書かれた加諡は諡の語彙に掛からない** — 唐高祖・太宗の674年・754年の\n` +
    `      加諡は「改上尊号曰」。走査語彙に尊号を足し、崩・葬・廟号・追を含む窓だけ見る\n` +
    `      （生前の尊号が大半なので窓で絞る）\n` +
    `  (3) **崩御条が形を出さない書がある** — 明史は16人中14人が「上尊谥，庙号〈廟号〉，\n` +
    `      葬〈陵〉」とだけ書く。その場合は冒頭形の1段になる（1段でも読解の結果であって未読ではない）\n` +
    `  (4) **同じ書の中で形が割れる** — 割れたら**証人の多い形**を採る（唐高宗の754年形は\n` +
    `      崩御条「天皇大弘孝皇帝」に対し条＋冒頭が「天皇大聖大弘孝皇帝」で後者）\n` +
    `- **最終段はその人物の諡ではない。** 後代の加諡・改諡が書に載っていても、その書が\n` +
    `  名乗りとして掲げ続ける形は posthumousNameFull の側（昭宗の「恭霊荘閔孝皇帝」は\n` +
    `  905年の降格で、舊唐書の冒頭は「聖穆景文孝皇帝」のまま）。posthumousNameFull を\n` +
    `  最終段に合わせて書き換えないこと\n` +
    `- **段は「その人物が名乗る底本」の中からだけ採る。** 他書にしか無い加諡は入れない\n` +
    `  （欄の主張が「名乗る原典が記す順」なので混ぜると主張と中身がずれる）。見つけたら\n` +
    `  processSuggestion で残量表へ上げること\n` +
    `- **請われただけの諡は段にしない**（授けられたものだけ）。唐哀帝の「昭宣光烈孝皇帝」は\n` +
    `  有司の請で、舊唐書は「今只取本谥」と明言する\n` +
    `- **「皇帝」で結ばない王諡が段に入ることがある**（明代宗の「戾」）。落とさずに入れて、\n` +
    `  findings の note に王諡である理由を書くこと\n` +
    `  取れない場合は無理に埋めず「調査済みだが不明」として unknown に入れてください。\n` +
    `  **空欄が正しい場合があります**（始皇帝に諡号は無い、漢は廟号を持つ皇帝が限られる、など）\n` +
    `- **空欄が正しいと決めた欄は findings に \`{"value": null, "verdict": "read-absent"}\` で残す**\n` +
    `  （書かないと「まだ読んでいない」と区別が付かず、確定率に乗りません）。原文は読み終わったが\n` +
    `  値の扱いが判断待ちのときは \`"verdict": "pending"\`。**迷ったら pending**（read-absent は\n` +
    `  不在確定として数えられるので、迷いを過大報告に落とさない）\n` +
    `- **\`read-absent\` を書く前に閉域の4軸を当てること**（2026-08-14 に足した。本人の\n` +
    `  \`_corpus_cache\` の中を語彙で走査して0件、という形の \`read-absent\` は実測で破れている —\n` +
    `  **値が在ると分かっている174人へ同じ検出器を掛けると27人（15.5%）が沈黙し、うち13人は\n` +
    `  保存値の文字列すらキャッシュに出ない**〔\`python3 scripts/screens/temple_name.py --audit\`〕）:\n` +
    `  (1) **同じ書のキャッシュの外** — 巻の見出し行・史臣曰／論曰・志（礼志・楽志）。\n` +
    `      清 聖祖の廟号の裏は礼志にあり、本紀の上諡条は「庙号」の語を使わない。\n` +
    `      隋 恭帝侑の短縮諡は巻の見出し「帝纪第五　恭帝」と史臣曰にしか出ない\n` +
    `  (2) **本紀・帝紀の外の列傳** — 北魏 南安王余の諡は帝紀に無く列傳 卷十八の\n` +
    `      「高宗葬以王礼，谥曰隐」に在った（本人のキャッシュだけで閉じて1件取りこぼした実例）\n` +
    `  (3) **別政権の書** — 亡国・廃位した君主は**諡を贈った主体が後継／敵対政権**のことがある\n` +
    `      （梁 貞陽侯淵明は南史・北齊書、西梁 後主 琮は舊唐書 蕭銑伝、元順帝の「惠宗」は\n` +
    `      北元の追尊で元史に無い）。**その政権の書1冊で閉じない**\n` +
    `  (4) **走査語は書ごと・1冊の中でも割れる** — 魏書は庙号／庙曰／庙称を使い分け、\n` +
    `      後漢書は「庙曰」「尊庙曰」で「庙号」を1件も使わない。号の授与が「尊〈X〉为〈Y〉」\n` +
    `      「追尊」「號曰」で書かれると諡・廟の語彙に掛からない。**必ず \`hanzi_norm\` の\n` +
    `      \`norm_for_match\` を通してから当てる**（字形を数え上げると次の異体で穴が開く）\n` +
    `  4軸のどれかを当てられなかったら \`read-absent\` ではなく \`pending\` にし、\n` +
    `  **\`sweptWords\`／\`sweptScope\` には実際に走査した語と範囲だけを書くこと**\n` +
    `  （走査していない語を並べると、次に読む人がその範囲を「見た」と読む）\n` +
    `- **引用は底本の字体のまま**（簡体の底本なら簡体のまま）。一方で findings の\n` +
    `  **値は既存レコードの表記に揃える**（このデータセットは日本語の新字体。例:\n` +
    `  底本「大圣大广孝皇帝」→ 値「大聖大広孝皇帝」）。どちらへ倒したかを note に1行残すこと\n` +
    `- **民族名（西夏のタングート名・北魏の鮮卑名など）を推測で補わない**\n` +
    `- 元号（単位2）と民族名（単位3）は 2026-08-03 に完了済みなので**この段では扱わない**。\n` +
    `  別称 aliases は欄への投入対象外だが、冒頭・贊に出たら claims と findings に残してよい\n` +
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
      `その人物の**廟号・諡号・諱を原文が何と書いているか**を自分で書き出してから、` +
      `（諡号は**短縮呼称 posthumousName と全長形 posthumousNameFull の2欄に割れている**ので、` +
      `どちらの欄へ入っているかも見る。正は check_regime_conventions の「保存形」の行）` +
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
        `data/verification.json の blocks へ記録**（raised=${raised}）。` +
        `投入が済んだら **python3 scripts/save_name_fragments.py ${workDir}/claims --tag <ブロック名>**` +
        `（まず --apply 無しで下見）で断片を保存する — workDir は /tmp なので、` +
        `諡号の全長形や加諡の経緯（保存値に入らない部分）は保存しないと消える。` +
        `**cp で上書きしないこと**（同じ人物の断片が別のブロックで既に在ることがあり、` +
        `上書きすると前回の read-absent・別項目の findings が消える）。` +
        `スクリプトが持つ規約は4つ: (1) 旧側にしか無い欄を持ち越す、` +
        `(2) 空配列は null ＋ read-absent へ正規化する、` +
        `(3) **既存の read-absent を pending へ後退させない**、` +
        `(4) 旧側の値を新側の空で消さない（要判断として出す）`,
}
