"use client";

// グラフ内スクロール型の横棒グラフ（皇帝ランキング・王朝別集計）で共有する部品。
// 設計の要点:
// - 数値軸はスクロール領域の外に独自SVGヘッダーとして常時表示する。Nivo側は
//   valueScaleのniceを切ってドメインを固定するため、同じ線形変換で目盛りを描けば
//   グリッド線とピクセル単位で揃う。
// - Nivo標準ツールチップはチャートSVG基準のabsolute配置でスクロール枠にクリップ
//   されるため、fixed配置の自前ツールチップ（FixedTooltip）を使う。

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { BarDatum, BarCustomLayerProps } from "@nivo/bar";

export const ROW_HEIGHT = 24;
// バー右外側の数値ラベル領域。
export const MARGIN_RIGHT = 76;
// グラフ内スクロールのビューポート高さ。説明・フィルタ込みで1画面に収まる高さに抑える。
export const SCROLL_MAX_HEIGHT = "min(60vh, 520px)";

/** バーの右外側に数値を描く独自レイヤー（短いバーでも値が読め、文字コントラストも確保できる）。 */
export function OutsideValueLabels({ bars }: BarCustomLayerProps<BarDatum>) {
  return (
    <g>
      {bars.map((bar) => (
        <text
          key={bar.key}
          x={bar.x + bar.width + 6}
          y={bar.y + bar.height / 2}
          dominantBaseline="central"
          fill="#3a3530"
          fontSize={11}
        >
          {(bar.data.data as unknown as { formatted: string }).formatted}
        </text>
      ))}
    </g>
  );
}

/** スクロール領域の外に置く数値軸ヘッダー。グラフ本体をスクロールしても軸が常に見える。 */
export function AxisHeader({
  width,
  marginLeft,
  domainMax,
  ticks,
  label,
}: {
  width: number;
  marginLeft: number;
  domainMax: number;
  ticks: number[];
  label: string;
}) {
  const plotWidth = Math.max(0, width - marginLeft - MARGIN_RIGHT);
  const x = (v: number) => marginLeft + (v / domainMax) * plotWidth;
  return (
    <svg width={width} height={40} className="block" aria-hidden>
      <text
        x={marginLeft + plotWidth / 2}
        y={14}
        textAnchor="middle"
        fill="#3a3530"
        fontSize={12}
      >
        {label}
      </text>
      {ticks.map((t) => (
        <text
          key={t}
          x={x(t)}
          y={33}
          textAnchor="middle"
          fill="#6b6258"
          fontSize={11}
        >
          {t}
        </text>
      ))}
    </svg>
  );
}

// ウィンドウイングのオーバースキャン行数（速いスクロールでも白抜けしにくい余裕）。
const OVERSCAN_ROWS = 12;

/**
 * グラフ内スクロールの行ウィンドウイング。364行を全件SVGレンダリングすると
 * マウントだけで秒単位のCPUを食うため（LAYOUT.mdのTBT計測記録）、可視範囲
 * ±オーバースキャンの行だけをNivoに渡す。行ピッチはROW_HEIGHT固定なので、
 * スライスをtop = start×ROW_HEIGHTに絶対配置すれば全件描画と目盛り・行位置が
 * ピクセル単位で一致する。
 */
export function useWindowedRows(rowCount: number): {
  scrollRef: RefObject<HTMLDivElement | null>;
  /** 表示範囲の先頭行（チャート上端から数えた0始まり）。 */
  start: number;
  /** 表示範囲の終端行（exclusive）。 */
  end: number;
  /** スクロールコンテナのonScrollに（既存処理と並べて）渡す。 */
  handleScroll: () => void;
} {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  // 初期値はSCROLL_MAX_HEIGHTの上限。マウント後に実測値へ置き換わる。
  const [viewportHeight, setViewportHeight] = useState(520);
  const rafRef = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setViewportHeight(el.clientHeight));
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleScroll = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setScrollTop(scrollRef.current?.scrollTop ?? 0);
    });
  };

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS);
  const end = Math.min(
    rowCount,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN_ROWS,
  );
  return { scrollRef, start, end, handleScroll };
}

/**
 * スクロール領域内側の幅を測るフック。スマホ対応と、スクロールバーの分だけ
 * 外枠より狭くなる分を軸ヘッダー幅に反映するために使う。
 */
export function useChartWidth(): {
  chartAreaRef: RefObject<HTMLDivElement | null>;
  chartWidth: number;
} {
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(800);
  useEffect(() => {
    const el = chartAreaRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setChartWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { chartAreaRef, chartWidth };
}

/** カーソル位置に追従するfixed配置ツールチップ。画面下部ではカーソルの上側に反転する。 */
export function FixedTooltip({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: ReactNode;
}) {
  const flip = y > window.innerHeight * 0.6;
  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{
        left: Math.min(x + 14, window.innerWidth - 254),
        top: flip ? y - 12 : y + 14,
        transform: flip ? "translateY(-100%)" : undefined,
      }}
    >
      {children}
    </div>
  );
}
