// 皇帝1人の全項目（肖像・名称・在位・死因・即位経路・年齢・回数系8項目・順位）の
// 表示本体。詳細ダイアログ（emperor-detail-dialog.tsx）と個別ページ
// （app/emperors/[id]/page.tsx）で共用する。"use client"を付けない純粋な表示部品
// （ダイアログ側から使うとクライアント、個別ページから使うとサーバーで描画される）。

import { ChevronRight } from "lucide-react";
import { Portrait } from "@/components/emperors/portrait";
import { YoutubeEmbed } from "@/components/emperors/youtube-embed";
import type { EmperorRecord, MetricRank } from "@/lib/emperor-types";
import { VIDEO_CHANNEL } from "@/lib/video-channel";
import { cn } from "@/lib/utils";

/** 「明」「呉・三国（三国）」のような、王朝名＋時代の見出し用サブラベル。
 *  王朝名から時代が読み取れる場合は重複を避けて時代を付さない。 */
export function dynastyContextLabel(record: EmperorRecord): string {
  return record.dynastyLabel.includes(record.eraLabel) ||
    record.eraLabel.includes(record.dynastyName)
    ? record.dynastyLabel
    : `${record.dynastyLabel}（${record.eraLabel}）`;
}

function DetailRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  /** 値の下に小さく添える補足（順位表示に使う）。 */
  sub?: string | null;
}) {
  return (
    // 補足（順位）はラベルと値の下に行いっぱいで置く。値の下に入れると、
    // 使える幅がラベルを引いた残りになり「172名中・年長順112位タイ」のような
    // 長い補足が折り返す（wideの2カラム＋カードの内余白で最も狭くなる）。
    // 折り返さない幅では右端が揃うので、見え方は従来と変わらない。
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

function ageText(age: number | null): string {
  return age === null ? "不詳" : `${age}歳（数え年）`;
}

/** 順位の表示文字列（例: "364名中3位"・"327名中・年長順5位タイ"）。順位対象外はnull。 */
function rankText(rank: MetricRank | null, directionLabel?: string): string | null {
  if (!rank) return null;
  const direction = directionLabel ? `・${directionLabel}` : "";
  return `${rank.total}名中${direction}${rank.rank}位${rank.tied ? "タイ" : ""}`;
}

/** 個別ページで各ブロックを載せる面（--card）。トップページのパネルと同じ体裁。 */
const SURFACE_CLASS = "rounded-[0.5rem] border border-border bg-card p-5";

/** 関連動画セクション。個別ページでは経緯の散文より後ろに置きたいため
 *  EmperorDetailBodyから切り出してあり、単独でも描ける
 *  （呼び出し側でrenderVideos={false}にして好きな位置へ置く）。動画が無い皇帝はnull。 */
export function EmperorVideosSection({
  record,
  wide = false,
  collapse = false,
}: {
  record: EmperorRecord;
  /** 動画リストを2カラムのグリッドに並べる（広幅表示用）。 */
  wide?: boolean;
  /** 折りたたみ（既定閉）にする。 */
  collapse?: boolean;
}) {
  if (record.videos.length === 0) return null;
  const videoNote = (
    <p className="text-xs leading-relaxed text-muted-foreground">
      当サイトとは無関係の外部YouTubeチャンネル「
      <a
        href={VIDEO_CHANNEL.url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-seal"
      >
        {VIDEO_CHANNEL.name}
      </a>
      」様が制作・公開されている解説動画です。
    </p>
  );
  const videoList = (
    <div className={wide ? "grid gap-2 sm:grid-cols-2" : "space-y-2"}>
      {record.videos.map((video) => (
        <YoutubeEmbed key={video.videoId} video={video} />
      ))}
    </div>
  );
  return !collapse ? (
    <div className="space-y-2">
      <h3 className="font-heading text-base font-semibold text-foreground">
        関連動画
      </h3>
      {videoNote}
      {videoList}
    </div>
  ) : (
    /* ダイアログでは動画リストで縦に伸びてスクロール必須になるのを避けるため、
       折りたたみ（既定は閉）で本数だけ見せる。状態不要のネイティブ
       details/summaryなら"use client"なしのこの部品でもそのまま使える。 */
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-heading text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
        />
        関連動画（{record.videos.length}本）
      </summary>
      <div className="mt-2 space-y-2">
        {videoNote}
        {videoList}
      </div>
    </details>
  );
}

export function EmperorDetailBody({
  record,
  wide = false,
  collapseVideos = !wide,
  renderVideos = true,
  surface = false,
}: {
  record: EmperorRecord;
  /** 個別ページ用の広幅表示。lg以上で基本情報と回数系を左右2カラムに並べて
   *  縦スクロールを減らす。 */
  wide?: boolean;
  /** 動画を折りたたみ（既定閉）にする。ダイアログではwide表示でも折りたたんで
   *  ダイアログ内スクロールを抑える（既定はwideでないときのみ折りたたみ）。 */
  collapseVideos?: boolean;
  /** 関連動画をこの部品の中に描く。falseにすると描かないので、呼び出し側が
   *  EmperorVideosSectionを好きな位置（経緯の散文より後ろ等）へ置ける。 */
  renderVideos?: boolean;
  /** 各ブロックを--cardの面に載せる（個別ページ用）。ダイアログはそれ自体が面
   *  なので重ねない（wideはダイアログでも渡るため、面の有無はwideから導かず
   *  この prop で受ける）。既定は面なし＝ダイアログ側の呼び出しは無変更でよい。 */
  surface?: boolean;
}) {
  return (
    <>
      {/* wide（個別ページ）ではlg以上で基本情報と回数系を左右に並べる。
          ダイアログではdisplay: contentsにして親（DialogContent等）の
          gapレイアウト直下に置いた従来の縦積みを保つ。 */}
      <div className={wide ? "grid gap-4 lg:grid-cols-2 lg:gap-x-10" : "contents"}>
        {/* sm未満は肖像と基本情報を縦に積む。横並びのままだとdlの実効幅が
            200px程度しか残らず、順位の補足が3行に折り返す。 */}
        <div
          className={cn(
            "flex flex-col gap-4 sm:flex-row",
            surface && SURFACE_CLASS,
          )}
        >
          <div
            className={cn(
              "relative shrink-0 self-start overflow-hidden rounded-md border border-border aspect-[3/4]",
              wide ? "w-36" : "w-28",
            )}
          >
            <Portrait record={record} sizes={wide ? "144px" : "112px"} large />
          </div>
          <dl className="min-w-0 flex-1 text-sm">
            {record.personalName && (
              <DetailRow label="諱（本名）" value={record.personalName} />
            )}
            {record.templeName && (
              <DetailRow label="廟号" value={record.templeName} />
            )}
            {record.posthumousName && (
              <DetailRow label="諡号" value={record.posthumousName} />
            )}
            <DetailRow label="在位" value={record.periodsLabel} />
            <DetailRow
              label="在位期間"
              value={record.reignDurationLabel}
              sub={rankText(record.ranks.reignYears)}
            />
            {/* 旧「建国」「復位」はラベルから外して軸・在位情報へ移したため、
                その2点だけは経路の脇に補足として出す（判定の4軸は「即位の経緯」節）。 */}
            <DetailRow
              label="即位経路"
              value={record.accessionRouteCategory}
              sub={
                [
                  record.accessionTitleNew ? "帝号を新たに称した" : null,
                  record.hasRestoration ? "のちに復位" : null,
                ]
                  .filter(Boolean)
                  .join("・") || null
              }
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
        </div>
        {/* 順位の読み方の注記は、説明対象である回数グリッドの直下に置く。 */}
        <div className={cn("space-y-2", surface && SURFACE_CLASS)}>
          {/* 順位表示が付いたため4列だとセル幅が足りずラベルが縦に折り返す。2列固定。
              面に載せるときだけ最終行（2列なので末尾2件）の下罫を落とす。 */}
          <dl
            className={cn(
              "grid grid-cols-2 content-start gap-x-6 text-sm",
              surface && "[&>*:nth-last-child(-n+2)]:border-b-0",
            )}
          >
            {(
              [
                ["改元", record.eraChangeCount, record.ranks.eraChangeCount],
                ["大赦", record.amnestyCount, record.ranks.amnestyCount],
                [
                  "立后",
                  record.empressInstallationCount,
                  record.ranks.empressInstallationCount,
                ],
                [
                  "皇太子廃立",
                  record.crownPrinceDepositionCount,
                  record.ranks.crownPrinceDepositionCount,
                ],
                [
                  "親征",
                  record.personalCampaignCount,
                  record.ranks.personalCampaignCount,
                ],
                [
                  "反乱鎮圧",
                  record.rebellionSuppressionCount,
                  record.ranks.rebellionSuppressionCount,
                ],
                [
                  "被反乱",
                  record.rebellionSufferedCount,
                  record.ranks.rebellionSufferedCount,
                ],
                [
                  "遷都",
                  record.capitalRelocationCount,
                  record.ranks.capitalRelocationCount,
                ],
              ] as const
            ).map(([label, count, rank]) => (
              <div
                key={label}
                className="flex items-start justify-between gap-2 border-b border-border/60 py-1.5"
              >
                <dt className="shrink-0 text-muted-foreground">{label}</dt>
                <dd className="text-right tabular-nums">
                  {count}回
                  {rank && (
                    <span className="block text-micro leading-tight text-muted-foreground">
                      {rankText(rank)}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            順位は同数を同順位として数えています（「タイ」表示）。回数の順位は1回以上、年齢の順位は年齢が判明している皇帝のみが対象です。
          </p>
        </div>
      </div>
      {renderVideos && (
        <EmperorVideosSection
          record={record}
          wide={wide}
          collapse={collapseVideos}
        />
      )}
    </>
  );
}
