"use client";

// 系譜・即位経路グラフ(/kinship)のSVG描画。レイアウトはビルド時計算済みの
// KinshipLayoutをそのまま描くだけで、このコンポーネントでは座標計算をしない
// (KINSHIP_SCHEMA.md「レイアウトはビルド時計算」)。
// ホバーツールチップの状態はuseTipOutletでチャート外に分離する(サイト共通原則)。
// クリックは近傍強調(選択人物と隣接エッジ・ノード以外をopacity 0.16。複数在位の
// カプセルは人物id単位でまとめて扱う)。

import { useMemo, useState } from "react";
import {
  FixedTooltip,
  useTipOutlet,
} from "@/components/charts/scroll-bar-chart";
import type {
  KinshipEdgeOut,
  KinshipLayout,
  KinshipNodeOut,
} from "@/lib/kinship-layout";

interface KinshipTip {
  x: number;
  y: number;
  lines: { text: string; muted?: boolean }[];
}

function nodeFill(slot: number): string {
  if (slot === 0) return "color-mix(in srgb, var(--foreground) 10%, var(--background))";
  return `color-mix(in srgb, var(--series-${slot}) 42%, var(--background))`;
}
function nodeEdge(slot: number): string {
  if (slot === 0) return "color-mix(in srgb, var(--foreground) 38%, var(--background))";
  return `color-mix(in srgb, var(--series-${slot}) 82%, var(--background))`;
}

function nodeTip(n: KinshipNodeOut, x: number, y: number): KinshipTip {
  const lines: KinshipTip["lines"] = [
    { text: n.tip.title },
    { text: n.tip.subtitle, muted: true },
    { text: n.tip.period, muted: true },
  ];
  if (n.tip.claim) lines.push({ text: n.tip.claim, muted: true });
  return { x, y, lines };
}

function edgeTip(e: KinshipEdgeOut, x: number, y: number): KinshipTip {
  const lines: KinshipTip["lines"] = [
    { text: e.tip.title },
    { text: e.tip.detail, muted: true },
  ];
  if (e.tip.noteExcerpt) lines.push({ text: e.tip.noteExcerpt, muted: true });
  if (e.tip.source) lines.push({ text: `出典: ${e.tip.source}`, muted: true });
  return { x, y, lines };
}

const KIN_STROKE = "color-mix(in srgb, var(--foreground) 42%, var(--background))";

export function KinshipChart({ layout }: { layout: KinshipLayout }) {
  const { setTip, TipOutlet } = useTipOutlet<KinshipTip>();
  const [focusId, setFocusId] = useState<string | null>(null);

  // 近傍集合(選択人物+隣接エッジの両端)。人物id単位。
  const neighbor = useMemo(() => {
    if (!focusId) return null;
    const keep = new Set([focusId]);
    for (const e of layout.edges) {
      if (e.from === focusId) keep.add(e.to);
      if (e.to === focusId) keep.add(e.from);
    }
    return keep;
  }, [focusId, layout.edges]);

  const dimNode = (n: KinshipNodeOut) => (neighbor ? !neighbor.has(n.id) : false);
  const dimEdge = (e: KinshipEdgeOut) =>
    neighbor ? !(e.from === focusId || e.to === focusId) : false;

  const emperorCount = useMemo(
    () => new Set(layout.nodes.filter((n) => n.kind === "emperor").map((n) => n.id)).size,
    [layout.nodes],
  );

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-background">
      <svg
        role="img"
        aria-label={`系譜・即位経路グラフ。縦が時間(上が古い)、横が王朝カラム。皇帝${emperorCount}人・継承エッジ${layout.edges.filter((e) => e.edgeType === "succession").length}本・血縁エッジ${layout.edges.filter((e) => e.edgeType === "kinship").length}本・婚姻${layout.edges.filter((e) => e.edgeType === "marriage").length}本を表示`}
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="block"
        onClick={() => setFocusId(null)}
      >
        <defs>
          <marker
            id="kinship-arrow"
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

        {/* 複数在位コネクタ(エッジより下層) */}
        <g>
          {layout.connectors.map((c, i) => (
            <g
              key={`conn:${c.personId}:${i}`}
              opacity={neighbor && !neighbor.has(c.personId) ? 0.16 : 1}
              className="transition-opacity"
            >
              <path
                d={c.path}
                fill="none"
                stroke={KIN_STROKE}
                strokeWidth={1.6}
                strokeDasharray="3 4"
              />
              <path
                d={c.path}
                fill="none"
                stroke="transparent"
                strokeWidth={10}
                onMouseMove={(ev) =>
                  setTip({
                    x: ev.clientX,
                    y: ev.clientY,
                    lines: [{ text: c.tipTitle }],
                  })
                }
                onMouseLeave={() => setTip(null)}
              />
            </g>
          ))}
        </g>

        {/* エッジ(ノードの下層) */}
        <g>
          {layout.edges.map((e) => (
            <g
              key={`${e.edgeType}:${e.from}→${e.to}`}
              opacity={dimEdge(e) ? 0.16 : 1}
              className="transition-opacity"
            >
              {e.edgeType === "marriage" ? (
                <>
                  {/* 婚姻=二重線(太線の上に背景色の細線を重ねる)・無向 */}
                  <path
                    d={e.path}
                    fill="none"
                    stroke={KIN_STROKE}
                    strokeWidth={3.6}
                    strokeLinecap="round"
                  />
                  <path
                    d={e.path}
                    fill="none"
                    stroke="var(--background)"
                    strokeWidth={1.4}
                    strokeLinecap="round"
                  />
                </>
              ) : (
                <path
                  d={e.path}
                  fill="none"
                  stroke={e.edgeType === "kinship" ? KIN_STROKE : "var(--seal)"}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray={e.disputed ? "2 5" : undefined}
                  markerEnd={e.edgeType === "kinship" ? undefined : "url(#kinship-arrow)"}
                />
              )}
              {/* ラベル: 継承=朱(カテゴリ+続柄)・血縁=灰(続柄)。婚姻と継承に重なる血縁は
                  graphLabelが空になり描かない(密集回避。全文はツールチップとテキスト版) */}
              {e.graphLabel !== "" && (
                <text
                  x={e.labelX}
                  y={e.labelY}
                  textAnchor={e.labelAnchor}
                  className={
                    e.edgeType === "succession"
                      ? "fill-seal text-[10px]"
                      : "fill-muted-foreground text-[9.5px]"
                  }
                  style={{
                    paintOrder: "stroke",
                    stroke: "var(--background)",
                    strokeWidth: 3,
                  }}
                >
                  {e.graphLabel}
                </text>
              )}
              {/* 当たり判定(細線のホバーを取りやすくする透明の太線) */}
              <path
                d={e.path}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                onMouseMove={(ev) => setTip(edgeTip(e, ev.clientX, ev.clientY))}
                onMouseLeave={() => setTip(null)}
              />
            </g>
          ))}
        </g>

        {/* 王朝見出し(各王朝の最初のカプセルの上。エッジより上層に描き、ハローで
            交差する線を隠して読めるようにする) */}
        <g aria-hidden>
          {layout.dynastyHeads.map((h) => (
            <text
              key={`${h.label}:${h.y}`}
              x={h.x}
              y={h.y}
              textAnchor="middle"
              className="fill-foreground text-[12px] font-semibold"
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
              opacity={dimNode(n) ? 0.16 : 1}
              className="cursor-pointer transition-opacity"
              onMouseMove={(ev) => setTip(nodeTip(n, ev.clientX, ev.clientY))}
              onMouseLeave={() => setTip(null)}
              onClick={(ev) => {
                ev.stopPropagation();
                // ドラッグで名前を選択(コピー)した直後のclickでは強調表示を切り替えない。
                if (window.getSelection()?.toString()) return;
                setFocusId((cur) => (cur === n.id ? null : n.id));
              }}
            >
              <rect
                x={n.x}
                y={n.y}
                width={n.w}
                height={n.h}
                rx={8}
                fill={nodeFill(n.colorSlot)}
                stroke={nodeEdge(n.colorSlot)}
                strokeWidth={1.5}
                strokeDasharray={n.kind === "person" ? "5 4" : undefined}
              />
              {/* 名前はドラッグ選択してコピーできるようにする(pointer-events無効化をしない) */}
              <text
                x={n.x + n.w / 2}
                y={n.y + n.h / 2 + 4}
                textAnchor="middle"
                className="fill-foreground text-[11px]"
                style={{ userSelect: "text" }}
              >
                {n.label}
              </text>
              {n.rootBadge && (
                <text
                  x={n.x + n.w + 6}
                  y={n.y + 11}
                  className="fill-muted-foreground text-[9.5px]"
                >
                  {n.rootBadge}
                </text>
              )}
              {n.claimBadge && (
                <text
                  x={n.x + n.w + 6}
                  y={n.y + (n.rootBadge ? 23 : 11)}
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
            <div className="max-w-[300px] rounded-md border border-border bg-background px-2.5 py-2 text-xs leading-relaxed shadow-md">
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
