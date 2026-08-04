import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { BreakdownBar } from "@/components/home-v2/breakdown-panel";
import { LabCard, LabFigure } from "@/components/lab/lab-card";
import { StackedRows } from "@/components/lab/stacked-rows";
import { RateBars } from "@/components/lab/rate-bars";
import { buildMetadata } from "@/lib/seo";
import {
  getCampaignStats,
  getConfidenceStats,
  getEraChangeStats,
  getEraNameMax,
  getFacadeStats,
  getRegimeFateStats,
  getRelationStats,
  getTitleOriginStats,
  labEmperorCount,
} from "@/lib/lab-stats";

/**
 * グラフ候補の検討面（/lab）。
 *
 * docs/site-design/CHART_CANDIDATES_2026-07-31.md で「形の強さ 中以上」と評価された
 * 9候補を実物にした面で、**採否を決めるための面**（公開ページではない）。
 * **候補7（同時在位数）・候補8（在位継続率）は 2026-08-01 に採用され、集計ごと
 * `lib/emperors.ts` へ移して概要ダッシュボードの3段目に載った**ので、ここには残り7件がある。
 * したがって:
 *  - `SITE_SECTIONS`・`nav-data.ts`・sitemap・OGP画像には登録しない。noindex を付ける
 *  - 集計は `lib/lab-stats.ts`（/lab 専用・emperors.ts とは別ファイル）
 *  - 数値は `site/tools/chart-candidates-stats.py` の出力と一致させてある。
 *    検討記録の表と突き合わせるため、時代は `catalogs.eras` の11区分
 *    （サイト本体の `ERA_BY_SECTION` 16区分ではない）
 *
 * 採用が決まった候補はここから公開ページへ移し、この面ごと畳む。
 */
export const metadata: Metadata = {
  ...buildMetadata({
    path: "/lab",
    title: "グラフ候補の検討面",
    description: "チャート候補7件の実装検討用（非公開・検索エンジンには出さない）",
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
  const confidence = getConfidenceStats();

  return (
    <>
      <PageHeader
        title="グラフ候補の検討面"
        description="チャート候補の検討記録（CHART_CANDIDATES_2026-07-31.md）で「形の強さ 中以上」だった9件のうち、まだ採否が決まっていない7件（候補7・8は概要ダッシュボードへ採用済み）。公開ページではない。"
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
                サイト本体の16区分ではない
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
