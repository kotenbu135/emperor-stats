// 皇帝個別ページの「出典」ブロック（2026-08-05・Issue #75）。
//
// 判定の根拠にした正史の書名・巻（`source.page`）だけを畳んで置く。個別ページには
// 「死因: 諸説あり」「即位経路: 内禅」という**判定結果しか出ていなかった**ため、
// 検索・AI 経由でここへ直接着地した訪問者には、その判定がどの史料に基づくかを
// 辿る手段が無かった（/about を読んだ人にしか届かないという到達範囲の非対称）。
//
// 出すのは書名・巻だけで、**note（判定根拠の散文）は出さない**（2026-08-05 の
// ユーザー決定）。note は調査の作業ログで「現行 X → Y に訂正」のように捨てた側の
// 値が残っており、そのままでは訪問者に出せない。
//
// **Radix の Accordion に替えないこと。** ui/accordion.tsx は forceMount を渡して
// いないので閉じた本文が DOM から消え、書名・巻が静的HTMLから丸ごと落ちる
// （＝このブロックを足した目的そのものが消える）。畳むなら素の `<details>`。
//
// 出す欄を増やすときは emperors.ts の `SOURCE_ENTRIES` に1行足す（ここは表示だけ）。

import { ChevronRight } from "lucide-react";
import type { EmperorSourceEntry } from "@/lib/emperor-types";

export function EmperorSources({ entries }: { entries: EmperorSourceEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section>
      {/* 面は基本情報・年表と同じ --card。閉じている状態が既定なので上下の余白は
          他ブロック（p-5）より薄くし、畳まれた1行として見えるようにする。 */}
      <details className="group rounded-[0.5rem] border border-border bg-card px-5 py-3">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-seal [&::-webkit-details-marker]:hidden">
          <ChevronRight
            aria-hidden
            className="size-3.5 shrink-0 transition-transform group-open:rotate-90"
          />
          {/* 見出しは summary の中に置く（外へ出すと閉じた状態で「出典」が2行並ぶ）。
              **何の出典かは畳んだまま見せる** — 「出典」だけだとページ全体の典拠に
              読め、開くまで死因・即位経路の2項目に限る話だと分からない。項目名は
              entries から作るので、出す欄を増やせばここも自動で追従する。 */}
          <h2 className="font-heading text-base font-semibold">出典</h2>
          <span className="text-xs">
            （{entries.map((e) => e.label).join("・")}）
          </span>
        </summary>
        <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
          <dl className="text-sm">
            {entries.map(({ label, page }) => (
              <div
                key={label}
                className="grid gap-x-3 border-b border-border/60 py-1.5 last:border-b-0 sm:grid-cols-[5.5rem_1fr]"
              >
                <dt className="text-muted-foreground">{label}</dt>
                {/* 書名・巻は底本の字体のまま出す（新字体へ直さない）。ルビは
                    通さない — 書名は name-readings.json に無く rubyOf が throw する。 */}
                <dd className="min-w-0 leading-relaxed">{page}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs leading-relaxed text-muted-foreground">
            この{entries.length}
            項目の判定に用いた正史の書名・巻です。判定の根拠を述べた調査メモと原文の引用は、サイトの画面には出しておらず配布データに収録しています。
          </p>
        </div>
      </details>
    </section>
  );
}
