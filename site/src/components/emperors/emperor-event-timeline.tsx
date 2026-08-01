"use client";

// 皇帝個別ページの「在位中の出来事」年表。7種別のevents[]を日付順にマージした
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
      {/* headとシェブロンを同じflexの兄弟にすると、狭い画面で本文が1行を占めた
          ときにシェブロンだけが次の行へ押し出される。headを折り返し可能な箱に
          まとめ、シェブロンはその外側に nowrap で並べる。 */}
      <summary className="flex list-none flex-nowrap items-start gap-x-3 rounded-md py-1.5 transition-colors hover:bg-accent/60 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          {head}
        </span>
        <ChevronRight
          aria-hidden
          className="mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
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

/**
 * 既定で開いたまま出す件数（2026-08-01 ユーザー決定。当初20件→10件へ変更）。
 *
 * 反乱鎮圧を落としたあとの件数は中央値8件・最大142件（宋高宗）で、10件以上が161名・
 * 20件以上が72名。10件なら半数近くはそのまま全件が見え、長い人は最初の画面で
 * 年表が終わらないという状態にならない。
 *
 * **残りは Radix の Accordion ではなく素の `<details>` に入れる。** ui/accordion.tsx は
 * forceMount を渡していないので閉じた本文が DOM から消え、142件の日付付きテキストが
 * 静的HTMLから丸ごと落ちる（`<details>` は閉じていても DOM に残る）。個別ページは
 * 皇帝名での検索結果に出ることが目的なのでここは動かせない。
 */
const INITIAL_VISIBLE = 10;

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
  // **10件の境目は種別で絞ったあとの集合に対して数える。** 元の集合を基準にすると、
  // 142件を5件に絞った状態で details が空になったり「残り132件」の嘘の件数が出る。
  const head = visible.slice(0, INITIAL_VISIBLE);
  const rest = visible.slice(INITIAL_VISIBLE);

  const chipClass = (pressed: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
      pressed
        ? "border-seal/60 bg-seal/10 text-foreground hover:bg-seal/20"
        : "border-border text-muted-foreground hover:border-seal/40 hover:text-foreground",
    );

  return (
    // 個別ページの他ブロックと同じ--cardの面に載せる（体裁はトップのパネルと共通）。
    <div className="space-y-2 rounded-[0.5rem] border border-border bg-card p-5">
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
      {/* 面に載せたので最終行の下罫は残さない（カード下端の余白に浮いて見える）。
          畳んだ残りがあるときは、その手前で罫を切らずに続ける。 */}
      <div
        className={cn(
          "border-t border-border/60",
          rest.length === 0 && "[&>*:last-child]:border-b-0",
        )}
      >
        {head.map((row, i) => (
          <EventRow key={i} row={row} />
        ))}
      </div>
      {rest.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1.5 text-sm text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden
              className="size-3.5 shrink-0 transition-transform group-open:rotate-90"
            />
            残り{rest.length}件を表示
          </summary>
          <div className="[&>*:last-child]:border-b-0">
            {rest.map((row, i) => (
              <EventRow key={i} row={row} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
