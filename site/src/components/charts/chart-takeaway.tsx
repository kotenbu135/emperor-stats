// グラフから「読み取れること」を言語化した SSR テキストブロック。
// クローラ・未訪問ユーザー向けに、グラフの結論をビルド時のデータから生成して
// 常時 DOM に出す（グラフ本体は LazyMount で画面外未マウント＝数値が DOM に出ない）。
// このブロックは必ず LazyMount の外＝Section の代表 Section 直下に置くこと。
// 「何のグラフか」は Section の description、「読み取れること」はこのブロックと分離する。
// 文面の単一情報源は lib/emperors.ts の getChartTakeaway（純粋な server 部品）。

export function ChartTakeaway({ sentences }: { sentences: string[] }) {
  if (sentences.length === 0) return null;
  return (
    <div className="mb-6 rounded-md border border-border bg-secondary/40 px-4 py-3">
      <p className="flex items-center gap-2 text-xs font-medium text-seal">
        <span aria-hidden className="h-3.5 w-1 shrink-0 rounded-full bg-seal" />
        読み取れること
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">
        {sentences.join(" ")}
      </p>
    </div>
  );
}
