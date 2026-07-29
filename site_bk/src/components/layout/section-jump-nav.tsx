"use client";

// ページ内の節へ飛ぶ索引（画面上部に固定）。
//
// 出自: /kinship の章ジャンプ（kinship-chapter-nav.tsx）。「時代が下るほど1章が
// 縦に長く、スクロールで迷子になる」というユーザー指摘(2026-07-26)への対応。
// 同じ問題が /emperors（365枚のカードで全高5万px超）と、節が3つ以上ある
// ランキングページにもあったため、3つ目の実装を書かずに済むよう共有部品に
// した(2026-07-27)。/kinship 側は章番号の採番を持つので当面そのまま。
//
// - ただのテキストリンクではなく丸ピル。押せることを形で伝える
// - 現在見ている節をハイライトする。判定はサイドバーメニュー・章ジャンプと
//   同じ IntersectionObserver・同じ帯（-20%/-55%）で、強調がずれないようにする
// - 節が多いページ（/emperors の16時代）では狭い画面に3つ分しか映らないため、
//   現在地のピルをバーの見える範囲へ送る
//
// 【観測対象の注意】id は「節の本体」に付けること。見出しに付けると、見出しが
// sticky でこのバーの真下に貼り付き続けるかぎり判定帯（画面の20%〜45%）に
// 一度も入らず、現在地が永久に更新されない。

import { useEffect, useState } from "react";
import {
  HorizontalScrollHint,
  useHorizontalScrollEdges,
} from "@/components/charts/horizontal-scroll-hint";
import { cn } from "@/lib/utils";

/** 固定バーの高さ(px)。 */
export const SECTION_NAV_H = 48;

/**
 * ジャンプ先の scroll-margin-top / 節見出しを sticky にする場合の top。
 * モバイルはサイトヘッダー(--chrome-top = 56px)も画面上端に固定されているため、
 * バーの高さだけでは足りない。直値ではなくこの式を使うこと。
 */
export const BELOW_SECTION_NAV = `calc(var(--chrome-top) + ${SECTION_NAV_H}px)`;

export interface JumpItem {
  /** 節本体の要素id。 */
  id: string;
  label: string;
  /** ピルに添える件数（任意）。 */
  count?: number;
}

export function SectionJumpNav({
  items,
  label,
  className,
}: {
  items: JumpItem[];
  /** バー左端の見出し（例: "時代へジャンプ"）。狭い画面では出さない。 */
  label: string;
  /** 左右の余白を打ち消す必要がある呼び出し元（既に padding された箱の中に
   *  置く場合）だけ渡す。例: "-mx-gutter md:-mx-gutter-wide" */
  className?: string;
}) {
  const [activeId, setActiveId] = useState<string>("");
  const { scrollRef, atStart, atEnd, onScroll } =
    useHorizontalScrollEdges<HTMLUListElement>();

  // 節の集合は絞り込みで変わりうる。並びを1本の文字列にして依存に使い、
  // 中身が同じ再レンダリングでは observer を張り直さない。
  const idKey = items.map((i) => i.id).join(" ");

  useEffect(() => {
    // 節が0件のときはバー自体を描かない。state は次に節が現れた瞬間、
    // observe 直後の通知で上書きされるのでここでは戻さない。
    if (!idKey) return;
    const els = idKey
      .split(" ")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -55% 0px" },
    );
    for (const el of els) observer.observe(el);
    return () => observer.disconnect();
  }, [idKey]);

  // 現在の節のピルをバーの見える範囲へ送る。
  useEffect(() => {
    const ul = scrollRef.current;
    if (!ul || !activeId) return;
    const pill = ul.querySelector<HTMLElement>('[aria-current="true"]');
    if (!pill) return;
    const margin = 24; // 端フェードに隠れない余白
    const left = pill.offsetLeft - margin;
    const right = pill.offsetLeft + pill.offsetWidth + margin;
    let next = ul.scrollLeft;
    if (left < ul.scrollLeft) next = left;
    else if (right > ul.scrollLeft + ul.clientWidth) next = right - ul.clientWidth;
    if (next === ul.scrollLeft) return;
    // 「視差効果を減らす」を選んでいる利用者には滑らせず即座に移す。
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ul.scrollTo({ left: Math.max(0, next), behavior: reduce ? "auto" : "smooth" });
  }, [activeId, scrollRef]);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label={label}
      // ページ全体を横断するスティッキーな索引の段（z-30）。節見出し・横スクロールの
      // 端フェード（z-10）と図の中で位置を保つラベル（z-20）より上、画面に固定される
      // 要素（z-50）より下。
      className={cn(
        "sticky z-30 flex items-center border-b border-border bg-background/95 px-gutter backdrop-blur md:px-gutter-wide",
        className,
      )}
      // モバイルは sticky なサイトヘッダーの下に着ける。
      style={{ height: SECTION_NAV_H, top: "var(--chrome-top)" }}
    >
      <span className="mr-3 hidden shrink-0 text-xs text-muted-foreground sm:inline">
        {label}
      </span>
      {/* 端フェードを絶対配置するため relative な箱で包む。バーは高さ固定なので
          フェードは inset-y-0 でバー全高に伸びる。 */}
      <div className="relative min-w-0 flex-1">
        <ul
          ref={scrollRef}
          onScroll={onScroll}
          className="flex min-w-0 gap-2 overflow-x-auto whitespace-nowrap py-1"
        >
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                    active
                      ? "border-seal bg-seal text-seal-foreground"
                      : "border-border bg-background text-foreground/80 hover:border-seal/50 hover:bg-accent/60 hover:text-seal",
                  )}
                >
                  {item.label}
                  {item.count !== undefined && (
                    <span
                      className={cn(
                        "text-micro tabular-nums",
                        active ? "text-seal-foreground/80" : "text-muted-foreground",
                      )}
                    >
                      {item.count}
                    </span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
        {/* 48px固定のバーではバッジがピルに重なるため端フェードだけにする。 */}
        <HorizontalScrollHint atStart={atStart} atEnd={atEnd} showBadge={false} />
      </div>
    </nav>
  );
}
