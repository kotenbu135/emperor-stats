"use client";

// 皇帝個別ページの「在位中の出来事」年表。8指標のevents[]を日付順にマージした
// EmperorEventRow[]（ビルド時にgetEmperorEventsが生成）を、種別バッジ+日付+要約の
// 行リストで表示する。note全文・結果・出典は行ごとのネイティブdetailsに格納し、
// クライアント状態は種別フィルタのみ（大赦が数十回ある皇帝向けの件数対策）。
// このデータは個別ページ専用で、統計ページのEmperorRecordには含まれない。

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  emperorEventKindLabels,
  type EmperorEventKind,
  type EmperorEventRow,
} from "@/lib/emperor-types";
import { cn } from "@/lib/utils";

/** 種別ドットの配色（globals.cssの--series-1〜8）。Tailwindが検出できるよう静的クラス名で持つ。 */
const KIND_DOT_CLASS: Record<EmperorEventKind, string> = {
  eraChange: "bg-series-1",
  amnesty: "bg-series-5",
  empressInstallation: "bg-series-3",
  crownPrinceDeposition: "bg-series-4",
  personalCampaign: "bg-series-6",
  rebellionSuppression: "bg-series-7",
  rebellionSuffered: "bg-series-8",
  capitalRelocation: "bg-series-2",
};

/** 種別チップ・バッジの表示順（emperors.ts側の指標順と一致させる）。 */
const KIND_ORDER: EmperorEventKind[] = [
  "eraChange",
  "amnesty",
  "empressInstallation",
  "crownPrinceDeposition",
  "personalCampaign",
  "rebellionSuppression",
  "rebellionSuffered",
  "capitalRelocation",
];

function KindBadge({ kind }: { kind: EmperorEventKind }) {
  return (
    <span className="inline-flex w-[5.5rem] shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden
        className={cn("size-2 shrink-0 rounded-full", KIND_DOT_CLASS[kind])}
      />
      {emperorEventKindLabels[kind]}
    </span>
  );
}

function EventRow({ row }: { row: EmperorEventRow }) {
  const hasDetails =
    row.facts.length > 0 || row.note !== null || row.sourceLabel !== null;
  const head = (
    <>
      <KindBadge kind={row.kind} />
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {row.dateLabel ?? "日付不詳"}
      </span>
      <span className="min-w-0 flex-1 basis-48 truncate text-sm">
        {row.summary}
      </span>
    </>
  );
  if (!hasDetails) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-border/60 py-1.5">
        {head}
      </div>
    );
  }
  return (
    <details className="group border-b border-border/60">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5 [&::-webkit-details-marker]:hidden">
        {head}
        <ChevronRight
          aria-hidden
          className="size-3.5 shrink-0 self-center text-muted-foreground transition-transform group-open:rotate-90"
        />
      </summary>
      <div className="space-y-1 pb-2 pl-2 text-sm">
        {row.facts.map((fact) => (
          <p key={fact.label} className="leading-relaxed">
            <span className="text-muted-foreground">{fact.label}: </span>
            {fact.text}
          </p>
        ))}
        {row.note && <p className="leading-relaxed">{row.note}</p>}
        {row.sourceLabel && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            出典: {row.sourceLabel}
          </p>
        )}
      </div>
    </details>
  );
}

export function EmperorEventTimeline({ rows }: { rows: EmperorEventRow[] }) {
  const [activeKind, setActiveKind] = useState<EmperorEventKind | null>(null);
  // この皇帝に存在する種別と件数（固定順）。フィルタチップに使う。
  const kinds = useMemo(() => {
    const counts = new Map<EmperorEventKind, number>();
    for (const row of rows) {
      counts.set(row.kind, (counts.get(row.kind) ?? 0) + 1);
    }
    return KIND_ORDER.filter((k) => counts.has(k)).map((k) => ({
      kind: k,
      count: counts.get(k)!,
    }));
  }, [rows]);
  const visible =
    activeKind === null ? rows : rows.filter((r) => r.kind === activeKind);

  const chipClass = (pressed: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
      pressed
        ? "border-seal/60 bg-seal/10 text-foreground"
        : "border-border text-muted-foreground hover:border-seal/40 hover:text-foreground",
    );

  return (
    <div className="space-y-2">
      {kinds.length > 1 && (
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="出来事の種別で絞り込み"
        >
          <button
            type="button"
            aria-pressed={activeKind === null}
            onClick={() => setActiveKind(null)}
            className={chipClass(activeKind === null)}
          >
            すべて（{rows.length}）
          </button>
          {kinds.map(({ kind, count }) => (
            <button
              key={kind}
              type="button"
              aria-pressed={activeKind === kind}
              onClick={() => setActiveKind(activeKind === kind ? null : kind)}
              className={chipClass(activeKind === kind)}
            >
              <span
                aria-hidden
                className={cn("size-2 rounded-full", KIND_DOT_CLASS[kind])}
              />
              {emperorEventKindLabels[kind]}（{count}）
            </button>
          ))}
        </div>
      )}
      <div className="border-t border-border/60">
        {visible.map((row, i) => (
          <EventRow key={i} row={row} />
        ))}
      </div>
    </div>
  );
}
