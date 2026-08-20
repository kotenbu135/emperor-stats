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
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import { RubyText } from "@/components/ui/ruby-text";
import { EDGE_STYLE, type KinshipEdgeKind } from "@/lib/kinship/edge-style";
import { regimeBandColor } from "@/lib/kinship/band-color";

export interface KinshipPerson {
  id: string;
  emperorId: string | null;
  /** 表示名の全文（検索と読み上げに使う）。カードは `main` と `annot` に割って描く。 */
  label: string;
  main: string;
  /** 「竇氏〔孝文竇皇后〕」の〔〕の中。カードでは2行目に小さく出す。 */
  annot: string | null;
  /**
   * 王朝内の代数（第N代・皇帝カードのみ）。復位は在位ごとに別カウントなので配列
   * （晋恵帝= [2, 4] → 「第2・4代」）。dynastyOrder 未調査の政権（隋・唐・五代十国
   * など）は null — **在位順から推論しない**（Issue #69）。
   */
  ordinal?: number[] | null;
  /** ルビ記法つきの main / annot。サーバー側（chapter-page）が rubyOf で付ける。 */
  mainRuby?: string;
  annotRuby?: string | null;
  regimeId: string | null;
  isEmperor: boolean;
  gender: string | null;
  reignFrom: number | null;
  reignTo: number | null;
  birthYear: number | null;
  deathYear: number | null;
  portrait: string | null;
  focusY: number | null;
  /** 親族カードだけが持つ「その家の政権」（家族の線で最寄りの皇帝から写す）。 */
  familyRegimeId?: string | null;
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
  /** parents = 子がいる実の両親／marriage = 婚姻だけ／disputed = 実父の異説 */
  kind: "parents" | "marriage" | "disputed";
}

/**
 * 線1本。**形はレイアウト側が折れ線 `points` で決め切る**（図の座標系そのまま）。
 * ここで曲げ方を決めると、線がカードを突き抜けても機械で見られない — バスの共有・
 * 廊下・カードとの交差の勘定は build-kinship-layout.mjs 側にまとまっている。
 */
export interface KinshipEdge {
  id: string;
  kind: KinshipEdgeKind;
  from: string;
  to: string;
  points: [number, number][];
  categoryId?: string | null;
  /** 線上に出す続柄（遠祖の「祖父」「曾祖父」だけレイアウト側が入れる） */
  label?: string | null;
  /** ラベルの置き場所（往復の継承だけレイアウト側が指定。無ければ最長区間の中点） */
  labelAt?: [number, number] | null;
}

/**
 * 図の縦に敷く「おおよその時代」の帯。**年の目盛りではない** — 段は世代の順なので
 * 年は 4% ほど前後する。作り方と、数値の軸にしない理由は build-kinship-layout.mjs 側。
 */
export interface KinshipEraBand {
  y0: number;
  y1: number;
  year: number;
  label: string;
}

export interface KinshipLayout {
  eraId: string;
  width: number;
  height: number;
  cardW: number;
  cardH: number;
  layers: number;
  eraBands: KinshipEraBand[];
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

/**
 * カードの2行目。**皇帝は在位年・それ以外は生没年**という別物を同じ形で出していて
 * 「在位なのか生没なのか分からない」と言われた（2026-08-18）。皇帝側に「在位」を付け、
 * 片方しか分かっていない人には**生／没のどちらなのか1字で添える**。
 */
function yearLine(p: KinshipPerson): string {
  const f = (y: number) => (y < 0 ? `前${-y}` : `${y}`);
  if (p.isEmperor) {
    if (p.reignFrom == null && p.reignTo == null) return "";
    if (p.reignFrom != null && p.reignTo != null)
      return `在位 ${f(p.reignFrom)}–${f(p.reignTo)}`;
    return `在位 ${f((p.reignFrom ?? p.reignTo) as number)}`;
  }
  if (p.birthYear != null && p.deathYear != null)
    return `${f(p.birthYear)}–${f(p.deathYear)}`;
  if (p.birthYear != null) return `${f(p.birthYear)}生`;
  if (p.deathYear != null) return `${f(p.deathYear)}没`;
  return "";
}

/** カード下帯の色。皇帝は政権色、それ以外は性別で分ける（2026-08-18 ユーザー指示）。 */
function bandOf(p: KinshipPerson): string {
  if (p.isEmperor) return regimeBandColor(p.regimeId);
  if (p.gender === "female") return "var(--kinship-kin-band-female)";
  return "var(--kinship-kin-band)";
}

/**
 * カードの4つの口。**上下だけでは足りない** — 継承（禅譲など）は段が同じ2人を結ぶことが
 * あり、上下の口でつなぐと線が必ずどちらかのカードを潜る（2026-08-18「禅譲の線がなるべく
 * 線やカードを横切らないように」）。`ports()` が返すサーバー描画用の配列と対で動かすこと。
 */
function CardPorts() {
  const hide = "!bg-transparent !border-0";
  return (
    <>
      <Handle id="t" type="target" position={Position.Top} className={hide} />
      <Handle id="b" type="source" position={Position.Bottom} className={hide} />
      {/* 左右は継承の線が出入りする。**向きが決まらないので source と target を両方置く**
          （片方だけだと、行き先が左にある禅譲で「source の口が無い」となって線が消える）。 */}
      <Handle id="ls" type="source" position={Position.Left} className={hide} />
      <Handle id="lt" type="target" position={Position.Left} className={hide} />
      <Handle id="rs" type="source" position={Position.Right} className={hide} />
      <Handle id="rt" type="target" position={Position.Right} className={hide} />
    </>
  );
}

function PersonCard({ data }: NodeProps<Node<{ person: KinshipPerson }>>) {
  const p = data.person;
  const fill = bandOf(p);
  // **皇帝以外は名前と年の帯だけ**（2026-08-18 ユーザー指示）。肖像アセットは皇帝にしか
  // 無いので、縦長の枠を用意しても中身は姓一文字のモノグラムにしかならなかった。
  const ink = p.isEmperor ? "#fff" : "var(--foreground)";
  // **親族カードでは帯が箱いっぱいまで伸びる。** 生没年がどちらも分かっていない人が
  // 70 人中 22 人いて、帯を内容ぶんの高さにすると下が地色のまま残る（＝カードが
  // 半分だけ塗られた別種の箱に見えた）。
  // 親族カードの左端に「その家の政権」の色を 4px 立てる（2026-08-19 ユーザー指示
  // 「同じ王朝の人物をわかりやすく表示したい」）。帯の色そのものを政権色に混ぜると
  // 男女の区別（帯2色）と白文字のコントラスト基準が崩れるので、縁の1本にとどめる。
  const stripe =
    !p.isEmperor && p.familyRegimeId
      ? `inset 4px 0 0 0 ${regimeBandColor(p.familyRegimeId)}`
      : undefined;
  const band = (
    <div
      className={`px-1.5 py-1 text-center leading-tight ${p.isEmperor ? "" : "flex flex-1 flex-col justify-center"}`}
      style={{ background: fill, boxShadow: stripe }}
    >
      {/* 王朝内の代数。dynastyOrder が確定している政権だけに出る（隋・唐・五代十国は
          未調査で出ない — 在位順から推論しない・Issue #69）。 */}
      {p.ordinal?.length ? (
        <div className="text-[9px] leading-tight tabular-nums" style={{ color: ink, opacity: 0.85 }}>
          第{p.ordinal.join("・")}代
        </div>
      ) : null}
      <div className="truncate text-[13px] font-semibold" style={{ color: ink }}>
        <RubyText source={p.mainRuby ?? p.main} />
      </div>
      {/* 補足（「竇氏〔孝文竇皇后〕」の〔〕の中）は2行目へ。**1行に詰めると切り詰めが出る**
          — 幅を広げると全員ぶん図が太るので、高さで解く（2026-08-18 の外部レビュー）。 */}
      {p.annot ? (
        <div className="truncate text-[9.5px] leading-[1.15]" style={{ color: ink, opacity: 0.92 }}>
          <RubyText source={p.annotRuby ?? p.annot} />
        </div>
      ) : null}
      {/* **年は白のまま落とさない。** 帯の色は「白文字が 4.5:1」で決めてあるので、
          薄めると小さい字だけがその基準を割る。字は 10px では読めないと言われたので 11px。 */}
      <div className="truncate text-[11px] tabular-nums" style={{ color: ink }}>
        {yearLine(p)}
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
          // **肖像は35人中15人にしかない。** 残り20枚を薄い箱＋灰色の1字にしていたので
          // 「サイズの不統一」「下部エリアのコントラスト不足」と読まれた（2026-08-18 の
          // 外部レビュー）。政権色をごく薄く敷き、字をその色で大きく出す。
          // **一文字をただ大きく置くと間延びする**（2026-08-18 の外部レビュー）。
          // 肖像の代わりだと分かる形＝印章の面にして、余白ではなく図形で埋める。
          <span
            className="flex h-full w-full items-center justify-center"
            style={{ background: `color-mix(in srgb, ${fill} 9%, var(--kinship-portrait-bg))` }}
          >
            <span
              className="flex h-[54px] w-[54px] items-center justify-center rounded-[7px] font-heading text-[26px] leading-none text-white"
              style={{ background: fill, boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.45)" }}
            >
              {p.main.charAt(0)}
            </span>
          </span>
        )}
      </div>
      {band}
    </>
  ) : (
    band
  );

  // 縁は `--kinship-card-edge`（地に対して 3.02:1）。`border-black/25` だと下地が
  // 透けて実効 1.9:1 まで落ち、カードが地に溶けていた（2026-08-18 の外部レビュー）。
  const shell =
    "flex h-full w-full flex-col overflow-hidden rounded-[3px] border-[1.5px] border-[var(--kinship-card-edge)] bg-card shadow-sm";

  // **Handle が無いと線が1本も描かれない。** サーバー描画のときはノードの `handles`
  // プロパティが位置を代行するが、クライアントで hydrate したあとは実要素の位置を測る。
  const ports = <CardPorts />;

  if (!p.emperorId)
    return (
      <div className={shell}>
        {ports}
        {body}
      </div>
    );
  return (
    // **`pointer-events-auto` を外さないこと。** ノードは draggable/selectable とも false
    // なので React Flow がラッパーに `pointer-events: none` を敷き、クリックが <a> に
    // 届かない（2026-08-19「クリックしたら個別ページに遷移するようにする」が効かなかった
    // 原因）。リンクだけ明示的に受け直す。ドラッグでのパンは mousedown が pane まで
    // バブルするので生きていて、パン後のクリックは d3-zoom が抑止する（実測済み）。
    <a
      href={`/emperors/${p.emperorId}`}
      className={`${shell} pointer-events-auto hover:border-[var(--kinship-line)]`}
    >
      {ports}
      {body}
    </a>
  );
}

function UnionDot(_props: NodeProps<Node<{ kind: KinshipUnion["kind"] }>>) {
  // 夫婦の横棒の中点に置く**見えない結節点**。線（夫婦の横棒・子の下ろし線）の端を
  // つなぐためだけにあり、一般的な家系図に倣って点は描かない（2026-08-19 ユーザー指示
  // 「一般的な家系図みたいなつなぎ方にして」で、結び目の黒点は横棒に置き換えた。
  // 実父の異説＝呂不韋も、点線の夫婦線そのものが異説を名乗るので記号は重ねない）。
  return (
    <div className="relative h-full w-full">
      <CardPorts />
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
/**
 * レイアウトが決めた折れ線をそのまま引く。**角丸を付けない**
 * （2026-08-18「不要な曲がりが発生していてキモい」）。
 */
function FamilyEdge({
  id,
  data,
  style,
  markerEnd,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
}: EdgeProps) {
  const pts = (data?.points as [number, number][] | undefined) ?? [];
  if (pts.length < 2) return null;
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  // ラベルはいちばん長い区間の真ん中に置く（折れ点に置くとカードの角に重なる）。
  // **往復の継承（簒奪⇄復位）だけはレイアウト側の指定（labelAt）** — 2本の最長区間が
  // 12px 差で並走するので、中点に置くとチップが重なって読めない。
  const labelAt = data?.labelAt as [number, number] | null | undefined;
  let mid = pts[0];
  let best = -1;
  for (let i = 1; i < pts.length; i += 1) {
    const len = Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
    if (len > best) {
      best = len;
      mid = [(pts[i][0] + pts[i - 1][0]) / 2, (pts[i][1] + pts[i - 1][1]) / 2];
    }
  }
  return (
    <BaseEdge
      id={id}
      path={d}
      style={style}
      markerEnd={markerEnd}
      label={label}
      labelX={labelAt?.[0] ?? mid[0]}
      labelY={labelAt?.[1] ?? mid[1]}
      labelStyle={labelStyle}
      labelShowBg={labelShowBg}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
    />
  );
}

const nodeTypes = { person: PersonCard, union: UnionDot };
const edgeTypes = { family: FamilyEdge };

// 線の見た目 EDGE_STYLE は src/lib/kinship/edge-style.ts（"use client" なし）にある。
// **この client モジュールから re-export しないこと** — Server Component の
// chapter-page が import すると client reference に化けて中身が落ちる（Issue #204）。

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
  // **`CardPorts` と同じ4つ・同じ id で並べること** — 片方だけ増やすと、静的 HTML と
  // クライアントで線の出入り口が変わる。
  const ports = (w: number, h: number) => [
    { id: "t", type: "target" as const, position: Position.Top, x: w / 2, y: 0 },
    { id: "b", type: "source" as const, position: Position.Bottom, x: w / 2, y: h },
    { id: "ls", type: "source" as const, position: Position.Left, x: 0, y: h / 2 },
    { id: "lt", type: "target" as const, position: Position.Left, x: 0, y: h / 2 },
    { id: "rs", type: "source" as const, position: Position.Right, x: w, y: h / 2 },
    { id: "rt", type: "target" as const, position: Position.Right, x: w, y: h / 2 },
  ];
  const at = new Map(layout.nodes.map((n) => [n.id, n]));
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
      strokeWidth: s.width ?? 1.9,
      strokeDasharray: s.dash,
      strokeLinecap: "round" as const,
      opacity: 0.9,
    };
    const base = {
      id: e.id,
      type: "family",
      source: e.from,
      target: e.to,
      data: { points: e.points, labelAt: e.labelAt ?? null },
      style,
    };
    if (e.kind !== "succession") {
      const plain = { ...base, sourceHandle: "b", targetHandle: "t" };
      if (e.kind !== "adoptive" && e.kind !== "remote") return plain satisfies Edge;
      // 養親と遠祖の線は章に数本しか無いうえ、一点鎖線だけでは「なぜこの2人が
      // つながるのか」が読めない（2026-08-19「明德馬皇后の関係性がわかりにくい」）。
      // 継承の線と同じ作法で、線の上に関係を1語だけ載せる（遠祖の語はレイアウト側が
      // relationDetail から決めて e.label に入れてくる）。
      const a = at.get(e.from);
      return {
        ...plain,
        label:
          e.kind === "remote"
            ? (e.label ?? "遠祖")
            : a?.gender === "female"
              ? "養母"
              : "養父",
        labelShowBg: true,
        labelBgPadding: [5, 2] as [number, number],
        labelBgBorderRadius: 3,
        labelBgStyle: {
          fill: "var(--kinship-canvas)",
          stroke: "var(--kinship-line)",
          strokeWidth: 0.75,
          strokeOpacity: 0.4,
        },
        labelStyle: { fill: "var(--kinship-line)", fontSize: 10.5, fontWeight: 600 },
      } satisfies Edge;
    }
    // 横向き（継承）はカードの左右の口を使う。**行き先が右なら右の口から出る** —
    // 逆に取ると線が出どころのカードを一周する。
    const a = at.get(e.from);
    const b = at.get(e.to);
    const rightward = a && b ? b.x + b.w / 2 > a.x + a.w / 2 : true;
    return {
      ...base,
      sourceHandle: rightward ? "rs" : "ls",
      targetHandle: rightward ? "lt" : "rt",
      label: SUCCESSION_LABEL[e.categoryId ?? ""] ?? "継承",
      // ラベルの下に地色の板を敷いて方眼と線を隠す（2026-08-18 の外部レビュー）。
      labelShowBg: true,
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 3,
      labelBgStyle: { fill: "var(--kinship-canvas)", stroke: "var(--kinship-succession)", strokeWidth: 0.75, strokeOpacity: 0.5 },
      labelStyle: { fill: "var(--kinship-succession)", fontSize: 11, fontWeight: 600 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "var(--kinship-succession)" },
      zIndex: 5,
    } satisfies Edge;
  });

  return { nodes, edges };
}

/**
 * 「おおよその時代」の帯を図の地に敷く。
 *
 * **2枚に分けてある。** 塗りは図の座標系（＝拡大縮小に付いていく）だが、年の見出しは
 * **画面の左端に原寸で貼り付ける** — 図は 1229×5996px で縦にしか動かさないので、
 * 図の中に置くと画面外へ流れて「いま何年あたりを見ているか」が分からなくなる。
 */
function EraBandFill({ bands, width }: { bands: KinshipEraBand[]; width: number }) {
  const [tx, ty, zoom] = useStore((st) => st.transform);
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <g transform={`translate(${tx},${ty}) scale(${zoom})`}>
        {bands.map((b, i) =>
          i % 2 ? null : (
            <rect
              key={b.y0}
              x={-2000}
              y={b.y0}
              width={width + 4000}
              height={b.y1 - b.y0}
              fill="var(--kinship-era-band)"
            />
          ),
        )}
        {bands.slice(1).map((b) => (
          <line
            key={b.y0}
            x1={-2000}
            x2={width + 2000}
            y1={b.y0}
            y2={b.y0}
            stroke="var(--kinship-grid)"
            strokeWidth={1 / zoom}
          />
        ))}
      </g>
    </svg>
  );
}

function EraBandRuler({ bands }: { bands: KinshipEraBand[] }) {
  const [, ty, zoom] = useStore((st) => st.transform);
  // 画面に見えている高さ。**帯は画面より長い**ので、見出しは見えている範囲の
  // 真ん中へ寄せないと画面外へ出る。
  const paneH = useStore((st) => st.height);
  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 w-[112px] overflow-hidden">
      {bands.map((b) => {
        const top = ty + b.y0 * zoom;
        const bottom = ty + b.y1 * zoom;
        // **端に少しだけ覗いている帯には年を出さない。** 画面へ引き戻す clamp と
        // 合わさると、ほとんど画面外の帯の年が、別の帯のカードの真横に出る
        // （2026-08-18 に「前50年ごろ」が公孫述 25–36 の隣に出た写真を撮った）。
        const visible = Math.min(bottom, paneH) - Math.max(top, 0);
        return (
          <div key={b.y0}>
            {/* **範囲であることを形で言う。** ただの吹き出しだと「この一点が前200年」と
                読まれるが、帯が主張しているのは「この範囲がだいたいその辺り」。 */}
            <span
              aria-hidden
              className="absolute left-2 w-[3px] rounded-full"
              style={{
                top: Math.max(top, -20),
                height: Math.max(0, Math.min(bottom, paneH + 20) - Math.max(top, -20)),
                background: "color-mix(in srgb, var(--kinship-line) 55%, transparent)",
              }}
            />
            {visible < 56 ? null : (
            <span
              className="absolute left-[18px] -translate-y-1/2 rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums whitespace-nowrap"
              style={{
                // 左下は拡大縮小のボタンが居るので、そこへは降ろさない
                // （2026-08-18 に「前125年ごろ」がボタンの裏に隠れた写真を撮った）。
                top: Math.min(
                  Math.max((Math.max(top, 0) + Math.min(bottom, paneH + 20)) / 2, 16),
                  Math.max(16, paneH - 104),
                ),
                // muted は地に対して 4.06:1 で小さい字の基準を割る（2026-08-18 の
                // 外部レビュー）。図の線と同じ濃さ（4.63:1）に上げる。
                background: "color-mix(in srgb, var(--kinship-canvas) 60%, white)",
                borderColor: "var(--kinship-card-edge)",
                color: "var(--kinship-line)",
              }}
            >
              {b.label}
            </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 人物を名前で探して図をそこへ寄せる。**図が 6,000px 近くあるのに探す手段が無い**
 * （2026-08-18 の外部レビュー）。105 人しか居ないので素の部分一致で足りる。
 * 置き場所は図の中（`Panel`）— 上の帯へ足すと 1440px で折り返して、同じレビューの
 * 「ヘッダーが図を圧迫している」を悪化させる。
 */
function PersonSearch({
  people,
  onPick,
}: {
  people: KinshipPerson[];
  onPick: (p: KinshipPerson) => void;
}) {
  const [q, setQ] = useState("");
  const deferred = useDeferredValue(q);
  const box = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => {
    const k = deferred.trim();
    if (!k) return [];
    return people.filter((p) => p.label.includes(k)).slice(0, 8);
  }, [deferred, people]);
  return (
    <div className="w-56">
      <input
        ref={box}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="人物を名前で探す"
        aria-label="人物を名前で探す"
        // 地がベージュなので既定の border では枠が見えない（2026-08-18 の外部レビュー）。
        className="w-full rounded-md border-[1.5px] border-[var(--kinship-card-edge)] bg-background px-2 py-1 text-sm shadow-md outline-none placeholder:text-foreground/65 focus-visible:outline-2 focus-visible:outline-seal"
      />
      {hits.length ? (
        <ul className="mt-1 overflow-hidden rounded-md border bg-background shadow-md">
          {hits.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full items-baseline gap-2 px-2 py-1 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-seal"
                onClick={() => {
                  onPick(p);
                  setQ("");
                  box.current?.blur();
                }}
              >
                <span className="truncate">{p.label}</span>
                <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {yearLine(p)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * 入口の皇帝は章ごとに決める（page 側の章の表が持つ）。秦・漢は前漢の高祖 —
 * **始皇帝ではない**（秦の一族だけを見せても章の系譜が読めない）。
 */
/**
 * 初期表示・ジャンプ・検索で寄るときの倍率。0.7 から1段階（ズームボタンの1押し＝
 * ×1.2）寄せた値（2026-08-19 ユーザー指示「1段階ズームした状態をデフォルトに」）。
 */
const ENTRY_ZOOM = 0.84;
const fitViewFor = (entryId: string) => ({
  nodes: [{ id: entryId }],
  minZoom: ENTRY_ZOOM,
  maxZoom: ENTRY_ZOOM,
});
const MIN_ZOOM = 0.08;
const MAX_ZOOM = 2;
/** このキーを押しながらのホイールだけ拡大縮小（WSL/Windows は Control・Mac は Meta）。 */
const ZOOM_KEYS = ["Meta", "Control"];
/** 図の縁からこれ以上は外へ動かせない（2026-08-19「どこまでも下に動かせてしまう」）。 */
const PAN_MARGIN = 160;

/** 図の中を動かすので Provider の内側に置く（`useReactFlow` は Provider が要る）。 */
export function ChapterFlow({
  layout,
  jumps,
  entryId,
  legend,
}: {
  layout: KinshipLayout;
  jumps: KinshipJump[];
  entryId: string;
  /** ツールバー右端に出す凡例のポップオーバー（中身は chapter-page.tsx が組む） */
  legend?: React.ReactNode;
}) {
  const graph = useMemo(() => buildGraph(layout), [layout]);
  const fitView = useMemo(() => fitViewFor(entryId), [entryId]);
  return (
    <ReactFlowProvider
      initialNodes={graph.nodes}
      initialEdges={graph.edges}
      initialWidth={layout.width}
      initialHeight={layout.height}
      fitView
      initialFitViewOptions={fitView}
      initialMinZoom={MIN_ZOOM}
      initialMaxZoom={MAX_ZOOM}
    >
      <ChapterFlowInner layout={layout} jumps={jumps} graph={graph} fitView={fitView} legend={legend} />
    </ReactFlowProvider>
  );
}

function ChapterFlowInner({
  layout,
  jumps,
  graph,
  fitView,
  legend,
}: {
  layout: KinshipLayout;
  jumps: KinshipJump[];
  graph: { nodes: Node[]; edges: Edge[] };
  fitView: ReturnType<typeof fitViewFor>;
  legend?: React.ReactNode;
}) {
  const { nodes, edges } = graph;

  // 政権へ飛ぶ（A = Die Welt der Habsburger の上端ナビに当たる）。図は1画面に収まらないので、
  // **行き先を図の外に文字で出す**のがここでの「全体の把握」。
  const { setViewport, getViewport } = useReactFlow();
  const paneRef = useRef<HTMLDivElement>(null);
  // **撮影の道具（tools/shoot-kinship.mjs）が図を動かすための口。**
  // 道具は `.react-flow__viewport` の CSS transform を直に書き換えていて、それだと
  // React Flow の store が更新されない — 結果、store を読んでいる「時代の帯」と
  // 「左端の年」だけが動かない写真が撮れる（2026-08-18 に実際に撮った。図の欠陥に
  // 見えるが図は正しく、嘘をついていたのは道具のほう）。**消すと同じ写真に戻る。**
  useEffect(() => {
    const w = window as unknown as { __kinshipSetViewport?: typeof setViewport };
    w.__kinshipSetViewport = setViewport;
    return () => {
      delete w.__kinshipSetViewport;
    };
  }, [setViewport]);
  const extent = useMemo<[[number, number], [number, number]]>(
    () => [
      [-PAN_MARGIN, -PAN_MARGIN],
      [layout.width + PAN_MARGIN, layout.height + PAN_MARGIN],
    ],
    [layout.width, layout.height],
  );
  const [here, setHere] = useState<string | null>(null);
  /**
   * d3-zoom が translateExtent に掛ける制約と同じ式で1軸を丸める。
   * **余白込みの図が画面より狭い軸は、位置に自由が無く中央へ固定される**（d3 の仕様）。
   * `setCenter` はこの制約を通らないので、制約の外の座標へ動かすと**次のドラッグ・
   * ホイールの開始時に d3 が補正し、画面がぱっと飛ぶ**（2026-08-19 ユーザー指摘。
   * 秦・漢の図が 1260px に縮み、0.7倍で画面より狭くなって顕在化した）。
   * ジャンプ・検索・初期表示の側で先に同じ制約を適用して、飛びの余地を消す。
   */
  const clampAxis = useCallback(
    (t: number, k: number, pane: number, e0: number, e1: number) => {
      const tMin = pane - e1 * k;
      const tMax = -e0 * k;
      if (tMin > tMax) return (tMin + tMax) / 2; // 自由が無い軸は d3 と同じく中央固定
      return Math.min(Math.max(t, tMin), tMax);
    },
    [],
  );
  const clampViewport = useCallback(
    (v: { x: number; y: number; zoom: number }) => {
      const rect = paneRef.current?.getBoundingClientRect();
      if (!rect) return v;
      return {
        x: clampAxis(v.x, v.zoom, rect.width, -PAN_MARGIN, layout.width + PAN_MARGIN),
        y: clampAxis(v.y, v.zoom, rect.height, -PAN_MARGIN, layout.height + PAN_MARGIN),
        zoom: v.zoom,
      };
    },
    [clampAxis, layout.width, layout.height],
  );
  // ジャンプのアニメ（600ms）の途中で掴むと、d3 の interpolateZoom が描く弧の上の
  // 未補正な座標から制約が掛かってやはり飛ぶ。finishAnim で**掴んだ瞬間にジャンプを
  // 完了させる**ための「進行中のアニメの行き先」。
  const anim = useRef<{ until: number; to: { x: number; y: number; zoom: number } } | null>(null);
  const centerOn = useCallback(
    (n: KinshipPerson) => {
      const rect = paneRef.current?.getBoundingClientRect();
      if (!rect) return;
      const k = ENTRY_ZOOM;
      const to = clampViewport({
        x: rect.width / 2 - (n.x + n.w / 2) * k,
        y: rect.height / 2 - (n.y + n.h / 2) * k,
        zoom: k,
      });
      anim.current = { until: Date.now() + 650, to };
      void setViewport(to, { duration: 600 });
    },
    [setViewport, clampViewport],
  );
  // 初期表示（fitView）も d3 の制約を通っていないので、最初の操作で同じ飛びが出る。
  // **onInit（React Flow が初期 fitView を終えた後）で一度だけ丸める** — マウントの
  // effect では早すぎて、直後の fitView が丸めた値を上書きして戻した（実測）。
  const clampNow = useCallback(() => {
    const v = getViewport();
    const c = clampViewport(v);
    if (Math.abs(c.x - v.x) > 0.5 || Math.abs(c.y - v.y) > 0.5) void setViewport(c);
  }, [getViewport, setViewport, clampViewport]);
  // ジャンプのアニメ（600ms）の途中で掴むと、d3 の interpolateZoom が描く弧の上の
  // 未補正な座標から制約が掛かってやはり飛ぶ。**掴んだ瞬間にジャンプを完了させる**。
  const finishAnim = useCallback(() => {
    const a = anim.current;
    if (a && Date.now() < a.until) {
      anim.current = null;
      void setViewport(a.to);
    }
  }, [setViewport]);
  const jumpTo = useCallback(
    (j: KinshipJump) => {
      const n = layout.nodes.find((p) => p.id === j.nodeId);
      if (!n) return;
      setHere(j.regimeId);
      centerOn(n);
    },
    [layout, centerOn],
  );

  return (
    <div
      // **高さを直値で持たない。** 凡例を畳めるようにしたので、畳んだぶんはそのまま
      // 図の面積になる（外側の main が `h-[calc(100vh-4rem)] flex-col`）。
      className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border"
      style={{ background: "var(--kinship-canvas)" }}
    >
      <nav
        aria-label="政権へジャンプ"
        className="flex shrink-0 flex-wrap items-center gap-1.5 border-b bg-background px-2 py-1.5"
      >
        {/* 「集計表なのかボタンなのか分からない」と外部レビューで言われたので、
            何をする並びなのかを頭に書く（2026-08-18）。 */}
        <span className="mr-0.5 shrink-0 text-xs text-muted-foreground">政権へ移動</span>
        {jumps.map((j) => (
          <Button
            key={j.regimeId}
            type="button"
            size="sm"
            variant={here === j.regimeId ? "secondary" : "outline"}
            aria-pressed={here === j.regimeId}
            onClick={() => jumpTo(j)}
          >
            {/* **図と同じ政権色の点**を頭に付ける。ただの枠付き文字に見えて押せると
                思われなかった（2026-08-18 の外部レビュー2巡目）。凡例の色見本と同じ形。 */}
            <span
              aria-hidden
              className="inline-block size-2.5 shrink-0 rounded-[2px]"
              style={{ background: regimeBandColor(j.regimeId) }}
            />
            {j.label}
            <span className="tabular-nums text-muted-foreground">{j.count}人</span>
          </Button>
        ))}
        {/* 凡例はこの帯の右端から <details> のポップオーバーで開く（既定は閉じる・
            開いても図を押し下げない）。中身は chapter-page.tsx が組んで渡す。 */}
        {legend ? <div className="ml-auto">{legend}</div> : null}
      </nav>
      <div
        ref={paneRef}
        className="relative min-h-0 flex-1"
        onPointerDownCapture={finishAnim}
        onWheelCapture={finishAnim}
      >
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
          // **ホイールは移動・拡大縮小は Ctrl/⌘＋ホイールかピンチ**（2026-08-19 ユーザー指示
          // 「スクロールしたら下に移動するようにする、拡大縮小は直感的な操作に反する」）。
          // 図は縦 5,000px 超なので、ホイール＝縦移動が地図系ツールの既定と同じ手触りになる。
          zoomOnScroll={false}
          panOnScroll
          zoomActivationKeyCode={ZOOM_KEYS}
          translateExtent={extent}
          // **全体を1画面に収めない。** 2981×4082px を 1156px 幅に収めると倍率 0.28 で
          // 字が読めなくなる（前回の取り下げ理由「俯瞰すると字が読めない」そのもの）。
          // 見本の A も1画面に収めていない — 図の入口へ寄せて開き、全体は MiniMap で見る。
          fitView
          fitViewOptions={fitView}
          onInit={clampNow}
          proOptions={{ hideAttribution: false }}
        >
          {/* 縦横の方眼は**時代の帯に置き換えた**（2026-08-18 の外部レビュー: 方眼が濃い・
              縦軸の基準が無い）。方眼は意味を持たないうえ線と紛れるので、地は点だけにする。 */}
          <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="var(--kinship-grid)" />
          <EraBandFill bands={layout.eraBands} width={layout.width} />
          <EraBandRuler bands={layout.eraBands} />
          <Panel position="top-right">
            <PersonSearch people={layout.nodes} onPick={centerOn} />
          </Panel>
          {/* 地と同色だとどこからがミニマップか分からない（2026-08-18 の外部レビュー）。
              枠と影で浮かせる。 */}
          <MiniMap
            pannable
            zoomable
            // 105 個の点が一様な灰色だと全体の構造が読めず、ただの模様になる
            // （2026-08-18 の外部レビュー2巡目）。図と同じ政権色で塗って、
            // 「どの帯がどの王朝か」が縮小しても分かるようにする。
            nodeColor={(n) => {
              const d = n.data as { person?: KinshipPerson } | undefined;
              if (!d?.person) return "var(--kinship-line)";
              return bandOf(d.person);
            }}
            nodeStrokeWidth={0}
            nodeBorderRadius={1}
            className="!rounded-md !border !border-black/20 !shadow-md"
            // 図は 1:4.9 の縦長なので、既定寸法だと 1 本の細い棒になって現在地が読めない
            // （2026-08-18 の外部レビュー）。高さを決めて枠と影で浮かせる。
            style={{ background: "var(--background)", width: 104, height: 300 }}
            maskColor="color-mix(in srgb, var(--kinship-canvas) 70%, transparent)"
          />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
