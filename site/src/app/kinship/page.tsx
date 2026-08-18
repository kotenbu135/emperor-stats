// 系譜図（Issue #174）の**試作**。秦・漢の1章だけを出す。
//
// **まだ SITE_SECTIONS・nav-data.ts・sitemap・capture-site.mjs のどれにも登録していない**
// （/lab と同じ非公開の作業ページ）。前回の版は登録して配信し、数時間後に取り下げた。
// 見た目がユーザーの水準に届いたと確認できるまで、この面は登録しない。
import { ChapterFlow, type KinshipLayout } from "@/components/kinship/chapter-flow";
import { regimeBandColor } from "@/lib/kinship/band-color";
import layoutJson from "@/lib/kinship/layout.qin-han.json";

const layout = layoutJson as unknown as KinshipLayout;

/** 凡例に出す政権（この章に実在するものだけ・図に出る順）。 */
function regimesInChapter(l: KinshipLayout) {
  const seen = new Map<string, number>();
  for (const n of l.nodes) {
    if (!n.isEmperor || !n.regimeId) continue;
    seen.set(n.regimeId, (seen.get(n.regimeId) ?? 0) + 1);
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1]);
}

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
          {layout.nodes.filter((n) => !n.isEmperor).length} 人。縦は世代の段（実年ではない）。
          カードにカーソルを乗せると、その人の祖先と子孫だけが残る。
        </p>
      </header>

      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {regimes.map(([id, n]) => {
          const color = regimeBandColor(id);
          return (
            <li key={id} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-3 w-3 rounded-[2px]"
                style={{ background: color }}
              />
              <span>
                {REGIME_LABEL[id] ?? id}
                <span className="ml-1 tabular-nums text-muted-foreground">{n}</span>
              </span>
            </li>
          );
        })}
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-3 w-3 rounded-[2px]"
            style={{ background: "var(--kinship-kin-band)" }}
          />
          <span>皇帝以外の親族</span>
        </li>
      </ul>

      <ChapterFlow layout={layout} />
    </main>
  );
}
