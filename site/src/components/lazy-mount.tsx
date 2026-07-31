"use client";

// 画面外チャートの遅延マウント枠。Nivoチャートは1つあたりの描画コストが大きく、
// 全セクションを初回レンダリングで一括マウントするとTBTが数秒に達する（実測）ため、
// ビューポート手前に近づいた時点で初めて子コンポーネントをマウントする。
// **Nivo が残っている面（/reign・/emperors）はこの枠を外すと TBT が跳ねる。**

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
