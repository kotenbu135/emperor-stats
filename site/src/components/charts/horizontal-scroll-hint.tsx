"use client";

// スクロールする枠に「まだ続きがある」ことを示す端フェードと告知バッジ。
//
// 「図が枠の中で切れているのか続きがあるのか分からない」という
// ユーザー指摘(2026-07-26)への対応。複数の面で同じ問題が出たため共有部品にした。
//
// 同じ手掛かりが縦（ランキング棒グラフのグラフ内スクロール）にも要るため、
// 縦版 VerticalScrollHint を後から足した(2026-07-27)。横版の機構をそのまま縦へ
// 写しているが、状態の持ち方だけは別にしてある（下記のコメント）。

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

/**
 * 縦スクロール枠の上下端フェード。`relative` な親（スクロール枠を内包する箱）の
 * 直下に、スクロール枠と並べて置く。
 *
 * 横版と違い、端の判定に使う state をこの部品の中だけで持ち、スクロールの購読も
 * 自分で行う（横版のようにフックを外へ出さない）。呼び出し元はランキング棒グラフの
 * 枠で、そこに state を持たせるとスクロールのたびに Nivo チャート全体が
 * 再レンダリングされるため。useTipOutlet と同じ「状態は末端の小さな部品が持つ」方針。
 *
 * 告知バッジは縦には出さない。ランキングの行は枠いっぱいに詰まっていて、右上でも
 * 右下でも必ず行の上に重なり続ける（横版が「背の低い枠ではフェードだけ」とした
 * 判断と同じ理由）。縦の続きの有無はスクロールバーでも分かる。
 */
export function VerticalScrollHint<E extends HTMLElement = HTMLDivElement>({
  scrollRef,
}: {
  scrollRef: RefObject<E | null>;
}) {
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const sync = () => {
      raf = 0;
      setAtTop(el.scrollTop <= 1);
      setAtBottom(el.scrollTop >= el.scrollHeight - el.clientHeight - 1);
    };
    // 実測はスクロールハンドラの中で行わず rAF へ回す（ハンドラ内で scrollTop 等を
    // 読むと、行ウィンドウイングが同じフレームで書き換える transform と噛み合って
    // 強制同期レイアウトになる）。state が変わるのは端をまたぐ瞬間だけなので、
    // スクロール中に再レンダリングが走り続けることはない。
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(sync);
    };
    sync();
    el.addEventListener("scroll", schedule, { passive: true });
    // 画面幅・絞り込みで枠の高さが変わると「続きがあるか」も変わる。
    const ro =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", schedule);
      ro?.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [scrollRef]);
  return (
    <>
      {!atTop && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-background to-transparent"
        />
      )}
      {!atBottom && (
        <div
          aria-hidden
          // 下端は枠の角に重なる。角丸を共有の半径で切っておかないと、フェードの
          // 四角い角が枠の丸みを塗りつぶす。
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 rounded-b-md bg-gradient-to-t from-background to-transparent"
        />
      )}
    </>
  );
}
