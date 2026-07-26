// 皇帝個別ページ専用の「即位の経緯」「死因の経緯」「復位の経緯」「在位日付の典拠」「調査メモ」節。
// noteは調査時の原文ママを表示する（サイト側での要約・書き換えはしない方針）。
// データ量が大きいためEmperorRecordには載せず、個別ページ（Server Component
// 静的書き出し）だけがlib/emperors.tsのgetEmperorNarrativeで取得して渡す。
// 詳細ダイアログへの反映はtask.md第3弾（lazy fetch）で行う。

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

// 純表示部品（hook・server専用APIなし）。詳細ダイアログ（Client Component）の
// lazy fetch表示（emperor-narrative-dialog.tsx）でも再利用する。
export function NarrativeBlock({
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
      <h3 className="font-heading text-base font-semibold text-foreground">
        {title}
      </h3>
      <p className="text-sm leading-relaxed">{section.note}</p>
      {axes && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-muted-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden
              className="size-3 shrink-0 transition-transform group-open:rotate-90"
            />
            判定の軸（この区分を導いた4つの事実）
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

export function EmperorNarrativeSections({
  narrative,
}: {
  narrative: EmperorNarrative;
}) {
  const { accession, accessionAxes, death, restorations, memos, reignSources } =
    narrative;
  if (
    !accession &&
    !death &&
    restorations.length === 0 &&
    memos.length === 0 &&
    reignSources.length === 0
  ) {
    return null;
  }
  return (
    <div className="mt-2 flex flex-col gap-5 border-t border-border pt-5">
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
          <h3 className="font-heading text-base font-semibold text-foreground">
            復位の経緯
          </h3>
          {restorations.map((r) => (
            <p key={r.periodLabel} className="text-sm leading-relaxed">
              <span className="text-muted-foreground">{r.periodLabel}｜</span>
              {r.note}
            </p>
          ))}
        </section>
      )}
      {reignSources.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 font-heading text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden
              className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
            />
            在位日付の典拠（正史原文と暦換算）
          </summary>
          <div className="mt-2 space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              在位の開始日・終了日の根拠にした正史原文の引用と、旧暦（干支日）から西暦への換算の調査記録を原文のまま掲載しています（換算方法は「このサイトについて」参照）。
            </p>
            {reignSources.map((s, i) => (
              <div key={i} className="space-y-0.5">
                <p className="text-xs font-semibold text-muted-foreground">
                  {reignSources.length > 1 && `${s.periodLabel}｜`}
                  {s.sourceLabel}
                </p>
                {s.quote && (
                  <p className="text-sm leading-relaxed">「{s.quote}」</p>
                )}
                {s.conversion && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    換算: {s.conversion}
                  </p>
                )}
                {s.note && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    補記: {s.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
      {memos.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 font-heading text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden
              className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
            />
            調査メモ（回数・年齢の数え方と判定根拠）
          </summary>
          <div className="mt-2 space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              各項目の回数・年齢を確定した際の調査記録を、原文のまま掲載しています（数え方の基準は
              「このサイトについて」参照）。
            </p>
            {memos.map((memo) => (
              <div key={memo.label} className="space-y-0.5">
                <p className="text-xs font-semibold text-muted-foreground">
                  {memo.label}
                </p>
                <p className="text-sm leading-relaxed">{memo.note}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
