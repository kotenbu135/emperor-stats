// 皇帝個別ページのヒーロー（ページ先頭・h1 を持つ唯一のブロック）。
//
// 2026-08-01 の作り替えまでは共通の PageHeader（名前1行＋王朝と在位の1行）で、
// 肖像は本文の基本情報 dl の脇に幅144pxで並んでいた。一覧カードは面の7割が肖像
// なので、カードから遷移したときに「同じ人物の面に来た」感じが出ていなかった。
// 肖像をページ先頭の主役に上げ、王朝・在位・死因・即位経路・年齢の要約をその隣に置く。
//
// 肖像アセットは**全144枚が360×480**なので、引き伸ばせる上限は200px前後
// （それ以上に出すと元画像の解像度を超える）。
//
// **肖像なしは221名・61%**（五胡十六国84%・南北朝80%）で、こちらが多数派に近い。
// **肖像が無いときは枠ごと出さず、名前主導の組みに切り替える**（2026-08-01 ユーザー決定・
// 2案の実物を撮って判断した。tools/shots/hero-noportrait-{A-none,B-monogram}-*.png）。
// 一覧カードと同じモノグラムを200px枠に置く案は、ページ先頭の一等地が61%の皇帝で
// 「画像がありません」の告知になるため採らない。肖像あり／なしで左右の組みが変わる
// 非対称は許容する。

import { Portrait } from "@/components/emperors/portrait";
import { RubyText } from "@/components/ui/ruby-text";
import { rubyOf } from "@/lib/name-readings";
import { cardSubtitleOf } from "@/lib/card-subtitle";
import { dynastyColorHex, dynastyColorSlot } from "@/lib/dynasty-colors";
import { dynastyContextLabel, type EmperorRecord } from "@/lib/emperor-types";

/** 要約チップ。値が無い項目は呼び出し側で落とす。 */
function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}

/** 「16歳で即位、70歳で没」。両方不詳なら null（チップごと出さない）。 */
function ageChipValue(record: EmperorRecord): string | null {
  const parts: string[] = [];
  if (record.accessionAge !== null) parts.push(`${record.accessionAge}歳で即位`);
  if (record.deathAge !== null) parts.push(`${record.deathAge}歳で没`);
  return parts.length > 0 ? parts.join("、") : null;
}

export function EmperorHero({ record }: { record: EmperorRecord }) {
  const ageValue = ageChipValue(record);
  // 皇帝号だけでは誰か分かりにくい人物向けの補助名（諱・通用名）。
  // **諱をそのまま出すと106/365で重複する** — 「王莽」「宇文化及」のように表示名が
  // 諱そのものの人物や、「太祖・朱全忠」のように皇帝号へ諱を併記している人物が多い。
  // 導出規則と人物別上書き（遼の漢風名・清の愛新覚羅姓省略など）は一覧カードと共用。
  const subtitle = cardSubtitleOf(record.id, record.personalName, record.name);
  return (
    <header className="border-b border-border bg-background px-gutter py-section md:px-gutter-wide">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
          {record.portraitUrl !== null && (
            // 枠は肖像の実体と同じ3:4。狭い画面では144pxに落として、名前と要約が
            // 肖像の右に残る幅を確保する（縦積みにすると先頭が肖像だけで埋まる）。
            <div className="relative aspect-[3/4] w-36 shrink-0 self-start overflow-hidden rounded-md border border-border sm:w-[200px]">
              {/* ページ先頭の肖像は LCP 要素になるので eager で取りに行く。 */}
              <Portrait record={record} sizes="200px" large priority />
            </div>
          )}
          <div className="min-w-0 flex-1">
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
              <span className="ml-2 text-muted-foreground">
                （{record.reignDurationLabel}）
              </span>
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip label="死因" value={record.deathCauseCategory} />
              <Chip label="即位" value={record.accessionRouteCategory} />
              {ageValue && <Chip label="年齢" value={ageValue} />}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
