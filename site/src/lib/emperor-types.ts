// クライアントコンポーネントから安全にimportできる型・定数のみを置く（node:fsに依存しない）。
// data/emperors.jsonの実読み込みはlib/emperors.ts（サーバー専用）で行う。

export type DeathCauseCategory =
  | "病死"
  | "暗殺"
  | "処刑"
  | "戦死"
  | "自尽"
  | "事故死"
  | "不詳"
  | "諸説あり";

// 2026-07-26、単一 enum 9値から「4軸＋2補助」の多軸構造へ移行した。
// これは軸から機械導出される表示ラベル（data/schema/ADDITIONAL_SCHEMA.md 1節の導出ルール）。
// 旧値の「建国」「禅譲」「復位」「不詳」「諸説あり」は軸へ分解されて消滅している
// （復位は reigns[].isRestoration、帝号の新称は axes.titleOrigin のバッジが担う）。
// スキーマ v3（2026-07-29）で、該当0名だった「受禅（擁立）」がデータの enum から
// 削除され、実在する 8 値になった。
export type AccessionRouteCategory =
  | "世襲"
  | "擁立"
  | "簒奪"
  | "内禅"
  | "自立"
  | "推戴"
  | "受禅（易姓）"
  | "継承（経緯記載なし）";

export type CourtEventKey =
  | "eraChangeCount"
  | "amnestyCount"
  | "empressInstallationCount"
  | "crownPrinceDepositionCount";

export type MilitaryEventKey =
  | "personalCampaignCount"
  | "rebellionSuppressionCount"
  | "rebellionSufferedCount";

export type AgeKey = "accessionAge" | "deathAge";

/**
 * 政権の位置づけ。スキーマ v3（2026-07-29）で `catalogs.regimes[].category` として
 * **政権単位に一意**な値になった（それ以前は皇帝ごとの `dynasty.category` で、
 * 同じ政権の中に別々の値が同居していた——タグが指していたのは政権の性格ではなく
 * その人の即位の経緯だったため）。人物単位の「その政権の中で正規の皇帝か
 * 対立・僭称か」は `EmperorRecord.isRivalClaimant` が担う。
 *
 * 2026-08-01 に軸そのものを「中華を統一していたか」へ入れ替えた（旧値は
 * 正統王朝／並立政権／反乱・自称政権で、「正統」がどの政権を正統とみなすかという
 * 歴史学上の論争を呼び込むため。判定基準は data/schema/INCLUSION_CRITERIA.md の
 * 「政権区分の判定基準」節）。
 */
export type DynastyCategory = "統一王朝" | "分裂期の王朝" | "反乱・自称政権";

/** ある指標での全皇帝中の順位（lib/emperors.tsがビルド時に計算する）。 */
export interface MetricRank {
  /** 同値は同順位とするcompetition ranking（1, 2, 2, 4, …）。 */
  rank: number;
  /** 順位対象の人数。回数系は1回以上、年齢は判明している皇帝のみが対象。 */
  total: number;
  /** 同順位の皇帝が他にもいるか（表示で「タイ」を付す）。 */
  tied: boolean;
}

/** 皇帝を扱うYouTube動画（data/emperor-videos.jsonの目視確認済みマッチのみ）。 */
export interface EmperorVideo {
  videoId: string;
  title: string;
  thumbnailUrl: string;
}

/**
 * 民族名（Issue #37 単位3）。ラベルは `lib/data-source.ts` が
 * `meta.catalogs.ethnicNameKinds` から解決済みで、**相手側 `personalName` の
 * ラベル（`counterpartLabel`）も kind から決まる** — 遼は「契丹名／漢風名」、
 * 元は「モンゴル語名／漢字音写」のように、括弧が指す現象が政権ごとに違うため。
 */
export interface EthnicName {
  kind: string;
  value: string;
  label: string;
  counterpartLabel: string;
  order: "ethnic-first" | "personal-first";
}

export interface EmperorRecord {
  id: string;
  name: string;
  dynastyName: string;
  dynastySection: string;
  dynastyKey: string;
  /** 表示用王朝名。王朝名のみ（同名王朝が複数時代にある場合のみ「呉・三国」のように時代を付す）。 */
  dynastyLabel: string;
  /** 訪問者向けの時代区分ラベル（例: 五胡十六国・南北朝）。王朝フィルタのグループ見出しに使う。 */
  eraLabel: string;
  dynastyCategory: DynastyCategory;
  /** その政権の中で正規の皇帝ではなく、並立して帝号を称し正史が帝紀を立てない皇帝
   *  （データ側 `standing` = 対立・僭称の皇帝。20名）。政権の位置づけを表す
   *  dynastyCategory とは別軸で、蕭正徳（梁）・元曄（北魏）のように
   *  「歴代に数えられる王朝の中の対立皇帝」がここで区別される。 */
  isRivalClaimant: boolean;
  reignApproxDays: number;
  reignYears: number;
  reignDurationLabel: string;
  reignNeedsPreciseDays: boolean;
  reignCount: number;
  deathCauseCategory: DeathCauseCategory;
  accessionRouteCategory: AccessionRouteCategory;
  /** 帝号を新たに称した（axes.titleOrigin = 新称）。旧「建国」が伝えていた情報のうち、
   *  皇位の出所とは別の「王朝を興して皇帝号を新設した」側面をここで示す。 */
  accessionTitleNew: boolean;
  /** 廃位・退位ののち再び即位した在位を持つ（reigns[].isRestoration）。
   *  旧「復位」ラベルの代わりに、即位経路の脇のバッジとして出す。 */
  hasRestoration: boolean;
  eraChangeCount: number;
  amnestyCount: number;
  empressInstallationCount: number;
  crownPrinceDepositionCount: number;
  personalCampaignCount: number;
  rebellionSuppressionCount: number;
  rebellionSufferedCount: number;
  capitalRelocationCount: number;
  /** 即位時年齢（数え年）。調査済みだが生年不詳などで算出できない場合はnull。 */
  accessionAge: number | null;
  /** 没年齢（数え年）。同上。 */
  deathAge: number | null;
  /** 在位期間の表示文字列（例: "1908–1912年 / 1917年"）。復位者は期間ごとに区切る。 */
  periodsLabel: string;
  /** 通用名の脇に小さく出す補助名（諱）。通用名に諱が含まれる人物は null。
   *  導出は lib/display-name.ts の `emperorSubtitle`。 */
  subtitle: string | null;
  /** 曖昧さを解いた名前。同じ王朝の中で通用名がぶつかる組（南斉の廃帝3人・
   *  後漢の少帝2人）にだけ諱が添わる。`<title>`・JSON-LD のように王朝は別に添えるが
   *  名前そのものが一意である必要がある面で使う。 */
  disambiguatedName: string;
  /** 王朝を冠した名前（「漢の武帝」）。**名前の文字列しか置けない面**
   *  （チャートの軸ラベル・ツールチップ）で使う。カード・表は王朝が隣に出るので使わない。 */
  qualifiedName: string;
  /** データ側の呼称の原文（`name.commonName`）。表示名は括弧（爵位・別諡号・別称）を
   *  落としているので、「廃帝（昌邑王）」の昌邑王のような情報はここにしか残らない。
   *  個別ページの Person JSON-LD の alternateName に使う。 */
  commonName: string;
  /** 姓（複姓を含む）。**null は「姓を持たない形で伝わる」**で未記入ではない
   *  （モンゴル語名の漢字音写12人・Issue #37 単位6）。 */
  familyName: string | null;
  /** 諱（姓を含まない）。廟号・諡号と並べて個別ページのヒーローにチップとして出す。 */
  personalName: string | null;
  /** 姓＋諱。人物を特定するための1つの文字列が要る面（補助名・検索・モノグラム・
   *  民族名の相手側）で使う。姓を持たない12人では諱そのもの。 */
  fullPersonalName: string | null;
  /** 民族名。分けていない人物は null（**「民族名が無い」ではない**・移行が別段のため）。 */
  ethnicName: EthnicName | null;
  /** 字（92人）。**null は「字が無い」ではない** — 唐以降の帝紀が冒頭定型に字を
   *  書かないためで、空欄の意味がデータ側で「無い」と確定していない。 */
  courtesyName: string | null;
  /** 幼名＝原文の「小字」（30人）。同じく **null は「小字が無い」ではない**。
   *  金章宗・衛紹王は民族名と同じ値を持つ（女真語の名を金史が「小字」として載せる）。 */
  childhoodName: string | null;
  templeName: string | null;
  posthumousName: string | null;
  /** 別名（秦始皇・趙政など）。個別ページの Person JSON-LD の alternateName に使う。 */
  aliases: string[];
  /** Wikidata QID（例: "Q7192"）。個別ページの Person JSON-LD の sameAs に使う。 */
  wikidataId: string | null;
  /** 皇帝一覧の検索対象文字列（各種名称・別名・王朝名・時代を連結したもの）。 */
  searchText: string;
  hasPortrait: boolean;
  portraitUrl: string | null;
  /** 肖像の中で顔の中心が縦方向のどこにあるか（0=上端・1=下端）。肖像なしはnull。
   *  個別ページのヒーローの枠は実体と同じ3:4で余りが出ないため使わないが、
   *  一覧用の軽量レコードがここから写されるので基底レコードにも持たせてある。 */
  portraitFocusY: number | null;
  /** この皇帝を扱うYouTube動画（無ければ空配列）。 */
  videos: EmperorVideo[];
  /** 各指標の全皇帝中の順位（個別ページ用）。回数系の0回・年齢不明は対象外でnull。 */
  ranks: Record<RankingMetricKey, MetricRank | null>;
}

/**
 * 皇帝一覧ページ（/emperors）専用の軽量レコード。カード表示・検索・絞り込みに
 * 必要な最小フィールドだけを持つ（365件×EmperorRecordフルをRSCペイロードに
 * 埋め込むと/emperorsのHTML・payloadが数百KB太るため）。全項目は個別ページ
 * （/emperors/{id}）が Server Component で読む。
 */
export interface EmperorListRecord {
  id: string;
  name: string;
  /** ふりがな付きの表示名（`｜親文字《ルビ》`・Issue #20）。読みが無い名前は name と同じ。
   *  平文は name のまま持つ — 検索・並べ替えはルビを剥がさずに済ませたい。 */
  nameRuby: string;
  /** 姓（複姓を含む）。**肖像なしカードのモノグラム一文字はここ** — 分ける前は
   *  諱の頭文字が姓だった（Issue #37 単位6）。姓を持たない12人は null。 */
  familyName: string | null;
  /** 諱（姓を含まない）。 */
  personalName: string | null;
  /** カード1行目に通用名と並べる補助名（諱）。不要な人物はnull。
   *  導出規則・人物別上書きは lib/display-name.ts を参照。 */
  cardSubtitle: string | null;
  /** 補助名のふりがな付き（Issue #20）。cardSubtitle が null ならこちらも null。 */
  cardSubtitleRuby: string | null;
  dynastyLabel: string;
  /** 王朝名のふりがな付き（Issue #20）。絞り込みは dynastyKey・表示だけこちらを使う。 */
  dynastyLabelRuby: string;
  eraLabel: string;
  /** 時代ラベルのふりがな付き（Issue #20）。グループ見出しの表示にだけ使う
   *  （グループ化のキーは平文の eraLabel）。 */
  eraLabelRuby: string;
  dynastyKey: string;
  dynastyCategory: DynastyCategory;
  /** その政権の中で正規の皇帝ではなく、並立して帝号を称した皇帝（20名・
   *  `EmperorRecord.isRivalClaimant` と同じ値）。カード2行目の王朝ラベルは
   *  本体政権（「梁（蕭梁）」）なので、これが無いとカードからは対立皇帝だと読めない。 */
  isRivalClaimant: boolean;
  portraitUrl: string | null;
  /** 肖像の中で顔の中心が縦方向のどこにあるか（0=上端・1=下端）。肖像なしはnull。
   *  カードの肖像枠は実体(3:4)より横長なので、この値が無いと上寄せに切られて
   *  題字や余白が枠を占め顔が下半分に沈む。出所は肖像 manifest.json の focusY。 */
  portraitFocusY: number | null;
  /** 在位期間の表示文字列（例: "1908–1912年 / 1917年"）。カード3行目に出す。
   *  名前と王朝しか無いカードは統計サイトの一覧として読み取れる情報が乏しく、
   *  同じ時代の中で誰がいつの人なのかを掴めないため添える。 */
  periodsLabel: string;
  /** 皇帝一覧の検索対象文字列（各種名称・別名・王朝名・時代を連結したもの）。 */
  searchText: string;
  /** かな検索用のひらがな読み（読み展開をスペース区切りで連結。表示には使わない）。 */
  searchKana: string;
}

/**
 * データベースページ（/database）の列数。OGP画像の事実カードがこの数を出すため、
 * 表の実装（emperor-table.tsx の COLUMNS）とずれないよう単一情報源にしてある
 * （OGP はビルド時に焼かれてキャッシュも効くので、本文とずれると訂正が最も届きにくい）。
 * COLUMNS 側にこの値との突合 assert があり、列を増減するとビルドが落ちる。
 */
export const DATABASE_COLUMN_COUNT = 8;

/**
 * データベースページ（/database）専用のレコード。**表が描く列＋絞り込みに要る値**だけを持つ。
 * `eraLabel`・`dynastyKey`・`reignCount` は列としては描かず、絞り込みだけが使う。
 *
 * `EmperorListRecord` を流用しないこと — 図鑑グリッド用のフィールドは表の列と
 * 一致せず、表が使わない `searchText`／`searchKana`（1人あたり数百バイト）を
 * 365件ぶん運ぶことになる。表の検索は行のセル値そのものを対象にするので、
 * 検索用の連結文字列を別に持つ必要がない（かな検索は図鑑側の機能で、ここには無い）。
 *
 * 列を足すときは、ここへ足す → `getEmperorTableRecords()` で埋める →
 * `emperor-table.tsx` の `COLUMNS` に定義を足す、の順で3箇所そろえる。
 */
export interface EmperorTableRecord {
  id: string;
  name: string;
  /** ふりがな付きの表示名（`｜親文字《ルビ》`・Issue #20）。並べ替え・検索は name を使う。 */
  nameRuby: string;
  /** 諱（姓を含まない）。列としては描かないが**検索の対象にする**（2026-07-31 ユーザー指示）—
   *  姓＋諱も別に検索文字列へ入れてあるので「劉徹」でも「徹」でも武帝を引ける。同一人物の別名なので、見えていない値で絞られても
   *  「なぜこの行が残ったか」が分からなくならない（時代・在位回数を検索対象から
   *  外したのとはここが違う）。 */
  personalName: string | null;
  /** 民族名（Issue #37 単位3）。**列ではなく検索の対象**なので `COLUMNS` と
   *  `DATABASE_COLUMN_COUNT` は動かさない。分ける前は `personalName` の括弧の中に
   *  入っていて検索に当たっていたので、無いと「クビライ」で元世祖が引けなくなる。 */
  ethnicName: string | null;
  dynastyLabel: string;
  /** 王朝名のふりがな付き（Issue #20）。並べ替え・絞り込みは dynastyLabel/dynastyKey。 */
  dynastyLabelRuby: string;
  /** 王朝の絞り込み用（DynastyOption.value と同じ政権 ID。列としては描かない）。 */
  dynastyKey: string;
  /** 時代の絞り込み用（列としては描かない）。 */
  eraLabel: string;
  /** 在位期間の表示文字列（例: "1908–1912年 / 1917年"）。 */
  periodsLabel: string;
  /** 在位期間列の**並べ替えキー**＝最初の在位の開始年（復位者も初回で位置が決まる）。
   *  表示文字列は「前221–前210年」のように前後の年が混ざり、文字列として並べても
   *  年代順にならない。既定順もこの値の昇順。 */
  firstStartYear: number;
  /** 在位年数列の**並べ替えキー**。表示は reignDurationLabel を出す
   *  （"61年332日" のような表示文字列で並べると桁が揃わず順序が壊れる）。 */
  reignApproxDays: number;
  reignDurationLabel: string;
  /** 在位回数。2以上＝復位した皇帝（旧 /reign の復位者一覧が担っていた情報）。
   *  絞り込み専用で、列としては描かない。 */
  reignCount: number;
  accessionRouteCategory: AccessionRouteCategory;
  deathCauseCategory: DeathCauseCategory;
  /** 即位時年齢（数え年）。調査済みだが生年不詳などで算出できない場合は null。 */
  accessionAge: number | null;
  /** 没年齢（数え年）。同上。 */
  deathAge: number | null;
}

/**
 * 構造化データ（Person JSON-LD）用の生年月日・没年月日。ages.birthDate/deathDateが
 * ISO風の解析可能な値かつ実際に日付を示す場合のみ値が入る（不明・推定不能はnull）。
 * precisionに応じて年/年月/年月日に丸めてある。
 */
export interface EmperorStructuredDates {
  birthDate: string | null;
  deathDate: string | null;
}

// 個別ページ専用の経緯（EmperorNarrative・RestorationNarrative）は
// 2026-08-03 に表示ごと廃止した。即位の経緯・死因の経緯・判定の軸・復位の経緯の
// いずれもサイトには出さず、note・出典・軸は配布データ（data/emperors.json）にある。

/**
 * 在位中の出来事年表（個別ページ）の種別キー。回数系8指標のうち7つに対応する
 * （反乱鎮圧は被反乱と同じ反乱を数えたものなので年表には出さない。理由は
 * emperors.ts の EVENT_METRICS のコメント）。
 */
export type EmperorEventKind =
  | "eraChange"
  | "amnesty"
  | "empressInstallation"
  | "crownPrinceDeposition"
  | "personalCampaign"
  | "rebellionSuffered"
  | "capitalRelocation";

export const emperorEventKindLabels: Record<EmperorEventKind, string> = {
  eraChange: "改元",
  amnesty: "大赦",
  empressInstallation: "立后",
  crownPrinceDeposition: "皇太子廃立",
  personalCampaign: "親征",
  rebellionSuffered: "被反乱",
  capitalRelocation: "遷都",
};

/** 在位中の出来事1件分（lib/emperors.tsのgetEmperorEventsが日付順に整列して返す）。 */
export interface EmperorEventRow {
  kind: EmperorEventKind;
  /** 表示用日付。**保存値の深さをそのまま出す**（年/月/日。例: "前202年7月〜前202年9月"）。
   *  データ側で「年精度 ＋ 在位境界年の月日」に絞ってあり、深さそのものが主張なので
   *  表示側で丸め直さない（2026-08-03・Issue #69）。
   *  西暦に換算されていないもの（元号+旧暦表記）は原文ママ。不明はnull。 */
  dateLabel: string | null;
  /** 1行要約。構造化フィールド優先（親征=対象、反乱=事件名、遷都=旧都→新都、
   *  その他=noteの先頭一文）。
   *
   *  **年表の行はこれで終わり**（2026-08-03 ユーザー決定・Issue #69）。以前は行を開くと
   *  首謀者・結果・note全文・出典を出していたが、note は調査の作業ログで訪問者に
   *  読ませる文章ではなく、そこに含まれる引用も「原文を読んだ形跡」であって
   *  配布データが底本に実在すると主張するものではない（線引きは /about）。 */
  summary: string;
}

export interface DynastyOption {
  value: string;
  label: string;
  /** 所属する時代グループ（セレクトのグループ見出し）。 */
  era: string;
  /** かな検索用の読み展開（ラベル・時代の読み。ビルド時生成）。 */
  kana: string[];
}

/** ランキング棒グラフで選択できる数値指標。サーバー→クライアント境界を関数でなく
 *  文字列キーで渡すための識別子（Client Componentに関数は渡せないため）。 */
export type RankingMetricKey =
  | "reignYears"
  | CourtEventKey
  | MilitaryEventKey
  | "capitalRelocationCount"
  | AgeKey;

export type CategoryMetricKey = "deathCauseCategory" | "accessionRouteCategory";

/** 「前221」「618」のような年表示。 */
export function formatYear(year: number): string {
  return year < 0 ? `前${-year}` : `${year}`;
}

/**
 * 年を連続座標（天文学的紀年）へ変換する。データの年は「前221年 = -221」で
 * 0年が暦に存在しないため、-1年と1年をそのまま引き算すると2年分になってしまう。
 * 負の年に+1して連続化し、位置・幅の計算はすべてこの座標系で行う。
 */
export function astroYear(year: number): number {
  return year < 0 ? year + 1 : year;
}

/** 訪問者向け時代区分ラベルの期間（`ERA_BY_SECTION` の16区分）。 */

/** 概算日数(365/30/7/1換算の共通尺度)を「○年○日」表記に変換する。 */
export function formatReignDuration(approxDays: number): string {
  // 金の末帝（完顔承麟）など即日退位・戦死のケース。「0日」では欠測に見えるため明示する。
  if (approxDays === 0) return "1日未満";
  const years = Math.floor(approxDays / 365);
  const days = approxDays - years * 365;
  if (years === 0) return `${days}日`;
  if (days === 0) return `${years}年`;
  return `${years}年${days}日`;
}

// value はデータ側のenum値（v3 では catalogs.enums.regimeCategory のラベル）。かつて
// 内部値（"十六国"等の出典wikitext由来の歴史的経緯）と表示ラベルの二重管理だったが、
// 2026-07-23に3値ともデータ側の語彙を表示語彙へ統一した（value === label。変換表と
// しての役割は廃止し、並び順と選択肢列挙のためだけに残す）。
export const dynastyCategoryOptions: { value: DynastyCategory; label: string }[] = [
  { value: "統一王朝", label: "統一王朝" },
  { value: "分裂期の王朝", label: "分裂期の王朝" },
  { value: "反乱・自称政権", label: "反乱・自称政権" },
];

// 文言はデータ側 catalogs.enums.regimeCategory の description を、例示を添えて
// 訪問者向けに膨らませたもの（このファイルは Client Component から import するため
// データを読めない。カタログの説明を変えたらここも合わせる）。
export const dynastyCategoryDescriptions: Record<DynastyCategory, string> = {
  統一王朝:
    "中華を統一して支配した時期がある王朝の皇帝（例：秦・前漢・後漢・隋・唐・北宋・元・明・清など）",
  "分裂期の王朝":
    "中華が複数の政権に分かれていた時代に、その一角を占めた王朝・政権の皇帝（例：魏・呉・蜀漢・五胡十六国・南北朝の各王朝・五代十国・遼・金・西夏・南宋など）",
  "反乱・自称政権":
    "統一が保たれていた時期に、反乱・自立によって帝号を称した政権の皇帝（例：赤眉軍の漢・公孫述の成家・李自成の順・呉三桂の周など）",
};

export const courtEventLabels: Record<CourtEventKey, string> = {
  eraChangeCount: "改元回数",
  amnestyCount: "大赦回数",
  empressInstallationCount: "立后回数",
  crownPrinceDepositionCount: "皇太子廃立回数",
};

export const militaryEventLabels: Record<MilitaryEventKey, string> = {
  personalCampaignCount: "親征回数",
  rebellionSuppressionCount: "反乱鎮圧回数",
  rebellionSufferedCount: "被反乱回数",
};

export const ageLabels: Record<AgeKey, string> = {
  accessionAge: "即位時年齢",
  deathAge: "没年齢",
};

/** 時代グループの時代順（王朝フィルタのグループ見出し・時代別集計の並び）。 */
export const eraOrder: string[] = [
  "秦・前漢",
  "新〜後漢初",
  "後漢",
  "三国",
  "晋",
  "五胡十六国",
  "南北朝",
  "隋",
  "隋末",
  "唐",
  "五代十国",
  "宋",
  "遼・西夏・金",
  "元",
  "明",
  "清",
];

export const deathCauseCategoryOrder: DeathCauseCategory[] = [
  "病死",
  "暗殺",
  "処刑",
  "戦死",
  "自尽",
  "事故死",
  "不詳",
  "諸説あり",
];

export const deathCauseDescriptions: Record<DeathCauseCategory, string> = {
  病死: "自然死・疾病による死（老衰を含む）",
  暗殺: "同一政権内部の臣下・近親・宦官等による謀殺（毒殺を含む）",
  処刑: "敵対勢力・後継政権・征服者による裁判・見せしめ的な公的処断",
  戦死: "親征・防衛戦・鎮圧戦などの戦闘中の死",
  自尽: "自殺・自害（廃位や敗戦に追い詰められての自裁を含む）",
  事故死: "落馬・溺死・火災等の事故による死",
  不詳: "死因の記録・手がかりが原典に見当たらない",
  諸説あり: "複数の原典・通説が対立し一つに絞れない",
};

// 軸1（君主位の出所）でまとめた表示順。前代君主から継承→他政権から受禅→自立の順に並べ、
// 各グループ内は軸2（即位を決めた主体）の順に並べる。
export const accessionRouteCategoryOrder: AccessionRouteCategory[] = [
  "世襲",
  "擁立",
  "簒奪",
  "内禅",
  "継承（経緯記載なし）",
  "受禅（易姓）",
  "自立",
  "推戴",
];

/**
 * 区分名の短い表示。末尾の丸括弧を落とす（「受禅（易姓）」→「受禅」・
 * 「継承（経緯記載なし）」→「継承」・「その他（3区分）」→「その他」）。
 * 現行のカタログでは括弧を落としても重複する区分名は無い（括弧つきは
 * 即位経路の2つだけ）。**落とした全文は title などで必ず残すこと** —
 * 括弧の中身は分類の根拠そのもの（「経緯記載なし」＝原典が書いていない）で、
 * 消したままにすると別の区分に見える。
 *
 * 凡例（概要ダッシュボードの内訳帯）と表（データベース）が同じ短縮規則を使う。
 */
export function shortCategoryLabel(name: string): string {
  return name.replace(/（[^）]*）$/, "");
}

export const accessionRouteDescriptions: Record<AccessionRouteCategory, string> = {
  世襲: "同一政権の前代君主から位を継ぎ、先帝自身が後継を定めていた（遺詔・立太子等）",
  擁立: "同一政権の前代君主から位を継いだが、決めたのは臣下・軍・宦官・外戚・母后・宗室",
  簒奪: "前帝の位を自ら奪って即位（排除と即位が一体の行為だった場合）",
  内禅: "同一政権内で、先帝が在世のまま自ら位を譲った（生前譲位。例：唐玄宗・清仁宗・金哀宗）",
  "継承（経緯記載なし）": "同一政権の前代君主から位を継いだが、誰が決めたかを原典が記していない（例：始皇帝・宋太宗）",
  "受禅（易姓）": "別姓・別政権の皇帝から位を受けた王朝交代で、本人が主導した（例：曹丕・楊堅・趙匡胤）",
  自立: "先行する君主から位を受けず、自ら皇帝を称した（例：劉邦・光武帝・明太祖）",
  推戴: "先行する君主から位を受けていないが、自ら称したのではなく他者に立てられた（例：南明の諸帝）",
};

/**
 * 即位経路の多軸表現（2026-07-26 導入。data/schema/ADDITIONAL_SCHEMA.md 1節が正典）。
 * 表示ラベル accessionRouteCategory はこの軸から機械導出した値。
 * 2026-08-03 以降サイトには出さない（「即位の経緯」節ごと廃止）ので、
 * ここに残っているのは data/emperors.json を読むときの生レコードの型としてだけ。
 */
export interface AccessionAxes {
  /** 軸1: 君主位の出所。 */
  throneSource: string;
  /** 軸1b: 帝号が新称か継承か（王朝を興して皇帝号を新たに称したかの手がかり）。 */
  titleOrigin: string;
  /** 軸2: 即位を決めた主体（複数可・「史料から決着不能」は単独）。 */
  decidedBy: string[];
  /** 軸2の補助: 第三者の内訳（臣下・軍・宦官・外戚・母后・宗室）。第三者を含むときのみ非空。 */
  decidedByAgents: string[];
  /** 軸3: 先帝の去就。 */
  predecessorFate: string;
  /** 軸4: 先帝との血縁（kinshipグラフの続柄と一致）。 */
  relationToPredecessor: string;
  /** 補助1: 手続きの形式（禅譲儀礼・内禅・通常の践祚・儀礼なし・自称・偽詔・矯詔）。 */
  procedure: string;
}

/**
 * 皇帝ごとの紹介文（`data/emperor-profiles.json`・GitHub Issue #16）。
 * 未執筆の皇帝は `getEmperorProfile()` が null を返す。
 */
export interface EmperorProfile {
  /** ヒーロー内（要約チップの下）の導入（120〜250字）。段落の区切りは空行。 */
  lead: string | null;
  /**
   * 「人物紹介」節の本文（150〜700字・逸話はここ）。段落の区切りは空行。
   *
   * lead と分けているのは、**ページを開いた時点で文章だけで埋まるのを避ける**ため
   * （2026-08-01 ユーザー指示）。ヒーローに500字級を置くと、初期表示で盤面
   * （基本情報・回数）まで届かない。
   */
  body: string | null;
  /** 検索結果・OGP に出る1文（120字前後）。leadの冒頭を切り出すと文が途中で切れるため別に持つ。 */
  description: string | null;
}

/**
 * 「明」「呉・三国（三国）」のような、王朝名＋時代の見出し用サブラベル。
 * 王朝名から時代が読み取れる場合は重複を避けて時代を付さない。
 *
 * 個別ページのヒーロー・`generateMetadata` の title/description・Person JSON-LD・
 * OGP画像（`lib/og-image.tsx`）が同じ文字列を出すため、部品ではなくここに置く
 * （OGP は satori 側で描くので React の表示部品を import できない）。
 */
export function dynastyContextLabel(
  record: Pick<EmperorRecord, "dynastyLabel" | "eraLabel" | "dynastyName">,
): string {
  return record.dynastyLabel.includes(record.eraLabel) ||
    record.eraLabel.includes(record.dynastyName)
    ? record.dynastyLabel
    : `${record.dynastyLabel}（${record.eraLabel}）`;
}

// 軸の表示見出し（accessionAxisLabels）は、それを出していた個別ページの
// 「即位の経緯」節ごと 2026-08-03 に廃止した。軸そのものは data 側に残っている。
