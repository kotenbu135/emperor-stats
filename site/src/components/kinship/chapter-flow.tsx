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
  Controls,
  Handle,
  MarkerType,
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
  extraParent: { from: string; to: string; kind: "single" | "second" | "adoptive" }[];
  succession: {
    from: string;
    to: string;
    categoryId: string | null;
    relation: string | null;
  }[];
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

function UnionDot() {
  return (
    <div className="h-full w-full rounded-full" style={{ background: "var(--kinship-line)" }}>
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0" />
    </div>
  );
}

const nodeTypes = { person: PersonCard, union: UnionDot };

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
  const nodes: Node[] = useMemo(() => {
    // `handles` はサーバー描画のためにある（クライアントでは実要素を測るので不要）。
    // これが無いと **静的 HTML に親子の線が1本も出ない**。
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
      data: { person: p },
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
        data: {},
      });
    }
    return out;
  }, [layout]);

  const edges: Edge[] = useMemo(() => {
    const line = (dash?: string, color = "var(--kinship-line)") => ({
      stroke: color,
      strokeWidth: 1.6,
      strokeDasharray: dash,
      opacity: 0.85,
    });
    // **すべて直角の線にする**（2026-08-18「線のぐちゃぐちゃ感を徹底的に改善」）。
    // 既定の bezier は2点を最短で結ぶので、段をまたぐ線が斜めに走ってカードの裏を通り、
    // 図全体が曲線の束に見えていた。系図は直角に折れる線が読みやすい。
    const ORTH = "smoothstep" as const;
    const out: Edge[] = [];
    for (const un of layout.unions) {
      out.push({ id: `${un.id}-f`, type: ORTH, source: un.father, target: un.id, style: line() });
      out.push({
        id: `${un.id}-m`,
        type: ORTH,
        source: un.mother,
        target: un.id,
        style: line("3 3"),
      });
      for (const c of un.children) {
        out.push({ id: `${un.id}-${c}`, type: ORTH, source: un.id, target: c, style: line() });
      }
    }
    layout.extraParent.forEach((e, i) => {
      // single = 片親しか分かっていない子／second = 実父が2人記録されている（史料の異説）／
      // adoptive = 養親。**どれも「1本の親子線」ではないので見た目を分ける。**
      const dash = e.kind === "single" ? undefined : e.kind === "adoptive" ? "6 3" : "1 3";
      out.push({ id: `x${i}`, type: ORTH, source: e.from, target: e.to, style: line(dash) });
    });
    layout.succession.forEach((s, i) => {
      out.push({
        id: `s${i}`,
        source: s.from,
        target: s.to,
        // **カードの上を横切らせない。** 既定の bezier は2点を最短で結ぶので箱の裏を通る。
        // 直角に折れる smoothstep のほうが、段の隙間を縫って回り込む。
        type: "smoothstep",
        style: line("5 4", "var(--kinship-succession)"),
        label: SUCCESSION_LABEL[s.categoryId ?? ""] ?? "継承",
        labelShowBg: true,
        labelBgPadding: [3, 1],
        labelBgStyle: { fill: "var(--kinship-canvas)" },
        labelStyle: { fill: "var(--kinship-succession)", fontSize: 10 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--kinship-succession)" },
        zIndex: 5,
      });
    });
    return out;
  }, [layout]);

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
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          minZoom={0.08}
          maxZoom={2}
          // **全体を1画面に収めない。** 2981×4082px を 1156px 幅に収めると倍率 0.28 で
          // 字が読めなくなる（前回の取り下げ理由「俯瞰すると字が読めない」そのもの）。
          // 見本の A も1画面に収めていない — 図の入口へ寄せて開き、全体は MiniMap で見る。
          fitView
          // 入口は前漢の高祖。**始皇帝ではない** — 秦の一族は左上に固まっていて、
          // そこを最初に見せても章全体の系譜が読めない。
          fitViewOptions={{ nodes: [{ id: "han-gaozu" }], minZoom: 0.7, maxZoom: 0.7 }}
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
