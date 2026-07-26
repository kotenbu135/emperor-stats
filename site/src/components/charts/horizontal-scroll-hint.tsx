"use client";

// 横スクロールする枠に「まだ続きがある」ことを示す端フェードと告知バッジ。
//
// 出自: /kinship の系譜図（kinship-chart.tsx）に実装したもの。「図が枠の中で
// 切れているのか続きがあるのか分からない」というユーザー指摘(2026-07-26)への対応。
// 同じ問題が /timeline の年表と /kinship の章ジャンプにもあったため、3つ目の
// 実装を書かずに済むよう共有部品へ切り出した(2026-07-27)。マークアップとクラス名は
// 切り出し元から一字も変えていない（/kinship の描画が変わってはいけないため）。

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/**
 * 横スクロール枠の両端に達しているかを監視する。state は端をまたぐ瞬間しか
 * 変わらないので、スクロール中に再レンダリングが走り続けることはない。
 *
 * @param externalRef 既にスクロール枠のrefを持っている呼び出し元（/timeline は
 *   キーボード操作・ラベルのクランプ処理で同じrefを使う）はそれを渡す。
 *   その場合 `onScroll` は使わず、呼び出し元の既存ハンドラから `syncEdges` を呼ぶ。
 */
export function useHorizontalScrollEdges<E extends HTMLElement = HTMLDivElement>(
  externalRef?: RefObject<E | null>,
) {
  const ownRef = useRef<E | null>(null);
  const scrollRef = externalRef ?? ownRef;
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  const syncEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1);
  // scrollRef は useRef 由来でレンダー間で同一（外から渡される場合も同じ）。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onScroll = useCallback(() => syncEdges(), [syncEdges]);
  useEffect(() => {
    syncEdges();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // 画面幅が変わると「続きがあるか」も変わる。
    const ro = new ResizeObserver(syncEdges);
    ro.observe(el);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncEdges]);
  return { scrollRef, atStart, atEnd, onScroll, syncEdges };
}

/**
 * 端フェードと告知バッジ。`relative` な親（スクロール枠を内包する箱）の直下に置く。
 * 年ラベル等の sticky オーバーレイ(z-20)より下(z-10)に敷く。
 */
export function HorizontalScrollHint({
  atStart,
  atEnd,
  showBadge = true,
}: {
  atStart: boolean;
  atEnd: boolean;
  /** 背の低い枠（48pxの章ジャンプバー等）ではバッジが中身に重なるため、
   *  端フェードだけにする。 */
  showBadge?: boolean;
}) {
  return (
    <>
      {!atStart && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-background to-transparent"
        />
      )}
      {!atEnd && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-background to-transparent"
          />
          {showBadge && (
            <span className="pointer-events-none absolute right-2 top-2 z-20 rounded-full border border-border bg-background/90 px-2 py-0.5 text-micro text-muted-foreground">
              横スクロールで続き →
            </span>
          )}
        </>
      )}
    </>
  );
}
