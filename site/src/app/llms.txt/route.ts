import { getHomeHighlights, getOverviewStats } from "@/lib/emperors";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

// llms.txt（https://llmstxt.org/）。**もとは public/llms.txt に手書きで置いていたが、
// 2026-09-20 にここへ移してデータから組み立てるようにした。**
//
// 移した理由は、手書き版に数字が1つも入っていなかったこと。生成AI経由の被引用を9問で
// 実測したところ（docs/site-design/GEO_AUDIT_2026-09-20.md）、サイトが第一の引用元に
// なった問いは0問で、原因は llms.txt・JSON-LD・sitemap のような下ごしらえの不足ではなく
// **看板の数字が読める文になっていないこと**だった。retriever は読める文しか引用できない。
//
// **数字はここで数え直さない。** トップページ（概要ダッシュボード）が使っているのと同じ
// `getOverviewStats()`・`getHomeHighlights()` の戻り値をそのまま文にする。llms.txt に
// 独自の集計を書くと、サイトの画面と llms.txt が別々の数字を名乗る状態になり、
// 「サイトと動画で数字を食い違わせない」と同じ穴が第三のコピーとして増える。
// 非業の死の区分（暗殺・処刑・戦死・自尽）も `reignDeath.segments[0]` から引いていて、
// ここには定義を書いていない — 区分を動かすときは emperors.ts の
// REIGN_DEATH_SEGMENTS 1か所だけを触れば、この文も一緒に動く。
//
// **`meta.generatedAt` を「◯◯時点」として書かないこと。** データ本体の最終更新は
// 2026-08-21 なのに `meta.generatedAt` は 2026-08-03 のままで、訂正のたびに更新されていない。
// 配布物に鮮度の主張として載せると嘘になる。
//
// `output: "export"` の静的書き出しなので `force-static`（robots.ts・sitemap.ts と同じ）。
export const dynamic = "force-static";

function buildLlmsTxt(): string {
  const overview = getOverviewStats();
  const highlights = getHomeHighlights();

  const { segments, bands } = highlights.reignDeath;
  // 非業の死の総数は帯ごとの先頭区分（segments[0]）の合計。帯は全365名を過不足なく
  // 割っているので、合計はそのまま全体の実数になる。
  const violentCount = bands.reduce((sum, band) => sum + band.values[0], 0);
  const violentPercent = (violentCount / overview.emperorCount) * 100;
  // detail は型の上では null を取りうる（「病死」のように畳んでいない区分は null）。
  // 先頭区分は畳んであるので実際には必ず中身があるが、消えたときに
  // 「非業の死（null）」と書かずに区分名だけへ落ちるようにしておく。
  const violentLabel = segments[0].detail
    ? `${segments[0].name}（${segments[0].detail}）`
    : segments[0].name;

  const breakdown = (slices: { category: string; count: number; percentLabel: string }[]) =>
    slices.map((s) => `${s.category} ${s.count}名（${s.percentLabel}）`).join("・");

  return `# ${SITE_NAME}

> 始皇帝から溥儀まで、中国史上で実際に「皇帝」を名乗った${overview.emperorCount}人の在位期間・死因・即位経路などを、正史原典に基づいて集計・可視化する日本語サイトです。

## 主要な数字

いずれもデータセット本体を集計した値で、サイトの概要ダッシュボードに出ている数字と同じものです。数え方の定義は「このサイトについて」にあります。

- 収録した皇帝は${overview.emperorCount}名、王朝・政権は${highlights.dynastyCount}。対象年代は${highlights.yearSpanLabel}です。
- 平均在位期間は${overview.avgReignLabel}です。最長は${overview.longestReign.name}（${overview.longestReign.dynastyLabel}）の${overview.longestReign.durationLabel}、最短は${overview.shortestReign.name}（${overview.shortestReign.dynastyLabel}）の${overview.shortestReign.durationLabel}です。
- ${violentLabel}は${violentCount}名で、全体の${violentPercent.toFixed(1)}%にあたります。
- 死因の内訳は${breakdown(highlights.deathCauses)}です。
- 即位経路の内訳は${breakdown(highlights.accessionRoutes)}です。
- 在位が短いほど${segments[0].name}の割合が高くなります。${bands.map((b) => `${b.label}は${b.count}名で${b.violentPercent}%`).join("・")}。
- 一度退位したあとに復位した皇帝は${overview.restorationCount}名です。

## まず読むページ

- [トップページ](${SITE_URL}/): サイト全体の概要と主要な統計
- [皇帝一覧](${SITE_URL}/emperors): ${overview.emperorCount}人の検索可能な一覧と個別ページへの入口
- [データベース](${SITE_URL}/database): ${overview.emperorCount}人を1つの表で確認できます。並べ替え・検索・絞り込みに対応
- [系譜図](${SITE_URL}/kinship): 皇帝と親族のつながりを時代別に確認できる家系図
- [このサイトについて](${SITE_URL}/about): 収録基準、項目の定義、史料、データの扱い、訂正履歴
- [サイトマップ](${SITE_URL}/sitemap.xml): 公開ページと${overview.emperorCount}人の個別ページの一覧

## 機械利用向けデータ

- [emperors.json](${SITE_URL}/data/emperors.json): 全収録皇帝の完全な JSON データ
- [emperors.csv](${SITE_URL}/data/emperors.csv): 1行1皇帝に平坦化した CSV
- [emperors.schema.json](${SITE_URL}/data/emperors.schema.json): JSON データの構造定義

## 利用上の注意

- 収録対象は、サイトの収録基準に基づく${overview.emperorCount}人です。人数や項目の意味を推測で拡張しないでください。
- 在位日付や出来事の日付は、保存されている精度（年・月・日）自体が主張の範囲です。不明な精度を推測で補っていません。
- 紀元前の年は、数値フィールドと ISO 8601 日付フィールドで表記規則が異なります。詳細は「このサイトについて」を参照してください。
- データの訂正・検証履歴と原典の引用は、配布データおよび GitHub リポジトリで確認できます。
- データセットのライセンス、肖像画のクレジット、免責事項は「このサイトについて」に記載しています。

## 開発元と原資料

- [GitHub リポジトリ](https://github.com/kotenbu135/emperor-stats): データ、調査記録、サイトのソースコード
- [運営者 kotenbu135](https://github.com/kotenbu135): サイトの運営者

## 言語

- 本文とデータの説明は日本語です。JSON のキーと値の定義は JSON Schema と「このサイトについて」を優先してください。
`;
}

export function GET(): Response {
  return new Response(buildLlmsTxt(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
