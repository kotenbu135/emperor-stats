// 分類（死因・即位経路）の全区分を件数・割合・定義つきで並べる静的リスト。
//
// 円グラフ（CategoryPieChart）は LazyMount 配下の Client Component なので、
// 画面外では区分名も件数も定義文も DOM に一切出ない。TopRankedTable が
// ランキングページに対して果たしているのと同じ役割を、分類ページで担う部品。
// 数値は getCategoryBreakdown（円グラフと同じ数え方）、並びは円グラフの既定
// （categoryOrder＝固定順）に合わせる。定義文は円グラフに渡している
// categoryDescriptions と同一のオブジェクトを受け取り、二重管理にしない。

import type { HomeBreakdownSlice } from "@/lib/emperors";

export function CategoryBreakdownList({
  slices,
  categoryOrder,
  categoryDescriptions,
  label,
  unit = "名",
}: {
  slices: HomeBreakdownSlice[];
  /** 表示順。円グラフの既定の並び（意味に沿った固定順）と同じものを渡す。 */
  categoryOrder: readonly string[];
  categoryDescriptions: Record<string, string>;
  /** 見出しの対象名（例: "死因"）。区分数は実際に出す行数から導出する。 */
  label: string;
  unit?: string;
}) {
  const byCategory = new Map(slices.map((s) => [s.category, s]));
  const rows = categoryOrder
    .map((category) => byCategory.get(category))
    .filter((s): s is HomeBreakdownSlice => s !== undefined);
  if (rows.length === 0) return null;

  // 見出しの「N分類」は実際の行数から導出する。該当者0名の区分は円グラフにも
  // このリストにも現れないため、スキーマ上の区分数を手で書くとずれる
  // （死因は8区分すべてに該当者がいるが、区分の増減はデータ側の enum に従う）。
  const title = `${label}${rows.length}分類の内訳と定義`;

  return (
    <div className="mt-6">
      <h3 className="font-heading text-base font-semibold text-foreground">
        {title}
      </h3>
      <dl className="mt-2 text-sm">
        {rows.map((s) => (
          <div
            key={s.category}
            className="border-b border-border/60 py-2 last:border-b-0"
          >
            <dt className="flex items-baseline gap-2">
              <span className="font-medium text-foreground">{s.category}</span>
              <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                {s.count}
                {unit}
              </span>
              <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">
                {s.percentLabel}
              </span>
            </dt>
            <dd className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {categoryDescriptions[s.category]}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
