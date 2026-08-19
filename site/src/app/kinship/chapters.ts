// 系譜図の章の表。**レイアウト JSON・入口の皇帝・章ごとの但し書きはここが唯一の正**
// （scripts/build-kinship-layout.mjs の CHAPTERS と1対1。あちらは誰を解くか、
// こちらはどう出すか）。章を足したら KINSHIP_RULES.md のチェックリストを踏む。
import type { KinshipLayout } from "@/components/kinship/chapter-flow";
import layoutQinHan from "@/lib/kinship/layout.qin-han.json";
import layoutThreeKingdomsJin from "@/lib/kinship/layout.three-kingdoms-jin.json";
import layoutEasternJinSixteen from "@/lib/kinship/layout.eastern-jin-sixteen.json";
import layoutNorthernSouthern from "@/lib/kinship/layout.northern-southern.json";
import layoutSuiTang from "@/lib/kinship/layout.sui-tang.json";
import layoutFiveDynasties from "@/lib/kinship/layout.five-dynasties.json";

export type KinshipChapter = {
  /** ページの URL（章ナビの行き先） */
  path: string;
  /** h1 と章ナビに出す名前 */
  heading: string;
  /** 初期表示で寄せる皇帝（fitView）。章の入口 — 時代の最初期で本流にいる人 */
  entryId: string;
  layout: KinshipLayout;
  /** 章ごとの但し書き（客人の説明など）。無い章は出さない */
  note?: string;
};

export const KINSHIP_CHAPTERS: KinshipChapter[] = [
  {
    path: "/kinship",
    heading: "秦・漢",
    entryId: "han-gaozu",
    layout: layoutQinHan as unknown as KinshipLayout,
  },
  {
    path: "/kinship/three-kingdoms-jin",
    heading: "三国・西晋",
    entryId: "wei-wendi",
    layout: layoutThreeKingdomsJin as unknown as KinshipLayout,
    // 客人（章の eraId ではない人物）を出す唯一の章なので、誰なのかを本文で名乗る。
    note: "後漢の献帝は、魏（文帝）への禅譲を示すためこの章にも出している。",
  },
  {
    path: "/kinship/eastern-jin-sixteen",
    heading: "東晋・十六国",
    entryId: "dongjin-yuandi",
    layout: layoutEasternJinSixteen as unknown as KinshipLayout,
    // 章の切れ目の但し書き。東晋の元帝は西晋の宗室（司馬懿の曾孫）で、
    // 父の司馬覲は前の章にいる — 禅譲ではないので客人としては連れて来ない。
    note: "東晋の元帝は西晋の一族（司馬懿の曾孫）で、父の司馬覲は「三国・西晋」の章に出ている。",
  },
  {
    path: "/kinship/northern-southern",
    heading: "南北朝",
    entryId: "liu-song-wudi",
    layout: layoutNorthernSouthern as unknown as KinshipLayout,
    note: "東晋の恭帝は、宋（武帝）への禅譲を示すためこの章にも出している。",
  },
  {
    path: "/kinship/sui-tang",
    heading: "隋・唐",
    entryId: "sui-wendi",
    layout: layoutSuiTang as unknown as KinshipLayout,
    note: "北周の静帝は、隋（文帝）への禅譲を示すためこの章にも出している。",
  },
  {
    path: "/kinship/five-dynasties",
    heading: "五代十国",
    entryId: "wudai-houliang-taizu",
    layout: layoutFiveDynasties as unknown as KinshipLayout,
    note: "唐の哀帝は、後梁（太祖）への禅譲を示すためこの章にも出している。",
  },
];

/**
 * 系譜図のカードに出る名前の一覧。ふりがな被覆レポート（reportReadingCoverage →
 * .ruby-displayed.json）に載せるためのもので、読みの解決そのものは chapter-page の
 * rubyOf が行う（未登録ならそちらでビルドが落ちる）。
 */
export function kinshipDisplayNames(): string[] {
  return KINSHIP_CHAPTERS.flatMap((c) =>
    c.layout.nodes.flatMap((n) => (n.annot ? [n.main, n.annot] : [n.main])),
  );
}
