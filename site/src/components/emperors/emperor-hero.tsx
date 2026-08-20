// 皇帝個別ページのヒーロー（ページ先頭・h1 を持つ唯一のブロック）。
//
// 2026-08-01 の作り替えまでは共通の PageHeader（名前1行＋王朝と在位の1行）で、
// 肖像は本文の基本情報 dl の脇に幅144pxで並んでいた。一覧カードは面の7割が肖像
// なので、カードから遷移したときに「同じ人物の面に来た」感じが出ていなかった。
// 肖像をページ先頭の主役に上げ、王朝・在位と名前（諱・廟号・元号ほか）をその隣に置く。
// 隣に出す要約は 2026-08-02 に死因・即位経路・年齢から名前へ入れ替えた（Chip 参照）。
//
// 肖像アセットは**全155枚が360×480**なので、引き伸ばせる上限は200px前後
// （それ以上に出すと元画像の解像度を超える）。
//
// **肖像なしは210名・58%**（五胡十六国84%・南北朝75%）で、こちらが多数派に近い。
// （数は 2026-08-05 に1件足したあとの実測。時代別の全数は /about の
// 「肖像画の出典」節が `getPortraitCoverageByEra()` から出している）
// **肖像が無いときは枠ごと出さず、名前主導の組みに切り替える**（2026-08-01 ユーザー決定・
// 2案の実物を撮って判断した。tools/shots/hero-noportrait-{A-none,B-monogram}-*.png）。
// 一覧カードと同じモノグラムを200px枠に置く案は、ページ先頭の一等地が58%の皇帝で
// 「画像がありません」の告知になるため採らない。肖像あり／なしで左右の組みが変わる
// 非対称は許容する。

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Portrait } from "@/components/emperors/portrait";
import { RubyText } from "@/components/ui/ruby-text";
import { rubyOf } from "@/lib/name-readings";
import { dynastyColorHex, dynastyColorSlot } from "@/lib/dynasty-colors";
import {
  emperorNameEntries,
  groupEmperorNameEntries,
} from "@/lib/display-name";
import { dynastyContextLabel, type EmperorRecord } from "@/lib/emperor-types";
import { SITE_NAME } from "@/lib/seo";
import { cn } from "@/lib/utils";

/** ページ送りの隣接皇帝。EmperorRecord をそのまま渡せる形にしてある。 */
export type AdjacentEmperor = { id: string; name: string; dynastyLabel: string };

/**
 * 名前のチップ（諱・廟号・諡号・元号・別称）。**行が無い皇帝では1つも出ない。**
 *
 * 2026-08-02 まではここに死因・即位経路・年齢を出していたが、いずれも直下の
 * 「基本情報」に同じ値が（年齢は順位付きで）並んでおり、重複しているだけだった
 * （ユーザー指摘）。同日に「基本情報」の隣へ足した名前ブロックのほうは、
 * **多くの皇帝で行が1つしか無く**カードの右側が空くだけだったので、両者を入れ替えた。
 * 名前は種類ごとに独立した短い語なので、行を並べるより粒で流れるチップが合う。
 *
 * ふりがな（Issue #20）。読みは ../data/name-readings.json で、未登録の名前は
 * ルビ無しで素通しする。`leading-ruby` はトグルの ON/OFF でチップの高さが動かない
 * よう、ルビの分の行間を先に確保するためのもの。
 */
function Chip({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs leading-ruby">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}

/**
 * パンくず（2026-08-02）。**ページ最上部の左端**に階層を出す。
 *
 * それまでは本文カラムの先頭（h1 より下）に「皇帝一覧へ戻る」「◯◯の皇帝一覧（n名）」の
 * 2本を並べていた。一般的な Web の作法（グローバルナビの直下・ページ見出しの上）から
 * 外れていて上位階層へ戻る導線が見つけにくく、紹介文のある皇帝ではモバイル（縦積み）で
 * 1画面ぶん下に落ちていたため、階層1本に統合してここへ上げた。
 *
 * - 最終項（現在の皇帝）は**リンクにしない**（NN/g・W3C APG。押せないことを
 *   `aria-current="page"` と色で示す）
 * - 区切りの `›` は `aria-hidden`（ol/li で階層は伝わっており、読み上げでは冗長）
 * - **`page.tsx` の BreadcrumbList JSON-LD と同じ4段**にすること（可視のパンくずと
 *   構造化データが食い違うと Google の推奨から外れる）
 * - ルビは振らない。王朝名も皇帝名もヒーロー本体（王朝行・h1）に総ルビで出ており、
 *   12px の補助行に二重で振ると行が詰まる
 */
function Breadcrumb({
  record,
  dynastyPeerCount,
}: {
  record: EmperorRecord;
  dynastyPeerCount: number;
}) {
  const trail: {
    label: string;
    href?: string;
    /** 幅が足りないときに落として良い項目（sm 未満で畳む） */
    collapse?: boolean;
  }[] = [
    // シェルのロゴにもホームリンクがあるので、狭い画面ではこの項を落とす。
    { label: SITE_NAME, href: "/", collapse: true },
    { label: "皇帝一覧", href: "/emperors" },
    // 王朝で絞った一覧。**同王朝が2名以上のときだけ**（1名の王朝＝自分だけの
    // 一覧に飛ばしても回遊にならない）。一覧の王朝フィルタ（?dynasty=）は
    // emperor-grid.tsx がマウント時に URL から復元するため、クエリ付きリンク
    // だけで絞り込み状態を再現できる。
    ...(dynastyPeerCount >= 2
      ? [
          {
            label: `${record.dynastyLabel}（${dynastyPeerCount}名）`,
            href: `/emperors?dynasty=${encodeURIComponent(record.dynastyKey)}`,
          },
        ]
      : []),
    { label: record.name },
  ];
  return (
    <nav aria-label="パンくず" className="min-w-0">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
        {trail.map((item, i) => (
          <li
            key={item.label}
            className={cn(
              "flex items-center gap-x-1.5",
              item.collapse && "hidden sm:flex",
            )}
          >
            {item.href ? (
              <Link
                href={item.href}
                className="-my-0.5 inline-block py-1 text-muted-foreground transition-colors hover:text-seal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="py-0.5 text-foreground">
                {item.label}
              </span>
            )}
            {i < trail.length - 1 && (
              <span aria-hidden className="text-muted-foreground/50">
                ›
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** ページ送りの1つ。端（前／次が無い側）は押せない見た目のまま枠だけ残す。 */
function PagerButton({
  emperor,
  direction,
}: {
  emperor: AdjacentEmperor | null;
  direction: "prev" | "next";
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const label = direction === "prev" ? "前の皇帝" : "次の皇帝";
  if (!emperor) {
    return (
      <span
        aria-hidden
        className="inline-flex size-8 items-center justify-center rounded-md border border-border/40 text-border"
      >
        <Icon className="size-4" />
      </span>
    );
  }
  return (
    <Link
      href={`/emperors/${emperor.id}`}
      title={`${label}: ${emperor.name}（${emperor.dynastyLabel}）`}
      aria-label={`${label}: ${emperor.name}`}
      className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-seal/50 hover:text-seal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal"
    >
      <Icon aria-hidden className="size-4" />
    </Link>
  );
}

export function EmperorHero({
  record,
  lead,
  dynastyPeerCount,
  prev,
  next,
}: {
  record: EmperorRecord;
  /** 紹介文（Issue #16）。段落の区切りは空行。未執筆は null。 */
  lead?: string | null;
  /** 同じ王朝の皇帝数。2名以上でパンくずに王朝の項が出る。 */
  dynastyPeerCount: number;
  /** 収録順（おおむね時代順）の前後。端では null。 */
  prev: AdjacentEmperor | null;
  next: AdjacentEmperor | null;
}) {
  // 通用名だけでは誰か分かりにくい人物向けの補助名（諱）。
  // **諱をそのまま出すと106/365で重複する** — 「王莽」「宇文化及」のように表示名が
  // 諱そのものの人物や、「太祖 朱全忠」のように通用名へ諱が入っている人物が多い。
  // 導出規則（遼の漢風名・清の愛新覚羅姓省略など）は lib/display-name.ts で一覧と共用。
  const subtitle = record.subtitle;
  // 名前のチップ。**h1 の脇に出ている補助名と同じ値は落とす** — 補助名は多くの皇帝で
  // 姓＋諱（「武帝 劉徹」の劉徹）なので、そのまま出すと同じ名前が1行下に二度並ぶ。
  //
  // **諱の行だけは落とさない**（Issue #37 単位6）。補助名が諱そのものになる人物
  // （清の11人＝載湉・上書きした二世皇帝＝胡亥）で落とすと、**姓の行だけが残って
  // 対にならない**。ここは同じ文字列がもう一度出ることより、「諱はどこまでか」が
  // ラベル付きで読めることを採る。
  const nameGroups = groupEmperorNameEntries(
    emperorNameEntries(record).filter(
      (e) => e.label === "諱" || e.value !== subtitle,
    ),
  );
  return (
    <header className="border-b border-border bg-background px-gutter py-section md:px-gutter-wide">
      <div className="mx-auto w-full max-w-4xl">
        {/* ページ最上部の行。左にパンくず、右にページ送り。**肖像の float より前**に
            置いて回り込みの外へ出す（float の後ろに置くと肖像の右へ食い込む）。
            ページ送りを本文ではなくこの行に置くのは、ページごとに縦位置がずれず
            連続で押せるため（皇帝名付きのリンクは本文末尾の nav に残してある）。 */}
        <div className="mb-5 flex items-center justify-between gap-4">
          <Breadcrumb record={record} dynastyPeerCount={dynastyPeerCount} />
          <nav
            aria-label="前後の皇帝（ページ送り）"
            className="flex shrink-0 items-center gap-1.5"
          >
            <PagerButton emperor={prev} direction="prev" />
            <PagerButton emperor={next} direction="next" />
          </nav>
        </div>
        {/* 肖像は**全幅で float**。**紹介文（Issue #16）を肖像の右に置き、
            長い本文は肖像の下へ回り込ませる**ため（2026-08-01 ユーザー指示の配置）。
            flex の2カラムだと、500字級の紹介文で右カラムだけが伸びて肖像の左下に
            大きな空白が残る。
            **sm 未満も 2026-08-04 に float へ変えた**（それまでは縦積み）。縦積みだと
            肖像の行に並ぶものが無く、390px 幅で右に約200px×190pxの空白が空いていた
            （ユーザー指摘）。ただし**480px 未満では回り込ませるのを王朝・名前・在位と
            名前チップまで**にし、紹介文は下の `clear-both min-[480px]:hidden` で肖像の
            下へ落とす — 128px の肖像の右に 500字級の本文を流すと1行13字で、狭い画面では
            読み物にならない（16pxの本文は1行16字＝約256pxを下限と置き、肖像128px＋余白16px＋
            左右の gutter 48px を引くと画面幅448pxから満たす）。
            **この換算をビューポート幅で書けるのは 640px 未満＝サイドバーが出ない帯だけ**。
            md 以上は240pxのサイドバーが挟まるので、768pxの画面でもヒーローの内幅は448pxで、
            200pxの肖像を引いた本文は224px しかない（sm 以上の回り込みは 2026-08-01 からの
            据え置きで、ここでは変えていない）。 */}
        <div>
          {record.portraitUrl !== null && (
            // 枠は肖像の実体と同じ3:4。狭い画面では128pxに落として、名前と在位が
            // 肖像の右に残る幅（390px 画面で198px）を確保する。**幅は3段**で、
            // 480px から紹介文も回り込むので肖像も160pxへ上げる。
            <div className="relative float-left mr-4 mb-4 aspect-[3/4] w-32 overflow-hidden rounded-md border border-border min-[480px]:w-40 sm:mr-6 sm:w-[200px]">
              {/* ページ先頭の肖像は LCP 要素になるので eager で取りに行く。 */}
              <Portrait
                record={record}
                sizes="(min-width: 640px) 200px, (min-width: 480px) 160px, 128px"
                large
                priority
              />
            </div>
          )}
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {/* 一覧カードの DynastyMark と同じ王朝の印。カードから遷移した先で
                  同じ符号が出ることで、色と王朝の対応が面をまたいで繋がる。 */}
              <span
                aria-hidden
                className="h-4 w-[3px] shrink-0 rounded-full"
                style={{
                  backgroundColor: dynastyColorHex(
                    dynastyColorSlot(record.dynastyKey),
                    100,
                  ),
                }}
              />
              {/* 王朝（時代）にもふりがなを振る。一覧カード・データベース表の王朝名と
                  同じ扱いにするため（Issue #20）。合成ラベルなので、読みテーブルは
                  王朝名・時代ラベルそれぞれで引く。 */}
              <span className="leading-ruby">
                <RubyText
                  source={
                    dynastyContextLabel(record) === record.dynastyLabel
                      ? rubyOf(record.dynastyLabel)
                      : `${rubyOf(record.dynastyLabel)}（${rubyOf(record.eraLabel)}）`
                  }
                />
              </span>
              <span aria-hidden>／</span>
              {record.dynastyCategory}
              {/* スキーマ v3 の standing。20名にしか立たないので、立つ人だけ出す。 */}
              {record.isRivalClaimant && (
                <span className="rounded-sm border border-border px-1.5 py-0.5 text-micro">
                  対立・僭称の皇帝
                </span>
              )}
            </p>
            {/* ふりがな（Issue #20）。読みは ../data/name-readings.json、未登録の名前は
                素通しでルビが付かない。leading-ruby は ON/OFF で行の高さが動かない
                ようにルビの分の行間を先に確保するためのもの（globals.css）。 */}
            <h1 className="mt-1.5 flex flex-wrap items-baseline gap-x-3 text-balance font-heading text-page-title font-semibold leading-ruby text-foreground">
              <RubyText source={rubyOf(record.name)} />
              {/* 補助名を h1 の中に入れるのは、皇帝号（武帝・太宗）だけでは人物が
                  特定できず、諱（劉徹・李世民）で検索されることが多いため。 */}
              {subtitle && (
                <span className="text-base font-normal text-muted-foreground">
                  <RubyText source={rubyOf(subtitle)} />
                </span>
              )}
            </h1>
            <p className="mt-2.5 text-sm tabular-nums text-foreground">
              在位 {record.periodsLabel}
              {/* 在位期間は肖像の右の狭い段でも割らない（`word-break: auto-phrase` は
                  「（54年」「33日）」で改行してしまう）。**在位年のほうは割ってよい** —
                  復位した皇帝は「1908–1912年 / 1917年 / 1934–1945年」と3期並ぶので、
                  こちらを nowrap にすると狭い画面で溢れる。 */}
              <span className="ml-2 whitespace-nowrap text-muted-foreground">
                （{record.reignDurationLabel}）
              </span>
            </p>
            {nameGroups.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {nameGroups.map((group) => (
                  <Chip
                    key={group.label}
                    label={group.label}
                    value={group.values.map((value, i) => (
                      <span key={value}>
                        {i > 0 && "・"}
                        <RubyText source={rubyOf(value)} />
                      </span>
                    ))}
                  />
                ))}
              </div>
            )}
            {/* 480px 未満でだけ紹介文を肖像の回り込みから外す（上の肖像のコメント）。 */}
            <div className="clear-both min-[480px]:hidden" />
            {/* 紹介文（Issue #16）。ページで唯一の16pxの文＝ここが「読ませる」文で
                あることを級数で示す（他の本文は14px）。行送りは leading-ruby
                （総ルビの段落はルビのある行だけ高くなり、leading-loose だと
                段落の中で行間がばらつく）。段落の区切りは空行。 */}
            {lead && (
              <div className="mt-5 space-y-4">
                {lead.split("\n\n").map((paragraph, i) => (
                  <p
                    key={i}
                    className="text-base leading-ruby text-foreground"
                  >
                    <RubyText source={paragraph} />
                  </p>
                ))}
              </div>
            )}
          </div>
          {/* float を閉じる。無いとヒーローの下境界が肖像を跨いで縮む。 */}
          <div className="clear-both" />
        </div>
      </div>
    </header>
  );
}
