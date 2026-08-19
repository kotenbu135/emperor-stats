// 系譜図の章の表。**レイアウト JSON・入口の皇帝・章ごとの但し書きはここが唯一の正**
// （scripts/build-kinship-layout.mjs の CHAPTERS と1対1。あちらは誰を解くか、
// こちらはどう出すか）。章を足したら KINSHIP_RULES.md のチェックリストを踏む。
import type { KinshipLayout } from "@/components/kinship/chapter-flow";
import layoutQinHan from "@/lib/kinship/layout.qin-han.json";
import layoutThreeKingdomsJin from "@/lib/kinship/layout.three-kingdoms-jin.json";

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
];
