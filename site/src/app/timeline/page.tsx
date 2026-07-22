import Link from "next/link";
import { PageHeader, Section } from "@/components/layout/page-header";
import { RiverTimeline } from "@/components/timeline/river-timeline";
import {
  formatYear,
  getAllEmperorRecords,
  getRiverTimelineData,
  getTimelineData,
} from "@/lib/emperors";
import { BreadcrumbJsonLd, buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/timeline",
  title: "通史年表",
  description:
    "始皇帝から溥儀まで、皇帝を名乗った365人の在位期間を1本の年表に。並立王朝の分裂期と統一期、皇帝不在の期間まで一望できます。",
});

export default function TimelinePage() {
  const records = getAllEmperorRecords();
  const timeline = getTimelineData();
  const river = getRiverTimelineData();

  return (
    <>
      <BreadcrumbJsonLd label="通史年表" path="/timeline" />
      <PageHeader
        title="通史年表"
        description="始皇帝の即位（前221年）から溥儀の退位（1945年）まで、皇帝を名乗った365人の在位を「王朝の大河」として描いた年表です。上が北方・下が南方・中央が統一王朝の座。帯が太い期間は天下に皇帝がその王朝ただ一つの統一期、上下に流れが分かれる時代は複数の皇帝が並び立った分裂期です。"
      />
      <Section
        id="chart"
        title="皇帝在位タイムライン"
        description="「全体」で統一と分裂のリズムを、「拡大」「詳細」で皇帝ひとりひとりの在位を確認できます。灰色の帯は群雄・小政権のまとまりで、クリックすると構成政権に開きます。帯にマウスを載せると概要、クリックで全項目の詳細が開きます。"
      >
        <RiverTimeline river={river} timeline={timeline} records={records} />
      </Section>
      <Section
        id="notes"
        title="この年表の見方"
        description="帯や空白の意味について、いくつか補足があります。"
      >
        <ul className="max-w-3xl list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground/90">
          <li>
            帯は<strong>収録皇帝（実際に皇帝を名乗った365人）の在位期間</strong>
            をつないだものです。王朝としての建国〜滅亡年とは一致しないことがあります（例：清の帯は皇帝号を採用した1636年から始まり、後金のハン時代を含みません）。
          </li>
          <li>
            <strong>帯の太い期間（統一）</strong>は、正確には
            「在位する皇帝がただ一つの王朝にのみいる期間」を在位データから機械的に求めたものです。歴史的な領土の統一とは一致しない場合があります（例：東晋371–383年は華北を統一した前秦の苻堅が「天王」を称して皇帝でなかったため、南宋1235–1259年は金滅亡後のモンゴルが皇帝を称さなかったため、いずれも「統一」側になります）。ただし1912年の宣統帝退位（帝制終焉）より後は、洪憲・張勲復辟・満洲国のように在位皇帝が一つの王朝のみでも、共和制下の帝政であり天下の統一とは呼べないため「統一」に数えていません。
          </li>
          <li>
            <strong>上下の配置</strong>
            はおおまかな地理（上＝北方・下＝南方・中央＝統一王朝の座）と正統・並立の区分に基づくレイアウト上の整理で、群雄・小政権は「まとまり」の帯（灰色の斜線）に集約しています。クリックすると構成政権ごとの帯に開きます。
          </li>
          <li>
            帯の途中の<strong>点線</strong>
            は、王朝は続いているものの皇帝を名乗った人物がいない期間です（例：唐の691–704年は武則天の周〔武周〕の期間、前秦の358–384年は苻堅が「天王」を称して皇帝を名乗らなかった期間）。
          </li>
          <li>
            <strong>斜線の帯</strong>
            は、中国全体で皇帝が1人もいない期間です：
            {timeline.vacancies.map((v, i) => (
              <span key={v.startYear}>
                {i > 0 ? "、" : ""}
                {v.startYear === v.endYear
                  ? `${formatYear(v.startYear)}年`
                  : `${formatYear(v.startYear)}–${formatYear(v.endYear)}年`}
                （{v.label}）
              </span>
            ))}
            。
          </li>
          <li>
            年表は<strong>年単位</strong>
            で描いているため、在位が1年に満たない皇帝の区切りはほとんど幅を持ちません。その場合も帯の上にマウスを載せると最も近い皇帝が表示され、クリックで詳細を確認できます。
          </li>
          <li>
            王朝の「正統」「並立」「反乱・自称」の区分や収録基準の詳細は、
            <Link
              href="/about"
              className="underline underline-offset-2 hover:text-seal"
            >
              このサイトについて
            </Link>
            をご覧ください。
          </li>
        </ul>
      </Section>
    </>
  );
}
