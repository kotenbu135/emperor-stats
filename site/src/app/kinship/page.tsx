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
  "凡例: 色付きカプセル＝皇帝（高さが在位期間・2行目は「第N代・即位経路」）／破線枠＝皇帝でないつなぎの人物（生没年または系譜からの推定で配置）／丸枠＝后妃など配偶者（位置は相手方＝夫または子の父の在位に整列。生没年はツールチップ）／二重線＝皇后との夫婦、細線＝妃嬪等の生母／灰の縦横線＝親子（夫婦の連結点から子へ降りる線。母ごとに分かれ、誰と誰の間の子かを示す）／朱の矢印＝王朝間の交代（禅譲・簒奪など。ラベルは経路と先代との続柄）／点線＋?＝史書間で記述が対立するもの（諸説あり）。縦スケールは1年＝8pxの完全等間隔です（在位が極端に短い皇帝のカプセルは名前が読める最小の高さで描くため、実期間よりわずかに長くなることがあります。また親子の線が見えるよう、直後に即位した子はわずかに下へずらします）。章の開始前に没した祖先（荘襄王など）は最上部に圧縮して配置します。伝説的な遠祖の系譜主張はツールチップとページ末尾の一覧で示します。";

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
          description="ノードにマウスを載せると詳細、クリックで家族（親子・夫婦）と関係エッジを強調表示します（もう一度クリックか背景クリックで解除）。名前はドラッグで選択してコピーできます。"
        >
          <KinshipChart layout={c} />
          <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            {LEGEND}
          </p>
        </Section>
      ))}
      <Section
        id="text"
        title="テキストで見る系譜"
        description="グラフと同じ内容を、王朝ごとに歴代順で列挙したものです（即位経路・父・母・先代との続柄）。"
      >
        {chapters.map((c) => (
          <div key={c.id} className="mb-8">
            <h3 className="mb-3 text-base font-semibold text-foreground">
              {c.title}（{c.period}）
            </h3>
            <div className="grid max-w-5xl gap-6 md:grid-cols-2">
              {c.textDynasties.map((d) => (
                <div key={d.label}>
                  <h4 className="mb-2 text-sm font-semibold text-foreground">
                    {d.label}
                  </h4>
                  <ul className="space-y-1 text-sm text-foreground/90">
                    {d.emperors.map((e) => (
                      <li key={e.id}>
                        {e.label}〔{e.sub}〕
                        {e.detail && (
                          <span className="text-muted-foreground">
                            {" "}
                            — {e.detail}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {c.textTransitions.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 text-sm font-semibold text-foreground">
                  王朝間の交代
                </h4>
                <ul className="space-y-1 text-sm text-foreground/90">
                  {c.textTransitions.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
            {c.claims.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 text-sm font-semibold text-foreground">
                  遠祖の系譜主張（史実未確認・主張として記録）
                </h4>
                <ul className="max-w-4xl space-y-1 text-sm text-foreground/90">
                  {c.claims.map((cl) => (
                    <li key={`${cl.claimant}:${cl.ancestry}`}>
                      {cl.claimant} — {cl.ancestry}
                      <span className="text-muted-foreground">
                        （出典: {cl.source}）
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </Section>
    </>
  );
}
