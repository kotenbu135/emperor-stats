import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { BreakdownBar } from "@/components/home-v2/breakdown-panel";
import { LabCard, LabFigure } from "@/components/lab/lab-card";
import { StackedRows } from "@/components/lab/stacked-rows";
import { RateBars } from "@/components/lab/rate-bars";
import { ConcurrentPanel } from "@/components/lab/concurrent-panel";
import { SurvivalPanel } from "@/components/lab/survival-panel";
import { buildMetadata } from "@/lib/seo";
import {
  getCampaignStats,
  getConcurrentStats,
  getConfidenceStats,
  getEraChangeStats,
  getEraNameMax,
  getFacadeStats,
  getRegimeFateStats,
  getRelationStats,
  getSurvivalStats,
  getTitleOriginStats,
  labEmperorCount,
} from "@/lib/lab-stats";

/**
 * グラフ候補の検討面（/lab）。
 *
 * docs/site-design/CHART_CANDIDATES_2026-07-31.md で「形の強さ 中以上」と評価された
 * 9候補を実物にした面で、**採否を決めるための面**（公開ページではない）。
 * したがって:
 *  - `SITE_SECTIONS`・`nav-data.ts`・sitemap・OGP画像には登録しない。noindex を付ける
 *  - 集計は `lib/lab-stats.ts`（/lab 専用・emperors.ts とは別ファイル）
 *  - 数値は `site/tools/chart-candidates-stats.py` の出力と一致させてある。
 *    検討記録の表と突き合わせるため、時代は `catalogs.eras` の11区分
 *    （サイト本体の `ERA_BY_SECTION` 15区分ではない）
 *
 * 採用が決まった候補はここから公開ページへ移し、この面ごと畳む。
 */
export const metadata: Metadata = {
  ...buildMetadata({
    path: "/lab",
    title: "グラフ候補の検討面",
    description: "チャート候補9件の実装検討用（非公開・検索エンジンには出さない）",
  }),
  robots: { index: false, follow: false },
};

/** 100%積み上げ帯の色。**9区分目の色を作らない**（--series-* は8色）。 */
const TWO_TONE = {
  colors: ["series8", "series1"] as const,
  bg: ["bg-series-8", "bg-series-1"],
};

export default function LabPage() {
  const campaign = getCampaignStats();
  const facade = getFacadeStats();
  const eraChange = getEraChangeStats();
  const eraNameMax = getEraNameMax();
  const titleOrigin = getTitleOriginStats();
  const regimeFate = getRegimeFateStats();
  const relation = getRelationStats();
  const concurrent = getConcurrentStats();
  const survival = getSurvivalStats();
  const confidence = getConfidenceStats();

  return (
    <>
      <PageHeader
        title="グラフ候補の検討面"
        description="チャート候補の検討記録（CHART_CANDIDATES_2026-07-31.md）で「形の強さ 中以上」だった9件を実物にした面。採否を決めるための面で、公開ページではない。"
      />
      <div className="px-gutter py-section md:px-gutter-wide">
        <div className="mx-auto w-full max-w-content space-y-8">
          <div className="rounded-lg border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground md:p-5">
            <p>
              数値はすべて{" "}
              <code className="text-xs text-foreground">
                site/tools/chart-candidates-stats.py
              </code>{" "}
              の出力と一致させてある（{labEmperorCount}名全件）。
              時代の区切りは検討記録と突き合わせるため{" "}
              <code className="text-xs text-foreground">meta.catalogs.eras</code>{" "}
              の11区分で、
              <strong className="text-foreground">
                サイト本体の15区分ではない
              </strong>
              — 盤面へ載せるときは組み替えが要り、南北朝69名が南朝・北朝へ割れて数字が動く。
              検討記録の表が11区分のうち近代（1名・袁世凱）を落として364名になっている箇所は、
              ここでは落とさずに出している（合計は{labEmperorCount}名）。
            </p>
            <p className="mt-2">
              並びは検討記録の「16. 評価まとめ」の段（すぐ作れて強い → 形が最も強い →
              設計意図に沿う → 1枚に絞れば通る → 別の役割 → 同じ材料の別断面）。
              落とした5候補（10・11・12・13・14）はここに無い。
            </p>
          </div>

          {/* ---------------------------------------------- すぐ作れて強い */}
          <LabCard
            no={3}
            title="一世一元への転換"
            strength="最強"
            description="即位したあとに元号を変えたか。明5%・清8%に対し、それ以前は33〜62%で段差がそのまま残る。"
            population={`${labEmperorCount}名・欠損0`}
            notes={[
              <>
                軸は「即位後に元号を変えたか」。
                <code className="text-foreground">eraChangeCount</code>{" "}
                は即位に伴う最初の建元を1回に数えるので、
                <strong className="text-foreground">
                  count ≥ 2 は「2回改元した」ではない
                </strong>
                。
              </>,
              <>
                count 0 の33名は2種に割れる。切り分けは note の文言でなく在位年で機械的に決めた
                — 最初の年号「建元」は前140年（漢武帝）なので、
                <code className="text-foreground">lastEndYear &lt; -140</code> の
                {eraChange.preInstitution.count}名（{eraChange.preInstitution.names.join("・")}
                ）が「年号制度の成立前」、残り{eraChange.continued}名が「先帝の元号を継続」。
              </>,
              <>
                制度の成立前に在位を終えたのに count が 0 でない例外が2名いる（
                {eraChange.preInstitutionWithCount
                  .map((x) => `${x.name} ${x.count}`)
                  .join("・")}
                ）。前元／中元／後元の紀年更新を当データが改元として数えているため。
              </>,
            ]}
          >
            <StackedRows
              segments={eraChange.segments}
              rows={eraChange.rows}
              colors={["series1", "gray", "series5"]}
              bgClasses={["bg-series-1", "bg-gray-500", "bg-series-5"]}
            />
            <div className="mt-5 border-t border-border pt-3">
              <p className="text-xs font-medium text-foreground">
                1人の皇帝が使った元号の数の最大（段差がもう一度出る側）
              </p>
              <p className="mt-1.5 text-xs leading-relaxed tabular-nums text-muted-foreground">
                {eraNameMax.map((x) => `${x.label} ${x.max}`).join("　")}
              </p>
            </div>
          </LabCard>

          {/* ---------------------------------------------- 形が最も強い */}
          <LabCard
            no={7}
            title="同時に何人が帝号を持っていたか"
            strength="最強"
            description={`年単位では最大${concurrent.yearMax.value}人（${concurrent.yearMax.year}年）だが、日付で数え直すと同時在位は最大${concurrent.dayMax.value}人（${concurrent.dayMax.date}）。`}
            population={`全${concurrent.segments.total}在位／日単位は日付で区間を作れる${concurrent.segments.usable}在位`}
            notes={[
              <>
                <strong className="text-foreground">「同時に」と言うなら日単位</strong>
                。{concurrent.yearMax.year}
                年に在位記録を持つ14名のうち、煬帝は4月に殺され、恭帝侑は6月に譲位し、薛挙は9月に没している。
              </>,
              <>
                日単位の値は月・年精度の日付を埋めて出したもの（欠けた月は開始側1月・終了側12月、
                欠けた日は開始側1日・終了側28日）。
                <strong className="text-foreground">埋め方は区間を伸ばす向き</strong>
                なので上限側の見積り。618年の14在位はすべて日まで下りているので、この年は埋めの影響を受けない。
              </>,
              <>
                表示は{concurrent.range.from < 0 ? `前${-concurrent.range.from}` : concurrent.range.from}年〜
                {concurrent.range.to}年で切ってある。近代の
                {concurrent.excluded.map((x) => `${x.name}（${x.period}）`).join("・")}
                を含めると1913〜1933年が0人になるが、これは
                <strong className="text-foreground">収録基準の産物であって歴史的空位ではない</strong>。
                表示範囲内で0人なのは{concurrent.zeroYears.length}年（
                {concurrent.zeroYears
                  .map((y) => (y < 0 ? `前${-y}` : `${y}`))
                  .join("・")}
                年）。
              </>,
              <>
                フィルタで山の高さが倍変わる — <code className="text-foreground">standing: rival</code>
                を除くと618年は12人、正統王朝だけに絞ると全期間の最大は7人（559・560・577年）。
                この図はフィルタなしの全件。
              </>,
              <>
                日単位に切り替えると母集団が{concurrent.segments.usable}在位へ落ちる。落ちるのは十六国系に偏るので、
                <strong className="text-foreground">4世紀の山は痩せるがピークの618年は影響を受けない</strong>。
              </>,
              <>
                <strong className="text-foreground">
                  日単位の線が0へ落ちる{concurrent.dayGapYears.length}年は「皇帝がいなかった年」ではない
                </strong>
                — 在位に日付が無くて線から落ちているだけ（前221〜前207年の始皇帝・二世皇帝と、
                8〜24年の新、317年）。盤面へ載せるなら、この層をどう見せるかを決める必要がある。
              </>,
            ]}
          >
            <ConcurrentPanel
              points={concurrent.points}
              usable={concurrent.segments.usable}
              total={concurrent.segments.total}
            />
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <LabFigure
                value={`${concurrent.dayMax.value}人`}
                label={`同時在位の最大（${concurrent.dayMax.date}）`}
                seal
              />
              <LabFigure
                value={`${concurrent.yearMax.value}人`}
                label={`年単位の最大（${concurrent.yearMax.year}年）`}
              />
              <LabFigure
                value={`${concurrent.distribution.find((d) => d.people === 1)?.years ?? 0}年`}
                label="皇帝が1人だけだった年（表示範囲内）"
              />
              <LabFigure
                value={`${concurrent.points.length}年`}
                label="表示範囲の長さ"
              />
            </div>
          </LabCard>

          <LabCard
            no={8}
            title="在位継続率カーブ"
            strength="強"
            description={`即位からN年後に、まだ在位している皇帝が何%残っているか。KPI「平均${survival.meanAll}年」の歪みを直す図でもある（中央値${survival.medianAll}年・平均以上に在位したのは${survival.aboveMean}名）。`}
            population={`全${survival.counts.all}名／日まで確定した${survival.counts.exact}名`}
            notes={[
              <>
                2本の線は5年で6ポイント離れる。日まで下りていない
                {survival.counts.all - survival.counts.exact}名は在位が短い側に偏っており（東晋・十六国は55名中41名）、
                除くと曲線が上へ持ち上がる。
                <strong className="text-foreground">
                  「欠損ゼロ」と言えるのは概算値（approxDays＝年365換算）を使う場合だけ
                </strong>
                。
              </>,
              <>
                複数回在位の8名は合算値で描いているので、厳密には「N年後もまだ在位」の意味にならない。
                初回在位だけで描くと中央値は{survival.medianAll}年→{survival.medianFirst}年（曲線の形はほぼ同じ）。
                この図は<strong className="text-foreground">合算値</strong>。
              </>,
              <>
                層別は入れていない。検討記録が前版の「自力で建てた71名 vs 受け継いだ294名」を
                取り下げており、名前を正すと凡例が「位を誰からも受けずに称した71名」になる
                — その説明が1行で済まないなら層別を入れない、という判断に従った。
              </>,
            ]}
          >
            <SurvivalPanel curve={survival.curve} />
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[36rem] text-xs tabular-nums">
                <caption className="pb-2 text-left text-xs text-muted-foreground">
                  検討記録と突き合わせる目盛り（%）
                </caption>
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th scope="col" className="py-1 pr-3 text-left font-medium">
                      経過
                    </th>
                    {survival.marks.map((m) => (
                      <th key={m.years} scope="col" className="py-1 text-right font-medium">
                        {m.years}年
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <th scope="row" className="py-1 pr-3 text-left font-normal text-muted-foreground">
                      全{survival.counts.all}名
                    </th>
                    {survival.marks.map((m) => (
                      <td key={m.years} className="py-1 text-right text-foreground">
                        {m.all}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="py-1 pr-3 text-left font-normal text-muted-foreground">
                      日まで確定{survival.counts.exact}名
                    </th>
                    {survival.marks.map((m) => (
                      <td key={m.years} className="py-1 text-right font-medium text-foreground">
                        {m.exact}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </LabCard>

          {/* ---------------------------------------------- 設計意図に沿う */}
          <LabCard
            no={2}
            title="建前と実態の食い違い（手続きの形式 × 実際に決めた主体）"
            strength="強"
            description={`スキーマが「建前を保存する軸」として設計した procedure を、実際に位を決めた主体と交差させたもの。禅譲儀礼${facade.ceremony.total}件のうち${facade.ceremony.self}件は「本人が決めた」。`}
            population={`${labEmperorCount}名・欠損0`}
            notes={[
              <>
                <code className="text-foreground">decidedBy</code>{" "}
                は配列なので、導出ルールと同じ優先順位（本人 &gt; 先帝 &gt; 第三者）で1つに畳んである。
              </>,
              <>
                ヒートマップにしていないのは
                <strong className="text-foreground">セルが薄いから</strong>
                — 5×4のうち実数を持つのは12個で、うち7個が20未満。行ごとの帯なら「ほぼゼロ」として正しく読める。
                盤面へ載せるなら「禅譲儀礼{facade.ceremony.total}件の内訳」だけを1本の帯で出すのが安全側。
              </>,
              <>
                「史料から決着不能」の17名は
                {facade.undeterminedAllNormal ? "全員が" : "全員が…ではないが主に"}
                「通常の践祚」— 原典が経緯を書かなかった即位は、儀礼としては何事もなく進んだものだけ。
              </>,
              <>
                ダッシュボードの「即位経路」カードと同じ材料（
                <code className="text-foreground">accessionRoute</code>）である点は正直に見る必要がある。
                ただし表示ラベルの categoryId はこの軸から導出された値で、この表はその導出の中身にあたる。
              </>,
            ]}
          >
            <StackedRows
              segments={facade.segments}
              rows={facade.rows}
              colors={["series5", "series1", "series8", "gray"]}
              bgClasses={["bg-series-5", "bg-series-1", "bg-series-8", "bg-gray-500"]}
            />
          </LabCard>

          {/* ---------------------------------------------- 1枚に絞れば通る */}
          <LabCard
            no={1}
            title="皇帝が自ら戦場に出たか（親征経験率）"
            strength="中"
            description={`${labEmperorCount}名の${campaign.overallPercent}%（${campaign.overallCount}名）が実際に戦場へ出ている。在位年範囲内の親征に限ると${campaign.withinPercent}%（${campaign.withinCount}名）。`}
            population={`${labEmperorCount}名・欠損0（在位年数と無相関 r=0.06）`}
            notes={[
              <>
                <strong className="text-foreground">王・天王期の出征は除いた。</strong>
                回数系は「本人の実権掌握期」で数える規約なので、親征{campaign.events.total}件のうち
                {campaign.events.outside}件は在位年範囲の外に出る（日付なしが{campaign.events.undated}件）。
                図は在位年範囲内に限った側で、十六国は全件だと53%、在位内では{campaign.bars[2].percent}%。
              </>,
              <>
                <strong className="text-foreground">表はこれ1つだけ。</strong>
                政権の性格で切ると差はもっと大きい（正統王朝23%・並立政権37%・反乱43%）が、
                時代の表と独立でなく、時代差の大半は「その時代に並立政権がどれだけあるか」で説明がつく。
                2つ並べると同じ事実を2回見せることになる。
              </>,
              <>
                「割拠の君主は自ら戦う」という1行では言い切れない — 五代十国では逆転する（正統38% vs 並立15%）。
              </>,
              <>
                <code className="text-foreground">events[].outcome</code>{" "}
                は自然文で語彙が揃っていないため
                <strong className="text-foreground">勝敗の内訳は描けない</strong>。
                描けるのは「出たか出ないか」と「何回出たか」まで。
              </>,
            ]}
          >
            <RateBars
              rows={campaign.bars.map((b) => ({
                label: b.label,
                n: b.n,
                hit: b.withReign,
                percent: b.percent,
              }))}
            />
            <div className="mt-5 border-t border-border pt-3">
              <p className="text-xs font-medium text-foreground">
                回数の上位（北族系の政権に集中する）
              </p>
              <p className="mt-1.5 text-xs leading-relaxed tabular-nums text-muted-foreground">
                {campaign.top.map((t) => `${t.regime}${t.name} ${t.count}回`).join("　")}
              </p>
            </div>
          </LabCard>

          {/* ---------------------------------------------- 別の役割 */}
          <LabCard
            no={9}
            title="項目ごとのデータの確からしさ"
            strength="中"
            description={`調査項目11本 × ${labEmperorCount}名の confidence。反乱系2項目だけが high 率で half を割る。`}
            population={`11項目 × ${labEmperorCount}名 = ${11 * labEmperorCount}セル（うち${confidence.total.empty}セルは値が未確定の既知バックログで、帯からも母数からも外してある）`}
            notes={[
              <>
                <strong className="text-foreground">グリッドにしない。</strong>
                {labEmperorCount}×12 のグリッドにしても行の側にほとんど情報が無い（時代別の high 率は
                69〜84%の間に全時代が収まる）。情報を持っているのは列＝項目の側。
              </>,
              <>
                <code className="text-foreground">confidence</code> を持つフィールドは12本あるが、
                <strong className="text-foreground">
                  それは「データセットの12調査項目」ではない
                </strong>
                。在位データの列が無く、12本目の <code className="text-foreground">verification</code>
                （皇帝号を確認できたか・high {confidence.verification.highPercent}%）は他の11とは問いが違うので、
                この帯からは外してある。
              </>,
              <>
                反乱系2項目の medium は「史料が細かい王朝ほど数え切れない」という当データの弱点が
                <code className="text-foreground">confidence</code> の側に正直に出たもの。年齢の low
                78名は「調査したが原典に記載なし」が確定した層。
              </>,
              <>
                <code className="text-foreground">confidence</code> が空文字の
                {confidence.total.empty}セル（
                {confidence.emptyCells.map((c) => c.id).filter((v, i, a) => a.indexOf(v) === i).join("・")}
                ）は <code className="text-foreground">KNOWN_EMPTY_CONFIDENCE</code>{" "}
                に登録済みの既知バックログ。
                <strong className="text-foreground">帯の上では第4のカテゴリにしない。</strong>
              </>,
            ]}
          >
            <StackedRows
              segments={[
                { name: "high", detail: "原典で直接確認できた" },
                { name: "medium", detail: "原典から読み取れるが判断を含む" },
                { name: "low", detail: "原典に記載が無い等で確定できない" },
              ]}
              rows={confidence.rows.map((r) => ({
                label: r.label,
                count: r.high + r.medium + r.low,
                values: [r.high, r.medium, r.low],
                highlight: `high ${r.highPercent}%`,
              }))}
              colors={["series1", "series5", "gray"]}
              bgClasses={["bg-series-1", "bg-series-5", "bg-gray-500"]}
            />
          </LabCard>

          {/* ---------------------------------------------- 同じ材料の別断面 */}
          <div className="rounded-lg border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground md:p-5">
            以下の3件（候補4・5・6）は、いずれも欠損ゼロで既存の部品だけで描けるが、
            <strong className="text-foreground">
              ダッシュボードの死因／即位経路カードと同じ材料の別断面
            </strong>
            にあたる。盤面へ載せるなら入れ替えの議論になり、
            <code className="text-xs text-foreground">/about</code> か皇帝個別ページが自然な受け皿。
          </div>

          {/* items-start にして、背の低いカードが伸びて中に空白を作らないようにする
              （盤面の1段目で「余った高さはカードの間へ逃がす」としたのと同じ考え方）。 */}
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <LabCard
              no={4}
              title="帝号を新たに称したか"
              strength="中"
              description={`継承${titleOrigin.slices[0].count} vs 新称${titleOrigin.slices[1].count}。スキーマがバッジとして表示すると定めている軸。`}
              population={`${labEmperorCount}名・欠損0`}
              notes={[
                <>
                  新称{titleOrigin.slices[1].count}名の内訳は
                  {titleOrigin.newBreakdown.map((b) => `${b.name}${b.count}`).join("・")}。
                  <strong className="text-foreground">
                    「父から王位を継いで帝号だけ新たに称した」型が
                    {titleOrigin.newBreakdown.find((b) => b.name === "前代君主から継承")?.count}名いる
                  </strong>
                  のが要点で、この層の存在が多軸化で titleOrigin を独立させた理由そのもの。
                </>,
                <>
                  在位中央値は新称{titleOrigin.medianNew}年 vs 継承{titleOrigin.medianInherited}年。
                </>,
                <>
                  弱点: 2値なので
                  <strong className="text-foreground">「形が数値を超える」かは怪しい</strong>
                  — 表の1行で言い切れる。
                </>,
              ]}
            >
              <BreakdownBar
                slices={titleOrigin.slices.map((s) => ({
                  name: s.name,
                  count: s.count,
                  share: s.count / labEmperorCount,
                  percentLabel: s.percentLabel,
                }))}
              />
            </LabCard>

            <LabCard
              no={6}
              title="先帝との血縁"
              strength="中"
              description={`規約が明記している丸め方（直系／傍系／養子／外戚／無血縁／その他／該当なし）で数えると、直系は${relation.slices[0].percentLabel}しかない。`}
              population={`${labEmperorCount}名・欠損0`}
              notes={[
                <>
                  「皇位は父から子へ」という素朴な像への反証になる。
                </>,
                <>
                  <strong className="text-foreground">
                    「該当なし」{relation.slices.find((s) => s.name === "該当なし")?.count}名は
                    「前任者がいない」ではない
                  </strong>
                  （位を受けた前帝がいないという意味）。凡例にこの含意を書けないと、
                  読者側で誤読が起きる。
                </>,
                <>
                  7区分あるので <code className="text-foreground">--series-1〜8</code> の8色に収まるが、
                  「その他」{relation.slices.find((s) => s.name === "その他")?.count}名が系列色を1つ食う。
                </>,
              ]}
            >
              <BreakdownBar
                slices={relation.slices.map((s) => ({
                  name: s.name,
                  count: s.count,
                  share: s.count / labEmperorCount,
                  percentLabel: s.percentLabel,
                  detail: s.detail,
                }))}
              />
            </LabCard>
          </div>

          <LabCard
            no={5}
            title="政権の性格と皇帝の末路"
            strength="中"
            description={`非業の死（暗殺・処刑・戦死・自尽）の割合は、正統王朝${regimeFate.rows[0].highlight.replace("非業の死 ", "")}に対し並立政権${regimeFate.rows[1].highlight.replace("非業の死 ", "")}・反乱政権${regimeFate.rows[2].highlight.replace("非業の死 ", "")}。`}
            population={`${labEmperorCount}名・欠損0`}
            notes={[
              <>
                <strong className="text-foreground">交絡が明白</strong>
                — 並立政権の皇帝は在位が短く（在位中央値
                {regimeFate.medians.map((m) => `${m.label}${m.years}年`).join("・")}）、
                ダッシュボードの「在位年数×死因」が既に「短いほど非業」を出している。
                生き残るとすれば図でなく下の数字。
              </>,
              <>
                <code className="text-foreground">standing</code>{" "}
                で切るともっと極端になるが、これは政権の性格とは別軸
                （同一国号内の対立・僭称。隋の恭帝侗・楊浩など）。
              </>,
              <>
                非業の死＝暗殺・処刑・戦死・自尽。病死・事故死・不詳・諸説ありは「それ以外」に畳んである。
              </>,
            ]}
          >
            <StackedRows
              segments={regimeFate.segments}
              rows={regimeFate.rows}
              colors={[...TWO_TONE.colors]}
              bgClasses={TWO_TONE.bg}
            />
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <LabFigure
                value={`${regimeFate.rival.medianYears}年`}
                label={`対立・僭称の皇帝${regimeFate.rival.count}名の在位中央値（約4か月）`}
                seal
              />
              <LabFigure
                value={`${regimeFate.rival.violentPercent}%`}
                label={`同・非業の死の割合`}
              />
              <LabFigure
                value={`${regimeFate.regular.medianYears}年`}
                label={`正規の皇帝${regimeFate.regular.count}名の在位中央値`}
              />
              <LabFigure
                value={`${regimeFate.regular.violentPercent}%`}
                label="同・非業の死の割合"
              />
            </div>
          </LabCard>
        </div>
      </div>
    </>
  );
}
