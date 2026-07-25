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
import { KinshipChart } from "@/components/kinship/kinship-chart";
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

const LEGEND =
  "凡例: 色付きカプセル＝皇帝（高さが在位期間・2行目は「第N代・即位経路」）／破線枠＝皇帝でないつなぎの人物（生没年または系譜からの推定で配置。2行目がある場合は「第N代・称号」＝皇帝を称さなかった君主で、王朝の代数はこの人物を含めて数えます）／丸枠＝后妃など配偶者（位置は相手方＝夫または子の父の在位に整列。生没年はツールチップ）／二重線＝皇后との夫婦、細線＝妃嬪等の生母／灰の縦横線＝親子（夫婦の連結点から子へ降りる線。母ごとに分かれ、誰と誰の間の子かを示す）／破線の親子線＝養子縁組（例: 明帝→曹芳）または実父に諸説あり（ツールチップで区別）／横向きの親子線には「◯◯の子」「◯◯の娘」と続柄を添えます（他家に嫁いだ娘など、親と同じ高さに置かれる人物への線）／朱の矢印＝王朝間の交代（禅譲・簒奪など。ラベルは経路と先代との続柄）／点線＋?＝史書間で記述が対立するもの（諸説あり）。縦スケールは1年＝8pxの完全等間隔です（在位が極端に短い皇帝のカプセルは名前が読める最小の高さで描くため、実期間よりわずかに長くなることがあります。また親子の線が見えるよう、先代の在位に隣接して即位した皇帝は上辺だけをわずかに下げ、下辺＝退位年の位置は保ちます）。章の開始前に没した祖先（荘襄王など）は最上部に圧縮して配置します。伝説的な遠祖の系譜主張は皇帝カプセルのツールチップで示します。";

export default function KinshipPage() {
  const chapters = CHAPTERS;

  return (
    <>
      <PageHeader
        title="系譜・家系図"
        description="皇帝間の血縁（実父・実母・養親）・婚姻と、王朝間の交代（禅譲・簒奪など）の系譜関係を、時代ごとの章に分けた家系図で描きます。縦が時間（上が古い）、横が王朝です。王朝内の継承は矢印ではなくカプセル内の「第N代・即位経路」で示し、矢印は王朝間の交代だけに使います。"
      />
      <div className="px-6 pt-6 md:px-10">
        <p className="max-w-3xl rounded-md border border-seal/30 bg-seal/5 px-4 py-3 text-sm leading-relaxed text-foreground">
          <span className="font-semibold">暫定公開版です。</span>
          現在掲載しているのは{COVERAGE}で、隋以降の章は準備中です。掲載済みの章についても、
          配置や表記は今後の調査にあわせて変わることがあります。
        </p>
      </div>
      {chapters.map((c, i) => (
        <Section
          key={c.id}
          id={c.id}
          title={`第${i + 1}章 ${c.title}（${c.period}）`}
          description="皇帝にマウスを載せると概要、クリックで全項目（在位・死因・順位などの詳細ダイアログ。他の統計ページと共通）を表示します。名前はドラッグで選択してコピーできます。"
        >
          <KinshipChart layout={c} />
          <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            {LEGEND}
          </p>
        </Section>
      ))}
    </>
  );
}
