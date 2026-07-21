import type { EmperorRecord } from "@/lib/emperor-types";
import { portraitThumbUrl } from "@/components/emperors/portrait";

export function EmperorTooltip({
  record,
  valueLabel,
  formattedValue,
  details = [],
  hint,
}: {
  record: Pick<EmperorRecord, "name" | "dynastyLabel" | "portraitUrl">;
  valueLabel: string;
  formattedValue: string;
  /** 指標値の下に添える補足項目（死因・即位経路など）。グラフから読み取れる値の
   *  再掲だけにならないよう、ホバーだけで人物の概要が掴めるようにする。 */
  details?: { label: string; value: string }[];
  /** 最下部の操作ヒント（例: クリックで全項目を表示）。 */
  hint?: string;
}) {
  return (
    <div
      className="rounded-md border border-border bg-background p-3 text-xs text-foreground shadow-md"
      // Nivoのツールチップラッパーは幅0のアンカーに絶対配置されるため、width: max-contentで
      // 内容幅まで広げたうえで上限だけ設ける（上限超過時はmin-w-0側でtruncate）。
      style={{ width: "max-content", maxWidth: 260 }}
    >
      <div className="flex items-center gap-3">
        {record.portraitUrl && (
          // 44px表示に360pxフルは過剰なため、unoptimizedのnext/imageでなく
          // 320pxサムネを素の<img>で出す。
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={portraitThumbUrl(record.portraitUrl)}
            alt={`${record.name}の肖像`}
            width={44}
            height={58}
            loading="lazy"
            decoding="async"
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
      {details.length > 0 && (
        <div className="mt-2 flex max-w-[210px] flex-wrap gap-x-3 gap-y-0.5 border-t border-border/60 pt-2 text-muted-foreground">
          {details.map((d) => (
            <span key={d.label} className="whitespace-nowrap">
              {d.label}：<span className="text-foreground/80">{d.value}</span>
            </span>
          ))}
        </div>
      )}
      {hint && (
        <div className="mt-1.5 text-[10px] text-muted-foreground/70">{hint}</div>
      )}
    </div>
  );
}
