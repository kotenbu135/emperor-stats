"use client";

// 系譜図の手動レイアウト編集モード(開発時のみ)。
//
// 使い方: npm run dev で /kinship?edit=qin-han (または ?edit=1 で最初の章)を開くと
// その章だけ編集可能になる。ノード・見出しをドラッグ → 右下パネルの「保存」で
// site/src/lib/kinship/manual-layout.json へ書き込む(別途 npm run kinship-editor で
// 保存サーバを起動しておく)。保存した章は mode:"manual" になり、以後は自動配置に
// 上書きされない(凍結)。
//
// 仕組み: ドラッグ中はSVGのグループにtransformを当てるだけ(即応)。離した時点で
// ブラウザ側で buildKinshipLayout をやり直し、線・兄弟バー・違反判定を作り直す。
// レイアウト計算の入力は /kinship-source(開発時のみ実データ)から取得する。
// 本番ビルドでは編集モードのコードは動かず(NODE_ENV判定)、layout.tsの動的import
// も実行されないため通常の閲覧には影響しない。

import { useCallback, useEffect, useRef, useState } from "react";
import { BASE_PATH } from "@/lib/base-path";
import type { KinshipChapterLayout } from "@/lib/kinship/layout";
import type { ManualLayout } from "@/lib/kinship/manual";
import { PRE_RATE, PX_PER_YEAR } from "@/lib/kinship/tree";

const SAVE_URL = `http://localhost:${process.env.NEXT_PUBLIC_KINSHIP_EDITOR_PORT ?? 4123}/save`;

type DragKind = "node" | "label";
interface DragState {
  kind: DragKind;
  key: string;
  el: SVGGElement;
  startClientX: number;
  startClientY: number;
  scale: number;
  ox: number;
  oy: number;
  h: number;
  isEmperor: boolean;
}

export interface KinshipEditorApi {
  active: boolean;
  /** 編集中の実効レイアウト(未編集ならサーバ計算のもの)。 */
  layout: KinshipChapterLayout;
  onNodePointerDown?: (
    ev: React.PointerEvent<SVGGElement>,
    id: string,
    isEmperor: boolean,
  ) => void;
  onLabelPointerDown?: (ev: React.PointerEvent<SVGGElement>, key: string) => void;
  panel: React.ReactNode;
}

/** px → 年(章の時間軸の逆変換)。 */
function yearAt(layout: KinshipChapterLayout, py: number): number {
  const { startYear, zeroY } = layout.axis;
  return py >= zeroY
    ? startYear + (py - zeroY) / PX_PER_YEAR
    : startYear - (zeroY - py) / PRE_RATE;
}

export function useKinshipEditor(server: KinshipChapterLayout): KinshipEditorApi {
  const [active, setActive] = useState(false);
  const [layout, setLayout] = useState(server);
  const [manual, setManual] = useState<ManualLayout | null>(null);
  const [status, setStatus] = useState("");
  const srcRef = useRef<unknown>(null);
  const buildRef = useRef<
    ((src: never, manual?: ManualLayout) => KinshipChapterLayout[]) | null
  >(null);
  const dragRef = useRef<DragState | null>(null);
  const undoRef = useRef<ManualLayout[]>([]);

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
      const src = await res.json();
      if (!alive) return;
      if (!Array.isArray(src?.emperors)) {
        setStatus("入力データを取得できません(/kinship-source が空)");
        return;
      }
      srcRef.current = src;
      buildRef.current = layoutMod.buildKinshipLayout as never;
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
      const chapters = buildRef.current(srcRef.current as never, manual);
      const found = chapters.find((c) => c.id === server.id);
      if (found) setLayout(found);
    } catch (e) {
      setStatus(`再計算に失敗: ${(e as Error).message}`);
    }
  }, [active, manual, server.id]);

  const beginDrag = useCallback(
    (
      ev: React.PointerEvent<SVGGElement>,
      kind: DragKind,
      key: string,
      origin: { x: number; y: number; h: number; isEmperor: boolean },
    ) => {
      if (!active) return;
      ev.preventDefault();
      ev.stopPropagation();
      const el = ev.currentTarget;
      const svg = el.ownerSVGElement;
      const scale = svg ? svg.getBoundingClientRect().width / svg.viewBox.baseVal.width : 1;
      el.setPointerCapture(ev.pointerId);
      dragRef.current = {
        kind,
        key,
        el,
        startClientX: ev.clientX,
        startClientY: ev.clientY,
        scale: scale || 1,
        ox: origin.x,
        oy: origin.y,
        h: origin.h,
        isEmperor: origin.isEmperor,
      };
    },
    [active],
  );

  // --- ドラッグ中/終了 ---
  useEffect(() => {
    if (!active) return;
    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (ev.clientX - d.startClientX) / d.scale;
      const dy = (ev.clientY - d.startClientY) / d.scale;
      const ty = d.kind === "node" && d.isEmperor ? 0 : dy;
      d.el.style.transform = `translate(${dx}px, ${ty}px)`;
    };
    const up = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      d.el.style.transform = "";
      const dx = Math.round((ev.clientX - d.startClientX) / d.scale);
      const dy = Math.round((ev.clientY - d.startClientY) / d.scale);
      if (dx === 0 && dy === 0) return;
      setManual((prev) => {
        if (!prev) return prev;
        undoRef.current = [...undoRef.current.slice(-49), prev];
        const next: ManualLayout = JSON.parse(JSON.stringify(prev));
        const ch = next[server.id];
        if (d.kind === "node") {
          const cur = ch.nodes[d.key] ?? {};
          ch.nodes[d.key] = {
            ...cur,
            x: d.ox + dx,
            ...(d.isEmperor ? {} : { year: yearAt(layout, d.oy + dy + d.h / 2) }),
          };
        } else {
          ch.labels = { ...(ch.labels ?? {}), [d.key]: { x: d.ox + dx, y: d.oy + dy } };
        }
        return next;
      });
      setStatus("未保存の変更があります");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [active, layout, server.id]);

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

  const undo = useCallback(() => {
    const prev = undoRef.current.pop();
    if (!prev) {
      setStatus("これ以上戻せません");
      return;
    }
    setManual(prev);
    setStatus("1つ戻しました（未保存）");
  }, []);

  const copy = useCallback(() => {
    if (!manual) return;
    void navigator.clipboard.writeText(JSON.stringify(manual, null, 2));
    setStatus("JSONをコピーしました");
  }, [manual]);

  const panel = active ? (
    <div className="fixed bottom-3 right-3 z-50 w-72 rounded-md border border-border bg-background/95 p-3 text-xs shadow-lg">
      <div className="mb-1 font-semibold">
        編集モード: {server.title}
        {layout.manual ? "（手動配置）" : ""}
      </div>
      <div className="mb-2 text-muted-foreground">{status}</div>
      <div className="mb-2 text-muted-foreground">
        違反 {layout.violations.length} 件
        {layout.violations.length > 0 && (
          <details className="mt-1">
            <summary className="cursor-pointer">内訳</summary>
            <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto">
              {layout.violations.map((v, i) => (
                <li key={i} className="leading-tight">
                  {v.split(" [")[0]}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save()}
          className="rounded border border-border px-2 py-1 hover:bg-muted"
        >
          保存
        </button>
        <button
          type="button"
          onClick={undo}
          className="rounded border border-border px-2 py-1 hover:bg-muted"
        >
          元に戻す
        </button>
        <button
          type="button"
          onClick={copy}
          className="rounded border border-border px-2 py-1 hover:bg-muted"
        >
          JSONコピー
        </button>
      </div>
    </div>
  ) : null;

  if (!active) return { active: false, layout: server, panel: null };
  return {
    active: true,
    layout,
    panel,
    onNodePointerDown: (ev, id, isEmperor) => {
      const n = layout.nodes.find((x) => x.id === id);
      if (!n) return;
      beginDrag(ev, "node", id, { x: n.x, y: n.y, h: n.h, isEmperor });
    },
    onLabelPointerDown: (ev, key) => {
      const pos = labelPos(layout, key);
      if (!pos) return;
      beginDrag(ev, "label", key, { x: pos.x, y: pos.y, h: 0, isEmperor: false });
    },
  };
}

function labelPos(
  layout: KinshipChapterLayout,
  key: string,
): { x: number; y: number } | undefined {
  const [kind, rest] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  if (kind === "band") {
    const b = layout.bands.find((x) => x.label === rest);
    return b ? { x: b.labelX, y: b.labelY } : undefined;
  }
  if (kind === "dyn") {
    const h = layout.dynastyHeads.find((x) => x.key === rest);
    return h ? { x: h.x, y: h.y } : undefined;
  }
  if (kind === "arrow") {
    const a = layout.arrows.find((x) => x.key === rest);
    return a ? { x: a.labelX, y: a.labelY } : undefined;
  }
  const e = layout.auxEdges.find((x) => x.key === rest);
  return e && e.labelX !== undefined ? { x: e.labelX, y: e.labelY! } : undefined;
}
