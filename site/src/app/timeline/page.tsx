import { PageHeader, Section } from "@/components/layout/page-header";
import { TimelineExplorer } from "@/components/timeline/timeline-explorer";
import {
  formatYear,
  getAllEmperorRecords,
  getTimelineData,
} from "@/lib/emperors";

export const metadata = {
  title: "通史年表 | 中国皇帝統計",
  description:
    "始皇帝から溥儀まで、皇帝を名乗った365人の在位期間を1本の年表に。並立王朝の分裂期と統一期、皇帝不在の期間まで一望できます。",
};

export default function TimelinePage() {
  const records = getAllEmperorRecords();
  const timeline = getTimelineData();

  return (
    <>
      <PageHeader
        title="通史年表"
        description="始皇帝の即位（前221年）から溥儀の退位（1945年）まで、皇帝を名乗った365人の在位期間を1本の横軸に並べた年表です。王朝が縦に積み重なる時代＝複数の皇帝が並び立った分裂期、1本に収束する時代＝統一期として、時代の流れを一望できます。"
      />
      <Section
        id="chart"
        title="皇帝在位タイムライン"
        description="「全体」で通史の流れを、「拡大」「詳細」で皇帝ひとりひとりの在位を確認できます。帯にマウスを載せると皇帝の概要、クリックで全項目の詳細が開きます。"
      >
        <TimelineExplorer timeline={timeline} records={records} />
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
            <a
              href="/about"
              className="underline underline-offset-2 hover:text-seal"
            >
              このサイトについて
            </a>
            をご覧ください。
          </li>
        </ul>
      </Section>
    </>
  );
}
