"use client";

// 横スクロール枠が両端に達しているかを監視するフック。
//
// 「図が枠の中で切れているのか続きがあるのか分からない」という
// ユーザー指摘(2026-07-26)への対応で作った共有部品。
//
// 2026-07-31 に、端フェードと告知バッジの描画部品（HorizontalScrollHint・
// VerticalScrollHint）は呼び出し元が全部消えたので削除した（/reign の廃止と、
// 時代ジャンプバーを横スクロールから畳み込みへ変えたため）。いまの唯一の
// 呼び出し元は /database の表で、フェードは表の事情に合わせて自前で描いている
// （左端は固定した先頭列にかぶるので出さない）。

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/**
 * 横スクロール枠の両端に達しているかを監視する。state は端をまたぐ瞬間しか
 * 変わらないので、スクロール中に再レンダリングが走り続けることはない。
 *
 * @param externalRef 既にスクロール枠のrefを持っている呼び出し元はそれを渡す。
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
