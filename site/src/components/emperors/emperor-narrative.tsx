// 皇帝個別ページ専用の「即位の経緯」「死因の経緯」「復位の経緯」（EmperorNarrativeSections）。
// noteは調査時の原文ママを表示する（サイト側での要約・書き換えはしない方針）。
// データ量が大きいためEmperorRecordには載せず、個別ページ（Server Component
// 静的書き出し）だけがlib/emperors.tsのgetEmperorNarrativeで取得して渡す。
//
// 2026-08-01 にページ末尾へ分けた「在位日付の典拠」「調査メモ」（EmperorResearchDetails）は
// 2026-08-02 に廃止した。根拠は配布データ（data/emperors.json）に同じものが入っている。

import { ChevronRight } from "lucide-react";
import {
  accessionAxisLabels,
  type AccessionAxes,
  type EmperorNarrative,
  type NarrativeSection,
} from "@/lib/emperor-types";

/**
 * 即位経路の4軸＋補助。表示ラベル（世襲・擁立…）はこの軸から機械導出した値なので、
 * ラベルだけを出すと「なぜその区分なのか」「どの軸で他の皇帝と違うのか」が読者に見えない。
 * 軸2は「第三者」のとき内訳（臣下・軍・宦官…）を括弧で添える。
 */
export function AccessionAxesTable({ axes }: { axes: AccessionAxes }) {
  const decidedBy = axes.decidedBy
    .map((who) =>
      who === "第三者" && axes.decidedByAgents.length > 0
        ? `${who}（${axes.decidedByAgents.join("・")}）`
        : who,
    )
    .join(" / ");
  const rows: [string, string][] = [
    [accessionAxisLabels.throneSource, axes.throneSource],
    [accessionAxisLabels.decidedBy, decidedBy],
    [accessionAxisLabels.predecessorFate, axes.predecessorFate],
    [accessionAxisLabels.relationToPredecessor, axes.relationToPredecessor],
    [accessionAxisLabels.procedure, axes.procedure],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs leading-relaxed">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function NarrativeBlock({
  title,
  section,
  axes = null,
}: {
  title: string;
  section: NarrativeSection;
  /** 即位の経緯のみ。判定ラベルの導出根拠として軸を折りたたみで添える。 */
  axes?: AccessionAxes | null;
}) {
  return (
    <section className="space-y-1.5">
      {/* 見出しはヒーローの h1 直下なので h2（h1→h3 のレベル飛び回避・
          2026-07-27 の SEO 監査 2-2）。見た目のサイズは他の節と同じ。 */}
      <h2 className="font-heading text-base font-semibold text-foreground">
        {title}
      </h2>
      <p className="text-sm leading-relaxed">{section.note}</p>
      {axes && (
        <details className="group">
          <summary className="flex list-none items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden
              className="size-3 shrink-0 transition-transform group-open:rotate-90"
            />
            判定の軸
          </summary>
          <div className="mt-1.5 border-l-2 border-border pl-3">
            <AccessionAxesTable axes={axes} />
          </div>
        </details>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        出典: {section.sourceLabel}
        {section.sourceNote && (
          <span className="mt-0.5 block">補記: {section.sourceNote}</span>
        )}
      </p>
    </section>
  );
}

/** 読み物としての経緯（即位・死因・復位）。3つとも無い皇帝はnull。 */
export function EmperorNarrativeSections({
  narrative,
}: {
  narrative: EmperorNarrative;
}) {
  const { accession, accessionAxes, death, restorations } = narrative;
  if (!accession && !death && restorations.length === 0) return null;
  return (
    <div className="flex flex-col gap-5">
      {/* 経緯2節はlg以上で左右に並べる（noteは中央値100字前後の短い叙述）。 */}
      <div className="grid gap-5 lg:grid-cols-2 lg:gap-x-10">
        {accession && (
          <NarrativeBlock
            title="即位の経緯"
            section={accession}
            axes={accessionAxes}
          />
        )}
        {death && <NarrativeBlock title="死因の経緯" section={death} />}
      </div>
      {restorations.length > 0 && (
        <section className="space-y-1.5">
          <h2 className="font-heading text-base font-semibold text-foreground">
            復位の経緯
          </h2>
          {restorations.map((r) => (
            <p key={r.periodLabel} className="text-sm leading-relaxed">
              <span className="text-muted-foreground">{r.periodLabel}｜</span>
              {r.note}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
