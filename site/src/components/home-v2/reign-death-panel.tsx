import { CategoryBar } from "@/components/tremor/CategoryBar";

/**
 * 在位年数帯 × 死因の100%積み上げ帯（5行）。
 *
 * 区分・並び・母集団の単一情報源は `lib/emperors.ts` の REIGN_DEATH_SEGMENTS で、
 * ここは受け取った並びをそのまま描く（クライアント側から emperors.ts を
 * import しないため、区分名は props で流れてくる）。
 */

/** emperors.ts の HomeReignDeath と同じ形（値だけを受け取る）。 */
export interface ReignDeathSegment {
  name: string;
  /** 畳んだ中身。凡例の title に出す。 */
  detail: string | null;
}

export interface ReignDeathBandRow {
  label: string;
  count: number;
  /** segments と同じ並びの件数。 */
  values: number[];
  violentPercent: number;
}

/**
 * 区分ごとの色。**並びは segments と1対1**（増やすときは両方に足す）。
 * 病死は同じ盤面の「死因」カードの先頭区分と同じ series-1 に揃えてある
 * （2枚のカードで同じ死因が違う色になると、色が意味を持たなくなる）。
 * 不詳ほかは系列色を使わず灰にする — 調査結果ではなく「分からない」の枠。
 */
const SEGMENT_COLOR = ["series8", "series1", "gray"] as const;
const SEGMENT_BG = ["bg-series-8", "bg-series-1", "bg-gray-500"];

export function ReignDeathPanel({
  segments,
  bands,
}: {
  segments: ReignDeathSegment[];
  bands: ReignDeathBandRow[];
}) {
  return (
    // 隣の世紀チャートのカードの方が背が高いので、余った高さは行の「間」へ逃がす
    // （下に空白を残さない・行の中に空白を作らない。1段目の内訳カードと同じ考え方）。
    <div className="flex h-full flex-col">
      <ul className="mt-5 flex flex-1 flex-col justify-between gap-3">
        {bands.map((b) => (
          <li key={b.label}>
            {/* 割合は帯の中でなく行見出しの右端に出す。帯は高さ8pxで文字が入らず、
                赤面に白文字を乗せてもコントラストが 3.95 で本文サイズには足りない。 */}
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-foreground">
                {b.label}
                <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                  {b.count}名
                </span>
              </span>
              <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                非業の死率 {b.violentPercent}%
              </span>
            </div>
            {(() => {
              // 帯そのものは色しか持たないので、全区分の実数を title に残す。
              // aria-label も同じ文字列で上書きする — vendored CategoryBar の既定は
              // aria-label="category bar" で、これが読み上げ名として title に勝つため、
              // そのままだと5行とも「category bar」としか読まれない。
              const detail = segments
                .map((s, i) => `${s.name} ${b.values[i]}名`)
                .join(" / ");
              return (
                <CategoryBar
                  className="mt-1.5"
                  values={b.values}
                  colors={[...SEGMENT_COLOR]}
                  showLabels={false}
                  title={detail}
                  aria-label={`${b.label} ${detail}`}
                />
              );
            })()}
          </li>
        ))}
      </ul>
      <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {segments.map((s, i) => (
          <li
            key={s.name}
            className="flex items-center gap-1.5"
            title={s.detail ?? undefined}
          >
            <span
              className={`size-2.5 shrink-0 rounded-xs ${
                SEGMENT_BG[i % SEGMENT_BG.length]
              }`}
              aria-hidden
            />
            <span className="text-xs text-muted-foreground">{s.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
