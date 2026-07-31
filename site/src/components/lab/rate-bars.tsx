"use client";

// 候補1「親征経験率」の時代別1本棒。vendored `BarList` を並び順そのまま
// （`sortOrder="none"`）で使う — 横軸は時間なので、値の大きい順に並べ替えない。
//
// 検討記録の結論に従い、**表はこれ1つだけ**にしてある（時代の表と政権の性格の表は
// 独立でなく、時代差の大半は「その時代に並立政権がどれだけあるか」で説明がつく。
// 2つ並べると同じ事実を2回見せることになる）。
//
// 棒の上のラベルに実数（何名中何名か）を入れる。棒の長さは割合なので、
// これが無いと n=1 の近代と n=69 の南北朝が同じ重みに見える。

import { BarList } from "@/components/tremor/BarList";

export function RateBars({
  rows,
}: {
  rows: { label: string; n: number; hit: number; percent: number }[];
}) {
  return (
    <BarList
      data={rows.map((r) => ({
        key: r.label,
        name: `${r.label}　${r.hit}/${r.n}名`,
        value: r.percent,
      }))}
      sortOrder="none"
      valueFormatter={(v) => `${v}%`}
    />
  );
}
