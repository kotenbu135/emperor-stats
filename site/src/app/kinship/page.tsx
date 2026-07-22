// 系譜・即位経路グラフの試作ページ(検証用・非公開導線)。
// - 目的: フェーズ1調査済み範囲(秦〜後漢36人・継承エッジ29本)で方式③(縦時間軸グラフ)が
//   正しく描画できるかの検証。データ完了後の本実装まで nav-data.ts / SITE_SECTIONS には
//   登録しない(ナビ・トップカード・sitemapから自動的に除外される)。robotsもnoindex。
// - レイアウトはビルド時計算(getKinshipGraphData → kinship-layout.ts)。

import { PageHeader, Section } from "@/components/layout/page-header";
import { KinshipChart } from "@/components/kinship/kinship-chart";
import { getKinshipGraphData } from "@/lib/emperors";
import { buildMetadata } from "@/lib/seo";

export const metadata = {
  ...buildMetadata({
    path: "/kinship",
    title: "系譜・即位経路グラフ（試作）",
    description:
      "皇帝間の継承関係(世襲・簒奪・禅譲など)を縦時間軸のグラフで描く試作ページです。現在は調査済みの秦〜後漢36人のみを表示しています。",
  }),
  robots: { index: false },
};

export default function KinshipPage() {
  const layout = getKinshipGraphData();
  const emperorCountShown = layout.nodes.filter((n) => n.kind === "emperor").length;

  // 「テキストで見る」用: エッジをレーンごとに時系列で列挙(クロール可能テキストは
  // client外に置く原則・a11y代替を兼ねる簡易版)。
  const nodeById = new Map(layout.nodes.map((n) => [n.id, n]));
  const chainsByLane = layout.lanes.map((lane) => {
    const edges = layout.edges
      .filter((e) => {
        const to = nodeById.get(e.to);
        if (!to) return false;
        const cx = to.x + to.w / 2;
        return cx >= lane.x && cx <= lane.x + lane.width;
      })
      .sort((p, q) => (nodeById.get(p.to)?.y ?? 0) - (nodeById.get(q.to)?.y ?? 0));
    return { label: lane.label, edges };
  });

  return (
    <>
      <PageHeader
        title="系譜・即位経路グラフ（試作）"
        description={`皇帝間の継承関係を「縦＝時間（上が古い）・横＝王朝レーン」のグラフで描く試作ページです。現在はデータ調査が完了している秦〜後漢の${emperorCountShown}人・継承エッジ${layout.edges.length}本のみを表示しています（血縁・婚姻の線は今後のデータ調査完了後に追加予定）。`}
      />
      <Section
        id="chart"
        title="継承グラフ（秦〜後漢）"
        description="カプセルは皇帝の在位期間（色は王朝、灰色は並立政権）、破線枠は皇帝でないつなぎの人物（生没年で配置）。朱色の矢印が継承で、ラベルは即位経路の分類、点線＋?は史書間・史書内で記述が対立するもの（諸説あり）。◆は先代を持たないグラフの根（建国など）。ノードにマウスを載せると詳細、クリックで前後のつながりを強調表示します（もう一度クリックか背景クリックで解除）。"
      >
        <KinshipChart layout={layout} />
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          凡例: 実線矢印＝正史で裏付けられた継承／点線矢印＋?＝諸説あり／枠線カプセル＝皇帝（高さが在位期間、短い在位は最小の高さで表示するため時間軸は近似）／破線枠＝非皇帝（追尊皇帝・宗室など）／◆建国・◆擁立＝先代を持たない政権の起点。
        </p>
      </Section>
      <Section
        id="text"
        title="テキストで見る継承の流れ"
        description="グラフと同じ内容を、レーン（王朝）ごとに先代→新帝の順で列挙したものです。"
      >
        <div className="grid max-w-4xl gap-6 md:grid-cols-2">
          {chainsByLane
            .filter((c) => c.edges.length > 0)
            .map((c) => (
              <div key={c.label}>
                <h3 className="mb-2 text-sm font-semibold text-foreground">{c.label}</h3>
                <ul className="space-y-1 text-sm text-foreground/90">
                  {c.edges.map((e) => (
                    <li key={`${e.from}→${e.to}`}>
                      {e.fromLabel} →〔{e.label}〕 {e.toLabel}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      </Section>
    </>
  );
}
