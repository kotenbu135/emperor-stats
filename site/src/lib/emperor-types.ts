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
 * 政権の性格。スキーマ v3（2026-07-29）で `catalogs.regimes[].category` として
 * **政権単位に一意**な値になった（それ以前は皇帝ごとの `dynasty.category` で、
 * 同じ政権の中に「正統王朝」と「反乱・自称政権」が同居していた——タグが指していたのは
 * 政権の性格ではなくその人の即位の経緯だったため）。人物単位の「その政権の中で
 * 正規の皇帝か対立・僭称か」は `EmperorRecord.isRivalClaimant` が担う。
 */
export type DynastyCategory = "正統王朝" | "並立政権" | "反乱・自称政権";

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
   *  （データ側 `standing` = 対立・僭称の皇帝。20名）。政権の性格を表す
   *  dynastyCategory とは別軸で、蕭正徳（梁）・元曄（北魏）のように
   *  「正統王朝の中の対立皇帝」がここで区別される。 */
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
  /** 諱（本名）・廟号・諡号。皇帝一覧の詳細表示用。 */
  personalName: string | null;
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
   *  詳細ダイアログ・個別ページの枠は実体と同じ3:4で余りが出ないため使わないが、
   *  一覧用の軽量レコードがここから写されるので基底レコードにも持たせてある。 */
  portraitFocusY: number | null;
  /** この皇帝を扱うYouTube動画（無ければ空配列）。 */
  videos: EmperorVideo[];
  /** 各指標の全皇帝中の順位（詳細ダイアログ用）。回数系の0回・年齢不明は対象外でnull。 */
  ranks: Record<RankingMetricKey, MetricRank | null>;
}

/**
 * 皇帝一覧ページ（/emperors）専用の軽量レコード。カード表示・検索・絞り込みに
 * 必要な最小フィールドだけを持つ（365件×EmperorRecordフルをRSCペイロードに
 * 埋め込むと/emperorsのHTML・payloadが数百KB太るため）。全項目は詳細ダイアログを
 * 開いた時だけ /emperor-records/{id} をfetchして取得する。
 */
export interface EmperorListRecord {
  id: string;
  name: string;
  /** 諱（本名）。肖像なしカードのモノグラム一文字に使う。 */
  personalName: string | null;
  /** カード1行目に皇帝号と並べる補助名（諱・通用名）。不要な人物はnull。
   *  導出規則・人物別上書きは lib/card-subtitle.ts を参照。 */
  cardSubtitle: string | null;
  dynastyLabel: string;
  eraLabel: string;
  dynastyKey: string;
  dynastyCategory: DynastyCategory;
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
 * `EmperorListRecord` を流用しないこと — 図鑑グリッド用の10フィールドは表の列と
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
  /** 諱（本名）。列としては描かないが**検索の対象にする**（2026-07-31 ユーザー指示）—
   *  「劉徹」で武帝を引ける。同一人物の別名なので、見えていない値で絞られても
   *  「なぜこの行が残ったか」が分からなくならない（時代・在位回数を検索対象から
   *  外したのとはここが違う）。 */
  personalName: string | null;
  dynastyLabel: string;
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

/** 詳細ダイアログの前後送りナビに必要な最小情報（一覧グリッドは軽量レコードを渡す）。 */
export interface EmperorNavTarget {
  id: string;
  name: string;
}

/** 経緯1節分（即位の経緯・死因の経緯）。noteは調査時の原文ママ。 */
export interface NarrativeSection {
  note: string;
  /** 出典の表示ラベル（source.pageそのまま）。原則は正史巻名（例: "旧唐書 巻二（太宗上）"）。
   *  Wikipedia記事名の出典はtask.md 3-1で一掃済み。 */
  sourceLabel: string;
  /** 出典側の補足note（異説の所在・出典帰属の修正経緯など。無ければnull）。 */
  sourceNote: string | null;
}

/** 復位1回分の経緯（reigns[].noteの原文ママ）。 */
export interface RestorationNarrative {
  /** 復位後の在位期間（例: "705–710年"）。 */
  periodLabel: string;
  note: string;
}

/** 調査メモ1項目分（回数系指標のcount.note・年齢のages.note）。 */
export interface ResearchMemo {
  label: string;
  note: string;
}

/**
 * 在位日付の典拠1件分（reigns[].duration.source）。quote/conversionは
 * task.md 3-1フェーズBで整備した正史原文引用・暦換算記録（一部の先行調査分は未付与でnull）。
 */
export interface ReignSourceNarrative {
  /** 対象の在位期間（例: "前221–前210年"）。 */
  periodLabel: string;
  /** 出典（正史の書名・巻名）。 */
  sourceLabel: string;
  /** 即位・退位日付の根拠になった正史原文の直接引用（即位／退位を「／」で区切る）。 */
  quote: string | null;
  /** 旧暦（干支日）→西暦の換算典拠・既存日付との照合結果の調査記録。 */
  conversion: string | null;
  /** 出典側の補足note（異説の所在・採否判断など。無ければnull）。 */
  note: string | null;
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

/**
 * 皇帝個別ページ専用の経緯・調査メモ（lib/emperors.tsのgetEmperorNarrativeが返す）。
 * note全文は総量が大きいため、全統計ページのクライアントpropsに埋め込まれる
 * EmperorRecordには含めず、個別ページ（Server Component静的書き出し）だけが使う。
 */
export interface EmperorNarrative {
  accession: NarrativeSection | null;
  /** 即位経路の4軸＋補助（表示ラベルの導出根拠）。 */
  accessionAxes: AccessionAxes | null;
  death: NarrativeSection | null;
  restorations: RestorationNarrative[];
  memos: ResearchMemo[];
  /** 在位日付の典拠（在位期間ごと。個別ページ限定表示）。 */
  reignSources: ReignSourceNarrative[];
}

/**
 * 詳細ダイアログがlazy fetchする経緯JSON（public/emperor-notes/{id}.json）。
 * EmperorNarrativeから経緯2節だけを抜き出したもの（memos・restorationsは個別ページ限定）。
 * ダイアログはEmperorRecordにnoteを載せない方針のため、開いた時だけこれを取得する。
 */
export interface EmperorNarrativeNotes {
  accession: NarrativeSection | null;
  accessionAxes: AccessionAxes | null;
  death: NarrativeSection | null;
}

/** 在位中の出来事年表（個別ページ）の種別キー。8指標のevents[]に対応する。 */
export type EmperorEventKind =
  | "eraChange"
  | "amnesty"
  | "empressInstallation"
  | "crownPrinceDeposition"
  | "personalCampaign"
  | "rebellionSuppression"
  | "rebellionSuffered"
  | "capitalRelocation";

export const emperorEventKindLabels: Record<EmperorEventKind, string> = {
  eraChange: "改元",
  amnesty: "大赦",
  empressInstallation: "立后",
  crownPrinceDeposition: "皇太子廃立",
  personalCampaign: "親征",
  rebellionSuppression: "反乱鎮圧",
  rebellionSuffered: "被反乱",
  capitalRelocation: "遷都",
};

/** 在位中の出来事1件分（lib/emperors.tsのgetEmperorEventsが日付順に整列して返す）。 */
export interface EmperorEventRow {
  kind: EmperorEventKind;
  /** 表示用日付。datePrecisionに応じ年/月/日で丸め済み（例: "前202年7月〜前202年9月"）。
   *  西暦に換算されていないもの（元号+旧暦表記）は原文ママ。不明はnull。 */
  dateLabel: string | null;
  /** 1行要約。構造化フィールド優先（親征=対象、反乱=事件名、遷都=旧都→新都、
   *  その他=noteの先頭一文）。 */
  summary: string;
  /** 対象・首謀者・結果など構造化フィールドの内訳（折りたたみ内に表示）。 */
  facts: { label: string; text: string }[];
  /** note全文（要約と同一の場合はnull）。 */
  note: string | null;
  /** 出典表示ラベル（events[].sourceがあるもののみ）。 */
  sourceLabel: string | null;
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

/** 訪問者向け時代区分ラベルの期間（`ERA_BY_SECTION` の15区分）。 */

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
  { value: "正統王朝", label: "正統王朝" },
  { value: "並立政権", label: "並立政権" },
  { value: "反乱・自称政権", label: "反乱・自称政権" },
];

// 文言はデータ側 catalogs.enums.regimeCategory の description を、例示を添えて
// 訪問者向けに膨らませたもの（このファイルは Client Component から import するため
// データを読めない。カタログの説明を変えたらここも合わせる）。
export const dynastyCategoryDescriptions: Record<DynastyCategory, string> = {
  正統王朝: "王朝の本流として歴代に数えられる政権の皇帝（例：前漢・唐・遼・金・宋・明・清など）",
  並立政権:
    "同時代に他政権と並び立った政権の皇帝（例：五胡十六国の各政権・十国・西夏・隋末の群雄など）",
  "反乱・自称政権":
    "既存王朝への反乱・自立によって建てられた政権の皇帝（例：赤眉軍の漢・公孫述の成家・李自成の順など）",
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
  "宋・遼・西夏・金",
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
 * 表示ラベル accessionRouteCategory はこの軸から機械導出した値なので、
 * 「なぜそのラベルなのか」を読者に見せるにはこちらを出す必要がある。
 * 経緯noteと同じくデータ量があるため、EmperorRecord ではなく経緯JSON側で運ぶ。
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

/** 軸の表示見出し（詳細ダイアログ・個別ページの「即位の経緯」節で使う）。 */
export const accessionAxisLabels: Record<
  Exclude<keyof AccessionAxes, "decidedByAgents" | "titleOrigin">,
  string
> = {
  throneSource: "君主位の出所",
  decidedBy: "即位を決めた主体",
  predecessorFate: "先帝の去就",
  relationToPredecessor: "先帝との血縁",
  procedure: "手続きの形式",
};
