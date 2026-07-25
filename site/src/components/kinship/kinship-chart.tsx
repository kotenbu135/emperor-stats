"use client";

// 系譜・即位経路グラフ(/kinship)のSVG描画(1章=1SVG)。レイアウトはビルド時計算済みの
// KinshipChapterLayoutをそのまま描くだけで、このコンポーネントでは座標計算をしない。
// - ホバー・詳細ダイアログの状態はチャートに持たない(useTipOutlet/useDetailOutlet。
//   サイト共通原則)。
// - 皇帝カプセルは統計ページ共通のEmperorTooltip、クリックで全項目ダイアログ
//   (EmperorDetailDialog)。フルレコードは/emperor-records/{id}をlazy fetchする
//   (/emperors一覧グリッドと同じ方式)。名前はドラッグ選択でコピーできる。
// - 親子は垂下線(junction)の構造で示し、線に続柄ラベルは付けない。
//   矢印は王朝間の交代のみ。

import { useCallback, useRef } from "react";
import {
  FixedTooltip,
  useTipOutlet,
} from "@/components/charts/scroll-bar-chart";
import { EmperorTooltip } from "@/components/charts/emperor-tooltip";
import { useDetailOutlet } from "@/components/emperors/emperor-detail-dialog";
import { useKinshipEditor } from "@/components/kinship/kinship-editor";
import { BASE_PATH } from "@/lib/base-path";
import type { EmperorRecord } from "@/lib/emperor-types";
import type {
  KinshipChapterLayout,
  KinshipEmperorTip,
  KinshipNodeOut,
  TipLine,
} from "@/lib/kinship/layout";

type KinshipTip =
  | { x: number; y: number; kind: "lines"; lines: TipLine[] }
  | { x: number; y: number; kind: "emperor"; emp: KinshipEmperorTip };

const KIN_STROKE = "color-mix(in srgb, var(--foreground) 42%, var(--background))";
const STRUCT_STROKE = "color-mix(in srgb, var(--foreground) 52%, var(--background))";

function nodeFill(n: KinshipNodeOut): string {
  if (n.kind === "consort")
    return "color-mix(in srgb, var(--foreground) 5%, var(--background))";
  // 非皇帝のつなぎ人物は従来どおり灰(破線枠と合わせて「皇帝でない」ことを示す)。
  if (n.kind === "person")
    return "color-mix(in srgb, var(--foreground) 10%, var(--background))";
  // 群雄・並立政権の皇帝カプセルは専用色(灰だと人物ノードと紛らわしい)。
  if (n.colorSlot === 0)
    return "color-mix(in srgb, var(--kinship-minor) 40%, var(--background))";
  return `color-mix(in srgb, var(--series-${n.colorSlot}) 42%, var(--background))`;
}
function nodeEdge(n: KinshipNodeOut): string {
  if (n.kind === "consort")
    return "color-mix(in srgb, var(--foreground) 30%, var(--background))";
  if (n.kind === "person")
    return "color-mix(in srgb, var(--foreground) 38%, var(--background))";
  if (n.colorSlot === 0)
    return "color-mix(in srgb, var(--kinship-minor) 80%, var(--background))";
  return `color-mix(in srgb, var(--series-${n.colorSlot}) 82%, var(--background))`;
}

export function KinshipChart({ layout: serverLayout }: { layout: KinshipChapterLayout }) {
  const { setTip, TipOutlet } = useTipOutlet<KinshipTip>();
  const { openDetail, DetailOutlet } = useDetailOutlet();
  // 開発時の手動レイアウト編集モード(?edit=<章id>)。通常表示では何もしない。
  const editor = useKinshipEditor(serverLayout);
  const layout = editor.layout;

  // ダイアログに出すフルEmperorRecordは開く時に/emperor-records/{id}(静的書き出し)を
  // fetchして取得する(emperor-grid.tsxと同じ方式・Mapキャッシュ+最新要求id確認つき)。
  const fullRecordsRef = useRef(new Map<string, EmperorRecord>());
  const wantedIdRef = useRef<string | null>(null);
  const openEmperor = useCallback(
    (id: string) => {
      wantedIdRef.current = id;
      const cached = fullRecordsRef.current.get(id);
      if (cached) {
        openDetail(cached);
        return;
      }
      fetch(`${BASE_PATH}/emperor-records/${id}`)
        .then((res) =>
          res.ok ? res.json() : Promise.reject(new Error(`${res.status}`)),
        )
        .then((record: EmperorRecord) => {
          fullRecordsRef.current.set(id, record);
          if (wantedIdRef.current === id) openDetail(record);
        })
        .catch(() => {
          // 取得できない環境ではダイアログを諦めて個別ページ本体へ遷移する。
          if (wantedIdRef.current === id) {
            window.location.assign(`${BASE_PATH}/emperors/${id}`);
          }
        });
    },
    [openDetail],
  );

  const emperorCount = layout.nodes.filter((n) => n.kind === "emperor").length;
  const markerId = `kinship-arrow-${layout.id}`;

  const showTip = (lines: TipLine[]) => (ev: React.MouseEvent) =>
    setTip({ x: ev.clientX, y: ev.clientY, kind: "lines", lines });
  const hideTip = () => setTip(null);

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-background">
      {/* 年ラベルは横スクロールしても見えるよう、SVG外のstickyオーバーレイで
          左右両端に固定表示する(h-0なので縦のレイアウトには影響しない)。 */}
      <div aria-hidden className="pointer-events-none sticky left-0 z-10 h-0 w-0">
        {layout.ticks.map((t) => (
          <span
            key={t.label}
            className="absolute whitespace-nowrap rounded-sm bg-background/85 px-1 text-[10.5px] text-muted-foreground"
            style={{ top: t.y - 8, left: 6 }}
          >
            {t.label}
          </span>
        ))}
      </div>
      <div
        aria-hidden
        className="pointer-events-none sticky z-10 h-0 w-0"
        style={{ left: "calc(100% - 6px)" }}
      >
        {layout.ticks.map((t) => (
          <span
            key={t.label}
            className="absolute whitespace-nowrap rounded-sm bg-background/85 px-1 text-[10.5px] text-muted-foreground"
            style={{ top: t.y - 8, left: 0, transform: "translateX(-100%)" }}
          >
            {t.label}
          </span>
        ))}
      </div>
      <svg
        role="img"
        aria-label={`${layout.title}の系譜図。縦が時間(上が古い)、横が王朝バンド。皇帝${emperorCount}人を家系図形式で表示。王朝間の交代${layout.arrows.length}本を矢印で表示`}
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="block"
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
          {/* ラベルはstickyオーバーレイ側で表示するため、SVG内は罫線のみ */}
          {layout.ticks.map((t) => (
            <line
              key={t.label}
              x1={layout.axisX - 5}
              y1={t.y}
              x2={layout.width - 16}
              y2={t.y}
              stroke="var(--border)"
              strokeWidth={0.6}
            />
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
            />
          ))}
        </g>

        {/* 夫婦の連結線(皇后=二重線・妃嬪等=細単線) */}
        <g>
          {layout.ties.map((t, i) => (
            <g key={`tie:${i}`}>
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
            <g key={e.key}>
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
              {e.label !== undefined && (
                <text
                  onPointerDown={
                    editor.onLabelPointerDown
                      ? (ev) =>
                          editor.onLabelPointerDown!(
                            ev as unknown as React.PointerEvent<SVGGElement>,
                            `aux:${e.key}`,
                          )
                      : undefined
                  }
                  x={e.labelX}
                  y={e.labelY}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                  style={{
                    paintOrder: "stroke",
                    stroke: "var(--background)",
                    strokeWidth: 3,
                  }}
                >
                  {e.label}
                </text>
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
            <g key={a.key}>
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
                onPointerDown={
                  editor.onLabelPointerDown
                    ? (ev) =>
                        editor.onLabelPointerDown!(
                          ev as unknown as React.PointerEvent<SVGGElement>,
                          `arrow:${a.key}`,
                        )
                    : undefined
                }
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

        {/* バンド見出し(最上部ノード群の中央)。補助線・矢印の後に描き、ハローで
            交差線を隠す(新（王氏）の見出しが王莽の連結線と重なる問題の解消)。 */}
        <g aria-hidden>
          {layout.bands
            .filter((b) => b.label !== "")
            .map((b) => (
              <text
                key={b.label}
                onPointerDown={
                  editor.onLabelPointerDown
                    ? (ev) =>
                        editor.onLabelPointerDown!(
                          ev as unknown as React.PointerEvent<SVGGElement>,
                          `band:${b.label}`,
                        )
                    : undefined
                }
                x={b.labelX}
                y={b.labelY}
                textAnchor="middle"
                className="fill-foreground text-[13px] font-semibold"
                style={{
                  paintOrder: "stroke",
                  stroke: "var(--background)",
                  strokeWidth: 4,
                }}
              >
                {b.label}
              </text>
            ))}
        </g>

        {/* 王朝見出し(各王朝の最初のカプセルの上。ハローで交差線を隠す) */}
        <g aria-hidden>
          {layout.dynastyHeads.map((h) => (
            <text
              key={`${h.label}:${h.y}`}
              onPointerDown={
                editor.onLabelPointerDown
                  ? (ev) =>
                      editor.onLabelPointerDown!(
                        ev as unknown as React.PointerEvent<SVGGElement>,
                        `dyn:${h.key}`,
                      )
                  : undefined
              }
              x={h.x}
              y={h.y}
              textAnchor="start"
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
              // 描画結果の幾何をHTMLから機械照合するためのQAフック(ノードid)。
              // curlしたSVGのrectとノードidを対応づけて距離を測る(KINSHIP.md参照)。
              data-kid={n.id}
              onPointerDown={
                editor.onNodePointerDown
                  ? (ev) =>
                      editor.onNodePointerDown!(ev, n.id, n.kind === "emperor")
                  : undefined
              }
              className={
                editor.active
                  ? "cursor-move"
                  : n.kind === "emperor"
                    ? "cursor-pointer"
                    : undefined
              }
              onMouseMove={(ev) =>
                setTip(
                  n.empTip !== null
                    ? { x: ev.clientX, y: ev.clientY, kind: "emperor", emp: n.empTip }
                    : { x: ev.clientX, y: ev.clientY, kind: "lines", lines: n.tipLines },
                )
              }
              onMouseLeave={hideTip}
              onClick={
                n.kind === "emperor" && !editor.active
                  ? () => {
                      // ドラッグで名前を選択(コピー)した直後のclickでは開かない。
                      if (window.getSelection()?.toString()) return;
                      openEmperor(n.id);
                    }
                  : undefined
              }
            >
              {n.segments ? (
                <>
                  {/* 廃位期間をまたぐ点線コネクタ(同一人物であることを示す) */}
                  {n.segments.slice(1).map((s, i) => (
                    <line
                      key={`conn:${i}`}
                      x1={n.x + n.w / 2}
                      y1={n.segments![i].y + n.segments![i].h}
                      x2={n.x + n.w / 2}
                      y2={s.y}
                      stroke={nodeEdge(n)}
                      strokeWidth={1.4}
                      strokeDasharray="2 3"
                    />
                  ))}
                  {n.segments.map((s, i) => (
                    <rect
                      key={`seg:${i}`}
                      x={n.x}
                      y={s.y}
                      width={n.w}
                      height={s.h}
                      rx={8}
                      fill={nodeFill(n)}
                      stroke={nodeEdge(n)}
                      strokeWidth={1.5}
                    />
                  ))}
                </>
              ) : (
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
              )}
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
              {/* 遠祖の系譜主張はグラフ内バッジにしない(隣のノードの付記に見える
                  誤読があった)。皇帝カプセルのツールチップで全文を示す。 */}
            </g>
          ))}
        </g>
      </svg>

      <TipOutlet
        render={(tip) => (
          <FixedTooltip x={tip.x} y={tip.y}>
            {tip.kind === "emperor" ? (
              <EmperorTooltip
                record={{
                  name: tip.emp.name,
                  dynastyLabel: tip.emp.dynastyLabel,
                  portraitUrl: tip.emp.portraitUrl,
                }}
                valueLabel="在位"
                formattedValue={tip.emp.reignLabel}
                details={tip.emp.details}
                hint="クリックで全項目を表示"
              />
            ) : (
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
            )}
          </FixedTooltip>
        )}
      />
      <DetailOutlet />
      {editor.panel}
    </div>
  );
}
