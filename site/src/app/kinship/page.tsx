import { ChapterFigure } from "@/components/kinship/chapter-figure";
import { PageHeader } from "@/components/layout/page-header";
import { getKinshipChapters } from "@/lib/kinship/layout";
import { BreadcrumbJsonLd, buildMetadata, StatsPageJsonLd } from "@/lib/seo";

// title/description はナビの短いラベル（SITE_SECTIONS）とは別物。検索結果に出るのはこちら。
const PAGE_TITLE = "系譜図";
const PAGE_DESCRIPTION =
  "皇帝どうしの血縁を、縦軸を実時間にした図で見られます。箱の上辺が即位年・下辺が退位年で、1年を8pxの等間隔で取っているため、在位の長さと世代の重なりがそのまま高さに出ます。秦・漢から五代十国までの6章。";

export const metadata = buildMetadata({
  path: "/kinship",
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
});

export default function KinshipPage() {
  const chapters = getKinshipChapters();
  const emperors = chapters.reduce((a, c) => a + c.emperorCount, 0);
  const persons = chapters.reduce((a, c) => a + c.personCount, 0);

  return (
    <>
      <BreadcrumbJsonLd label={PAGE_TITLE} path="/kinship" />
      <StatsPageJsonLd name={PAGE_TITLE} description={PAGE_DESCRIPTION} path="/kinship" />
      <PageHeader
        title={PAGE_TITLE}
        description={`秦・漢から五代十国までの6章。皇帝${emperors}名と、その父母・后妃${persons}名を、縦軸を実時間にして並べた図です。箱をクリックすると個別ページへ移動できます。`}
      />
      <div className="space-y-section px-gutter py-section md:px-gutter-wide">
        {chapters.map((chapter) => (
          <section key={chapter.id} id={chapter.id} className="scroll-mt-24">
            <h2 className="mb-1 text-lg font-medium tracking-wide">{chapter.label}</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              皇帝{chapter.emperorCount}名・縁者{chapter.personCount}名
              {chapter.inferredCount > 0 && (
                <>
                  {/* 推定した人を隠さない。図の中では薄く描いてあるが、
                      それだけだと「薄い」の意味が伝わらないので数を添える。 */}
                  ・うち{chapter.inferredCount}名は生没年が原典に無く、最初の子の年から推定した位置
                </>
              )}
            </p>
            <ChapterFigure chapter={chapter} />
          </section>
        ))}
      </div>
      <div className="px-gutter pb-section text-sm text-muted-foreground md:px-gutter-wide">
        <p className="max-w-content">
          縦の位置は実時間で、1年 = 8px の等間隔です。皇帝の箱は上辺が即位年・下辺が退位年
          （在位が短い場合も読めるように下辺だけを最小の高さまで延ばしています）。
          点線の枠は皇帝ではない人物、破線の線は養子縁組による親子です。
          横の位置は血縁の近さを見やすくするために機械で解いたもので、意味を持ちません。
        </p>
      </div>
    </>
  );
}
