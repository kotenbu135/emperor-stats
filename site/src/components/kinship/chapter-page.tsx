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
import { rubyOf } from "@/lib/name-readings";

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
  "northern-wei": "北魏",
  "liu-song": "宋（劉宋）",
  "southern-qi": "南斉",
  "southern-liang": "梁",
  "eastern-wei": "東魏",
  "western-wei": "西魏",
  "northern-qi": "北斉",
  "northern-zhou": "北周",
  "houjing-han": "漢（侯景）",
  "western-liang": "後梁（西梁）",
  chen: "陳",
  sui: "隋",
  tang: "唐",
  "wu-zhou": "周（武周）",
  "anshi-yan": "燕（安史）",
  xiqin: "秦（薛挙）",
  dingyang: "定楊（劉武周）",
  zheng: "鄭（王世充）",
  xu: "許（宇文化及）",
  "xiaoxian-liang": "梁（蕭銑）",
  "liangshidu-liang": "梁（梁師都）",
  "suimo-chu": "楚（林士弘）",
  "zhucan-chu": "楚（朱粲）",
  "liguigui-liang": "涼（李軌）",
  "suimo-wu": "呉（李子通）",
  "suimo-song": "宋（輔公祏）",
  "zhuci-qin": "秦（朱泚）",
  "lixilie-chu": "楚（李希烈）",
  "huangchao-qi": "斉（黄巣）",
  "later-liang": "後梁",
  "later-tang": "後唐",
  "later-jin": "後晋",
  "later-han": "後漢（五代）",
  "later-zhou": "後周",
  "yang-wu": "呉（楊呉）",
  "former-shu": "前蜀",
  "later-shu": "後蜀",
  "southern-han": "南漢",
  min: "閩",
  "southern-tang": "南唐",
  "northern-han": "北漢",
  "jie-yan": "燕（劉守光）",
  "northern-song": "北宋",
  "southern-song": "南宋",
  liao: "遼",
  "western-liao": "西遼",
  "jin-jurchen": "金",
  "western-xia": "西夏",
  "zhangbangchang-chu": "楚（張邦昌）",
  "liuyu-qi": "斉（劉豫）",
  yuan: "元",
  "northern-yuan": "北元",
  "hanlin-song": "宋（韓林児）",
  tianwan: "天完（徐寿輝）",
  "chen-han": "陳漢",
  "ming-xia": "夏（明玉珍）",
  ming: "明",
  "southern-ming": "南明",
  shun: "順（李自成）",
  xi: "西（張献忠）",
  qing: "清",
  "wu-zhou-sanfan": "周（呉三桂）",
  "empire-of-china": "中華帝国",
};

export function KinshipChapterPage({ chapter }: { chapter: KinshipChapter }) {
  // 名前へのふりがな（Issue #20）。レイアウト JSON は平文のまま持ち、ルビ記法は
  // ここ（サーバー側）で rubyOf が付ける — 未登録の名前はビルドが落ちるので、
  // 系譜図に人を足したら data/name-readings.json にも読みを足すこと。
  // 表示 ON/OFF はサイト共通のトグル（サイドバー最下部・モバイルヘッダーの「字」）。
  const layout: KinshipLayout = {
    ...chapter.layout,
    nodes: chapter.layout.nodes.map((n) => ({
      ...n,
      mainRuby: rubyOf(n.main),
      annotRuby: n.annot ? rubyOf(n.annot) : null,
    })),
  };
  const kindsInChapter = new Set(layout.edges.map((e) => e.kind));
  const lineLegend = LINE_LEGEND.filter((l) => l.kinds.some((k) => kindsInChapter.has(k as never)));
  // 凡例は図のツールバー右端の「凡例」ボタンから **JS なしのポップオーバー**
  // （<details> ＋ absolute）で開く。ヘッダーの独立行に置くと畳んでいても1行ぶん
  // 図の縦を食い、開いたときに図全体が押し下がる（2026-08-19「凡例はデフォルトで
  // 閉じる」）。<details> なので中身は静的 HTML に残る（ui/accordion.tsx を使わない理由）。
  // **政権ごとのカードの色見本は置かない** — 「政権へ移動」ボタン列が同じ色の点＋
  // 政権名を出しており、丸ごと重複だった（2026-08-19 ユーザー指示）。
  const legend = (
    <details className="relative">
      <summary className="inline-flex h-8 cursor-pointer list-none items-center rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-seal [&::-webkit-details-marker]:hidden">
        凡例
      </summary>
      <div className="absolute right-0 top-full z-20 mt-1.5 w-[min(30rem,85vw)] rounded-md border border-border bg-card p-3 shadow-md">
        <dl className="grid grid-cols-[max-content_1fr] items-baseline gap-x-4 gap-y-2.5 text-[13px]">
          {/* **見本は図と同じ dasharray で引く。** 文字（—— や - - -）で代用すると
              線種を変えたときに凡例だけ古いままになる。 */}
          <dt className="font-semibold text-muted-foreground">線の意味</dt>
          <dd className="flex flex-col gap-1.5">
            {lineLegend.map((l) => (
              <span key={l.label} className="flex items-center gap-2">
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
            その辺りの段の<strong className="font-semibold">おおよその</strong>時代。
            段は世代の順に決めてあるので、后妃や傍系のカードは帯の年と数十年ずれることがある
          </dd>

          <dt className="font-semibold text-muted-foreground">カードの数字</dt>
          <dd>皇帝は在位年、親族は生没年</dd>

          {chapter.note ? (
            <>
              <dt className="font-semibold text-muted-foreground">注記</dt>
              <dd>{chapter.note}</dd>
            </>
          ) : null}
        </dl>
      </div>
    </details>
  );
  return (
    <main className="flex h-[calc(100vh-4rem)] flex-col gap-3 p-4">
      {/* ヘッダーは1行だけ。**h1 は全章共通の「系譜図」** — 章名を h1 にすると
          その幅でタブ列の開始位置がページごとにずれる（2026-08-19「ページを
          切り替えたときにボタンの配置がかわってキモい」）。章名は隣のタブの
          押下状態と <title> が名乗る。 */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-3">
          {/* 他ページの PageHeader と同じ「印章の朱のアクセントバー＋font-heading」。
              帯ごと py-section にすると図の縦を食うので、意匠だけ写す。 */}
          <span aria-hidden className="h-6 w-1 shrink-0 rounded-full bg-seal" />
          <h1 className="font-heading text-xl font-semibold text-foreground">系譜図</h1>
        </div>
        {/* 章ナビ＝セグメントコントロール。**全タブ同寸で、現在章は色だけ変える**
            （寸法や枠が変わるとページ切り替えで並びが動く）。 */}
        <nav
          aria-label="章"
          className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-secondary/60 p-0.5"
        >
          {KINSHIP_CHAPTERS.map((c) =>
            c.path === chapter.path ? (
              <span
                key={c.path}
                aria-current="page"
                className="whitespace-nowrap rounded-md bg-seal px-3 py-1 font-heading text-[13px] font-semibold text-seal-foreground shadow-sm"
              >
                {c.heading}
              </span>
            ) : (
              <Link
                key={c.path}
                href={c.path}
                className="whitespace-nowrap rounded-md px-3 py-1 font-heading text-[13px] font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-seal"
              >
                {c.heading}
              </Link>
            ),
          )}
        </nav>
      </header>

      <ChapterFlow
        layout={layout}
        jumps={jumpTargets(layout)}
        entryId={chapter.entryId}
        legend={legend}
      />
    </main>
  );
}
