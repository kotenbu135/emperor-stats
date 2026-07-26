"use client";

// /kinship の章ジャンプ(画面上部に固定)。時代が下るほど1章が縦に長く、
// スクロールで迷子になるため(ユーザー指示・2026-07-26)。
// - 見た目はボタン(丸ピル)。ただのテキストリンクだと押せることが伝わらなかった。
// - 現在見ている章をハイライトする。判定はサイドバーメニュー(nav-menu.tsx)の
//   useActiveSection と同じ IntersectionObserver 方式・同じ帯(-20%/-55%)にして、
//   左メニューの強調とページ内バーの強調がずれないようにする。
// - 高さは NAV_H に固定する。章側の scroll-margin-top と揃える必要があるため
//   (ずれると、ジャンプ先の上に前の章の横スクロールバーが覗く)。

import { useEffect, useState } from "react";
import {
  HorizontalScrollHint,
  useHorizontalScrollEdges,
} from "@/components/charts/horizontal-scroll-hint";
import { cn } from "@/lib/utils";

/** 固定バーの高さ(px)。章の scroll-mt と必ず同じ値にすること。 */
export const KINSHIP_NAV_H = 48;

export function KinshipChapterNav({
  chapters,
}: {
  chapters: { id: string; title: string }[];
}) {
  const [activeId, setActiveId] = useState<string>(chapters[0]?.id ?? "");
  // 章が4つあると狭い画面では3つ目までしか見えず、手掛かりもなかった。
  const { scrollRef, atStart, atEnd, onScroll } =
    useHorizontalScrollEdges<HTMLUListElement>();

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (chapters.some((c) => c.id === hash)) setActiveId(hash);
    };
    window.addEventListener("hashchange", onHashChange);

    const els = chapters
      .map((c) => document.getElementById(c.id))
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
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      observer.disconnect();
    };
  }, [chapters]);

  return (
    <nav
      aria-label="章へジャンプ"
      className="sticky top-0 z-30 flex items-center border-b border-border bg-background/95 px-6 backdrop-blur md:px-10"
      style={{ height: KINSHIP_NAV_H }}
    >
      <span className="mr-3 hidden shrink-0 text-xs text-muted-foreground sm:inline">
        章へジャンプ
      </span>
      {/* 端フェードを絶対配置するため relative な箱で包む。バーは高さ固定なので
          フェードは inset-y-0 でバー全高に伸びる。 */}
      <div className="relative min-w-0 flex-1">
      <ul
        ref={scrollRef}
        onScroll={onScroll}
        className="flex min-w-0 gap-2 overflow-x-auto whitespace-nowrap py-1"
      >
        {chapters.map((c, i) => {
          const active = c.id === activeId;
          return (
            <li key={c.id}>
              <a
                href={`#${c.id}`}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "inline-block rounded-full border px-3 py-1 text-sm transition-colors",
                  active
                    ? "border-seal bg-seal text-seal-foreground"
                    : "border-border bg-background text-foreground/80 hover:border-seal/50 hover:bg-accent/60 hover:text-seal",
                )}
              >
                第{i + 1}章 {c.title}
              </a>
            </li>
          );
        })}
      </ul>
      {/* 48px固定のバーではバッジが章ピルに重なるため端フェードだけにする。 */}
      <HorizontalScrollHint atStart={atStart} atEnd={atEnd} showBadge={false} />
      </div>
    </nav>
  );
}
