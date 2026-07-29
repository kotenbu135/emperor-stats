"use client";

// 系譜図の手動レイアウト編集モード(開発時のみ)。
//
// 使い方: npm run dev で /kinship?edit=qin-han (または ?edit=1 で最初の章)を開くと
// その章だけ編集可能になる。ドラッグで移動 → 右下パネルの「保存」で
// site/src/lib/kinship/manual-layout.json へ書き込む(別途 npm run kinship-editor で
// 保存サーバを起動しておく)。保存した章は mode:"manual" になり、以後は自動配置に
// 上書きされない(凍結)。
//
// 動かせるもの:
// - 皇帝カプセル(横のみ。縦=在位期間は年目盛りに固定)
// - 非皇帝のピル・配偶者(縦横)。Shift+ドラッグでその人の子孫・配偶者ごと移動
// - 見出し・ラベルの文字(バンド名/王朝名/矢印ラベル/続柄ラベル)
// - 線の付け根(補助線・遠祖主張の点線の両端)と、折れ線の通り道、垂下線の降り口
//
// 操作: ドラッグ中は他ノードの辺・中心に吸着しガイド線を表示(Altで一時解除)。
// クリックで選択して矢印キー1px(Shift+8px)移動。Ctrl+Zで取り消し。
//
// 仕組み: ドラッグ中はSVG要素にtransformを当てるだけ(即応)。離した時点で
// ブラウザ側で buildKinshipLayout をやり直し、線・兄弟バー・違反判定を作り直す。
// レイアウト計算の入力は /kinship-source(開発時のみ実データ)から取得する。

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { BASE_PATH } from "@/lib/base-path";
import type { KinshipChapterLayout, KinshipSource } from "@/lib/kinship/layout";
import type { ManualAnchor, ManualLayout } from "@/lib/kinship/manual";
import { PRE_RATE, PX_PER_YEAR } from "@/lib/kinship/tree";

const SAVE_URL = "http://localhost:4123/save";
const SNAP = 6; // 吸着のしきい値(px)

type DragKind = "node" | "label" | "anchor" | "mid" | "junction";

interface DragState {
  kind: DragKind;
  key: string;
  els: SVGGraphicsElement[];
  startClientX: number;
  startClientY: number;
  scale: number;
  ox: number;
  oy: number;
  w: number;
  h: number;
  lockY: boolean;
  /** 付け根ドラッグ: 取り付く相手のノードid。 */
  ownerId?: string;
  /** 付け根ドラッグ: 補助線のキーと端。 */
  edgeKey?: string;
  edgeEnd?: "from" | "to";
  /** 通り道(mid)ドラッグが横方向か。 */
  midHorizontal?: boolean;
  /** 直近のドラッグ量(pointerupで確定に使う)。 */
  el0?: { dx: number; dy: number };
}

export interface KinshipEditorApi {
  active: boolean;
  layout: KinshipChapterLayout;
  onNodePointerDown?: (
    ev: React.PointerEvent<SVGGElement>,
    id: string,
    isEmperor: boolean,
  ) => void;
  violationIds: Set<string>;
  selectedId: string | null;
  /** SVG内に重ねて描く編集用レイヤ(ガイド線・ハンドル・当たり判定)。 */
  overlay: React.ReactNode;
  panel: React.ReactNode;
}

/** px → 年(章の時間軸の逆変換)。 */
function yearAt(layout: KinshipChapterLayout, py: number): number {
  const { startYear, zeroY } = layout.axis;
  return py >= zeroY
    ? startYear + (py - zeroY) / PX_PER_YEAR
    : startYear - (zeroY - py) / PRE_RATE;
}

/** "M x y L x y …" の点列を取り出す。 */
function pathPoints(d: string): [number, number][] {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts;
}

/** 点を矩形の周上へ写して {辺, 辺上の位置} にする。 */
function toAnchor(
  r: { x: number; y: number; w: number; h: number },
  px: number,
  py: number,
): ManualAnchor {
  const dl = Math.abs(px - r.x);
  const dr = Math.abs(px - (r.x + r.w));
  const dt = Math.abs(py - r.y);
  const db = Math.abs(py - (r.y + r.h));
  const m = Math.min(dl, dr, dt, db);
  const clamp = (v: number) => Math.min(Math.max(v, 0), 1);
  if (m === dl) return { side: "L", t: clamp((py - r.y) / r.h) };
  if (m === dr) return { side: "R", t: clamp((py - r.y) / r.h) };
  if (m === dt) return { side: "T", t: clamp((px - r.x) / r.w) };
  return { side: "B", t: clamp((px - r.x) / r.w) };
}

/** ドラッグ中のガイド線(チャート全体を再描画しないよう独立コンポーネント)。 */
interface GuideHandle {
  set: (g: { x?: number; y?: number }) => void;
}
function GuideLayer({
  ref,
  height,
  width,
}: {
  ref: React.RefObject<GuideHandle | null>;
  height: number;
  width: number;
}) {
  const [g, setG] = useState<{ x?: number; y?: number }>({});
  useImperativeHandle(ref, () => ({ set: setG }), []);
  return (
    <>
      {g.x !== undefined && (
        <line x1={g.x} y1={0} x2={g.x} y2={height} stroke="var(--seal)" strokeWidth={0.8} strokeDasharray="4 3" />
      )}
      {g.y !== undefined && (
        <line x1={0} y1={g.y} x2={width} y2={g.y} stroke="var(--seal)" strokeWidth={0.8} strokeDasharray="4 3" />
      )}
    </>
  );
}

export function useKinshipEditor(server: KinshipChapterLayout): KinshipEditorApi {
  const [active, setActive] = useState(false);
  const [layout, setLayout] = useState(server);
  const [manual, setManual] = useState<ManualLayout | null>(null);
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** 選択中の王朝交代の矢印(キー)。直線／直角の切り替え対象。 */
  const [selectedArrowKey, setSelectedArrowKey] = useState<string | null>(null);
  const [showHandles, setShowHandles] = useState(true);
  const srcRef = useRef<KinshipSource | null>(null);
  const buildRef = useRef<
    ((src: KinshipSource, manual?: ManualLayout) => KinshipChapterLayout[]) | null
  >(null);
  const dragRef = useRef<DragState | null>(null);
  const undoRef = useRef<ManualLayout[]>([]);
  const guideRef = useRef<GuideHandle | null>(null);
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // --- 起動: ?edit=<章id>|1 かつ開発時のみ ---
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const q = new URLSearchParams(window.location.search).get("edit");
    if (!q || (q !== "1" && q !== server.id)) return;
    let alive = true;
    void (async () => {
      const [layoutMod, manualMod, res] = await Promise.all([
        import("@/lib/kinship/layout"),
        import("@/lib/kinship/manual"),
        fetch(`${BASE_PATH}/kinship-source`),
      ]);
      const src = (await res.json()) as KinshipSource;
      if (!alive) return;
      if (!Array.isArray(src?.emperors)) {
        setStatus("入力データを取得できません(/kinship-source が空)");
        return;
      }
      srcRef.current = src;
      buildRef.current = layoutMod.buildKinshipLayout;
      // この章がまだ自動配置なら、現在の見た目をそのまま初期値として凍結する。
      const base: ManualLayout = JSON.parse(JSON.stringify(manualMod.MANUAL_LAYOUT));
      if (base[server.id]?.mode !== "manual") {
        base[server.id] = {
          mode: "manual",
          nodes: Object.fromEntries(
            server.nodes.map((n) => [
              n.id,
              n.kind === "emperor"
                ? { x: n.x }
                : { x: n.x, year: yearAt(server, n.y + n.h / 2) },
            ]),
          ),
          labels: {},
          edges: {},
          junctions: {},
        };
      }
      setManual(base);
      setActive(true);
      setStatus("編集モード（ドラッグで移動・保存で凍結）");
    })();
    return () => {
      alive = false;
    };
  }, [server]);

  // --- 手動座標が変わったらレイアウトを作り直す ---
  useEffect(() => {
    if (!active || !manual || !buildRef.current || !srcRef.current) return;
    try {
      const chapters = buildRef.current(srcRef.current, manual);
      const found = chapters.find((c) => c.id === server.id);
      if (found) setLayout(found);
    } catch (e) {
      setStatus(`再計算に失敗: ${(e as Error).message}`);
    }
  }, [active, manual, server.id]);

  // --- 子孫(+その配偶者)の集合。Shift+ドラッグでまとめて動かす ---
  const descendantsOf = useCallback(
    (id: string): string[] => {
      const src = srcRef.current;
      if (!src) return [id];
      const kids = new Map<string, string[]>();
      for (const e of src.edges) {
        if (e.type !== "kinship") continue;
        if (e.relation !== "実父" && e.relation !== "養父") continue;
        kids.set(e.from, [...(kids.get(e.from) ?? []), e.to]);
      }
      const out = new Set<string>([id]);
      const queue = [id];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const c of kids.get(cur) ?? [])
          if (!out.has(c)) {
            out.add(c);
            queue.push(c);
          }
      }
      for (const n of layoutRef.current.nodes)
        if (n.attachedTo && out.has(n.attachedTo)) out.add(n.id);
      return [...out].filter((x) => layoutRef.current.nodes.some((n) => n.id === x));
    },
    [],
  );

  const pushUndo = useCallback((prev: ManualLayout) => {
    undoRef.current = [...undoRef.current.slice(-99), prev];
  }, []);

  /** 手動座標の書き換え(1操作=1Undo)。 */
  const edit = useCallback(
    (fn: (ch: NonNullable<ManualLayout[string]>) => void) => {
      setManual((prev) => {
        if (!prev) return prev;
        pushUndo(prev);
        const next: ManualLayout = JSON.parse(JSON.stringify(prev));
        fn(next[server.id]);
        return next;
      });
      setStatus("未保存の変更があります");
    },
    [pushUndo, server.id],
  );

  const beginDrag = useCallback(
    (ev: React.PointerEvent, init: Omit<DragState, "startClientX" | "startClientY" | "scale" | "els"> & { els?: SVGGraphicsElement[] }) => {
      if (!active) return;
      ev.preventDefault();
      ev.stopPropagation();
      const el = ev.currentTarget as SVGGraphicsElement;
      const svg = el.ownerSVGElement;
      const scale = svg ? svg.getBoundingClientRect().width / svg.viewBox.baseVal.width : 1;
      try {
        el.setPointerCapture(ev.pointerId);
      } catch {
        /* 合成イベント等でキャプチャできない場合は無視(windowのlistenerで拾う) */
      }
      dragRef.current = {
        ...init,
        els: init.els ?? [el],
        startClientX: ev.clientX,
        startClientY: ev.clientY,
        scale: scale || 1,
      };
    },
    [active],
  );

  // --- ドラッグ中/終了 ---
  useEffect(() => {
    if (!active) return;
    const snapCandidates = () => {
      const xs: number[] = [];
      const ys: number[] = [];
      for (const n of layoutRef.current.nodes) {
        if (n.id === dragRef.current?.key) continue;
        xs.push(n.x, n.x + n.w / 2, n.x + n.w);
        ys.push(n.y, n.y + n.h / 2, n.y + n.h);
      }
      return { xs, ys };
    };
    let cand: { xs: number[]; ys: number[] } | null = null;

    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      let dx = (ev.clientX - d.startClientX) / d.scale;
      let dy = (ev.clientY - d.startClientY) / d.scale;
      if (d.lockY) dy = 0;
      let gx: number | undefined;
      let gy: number | undefined;
      if (!ev.altKey && (d.kind === "node" || d.kind === "label")) {
        cand = cand ?? snapCandidates();
        // 自分の左辺・中心・右辺のいずれかが他ノードの辺・中心に近ければ吸着。
        const edgesX = d.kind === "node" ? [d.ox, d.ox + d.w / 2, d.ox + d.w] : [d.ox];
        const edgesY = d.kind === "node" ? [d.oy, d.oy + d.h / 2, d.oy + d.h] : [d.oy];
        let best = SNAP;
        for (const e of edgesX)
          for (const c of cand.xs) {
            const diff = c - (e + dx);
            if (Math.abs(diff) < best) {
              best = Math.abs(diff);
              gx = c;
              dx += diff;
            }
          }
        if (!d.lockY) {
          let bestY = SNAP;
          for (const e of edgesY)
            for (const c of cand.ys) {
              const diff = c - (e + dy);
              if (Math.abs(diff) < bestY) {
                bestY = Math.abs(diff);
                gy = c;
                dy += diff;
              }
            }
        }
      }
      guideRef.current?.set({ x: gx, y: gy });
      for (const el of d.els) el.style.transform = `translate(${dx}px, ${dy}px)`;
      d.el0 = { dx, dy };
    };

    const up = () => {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      cand = null;
      guideRef.current?.set({});
      for (const el of d.els) el.style.transform = "";
      const dx = Math.round((d.el0?.dx ?? 0) * 2) / 2;
      const dy = Math.round((d.el0?.dy ?? 0) * 2) / 2;
      if (dx === 0 && dy === 0) {
        if (d.kind === "node") setSelectedId(d.key);
        return;
      }
      const lay = layoutRef.current;
      edit((ch) => {
        if (d.kind === "node") {
          for (const el of d.els) {
            const id = el.dataset.kid;
            if (!id) continue;
            const n = lay.nodes.find((x) => x.id === id);
            if (!n) continue;
            const cur = ch.nodes[id] ?? {};
            ch.nodes[id] = {
              ...cur,
              x: n.x + dx,
              ...(n.kind === "emperor" ? {} : { year: yearAt(lay, n.y + dy + n.h / 2) }),
            };
          }
        } else if (d.kind === "label") {
          ch.labels = { ...(ch.labels ?? {}), [d.key]: { x: d.ox + dx, y: d.oy + dy } };
        } else if (d.kind === "anchor") {
          const owner = lay.nodes.find((n) => n.id === d.ownerId);
          if (owner) {
            const a = toAnchor(owner, d.ox + dx, d.oy + dy);
            const e = { ...(ch.edges?.[d.edgeKey!] ?? {}) };
            e[d.edgeEnd!] = a;
            ch.edges = { ...(ch.edges ?? {}), [d.edgeKey!]: e };
          }
        } else if (d.kind === "mid") {
          const e = { ...(ch.edges?.[d.edgeKey!] ?? {}) };
          e.mid = d.midHorizontal ? d.ox + dx : d.oy + dy;
          ch.edges = { ...(ch.edges ?? {}), [d.edgeKey!]: e };
        } else if (d.kind === "junction") {
          ch.junctions = { ...(ch.junctions ?? {}), [d.key]: d.ox + dx };
        }
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [active, edit]);

  // --- 矢印キーで選択ノードを微調整 ---
  useEffect(() => {
    if (!active) return;
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.target as HTMLElement)?.tagName === "INPUT") return;
      if (ev.key === "z" && (ev.ctrlKey || ev.metaKey)) {
        ev.preventDefault();
        const prev = undoRef.current.pop();
        if (prev) {
          setManual(prev);
          setStatus("1つ戻しました（未保存）");
        }
        return;
      }
      if (ev.key === "Escape") {
        setSelectedId(null);
        setSelectedArrowKey(null);
        return;
      }
      if (!selectedId) return;
      const step = ev.shiftKey ? 8 : 1;
      const dxy: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const mv = dxy[ev.key];
      if (!mv) return;
      ev.preventDefault();
      const n = layoutRef.current.nodes.find((x) => x.id === selectedId);
      if (!n) return;
      edit((ch) => {
        const cur = ch.nodes[selectedId] ?? {};
        ch.nodes[selectedId] = {
          ...cur,
          x: n.x + mv[0],
          ...(n.kind === "emperor"
            ? {}
            : { year: yearAt(layoutRef.current, n.y + mv[1] + n.h / 2) }),
        };
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, selectedId, edit]);

  const save = useCallback(async () => {
    if (!manual) return;
    setStatus("保存中…");
    try {
      const res = await fetch(SAVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manual),
      });
      const json = await res.json();
      setStatus(json.ok ? "保存しました（この章は凍結されました）" : `保存失敗: ${json.error}`);
    } catch {
      setStatus("保存サーバに繋がりません（site/ で npm run kinship-editor）");
    }
  }, [manual]);

  const violationIds = useMemo(
    () => new Set(layout.violations.flatMap((v) => v.ids)),
    [layout.violations],
  );

  // 凍結後にデータへ追加され、まだ手で置いていないノード(自動配置のまま)。
  // 見つけて動かしてもらうために色を変えて示す。
  const unplacedIds = useMemo(() => {
    const table = manual?.[server.id]?.nodes;
    if (!table) return new Set<string>();
    return new Set(layout.nodes.filter((n) => table[n.id] === undefined).map((n) => n.id));
  }, [manual, server.id, layout.nodes]);

  // --- 編集用オーバーレイ(ガイド線・付け根ハンドル・見出しの当たり判定) ---
  const overlay = active ? (
    <g>
      <GuideLayer ref={guideRef} width={layout.width} height={layout.height} />
      {/* 違反しているノードを赤枠で示す */}
      {layout.nodes
        .filter((n) => violationIds.has(n.id))
        .map((n) => (
          <rect
            key={`v:${n.id}`}
            x={n.x - 3}
            y={n.y - 3}
            width={n.w + 6}
            height={n.h + 6}
            rx={8}
            fill="none"
            stroke="var(--seal)"
            strokeWidth={1.6}
            strokeDasharray="3 2"
            pointerEvents="none"
          />
        ))}
      {/* まだ手で置いていない(データ追加分の)ノードを示す */}
      {layout.nodes
        .filter((n) => unplacedIds.has(n.id))
        .map((n) => (
          <rect
            key={`u:${n.id}`}
            x={n.x - 5}
            y={n.y - 5}
            width={n.w + 10}
            height={n.h + 10}
            rx={9}
            fill="none"
            stroke="#2563eb"
            strokeWidth={2}
            pointerEvents="none"
          />
        ))}
      {selectedId &&
        (() => {
          const n = layout.nodes.find((x) => x.id === selectedId);
          return n ? (
            <rect
              x={n.x - 2}
              y={n.y - 2}
              width={n.w + 4}
              height={n.h + 4}
              rx={8}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth={1.4}
              pointerEvents="none"
            />
          ) : null;
        })()}
      {showHandles && (
        <>
          {/* 見出し文字の当たり判定(文字そのものは細くて掴みにくい) */}
          {layout.bands
            .filter((b) => b.label !== "")
            .map((b) => (
              <LabelHit
                key={`lb:${b.label}`}
                x={b.labelX - (b.label.length * 13) / 2 - 4}
                y={b.labelY - 14}
                w={b.label.length * 13 + 8}
                h={18}
                onDown={(ev) =>
                  beginDrag(ev, {
                    kind: "label",
                    key: `band:${b.label}`,
                    ox: b.labelX,
                    oy: b.labelY,
                    w: 0,
                    h: 0,
                    lockY: false,
                  })
                }
              />
            ))}
          {layout.dynastyHeads.map((hd) => (
            <LabelHit
              key={`ld:${hd.key}`}
              x={hd.x - 3}
              y={hd.y - 12}
              w={hd.label.length * 11.5 + 6}
              h={16}
              onDown={(ev) =>
                beginDrag(ev, {
                  kind: "label",
                  key: `dyn:${hd.key}`,
                  ox: hd.x,
                  oy: hd.y,
                  w: 0,
                  h: 0,
                  lockY: false,
                })
              }
            />
          ))}
          {layout.arrows.map((a) => (
            <LabelHit
              key={`la:${a.key}`}
              x={a.labelX - (a.label.length * 10) / 2 - 4}
              y={a.labelY - 11}
              w={a.label.length * 10 + 8}
              h={15}
              onDown={(ev) =>
                beginDrag(ev, {
                  kind: "label",
                  key: `arrow:${a.key}`,
                  ox: a.labelX,
                  oy: a.labelY,
                  w: 0,
                  h: 0,
                  lockY: false,
                })
              }
            />
          ))}
          {layout.auxEdges
            .filter((e) => e.label !== undefined)
            .map((e) => (
              <LabelHit
                key={`lx:${e.key}`}
                x={e.labelX! - (e.label!.length * 10) / 2 - 4}
                y={e.labelY! - 11}
                w={e.label!.length * 10 + 8}
                h={15}
                onDown={(ev) =>
                  beginDrag(ev, {
                    kind: "label",
                    key: `aux:${e.key}`,
                    ox: e.labelX!,
                    oy: e.labelY!,
                    w: 0,
                    h: 0,
                    lockY: false,
                  })
                }
              />
            ))}
          {/* 矢印そのものの当たり判定。クリックで選択し、パネルで直線／直角を選ぶ。
              オーバーレイはカプセルより上に載るので、当たり判定の幅は線の見た目
              (2px)に近い7pxに留める(広げると矢印が横切るカプセルを掴めなくなる。
              それでも邪魔なときは「ハンドル非表示」でオーバーレイごと消せる)。 */}
          {layout.arrows.map((a) => (
            <g key={`sel:${a.key}`}>
              {selectedArrowKey === a.key && (
                <path
                  d={a.path}
                  fill="none"
                  stroke="var(--foreground)"
                  strokeOpacity={0.3}
                  strokeWidth={8}
                  strokeLinecap="round"
                  pointerEvents="none"
                />
              )}
              <path
                d={a.path}
                fill="none"
                stroke="transparent"
                strokeWidth={7}
                strokeLinecap="round"
                pointerEvents="stroke"
                className="cursor-pointer"
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  setSelectedArrowKey((k) => (k === a.key ? null : a.key));
                }}
              />
            </g>
          ))}
          {/* 王朝交代の赤矢印の付け根・通り道 */}
          {layout.arrows.flatMap((a) => {
            const pts = pathPoints(a.path);
            if (pts.length < 2) return [];
            const first = pts[0];
            const last = pts[pts.length - 1];
            const hs = [
              <Handle
                key={`sf:${a.key}`}
                cx={first[0]}
                cy={first[1]}
                onDown={(ev) =>
                  beginDrag(ev, {
                    kind: "anchor",
                    key: `${a.key}:from`,
                    edgeKey: a.key,
                    edgeEnd: "from",
                    ownerId: a.fromId,
                    ox: first[0],
                    oy: first[1],
                    w: 0,
                    h: 0,
                    lockY: false,
                  })
                }
              />,
              <Handle
                key={`st:${a.key}`}
                cx={last[0]}
                cy={last[1]}
                onDown={(ev) =>
                  beginDrag(ev, {
                    kind: "anchor",
                    key: `${a.key}:to`,
                    edgeKey: a.key,
                    edgeEnd: "to",
                    ownerId: a.toId,
                    ox: last[0],
                    oy: last[1],
                    w: 0,
                    h: 0,
                    lockY: false,
                  })
                }
              />,
            ];
            // 通り道(折れ位置)のハンドルは、付け根を動かして直交の折れ線に
            // なってから出す(ベジェのままでは mid が効かないため)。
            if (a.routed && pts.length === 4) {
              const horizontal = Math.abs(pts[0][1] - pts[1][1]) < 0.5;
              hs.push(
                <Handle
                  key={`sm:${a.key}`}
                  cx={(pts[1][0] + pts[2][0]) / 2}
                  cy={(pts[1][1] + pts[2][1]) / 2}
                  square
                  onDown={(ev) =>
                    beginDrag(ev, {
                      kind: "mid",
                      key: `${a.key}:mid`,
                      edgeKey: a.key,
                      midHorizontal: horizontal,
                      ox: (pts[1][0] + pts[2][0]) / 2,
                      oy: (pts[1][1] + pts[2][1]) / 2,
                      w: 0,
                      h: 0,
                      lockY: horizontal,
                    })
                  }
                />,
              );
            }
            return hs;
          })}
          {/* 線の付け根・通り道のハンドル */}
          {layout.auxEdges.flatMap((e) => {
            const pts = pathPoints(e.path);
            if (pts.length < 2) return [];
            const first = pts[0];
            const last = pts[pts.length - 1];
            const handles = [
              <Handle
                key={`af:${e.key}`}
                cx={first[0]}
                cy={first[1]}
                onDown={(ev) =>
                  beginDrag(ev, {
                    kind: "anchor",
                    key: `${e.key}:from`,
                    edgeKey: e.key,
                    edgeEnd: "from",
                    ownerId: e.fromId,
                    ox: first[0],
                    oy: first[1],
                    w: 0,
                    h: 0,
                    lockY: false,
                  })
                }
              />,
              <Handle
                key={`at:${e.key}`}
                cx={last[0]}
                cy={last[1]}
                onDown={(ev) =>
                  beginDrag(ev, {
                    kind: "anchor",
                    key: `${e.key}:to`,
                    edgeKey: e.key,
                    edgeEnd: "to",
                    ownerId: e.toId,
                    ox: last[0],
                    oy: last[1],
                    w: 0,
                    h: 0,
                    lockY: false,
                  })
                }
              />,
            ];
            if (pts.length === 4) {
              const horizontal = Math.abs(pts[0][1] - pts[1][1]) < 0.5;
              const mx = (pts[1][0] + pts[2][0]) / 2;
              const my = (pts[1][1] + pts[2][1]) / 2;
              handles.push(
                <Handle
                  key={`am:${e.key}`}
                  cx={mx}
                  cy={my}
                  square
                  onDown={(ev) =>
                    beginDrag(ev, {
                      kind: "mid",
                      key: `${e.key}:mid`,
                      edgeKey: e.key,
                      midHorizontal: horizontal,
                      ox: mx,
                      oy: my,
                      w: 0,
                      h: 0,
                      lockY: !horizontal ? false : true,
                    })
                  }
                />,
              );
            }
            return handles;
          })}
          {/* 垂下線の降り口 */}
          {layout.junctions.map((j) => (
            <Handle
              key={`j:${j.key}`}
              cx={j.x}
              cy={j.y}
              square
              onDown={(ev) =>
                beginDrag(ev, {
                  kind: "junction",
                  key: j.key,
                  ox: j.x,
                  oy: j.y,
                  w: 0,
                  h: 0,
                  lockY: true,
                })
              }
            />
          ))}
        </>
      )}
    </g>
  ) : null;

  const panel = active ? (
    <div className="fixed bottom-3 right-3 z-50 w-80 rounded-md border border-border bg-background/95 p-3 text-xs shadow-lg">
      <div className="mb-1 font-semibold">
        編集モード: {server.title}
        {layout.manual ? "（手動配置）" : ""}
      </div>
      <div className="mb-2 text-muted-foreground">{status}</div>
      <div className="mb-2 leading-relaxed text-muted-foreground">
        ドラッグ=移動／Shift+ドラッグ=子孫ごと／Alt=吸着解除／クリックで選択して矢印キー1px（Shift+8px）／Ctrl+Z=取り消し／赤矢印をクリック=直線・直角の切り替え
      </div>
      {selectedArrowKey &&
        (() => {
          const a = layout.arrows.find((x) => x.key === selectedArrowKey);
          if (!a) return null;
          const straight =
            manual?.[server.id]?.edges?.[selectedArrowKey]?.straight === true;
          return (
            <div className="mb-2 rounded border border-border p-2">
              <div className="mb-1 leading-tight">
                選択中の矢印: {a.label}（{a.fromId} → {a.toId}）
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    edit((ch) => {
                      const cur = { ...(ch.edges?.[selectedArrowKey] ?? {}) };
                      if (cur.straight) delete cur.straight;
                      else cur.straight = true;
                      ch.edges = { ...(ch.edges ?? {}), [selectedArrowKey]: cur };
                    })
                  }
                  className="rounded border border-border px-2 py-1 hover:bg-muted"
                >
                  {straight ? "直線をやめる" : "直線にする"}
                </button>
                <span className="text-muted-foreground">
                  現在: {straight ? "直線" : a.routed ? "直角の折れ線" : "曲線（既定）"}
                </span>
              </div>
            </div>
          );
        })()}
      {unplacedIds.size > 0 && (
        <div className="mb-2 leading-relaxed" style={{ color: "#2563eb" }}>
          未配置 {unplacedIds.size} 件（青枠・凍結後に追加されたノード）:{" "}
          {layout.nodes
            .filter((n) => unplacedIds.has(n.id))
            .map((n) => n.label)
            .join("・")}
        </div>
      )}
      <div className="mb-2 text-muted-foreground">
        違反 {layout.violations.length} 件
        {layout.violations.length > 0 && (
          <details className="mt-1">
            <summary className="cursor-pointer">内訳</summary>
            <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto">
              {layout.violations.map((v, i) => (
                <li key={i} className="leading-tight">
                  {v.text}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void save()} className="rounded border border-border px-2 py-1 hover:bg-muted">
          保存
        </button>
        <button
          type="button"
          onClick={() => {
            const prev = undoRef.current.pop();
            if (prev) {
              setManual(prev);
              setStatus("1つ戻しました（未保存）");
            } else setStatus("これ以上戻せません");
          }}
          className="rounded border border-border px-2 py-1 hover:bg-muted"
        >
          元に戻す
        </button>
        <button
          type="button"
          onClick={() => {
            if (manual) void navigator.clipboard.writeText(JSON.stringify(manual, null, 2));
            setStatus("JSONをコピーしました");
          }}
          className="rounded border border-border px-2 py-1 hover:bg-muted"
        >
          JSONコピー
        </button>
        <button
          type="button"
          onClick={() => setShowHandles((v) => !v)}
          className="rounded border border-border px-2 py-1 hover:bg-muted"
        >
          {showHandles ? "ハンドル非表示" : "ハンドル表示"}
        </button>
      </div>
    </div>
  ) : null;

  if (!active)
    return {
      active: false,
      layout: server,
      violationIds: new Set<string>(),
      selectedId: null,
      overlay: null,
      panel: null,
    };
  return {
    active: true,
    layout,
    violationIds,
    selectedId,
    overlay,
    panel,
    onNodePointerDown: (ev, id, isEmperor) => {
      const n = layout.nodes.find((x) => x.id === id);
      if (!n) return;
      const ids = ev.shiftKey ? descendantsOf(id) : [id];
      const svg = (ev.currentTarget as SVGGElement).ownerSVGElement;
      const els =
        ids.length > 1 && svg
          ? (ids
              .map((x) => svg.querySelector(`g[data-kid="${x}"]`))
              .filter(Boolean) as SVGGraphicsElement[])
          : undefined;
      beginDrag(ev, {
        kind: "node",
        key: id,
        ox: n.x,
        oy: n.y,
        w: n.w,
        h: n.h,
        lockY: isEmperor,
        els,
      });
    },
  };
}

function LabelHit({
  x,
  y,
  w,
  h,
  onDown,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  onDown: (ev: React.PointerEvent) => void;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      fill="transparent"
      className="cursor-move"
      stroke="var(--seal)"
      strokeWidth={0.5}
      strokeOpacity={0.35}
      strokeDasharray="2 2"
      onPointerDown={onDown}
    />
  );
}

function Handle({
  cx,
  cy,
  square,
  onDown,
}: {
  cx: number;
  cy: number;
  square?: boolean;
  onDown: (ev: React.PointerEvent) => void;
}) {
  return square ? (
    <rect
      x={cx - 3.5}
      y={cy - 3.5}
      width={7}
      height={7}
      fill="var(--background)"
      stroke="var(--seal)"
      strokeWidth={1.2}
      className="cursor-move"
      onPointerDown={onDown}
    />
  ) : (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill="var(--background)"
      stroke="var(--seal)"
      strokeWidth={1.2}
      className="cursor-move"
      onPointerDown={onDown}
    />
  );
}
