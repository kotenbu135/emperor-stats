// 皇帝1人の全項目（肖像・名称・在位・死因・即位経路・年齢・回数系8項目・順位）の
// 表示本体。詳細ダイアログ（emperor-detail-dialog.tsx）と個別ページ
// （app/emperors/[id]/page.tsx）で共用する。"use client"を付けない純粋な表示部品
// （ダイアログ側から使うとクライアント、個別ページから使うとサーバーで描画される）。

import { Portrait } from "@/components/emperors/portrait";
import type { EmperorRecord, MetricRank } from "@/lib/emperor-types";

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
    <div className="flex justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right">
        {value}
        {sub && (
          <span className="block text-xs leading-tight text-muted-foreground">
            {sub}
          </span>
        )}
      </dd>
    </div>
  );
}

function ageText(age: number | null): string {
  return age === null ? "不詳" : `${age}歳（数え年）`;
}

/** 順位の表示文字列（例: "364名中3位"・"327名中・若い順5位タイ"）。順位対象外はnull。 */
function rankText(rank: MetricRank | null, directionLabel?: string): string | null {
  if (!rank) return null;
  const direction = directionLabel ? `・${directionLabel}` : "";
  return `${rank.total}名中${direction}${rank.rank}位${rank.tied ? "タイ" : ""}`;
}

export function EmperorDetailBody({ record }: { record: EmperorRecord }) {
  return (
    <>
      <div className="flex gap-4">
        <div className="relative w-28 shrink-0 self-start overflow-hidden rounded-md border border-border aspect-[3/4]">
          <Portrait record={record} sizes="112px" large />
        </div>
        <dl className="min-w-0 flex-1 text-sm">
          {record.personalName && (
            <DetailRow label="諱（本名）" value={record.personalName} />
          )}
          {record.templeName && (
            <DetailRow label="廟号" value={record.templeName} />
          )}
          <DetailRow label="在位" value={record.periodsLabel} />
          <DetailRow
            label="在位期間"
            value={record.reignDurationLabel}
            sub={rankText(record.ranks.reignYears)}
          />
          <DetailRow
            label="即位経路"
            value={record.accessionRouteCategory}
          />
          <DetailRow label="死因" value={record.deathCauseCategory} />
          <DetailRow
            label="即位時年齢"
            value={ageText(record.accessionAge)}
            sub={rankText(record.ranks.accessionAge, "若い順")}
          />
          <DetailRow
            label="没年齢"
            value={ageText(record.deathAge)}
            sub={rankText(record.ranks.deathAge, "長寿順")}
          />
        </dl>
      </div>
      {/* 順位表示が付いたため4列だとセル幅が足りずラベルが縦に折り返す。2列固定。 */}
      <dl className="grid grid-cols-2 gap-x-6 text-sm">
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
                <span className="block text-[10px] leading-tight text-muted-foreground">
                  {rankText(rank)}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        順位は同数を同順位として数えています（「タイ」表示）。回数の順位は1回以上、年齢の順位は年齢が判明している皇帝のみが対象です。
        {record.posthumousName && (
          <span className="mt-1 block">諡号：{record.posthumousName}</span>
        )}
      </p>
    </>
  );
}
