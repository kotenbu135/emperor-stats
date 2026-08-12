export const meta = {
  name: 'review-profile',
  description: '紹介文の外部レビュー（review/*.md）を Claude で回し、指摘表を review/result/ へ書く',
  whenToUse: 'review/ の依頼文をまとめてレビューするとき。args に {files:[...]} か {ids:[...]}',
  phases: [{ title: 'レビュー', detail: '1本につき1体。依頼文どおりに読んで指摘表を書く' }],
}

// **やることはブラウザのチャット1往復と同じ**。依頼文はファイルの中で完結しているので、
// 渡して、読ませて、表を書かせる。それだけ。
//
// 2026-08-12 に一度、観点を2体に割り・構造化出力を挟み・書き出し専用の3体目を足した形で
// 組んだが、ブラウザ1往復（2分）に対して1本12分・費用3倍になり、肝心の観点1では負けた。
// 負けた理由は体の数でも思考量でもなく **Web 検索を使わせていなかったこと** だったので、
// 段は1つに戻し、Web 検索だけを足してある。
const PROMPT = (path, outDir, name) => `
あなたは中国皇帝データセットの紹介文を外部レビューする立場です。

1. ${path} を Read で全文読む。冒頭に依頼文（観点1〜9・返し方）が入っているので、
   **その依頼文の指示にそのまま従う**
2. **Web 検索を使って通説と突き合わせる。** 人物名・地名・器物名・年・序数・字の異同を
   検索する（記憶だけで当てると「轀涼車／轀輬車」「胡亥は第十八子」「呂不韋は陽翟の大商人」の
   ような所が素通りする）。WebSearch が見当たらなければ ToolSearch で
   「select:WebSearch,WebFetch」を読み込んでから使う
3. 指摘の表を作り、${outDir}/${name} へ Write する。ファイルの中身は
   「<!-- claude-opus-5 workflow / ${name} / 指摘N件 -->」の1行、空行、そして
   「| 箇所 | 観点 | 指摘 |」の表だけ
4. 返すのは "ok ${name} N件" の1行だけ（表は返さない）

守ること:
- **指摘だけ。書き直し案・リライトは絶対に書かない**（過去に推測で埋めた文へ史実の誤りが
  混じった事故がある）
- 箇所は本文に振られた [番号] で指す。本文に実在する番号だけを使う
  （末尾の「検索結果に出る1文」にも番号が振ってある）
- **Web は差分検出器であって根拠ではない。** 返すのは「通説では〜とされることが多い」の形で、
  訂正の断定はしない。**Web の文章を指摘の中へ書き写さない**。原文と割れたらこのデータセットは
  原文を採るが、「割れている」ことは報告してよい
- **原文（china-history・_corpus_cache・emperors.json）は読まない。** 読んだ時点で外の目では
  なくなる。読むのは渡された1枚だけ
- **確信度で絞らない。** 依頼文が「訂正ではなく通説ではこう言われている、の形で挙げよ」と
  言っている＝疑いの段階で出すのが正しい。ただし依頼文が先に打ち消している例
  （『史記』に「坑儒」の語は無い）は出さない
- 字数・表記ゆれ・禁止語・短さは出さない。呼び方が通用名に揃えてあることも指摘しない
- **段落を1つずつ順に舐める**（気になった所だけ拾わない）。ただし**舐めた過程は出力に書かない**
`

const input = typeof args === 'string' ? JSON.parse(args) : args || {}
const outDir = input.out || 'review/result'
const files = (input.files || []).slice()
if (input.ids) for (const id of input.ids) files.push(`review/${id}.md`)
if (!files.length) throw new Error('args に {files:[...]} か {ids:[...]} が要ります')

log(`${files.length}本（1本につき1体・Web 検索あり）→ ${outDir}/`)

const results = await pipeline(files, (path) => {
  const name = path.split('/').pop()
  return agent(PROMPT(path, outDir, name), {
    label: `review:${name}`,
    phase: 'レビュー',
    effort: 'high',
  }).then((text) => `${name} ${String(text || '').trim().slice(0, 40)}`)
})

const ok = results.filter(Boolean)
log(`完了 ${ok.length}/${files.length}本`)
return { files: ok.length, perFile: ok }
