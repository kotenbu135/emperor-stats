// 系譜図の章ページの共通部（ヘッダー・章ナビ・凡例・図）。**章の一覧は
// app/kinship/chapters.ts が正**で、ここは1章を受け取って描くだけ。
import Link from "next/link";

import {
  ChapterFlow,
  EDGE_STYLE,
  type KinshipJump,
  type KinshipLayout,
} from "@/components/kinship/chapter-flow";
import { KINSHIP_CHAPTERS, type KinshipChapter } from "@/app/kinship/chapters";
import { regimeBandColor } from "@/lib/kinship/band-color";

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
 * 凡例の線見本。**図と同じ `EDGE_STYLE` から引く**（値を書き写すと線種を変えたときに
 * 凡例だけ古いままになる — 実際に養親の刻みが凡例だけ古い値で残っていた）。
 */
const LINE_LEGEND: {
  label: string;
  /** この線種が図に実在するときだけ凡例に出す（無い章に「実父の異説」を出さない） */
  kinds: string[];
  dash?: string;
  color?: string;
  width?: number;
}[] = [
  {
    label: "夫婦と実の親子（子は夫婦の横棒から下りる）",
    kinds: ["marriage", "father", "child"],
    ...EDGE_STYLE.child,
  },
  { label: "実母", kinds: ["mother"], ...EDGE_STYLE.mother },
  { label: "養親", kinds: ["adoptive"], ...EDGE_STYLE.adoptive },
  { label: "遠い祖先（実父が史料に無い人）", kinds: ["remote"], ...EDGE_STYLE.remote },
  {
    label: "禅譲・簒奪など、親子では説明が付かない継承",
    kinds: ["succession"],
    ...EDGE_STYLE.succession,
  },
  { label: "実父の異説", kinds: ["disputed", "second"], ...EDGE_STYLE.disputed },
];

/** 図に出す短い政権名（data の label は「魏（曹魏）」型で図では長い）。 */
const REGIME_LABEL: Record<string, string> = {
  qin: "秦",
  "western-han": "前漢",
  xin: "新",
  xuanhan: "玄漢",
  "chimei-han": "赤眉漢",
  chengjia: "成家",
  "liuyong-liang": "梁（劉永）",
  "eastern-han": "後漢",
  "cao-wei": "魏",
  "shu-han": "蜀漢",
  "eastern-wu": "呉",
  zhongjia: "仲家（袁術）",
  "western-jin": "西晋",
  "eastern-jin": "東晋",
  "huan-chu": "楚（桓玄）",
  "former-liang": "前涼",
  "former-zhao": "前趙",
  "cheng-han": "成漢",
  "later-zhao": "後趙",
  "former-yan": "前燕",
  "former-qin": "前秦",
  "later-yan": "後燕",
  "western-yan": "西燕",
  "southern-yan": "南燕",
  "later-qin": "後秦",
  hexia: "夏（赫連）",
};

export function KinshipChapterPage({ chapter }: { chapter: KinshipChapter }) {
  const layout = chapter.layout;
  const regimes = regimesInChapter(layout);
  const kindsInChapter = new Set(layout.edges.map((e) => e.kind));
  const lineLegend = LINE_LEGEND.filter((l) => l.kinds.some((k) => kindsInChapter.has(k as never)));
  return (
    <main className="flex h-[calc(100vh-4rem)] flex-col gap-3 p-4">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-heading text-xl font-semibold">{chapter.heading}の系譜</h1>
        {/* 章ナビ。h1 の隣に置く（時代の帯・凡例と別行にすると縦を1行ぶん食う）。 */}
        <nav aria-label="章" className="flex items-center gap-1">
          {KINSHIP_CHAPTERS.map((c) =>
            c.path === chapter.path ? (
              <span
                key={c.path}
                aria-current="page"
                className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold"
              >
                {c.heading}
              </span>
            ) : (
              <Link
                key={c.path}
                href={c.path}
                className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:border-[var(--kinship-line)] hover:text-foreground"
              >
                {c.heading}
              </Link>
            ),
          )}
        </nav>
        <p className="text-sm text-muted-foreground">
          皇帝 {layout.nodes.filter((n) => n.isEmperor).length} 人と、その親族{" "}
          {layout.nodes.filter((n) => !n.isEmperor).length} 人。縦は親子の段。
          皇帝の数字は在位年、親族の数字は生没年。
          {chapter.note ? <> {chapter.note}</> : null}
        </p>
      </header>

      {/* 凡例は**2つの別の情報**（政権の色分けと線の意味）なので、見出しを付けて
          ブロックを分ける（2026-08-18 の外部レビュー: 同じ行にベタ打ちで過密）。
          そのうえで**畳めるようにする**（同レビュー: ヘッダーが図の面積を圧迫している）。
          **既定は開く** — 線の意味を知らずに開いた図は読めない。畳んだ状態でも
          `<details>` なので中身は静的HTMLに残る（`ui/accordion.tsx` を使わない理由）。 */}
      <details open className="rounded-md border bg-card px-3 py-2">
        <summary className="text-[13px] font-semibold text-muted-foreground">
          凡例（カードの色・線の意味・時代の帯）
        </summary>
        {/* **見出しを左の1列に揃える。** 3つの別々の flex を横に並べていたので、
            どこまでが「カードの色」でどこからが「線の意味」なのか行の途中で切れていた
            （2026-08-18 の外部レビュー2巡目「横一列に詰め込まれて羅列」）。 */}
        <dl className="mt-2 grid grid-cols-[max-content_1fr] items-baseline gap-x-4 gap-y-2.5 text-[13px]">
        <dt className="font-semibold text-muted-foreground">カードの色</dt>
        <dd className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
          {regimes.map(([id, n]) => (
            <span key={id} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block size-3.5 rounded-[2px]"
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
              className="inline-block size-3.5 rounded-[2px]"
              style={{ background: "var(--kinship-kin-band)" }}
            />
            <span>親族（男性）</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block size-3.5 rounded-[2px]"
              style={{ background: "var(--kinship-kin-band-female)" }}
            />
            <span>親族（女性）</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-3.5 w-5 rounded-[2px]"
              style={{
                background: "var(--kinship-kin-band)",
                boxShadow: `inset 3px 0 0 0 ${regimeBandColor(regimes[0]?.[0] ?? "")}`,
              }}
            />
            <span>親族の左端の色＝その家の政権</span>
          </span>
        </dd>

        {/* **見本は図と同じ dasharray で引く。** 文字（—— や - - -）で代用すると
            線種を変えたときに凡例だけ古いままになる。 */}
        <dt className="font-semibold text-muted-foreground">線の意味</dt>
        <dd className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
          {lineLegend.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <svg aria-hidden width="30" height="10" className="shrink-0">
                <line
                  x1="1"
                  y1="5"
                  x2="29"
                  y2="5"
                  stroke={l.color ?? "var(--kinship-line)"}
                  strokeWidth={l.width ?? 1.9}
                  strokeDasharray={l.dash}
                  strokeLinecap="round"
                />
              </svg>
              <span style={l.color ? { color: l.color } : undefined}>{l.label}</span>
            </span>
          ))}
        </dd>

        {/* 時代の帯は**目盛りではない**と本文で名乗る。段は世代の順なので、上下に
            並ぶカードの年は 4% ほど前後する（実測 3,320 組中 135 組）。精度を名乗って
            数値の軸を引くと、そのずれが1件ずつ突き合わせられる嘘になる。 */}
        <dt className="font-semibold text-muted-foreground">左端の年</dt>
        <dd>
          {/* **「年が前後することがある」だけでは足りない。** 読者が見るのは帯の中で
              隣り合う2枚（元帝 前49 と 樊嫻都 22没）で、そこに丸めの話は効かない。
              **どういう人がずれるのかを名指しする** — ずれの上位12人は后妃と傍系に
              偏っていて、しかも前漢末〜後漢初に固まっている（新・玄漢・後漢が同じ
              世代に重なる区間）。上位8人を外しても 74/135 残るので、機械で寄せて
              消せる種類のずれではない。 */}
          <span>
            その辺りの段の<strong className="font-semibold">おおよその</strong>時代。
            段は世代の順に決めてあるので、后妃や傍系のカードは帯の年と数十年ずれることがある
            （別々の王朝が同じ世代に重なる区間ではとくに）
          </span>
        </dd>
        </dl>
      </details>

      <ChapterFlow layout={layout} jumps={jumpTargets(layout)} entryId={chapter.entryId} />
    </main>
  );
}
