"use client";

// 通史年表v2「大河」ビュー本体（設計: docs/site-design/TIMELINE.md「第2世代」、
// モック: docs/site-design/mockups/timeline-river.html）。
// - 約35本のストリーム+群雄クラスターをSVGで描く。縦=地理（上:北方/中央:統一の
//   座/下:南方）、帯の太さ=唯一在位（統一）、灰ハッチ=クラスター（クリック開閉）。
// - 描画はzoom/開閉/コンテナ幅が変わったときだけ。スクロールは常にネイティブ。
// - ホバー・詳細ダイアログの状態はチャートに持たない（useTipOutlet/useDetailOutlet。
//   経緯はLAYOUT.md「実機timespanレポート」節）。
// - ズーム時の帯ラベルはスクロールに追従してスパン内へクランプする（rAF+transform
//   の直接DOM操作。top/left書き換えやReact stateにはしない）。
// - キーボード操作は第1世代を踏襲（role="application"・左右=同じ段・上下=並立・
//   Enter=拡大/詳細/開閉・Escape=解除）。

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Button } from "@/components/ui/button";
import {
  FixedTooltip,
  useChartWidth,
  useTipOutlet,
} from "@/components/charts/scroll-bar-chart";
import { EmperorTooltip } from "@/components/charts/emperor-tooltip";
import { useDetailOutlet } from "@/components/emperors/emperor-detail-dialog";
import { dynastyContextLabel } from "@/components/emperors/emperor-detail-body";
import { TimelineTable } from "@/components/timeline/timeline-table";
import type { EmperorRecord, TimelineData } from "@/lib/emperor-types";
import {
  fromAstroYear,
  type RiverMember,
  type RiverSeg,
  type RiverSpan,
  type RiverStream,
  type RiverTimelineData,
} from "@/lib/timeline-river";

// --- レイアウト定数 ---
const PAD_X = 14;
const CH_H = 30; // 章（時代）ラベル行
const EV_H = 50; // 画期フラグ2段
const ROW_H = 50; // 基本の行高
const AX_H = 30; // 軸ラベル行
const BC_H = 46; // 統一/分裂バーコード
const H_SOLE = 34;
const H_MAJOR = 17;
const H_TINY = 11;
const H_CLUSTER = 22;
const MEMBER_LANE = 16; // 展開クラスターのミニレーン高

type Zoom = "fit" | "mid" | "detail";
const ZOOM_PX: Record<Exclude<Zoom, "fit">, number> = { mid: 3, detail: 8 };
const ZOOM_LABELS: Record<Zoom, string> = { fit: "全体", mid: "拡大", detail: "詳細" };

type RiverTip =
  | { kind: "emperor"; record: EmperorRecord; seg: RiverSeg; x: number; y: number }
  | { kind: "stream"; stream: RiverStream; x: number; y: number }
  | { kind: "member"; member: RiverMember; stream: RiverStream; x: number; y: number };

function fmtA(a: number): string {
  const y = fromAstroYear(a);
  return y < 0 ? `前${-y}` : `${y}`;
}
function periodA(a: number, b: number): string {
  return a === b ? `${fmtA(a)}年` : `${fmtA(a)}–${fmtA(b)}年`;
}

function bandHeight(stream: RiverStream, sole: boolean): number {
  if (stream.kind === "cluster") return H_CLUSTER;
  if (sole) return H_SOLE;
  return stream.kind === "tiny" ? H_TINY : H_MAJOR;
}
function spanAt(stream: RiverStream, a: number): RiverSpan {
  let best = stream.spans[0];
  for (const sp of stream.spans) {
    if (sp.a <= a && a <= sp.b) return sp;
    if (sp.a <= a) best = sp;
  }
  return best;
}
function soleAt(stream: RiverStream, a: number): boolean {
  const sp = spanAt(stream, a);
  for (const p of sp.pieces) if (p.a <= a && a <= p.b) return p.sole;
  return false;
}
/** x座標由来の年に最も近い在位セグメント（在位1年未満でも選べる）。 */
function nearestSeg(segs: RiverSeg[], t: number): RiverSeg {
  let best = segs[0];
  let bd = Infinity;
  for (const g of segs) {
    const d = g.a <= t && t <= g.b + 1 ? 0 : Math.min(Math.abs(t - g.a), Math.abs(t - g.b - 1));
    if (d < bd) {
      bd = d;
      best = g;
    }
  }
  return best;
}

/** 王朝帯の色（--series-N を宣紙色に混ぜた淡彩。cluster=slot 0 は灰）。 */
function streamColors(slot: number): { fill: string; edge: string } {
  if (slot === 0)
    return {
      fill: "color-mix(in srgb, var(--foreground) 10%, var(--background))",
      edge: "color-mix(in srgb, var(--foreground) 38%, var(--background))",
    };
  const c = `var(--series-${slot})`;
  return {
    fill: `color-mix(in srgb, ${c} 42%, var(--background))`,
    edge: `color-mix(in srgb, ${c} 82%, var(--background))`,
  };
}

/** スクロール直後150msのホバー抑制（第1世代のuseHoverGateと同じ）。 */
function useHoverGate(): { markScroll: () => void; hoverAllowed: () => boolean } {
  const lastScrollAtRef = useRef(-Infinity);
  const markScroll = () => {
    lastScrollAtRef.current = performance.now();
  };
  const hoverAllowed = () => performance.now() - lastScrollAtRef.current > 150;
  return { markScroll, hoverAllowed };
}

const HALO: React.CSSProperties = {
  stroke: "var(--background)",
  strokeWidth: 3.5,
  paintOrder: "stroke",
};

export function RiverTimeline({
  river,
  timeline,
  records,
}: {
  river: RiverTimelineData;
  timeline: TimelineData;
  records: EmperorRecord[];
}) {
  const recordById = useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [expanded, setExpanded] = useState<readonly number[]>([]);
  const expandedSet = useMemo(() => new Set(expanded), [expanded]);
  const { chartAreaRef, chartWidth } = useChartWidth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pendingCenterRef = useRef<number | null>(null);
  const suppressTipClearRef = useRef(false);
  const { markScroll, hoverAllowed } = useHoverGate();
  const rafRef = useRef(0);
  const { setTip, TipOutlet } = useTipOutlet<RiverTip>();
  const { openDetail, DetailOutlet } = useDetailOutlet();
  const [focus, setFocus] = useState<{ si: number; gi: number } | null>(null);

  // --- 座標系 ---
  // 「全体」はコンテナ幅フィットだが、注記・ラベルが衝突しない1.05px/年を下限に
  // する（承認済みモックと同じ密度。狭い画面では横スクロールになる）。
  const totalYears = river.b + 1 - river.a;
  const pxy =
    zoom === "fit"
      ? Math.max(1.05, (chartWidth - PAD_X * 2) / totalYears)
      : ZOOM_PX[zoom];
  const canvasW = Math.round(totalYears * pxy + PAD_X * 2);
  const x = (a: number) => PAD_X + (a - river.a) * pxy;
  const wd = (a: number, b: number) => (b + 1 - a) * pxy;

  // 展開クラスターのある行は「通常帯の段+展開領域」に広げる。通常帯は脊柱
  // (row 0)側に据え置き、展開領域は反対側に足す — 同じ段の他の帯(北魏など)と
  // 展開ボックスが重ならないようにするため。
  const rowsTop = CH_H + EV_H;
  const { rowY, rowsBot } = useMemo(() => {
    const rowY: number[] = [];
    let acc = rowsTop;
    for (let r = river.rowMin; r <= river.rowMax; r++) {
      let ext = 0;
      river.streams.forEach((s, si) => {
        if (s.kind === "cluster" && expandedSet.has(si) && s.spans[0].row === r)
          ext = Math.max(ext, (s.laneCount ?? 1) * MEMBER_LANE + 34);
      });
      rowY.push(r < 0 ? acc + ext + ROW_H / 2 : acc + ROW_H / 2);
      acc += ROW_H + ext;
    }
    return { rowY, rowsBot: acc };
  }, [river, expandedSet, rowsTop]);
  const yOf = (row: number) => rowY[row - river.rowMin];
  /** 展開ボックスの上端。北側の行は通常帯の上、それ以外は下に隣接させる。 */
  const expBoxTop = (stream: RiverStream): number => {
    const row = stream.spans[0].row;
    const boxH = (stream.laneCount ?? 1) * MEMBER_LANE + 30;
    return row < 0 ? yOf(row) - ROW_H / 2 - boxH - 2 : yOf(row) + ROW_H / 2 + 2;
  };
  const canvasH = rowsBot + AX_H + BC_H;
  const bcY = rowsBot + AX_H;

  // --- スクロール（tip消去＋ズーム時ラベルのクランプ。DOM直接操作のみ） ---
  const clampLabels = () => {
    const el = scrollRef.current;
    const svg = svgRef.current;
    if (!el || !svg) return;
    svg.querySelectorAll<SVGTextElement>("[data-clamp-min]").forEach((t) => {
      const min = Number(t.dataset.clampMin);
      const max = Number(t.dataset.clampMax);
      const tx = Math.min(Math.max(el.scrollLeft + 8, min), max);
      t.setAttribute("transform", `translate(${tx},0)`);
    });
  };
  const handleScroll = () => {
    cancelAnimationFrame(rafRef.current);
    if (suppressTipClearRef.current) {
      suppressTipClearRef.current = false;
      rafRef.current = requestAnimationFrame(clampLabels);
      return;
    }
    markScroll();
    rafRef.current = requestAnimationFrame(() => {
      setTip(null);
      clampLabels();
    });
  };

  // ズーム・開閉の切替時は画面中央（または指定年）を維持する
  const applyView = (next: Zoom, centerT?: number, nextExpanded?: readonly number[]) => {
    const el = scrollRef.current;
    if (centerT !== undefined) pendingCenterRef.current = centerT;
    else if (el)
      pendingCenterRef.current = river.a + (el.scrollLeft + el.clientWidth / 2 - PAD_X) / pxy;
    setTip(null);
    if (nextExpanded) setExpanded(nextExpanded);
    setZoom(next);
  };
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && pendingCenterRef.current !== null) {
      el.scrollLeft = (pendingCenterRef.current - river.a) * pxy + PAD_X - el.clientWidth / 2;
      pendingCenterRef.current = null;
    }
    clampLabels();
    // clampLabelsはレンダリング値を閉じ込めた安定でない関数のため依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, pxy, chartWidth, expanded]);

  const astroAtClientX = (clientX: number): number => {
    const el = scrollRef.current;
    if (!el) return river.a;
    const rect = el.getBoundingClientRect();
    return river.a + (clientX - rect.left + el.scrollLeft - PAD_X) / pxy;
  };

  // --- ホバー・クリック ---
  const handleStreamHover = (si: number, e: ReactMouseEvent) => {
    if (!hoverAllowed()) return;
    const s = river.streams[si];
    if (zoom === "fit" || s.kind === "cluster") {
      setTip({ kind: "stream", stream: s, x: e.clientX, y: e.clientY });
      return;
    }
    const seg = nearestSeg(s.segs, astroAtClientX(e.clientX));
    const record = recordById.get(seg.emperorId);
    if (record) setTip({ kind: "emperor", record, seg, x: e.clientX, y: e.clientY });
  };
  const toggleCluster = (si: number, t: number) => {
    setTip(null);
    applyView(
      zoom,
      t,
      expandedSet.has(si) ? expanded.filter((i) => i !== si) : [...expanded, si],
    );
  };
  const handleStreamClick = (si: number, e: ReactMouseEvent) => {
    const s = river.streams[si];
    const t = astroAtClientX(e.clientX);
    if (s.kind === "cluster") {
      toggleCluster(si, t);
      return;
    }
    if (zoom === "fit") {
      applyView("mid", t);
      return;
    }
    const record = recordById.get(nearestSeg(s.segs, t).emperorId);
    if (record) {
      setTip(null);
      openDetail(record);
    }
  };
  const handleMemberHover = (si: number, mi: number, e: ReactMouseEvent) => {
    if (!hoverAllowed()) return;
    const s = river.streams[si];
    setTip({ kind: "member", member: s.members![mi], stream: s, x: e.clientX, y: e.clientY });
  };

  // --- キーボード操作（左右=同じ段・上下=並立・Enter=拡大/詳細/開閉） ---
  // 操作単位: 非クラスター=在位セグメント・クラスター=帯全体（Enterで開閉）。
  const focusables = useMemo(() => {
    // 各ストリームの操作単位列。クラスターはスパン単位で1項目。
    return river.streams.map((s) =>
      s.kind === "cluster" ? s.spans.map((sp) => ({ a: sp.a, b: sp.b })) : s.segs,
    );
  }, [river]);
  const rowOfFocus = (si: number, gi: number): number =>
    spanAt(river.streams[si], focusables[si][gi].a).row;

  const focusItem = (si: number, gi: number) => {
    setFocus({ si, gi });
    const s = river.streams[si];
    const g = focusables[si][gi];
    const el = scrollRef.current;
    if (!el) return;
    const cx = x((g.a + g.b + 1) / 2);
    const margin = 60;
    let left = el.scrollLeft;
    if (cx - left < margin) left = Math.max(0, cx - margin);
    else if (cx - left > el.clientWidth - margin) left = cx - el.clientWidth + margin;
    // スクロール可能域にクランプしてから比較する(クランプ後に同値だとscrollイベントが
    // 発火せず、suppressTipClearRefが1回分残ってしまうため)
    left = Math.min(Math.max(0, left), el.scrollWidth - el.clientWidth);
    if (left !== el.scrollLeft) {
      suppressTipClearRef.current = true;
      el.scrollLeft = left;
    }
    const rect = el.getBoundingClientRect();
    const ty = rect.top + yOf(rowOfFocus(si, gi));
    if (s.kind === "cluster") {
      setTip({ kind: "stream", stream: s, x: rect.left + cx - left, y: ty });
    } else {
      const record = recordById.get((g as RiverSeg).emperorId);
      if (record)
        setTip({ kind: "emperor", record, seg: g as RiverSeg, x: rect.left + cx - left, y: ty });
    }
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      setFocus(null);
      setTip(null);
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " "].includes(e.key)) return;
    e.preventDefault();
    if (!focus) {
      // 初回は画面中央に最も近いrow 0（本流）の項目から始める
      const el = scrollRef.current;
      const t = el ? river.a + (el.scrollLeft + el.clientWidth / 2 - PAD_X) / pxy : river.a;
      let best: { si: number; gi: number; d: number } | null = null;
      river.streams.forEach((s, si) => {
        s.spans.forEach((sp) => {
          if (sp.row !== 0) return;
          const d = t < sp.a ? sp.a - t : t > sp.b ? t - sp.b : 0;
          if (!best || d < best.d) {
            const items = focusables[si];
            let gi = 0;
            let bd = Infinity;
            items.forEach((g, i) => {
              const gd = g.a <= t && t <= g.b + 1 ? 0 : Math.min(Math.abs(t - g.a), Math.abs(t - g.b));
              if (gd < bd) {
                bd = gd;
                gi = i;
              }
            });
            best = { si, gi, d };
          }
        });
      });
      if (best) focusItem((best as { si: number; gi: number }).si, (best as { si: number; gi: number }).gi);
      return;
    }
    const { si, gi } = focus;
    const s = river.streams[si];
    const g = focusables[si][gi];
    const t = (g.a + g.b + 1) / 2;
    if (e.key === "Enter" || e.key === " ") {
      if (s.kind === "cluster") toggleCluster(si, t);
      else if (zoom === "fit") applyView("mid", t);
      else {
        const record = recordById.get((g as RiverSeg).emperorId);
        if (record) {
          setTip(null);
          openDetail(record);
        }
      }
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const dir = e.key === "ArrowRight" ? 1 : -1;
      if (gi + dir >= 0 && gi + dir < focusables[si].length) {
        focusItem(si, gi + dir);
        return;
      }
      // 端では同じ段の前後のストリームへ（row 0なら本流を通しで辿れる）
      const row = rowOfFocus(si, gi);
      let bestSi = -1;
      let bestSpan: RiverSpan | null = null;
      let bestDist = Infinity;
      river.streams.forEach((s2, si2) => {
        if (si2 === si) return;
        s2.spans.forEach((sp) => {
          if (sp.row !== row) return;
          const d = dir === 1 ? sp.a - g.b : g.a - sp.b;
          if (d > 0 && d < bestDist) {
            bestDist = d;
            bestSi = si2;
            bestSpan = sp;
          }
        });
      });
      if (bestSi === -1 || !bestSpan) return;
      // 渡った先では見つけた同じ段のスパン内の端に着地する（清のように段を
      // またぐストリームで、いきなり別の段の端へ飛ばないように）
      const span = bestSpan as RiverSpan;
      const items = focusables[bestSi];
      let ngi = dir === 1 ? 0 : items.length - 1;
      if (dir === 1) {
        const idx = items.findIndex((it) => it.a >= span.a);
        if (idx !== -1) ngi = idx;
      } else {
        for (let i = items.length - 1; i >= 0; i--)
          if (items[i].a <= span.b) {
            ngi = i;
            break;
          }
      }
      focusItem(bestSi, ngi);
      return;
    }
    // 上下: 同時期に並立する最も近い段へ
    const dir = e.key === "ArrowDown" ? 1 : -1;
    const row = rowOfFocus(si, gi);
    let best2: { si: number; d: number } | null = null;
    river.streams.forEach((s2, si2) => {
      if (si2 === si) return;
      s2.spans.forEach((sp) => {
        const laneDist = (sp.row - row) * dir;
        if (laneDist <= 0) return;
        if (sp.a > t || sp.b + 1 < t) return;
        if (!best2 || laneDist < best2.d) best2 = { si: si2, d: laneDist };
      });
    });
    if (!best2) return;
    const targetSi = (best2 as { si: number }).si;
    const items = focusables[targetSi];
    let ngi = 0;
    let bd = Infinity;
    items.forEach((g2, i) => {
      const gd = g2.a <= t && t <= g2.b + 1 ? 0 : Math.min(Math.abs(t - g2.a), Math.abs(t - g2.b));
      if (gd < bd) {
        bd = gd;
        ngi = i;
      }
    });
    focusItem(targetSi, ngi);
  };
  const focusedRecord =
    focus && river.streams[focus.si].kind !== "cluster"
      ? recordById.get((focusables[focus.si][focus.gi] as RiverSeg).emperorId)
      : undefined;
  const focusedCluster = focus && river.streams[focus.si].kind === "cluster" ? river.streams[focus.si] : undefined;

  // --- 軸目盛 ---
  const gridStep = zoom === "fit" ? 100 : 50;
  const labelStep = zoom === "fit" ? 200 : 100;
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let y = -200; y < 2000; y += gridStep) {
      if (y === 0) continue;
      const a = y > 0 ? y : y + 1;
      if (a >= river.a && a <= river.b) out.push(y);
    }
    return out;
  }, [gridStep, river.a, river.b]);

  const jumpTo = (a: number) => {
    scrollRef.current?.scrollTo({ left: (a - river.a) * pxy + PAD_X - 60, behavior: "smooth" });
  };

  return (
    <div ref={chartAreaRef}>
      {/* ズーム切替と時代へのジャンプ */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">表示範囲</span>
        {(Object.keys(ZOOM_LABELS) as Zoom[]).map((z) => (
          <Button
            key={z}
            size="sm"
            variant={zoom === z ? "default" : "outline"}
            aria-pressed={zoom === z}
            onClick={() => applyView(z)}
          >
            {ZOOM_LABELS[z]}
          </Button>
        ))}
        <span className="ml-2 text-xs text-muted-foreground">時代へ移動</span>
        <span className="flex flex-wrap gap-1.5">
          {river.chapters
            .filter((c) => c.label)
            .map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => jumpTo(c.a)}
                className="rounded-full border border-border px-2.5 py-0.5 font-heading text-[11px] font-medium text-foreground/70 transition-colors hover:border-seal hover:text-seal"
              >
                {c.label}
              </button>
            ))}
        </span>
      </div>

      {/* 年表本体 */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setFocus(null);
          setTip(null);
        }}
        tabIndex={0}
        role="application"
        aria-label="通史年表。左右キーで同じ段の皇帝を時代順に移動、上下キーで同時期に並立する王朝へ移動、Enterで詳細の表示や群雄のまとまりの開閉ができます。同じ内容は下の「表で見る」でも参照できます。"
        className="overflow-x-auto overscroll-x-contain rounded border border-border bg-background focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span aria-live="polite" className="sr-only">
          {focusedRecord
            ? `${focusedRecord.name}（${dynastyContextLabel(focusedRecord)}）を選択中`
            : focusedCluster
              ? `${focusedCluster.label}（皇帝${focusedCluster.emperorCount}人のまとまり）を選択中`
              : ""}
        </span>
        <svg
          ref={svgRef}
          width={canvasW}
          height={canvasH}
          viewBox={`0 0 ${canvasW} ${canvasH}`}
          role="img"
          aria-label="前221年から1945年まで、皇帝の在位を王朝の流れとして時代順に示した図。上が北方、下が南方、中央が統一王朝の座。"
          className="block"
        >
          <defs>
            <pattern
              id="river-hatch"
              width="7"
              height="7"
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
            >
              <rect
                width="7"
                height="7"
                fill="color-mix(in srgb, var(--foreground) 9%, var(--background))"
              />
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="7"
                stroke="color-mix(in srgb, var(--foreground) 26%, var(--background))"
                strokeWidth="2.4"
              />
            </pattern>
            <pattern
              id="river-vacancy"
              width="8"
              height="8"
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
            >
              <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(58,53,48,0.13)" strokeWidth="2" />
            </pattern>
          </defs>

          {/* 章（時代）ゾーン */}
          {river.chapters.map((c, i) => {
            const cw = x(c.b) - x(c.a);
            return (
              <g key={`${c.a}`}>
                {i % 2 === 1 && (
                  <rect
                    x={x(c.a)}
                    y={CH_H}
                    width={cw}
                    height={rowsBot - CH_H}
                    fill="rgba(58,53,48,0.028)"
                  />
                )}
                <line
                  x1={x(c.a)}
                  y1={CH_H}
                  x2={x(c.a)}
                  y2={rowsBot}
                  stroke="rgba(58,53,48,0.14)"
                  strokeDasharray="1 3"
                />
                {c.label && (
                  <text
                    x={x(c.a) + cw / 2}
                    y={CH_H - 9}
                    textAnchor="middle"
                    fontSize={cw > 120 ? 15 : 11}
                    letterSpacing={cw > 200 ? 4 : 1}
                    className="fill-foreground font-heading font-semibold"
                  >
                    {c.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* 世紀グリッドと軸 */}
          {ticks.map((y) => {
            const a = y > 0 ? y : y + 1;
            const major = y % labelStep === 0;
            return (
              <g key={y}>
                <line
                  x1={x(a)}
                  y1={rowsTop}
                  x2={x(a)}
                  y2={rowsBot}
                  stroke={`rgba(58,53,48,${major ? 0.07 : 0.04})`}
                />
                {major && (
                  <text
                    x={x(a)}
                    y={rowsBot + 18}
                    textAnchor="middle"
                    fontSize={10}
                    className="fill-muted-foreground"
                  >
                    {fmtA(a)}
                  </text>
                )}
              </g>
            );
          })}
          <line
            x1={PAD_X}
            y1={rowsBot + 2}
            x2={canvasW - PAD_X}
            y2={rowsBot + 2}
            stroke="rgba(58,53,48,0.25)"
          />

          {/* 空位（全王朝共通の皇帝不在） */}
          {river.vacancies.map((v) => (
            <rect
              key={v.a}
              x={x(v.a)}
              y={rowsTop}
              width={Math.max(wd(v.a, v.b), 2)}
              height={rowsBot - rowsTop}
              fill="url(#river-vacancy)"
            />
          ))}

          {/* 画期フラグ */}
          {river.events.map((ev) => {
            const ty = CH_H + 16 + ev.level * 16;
            const atEnd = x(ev.a) > canvasW - 180;
            return (
              <g key={ev.a}>
                <line
                  x1={x(ev.a)}
                  y1={ty + 3}
                  x2={x(ev.a)}
                  y2={rowsBot}
                  stroke="color-mix(in srgb, var(--seal) 40%, var(--background))"
                />
                <text
                  x={x(ev.a) + (atEnd ? -3 : 3)}
                  y={ty}
                  textAnchor={atEnd ? "end" : "start"}
                  fontSize={10}
                  style={HALO}
                  fill="color-mix(in srgb, var(--seal) 80%, var(--background))"
                >
                  <tspan fontWeight={600}>{fmtA(ev.a)}</tspan> {ev.label}
                </text>
              </g>
            );
          })}

          {/* 継承・分岐・吸収エッジ（帯の下層） */}
          {river.edges.map((ed, i) => {
            const f = river.streams[ed.from];
            const t = river.streams[ed.to];
            const a1 = ed.year ?? t.a;
            const fsp = spanAt(f, a1 - 1);
            const tsp = spanAt(t, a1);
            const x1 = x(Math.max(a1, tsp.a));
            const x0 = Math.max(Math.min(x(fsp.b + 1), x1 - 6), x1 - 26);
            const yF = yOf(fsp.row);
            const yT = yOf(tsp.row);
            const hF = bandHeight(f, soleAt(f, fsp.b));
            const hT = bandHeight(t, soleAt(t, tsp.a));
            const fc = streamColors(f.colorSlot);
            const tc = streamColors(t.colorSlot);
            if (ed.kind === "dash")
              return (
                <line
                  key={i}
                  x1={x0}
                  y1={yF}
                  x2={x1}
                  y2={yT}
                  stroke={fc.edge}
                  strokeWidth={1.6}
                  strokeDasharray="4 3"
                />
              );
            if (fsp.row === tsp.row)
              return (
                <path
                  key={i}
                  d={`M${x0},${yF - hF / 2} L${x1},${yT - hT / 2} L${x1},${yT + hT / 2} L${x0},${yF + hF / 2} Z`}
                  fill={tc.fill}
                  opacity={0.85}
                />
              );
            const up = tsp.row < fsp.row;
            const ya = up ? yF - hF / 2 : yF + hF / 2;
            const yb = up ? yT + hT / 2 : yT - hT / 2;
            const m = (x0 + x1) / 2;
            const o = up ? 8 : -8;
            return (
              <path
                key={i}
                d={`M${x0},${ya} C${m},${ya} ${m},${yb} ${x1},${yb} L${x1},${yb + o} C${m},${yb + o} ${m},${ya + o} ${x0},${ya + o} Z`}
                fill={ed.kind === "merge" ? fc.fill : tc.fill}
                opacity={0.8}
              />
            );
          })}

          {/* ストリーム帯 */}
          {river.streams.map((s, si) =>
            s.kind === "cluster" && expandedSet.has(si) ? (
              <ExpandedCluster
                key={s.label}
                stream={s}
                si={si}
                x={x}
                wd={wd}
                yTop={expBoxTop(s)}
                zoom={zoom}
                onHover={handleMemberHover}
                onLeave={() => setTip(null)}
                onToggle={(t) => toggleCluster(si, t)}
              />
            ) : (
              <StreamBand
                key={s.label}
                stream={s}
                si={si}
                x={x}
                wd={wd}
                yOf={yOf}
                zoom={zoom}
                nameOf={(id) => recordById.get(id)?.name ?? ""}
                onHover={handleStreamHover}
                onLeave={() => setTip(null)}
                onClick={handleStreamClick}
              />
            ),
          )}

          {/* キーボードフォーカスリング */}
          {focus &&
            (() => {
              const s = river.streams[focus.si];
              const g = focusables[focus.si][focus.gi];
              const row = rowOfFocus(focus.si, focus.gi);
              const isExp = s.kind === "cluster" && expandedSet.has(focus.si);
              const h = isExp
                ? (s.laneCount ?? 1) * MEMBER_LANE + 30
                : bandHeight(s, s.kind !== "cluster" && soleAt(s, g.a));
              return (
                <rect
                  aria-hidden
                  x={x(g.a) - 2}
                  y={(isExp ? expBoxTop(s) + h / 2 : yOf(row)) - h / 2 - 3}
                  width={Math.max(4, wd(g.a, g.b)) + 4}
                  height={h + 6}
                  rx={3}
                  fill="none"
                  stroke="var(--seal)"
                  strokeWidth={2}
                  pointerEvents="none"
                />
              );
            })()}

          {/* 統一と分裂のバーコード */}
          <text x={PAD_X} y={bcY + 9} fontSize={10.5} fontWeight={600} className="fill-foreground">
            統一と分裂のリズム
          </text>
          <text x={PAD_X + 128} y={bcY + 9} fontSize={9.5} className="fill-muted-foreground">
            在位する皇帝がただ一つの王朝のみ＝統一（金）／複数王朝が並立＝分裂（灰）／皇帝不在（斜線）
          </text>
          {river.runs.map((r) => (
            <rect
              key={r.a}
              x={x(r.a)}
              y={bcY + 14}
              width={Math.max(wd(r.a, r.b), 1)}
              height={13}
              fill={
                r.state === "sole"
                  ? "color-mix(in srgb, var(--series-4) 78%, var(--background))"
                  : r.state === "split"
                    ? "color-mix(in srgb, var(--foreground) 18%, var(--background))"
                    : "url(#river-vacancy)"
              }
            />
          ))}
          <rect
            x={PAD_X}
            y={bcY + 14}
            width={canvasW - PAD_X * 2}
            height={13}
            fill="none"
            stroke="rgba(58,53,48,0.3)"
            strokeWidth={0.8}
          />
        </svg>
      </div>

      {/* 凡例 */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span className="mr-1 inline-block h-4 w-5 translate-y-1 rounded-[2px] border border-[color-mix(in_srgb,var(--series-4)_82%,var(--background))] bg-[color-mix(in_srgb,var(--series-4)_42%,var(--background))]" />
          太い帯＝天下に皇帝がその王朝ただ一つ（統一）
        </span>
        <span>
          <span className="mr-1 inline-block h-2.5 w-5 translate-y-0.5 rounded-[2px] border border-[color-mix(in_srgb,var(--series-4)_82%,var(--background))] bg-[color-mix(in_srgb,var(--series-4)_42%,var(--background))]" />
          並立期の王朝
        </span>
        <span>
          <span
            className="mr-1 inline-block h-3 w-5 translate-y-0.5 rounded-[2px] border border-border"
            style={{
              background:
                "repeating-linear-gradient(45deg, rgba(58,53,48,0.2) 0 2px, transparent 2px 6px)",
            }}
          />
          群雄のまとまり（クリックで開閉）
        </span>
        <span>
          <span className="mr-1 inline-block w-5 translate-y-[-3px] border-t border-dashed border-foreground/40" />
          中断・継承
        </span>
        <span>
          <span className="mr-1 inline-block h-3 w-1 translate-y-0.5 bg-seal" />
          復位による再即位（拡大・詳細）
        </span>
      </div>

      <TimelineTable timeline={timeline} recordById={recordById} openDetail={openDetail} />

      <TipOutlet
        render={(tip) => (
          <FixedTooltip x={tip.x} y={tip.y}>
            {tip.kind === "emperor" ? (
              <EmperorTooltip
                record={tip.record}
                valueLabel="在位"
                formattedValue={`${periodA(tip.seg.a, tip.seg.b)}（計${tip.record.reignDurationLabel}）`}
                details={[
                  { label: "即位経路", value: tip.record.accessionRouteCategory },
                  { label: "死因", value: tip.record.deathCauseCategory },
                  {
                    label: "没年齢",
                    value: tip.record.deathAge === null ? "不詳" : `${tip.record.deathAge}歳`,
                  },
                ]}
                hint="クリックで全項目を表示"
              />
            ) : tip.kind === "stream" ? (
              <div
                className="rounded-md border border-border bg-background p-3 text-xs text-foreground shadow-md"
                style={{ width: "max-content", maxWidth: 280 }}
              >
                <div className="font-medium">{tip.stream.label}</div>
                <div className="mt-0.5 text-muted-foreground">
                  {periodA(tip.stream.a, tip.stream.b)}
                  {tip.stream.kind === "cluster"
                    ? `・${tip.stream.members?.length}政権`
                    : tip.stream.sub
                      ? `・${tip.stream.sub}`
                      : ""}
                  ・皇帝{tip.stream.emperorCount}人
                </div>
                <div className="mt-1.5 text-[10px] text-muted-foreground/70">
                  {tip.stream.kind === "cluster"
                    ? "クリックで構成政権を開閉"
                    : "クリックでこの時代を拡大"}
                </div>
              </div>
            ) : (
              <div
                className="rounded-md border border-border bg-background p-3 text-xs text-foreground shadow-md"
                style={{ width: "max-content", maxWidth: 280 }}
              >
                <div className="font-medium">{tip.member.label}</div>
                <div className="mt-0.5 text-muted-foreground">
                  {periodA(tip.member.a, tip.member.b)}・皇帝{tip.member.emperorCount}人
                </div>
                <div className="mt-1">
                  {tip.member.segs.map((g) => (
                    <div key={`${g.emperorId}-${g.a}`}>
                      {recordById.get(g.emperorId)?.name ?? g.emperorId}（{periodA(g.a, g.b)}）
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 text-[10px] text-muted-foreground/70">クリックでたたむ</div>
              </div>
            )}
          </FixedTooltip>
        )}
      />
      <DetailOutlet />
    </div>
  );
}

/** ストリーム1本（スパン矩形＋唯一在位の太帯＋皇帝セグメント＋ラベル）。 */
function StreamBand({
  stream,
  si,
  x,
  wd,
  yOf,
  zoom,
  nameOf,
  onHover,
  onLeave,
  onClick,
}: {
  stream: RiverStream;
  si: number;
  x: (a: number) => number;
  wd: (a: number, b: number) => number;
  yOf: (row: number) => number;
  zoom: Zoom;
  nameOf: (id: string) => string;
  onHover: (si: number, e: ReactMouseEvent) => void;
  onLeave: () => void;
  onClick: (si: number, e: ReactMouseEvent) => void;
}) {
  const colors = streamColors(stream.colorSlot);
  const zoomed = zoom !== "fit";
  const parts: React.ReactNode[] = [];

  // 中断コネクタ / 段替わりの流路（清の入関・元の北走）
  for (let i = 0; i < stream.spans.length - 1; i++) {
    const s1 = stream.spans[i];
    const s2 = stream.spans[i + 1];
    const gap = x(s2.a) - x(s1.b + 1);
    if (s1.row !== s2.row && gap < 8) {
      const xa = x(s1.b + 1) - 4;
      const xb = x(s2.a) + 4;
      const m = (xa + xb) / 2;
      const h2 = H_MAJOR / 2;
      const y1 = yOf(s1.row);
      const y2 = yOf(s2.row);
      parts.push(
        <path
          key={`c${i}`}
          d={`M${xa},${y1 - h2} C${m},${y1 - h2} ${m},${y2 - h2} ${xb},${y2 - h2} L${xb},${y2 + h2} C${m},${y2 + h2} ${m},${y1 + h2} ${xa},${y1 + h2} Z`}
          fill={colors.fill}
          opacity={0.9}
        />,
      );
      continue;
    }
    if (gap < 2) continue;
    parts.push(
      <line
        key={`c${i}`}
        x1={x(s1.b + 1)}
        y1={yOf(s1.row)}
        x2={x(s2.a)}
        y2={yOf(s2.row)}
        stroke={colors.edge}
        strokeWidth={1.3}
        strokeDasharray="3 3"
      />,
    );
  }

  for (const sp of stream.spans) {
    const yC = yOf(sp.row);
    const hMax = Math.max(...sp.pieces.map((p) => bandHeight(stream, p.sole)));
    for (const p of sp.pieces) {
      const h = bandHeight(stream, p.sole);
      parts.push(
        <rect
          key={`p${p.a}`}
          x={x(p.a)}
          y={yC - h / 2}
          width={Math.max(wd(p.a, p.b), 1.6)}
          height={h}
          rx={2.5}
          fill={stream.kind === "cluster" ? "url(#river-hatch)" : colors.fill}
          stroke={colors.edge}
          strokeWidth={1.1}
        />,
      );
    }
    // 皇帝セグメント（拡大・詳細）: 区切り線・交互の濃淡・復位・名前。
    // スパン分割（清の入関等）をまたぐ在位はスパン境界でクランプして両側に描く。
    if (zoomed && stream.kind !== "cluster") {
      let i = 0;
      for (const g of stream.segs) {
        if (g.b < sp.a || g.a > sp.b) continue;
        const ga = Math.max(g.a, sp.a);
        const gb = Math.min(g.b, sp.b);
        const h = bandHeight(
          stream,
          sp.pieces.find((p) => p.a <= ga && ga <= p.b)?.sole ?? false,
        );
        const gw = wd(ga, gb);
        const name = zoom === "detail" ? nameOf(g.emperorId) : "";
        // 交互の濃淡は太さの境界(唯一在位⇄並立)で高さが変わるため、ピースとの
        // 交差ごとに帯の実高さへ合わせて分割して描く
        const shadeRects =
          i % 2 === 1
            ? sp.pieces.flatMap((p) => {
                const pa = Math.max(ga, p.a);
                const pb = Math.min(gb, p.b);
                if (pa > pb) return [];
                const ph = bandHeight(stream, p.sole);
                return [
                  <rect
                    key={`sh${pa}`}
                    x={x(pa)}
                    y={yC - ph / 2 + 1}
                    width={wd(pa, pb)}
                    height={ph - 2}
                    fill="rgba(58,53,48,0.055)"
                  />,
                ];
              })
            : [];
        parts.push(
          <g key={`s${g.emperorId}-${g.a}-${sp.a}`}>
            {shadeRects}
            {g.a > sp.a && (
              <line
                x1={x(g.a)}
                y1={yC - h / 2}
                x2={x(g.a)}
                y2={yC + h / 2}
                stroke={g.isRestoration ? "var(--seal)" : colors.edge}
                strokeWidth={g.isRestoration ? 2 : 1}
              />
            )}
            {name !== "" &&
              gw >= name.length * 10.5 + 8 &&
              // 長い在位はスクロールに追従してセグメント内へクランプする
              // (ストリームラベルと同じdata-clamp機構)
              (gw > name.length * 10.5 + 48 ? (
                <text
                  data-clamp-min={x(ga) + 4}
                  data-clamp-max={x(ga) + gw - name.length * 10.5 - 8}
                  transform={`translate(${x(ga) + 4},0)`}
                  y={yC + 3.5}
                  fontSize={10}
                  style={HALO}
                  className="fill-foreground/90"
                  pointerEvents="none"
                >
                  {name}
                </text>
              ) : (
                <text
                  x={x(ga) + 4}
                  y={yC + 3.5}
                  fontSize={10}
                  style={HALO}
                  className="fill-foreground/90"
                  pointerEvents="none"
                >
                  {name}
                </text>
              ))}
          </g>,
        );
        i++;
      }
    }
    // 五代の内部区分
    stream.subdivs?.forEach((v) => {
      if (v.a > sp.a && v.a <= sp.b)
        parts.push(
          <line
            key={`d${v.a}`}
            x1={x(v.a)}
            y1={yC - H_MAJOR / 2 - 3}
            x2={x(v.a)}
            y2={yC + H_MAJOR / 2 + 3}
            stroke="var(--background)"
            strokeWidth={2}
          />,
        );
      if (zoomed && v.a >= sp.a && v.a <= sp.b)
        parts.push(
          <text
            key={`dl${v.a}`}
            x={x(v.a) + wd(v.a, v.b) / 2}
            y={yC - H_MAJOR / 2 - 6}
            textAnchor="middle"
            fontSize={10.5}
            style={HALO}
            className="fill-foreground font-heading font-semibold"
            pointerEvents="none"
          >
            {v.label}
          </text>,
        );
    });
    // 当たり判定（帯の高さ+余白で受け、最近傍セグメントへスナップ）
    parts.push(
      <rect
        key={`h${sp.a}`}
        x={x(sp.a)}
        y={yC - hMax / 2 - 3}
        width={Math.max(wd(sp.a, sp.b), 4)}
        height={hMax + 6}
        fill="transparent"
        className="cursor-pointer"
        onMouseMove={(e) => onHover(si, e)}
        onMouseLeave={onLeave}
        onClick={(e) => onClick(si, e)}
      />,
    );
  }

  // ラベル: 全体=最長スパン中央（幅が足りるとき）・拡大/詳細=スパン左端に
  // クランプ表示（スクロール追従はdata-clamp属性を親がrAFで更新）
  const pre = stream.kind === "cluster" ? "▸ " : "";
  const fs = stream.kind === "major" ? 15 : 11;
  if (zoomed) {
    for (const sp of stream.spans) {
      const h = bandHeight(stream, soleAt(stream, sp.a));
      const min = x(sp.a) + 4;
      const max = Math.max(min, x(sp.a) + wd(sp.a, sp.b) - stream.label.length * fs - 8);
      parts.push(
        <text
          key={`l${sp.a}`}
          data-clamp-min={min}
          data-clamp-max={max}
          transform={`translate(${min},0)`}
          y={yOf(sp.row) - h / 2 - 5}
          fontSize={fs}
          style={HALO}
          className="fill-foreground font-heading font-semibold"
          pointerEvents="none"
        >
          {pre + stream.label}
        </text>,
      );
    }
  } else {
    let big = stream.spans[0];
    for (const sp of stream.spans) if (sp.b - sp.a > big.b - big.a) big = sp;
    const yC = yOf(big.row);
    const ww = wd(big.a, big.b);
    const cx = x(big.a) + ww / 2;
    const inw = stream.label.length * fs * 1.08 + 6;
    const hMax = Math.max(...big.pieces.map((p) => bandHeight(stream, p.sole)));
    const labelCommon = {
      textAnchor: "middle" as const,
      style: HALO,
      className: "fill-foreground font-heading font-semibold",
      pointerEvents: "none" as const,
    };
    if (stream.labelPos === "in" && ww >= inw) {
      // 補足行の人数は必ずemperorCountから導出する(手書きはズレる。自己レビューで
      // 唐21↔実24人・五代13↔実14人の不一致を検出した教訓)
      if (stream.kind === "major" && ww >= inw + 64) {
        parts.push(
          <text key="l" x={cx} y={yC - 2} fontSize={fs} {...labelCommon}>
            {pre + stream.label}
          </text>,
          <text
            key="l2"
            x={cx}
            y={yC + 13}
            fontSize={9}
            textAnchor="middle"
            style={HALO}
            className="fill-foreground/70"
            pointerEvents="none"
          >
            {fmtA(stream.a)}–{fmtA(stream.b)}
            {stream.sub ? `・${stream.sub}` : ""}・皇帝{stream.emperorCount}人
          </text>,
        );
      } else {
        parts.push(
          <text key="l" x={cx} y={yC + fs * 0.36} fontSize={fs} {...labelCommon}>
            {pre + stream.label}
          </text>,
        );
      }
    } else if (stream.labelPos === "below") {
      parts.push(
        <text key="l" x={cx} y={yC + hMax / 2 + 12} fontSize={10.5} {...labelCommon}>
          {pre + stream.label}
        </text>,
      );
    } else {
      parts.push(
        <text key="l" x={cx} y={yC - hMax / 2 - 5} fontSize={10.5} {...labelCommon}>
          {pre + stream.label}
        </text>,
      );
    }
  }

  return <g>{parts}</g>;
}

/** 展開されたクラスター（構成政権のミニレーン表示）。 */
function ExpandedCluster({
  stream,
  si,
  x,
  wd,
  yTop,
  zoom,
  onHover,
  onLeave,
  onToggle,
}: {
  stream: RiverStream;
  si: number;
  x: (a: number) => number;
  wd: (a: number, b: number) => number;
  yTop: number;
  zoom: Zoom;
  onHover: (si: number, mi: number, e: ReactMouseEvent) => void;
  onLeave: () => void;
  onToggle: (t: number) => void;
}) {
  const zoomed = zoom !== "fit";
  const x0 = x(stream.a) - 6;
  const x1 = x(stream.b) + wd(stream.b, stream.b) + 6;
  const height = (stream.laneCount ?? 1) * MEMBER_LANE + 30;
  const gray = streamColors(0);
  const mid = (stream.a + stream.b + 1) / 2;
  return (
    <g>
      <rect
        x={x0}
        y={yTop}
        width={x1 - x0}
        height={height}
        rx={4}
        fill="rgba(58,53,48,0.03)"
        stroke="rgba(58,53,48,0.25)"
        strokeDasharray="3 3"
        className="cursor-pointer"
        onClick={() => onToggle(mid)}
      />
      <text
        x={x0 + 5}
        y={yTop + 13}
        fontSize={10.5}
        style={HALO}
        className="fill-foreground font-heading font-semibold"
        pointerEvents="none"
      >
        ▾ {stream.label}（皇帝{stream.emperorCount}人・たたむ）
      </text>
      {stream.members!.map((m, mi) => {
        const yC = yTop + 22 + m.lane * MEMBER_LANE + MEMBER_LANE / 2;
        const ww = wd(m.a, m.b);
        return (
          <g key={m.label + m.a}>
            {m.spans.map((sp, i) =>
              i < m.spans.length - 1 ? (
                <line
                  key={`c${i}`}
                  x1={x(m.spans[i].b + 1)}
                  y1={yC}
                  x2={x(m.spans[i + 1].a)}
                  y2={yC}
                  stroke={gray.edge}
                  strokeDasharray="3 3"
                />
              ) : null,
            )}
            {m.spans.map((sp) => (
              <rect
                key={sp.a}
                x={x(sp.a)}
                y={yC - 5.5}
                width={Math.max(wd(sp.a, sp.b), 1.6)}
                height={11}
                rx={2}
                fill="url(#river-hatch)"
                stroke={gray.edge}
                strokeWidth={1}
              />
            ))}
            {zoomed &&
              m.segs.map((g) =>
                g.a > m.spans[0].a ? (
                  <line
                    key={`${g.emperorId}-${g.a}`}
                    x1={x(g.a)}
                    y1={yC - 5.5}
                    x2={x(g.a)}
                    y2={yC + 5.5}
                    stroke={g.isRestoration ? "var(--seal)" : gray.edge}
                    strokeWidth={g.isRestoration ? 2 : 1}
                  />
                ) : null,
              )}
            {ww >= m.label.length * 10 + 6 ? (
              <text
                x={x(m.a) + ww / 2}
                y={yC + 3.5}
                textAnchor="middle"
                fontSize={9.5}
                style={HALO}
                className="fill-foreground font-heading font-semibold"
                pointerEvents="none"
              >
                {m.label}
              </text>
            ) : (
              <text
                x={x(m.b) + wd(m.b, m.b) + 3}
                y={yC + 3.5}
                fontSize={9.5}
                style={HALO}
                className="fill-foreground font-heading"
                pointerEvents="none"
              >
                {m.label}
              </text>
            )}
            <rect
              x={x(m.a)}
              y={yC - 7.5}
              width={Math.max(ww, 4)}
              height={15}
              fill="transparent"
              className="cursor-pointer"
              onMouseMove={(e) => onHover(si, mi, e)}
              onMouseLeave={onLeave}
              onClick={() => onToggle(mid)}
            />
          </g>
        );
      })}
    </g>
  );
}
