// 系譜図（Issue #174）の**試作**。秦・漢の1章だけを出す。
//
// **まだ SITE_SECTIONS・nav-data.ts・sitemap・capture-site.mjs のどれにも登録していない**
// （/lab と同じ非公開の作業ページ）。前回の版は登録して配信し、数時間後に取り下げた。
// 見た目がユーザーの水準に届いたと確認できるまで、この面は登録しない。
//
// **noindex は /lab より強い理由で要る** — このURLは 2026-08-17 に数時間だけ公開されて
// 取り下げた先で、廃止済みURLには表示が残っている（GSC 実測）。次の配信で out/ に入る以上、
// 登録していないことは検索エンジンに出ないことを意味しない。
import type { Metadata } from "next";

import {
  ChapterFlow,
  type KinshipJump,
  type KinshipLayout,
} from "@/components/kinship/chapter-flow";
import { buildMetadata } from "@/lib/seo";
import { regimeBandColor } from "@/lib/kinship/band-color";
import layoutJson from "@/lib/kinship/layout.qin-han.json";

const layout = layoutJson as unknown as KinshipLayout;

export const metadata: Metadata = {
  ...buildMetadata({
    path: "/kinship",
    title: "系譜図（試作）",
    description: "秦・漢の系譜図の試作（非公開・検索エンジンには出さない）",
  }),
  robots: { index: false, follow: false },
};

/** 凡例に出す政権（この章に実在するものだけ・図に出る順）。 */
function regimesInChapter(l: KinshipLayout) {
  const seen = new Map<string, number>();
  for (const n of l.nodes) {
    if (!n.isEmperor || !n.regimeId) continue;
    seen.set(n.regimeId, (seen.get(n.regimeId) ?? 0) + 1);
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1]);
}

/** 政権ジャンプの行き先。**時代順**（凡例の人数順とは別）で、各政権の最初の皇帝へ飛ぶ。 */
function jumpTargets(l: KinshipLayout): KinshipJump[] {
  const byRegime = new Map<string, KinshipLayout["nodes"]>();
  for (const n of l.nodes) {
    if (!n.isEmperor || !n.regimeId) continue;
    const cur = byRegime.get(n.regimeId);
    if (cur) cur.push(n);
    else byRegime.set(n.regimeId, [n]);
  }
  return [...byRegime.entries()]
    .map(([regimeId, ns]) => {
      const sorted = [...ns].sort(
        (a, b) => (a.reignFrom ?? 9999) - (b.reignFrom ?? 9999),
      );
      return {
        regimeId,
        label: REGIME_LABEL[regimeId] ?? regimeId,
        nodeId: sorted[0].id,
        count: ns.length,
        from: sorted[0].reignFrom ?? 9999,
      };
    })
    .sort((a, b) => a.from - b.from)
    .map(({ from: _from, ...j }) => j);
}

/**
 * 凡例の線見本。**`chapter-flow.tsx` の `EDGE_STYLE` と同じ値**を書く
 * （文字で代用すると線種を変えたときに凡例だけ古いままになる）。
 */
const LINE_LEGEND: { label: string; dash?: string; color?: string; width?: number }[] = [
  { label: "実父" },
  { label: "実母", dash: "5 4" },
  { label: "養親", dash: "14 5" },
  { label: "禅譲・擁立など、親子では説明が付かない継承", dash: "6 4", color: "var(--kinship-succession)" },
];

const REGIME_LABEL: Record<string, string> = {
  qin: "秦",
  "western-han": "前漢",
  xin: "新",
  xuanhan: "玄漢",
  "chimei-han": "赤眉漢",
  chengjia: "成家",
  "liuyong-liang": "梁（劉永）",
  "eastern-han": "後漢",
};

export default function KinshipPage() {
  const regimes = regimesInChapter(layout);
  return (
    <main className="flex h-[calc(100vh-4rem)] flex-col gap-3 p-4">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-heading text-xl font-semibold">秦・漢の系譜</h1>
        <p className="text-sm text-muted-foreground">
          皇帝 {layout.nodes.filter((n) => n.isEmperor).length} 人と、その親族{" "}
          {layout.nodes.filter((n) => !n.isEmperor).length} 人。縦は親子の段だが、
          段の割り当ては時代の順にも合わせてある（在位年・生没年を制約に使っている）。
          皇帝の数字は在位年、親族の数字は生没年。
        </p>
      </header>

      {/* 凡例は**2つの別の情報**（政権の色分けと線の意味）なので、見出しを付けて
          ブロックを分ける（2026-08-18 の外部レビュー: 同じ行にベタ打ちで過密）。 */}
      <div className="flex flex-wrap items-start gap-x-8 gap-y-2 rounded-md border bg-card px-3 py-2">
        <section className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <h2 className="mr-1 font-semibold text-muted-foreground">カードの色</h2>
          {regimes.map(([id, n]) => (
            <span key={id} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-3 w-3 rounded-[2px]"
                style={{ background: regimeBandColor(id) }}
              />
              <span>
                {REGIME_LABEL[id] ?? id}
                <span className="ml-1 tabular-nums text-muted-foreground">{n}人</span>
              </span>
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-[2px]"
              style={{ background: "var(--kinship-kin-band)" }}
            />
            <span>親族（男性）</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-[2px]"
              style={{ background: "var(--kinship-kin-band-female)" }}
            />
            <span>親族（女性）</span>
          </span>
        </section>

        {/* **見本は図と同じ dasharray で引く。** 文字（—— や - - -）で代用すると
            線種を変えたときに凡例だけ古いままになる。 */}
        <section className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <h2 className="mr-1 font-semibold text-muted-foreground">線の意味</h2>
          {LINE_LEGEND.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <svg aria-hidden width="26" height="10" className="shrink-0">
                <line
                  x1="1"
                  y1="5"
                  x2="25"
                  y2="5"
                  stroke={l.color ?? "var(--kinship-line)"}
                  strokeWidth={l.width ?? 1.6}
                  strokeDasharray={l.dash}
                  strokeLinecap="round"
                />
              </svg>
              <span style={l.color ? { color: l.color } : undefined}>{l.label}</span>
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-3.5 w-3.5 shrink-0 rounded-full"
              style={{ background: "var(--kinship-line)" }}
            />
            <span>夫婦（ここから子が下りる）</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-3.5 w-3.5 shrink-0 rounded-full"
              style={{
                background: "var(--kinship-canvas)",
                border: "2.5px dotted var(--kinship-line)",
              }}
            />
            <span>実父の異説</span>
          </span>
        </section>
      </div>

      <ChapterFlow layout={layout} jumps={jumpTargets(layout)} />
    </main>
  );
}
