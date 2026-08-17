import type { KinshipChapter } from "@/lib/kinship/layout";

/**
 * 章1つぶんの系譜図。**Server Component のまま**（"use client" を付けない）。
 *
 * 座標も線の path もビルド時に解いてあるので、ここは配られた値を SVG に落とすだけ。
 * クライアントには JavaScript を1バイトも送らない ＝ 皇帝個別ページへの `<a>` が
 * 静的HTMLに載り、クローラが辿れる（旧実装がクライアント描画で満たせなかった条件）。
 *
 * 横に溢れる図なので、スクロールは**この箱の中**で完結させる（body を横に流さない）。
 */
export function ChapterFigure({ chapter }: { chapter: KinshipChapter }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <svg
        width={chapter.width}
        height={chapter.height}
        viewBox={`0 0 ${chapter.width} ${chapter.height}`}
        role="img"
        aria-label={`${chapter.label}の系譜図。皇帝${chapter.emperorCount}名と縁者${chapter.personCount}名を、縦軸を実時間にして配置した図。`}
        className="block"
      >
        {chapter.ticks.map((t) => (
          <g key={t.y}>
            <line
              x1={0}
              y1={t.y}
              x2={chapter.width}
              y2={t.y}
              className="stroke-border"
              strokeWidth={1}
              strokeDasharray="2 6"
            />
            <text x={6} y={t.y - 4} className="fill-muted-foreground text-[11px]">
              {t.label}
            </text>
          </g>
        ))}

        {/* 線は箱より先に描く（重なったときに箱が上に来る） */}
        {chapter.ties.map((t, i) => (
          <line
            key={`tie-${i}`}
            x1={t.x1}
            y1={t.y}
            x2={t.x2}
            y2={t.y}
            className="stroke-foreground/45"
            strokeWidth={1.5}
          />
        ))}
        {chapter.links.map((l, i) => (
          <path
            key={`link-${i}`}
            d={l.d}
            fill="none"
            className="stroke-foreground/55"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            // 養子縁組は破線（実子と同じ実線で描くと系統が1本に見える）
            strokeDasharray={l.adoptive ? "5 4" : undefined}
          />
        ))}

        {chapter.boxes.map((b) => {
          const isEmperor = b.kind === "emperor";
          const label = b.label.length > 12 ? `${b.label.slice(0, 11)}…` : b.label;
          const body = (
            <>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={8}
                fill={b.fill}
                stroke={b.stroke}
                strokeWidth={1}
                strokeDasharray={isEmperor ? undefined : "4 3"}
                opacity={b.inferred ? 0.72 : 1}
              />
              {b.mark && (
                /* 政権の印。一覧カードの DynastyMark（3px の帯）と同じ語彙 */
                <rect x={b.x} y={b.y + 6} width={3} height={Math.max(4, b.h - 12)} rx={1.5} fill={b.mark} />
              )}
              <text
                x={b.x + (isEmperor ? 14 : b.w / 2)}
                y={b.y + (isEmperor ? 20 : 24)}
                textAnchor={isEmperor ? "start" : "middle"}
                className={
                  isEmperor
                    ? "fill-foreground text-[13px]"
                    : "fill-muted-foreground text-[12px]"
                }
              >
                {label}
              </text>
              {isEmperor && b.sub && (
                <text x={b.x + 14} y={b.y + 36} className="fill-muted-foreground text-[11px]">
                  {b.sub}
                </text>
              )}
            </>
          );
          if (!b.href) return <g key={b.key}>{body}</g>;
          return (
            // 素の <a href>。静的HTMLに載ることが目的なので next/link にしない
            // （出力は同じだが、この面はクライアント JS をまったく持たない）。
            <a key={b.key} href={b.href} className="[&_rect]:hover:stroke-seal">
              <title>{`${b.label}${b.sub ? `（${b.sub}）` : ""}の個別ページ`}</title>
              {body}
            </a>
          );
        })}
      </svg>
    </div>
  );
}
