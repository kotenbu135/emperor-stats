// 皇帝個別ページの「基本情報」と「回数で見る在位」。emperor-detail-body.tsx を
// 2026-08-01 に解体して、個別ページ専用の2ブロックに割り直したもの
// （詳細ダイアログと共用していた分岐 props — wide・surface・linkStats・
// renderVideos・collapseVideos — はダイアログの廃止で全部死んだ）。

import Link from "next/link";
import type { EmperorRecord, MetricRank } from "@/lib/emperor-types";

/**
 * データベースの該当状態への文脈内リンク（2026-07-27 の SEO 監査 2-3）。
 *
 * **行き先があるのは2本だけ**。2026-07-31 に統計5ページを廃止したので、回数系
 * 8指標のランキングを載せた面は無い（順位の数字は出すがリンクにしない・
 * 2026-08-01 ユーザー決定）。残る2本は個別ページからデータベースへ生き残っている
 * 唯一の導線で、/database に URL 同期を入れたのはこの着地点のため。
 */
function StatLink({
  href,
  label,
  children,
}: {
  href: string;
  /** リンク単体で意味が通るようにする説明（「のちに復位」だけでは行き先が分からない）。 */
  label: string;
  children: React.ReactNode;
}) {
  return (
    // 説明は aria-label でなく sr-only の追記で足す。aria-label はアクセシブル名を
    // 丸ごと置き換えるため、可視テキスト（「365名中1位」）が名前から消えて
    // WCAG 2.5.3 Label in Name に反する（音声入力で読み上げどおり言っても操作できない）。
    <Link
      href={href}
      title={label}
      className="underline decoration-dotted underline-offset-2 hover:text-seal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal"
    >
      {children}
      <span className="sr-only">（{label}）</span>
    </Link>
  );
}

function DetailRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  /** 値の下に小さく添える補足（順位表示に使う）。 */
  sub?: React.ReactNode;
}) {
  return (
    // 補足（順位）はラベルと値の下に行いっぱいで置く。値の下に入れると、
    // 使える幅がラベルを引いた残りになり「172名中・年長順112位タイ」のような
    // 長い補足が折り返す（2カラム＋カードの内余白で最も狭くなる）。
    <div className="grid grid-cols-[auto_1fr] gap-x-3 border-b border-border/60 py-1.5 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
      {sub && (
        <dd className="col-span-2 text-right text-xs leading-tight text-muted-foreground">
          {sub}
        </dd>
      )}
    </div>
  );
}

/** 即位経路の脇に出す補足（帝号を新たに称した・のちに復位）。 */
function accessionSubNote(record: EmperorRecord): React.ReactNode {
  const parts: React.ReactNode[] = [];
  if (record.accessionTitleNew) parts.push("帝号を新たに称した");
  if (record.hasRestoration) {
    parts.push(
      <StatLink href="/database?reign=restoration" label="復位者一覧を見る">
        のちに復位
      </StatLink>,
    );
  }
  if (parts.length === 0) return null;
  return parts.map((part, i) => (
    <span key={i}>
      {i > 0 && "・"}
      {part}
    </span>
  ));
}

function ageText(age: number | null): string {
  return age === null ? "不詳" : `${age}歳（数え年）`;
}

/** 順位の表示文字列（例: "364名中3位"・"327名中・年長順5位タイ"）。順位対象外はnull。 */
function rankText(
  rank: MetricRank | null,
  directionLabel?: string,
): string | null {
  if (!rank) return null;
  const direction = directionLabel ? `・${directionLabel}` : "";
  return `${rank.total}名中${direction}${rank.rank}位${rank.tied ? "タイ" : ""}`;
}

/** 各ブロックを載せる面（--card）。トップページのパネルと同じ体裁。 */
const SURFACE_CLASS = "rounded-[0.5rem] border border-border bg-card p-5";

/** 回数系8指標の並び。順位の数字は出すがリンクは付けない（上の StatLink 参照）。 */
const COUNT_METRICS = [
  ["改元", "eraChangeCount"],
  ["大赦", "amnestyCount"],
  ["立后", "empressInstallationCount"],
  ["皇太子廃立", "crownPrinceDepositionCount"],
  ["親征", "personalCampaignCount"],
  ["反乱鎮圧", "rebellionSuppressionCount"],
  ["被反乱", "rebellionSufferedCount"],
  ["遷都", "capitalRelocationCount"],
] as const;

export function EmperorFacts({ record }: { record: EmperorRecord }) {
  return (
    // 名前（諱・廟号・諡号・元号・別称）はここに置かない（2026-08-02 ユーザー決定）。
    // 一度は全幅の帯として3枚目に置いたが、**多くの皇帝で行が1つしか無く**
    // （諱だけが163人・0行が56人）帯の右側が空くだけだったため、ヒーローの
    // 要約チップ（死因・即位・年齢＝ここの「基本情報」と同じ値を出していた）と
    // 入れ替えた（emperor-hero.tsx）。
    <div className="grid gap-4 lg:grid-cols-2 lg:gap-x-6">
      <section className={SURFACE_CLASS}>
          <h2 className="mb-2 font-heading text-base font-semibold text-foreground">
            基本情報
          </h2>
          <dl className="text-sm">
            <DetailRow label="在位" value={record.periodsLabel} />
            <DetailRow
              label="在位期間"
              value={record.reignDurationLabel}
              sub={
                rankText(record.ranks.reignYears) && (
                  <StatLink
                    href="/database?sort=reignApproxDays&order=desc"
                    label="在位年数ランキングを見る"
                  >
                    {rankText(record.ranks.reignYears)}
                  </StatLink>
                )
              }
            />
            {/* スキーマ v3（2026-07-29）で、政権の位置づけ（統一王朝・分裂期の王朝・
              反乱・自称政権）と「その政権の中で正規の皇帝か」が別の軸に分かれた。
              前者は王朝ラベル・配色・絞り込みが担うが、後者は該当20名にしか
              立たない情報なので、立つ人物にだけ1行出す。 */}
            {record.isRivalClaimant && (
              <DetailRow
                label="政権内の位置"
                value="対立・僭称の皇帝"
                sub="同じ国号のまま並立して帝号を称し、その王朝の正史が帝紀を立てていない"
              />
            )}
            {/* 旧「建国」「復位」はラベルから外して軸・在位情報へ移したため、
              その2点だけは経路の脇に補足として出す。判定の4軸は 2026-08-03 に
              「即位の経緯」節ごとページから外したので、サイトには出ない
              （配布データ data/emperors.json の accessionRoute.axes にある）。 */}
            <DetailRow
              label="即位経路"
              value={record.accessionRouteCategory}
              sub={accessionSubNote(record)}
            />
            <DetailRow label="死因" value={record.deathCauseCategory} />
            <DetailRow
              label="即位時年齢"
              value={ageText(record.accessionAge)}
              sub={rankText(record.ranks.accessionAge, "年長順")}
            />
            <DetailRow
              label="没年齢"
              value={ageText(record.deathAge)}
              sub={rankText(record.ranks.deathAge, "長寿順")}
            />
          </dl>
        </section>
        <section className={SURFACE_CLASS}>
          <h2 className="mb-2 font-heading text-base font-semibold text-foreground">
            回数で見る在位
          </h2>
          {/* 順位表示が付いたため4列だとセル幅が足りずラベルが縦に折り返す。2列固定。
            最終行（2列なので末尾2件）の下罫は面の下端に浮くので落とす。 */}
          <dl className="grid grid-cols-2 content-start gap-x-6 text-sm [&>*:nth-last-child(-n+2)]:border-b-0">
            {COUNT_METRICS.map(([label, key]) => (
              <div
                key={label}
                className="flex items-start justify-between gap-2 border-b border-border/60 py-1.5"
              >
                <dt className="shrink-0 text-muted-foreground">{label}</dt>
                <dd className="text-right tabular-nums">
                  {record[key]}回
                  {record.ranks[key] && (
                    <span className="block text-micro leading-tight text-muted-foreground">
                      {rankText(record.ranks[key])}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
      </section>
    </div>
  );
}
