"use client";

// 系譜・即位経路グラフ(/kinship)のSVG描画(1章=1SVG)。レイアウトはビルド時計算済みの
// KinshipChapterLayoutをそのまま描くだけで、このコンポーネントでは座標計算をしない。
// - ホバーツールチップの状態はuseTipOutletでチャート外に分離する(サイト共通原則)。
// - クリックは近傍強調(選択人物と、その家族(垂下線・夫婦線)・補助エッジ・矢印の
//   相手以外をopacity 0.16)。名前はドラッグ選択でコピーできる。
// - 親子は垂下線(junction)の構造で示し、線に続柄ラベルは付けない。
//   矢印は王朝間の交代のみ。

import { useMemo, useState } from "react";
import {
  FixedTooltip,
  useTipOutlet,
} from "@/components/charts/scroll-bar-chart";
import type {
  KinshipChapterLayout,
  KinshipNodeOut,
  TipLine,
} from "@/lib/kinship/layout";

interface KinshipTip {
  x: number;
  y: number;
  lines: TipLine[];
}

const KIN_STROKE = "color-mix(in srgb, var(--foreground) 42%, var(--background))";
const STRUCT_STROKE = "color-mix(in srgb, var(--foreground) 52%, var(--background))";

function nodeFill(n: KinshipNodeOut): string {
  if (n.kind === "consort")
    return "color-mix(in srgb, var(--foreground) 5%, var(--background))";
  if (n.colorSlot === 0)
    return "color-mix(in srgb, var(--foreground) 10%, var(--background))";
  return `color-mix(in srgb, var(--series-${n.colorSlot}) 42%, var(--background))`;
}
function nodeEdge(n: KinshipNodeOut): string {
  if (n.kind === "consort")
    return "color-mix(in srgb, var(--foreground) 30%, var(--background))";
  if (n.colorSlot === 0)
    return "color-mix(in srgb, var(--foreground) 38%, var(--background))";
  return `color-mix(in srgb, var(--series-${n.colorSlot}) 82%, var(--background))`;
}

export function KinshipChart({ layout }: { layout: KinshipChapterLayout }) {
  const { setTip, TipOutlet } = useTipOutlet<KinshipTip>();
  const [focusId, setFocusId] = useState<string | null>(null);

  // 近傍集合(選択人物+家族線・補助エッジ・矢印で繋がる相手)。
  const neighbor = useMemo(() => {
    if (!focusId) return null;
    const keep = new Set([focusId]);
    for (const d of layout.drops) {
      if (d.ids.includes(focusId)) for (const id of d.ids) keep.add(id);
    }
    for (const t of layout.ties) {
      if (t.husbandId === focusId) keep.add(t.spouseId);
      if (t.spouseId === focusId) keep.add(t.husbandId);
    }
    for (const e of [...layout.auxEdges, ...layout.arrows]) {
      if (e.fromId === focusId) keep.add(e.toId);
      if (e.toId === focusId) keep.add(e.fromId);
    }
    return keep;
  }, [focusId, layout]);

  const dim = (related: boolean) => (neighbor && !related ? 0.16 : 1);
  const emperorCount = layout.nodes.filter((n) => n.kind === "emperor").length;
  const markerId = `kinship-arrow-${layout.id}`;

  const showTip = (lines: TipLine[]) => (ev: React.MouseEvent) =>
    setTip({ x: ev.clientX, y: ev.clientY, lines });
  const hideTip = () => setTip(null);

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-background">
      <svg
        role="img"
        aria-label={`${layout.title}の系譜図。縦が時間(上が古い)、横が王朝バンド。皇帝${emperorCount}人を家系図形式で表示。王朝間の交代${layout.arrows.length}本を矢印で表示`}
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="block"
        onClick={() => setFocusId(null)}
      >
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6.5"
            markerHeight="6.5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--seal)" />
          </marker>
        </defs>

        {/* 時間軸・目盛り */}
        <g aria-hidden>
          <line
            x1={layout.axisX}
            y1={layout.ticks[0]?.y ?? 0}
            x2={layout.axisX}
            y2={layout.height - 24}
            stroke="var(--border)"
            strokeWidth={1.5}
          />
          {layout.ticks.map((t) => (
            <g key={t.label}>
              <line
                x1={layout.axisX - 5}
                y1={t.y}
                x2={layout.width - 16}
                y2={t.y}
                stroke="var(--border)"
                strokeWidth={0.6}
              />
              <text
                x={layout.axisX - 9}
                y={t.y + 3.5}
                textAnchor="end"
                className="fill-muted-foreground text-[10.5px]"
              >
                {t.label}
              </text>
            </g>
          ))}
        </g>

        {/* バンド見出し */}
        <g aria-hidden>
          {layout.bands.map((b) => (
            <text
              key={b.label}
              x={b.x + b.width / 2}
              y={b.labelY}
              textAnchor="middle"
              className="fill-foreground text-[13px] font-semibold"
            >
              {b.label}
            </text>
          ))}
        </g>

        {/* 家系図の構造線(垂下線・兄弟バー)。エッジ・ノードの下層 */}
        <g>
          {layout.drops.map((d, i) => (
            <path
              key={`drop:${i}`}
              d={d.path}
              fill="none"
              stroke={STRUCT_STROKE}
              strokeWidth={1.6}
              strokeDasharray={d.dashed ? "2 4" : undefined}
              opacity={dim(d.ids.some((id) => neighbor?.has(id) ?? false))}
              className="transition-opacity"
            />
          ))}
        </g>

        {/* 夫婦の連結線(皇后=二重線・妃嬪等=細単線) */}
        <g>
          {layout.ties.map((t, i) => (
            <g
              key={`tie:${i}`}
              opacity={dim(
                (neighbor?.has(t.husbandId) ?? false) ||
                  (neighbor?.has(t.spouseId) ?? false),
              )}
              className="transition-opacity"
            >
              {t.double ? (
                <>
                  <line x1={t.x1} y1={t.y - 1.7} x2={t.x2} y2={t.y - 1.7} stroke={STRUCT_STROKE} strokeWidth={1.4} />
                  <line x1={t.x1} y1={t.y + 1.7} x2={t.x2} y2={t.y + 1.7} stroke={STRUCT_STROKE} strokeWidth={1.4} />
                </>
              ) : (
                <line x1={t.x1} y1={t.y} x2={t.x2} y2={t.y} stroke={KIN_STROKE} strokeWidth={1.1} />
              )}
            </g>
          ))}
        </g>

        {/* 補助エッジ(バンドをまたぐ血縁・養母・異説の親など) */}
        <g>
          {layout.auxEdges.map((e) => (
            <g
              key={e.key}
              opacity={dim(e.fromId === focusId || e.toId === focusId)}
              className="transition-opacity"
            >
              {e.marriage ? (
                <>
                  <path d={e.path} fill="none" stroke={KIN_STROKE} strokeWidth={3.4} strokeLinecap="round" />
                  <path d={e.path} fill="none" stroke="var(--background)" strokeWidth={1.4} strokeLinecap="round" />
                </>
              ) : (
                <path
                  d={e.path}
                  fill="none"
                  stroke={KIN_STROKE}
                  strokeWidth={1.4}
                  strokeLinecap="round"
                  strokeDasharray={e.dashed ? "2 5" : undefined}
                />
              )}
              <path
                d={e.path}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                onMouseMove={showTip(e.tipLines)}
                onMouseLeave={hideTip}
              />
            </g>
          ))}
        </g>

        {/* 王朝間の交代(禅譲・簒奪など)の矢印 */}
        <g>
          {layout.arrows.map((a) => (
            <g
              key={a.key}
              opacity={dim(a.fromId === focusId || a.toId === focusId)}
              className="transition-opacity"
            >
              <path
                d={a.path}
                fill="none"
                stroke="var(--seal)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray={a.disputed ? "2 5" : undefined}
                markerEnd={`url(#${markerId})`}
              />
              <text
                x={a.labelX}
                y={a.labelY}
                textAnchor="middle"
                className="fill-seal text-[10px] font-medium"
                style={{
                  paintOrder: "stroke",
                  stroke: "var(--background)",
                  strokeWidth: 3,
                }}
              >
                {a.label}
              </text>
              <path
                d={a.path}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                onMouseMove={showTip(a.tipLines)}
                onMouseLeave={hideTip}
              />
            </g>
          ))}
        </g>

        {/* 王朝見出し(各王朝の最初のカプセルの上。ハローで交差線を隠す) */}
        <g aria-hidden>
          {layout.dynastyHeads.map((h) => (
            <text
              key={`${h.label}:${h.y}`}
              x={h.x}
              y={h.y}
              textAnchor="middle"
              className="fill-foreground text-[11.5px] font-semibold"
              style={{
                paintOrder: "stroke",
                stroke: "var(--background)",
                strokeWidth: 3,
              }}
            >
              {h.label}
            </text>
          ))}
        </g>

        {/* ノード */}
        <g>
          {layout.nodes.map((n) => (
            <g
              key={n.key}
              opacity={dim(neighbor?.has(n.id) ?? false)}
              className="cursor-pointer transition-opacity"
              onMouseMove={showTip(n.tipLines)}
              onMouseLeave={hideTip}
              onClick={(ev) => {
                ev.stopPropagation();
                // ドラッグで名前を選択(コピー)した直後のclickでは強調を切り替えない。
                if (window.getSelection()?.toString()) return;
                setFocusId((cur) => (cur === n.id ? null : n.id));
              }}
            >
              <rect
                x={n.x}
                y={n.y}
                width={n.w}
                height={n.h}
                rx={n.kind === "consort" ? n.h / 2 : 8}
                fill={nodeFill(n)}
                stroke={nodeEdge(n)}
                strokeWidth={n.kind === "emperor" ? 1.5 : 1.2}
                strokeDasharray={n.kind === "person" ? "5 4" : undefined}
              />
              {/* 名前はドラッグ選択してコピーできるようにする(pointer-events無効化をしない) */}
              <text
                x={n.x + n.w / 2}
                y={n.sub !== null ? n.y + n.h / 2 - 3 : n.y + n.h / 2 + 4}
                textAnchor="middle"
                className={
                  n.kind === "consort"
                    ? "fill-foreground/80 text-[10.5px]"
                    : "fill-foreground text-[11px]"
                }
                style={{ userSelect: "text" }}
              >
                {n.label}
              </text>
              {n.sub !== null && (
                <text
                  x={n.x + n.w / 2}
                  y={n.y + n.h / 2 + 11}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[9.5px]"
                  style={{ userSelect: "text" }}
                >
                  {n.sub}
                </text>
              )}
              {n.claimBadge && (
                <text
                  x={n.x + n.w + 5}
                  y={n.y + 11}
                  className="fill-muted-foreground text-[9.5px]"
                >
                  ◇遠祖
                </text>
              )}
            </g>
          ))}
        </g>
      </svg>

      <TipOutlet
        render={(tip) => (
          <FixedTooltip x={tip.x} y={tip.y}>
            <div className="max-w-[320px] rounded-md border border-border bg-background px-2.5 py-2 text-xs leading-relaxed shadow-md">
              {tip.lines.map((line, i) => (
                <div
                  key={i}
                  className={
                    line.muted ? "text-muted-foreground" : "font-semibold text-foreground"
                  }
                >
                  {line.text}
                </div>
              ))}
            </div>
          </FixedTooltip>
        )}
      />
    </div>
  );
}
