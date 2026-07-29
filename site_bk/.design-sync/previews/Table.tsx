import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "site";

const ROWS = [
  { name: "英宗（朱祁鎮）", dynasty: "明", periods: "1435年–1449年 / 1457年–1464年", count: 2, reason: "土木の変で捕虜となり弟が即位、奪門の変で復位" },
  { name: "高宗（李治）", dynasty: "唐", periods: "649年–683年", count: 1, reason: "—" },
  { name: "中宗（李顕）", dynasty: "唐", periods: "684年 / 705年–710年", count: 2, reason: "武則天に廃され廬陵王に降格、神龍革命で復位" },
  { name: "睿宗（李旦）", dynasty: "唐", periods: "684年–690年 / 710年–712年", count: 2, reason: "武則天の即位で退位、韋后誅殺後に再即位" },
];

/** 復位した皇帝の一覧表（/death-accession の実装から）。 */
export function RestorationTable() {
  return (
    <div className="max-h-[420px] overflow-y-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>皇帝</TableHead>
            <TableHead>王朝</TableHead>
            <TableHead>在位期間</TableHead>
            <TableHead className="text-right">即位回数</TableHead>
            <TableHead className="min-w-[240px]">復位の経緯</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROWS.map((r) => (
            <TableRow key={r.name}>
              <TableCell className="align-top">{r.name}</TableCell>
              <TableCell className="align-top text-muted-foreground">
                {r.dynasty}
              </TableCell>
              <TableCell className="align-top tabular-nums text-muted-foreground">
                {r.periods}
              </TableCell>
              <TableCell className="align-top text-right tabular-nums">
                {r.count}
              </TableCell>
              <TableCell className="whitespace-normal align-top text-muted-foreground">
                {r.reason}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** キャプション付きの短い集計表。数値列は tabular-nums + 右寄せで揃える。 */
export function WithCaption() {
  const rows = [
    { era: "秦漢", n: 41, avg: "10.6年" },
    { era: "魏晋南北朝", n: 122, avg: "7.4年" },
    { era: "隋唐", n: 48, avg: "12.9年" },
    { era: "元明清", n: 45, avg: "18.2年" },
  ];
  return (
    <div className="max-w-md rounded-md border border-border">
      <Table>
        <TableCaption>時代区分別の平均在位年数（数え方は「このサイトについて」）</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>時代</TableHead>
            <TableHead className="text-right">人数</TableHead>
            <TableHead className="text-right">平均在位</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.era}>
              <TableCell>{r.era}</TableCell>
              <TableCell className="text-right tabular-nums">{r.n}</TableCell>
              <TableCell className="text-right tabular-nums">{r.avg}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
