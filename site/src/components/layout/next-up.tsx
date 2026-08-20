import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * ページ末尾の「次に見る」3枚（2026-08-17・GitHub Issue #94 の案4）。
 *
 * **置くのは `/` と皇帝個別365ページだけ。** `/emperors`（全高44,772px）・
 * `/database`（同18,226px）はページ末尾まで到達しないので、この帯を足しても回遊にならない
 * （2026-08-06 に入れたモバイルヘッダーの3項目＝Issue #92 の案2がその2面を担う）。
 * ここは「移動できない」の解決ではなく、読み終えた面から**関連する面を薦める**器。
 *
 * **フッターの1行には触らない**（2026-08-03 の決定・全ページ向けの注意書きは `/about` へ）。
 * この帯はフッターの直上・本文の中に置く。
 *
 * 3枚に固定するのは段組みのため（sm で2列・lg で3列に割る）。**4枚目を足さない** —
 * 4枚は sm の2列で1枚あまり、lg の3列でも1枚あまって末尾に穴が空く。
 */
export interface NextUpItem {
  /** カードの見出し。行き先そのものではなく「そこで何が見られるか」を書く。 */
  title: string;
  /** 見出しの下の1行。件数を出すときはここ（`162名` のように実数で）。 */
  description: string;
  href: string;
}

export function NextUp({ items }: { items: NextUpItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-labelledby="next-up-heading" className="mt-section">
      <h2
        id="next-up-heading"
        className="font-heading text-base font-semibold text-foreground"
      >
        次に見る
      </h2>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.href}>
            {/* hover は「面がわずかに沈む」側（AGENTS.md の2つの言い方のうち1つ）で、
                矢印だけ朱に寄せる。focus-visible を書き忘れると globals.css の
                `*` に当たった `outline-ring/50`（白地 1.7:1）へ落ちるので必ず対で書く。
                隣と接する箱なので offset は付けない。 */}
            <Link
              href={item.href}
              className="group flex h-full items-start gap-2 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-seal"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">
                  {item.title}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {item.description}
                </span>
              </span>
              <ChevronRight
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-seal"
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
