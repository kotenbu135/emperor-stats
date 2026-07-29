// /kinship の凡例。以前は長い説明文を各章の下に置いていたが、読まれない長文より
// 図で示すほうが伝わるため、実際の描画とまったく同じマークを並べる図版にした
// (ユーザー指示・2026-07-26「凡例の文章は廃止 図で表す」)。色・線幅・破線は
// lib/kinship/style.ts をチャート本体と共用し、凡例だけ古くなることを防ぐ。
//
// テキストは各マークの短いラベルだけにする(補足の1行も2026-07-26のユーザー指示で
// 削除。縦スケールは「縦の長さ＝在位期間」の年グリッドが図として示している)。
// 図が主役なので details で既定は閉じておく。

import {
  CONSORT_EDGE,
  CONSORT_FILL,
  KIN_STROKE,
  PERSON_EDGE,
  PERSON_FILL,
  STRUCT_STROKE,
  seriesEdge,
  seriesFill,
} from "@/lib/kinship/style";
import { PX_PER_YEAR } from "@/lib/kinship/tree";

const W = 132;
const H = 52;

/** 凡例1項目。svgは W×H の座標系で描く。 */
function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col items-center gap-1">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        aria-hidden
        className="block shrink-0"
      >
        {children}
      </svg>
      <span className="text-center text-xs leading-snug text-muted-foreground">
        {label}
      </span>
    </li>
  );
}

/** 皇帝カプセル(実物と同じ塗り・枠・2行構成)。 */
function Capsule({
  x,
  y,
  w = 96,
  h = 34,
  slot = 4,
  name,
  sub,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  slot?: number;
  name: string;
  sub?: string;
}) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        fill={seriesFill(slot)}
        stroke={seriesEdge(slot)}
        strokeWidth={1.5}
      />
      <text
        x={x + w / 2}
        y={sub ? y + h / 2 - 3 : y + h / 2 + 4}
        textAnchor="middle"
        className="fill-foreground text-[11px]"
      >
        {name}
      </text>
      {sub && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 11}
          textAnchor="middle"
          className="fill-muted-foreground text-[9.5px]"
        >
          {sub}
        </text>
      )}
    </>
  );
}

/** 皇帝でないつなぎ人物のピル(破線枠)。 */
function PersonPill({ x, y, name }: { x: number; y: number; name: string }) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={48}
        height={26}
        rx={8}
        fill={PERSON_FILL}
        stroke={PERSON_EDGE}
        strokeWidth={1.2}
        strokeDasharray="5 4"
      />
      <text
        x={x + 24}
        y={y + 17}
        textAnchor="middle"
        className="fill-foreground text-[11px]"
      >
        {name}
      </text>
    </>
  );
}

/** 后妃など配偶者のピル(丸枠)。 */
function ConsortPill({ x, y, name }: { x: number; y: number; name: string }) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={48}
        height={24}
        rx={12}
        fill={CONSORT_FILL}
        stroke={CONSORT_EDGE}
        strokeWidth={1.2}
      />
      <text
        x={x + 24}
        y={y + 16}
        textAnchor="middle"
        className="fill-foreground/80 text-[10.5px]"
      >
        {name}
      </text>
    </>
  );
}

/** 朱矢印の矢頭。marker は同じSVG内でしか参照できないので項目ごとに置く。 */
function ArrowHead({ id }: { id: string }) {
  return (
    <defs>
      <marker
        id={id}
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
  );
}

export function KinshipLegend() {
  return (
    // 既定は閉じる(ユーザー指示・2026-07-26)。図が本体で、凡例は必要なときだけ開く。
    <details className="group rounded-md border border-border bg-background">
      <summary className="cursor-pointer list-none px-4 py-2 text-sm font-semibold text-foreground marker:content-none">
        <span aria-hidden className="mr-1.5 inline-block transition-transform group-open:rotate-90">
          ▶
        </span>
        凡例
      </summary>
      <ul className="grid grid-cols-2 justify-items-center gap-x-4 gap-y-3 px-4 pb-3 sm:grid-cols-3 lg:grid-cols-5">
        <Item label="皇帝（第N代・即位経路）">
          <Capsule x={18} y={9} name="武帝" sub="第2代・世襲" />
        </Item>

        <Item label="縦の長さ＝在位期間">
          {/* 実スケール(1年=PX_PER_YEAR px)の年グリッドと、長短2つのカプセル。 */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line
              key={i}
              x1={4}
              y1={6 + i * PX_PER_YEAR}
              x2={100}
              y2={6 + i * PX_PER_YEAR}
              stroke="var(--border)"
              strokeWidth={0.6}
            />
          ))}
          <line x1={106} y1={6} x2={106} y2={6 + PX_PER_YEAR} stroke="var(--border)" strokeWidth={1} />
          <line x1={103} y1={6} x2={109} y2={6} stroke="var(--border)" strokeWidth={1} />
          <line x1={103} y1={6 + PX_PER_YEAR} x2={109} y2={6 + PX_PER_YEAR} stroke="var(--border)" strokeWidth={1} />
          <text x={112} y={6 + PX_PER_YEAR} className="fill-muted-foreground text-[9px]">
            1年
          </text>
          <rect
            x={16}
            y={6}
            width={34}
            height={PX_PER_YEAR * 5}
            rx={6}
            fill={seriesFill(1)}
            stroke={seriesEdge(1)}
            strokeWidth={1.5}
          />
          {/* 同じ王朝(同じ色)で高さだけが違う2人。色の差ではなく高さ＝在位年数を示す。 */}
          <rect
            x={60}
            y={6}
            width={34}
            height={PX_PER_YEAR * 2}
            rx={6}
            fill={seriesFill(1)}
            stroke={seriesEdge(1)}
            strokeWidth={1.5}
          />
        </Item>

        <Item label="皇帝を称さなかった人物">
          <PersonPill x={42} y={13} name="曹操" />
        </Item>

        <Item label="后妃など配偶者">
          <ConsortPill x={42} y={14} name="卞氏" />
        </Item>

        <Item label="皇后との夫婦">
          <Capsule x={2} y={13} w={52} h={26} slot={1} name="文帝" />
          <ConsortPill x={78} y={14} name="甄氏" />
          <line x1={54} y1={26 - 1.7} x2={78} y2={26 - 1.7} stroke={STRUCT_STROKE} strokeWidth={1.4} />
          <line x1={54} y1={26 + 1.7} x2={78} y2={26 + 1.7} stroke={STRUCT_STROKE} strokeWidth={1.4} />
        </Item>

        <Item label="妃嬪など生母">
          <Capsule x={2} y={13} w={52} h={26} slot={1} name="明帝" />
          <ConsortPill x={78} y={14} name="虞氏" />
          <line x1={54} y1={26} x2={78} y2={26} stroke={KIN_STROKE} strokeWidth={1.1} />
        </Item>

        <Item label="親子（母ごとに分かれる）">
          <Capsule x={2} y={2} w={44} h={20} slot={1} name="父" />
          <ConsortPill x={66} y={3} name="母" />
          <line x1={46} y1={12 - 1.7} x2={66} y2={12 - 1.7} stroke={STRUCT_STROKE} strokeWidth={1.4} />
          <line x1={46} y1={12 + 1.7} x2={66} y2={12 + 1.7} stroke={STRUCT_STROKE} strokeWidth={1.4} />
          {/* 垂下線は二重線の下側の線から出す */}
          <path
            d={`M 56 ${12 + 1.7} L 56 30 M 30 30 L 82 30 M 30 30 L 30 36 M 82 30 L 82 36`}
            fill="none"
            stroke={STRUCT_STROKE}
            strokeWidth={1.6}
          />
          <Capsule x={8} y={36} w={44} h={14} slot={1} name="子" />
          <Capsule x={60} y={36} w={44} h={14} slot={1} name="子" />
        </Item>

        <Item label="養子縁組／実父に諸説あり">
          <Capsule x={42} y={2} w={48} h={18} slot={1} name="父" />
          <path
            d="M 66 20 L 66 34"
            fill="none"
            stroke={STRUCT_STROKE}
            strokeWidth={1.6}
            strokeDasharray="2 4"
          />
          <Capsule x={42} y={34} w={48} h={16} slot={1} name="子" />
        </Item>

        <Item label="王朝間の交代">
          <ArrowHead id="kinship-legend-arrow-a" />
          <Capsule x={0} y={20} w={44} h={26} slot={4} name="献帝" />
          <Capsule x={88} y={20} w={44} h={26} slot={1} name="文帝" />
          <path
            d="M 44 33 L 86 33"
            fill="none"
            stroke="var(--seal)"
            strokeWidth={2}
            strokeLinecap="round"
            markerEnd="url(#kinship-legend-arrow-a)"
          />
          <text
            x={65}
            y={26}
            textAnchor="middle"
            className="fill-seal text-[10px] font-medium"
          >
            禅譲
          </text>
        </Item>

        <Item label="諸説あり（史書間で記述が対立）">
          <ArrowHead id="kinship-legend-arrow-b" />
          <Capsule x={0} y={20} w={44} h={26} slot={6} name="先帝" />
          <Capsule x={88} y={20} w={44} h={26} slot={3} name="新帝" />
          <path
            d="M 44 33 L 86 33"
            fill="none"
            stroke="var(--seal)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="2 5"
            markerEnd="url(#kinship-legend-arrow-b)"
          />
          <text
            x={65}
            y={26}
            textAnchor="middle"
            className="fill-seal text-[10px] font-medium"
          >
            簒奪?
          </text>
        </Item>
      </ul>
    </details>
  );
}
