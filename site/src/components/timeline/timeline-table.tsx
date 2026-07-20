"use client";

// 通史年表の「表で見る」。チャートのキーボード・スクリーンリーダー向け代替導線
// （時代順の王朝一覧＋皇帝名クリックで詳細ダイアログ）。開閉はTableDetailsで
// チャート本体から分離する。

import { Fragment, type ReactNode } from "react";
import { TableDetails } from "@/components/charts/scroll-bar-chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  dynastyCategoryOptions,
  formatYear,
  type EmperorRecord,
  type TimelineData,
  type TimelineDynastyBand,
} from "@/lib/emperor-types";

function spansLabel(band: TimelineDynastyBand): string {
  return band.spans
    .map((s) =>
      s.startYear === s.endYear
        ? `${formatYear(s.startYear)}年`
        : `${formatYear(s.startYear)}–${formatYear(s.endYear)}年`,
    )
    .join(" / ");
}

const categoryLabels = new Map(
  dynastyCategoryOptions.map((o) => [o.value, o.label]),
);

export function TimelineTable({
  timeline,
  recordById,
  openDetail,
}: {
  timeline: TimelineData;
  recordById: Map<string, EmperorRecord>;
  openDetail: (record: EmperorRecord) => void;
}) {
  return (
    <TableDetails summary="表で見る（時代順の王朝一覧・皇帝名クリックで詳細）">
      {() => (
        <div className="mt-2 overflow-x-auto rounded border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">時代</TableHead>
                <TableHead className="whitespace-nowrap">王朝</TableHead>
                <TableHead className="whitespace-nowrap">皇帝在位期間</TableHead>
                <TableHead className="whitespace-nowrap">区分</TableHead>
                <TableHead>皇帝（在位順）</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeline.bands.map((band) => {
                // 復位者はsegmentsに複数回現れるため、在位順を保ってユニーク化する。
                const emperorIds: string[] = [];
                const seen = new Set<string>();
                for (const seg of band.segments) {
                  if (!seen.has(seg.emperorId)) {
                    seen.add(seg.emperorId);
                    emperorIds.push(seg.emperorId);
                  }
                }
                return (
                  <TableRow key={band.key}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {band.era}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">
                      {band.label}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {spansLabel(band)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {categoryLabels.get(band.category)}
                    </TableCell>
                    <TableCell className="min-w-[16rem]">
                      {emperorIds.map((id, i): ReactNode => {
                        const record = recordById.get(id);
                        if (!record) return null;
                        return (
                          <Fragment key={id}>
                            {i > 0 && (
                              <span className="text-muted-foreground">・</span>
                            )}
                            <button
                              type="button"
                              className="cursor-pointer underline decoration-border underline-offset-2 hover:text-seal"
                              onClick={() => openDetail(record)}
                            >
                              {record.name}
                            </button>
                          </Fragment>
                        );
                      })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </TableDetails>
  );
}
