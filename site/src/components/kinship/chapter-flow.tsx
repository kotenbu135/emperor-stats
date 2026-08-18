"use client";

// 系譜図の描画層（React Flow v12）。
//
// **ここではレイアウトを決めない。** 位置は scripts/build-kinship-layout.mjs が elkjs で
// ビルド前に確定したものを props で受け取るだけ。`site/AGENTS.md` の「クライアント側から
// emperors.ts を import しない」を守るため、渡ってくるのは表示に要る欄だけの軽い型。
//
// **静的 HTML に `<a href="/emperors/[id]">` と親子の線が出ることは検査済み**
// （out/kinship.html を grep して確認。React Flow は "use client" だが static export では
// プリレンダーされる。線を出すにはノードに `handles` を渡す必要がある）。
//
// 見た目の出どころ（Issue #174・2026-08-18 のユーザー決定）:
// - A = Die Welt der Habsburger の系図面 … 肖像を主役にしたカード／地を白にしない／
//   空きセルにも薄い箱を敷く／上端に章のナビ
// - B = UsefulCharts の East Asian Royal Family Trees … 政権を**濃い彩度の帯＋白文字**で
//   出す（前回の淡彩8%は箱1個の面積では白としか読めなかった）
//
// **ホバーで系統を絞る仕掛けは 2026-08-18 に不要と判断されて外した**（C = Royal
// Constellations から採る予定だった作法）。戻さないこと。
import { useCallback, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import { regimeBandColor } from "@/lib/kinship/band-color";

export interface KinshipPerson {
  id: string;
  emperorId: string | null;
  label: string;
  regimeId: string | null;
  isEmperor: boolean;
  gender: string | null;
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
  crossEra: { label: string; era: string | null }[];
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
  /** parents = 子がいる実の両親／marriage = 婚姻だけ／disputed = 実父の異説 */
  kind: "parents" | "marriage" | "disputed";
}

/** 線1本。`busY` は「同じ親から出る線をまとめる横棒の高さ」で、レイアウト側が決める。 */
export interface KinshipEdge {
  id: string;
  kind: "father" | "mother" | "child" | "adoptive" | "second" | "disputed" | "succession";
  from: string;
  to: string;
  busY: number | null;
  categoryId?: string | null;
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
  edges: KinshipEdge[];
}

export interface KinshipJump {
  regimeId: string;
  label: string;
  nodeId: string;
  count: number;
}

/** 継承の区分ラベル（図の線に添える）。data/emperors.json の catalogs と同じ語を使う。 */
const SUCCESSION_LABEL: Record<string, string> = {
  enthroned: "擁立",
  hereditary: "世襲",
  usurpation: "簒奪",
  "abdication-received": "禅譲",
  "inner-abdication": "内禅",
  restoration: "復位",
  acclamation: "推戴",
  "self-established": "自立",
  "succession-unspecified": "継承",
};

function yearLabel(from: number | null, to: number | null): string {
  const f = (y: number) => (y < 0 ? `前${-y}` : `${y}`);
  if (from == null && to == null) return "";
  if (from != null && to != null) return `${f(from)}–${f(to)}`;
  return f((from ?? to) as number);
}

/** カード下帯の色。皇帝は政権色、それ以外は性別で分ける（2026-08-18 ユーザー指示）。 */
function bandOf(p: KinshipPerson): string {
  if (p.isEmperor) return regimeBandColor(p.regimeId);
  if (p.gender === "female") return "var(--kinship-kin-band-female)";
  return "var(--kinship-kin-band)";
}

function PersonCard({ data }: NodeProps<Node<{ person: KinshipPerson }>>) {
  const p = data.person;
  const fill = bandOf(p);
  // **皇帝以外は名前と年の帯だけ**（2026-08-18 ユーザー指示）。肖像アセットは皇帝にしか
  // 無いので、縦長の枠を用意しても中身は姓一文字のモノグラムにしかならなかった。
  const band = (
    <div className="px-1.5 py-1 text-center leading-tight" style={{ background: fill }}>
      <div
        className="truncate text-[13px] font-semibold"
        style={{ color: p.isEmperor ? "#fff" : "var(--foreground)" }}
      >
        {p.label}
      </div>
      {/* **年は白のまま落とさない。** 帯の色は「白文字が 4.5:1」で決めてあるので、
          82% に薄めると 10px の小さな字だけがその基準を割る。 */}
      <div
        className="truncate text-[10px] tabular-nums"
        style={{ color: p.isEmperor ? "#fff" : "var(--foreground)" }}
      >
        {p.isEmperor ? yearLabel(p.reignFrom, p.reignTo) : yearLabel(p.birthYear, p.deathYear)}
      </div>
    </div>
  );

  const body = p.isEmperor ? (
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
      {band}
    </>
  ) : (
    band
  );

  const shell =
    "flex h-full w-full flex-col overflow-hidden rounded-[3px] border border-black/25 bg-card shadow-sm";

  // **Handle が無いと線が1本も描かれない。** サーバー描画のときはノードの `handles`
  // プロパティが位置を代行するが、クライアントで hydrate したあとは実要素の位置を測る。
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

function UnionDot({ data }: NodeProps<Node<{ kind: KinshipUnion["kind"] }>>) {
  // 実父の異説の結び目は**中を抜く**（実の夫婦の塗り潰しと同じ形にしない）。
  const disputed = data.kind === "disputed";
  return (
    <div
      className="h-full w-full rounded-full"
      style={{
        background: disputed ? "var(--kinship-canvas)" : "var(--kinship-line)",
        border: disputed ? "1.6px solid var(--kinship-line)" : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0" />
    </div>
  );
}

/**
 * 直角の線を1本引く。**角丸を付けない**（2026-08-18「不要な曲がりが発生していてキモい」）。
 *
 * React Flow の `smoothstep` は2点ごとに中点で折るので、同じ親から出る線が兄弟の数だけ
 * 違う高さの横棒になり、しかも分岐点では角丸どうしが逆向きに剥がれて瘤ができていた。
 * ここは `busY`（＝兄弟で共有する横棒の高さ・レイアウト側が決める）を通る折れ線を
 * 直角のまま引くだけにする。同じ親の線は分岐点まで完全に重なるので、本物の T 字になる。
 */
function combPath(sx: number, sy: number, tx: number, ty: number, busY: number): string {
  if (Math.abs(sx - tx) < 0.5) return `M${sx},${sy} L${sx},${ty}`;
  return `M${sx},${sy} L${sx},${busY} L${tx},${busY} L${tx},${ty}`;
}

function FamilyEdge({ id, sourceX, sourceY, targetX, targetY, data, style }: EdgeProps) {
  const busY = (data?.busY as number | undefined) ?? (sourceY + targetY) / 2;
  return <BaseEdge id={id} path={combPath(sourceX, sourceY, targetX, targetY, busY)} style={style} />;
}

const nodeTypes = { person: PersonCard, union: UnionDot };
const edgeTypes = { family: FamilyEdge };

/** 線の見た目。**種別ごとに1箇所**で、凡例（page.tsx）と対で動かす。 */
const EDGE_STYLE: Record<KinshipEdge["kind"], { dash?: string; color?: string }> = {
  father: {},
  mother: { dash: "3 3" },
  child: {},
  adoptive: { dash: "6 3" },
  second: { dash: "1 3" },
  disputed: { dash: "1 3" },
  succession: { dash: "5 4", color: "var(--kinship-succession)" },
};

/**
 * レイアウトを React Flow の nodes/edges に写す。
 *
 * **`ChapterFlow`（Provider の外側）で1回だけ呼ぶ。** `ReactFlowProvider` を自分で置くと
 * React Flow 内部の `Wrapper` が「もう Provider がある」と見て素通りするので、
 * `<ReactFlow nodes=… edges=… fitView>` は**サーバー描画には一切届かない**。
 * initialNodes / initialEdges / initialWidth / initialHeight / fitView を Provider へ
 * 直接渡すのが唯一の経路で、渡し忘れると静的 HTML からカードも線も `<a>` も全部消える
 * （2026-08-18 に実際に消えていた。受け入れ確認は out/kinship.html の
 * `href="/emperors/` と `react-flow__edge-path` の件数を数えること）。
 */
function buildGraph(layout: KinshipLayout): { nodes: Node[]; edges: Edge[] } {
  // `handles` はサーバー描画のためにある（クライアントでは実要素を測るので不要）。
  const ports = (w: number, h: number) => [
    { type: "target" as const, position: Position.Top, x: w / 2, y: 0 },
    { type: "source" as const, position: Position.Bottom, x: w / 2, y: h },
  ];
  const nodes: Node[] = layout.nodes.map((p) => ({
    id: p.id,
    type: "person",
    position: { x: p.x, y: p.y },
    width: p.w,
    height: p.h,
    handles: ports(p.w, p.h),
    draggable: false,
    connectable: false,
    selectable: false,
    data: { person: p },
  }));
  for (const un of layout.unions) {
    nodes.push({
      id: un.id,
      type: "union",
      position: { x: un.x, y: un.y },
      width: un.w,
      height: un.h,
      handles: ports(un.w, un.h),
      draggable: false,
      connectable: false,
      selectable: false,
      data: { kind: un.kind },
    });
  }

  const edges: Edge[] = layout.edges.map((e) => {
    const s = EDGE_STYLE[e.kind];
    const style = {
      stroke: s.color ?? "var(--kinship-line)",
      strokeWidth: 1.6,
      strokeDasharray: s.dash,
      opacity: 0.85,
    };
    if (e.kind !== "succession") {
      return {
        id: e.id,
        type: "family",
        source: e.from,
        target: e.to,
        data: { busY: e.busY },
        style,
      } satisfies Edge;
    }
    // 継承だけは行き先が段の順に並ばない（禅譲は下から上へも走る）ので、
    // バスを決めずに React Flow の直角ルータへ渡す。
    return {
      id: e.id,
      type: "smoothstep",
      source: e.from,
      target: e.to,
      style,
      label: SUCCESSION_LABEL[e.categoryId ?? ""] ?? "継承",
      labelShowBg: true,
      labelBgPadding: [3, 1] as [number, number],
      labelBgStyle: { fill: "var(--kinship-canvas)" },
      labelStyle: { fill: "var(--kinship-succession)", fontSize: 10 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "var(--kinship-succession)" },
      zIndex: 5,
    } satisfies Edge;
  });

  return { nodes, edges };
}

/** 入口は前漢の高祖。**始皇帝ではない** — 秦の一族だけを見せても章の系譜が読めない。 */
const FIT_VIEW = { nodes: [{ id: "han-gaozu" }], minZoom: 0.7, maxZoom: 0.7 };
const MIN_ZOOM = 0.08;
const MAX_ZOOM = 2;

/** 図の中を動かすので Provider の内側に置く（`useReactFlow` は Provider が要る）。 */
export function ChapterFlow({
  layout,
  jumps,
}: {
  layout: KinshipLayout;
  jumps: KinshipJump[];
}) {
  const graph = useMemo(() => buildGraph(layout), [layout]);
  return (
    <ReactFlowProvider
      initialNodes={graph.nodes}
      initialEdges={graph.edges}
      initialWidth={layout.width}
      initialHeight={layout.height}
      fitView
      initialFitViewOptions={FIT_VIEW}
      initialMinZoom={MIN_ZOOM}
      initialMaxZoom={MAX_ZOOM}
    >
      <ChapterFlowInner layout={layout} jumps={jumps} graph={graph} />
    </ReactFlowProvider>
  );
}

function ChapterFlowInner({
  layout,
  jumps,
  graph,
}: {
  layout: KinshipLayout;
  jumps: KinshipJump[];
  graph: { nodes: Node[]; edges: Edge[] };
}) {
  const { nodes, edges } = graph;

  // 政権へ飛ぶ（A = Die Welt der Habsburger の上端ナビに当たる）。図は1画面に収まらないので、
  // **行き先を図の外に文字で出す**のがここでの「全体の把握」。
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
        className="flex shrink-0 flex-wrap items-center gap-1.5 border-b bg-background px-2 py-1.5"
      >
        {jumps.map((j) => (
          <Button
            key={j.regimeId}
            type="button"
            size="sm"
            variant={here === j.regimeId ? "secondary" : "outline"}
            aria-pressed={here === j.regimeId}
            onClick={() => jumpTo(j)}
          >
            {j.label}
            <span className="tabular-nums text-muted-foreground">{j.count}</span>
          </Button>
        ))}
      </nav>
      <div className="relative min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          width={layout.width}
          height={layout.height}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          // **全体を1画面に収めない。** 2981×4082px を 1156px 幅に収めると倍率 0.28 で
          // 字が読めなくなる（前回の取り下げ理由「俯瞰すると字が読めない」そのもの）。
          // 見本の A も1画面に収めていない — 図の入口へ寄せて開き、全体は MiniMap で見る。
          fitView
          fitViewOptions={FIT_VIEW}
          proOptions={{ hideAttribution: false }}
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
