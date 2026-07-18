"use client";

// 画面外チャートの遅延マウント枠。Nivoチャートは1つあたりの描画コストが大きく、
// 全セクションを初回レンダリングで一括マウントするとTBTが数秒に達するため
// （docs/site-design/LAYOUT.md「全9ページ計測」節）、ビューポート手前に
// 近づいた時点で初めて子コンポーネントをマウントする。

import { useEffect, useRef, useState, type ReactNode } from "react";

export function LazyMount({
  estimatedHeight,
  children,
}: {
  /** マウント前に確保しておく高さ。実高さとの多少のずれは、マウントが
   *  ビューポート外（rootMargin手前）で起きるためCLSには影響しない。 */
  estimatedHeight: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setMounted(true);
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (mounted) return <>{children}</>;
  return <div ref={ref} style={{ minHeight: estimatedHeight }} />;
}
