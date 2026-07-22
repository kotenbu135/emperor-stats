import { PageHeader } from "@/components/layout/page-header";
import {
  datasetGeneratedAt,
  datasetTemporalCoverage,
  datasetVersion,
  getPortraitCredits,
  getOverviewStats,
} from "@/lib/emperors";
import { BASE_PATH } from "@/lib/base-path";
import { VIDEO_CHANNEL } from "@/lib/video-channel";
import { buildMetadata, datasetJsonLd, JsonLd } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/about",
  title: "このサイトについて",
  description:
    "中国皇帝統計の収録基準・各統計項目の数え方・典拠とした史料・データセットのダウンロード（CC BY 4.0）・肖像画の出典・免責事項について説明します。",
});

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
      {children}
    </div>
  );
}

function H2({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <div className="mt-10 flex items-center gap-2.5">
      <span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-seal/80" />
      <h2
        id={id}
        className="scroll-mt-20 font-heading text-xl font-semibold text-foreground"
      >
        {children}
      </h2>
    </div>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-6 font-heading text-base font-semibold text-foreground">
      {children}
    </h3>
  );
}

export default function AboutPage() {
  const stats = getOverviewStats();
  const credits = getPortraitCredits();

  return (
    <>
      <JsonLd
        data={datasetJsonLd({
          description:
            "始皇帝から溥儀まで、中国史上で実際に「皇帝」を名乗った人物の在位期間・死因・即位経路など全12項目を正史原典から個別調査したデータセット。",
          dateModified: datasetGeneratedAt,
          emperorCount: stats.emperorCount,
          version: datasetVersion,
          temporalCoverage: datasetTemporalCoverage,
        })}
      />
      <PageHeader
        title="このサイトについて"
        description="収録基準・各統計項目の数え方・典拠とした史料・データセットのダウンロード・肖像画の出典・免責事項について説明します。"
        contained
      />
      {/* 記事型ページのためワイド画面では本文列を中央寄せにする（PageHeaderのcontainedと同じ列幅） */}
      <div className="px-6 py-8 md:px-10">
        <div className="mx-auto w-full max-w-2xl">
        <Prose>
          <p>
            このサイトは、始皇帝（紀元前221年）から清朝最後の皇帝・溥儀まで、中国史上に登場した
            <strong>実際に「皇帝」を名乗った人物{stats.emperorCount}名</strong>
            の在位期間・死因・即位の経緯などを集計・可視化したものです。
          </p>
          <p>
            集計にあたっては、可能な限り『史記』『漢書』『旧唐書』『宋史』などの正史原典に立ち返って確認しています。史料によって記述が食い違う場合や、原典に手がかりが見当たらない場合は、無理に一つの答えを決めず「諸説あり」「不詳」として扱っています。
          </p>
        </Prose>

        <H2 id="criteria">誰を「皇帝」として数えているか</H2>
        <Prose>
          <p>
            <strong>
              生きている間に自分自身で「皇帝」という称号を実際に使った人物だけを収録しています。
            </strong>
          </p>
          <p>
            歴史上「正統な王朝」と評価されているかどうかは問いません。反乱によって即位した人物や、他人に擁立された人物であっても、実際に皇帝を名乗った記録があれば収録しています（例：安禄山、朱全忠）。逆に、死後に子孫から皇帝の称号を贈られただけの人物（追尊）や、実質的な権力者であっても生前は「王」「可汗」などにとどまった人物（例：チンギス・カン）は収録していません。
          </p>
          <p>
            同じ人物が2度以上皇帝の座に就いた場合（廃位後の復位など）は1人としてまとめ、在位期間だけを複数記録しています。
          </p>
        </Prose>

        <H2 id="counting">各統計項目の数え方</H2>
        <Prose>
          <H3>在位年数</H3>
          <p>
            即位した日から退位・崩御した日までの期間です。史料から確認できた精度（年まで／月まで／日まで）をそのまま使っており、日付が不明な部分を推測で埋めることはしていません。そのため、同じ「在位◯年」という表示でも、日単位まで確定している皇帝と、年単位までしか分からない皇帝が混在します。廃位後に復位した皇帝は、在位期間ごとに区切って合計しています。
          </p>
          <H3>日付の暦と西暦への換算</H3>
          <p>
            正史の日付は旧暦（太陰太陽暦）の「元号年・月・干支日」で記されています。在位の開始日・終了日は、皇帝ごとに正史原文の該当記事を確認し、暦計算ライブラリ
            <a
              href="https://github.com/yuangu/sxtwl_cpp"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-seal"
            >
              sxtwl（寿星天文暦）
            </a>
            で西暦に換算しています。西暦は歴史学の慣用に従い、1582年10月のグレゴリオ暦導入より前はユリウス暦、以後はグレゴリオ暦です。旧暦の年末（十二月など）が西暦では翌年に入る場合があるため、旧暦年と西暦年は必ずしも一対一に対応しません。史料間で日付が食い違う場合は正史原典の記述を優先し、対立の内容は出典の注記に記録しています。
          </p>
          <p>
            紀元前の年は、画面上では「前◯年」と表示しています。配布データ内部の扱いは、値の形式によって歴史学と情報規格それぞれの慣用に合わせて2通りに分かれます。年数だけを表す数値（在位開始年など）は0年を置かない歴史年表記（前210年＝-210）で、ISO 8601形式の日付文字列（在位開始日・終了日、生年月日・没年月日など）は同規格が定める0年を含む天文年表記（前210年＝-0209）です。したがって同じ「前210年」でも、数値フィールドは-210、日付フィールドは-0209と1つずれます。各皇帝の個別ページでは、日付の根拠にした正史原文の引用と換算の調査記録を「在位日付の典拠」として公開しています。
          </p>
          <H3>死因</H3>
          <p>
            崩御の原因を「病死」「暗殺」「処刑」「戦死」「自尽」「事故死」「不詳」「諸説あり」の8種類に分類しています。暗殺と処刑は「誰が手を下したか」で区別しており、同じ政権内部の者（家臣・皇族・宦官など）による謀殺は暗殺、王朝が滅んだ後に征服者側が公的に処断した場合は処刑です。家臣に強要されて自ら命を絶った場合は「自尽」、毒殺は「暗殺」の一種として扱っています。正史の記述は、王朝交代後に前王朝の最後の皇帝を実際以上に悪く描く傾向があることが知られているため、原典の記述だけでなく現代の学術的な研究も踏まえて判定しています。
          </p>
          <H3>即位の経緯</H3>
          <p>
            どのような経緯で皇位に就いたかを「世襲」「簒奪」「禅譲」「内禅」「擁立」「復位」「建国」「不詳」「諸説あり」の9種類に分類しています。世襲は血縁者による通常の継承（先帝の崩御に伴う継承）、簒奪は実力による奪取、禅譲は前王朝（別姓）の皇帝から位を譲られる王朝交代を伴う即位（実態が簒奪に近いものも含みます）、内禅は同じ王朝の中で先帝が存命のまま位を譲る「生前譲位」による即位（例：清の乾隆帝から嘉慶帝への譲位）、擁立は本人の主体的な簒奪行為なしに即位させられた場合、建国は先行する政権からの継承なしに新たに政権を樹立した場合です。
          </p>
          <H3>改元回数</H3>
          <p>
            在位中に元号（年号）を何回変えたかを数えています。即位に伴って最初の元号を定めた場合もその1回に含めています。まだ元号という制度が存在しなかった時代（秦など）は0回としています。
          </p>
          <H3>大赦回数</H3>
          <p>
            在位中に、国全体を対象とした恩赦（「大赦天下」等）を何回行ったかを数えています。特定の地域・特定の罪状のみを対象にした部分的な恩赦は含めていません。
          </p>
          <H3>立后（皇后冊立）回数</H3>
          <p>
            在位中に皇后を正式に立てた回数です。廃后した後に別の皇后を立てた場合や、一度廃した皇后を再び立てた場合も、それぞれ1回として数えています。在位中に皇后を立てなかった場合は0回です。
          </p>
          <H3>皇太子廃立回数</H3>
          <p>
            一度立てた皇太子（またはそれに相当する法定の後継者）を、在位中に廃止した回数です。皇太子を「立てた」回数ではなく、「廃止した」回数のみを数えている点にご注意ください。
          </p>
          <H3>親征回数</H3>
          <p>
            皇帝自身が軍を率いて戦場に赴いた回数です。将軍への派遣や勅命のみで皇帝本人が出陣しなかった場合は含めません。同一の相手に対する一連の軍事行動（出征から帰還まで）を1回とし、年をまたいでも同じ遠征の継続であれば1回と数えています。
          </p>
          <H3>反乱鎮圧回数・被反乱回数</H3>
          <p>
            反乱鎮圧回数は、政権側として反乱の鎮圧にあたった件数、被反乱回数は、自分（の政権）に対して起こされた反乱の件数です。いずれも独立した首謀者・蜂起単位で1件と数え、鎮圧の成否は問いません。農民反乱から、兵力を伴う宮廷クーデター・弑逆までを広く含みますが、皇帝の統治下にない独立勢力との抗争（統一戦争）や外国との戦争、実際の挙兵に至らなかった謀反計画は含めません。両者は原則として同じ反乱を両面から数えたものですが、鎮圧に着手しないまま在位が終わった場合や、クーデターのように鎮圧の主体が皇帝側でない場合は被反乱のみに数えるため、件数は一致しないことがあります。
          </p>
          <H3>遷都回数</H3>
          <p>
            在位中に正式な遷都（恒久的な主都の移転）を行った回数です。戦乱による一時的な避難・行幸や、副都・陪都の新設は含めません。短期間に都が複数回変わった場合は、それぞれ1回として数えています。
          </p>
          <H3>即位時年齢・没年齢</H3>
          <p>
            年齢はすべて数え年（生まれた年を1歳とし、年が明けるごとに1歳加える中国伝統の数え方）で統一しています。正史に生年や享年の直接の記載がない皇帝は「不詳」とし、推測で埋めることはしていません。そのため年齢の統計は、判明している皇帝のみを対象にしています。
          </p>
          <p>
            なお、各グラフで「0回」の皇帝は「調査した結果、該当が0件だった」ことが確認できた皇帝です。調査できていない項目とは区別して記録しています。
          </p>
        </Prose>

        <H2 id="sources">典拠とした史料</H2>
        <Prose>
          <p>
            『史記』『漢書』『後漢書』『三国志』『晋書』『宋書』『南斉書』『梁書』『陳書』『魏書』『北斉書』『周書』『隋書』『南史』『北史』『旧唐書』『新唐書』『旧五代史』『新五代史』『宋史』『遼史』『金史』『元史』『新元史』『明史』『清史稿』などの正史（本紀・列伝）を第一の典拠としています。西夏など正史に本紀がない政権は『西夏書事』等の編年史料、南明・明清交替期の諸政権は『小腆紀伝』等で補っています。
          </p>
        </Prose>

        <H2 id="dataset">データセットのダウンロードとライセンス</H2>
        <Prose>
          <p>
            本サイトの元データ（{stats.emperorCount}名 × 全12項目・調査メモと出典を含む完全版）を、機械可読な形式で公開しています。現在のデータ版は
            <strong> {datasetVersion} </strong>
            です。
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <a
                href={`${BASE_PATH}/data/emperors.json`}
                className="underline underline-offset-2 hover:text-seal"
              >
                emperors.json
              </a>
              （完全版・約6.9MB、gzip配信のため実転送は約1MB）
            </li>
            <li>
              <a
                href={`${BASE_PATH}/data/emperors.csv`}
                className="underline underline-offset-2 hover:text-seal"
              >
                emperors.csv
              </a>
              （1行1皇帝に平坦化した41列・約120KB。UTF-8 BOM付きで表計算ソフトでそのまま開けます）
            </li>
            <li>
              <a
                href={`${BASE_PATH}/data/emperors.schema.json`}
                className="underline underline-offset-2 hover:text-seal"
              >
                emperors.schema.json
              </a>
              （JSONの構造定義・JSON Schema）
            </li>
          </ul>
          <p>
            いずれも認証不要・CORS許可済みのため、プログラムから直接取得できます。JSONの構造の説明（フィールド定義・分類の意味）は上記スキーマと
            <a
              href="https://github.com/kotenbu135/emperor-stats/tree/main/data/schema"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-seal"
            >
              GitHub のスキーマ文書
            </a>
            を参照してください。
          </p>
          <p>
            <strong>ライセンス</strong>: データおよび調査メモの文章は
            <a
              href="https://creativecommons.org/licenses/by/4.0/deed.ja"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-seal"
            >
              CC BY 4.0
            </a>
            で提供します。出典を明記すれば、商用を含め自由に複製・再配布・改変できます。帰属表示の例:「出典: 中国皇帝統計 (emperorstats.com), CC BY 4.0」。サイトのソースコードは
            <a
              href="https://github.com/kotenbu135/emperor-stats/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-seal"
            >
              MITライセンス
            </a>
            です。
          </p>
          <p>
            データ内容の変更履歴は
            <a
              href="https://github.com/kotenbu135/emperor-stats/blob/main/CHANGELOG.md"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-seal"
            >
              CHANGELOG
            </a>
            に記録しています。
          </p>
        </Prose>

        <H2 id="errata">正誤表</H2>
        <Prose>
          <p>
            公開後に判明した誤りは、原典を再調査したうえで訂正し、ここに記録します。
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>2026-07-21</strong>:
              在位期間の出典を全皇帝分、正史原典（書名・巻・原文引用つき）へ差し替える再調査を実施。この過程で旧暦→西暦の換算誤り等の在位日付の訂正を約90件行いました（詳細はCHANGELOGと配布データ内の調査記録）。
            </li>
            <li>
              <strong>2026-07-20</strong>:
              収録漏れが判明した唐哀帝を追加し、収録数を364名から365名に改めました。
            </li>
          </ul>
          <p>
            誤りにお気づきの際は
            <a
              href="https://github.com/kotenbu135/emperor-stats/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-seal"
            >
              GitHubのIssue
            </a>
            からお知らせください。
          </p>
        </Prose>

        <H2 id="portraits">肖像画の出典</H2>
        <Prose>
          <p>
            肖像画は、パブリックドメインまたはCC0で公開されている画像のみを{credits.length}
            名分使用しています（主にWikimedia
            Commons経由。『歴代帝后像』『帝鑑図説』など）。著作権保護期間内の画像や、クレジット表示が必要なライセンス（CC
            BY-SA等）の画像は使用していません。
          </p>
        </Prose>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            使用画像の一覧（{credits.length}件）
          </summary>
          <div className="mt-2 max-h-[480px] overflow-y-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-secondary text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">皇帝</th>
                  <th className="px-3 py-2 font-medium">王朝</th>
                  <th className="px-3 py-2 font-medium">ライセンス</th>
                  <th className="px-3 py-2 font-medium">出典</th>
                </tr>
              </thead>
              <tbody>
                {credits.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-3 py-1.5">{c.commonName}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{c.dynasty}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {c.licenseShortName}
                    </td>
                    <td className="px-3 py-1.5">
                      <a
                        href={c.commonsPageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground underline underline-offset-2 hover:text-seal"
                      >
                        Commons
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <H2 id="videos">関連動画について</H2>
        <Prose>
          <p>
            一部の皇帝ページには、その皇帝を主題とした解説動画（YouTube埋め込み）を掲載しています。これらの動画は、
            <strong>当サイトとは無関係の</strong>YouTubeチャンネル「
            <a
              href={VIDEO_CHANNEL.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-seal"
            >
              {VIDEO_CHANNEL.name}
            </a>
            」様が制作・公開されているものです。動画の内容は当サイトの集計・調査とは独立しており、当サイトが内容の正確性を保証するものではありません。埋め込みにはYouTubeの公式埋め込み機能を利用しています。
          </p>
        </Prose>

        <H2 id="disclaimer">免責事項</H2>
        <Prose>
          <p>
            本サイトは、AI（大規模言語モデル）を活用して調査・集計・構築しています。また、制作者は歴史学の専門家ではありません。正史の原典に1件ずつあたる方針でできる限り丁寧に作成していますが、史料の解釈を誤っている場合や、現代の歴史学の通説と異なる整理をしている場合があります。歴史の素人が作った統計サイトとして、どうか優しい目でご覧いただければ幸いです。お気づきの点は
            <a
              href="https://github.com/kotenbu135/emperor-stats/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-seal"
            >
              GitHubのIssue</a>
            で教えていただけると助かります。
          </p>
          <p>
            本サイトの内容の正確性・完全性を保証するものではなく、本サイトの利用によって生じたいかなる不利益・損害についても、制作者は責任を負いかねます。レポートや記事等で数値を利用される際は、必ず原典をご確認ください。
          </p>
          <p>
            正史原文の確認にあたっては、GitHubで公開されている二十四史コーパス
            <a
              href="https://github.com/hunterhug/china-history"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-seal"
            >
              china-history</a>
            および古代文献コーパス
            <a
              href="https://github.com/garychowcmu/daizhigev20"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-seal"
            >
              daizhigev20</a>
            （殆知閣古代文献）を利用させていただきました。両プロジェクトの公開に感謝します。
          </p>
        </Prose>
        </div>
      </div>
    </>
  );
}
