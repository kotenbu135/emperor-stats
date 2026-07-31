import { Card } from "@/components/tremor/Card";

/**
 * /lab の1候補ぶんの枠。**注記が成果物の一部**なので、カードは必ず
 * 「母集団」と「但し書き」の置き場所を持つ — この面の目的は図を眺めることではなく
 * 「盤面へ載せられるか」を判断することで、判断には n と交絡の断り書きが要る。
 */
export function LabCard({
  no,
  title,
  strength,
  description,
  population,
  notes,
  children,
}: {
  /** 検討記録（CHART_CANDIDATES_2026-07-31.md）の候補番号。 */
  no: number;
  title: string;
  /** 同記録「5. 候補一覧」の形の強さ。 */
  strength: string;
  /** この図が何を主張するか（1行）。 */
  description: string;
  /** 母集団。欠損がある候補は必ずここに書く。 */
  population: string;
  /** 但し書き。**空にしない** — 断り書きの要らない候補は無い。 */
  notes: React.ReactNode[];
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col p-5 md:p-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-heading text-xs font-semibold tabular-nums text-seal">
          候補 {no}
        </span>
        <h2 className="font-heading text-base font-semibold text-foreground">
          {title}
        </h2>
        <span className="ml-auto shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
          形の強さ {strength}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">母集団: {population}</p>
      <div className="mt-5 flex-1">{children}</div>
      <div className="mt-5 border-t border-border pt-3">
        <p className="text-xs font-medium text-foreground">但し書き</p>
        <ul className="mt-1.5 space-y-1">
          {notes.map((n, i) => (
            <li key={i} className="text-xs leading-relaxed text-muted-foreground">
              — {n}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

/** 図の脇に置く1つの数字（候補の主張がグラフでなく数だったとき用）。 */
export function LabFigure({
  value,
  label,
  seal = false,
}: {
  value: string;
  label: string;
  seal?: boolean;
}) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <div
        className={`font-heading text-xl font-semibold tabular-nums ${
          seal ? "text-seal" : "text-foreground"
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
