// ルビ記法（`｜親文字《ルビ》`）を <ruby> へ描くだけのコンポーネント。GitHub Issue #20。
// 記法とパーサは lib/ruby.ts、方針は docs/site-design/RUBY_PLAN_2026-08-01.md。
//
// **rt は常に DOM に置き、表示/非表示は CSS だけで切り替える**（globals.css の
// `:root[data-ruby="off"]`）。実行時に要素を足し引きすると、その行の高さが変わって
// レイアウトシフトになる。トグルは components/layout/ruby-toggle.tsx。
//
// Server / Client のどちらからも使えるように "use client" は付けない
// （lib/ruby.ts が React 非依存の純粋関数だけで出来ている）。

import { Fragment } from "react";
import { hasRuby, parseRuby } from "@/lib/ruby";

/**
 * @param source ルビ記法の文字列。注釈が1つも無ければ素のテキストとして返す
 *   （<ruby> を作らないので、読み未確定の名前は今までと同じ見た目になる）。
 */
export function RubyText({ source }: { source: string }) {
  if (!hasRuby(source)) return <>{source}</>;
  return (
    <>
      {parseRuby(source).map((segment, i) =>
        segment.ruby === null ? (
          <Fragment key={i}>{segment.text}</Fragment>
        ) : (
          <ruby key={i}>
            {segment.text}
            <rt>{segment.ruby}</rt>
          </ruby>
        ),
      )}
    </>
  );
}
