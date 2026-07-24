// 系譜・即位経路グラフ(全面再設計版・段階公開中)。
// - 構成: 時代チャプター縦積み(章を縦に積み、時間は下へ連続)。章内は王朝バンドを
//   横に並べ、バンド内は家系図(兄弟横並び・夫婦連結・母別の垂下線)。
// - 王朝内の継承は矢印にせず、カプセル内の「第N代・即位経路」表記で示す。
//   矢印は王朝間の交代(禅譲・簒奪など)のみ。
// - 現在は第1章(秦・漢)のパイロット。全章実装まで nav-data.ts / SITE_SECTIONS には
//   登録せず、robotsもnoindex。
// - レイアウトはビルド時計算(getKinshipGraphData → src/lib/kinship/)。

import { PageHeader, Section } from "@/components/layout/page-header";
import { KinshipChart } from "@/components/kinship/kinship-chart";
import { getKinshipGraphData } from "@/lib/emperors";
import { buildMetadata } from "@/lib/seo";

export const metadata = {
  ...buildMetadata({
    path: "/kinship",
    title: "系譜・家系図",
    description:
      "中国皇帝の系譜を、時代ごとの章に分けた家系図で描くページです。兄弟・夫婦・生母の関係と、禅譲・簒奪など王朝間の交代の系譜関係を示します（段階公開中・現在は秦・漢の章のみ）。",
  }),
  robots: { index: false },
};

const LEGEND =
  "凡例: 色付きカプセル＝皇帝（高さが在位期間・2行目は「第N代・即位経路」）／破線枠＝皇帝でないつなぎの人物（生没年または系譜からの推定で配置）／丸枠＝后妃など配偶者（位置は相手方＝夫または子の父の在位に整列。生没年はツールチップ）／二重線＝皇后との夫婦、細線＝妃嬪等の生母／灰の縦横線＝親子（夫婦の連結点から子へ降りる線。母ごとに分かれ、誰と誰の間の子かを示す）／朱の矢印＝王朝間の交代（禅譲・簒奪など。ラベルは経路と先代との続柄）／点線＋?＝史書間で記述が対立するもの（諸説あり）。縦スケールは1年＝8pxの完全等間隔です（在位が極端に短い皇帝のカプセルは名前が読める最小の高さで描くため、実期間よりわずかに長くなることがあります。また親子の線が見えるよう、先代の在位に隣接して即位した皇帝は上辺だけをわずかに下げ、下辺＝退位年の位置は保ちます）。章の開始前に没した祖先（荘襄王など）は最上部に圧縮して配置します。伝説的な遠祖の系譜主張は皇帝カプセルのツールチップで示します。";

export default function KinshipPage() {
  const chapters = getKinshipGraphData();

  return (
    <>
      <PageHeader
        title="系譜・家系図"
        description="皇帝間の血縁（実父・実母・養親）・婚姻と、王朝間の交代（禅譲・簒奪など）の系譜関係を、時代ごとの章に分けた家系図で描きます。縦が時間（上が古い）、横が王朝です。王朝内の継承は矢印ではなくカプセル内の「第N代・即位経路」で示し、矢印は王朝間の交代だけに使います。現在は第1章（秦・漢）を先行公開しています（生母データの調査進行にあわせて章を追加予定）。"
      />
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
