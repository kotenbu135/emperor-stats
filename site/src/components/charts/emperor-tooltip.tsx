import Image from "next/image";
import type { EmperorRecord } from "@/lib/emperor-types";

export function EmperorTooltip({
  record,
  valueLabel,
  formattedValue,
}: {
  record: Pick<EmperorRecord, "name" | "dynastyLabel" | "portraitUrl">;
  valueLabel: string;
  formattedValue: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-md border border-border bg-background p-3 text-xs text-foreground shadow-md"
      // Nivoのツールチップラッパーは幅0のアンカーに絶対配置されるため、width: max-contentで
      // 内容幅まで広げたうえで上限だけ設ける（上限超過時はmin-w-0側でtruncate）。
      style={{ width: "max-content", maxWidth: 240 }}
    >
      {record.portraitUrl && (
        <Image
          src={record.portraitUrl}
          alt={`${record.name}の肖像`}
          width={44}
          height={58}
          className="shrink-0 rounded object-cover"
          style={{ objectPosition: "top" }}
        />
      )}
      <div className="min-w-0">
        <div className="truncate font-medium">{record.name}</div>
        <div className="truncate text-muted-foreground">{record.dynastyLabel}</div>
        <div className="mt-1 whitespace-nowrap">
          {valueLabel}：{formattedValue}
        </div>
      </div>
    </div>
  );
}
