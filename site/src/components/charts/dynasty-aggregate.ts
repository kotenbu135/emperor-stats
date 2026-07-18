// 王朝・時代横断ビュー用の集計ロジック（クライアント側で実行できる純粋関数のみ）。

import {
  deathCauseCategoryOrder,
  eraOrder,
  type DeathCauseCategory,
  type DynastyCategory,
  type EmperorRecord,
} from "@/lib/emperor-types";

export type GroupUnit = "dynasty" | "era";

export interface GroupAggRow {
  key: string;
  /** 表示名（王朝名または時代名）。 */
  label: string;
  era: string;
  emperorCount: number;
  avgReignDays: number;
  longest: { name: string; durationLabel: string };
  deathCauseCounts: Record<DeathCauseCategory, number>;
}

/**
 * 皇帝レコードを王朝（または時代）単位に集計する。
 * 返り値の並びは時代順（王朝単位のときはデータ内初出順＝ほぼ時代順）。
 */
export function aggregateByGroup(
  records: EmperorRecord[],
  unit: GroupUnit,
  categoryValue: DynastyCategory | "all",
): GroupAggRow[] {
  const filtered =
    categoryValue === "all"
      ? records
      : records.filter((r) => r.dynastyCategory === categoryValue);

  const rows = new Map<string, GroupAggRow>();
  for (const r of filtered) {
    const key = unit === "dynasty" ? r.dynastyKey : r.eraLabel;
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        label: unit === "dynasty" ? r.dynastyLabel : r.eraLabel,
        era: r.eraLabel,
        emperorCount: 0,
        avgReignDays: 0,
        longest: { name: r.name, durationLabel: r.reignDurationLabel },
        deathCauseCounts: Object.fromEntries(
          deathCauseCategoryOrder.map((c) => [c, 0]),
        ) as Record<DeathCauseCategory, number>,
      };
      rows.set(key, row);
    }
    // avgReignDaysはいったん合計を貯め、最後に件数で割る。
    row.avgReignDays += r.reignApproxDays;
    row.emperorCount += 1;
    row.deathCauseCounts[r.deathCauseCategory] += 1;
  }
  // 平均・最長在位者を確定させる。
  const longestDays = new Map<string, number>();
  for (const r of filtered) {
    const key = unit === "dynasty" ? r.dynastyKey : r.eraLabel;
    const row = rows.get(key)!;
    if ((longestDays.get(key) ?? -1) < r.reignApproxDays) {
      longestDays.set(key, r.reignApproxDays);
      row.longest = { name: r.name, durationLabel: r.reignDurationLabel };
    }
  }
  for (const row of rows.values()) {
    row.avgReignDays = row.avgReignDays / row.emperorCount;
  }

  const result = [...rows.values()];
  if (unit === "era") {
    const order = new Map(eraOrder.map((e, i) => [e, i]));
    result.sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99));
  }
  return result;
}
