// このサイトについて（/about）。サイトで唯一の記事型ページ。
//
// **文章は 2026-07-31 の作り替えでもほぼそのまま**（ユーザー指示）。組み方だけを変えた。
// 組みものの部品と、その意図は `@/components/about/article` の冒頭コメント。
//
// 【節の id は外部契約】`#operator` は `lib/seo.tsx` の OPERATOR_ID（JSON-LD の
// Person ノードの @id）、`#dataset` は DATASET_ID が指している。9つの id
// （criteria / counting / sources / dataset / errata / portraits / videos /
// operator / disclaimer）はどれも変えないこと。
//
// 【id は節の本体に付ける】SectionJumpNav の現在地判定は IntersectionObserver で、
// 観測対象が節の本体でないと帯に入らない（同ファイルの冒頭コメント）。Section が
// id を <section> へ付けるので、見出しには付けない。

import { PageHeader, Section } from "@/components/layout/page-header";
import {
  BELOW_SECTION_NAV,
  SectionJumpNav,
  type JumpItem,
} from "@/components/layout/section-jump-nav";
import {
  A,
  ARTICLE_WIDTH,
  ArticleIntro,
  Callout,
  DownloadCards,
  ErrataList,
  Lead,
  PortraitCredits,
  Prose,
  TermList,
  type DownloadItem,
  type ErratumItem,
  type TermItem,
} from "@/components/about/article";
import {
  datasetGeneratedAt,
  datasetTemporalCoverage,
  datasetVersion,
  getPortraitCredits,
  getOverviewStats,
} from "@/lib/emperors";
import { BASE_PATH } from "@/lib/base-path";
import { VIDEO_CHANNEL } from "@/lib/video-channel";
import { buildMetadata, datasetJsonLd, JsonLd, OPERATOR } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/about",
  title: "このサイトについて",
  description:
    "中国皇帝統計の収録基準・各統計項目の数え方・典拠とした史料・データセットのダウンロード（CC BY 4.0）・肖像画の出典・運営者情報・免責事項について説明します。",
});

/** バーのラベルは短く。長いと畳んだトリガー（min-w 9.5rem）で切れる。 */
const JUMP_ITEMS: JumpItem[] = [
  { id: "criteria", label: "収録基準" },
  { id: "counting", label: "各項目の数え方" },
  { id: "sources", label: "典拠とした史料" },
  { id: "dataset", label: "データ配布" },
  { id: "errata", label: "正誤表" },
  { id: "portraits", label: "肖像画の出典" },
  { id: "videos", label: "関連動画" },
  { id: "operator", label: "運営者" },
  { id: "disclaimer", label: "免責事項" },
];

const DOWNLOADS: DownloadItem[] = [
  {
    file: "emperors.json",
    href: `${BASE_PATH}/data/emperors.json`,
    format: "json",
    size: "約6.9MB",
    note: "完全版。gzip配信のため実転送は約1MB",
  },
  {
    file: "emperors.csv",
    href: `${BASE_PATH}/data/emperors.csv`,
    format: "csv",
    size: "約120KB",
    note: "1行1皇帝に平坦化した41列。UTF-8 BOM付きで表計算ソフトでそのまま開けます",
  },
  {
    file: "emperors.schema.json",
    href: `${BASE_PATH}/data/emperors.schema.json`,
    format: "schema",
    size: "—",
    note: "JSONの構造定義・JSON Schema",
  },
];

const ERRATA: ErratumItem[] = [
  {
    date: "2026-07-21",
    body: "在位期間の出典を全皇帝分、正史原典（書名・巻・原文引用つき）へ差し替える再調査を実施。この過程で旧暦→西暦の換算誤り等の在位日付の訂正を約90件行いました（詳細はCHANGELOGと配布データ内の調査記録）。",
  },
  {
    date: "2026-07-20",
    body: "収録漏れが判明した唐哀帝を追加し、収録数を364名から365名に改めました。",
  },
];

export default function AboutPage() {
  const stats = getOverviewStats();
  const credits = getPortraitCredits();

  // 11項目の数え方。文章は元のまま、h3 の見出しを用語の桁へ移しただけ。
  const countingItems: TermItem[] = [
    {
      term: "在位年数",
      body: (
        <p>
          即位した日から退位・崩御した日までの期間です。史料から確認できた精度（年まで／月まで／日まで）をそのまま使っており、日付が不明な部分を推測で埋めることはしていません。そのため、同じ「在位◯年」という表示でも、日単位まで確定している皇帝と、年単位までしか分からない皇帝が混在します。廃位後に復位した皇帝は、在位期間ごとに区切って合計しています。
        </p>
      ),
    },
    {
      term: "日付の暦と西暦への換算",
      body: (
        <>
          <p>
            正史の日付は旧暦（太陰太陽暦）の「元号年・月・干支日」で記されています。在位の開始日・終了日は、皇帝ごとに正史原文の該当記事を確認し、暦計算ライブラリ
            <A href="https://github.com/yuangu/sxtwl_cpp" external>
              sxtwl（寿星天文暦）
            </A>
            で西暦に換算しています。西暦は歴史学の慣用に従い、1582年10月のグレゴリオ暦導入より前はユリウス暦、以後はグレゴリオ暦です。旧暦の年末（十二月など）が西暦では翌年に入る場合があるため、旧暦年と西暦年は必ずしも一対一に対応しません。史料間で日付が食い違う場合は正史原典の記述を優先し、対立の内容は出典の注記に記録しています。
          </p>
          <p>
            紀元前の年は、画面上では「前◯年」と表示しています。配布データ内部の扱いは、値の形式によって歴史学と情報規格それぞれの慣用に合わせて2通りに分かれます。年数だけを表す数値（在位開始年など）は0年を置かない歴史年表記（前210年＝-210）で、ISO
            8601形式の日付文字列（在位開始日・終了日、生年月日・没年月日など）は同規格が定める0年を含む天文年表記（前210年＝-0209）です。したがって同じ「前210年」でも、数値フィールドは-210、日付フィールドは-0209と1つずれます。日付の根拠にした正史原文の引用と換算の調査記録は、下の「データセットのダウンロードとライセンス」で配布しているデータに収録しています。
          </p>
          <p>
            改元・大赦・親征・反乱といった<strong>出来事の日付について、このデータセットが主張するのは「年」と、在位の開始年・終了年に起きた出来事の「月日」だけです</strong>。それ以外の年の月日は、原典から読み取った値であっても年までに丸めて収録しています（表示も年までになります）。原典の紀年表記と換算の経路を各件に残して機械で再現できるようにする作業が全件では終わっておらず、確かめられる範囲を超えて細かい日付を主張しないためです。丸める前の値は削除しておらず、リポジトリの内部用ファイルに全件残しています。在位期間の開始日・終了日はこの対象外で、従来どおり確認できた精度で収録しています。
          </p>
        </>
      ),
    },
    {
      term: "死因",
      body: (
        <p>
          崩御の原因を「病死」「暗殺」「処刑」「戦死」「自尽」「事故死」「不詳」「諸説あり」の8種類に分類しています。暗殺と処刑は「誰が手を下したか」で区別しており、同じ政権内部の者（家臣・皇族・宦官など）による謀殺は暗殺、王朝が滅んだ後に征服者側が公的に処断した場合は処刑です。家臣に強要されて自ら命を絶った場合は「自尽」、毒殺は「暗殺」の一種として扱っています。正史の記述は、王朝交代後に前王朝の最後の皇帝を実際以上に悪く描く傾向があることが知られているため、原典の記述だけでなく現代の学術的な研究も踏まえて判定しています。
        </p>
      ),
    },
    {
      term: "即位の経緯",
      body: (
        <>
          <p>
            どのような経緯で皇位に就いたかを分類しています。ただしこの分類は、私たちが一人ひとりに「ふさわしいラベル」を当てて決めたものではありません。ラベルの当てはめは人によって納得が分かれるため、代わりに
            <strong>
              原典が書いている事実を独立した4つの軸に分解し、そこからラベルを機械的に導き出す
            </strong>
            方式に変えました（2026年）。
          </p>
          <p>
            4つの軸は、①<strong>君主位の出所</strong>
            （前代君主から継承／他政権から受禅／自立）、②
            <strong>即位を決めた主体</strong>
            （本人／先帝／第三者／史料から決着不能）、③<strong>先帝の去就</strong>
            （崩御／横死／生前譲位／廃位・追放）、④<strong>先帝との血縁</strong>
            です。この組み合わせから「世襲」「擁立」「簒奪」「内禅」「自立」「推戴」「受禅（易姓）」「継承（経緯記載なし）」というラベルが決まります。世襲は先帝が後継を定めた継承、擁立は第三者（臣下・軍・宦官・外戚・母后・宗室）が立てた場合、簒奪は前帝の位を自ら奪った場合、内禅は先帝が存命のまま自ら位を譲った場合（例：清の乾隆帝から嘉慶帝）、自立は先行する君主から位を受けず自ら称した場合、推戴はそれを他者に立てられた場合、受禅（易姓）は別姓・別政権の皇帝から位を譲られた王朝交代です。
          </p>
          <p>
            「継承（経緯記載なし）」は、正史が立太子・遺詔・推戴のいずれも記していない継承です。以前はこうした人物も「世襲」に押し込んでいましたが、たとえば始皇帝について『史記』は「政代立為秦王」としか書かず、宋の太宗について『宋史』は「太祖崩，帝遂即皇帝位」としか書きません。血縁上の跡継ぎだからという理由で「先帝が決めた」と推測せず、原典が書いていないことを書いていないまま表示しています。
          </p>
          <p>
            なお、旧来の「建国」は
            <strong>政権の属性であって皇位の出所ではない</strong>
            ため軸から外しました。王朝の創始者は、前王朝から位を譲られたなら受禅（易姓）、自ら称したなら自立、他者に立てられたなら推戴に分かれます。王や節度使の位を父祖から継いで皇帝号だけを新たに称した場合（始皇帝・後唐の荘宗・西夏の李元昊など）は、皇位の出所としては継承にあたるため世襲などになり、称号を新たに称したことは別に記録しています。「復位」も分類から外し、2度目以降の即位は在位期間の情報として持たせたうえ、ラベルは初回即位の経緯で付けています（例：明の英宗）。
          </p>
        </>
      ),
    },
    {
      term: "改元回数",
      body: (
        <p>
          在位中に元号（年号）を何回変えたかを数えています。即位に伴って最初の元号を定めた場合もその1回に含めています。まだ元号という制度が存在しなかった時代（秦など）は0回としています。
        </p>
      ),
    },
    {
      term: "大赦回数",
      body: (
        <p>
          在位中に、国全体を対象とした恩赦（「大赦天下」等）を何回行ったかを数えています。特定の地域・特定の罪状のみを対象にした部分的な恩赦は含めていません。
        </p>
      ),
    },
    {
      term: "立后（皇后冊立）回数",
      body: (
        <p>
          在位中に皇后を正式に立てた回数です。廃后した後に別の皇后を立てた場合や、一度廃した皇后を再び立てた場合も、それぞれ1回として数えています。在位中に皇后を立てなかった場合は0回です。
        </p>
      ),
    },
    {
      term: "皇太子廃立回数",
      body: (
        <p>
          一度立てた皇太子（またはそれに相当する法定の後継者）を、在位中に廃止した回数です。皇太子を「立てた」回数ではなく、「廃止した」回数のみを数えている点にご注意ください。
        </p>
      ),
    },
    {
      term: "親征回数",
      body: (
        <p>
          皇帝自身が軍を率いて戦場に赴いた回数です。将軍への派遣や勅命のみで皇帝本人が出陣しなかった場合は含めません。同一の相手に対する一連の軍事行動（出征から帰還まで）を1回とし、年をまたいでも同じ遠征の継続であれば1回と数えています。
        </p>
      ),
    },
    {
      term: "反乱鎮圧回数・被反乱回数",
      body: (
        <p>
          反乱鎮圧回数は、政権側として反乱の鎮圧にあたった件数、被反乱回数は、自分（の政権）に対して起こされた反乱の件数です。いずれも独立した首謀者・蜂起単位で1件と数え、鎮圧の成否は問いません。農民反乱から、兵力を伴う宮廷クーデター・弑逆までを広く含みますが、皇帝の統治下にない独立勢力との抗争（統一戦争）や外国との戦争、実際の挙兵に至らなかった謀反計画は含めません。両者は原則として同じ反乱を両面から数えたものですが、鎮圧に着手しないまま在位が終わった場合や、クーデターのように鎮圧の主体が皇帝側でない場合は被反乱のみに数えるため、件数は一致しないことがあります。
        </p>
      ),
    },
    {
      term: "遷都回数",
      body: (
        <p>
          在位中に正式な遷都（恒久的な主都の移転）を行った回数です。戦乱による一時的な避難・行幸や、副都・陪都の新設は含めません。短期間に都が複数回変わった場合は、それぞれ1回として数えています。
        </p>
      ),
    },
    {
      term: "即位時年齢・没年齢",
      body: (
        <p>
          年齢はすべて数え年（生まれた年を1歳とし、年が明けるごとに1歳加える中国伝統の数え方）で統一しています。正史に生年や享年の直接の記載がない皇帝は「不詳」とし、推測で埋めることはしていません。そのため年齢の統計は、判明している皇帝のみを対象にしています。
        </p>
      ),
    },
  ];

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
        description="収録基準・各統計項目の数え方・典拠とした史料・データセットのダウンロード・肖像画の出典・運営者情報・免責事項について説明します。"
        contained
        containedWidth={ARTICLE_WIDTH}
      />
      {/* 9節・約5000pxの1本道なので、節へ飛ぶ索引を上に固定する。 */}
      <SectionJumpNav
        items={JUMP_ITEMS}
        label="節へジャンプ"
        innerWidth={ARTICLE_WIDTH}
        popoverColumns={1}
      />

      <ArticleIntro>
        <Prose>
          <Lead>
              このサイトは、始皇帝（紀元前221年）から清朝最後の皇帝・溥儀まで、中国史上に登場した
              <strong className="font-semibold text-seal">
                実際に「皇帝」を名乗った人物{stats.emperorCount}名
              </strong>
              の在位期間・死因・即位の経緯などを集計・可視化したものです。
            </Lead>
          <p>
            集計にあたっては、可能な限り『史記』『漢書』『旧唐書』『宋史』などの正史原典に立ち返って確認しています。史料によって記述が食い違う場合や、原典に手がかりが見当たらない場合は、無理に一つの答えを決めず「諸説あり」「不詳」として扱っています（即位の経緯については、2026年の分類見直しでこれを「継承（経緯記載なし）」という区分に置き換えました）。
          </p>
        </Prose>
      </ArticleIntro>

      <Section
        id="criteria"
        title="誰を「皇帝」として数えているか"
        contained
        containedWidth={ARTICLE_WIDTH}
        scrollMt={BELOW_SECTION_NAV}
      >
        <Prose>
          <Callout>
            <p>
              生きている間に自分自身で「皇帝」という称号を実際に使った人物だけを収録しています。
            </p>
          </Callout>
          <p>
            歴史上「正統な王朝」と評価されているかどうかは問いません。反乱によって即位した人物や、他人に擁立された人物であっても、実際に皇帝を名乗った記録があれば収録しています（例：安禄山、朱全忠）。逆に、死後に子孫から皇帝の称号を贈られただけの人物（追尊）や、実質的な権力者であっても生前は「王」「可汗」などにとどまった人物（例：チンギス・カン）は収録していません。
          </p>
          <p>
            同じ人物が2度以上皇帝の座に就いた場合（廃位後の復位など）は1人としてまとめ、在位期間だけを複数記録しています。
          </p>
        </Prose>
      </Section>

      <Section
        id="counting"
        title="各統計項目の数え方"
        description="全12項目それぞれについて、何を1件と数え、何を数えていないかです。"
        contained
        containedWidth={ARTICLE_WIDTH}
        scrollMt={BELOW_SECTION_NAV}
      >
        <TermList items={countingItems} />
        <Prose className="mt-6">
          <p>
            {/* 旧「各グラフで」。集計グラフを載せていた統計5ページは 2026-07-31 に
                廃止したので、行き先の無い言い方を項目基準へ直した（意味は同じ）。 */}
            なお、各項目で「0回」の皇帝は「調査した結果、該当が0件だった」ことが確認できた皇帝です。調査できていない項目とは区別して記録しています。
          </p>
        </Prose>
      </Section>

      <Section
        id="sources"
        title="典拠とした史料"
        contained
        containedWidth={ARTICLE_WIDTH}
        scrollMt={BELOW_SECTION_NAV}
      >
        <Prose>
          <p>
            『史記』『漢書』『後漢書』『三国志』『晋書』『宋書』『南斉書』『梁書』『陳書』『魏書』『北斉書』『周書』『隋書』『南史』『北史』『旧唐書』『新唐書』『旧五代史』『新五代史』『宋史』『遼史』『金史』『元史』『新元史』『明史』『清史稿』などの正史（本紀・列伝）を第一の典拠としています。西夏など正史に本紀がない政権は『西夏書事』等の編年史料、南明・明清交替期の諸政権は『小腆紀伝』等で補っています。
          </p>
          {/* ふりがな（GitHub Issue #20）の出所を明示する。読みは正史から得られる
              値ではないので、調査12項目と同じ根拠があると読まれないようにする
              （docs/site-design/RUBY_PLAN_2026-08-01.md の判断待ち6の決定）。 */}
          <p>
            なお、名前に振っているふりがなは日本語の慣用読みで、正史原典から得られる調査項目ではありません（複数の読みが行われている名前もあります）。モンゴル語・満洲語などの音写名は、漢字表記に原音のカタカナを添えています。
          </p>
        </Prose>
      </Section>

      <Section
        id="dataset"
        title="データセットのダウンロードとライセンス"
        contained
        containedWidth={ARTICLE_WIDTH}
        scrollMt={BELOW_SECTION_NAV}
      >
        <Prose>
          <p>
            本サイトの元データ（{stats.emperorCount}
            名 × 全12項目・調査メモと出典を含む完全版）を、機械可読な形式で公開しています。現在のデータ版は
            <strong> {datasetVersion} </strong>
            です。
          </p>
        </Prose>
        <div className="mt-5">
          <DownloadCards items={DOWNLOADS} />
        </div>
        <Prose className="mt-5">
          <p>
            いずれも認証不要・CORS許可済みのため、プログラムから直接取得できます。JSONの構造の説明（フィールド定義・分類の意味）は上記スキーマと
            <A href={`${OPERATOR.repoUrl}/tree/main/data/schema`} external>
              GitHub のスキーマ文書
            </A>
            を参照してください。
          </p>
          <Callout tone="muted">
            <p>
              <strong>ライセンス</strong>: データおよび調査メモの文章は
              <A
                href="https://creativecommons.org/licenses/by/4.0/deed.ja"
                external
              >
                CC BY 4.0
              </A>
              {/* 「」は元の文のまま。地に箱を敷くと閉じ括弧の前に余白が空いて
                  「CC BY 4.0 」。のように見えるので、等幅にするだけにとどめる。 */}
              で提供します。出典を明記すれば、商用を含め自由に複製・再配布・改変できます。帰属表示の例:「
              <code className="font-mono text-sm text-foreground">
                出典: 中国皇帝統計 (emperorstats.com), CC BY 4.0
              </code>
              」。サイトのソースコードは
              <A href={`${OPERATOR.repoUrl}/blob/main/LICENSE`} external>
                MITライセンス
              </A>
              です。
            </p>
          </Callout>
          <p>
            データ内容の変更履歴は
            <A href={`${OPERATOR.repoUrl}/blob/main/CHANGELOG.md`} external>
              CHANGELOG
            </A>
            に記録しています。
          </p>
        </Prose>
      </Section>

      <Section
        id="errata"
        title="正誤表"
        description="公開後に判明した誤りは、原典を再調査したうえで訂正し、ここに記録します。"
        contained
        containedWidth={ARTICLE_WIDTH}
        scrollMt={BELOW_SECTION_NAV}
      >
        <ErrataList items={ERRATA} />
        <Prose className="mt-5">
          <p>
            誤りにお気づきの際は
            <A href={`${OPERATOR.repoUrl}/issues`} external>
              GitHubのIssue
            </A>
            からお知らせください。
          </p>
        </Prose>
      </Section>

      <Section
        id="portraits"
        title="肖像画の出典"
        contained
        containedWidth={ARTICLE_WIDTH}
        scrollMt={BELOW_SECTION_NAV}
      >
        <Prose>
          <p>
            肖像画は、パブリックドメインまたはCC0で公開されている画像のみを
            {credits.length}
            名分使用しています（主にWikimedia
            Commons経由。『歴代帝后像』『帝鑑図説』など）。著作権保護期間内の画像や、クレジット表示が必要なライセンス（CC
            BY-SA等）の画像は使用していません。
          </p>
        </Prose>
        <div className="mt-5">
          <PortraitCredits credits={credits} />
        </div>
      </Section>

      <Section
        id="videos"
        title="関連動画について"
        contained
        containedWidth={ARTICLE_WIDTH}
        scrollMt={BELOW_SECTION_NAV}
      >
        <Prose>
          <p>
            一部の皇帝ページには、その皇帝を主題とした解説動画（YouTube埋め込み）を掲載しています。これらの動画は、
            <strong>当サイトとは無関係の</strong>YouTubeチャンネル「
            <A href={VIDEO_CHANNEL.url} external>
              {VIDEO_CHANNEL.name}
            </A>
            」様が制作・公開されているものです。動画の内容は当サイトの集計・調査とは独立しており、当サイトが内容の正確性を保証するものではありません。埋め込みにはYouTubeの公式埋め込み機能を利用しています。
          </p>
        </Prose>
      </Section>

      <Section
        id="operator"
        title="運営者について"
        contained
        containedWidth={ARTICLE_WIDTH}
        scrollMt={BELOW_SECTION_NAV}
      >
        <Prose>
          <p>
            このサイトとデータセットは、
            <A href={OPERATOR.profileUrl} external>
              {OPERATOR.handle}
            </A>
            が個人で制作・運営しています。所属する組織や団体はなく、企業・研究機関からの資金提供も受けていません。広告掲載やアフィリエイトも行っていません。
          </p>
          <p>
            歴史学の専門家ではない個人の仕事なので（下の免責事項もご覧ください）、そのぶん
            <strong>判断の根拠を全部残して検証できるようにする</strong>
            方針で作っています。
            {stats.emperorCount}
            名の全員について、在位の開始日・終了日は正史原文の該当箇所を引用したうえで暦換算の計算過程まで記録しています。死因と即位の経緯には判定の根拠を述べた調査メモと出典（書名・巻）を、改元・大赦・親征などの回数系8項目には数え方と判定根拠を記した調査メモを付けています（回数系は出典欄を独立させておらず、典拠にした書名・巻は調査メモの本文に記しています）。死因と即位の経緯はサイトの各皇帝の個別ページで読め、これらすべては
            <A href={`${BASE_PATH}/data/emperors.json`}>配布データ</A>
            に収録しています。集計結果に疑問があれば、根拠にした原文まで遡って確かめられます。
          </p>
          <p>
            ソースコード・データの変更履歴・調査手順の記録は
            <A href={OPERATOR.repoUrl} external>
              GitHub リポジトリ
            </A>
            ですべて公開しています。ご指摘・ご連絡は同リポジトリの
            <A href={`${OPERATOR.repoUrl}/issues`} external>
              Issue
            </A>
            へお願いします。
          </p>
        </Prose>
      </Section>

      <Section
        id="disclaimer"
        title="免責事項"
        contained
        containedWidth={ARTICLE_WIDTH}
        scrollMt={BELOW_SECTION_NAV}
      >
        <Prose>
          <Callout tone="muted">
            <p>
              本サイトは、AI（大規模言語モデル）を活用して調査・集計・構築しています。また、制作者は歴史学の専門家ではありません。正史の原典に1件ずつあたる方針でできる限り丁寧に作成していますが、史料の解釈を誤っている場合や、現代の歴史学の通説と異なる整理をしている場合があります。歴史の素人が作った統計サイトとして、どうか優しい目でご覧いただければ幸いです。お気づきの点は
              <A href={`${OPERATOR.repoUrl}/issues`} external>
                GitHubのIssue
              </A>
              で教えていただけると助かります。
            </p>
            <p>
              本サイトの内容の正確性・完全性を保証するものではなく、本サイトの利用によって生じたいかなる不利益・損害についても、制作者は責任を負いかねます。レポートや記事等で数値を利用される際は、必ず原典をご確認ください。
            </p>
          </Callout>
          <p>
            正史原文の確認にあたっては、GitHubで公開されている二十四史コーパス
            <A href="https://github.com/hunterhug/china-history" external>
              china-history
            </A>
            および古代文献コーパス
            <A href="https://github.com/garychowcmu/daizhigev20" external>
              daizhigev20
            </A>
            （殆知閣古代文献）を利用させていただきました。両プロジェクトの公開に感謝します。
          </p>
        </Prose>
      </Section>
    </>
  );
}
