// 系譜・即位経路グラフ(全域版・公開整備までnoindex)。
// - 皇帝365人+ブリッジ人物のグラフ全体を「縦=時間・横=王朝カラム(時代で再利用)」で描く。
//   公開整備(S4)まで nav-data.ts / SITE_SECTIONS には登録しない(ナビ・トップカード・
//   sitemapから自動的に除外される)。robotsもnoindex。
// - レイアウトはビルド時計算(getKinshipGraphData → kinship-layout.ts)。
// - テキスト版(SEO・a11y代替)は王朝ごとに継承チェーン・血縁・婚姻を列挙し、
//   系譜主張(genealogicalClaims)も一覧化する。

import { PageHeader, Section } from "@/components/layout/page-header";
import { KinshipChart } from "@/components/kinship/kinship-chart";
import { getKinshipGraphData } from "@/lib/emperors";
import { buildMetadata } from "@/lib/seo";

export const metadata = {
  ...buildMetadata({
    path: "/kinship",
    title: "系譜・即位経路グラフ",
    description:
      "始皇帝から溥儀まで、皇帝365人の継承関係（世襲・簒奪・禅譲など）と血縁・婚姻のつながりを、ひとつの縦時間軸グラフで描きます。",
  }),
  robots: { index: false },
};

export default function KinshipPage() {
  const layout = getKinshipGraphData();
  const emperorCountShown = new Set(
    layout.nodes.filter((n) => n.kind === "emperor").map((n) => n.id),
  ).size;
  const personCountShown = layout.nodes.filter((n) => n.kind === "person").length;
  const succCount = layout.edges.filter((e) => e.edgeType === "succession").length;
  const kinCount = layout.edges.filter((e) => e.edgeType === "kinship").length;
  const marriageCount = layout.edges.filter((e) => e.edgeType === "marriage").length;

  // 「テキストで見る」用: エッジを到達側(新帝・子)ノードの王朝ごとにまとめ、
  // 時系列(到達側ノードのy)で列挙する。クロール可能テキストはclient外に置く原則・
  // a11y代替を兼ねる。婚姻は無向のためfrom側の王朝にまとめる。
  const nodeByKey = new Map(layout.nodes.map((n) => [n.key, n]));
  const firstCapsule = new Map<string, (typeof layout.nodes)[number]>();
  for (const n of layout.nodes) {
    const cur = firstCapsule.get(n.id);
    if (!cur || n.y < cur.y) firstCapsule.set(n.id, n);
  }
  void nodeByKey;
  interface DynGroup {
    label: string;
    y: number;
    succession: typeof layout.edges;
    kinship: typeof layout.edges;
    marriage: typeof layout.edges;
  }
  const groups = new Map<string, DynGroup>();
  const groupOf = (anchorId: string): DynGroup => {
    const anchor = firstCapsule.get(anchorId)!;
    const label = anchor.groupLabel;
    let g = groups.get(label);
    if (!g) {
      g = { label, y: anchor.y, succession: [], kinship: [], marriage: [] };
      groups.set(label, g);
    }
    g.y = Math.min(g.y, anchor.y);
    return g;
  };
  for (const e of layout.edges) {
    if (e.edgeType === "succession") groupOf(e.to).succession.push(e);
    else if (e.edgeType === "kinship") groupOf(e.to).kinship.push(e);
    else groupOf(e.from).marriage.push(e);
  }
  const sortedGroups = [...groups.values()].sort((p, q) => p.y - q.y);
  for (const g of sortedGroups) {
    const yOf = (id: string) => firstCapsule.get(id)?.y ?? 0;
    g.succession.sort((p, q) => yOf(p.to) - yOf(q.to));
    g.kinship.sort((p, q) => yOf(p.to) - yOf(q.to));
    g.marriage.sort((p, q) => yOf(p.from) - yOf(q.from));
  }

  return (
    <>
      <PageHeader
        title="系譜・即位経路グラフ"
        description={`始皇帝から溥儀まで、皇帝${emperorCountShown}人と系譜をつなぐ非皇帝${personCountShown}人を、継承${succCount}本・血縁${kinCount}本・婚姻${marriageCount}本のつながりでひとつのグラフに描きます。縦が時間（上が古い）、横は王朝のカラムです（時代ごとにカラムを使い回します）。`}
      />
      <Section
        id="chart"
        title="継承と血縁のグラフ（前221年〜1945年）"
        description="カプセルは皇帝の在位期間（色は王朝、灰色は並立政権。復位した皇帝はカプセルが複数になり、左側面の点線でつながります）、破線枠は皇帝でないつなぎの人物（生没年または系譜からの推定で配置）。朱色の矢印が継承で、ラベルは即位経路の分類、点線＋?は史書間・史書内で記述が対立するもの（諸説あり）。灰色の実線は血縁（親→子）、二重線は婚姻。◆は先代を持たないグラフの根（建国など）、◇遠祖は伝説的遠祖の系譜主張を持つ人物。ノードにマウスを載せると詳細、クリックで前後のつながりを強調表示します（もう一度クリックか背景クリックで解除）。"
      >
        <KinshipChart layout={layout} />
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          凡例: 朱の実線矢印＝正史で裏付けられた継承／朱の点線矢印＋?＝諸説あり／灰の実線＝血縁（親→子）／灰の二重線＝婚姻／灰の点線（カプセル左側面）＝同一人物の復位／枠線カプセル＝皇帝（高さが在位期間）／破線枠＝非皇帝（追尊皇帝・宗室など）／◆建国・◆擁立＝先代を持たない政権の起点／◇遠祖＝伝説的遠祖の系譜主張（正史に記録された自称。ツールチップに内容）。短い在位が密集する期間は時間軸を局所的に引き伸ばして描いています（左の年目盛りの間隔が広がっている箇所。ノードの位置と年目盛りは常に対応します）。
        </p>
      </Section>
      <Section
        id="text"
        title="テキストで見る継承の流れ"
        description="グラフと同じ内容を、王朝ごとに先代→新帝の順で列挙したものです。血縁は親→子、婚姻は夫⚭妻の順です。"
      >
        <div className="grid max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sortedGroups
            .filter((g) => g.succession.length + g.kinship.length + g.marriage.length > 0)
            .map((g) => (
              <div key={g.label}>
                <h3 className="mb-2 text-sm font-semibold text-foreground">{g.label}</h3>
                {g.succession.length > 0 && (
                  <ul className="space-y-1 text-sm text-foreground/90">
                    {g.succession.map((e) => (
                      <li key={`${e.from}→${e.to}`}>
                        {e.fromLabel} →〔{e.label}〕 {e.toLabel}
                      </li>
                    ))}
                  </ul>
                )}
                {g.kinship.length > 0 && (
                  <>
                    <h4 className="mb-1 mt-3 text-xs font-semibold text-muted-foreground">
                      血縁
                    </h4>
                    <ul className="space-y-1 text-sm text-foreground/90">
                      {g.kinship.map((e) => (
                        <li key={`${e.from}→${e.to}`}>
                          {e.fromLabel} →〔{e.label}〕 {e.toLabel}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {g.marriage.length > 0 && (
                  <>
                    <h4 className="mb-1 mt-3 text-xs font-semibold text-muted-foreground">
                      婚姻
                    </h4>
                    <ul className="space-y-1 text-sm text-foreground/90">
                      {g.marriage.map((e) => (
                        <li key={`${e.from}⚭${e.to}`}>
                          {e.fromLabel} ⚭ {e.toLabel}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ))}
        </div>
      </Section>
      <Section
        id="claims"
        title="伝説的遠祖の系譜主張"
        description="正史に記録された「王朝や皇帝が自称した遠い祖先」の一覧です（黄帝・堯・舜など伝説上の人物に連なる主張が中心）。グラフのノードとしては描かず、◇遠祖バッジとこの一覧で示します。史実の裏付けを主張するものではありません。"
      >
        <ul className="max-w-4xl space-y-2 text-sm text-foreground/90">
          {layout.claimsList.map((c) => (
            <li key={c.claimantId}>
              <span className="font-semibold">{c.claimantLabel}</span>
              <span className="text-muted-foreground">（{c.dynastyLabel}）</span> —{" "}
              {c.ancestry}
              <span className="text-xs text-muted-foreground">（{c.source}）</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
