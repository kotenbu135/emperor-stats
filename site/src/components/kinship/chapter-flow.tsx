"use client";

// 系譜図の描画層（React Flow v12）。
//
// **ここではレイアウトを決めない。** 位置は scripts/build-kinship-layout.mjs が elkjs で
// ビルド前に確定したものを props で受け取るだけ。`site/AGENTS.md` の「クライアント側から
// emperors.ts を import しない」を守るため、渡ってくるのは表示に要る欄だけの軽い型。
//
// **静的 HTML に `<a href="/emperors/[id]">` が出ることは検査済み**（out/kinship.html を
// grep して確認。React Flow は "use client" だが、static export ではプリレンダーされる）。
//
// 見た目の出どころ（Issue #174・2026-08-18 のユーザー決定）:
// - A = Die Welt der Habsburger の系図面 … 肖像を主役にしたカード／地を白にしない／
//   空きセルにも薄い箱を敷く／上端に章のナビ
// - B = UsefulCharts の East Asian Royal Family Trees … 政権を**濃い彩度の帯＋白文字**で
//   出す（前回の淡彩8%は箱1個の面積では白としか読めなかった）
// - C = Royal Constellations … ホバーで**関係するものだけ残して他を沈める**
import { useCallback, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { regimeBandColor } from "@/lib/kinship/band-color";

export interface KinshipPerson {
  id: string;
  emperorId: string | null;
  label: string;
  regimeId: string | null;
  isEmperor: boolean;
  reignFrom: number | null;
  reignTo: number | null;
  birthYear: number | null;
  deathYear: number | null;
  portrait: string | null;
  focusY: number | null;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface KinshipUnion {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  father: string;
  mother: string;
  children: string[];
}

export interface KinshipLayout {
  eraId: string;
  width: number;
  height: number;
  cardW: number;
  cardH: number;
  layers: number;
  nodes: KinshipPerson[];
  unions: KinshipUnion[];
  directParent: { from: string; to: string; relation: string }[];
}


function yearLabel(from: number | null, to: number | null): string {
  const f = (y: number) => (y < 0 ? `前${-y}` : `${y}`);
  if (from == null && to == null) return "";
  if (from != null && to != null) return `${f(from)}–${f(to)}`;
  return f((from ?? to) as number);
}

interface CardData extends Record<string, unknown> {
  person: KinshipPerson;
  dimmed: boolean;
}

function PersonCard({ data }: NodeProps<Node<CardData>>) {
  const p = data.person;
  const fill = regimeBandColor(p.regimeId);
  const body = (
    <>
      <div
        className="relative flex-1 overflow-hidden"
        style={{ background: "var(--kinship-portrait-bg)" }}
      >
        {p.portrait ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/portraits/${p.portrait}`}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: `50% ${((p.focusY ?? 0.25) * 100).toFixed(0)}%` }}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-heading text-2xl text-muted-foreground">
            {p.label.charAt(0)}
          </span>
        )}
      </div>
      <div
        className="px-1.5 py-1 text-center leading-tight"
        style={{ background: p.isEmperor ? fill : "var(--kinship-kin-band)" }}
      >
        <div
          className="truncate text-[13px] font-semibold"
          style={{ color: p.isEmperor ? "#fff" : "var(--foreground)" }}
        >
          {p.label}
        </div>
        {/* **年は白のまま落とさない。** 帯の色は「白文字が 4.5:1」で決めてあるので、
            82% に薄めると 10px の小さな字だけがその基準を割る。親族カードの副行も
            --muted-foreground（--muted/--background に対して調整した値）ではなく
            地の文の色にする — --kinship-kin-band の上での比は測っていないため。 */}
        <div
          className="truncate text-[10px] tabular-nums"
          style={{ color: p.isEmperor ? "#fff" : "var(--foreground)" }}
        >
          {p.isEmperor
            ? yearLabel(p.reignFrom, p.reignTo)
            : yearLabel(p.birthYear, p.deathYear)}
        </div>
      </div>
    </>
  );

  const shell = `flex h-full w-full flex-col overflow-hidden rounded-[3px] border border-black/15 bg-card shadow-sm transition-opacity ${
    data.dimmed ? "opacity-20" : "opacity-100"
  }`;

  // **Handle が無いと線が1本も描かれない。** サーバー描画のときはノードの `handles`
  // プロパティが位置を代行するが、クライアントで hydrate したあとは実要素の位置を測る。
  // 図では触らせないので見た目は消す（`opacity-0` ではなく寸法ごと潰すと測れなくなる）。
  const ports = (
    <>
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0" />
    </>
  );

  if (!p.emperorId)
    return (
      <div className={shell}>
        {ports}
        {body}
      </div>
    );
  return (
    <a href={`/emperors/${p.emperorId}`} className={`${shell} hover:border-black/40`}>
      {ports}
      {body}
    </a>
  );
}

function UnionDot({ data }: NodeProps<Node<{ dimmed: boolean }>>) {
  return (
    <div
      className="h-full w-full rounded-full transition-opacity"
      style={{
        background: "var(--kinship-line)",
        opacity: data.dimmed ? 0.15 : 1,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0" />
    </div>
  );
}

const nodeTypes = { person: PersonCard, union: UnionDot };

export interface KinshipJump {
  regimeId: string;
  label: string;
  nodeId: string;
  count: number;
}

/** 図の中を動かすので Provider の内側に置く（`useReactFlow` は Provider が要る）。 */
export function ChapterFlow({
  layout,
  jumps,
}: {
  layout: KinshipLayout;
  jumps: KinshipJump[];
}) {
  return (
    <ReactFlowProvider>
      <ChapterFlowInner layout={layout} jumps={jumps} />
    </ReactFlowProvider>
  );
}

function ChapterFlowInner({
  layout,
  jumps,
}: {
  layout: KinshipLayout;
  jumps: KinshipJump[];
}) {
  const [focusId, setFocusId] = useState<string | null>(null);

  // ホバーした人物の祖先と子孫（C の作法）。107 人ぶんなので毎回辿って構わない。
  const { up, down } = useMemo(() => {
    const u = new Map<string, string[]>();
    const d = new Map<string, string[]>();
    const link = (m: Map<string, string[]>, a: string, b: string) => {
      const cur = m.get(a);
      if (cur) cur.push(b);
      else m.set(a, [b]);
    };
    for (const un of layout.unions) {
      link(d, un.father, un.id);
      link(d, un.mother, un.id);
      link(u, un.id, un.father);
      link(u, un.id, un.mother);
      for (const c of un.children) {
        link(d, un.id, c);
        link(u, c, un.id);
      }
    }
    for (const e of layout.directParent) {
      link(d, e.from, e.to);
      link(u, e.to, e.from);
    }
    return { up: u, down: d };
  }, [layout]);

  const related = useMemo(() => {
    if (!focusId) return null;
    const seen = new Set<string>([focusId]);
    // **辿りをヘルパー関数に切り出さない** — `up`/`down` を引数で渡す形は
    // react-hooks/immutability が「この値は変更できない」で落とす（lint エラー）。
    for (const m of [up, down]) {
      const stack = [focusId];
      while (stack.length) {
        const cur = stack.pop() as string;
        for (const nx of m.get(cur) ?? []) {
          if (seen.has(nx)) continue;
          seen.add(nx);
          stack.push(nx);
        }
      }
    }
    return seen;
  }, [focusId, up, down]);

  const nodes: Node[] = useMemo(() => {
    // `handles` はサーバー描画のためにある（クライアントでは実要素を測るので不要）。
    // これが無いと **静的 HTML に親子の線が1本も出ない**（`<a>` は出るので SEO の要件は
    // 満たすが、JS が動かない環境では点だけが並ぶ）。
    const ports = (w: number, h: number) => [
      { type: "target" as const, position: Position.Top, x: w / 2, y: 0 },
      { type: "source" as const, position: Position.Bottom, x: w / 2, y: h },
    ];
    const out: Node[] = layout.nodes.map((p) => ({
      id: p.id,
      type: "person",
      position: { x: p.x, y: p.y },
      width: p.w,
      height: p.h,
      handles: ports(p.w, p.h),
      draggable: false,
      connectable: false,
      selectable: false,
      data: { person: p, dimmed: related ? !related.has(p.id) : false },
    }));
    for (const un of layout.unions) {
      out.push({
        id: un.id,
        type: "union",
        position: { x: un.x, y: un.y },
        width: un.w,
        height: un.h,
        handles: ports(un.w, un.h),
        draggable: false,
        connectable: false,
        selectable: false,
        data: { dimmed: related ? !related.has(un.id) : false },
      });
    }
    return out;
  }, [layout, related]);

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    const dim = (a: string, b: string) =>
      related ? !(related.has(a) && related.has(b)) : false;
    const style = (a: string, b: string, dashed: boolean) => ({
      stroke: "var(--kinship-line)",
      strokeWidth: 1.6,
      strokeDasharray: dashed ? "3 3" : undefined,
      opacity: dim(a, b) ? 0.12 : 0.85,
    });
    for (const un of layout.unions) {
      out.push({
        id: `${un.id}-f`,
        source: un.father,
        target: un.id,
        style: style(un.father, un.id, false),
      });
      out.push({
        id: `${un.id}-m`,
        source: un.mother,
        target: un.id,
        style: style(un.mother, un.id, true),
      });
      for (const c of un.children) {
        out.push({
          id: `${un.id}-${c}`,
          source: un.id,
          target: c,
          style: style(un.id, c, false),
        });
      }
    }
    layout.directParent.forEach((e, i) => {
      out.push({
        id: `d${i}`,
        source: e.from,
        target: e.to,
        style: style(e.from, e.to, e.relation === "mother"),
      });
    });
    return out;
  }, [layout, related]);

  const onEnter = useCallback((_: unknown, node: Node) => setFocusId(node.id), []);
  const onLeave = useCallback(() => setFocusId(null), []);

  // 政権へ飛ぶ（A = Die Welt der Habsburger の上端ナビに当たる）。図は 3023×4144px あって
  // 1画面には収まらないので、**行き先を図の外に文字で出す**のがここでの「全体の把握」。
  const { setCenter } = useReactFlow();
  const [here, setHere] = useState<string | null>(null);
  const jumpTo = useCallback(
    (j: KinshipJump) => {
      const n = layout.nodes.find((p) => p.id === j.nodeId);
      if (!n) return;
      setHere(j.regimeId);
      void setCenter(n.x + n.w / 2, n.y + n.h / 2, { zoom: 0.7, duration: 600 });
    },
    [layout, setCenter],
  );

  return (
    <div
      className="relative flex h-[calc(100vh-9rem)] w-full flex-col overflow-hidden rounded-lg border"
      style={{ background: "var(--kinship-canvas)" }}
    >
      <nav
        aria-label="政権へジャンプ"
        className="flex shrink-0 flex-wrap items-center gap-1 border-b px-2 py-1.5"
        style={{ background: "var(--kinship-kin-band)" }}
      >
        {jumps.map((j) => (
          <button
            key={j.regimeId}
            type="button"
            onClick={() => jumpTo(j)}
            className={`rounded-[3px] px-2 py-0.5 text-xs transition-colors hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal ${
              here === j.regimeId ? "text-seal font-semibold" : ""
            }`}
          >
            {j.label}
            <span className="ml-1 tabular-nums opacity-60">{j.count}</span>
          </button>
        ))}
      </nav>
      <div className="relative min-h-0 flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        width={layout.width}
        height={layout.height}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.08}
        maxZoom={2}
        // **全体を1画面に収めない。** 3023×4144px を 1156px 幅に収めると倍率 0.28 で
        // 字が読めなくなる（前回の取り下げ理由「俯瞰すると字が読めない」そのもの）。
        // 見本の A（Die Welt der Habsburger）も1画面に収めていない — 図の入口
        // （この章では始皇帝）へ寄せて開き、全体は右下の MiniMap で把握させる。
        fitView
        // 入口は前漢の高祖。**始皇帝ではない** — elk の最上段には「親が分からない人」が
        // 並ぶだけで、そこを最初に見せても系譜として読めない（秦の2人は左上にいる）。
        fitViewOptions={{ nodes: [{ id: "han-gaozu" }], minZoom: 0.7, maxZoom: 0.7 }}
        proOptions={{ hideAttribution: false }}
        onNodeMouseEnter={onEnter}
        onNodeMouseLeave={onLeave}
      >
        <Background
          variant={BackgroundVariant.Lines}
          gap={[layout.cardW + 14, layout.cardH + 40]}
          lineWidth={1}
          color="var(--kinship-grid)"
        />
        <MiniMap pannable zoomable className="!bg-transparent" />
        <Controls showInteractive={false} />
      </ReactFlow>
      </div>
    </div>
  );
}
