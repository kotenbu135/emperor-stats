"use client";

// 通史年表本体（設計: docs/site-design/TIMELINE.md）。
// - 描画はNivoでなくdiv絶対配置の自前実装（ガント型チャートはNivoに無い）。
//   総DOMノード数は帯87+セグメント365程度と小さいため、ランキングチャートの
//   ような行ウィンドウイングは不要（スクロールはネイティブのみで再レンダリングゼロ）。
// - ホバー・ダイアログの状態はチャート本体に持たない（useTipOutlet/useDetailOutlet）。
// - ツールチップ・ミニマップ窓の位置更新はtransform（top/left書き換えはCLSに計上される）。
// - 当たり判定は帯全体で受け、x座標から最近傍の在位セグメントへスナップする
//   （在位1年未満の皇帝65名はセグメント幅がほぼ0でも選べる。RowOverlayと同じ発想）。

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
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
import {
  astroYear,
  formatYear,
  type DynastyCategory,
  type EmperorRecord,
  type TimelineData,
  type TimelineDynastyBand,
  type TimelineSegment,
} from "@/lib/emperor-types";

// --- レイアウト定数 ---
const ERA_ROW_H = 20;
const AXIS_H = 22;
const LANE_H = 32;
const PAD_X = 12;
// 正統王朝ブロックと並立・反乱政権ブロックの間の隙間。
const GROUP_GAP = 10;
const BAND_H: Record<DynastyCategory, number> = {
  正統: 22,
  十六国: 12,
  "正統（反乱・自称）": 12,
};

type Zoom = "fit" | "mid" | "detail";
const ZOOM_PX: Record<Exclude<Zoom, "fit">, number> = { mid: 2, detail: 8 };
const ZOOM_LABELS: Record<Zoom, string> = {
  fit: "全体",
  mid: "拡大",
  detail: "詳細",
};

type TimelineTip =
  | {
      kind: "emperor";
      record: EmperorRecord;
      segment: TimelineSegment;
      x: number;
      y: number;
    }
  | { kind: "dynasty"; band: TimelineDynastyBand; x: number; y: number };

/** スクロール直後150msのホバー抑制（useWindowedRowsのhoverAllowedと同じ）。 */
function useHoverGate(): { markScroll: () => void; hoverAllowed: () => boolean } {
  const lastScrollAtRef = useRef(-Infinity);
  const markScroll = () => {
    lastScrollAtRef.current = performance.now();
  };
  const hoverAllowed = () =>
    performance.now() - lastScrollAtRef.current > 150;
  return { markScroll, hoverAllowed };
}

function periodLabel(startYear: number, endYear: number): string {
  return startYear === endYear
    ? `${formatYear(startYear)}年`
    : `${formatYear(startYear)}–${formatYear(endYear)}年`;
}

/** x座標由来の年（astro座標）に最も近い在位セグメントを返す。 */
function nearestSegment(segments: TimelineSegment[], t: number): TimelineSegment {
  // startYear昇順ソート済み。tを含むか、境界距離が最小のものを選ぶ。
  let lo = 0;
  let hi = segments.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (astroYear(segments[mid].startYear) <= t) lo = mid;
    else hi = mid - 1;
  }
  const cur = segments[lo];
  if (t <= astroYear(cur.endYear) + 1) return cur;
  const next = segments[lo + 1];
  if (!next) return cur;
  const distCur = t - (astroYear(cur.endYear) + 1);
  const distNext = astroYear(next.startYear) - t;
  return distNext < distCur ? next : cur;
}

/** 王朝帯の色（--series-N を宣紙色に混ぜた淡彩。水墨に淡い彩を差す配色）。 */
function bandColors(band: TimelineDynastyBand): {
  fill: string;
  edge: string;
  strong: string;
} {
  const color = `var(--series-${band.colorSlot})`;
  const tint = (p: number) =>
    `color-mix(in srgb, ${color} ${p}%, var(--background))`;
  return band.category === "正統"
    ? { fill: tint(40), edge: tint(78), strong: tint(95) }
    : { fill: tint(22), edge: tint(52), strong: tint(75) };
}

export function TimelineExplorer({
  timeline,
  records,
}: {
  timeline: TimelineData;
  records: EmperorRecord[];
}) {
  const recordById = useMemo(
    () => new Map(records.map((r) => [r.id, r])),
    [records],
  );
  const [zoom, setZoom] = useState<Zoom>("fit");
  const { chartAreaRef, chartWidth } = useChartWidth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const miniRef = useRef<HTMLDivElement>(null);
  const miniWindowRef = useRef<HTMLDivElement>(null);
  const pendingCenterRef = useRef<number | null>(null);
  // キーボードフォーカス中のセグメント（bands/segments配列のインデックスで保持し、
  // 描画座標はズームごとに再計算する）。
  const [focus, setFocus] = useState<{ bandIdx: number; segIdx: number } | null>(
    null,
  );
  // キーボード操作に伴うプログラムスクロールでは、直後のscrollイベントで
  // ツールチップを消さない（1回分だけ抑制するフラグ）。
  const suppressTipClearRef = useRef(false);
  const { markScroll, hoverAllowed } = useHoverGate();
  const rafRef = useRef(0);
  const { setTip, TipOutlet } = useTipOutlet<TimelineTip>();
  const { openDetail, DetailOutlet } = useDetailOutlet();

  // --- 座標系 ---
  const t0 = astroYear(timeline.startYear);
  const totalYears = astroYear(timeline.endYear) + 1 - t0;
  const pxy =
    zoom === "fit"
      ? Math.max(0.05, (chartWidth - PAD_X * 2) / totalYears)
      : ZOOM_PX[zoom];
  const canvasW = Math.round(totalYears * pxy + PAD_X * 2);
  const xOf = (year: number) => PAD_X + (astroYear(year) - t0) * pxy;
  const widthOf = (startYear: number, endYear: number) =>
    (astroYear(endYear) + 1 - astroYear(startYear)) * pxy;

  const eraStripH = timeline.eraLaneCount * ERA_ROW_H;
  const lanesTop = eraStripH + AXIS_H;
  const lanesH = timeline.laneCount * LANE_H + GROUP_GAP;
  const canvasH = lanesTop + lanesH + 6;
  const laneTopOf = (lane: number) =>
    lanesTop + lane * LANE_H + (lane >= timeline.mainLaneCount ? GROUP_GAP : 0);

  // --- ミニマップ窓の同期（スクロールごとの更新はDOM直接操作。React stateにしない） ---
  const syncMiniWindow = () => {
    const el = scrollRef.current;
    const mini = miniRef.current;
    const win = miniWindowRef.current;
    if (!el || !mini || !win) return;
    const mw = mini.clientWidth;
    const left = (el.scrollLeft / canvasW) * mw;
    const width = Math.min(mw, (el.clientWidth / canvasW) * mw);
    win.style.transform = `translateX(${left}px)`;
    win.style.width = `${width}px`;
    // 全体ズーム（窓＝全幅）のときは表示しても意味がないので隠す。
    win.style.opacity = width >= mw - 1 ? "0" : "1";
  };

  const handleScroll = () => {
    if (suppressTipClearRef.current) {
      suppressTipClearRef.current = false;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(syncMiniWindow);
      return;
    }
    markScroll();
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setTip(null);
      syncMiniWindow();
    });
  };
  // ズーム切替時は切替前の画面中央の年を維持する。スクロール位置・ミニマップ窓の
  // 反映はDOM直接操作のみ（setStateしない）。pendingCenterRefは絶対astro年で持つ
  // （帯クリック時のastroAtClientXと同じ座標系。オフセットと混在させない）。
  const applyZoom = (next: Zoom, centerT?: number) => {
    const el = scrollRef.current;
    if (centerT !== undefined) {
      pendingCenterRef.current = centerT;
    } else if (el) {
      pendingCenterRef.current =
        t0 + (el.scrollLeft + el.clientWidth / 2 - PAD_X) / pxy;
    }
    setTip(null);
    setZoom(next);
  };
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && pendingCenterRef.current !== null) {
      el.scrollLeft =
        (pendingCenterRef.current - t0) * pxy + PAD_X - el.clientWidth / 2;
      pendingCenterRef.current = null;
    }
    syncMiniWindow();
    // syncMiniWindowはレンダリング値（canvasW）を閉じ込めた安定でない関数のため
    // 依存に含めない（canvasWはpxy・chartWidthから決まる）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, pxy, chartWidth]);

  // --- ヒット判定（帯のどこでも最近傍の皇帝にスナップ） ---
  const astroAtClientX = (clientX: number): number => {
    const el = scrollRef.current;
    if (!el) return t0;
    const rect = el.getBoundingClientRect();
    return t0 + (clientX - rect.left + el.scrollLeft - PAD_X) / pxy;
  };
  const handleBandHover = (
    band: TimelineDynastyBand,
    e: ReactMouseEvent<HTMLDivElement>,
  ) => {
    if (!hoverAllowed()) return;
    if (zoom === "fit") {
      // 全体ズームではセグメントを描いていないため、王朝サマリーを出す。
      setTip({ kind: "dynasty", band, x: e.clientX, y: e.clientY });
      return;
    }
    const segment = nearestSegment(band.segments, astroAtClientX(e.clientX));
    const record = recordById.get(segment.emperorId);
    if (record) {
      setTip({ kind: "emperor", record, segment, x: e.clientX, y: e.clientY });
    }
  };
  const handleBandClick = (
    band: TimelineDynastyBand,
    e: ReactMouseEvent<HTMLDivElement>,
  ) => {
    const t = astroAtClientX(e.clientX);
    if (zoom === "fit") {
      // 全体ズームのクリックはその地点へ拡大（初学者の導線: 全体→時代→皇帝）。
      applyZoom("mid", t);
      return;
    }
    const segment = nearestSegment(band.segments, t);
    const record = recordById.get(segment.emperorId);
    if (record) {
      setTip(null);
      openDetail(record);
    }
  };

  // --- キーボード操作（左右: 同じ段の皇帝を順に移動・上下: 並立王朝へ・Enter: 詳細） ---
  const laneBandIdxs = useMemo(() => {
    // レーンごとの帯インデックス。bandsは開始年順ソート済みなので各レーン内も時代順。
    const m = new Map<number, number[]>();
    timeline.bands.forEach((b, i) => {
      const arr = m.get(b.lane) ?? [];
      arr.push(i);
      m.set(b.lane, arr);
    });
    return m;
  }, [timeline.bands]);
  const segMid = (seg: TimelineSegment) =>
    (astroYear(seg.startYear) + astroYear(seg.endYear) + 1) / 2;

  /** フォーカスを移し、画面内へスクロールし、ツールチップを添える。 */
  const focusSegment = (bandIdx: number, segIdx: number) => {
    setFocus({ bandIdx, segIdx });
    const band = timeline.bands[bandIdx];
    const seg = band.segments[segIdx];
    const el = scrollRef.current;
    if (!el) return;
    const x = PAD_X + (segMid(seg) - t0) * pxy;
    const margin = 60;
    let left = el.scrollLeft;
    if (x - left < margin) left = Math.max(0, x - margin);
    else if (x - left > el.clientWidth - margin)
      left = x - el.clientWidth + margin;
    if (left !== el.scrollLeft) {
      suppressTipClearRef.current = true;
      el.scrollLeft = left;
    }
    const record = recordById.get(seg.emperorId);
    if (record) {
      const rect = el.getBoundingClientRect();
      setTip({
        kind: "emperor",
        record,
        segment: seg,
        x: rect.left + x - left,
        y: rect.top + laneTopOf(band.lane) + LANE_H / 2,
      });
    }
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      setFocus(null);
      setTip(null);
      return;
    }
    const handled = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " "];
    if (!handled.includes(e.key)) return;
    e.preventDefault();
    if (!focus) {
      // 初回は画面中央に最も近い最上段レーン（本流）の皇帝から始める。
      const el = scrollRef.current;
      const centerT = el
        ? t0 + (el.scrollLeft + el.clientWidth / 2 - PAD_X) / pxy
        : t0;
      let bandIdx = 0;
      let best = Infinity;
      for (const i of laneBandIdxs.get(0) ?? [0]) {
        const b = timeline.bands[i];
        const d =
          centerT < astroYear(b.startYear)
            ? astroYear(b.startYear) - centerT
            : centerT > astroYear(b.endYear)
              ? centerT - astroYear(b.endYear)
              : 0;
        if (d < best) {
          best = d;
          bandIdx = i;
        }
      }
      const band = timeline.bands[bandIdx];
      const seg = nearestSegment(band.segments, centerT);
      focusSegment(bandIdx, band.segments.indexOf(seg));
      return;
    }
    const { bandIdx, segIdx } = focus;
    const band = timeline.bands[bandIdx];
    const seg = band.segments[segIdx];
    if (e.key === "Enter" || e.key === " ") {
      if (zoom === "fit") {
        // 帯クリックと同じ導線: 全体ズームではその地点へ拡大する。
        applyZoom("mid", segMid(seg));
      } else {
        const record = recordById.get(seg.emperorId);
        if (record) {
          setTip(null);
          openDetail(record);
        }
      }
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const dir = e.key === "ArrowRight" ? 1 : -1;
      if (segIdx + dir >= 0 && segIdx + dir < band.segments.length) {
        focusSegment(bandIdx, segIdx + dir);
        return;
      }
      // 帯の端では同じレーンの前後の帯へ渡る（lane 0なら本流を通しで辿れる）。
      const laneIdxs = laneBandIdxs.get(band.lane)!;
      const nextBandIdx = laneIdxs[laneIdxs.indexOf(bandIdx) + dir];
      if (nextBandIdx === undefined) return;
      const nextBand = timeline.bands[nextBandIdx];
      focusSegment(nextBandIdx, dir === 1 ? 0 : nextBand.segments.length - 1);
      return;
    }
    // 上下: 現在のセグメントと同時期に並立している、最も近いレーンの王朝へ移る。
    // 同時期に重なる帯がその方向に無ければ何もしない（遠くの時代へ飛ばない）。
    const dir = e.key === "ArrowDown" ? 1 : -1;
    const t = segMid(seg);
    let targetIdx = -1;
    let bestLaneDist = Infinity;
    timeline.bands.forEach((b, i) => {
      const laneDist = (b.lane - band.lane) * dir;
      if (laneDist <= 0) return;
      if (astroYear(b.startYear) > t || astroYear(b.endYear) + 1 < t) return;
      if (laneDist < bestLaneDist) {
        bestLaneDist = laneDist;
        targetIdx = i;
      }
    });
    if (targetIdx === -1) return;
    const targetBand = timeline.bands[targetIdx];
    const targetSeg = nearestSegment(targetBand.segments, t);
    focusSegment(targetIdx, targetBand.segments.indexOf(targetSeg));
  };
  const focusedRecord = focus
    ? recordById.get(
        timeline.bands[focus.bandIdx].segments[focus.segIdx].emperorId,
      )
    : undefined;

  // --- ミニマップ操作（クリック/ドラッグでジャンプ） ---
  const scrollToMiniX = (clientX: number) => {
    const el = scrollRef.current;
    const mini = miniRef.current;
    if (!el || !mini) return;
    const rect = mini.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    el.scrollLeft = frac * canvasW - el.clientWidth / 2;
  };
  const handleMiniPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    scrollToMiniX(e.clientX);
  };
  const handleMiniPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.buttons & 1) scrollToMiniX(e.clientX);
  };

  // --- 軸目盛（ラベル同士が重ならない最小の刻みを選ぶ。スマホの全体ズーム対策） ---
  const tickStep =
    [10, 50, 100, 250, 500].find((step) => step * pxy >= 36) ?? 500;
  const ticks = useMemo(() => {
    const result: number[] = [];
    for (
      let y = Math.ceil(timeline.startYear / tickStep) * tickStep;
      y <= timeline.endYear;
      y += tickStep
    ) {
      if (y !== 0) result.push(y); // 0年は暦に存在しない
    }
    return result;
  }, [tickStep, timeline.startYear, timeline.endYear]);

  // --- ミニマップの並立数カーブ（1ユニット=1年のステップ面グラフ） ---
  const concurrencyPath = useMemo(() => {
    const maxC = timeline.maxConcurrency;
    const n = timeline.concurrency.length;
    const parts: string[] = [`M0,${maxC}`];
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const v = timeline.concurrency[i];
      if (v !== prev) {
        parts.push(`L${i},${maxC - prev}`, `L${i},${maxC - v}`);
        prev = v;
      }
    }
    parts.push(`L${n},${maxC - prev}`, `L${n},${maxC}`, "Z");
    return parts.join("");
  }, [timeline.concurrency, timeline.maxConcurrency]);

  const miniFrac = (year: number) =>
    `${(((astroYear(year) - t0) / totalYears) * 100).toFixed(3)}%`;
  const miniFracW = (startYear: number, endYear: number) =>
    `${(((astroYear(endYear) + 1 - astroYear(startYear)) / totalYears) * 100).toFixed(3)}%`;

  return (
    <div ref={chartAreaRef}>
      {/* ズーム切替 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">表示範囲</span>
        {(Object.keys(ZOOM_LABELS) as Zoom[]).map((z) => (
          <Button
            key={z}
            size="sm"
            variant={zoom === z ? "default" : "outline"}
            aria-pressed={zoom === z}
            onClick={() => applyZoom(z)}
          >
            {ZOOM_LABELS[z]}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground">
          ミニマップのドラッグで移動・帯のクリックで
          {zoom === "fit" ? "拡大" : "皇帝の詳細"}
          ・矢印キーでも操作できます
        </span>
      </div>

      {/* ミニマップ（全期間+並立数カーブ+表示窓） */}
      <div
        ref={miniRef}
        aria-hidden
        className="relative mb-2 h-14 cursor-grab touch-none select-none overflow-hidden rounded border border-border bg-secondary/40 active:cursor-grabbing"
        onPointerDown={handleMiniPointerDown}
        onPointerMove={handleMiniPointerMove}
      >
        {timeline.eras.map((era, i) => {
          return (
            <div
              key={era.label}
              className={`absolute overflow-hidden whitespace-nowrap border-l border-background/70 px-0.5 text-[9px] leading-[12px] text-muted-foreground ${i % 2 === 0 ? "bg-primary/10" : "bg-primary/20"}`}
              style={{
                left: miniFrac(era.startYear),
                width: miniFracW(era.startYear, era.endYear),
                top: era.lane * 12,
                height: 12,
              }}
            >
              {era.shortLabel}
            </div>
          );
        })}
        <svg
          className="absolute inset-x-0 bottom-0"
          width="100%"
          height={18}
          viewBox={`0 0 ${timeline.concurrency.length} ${timeline.maxConcurrency}`}
          preserveAspectRatio="none"
        >
          <path d={concurrencyPath} fill="rgba(58,53,48,0.22)" />
        </svg>
        <span className="absolute bottom-0 left-1 text-[9px] leading-[14px] text-muted-foreground/80">
          同時在位数（最大{timeline.maxConcurrency}人）
        </span>
        <div
          ref={miniWindowRef}
          className="pointer-events-none absolute inset-y-0 left-0 rounded-sm border-2 border-seal/70 bg-seal/10"
          style={{ width: 60 }}
        />
      </div>

      {/* 年表本体（フォーカス可能。矢印キー・Enterのカスタム操作を持つためapplication） */}
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
        aria-label="通史年表。左右キーで同じ段の皇帝を時代順に移動、上下キーで同時期に並立する王朝へ移動、Enterで詳細を表示します。同じ内容は下の「表で見る」でも参照できます。"
        className="overflow-x-auto overscroll-x-contain rounded border border-border bg-background focus-visible:outline-2 focus-visible:outline-ring"
      >
        {/* キーボード選択中の皇帝の読み上げ */}
        <span aria-live="polite" className="sr-only">
          {focusedRecord
            ? `${focusedRecord.name}（${dynastyContextLabel(focusedRecord)}）を選択中`
            : ""}
        </span>
        <div
          role="img"
          aria-label="前221年から1945年まで、皇帝の在位を王朝ごとの帯として時代順に示した図。"
          className="relative"
          style={{ width: canvasW, height: canvasH }}
        >
          {/* 時代帯 */}
          {timeline.eras.map((era, i) => {
            const w = widthOf(era.startYear, era.endYear);
            const label =
              w >= era.label.length * 12 + 8
                ? era.label
                : w >= era.shortLabel.length * 12 + 6
                  ? era.shortLabel
                  : "";
            return (
              <div
                key={era.label}
                title={`${era.label}（${periodLabel(era.startYear, era.endYear)}）`}
                className={`absolute overflow-hidden whitespace-nowrap border-l border-background px-1 text-center font-heading text-[11px] leading-[20px] text-foreground/80 ${i % 2 === 0 ? "bg-secondary/50" : "bg-secondary"}`}
                style={{
                  left: xOf(era.startYear),
                  width: w,
                  top: era.lane * ERA_ROW_H,
                  height: ERA_ROW_H,
                }}
              >
                {label}
              </div>
            );
          })}

          {/* 軸目盛とグリッド線 */}
          {ticks.map((year) => (
            <div key={year}>
              <span
                className="absolute -translate-x-1/2 text-[10px] text-muted-foreground"
                style={{ left: xOf(year), top: eraStripH + 4 }}
              >
                {formatYear(year)}
              </span>
              <div
                className="absolute w-px bg-border/60"
                style={{ left: xOf(year), top: lanesTop, height: lanesH }}
              />
            </div>
          ))}

          {/* 空位期間（全王朝共通の皇帝不在。斜線ハッチ） */}
          {timeline.vacancies.map((v) => {
            const w = Math.max(3, widthOf(v.startYear, v.endYear));
            return (
              <div
                key={v.startYear}
                className="absolute"
                style={{
                  left: xOf(v.startYear),
                  width: w,
                  top: lanesTop,
                  height: lanesH,
                  background:
                    "repeating-linear-gradient(45deg, rgba(58,53,48,0.14) 0 2px, transparent 2px 7px)",
                }}
              >
                {w >= 18 && (
                  <span className="absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground [writing-mode:vertical-rl]">
                    皇帝不在：{v.label}
                  </span>
                )}
              </div>
            );
          })}

          {/* 正統王朝ブロックと並立・反乱政権ブロックの区切り */}
          <div
            aria-hidden
            className="absolute inset-x-0 border-t border-dashed border-border"
            style={{ top: laneTopOf(timeline.mainLaneCount) - GROUP_GAP / 2 - 5 }}
          />

          {/* 王朝帯 */}
          {timeline.bands.map((band) => (
            <BandView
              key={band.key}
              band={band}
              left={xOf(band.startYear)}
              pxy={pxy}
              top={
                laneTopOf(band.lane) + (LANE_H - BAND_H[band.category]) / 2
              }
              height={BAND_H[band.category]}
              showSegments={zoom !== "fit"}
              showEmperorLabels={zoom === "detail"}
              nameOf={(id) => recordById.get(id)?.name ?? ""}
              onHover={handleBandHover}
              onLeave={() => setTip(null)}
              onClick={handleBandClick}
            />
          ))}

          {/* キーボードフォーカスリング（座標はズームごとに再計算される） */}
          {focus &&
            (() => {
              const band = timeline.bands[focus.bandIdx];
              const seg = band.segments[focus.segIdx];
              return (
                <div
                  aria-hidden
                  className="pointer-events-none absolute rounded-[3px] border-2 border-seal"
                  style={{
                    left: xOf(seg.startYear) - 2,
                    width: Math.max(4, widthOf(seg.startYear, seg.endYear)) + 4,
                    top:
                      laneTopOf(band.lane) +
                      (LANE_H - BAND_H[band.category]) / 2 -
                      3,
                    height: BAND_H[band.category] + 6,
                  }}
                />
              );
            })()}
        </div>
      </div>

      {/* 凡例 */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span className="mr-1 inline-block h-3 w-5 translate-y-0.5 rounded-[2px] border border-[color-mix(in_srgb,var(--series-1)_78%,var(--background))] bg-[color-mix(in_srgb,var(--series-1)_40%,var(--background))]" />
          正統王朝（太い帯）
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-5 translate-y-0.5 rounded-[2px] border border-[color-mix(in_srgb,var(--series-2)_52%,var(--background))] bg-[color-mix(in_srgb,var(--series-2)_22%,var(--background))]" />
          並立・反乱・自称政権（細い帯）
        </span>
        <span>
          <span
            className="mr-1 inline-block h-3 w-5 translate-y-0.5 rounded-[2px] border border-border"
            style={{
              background:
                "repeating-linear-gradient(45deg, rgba(58,53,48,0.2) 0 2px, transparent 2px 6px)",
            }}
          />
          皇帝不在の期間
        </span>
        <span>
          <span className="mr-1 inline-block w-5 translate-y-[-3px] border-t border-dashed border-foreground/40" />
          同じ王朝で皇帝を名乗った人物がいない期間
        </span>
        <span>
          <span className="mr-1 inline-block h-3 w-1 translate-y-0.5 bg-seal" />
          復位による再即位（詳細ズーム時）
        </span>
      </div>

      <TimelineTable
        timeline={timeline}
        recordById={recordById}
        openDetail={openDetail}
      />

      <TipOutlet
        render={(tip) => (
          <FixedTooltip x={tip.x} y={tip.y}>
            {tip.kind === "emperor" ? (
              <EmperorTooltip
                record={tip.record}
                valueLabel="在位"
                formattedValue={`${periodLabel(tip.segment.startYear, tip.segment.endYear)}（計${tip.record.reignDurationLabel}）`}
                details={[
                  { label: "即位経路", value: tip.record.accessionRouteCategory },
                  { label: "死因", value: tip.record.deathCauseCategory },
                  {
                    label: "没年齢",
                    value:
                      tip.record.deathAge === null
                        ? "不詳"
                        : `${tip.record.deathAge}歳`,
                  },
                ]}
                hint="クリックで全項目を表示"
              />
            ) : (
              <div
                className="rounded-md border border-border bg-background p-3 text-xs text-foreground shadow-md"
                style={{ width: "max-content", maxWidth: 260 }}
              >
                <div className="font-medium">{tip.band.label}</div>
                <div className="mt-0.5 text-muted-foreground">
                  {/* 「唐（唐）」のような重複を避け、王朝名から時代が読み取れない場合だけ時代を付す */}
                  {tip.band.label.includes(tip.band.era) ||
                  tip.band.era.includes(tip.band.label)
                    ? `皇帝${tip.band.emperorCount}名`
                    : `${tip.band.era}・皇帝${tip.band.emperorCount}名`}
                </div>
                <div className="mt-1">
                  {tip.band.spans
                    .map((s) => periodLabel(s.startYear, s.endYear))
                    .join(" / ")}
                </div>
                <div className="mt-1.5 text-[10px] text-muted-foreground/70">
                  クリックでこの時代を拡大
                </div>
              </div>
            )}
          </FixedTooltip>
        )}
      />
      <DetailOutlet />
    </div>
  );
}

/** 王朝帯1本。スパン（実在位期間）の淡彩矩形＋点線コネクタ＋皇帝セグメント区切り。 */
function BandView({
  band,
  left,
  pxy,
  top,
  height,
  showSegments,
  showEmperorLabels,
  nameOf,
  onHover,
  onLeave,
  onClick,
}: {
  band: TimelineDynastyBand;
  left: number;
  pxy: number;
  top: number;
  height: number;
  showSegments: boolean;
  showEmperorLabels: boolean;
  nameOf: (id: string) => string;
  onHover: (
    band: TimelineDynastyBand,
    e: ReactMouseEvent<HTMLDivElement>,
  ) => void;
  onLeave: () => void;
  onClick: (
    band: TimelineDynastyBand,
    e: ReactMouseEvent<HTMLDivElement>,
  ) => void;
}) {
  const colors = bandColors(band);
  const tOrigin = astroYear(band.startYear);
  const relX = (year: number) => (astroYear(year) - tOrigin) * pxy;
  const relW = (startYear: number, endYear: number) =>
    (astroYear(endYear) + 1 - astroYear(startYear)) * pxy;
  const width = relW(band.startYear, band.endYear);
  const spanStarts = new Set(band.spans.map((s) => s.startYear));
  const label = width >= band.label.length * 11 + 10 ? band.label : "";

  return (
    <div
      className="absolute cursor-pointer hover:brightness-[0.96]"
      style={{ left, top, width, height }}
      onMouseMove={(e) => onHover(band, e)}
      onMouseLeave={onLeave}
      onClick={(e) => onClick(band, e)}
    >
      {/* 帯内ギャップの点線コネクタ（同じ王朝だが皇帝を名乗った人物がいない期間） */}
      {band.spans.length > 1 && (
        <div
          className="absolute inset-x-0 top-1/2"
          style={{ borderTop: `1px dashed ${colors.edge}` }}
        />
      )}
      {/* 実在位スパンの矩形 */}
      {band.spans.map((span) => (
        <div
          key={span.startYear}
          className="absolute inset-y-0 rounded-[2px]"
          style={{
            left: relX(span.startYear),
            width: relW(span.startYear, span.endYear),
            background: colors.fill,
            border: `1px solid ${colors.edge}`,
          }}
        />
      ))}
      {/* 皇帝セグメント（区切り線・交互の濃淡・復位マーカー・詳細ズームの名前） */}
      {showSegments &&
        band.segments.map((seg, i) => {
          const w = relW(seg.startYear, seg.endYear);
          const name = showEmperorLabels ? nameOf(seg.emperorId) : "";
          const showName = name !== "" && w >= name.length * 10 + 8;
          return (
            <div
              key={`${seg.emperorId}-${seg.startYear}`}
              className="absolute inset-y-0 overflow-hidden"
              style={{
                left: relX(seg.startYear),
                width: w,
                background: i % 2 === 1 ? "rgba(58,53,48,0.06)" : undefined,
                borderLeft: seg.isRestoration
                  ? `2px solid var(--seal)`
                  : spanStarts.has(seg.startYear)
                    ? undefined
                    : `1px solid ${colors.strong}`,
              }}
            >
              {showName && (
                <span
                  className="absolute left-1 top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] text-foreground/90"
                  style={{
                    textShadow:
                      "0 0 3px var(--background), 0 0 3px var(--background)",
                  }}
                >
                  {name}
                </span>
              )}
            </div>
          );
        })}
      {/* 王朝名ラベル（幅が足りるときのみ） */}
      {label && !showEmperorLabels && (
        <span
          className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-medium text-foreground"
          style={{
            textShadow: "0 0 3px var(--background), 0 0 3px var(--background)",
          }}
        >
          {band.label}
        </span>
      )}
    </div>
  );
}
