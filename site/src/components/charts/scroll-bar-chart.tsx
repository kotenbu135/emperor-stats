"use client";

// グラフ内スクロール型の横棒グラフ（皇帝ランキング・王朝別集計）で共有する部品。
// 設計の要点:
// - 数値軸はスクロール領域の外に独自SVGヘッダーとして常時表示する。Nivo側は
//   valueScaleのniceを切ってドメインを固定するため、同じ線形変換で目盛りを描けば
//   グリッド線とピクセル単位で揃う。
// - Nivo標準ツールチップはチャートSVG基準のabsolute配置でスクロール枠にクリップ
//   されるため、fixed配置の自前ツールチップ（FixedTooltip）を使う。

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type { BarDatum, BarCustomLayerProps } from "@nivo/bar";

export const ROW_HEIGHT = 24;
// バー右外側の数値ラベル領域。
export const MARGIN_RIGHT = 76;
// Nivoチャートの上マージン。RowOverlayの行位置計算と共有するため定数化する。
export const MARGIN_TOP = 6;
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

/**
 * 行全体（ラベル＋グラフ領域）を覆う透明のヒット領域。バー矩形だけをホバー対象に
 * すると値が小さい行は当たり判定が数pxしかなく狙えないため、SVGの上に行単位の
 * 要素を重ねて「行のどこでもホバー・クリックできる」ようにする。
 * - ウィンドウイング中のスライス（transformで動く親）の中に置く前提。keyは行idで
 *   なくウィンドウ内indexを使う（ウィンドウがずれてもDOMノードのtopが変わらず、
 *   位置の書き換えが起きない）。
 * - onSelectを渡すとbutton要素になり、クリック（タップ・キーボード）で詳細を開ける。
 *   省略時はホバー専用の装飾要素（aria-hidden）を描く。
 */
export function RowOverlay<T>({
  rows,
  hoverAllowed,
  onHover,
  onLeave,
  onSelect,
  selectLabelOf,
}: {
  /** ウィンドウ内に表示中の行（上から順）。 */
  rows: T[];
  /** スクロール直後のホバー抑制（useWindowedRowsのhoverAllowed）。 */
  hoverAllowed: () => boolean;
  onHover: (row: T, event: ReactMouseEvent<HTMLElement>) => void;
  onLeave: () => void;
  /** 行クリック時の動作（詳細ダイアログを開くなど）。 */
  onSelect?: (row: T) => void;
  /** onSelect時に必須。行buttonのアクセシブルネーム。 */
  selectLabelOf?: (row: T) => string;
}) {
  return (
    <>
      {rows.map((row, i) => {
        const style = { top: MARGIN_TOP + i * ROW_HEIGHT, height: ROW_HEIGHT };
        const handlers = {
          onMouseEnter: (event: ReactMouseEvent<HTMLElement>) => {
            if (hoverAllowed()) onHover(row, event);
          },
          onMouseLeave: onLeave,
        };
        return onSelect ? (
          <button
            key={i}
            type="button"
            className="absolute inset-x-0 cursor-pointer hover:bg-seal/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            style={style}
            aria-label={selectLabelOf?.(row)}
            onClick={() => {
              onLeave();
              onSelect(row);
            }}
            {...handlers}
          />
        ) : (
          <div
            key={i}
            aria-hidden
            className="absolute inset-x-0 hover:bg-seal/5"
            style={style}
            {...handlers}
          />
        );
      })}
    </>
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
// ウィンドウ更新の粒度（行）。startをこの倍数に量子化することで、境界をまたいだ
// ときだけ再レンダリングが起きる（量子化なしだと24pxごとにNivoチャート全体が
// 再描画され、スクロール中のTBTが秒単位になる。実測はLighthouse timespanの記録）。
const STEP_ROWS = 8;

function computeRange(
  scrollTop: number,
  viewportHeight: number,
  rowCount: number,
): { start: number; end: number } {
  const rawStart = Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS;
  const start = Math.max(0, Math.floor(rawStart / STEP_ROWS) * STEP_ROWS);
  const rawEnd =
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN_ROWS;
  const end = Math.min(rowCount, Math.ceil(rawEnd / STEP_ROWS) * STEP_ROWS);
  return { start, end };
}

/**
 * グラフ内スクロールの行ウィンドウイング。364行を全件SVGレンダリングすると
 * マウントだけで秒単位のCPUを食うため（LAYOUT.mdのTBT計測記録）、可視範囲
 * ±オーバースキャンの行だけをNivoに渡す。行ピッチはROW_HEIGHT固定なので、
 * スライスをtop = start×ROW_HEIGHTに絶対配置すれば全件描画と行位置が一致する。
 *
 * stateに持つのはスクロール量そのものではなく量子化済みの行範囲。スクロールで
 * 変わるのは範囲がSTEP_ROWS境界をまたいだときだけなので、呼び出し側コンポーネント
 * （Nivoチャート含む）の再レンダリングもそのときしか起きない。
 */
export function useWindowedRows(rowCount: number): {
  scrollRef: RefObject<HTMLDivElement | null>;
  /** 表示範囲の先頭行（チャート上端から数えた0始まり）。 */
  start: number;
  /** 表示範囲の終端行（exclusive）。 */
  end: number;
  /** スクロールコンテナのonScrollに（既存処理と並べて）渡す。 */
  handleScroll: () => void;
  /** ホバーツールチップを表示してよいか。スクロール中はバーがカーソル下を
   *  次々通過してmouseenterが連発し、その都度チャート全体が再レンダリングされて
   *  TBTの主因になるため、スクロール直後の一定時間はホバーを無視する。 */
  hoverAllowed: () => boolean;
} {
  const scrollRef = useRef<HTMLDivElement>(null);
  // 初期の高さはSCROLL_MAX_HEIGHTの上限。マウント後に実測値へ置き換わる。
  const viewportHeightRef = useRef(520);
  const rowCountRef = useRef(rowCount);
  const rafRef = useRef(0);
  const [range, setRange] = useState(() => computeRange(0, 520, rowCount));

  const updateRange = () => {
    const el = scrollRef.current;
    const next = computeRange(
      el?.scrollTop ?? 0,
      viewportHeightRef.current,
      rowCountRef.current,
    );
    setRange((prev) =>
      prev.start === next.start && prev.end === next.end ? prev : next,
    );
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      viewportHeightRef.current = el.clientHeight;
      updateRange();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // フィルタ変更などで行数が変わったら範囲を計算し直す（stale rangeのままだと
  // 呼び出し側のsliceが範囲外になる）。
  useEffect(() => {
    rowCountRef.current = rowCount;
    updateRange();
  }, [rowCount]);

  const lastScrollAtRef = useRef(-Infinity);
  const handleScroll = () => {
    lastScrollAtRef.current = performance.now();
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(updateRange);
  };
  const hoverAllowed = () => performance.now() - lastScrollAtRef.current > 150;

  // 行数が減った直後のレンダリングでは効果が範囲を再計算するまでの間
  // stateが古い可能性があるため、常にrowCountでクランプして返す。
  const end = Math.min(range.end, rowCount);
  const start = Math.min(range.start, end);
  return { scrollRef, start, end, handleScroll, hoverAllowed };
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

/** カーソル位置に追従するfixed配置ツールチップ。画面下部ではカーソルの上側に反転する。
 *  位置はleft/topでなくtransformで動かす。left/topの書き換えはfixed要素でも
 *  layout-shiftとして計上され、バー間をホバーするだけでCLSが積み上がる
 *  （実機Lighthouse timespanで確認。transformはlayout-shiftの対象外）。 */
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
  const left = Math.min(x + 14, window.innerWidth - 254);
  const top = flip ? y - 12 : y + 14;
  return (
    <div
      className="pointer-events-none fixed left-0 top-0 z-50"
      style={{
        transform: `translate(${left}px, ${top}px)${flip ? " translateY(-100%)" : ""}`,
      }}
    >
      {children}
    </div>
  );
}

/**
 * ホバーツールチップの状態をチャート本体から分離するフック。
 * hoverTipをチャートコンポーネントのstateに持つと、バーやセグメントを通過する
 * たびにNivoチャート全体（数百SVGノード）が再レンダリングされ、実機Lighthouse
 * timespanでTBTが秒単位に積み上がる。状態はTipOutlet（ツールチップだけを描く
 * 小さな子コンポーネント）が持ち、チャート側は安定参照のsetTipを呼ぶだけにする。
 */
export function useTipOutlet<T>(): {
  /** ツールチップの表示/更新/非表示。チャート側のイベントハンドラから呼ぶ。 */
  setTip: (tip: T | null) => void;
  /** ツールチップの描画位置に置くコンポーネント。renderにはtip非nullのときだけ呼ばれる描画関数を渡す。 */
  TipOutlet: (props: { render: (tip: T) => ReactNode }) => ReactNode;
} {
  const setterRef = useRef<((tip: T | null) => void) | null>(null);
  const setTip = useCallback((tip: T | null) => {
    setterRef.current?.(tip);
  }, []);
  const TipOutlet = useCallback(
    ({ render }: { render: (tip: T) => ReactNode }) => (
      <TipOutletInner setterRef={setterRef} render={render} />
    ),
    [],
  );
  return { setTip, TipOutlet };
}

function TipOutletInner<T>({
  setterRef,
  render,
}: {
  setterRef: RefObject<((tip: T | null) => void) | null>;
  render: (tip: T) => ReactNode;
}) {
  const [tip, setTip] = useState<T | null>(null);
  useEffect(() => {
    setterRef.current = setTip;
    return () => {
      setterRef.current = null;
    };
  }, [setterRef]);
  if (tip === null) return null;
  return <>{render(tip)}</>;
}

/**
 * 「表で見る」の開閉状態を自前で持つdetails枠。開閉のたびに親チャート
 * （Nivo含む）が再レンダリングされるのを避ける。childrenは開いている間だけ
 * 呼ばれる描画関数（閉じているときのテーブル構築コストもゼロ）。
 */
export function TableDetails({
  summary,
  children,
}: {
  summary: ReactNode;
  children: () => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="mt-3"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
        {summary}
      </summary>
      {open && children()}
    </details>
  );
}
