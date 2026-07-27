// 系譜・即位経路グラフ(全面再設計版・段階公開中)。
// - 構成: 時代チャプター縦積み(章を縦に積み、時間は下へ連続)。章内は王朝バンドを
//   横に並べ、バンド内は家系図(兄弟横並び・夫婦連結・母別の垂下線)。
// - 王朝内の継承は矢印にせず、カプセル内の「第N代・即位経路」表記で示す。
//   矢印は王朝間の交代(禅譲・簒奪など)のみ。
// - 段階公開: 現在は第1章(秦・漢)〜第4章(南北朝)。有効な章は chapters.ts の
//   KINSHIP_ENABLED_CHAPTER_IDS が単一の情報源で、この画面の文言もそこから導出する
//   (章を増やしたときに文言だけ古くなる事故を防ぐ)。全章そろうまで SITE_SECTIONS
//   (トップのカード一覧・sitemap.xml)には登録せず、robotsもnoindexのままにする。
//   メニュー(nav-data.ts)にだけ「系譜・家系図（一部公開）」として載せている。
// - レイアウトはビルド時計算(getKinshipGraphData → src/lib/kinship/)。

import { PageHeader, Section } from "@/components/layout/page-header";
import {
  BELOW_KINSHIP_NAV,
  KinshipChapterNav,
} from "@/components/kinship/kinship-chapter-nav";
import { KinshipChart } from "@/components/kinship/kinship-chart";
import { KinshipLegend } from "@/components/kinship/kinship-legend";
import { getKinshipGraphData } from "@/lib/emperors";
import { buildMetadata } from "@/lib/seo";

const CHAPTERS = getKinshipGraphData();

/**
 * 掲載範囲の文言（例:「第1章「秦・漢」から第4章「南北朝」まで（前221年〜589年）」）。
 * 章を増やしたときに説明文だけ古くなるのを防ぐため、有効な章の定義から導出する。
 */
const COVERAGE = (() => {
  const first = CHAPTERS[0];
  const last = CHAPTERS[CHAPTERS.length - 1];
  if (CHAPTERS.length === 1) return `第1章「${first.title}」（${first.period}）`;
  const from = first.period.split("–")[0].trim();
  const to = last.period.split("–")[1].trim();
  return `第1章「${first.title}」から第${CHAPTERS.length}章「${last.title}」まで（${from}〜${to}）`;
})();

export const metadata = {
  ...buildMetadata({
    path: "/kinship",
    title: "系譜・家系図",
    description: `中国皇帝の系譜を、時代ごとの章に分けた家系図で描くページです。兄弟・夫婦・生母の関係と、禅譲・簒奪など王朝間の交代の系譜関係を示します（段階公開中・現在は${COVERAGE}）。`,
  }),
  robots: { index: false },
};

export default function KinshipPage() {
  const chapters = CHAPTERS;

  return (
    <>
      <PageHeader
        title="系譜・家系図"
        description="皇帝間の血縁や王朝間の交代の系譜関係を表しています。"
      />
      {/* 凡例は各章の下に置いた長文をやめ、実際の描画と同じマークを並べた図版を
          ページ先頭に1つだけ置く(ユーザー指示・2026-07-26)。下の固定バーと枠線が
          接して二重線に見えないよう pb で離す。 */}
      <div className="px-6 pb-4 pt-6 md:px-10">
        <KinshipLegend />
      </div>
      {/* 章ジャンプ。sticky が効く範囲は親要素の箱に限られるため、章と同じ最上位の
          並びに置く(上のヘッダー用 div の中に入れると、その div が画面外へ出た
          時点で固定が外れてしまう)。 */}
      <KinshipChapterNav
        chapters={chapters.map((c) => ({ id: c.id, title: c.title }))}
      />
      {chapters.map((c, i) => (
        <Section
          key={c.id}
          id={c.id}
          title={`第${i + 1}章 ${c.title}（${c.period}）`}
          description={c.range}
          // 固定バーの高さぴったりに合わせる(大きいと前の章の横スクロールバーが
          // ジャンプ後の画面上部に覗く。ユーザー指摘・2026-07-26)。
          scrollMt={BELOW_KINSHIP_NAV}
        >
          <KinshipChart layout={c} />
        </Section>
      ))}
    </>
  );
}
